# County: submission index

2026 FinTechathon, International Track, Topic A (Personal Finance Assistant). Prepared 2026-10-20.

## Project description (about 190 words)

**County: budgeting that runs itself.**
Most budgeting apps die in week two because every coffee must be typed in. County removes that work. It imports a WeChat/Alipay statement or a receipt photo, learns each person's habits, and records familiar spending silently. It interrupts only when something is truly unclear (a new shop, an unusual amount, a transfer to a friend) and always says why, so every automatic decision is transparent and reversible. The result is one answer: "you can spend ¥X today before payday."

All money is computed by deterministic code, never by a language model. Users set goals, see how many days a spending cut saves, test "what if" plans, save together with friends, and learn from updatable educational lessons with live market headlines and research links, never product advice.

Built for trust: PIPL-style consent gate, password accounts with owner and read-only guest roles, step-up re-authentication, a tamper-evident audit log, one-tap export and deletion. Backed by 148 automated tests, a 163-check sandbox run on a simulated account, and an open accuracy report (95% category accuracy on known merchants, 0.32 taps per record versus 4 manual, on a synthetic set). Bank sync and the LLM layer are labelled roadmap.

## Why County exists (extended, about 190 words)

> For many young workers in China, WeChat Pay and Alipay are the bank: money leaves in seconds, but understanding where it went takes effort nobody has. Budgeting apps demand manual entry, so records go stale, trust fades, and the one question that matters, "can I afford this today?", goes unanswered.
>
> County answers it. It reads a statement or receipt, learns each person's habits, and acts within clear limits: familiar spending is recorded silently, uncertain items are queued with a plain-language reason, and transfers to people or large amounts are asked first. Every decision can be explained and undone. This is AI as a financial participant, trusted because it is accountable: permission tiers, step-up confirmation, PIPL-style consent and a tamper-evident audit log.
>
> Money is never left to a language model. Allowances, goal dates and savings plans come from auditable code, so figures reconcile exactly. Plans become motivation: "cut this 20% and reach Japan N days sooner", with friends saving alongside.
>
> Our evidence is open: 148 tests, a 163-check sandbox run, and an accuracy report that shows weaknesses as plainly as strengths. County is a working, honest step toward an assistant banks can embed.

Wording note: the "Ask AI" planner is currently deterministic. If an LLM key is connected, add: "An LLM explains results in plain language; it never produces the numbers."

## Deliverables

| Required item | File | Notes |
|---|---|---|
| Technical documentation (architecture, core algorithms, security design) | `01_Technical_Documentation.md` | Real formulas and constants, worked examples, real-vs-simulated table |
| Security self-assessment (permission tiers, known-risk list) | `02_Security_Self_Assessment.md` | Tier table with enforcement locations, risk register, 30-60-90 day roadmap |
| Execution evidence (non-on-chain topic: sandbox logs + demo video) | `03_Execution_Evidence.md`, `../../evidence/` | Simulated account 林小雨; logs, JSON, SHA-256 manifest |
| Demo video | `04_Demo_Video_Script.md` | Shot-by-shot script (about 2:55). The recording itself is still to be made. |

## Evidence at a glance (all reproducible)

| What | Result | Where |
|---|---|---|
| Sandbox session on the simulated account | 30 steps, 163 assertions, 163 PASS | `evidence/sandbox/sandbox_run_20261020_021222.log/.json` |
| Unit and API test suite | 148 tests, 0 failures | `evidence/tests/unittest_20261020_021058.txt` |
| Security self-test | 347 checks: 325 PASS, 0 FAIL, 22 NOTE (known gaps) | `evidence/security/security_checks_20261020_021541.txt` |
| Accuracy report (synthetic labelled set, n=60) | 78.3% category accuracy overall, 95.1% on known merchants, 0% on unseen merchants at first sight | in-app: Settings > Accuracy report |
| Integrity | SHA-256 of every evidence file | `evidence/sandbox/MANIFEST.sha256` |

Reproduce: `python tools\evidence_run.py`, `python tools\security_checks.py`, `python -m unittest discover -s tests`.

## What is real and what is simulated (say this plainly)

- **Real:** statement import, rules engine and merchant memory, daily-allowance and goal maths, insights and reports, accuracy benchmark, consent gate, accounts, roles, audit log, export and delete, live news feed (public RSS), reading-list links.
- **Simulated or demo:** the "Ask AI" planner (deterministic, numbers from code, no language model), receipt-photo recognition (labelled DEMO unless an API key is set), friends and leaderboard, bank/Alipay/WeChat connectors (consent flow only), lesson "updates" (versioned content packs).
- **Known limits:** no encryption at rest, plain HTTP unless a certificate is supplied, one dataset per installation, no formal penetration test or legal review. See the risk register.

## Before submitting

1. Confirm the registration deadline and package contents with the organisers (the dates found online were from one page).
2. Record the video from `04_Demo_Video_Script.md` using `python backend/server.py --demo-account`; never show the demo password on screen.
3. Re-run the three commands above on the day of submission and keep the new logs.
4. Fill the sign-off block in the security self-assessment with the team members' names.
