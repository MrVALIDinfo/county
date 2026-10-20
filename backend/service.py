"""Glue: import, chat, review actions. Keeps server.py thin."""
import json
import time
from datetime import date, timedelta

import chatparse
import db
import demo
import forecast
import advisor
import parse_csv
import scan
import rules

PURPOSES = {  # purpose -> (category, direction override)
    "purchase": ("shopping", None), "gift": ("transfers", None), "loan": ("transfers", None),
    "split": ("transfers", None), "self": ("transfers", "transfer"),
    "income": ("income", "in"), "repay": ("transfers", "transfer"),
}


def _income(c):
    return c.execute("SELECT income_cents FROM profile WHERE id=1").fetchone()[0]


def process(c, t, source, income):
    """Insert one row. Returns mode ('silent'|'digest'|'ask') or 'dup'."""
    if t.get("ext_id") and c.execute("SELECT 1 FROM transactions WHERE ext_id=?", (t["ext_id"],)).fetchone():
        return "dup", None
    if c.execute("SELECT 1 FROM transactions WHERE date=? AND amount_cents=? AND merchant_key=? AND source!=?",
                 (t["date"], t["amount_cents"], t["merchant_key"], source)).fetchone():
        return "dup", None
    if source == "csv" and not t.get("ext_id") and c.execute(
            "SELECT 1 FROM transactions WHERE date=? AND amount_cents=? AND merchant_key=?",
            (t["date"], t["amount_cents"], t["merchant_key"])).fetchone():
        return "dup", None
    if t["counterparty_type"] == "self":
        mode, reason = "silent", None
    else:
        key = t["merchant_key"]
        if t.get("known"):
            c.execute("INSERT OR IGNORE INTO merchant_memory(merchant_key,category,n_confirmed) VALUES(?,?,2)", (key, t["category"]))
        mem = c.execute("SELECT * FROM merchant_memory WHERE merchant_key=?", (key,)).fetchone()
        if mem and t["counterparty_type"] == "merchant":
            t["category"] = mem["category"]
            if mem["n_confirmed"] >= rules.SILENT_MIN_CONFIRMED:
                t["confidence"] = max(t["confidence"], 0.92)
        mode, reason = rules.decide_ex(c, t, income)
    status = "auto" if mode == "silent" else "pending"
    cur = c.execute(
        "INSERT INTO transactions(date,amount_cents,currency,merchant,merchant_key,category,direction,counterparty_type,"
        "source,confidence,status,mode,ext_id,raw,reason) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (t["date"], t["amount_cents"], "CNY", t["merchant"], t["merchant_key"], t["category"], t["direction"],
         t["counterparty_type"], source, t["confidence"], status, mode, t.get("ext_id"), t.get("raw"), reason))
    return mode, cur.lastrowid


def import_text(c, text, source="csv"):
    rows, skipped = parse_csv.parse(text)
    income = _income(c)
    rep = {"read": len(rows) + skipped, "imported": 0, "duplicates": 0, "skipped": skipped,
           "silent": 0, "digest": 0, "ask": 0}
    for t in rows:
        mode, _ = process(c, t, source, income)
        if mode == "dup":
            rep["duplicates"] += 1
        else:
            rep["imported"] += 1
            rep[mode] += 1
    c.commit()
    return rep


def _calibrate_japan(c, gid, target, today):
    """Pick Japan-trip saved_cents so the status is 'tight' now and flips to 'ok' after a +1000 yuan deposit."""
    dep = 100000

    def ev(saved):
        c.execute("UPDATE goals SET saved_cents=? WHERE id=?", (saved, gid))
        return forecast.dashboard(c, today)

    def margin(saved):
        b, a = ev(saved), ev(saved + dep)
        if b["status"] != "tight" or a["status"] != "ok":
            return None
        return min(b["avg_flex_cents"] - b["allowance_cents"], a["allowance_cents"] - a["avg_flex_cents"] + 1)

    hi = target - dep
    best, best_m = None, -1
    for coarse in range(0, hi + 1, 20000):
        for s in (coarse, coarse + 10000):
            if s <= hi:
                m = margin(s)
                if m is not None and m > best_m:
                    best, best_m = s, m
    if best is not None:
        for s in range(max(0, best - 20000), min(hi, best + 20000) + 1, 500):
            m = margin(s)
            if m is not None and m > best_m:
                best, best_m = s, m
    c.execute("UPDATE goals SET saved_cents=? WHERE id=?", (best if best is not None else 400000, gid))
    return best is not None


def load_demo(c, today=None):
    db.wipe(c)
    today = today or date.today()
    c.execute("UPDATE profile SET income_cents=1500000, payday_day=10 WHERE id=1")
    rep = import_text(c, demo.generate(today))
    gid = None
    for name, target, days, saved in (("Japan trip", 1600000, 90, 0), ("MacBook Air", 800000, 60, 650000),
                                       ("Emergency fund", 3000000, 330, 1200000)):
        cur = c.execute("INSERT INTO goals(name,target_cents,deadline,saved_cents) VALUES(?,?,?,?)",
                        (name, target, (today + timedelta(days=days)).isoformat(), saved))
        gid = gid or cur.lastrowid
    for emergency_saved in (1200000, 800000, 400000, 0):  # rare edge dates (e.g. the 1st): lower other reserves until a flip exists
        c.execute("UPDATE goals SET saved_cents=? WHERE name='Emergency fund'", (emergency_saved,))
        if _calibrate_japan(c, gid, 1600000, today):
            break
    c.commit()
    rep["persona"] = {"nickname": "小雨"}
    return rep


def chat(c, text):
    p = chatparse.parse(text)
    if not p:
        return {"kind": "unknown"}
    p["date"] = date.today().isoformat()
    mode, tid = process(c, p, "chat", _income(c))
    c.commit()
    if mode == "dup":
        return {"kind": "dup"}
    tx = dict(c.execute("SELECT * FROM transactions WHERE id=?", (tid,)).fetchone())
    return {"kind": mode, "tx": _public(tx)}


_last_scan = 0.0


def scan_image(c, image_b64, media_type):
    global _last_scan
    if media_type not in ("image/jpeg", "image/png", "image/webp"):
        media_type = "image/jpeg"
    if len(image_b64) * 3 // 4 > 5_000_000:
        return {"kind": "error", "reason": "too_large"}
    now = time.monotonic()
    if now - _last_scan < 3:
        return {"kind": "error", "reason": "rate"}
    _last_scan = now
    r = scan.analyze(image_b64, media_type)
    if r.get("error"):
        return {"kind": "error", "reason": r["error"]}
    t = {"date": r["date"], "amount_cents": r["amount_cents"], "merchant": r["merchant"],
         "merchant_key": rules.norm_key(r["merchant"]), "category": r["category"], "direction": "out",
         "counterparty_type": "merchant", "confidence": r["confidence"], "known": False}
    mode, tid = process(c, t, "screenshot", _income(c))
    c.commit()
    if mode == "dup":
        return {"kind": "dup"}
    tx = dict(c.execute("SELECT * FROM transactions WHERE id=?", (tid,)).fetchone())
    return {"kind": mode, "tx": _public(tx), "demo": r["demo"]}


def ask(c, d):
    kind = d.get("kind") if d.get("kind") in ("goal", "save", "budget", "text") else "text"
    return advisor.answer(c, kind, d.get("id"), str(d.get("text", ""))[:300])


def _public(tx):
    return {k: tx[k] for k in ("id", "date", "amount_cents", "merchant", "category", "direction",
                                "counterparty_type", "status", "mode", "confidence", "reason")}


def pending(c):
    rows = c.execute("SELECT * FROM transactions WHERE status='pending' ORDER BY mode DESC, date DESC LIMIT 100").fetchall()
    return [_public(dict(r)) for r in rows]


def recent(c, n=12):
    rows = c.execute("SELECT * FROM transactions ORDER BY date DESC, id DESC LIMIT ?", (n,)).fetchall()
    return [_public(dict(r)) for r in rows]


def confirm(c, tx_id, category):
    r = c.execute("SELECT * FROM transactions WHERE id=?", (tx_id,)).fetchone()
    if not r:
        return {"updated": 0}
    if category not in scan.CATEGORIES:
        raise ValueError("bad category")
    if category != "other":
        rules.learn(c, r["merchant_key"], category)
    cur = c.execute(
        "UPDATE transactions SET category=?, status='confirmed', confidence=1.0 "
        "WHERE (id=? OR (merchant_key=? AND status='pending' AND mode='digest'))",
        (category, tx_id, r["merchant_key"]))
    c.commit()
    return {"updated": cur.rowcount}


def resolve(c, tx_id, purpose):
    cat, direction = PURPOSES.get(purpose, ("other", None))
    r = c.execute("SELECT * FROM transactions WHERE id=?", (tx_id,)).fetchone()
    if not r:
        return {"updated": 0}
    if purpose == "purchase" and r["category"] != "transfers":
        cat = r["category"]
    c.execute("UPDATE transactions SET category=?, direction=COALESCE(?,direction), status='confirmed', confidence=1.0 WHERE id=?",
              (cat, direction, tx_id))
    c.commit()
    return {"updated": 1}


def set_goal(c, d):
    cap = 10 ** 12
    vals = (str(d.get("name", ""))[:60] or "Goal", min(cap, max(1, int(d.get("target_cents", 0)))), str(d.get("deadline", "")),
            min(cap, max(0, int(d.get("saved_cents", 0)))))
    if d.get("id"):
        gid = int(d["id"])
        cur = c.execute("UPDATE goals SET name=?,target_cents=?,deadline=?,saved_cents=? WHERE id=?", vals + (gid,))
        if not cur.rowcount:
            raise ValueError("goal not found")
    else:
        gid = c.execute("INSERT INTO goals(name,target_cents,deadline,saved_cents) VALUES(?,?,?,?)", vals).lastrowid
    c.commit()
    return {"id": gid}


def delete_goal(c, gid):
    c.execute("DELETE FROM goals WHERE id=?", (gid,))
    c.commit()


def deposit_goal(c, gid, amount_cents):
    amount_cents = max(-10 ** 12, min(10 ** 12, amount_cents))
    c.execute("UPDATE goals SET saved_cents=MIN(1000000000000,MAX(0,saved_cents+?)) WHERE id=?", (amount_cents, gid))
    c.commit()


def transactions(c, q):
    where, args = ["1=1"], []
    year, month, day = q.get("year"), q.get("month"), q.get("day")

    def _rng(v, lo, hi, name):
        n = int(v)
        if not lo <= n <= hi:
            raise ValueError(name + " out of range")
        return n

    if year:
        prefix = f"{_rng(year, 1900, 2200, 'year'):04d}"
        if month:
            prefix += f"-{_rng(month, 1, 12, 'month'):02d}"
            if day:
                prefix += f"-{_rng(day, 1, 31, 'day'):02d}"
        where.append("date LIKE ?")
        args.append(prefix + "%")
    if q.get("category"):
        where.append("category=?")
        args.append(q["category"])
    if q.get("direction") in ("out", "in"):
        where.append("direction=?")
        args.append(q["direction"])
    if q.get("q"):
        where.append("merchant LIKE ?")
        args.append("%" + q["q"][:40].replace("%", "") + "%")
    w = " AND ".join(where)
    rows = c.execute(f"SELECT * FROM transactions WHERE {w} ORDER BY date DESC, id DESC LIMIT 400", args).fetchall()
    tot = {r["direction"]: r["s"] for r in c.execute(
        f"SELECT direction, SUM(amount_cents) s FROM transactions WHERE {w} AND (status!='pending' OR mode='digest') GROUP BY direction",
        args).fetchall()}
    years = [r[0] for r in c.execute("SELECT DISTINCT substr(date,1,4) y FROM transactions ORDER BY y DESC").fetchall()]
    return {"items": [_public(dict(r)) for r in rows], "total_out": tot.get("out", 0), "total_in": tot.get("in", 0), "years": years}


def set_profile(c, d):
    c.execute("UPDATE profile SET payday_day=?, income_cents=? WHERE id=1",
              (max(1, min(31, int(d.get("payday_day", 5)))), min(10 ** 12, max(0, int(d.get("income_cents", 0))))))
    c.commit()


FRIENDS = [("佳怡", 0.38), ("思远", 0.31), ("明轩", 0.24), ("雨桐", 0.19), ("浩然", 0.08)]


def state(c):
    d = forecast.dashboard(c, date.today())
    d["recent"] = recent(c)
    d["pending_list"] = pending(c)
    board = [{"name": n, "rate": r, "me": False} for n, r in FRIENDS]
    board.append({"name": "me", "rate": d["savings_rate"], "me": True})
    d["leaderboard"] = sorted(board, key=lambda x: -x["rate"])
    return d
