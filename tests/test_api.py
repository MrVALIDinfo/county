"""HTTP API: read-endpoint smoke, hardening regressions from the two earlier reviews, security headers.
Own in-process server per test (random port, throwaway DB). Requests are made as a logged-in owner because
every /api call except auth/status|setup|login needs a session."""
import json
import unittest

from tests.helpers import ServerCase

try:
    import auth  # noqa: F401
    HAS_AUTH = True
except ImportError:
    HAS_AUTH = False


@unittest.skipUnless(HAS_AUTH, "backend/auth.py missing: API tests need the authenticated server")
class ApiBase(ServerCase):
    def setUp(self):
        super().setUp()
        self.o = self.owner_client()

    def alive(self):
        st, _, b = self.o.get("/api/state")
        self.assertEqual(st, 200, b)


class TestReadSmoke(ApiBase):
    def test_state_empty_db(self):
        st, _, b = self.o.get("/api/state")
        self.assertEqual(st, 200)
        for k in ("cycle", "allowance_cents", "status", "goals", "strip", "leaderboard", "recent", "pending_list"):
            self.assertIn(k, b)
        self.assertFalse(b["has_data"])

    def test_state_after_demo(self):
        self.stepup(self.o)
        st, _, rep = self.o.post("/api/demo")
        self.assertEqual(st, 200, rep)
        self.assertEqual(rep["imported"], 371)
        st, _, b = self.o.get("/api/state")
        self.assertTrue(b["has_data"])
        self.assertEqual(b["tx_count"], 371)
        self.assertIsInstance(b["allowance_cents"], int)

    def test_read_endpoints_return_json_200(self):
        for p in ("/api/transactions", "/api/transactions?year=2026&month=10&direction=out&q=lu",
                  "/api/lessons", "/api/research", "/api/benchmark", "/api/insights", "/api/report"):
            st, r, b = self.o.get(p)
            self.assertEqual(st, 200, (p, b))
            self.assertTrue(r.getheader("Content-Type").startswith("application/json"), p)
            self.assertIsInstance(b, dict, p)

    def test_benchmark_shape(self):
        _, _, b = self.o.get("/api/benchmark")
        self.assertEqual(b["n"], 60)
        self.assertTrue(b["synthetic"])

    def test_unknown_api_path(self):
        st, _, _ = self.o.get("/api/nope")
        self.assertIn(st, (403, 404))  # unknown GET paths fall in the strictest tier for owners without step-up

    def test_static_index_public(self):
        st, r, b = self.anon.get("/")
        self.assertEqual(st, 200)
        self.assertIn("text/html", r.getheader("Content-Type"))

    def test_static_path_traversal(self):
        for p in ("/../backend/server.py", "/..%2fbackend%2fserver.py", "/%2e%2e/backend/db.py",
                  "/..\\backend\\db.py"):
            st, _, b = self.anon.get(p)
            self.assertNotEqual(st, 200, p)
            self.assertNotIn("class Handler", b if isinstance(b, str) else "")

    def test_post_chat_and_confirm_flow(self):
        st, _, b = self.o.post("/api/chat", {"text": "potato 5"})
        self.assertEqual(st, 200, b)
        self.assertEqual(b["kind"], "digest")
        self.assertEqual(b["tx"]["amount_cents"], 500)
        st, _, c = self.o.post("/api/confirm", {"id": b["tx"]["id"], "category": "groceries"})
        self.assertEqual((st, c["updated"]), (200, 1))
        st, _, c = self.o.post("/api/chat", {"text": "no amount here"})
        self.assertEqual((st, c["kind"]), (200, "unknown"))


class TestRegressions(ApiBase):
    def test_non_json_content_type_415(self):
        for ct in ("text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", ""):
            st, _, _ = self.o.raw("POST", "/api/chat", '{"text":"coffee 5"}', headers={"Content-Type": ct})
            self.assertEqual(st, 415, ct)
        st, _, _ = self.o.raw("POST", "/api/chat", '{"text":"coffee 5"}')  # no Content-Type at all
        self.assertEqual(st, 415)
        self.alive()

    def test_bad_host_403(self):
        for h in ("evil.example.com", "evil.com:8000", "127.0.0.1.evil.com", "localhost.evil.com"):
            st, _, _ = self.o.get("/api/state", host=h)
            self.assertEqual(st, 403, h)
            st, _, _ = self.o.post("/api/chat", {"text": "coffee 5"}, host=h)
            self.assertEqual(st, 403, h)
            st, _, _ = self.anon.get("/", host=h)
            self.assertEqual(st, 403, h)
        st, _, _ = self.o.get("/api/state", host="localhost:8000")  # allowed names pass
        self.assertEqual(st, 200)

    def test_foreign_origin_rejected_on_post(self):
        st, _, _ = self.o.post("/api/chat", {"text": "coffee 5"}, headers={"Origin": "http://evil.example"})
        self.assertEqual(st, 403)

    def test_bad_year_400(self):
        for q in ("year=abc", "year=2026&month=xx", "year=2026&month=10&day=zz", "year=%00", "year=1e9",
                  "year=99999999999999999999999"):
            st, _, b = self.o.get("/api/transactions?" + q)
            self.assertEqual(st, 400, (q, b))
        self.alive()

    def test_bad_query_does_not_500(self):
        for p in ("/api/transactions?category=%27%3B--", "/api/transactions?q=%25%25%25", "/api/audit?limit=abc",
                  "/api/transactions?direction=sideways"):
            st, _, _ = self.o.get(p)
            self.assertLess(st, 500, p)

    def test_negative_and_non_integer_content_length(self):
        for cl in ("-1", "-99999999999", "abc", "1.5", "", " ", "0x10", "99999999999999999999"):
            st, _, b = self.o.raw("POST", "/api/chat", b"", headers={"Content-Type": "application/json", "Content-Length": cl})
            self.assertLess(st, 500, (cl, st, b))
        self.alive()

    def test_oversized_declared_length_rejected_without_reading(self):
        st, _, b = self.o.raw("POST", "/api/chat", b"{}", headers={"Content-Type": "application/json",
                                                                  "Content-Length": "9000001"})
        self.assertEqual(st, 413, b)
        self.alive()

    def test_json_list_body(self):
        for body in ("[]", "[1,2,3]", '["a"]', "null", "123", '"str"'):
            st, _, b = self.o.raw("POST", "/api/chat", body, headers={"Content-Type": "application/json"})
            self.assertEqual(st, 400, (body, st, b))
            self.assertEqual(b, {"error": "invalid_json"})
        st, _, b = self.o.raw("POST", "/api/goal", "[1]", headers={"Content-Type": "application/json"})
        self.assertEqual(st, 400, b)
        self.alive()

    def test_invalid_json_400(self):
        for body in ("{not json", '{"a":', "\xff\xfe", "{" * 10):
            st, _, b = self.o.raw("POST", "/api/chat", body.encode("latin-1", "replace"),
                                  headers={"Content-Type": "application/json"})
            self.assertEqual(st, 400, (body, b))

    def test_huge_exponent_amounts(self):
        gid = self.o.post("/api/goal", {"name": "g", "target_cents": 100000, "deadline": "2027-01-01"})[2]["id"]
        for path, body in (
            ("/api/goal/deposit", '{"id":%d,"amount_cents":1e999999999}' % gid),
            ("/api/goal/deposit", '{"id":%d,"amount_cents":-1e999999999}' % gid),
            ("/api/goal/deposit", '{"id":%d,"amount_cents":NaN}' % gid),
            ("/api/goal", '{"name":"x","target_cents":1e999999999}'),
            ("/api/goal", '{"name":"x","target_cents":Infinity,"deadline":"2027-01-01"}'),
            ("/api/profile", '{"payday_day":5,"income_cents":1e999999999}'),
            ("/api/profile", '{"payday_day":1e999,"income_cents":1}'),
            ("/api/confirm", '{"id":1e999999999,"category":"other"}'),
            ("/api/chat", '{"text":"coffee 1e999999999"}'),
            ("/api/chat", '{"text":"' + "9" * 5000 + ' coffee"}'),
        ):
            st, _, b = self.o.raw("POST", path, body, headers={"Content-Type": "application/json"})
            self.assertLess(st, 500, (path, body[:60], st, b))
            self.assertIn(st, (200, 400), (path, body[:60], st, b))
        self.alive()
        # nothing absurd was stored
        _, _, g = self.o.get("/api/state")
        for goal in g["goals"]:
            self.assertLessEqual(goal["saved_cents"], 10 ** 12)
            self.assertLessEqual(goal["target_cents"], 10 ** 12)

    def test_deeply_nested_json_dict_400_server_survives(self):
        body = '{"a":' * 200000 + "1" + "}" * 200000
        st, _, b = self.o.raw("POST", "/api/chat", body, headers={"Content-Type": "application/json"})
        self.assertEqual(st, 400, b)
        self.alive()

    def test_deeply_nested_json_list_400_server_survives(self):
        body = "[" * 200000 + "]" * 200000
        st, _, b = self.o.raw("POST", "/api/chat", body, headers={"Content-Type": "application/json"})
        self.assertEqual(st, 400, b)
        self.alive()
        body = '{"text":' + "[" * 200000 + "]" * 200000 + "}"
        st, _, b = self.o.raw("POST", "/api/ask", body, headers={"Content-Type": "application/json"})
        self.assertEqual(st, 400, b)
        self.alive()

    def test_deep_nesting_on_public_auth_endpoint(self):
        body = '{"username":' + "[" * 200000 + "]" * 200000 + "}"
        st, _, b = self.anon.raw("POST", "/api/auth/login", body, headers={"Content-Type": "application/json"})
        self.assertEqual(st, 400, b)
        self.alive()

    def test_wrong_types_in_fields_do_not_500(self):
        for path, body in (
            ("/api/chat", {"text": ["a"]}), ("/api/chat", {"text": None}), ("/api/chat", {"text": {"a": 1}}),
            ("/api/confirm", {"id": "x", "category": "other"}), ("/api/confirm", {"id": None}),
            ("/api/resolve", {"id": 1}), ("/api/goal/delete", {}), ("/api/goal/deposit", {"id": 1, "amount_cents": "abc"}),
            ("/api/profile", {"payday_day": "x"}), ("/api/ask", {"kind": ["goal"], "id": {}}),
            ("/api/import", {"csv": 123}), ("/api/scan", {"image": 5}),
        ):
            st, _, b = self.o.post(path, body)
            self.assertLess(st, 500, (path, body, st, b))
        self.alive()

    def test_import_garbage_csv(self):
        for csv_text in ("", "garbage", "交易时间,金额\n\x00\x00", "交易时间,金额(元),收/支\n" + "x," * 5000):
            st, _, b = self.o.post("/api/import", {"csv": csv_text})
            self.assertLess(st, 500, b)

    def test_slow_or_truncated_body_does_not_kill_server(self):
        # declares 100 bytes but sends 3 then closes: handler must not crash the server
        import socket
        s = socket.create_connection(("127.0.0.1", self.port), timeout=5)
        s.sendall(b"POST /api/chat HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\n"
                  b"Content-Length: 100\r\n\r\n{\"a")
        s.close()
        self.alive()


class TestHeaders(ApiBase):
    EXPECT = {"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer"}

    def check(self, r):
        for k, v in self.EXPECT.items():
            self.assertEqual(r.getheader(k), v, k)
        csp = r.getheader("Content-Security-Policy")
        self.assertIn("default-src 'self'", csp)
        self.assertIn("frame-ancestors 'none'", csp)
        self.assertNotIn("unsafe-eval", csp)
        self.assertNotIn("http://", csp)

    def test_on_static_page(self):
        self.check(self.anon.get("/")[1])

    def test_on_api_json_and_errors(self):
        self.check(self.o.get("/api/state")[1])
        self.check(self.anon.get("/api/state")[1])               # 401
        self.check(self.anon.get("/api/state", host="evil.com")[1])  # 403
        self.check(self.o.raw("POST", "/api/chat", "{}", headers={"Content-Type": "text/plain"})[1])  # 415
        self.check(self.anon.get("/no-such-file.txt")[1])          # 404 from send_error

    def test_api_responses_not_cacheable(self):
        self.assertEqual(self.o.get("/api/state")[1].getheader("Cache-Control"), "no-store")
        self.assertEqual(self.anon.get("/api/auth/status")[1].getheader("Cache-Control"), "no-store")

    def test_no_server_version_leak_of_python_paths(self):
        st, r, b = self.o.raw("POST", "/api/chat", "{not json", headers={"Content-Type": "application/json"})
        self.assertNotIn("Traceback", json.dumps(b))
        self.assertNotIn("backend", json.dumps(b))


if __name__ == "__main__":
    unittest.main()
