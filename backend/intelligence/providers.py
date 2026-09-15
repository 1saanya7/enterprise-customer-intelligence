"""Provider boundary. Only the offline implementation is authorised and executable."""

from collections.abc import Callable
from typing import Protocol

from intelligence.cost_policy import require_cloud_usage
from intelligence.models import Investigation, InvestigationRequest, Principal
from intelligence.store import Store
from intelligence.workflow import investigate

Progress = Callable[[dict], None]


class AgentProvider(Protocol):
    name: str

    def execute(
        self,
        principal: Principal,
        request: InvestigationRequest,
        progress: Progress,
        execution_id: str,
    ) -> Investigation: ...


class MockAgentProvider:
    """Executes real deterministic calculations over the versioned sample dataset."""

    name = "offline"

    def __init__(self, store: Store):
        self.store = store

    def execute(
        self,
        principal: Principal,
        request: InvestigationRequest,
        progress: Progress,
        execution_id: str,
    ) -> Investigation:
        return investigate(self.store, principal, request, progress, execution_id)


class GoogleAgentProvider:
    """Non-operational extension point; no SDK/client/credentials are initialized."""

    name = "google-disabled"

    def execute(
        self,
        principal: Principal,
        request: InvestigationRequest,
        progress: Progress,
        execution_id: str,
    ) -> Investigation:
        require_cloud_usage("Google agent provider execution")
