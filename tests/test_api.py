import uuid

import pytest
from fastapi.testclient import TestClient
from intelligence.api import create_app
from intelligence.config import Settings

PASSWORD = "Strong-Test-Password-2026"
BODY = {"question": "Investigate product revenue, complaints, and warranty evidence"}


@pytest.fixture
def client(tmp_path):
    app = create_app(Settings(data_path=str(tmp_path / "api.sqlite3"), app_mode="local", bootstrap_password=PASSWORD, login_limit=50))
    with TestClient(app) as test_client:
        yield test_client


def login(client, email="ananya.rao@northstar.example"):
    response = client.post("/api/auth/login", json={"email": email, "password": PASSWORD}, headers={"Origin": "http://127.0.0.1:5173"})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def mutation_headers(csrf, *, key=True):
    headers = {"Origin": "http://127.0.0.1:5173", "X-CSRF-Token": csrf}
    if key:
        headers["Idempotency-Key"] = str(uuid.uuid4())
    return headers


def run(client, csrf):
    return client.post("/api/investigations", json=BODY, headers=mutation_headers(csrf))


def test_session_authentication_and_csrf(client):
    assert client.get("/api/workspace").status_code == 401
    csrf = login(client)
    assert client.get("/api/auth/me").json()["user"]["name"] == "Ananya Rao"
    assert client.post("/api/investigations", json=BODY).status_code == 403
    assert run(client, csrf).status_code == 200


def test_health_verifies_database_readiness(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["database"] == "ready"


def test_cross_tenant_and_owner_reads_are_hidden(client):
    investigation_id = run(client, login(client)).json()["id"]
    login(client, "kavya.nair@meridian.example")
    assert client.get(f"/api/investigations/{investigation_id}").status_code == 404
    assert client.get("/api/investigations").json() == []


def test_approval_and_report_access(client):
    csrf = login(client)
    investigation_id = run(client, csrf).json()["id"]
    path = f"/api/investigations/{investigation_id}/report"
    assert client.post(path, json={}, headers=mutation_headers(csrf, key=False)).status_code == 422
    response = client.post(path, json={"approved": True}, headers=mutation_headers(csrf, key=False))
    assert response.status_code == 200
    assert "Currency: INR" in response.text
    assert "northstar-p1-warranty-v1" in response.text


def test_permission_denials_are_backend_enforced_and_audited(client):
    csrf = login(client, "rahul.menon@northstar.example")
    assert run(client, csrf).status_code == 403
    assert client.get("/api/audit").status_code == 403
    login(client, "arjun.iyer@northstar.example")
    events = client.get("/api/audit").json()
    assert any(e["outcome"] == "denied" and e["user_id"] == "rahul" for e in events)


def test_idempotency_key_cannot_be_reused(client):
    csrf = login(client)
    headers = mutation_headers(csrf)
    assert client.post("/api/investigations", json=BODY, headers=headers).status_code == 200
    assert client.post("/api/investigations", json=BODY, headers=headers).status_code == 409


@pytest.mark.parametrize("fields", [{"as_of": "bad"}, {"as_of": "2026-02-30"}, {"decline_threshold": -1}, {"decline_threshold": 101}, {"unexpected": "field"}])
def test_invalid_requests(client, fields):
    csrf = login(client)
    response = client.post("/api/investigations", json={**BODY, **fields}, headers=mutation_headers(csrf))
    assert response.status_code == 422


def test_rbac_controls_data_endpoints(client):
    login(client, "meera.shah@northstar.example")
    assert client.get("/api/analytics").status_code == 200
    assert client.get("/api/agents").status_code == 403
    login(client, "arjun.iyer@northstar.example")
    assert client.get("/api/users").status_code == 200
    assert client.get("/api/operations").status_code == 200


def test_live_mode_fails_closed(tmp_path):
    with pytest.raises(RuntimeError, match="verified identity"):
        create_app(Settings(app_mode="cloud", data_path=str(tmp_path / "cloud.db")))

