"""Mock 'Ask AI' planner. Deterministic: every number comes from forecast.dashboard.
No external model is called; the frontend words the plan in the user's language.
Later this can hand the same structured plan to Claude for phrasing."""
import math
from datetime import date, timedelta

import forecast

FRIEND_MONTHLY_CENTS = 20000  # mock: each invited friend adds about 200 yuan per month to a shared goal
GOAL_WORDS = ("goal", "faster", "trip", "plan", "目标", "更快", "цель", "быстрее")
SAVE_WORDS = ("save", "saving", "cut", "reduce", "expens", "spend less", "tip", "advice", "省", "节省", "建议", "экон", "совет")


def _eta(today, remaining, pace):
    if remaining <= 0:
        return today
    if pace <= 0:
        return None
    return today + timedelta(days=int(remaining / pace * 30))


def _monthly(a, d):
    """advice['saving_cents'] covers only the days left in the cycle; scale it to a month."""
    return int(a["saving_cents"] / max(1, d["cycle"]["days_left"]) * 30)


def _goal_pace(d, g):
    needed = d["goal_reserve_cents"]
    share = g["monthly_needed_cents"] / needed if needed else 0
    return max(0.0, d["projected_saving_cents"] * share)


def _iso(x):
    return x.isoformat() if x else None


def goal_plan(d, gid, today):
    active = [x for x in d["goals"] if x["remaining_cents"] > 0]
    g = next((x for x in d["goals"] if str(x["id"]) == str(gid)), None) or (active[0] if active else (d["goals"][0] if d["goals"] else None))
    if not g:
        return {"intent": "no_goal"}
    if g["remaining_cents"] <= 0:
        return {"intent": "goal_done", "goal": {"id": g["id"], "name": g["name"]}}
    pace = _goal_pace(d, g)
    steps, extra = [], 0
    for a in [a for a in d["advice"] if a["share"] >= 0.15][:2]:
        m = _monthly(a, d)
        if m > 0:
            steps.append({"type": "cut", "category": a["category"], "monthly_cents": m})
            extra += m
    gap = max(0, g["monthly_needed_cents"] - pace - extra)
    if gap > 0:
        weekly = max(1000, math.ceil(gap / 4.3 / 1000) * 1000)
        steps.append({"type": "weekly", "weekly_cents": weekly, "monthly_cents": int(weekly * 4.3)})
        extra += int(weekly * 4.3)
    steps = steps[:2] + [{"type": "friends", "n": 2, "each_cents": FRIEND_MONTHLY_CENTS, "monthly_cents": 2 * FRIEND_MONTHLY_CENTS}]
    extra = sum(s["monthly_cents"] for s in steps)
    now = _eta(today, g["remaining_cents"], pace)
    new = _eta(today, g["remaining_cents"], pace + extra)
    deadline = date.fromisoformat(g["deadline"])
    return {"intent": "goal", "goal": {"id": g["id"], "name": g["name"], "remaining_cents": g["remaining_cents"], "deadline": g["deadline"]},
            "steps": steps, "extra_monthly_cents": extra, "eta_now": _iso(now), "eta_new": _iso(new),
            "days_faster": (now - new).days if now and new else None, "on_time": bool(new and new <= deadline)}


def save_plan(d, today):
    steps = [{"type": "cut", "category": a["category"], "monthly_cents": _monthly(a, d), "share": a["share"]} for a in d["advice"][:3]]
    total = sum(s["monthly_cents"] for s in steps)
    goal = None
    active = [x for x in d["goals"] if x["remaining_cents"] > 0]
    if active:
        g = active[0]
        pace = _goal_pace(d, g)
        now, new = _eta(today, g["remaining_cents"], pace), _eta(today, g["remaining_cents"], pace + total)
        goal = {"id": g["id"], "name": g["name"], "days_faster": (now - new).days if now and new else None}
    return {"intent": "save", "steps": steps, "total_monthly_cents": total, "goal": goal}


def budget_plan(d):
    return {"intent": "budget", "allowance_cents": d["allowance_cents"], "status": d["status"], "days_left": d["cycle"]["days_left"],
            "top_category": d["advice"][0]["category"] if d["advice"] else None}


def classify(text, d):
    low = (text or "").lower()
    for g in d["goals"]:
        if g["name"].lower() in low:
            return "goal", g["id"]
    active = [g for g in d["goals"] if g["remaining_cents"] > 0] or d["goals"]
    if any(w in low for w in GOAL_WORDS) and active:
        return "goal", active[0]["id"]
    if any(w in low for w in SAVE_WORDS):
        return "save", None
    return "budget", None


def answer(c, kind, gid, text):
    today = date.today()
    d = forecast.dashboard(c, today)
    if kind == "text":
        kind, gid = classify(text, d)
    if kind == "goal":
        return goal_plan(d, gid, today)
    if kind == "save":
        return save_plan(d, today)
    return budget_plan(d)
