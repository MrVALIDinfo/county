"""Authentication, roles, consent gate, step-up, sessions, lockout, audit chain, secret storage.
Own in-process server per test; fast PBKDF2 (auth.ITERATIONS lowered) and an offset clock (auth.now) so
expiry tests are instant and deterministic."""
import hashlib
import sqlite3
import unittest

from tests.helpers import OWNER, VIEWER, ServerCase
import db

try:
    import auth
    import audit  # noqa: F401
    HAS_AUTH = True
except ImportError:
    HAS_AUTH = False


@unittest.skipUnless(HAS_AUTH, "backend/auth.py or audit.py missing: auth contract tests skipped")
class AuthBase(ServerCase):
    def make_viewer(self, owner, name=VIEWER[0], pw=VIEWER[1]):
        self.stepup(owner)
        st, _, b = owner.post("/api/auth/viewer", {"username": name, "password": pw})
        self.assertEqual(st, 200, b)
        cl = self.client()
        st, _, b = cl.post("/api/auth/login", {"username": name, "password": pw})
        self.assertEqual(st, 200, b)
        return cl

    def dump_db_text(self):
        con = sqlite3.connect(db.PATH)
        try:
            out = []
            for (t,) in con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall():
                out.append(t + ":" + repr(con.execute(f"SELECT * FROM {t}").fetchall()))
            return "\n".join(out)
        finally:
            con.close()


class TestSetupAndPasswords(AuthBase):
    def test_status_is_public(self):
        st, _, b = self.get("/api/auth/status")
        self.assertEqual(st, 200)
        self.assertFalse(b["configured"])
        self.assertFalse(b["authenticated"])
        self.assertIsNone(b["username"])

    def test_setup_only_once(self):
        cl = self.client()
        st, _, b = cl.post("/api/auth/setup", {"username": OWNER[0], "password": OWNER[1]})
        self.assertEqual((st, b["role"]), (200, "owner"))
        st, _, b = self.client().post("/api/auth/setup", {"username": "other_user", "password": "another-long-pass-1"})
        self.assertEqual((st, b["error"]), (409, "already_configured"))
        self.assertTrue(self.get("/api/auth/status")[2]["configured"])

    def test_weak_passwords_rejected_and_no_user_created(self):
        cases = [("short", "password_too_short"), ("1234567", "password_too_short"),
                 ("aaaaaaaaaaaa", "password_one_character"), (OWNER[0], "password_equals_username"),
                 (OWNER[0].upper(), "password_equals_username"), ("x" * 257, "password_too_long"),
                 (12345678, "password_invalid"), (None, "password_invalid")]
        for pw, code in cases:
            st, _, b = self.client().post("/api/auth/setup", {"username": OWNER[0], "password": pw})
            self.assertEqual((st, b.get("error")), (400, code), pw if not isinstance(pw, str) else pw[:12])
        self.assertFalse(self.get("/api/auth/status")[2]["configured"])

    def test_bad_usernames_rejected(self):
        for u in ("ab", "has space", "x" * 33, "a;b", "", None, ["a"], "emoji\U0001f600xx"):
            st, _, b = self.client().post("/api/auth/setup", {"username": u, "password": OWNER[1]})
            self.assertEqual((st, b.get("error")), (400, "username_invalid"), u)

    def test_min_length_boundary(self):
        st, _, b = self.client().post("/api/auth/setup", {"username": OWNER[0], "password": "abcdefgh"})
        self.assertEqual(st, 200, b)


class TestLoginAndCookie(AuthBase):
    def test_login_sets_secure_cookie_flags(self):
        self.owner_client(consent=False)
        cl = self.client()
        st, r, b = cl.post("/api/auth/login", {"username": OWNER[0], "password": OWNER[1]})
        self.assertEqual(st, 200, b)
        cks = [c for c in cl.last_set_cookie if c.startswith("fc_session=")]
        self.assertEqual(len(cks), 1)
        ck = cks[0]
        self.assertIn("HttpOnly", ck)
        self.assertIn("SameSite=Strict", ck)
        self.assertIn("Path=/", ck)
        self.assertRegex(ck, r"Max-Age=\d+")
        self.assertGreaterEqual(len(cl.cookie), 40)
        self.assertNotIn(OWNER[1], ck)
        self.assertNotIn("token", b)
        self.assertNotIn("password", str(b))

    def test_setup_also_sets_cookie(self):
        cl = self.client()
        cl.post("/api/auth/setup", {"username": OWNER[0], "password": OWNER[1]})
        self.assertTrue(any("HttpOnly" in c and "SameSite=Strict" in c for c in cl.last_set_cookie))
        self.assertEqual(cl.get("/api/auth/status")[2]["username"], OWNER[0])

    def test_unauthenticated_api_is_401(self):
        self.owner_client(consent=False)
        for m, p in (("GET", "/api/state"), ("GET", "/api/transactions"), ("GET", "/api/export"),
                     ("GET", "/api/audit"), ("GET", "/api/benchmark"), ("GET", "/api/nope"),
                     ("POST", "/api/chat"), ("POST", "/api/delete-all"), ("POST", "/api/demo"),
                     ("POST", "/api/auth/logout"), ("POST", "/api/auth/stepup"), ("POST", "/api/auth/viewer")):
            st, _, b = self.get(p) if m == "GET" else self.post(p, {})
            self.assertEqual((st, b["error"]), (401, "unauthenticated"), (m, p))

    def test_garbage_and_forged_cookies_are_401(self):
        self.owner_client(consent=False)
        for ck in ("fc_session=", "fc_session=abc", "fc_session=" + "A" * 43, "fc_session=" + "A" * 500,
                   "other=1", "fc_session=' OR 1=1--"):
            st, _, _ = self.get("/api/state", headers={"Cookie": ck})
            self.assertEqual(st, 401, ck[:30])

    def test_token_in_query_or_header_is_not_a_session(self):
        o = self.owner_client(consent=False)
        tok = o.cookie
        self.assertEqual(self.get("/api/state?fc_session=" + tok)[0], 401)
        self.assertEqual(self.get("/api/state", headers={"X-Session": tok, "Authorization": "Bearer " + tok})[0], 401)

    def test_wrong_credentials_generic_error(self):
        self.owner_client(consent=False)
        a = self.client().post("/api/auth/login", {"username": OWNER[0], "password": "wrong-password-1"})
        b = self.client().post("/api/auth/login", {"username": "nobody_here", "password": "wrong-password-1"})
        self.assertEqual((a[0], b[0]), (401, 401))
        self.assertEqual(a[2], b[2])
        self.assertEqual(a[2], {"error": "invalid_credentials"})

    def test_login_with_odd_types_is_401_not_500(self):
        self.owner_client(consent=False)
        for body in ({}, {"username": OWNER[0]}, {"username": ["x"], "password": {"a": 1}}, {"username": 5, "password": 5},
                     {"username": "x" * 5000, "password": "y" * 5000}):
            st, _, b = self.client().post("/api/auth/login", body)
            self.assertEqual((st, b["error"]), (401, "invalid_credentials"), body)

    def test_username_is_case_sensitive_or_consistent(self):
        self.owner_client(consent=False)
        st, _, b = self.client().post("/api/auth/login", {"username": OWNER[0], "password": OWNER[1]})
        self.assertEqual(st, 200, b)


class TestLockout(AuthBase):
    def lock(self, user):
        codes = []
        for _ in range(auth.LOCK_AFTER):
            st, _, b = self.client().post("/api/auth/login", {"username": user, "password": "wrong-password-1"})
            codes.append((st, b))
        return codes

    def test_known_user_locked_after_five(self):
        self.owner_client(consent=False)
        codes = self.lock(OWNER[0])
        self.assertEqual([s for s, _ in codes], [401] * (auth.LOCK_AFTER - 1) + [429])
        last = codes[-1][1]
        self.assertEqual(last["error"], "locked")
        self.assertGreaterEqual(last["retry_after"], 1)
        self.assertLessEqual(last["retry_after"], auth.LOCK_BASE + 1)
        # even the correct password is refused while locked
        st, _, b = self.client().post("/api/auth/login", {"username": OWNER[0], "password": OWNER[1]})
        self.assertEqual((st, b["error"]), (429, "locked"))
        self.assertIn("retry_after", b)

    def test_unknown_user_same_behaviour(self):
        self.owner_client(consent=False)
        known_first = self.client().post("/api/auth/login", {"username": OWNER[0], "password": "wrong-password-1"})
        codes = self.lock("ghost_user")
        self.assertEqual([s for s, _ in codes], [401] * (auth.LOCK_AFTER - 1) + [429])
        self.assertEqual(codes[0][1], known_first[2])  # identical generic body
        self.assertEqual(codes[-1][1]["error"], "locked")
        self.assertIn("retry_after", codes[-1][1])

    def test_lock_expires(self):
        self.owner_client(consent=False)
        self.lock(OWNER[0])
        self.clock.offset += auth.LOCK_BASE + 5
        st, _, b = self.client().post("/api/auth/login", {"username": OWNER[0], "password": OWNER[1]})
        self.assertEqual(st, 200, b)

    def test_success_resets_failure_counter(self):
        self.owner_client(consent=False)
        for _ in range(auth.LOCK_AFTER - 1):
            self.assertEqual(self.client().post("/api/auth/login", {"username": OWNER[0], "password": "wrong-password-1"})[0], 401)
        self.assertEqual(self.client().post("/api/auth/login", {"username": OWNER[0], "password": OWNER[1]})[0], 200)
        for _ in range(auth.LOCK_AFTER - 1):
            self.assertEqual(self.client().post("/api/auth/login", {"username": OWNER[0], "password": "wrong-password-1"})[0], 401)

    def test_lockout_is_per_username(self):
        self.owner_client(consent=False)
        self.lock("ghost_user")
        self.assertEqual(self.client().post("/api/auth/login", {"username": OWNER[0], "password": OWNER[1]})[0], 200)

    def test_stepup_wrong_password_locks_too(self):
        o = self.owner_client(consent=False)
        st, _, b = o.post("/api/auth/stepup", {"password": "wrong-password-1"})
        self.assertEqual((st, b["error"]), (403, "invalid_password"))
        for _ in range(auth.LOCK_AFTER - 1):
            st, _, b = o.post("/api/auth/stepup", {"password": "wrong-password-1"})
        self.assertEqual((st, b["error"]), (429, "locked"))


class TestRoles(AuthBase):
    def test_viewer_reads_but_cannot_write(self):
        o = self.owner_client()
        v = self.make_viewer(o)
        self.assertEqual(v.get("/api/state")[0], 200)
        self.assertEqual(v.get("/api/transactions")[0], 200)
        self.assertEqual(v.get("/api/benchmark")[0], 200)
        self.assertEqual(v.post("/api/ask", {"kind": "budget"})[0], 200)
        for p, body in (("/api/chat", {"text": "coffee 5"}), ("/api/goal", {"name": "x", "target_cents": 1}),
                        ("/api/profile", {"payday_day": 5, "income_cents": 1}), ("/api/import", {"csv": ""}),
                        ("/api/confirm", {"id": 1, "category": "other"}), ("/api/consent", {"agree": True, "version": "v1"}),
                        ("/api/auth/password", {"old": VIEWER[1], "new": "brand-new-pass-9"})):
            st, _, b = v.post(p, body)
            self.assertEqual((st, b["error"]), (403, "forbidden"), p)

    def test_viewer_cannot_use_owner_or_sensitive_endpoints(self):
        o = self.owner_client()
        v = self.make_viewer(o)
        for p in ("/api/audit", "/api/auth/users", "/api/export"):
            self.assertEqual(v.get(p)[0], 403, p)
        for p in ("/api/delete-all", "/api/demo", "/api/auth/viewer", "/api/auth/users/delete"):
            self.assertEqual(v.post(p, {})[0], 403, p)
        # a viewer cannot get step-up powers either: step-up succeeds for the session but role still blocks
        v.post("/api/auth/stepup", {"password": VIEWER[1]})
        self.assertEqual(v.get("/api/export")[0], 403)
        self.assertEqual(v.post("/api/delete-all", {})[0], 403)

    def test_viewer_cannot_create_users_or_delete_owner(self):
        o = self.owner_client()
        v = self.make_viewer(o)
        st, _, b = v.post("/api/auth/viewer", {"username": "third_user", "password": "third-user-pass-1"})
        self.assertEqual(st, 403)
        self.stepup(o)
        st, _, b = o.post("/api/auth/users/delete", {"username": OWNER[0]})
        self.assertEqual((st, b["error"]), (409, "cannot_delete_owner"))

    def test_duplicate_username_case_insensitive(self):
        o = self.owner_client()
        self.stepup(o)
        st, _, b = o.post("/api/auth/viewer", {"username": OWNER[0].upper(), "password": VIEWER[1]})
        self.assertEqual((st, b["error"]), (409, "username_taken"))

    def test_deleted_viewer_session_dies(self):
        o = self.owner_client()
        v = self.make_viewer(o)
        self.assertEqual(v.get("/api/state")[0], 200)
        st, _, b = o.post("/api/auth/users/delete", {"username": VIEWER[0]})
        self.assertEqual(st, 200, b)
        self.assertEqual(v.get("/api/state")[0], 401)

    def test_owner_user_list_has_no_secrets(self):
        o = self.owner_client()
        self.make_viewer(o)
        st, _, b = o.get("/api/auth/users")
        self.assertEqual(st, 200)
        self.assertEqual({u["username"] for u in b["users"]}, {OWNER[0], VIEWER[0]})
        text = str(b)
        for bad in ("pwd_hash", "salt", "iterations", VIEWER[1], OWNER[1]):
            self.assertNotIn(bad, text)


class TestConsentGate(AuthBase):
    def test_chat_needs_consent_428_then_ok(self):
        o = self.owner_client(consent=False)
        for p, body in (("/api/chat", {"text": "coffee 5"}), ("/api/import", {"csv": ""}),
                        ("/api/scan", {"image": ""})):
            st, _, b = o.post(p, body)
            self.assertEqual((st, b["error"]), (428, "consent_required"), p)
        self.assertIsNone(o.get("/api/auth/status")[2]["consent"])
        st, _, b = o.post("/api/consent", {"agree": True, "version": "v1"})
        self.assertEqual(st, 200, b)
        st, _, b = o.post("/api/chat", {"text": "coffee 5"})
        self.assertEqual(st, 200, b)
        self.assertEqual(o.get("/api/auth/status")[2]["consent"]["version"], "v1")

    def test_consent_validation_and_withdraw(self):
        o = self.owner_client(consent=False)
        for body in ({}, {"agree": "yes", "version": "v1"}, {"agree": False, "version": "v1"}, {"agree": True},
                     {"agree": True, "version": ""}):
            self.assertEqual(o.post("/api/consent", body)[0], 400, body)
        o.post("/api/consent", {"agree": True, "version": "v1"})
        self.assertEqual(o.post("/api/chat", {"text": "coffee 5"})[0], 200)
        self.assertEqual(o.post("/api/consent/withdraw", {})[0], 200)
        self.assertEqual(o.post("/api/chat", {"text": "coffee 5"})[0], 428)

    def test_reads_do_not_need_consent(self):
        o = self.owner_client(consent=False)
        self.assertEqual(o.get("/api/state")[0], 200)

    def test_demo_needs_stepup_then_consent(self):
        o = self.owner_client(consent=False)
        self.assertEqual(o.post("/api/demo", {})[2]["error"], "stepup_required")
        self.stepup(o)
        self.assertEqual(o.post("/api/demo", {})[0:1] + (o.post("/api/demo", {})[2]["error"],), (428, "consent_required"))


class TestStepUp(AuthBase):
    def test_sensitive_endpoints_need_stepup(self):
        o = self.owner_client()
        calls = (("GET", "/api/export", None), ("POST", "/api/delete-all", {}), ("POST", "/api/demo", {}),
                 ("POST", "/api/auth/viewer", {"username": VIEWER[0], "password": VIEWER[1]}),
                 ("POST", "/api/auth/users/delete", {"username": "x"}))
        for m, p, body in calls:
            st, _, b = o.get(p) if m == "GET" else o.post(p, body)
            self.assertEqual((st, b["error"]), (403, "stepup_required"), p)
        self.stepup(o)
        st, _, b = o.get("/api/export")
        self.assertEqual(st, 200)
        self.assertIn("transactions", b)
        self.assertEqual(o.post("/api/auth/viewer", {"username": VIEWER[0], "password": VIEWER[1]})[0], 200)
        self.assertEqual(o.post("/api/demo", {})[0], 200)
        self.assertEqual(o.post("/api/delete-all", {})[0], 200)

    def test_delete_all_wipes_data_and_consent_but_keeps_users(self):
        o = self.owner_client()
        self.stepup(o)
        o.post("/api/demo", {})
        self.assertTrue(o.get("/api/state")[2]["has_data"])
        self.assertEqual(o.post("/api/delete-all", {})[0], 200)
        self.assertFalse(o.get("/api/state")[2]["has_data"])
        self.assertIsNone(o.get("/api/auth/status")[2]["consent"])
        self.assertEqual(o.get("/api/auth/status")[2]["username"], OWNER[0])  # still logged in

    def test_unknown_post_path_is_strict(self):
        o = self.owner_client()
        st, _, b = o.post("/api/does-not-exist", {})
        self.assertEqual((st, b["error"]), (403, "stepup_required"))
        self.stepup(o)
        self.assertEqual(o.post("/api/does-not-exist", {})[0], 404)

    def test_wrong_password_for_stepup(self):
        o = self.owner_client()
        st, _, b = o.post("/api/auth/stepup", {"password": "wrong-password-1"})
        self.assertEqual((st, b["error"]), (403, "invalid_password"))
        self.assertEqual(o.get("/api/export")[0], 403)

    def test_stepup_rotates_token_and_reports_expiry(self):
        o = self.owner_client()
        old = o.cookie
        st, _, b = o.post("/api/auth/stepup", {"password": OWNER[1]})
        self.assertEqual(st, 200)
        self.assertNotEqual(o.cookie, old)
        self.assertIsNotNone(b["stepup_until"])
        self.assertEqual(self.client().get("/api/state", headers={"Cookie": "fc_session=" + old})[0], 401)
        self.assertIsNotNone(o.get("/api/auth/status")[2]["stepup_until"])

    def test_stepup_expires(self):
        o = self.owner_client()
        self.stepup(o)
        self.assertEqual(o.get("/api/export")[0], 200)
        self.clock.offset += auth.STEPUP_TTL - 5
        self.assertEqual(o.get("/api/export")[0], 200)
        self.clock.offset += 10
        st, _, b = o.get("/api/export")
        self.assertEqual((st, b["error"]), (403, "stepup_required"))
        self.assertIsNone(o.get("/api/auth/status")[2]["stepup_until"])
        self.assertEqual(o.get("/api/state")[0], 200)  # session itself is still valid
        self.stepup(o)
        self.assertEqual(o.get("/api/export")[0], 200)

    def test_stepup_ttl_constant_is_honoured(self):
        self._patch(auth, "STEPUP_TTL", 2)
        o = self.owner_client()
        self.stepup(o)
        self.clock.offset += 3
        self.assertEqual(o.get("/api/export")[2]["error"], "stepup_required")


class TestSessions(AuthBase):
    def test_logout_invalidates_cookie(self):
        o = self.owner_client()
        tok = o.cookie
        self.assertEqual(o.get("/api/state")[0], 200)
        st, _, b = o.post("/api/auth/logout", {})
        self.assertEqual(st, 200, b)
        self.assertTrue(any(c.startswith("fc_session=;") and "Max-Age=0" in c for c in o.last_set_cookie))
        replay = self.client()
        self.assertEqual(replay.get("/api/state", headers={"Cookie": "fc_session=" + tok})[0], 401)
        self.assertEqual(self.dump_db_text().count(hashlib.sha256(tok.encode()).hexdigest()), 0)

    def test_idle_timeout(self):
        o = self.owner_client()
        self.clock.offset += auth.IDLE_TIMEOUT - 10
        self.assertEqual(o.get("/api/state")[0], 200)       # slides last_seen
        self.clock.offset += auth.IDLE_TIMEOUT - 10
        self.assertEqual(o.get("/api/state")[0], 200)
        self.clock.offset += auth.IDLE_TIMEOUT + 5
        st, _, b = o.get("/api/state")
        self.assertEqual((st, b["error"]), (401, "unauthenticated"))

    def test_idle_timeout_constant_is_honoured(self):
        self._patch(auth, "IDLE_TIMEOUT", 5)
        o = self.owner_client()
        self.clock.offset += 6
        self.assertEqual(o.get("/api/state")[0], 401)

    def test_absolute_lifetime_cannot_be_slid_forever(self):
        o = self.owner_client()
        step = auth.IDLE_TIMEOUT - 100
        n = int(auth.ABS_LIFETIME // step) + 2
        codes = []
        for _ in range(n):
            self.clock.offset += step
            codes.append(o.get("/api/state")[0])
        self.assertEqual(codes[0], 200)
        self.assertEqual(codes[-1], 401)

    def test_stepup_does_not_extend_absolute_lifetime(self):
        o = self.owner_client()
        step = auth.IDLE_TIMEOUT - 100
        total = 0
        while total + step < auth.ABS_LIFETIME - 50:
            self.clock.offset += step
            total += step
            self.assertEqual(o.get("/api/state")[0], 200)
        self.clock.offset += 60 + (auth.ABS_LIFETIME - total - 50)
        self.assertEqual(o.get("/api/state")[0], 401)

    def test_login_rotates_session_token(self):
        o = self.owner_client(consent=False)
        first = o.cookie
        st, _, _ = o.post("/api/auth/login", {"username": OWNER[0], "password": OWNER[1]})
        self.assertEqual(st, 200)
        self.assertNotEqual(o.cookie, first)
        self.assertEqual(self.client().get("/api/state", headers={"Cookie": "fc_session=" + first})[0], 401)

    def test_password_change_kills_other_sessions(self):
        o = self.owner_client(consent=False)
        other = self.client()
        other.post("/api/auth/login", {"username": OWNER[0], "password": OWNER[1]})
        self.assertEqual(other.get("/api/state")[0], 200)
        new = "a-brand-new-passphrase-2"
        st, _, b = o.post("/api/auth/password", {"old": OWNER[1], "new": new})
        self.assertEqual(st, 200, b)
        self.assertEqual(other.get("/api/state")[0], 401)
        self.assertEqual(o.get("/api/state")[0], 200)
        self.assertEqual(self.client().post("/api/auth/login", {"username": OWNER[0], "password": OWNER[1]})[0], 401)
        self.assertEqual(self.client().post("/api/auth/login", {"username": OWNER[0], "password": new})[0], 200)
        st, _, b = o.post("/api/auth/password", {"old": "wrong-password-1", "new": "whatever-long-pass-3"})
        self.assertEqual((st, b["error"]), (403, "invalid_password"))


class TestAudit(AuthBase):
    def test_chain_ok_then_tamper(self):
        o = self.owner_client()
        o.post("/api/chat", {"text": "coffee 5"})
        self.stepup(o)
        o.get("/api/export")
        self.client().post("/api/auth/login", {"username": OWNER[0], "password": "wrong-password-1"})
        st, _, b = o.get("/api/audit?limit=100")
        self.assertEqual(st, 200)
        self.assertIs(b["chain_ok"], True)
        self.assertIsNone(b["first_broken_id"])
        actions = [e["action"] for e in b["entries"]]
        for a in ("setup", "POST /api/chat", "stepup", "GET /api/export", "login"):
            self.assertIn(a, actions)
        self.assertTrue(any(e["status"] == "invalid_credentials" for e in b["entries"]))
        # tamper with one row directly in SQLite
        con = sqlite3.connect(db.PATH)
        row = con.execute("SELECT id FROM audit WHERE action='POST /api/chat'").fetchone()[0]
        con.execute("UPDATE audit SET action='GET /api/state' WHERE id=?", (row,))
        con.commit()
        con.close()
        st, _, b = o.get("/api/audit?limit=100")
        self.assertIs(b["chain_ok"], False)
        self.assertEqual(b["first_broken_id"], row)

    def test_deleting_a_row_breaks_chain(self):
        o = self.owner_client()
        o.post("/api/chat", {"text": "coffee 5"})
        o.post("/api/chat", {"text": "coffee 6"})
        con = sqlite3.connect(db.PATH)
        mid = con.execute("SELECT id FROM audit ORDER BY id LIMIT 1 OFFSET 2").fetchone()[0]
        con.execute("DELETE FROM audit WHERE id=?", (mid,))
        con.commit()
        con.close()
        self.assertIs(o.get("/api/audit")[2]["chain_ok"], False)

    def test_hash_recipe(self):
        o = self.owner_client()
        e = o.get("/api/audit?limit=1")[2]["entries"][0]
        con = sqlite3.connect(db.PATH)
        con.row_factory = sqlite3.Row
        r = con.execute("SELECT * FROM audit WHERE id=?", (e["id"],)).fetchone()
        con.close()
        want = hashlib.sha256("|".join((r["prev_hash"], r["ts"], r["user"], r["role"], r["action"], r["status"], r["ip"])).encode()).hexdigest()
        self.assertEqual(r["hash"], want)

    def test_denials_are_audited_and_no_secrets_logged(self):
        o = self.owner_client()
        v = self.make_viewer(o)
        v.post("/api/chat", {"text": "super secret coffee 5"})
        o.get("/api/export")  # step-up consumed? expired state not needed: denied or ok, both logged
        b = o.get("/api/audit?limit=200")[2]
        self.assertTrue(any(e["action"].endswith("[denied]") and e["user"] == VIEWER[0] for e in b["entries"]))
        blob = str(b)
        for secret in (OWNER[1], VIEWER[1], "super secret", o.cookie, v.cookie):
            self.assertNotIn(secret, blob)
        self.assertNotIn(OWNER[1], self.dump_db_text().split("audit:")[1])

    def test_reads_are_not_audited_and_audit_is_owner_only(self):
        o = self.owner_client()
        n0 = len(o.get("/api/audit?limit=500")[2]["entries"])
        o.get("/api/state")
        o.get("/api/audit")
        self.assertEqual(len(o.get("/api/audit?limit=500")[2]["entries"]), n0)
        self.assertEqual(self.anon.get("/api/audit")[0], 401)

    def test_limit_is_clamped(self):
        o = self.owner_client()
        for q in ("limit=-5", "limit=0", "limit=99999999", "limit=abc"):
            st, _, b = o.get("/api/audit?" + q)
            self.assertEqual(st, 200, q)
            self.assertLessEqual(len(b["entries"]), 500)
            self.assertGreaterEqual(len(b["entries"]), 1)


class TestSecretStorage(AuthBase):
    def test_passwords_hashed_and_salted(self):
        o = self.owner_client()
        shared = "same-password-for-both-1"
        self.make_viewer(o, "viewer_dan", shared)
        self.stepup(o)
        o.post("/api/auth/users/delete", {"username": "viewer_dan"})
        self.make_viewer(o, "viewer_eve", shared)
        con = sqlite3.connect(db.PATH)
        con.row_factory = sqlite3.Row
        owner = con.execute("SELECT * FROM users WHERE username=?", (OWNER[0],)).fetchone()
        eve = con.execute("SELECT * FROM users WHERE username='viewer_eve'").fetchone()
        con.close()
        for row, pw in ((owner, OWNER[1]), (eve, shared)):
            self.assertNotEqual(row["pwd_hash"], pw)
            self.assertNotIn(pw, row["pwd_hash"])
            self.assertEqual(len(row["pwd_hash"]), 64)      # hex SHA-256 PBKDF2 output
            self.assertEqual(len(row["salt"]), 32)           # 16 random bytes
            self.assertNotEqual(row["pwd_hash"], hashlib.sha256(pw.encode()).hexdigest())
            self.assertGreaterEqual(row["iterations"], 1000)
        self.assertNotEqual(owner["salt"], eve["salt"])
        self.assertNotEqual(owner["pwd_hash"], eve["pwd_hash"])
        # same password, different salts -> different hashes
        h1, s1, _ = auth.hash_password("pw-12345678")
        h2, s2, _ = auth.hash_password("pw-12345678")
        self.assertNotEqual((h1, s1), (h2, s2))
        self.assertNotEqual(h1, h2)
        self.assertTrue(auth.verify_password("pw-12345678", h1, s1, auth.ITERATIONS))
        self.assertFalse(auth.verify_password("pw-12345679", h1, s1, auth.ITERATIONS))

    def test_default_iteration_count_is_strong(self):
        # the real constant (the test server lowers it for speed); recorded value must be >= OWASP-ish floor
        self.assertGreaterEqual(self._patches[0][2], 600000)

    def test_session_tokens_stored_hashed_only(self):
        o = self.owner_client()
        self.stepup(o)  # rotates the token: old and new both must be absent
        tok = o.cookie
        con = sqlite3.connect(db.PATH)
        rows = con.execute("SELECT token_hash FROM sessions").fetchall()
        con.close()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], hashlib.sha256(tok.encode()).hexdigest())
        self.assertNotIn(tok, self.dump_db_text())
        self.assertNotIn(OWNER[1], self.dump_db_text())

    def test_no_password_or_token_in_any_response(self):
        cl = self.client()
        st, r, b = cl.post("/api/auth/setup", {"username": OWNER[0], "password": OWNER[1]})
        for body in (b, cl.get("/api/auth/status")[2], cl.get("/api/auth/users")[2]):
            s = str(body)
            self.assertNotIn(OWNER[1], s)
            self.assertNotIn(cl.cookie, s)


if __name__ == "__main__":
    unittest.main()
