"""Append-only, hash-chained audit log. Records who did what and the outcome; never request bodies,
passwords or tokens.  hash = SHA-256(prev_hash | ts | user | role | action | status | ip)."""
import hashlib
import threading
from datetime import datetime, timezone

GENESIS = "0" * 64
_lock = threading.Lock()


def _digest(prev, ts, user, role, action, status, ip):
    return hashlib.sha256("|".join((prev, ts, user, role, action, status, ip)).encode("utf-8")).hexdigest()


def _clean(v, n=64):
    return "".join(ch for ch in str(v if v is not None else "")[:n] if ch.isprintable() and ch != "|")


def record(c, user, role, action, status, ip):
    user, role, action, status, ip = _clean(user), _clean(role), _clean(action, 80), _clean(status), _clean(ip, 45)
    ts = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
    with _lock:
        r = c.execute("SELECT hash FROM audit ORDER BY id DESC LIMIT 1").fetchone()
        prev = r["hash"] if r else GENESIS
        c.execute("INSERT INTO audit(ts,user,role,action,status,ip,prev_hash,hash) VALUES(?,?,?,?,?,?,?,?)",
                  (ts, user, role, action, status, ip, prev, _digest(prev, ts, user, role, action, status, ip)))
        c.commit()


def verify_chain(c):
    """-> (ok, first_broken_id or None). Checks every row's hash and its link to the previous row."""
    prev = GENESIS
    for r in c.execute("SELECT * FROM audit ORDER BY id"):
        if r["prev_hash"] != prev or r["hash"] != _digest(
                r["prev_hash"], r["ts"], r["user"] or "", r["role"] or "", r["action"], r["status"] or "", r["ip"] or ""):
            return False, r["id"]
        prev = r["hash"]
    return True, None


def recent(c, limit=50):
    limit = max(1, min(500, limit))
    rows = c.execute("SELECT id,ts,user,role,action,status,ip,hash FROM audit ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]
