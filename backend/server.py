"""Zero-dependency server: static frontend + JSON API with authentication.
Run:  python backend/server.py                    (localhost only)
      python backend/server.py --lan              (reachable from phones on the same Wi-Fi; plain HTTP, trusted Wi-Fi only)
      python backend/server.py --tls-cert C --tls-key K   (HTTPS; the owner must supply the certificate)
      python backend/server.py --demo-account     (recording only: creates an owner 'demo'; NOT for production)

Every /api request goes through ONE policy table (POLICY). Tiers:
  PUBLIC     no session            static files, auth status, setup, login
  SESSION    any logged-in user    logout, step-up
  READ       viewer or owner       read-only data endpoints, Ask AI
  OWNER      owner                 user list, audit log (not audited themselves)
  WRITE      owner (audited)       every other state-changing call
  SENSITIVE  owner + step-up <=5m  delete-all, demo reset, export, guest management (audited)
Unknown /api paths get SENSITIVE (strictest)."""
import json
import mimetypes
import os
import secrets
import socket
import ssl
import sys
import threading
import time
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import audit
import auth
import db
import ext_routes
import service

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend"))
PORT = int(os.environ.get("PORT", "8000"))
TOKEN = None          # set with --lan: required as X-Token on every /api/* request
TLS = False           # set when the server runs with --tls-cert/--tls-key
ALLOWED_HOSTS = {"localhost", "127.0.0.1", "[::1]"}
RATE_LIMIT = 240      # /api requests per client IP per RATE_WINDOW seconds
RATE_WINDOW = 60
MAX_BODY = 9_000_000
CSP = ("default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; "
       "connect-src 'self'; frame-ancestors 'none'")

PUBLIC, SESSION, READ, OWNER, WRITE, SENSITIVE = "PUBLIC", "SESSION", "READ", "OWNER", "WRITE", "SENSITIVE"
POLICY = {
    ("GET", "/api/auth/status"): PUBLIC,
    ("POST", "/api/auth/setup"): PUBLIC,
    ("POST", "/api/auth/login"): PUBLIC,
    ("POST", "/api/auth/logout"): SESSION,
    ("POST", "/api/auth/stepup"): SESSION,
    ("POST", "/api/auth/password"): WRITE,
    ("POST", "/api/auth/viewer"): SENSITIVE,
    ("POST", "/api/auth/users/delete"): SENSITIVE,
    ("GET", "/api/auth/users"): OWNER,
    ("GET", "/api/audit"): OWNER,
    ("POST", "/api/consent"): WRITE,
    ("POST", "/api/consent/withdraw"): WRITE,
    **{("GET", p): READ for p in ("/api/state", "/api/transactions", "/api/news", "/api/lessons", "/api/research",
                                  "/api/benchmark", "/api/insights", "/api/report")},
    ("POST", "/api/ask"): READ,
    ("GET", "/api/learn"): READ,
    ("POST", "/api/learn/complete"): WRITE,
    ("POST", "/api/learn/reset"): WRITE,
    **{("POST", p): WRITE for p in ("/api/import", "/api/scan", "/api/chat", "/api/confirm", "/api/resolve",
                                    "/api/goal", "/api/goal/delete", "/api/goal/deposit", "/api/profile",
                                    "/api/lessons/update", "/api/lessons/reset", "/api/news/refresh")},
    ("POST", "/api/delete-all"): SENSITIVE,
    ("POST", "/api/demo"): SENSITIVE,
    ("GET", "/api/export"): SENSITIVE,
}
CONSENT_GATED = {"/api/import", "/api/scan", "/api/chat", "/api/demo"}   # data-ingestion endpoints (POST)

_rate = {}
_rate_lock = threading.Lock()


def rate_ok(ip):
    t = time.monotonic()
    with _rate_lock:
        dq = _rate.setdefault(ip, deque())
        while dq and t - dq[0] > RATE_WINDOW:
            dq.popleft()
        if len(dq) >= RATE_LIMIT:
            return False
        dq.append(t)
        if len(_rate) > 5000:   # bound memory
            for k in [k for k, v in _rate.items() if not v or t - v[-1] > RATE_WINDOW]:
                _rate.pop(k, None)
    return True


class Reply(Exception):
    """Raised to end request handling with a JSON reply."""
    def __init__(self, obj, code=200):
        super().__init__(code)
        self.obj, self.code = obj, code


def _query(path_qs):
    return {k: v[0] for k, v in parse_qs(urlparse(path_qs).query).items()}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def setup(self):
        super().setup()
        self.connection.settimeout(15)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()")
        if TLS:
            self.send_header("Strict-Transport-Security", "max-age=31536000")
        super().end_headers()

    # ---------- request checks ----------
    def _host_ok(self):
        h = (self.headers.get("Host") or "").strip().lower()
        h = h.rsplit(":", 1)[0] if not h.endswith("]") else h
        return h in ALLOWED_HOSTS

    def _token_ok(self):
        return not TOKEN or secrets.compare_digest((self.headers.get("X-Token") or "").encode(), TOKEN.encode())

    def _origin_ok(self):
        o = self.headers.get("Origin")
        if o is None:
            return True
        host = (self.headers.get("Host") or "").strip().lower()
        return urlparse(o).netloc.lower() == host and bool(host)

    @property
    def ip(self):
        return self.client_address[0]

    # ---------- replies ----------
    def _json(self, obj, code=200):
        if getattr(self, "_aud", None) and getattr(self, "_c", None) is not None:   # audit before the client sees the result
            user, role, action = self._aud
            self._aud = None
            try:
                audit.record(self._c, user, role, action, "ok" if code < 400 else f"error:{code}", self.ip)
            except Exception:
                print("[server] audit write failed")
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for ck in getattr(self, "_cookies", []):
            self.send_header("Set-Cookie", ck)
        self.end_headers()
        self.wfile.write(body)

    def _set_session_cookie(self, token, max_age):
        self._cookies.append(auth.cookie_header(token, max_age, TLS))

    def _clear_cookie(self):
        self._cookies.append(auth.cookie_header("", 0, TLS))

    def _body(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = 0
        n = max(0, n)
        if n > MAX_BODY:
            raise Reply({"error": "too_large"}, 413)
        raw = self.rfile.read(n) if n else b""
        if not raw.strip():
            return {}
        if not raw.lstrip()[:1] == b"{":
            raise Reply({"error": "invalid_json"}, 400)
        try:
            d = json.loads(raw)
        except (ValueError, RecursionError):
            raise Reply({"error": "invalid_json"}, 400)
        return d if isinstance(d, dict) else {}

    def _session(self):
        ck = self.headers.get("Cookie") or ""
        token = None
        for part in ck.split(";"):
            k, _, v = part.strip().partition("=")
            if k == auth.COOKIE:
                token = v
        self._token = token
        s = auth.lookup(self._c, token) if token else None
        if token and not s:
            self._clear_cookie()
        return s

    # ---------- entry points ----------
    def do_GET(self):
        self._handle("GET")

    def do_POST(self):
        self._handle("POST")

    def _handle(self, method):
        self._cookies, self._aud, self._c, self._token = [], None, None, None
        path = urlparse(self.path).path
        try:
            if not self._host_ok():
                return self._json({"error": "forbidden"}, 403)
            if not path.startswith("/api/"):
                if method == "GET":
                    return self._static(path)
                return self._json({"error": "not found"}, 404)
            if not rate_ok(self.ip):
                self.close_connection = True
                return self._json({"error": "rate_limited", "retry_after": RATE_WINDOW}, 429)
            if not self._token_ok():
                return self._json({"error": "unauthorized"}, 401)
            if method == "POST":
                if not self._origin_ok():
                    return self._json({"error": "bad_origin"}, 403)
                if not (self.headers.get("Content-Type") or "").lower().startswith("application/json"):
                    return self._json({"error": "unsupported media type"}, 415)
            self._c = db.connect()
            self._api(method, path)
        except Reply as r:
            self._json(r.obj, r.code)
        except auth.AuthError as e:
            self._json({"error": e.code, **e.extra}, e.status)
        except KeyError:
            self._json({"error": "missing_field"}, 400)
        except (ValueError, TypeError, AttributeError) as e:
            self._json({"error": str(e) if str(e) in ("bad category", "goal not found") else "bad_input"}, 400)
        except (RecursionError, ArithmeticError, MemoryError):   # includes decimal.DecimalException / OverflowError
            self._json({"error": "bad_input"}, 400)
        except (BrokenPipeError, ConnectionError, socket.timeout):
            self.close_connection = True
        except Exception as e:
            print(f"[server] internal error: {type(e).__name__} on {method} {path[:60]}")
            try:
                self._json({"error": "internal"}, 500)
            except Exception:
                pass
        finally:
            if self._c is not None:
                try:
                    self._c.close()
                except Exception:
                    pass

    def _static(self, path):
        rel = "index.html" if path in ("/", "") else path.lstrip("/")
        full = os.path.normpath(os.path.join(ROOT, rel))
        if not full.startswith(ROOT + os.sep) or not os.path.isfile(full):
            self.send_error(404)
            return
        with open(full, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", (mimetypes.guess_type(full)[0] or "application/octet-stream") + ("; charset=utf-8" if full.endswith((".html", ".js", ".css", ".json", ".svg")) else ""))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    # ---------- the policy gate ----------
    def _api(self, method, path):
        c = self._c
        tier = POLICY.get((method, path), SENSITIVE)    # unknown -> strictest
        sess = self._session()
        user, role = (sess["username"], sess["role"]) if sess else ("", "")
        if tier != PUBLIC:
            if not sess:
                return self._json({"error": "unauthenticated"}, 401)
            audited = tier in (WRITE, SENSITIVE)
            if audited:
                self._aud = (user, role, f"{method} {path}")
            if tier in (OWNER, WRITE, SENSITIVE) and role != "owner":
                return self._deny("forbidden", 403, audited, role=role)
            if tier == READ and role not in ("owner", "viewer"):
                return self._deny("forbidden", 403, audited, role=role)
            if tier == SENSITIVE and not sess["stepup_ok"]:
                return self._deny("stepup_required", 403, audited)
            if method == "POST" and path in CONSENT_GATED and not c.execute("SELECT 1 FROM consent").fetchone():
                return self._deny("consent_required", 428, audited)
        d = self._body() if method == "POST" else None
        return self._route(method, path, d, sess)

    def _deny(self, code, status, audited, **extra):
        if audited:
            user, role, action = self._aud
            self._aud = (user, role, action + " [denied]")
        return self._json({"error": code, **extra}, status)

    def _status(self, sess):
        c = self._c
        cons = c.execute("SELECT version,at FROM consent WHERE id=1").fetchone()
        return {"configured": auth.user_count(c) > 0, "authenticated": bool(sess),
                "username": sess["username"] if sess else None, "role": sess["role"] if sess else None,
                "stepup_until": int(sess["stepup_until"]) if sess and sess["stepup_ok"] else None,
                "consent": dict(cons) if cons else None, "idle_timeout_s": auth.IDLE_TIMEOUT}

    def _login_ok(self, user_id, username, role, action):
        token = auth.login_session(self._c, user_id, self.ip, self._token)
        self._set_session_cookie(token, auth.ABS_LIFETIME)
        audit.record(self._c, username, role, action, "ok", self.ip)
        return {"ok": True, "username": username, "role": role, "stepup_until": None}

    def _route(self, method, path, d, sess):
        c = self._c
        # ----- auth -----
        if path == "/api/auth/status":
            return self._json(self._status(sess))
        if path == "/api/auth/setup":
            if auth.user_count(c):
                raise auth.AuthError("already_configured", 409)
            uid = auth.create_user(c, d.get("username"), d.get("password"), "owner", single_owner_setup=True)
            return self._json(self._login_ok(uid, d["username"], "owner", "setup"))
        if path == "/api/auth/login":
            uname = d.get("username")
            try:
                row = auth.authenticate(c, uname, d.get("password"), self.ip)
            except auth.AuthError as e:
                audit.record(c, uname if isinstance(uname, str) else "", "", "login", e.code, self.ip)
                raise
            return self._json(self._login_ok(row["id"], row["username"], row["role"], "login"))
        if path == "/api/auth/logout":
            auth.logout(c, self._token)
            self._clear_cookie()
            audit.record(c, sess["username"], sess["role"], "logout", "ok", self.ip)
            return self._json({"ok": True})
        if path == "/api/auth/stepup":
            try:
                auth.verify_for_stepup(c, sess["user_id"], sess["username"], d.get("password"), self.ip)
            except auth.AuthError as e:
                audit.record(c, sess["username"], sess["role"], "stepup", e.code, self.ip)
                raise
            token, until = auth.stepup(c, sess, self.ip)
            self._set_session_cookie(token, auth.remaining_lifetime(sess))
            audit.record(c, sess["username"], sess["role"], "stepup", "ok", self.ip)
            return self._json({"ok": True, "stepup_until": int(until)})
        if path == "/api/auth/password":
            auth.change_password(c, sess["user_id"], sess["username"], d.get("old"), d.get("new"), sess["token_hash"])
            return self._json({"ok": True})
        if path == "/api/auth/viewer":
            auth.create_user(c, d.get("username"), d.get("password"), "viewer")
            return self._json({"ok": True, "username": d["username"], "role": "viewer"})
        if path == "/api/auth/users/delete":
            auth.delete_user(c, d.get("username"))
            return self._json({"ok": True})
        if path == "/api/auth/users":
            return self._json({"users": auth.list_users(c)})
        if path == "/api/audit":
            try:
                limit = int(_query(self.path).get("limit", 50))
            except ValueError:
                limit = 50
            ok, broken = audit.verify_chain(c)
            return self._json({"entries": audit.recent(c, limit), "chain_ok": ok, "first_broken_id": broken})
        if path == "/api/consent":
            if d.get("agree") is not True:
                raise Reply({"error": "agree_required"}, 400)
            ver = str(d.get("version", ""))[:32]
            if not ver:
                raise Reply({"error": "version_required"}, 400)
            at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            c.execute("INSERT INTO consent(id,version,at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version, at=excluded.at",
                      (ver, at))
            c.commit()
            return self._json({"ok": True, "consent": {"version": ver, "at": at}})
        if path == "/api/consent/withdraw":
            c.execute("DELETE FROM consent")
            c.commit()
            return self._json({"ok": True})
        # ----- data -----
        if method == "GET":
            if path == "/api/state":
                return self._json(service.state(c))
            if path == "/api/transactions":
                return self._json(service.transactions(c, _query(self.path)))
            fn = ext_routes.GET.get(path)
            if fn:
                return self._json(fn(c, _query(self.path)))
            return self._json({"error": "not found"}, 404)
        if path == "/api/demo":
            return self._json(service.load_demo(c))
        if path == "/api/import":
            return self._json(service.import_text(c, str(d.get("csv", ""))))
        if path == "/api/scan":
            return self._json(service.scan_image(c, str(d.get("image", "")), str(d.get("media_type", "image/jpeg"))))
        if path == "/api/ask":
            return self._json(service.ask(c, d))
        fn = ext_routes.POST.get(path)
        if fn:
            return self._json(fn(c, d))
        if path == "/api/chat":
            return self._json(service.chat(c, str(d.get("text", ""))[:300]))
        if path == "/api/confirm":
            return self._json(service.confirm(c, int(d["id"]), str(d["category"])))
        if path == "/api/resolve":
            return self._json(service.resolve(c, int(d["id"]), str(d["purpose"])))
        if path == "/api/goal":
            return self._json(service.set_goal(c, d))
        if path == "/api/goal/delete":
            service.delete_goal(c, int(d["id"]))
            return self._json({"ok": True})
        if path == "/api/goal/deposit":
            service.deposit_goal(c, int(d["id"]), int(d["amount_cents"]))
            return self._json({"ok": True})
        if path == "/api/profile":
            service.set_profile(c, d)
            return self._json({"ok": True})
        if path == "/api/delete-all":
            db.wipe(c, consent=True)          # ledger + consent record (right to erasure); users/sessions/audit are kept
            try:
                import lessons
                lessons._set_version(1)       # lessons progress back to the first pack
            except Exception:
                pass
            return self._json({"ok": True})
        return self._json({"error": "not found"}, 404)


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):   # one line, no traceback, no user data
        print(f"[server] connection error: {type(sys.exc_info()[1]).__name__}")


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def _arg(name):
    if name in sys.argv:
        i = sys.argv.index(name)
        return sys.argv[i + 1] if i + 1 < len(sys.argv) else None
    return None


def _tls_context():
    cert, key = _arg("--tls-cert"), _arg("--tls-key")
    if not cert and not key and "--tls-cert" not in sys.argv and "--tls-key" not in sys.argv:
        return None
    if not cert or not key or not os.path.isfile(cert) or not os.path.isfile(key):
        sys.exit("TLS needs BOTH --tls-cert FILE and --tls-key FILE pointing to existing PEM files.\n"
                 "The owner must supply a certificate (this app does not generate one). For a local test certificate:\n"
                 "  mkcert localhost 127.0.0.1   (https://github.com/FiloSottile/mkcert)  or  openssl req -x509 -newkey rsa:2048 -nodes "
                 "-keyout key.pem -out cert.pem -days 365 -subj /CN=localhost")
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    ctx.load_cert_chain(cert, key)
    return ctx


def _demo_account():
    c = db.connect()
    try:
        if c.execute("SELECT 1 FROM users WHERE username='demo'").fetchone():
            print("DEMO ACCOUNT 'demo' already exists (password unchanged).")
        else:
            pw = os.environ.get("FC_DEMO_PASSWORD") or secrets.token_urlsafe(9)
            auth.create_user(c, "demo", pw, "owner")
            if not os.environ.get("FC_DEMO_PASSWORD"):
                print(f"DEMO ACCOUNT created: user 'demo'  password '{pw}'")
            else:
                print("DEMO ACCOUNT created: user 'demo', password from FC_DEMO_PASSWORD")
        print("!" * 70)
        print("!!  DEMO ACCOUNT, NOT FOR PRODUCTION. Use only for recording the demo video.  !!")
        print("!" * 70)
    finally:
        c.close()


if __name__ == "__main__":
    lan = "--lan" in sys.argv
    ctx = _tls_context()
    TLS = ctx is not None
    if lan:
        ip = lan_ip()
        ALLOWED_HOSTS.add(ip)
        TOKEN = secrets.token_urlsafe(8)
    if "--demo-account" in sys.argv:
        _demo_account()
    srv = Server(("0.0.0.0" if lan else "127.0.0.1", PORT), Handler)
    if ctx:
        srv.socket = ctx.wrap_socket(srv.socket, server_side=True, do_handshake_on_connect=False)
    scheme = "https" if TLS else "http"
    print(f"Local:  {scheme}://localhost:{PORT}")
    if lan:
        print(f"Phone:  {scheme}://{ip}:{PORT}/?t={TOKEN}  (same Wi-Fi; accounts + session cookie still required)")
        if not TLS:
            print("WARNING: --lan without TLS sends the token, session cookie and your data in clear text. Trusted Wi-Fi only; "
                  "use --tls-cert/--tls-key for HTTPS (also needed for the microphone on phones).")
    srv.serve_forever()
