import hashlib
import hmac
import json
import secrets
import threading
import time
from collections import OrderedDict, deque
from pathlib import Path

from fastapi import HTTPException

from intelligence.config import Settings
from intelligence.models import Principal
from intelligence.sample_data import PEOPLE
from intelligence.store import Store


def password_hash(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return f"scrypt${salt}${digest}"


class RateLimiter:
    """Bounded per-process protection; replace with shared counters for multi-instance deployment."""

    def __init__(self):
        self.buckets = OrderedDict()
        self.lock = threading.Lock()

    def check(self, key: str, limit: int, window: int = 60):
        with self.lock:
            now = time.monotonic()
            bucket = self.buckets.setdefault(key, deque())
            self.buckets.move_to_end(key)
            while bucket and bucket[0] <= now - window:
                bucket.popleft()
            if len(bucket) >= limit:
                raise HTTPException(
                    429,
                    "Too many requests. Please try again in a minute.",
                    headers={"Retry-After": "60"},
                )
            bucket.append(now)
            if len(self.buckets) > 10000:
                self.buckets.popitem(last=False)


class AuthService:
    def __init__(self, store: Store, config: Settings):
        self.store, self.config = store, config
        self.dummy_hash = password_hash(secrets.token_urlsafe(24))

    def bootstrap(self):
        accounts = []
        with self.store.connect() as db:
            for person in PEOPLE:
                if db.execute("SELECT 1 FROM users WHERE id=?", (person.user_id,)).fetchone():
                    continue
                password = self.config.bootstrap_password or secrets.token_urlsafe(18)
                db.execute(
                    "INSERT INTO users VALUES (?,?,?,?,?,1)",
                    (
                        person.user_id,
                        person.tenant_id,
                        person.email,
                        password_hash(password),
                        person.model_dump_json(),
                    ),
                )
                accounts.append(
                    {
                        "name": person.name,
                        "email": person.email,
                        "role": person.role,
                        "password": password,
                    }
                )
        if accounts and not self.config.bootstrap_password:
            path = Path(self.config.data_path).parent / "local-accounts.json"
            path.write_text(
                json.dumps(
                    {
                        "notice": "Private local evaluation credentials. Never commit or deploy.",
                        "accounts": accounts,
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            path.chmod(0o600)

    def login(self, email: str, password: str) -> tuple[Principal, str, str]:
        with self.store.connect() as db:
            row = db.execute(
                "SELECT * FROM users WHERE email=?", (email.strip().lower(),)
            ).fetchone()
            saved = row["password_hash"] if row else self.dummy_hash
            actual = password_hash(password, saved.split("$")[1])
            if not hmac.compare_digest(actual, saved) or not row or not row["active"]:
                if row:
                    denied_user = Principal.model_validate_json(row["profile"])
                    db.execute(
                        "INSERT INTO audit (tenant_id,user_id,action,outcome,resource_id) VALUES (?,?,?,?,?)",
                        (denied_user.tenant_id, denied_user.user_id, "session.sign_in", "denied", ""),
                    )
                raise HTTPException(401, "Email or password is incorrect.")
            user = Principal.model_validate_json(row["profile"])
            token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
            now = time.time()
            db.execute("DELETE FROM sessions WHERE expires < ?", (now,))
            db.execute(
                "INSERT INTO sessions VALUES (?,?,?,?,?)",
                (
                    hashlib.sha256(token.encode()).hexdigest(),
                    user.user_id,
                    csrf,
                    now + self.config.session_ttl_seconds,
                    now,
                ),
            )
        self.store.audit(user, "session.sign_in", "success")
        return user, token, csrf

    def resolve(self, token: str | None) -> tuple[Principal, str]:
        if not token:
            raise HTTPException(401, "Sign in to your workspace.")
        digest = hashlib.sha256(token.encode()).hexdigest()
        with self.store.connect() as db:
            row = db.execute(
                "SELECT s.csrf,s.last_seen,u.profile FROM sessions s JOIN users u ON u.id=s.user_id "
                "WHERE s.token_hash=? AND s.expires>? AND u.active=1",
                (digest, time.time()),
            ).fetchone()
            if not row:
                raise HTTPException(401, "Your session has expired. Sign in again.")
            now = time.time()
            if row["last_seen"] < now - 60:
                db.execute("UPDATE sessions SET last_seen=? WHERE token_hash=?", (now, digest))
        return Principal.model_validate_json(row["profile"]), row["csrf"]

    def logout(self, token: str):
        with self.store.connect() as db:
            db.execute(
                "DELETE FROM sessions WHERE token_hash=?",
                (hashlib.sha256(token.encode()).hexdigest(),),
            )
