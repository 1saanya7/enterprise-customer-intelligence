import asyncio
import importlib.util
from pathlib import Path
from unittest.mock import patch

import pytest
from intelligence.cost_policy import CloudUsageDisabled


def test_bigquery_is_blocked_before_client_or_credentials():
    from intelligence.cloud import BigQuerySales

    with patch("intelligence.cloud.bigquery.Client") as client:
        with pytest.raises(CloudUsageDisabled, match="no-paid-cloud"):
            BigQuerySales("sample-project", "analytics", "us-central1")
        client.assert_not_called()


def test_every_agent_blocks_model_calls(tmp_path):
    from intelligence.agents import build_agent
    from intelligence.security import REFERENCE_USERS
    from intelligence.store import Store

    graph = build_agent("any-model", Store(str(tmp_path / "cost.db")), REFERENCE_USERS["ananya"])
    for agent in graph.edges[0][1:]:
        with pytest.raises(CloudUsageDisabled):
            agent.before_model_callback(callback_context=None, llm_request=None)


def test_smoke_script_blocks_even_with_project_and_model(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "sample-project")
    monkeypatch.setenv("GEMINI_MODEL", "any-model")
    path = Path(__file__).resolve().parents[1] / "scripts/adk_smoke.py"
    spec = importlib.util.spec_from_file_location("adk_smoke", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with pytest.raises(CloudUsageDisabled):
        asyncio.run(module.main())


def test_google_provider_is_a_disabled_extension_point(tmp_path):
    from intelligence.models import InvestigationRequest
    from intelligence.providers import GoogleAgentProvider
    from intelligence.security import REFERENCE_USERS
    provider = GoogleAgentProvider()
    with pytest.raises(CloudUsageDisabled, match="Google agent provider execution"):
        provider.execute(
            REFERENCE_USERS["ananya"],
            InvestigationRequest(),
            lambda _event: None,
            "blocked-execution",
        )

