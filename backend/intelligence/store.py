import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from intelligence.models import Investigation, Principal
from intelligence.sample_data import DATASET_VERSION, seed


class Store:
    def __init__(self, path: str):
        self.path = path
        Path(path).parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def initialize(self):
        with self.connect() as db:
            old_columns = {r[1] for r in db.execute("PRAGMA table_info(sales)")}
            if "revenue_cents" in old_columns:
                raise RuntimeError(
                    "Legacy USD database preserved. Use DATA_PATH=.local/northstar-v2.sqlite3 for the INR dataset."
                )
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS sales (tenant_id TEXT, product_id TEXT, product TEXT,
                    category TEXT, order_date TEXT, region TEXT, city TEXT, revenue_paise INTEGER, units INTEGER);
                CREATE INDEX IF NOT EXISTS sales_scope ON sales(tenant_id,order_date,region);
                CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, tenant_id TEXT, product_id TEXT,
                    category TEXT, created_at TEXT, region TEXT, priority TEXT);
                CREATE INDEX IF NOT EXISTS ticket_scope ON tickets(tenant_id,product_id,created_at);
                CREATE TABLE IF NOT EXISTS policies (tenant_id TEXT, product_id TEXT, id TEXT PRIMARY KEY,
                    title TEXT, text TEXT, effective_from TEXT, effective_to TEXT);
                CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, tenant_id TEXT, email TEXT UNIQUE,
                    password_hash TEXT NOT NULL, profile TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
                CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id),
                    csrf TEXT NOT NULL, expires REAL NOT NULL, last_seen REAL NOT NULL);
                CREATE INDEX IF NOT EXISTS session_activity ON sessions(expires,last_seen,user_id);
                CREATE TABLE IF NOT EXISTS investigations (id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT,
                    payload TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS investigation_scope ON investigations(tenant_id,user_id);
                CREATE TABLE IF NOT EXISTS executions (id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT,
                    idempotency_key TEXT, request_hash TEXT, status TEXT, started_at TEXT, completed_at TEXT,
                    duration_ms REAL, result_id TEXT, error TEXT, UNIQUE(tenant_id,user_id,idempotency_key));
                CREATE INDEX IF NOT EXISTS execution_activity ON executions(tenant_id,started_at DESC);
                CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY,
                    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                    tenant_id TEXT, user_id TEXT, action TEXT, outcome TEXT, resource_id TEXT);
                CREATE INDEX IF NOT EXISTS audit_scope ON audit(tenant_id,id DESC);
                CREATE TABLE IF NOT EXISTS request_metrics (id INTEGER PRIMARY KEY, tenant_id TEXT,
                    route TEXT, method TEXT, status INTEGER, duration_ms REAL,
                    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
                CREATE INDEX IF NOT EXISTS metric_scope ON request_metrics(tenant_id,created_at DESC);
                CREATE INDEX IF NOT EXISTS policy_scope ON policies(tenant_id,product_id,effective_from DESC);
            """)
            if not db.execute("SELECT 1 FROM metadata WHERE key='dataset_version'").fetchone():
                seed(db)
                db.execute("INSERT INTO metadata VALUES ('dataset_version',?)", (DATASET_VERSION,))

    def save(self, principal: Principal, result: Investigation):
        with self.connect() as db:
            db.execute(
                "INSERT INTO investigations VALUES (?,?,?,?)",
                (result.id, principal.tenant_id, principal.user_id, result.model_dump_json()),
            )

    def get(self, principal: Principal, investigation_id: str) -> Investigation | None:
        with self.connect() as db:
            row = db.execute(
                "SELECT payload FROM investigations WHERE id=? AND tenant_id=? AND user_id=?",
                (investigation_id, principal.tenant_id, principal.user_id),
            ).fetchone()
        return Investigation.model_validate_json(row[0]) if row else None

    def audit(self, principal: Principal, action: str, outcome: str, resource_id: str = ""):
        with self.connect() as db:
            db.execute(
                "INSERT INTO audit (tenant_id,user_id,action,outcome,resource_id) VALUES (?,?,?,?,?)",
                (principal.tenant_id, principal.user_id, action, outcome, resource_id),
            )

    def recent(self, principal: Principal, limit: int = 50) -> list[dict]:
        with self.connect() as db:
            rows = db.execute(
                "SELECT payload FROM investigations WHERE tenant_id=? AND user_id=? ORDER BY rowid DESC LIMIT ?",
                (principal.tenant_id, principal.user_id, limit),
            ).fetchall()
        return [
            {k: p[k] for k in ("id", "question", "created_at", "status", "duration_ms", "region")}
            for row in rows
            for p in [json.loads(row[0])]
        ]
