"""All money math lives here (integers, cents). See docs/SPEC.md §5-6."""
import calendar
import json
import math
from datetime import date, timedelta

from rules import FLEX_EXCLUDED

COUNTED = "direction=? AND (status IN ('auto','confirmed') OR (status='pending' AND mode='digest'))"


def add_months(d, n):
    y = d.year + (d.month - 1 + n) // 12
    m = (d.month - 1 + n) % 12 + 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def payday_in(y, m, pd):
    return date(y, m, min(pd, calendar.monthrange(y, m)[1]))


def cycle(today, pd):
    p = payday_in(today.year, today.month, pd)
    if p <= today:
        return p, payday_in(*divmod_month(today, 1), pd)
    return payday_in(*divmod_month(today, -1), pd), p


def divmod_month(d, n):
    m0 = d.year * 12 + d.month - 1 + n
    return m0 // 12, m0 % 12 + 1


def _sum(c, direction, d0, d1, flex=False):
    sql = f"SELECT category, SUM(amount_cents) s FROM transactions WHERE {COUNTED} AND date>=? AND date<=? GROUP BY category"
    rows = c.execute(sql, (direction, d0.isoformat(), d1.isoformat())).fetchall()
    return sum(r["s"] for r in rows if not flex or r["category"] not in FLEX_EXCLUDED)


def goals_info(c, today):
    out = []
    for g in c.execute("SELECT * FROM goals ORDER BY deadline, id").fetchall():
        try:
            dl = date.fromisoformat(g["deadline"])
        except (TypeError, ValueError):
            dl = add_months(today, 6)
        days_to = (dl - today).days
        months_left = max(1, math.ceil(days_to / 30))
        remaining = max(0, g["target_cents"] - g["saved_cents"])
        out.append({
            "id": g["id"], "name": g["name"], "target_cents": g["target_cents"], "saved_cents": g["saved_cents"],
            "deadline": dl.isoformat(), "days_to_deadline": days_to, "months_left": months_left,
            "remaining_cents": remaining, "monthly_needed_cents": math.ceil(remaining / months_left),
            "progress": min(1.0, g["saved_cents"] / g["target_cents"]) if g["target_cents"] else 0,
        })
    return out


def dashboard(c, today):
    prof = c.execute("SELECT * FROM profile WHERE id=1").fetchone()
    fixed = json.loads(prof["fixed_json"] or "[]")
    start, nxt = cycle(today, prof["payday_day"])
    cycle_days = (nxt - start).days
    days_left = max(1, (nxt - today).days)
    goals = goals_info(c, today)
    needed = sum(g["monthly_needed_cents"] for g in goals)

    detected_income = c.execute(
        f"SELECT COALESCE(SUM(amount_cents),0) FROM transactions WHERE {COUNTED} AND category='income' AND date>=? AND date<=?",
        ("in", start.isoformat(), today.isoformat())).fetchone()[0]
    income = detected_income if detected_income > 0 else prof["income_cents"]
    spent = _sum(c, "out", start, today)
    balance = income - spent

    upcoming = 0
    d = today + timedelta(days=1)
    while d < nxt:
        upcoming += sum(f["amount_cents"] for f in fixed if min(f["day"], calendar.monthrange(d.year, d.month)[1]) == d.day)
        d += timedelta(days=1)

    free = balance - upcoming - needed
    allowance = max(0, free // days_left)
    flex14 = _sum(c, "out", today - timedelta(days=13), today, flex=True)
    avg_flex = flex14 // 14
    status = "over" if free < 0 else ("tight" if avg_flex > allowance else "ok")

    fixed_total = sum(f["amount_cents"] for f in fixed)
    day_target = max(0, (prof["income_cents"] - fixed_total - needed) // max(1, cycle_days))
    per_day = {r["date"]: r["s"] for r in c.execute(
        f"SELECT date, SUM(amount_cents) s FROM transactions WHERE {COUNTED} AND date>=? AND date<=? "
        f"AND category NOT IN ('housing','subscriptions','income') GROUP BY date",
        ("out", start.isoformat(), today.isoformat()))}
    strip = []
    for i in range(cycle_days):
        dd = start + timedelta(days=i)
        spent_d = per_day.get(dd.isoformat(), 0)
        state = "today" if dd == today else ("future" if dd > today else ("ok" if spent_d <= day_target else "over"))
        strip.append({"date": dd.isoformat(), "spent_cents": spent_d, "state": state})

    cats = c.execute(
        f"SELECT category, SUM(amount_cents) s FROM transactions WHERE {COUNTED} AND date>=? AND date<=? "
        f"AND category NOT IN ('housing','subscriptions','income','transfers') GROUP BY category ORDER BY s DESC",
        ("out", start.isoformat(), today.isoformat())).fetchall()
    flex_total = sum(r["s"] for r in cats) or 1
    elapsed = max(1, (today - start).days + 1)
    advice = []
    for r in cats[:3]:
        daily = r["s"] / elapsed
        saving = int(0.2 * daily * days_left)
        faster = round(saving / (needed / 30)) if needed else None
        advice.append({"category": r["category"], "share": round(r["s"] / flex_total, 3),
                       "total_cents": r["s"], "saving_cents": saving, "days_faster": faster})

    for a in advice:
        q = (f"FROM transactions WHERE {COUNTED} AND date>=? AND date<=? AND category=?", ("out", start.isoformat(), today.isoformat(), a["category"]))
        rows = c.execute("SELECT merchant, COUNT(*) n, SUM(amount_cents) s " + q[0] + " GROUP BY merchant_key ORDER BY s DESC LIMIT 4", q[1]).fetchall()
        a["merchants"] = [{"merchant": r["merchant"], "n": r["n"], "total_cents": r["s"]} for r in rows]
        big = c.execute("SELECT merchant, date, amount_cents " + q[0] + " ORDER BY amount_cents DESC LIMIT 1", q[1]).fetchone()
        a["biggest"] = dict(big) if big else None
        a["count"] = c.execute("SELECT COUNT(*) " + q[0], q[1]).fetchone()[0]

    projected_saving = prof["income_cents"] - fixed_total - avg_flex * 30
    for g in goals:
        share = g["monthly_needed_cents"] / needed if needed else 0
        pace = projected_saving * share
        g["status"] = "ahead" if g["remaining_cents"] == 0 or pace >= g["monthly_needed_cents"] * 1.1 else ("on_track" if pace >= g["monthly_needed_cents"] else "behind")
        g["projected_date"] = None
        if g["remaining_cents"] == 0:
            g["projected_date"] = today.isoformat()
        elif pace > 0:
            g["projected_date"] = (today + timedelta(days=int(g["remaining_cents"] / pace * 30))).isoformat()
    savings_rate = max(0.0, min(1.0, projected_saving / prof["income_cents"])) if prof["income_cents"] else 0.0

    pend = c.execute("SELECT mode, COUNT(*) n FROM transactions WHERE status='pending' GROUP BY mode").fetchall()
    pending = {r["mode"]: r["n"] for r in pend}
    n_tx = c.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
    return {
        "today": today.isoformat(), "has_data": n_tx > 0, "tx_count": n_tx,
        "cycle": {"start": start.isoformat(), "next_payday": nxt.isoformat(), "days": cycle_days, "days_left": days_left},
        "income_cents": income, "spent_cents": spent, "balance_cents": balance,
        "projected_saving_cents": int(projected_saving), "upcoming_fixed_cents": upcoming, "fixed_total_cents": fixed_total, "goal_reserve_cents": needed, "free_cents": free,
        "allowance_cents": allowance, "avg_flex_cents": avg_flex, "status": status,
        "strip": strip, "day_target_cents": day_target, "advice": advice, "goals": goals,
        "savings_rate": round(savings_rate, 3), "pending": {"digest": pending.get("digest", 0), "ask": pending.get("ask", 0)},
        "profile": {"payday_day": prof["payday_day"], "income_cents": prof["income_cents"]},
    }
