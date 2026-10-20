# Execution Evidence

Project: personal-finance AI copilot, 2026 FinTechathon International Track, Topic A (non-on-chain).
Run referenced here: `sandbox_run_20261020_021222` (2026-10-19 20:12 UTC = 2026-10-20 04:12 Asia/Shanghai). All excerpts are copied from the files under `evidence/`; nothing is hand-written.

## 1. Purpose

Topic A has no smart contract, so there is no transaction hash to show. The required "execution evidence" is therefore a record that the product really ran end to end on a simulated account, plus proof of the safeguards around that account. This document explains what the evidence is, how it was produced, how a reviewer can reproduce it, and what it does not prove.

## 2. Evidence model for a non-on-chain topic

We replace on-chain proof with four layers, each checkable by a reviewer:

1. **Sandbox operation log**: every step is a real HTTP call to the running application, with status code, latency, UTC and Asia/Shanghai timestamps and a PASS or FAIL per assertion (`evidence/sandbox/sandbox_run_<ts>.log` and `.json`).
2. **Automated tests**: the full unittest suite output (`evidence/tests/unittest_<ts>.txt`).
3. **Tamper-evident audit log**: the application's own hash-chained access log, verified inside the run.
4. **Integrity manifest**: SHA-256 of every evidence file (`evidence/sandbox/MANIFEST.sha256`).

The demo video (section 10) is the human-readable companion to layer 1.

## 3. Simulated account and sandbox boundary

The account is **Lin Xiaoyu**, a synthetic 26-year-old designer. The bank connector is a simulation: a generated WeChat-style CSV statement (371 records) loaded by the app's demo function. No real bank, no real customer data and no real credential is involved.

Boundary of the sandbox:

- The script starts its **own** HTTP server inside the Python process, on `127.0.0.1` and a random free port (59856 in this run).
- The database is a **throwaway SQLite file** in a temp directory, deleted after the run; `db.PATH` is redirected before the first connection. The lessons-state file is also redirected. The script never touches `data/app.db`, `data/lessons_state.json` or the development server on port 8000.
- Every call goes through the same endpoints and the same session cookie (`fc_session`, stored in a cookie jar) that the browser uses. There is no back door into service code, with one declared exception: the tamper test in step S9 edits one audit row in the throwaway database on purpose.
- The owner password (24 random characters) and the guest password (19 random characters) are generated for each run, never printed and never written to disk; request bodies are logged as `"password": "<redacted>"` and session tokens appear only as fingerprints.
- `ANTHROPIC_API_KEY` is removed from the process environment so the receipt scan takes its labelled DEMO path and the run is deterministic.

## 4. How to reproduce

```
python tools/evidence_run.py
python -m unittest discover -s tests -v
```

The first command needs only the Python standard library, takes about 10 seconds, writes a new `sandbox_run_<timestamp>.log/.json`, refreshes `account_snapshot_after_demo.json` and regenerates `MANIFEST.sha256`. Its exit code is 0 only if every assertion passes. Dates are relative to the day of the run, so cash figures differ between days; the PASS/FAIL logic does not. News depends on the network (section 9).

## 5. Step-by-step table

Numbers in the third column are copied from the run.

| Step | What it does | What it proves | Excerpt from the log |
|---|---|---|---|
| S1 | Fresh install, anonymous calls | Nothing is readable without an account | `configured: false`; anonymous `GET /api/state` -> `401 unauthenticated` |
| S2 | First-run owner setup | Password policy, HttpOnly + SameSite=Strict cookie, only one owner | `password_too_short` (400); setup 200 role owner; second setup `409 already_configured` |
| S3 | Logout, wrong password, login | Server-side revocation; same answer for known and unknown users; new token per login | wrong password and unknown user both `401 invalid_credentials`; login 200 |
| S4 | Consent gate | Data ingestion blocked until consent is recorded | `POST /api/chat` -> `428 consent_required`; `POST /api/consent` -> 200, `version v1` |
| S5 | Step-up | Sensitive routes need a recent password check | `POST /api/demo` -> `403 stepup_required`; wrong password `403 invalid_password`; right password 200, window 299 s |
| 1 | Empty account | Clean starting state | `has_data: false, tx_count: 0` |
| 2 | Load persona (`POST /api/demo`) | Import and classification pipeline | `imported 371, silent 367, digest 2, ask 2, duplicates 0` |
| 3 / 3b | Dashboard and snapshot | The "you can spend today" figure | `allowance_cents 23776` (CNY 237.76), `status tight`, `savings_rate 0.295`; snapshot 371 transactions, 19 merchant-memory entries |
| S6 | Guest `judge` | Read-only role; writes, audit, export and delete refused | guest `GET /api/state` 200; guest `POST /api/chat` `403 forbidden`; guest `GET /api/export` `403` even after its own step-up |
| S7 | Lockout on `lockout_probe` | Brute-force protection | statuses `[401, 401, 401, 401, 429]`; `{"error":"locked","retry_after":60}`; real owner still signs in |
| 4a | Chat `Luckin 18` | Known merchant is recorded silently | `kind silent`, `food_drink`, 1800 cents |
| 4b | Chat `转给 浩然 500` | Person transfers are asked, not guessed | `kind ask`, `reason person`; resolve as loan -> `transfers` |
| 4c | Chat `potato 5` twice | Learning: digest once, silent after one confirmation | `digest` -> confirm `groceries` -> `silent` |
| 5 | Needs-a-look queue | Every question carries a reason | `unusual 96.00, new 168.00, person 500.00, large 3299.00`; queue empty after resolving |
| 6a | Create goal, deposit | Goal CRUD | `saved_cents 50000` after deposit |
| 6b | Reload persona, deposit 1,000 | Calibrated what-if flips the status | `FLIP on 'Japan trip': tight -> ok; allowance CNY 237.76 -> 253.63` |
| 7 | Ask AI plans | Deterministic planner on real numbers | `eta_now 2027-01-04 -> eta_new 2026-11-28, days_faster 37` |
| 8 | History, report, insights | Filters and arithmetic | food_drink Oct: 50 items, CNY 2380.00; `net = income - spent`; `spent_delta_pct -15` |
| 9 | Benchmark | Honest accuracy on a synthetic set | `silent_pct 75.0, category_acc_known 95.1, category_acc_unseen_all 42.1`, `synthetic: true` |
| 10a / 10b | News, lessons | Public feeds and updatable content | news `live: true`, 60 items from 7 sources; lessons v1 -> v2 (3 tagged topics) -> reset |
| 11 | Receipt scan | Labelled DEMO path | `demo: true`, canned receipt, no key used |
| 12 | CSV twice | Deduplication | first `imported 4, skipped 1`; second `imported 0, duplicates 4` |
| 13a / 13b | Export, delete-all | Data-subject rights, with fresh-login step-up | fresh login export `403 stepup_required`; export 376 transactions; after delete-all 0 records, consent removed, next chat `428` |
| 14 | Probes | Transport guards | `415` non-JSON, `403 bad_origin`, `400` bad year, `403` foreign Host, unknown route `403 stepup_required` |
| S8 | Guest removal, audit | Access log and chain | `chain_ok: true`, 63 entries; deleted guest `401` |
| S9 | Tamper test | The chain detects an edit | edit row 59 -> `chain_ok false, first_broken_id 59`; restore -> `true` |
| S10 | Logout | Session dies server-side | next `GET /api/state` -> `401` |

**Totals for this run: 30 steps, 126 HTTP calls, 163 assertions, 163 PASS, 0 FAIL, 8.07 s.**

## 6. Security-relevant evidence

- **Authentication and tiers.** Every `/api` call passes one policy table: public, session, read (owner or guest), owner, write (owner, audited) and sensitive (owner plus recent step-up, audited). Unknown paths fall into the strictest tier, which step 14 shows (`GET /api/nope` -> `403 stepup_required`). Sessions use an HttpOnly, SameSite=Strict cookie; a forged token returns 401 (S3). The Secure flag is off in this sandbox because it is plain HTTP on loopback; it is set automatically when the server runs with a TLS certificate.
- **Guest role.** `judge` read the dashboard (`200`, 371 records) and the monthly report, and used Ask AI, but received `403 forbidden` on every write, on the audit log, on the user list, on export and on delete-all. Attempts by the guest appear in the audit log with user `judge`, role `viewer`, action suffix `[denied]`.
- **Consent.** Ingestion routes return `428 consent_required` until the owner agrees (S4). Erasure removes the consent record, so the gate closes again (13b).
- **Step-up.** Demo reset, export, delete-all, guest creation and guest removal need the password again within five minutes. The log shows the 403, a wrong password rejected, then success with a 299 s window. A fresh login starts without step-up (13a).
- **Lockout.** Five failures on one (address, user name) pair lock it for 60 s; the sixth attempt is refused before any password check, and the real owner is unaffected.
- **Audit chain.** Each entry stores `SHA-256(prev_hash | time | user | role | action | status | ip)`. Entries record who did what and the result, never bodies, passwords or tokens; the run scans all 63 entries and finds neither password nor token. The tamper test proves that editing one row is detected and located. This is detection, not prevention: someone with write access to the database file could rewrite the whole chain.

## 7. Automated test evidence

`evidence/tests/unittest_20261020_021058.txt` is the unedited output of `python -m unittest discover -s tests -v`: **148 tests, 0 failures, 0 errors, status OK, 57.4 s.** Breakdown by file: `test_money.py` 67 tests (parsing, rules, dashboard maths, advisor, benchmark), `test_api.py` 28 (read smoke, regressions, security headers) and `test_auth_security.py` 53 (setup and passwords, login and cookie, sessions, roles, step-up, lockout, consent gate, audit chain, secret storage). The tests also use temporary databases and in-process servers.

## 8. Integrity

`evidence/sandbox/MANIFEST.sha256` lists a SHA-256 for every file under `evidence/` (sandbox, tests and security checks), with paths relative to `evidence/`. Verify from the `evidence` folder with `certutil -hashfile <file> SHA256` or the one-line Python check in `evidence/sandbox/README.md`. The manifest reveals later edits; it is not a signature or a trusted timestamp. If a reviewer re-runs the script, the log and manifest are replaced by new ones.

## 9. Limitations

- The **bank connector is simulated**: a generated WeChat-style CSV. No licensed bank link was exercised.
- **Receipt photo recognition runs in labelled DEMO mode** without an API key: the same canned receipt is returned (`demo: true`) whatever the image shows.
- The **benchmark is synthetic** (60 records). Its 75.0% silent rate and 95.1% accuracy on known merchants do not predict real-world accuracy; the 42.1% on unseen merchants is why the app asks.
- **News depends on the network.** In this run the public feeds were reachable (`live: true`); offline, the app serves items labelled as samples and the assertion checks that label.
- Ask AI is a deterministic planner, and the lesson update is a simulated content pack.
- Timings come from a developer laptop on loopback and say nothing about production latency.
- The tamper test edits the throwaway database directly; the audit chain protects against undetected edits, not against full rewriting.

## 10. Demo video

The video shows the same flow on screen in about 2 minutes 55 seconds: secure sign-in with the demo account, step-up confirmation, import, silent versus asked records, goals and plans, the guest read-only role, the access log, and export and delete. Storyboard and voiceover: [04_Demo_Video_Script.md](04_Demo_Video_Script.md). Numbers on screen should be checked against a log made on the recording day.
