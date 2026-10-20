# Sandbox execution evidence (simulated account)

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
