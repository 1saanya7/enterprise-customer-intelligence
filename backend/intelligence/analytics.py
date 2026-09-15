import json
import math
import time
from datetime import datetime, timedelta, timezone

from intelligence.models import Principal
from intelligence.security import PERMISSIONS, require
from intelligence.store import Store
from intelligence.workflow import quarter_bounds


def dashboard(store: Store, principal: Principal, as_of: str, region: str) -> dict:
    require(principal, "analytics.read", "sales:read")
    baseline, start, end = quarter_bounds(as_of)
    params = {
        "tenant": principal.tenant_id,
        "baseline": baseline,
        "start": start,
        "end": end,
        "region": region,
    }
    where = "tenant_id=:tenant AND order_date>=:baseline AND order_date<:end AND (:region='All regions' OR region=:region)"
    with store.connect() as db:
        products = [
            dict(r)
            for r in db.execute(
                f"""SELECT product_id,product,category,
            SUM(CASE WHEN order_date<:start THEN revenue_paise ELSE 0 END)/100.0 AS previous_revenue,
            SUM(CASE WHEN order_date>=:start THEN revenue_paise ELSE 0 END)/100.0 AS current_revenue,
            SUM(CASE WHEN order_date>=:start THEN units ELSE 0 END) AS units,
            SUM(CASE WHEN order_date<:start THEN 1 ELSE 0 END) AS previous_rows,
            SUM(CASE WHEN order_date>=:start THEN 1 ELSE 0 END) AS current_rows
            FROM sales WHERE {where} GROUP BY product_id,product,category ORDER BY current_revenue DESC""",
                params,
            )
        ]
        trends = [
            dict(r)
            for r in db.execute(
                f"SELECT substr(order_date,1,7) AS month, SUM(revenue_paise)/100.0 AS revenue "
                f"FROM sales WHERE {where} GROUP BY month ORDER BY month",
                params,
            )
        ]
        regions = [
            dict(r)
            for r in db.execute(
                "SELECT region,SUM(revenue_paise)/100.0 AS revenue FROM sales "
                "WHERE tenant_id=:tenant AND order_date>=:start AND order_date<:end AND (:region='All regions' OR region=:region) "
                "GROUP BY region ORDER BY revenue DESC",
                params,
            )
        ]
        complaints = None
        if "tickets:read" in PERMISSIONS[principal.role]:
            complaints = [
                dict(r)
                for r in db.execute(
                    "SELECT category,COUNT(*) AS count FROM tickets WHERE tenant_id=:tenant "
                    "AND created_at>=:start AND created_at<:end AND (:region='All regions' OR region=:region) GROUP BY category ORDER BY count DESC",
                    params,
                )
            ]
    complete = bool(products) and all(p["previous_rows"] and p["current_rows"] for p in products)
    for p in products:
        p["change_pct"] = (
            round((p["current_revenue"] / p["previous_revenue"] - 1) * 100, 2)
            if p["previous_revenue"] and complete
            else None
        )
        del p["previous_rows"], p["current_rows"]
    previous = sum(p["previous_revenue"] for p in products)
    current = sum(p["current_revenue"] for p in products)
    return {
        "currency": "INR",
        "data_classification": "Sample business data",
        "period_start": start,
        "period_end": end,
        "baseline_start": baseline,
        "complete": complete,
        "region": region,
        "revenue": current,
        "previous_revenue": previous,
        "change_pct": round((current / previous - 1) * 100, 2) if previous and complete else None,
        "declining_products": sum(
            p["change_pct"] is not None and p["change_pct"] < -15 for p in products
        ),
        "units": sum(p["units"] for p in products),
        "products": products,
        "trends": trends,
        "regions": regions,
        "complaints": complaints,
    }


def operations(store: Store, principal: Principal) -> dict:
    require(principal, "operations.read")
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    with store.connect() as db:
        runs = [
            dict(r)
            for r in db.execute(
                "SELECT e.id,e.user_id,json_extract(u.profile,'$.name') AS user_name,e.status,e.started_at,"
                "e.completed_at,e.duration_ms,e.result_id,e.error FROM executions e "
                "LEFT JOIN users u ON u.id=e.user_id WHERE e.tenant_id=? AND e.started_at>=? "
                "ORDER BY e.started_at DESC LIMIT 5000",
                (principal.tenant_id, since),
            )
        ]
        metrics = [
            dict(r)
            for r in db.execute(
                "SELECT route,status,duration_ms FROM request_metrics WHERE tenant_id=? "
                "AND created_at>=? ORDER BY id DESC LIMIT 5000",
                (principal.tenant_id, since),
            )
        ]
        active = db.execute(
            "SELECT COUNT(DISTINCT s.user_id) FROM sessions s JOIN users u ON u.id=s.user_id "
            "WHERE u.tenant_id=? AND s.expires>? AND s.last_seen>?",
            (principal.tenant_id, time.time(), time.time() - 900),
        ).fetchone()[0]
    durations = sorted(m["duration_ms"] for m in metrics)
    finished = [r for r in runs if r["status"] in ("complete", "insufficient_evidence", "failed")]
    completed = sum(r["status"] in ("complete", "insufficient_evidence") for r in finished)
    return {
        "window": "Last 24 hours · up to 5,000 records",
        "execution_count": len(runs),
        "success_rate": round(completed / len(finished) * 100, 1) if finished else None,
        "failed_count": sum(r["status"] == "failed" for r in runs),
        "active_users": active,
        "api_requests": len(metrics),
        "api_error_rate": round(sum(m["status"] >= 500 for m in metrics) / len(metrics) * 100, 1)
        if metrics
        else None,
        "p95_ms": round(durations[max(0, math.ceil(len(durations) * 0.95) - 1)], 2)
        if durations
        else None,
        "model_tokens": 0,
        "ai_cost_inr": 0,
        "infrastructure_cost_inr": None,
        "cloud_status": "Blocked by spending policy",
        "runs": runs[:50],
        "latency": [
            {
                "route": route,
                "requests": len(group),
                "average_ms": round(sum(x["duration_ms"] for x in group) / len(group), 2),
            }
            for route in sorted({m["route"] for m in metrics})
            for group in [[m for m in metrics if m["route"] == route]]
        ],
    }


def agent_catalog(store: Store, principal: Principal) -> list[dict]:
    require(principal, "agents.read")
    with store.connect() as db:
        rows = db.execute(
            "SELECT payload FROM investigations WHERE tenant_id=? AND user_id=? ORDER BY rowid DESC LIMIT 100",
            (principal.tenant_id, principal.user_id),
        ).fetchall()
    results = [json.loads(r[0]) for r in rows]
    definitions = [
        (
            "sales",
            "Revenue analyst",
            "Compare completed quarters and identify material product declines.",
            "Sales analysis",
            ["Scoped sales query", "Quarter comparison"],
        ),
        (
            "signals",
            "Customer signals",
            "Aggregate support tickets into actionable product complaint themes.",
            "Complaint aggregation",
            ["Ticket aggregation"],
        ),
        (
            "policy",
            "Policy researcher",
            "Find effective warranty terms and disclose coverage conditions.",
            "Policy lookup",
            ["Versioned policy lookup"],
        ),
        (
            "validation",
            "Evidence reviewer",
            "Recompute numerical claims and verify their source references.",
            "Evidence validation",
            ["Numeric validation", "Citation verification"],
        ),
    ]
    output = []
    for id_, name, description, step, tools in definitions:
        agent_results = [
            result
            for result in results
            if any(trace["name"] == step and trace["status"] == "complete" for trace in result["trace"])
        ]
        traces = [
            t
            for r in agent_results
            for t in r["trace"]
            if t["name"] == step and t["status"] == "complete"
        ]
        output.append(
            {
                "id": id_,
                "name": name,
                "description": description,
                "provider": "Offline workflow",
                "model": None,
                "status": "Available",
                "tools": tools,
                "runs": len(traces),
                "average_ms": round(sum(t["duration_ms"] for t in traces) / len(traces), 2)
                if traces
                else None,
                "last_execution": agent_results[0]["created_at"] if agent_results else None,
                "cost_inr": 0,
                "scope": "Your latest 100 investigations",
            }
        )
    return output
