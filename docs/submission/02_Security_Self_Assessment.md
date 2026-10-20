# Security Self-Assessment: County (hardened build)

Version: submission draft 2, 2026-10-20. Prepared for the 2026 FinTechathon International Track, Topic A.
Evidence: `tools/security_checks.py`, `evidence/security/security_checks_20261020_021541.json` and `.txt`, `evidence/security/unittest_20261020.txt`.

> **Reading guide.** This is a self-assessment of a hackathon prototype. It is not a penetration test, an audit, a certification or a legal review. No certification (ISO 27001, MLPS, SOC 2, PCI or similar) is held or claimed. Controls are described only as far as the code in this repository implements them; every gap is listed in the risk register (section 8). In this round the team replaced the earlier "no login" design with real accounts, roles, step-up re-authentication, a server-side consent gate and an audit log. This document replaces the first version.

## 1. Scope and data classification

### 1.1 What is assessed

A mobile-first personal-finance assistant. The backend is Python 3.12 using only the standard library (`http.server`, `sqlite3`, `hashlib`, `ssl`). The frontend is vanilla JavaScript with no build step and no third-party scripts, fonts or CDNs. One installation holds **one dataset** and a small set of accounts: one owner (created at first run) and up to 19 read-only guests (`auth.MAX_USERS = 20`).

In scope: the HTTP server and its policy gate, authentication and sessions, the audit log, the consent gate, the API routes, the SQLite schema, ingestion paths (CSV, chat, receipt scan), news fetching, export and delete-all, the TLS option, and the frontend rendering and auth code. Out of scope: the operating system and its file permissions, the browser, the network, any production deployment (none exists) and any real bank connection (the bank connect flow is simulated).

### 1.2 Data classification

| Data | Example | Class | Where stored | Leaves the device? |
|---|---|---|---|---|
| Transaction rows | date, amount (integer cents), merchant, category | Sensitive personal financial information (PIPL) | SQLite `transactions` | No |
| Raw statement row | first 300 chars of each imported CSV row (`raw`), bank transaction number (`ext_id`) | Sensitive; unfiltered bank text | SQLite `transactions.raw`, `ext_id` | No; excluded from export (EXP-01) |
| Profile, goals, merchant memory | payday, income, goals, merchant to category | Sensitive / derived personal data | SQLite | No |
| Account credentials | PBKDF2 hash, 16-byte salt, iteration count | Secret | SQLite `users` | No |
| Session tokens | 256-bit random value | Secret | Browser cookie (HttpOnly); only SHA-256(token) in SQLite `sessions` | Cookie sent to the server |
| Audit log | user, role, action, status, IP, hash chain | Personal (user name, IP); contains no ledger values, passwords or tokens (AUD-05) | SQLite `audit` | No |
| Consent record | version and UTC time, one global row | Personal / legal record | SQLite `consent` | No |
| Receipt photo | image posted to `/api/scan` | Sensitive; not stored | Memory only; sent to Claude vision only if `ANTHROPIC_API_KEY` is set | Only with a key |
| Nickname, email, phone, avatar | Settings form | Personal | Browser `localStorage` | No |
| LAN token | `?t=...` (only with `--lan`) | Secret per run | Server memory; tab `sessionStorage` | On the LAN, in clear over HTTP |
| News headlines | public RSS | Public, untrusted | Memory cache | Fetched from 7 fixed publishers |

The demo ships synthetic data only (`backend/demo.py`). A user can still import a real statement, so the controls are designed as if the data were real and the residual risks in section 8 apply in that case.

## 2. Design principles

| Principle | What it means in this code | Where |
|---|---|---|
| One gate for every API call | All `/api/*` requests pass one policy table (`server.POLICY`) that maps method and path to a tier. A path that is not in the table gets the strictest tier. A check proves that every implemented route has an entry (POL-01). | `server.py` `POLICY`, `Handler._api` |
| Deny by default | Unknown API paths are `SENSITIVE`; unauthenticated callers get 401 on every non-public route (AUTHN-01..AUTHN-35). | `Handler._api` |
| Least privilege | Guests are read-only; owner write actions are audited; destructive and account-changing actions also need a password re-entry within the last 5 minutes. | `POLICY`, `auth.stepup` |
| Secrets are never stored or logged in clear | Passwords: salted PBKDF2. Session tokens: only SHA-256 in the database. The audit log records who, what and outcome, never bodies, passwords or tokens. | `auth.py`, `audit.py` |
| Server-side enforcement | Consent, roles and step-up are decided by the server. The browser UI hides buttons for guests, but the checks do not depend on it (TIER-01..05, CONS-01..04). | `server.py` |
| Minimal data | Only statement rows, chat text and scanned receipts are ingested; no bank passwords or scraping; the bank connector is a labelled simulation. | `docs/PRODUCT.md`, `trust.js` |
| Money by code | Integer cents; the only LLM call is receipt vision and its output is validated and capped. | `forecast.py`, `scan.py` |
| No third-party runtime code | No pip packages, no CDN or fonts; CSP `default-src 'self'`. | `index.html`, `end_headers` |
| Local by default | Binds 127.0.0.1. `--lan` is an explicit flag; TLS is an explicit option. | `server.py` `__main__` |

## 3. Permission tiers

The tier of every route is fixed in `server.POLICY` (36 entries: PUBLIC 3, SESSION 2, READ 9, OWNER 2, WRITE 15, SENSITIVE 5). Enforcement happens in `Handler._api` in this order: tier lookup, session lookup (401 if none), role check (403 `forbidden`), step-up check for SENSITIVE (403 `stepup_required`), consent gate for ingestion POSTs (428 `consent_required`), then the request body is read and the route runs. Roles are `owner` and `viewer` (shown to users as "Guest").

| Tier | Who | Capabilities | Enforcement (file, function) | Evidence check IDs |
|---|---|---|---|---|
| PUBLIC | Anyone who passes the network checks | `GET /api/auth/status`, `POST /api/auth/setup` (works once), `POST /api/auth/login`; static UI shell | `POLICY`; `auth.create_user(single_owner_setup=True)` uses `BEGIN IMMEDIATE`; `auth.authenticate` with lockout | AUTHN-PUB, SETUP-01..07, LOCK-01..08 |
| SESSION | Any signed-in user | `POST /api/auth/logout`, `POST /api/auth/stepup` | `Handler._api` (session required); `auth.verify_for_stepup` | COOKIE-05, STEP-91..94, TIER-09 |
| READ | Guest or owner | `GET` state, transactions, insights, report, benchmark, lessons, research, news; `POST /api/ask` | `Handler._api` role in (owner, viewer); no audit entry for reads | TIER-01, AUD-07 |
| OWNER | Owner only | `GET /api/auth/users`, `GET /api/audit` (integrity verdict); not themselves audited | `Handler._api` role check; `audit.verify_chain`, `audit.recent` | TIER-05, TIER-08, AUD-01..04 |
| WRITE | Owner only, audited | change own password, record or withdraw consent, import, scan, chat, confirm, resolve, goals, profile, lessons update/reset, news refresh | `Handler._api` sets `_aud` and checks role; ingestion POSTs additionally need consent (`CONSENT_GATED`) | TIER-02, TIER-03, CONS-01..10, SEC-09, AUD-06 |
| SENSITIVE | Owner with a step-up window of at most 300 s, audited | `delete-all`, `demo` (wipes and reloads), `export`, create guest, delete guest | `Handler._api` checks `sess["stepup_ok"]`; `auth.stepup` rotates the token and sets `stepup_until`; `db.wipe(consent=True)` | STEP-01..97, TIER-04, TIER-06, TIER-07, ORG-05, DEL-00..09 |
| Unknown path | Treated as SENSITIVE | Returns 401 without a session; 403 `stepup_required` for an owner without step-up; otherwise 404 | `POLICY.get(..., SENSITIVE)` | AUTHN-34, AUTHN-35, PT-17 |
| Consent gate (cross-tier) | Any role that reaches an ingestion POST | `import`, `scan`, `chat`, `demo` return 428 until a consent row exists | `Handler._api` `CONSENT_GATED`; table `consent` | CONS-01..10, FE-06, DEL-06 |

Notes on the tiers:

- A guest who completes step-up still gets 403 `forbidden` on SENSITIVE routes, because the role check runs first (TIER-04). Step-up proves recent password knowledge; it does not raise privilege.
- Guests read the **same single dataset** as the owner. There is no per-guest scoping (TIER-10).
- Static files (HTML, JS, CSS) are served without a session. They contain no user data. The UI shows the sign-in screen when the API answers 401.

## 4. Authentication and session design

### 4.1 Accounts and passwords

| Aspect | Implementation | Evidence |
|---|---|---|
| First run | Fresh install has no account; the first visitor creates the owner via `POST /api/auth/setup`, which refuses a second call with 409. There is no default password. | SETUP-01, SETUP-05, SETUP-06, DEMO-01 |
| Password storage | PBKDF2-HMAC-SHA256, 16-byte random salt per user, 600 000 iterations stored per row, hashes upgraded on next login if the cost is raised. Independent recomputation in the test equals the stored hash (about 0.24 s per guess on the test machine). | SEC-01..04 |
| Password policy | 8 to 256 characters, not one repeated character, not equal to the username. Username: 3 to 32 characters from `A-Za-z0-9_.@-`, unique case-insensitively. | SETUP-03/04, SEC-08, TIER-00 |
| Unknown-user timing | A dummy PBKDF2 verification runs for unknown usernames so that response time does not reveal whether an account exists. Comparisons use `hmac.compare_digest`. | SEC-07 (static) |
| Change password | Requires the current password; all other sessions of that user are deleted, the current one stays. | SEC-09 |
| Recovery | **None.** There is no reset flow, e-mail or security question. A forgotten owner password means deleting `data/app.db`. | R5 |
| `--demo-account` | Optional flag for recording the demo video: creates one owner `demo`; password from `FC_DEMO_PASSWORD` or a random value printed once; prints a "NOT FOR PRODUCTION" banner; idempotent. Not used in a normal start. | DEMO-01, DEMO-02 |

### 4.2 Sessions and cookie

| Aspect | Implementation | Evidence |
|---|---|---|
| Token | `secrets.token_urlsafe(32)` (256 bits). Only SHA-256(token) is stored. A token in a URL parameter or header is not a session. | COOKIE-02, COOKIE-04, SEC-05 |
| Cookie | `fc_session=...; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`; `Secure` is added only when the server runs with TLS. | COOKIE-01, TLS-02, TLS-06 |
| Rotation | Login deletes any presented old token and issues a new one (session-fixation defence). Step-up also rotates the token and does not reset the absolute lifetime. | COOKIE-06, STEP-92..94 |
| Timeouts | Idle 1800 s (sliding), absolute 43 200 s (12 h), step-up 300 s. Expired rows are deleted on use and purged at login. Tested with an offset clock. | SESS-01..03, STEP-96 |
| Logout | Deletes the server-side session and clears the cookie. Deleting a guest kills its live sessions. | COOKIE-05, TIER-07 |
| Brute-force lockout | Key is (client IP, lower-cased username). 5th consecutive failure returns 429 `locked` with `retry_after` 60 s; each further failure doubles the wait up to 900 s. A correct password is also refused during the lock. Failure counters are cleared by a success. Wrong and unknown users give the identical 401 body. Step-up has its own lock key. | LOCK-01..08 |
| Request limit | 240 `/api` requests per client IP per 60 s, in memory; excess gets 429 `rate_limited`. | RATE-01..03 |

### 4.3 Request lifecycle (security view)

`Host allow-list (403)` then `static file or /api` then for `/api`: `per-IP limit (429)`, `LAN token if --lan (401)`, for POST: `Origin must equal Host if present (403)` and `Content-Type must be application/json (415)`, then `policy gate` (session 401, role 403, step-up 403, consent 428), then body parse (invalid JSON or nesting 400, over 9 MB 413), then the route. Errors are mapped to short JSON codes; internals are never echoed.

## 5. Control inventory

| # | Control | Threat addressed | Implementation | Evidence | Status |
|---|---|---|---|---|---|
| C1 | Central policy table, deny by default | Forgotten or new route left open | `server.POLICY`, `Handler._api` | POL-01, AUTHN-01..35 | Implemented |
| C2 | Accounts with owner and guest roles | Unauthorised use of the data | `auth.py`, `users` table | SETUP-xx, TIER-01..05 | Implemented |
| C3 | PBKDF2-HMAC-SHA256, per-user salt, 600k iterations | Offline cracking of a stolen DB | `auth.hash_password` | SEC-01..04 | Implemented |
| C4 | HttpOnly, SameSite=Strict cookie; hashed tokens; rotation; timeouts | Session theft, fixation, replay | `auth.cookie_header`, `login_session`, `lookup` | COOKIE-01..06, SESS-01..03 | Implemented |
| C5 | Lockout with back-off, uniform errors, dummy hash | Password guessing, user enumeration | `auth.authenticate`, `check_lock`, `register_failure` | LOCK-01..08 | Implemented (per IP and username) |
| C6 | Step-up re-authentication (5 min) for SENSITIVE actions | Hijacked or unattended session doing damage | `auth.stepup`, `Handler._api` | STEP-01..97 | Implemented |
| C7 | Server-side consent gate (HTTP 428) and consent record | PIPL separate-consent expectation | `CONSENT_GATED`, `consent` table | CONS-01..10, FE-06 | Implemented (one global record) |
| C8 | Hash-chained audit log with integrity check | Silent edit of the record of who did what | `audit.record`, `audit.verify_chain`, `GET /api/audit` | AUD-01..08 | Implemented (tamper-evident only) |
| C9 | Origin check on POST, JSON-only content type, no CORS header | CSRF, cross-site form posts | `Handler._origin_ok`, content-type check | ORG-01..08, CT-01..10, HDR-01..04 | Implemented |
| C10 | Host allow-list; loopback bind; optional LAN token | DNS rebinding, network exposure | `_host_ok`, `_token_ok` | HOST-xx, LAN-01..13 | Implemented (HTTP) |
| C11 | Security headers: CSP, nosniff, DENY framing, no-referrer, Permissions-Policy; `Cache-Control: no-store` on API replies | Clickjacking, sniffing, leakage, caching of data | `Handler.end_headers`, `_json` | HDR-01..13 | Implemented (CSP keeps `style-src 'unsafe-inline'`) |
| C12 | Optional TLS (`--tls-cert`, `--tls-key`), TLS 1.2 minimum, HSTS and `Secure` cookie when on | Eavesdropping | `_tls_context`, `end_headers` | TLS-01..07 | Implemented; certificate supplied by the owner |
| C13 | Per-IP request limit | Request floods from one client | `server.rate_ok` | RATE-01..03 | Implemented (in process) |
| C14 | Static path containment | Source or DB download | `Handler._static` | PT-00..17 | Implemented |
| C15 | Parameterised SQL, whitelisted filters, year/month/day range validation | SQL injection, odd filters | `service.py`, `rules.py` | SQL-01..09, RANGE-01..09 | Implemented |
| C16 | Bounded parsing: 9 MB cap, non-object bodies, invalid JSON, deep nesting, numeric overflow | Parser crashes, memory exhaustion | `Handler._body`, ArithmeticError and RecursionError handlers, `parse_csv`, `scan._normalize` | BODY-01..17, NUM, CHAT, GOAL, FIX-01..03 | Implemented (two earlier FAILs fixed) |
| C17 | Output encoding in the UI (`esc()`), avatar allow-list | Stored XSS | `app.js`, `invest2.js` | XSS-01..04, FE-01..04 | Implemented (heuristic review) |
| C18 | Scan hardening | Hostile image or model output | `service.scan_image`, `scan._normalize` | SCAN-01..10 | Implemented |
| C19 | Export field allow-list; delete-all with VACUUM, consent removal and lessons reset | Portability and erasure | `trust.py`, `db.wipe` | EXP-01..04, DEL-00..09 | Implemented for ledger data |
| C20 | News allow-list and link filter | Open fetch, `javascript:` links, XML entities | `news.py` | NEWS-01..10 | Implemented (private-IP redirect gap) |
| C21 | API key from environment only | Credential leakage | `scan.analyze` | SCAN-06 | Implemented |
| C22 | Encryption at rest, MFA, per-user data partitioning, edge rate limiting | Device theft, credential theft, tenant separation, flooding | none | MISC-02..05 | **Not implemented** (section 8) |

## 6. Automated results

### 6.1 Method

`python tools/security_checks.py` (Python 3.12.10, Windows 10) starts its own servers in-process on 127.0.0.1 random ports with a throw-away SQLite file (`db.PATH` is set before any `db.connect()`) and a temporary lessons-state file. It performs first-run setup, consent and step-up as a real client would, then sends real HTTP requests (`http.client`, raw sockets for malformed headers). Time-based controls (step-up expiry, idle and absolute timeout, lock expiry) are tested by offsetting `auth.now` in the same process; password hashing runs at the real 600 000 iterations. The per-IP request limit is raised for the bulk of the run and tested separately (RATE-01). A second server with a throw-away self-signed certificate (created with `openssl`) is used for a real TLS handshake. The script never opens `data/app.db`; ENV-01 confirms that the size and modification time of `data/app.db` and `data/lessons_state.json` did not change.

| Result | Count |
|---|---|
| Checks run | 347 |
| PASS | 325 |
| FAIL | 0 |
| NOTE (documented residual risk, not counted as pass or fail) | 22 |

Run started 2026-10-19 20:15:06 UTC (local 2026-10-20 02:15), duration about 35 s. Report SHA-256 (canonical JSON, method recorded in the file): `e669948913c1025a107f8eaa3dec722fcbdac6b424e32df4add76427e8fd4393`.

The first documentation round reported 178 checks with 160 PASS, 2 FAIL and 16 NOTE. Both FAILs are fixed: NUM-07 (decimal overflow `1e999999999` in a CSV amount) now makes the row skipped with HTTP 200 instead of dropping the connection, and deeply nested JSON (BODY-14) now returns 400 `invalid_json`. Regression checks FIX-01..03 and BODY-14b cover them. Note that the overflow case is handled in the parser (skipped row), not by a 400; a 400 is returned for the same kind of overflow on JSON number fields such as goals (FIX-03).

### 6.2 Results by group

| Group | Check IDs | Outcome |
|---|---|---|
| Setup, password policy, cookie | SETUP-01..07, COOKIE-01..06 | Fresh install has no account; weak or invalid input refused with no user created; second setup 409; cookie flags HttpOnly, SameSite=Strict, Max-Age 43 200; forged cookie 401 and cleared; token in URL or header ignored; logout and login rotation work |
| Policy coverage, 401 | POL-01..03, AUTHN-01..35, AUTHN-PUB | All 36 policy entries implemented; every non-public route (33) and unknown GET/POST paths give 401 without a cookie; the 3 public routes reachable |
| Step-up | STEP-01..97 | Every SENSITIVE route gives 403 `stepup_required` without step-up and changes nothing; wrong password refused; correct one rotates the token, expires at 300 s (299 s still valid, 301 s refused) |
| Consent gate | CONS-01..11 | chat, import, scan, demo give 428 without consent and store nothing; reads unaffected; consent needs boolean `agree` and version; withdrawal closes the gate again |
| Tiers | TIER-00..10 | Guest reads all READ routes, is refused on every WRITE (15), SENSITIVE (5) and OWNER (2) route with no state change, also after its own step-up; owner cannot be deleted; deleting a guest kills its session |
| Lockout | LOCK-01..09 | 4 x 401 then 429 with `retry_after` 60; correct password refused while locked; unknown users lock identically; per IP and username; back-off 120 s on the 6th failure; expiry and reset |
| Audit | AUD-01..08 | Chain verified (145 rows at that point); independent recomputation matches; editing one row gives `chain_ok=false` with the row id, deleting a row also breaks the chain; no secrets in the log; denials, failed logins, 428s and failed step-ups are logged; reads are not |
| Secret storage | SEC-01..09 | 64-hex hash, 32-hex salt, 600 000 iterations; hash equals independent PBKDF2; no plaintext password or raw token in the DB file; no API reply leaks credentials; password change kills other sessions |
| Origin / CSRF | ORG-01..08 | Foreign, `null` and wrong-port origins refused with a valid cookie; delete-all from a foreign origin with an open step-up window refused and data intact; same-origin accepted |
| Headers, rate, timeouts | HDR-01..13, RATE-01..03, SESS-01..03 | Permissions-Policy and `no-store` present (also on 401s); 429 after the limit; idle and absolute timeouts as documented |
| TLS and demo flag | TLS-01..08, DEMO-01..02 | Plain mode has no HSTS or `Secure`; real handshake negotiated TLS 1.3 (minimum 1.2); HSTS and `Secure` cookie under TLS; plain HTTP to the TLS port gets no reply; incomplete flags refuse to start; `--demo-account` hashes its password |
| Earlier groups | PT, CT, HOST, BODY, NUM, CHAT, GOAL, SQL, RANGE, XSS, FE, SCAN, EXP, NEWS, LAN, DEL, MISC | All PASS. Path traversal (19), 415 and methods, Host (25), body robustness (18), numeric edges, SQL injection, year/month/day range (9), XSS, frontend static review (12), scan limits and injected model output, export allow-list, news URL filter, LAN token, delete-all including consent removal (DEL-06) and lessons reset (DEL-08) |

### 6.3 Unit and integration test suite

`python -m unittest discover -s tests -v` ran **148 tests, all OK**, in 57 s (Python 3.12.10; output saved in `evidence/security/unittest_20261020.txt`). Split: `test_money.py` 67 (forecast, rules, parsers, advisor, benchmark), `test_api.py` 28 (read smoke, 415/403/400/413, bad Content-Length, deep JSON, overflow, traversal, headers), `test_auth_security.py` 53 (setup once, password policy, cookie flags, 401s, lockout, roles, consent gate, step-up and expiry, timeouts, audit chain and tamper, secret storage). Every test uses a throw-away database, its own in-process server and an offset clock, so `data/app.db` and the preview server are not touched. The unit tests and the self-test overlap on purpose; they are independent implementations of the same expectations.

### 6.4 What the tests did not do

No penetration test, fuzzing campaign, concurrency or slow-client attack, browser-driven session test, or mobile device test was run. The TLS test used a throw-away self-signed certificate on loopback; no certificate chain, renewal or reverse proxy was tested. The news fetch was patched to avoid live network access and the Claude call was simulated with a fake key; real publishers and the real API were not contacted. The frontend review is static (a heuristic scan plus manual triage of every `innerHTML` interpolation), not a DOM test in a browser. Timing equality of known and unknown users is a design property (dummy hash), not a measured result.

## 7. Frontend notes

`frontend/auth.js` holds the sign-in and setup screen, the step-up modal, account settings, guest management and the access-log view. It stores no password or token in browser storage (FE-12): the session is the HttpOnly cookie. It reacts to 401 (back to sign-in), 403 `stepup_required` (password modal, then retry) and 428 `consent_required` (consent dialog) (FE-13). For guests it hides write controls (CSS class `role-viewer`) and shows a read-only banner; this is a convenience, the server enforces the same rules. Delete-all also clears the cached `consent_v1` key (FE-08). `esc()` covers `& < > " '` and no unresolved user-data sink was found (FE-01..03); the avatar regex rejects six hostile inputs (FE-04).

## 8. Known-risk register

Likelihood and impact (Low / Medium / High) are judged for a real-user pilot unless stated. "Residual" is the risk after current mitigation.

| ID | Risk | Likelihood | Impact | Mitigation in place | Residual | Plan | Status |
|---|---|---|---|---|---|---|---|
| R1 | **No encryption at rest.** The SQLite file (ledger, `raw` bank text, `ext_id`, audit) and exports are plain. Anyone with file access can read it; password hashes are salted but the ledger is not protected. | Medium | High | Local only; passwords hashed; `VACUUM` on delete-all; export excludes `raw` | High on a lost or shared device | OS disk encryption now; SQLCipher (or app-level encryption) and dropping `raw` after import (days 31-60) | Open |
| R2 | **Plain HTTP unless a certificate is supplied.** In `--lan` mode the LAN token, password, cookie and data travel in clear; the cookie has no `Secure` flag in plain mode. | Medium on shared Wi-Fi | High | Loopback default; TLS option verified (TLS-04..06); warning printed for `--lan` without TLS | High for plain `--lan` | Always run TLS: reverse proxy with a real certificate, HSTS preload review (days 1-30) | Open |
| R3 | **Single dataset per installation.** Guests read the owner's data; there is no per-user partitioning or tenant separation. | High by design | Medium | Guests are read-only and cannot export or see audit/users (TIER-02..05) | Medium | Add `user_id` to ledger tables and scope every query (days 31-90) | Open |
| R4 | **Consent record is global.** One row covers all accounts; a guest cannot give or withdraw consent separately. | Medium | Medium | Server-side gate, version and time stored, withdrawal and delete-all remove it | Medium | Per-user consent with the partitioning in R3 | Open |
| R5 | **No MFA and no account recovery.** Single-factor password; a forgotten owner password means deleting the database. | Medium | Medium-High | 600k PBKDF2, lockout, step-up, session limits | Medium | TOTP or WebAuthn as a second factor; recovery codes shown once at setup (days 31-60) | Open |
| R6 | **Abuse protection is in-process and keyed by client IP.** Behind a reverse proxy every user shares the proxy's address (lockout and limit then apply to everyone); thread per connection with no cap; usernames can be rotated to get 5 tries each. | Medium | Medium | Lockout with back-off, 240 req/min per IP, 15 s socket timeout, 9 MB cap | Medium | Rate limiting and connection caps at the edge (proxy or WAF), trusted `X-Forwarded-For` handling, global failure threshold (days 31-60) | Open |
| R7 | **Audit log is tamper-evident, not tamper-proof.** Someone who can write the DB file can recompute the whole chain; there is no HMAC key, external anchor, rotation or export. | Low-Medium | Medium | Hash chain, owner-only verdict, independent recomputation (AUD-02..04) | Medium | Periodically anchor the last hash off-box (signed, or mailed to the owner); size limits | Open |
| R8 | **No formal penetration test and no PIPL legal review.** Compliance mapping (consent, minimisation, portability, erasure) is design-level. | n/a | High | This self-assessment, 347 checks and 148 tests | High until done | Independent pen test and PIPL review before any pilot (days 61-90) | Open |
| R9 | **File permissions and backups are the OS's.** The app does not set or check permissions on `data/app.db`; copies or backups made by the user are outside its control. Audit rows (user, IP) are kept after delete-all and cannot be erased through the API. | Medium | Medium | Local-only default; delete-all removes ledger data and consent | Medium | Document permission setup; add an account-and-audit erasure procedure | Open |
| R10 | **Simulated and mock components could be mistaken for production**: bank connect, lessons "update", friends leaderboard, Ask-AI (no LLM), DEMO scan result. | Medium | Medium | "Simulated", "Beta", "DEMO" labels | Low-Medium | Keep labels; build flag to disable simulations | Accepted |
| R11 | **`--demo-account`** creates a well-known user name (`demo`) for recording. If used in a real deployment it is a predictable account. | Low | Medium | Off by default; random or env password never stored in clear; loud banner (DEMO-02) | Low | Remove the flag from production builds | Accepted |
| R12 | LAN token is 8 random bytes in clear over HTTP and is only an extra network gate. | Medium on shared Wi-Fi | Medium | Account and session still required; Host check; compare in constant time | Low-Medium | Subsumed by R2 | Open |
| R13 | News fetch SSRF scope: a redirect from an allow-listed feed to a private address is followed (NEWS-10); the body is only parsed. | Low | Low-Medium | Fixed feed list, non-http(s) redirects refused, DOCTYPE rejected, 1 MiB cap | Low | Block private, loopback and link-local targets after each redirect | Open |
| R14 | Prompt injection through receipts when a key is set; a known merchant is auto-recorded with a model-supplied amount (SCAN-11). | Medium | Medium | Direction forced to `out`, category whitelist, confidence cap 0.8, image-only request | Medium | Always show scan results for review; cap auto-record amount | Open |
| R15 | CSV import abuse (large files, formula-like text). | Medium | Low-Medium | 9 MB cap, bounded amounts, parameterised SQL, escaped display | Low-Medium | Row-count cap; prefix risky cells if a CSV export is added | Open |
| R16 | CSP allows `style-src 'unsafe-inline'`; content-type check is a prefix match. | Low | Low | `default-src 'self'` blocks inline and remote scripts | Low | Move inline styles, drop `unsafe-inline` | Planned |
| R17 | Supply chain: no Python packages or CDN; remaining exposure is the interpreter and OS. | Low | Medium | No third-party code (FE-10) | Low | Pin Python version; signed release if packaged | Accepted |

Closed since the first round: no authentication or roles (now C2..C6), no audit log (C8), client-only consent (C7), two handler crashes (NUM-07, BODY-14 fixed), delete-all leaving the consent timestamp (DEL-06, FE-08) and lessons progress (DEL-08), no request limit (C13). Request-size, parser and range hardening were added (RANGE-01..09).

### 8.1 30-60-90 day hardening roadmap

| Window | Actions |
|---|---|
| Days 1-30 | Run behind a TLS reverse proxy with a real certificate and HSTS (R2); enable OS disk encryption and set file permissions on `data/` (R1, R9); run `tools/security_checks.py` and the unit tests in CI on every commit; block private-IP redirects in the news fetcher (R13) |
| Days 31-60 | Encrypt data at rest with SQLCipher or equivalent and drop or hash `raw` after import (R1); add TOTP or WebAuthn MFA and recovery codes (R5); move rate limiting and connection caps to the edge and handle `X-Forwarded-For` safely (R6); anchor the audit chain off-box (R7); cap auto-record amounts from scans (R14) |
| Days 61-90 | Partition data per user and make consent per user (R3, R4); commission an independent penetration test and a PIPL legal review before any real-user pilot (R8); remove `unsafe-inline` from the CSP (R16); add an account and audit erasure procedure (R9) |

## 9. Incident response and data-subject procedures

There is no operations team and no hosted service. These procedures match the current design.

### 9.1 Data-subject requests

| Request | How it works today | Notes |
|---|---|---|
| Access / portability | Owner opens Privacy, "Export my data". `GET /api/export` is SENSITIVE: it asks for the password if the 5-minute step-up window is closed, is audited, and returns profile, goals, transactions and merchant memory as JSON. | Raw bank row and bank transaction number excluded (EXP-01). Guests cannot export (TIER-04). |
| Erasure | Owner chooses "Delete my data" (confirm, then step-up). `POST /api/delete-all` empties transactions, goals and merchant memory, resets the profile, removes the consent record, resets lessons progress and runs `VACUUM`; the browser clears profile keys and the cached consent. | DEL-01..09. Accounts and the audit log are kept (R9). Copies of `data/app.db` made by the user are outside the app. |
| Withdraw consent | "Withdraw consent" calls `POST /api/consent/withdraw`; ingestion returns 428 immediately (CONS-10). | Does not delete data; the user must also run erasure. Consent is global (R4). |
| Access log | Owner opens Access log: entries with a hash-chain verdict. | AUD-01. A guest cannot (TIER-05). |
| Rectification and undo | Re-categorise records, edit goals and profile. | No bulk edit. |
| Account removal | Owner deletes a guest (SENSITIVE); the guest's sessions die at once (TIER-07). The owner account cannot be deleted through the API (TIER-06). | |

### 9.2 Incident handling

| Step | Action |
|---|---|
| Detect | Signals: Access log (failed or locked logins, `[denied]` entries, unexpected exports or delete-all), `chain_ok=false` with `first_broken_id`, user reports, console messages (request logging is off by design; only server errors print). No automatic alerting exists. |
| Contain | Stop the server. Change the owner password (this deletes all other sessions of that user); delete guests that should not have access; restart without `--lan`, which also invalidates the LAN token. |
| Assess | Review the audit log for the affected window. Check whether `data/app.db`, a backup or an export file left the device. The app itself sends user data only to Claude vision, and only if a key is set. |
| Remediate | Rotate the Anthropic API key if exposure is suspected; erase data with delete-all or by deleting `data/app.db`; for a suspected tampered log, treat the log as unreliable from `first_broken_id` onward and compare with backups. |
| Notify | For a real-user deployment, notification duties under PIPL would apply. No process is defined for the prototype; a named contact and a timeline must be agreed before any pilot. |
| Learn | Add a regression check to `tools/security_checks.py` and a test to `tests/`, then update this register. |

## 10. Residual-risk statement and sign-off

**Statement.** The observed controls match the claims in this document: every API route goes through one deny-by-default policy table; accounts use salted PBKDF2 at 600 000 iterations; sessions are HttpOnly, SameSite=Strict, hashed at rest and time-limited; brute-force lockout gives uniform errors; guests are read-only; destructive and sensitive actions need a step-up within 5 minutes and are audited in a hash-chained log whose tampering is detected; consent is enforced by the server; cross-origin writes are refused; the optional TLS mode works end to end. The self-test ran 347 checks with 325 passes, 0 failures and 22 documented notes, and the unit suite ran 148 tests, all passing. The earlier two failures are fixed.

The system is still a prototype. The main residual risks are: **no encryption at rest (R1)**, **plain HTTP unless the owner supplies a certificate (R2)**, **one dataset shared by all accounts with a single global consent record (R3, R4)**, no MFA or recovery (R5), in-process abuse protection keyed by client IP (R6), file permissions left to the OS (R9), simulated components (R10), and no independent penetration test or PIPL legal review (R8). It should not be exposed to the internet, run in plain `--lan` mode with real financial data, or offered to real users before R1, R2, R3, R5 and R8 are addressed. This document is not a certification and does not replace an independent penetration test or legal review.

| Role | Name | Signature | Date |
|---|---|---|---|
| Team lead | ______________ | ______________ | ____ / ____ / 2026 |
| Backend and security owner | ______________ | ______________ | ____ / ____ / 2026 |
| Frontend owner | ______________ | ______________ | ____ / ____ / 2026 |
| Reviewer (optional) | ______________ | ______________ | ____ / ____ / 2026 |

Reproduce: `python tools/security_checks.py` from the project root (do not use `python -I`; exit code 1 means at least one FAIL), and `python -m unittest discover -s tests`. A new run writes a new timestamped file pair under `evidence/security/`.
