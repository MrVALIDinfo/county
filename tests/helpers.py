"""Shared test helpers: backend on sys.path, throwaway DB, in-process HTTP server on a random port."""
import contextlib
import http.client
import json
import os
import sys
import tempfile
import threading
import unittest

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
BACKEND = os.path.join(ROOT, "backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

import db  # noqa: E402

REAL_DB = os.path.normpath(db.PATH)


class TempDB:
    """Point db.PATH at a temp file (before any connect) and restore it afterwards."""

    def __init__(self):
        self.dir = tempfile.mkdtemp(prefix="fc_test_")
        self.path = os.path.join(self.dir, "test.db")
        self.old = db.PATH
        db.PATH = self.path
        assert os.path.normpath(db.PATH) != REAL_DB

    def connect(self):
        assert os.path.normpath(db.PATH) == os.path.normpath(self.path)
        return db.connect()

    def close(self):
        db.PATH = self.old
        import shutil
        shutil.rmtree(self.dir, ignore_errors=True)


class DBCase(unittest.TestCase):
    """Each test gets a fresh throwaway DB and connection `self.c`."""

    def setUp(self):
        self.tmp = TempDB()
        self.c = self.tmp.connect()

    def tearDown(self):
        self.c.close()
        self.tmp.close()


def add_tx(c, date, cents, merchant="Shop", cat="shopping", direction="out", status="auto",
           mode="silent", cp="merchant", source="csv", ext_id=None, conf=0.9):
    import rules
    c.execute("INSERT INTO transactions(date,amount_cents,currency,merchant,merchant_key,category,direction,"
              "counterparty_type,source,confidence,status,mode,ext_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
              (date, cents, "CNY", merchant, rules.norm_key(merchant), cat, direction, cp, source, conf,
               status, mode, ext_id))
    c.commit()


OWNER = ("owner_anna", "correct-horse-battery-9")
VIEWER = ("viewer_bob", "another-long-pass-7")


class Client:
    """Tiny HTTP client with its own cookie jar, talking to the in-process test server."""

    def __init__(self, port):
        self.port = port
        self.cookie = None
        self.last_set_cookie = []

    def raw(self, method, path, body=None, headers=None, host=None, use_cookie=True):
        """-> (status, response, parsed_json_or_text). body: bytes/str or None."""
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=30)
        try:
            conn.putrequest(method, path, skip_host=True, skip_accept_encoding=True)
            conn.putheader("Host", host or f"127.0.0.1:{self.port}")
            hs = dict(headers or {})
            if isinstance(body, str):
                body = body.encode()
            if body is not None and not any(k.lower() == "content-length" for k in hs):
                hs["Content-Length"] = str(len(body))
            if use_cookie and self.cookie and not any(k.lower() == "cookie" for k in hs):
                hs["Cookie"] = f"fc_session={self.cookie}"
            for k, v in hs.items():
                if v is not None:
                    conn.putheader(k, v)
            conn.endheaders(body)
            r = conn.getresponse()
            data = r.read()
            self.last_set_cookie = r.msg.get_all("Set-Cookie") or []
            for ck in self.last_set_cookie:
                name, _, rest = ck.partition("=")
                if name == "fc_session":
                    self.cookie = rest.split(";", 1)[0] or None
            try:
                parsed = json.loads(data)
            except ValueError:
                parsed = data.decode("utf-8", "replace")
            return r.status, r, parsed
        finally:
            conn.close()

    def get(self, path, **kw):
        return self.raw("GET", path, **kw)

    def post(self, path, obj=None, headers=None, **kw):
        h = {"Content-Type": "application/json"}
        h.update(headers or {})
        return self.raw("POST", path, json.dumps(obj if obj is not None else {}), headers=h, **kw)


class FakeClock:
    """Offset clock substituted for auth.now so expiry tests need no sleeping."""

    def __init__(self):
        import time
        self.real = time.time
        self.offset = 0.0

    def __call__(self):
        return self.real() + self.offset


class ServerCase(unittest.TestCase):
    """Own in-process server on 127.0.0.1:<random free port> with a throwaway DB.
    Fast password hashing (auth.ITERATIONS lowered), lessons state file redirected, rate limiter reset."""

    def setUp(self):
        import server
        from http.server import ThreadingHTTPServer
        self.tmp = TempDB()
        self.server_mod = server
        self._patches = []
        self.clock = FakeClock()
        try:
            import auth
            self.auth = auth
            self._patch(auth, "ITERATIONS", 1000)
            self._patch(auth, "now", self.clock)
        except ImportError:
            self.auth = None
        try:
            import lessons
            self._patch(lessons, "STATE_FILE", os.path.join(self.tmp.dir, "lessons_state.json"))
        except ImportError:
            pass
        if hasattr(server, "_rate"):
            server._rate.clear()
        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        self.port = self.srv.server_address[1]
        self.thread = threading.Thread(target=self.srv.serve_forever, daemon=True)
        self.thread.start()
        self.anon = Client(self.port)

    def _patch(self, obj, name, value):
        self._patches.append((obj, name, getattr(obj, name)))
        setattr(obj, name, value)

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()
        self.thread.join(5)
        for obj, name, old in reversed(self._patches):
            setattr(obj, name, old)
        self.tmp.close()

    def client(self):
        return Client(self.port)

    def owner_client(self, consent=True):
        """Fresh owner account (first-run setup) + logged-in client; optionally records PIPL consent."""
        cl = self.client()
        st, _, b = cl.post("/api/auth/setup", {"username": OWNER[0], "password": OWNER[1]})
        assert st == 200, (st, b)
        if consent:
            st, _, b = cl.post("/api/consent", {"agree": True, "version": "v1"})
            assert st == 200, (st, b)
        return cl

    def stepup(self, cl, password=OWNER[1]):
        st, _, b = cl.post("/api/auth/stepup", {"password": password})
        assert st == 200, (st, b)

    # anonymous shortcuts
    def raw(self, *a, **kw):
        return self.anon.raw(*a, **kw)

    def get(self, *a, **kw):
        return self.anon.get(*a, **kw)

    def post(self, *a, **kw):
        return self.anon.post(*a, **kw)
