# County

Budgeting that runs itself. County reads a WeChat/Alipay statement or a receipt photo, learns each person's habits and records familiar spending silently. It asks only when something is truly unclear (a new shop, an unusual amount, a transfer to a friend) and always says why. The result is one answer: *you can spend ¥X today before payday*.

Built for the 2026 FinTechathon International Track, Topic A (Personal Finance Assistant). Mobile-first web app (PWA), English and Chinese, zero third-party dependencies: Python 3.12 standard library + vanilla JavaScript.

## Run

```bash
python backend/server.py                 # http://localhost:8000 (localhost only)
python backend/server.py --demo-account  # recording only: creates owner "demo", password printed in the console
python backend/server.py --lan           # phones on the same Wi-Fi (plain HTTP, trusted network only)
```

The first start asks you to create an owner account. Then open Import and press "Load demo data" to load the synthetic persona 林小雨.

## Test

```bash
python -m unittest discover -s tests     # 148 tests: money logic, API, authentication and permissions
python tools/evidence_run.py             # sandbox session on a simulated account, writes evidence/sandbox/
python tools/security_checks.py          # security self-test, writes evidence/security/
```

## What is real, what is simulated

- Real: statement import, rules engine and merchant memory, daily allowance and goal maths, insights and reports, accuracy benchmark, consent gate, accounts with owner/guest roles, step-up re-authentication, hash-chained audit log, export and delete, live news feed (public RSS), learning path with progress.
- Simulated or demo: the "Ask AI" planner (deterministic, numbers come from code, no language model), receipt-photo recognition (labelled DEMO unless `ANTHROPIC_API_KEY` is set), friends and leaderboard, bank connectors (consent flow only), lesson-pack "updates".
- Known limits: no encryption at rest, plain HTTP unless a certificate is supplied (`--tls-cert`, `--tls-key`), one dataset per installation, no formal penetration test. See the risk register.

All data in the demo is synthetic. Educational content only, not investment advice.

## Documentation

`docs/submission/`: `00_Submission_Index.md`, `01_Technical_Documentation.md`, `02_Security_Self_Assessment.md`, `03_Execution_Evidence.md`, `04_Demo_Video_Script.md`. Evidence logs live in `evidence/`.
