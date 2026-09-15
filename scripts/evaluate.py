"""Small development-fixture evaluation, not a held-out AI quality benchmark."""

import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from intelligence.models import InvestigationRequest
from intelligence.security import REFERENCE_USERS
from intelligence.store import Store
from intelligence.workflow import investigate


def main():
    root = Path(__file__).resolve().parents[1]
    cases = json.loads((root / "evaluation/scenarios.json").read_text())
    outcomes = []
    with tempfile.TemporaryDirectory() as temporary:
        store = Store(str(Path(temporary) / "evaluation.sqlite3"))
        store.initialize()
        for case in cases:
            try:
                result = investigate(
                    store,
                    REFERENCE_USERS[case["user"]],
                    InvestigationRequest(
                        question="Investigate the fixture's product performance and evidence.",
                        decline_threshold=case["threshold"],
                        as_of=case["as_of"],
                    ),
                )
                passed = (
                    "http_status" not in case
                    and result.status == case["status"]
                    and [p.product_id for p in result.products] == case["products"]
                )
            except HTTPException as error:
                passed = error.status_code == case.get("http_status")
            outcomes.append({"id": case["id"], "passed": passed})
    report = {
        "suite": "development fixtures; no live LLM calls",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "passed": sum(o["passed"] for o in outcomes),
        "total": len(outcomes),
        "cases": outcomes,
    }
    output = root / ".local/evaluation.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["passed"] == report["total"] else 1)


if __name__ == "__main__":
    main()
