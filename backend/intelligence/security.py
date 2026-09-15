from fastapi import HTTPException

from intelligence.models import Principal
from intelligence.sample_data import PEOPLE

ROLE_LABELS = {
    "administrator": "Administrator",
    "platform_engineer": "Platform engineer",
    "analyst": "Analyst",
    "developer": "Developer",
    "finance": "Finance user",
    "viewer": "Viewer",
    "support": "Support specialist",
}
PERMISSIONS = {
    "administrator": {"agents.read", "operations.read", "audit.read", "users.manage", "users.read"},
    "platform_engineer": {"agents.read", "operations.read", "audit.read"},
    "analyst": {
        "agents.read",
        "agents.execute",
        "analytics.read",
        "sales:read",
        "tickets:read",
        "policies:read",
        "reports:create",
    },
    "developer": {"agents.read", "operations.read"},
    "finance": {"analytics.read", "sales:read", "billing.read"},
    "viewer": {"analytics.read", "sales:read"},
    "support": {"agents.read", "tickets:read", "policies:read"},
}


def require(principal: Principal, *permissions: str) -> None:
    if not principal.active or not set(permissions).issubset(PERMISSIONS[principal.role]):
        raise HTTPException(
            403,
            "Your access level does not allow this action. Contact your workspace administrator.",
        )


def profile(principal: Principal) -> dict:
    return {
        **principal.model_dump(),
        "role_label": ROLE_LABELS[principal.role],
        "capabilities": sorted(PERMISSIONS[principal.role]),
    }


# Reference identities support deterministic tests and are never an authentication mechanism.
REFERENCE_USERS = {p.user_id: p for p in PEOPLE}
