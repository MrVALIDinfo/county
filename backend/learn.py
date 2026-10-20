"""Duolingo-style investing-education course (EDUCATIONAL ONLY, no product advice).

GET  /api/learn           course + progress + deterministic coach pick
POST /api/learn/complete  {lesson_id, correct, total} -> XP / streak / unlocks
POST /api/learn/reset     clear progress (demo)
Money numbers come from forecast.dashboard; the coach never tells anyone to buy anything.
Invalid input raises ValueError (the server turns it into HTTP 400).
"""
import datetime
import json
import os

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COURSE_PATH = os.path.join(_ROOT, "data", "learn", "course.json")
DAILY_GOAL = 20
PASS_RATIO = 0.6
MAX_TOTAL = 10
GOAL_LESSON = "l2-2"        # "match money to time": the lesson the coach links to goals / free money
CUSHION_LESSON = "l1-1"

_cache = {"mtime": None, "course": None}


def _today():
    """Server date. Tests monkeypatch this."""
    return datetime.date.today()


# ---------- course ----------
def _course():
    try:
        m = os.path.getmtime(COURSE_PATH)
    except OSError:
        raise ValueError("course_missing")
    if _cache["mtime"] != m:
        with open(COURSE_PATH, encoding="utf-8") as f:
            _cache["course"] = json.load(f)
        _cache["mtime"] = m
    return _cache["course"]


def _index(course):
    """(ordered lesson ids, id -> (lesson, level index))"""
    order, by_id = [], {}
    for li, lv in enumerate(sorted(course["levels"], key=lambda x: x["order"])):
        for ls in lv["lessons"]:
            order.append(ls["id"])
            by_id[ls["id"]] = (ls, li)
    return order, by_id


def _levels(course):
    return sorted(course["levels"], key=lambda x: x["order"])


# ---------- storage ----------
def _ensure(c):
    c.execute("CREATE TABLE IF NOT EXISTS learn_progress("
              "lesson_id TEXT PRIMARY KEY, score INTEGER NOT NULL, total INTEGER NOT NULL, "
              "best REAL NOT NULL, at TEXT NOT NULL, runs INTEGER NOT NULL DEFAULT 1)")
    c.execute("CREATE TABLE IF NOT EXISTS learn_days("
              "day TEXT PRIMARY KEY, xp INTEGER NOT NULL DEFAULT 0, lessons INTEGER NOT NULL DEFAULT 0)")


def _completed(c):
    return {r["lesson_id"]: {"score": r["score"], "total": r["total"], "at": r["at"], "best": r["best"]}
            for r in c.execute("SELECT lesson_id,score,total,best,at FROM learn_progress")}


def _unlocked(course, done):
    """Level 1 always; level n+1 once every lesson of level n is completed."""
    out, levels_done = [], []
    ok = True
    for lv in _levels(course):
        if not ok:
            break
        out.append(lv["id"])
        if all(ls["id"] in done for ls in lv["lessons"]):
            levels_done.append(lv["id"])
        else:
            ok = False
    return out, levels_done


def _streaks(days, today):
    """days: set of ISO dates with a completed lesson -> (current, best)."""
    ds = sorted(datetime.date.fromisoformat(x) for x in days)
    best = run = 0
    prev = None
    for d in ds:
        run = run + 1 if prev is not None and (d - prev).days == 1 else 1
        best = max(best, run)
        prev = d
    cur = 0
    d = today if today.isoformat() in days else today - datetime.timedelta(days=1)
    while d.isoformat() in days:
        cur += 1
        d -= datetime.timedelta(days=1)
    return cur, best


def _progress(c, course, today):
    done = _completed(c)
    unlocked, levels_done = _unlocked(course, done)
    order, by_id = _index(course)
    days = {r["day"]: r["xp"] for r in c.execute("SELECT day,xp FROM learn_days WHERE lessons>0")}
    xp = c.execute("SELECT COALESCE(SUM(xp),0) FROM learn_days").fetchone()[0]
    cur, best = _streaks(set(days), today)
    nxt = None
    for lid in order:
        if lid not in done and _levels(course)[by_id[lid][1]]["id"] in unlocked:
            nxt = lid
            break
    return {"xp": xp, "streak": cur, "best_streak": best, "daily_goal": DAILY_GOAL,
            "today_xp": days.get(today.isoformat(), 0), "last_active": max(days) if days else None,
            "completed": done, "unlocked_levels": unlocked, "next_lesson": nxt, "levels_done": levels_done}


# ---------- coach ----------
def _yuan(cents):
    return "¥{:,}".format(int(cents) // 100)


def _free_cents(c, today):
    try:
        import forecast
        return int(forecast.dashboard(c, today)["free_cents"])
    except Exception:
        return None


def _coach(c, course, prog, today):
    order, by_id = _index(course)
    done = prog["completed"]
    nxt = prog["next_lesson"]
    unlocked = prog["unlocked_levels"]
    levels = _levels(course)

    def title(lid, lang):
        return by_id[lid][0][lang]["title"]

    def avail(lid):
        return lid in by_id and lid not in done and levels[by_id[lid][1]]["id"] in unlocked

    yesterday = (today - datetime.timedelta(days=1)).isoformat()
    if nxt is None:
        first = order[0]
        return {"lesson": first, "reason": "default",
                "en": "All lessons done. Revisit any lesson to keep it fresh.",
                "zh": "所有课程已完成。随时回顾，保持熟练。"}
    if prog["last_active"] == yesterday and prog["today_xp"] == 0 and prog["streak"] > 0:
        n = prog["streak"]
        return {"lesson": nxt, "reason": "streak",
                "en": "Your %d-day streak ends tonight. One short lesson keeps it alive." % n,
                "zh": "你的 %d 天连续学习今晚就断了。学一节短课就能保住。" % n}
    if avail(CUSHION_LESSON):
        return {"lesson": CUSHION_LESSON, "reason": "cushion",
                "en": "Start with your cushion: money for surprises comes before investing.",
                "zh": "先学应急备用金：应对意外的钱，要排在投资之前。"}
    if avail(GOAL_LESSON):
        free = _free_cents(c, today)
        if free is not None and free > 0:
            return {"lesson": GOAL_LESSON, "reason": "free_money",
                    "en": "You have %s free this cycle. Learn how to match money to goals first." % _yuan(free),
                    "zh": "本周期你有 %s 可自由支配。先学学怎样让钱匹配目标。" % _yuan(free)}
        try:
            has_goal = c.execute("SELECT COUNT(*) FROM goals").fetchone()[0] > 0
        except Exception:
            has_goal = False
        if has_goal:
            return {"lesson": GOAL_LESSON, "reason": "goal",
                    "en": "You are saving for goals. Learn how time horizons shape the right kind of money.",
                    "zh": "你正在为目标存钱。学学期限如何决定钱该放在哪类工具里。"}
    return {"lesson": nxt, "reason": "default",
            "en": "Next up: %s. Short and simple." % title(nxt, "en"),
            "zh": "下一课：%s。简短易懂。" % title(nxt, "zh")}


# ---------- handlers ----------
def get_learn(c, q=None):
    _ensure(c)
    course = _course()
    today = _today()
    prog = _progress(c, course, today)
    return {"course": course, "progress": prog, "coach": _coach(c, course, prog, today)}


def _int(v):
    if isinstance(v, bool) or not isinstance(v, int):
        raise ValueError("bad_input")
    return v


def complete(c, d):
    if not isinstance(d, dict):
        raise ValueError("bad_input")
    _ensure(c)
    course = _course()
    lid = d.get("lesson_id")
    order, by_id = _index(course)
    if not isinstance(lid, str) or lid not in by_id:
        raise ValueError("bad_input")
    correct, total = _int(d.get("correct")), _int(d.get("total"))
    if not (1 <= total <= MAX_TOTAL and 0 <= correct <= total):
        raise ValueError("bad_input")
    lesson, li = by_id[lid]
    today = _today()
    day = today.isoformat()
    done = _completed(c)
    before, _ = _unlocked(course, done)
    if _levels(course)[li]["id"] not in before:
        raise ValueError("bad_input")

    ratio = correct / total
    passed = ratio >= PASS_RATIO
    gained = 0
    if passed:
        base = int(lesson["xp"] * ratio + 0.5)
        gained = base if lid not in done else max(1, int(base * 0.5 + 0.5))
        prev = c.execute("SELECT best,runs FROM learn_progress WHERE lesson_id=?", (lid,)).fetchone()
        best = max(ratio, prev["best"]) if prev else ratio
        c.execute("INSERT INTO learn_progress(lesson_id,score,total,best,at,runs) VALUES(?,?,?,?,?,1) "
                  "ON CONFLICT(lesson_id) DO UPDATE SET score=excluded.score,total=excluded.total,"
                  "best=?,at=excluded.at,runs=runs+1", (lid, correct, total, round(best, 3), day, round(best, 3)))
        c.execute("INSERT INTO learn_days(day,xp,lessons) VALUES(?,?,1) "
                  "ON CONFLICT(day) DO UPDATE SET xp=xp+excluded.xp,lessons=lessons+1", (day, gained))
        c.commit()
    prog = _progress(c, course, today)
    after = prog["unlocked_levels"]
    new = [x for x in after if x not in before]
    return {"ok": True, "xp_gained": gained, "xp": prog["xp"], "streak": prog["streak"],
            "today_xp": prog["today_xp"], "daily_goal_hit": prog["today_xp"] >= DAILY_GOAL,
            "completed": passed, "level_up": new[0] if new else None, "unlocked": after}


def reset(c, d=None):
    _ensure(c)
    c.execute("DELETE FROM learn_progress")
    c.execute("DELETE FROM learn_days")
    c.commit()
    return {"ok": True}


def register(GET, POST):
    GET["/api/learn"] = get_learn
    POST["/api/learn/complete"] = complete
    POST["/api/learn/reset"] = reset
