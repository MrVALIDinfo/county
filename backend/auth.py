"""Authentication: users, sessions, brute-force lockout. Standard library only.

Passwords: PBKDF2-HMAC-SHA256, 16-byte random salt per user, 600 000 iterations (stored per row so the
cost can be raised later; hashes are upgraded on the next successful login).
Sessions: secrets.token_urlsafe(32); only SHA-256(token) is stored. Tokens are rotated on login and step-up.
Nothing in this module logs or returns a password, a hash or a token (except the raw token to the cookie)."""
import hashlib
import hmac
import re
import secrets
import time

ITERATIONS = 600_000
IDLE_TIMEOUT = 1800          # seconds, sliding
ABS_LIFETIME = 12 * 3600     # seconds, from login
STEPUP_TTL = 300             # seconds
COOKIE = "fc_session"
LOCK_AFTER = 5               # failures before the first lock
LOCK_BASE = 60               # seconds; doubles per further failure
LOCK_MAX = 900               # 15 minutes
MAX_USERS = 20
USERNAME_RE = re.compile(r"[A-Za-z0-9_.@-]{3,32}")


def now():
    return time.time()


class AuthError(Exception):
    def __init__(self, code, status=400, **extra):
        super().__init__(code)
        self.code, self.status, self.extra = code, status, extra


# ---------- passwords ----------
def _pbkdf2(password, salt, iterations):
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)


def hash_password(password, salt=None, iterations=None):
    iterations = iterations or ITERATIONS
    salt = salt or secrets.token_bytes(16)
    return _pbkdf2(password, salt, iterations).hex(), salt.hex(), iterations


def verify_password(password, pwd_hash, salt_hex, iterations):
    got = _pbkdf2(password, bytes.fromhex(salt_hex), int(iterations))
    return hmac.compare_digest(got, bytes.fromhex(pwd_hash))


_DUMMY = hash_password("dummy-password-for-timing", bytes(16))   # computed once at import


def _dummy_verify(password):
    """Burn the same CPU as a real check so unknown users are not distinguishable by timing."""
    verify_password(password, *_DUMMY)


def check_username(username):
    if not isinstance(username, str) or not USERNAME_RE.fullmatch(username):
        raise AuthError("username_invalid", 400)


def check_password_policy(username, password):
    if not isinstance(password, str):
        raise AuthError("password_invalid", 400)
    if len(password) < 8:
        raise AuthError("password_too_short", 400, min_length=8)
    if len(password) > 256:
        raise AuthError("password_too_long", 400)
    if len(set(password)) == 1:
        raise AuthError("password_one_character", 400)
    if password.lower() == (username or "").lower():
        raise AuthError("password_equals_username", 400)


# ---------- users ----------
def user_count(c):
    return c.execute("SELECT COUNT(*) FROM users").fetchone()[0]


def create_user(c, username, password, role, single_owner_setup=False):
    check_username(username)
    check_password_policy(username, password)
    h, salt, it = hash_password(password)
    try:
        if single_owner_setup:
            c.execute("BEGIN IMMEDIATE")
            if user_count(c):
                c.rollback()
                raise AuthError("already_configured", 409)
        elif user_count(c) >= MAX_USERS:
            raise AuthError("too_many_users", 409)
        cur = c.execute(
            "INSERT INTO users(username,pwd_hash,salt,iterations,role,created_at,disabled) VALUES(?,?,?,?,?,?,0)",
            (username, h, salt, it, role, now()))
        c.commit()
    except AuthError:
        raise
    except Exception as e:  # sqlite3.IntegrityError on the NOCASE unique index
        c.rollback()
        if "UNIQUE" in str(e):
            raise AuthError("username_taken", 409)
        raise
    return cur.lastrowid


def list_users(c):
    return [{"username": r["username"], "role": r["role"], "created_at": r["created_at"], "disabled": bool(r["disabled"])}
            for r in c.execute("SELECT username,role,created_at,disabled FROM users ORDER BY id")]


def delete_user(c, username):
    r = c.execute("SELECT id,role FROM users WHERE username=?", (str(username),)).fetchone()
    if not r:
        raise AuthError("not_found", 404)
    if r["role"] == "owner":
        raise AuthError("cannot_delete_owner", 409)
    c.execute("DELETE FROM sessions WHERE user_id=?", (r["id"],))
    c.execute("DELETE FROM users WHERE id=?", (r["id"],))
    c.commit()


def change_password(c, user_id, username, old, new, keep_token_hash):
    row = c.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    if not isinstance(old, str) or not verify_password(old, row["pwd_hash"], row["salt"], row["iterations"]):
        raise AuthError("invalid_password", 403)
    check_password_policy(username, new)
    h, salt, it = hash_password(new)
    c.execute("UPDATE users SET pwd_hash=?,salt=?,iterations=? WHERE id=?", (h, salt, it, user_id))
    c.execute("DELETE FROM sessions WHERE user_id=? AND token_hash!=?", (user_id, keep_token_hash))
    c.commit()


# ---------- brute-force lockout ----------
def lock_key(kind, ip, username):
    return f"{kind}|{ip}|{str(username).lower()[:64]}"


def check_lock(c, key):
    r = c.execute("SELECT locked_until FROM login_attempts WHERE key=?", (key,)).fetchone()
    if r and r["locked_until"] > now():
        raise AuthError("locked", 429, retry_after=int(r["locked_until"] - now()) + 1)


def register_failure(c, key):
    """Returns retry_after seconds if this failure locked the key, else 0."""
    r = c.execute("SELECT fails FROM login_attempts WHERE key=?", (key,)).fetchone()
    fails = (r["fails"] if r else 0) + 1
    locked_until, wait = 0, 0
    if fails >= LOCK_AFTER:
        wait = min(LOCK_MAX, LOCK_BASE * 2 ** (fails - LOCK_AFTER))
        locked_until = now() + wait
    c.execute("INSERT INTO login_attempts(key,fails,locked_until) VALUES(?,?,?) "
              "ON CONFLICT(key) DO UPDATE SET fails=excluded.fails, locked_until=excluded.locked_until",
              (key, fails, locked_until))
    c.commit()
    return wait


def clear_failures(c, key):
    c.execute("DELETE FROM login_attempts WHERE key=?", (key,))
    c.commit()


def authenticate(c, username, password, ip):
    """Verify credentials with lockout. Returns the user row. Raises AuthError
    (invalid_credentials 401 / locked 429). Unknown users cost the same time and give the same message."""
    username = username if isinstance(username, str) else ""
    password = password if isinstance(password, str) else ""
    if len(password) > 256 or len(username) > 64:
        raise AuthError("invalid_credentials", 401)
    key = lock_key("login", ip, username)
    check_lock(c, key)
    row = c.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone() if username else None
    if row is None:
        _dummy_verify(password)
        ok = False
    else:
        ok = verify_password(password, row["pwd_hash"], row["salt"], row["iterations"]) and not row["disabled"]
    if not ok:
        wait = register_failure(c, key)
        if wait:
            raise AuthError("locked", 429, retry_after=wait)
        raise AuthError("invalid_credentials", 401)
    clear_failures(c, key)
    if row["iterations"] < ITERATIONS:  # transparent upgrade of old hashes
        h, salt, it = hash_password(password)
        c.execute("UPDATE users SET pwd_hash=?,salt=?,iterations=? WHERE id=?", (h, salt, it, row["id"]))
        c.commit()
    return row


def verify_for_stepup(c, user_id, username, password, ip):
    key = lock_key("stepup", ip, username)
    check_lock(c, key)
    row = c.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    if not isinstance(password, str) or len(password) > 256 or not verify_password(
            password, row["pwd_hash"], row["salt"], row["iterations"]):
        wait = register_failure(c, key)
        if wait:
            raise AuthError("locked", 429, retry_after=wait)
        raise AuthError("invalid_password", 403)
    clear_failures(c, key)


# ---------- sessions ----------
def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(c, user_id, ip, created_at=None, stepup_until=0):
    token = secrets.token_urlsafe(32)
    t = now()
    c.execute("INSERT INTO sessions(token_hash,user_id,created_at,last_seen,stepup_until,ip) VALUES(?,?,?,?,?,?)",
              (hash_token(token), user_id, created_at or t, t, stepup_until, ip))
    c.commit()
    return token


def purge_expired(c):
    t = now()
    c.execute("DELETE FROM sessions WHERE last_seen<? OR created_at<?", (t - IDLE_TIMEOUT, t - ABS_LIFETIME))
    c.commit()


def lookup(c, token):
    """-> session dict or None. Enforces idle (sliding) and absolute expiry; slides last_seen."""
    if not token or len(token) > 100:
        return None
    th = hash_token(token)
    r = c.execute("SELECT s.*, u.username, u.role, u.disabled FROM sessions s JOIN users u ON u.id=s.user_id "
                  "WHERE s.token_hash=?", (th,)).fetchone()
    if not r:
        return None
    t = now()
    if r["disabled"] or t - r["last_seen"] > IDLE_TIMEOUT or t - r["created_at"] > ABS_LIFETIME:
        c.execute("DELETE FROM sessions WHERE token_hash=?", (th,))
        c.commit()
        return None
    c.execute("UPDATE sessions SET last_seen=? WHERE token_hash=?", (t, th))
    c.commit()
    s = dict(r)
    s["stepup_ok"] = r["stepup_until"] > t
    return s


def login_session(c, user_id, ip, old_token=None):
    if old_token:
        c.execute("DELETE FROM sessions WHERE token_hash=?", (hash_token(old_token),))
    purge_expired(c)
    return create_session(c, user_id, ip)


def stepup(c, sess, ip):
    """Rotate the token and open a 5-minute fresh-auth window. Absolute lifetime is NOT reset."""
    c.execute("DELETE FROM sessions WHERE token_hash=?", (sess["token_hash"],))
    c.commit()
    until = now() + STEPUP_TTL
    token = create_session(c, sess["user_id"], ip, created_at=sess["created_at"], stepup_until=until)
    return token, until


def logout(c, token):
    if token:
        c.execute("DELETE FROM sessions WHERE token_hash=?", (hash_token(token),))
        c.commit()


def cookie_header(token, max_age, secure):
    parts = [f"{COOKIE}={token}", "HttpOnly", "SameSite=Strict", "Path=/", f"Max-Age={int(max_age)}"]
    if secure:
        parts.append("Secure")
    return "; ".join(parts)


def remaining_lifetime(sess):
    return max(0, min(ABS_LIFETIME - (now() - sess["created_at"]), ABS_LIFETIME))
