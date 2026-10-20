import json
import os
import sqlite3

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
PATH = os.path.join(DATA_DIR, "app.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS transactions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency TEXT DEFAULT 'CNY',
  merchant TEXT, merchant_key TEXT, category TEXT,
  direction TEXT, counterparty_type TEXT, source TEXT, confidence REAL,
  status TEXT, mode TEXT, ext_id TEXT, raw TEXT, reason TEXT
);
CREATE INDEX IF NOT EXISTS tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS tx_key ON transactions(merchant_key);
CREATE TABLE IF NOT EXISTS merchant_memory(
  merchant_key TEXT PRIMARY KEY, category TEXT, n_confirmed INTEGER
);
CREATE TABLE IF NOT EXISTS profile(
  id INTEGER PRIMARY KEY CHECK(id=1),
  payday_day INTEGER, income_cents INTEGER, fixed_json TEXT, currency TEXT
);
CREATE TABLE IF NOT EXISTS goals(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, target_cents INTEGER, deadline TEXT, saved_cents INTEGER
);
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pwd_hash TEXT NOT NULL, salt TEXT NOT NULL, iterations INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','viewer')),
  created_at REAL NOT NULL, disabled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions(
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL,
  created_at REAL NOT NULL, last_seen REAL NOT NULL, stepup_until REAL NOT NULL DEFAULT 0, ip TEXT
);
CREATE INDEX IF NOT EXISTS sess_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS login_attempts(
  key TEXT PRIMARY KEY, fails INTEGER NOT NULL DEFAULT 0, locked_until REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS audit(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, user TEXT, role TEXT,
  action TEXT NOT NULL, status TEXT, ip TEXT, prev_hash TEXT NOT NULL, hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS consent(
  id INTEGER PRIMARY KEY CHECK(id=1), version TEXT NOT NULL, at TEXT NOT NULL
);
"""

DEFAULT_FIXED = [{"name": "rent", "amount_cents": 320000, "day": 1}]


def connect():
    os.makedirs(DATA_DIR, exist_ok=True)
    c = sqlite3.connect(PATH)
    c.row_factory = sqlite3.Row
    old = c.execute("SELECT sql FROM sqlite_master WHERE name='goals'").fetchone()
    if old and "CHECK(id=1)" in old[0]:  # migrate single-goal schema (demo data only)
        c.execute("DROP TABLE goals")
    c.executescript(SCHEMA)
    if "reason" not in [r[1] for r in c.execute("PRAGMA table_info(transactions)")]:
        c.execute("ALTER TABLE transactions ADD COLUMN reason TEXT")
    c.execute(
        "INSERT OR IGNORE INTO profile(id,payday_day,income_cents,fixed_json,currency) VALUES(1,5,900000,?,'CNY')",
        (json.dumps(DEFAULT_FIXED),),
    )
    c.commit()
    return c


def wipe(c, keep_profile=False, consent=False):
    """Erase ledger data. users/sessions/audit are never touched. consent=True (delete-all flow) also erases the consent record."""
    c.execute("DELETE FROM transactions")
    if consent:
        c.execute("DELETE FROM consent")
    c.execute("DELETE FROM merchant_memory")
    c.execute("DELETE FROM goals")
    for t in ("learn_progress", "learn_days"):   # created lazily by learn.py
        if c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (t,)).fetchone():
            c.execute("DELETE FROM " + t)
    if not keep_profile:
        c.execute("DELETE FROM profile")
        c.execute(
            "INSERT INTO profile(id,payday_day,income_cents,fixed_json,currency) VALUES(1,5,900000,?,'CNY')",
            (json.dumps(DEFAULT_FIXED),),
        )
    c.commit()
    try:
        c.execute("VACUUM")  # outside a transaction: drops deleted rows from the file
    except Exception:
        pass
