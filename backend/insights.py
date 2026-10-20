"""insights extension: weekly summary, streaks/badges, per-goal pace, monthly report. Money math = integers (cents)."""
import calendar
from datetime import date, timedelta

import forecast
from forecast import COUNTED

NON_FLEX = ("housing", "subscriptions", "income", "transfers")
_NF = ",".join("'%s'" % x for x in NON_FLEX)
STREAK_WINDOW = 60


def _per_day_flex(c, d0, d1):
    rows = c.execute(
        f"SELECT date, SUM(amount_cents) s FROM transactions WHERE {COUNTED} AND date>=? AND date<=? "
        f"AND category NOT IN ({_NF}) GROUP BY date", ("out", d0.isoformat(), d1.isoformat())).fetchall()
    return {r["date"]: r["s"] for r in rows}


def _week(c, today):
    d0, p0, p1 = today - timedelta(days=6), today - timedelta(days=13), today - timedelta(days=7)
    cur = _per_day_flex(c, d0, today)
    prev = _per_day_flex(c, p0, p1)
    this_total, prev_total = sum(cur.values()), sum(prev.values())
    days = [(d0 + timedelta(days=i)) for i in range(7)]
    days = [x for x in days if x != today or cur.get(x.isoformat(), 0) > 0]  # today is unfinished: skip while empty
    best = min(days, key=lambda x: (cur.get(x.isoformat(), 0), -x.toordinal()))
    cats = c.execute(
        f"SELECT category, SUM(amount_cents) s, COUNT(*) n FROM transactions WHERE {COUNTED} AND date>=? AND date<=? "
        f"AND category NOT IN ({_NF}) GROUP BY category ORDER BY s DESC", ("out", d0.isoformat(), today.isoformat())).fetchall()
    top = None
    if cats and this_total > 0:
        top = {"category": cats[0]["category"], "total_cents": cats[0]["s"], "share": round(cats[0]["s"] / this_total, 3)}
    delta = None
    if prev_total > 0:
        delta = round((this_total - prev_total) / prev_total * 100)
    # deterministic tip code
    if this_total == 0 and prev_total == 0:
        tip = {"code": "none"}
    elif delta is not None and delta < 0:
        tip = {"code": "keep", "saved_cents": prev_total - this_total}
    elif top and top["share"] >= 0.35:
        tip = {"code": "cut_top", "category": top["category"], "monthly_cents": int(top["total_cents"] * 0.2 * 4.3)}
    elif top:
        tip = {"code": "watch_top", "category": top["category"]}
    else:
        tip = {"code": "none"}
    return {"this_cents": this_total, "prev_cents": prev_total, "delta_pct": delta,
            "best_day": {"date": best.isoformat(), "spent_cents": cur.get(best.isoformat(), 0)},
            "top_category": top, "tip": tip, "from": d0.isoformat(), "to": today.isoformat()}


def _streaks(c, today, day_target):
    """Consecutive completed days (up to yesterday) with flex spend <= daily target, from the first recorded day."""
    first = c.execute("SELECT MIN(date) m FROM transactions").fetchone()["m"]
    if not first or day_target <= 0:
        return {"current": 0, "best": 0, "ok_days": 0, "days_tracked": 0}
    start = max(date.fromisoformat(first), today - timedelta(days=STREAK_WINDOW))
    end = today - timedelta(days=1)
    if end < start:
        return {"current": 0, "best": 0, "ok_days": 0, "days_tracked": 0}
    per = _per_day_flex(c, start, end)
    cur = best = run = ok = n = 0
    d = start
    while d <= end:
        n += 1
        if per.get(d.isoformat(), 0) <= day_target:
            run += 1
            ok += 1
            best = max(best, run)
        else:
            run = 0
        d += timedelta(days=1)
    cur = run
    return {"current": cur, "best": best, "ok_days": ok, "days_tracked": n}


def _badges(c, d, streak):
    goals_done = any(g["remaining_cents"] <= 0 and g["target_cents"] > 0 for g in d["goals"])
    auto = c.execute("SELECT COUNT(*) FROM transactions WHERE status='auto'").fetchone()[0]
    top_share = d["advice"][0]["share"] if d["advice"] else None
    return [
        {"id": "week", "unlocked": streak["best"] >= 7, "progress": min(7, streak["best"]), "goal": 7},
        {"id": "streak3", "unlocked": streak["best"] >= 3, "progress": min(3, streak["best"]), "goal": 3},
        {"id": "goal", "unlocked": goals_done, "progress": 1 if goals_done else 0, "goal": 1},
        {"id": "quiet", "unlocked": auto >= 50, "progress": min(50, auto), "goal": 50},
        {"id": "smart", "unlocked": top_share is not None and top_share < 0.35,
         "progress": None if top_share is None else round(top_share * 100), "goal": 35},
    ]


def insights(c, q=None):
    today = date.today()
    d = forecast.dashboard(c, today)
    streak = _streaks(c, today, d["day_target_cents"])
    pace = {}
    needed = d["goal_reserve_cents"]
    for g in d["goals"]:
        share = g["monthly_needed_cents"] / needed if needed else 0
        pace[str(g["id"])] = int(max(0.0, d["projected_saving_cents"] * share))
    return {"today": today.isoformat(), "has_data": d["has_data"], "week": _week(c, today),
            "streak": streak, "badges": _badges(c, d, streak), "day_target_cents": d["day_target_cents"],
            "goals_pace": pace}


def report(c, q=None):
    q = q or {}
    today = date.today()
    try:
        y, m = int(q.get("year", today.year)), int(q.get("month", today.month))
        if not (1 <= m <= 12 and 1900 <= y <= 2200):
            raise ValueError
    except (TypeError, ValueError):
        y, m = today.year, today.month
    return _month(c, y, m, True)


def _month(c, y, m, with_prev):
    d0, d1 = date(y, m, 1), date(y, m, calendar.monthrange(y, m)[1])
    base = f"FROM transactions WHERE {COUNTED} AND date>=? AND date<=? AND COALESCE(counterparty_type,'')!='self' AND category!='transfers'"
    a = (d0.isoformat(), d1.isoformat())
    income = c.execute("SELECT COALESCE(SUM(amount_cents),0) " + base, ("in",) + a).fetchone()[0]
    spent = c.execute("SELECT COALESCE(SUM(amount_cents),0) " + base, ("out",) + a).fetchone()[0]
    n = c.execute("SELECT COUNT(*) " + base, ("out",) + a).fetchone()[0]
    cats = [{"category": r["category"] or "other", "total_cents": r["s"], "n": r["n"],
             "share": round(r["s"] / spent, 3) if spent else 0}
            for r in c.execute("SELECT category, SUM(amount_cents) s, COUNT(*) n " + base + " GROUP BY category ORDER BY s DESC", ("out",) + a)]
    mer = [{"merchant": r["merchant"], "n": r["n"], "total_cents": r["s"]}
           for r in c.execute("SELECT merchant, COUNT(*) n, SUM(amount_cents) s " + base + " GROUP BY merchant_key ORDER BY s DESC LIMIT 5", ("out",) + a)]
    out = {"year": y, "month": m, "income_cents": income, "spent_cents": spent, "net_cents": income - spent,
           "count": n, "empty": (income == 0 and spent == 0), "categories": cats, "merchants": mer}
    if with_prev:
        py, pm = forecast.divmod_month(d0, -1)
        p = _month(c, py, pm, False)
        out["prev"] = {"year": py, "month": pm, "income_cents": p["income_cents"], "spent_cents": p["spent_cents"], "empty": p["empty"]}
        out["spent_delta_pct"] = round((spent - p["spent_cents"]) / p["spent_cents"] * 100) if p["spent_cents"] else None
        out["income_delta_pct"] = round((income - p["income_cents"]) / p["income_cents"] * 100) if p["income_cents"] else None
        mn = c.execute("SELECT MIN(date) m, MAX(date) x FROM transactions").fetchone()
        out["min_month"] = mn["m"][:7] if mn["m"] else None
        out["max_month"] = mn["x"][:7] if mn["x"] else None
    return out


def register(GET, POST):
    GET["/api/insights"] = insights
    GET["/api/report"] = report
