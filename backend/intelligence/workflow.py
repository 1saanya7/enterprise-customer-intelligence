import time
import uuid
from collections.abc import Callable
from datetime import date, datetime, timezone

from intelligence.models import (
    Evidence,
    Investigation,
    InvestigationRequest,
    Principal,
    ProductFinding,
    TraceStep,
)
from intelligence.security import require
from intelligence.store import Store


def quarter_bounds(as_of: str) -> tuple[str, str, str]:
    current = date.fromisoformat(as_of)
    end = date(current.year, ((current.month - 1) // 3) * 3 + 1, 1)

    def previous(d: date) -> date:
        return date(d.year - 1, 10, 1) if d.month == 1 else date(d.year, d.month - 3, 1)

    start = previous(end)
    return previous(start).isoformat(), start.isoformat(), end.isoformat()


def inr(value: float) -> str:
    whole = str(round(value))
    if len(whole) <= 3:
        return "₹" + whole
    head, tail = whole[:-3], whole[-3:]
    groups = []
    while head:
        groups.insert(0, head[-2:])
        head = head[:-2]
    return "₹" + ",".join(groups + [tail])


def investigate(
    store: Store,
    principal: Principal,
    request: InvestigationRequest,
    progress: Callable[[dict], None] | None = None,
    execution_id: str | None = None,
) -> Investigation:
    started = time.perf_counter()
    trace: list[TraceStep] = []

    def stage(name: str, detail: str, since: float, skipped: bool = False):
        step = TraceStep(
            name=name,
            status="skipped" if skipped else "complete",
            detail=detail,
            duration_ms=round((time.perf_counter() - since) * 1000, 3),
        )
        trace.append(step)
        if progress:
            progress({"type": "step", **step.model_dump()})

    require(principal, "agents.execute", "sales:read", "tickets:read", "policies:read")
    stage("Authorization", "Verified your workspace access and investigation capability.", started)
    baseline, start, end = quarter_bounds(request.as_of)
    params = {
        "tenant": principal.tenant_id,
        "baseline": baseline,
        "start": start,
        "end": end,
        "region": request.region,
    }
    tick = time.perf_counter()
    with store.connect() as db:
        rows = db.execute(
            """
            SELECT product_id,product,
                SUM(CASE WHEN order_date < :start THEN revenue_paise ELSE 0 END) AS previous,
                SUM(CASE WHEN order_date >= :start THEN revenue_paise ELSE 0 END) AS current,
                SUM(CASE WHEN order_date < :start THEN 1 ELSE 0 END) AS previous_rows,
                SUM(CASE WHEN order_date >= :start THEN 1 ELSE 0 END) AS current_rows
            FROM sales WHERE tenant_id=:tenant AND order_date>=:baseline AND order_date<:end
                AND (:region='All regions' OR region=:region)
            GROUP BY product_id,product ORDER BY product_id
        """,
            params,
        ).fetchall()
        complete = bool(rows) and all(r["previous_rows"] and r["current_rows"] for r in rows)
        candidates = [
            r
            for r in rows
            if complete
            and r["previous"] > 0
            and (r["current"] - r["previous"]) / r["previous"] * 100 < -request.decline_threshold
        ]
        stage(
            "Sales analysis", f"Compared completed quarters across {request.region.lower()}.", tick
        )
        tick = time.perf_counter()
        candidate_ids = {row["product_id"] for row in candidates}
        counts = {product_id: [] for product_id in candidate_ids}
        ticket_rows = db.execute(
            "SELECT product_id,category,COUNT(*) AS count FROM tickets WHERE tenant_id=:tenant "
            "AND created_at>=:start AND created_at<:end AND (:region='All regions' OR region=:region) "
            "GROUP BY product_id,category ORDER BY product_id,count DESC,category",
            params,
        ).fetchall()
        for ticket in ticket_rows:
            if ticket["product_id"] in candidate_ids:
                counts[ticket["product_id"]].append(
                    {"category": ticket["category"], "count": ticket["count"]}
                )
        stage(
            "Complaint aggregation",
            f"Reviewed ticket categories for {len(candidates)} qualifying products.",
            tick,
            not candidates,
        )
        tick = time.perf_counter()
        policies = {product_id: None for product_id in candidate_ids}
        policy_rows = db.execute(
            "SELECT * FROM policies WHERE tenant_id=? AND effective_from<=? AND effective_to>? "
            "ORDER BY product_id,effective_from DESC",
            (principal.tenant_id, request.as_of, request.as_of),
        ).fetchall()
        for policy in policy_rows:
            product_id = policy["product_id"]
            if product_id in candidate_ids and policies[product_id] is None:
                policies[product_id] = policy
        stage(
            "Policy lookup",
            "Matched product policies effective on the selected date.",
            tick,
            not candidates,
        )
    tick = time.perf_counter()
    products, evidence = [], []
    for row in candidates:
        pid = row["product_id"]
        change = round((row["current"] - row["previous"]) / row["previous"] * 100, 2)
        policy = policies[pid]
        ids = [f"sales-{pid}", f"complaints-{pid}"]
        evidence.extend(
            [
                Evidence(
                    id=ids[0],
                    kind="sql",
                    title=f"{row['product']} · Quarterly revenue",
                    excerpt=f"Previous quarter: {inr(row['previous'] / 100)}; current quarter: {inr(row['current'] / 100)}; change: {change:g}%.",
                    source="Sales ledger · INR · selected region and completed quarters",
                ),
                Evidence(
                    id=ids[1],
                    kind="sql",
                    title=f"{row['product']} · Support tickets",
                    excerpt="; ".join(f"{c['category']}: {c['count']} tickets" for c in counts[pid])
                    or "No support tickets in this period.",
                    source="Customer operations · ticket counts, not unique customers",
                ),
            ]
        )
        if policy:
            ids.append(policy["id"])
            evidence.append(
                Evidence(
                    id=policy["id"],
                    kind="document",
                    title=policy["title"],
                    excerpt=policy["text"],
                    source=f"Policy register · effective {policy['effective_from']}",
                )
            )
        products.append(
            ProductFinding(
                product_id=pid,
                product=row["product"],
                previous_revenue=row["previous"] / 100,
                current_revenue=row["current"] / 100,
                change_pct=change,
                complaints=counts[pid],
                evidence_ids=ids,
                warranty="Potential manufacturing-defect coverage; invoice and inspection required."
                if policy
                else "Insufficient evidence: no applicable policy.",
            )
        )
    known = {e.id for e in evidence}
    for product in products:
        expected = round((product.current_revenue / product.previous_revenue - 1) * 100, 2)
        if abs(expected - product.change_pct) > 0.01 or not set(product.evidence_ids) <= known:
            raise ValueError("Evidence validation failed")
    stage(
        "Evidence validation",
        f"Verified {len(evidence)} source references and recomputed revenue changes.",
        tick,
        not products,
    )
    status = (
        "complete"
        if complete and all(len(p.evidence_ids) == 3 for p in products)
        else "insufficient_evidence"
    )
    summary = (
        (
            f"{len(products)} products declined by more than {request.decline_threshold:g}% in the latest completed quarter. "
            "Complaint patterns are signals for investigation; they do not establish the cause of the decline."
        )
        if complete
        else (
            "Sales data is missing for one or both comparison quarters. A reliable decline cannot be calculated."
        )
    )
    return Investigation(
        id=execution_id or str(uuid.uuid4()),
        status=status,
        question=request.question,
        period=f"{start} to {end} (exclusive), compared with {baseline} to {start}",
        region=request.region,
        summary=summary,
        recommendations=[
            "Prioritise an engineering review of the leading complaint categories.",
            "Verify purchase invoices and inspection findings before deciding warranty coverage.",
            "Review pricing, availability and channel mix before attributing the revenue decline.",
        ]
        if products
        else [],
        products=products,
        evidence=evidence,
        trace=trace,
        duration_ms=round((time.perf_counter() - started) * 1000, 3),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
