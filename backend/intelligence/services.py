import hashlib
import json
import logging
import sqlite3
import time
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from intelligence.models import InvestigationRequest, Principal
from intelligence.providers import AgentProvider, Progress
from intelligence.security import require
from intelligence.store import Store

logger = logging.getLogger("northstar.execution")


class InvestigationService:
    def __init__(self, store: Store, provider: AgentProvider):
        self.store, self.provider = store, provider

    def reserve(self, principal: Principal, request: InvestigationRequest, key: str) -> str:
        require(principal, "agents.execute", "sales:read", "tickets:read", "policies:read")
        request_hash = hashlib.sha256(request.model_dump_json().encode()).hexdigest()
        execution_id = str(uuid.uuid4())
        try:
            with self.store.connect() as db:
                db.execute(
                    "INSERT INTO executions (id,tenant_id,user_id,idempotency_key,request_hash,status,started_at) "
                    "VALUES (?,?,?,?,?,'queued',?)",
                    (
                        execution_id,
                        principal.tenant_id,
                        principal.user_id,
                        key,
                        request_hash,
                        datetime.now(timezone.utc).isoformat(),
                    ),
                )
        except sqlite3.IntegrityError:
            with self.store.connect() as db:
                existing = db.execute(
                    "SELECT id,request_hash FROM executions WHERE tenant_id=? AND user_id=? AND idempotency_key=?",
                    (principal.tenant_id, principal.user_id, key),
                ).fetchone()
            message = (
                "This request has already been accepted. Open it in execution history."
                if existing and existing["request_hash"] == request_hash
                else "This request key was already used for different parameters."
            )
            raise HTTPException(409, message)
        self.store.audit(principal, "investigation.create", "accepted", execution_id)
        return execution_id

    def execute(
        self,
        principal: Principal,
        request: InvestigationRequest,
        execution_id: str,
        progress: Progress,
    ):
        started = time.perf_counter()
        with self.store.connect() as db:
            db.execute("UPDATE executions SET status='running' WHERE id=?", (execution_id,))
        progress(
            {
                "type": "started",
                "id": execution_id,
                "message": "Workspace verified. Preparing the investigation.",
            }
        )
        try:
            result = self.provider.execute(principal, request, progress, execution_id)
            # Result and terminal execution state commit atomically.
            with self.store.connect() as db:
                db.execute(
                    "INSERT INTO investigations VALUES (?,?,?,?)",
                    (result.id, principal.tenant_id, principal.user_id, result.model_dump_json()),
                )
                db.execute(
                    "UPDATE executions SET status=?,completed_at=?,duration_ms=?,result_id=? WHERE id=?",
                    (
                        result.status,
                        datetime.now(timezone.utc).isoformat(),
                        result.duration_ms,
                        result.id,
                        execution_id,
                    ),
                )
            self.store.audit(principal, "investigation.complete", result.status, result.id)
            progress({"type": "result", "result": result.model_dump(mode="json")})
            return result
        except Exception:
            duration = (time.perf_counter() - started) * 1000
            with self.store.connect() as db:
                db.execute(
                    "UPDATE executions SET status='failed',completed_at=?,duration_ms=?,error=? WHERE id=?",
                    (
                        datetime.now(timezone.utc).isoformat(),
                        duration,
                        "Investigation failed. Retry or contact your administrator with the execution ID.",
                        execution_id,
                    ),
                )
            self.store.audit(principal, "investigation.complete", "failed", execution_id)
            logger.error(json.dumps({"event": "execution.failed", "execution_id": execution_id}))
            progress(
                {
                    "type": "error",
                    "id": execution_id,
                    "message": "Investigation failed. Check execution history before retrying.",
                }
            )
            raise
