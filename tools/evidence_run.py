#!/usr/bin/env python3
"""Sandbox execution-evidence run for the simulated account "Lin Xiaoyu" (synthetic persona, no real data).

Starts its OWN temporary HTTP server (127.0.0.1, random free port) on a THROWAWAY sqlite file and a throwaway
lessons-state file, drives it only through real HTTP calls (urllib + a cookie jar, JSON content type, same
endpoints and the same `fc_session` cookie flow the browser uses), logs every step, and shuts the server down.
The app requires authentication: the script creates an owner account with a strong synthetic password generated
for this run (never printed, never written to disk), then exercises consent, step-up, guest role, lockout and audit.

Usage:  python tools\\evidence_run.py
Outputs (evidence/sandbox/): sandbox_run_<ts>.log, sandbox_run_<ts>.json, account_snapshot_after_demo.json,
MANIFEST.sha256 (covers every file under evidence/), README.md. Nothing in the logs is hand-written: every value comes from a live response.
"""
import base64
import hashlib
import http.cookiejar
import json
import os
import platform
import secrets
import sqlite3
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
BACKEND = os.path.join(ROOT, "backend")
OUT = os.path.join(ROOT, "evidence", "sandbox")
sys.path.insert(0, BACKEND)

KEY_WAS_SET = bool(os.environ.pop("ANTHROPIC_API_KEY", None))  # determinism: scan must take the labelled DEMO path

import db  # noqa: E402

_TMP = tempfile.mkdtemp(prefix="evidence_sandbox_")
db.PATH = os.path.join(_TMP, "sandbox.db")  # BEFORE any db.connect()

import lessons  # noqa: E402
import server  # noqa: E402
from http.server import ThreadingHTTPServer  # noqa: E402

lessons.STATE_FILE = os.path.join(_TMP, "lessons_state.json")  # never touch data/lessons_state.json

CST = timezone(timedelta(hours=8))


def now_stamps():
    n = datetime.now(timezone.utc)
    return n.isoformat(timespec="milliseconds"), n.astimezone(CST).isoformat(timespec="milliseconds")


class Client:
    """A browser stand-in: own cookie jar, no proxies. Cookies (fc_session) are stored and replayed automatically."""

    def __init__(self, label):
        self.label = label
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(self.jar))

    def cookie(self):
        return next((c for c in self.jar if c.name == "fc_session"), None)

    def token_digest(self):
        c = self.cookie()
        return hashlib.sha256(c.value.encode()).hexdigest()[:8] if c else None   # fingerprint only, never the token


class Runner:
    def __init__(self, base):
        self.base = base
        self.owner = Client("owner")
        self.steps = []
        self.cur = None
        self.t0 = time.perf_counter()

    # ---- steps
    def begin(self, sid, desc):
        u, c = now_stamps()
        self.cur = {"id": sid, "description": desc, "ts_utc": u, "ts_asia_shanghai": c, "calls": [], "assertions": [], "notes": []}
        self.steps.append(self.cur)

    def note(self, s):
        self.cur["notes"].append(s)

    def check(self, name, cond, detail=""):
        self.cur["assertions"].append({"name": name, "result": "PASS" if cond else "FAIL", "detail": str(detail)})
        return cond

    # ---- HTTP
    def call(self, method, path, body=None, headers=None, raw=None, keys=None, client=None):
        client = client or self.owner
        h = {"Accept": "application/json"}
        data = None
        if raw is not None:
            data = raw
        elif method == "POST":
            data = json.dumps(body if body is not None else {}).encode()
            h["Content-Type"] = "application/json"
        h.update(headers or {})
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=h)
        t = time.perf_counter()
        try:
            with client.opener.open(req, timeout=60) as r:
                status, txt = r.status, r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            status, txt = e.code, e.read().decode("utf-8")
        ms = round((time.perf_counter() - t) * 1000, 1)
        try:
            js = json.loads(txt)
        except ValueError:
            js = {"_raw": txt[:200]}
        summ = summarize(body) if body is not None else ({"raw_bytes": len(raw)} if raw is not None else None)
        rec = {"client": client.label, "method": method, "path": path, "request": summ, "status": status, "latency_ms": ms,
               "response_key_fields": pick(js, keys) if keys else summarize(js)}
        self.cur["calls"].append(rec)
        return status, js


def summarize(o, depth=0):
    """Short, redacted view: long strings truncated, lists reduced to length."""
    if isinstance(o, dict):
        return {k: ("<redacted>" if k in ("password", "old", "new") else summarize(v, depth + 1)) for k, v in list(o.items())[:14]}
    if isinstance(o, list):
        return f"<list len={len(o)}>"
    if isinstance(o, str):
        return o if len(o) <= 60 else o[:57] + "..."
    return o


def pick(js, keys):
    out = {}
    for k in keys:
        cur, ok = js, True
        for part in k.split("."):
            if isinstance(cur, dict) and part in cur:
                cur = cur[part]
            else:
                ok = False
                break
        if ok:
            out[k] = summarize(cur) if isinstance(cur, (dict, list)) else cur
    return out


def yuan(c):
    return f"{c / 100:.2f}"


def main():
    started = datetime.now(timezone.utc)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    os.makedirs(OUT, exist_ok=True)

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
    port = httpd.server_address[1]
    th = threading.Thread(target=httpd.serve_forever, daemon=True)
    th.start()
    R = Runner(f"http://127.0.0.1:{port}")
    today = date.today()
    today_s = today.isoformat()
    ctx = {}

    OWNER_U, OWNER_PW = "xiaoyu", secrets.token_urlsafe(18)        # strong synthetic password, generated per run, never printed
    GUEST_U, GUEST_PW = "judge", secrets.token_urlsafe(14)
    owner = R.owner

    def login_owner(client=None):
        return R.call("POST", "/api/auth/login", {"username": OWNER_U, "password": OWNER_PW}, keys=["ok", "username", "role"], client=client)

    def ensure_stepup(why):
        s_, stt = R.call("GET", "/api/auth/status", keys=["stepup_until", "role"])
        if stt.get("stepup_until"):
            R.note(f"step-up still valid ({why}); no re-authentication needed")
            return True
        s_, r_ = R.call("POST", "/api/auth/stepup", {"password": OWNER_PW}, keys=["ok", "stepup_until"])
        R.note(f"step-up window had lapsed; re-authenticated ({why})")
        return s_ == 200

    # ---------------------------------------------------------------- S1
    R.begin("S1", "Fresh install: the app is unconfigured and every data route refuses anonymous callers")
    s, st = R.call("GET", "/api/auth/status", keys=["configured", "authenticated", "role", "consent", "idle_timeout_s"])
    R.check("HTTP 200 on the public status route", s == 200, s)
    R.check("no account exists yet (configured=false, authenticated=false)", st.get("configured") is False and st.get("authenticated") is False,
            (st.get("configured"), st.get("authenticated")))
    for m_, pth in (("GET", "/api/state"), ("POST", "/api/chat"), ("GET", "/api/export"), ("GET", "/api/audit")):
        s, r = R.call(m_, pth, {} if m_ == "POST" else None, keys=["error"])
        R.check(f"anonymous {m_} {pth} -> 401 unauthenticated", s == 401 and r.get("error") == "unauthenticated", (s, r.get("error")))

    # ---------------------------------------------------------------- S2
    R.begin("S2", "First-run owner setup (POST /api/auth/setup): password policy, HttpOnly session cookie, single owner")
    s, r = R.call("POST", "/api/auth/setup", {"username": OWNER_U, "password": "short"}, keys=["error", "min_length"])
    R.check("password shorter than 8 characters rejected (400)", s == 400 and r.get("error") == "password_too_short", (s, r.get("error")))
    R.check("no cookie issued on a failed setup", owner.cookie() is None, owner.cookie() is not None)
    s, r = R.call("POST", "/api/auth/setup", {"username": OWNER_U, "password": OWNER_PW}, keys=["ok", "username", "role"])
    R.check("owner created and logged in (200, role owner)", s == 200 and r.get("role") == "owner" and r.get("username") == OWNER_U, (s, r.get("role")))
    ck = owner.cookie()
    R.check("session cookie fc_session is set", ck is not None, bool(ck))
    R.check("cookie is HttpOnly (not readable from JavaScript)", bool(ck) and ck.has_nonstandard_attr("HttpOnly"), "HttpOnly")
    R.check("cookie is SameSite=Strict", bool(ck) and ck.get_nonstandard_attr("SameSite") == "Strict", ck.get_nonstandard_attr("SameSite") if ck else None)
    R.note(f"owner '{OWNER_U}' created with a {len(OWNER_PW)}-character random password (value never logged); cookie Secure flag is off because this sandbox is plain HTTP on loopback (set automatically under --tls-cert)")
    s, r = R.call("POST", "/api/auth/setup", {"username": "intruder", "password": secrets.token_urlsafe(12)}, keys=["error"])
    R.check("second setup refused (409 already_configured): only one owner can be created this way", s == 409 and r.get("error") == "already_configured", (s, r.get("error")))
    s, st = R.call("GET", "/api/auth/status", keys=["configured", "authenticated", "username", "role", "stepup_until"])
    R.check("status now reports authenticated owner xiaoyu", st.get("authenticated") is True and st.get("username") == OWNER_U and st.get("role") == "owner", st)

    # ---------------------------------------------------------------- S3
    R.begin("S3", "Logout and login: server-side session revocation, generic failure message, token rotation")
    t_setup = owner.token_digest()
    s, r = R.call("POST", "/api/auth/logout", {}, keys=["ok"])
    R.check("logout ok (200)", s == 200 and r.get("ok") is True, s)
    R.check("cookie removed from the jar", owner.cookie() is None, owner.cookie() is not None)
    s, r = R.call("GET", "/api/state", keys=["error"])
    R.check("state after logout -> 401", s == 401, s)
    stale = Client("replay")
    s, r = R.call("GET", "/api/state", headers={"Cookie": "fc_session=forged-or-revoked-token"}, keys=["error"], client=stale)
    R.check("a forged / revoked session token is rejected (401)", s == 401, s)
    s, r1 = R.call("POST", "/api/auth/login", {"username": OWNER_U, "password": "wrong-" + secrets.token_urlsafe(6)}, keys=["error"])
    s2, r2 = R.call("POST", "/api/auth/login", {"username": "nobody_here", "password": "wrong-" + secrets.token_urlsafe(6)}, keys=["error"])
    R.check("wrong password -> 401 invalid_credentials", s == 401 and r1.get("error") == "invalid_credentials", (s, r1.get("error")))
    R.check("unknown user gives the SAME answer (no account enumeration)", s2 == 401 and r2.get("error") == r1.get("error"), (s2, r2.get("error")))
    s, r = login_owner()
    R.check("login with the right password (200, owner)", s == 200 and r.get("role") == "owner", (s, r.get("role")))
    R.check("a new session token was issued (differs from the setup session)", owner.token_digest() not in (None, t_setup), "token fingerprints differ")
    s, st = R.call("GET", "/api/state", keys=["has_data", "tx_count"])
    R.check("authenticated read works (200)", s == 200, s)

    # ---------------------------------------------------------------- S4
    R.begin("S4", "PIPL consent gate: data-ingestion routes answer HTTP 428 until the owner records consent (POST /api/consent)")
    s, st = R.call("GET", "/api/auth/status", keys=["consent"])
    R.check("no consent recorded yet", st.get("consent") is None, st.get("consent"))
    s, r = R.call("POST", "/api/chat", {"text": "Luckin 18"}, keys=["error"])
    R.check("chat before consent -> 428 consent_required", s == 428 and r.get("error") == "consent_required", (s, r.get("error")))
    s, r = R.call("POST", "/api/consent", {"version": "v1", "agree": False}, keys=["error"])
    R.check("consent without agree:true -> 400 agree_required", s == 400 and r.get("error") == "agree_required", (s, r.get("error")))
    s, r = R.call("POST", "/api/consent", {"version": "v1", "agree": True}, keys=["ok", "consent.version", "consent.at"])
    R.check("consent recorded (200, version v1)", s == 200 and r.get("consent", {}).get("version") == "v1", (s, r.get("consent")))
    s, st = R.call("GET", "/api/auth/status", keys=["consent.version", "consent.at"])
    R.check("status shows the consent record", st.get("consent", {}).get("version") == "v1", st.get("consent"))

    # ---------------------------------------------------------------- S5
    R.begin("S5", "Step-up re-authentication: a sensitive route (demo reset) is refused with 403 until the owner re-enters the password")
    s, r = R.call("POST", "/api/demo", {}, keys=["error"])
    R.check("POST /api/demo without step-up -> 403 stepup_required", s == 403 and r.get("error") == "stepup_required", (s, r.get("error")))
    s, r = R.call("GET", "/api/export", keys=["error"])
    R.check("GET /api/export without step-up -> 403 stepup_required", s == 403 and r.get("error") == "stepup_required", (s, r.get("error")))
    s, r = R.call("POST", "/api/auth/stepup", {"password": "wrong-" + secrets.token_urlsafe(6)}, keys=["error"])
    R.check("step-up with a wrong password -> 403 invalid_password", s == 403 and r.get("error") == "invalid_password", (s, r.get("error")))
    s, r = R.call("POST", "/api/auth/stepup", {"password": OWNER_PW}, keys=["ok", "stepup_until"])
    R.check("step-up with the right password -> 200", s == 200 and r.get("ok") is True, (s, r.get("ok")))
    left = (r.get("stepup_until") or 0) - time.time()
    R.check("step-up window is about 5 minutes (250-305 s)", 250 <= left <= 305, f"{left:.0f} s")
    s, st = R.call("GET", "/api/auth/status", keys=["stepup_until"])
    R.check("status reports the open step-up window", bool(st.get("stepup_until")), st.get("stepup_until"))

    # ---------------------------------------------------------------- 1
    R.begin("1", "Health check: empty account state on a fresh throwaway database")
    s, st = R.call("GET", "/api/state", keys=["has_data", "tx_count", "status", "allowance_cents", "pending", "goals"])
    R.check("HTTP 200", s == 200, s)
    R.check("account is empty (has_data=false, tx_count=0)", st.get("has_data") is False and st.get("tx_count") == 0,
            f"has_data={st.get('has_data')} tx_count={st.get('tx_count')}")
    R.check("no goals on a fresh account", st.get("goals") == [], st.get("goals"))

    # ---------------------------------------------------------------- 2
    R.begin("2", "Load the synthetic demo persona Lin Xiaoyu (POST /api/demo)")
    s, d = R.call("POST", "/api/demo", {}, keys=["read", "imported", "duplicates", "skipped", "silent", "digest", "ask", "persona.nickname"])
    R.check("HTTP 200", s == 200, s)
    R.check("records imported > 300", d.get("imported", 0) > 300, d.get("imported"))
    R.check("no duplicates on first load", d.get("duplicates") == 0, d.get("duplicates"))
    R.check("most records recorded silently", d.get("silent", 0) > 0.9 * d.get("imported", 1), f"silent={d.get('silent')}/{d.get('imported')}")
    R.check("pending queue = digest + ask", d.get("digest", 0) + d.get("ask", 0) > 0, f"digest={d.get('digest')} ask={d.get('ask')}")
    ctx["demo"] = d
    R.note(f"records imported={d.get('imported')} silent={d.get('silent')} digest={d.get('digest')} ask={d.get('ask')}")

    # ---------------------------------------------------------------- 3
    R.begin("3", "Read the Home dashboard numbers (GET /api/state)")
    s, st = R.call("GET", "/api/state", keys=["today", "tx_count", "income_cents", "spent_cents", "balance_cents", "free_cents",
                                              "allowance_cents", "avg_flex_cents", "status", "savings_rate", "pending",
                                              "cycle.days_left", "cycle.next_payday"])
    R.check("HTTP 200", s == 200, s)
    R.check("has_data true", st.get("has_data") is True, st.get("has_data"))
    R.check("allowance > 0 ('you can spend today')", st.get("allowance_cents", 0) > 0, yuan(st.get("allowance_cents", 0)))
    R.check("status in {ok,tight,over}", st.get("status") in ("ok", "tight", "over"), st.get("status"))
    R.check("3 demo goals present", len(st.get("goals", [])) == 3, [g["name"] for g in st.get("goals", [])])
    R.check("savings_rate within [0,1]", 0 <= st.get("savings_rate", -1) <= 1, st.get("savings_rate"))
    ctx["state3"] = st
    R.note(f"allowance=CNY {yuan(st['allowance_cents'])}/day status={st['status']} free=CNY {yuan(st['free_cents'])} "
           f"savings_rate={st['savings_rate']} goals={[(g['name'], g['saved_cents'], g['target_cents']) for g in st['goals']]}")

    R.begin("3b", "Redacted account snapshot (counts only; reads GET /api/export, writes account_snapshot_after_demo.json)")
    ensure_stepup("export is a sensitive route")
    s, ex = R.call("GET", "/api/export", keys=["profile.payday_day", "profile.income_cents"])
    R.check("HTTP 200", s == 200, s)
    txs = ex.get("transactions", [])
    def tally(k):
        o = {}
        for t in txs:
            o[str(t.get(k))] = o.get(str(t.get(k)), 0) + 1
        return dict(sorted(o.items()))
    snap = {
        "generated_utc": now_stamps()[0],
        "note": "Redacted summary of the SIMULATED account after /api/demo. Counts and balances only; no merchant names, no raw bank strings.",
        "persona": "Lin Xiaoyu (synthetic)",
        "transactions_total": len(txs),
        "by_status": tally("status"), "by_mode": tally("mode"), "by_category": tally("category"),
        "by_direction": tally("direction"), "by_source": tally("source"),
        "date_range": [min(t["date"] for t in txs), max(t["date"] for t in txs)] if txs else None,
        "merchant_memory_entries": len(ex.get("merchant_memory", [])),
        "profile": ex.get("profile"),
        "dashboard": {k: st3 for k, st3 in ((k, ctx["state3"].get(k)) for k in
                      ("today", "income_cents", "spent_cents", "balance_cents", "free_cents", "allowance_cents", "avg_flex_cents",
                       "status", "savings_rate", "pending"))},
        "goals": [{"name": g["name"], "target_cents": g["target_cents"], "saved_cents": g["saved_cents"],
                   "deadline": g["deadline"], "status": g["status"]} for g in ctx["state3"]["goals"]],
    }
    with open(os.path.join(OUT, "account_snapshot_after_demo.json"), "w", encoding="utf-8") as f:
        json.dump(snap, f, ensure_ascii=False, indent=2)
    R.check("snapshot total equals dashboard tx_count", len(txs) == ctx["state3"]["tx_count"], f"{len(txs)} vs {ctx['state3']['tx_count']}")
    R.note(f"snapshot written: {len(txs)} transactions, {len(ex.get('merchant_memory', []))} merchant-memory entries")

    # ---------------------------------------------------------------- S6
    R.begin("S6", "Guest (viewer) role: owner creates read-only guest 'judge' after step-up; guest can read but cannot write")
    ensure_stepup("guest management is a sensitive route")
    s, r = R.call("POST", "/api/auth/viewer", {"username": GUEST_U, "password": GUEST_PW}, keys=["ok", "username", "role"])
    R.check("guest account created (200, role viewer)", s == 200 and r.get("role") == "viewer", (s, r.get("role")))
    s, r = R.call("GET", "/api/auth/users", keys=[])
    users = r.get("users", [])
    R.check("owner can list accounts: xiaoyu (owner) and judge (viewer)", sorted((u["username"], u["role"]) for u in users) == [(GUEST_U, "viewer"), (OWNER_U, "owner")],
            [(u["username"], u["role"]) for u in users])
    R.check("user list exposes no password hash, salt or token", all(set(u) <= {"username", "role", "created_at", "disabled"} for u in users), sorted({k for u in users for k in u}))
    guest = Client("guest")
    s, r = R.call("POST", "/api/auth/login", {"username": GUEST_U, "password": GUEST_PW}, keys=["ok", "username", "role"], client=guest)
    R.check("guest logs in with its own session (200, role viewer)", s == 200 and r.get("role") == "viewer", (s, r.get("role")))
    s, r = R.call("GET", "/api/state", keys=["has_data", "tx_count", "status", "allowance_cents"], client=guest)
    R.check("guest can READ the dashboard (GET /api/state 200)", s == 200 and r.get("has_data") is True, (s, r.get("tx_count")))
    s, r = R.call("GET", f"/api/report?year={today.year}&month={today.month}", keys=["empty", "count"], client=guest)
    R.check("guest can read the monthly report (200)", s == 200, s)
    s, r = R.call("POST", "/api/ask", {"kind": "budget"}, keys=["intent"], client=guest)
    R.check("guest can use Ask AI (read-only advice, 200)", s == 200 and r.get("intent") == "budget", (s, r.get("intent")))
    s, r = R.call("POST", "/api/chat", {"text": "Luckin 18"}, keys=["error", "role"], client=guest)
    R.check("guest WRITE (POST /api/chat) -> 403 forbidden", s == 403 and r.get("error") == "forbidden", (s, r.get("error")))
    s, r = R.call("POST", "/api/goal/deposit", {"id": 1, "amount_cents": 100}, keys=["error"], client=guest)
    R.check("guest WRITE (POST /api/goal/deposit) -> 403 forbidden", s == 403, s)
    s, r = R.call("GET", "/api/audit", keys=["error"], client=guest)
    R.check("guest cannot read the audit log (403)", s == 403, s)
    s, r = R.call("GET", "/api/auth/users", keys=["error"], client=guest)
    R.check("guest cannot list accounts (403)", s == 403, s)
    s, r = R.call("POST", "/api/auth/stepup", {"password": GUEST_PW}, keys=["ok"], client=guest)
    R.check("guest may re-authenticate (step-up 200)...", s == 200, s)
    s, r = R.call("GET", "/api/export", keys=["error"], client=guest)
    R.check("...but still cannot export data: role is checked before step-up (403 forbidden)", s == 403 and r.get("error") == "forbidden", (s, r.get("error")))
    s, r = R.call("POST", "/api/delete-all", {}, keys=["error"], client=guest)
    R.check("guest cannot delete data (403)", s == 403, s)
    s, st = R.call("GET", "/api/state", keys=["tx_count"])
    R.check("owner data untouched by the guest's attempts", st.get("tx_count") == ctx["state3"]["tx_count"], f"{st.get('tx_count')} == {ctx['state3']['tx_count']}")

    # ---------------------------------------------------------------- S7
    R.begin("S7", "Brute-force lockout on a throwaway user name 'lockout_probe': 4 x 401, then 429 with retry_after")
    codes, last = [], {}
    attacker = Client("attacker")
    for i in range(5):
        s, last = R.call("POST", "/api/auth/login", {"username": "lockout_probe", "password": "guess-" + secrets.token_urlsafe(6)}, keys=["error", "retry_after"], client=attacker)
        codes.append(s)
    R.check("attempts 1-4 -> 401 invalid_credentials, attempt 5 -> 429 locked", codes == [401, 401, 401, 401, 429], codes)
    R.check("429 carries retry_after (60 s for the first lock)", last.get("error") == "locked" and last.get("retry_after") == 60, last)
    s, r = R.call("POST", "/api/auth/login", {"username": "lockout_probe", "password": "guess-" + secrets.token_urlsafe(6)}, keys=["error", "retry_after"], client=attacker)
    R.check("6th attempt is refused before any password check (429, retry_after > 0)", s == 429 and r.get("retry_after", 0) > 0, (s, r.get("retry_after")))
    s, r = login_owner(Client("owner-second-device"))
    R.check("lockout is per (IP, user name): the real owner can still sign in", s == 200 and r.get("role") == "owner", s)

    # ---------------------------------------------------------------- 4
    R.begin("4a", "Chat entry 'Luckin 18' -> known merchant, recorded SILENTLY")
    s, r = R.call("POST", "/api/chat", {"text": "Luckin 18"}, keys=["kind", "tx.merchant", "tx.amount_cents", "tx.category", "tx.mode", "tx.status"])
    R.check("kind == silent", r.get("kind") == "silent", r.get("kind"))
    R.check("amount 18.00 CNY", r.get("tx", {}).get("amount_cents") == 1800, r.get("tx", {}).get("amount_cents"))
    R.check("category food_drink", r.get("tx", {}).get("category") == "food_drink", r.get("tx", {}).get("category"))

    R.begin("4b", "Chat entry '转给 浩然 500' -> person transfer, the app ASKS; resolve as 'loan'")
    s, r = R.call("POST", "/api/chat", {"text": "转给 浩然 500"}, keys=["kind", "tx.id", "tx.merchant", "tx.amount_cents", "tx.reason", "tx.status"])
    R.check("kind == ask", r.get("kind") == "ask", r.get("kind"))
    R.check("reason == person", r.get("tx", {}).get("reason") == "person", r.get("tx", {}).get("reason"))
    tid = r.get("tx", {}).get("id")
    s, r2 = R.call("POST", "/api/resolve", {"id": tid, "purpose": "loan"}, keys=["updated"])
    R.check("resolve updated 1 row", r2.get("updated") == 1, r2.get("updated"))
    s, tl = R.call("GET", f"/api/transactions?year={today.year}&month={today.month}&category=transfers", keys=["total_out"])
    row = next((t for t in tl.get("items", []) if t["id"] == tid), None)
    R.check("record now confirmed/transfers", bool(row) and row["status"] == "confirmed" and row["category"] == "transfers", row and (row["status"], row["category"]))

    R.begin("4c", "Chat entry 'potato 5' -> unknown merchant, DIGEST; confirm category; repeat goes SILENT (memory effect)")
    s, r = R.call("POST", "/api/chat", {"text": "potato 5"}, keys=["kind", "tx.id", "tx.merchant", "tx.category", "tx.reason", "tx.status"])
    R.check("first entry kind == digest", r.get("kind") == "digest", r.get("kind"))
    tid = r.get("tx", {}).get("id")
    s, r2 = R.call("POST", "/api/confirm", {"id": tid, "category": "groceries"}, keys=["updated"])
    R.check("confirm updated >= 1 row", r2.get("updated", 0) >= 1, r2.get("updated"))
    s, r3 = R.call("POST", "/api/chat", {"text": "potato 5"}, keys=["kind", "tx.category", "tx.mode", "tx.status"])
    R.check("second identical entry kind == silent", r3.get("kind") == "silent", r3.get("kind"))
    R.check("second entry category learned = groceries", r3.get("tx", {}).get("category") == "groceries", r3.get("tx", {}).get("category"))
    R.note("memory effect: digest (1 tap) -> silent (0 taps) after one confirmation")

    # ---------------------------------------------------------------- 5
    R.begin("5", "'Needs a look' queue: list items with reasons, resolve every item")
    s, st = R.call("GET", "/api/state", keys=["pending"])
    q = st.get("pending_list", [])
    s, st = R.call("GET", "/api/state")  # full list (summarised in log); reasons recorded below
    q = st.get("pending_list", [])
    R.check("queue has 4 items (2 digest + 2 ask) from the demo", len(q) == 4, len(q))
    R.check("every item carries a reason", all(x.get("reason") for x in q), [x.get("reason") for x in q])
    R.note("queue: " + "; ".join(f"id={x['id']} {x['mode']}/{x['reason']} CNY {yuan(x['amount_cents'])} ({x['merchant']})" for x in q))
    for x in q:
        if x["mode"] == "ask" and x["counterparty_type"] == "person":
            s, rr = R.call("POST", "/api/resolve", {"id": x["id"], "purpose": "gift"}, keys=["updated"])
        elif x["mode"] == "ask":
            s, rr = R.call("POST", "/api/resolve", {"id": x["id"], "purpose": "purchase"}, keys=["updated"])
        else:
            cat = x["category"] if x["category"] != "other" else "shopping"
            s, rr = R.call("POST", "/api/confirm", {"id": x["id"], "category": cat}, keys=["updated"])
        R.check(f"item {x['id']} resolved", rr.get("updated", 0) >= 1, rr.get("updated"))
    s, st = R.call("GET", "/api/state", keys=["pending.digest", "pending.ask", "allowance_cents", "status"])
    R.check("queue is empty after resolving", st["pending"] == {"digest": 0, "ask": 0}, st["pending"])
    ctx["state5"] = st

    # ---------------------------------------------------------------- 6
    R.begin("6a", "Goals: add a goal (POST /api/goal) and deposit (POST /api/goal/deposit)")
    s, g = R.call("POST", "/api/goal", {"name": "Chengdu weekend (sandbox)", "target_cents": 300000,
                                        "deadline": (today + timedelta(days=120)).isoformat(), "saved_cents": 0}, keys=["id"])
    R.check("goal created", isinstance(g.get("id"), int), g.get("id"))
    gid = g.get("id")
    s, r = R.call("POST", "/api/goal/deposit", {"id": gid, "amount_cents": 50000}, keys=["ok"])
    R.check("deposit ok", r.get("ok") is True, r)
    s, st = R.call("GET", "/api/state")
    mine = next((x for x in st["goals"] if x["id"] == gid), {})
    R.check("saved_cents == 50000 after deposit", mine.get("saved_cents") == 50000, mine.get("saved_cents"))
    R.note(f"new goal progress={mine.get('progress')} monthly_needed=CNY {yuan(mine.get('monthly_needed_cents', 0))}")
    R.call("POST", "/api/goal/delete", {"id": gid}, keys=["ok"])  # keep the demo goal set clean for later steps

    R.begin("6b", "Goal what-if: find the demo goal whose +CNY 1,000 deposit flips dashboard status 'tight' -> 'ok'")
    # The demo goal is calibrated on the freshly loaded persona. Steps 4-5 legitimately changed the 14-day flexible-spend
    # pace (the CNY 500 loan counts as spend), so the script re-loads the persona first, exactly like the in-app "reset demo".
    ensure_stepup("demo reset is a sensitive route")
    s, dm = R.call("POST", "/api/demo", {}, keys=["imported", "silent", "digest", "ask"])
    R.check("persona reloaded (reset demo)", s == 200 and dm.get("imported", 0) > 300, dm.get("imported"))
    R.note("reset demo before the what-if: chat entries from step 4 add CNY 500+ of 14-day spend (transfers count), which would mask the calibrated flip")
    s, st = R.call("GET", "/api/state", keys=["status", "allowance_cents", "avg_flex_cents"])
    before_status, before_allow, avg_flex = st["status"], st["allowance_cents"], st["avg_flex_cents"]
    R.note(f"before: status={before_status} allowance=CNY {yuan(before_allow)} avg_flex=CNY {yuan(avg_flex)}")
    R.check("starting status is 'tight'", before_status == "tight", before_status)
    flipped = None
    for goal in sorted(st["goals"], key=lambda g: g["name"] != "Japan trip"):  # the demo goal calibrated for the flip first
        R.call("POST", "/api/goal/deposit", {"id": goal["id"], "amount_cents": 100000}, keys=["ok"])
        s, a = R.call("GET", "/api/state", keys=["status", "allowance_cents"])
        if before_status == "tight" and a["status"] == "ok":
            flipped = (goal["name"], a["status"], a["allowance_cents"])
            R.note(f"FLIP on '{goal['name']}': status tight -> {a['status']}; allowance CNY {yuan(before_allow)} -> {yuan(a['allowance_cents'])}")
            break
        R.note(f"'{goal['name']}': +1000 gives status={a['status']} allowance=CNY {yuan(a['allowance_cents'])} (no flip, reverting)")
        R.call("POST", "/api/goal/deposit", {"id": goal["id"], "amount_cents": -100000}, keys=["ok"])
    R.check("a goal deposit flips tight -> ok", flipped is not None, flipped)
    if flipped:
        R.check("allowance rose after the deposit", flipped[2] > before_allow, f"{yuan(before_allow)} -> {yuan(flipped[2])}")
        R.check("goal is the demo 'Japan trip'", flipped[0] == "Japan trip", flipped[0])
    s, st = R.call("GET", "/api/state", keys=["goals"])
    ctx["goals"] = st["goals"]

    # ---------------------------------------------------------------- 7
    R.begin("7", "Ask-AI plans (mock planner): goal / save / budget / free-text")
    japan = next((x for x in ctx["goals"] if x["name"] == "Japan trip"), ctx["goals"][0])
    s, p = R.call("POST", "/api/ask", {"kind": "goal", "id": japan["id"]},
                  keys=["intent", "goal.name", "extra_monthly_cents", "eta_now", "eta_new", "days_faster", "on_time", "steps"])
    R.check("goal plan intent", p.get("intent") in ("goal", "goal_done"), p.get("intent"))
    if p.get("intent") == "goal":
        R.check("accelerated ETA not later than current ETA", bool(p["eta_new"]) and bool(p["eta_now"]) and p["eta_new"] <= p["eta_now"],
                f"{p.get('eta_now')} -> {p.get('eta_new')}")
        R.note("goal plan steps: " + json.dumps(p.get("steps"), ensure_ascii=False))
    s, p = R.call("POST", "/api/ask", {"kind": "save"}, keys=["intent", "total_monthly_cents", "goal.name", "goal.days_faster"])
    R.check("save plan intent", p.get("intent") == "save", p.get("intent"))
    R.check("save plan has 1-3 cut steps", 1 <= len(p.get("steps", [])) <= 3, len(p.get("steps", [])))
    R.note("save plan steps: " + json.dumps(p.get("steps"), ensure_ascii=False))
    s, p = R.call("POST", "/api/ask", {"kind": "budget"}, keys=["intent", "allowance_cents", "status", "days_left", "top_category"])
    R.check("budget plan intent", p.get("intent") == "budget", p.get("intent"))
    s, p = R.call("POST", "/api/ask", {"kind": "text", "text": "How can I reach my Japan trip goal faster?"},
                  keys=["intent", "goal.name", "eta_now", "eta_new", "days_faster", "extra_monthly_cents"])
    R.check("free-text routed to goal plan", p.get("intent") == "goal" and p.get("goal", {}).get("name") == "Japan trip",
            (p.get("intent"), p.get("goal", {}).get("name")))

    # ---------------------------------------------------------------- 8
    R.begin("8", "History filters, monthly report and weekly insights")
    s, t = R.call("GET", f"/api/transactions?year={today.year}&month={today.month}&category=food_drink",
                  keys=["total_out", "total_in", "years"])
    R.check("HTTP 200", s == 200, s)
    R.check("all items are food_drink and in the requested month", all(i["category"] == "food_drink" and i["date"].startswith(f"{today.year:04d}-{today.month:02d}") for i in t.get("items", [])),
            f"{len(t.get('items', []))} items")
    R.check("filtered total_out > 0", t.get("total_out", 0) > 0, yuan(t.get("total_out", 0)))
    R.note(f"food_drink {today.year}-{today.month:02d}: {len(t['items'])} items, total_out=CNY {yuan(t['total_out'])}")
    s, t2 = R.call("GET", f"/api/transactions?year={today.year}", keys=["total_out", "years"])
    R.check("year filter returns >= month filter", t2.get("total_out", 0) >= t.get("total_out", 0), f"{yuan(t2['total_out'])} >= {yuan(t['total_out'])}")
    s, rp = R.call("GET", f"/api/report?year={today.year}&month={today.month}",
                   keys=["year", "month", "income_cents", "spent_cents", "net_cents", "count", "spent_delta_pct", "empty", "categories", "merchants"])
    R.check("report not empty", rp.get("empty") is False, rp.get("empty"))
    R.check("net = income - spent", rp.get("net_cents") == rp.get("income_cents", 0) - rp.get("spent_cents", 0), rp.get("net_cents"))
    R.check("category shares sum to ~1", abs(sum(c["share"] for c in rp.get("categories", [])) - 1) < 0.02, sum(c["share"] for c in rp.get("categories", [])))
    s, ins = R.call("GET", "/api/insights", keys=["has_data", "day_target_cents", "streak", "week", "badges", "goals_pace"])
    R.check("insights has_data", ins.get("has_data") is True, ins.get("has_data"))

    # ---------------------------------------------------------------- 9
    R.begin("9", "Accuracy benchmark on the synthetic set (GET /api/benchmark)")
    s, b = R.call("GET", "/api/benchmark", keys=["synthetic", "n", "metrics", "counts"])
    R.check("benchmark flagged synthetic", b.get("synthetic") is True, b.get("synthetic"))
    R.check("n > 0 records replayed", b.get("n", 0) > 0, b.get("n"))
    m = b.get("metrics", {})
    R.check("metrics present (extraction, category, silent, taps)", all(k in m for k in ("extraction_acc", "category_acc", "silent_pct", "avg_taps", "wrong_silent_pct")), sorted(m))
    R.note("metrics: " + json.dumps(m, ensure_ascii=False))
    R.note("counts: " + json.dumps(b.get("counts"), ensure_ascii=False))
    ctx["bench"] = b

    # ---------------------------------------------------------------- 10
    R.begin("10a", "Invest news (public RSS, server-side, allowlisted); offline falls back to labelled samples")
    s, nw = R.call("GET", "/api/news", keys=["live", "cached", "fetched_at", "error"])
    items = nw.get("items", [])
    R.check("HTTP 200 and items returned (live or fallback)", s == 200 and len(items) > 0, f"live={nw.get('live')} items={len(items)}")
    if not nw.get("live"):
        R.check("offline fallback items are labelled sample", all(i.get("sample") for i in items), "sample flag")
    R.note(f"live={nw.get('live')} items={len(items)} sources={len(nw.get('sources', []))} sample_items={sum(1 for i in items if i.get('sample'))}")
    ctx["news_live"] = nw.get("live")
    R.begin("10b", "Updatable lessons: v1 -> v2 (simulated content update) -> reset; research list follows version")
    s, l1 = R.call("GET", "/api/lessons", keys=["version", "latest_version", "has_update", "updated_at"])
    R.check("starts at version 1", l1.get("version") == 1, l1.get("version"))
    R.note(f"v1 topics={len(l1.get('topics', []))} latest_version={l1.get('latest_version')}")
    s, u = R.call("POST", "/api/lessons/update", {}, keys=["updated", "from", "to"])
    R.check("update 1 -> 2", u.get("updated") is True and u.get("to") == 2, (u.get("from"), u.get("to")))
    s, l2 = R.call("GET", "/api/lessons", keys=["version", "has_update"])
    R.check("now version 2", l2.get("version") == 2, l2.get("version"))
    R.check("v2 has tagged new/updated topics", any(t.get("tag") for t in l2.get("topics", [])), [t.get("tag") for t in l2.get("topics", [])])
    R.note(f"v2 topics={len(l2.get('topics', []))} tagged={sum(1 for t in l2.get('topics', []) if t.get('tag'))} changelog_entries={len(l2.get('changelog', []))}")
    s, rs2 = R.call("GET", "/api/research", keys=["version"])
    s, rz = R.call("POST", "/api/lessons/reset", {}, keys=["version"])
    R.check("reset back to version 1", rz.get("version") == 1, rz.get("version"))
    s, rs1 = R.call("GET", "/api/research", keys=["version"])
    R.check("research list: v2 shows >= v1 items", len(rs2.get("items", [])) >= len(rs1.get("items", [])), f"v2={len(rs2.get('items', []))} v1={len(rs1.get('items', []))}")
    R.note(f"research items: v1={len(rs1.get('items', []))} v2={len(rs2.get('items', []))}")

    # ---------------------------------------------------------------- 11
    R.begin("11", "Receipt photo path (POST /api/scan, tiny generated JPEG stub, no ANTHROPIC_API_KEY)")
    jpeg = bytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]) + b"JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + bytes(64) + bytes([0xFF, 0xD9])
    R.note(f"key_was_set_in_env={KEY_WAS_SET} (removed from the process env for determinism); JPEG stub bytes={len(jpeg)}")
    s, r = R.call("POST", "/api/scan", {"image": base64.b64encode(jpeg).decode(), "media_type": "image/jpeg"},
                  keys=["kind", "demo", "tx.merchant", "tx.amount_cents", "tx.category", "tx.confidence", "tx.mode"])
    R.check("scan returns a record (digest/ask/silent)", r.get("kind") in ("digest", "ask", "silent"), r.get("kind"))
    R.check("result is labelled DEMO (demo: true)", r.get("demo") is True, r.get("demo"))
    R.note("DEMO result is a fixed canned receipt; the image is NOT recognised without an LLM key")

    # ---------------------------------------------------------------- 12
    R.begin("12", "CSV import of a small generated WeChat-style statement, twice (dedupe proof)")
    hdr = "交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注"
    d1 = (today - timedelta(days=3)).isoformat()
    lines = ["微信支付账单明细", "微信昵称：[小雨]", "----------------------微信支付账单明细列表--------------------", hdr,
             f"{d1} 08:30:00,商户消费,瑞幸咖啡,咖啡,支出,¥17.00,零钱,支付成功,EVID0000001,M1,/",
             f"{d1} 12:10:00,商户消费,美团,午餐外卖,支出,¥36.00,零钱,支付成功,EVID0000002,M2,/",
             f"{d1} 19:00:00,商户消费,盒马鲜生,买菜,支出,¥64.00,零钱,支付成功,EVID0000003,M3,/",
             f"{d1} 21:00:00,商户消费,滴滴出行,快车,支出,¥22.00,零钱,支付成功,EVID0000004,M4,/",
             f"{d1} 21:30:00,商户消费,喜茶,奶茶,支出,¥30.00,零钱,支付失败,EVID0000005,M5,/"]
    csv_text = "\n".join(lines) + "\n"
    s, a = R.call("POST", "/api/import", {"csv": csv_text}, keys=["read", "imported", "duplicates", "skipped", "silent", "digest", "ask"])
    R.check("first import: 4 imported, 1 failed row skipped", a.get("imported") == 4 and a.get("skipped") == 1, (a.get("imported"), a.get("skipped")))
    s, b2 = R.call("POST", "/api/import", {"csv": csv_text}, keys=["read", "imported", "duplicates", "skipped"])
    R.check("second import: 0 imported, 4 duplicates", b2.get("imported") == 0 and b2.get("duplicates") == 4, (b2.get("imported"), b2.get("duplicates")))

    # ---------------------------------------------------------------- 13
    R.begin("13a", "Data-subject right: export (GET /api/export, counts only logged) on a fresh login that must step up first")
    R.call("POST", "/api/auth/logout", {}, keys=["ok"])
    s, r = login_owner()
    R.check("fresh login (new session carries no step-up)", s == 200, s)
    s, r = R.call("GET", "/api/export", keys=["error"])
    R.check("export on the fresh session -> 403 stepup_required", s == 403 and r.get("error") == "stepup_required", (s, r.get("error")))
    s, r = R.call("POST", "/api/auth/stepup", {"password": OWNER_PW}, keys=["ok"])
    R.check("step-up ok (200)", s == 200, s)
    s, ex = R.call("GET", "/api/export", keys=["exported_at"])
    cnt = {"transactions": len(ex.get("transactions", [])), "goals": len(ex.get("goals", [])), "merchant_memory": len(ex.get("merchant_memory", []))}
    R.check("export contains transactions, goals and profile", cnt["transactions"] > 300 and cnt["goals"] == 3 and ex.get("profile") is not None, cnt)
    R.note("export counts: " + json.dumps(cnt) + " (contents deliberately not logged)")
    ctx["export_counts"] = cnt
    R.begin("13b", "Data-subject right: delete all (POST /api/delete-all) and verify empty")
    ensure_stepup("delete-all is a sensitive route")
    s, r = R.call("POST", "/api/delete-all", {}, keys=["ok"])
    R.check("delete-all ok", r.get("ok") is True, r)
    s, st = R.call("GET", "/api/state", keys=["has_data", "tx_count", "goals", "pending"])
    R.check("account empty after delete", st.get("has_data") is False and st.get("tx_count") == 0 and st.get("goals") == [], (st.get("has_data"), st.get("tx_count")))
    s, ex2 = R.call("GET", "/api/export")
    R.check("export after delete: 0 transactions, 0 goals, 0 memory", not ex2.get("transactions") and not ex2.get("goals") and not ex2.get("merchant_memory"),
            (len(ex2.get("transactions", [])), len(ex2.get("goals", [])), len(ex2.get("merchant_memory", []))))
    s, r = R.call("GET", "/api/auth/status", keys=["consent", "authenticated"])
    R.check("erasure also removed the consent record", r.get("consent") is None, r.get("consent"))
    s, r = R.call("POST", "/api/chat", {"text": "Luckin 18"}, keys=["error"])
    R.check("chat after erasure -> 428 consent_required again", s == 428 and r.get("error") == "consent_required", (s, r.get("error")))
    s, r = R.call("GET", "/api/auth/users", keys=[])
    R.check("accounts (owner, judge) are kept by delete-all; only the ledger and consent are erased", len(r.get("users", [])) == 2, len(r.get("users", [])))

    # ---------------------------------------------------------------- 14
    R.begin("14", "Negative / security probes through the same HTTP path (on a fresh login without step-up)")
    R.call("POST", "/api/auth/logout", {}, keys=["ok"])
    login_owner()
    s, r = R.call("POST", "/api/chat", raw=b'{"text":"Luckin 18"}', headers={"Content-Type": "text/plain"})
    R.check("non-JSON content type -> 415", s == 415, s)
    s, r = R.call("POST", "/api/chat", {"text": "Luckin 18"}, headers={"Origin": "http://evil.example.com"}, keys=["error"])
    R.check("cross-origin POST -> 403 bad_origin (CSRF guard)", s == 403 and r.get("error") == "bad_origin", (s, r.get("error")))
    s, r = R.call("GET", "/api/transactions?year=abc")
    R.check("bad year -> 400", s == 400, s)
    s, r = R.call("GET", "/api/state", headers={"Host": "evil.example.com"})
    R.check("foreign Host header -> 403 (DNS-rebinding guard)", s == 403, s)
    s, r = R.call("GET", "/api/nope", keys=["error"])
    R.check("unknown route falls into the strictest tier -> 403 stepup_required", s == 403 and r.get("error") == "stepup_required", (s, r.get("error")))
    s, r = R.call("POST", "/api/confirm", {"id": 1, "category": "not_a_category"})
    R.check("confirm with unknown id is harmless (updated 0)", s == 200 and r.get("updated") == 0, (s, r))

    # ---------------------------------------------------------------- S8
    R.begin("S8", "Guest removal (sensitive, step-up) and tamper-evident access log (GET /api/audit)")
    ensure_stepup("guest removal is a sensitive route")
    s, r = R.call("POST", "/api/auth/users/delete", {"username": GUEST_U}, keys=["ok"])
    R.check("guest 'judge' deleted (200)", s == 200 and r.get("ok") is True, (s, r))
    s, r = R.call("POST", "/api/auth/login", {"username": GUEST_U, "password": GUEST_PW}, keys=["error"], client=guest)
    R.check("deleted guest can no longer sign in (401)", s == 401, s)
    s, r = R.call("GET", "/api/state", client=guest)
    R.check("deleted guest's old session is dead (401)", s == 401, s)
    s, au = R.call("GET", "/api/audit?limit=500", keys=["chain_ok", "first_broken_id"])
    ents = au.get("entries", [])
    total = max((e["id"] for e in ents), default=0)
    R.check("HTTP 200 and chain_ok == true (hash chain verifies end to end)", s == 200 and au.get("chain_ok") is True, (s, au.get("chain_ok"), au.get("first_broken_id")))
    R.check("log holds every action of this run (>= 60 entries, ids 1..N contiguous)", total >= 60 and len(ents) == total, f"entries={len(ents)} last_id={total}")
    acts = {(e["action"], e["status"]) for e in ents}
    for need in (("setup", "ok"), ("login", "ok"), ("login", "invalid_credentials"), ("login", "locked"), ("stepup", "ok"), ("stepup", "invalid_password"),
                 ("POST /api/demo [denied]", "error:403"), ("POST /api/chat [denied]", "error:428"), ("POST /api/demo", "ok"),
                 ("POST /api/auth/viewer", "ok"), ("GET /api/export", "ok"), ("POST /api/delete-all", "ok"), ("POST /api/auth/users/delete", "ok")):
        R.check(f"audit contains {need[0]} / {need[1]}", need in acts, "present" if need in acts else "missing")
    R.check("a guest's denied write is attributed to user judge, role viewer",
            any(e["user"] == GUEST_U and e["role"] == "viewer" and e["action"].endswith("[denied]") for e in ents), "judge/viewer/[denied]")
    leak = json.dumps(ents)
    R.check("no password, token or request body appears in the log", OWNER_PW not in leak and GUEST_PW not in leak and "fc_session" not in leak, "scanned all entries")
    R.note(f"{total} audit entries; chain_ok={au.get('chain_ok')}; last 8 (newest first): " +
           "; ".join(f"#{e['id']} {e['user'] or '-'}/{e['role'] or '-'} {e['action']} -> {e['status']}" for e in ents[:8]))

    R.begin("S9", "Tamper test on the THROWAWAY database: edit one audit row directly, chain_ok must turn false; restore, true again")
    victim = next(e for e in ents if e["status"].startswith("error:"))
    cx = sqlite3.connect(db.PATH)
    old_status = cx.execute("SELECT status FROM audit WHERE id=?", (victim["id"],)).fetchone()[0]
    cx.execute("UPDATE audit SET status='ok' WHERE id=?", (victim["id"],))
    cx.commit()
    s, au2 = R.call("GET", "/api/audit?limit=5", keys=["chain_ok", "first_broken_id"])
    R.check("after the edit chain_ok == false and first_broken_id points at the edited row", au2.get("chain_ok") is False and au2.get("first_broken_id") == victim["id"],
            (au2.get("chain_ok"), au2.get("first_broken_id"), victim["id"]))
    cx.execute("UPDATE audit SET status=? WHERE id=?", (old_status, victim["id"]))
    cx.commit()
    cx.close()
    s, au3 = R.call("GET", "/api/audit?limit=5", keys=["chain_ok", "first_broken_id"])
    R.check("after restoring the original value chain_ok == true again", au3.get("chain_ok") is True, au3.get("chain_ok"))
    R.note(f"row #{victim['id']} (status '{old_status}') was edited and restored in the temp DB only; this is a test of detection, not a claim of tamper-proof storage")

    R.begin("S10", "Sign out: the session is revoked server-side")
    s, r = R.call("POST", "/api/auth/logout", {}, keys=["ok"])
    R.check("logout ok", s == 200, s)
    s, r = R.call("GET", "/api/state", keys=["error"])
    R.check("owner's session no longer works (401)", s == 401, s)

    # ---------------------------------------------------------------- shutdown + outputs
    httpd.shutdown()
    httpd.server_close()
    total_s = round(time.perf_counter() - R.t0, 2)
    n_pass = sum(1 for st_ in R.steps for a in st_["assertions"] if a["result"] == "PASS")
    n_fail = sum(1 for st_ in R.steps for a in st_["assertions"] if a["result"] == "FAIL")
    n_calls = sum(len(st_["calls"]) for st_ in R.steps)
    summary = {"steps_run": len(R.steps), "http_calls": n_calls, "assertions_passed": n_pass, "assertions_failed": n_fail,
               "total_duration_s": total_s, "result": "PASS" if n_fail == 0 else "FAIL"}
    meta = {"run_id": stamp, "persona": "Lin Xiaoyu (synthetic, no real data)", "started_utc": started.isoformat(timespec="seconds"),
            "app_date": today_s, "python": platform.python_version(), "platform": platform.platform(),
            "server": f"in-process ThreadingHTTPServer on 127.0.0.1:{port} (random port)", "database": "throwaway temp sqlite (deleted after run)",
            "anthropic_key_used": False, "anthropic_key_was_in_env": KEY_WAS_SET,
            "auth": "owner xiaoyu + guest judge, per-run random passwords (never logged), session cookie fc_session via cookie jar",
            "mocks": ["bank connector = synthetic WeChat-style CSV", "scan = canned DEMO result without LLM key",
                      "Ask-AI = deterministic planner, no LLM", "lessons update = simulated content pack",
                      "benchmark = synthetic set data/bench_set.csv"]}

    base = f"sandbox_run_{stamp}"
    with open(os.path.join(OUT, base + ".json"), "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "steps": R.steps, "summary": summary}, f, ensure_ascii=False, indent=2)
    L = [f"SANDBOX EXECUTION LOG  run {stamp}", "=" * 78]
    for k, v in meta.items():
        L.append(f"{k:>22}: {v if not isinstance(v, list) else '; '.join(v)}")
    L.append("=" * 78)
    for stp in R.steps:
        L.append("")
        L.append(f"[STEP {stp['id']}] {stp['description']}")
        L.append(f"  time UTC {stp['ts_utc']} | Asia/Shanghai {stp['ts_asia_shanghai']}")
        for c in stp["calls"]:
            L.append(f"  > [{c['client']}] {c['method']} {c['path']}  body={json.dumps(c['request'], ensure_ascii=False)}")
            L.append(f"    status={c['status']} latency={c['latency_ms']}ms resp={json.dumps(c['response_key_fields'], ensure_ascii=False)}")
        for n in stp["notes"]:
            L.append(f"  . {n}")
        for a in stp["assertions"]:
            L.append(f"  [{a['result']}] {a['name']}  -> {a['detail']}")
    L += ["", "=" * 78, "SUMMARY"]
    for k, v in summary.items():
        L.append(f"  {k}: {v}")
    with open(os.path.join(OUT, base + ".log"), "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")

    write_readme()
    write_manifest()
    print("\n".join(L[-8:]))
    print(f"Wrote evidence/sandbox/{base}.log and .json")
    try:
        os.remove(db.PATH)
    except OSError:
        pass
    return 0 if n_fail == 0 else 1


def write_readme():
    txt = """# Sandbox execution evidence (simulated account)

Persona: Lin Xiaoyu, a synthetic 26-year-old product designer. No real bank data, no real credentials.
The run also exercises the authentication layer: owner `xiaoyu` (strong random password generated for the run and
never printed or stored), read-only guest `judge`, consent gate, step-up re-authentication, lockout and the audit log.

## Reproduce

    python tools/evidence_run.py

The script starts its own temporary HTTP server on 127.0.0.1 (random port) with a throwaway SQLite file and a
throwaway lessons-state file, drives the app only through real HTTP calls with a cookie jar (the same `fc_session`
cookie flow a browser uses), and shuts everything down. It never touches `data/app.db`, `data/lessons_state.json`
or the dev server on port 8000. Each run writes a new `sandbox_run_<YYYYMMDD_HHMMSS>.log` (readable) and `.json`
(machine readable), refreshes `account_snapshot_after_demo.json` and regenerates `MANIFEST.sha256`.

Dates and some figures depend on the day the script is run (the demo statement is generated relative to today),
so absolute numbers can differ between days; the PASS/FAIL logic does not. Passwords, hashes and session tokens
are never written to the log or JSON (request bodies are redacted; the cookie is only fingerprinted).

## Files

- `sandbox_run_<ts>.log` / `.json`: step-by-step log with UTC and Asia/Shanghai timestamps, status codes, latency, PASS/FAIL.
- `account_snapshot_after_demo.json`: redacted counts of the simulated account after loading the persona.
- `../tests/unittest_<ts>.txt`: full output of `python -m unittest discover -s tests -v`.
- `MANIFEST.sha256`: SHA-256 of every file under `evidence/` (paths relative to `evidence/`).

## Verify integrity

From the `evidence` directory:

    python -c "import hashlib,sys;[print('OK ' if hashlib.sha256(open(l.split('  ',1)[1].strip(),'rb').read()).hexdigest()==l.split('  ',1)[0] else 'BAD', l.split('  ',1)[1].strip()) for l in open('sandbox/MANIFEST.sha256')]"
    # or one file:  certutil -hashfile sandbox/sandbox_run_<ts>.log SHA256

The manifest detects accidental or later edits; it is not a signature. Re-running the script regenerates it.

## Simulated / mock components

Bank connector = synthetic WeChat-style CSV; receipt scan = canned DEMO result (no LLM key); Ask-AI = deterministic
planner; lessons update = simulated content pack; benchmark = synthetic set. News uses public RSS when online and
labelled sample items when offline.
"""
    with open(os.path.join(OUT, "README.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write(txt)


def write_manifest():
    """SHA-256 of every file under evidence/ (sandbox, tests, security, ...), paths relative to evidence/."""
    evid = os.path.dirname(OUT)
    lines = []
    for dp, dn, fn in os.walk(evid):
        dn.sort()
        for n in sorted(fn):
            p = os.path.join(dp, n)
            rel = os.path.relpath(p, evid).replace(os.sep, "/")
            if rel == "sandbox/MANIFEST.sha256":
                continue
            lines.append((rel, hashlib.sha256(open(p, "rb").read()).hexdigest()))
    lines.sort()
    with open(os.path.join(OUT, "MANIFEST.sha256"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(f"{h}  {rel}" for rel, h in lines) + "\n")


if __name__ == "__main__":
    sys.exit(main())
