import asyncio
import hmac
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware

from intelligence.analytics import agent_catalog, dashboard, operations
from intelligence.auth import AuthService, RateLimiter
from intelligence.config import Settings, settings
from intelligence.models import Investigation, InvestigationRequest, Principal, Role
from intelligence.providers import MockAgentProvider
from intelligence.sample_data import DATASET_VERSION
from intelligence.security import PERMISSIONS, ROLE_LABELS, profile, require
from intelligence.services import InvestigationService
from intelligence.store import Store

logger = logging.getLogger("northstar.api")
ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class ReportApproval(BaseModel):
    approved: Literal[True]


class RoleUpdate(BaseModel):
    role: Role


def create_app(config: Settings | None = None) -> FastAPI:
    config = config or settings()
    if config.app_mode != "local":
        raise RuntimeError(
            "Cloud API mode is disabled. Configure verified identity and obtain spending approval before deployment."
        )
    store = Store(config.data_path)
    auth = AuthService(store, config)
    limiter = RateLimiter()
    service = InvestigationService(store, MockAgentProvider(store))
    tasks = set()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        store.initialize()
        auth.bootstrap()
        # A local restart must not leave previously interrupted work looking active.
        with store.connect() as db:
            db.execute(
                "UPDATE executions SET status='failed',error='Interrupted by application restart. Start a new investigation.' WHERE status IN ('queued','running')"
            )
        yield
        if tasks:
            await asyncio.gather(*list(tasks), return_exceptions=True)

    app = FastAPI(title="Northstar Intelligence API", version="0.2.0", lifespan=lifespan)
    app.state.store, app.state.auth, app.state.service = store, auth, service
    app.add_middleware(
        TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"]
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Content-Type", "X-CSRF-Token", "Idempotency-Key"],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request.state.request_id = str(uuid.uuid4())
        request.state.user = None
        started = time.perf_counter()
        if not request.client or request.client.host not in {"127.0.0.1", "::1", "testclient"}:
            return JSONResponse(
                {
                    "error": {
                        "code": "LOCAL_ONLY",
                        "message": "This installation accepts local connections only.",
                    }
                },
                status_code=403,
            )
        response = await call_next(request)
        response.headers.update(
            {
                "X-Request-ID": request.state.request_id,
                "X-Content-Type-Options": "nosniff",
                "Referrer-Policy": "same-origin",
                "Cache-Control": "no-store",
            }
        )
        route = request.scope.get("route")
        route_name = getattr(route, "path", "unmatched")
        duration = round((time.perf_counter() - started) * 1000, 3)
        if request.state.user and route_name not in {
            "/api/health",
            "/api/operations",
        }:
            with store.connect() as db:
                db.execute(
                    "INSERT INTO request_metrics (tenant_id,route,method,status,duration_ms) VALUES (?,?,?,?,?)",
                    (
                        request.state.user.tenant_id,
                        route_name,
                        request.method,
                        response.status_code,
                        duration,
                    ),
                )
                db.execute(
                    "DELETE FROM request_metrics WHERE id < (SELECT COALESCE(MAX(id),0)-50000 FROM request_metrics)"
                )
        logger.info(
            json.dumps(
                {
                    "request_id": request.state.request_id,
                    "route": route_name,
                    "method": request.method,
                    "status": response.status_code,
                    "response_start_ms": duration,
                }
            )
        )
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        if exc.status_code == 403 and getattr(request.state, "user", None):
            store.audit(
                request.state.user,
                "access.denied",
                "denied",
                getattr(request.scope.get("route"), "path", ""),
            )
        return JSONResponse(
            {
                "error": {
                    "code": f"HTTP_{exc.status_code}",
                    "message": str(exc.detail),
                    "request_id": getattr(request.state, "request_id", ""),
                }
            },
            status_code=exc.status_code,
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(
            {
                "error": {
                    "code": "INVALID_INPUT",
                    "message": "Check the highlighted request fields.",
                    "fields": [
                        {"field": ".".join(str(x) for x in e["loc"][1:]), "message": e["msg"]}
                        for e in exc.errors()
                    ],
                    "request_id": getattr(request.state, "request_id", ""),
                }
            },
            status_code=422,
        )

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        logger.error(
            json.dumps(
                {
                    "event": "request.failed",
                    "request_id": getattr(request.state, "request_id", ""),
                    "error_type": type(exc).__name__,
                }
            )
        )
        return JSONResponse(
            {
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "The request could not be completed. Please try again.",
                    "request_id": getattr(request.state, "request_id", ""),
                }
            },
            status_code=500,
        )

    def check_origin(request: Request):
        if request.headers.get("origin") and request.headers["origin"] not in ORIGINS:
            raise HTTPException(403, "The request origin is not allowed.")

    def principal(request: Request) -> Principal:
        user, csrf = auth.resolve(request.cookies.get("northstar_session"))
        request.state.user = user
        request.state.csrf = csrf
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            check_origin(request)
            if not hmac.compare_digest(request.headers.get("x-csrf-token", ""), csrf):
                raise HTTPException(
                    403, "The request security token is missing or expired. Refresh and retry."
                )
        return user

    Identity = Annotated[Principal, Depends(principal)]

    @app.get("/api/health")
    def health():
        try:
            with store.connect() as db:
                db.execute("SELECT 1").fetchone()
        except Exception as exc:  # noqa: BLE001
            logger.error(
                json.dumps(
                    {
                        "event": "health.database_unavailable",
                        "error_type": type(exc).__name__,
                    }
                )
            )
            return JSONResponse(
                {
                    "status": "unavailable",
                    "mode": "local",
                    "database": "unavailable",
                    "live_integrations": False,
                    "cloud_spending": "blocked",
                },
                status_code=503,
            )
        return {
            "status": "ok",
            "mode": "local",
            "database": "ready",
            "live_integrations": False,
            "cloud_spending": "blocked",
        }

    @app.post("/api/auth/login")
    def login(body: LoginRequest, request: Request):
        check_origin(request)
        limiter.check("login:" + request.client.host, config.login_limit)
        user, token, csrf = auth.login(body.email, body.password)
        request.state.user = user
        response = JSONResponse({"user": profile(user), "csrf_token": csrf})
        response.set_cookie(
            "northstar_session",
            token,
            httponly=True,
            secure=config.cookie_secure,
            samesite="strict",
            max_age=config.session_ttl_seconds,
            path="/",
        )
        return response

    @app.get("/api/auth/me")
    def me(request: Request, user: Identity):
        return {"user": profile(user), "csrf_token": request.state.csrf}

    @app.post("/api/auth/logout")
    def logout(request: Request, user: Identity):
        auth.logout(request.cookies["northstar_session"])
        store.audit(user, "session.sign_out", "success")
        response = Response(status_code=204)
        response.delete_cookie(
            "northstar_session",
            path="/",
            secure=config.cookie_secure,
            httponly=True,
            samesite="strict",
        )
        return response

    @app.get("/api/workspace")
    def workspace(user: Identity):
        return {
            "organization": user.organization,
            "name": "Northstar Intelligence",
            "environment": "Private workspace",
            "dataset": DATASET_VERSION,
            "data_label": "Sample enterprise data",
            "currency": "INR",
            "regions": ["All regions", "West", "South", "North"],
            "periods": [
                {"value": "2026-07-01", "label": "Apr – Jun 2026"},
                {"value": "2026-04-01", "label": "Jan – Mar 2026"},
            ],
            "cloud_enabled": False,
            "provider": "offline",
        }

    @app.get("/api/analytics")
    def analytics(
        user: Identity,
        as_of: str = "2026-07-01",
        region: Literal["All regions", "West", "South", "North"] = "All regions",
    ):
        try:
            params = InvestigationRequest(as_of=as_of, region=region)
        except ValueError:
            raise HTTPException(422, "Choose a valid comparison date.")
        return dashboard(store, user, params.as_of, params.region)

    def reserve(body: InvestigationRequest, user: Principal, key: str | None):
        limiter.check("execution:" + user.user_id, config.execution_limit)
        if not key or len(key) > 100:
            raise HTTPException(422, "A valid Idempotency-Key header is required.")
        return service.reserve(user, body, key)

    @app.post("/api/investigations", response_model=Investigation)
    def run(
        body: InvestigationRequest,
        user: Identity,
        idempotency_key: Annotated[str | None, Header()] = None,
    ):
        execution_id = reserve(body, user, idempotency_key)
        return service.execute(user, body, execution_id, lambda _: None)

    @app.post("/api/investigations/stream")
    async def stream(
        body: InvestigationRequest,
        user: Identity,
        idempotency_key: Annotated[str | None, Header()] = None,
    ):
        execution_id = reserve(body, user, idempotency_key)
        queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def emit(event):
            loop.call_soon_threadsafe(queue.put_nowait, event)

        async def work():
            try:
                await asyncio.to_thread(service.execute, user, body, execution_id, emit)
            except Exception as error:  # noqa: BLE001
                logger.info(
                    json.dumps(
                        {
                            "event": "stream.execution_closed",
                            "execution_id": execution_id,
                            "error_type": type(error).__name__,
                        }
                    )
                )
            finally:
                await queue.put(None)

        task = asyncio.create_task(work())
        tasks.add(task)
        task.add_done_callback(tasks.discard)

        async def events():
            yield "data: " + json.dumps({"type": "accepted", "id": execution_id}) + "\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
                    continue
                if event is None:
                    break
                yield "data: " + json.dumps(event) + "\n\n"

        return StreamingResponse(
            events(),
            media_type="text/event-stream",
            headers={"X-Accel-Buffering": "no", "Cache-Control": "no-store"},
        )

    @app.get("/api/investigations")
    def history(user: Identity, limit: int = Query(default=50, ge=1, le=100)):
        return store.recent(user, limit)

    @app.get("/api/investigations/{investigation_id}", response_model=Investigation)
    def result(investigation_id: str, user: Identity):
        item = store.get(user, investigation_id)
        if item is None:
            raise HTTPException(404, "Investigation not found.")
        return item

    @app.get("/api/executions")
    def executions(user: Identity):
        with store.connect() as db:
            return [
                dict(r)
                for r in db.execute(
                    "SELECT id,status,started_at,duration_ms,result_id,error FROM executions "
                    "WHERE tenant_id=? AND user_id=? ORDER BY started_at DESC LIMIT 100",
                    (user.tenant_id, user.user_id),
                )
            ]

    @app.post("/api/investigations/{investigation_id}/report")
    def report(investigation_id: str, body: ReportApproval, user: Identity):
        require(user, "reports:create")
        item = result(investigation_id, user)
        lines = [
            "# Northstar Intelligence · Product investigation",
            "",
            "Classification: sample enterprise data",
            "Currency: INR",
            "",
            item.period,
            item.region,
            "",
            item.summary,
            "",
        ]
        for product in item.products:
            lines.extend(
                [
                    f"## {product.product}",
                    f"Revenue change: {product.change_pct}%",
                    product.warranty,
                    f"Evidence: {', '.join(product.evidence_ids)}",
                    "",
                ]
            )
        lines.extend(
            ["## Recommended actions", *[f"- {r}" for r in item.recommendations], "", "## Evidence"]
        )
        for source in item.evidence:
            lines.extend([f"### {source.id}: {source.title}", source.excerpt, source.source, ""])
        store.audit(user, "report.export", "approved", investigation_id)
        return Response(
            "\n".join(lines),
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="northstar-{item.id}.md"'},
        )

    @app.get("/api/agents")
    def agents(user: Identity):
        return agent_catalog(store, user)

    @app.get("/api/operations")
    def ops(user: Identity):
        return operations(store, user)

    @app.get("/api/audit")
    def audit(user: Identity):
        require(user, "audit.read")
        with store.connect() as db:
            return [
                dict(r)
                for r in db.execute(
                    "SELECT a.*,json_extract(u.profile,'$.name') AS name FROM audit a "
                    "LEFT JOIN users u ON a.user_id=u.id WHERE a.tenant_id=? ORDER BY a.id DESC LIMIT 200",
                    (user.tenant_id,),
                )
            ]

    @app.get("/api/users")
    def users(user: Identity):
        require(user, "users.read")
        with store.connect() as db:
            people = [
                profile(Principal.model_validate_json(r[0]))
                for r in db.execute(
                    "SELECT profile FROM users WHERE tenant_id=? ORDER BY email", (user.tenant_id,)
                )
            ]
        return {
            "users": people,
            "roles": [
                {"value": r, "label": label, "capabilities": sorted(PERMISSIONS[r])}
                for r, label in ROLE_LABELS.items()
            ],
        }

    @app.patch("/api/users/{user_id}/role")
    def update_role(user_id: str, body: RoleUpdate, user: Identity):
        require(user, "users.manage")
        if user_id == user.user_id:
            raise HTTPException(409, "Your own administrator access cannot be changed here.")
        with store.connect() as db:
            row = db.execute(
                "SELECT profile FROM users WHERE id=? AND tenant_id=?", (user_id, user.tenant_id)
            ).fetchone()
            if not row:
                raise HTTPException(404, "Workspace member not found.")
            target = Principal.model_validate_json(row[0])
            target.role = body.role
            db.execute("UPDATE users SET profile=? WHERE id=?", (target.model_dump_json(), user_id))
            db.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
            db.execute(
                "INSERT INTO audit (tenant_id,user_id,action,outcome,resource_id) VALUES (?,?,?,?,?)",
                (user.tenant_id, user.user_id, "member.role_change", body.role, user_id),
            )
        return profile(target)

    return app
