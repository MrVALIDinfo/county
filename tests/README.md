# Tests

Standard library only (`unittest`). From the project root:

    python -m unittest discover -s tests -v      # exits non-zero on any failure

Safety: every test uses a throwaway SQLite file (`db.PATH` is redirected and restored) and its own in-process
HTTP server on 127.0.0.1 with a random port. `data/app.db`, the preview server (port 8000) and
`data/lessons_state.json` are never touched. Time-dependent auth tests use an offset clock (`auth.now`) and a
lowered PBKDF2 cost, so no sleeping.

## Coverage
- `test_money.py`: forecast cycle edges (payday 31, payday today, day before, leap year), dashboard on the demo
  persona and crafted data (allowance, status over/tight/ok, free-money formula, goal reserve, completed goals,
  income detection), advisor plans vs forecast, `rules.decide_ex` for every reason, merchant-memory learning,
  CSV parser (refunds, failed rows, NaN/huge amounts, GBK decode by caller), dedupe, `resolve`/`confirm`,
  chat parser (thousands, Cyrillic, transfers, overflow), benchmark shape.
- `test_api.py`: read-endpoint smoke, 415/403/400/413 regressions, bad Content-Length, list and 200 000-deep JSON,
  `1e999999999` amounts, path traversal, security headers.
- `test_auth_security.py`: setup-once, password policy, cookie flags, 401s, lockout (429 + retry_after, generic
  error), viewer read-only, consent gate (428), step-up (+expiry), logout, idle/absolute timeout, audit hash chain
  and tamper detection, passwords salted/hashed, session tokens stored hashed.

Auth/API tests skip with a message if `backend/auth.py` is missing.
