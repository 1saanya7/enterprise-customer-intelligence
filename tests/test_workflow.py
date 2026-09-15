import pytest
from fastapi import HTTPException
from intelligence.models import InvestigationRequest
from intelligence.security import REFERENCE_USERS
from intelligence.store import Store
from intelligence.workflow import investigate, quarter_bounds


@pytest.fixture
def store(tmp_path):
    instance = Store(str(tmp_path / "test.sqlite3"))
    instance.initialize()
    return instance


def request(**kwargs):
    return InvestigationRequest(question="Investigate sales and complaints", **kwargs)


def test_flagship_known_results(store):
    result = investigate(store, REFERENCE_USERS["ananya"], request())
    assert result.status == "complete"
    assert [(p.product_id, p.change_pct) for p in result.products] == [("p1", -28), ("p2", -20)]
    assert result.products[0].complaints[0].model_dump() == {"category": "Battery overheating", "count": 42}
    assert len(result.evidence) == 6
    assert "inspection required" in result.products[0].warranty


def test_tenants_do_not_mix(store):
    northstar = investigate(store, REFERENCE_USERS["ananya"], request())
    meridian = investigate(store, REFERENCE_USERS["kavya"], request())
    assert northstar.products[0].current_revenue == 8640000
    assert meridian.products[0].current_revenue == 5184000
    assert meridian.products[0].complaints[0].count == 25
    assert all("northstar" not in e.id for e in meridian.evidence)


@pytest.mark.parametrize("user", ["rahul", "meera", "arjun"])
def test_permissions_before_data_access(store, user):
    with pytest.raises(HTTPException) as exc:
        investigate(store, REFERENCE_USERS[user], request())
    assert exc.value.status_code == 403


def test_threshold_is_strict(store):
    result = investigate(store, REFERENCE_USERS["ananya"], request(decline_threshold=20))
    assert [p.product_id for p in result.products] == ["p1"]


def test_no_data_is_not_success(store):
    result = investigate(store, REFERENCE_USERS["ananya"], request(as_of="2025-07-15"))
    assert result.status == "insufficient_evidence"
    assert not result.products


def test_missing_policy_is_insufficient(store):
    with store.connect() as db:
        db.execute("DELETE FROM policies WHERE tenant_id='northstar' AND product_id='p1'")
    result = investigate(store, REFERENCE_USERS["ananya"], request())
    assert result.status == "insufficient_evidence"
    assert "no applicable policy" in result.products[0].warranty


def test_quarter_year_boundary():
    assert quarter_bounds("2026-01-01") == ("2025-07-01", "2025-10-01", "2026-01-01")
    assert quarter_bounds("2026-07-01") == ("2026-01-01", "2026-04-01", "2026-07-01")


def test_seed_is_idempotent(store):
    store.initialize()
    with store.connect() as db:
        assert db.execute("SELECT COUNT(*) FROM sales").fetchone()[0] == 216


@pytest.mark.parametrize("as_of", ["2026-04-15", "2026-10-15"])
def test_one_missing_quarter_is_not_zero_revenue(store, as_of):
    result = investigate(store, REFERENCE_USERS["ananya"], request(as_of=as_of))
    assert result.status == "insufficient_evidence"
    assert not result.products

