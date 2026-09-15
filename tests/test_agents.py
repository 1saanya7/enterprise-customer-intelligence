def test_adk_agent_construction(tmp_path):
    from intelligence.agents import build_agent
    from intelligence.security import REFERENCE_USERS
    from intelligence.store import Store

    store = Store(str(tmp_path / "adk.sqlite3"))
    store.initialize()
    agent = build_agent("test-model-no-network", store, REFERENCE_USERS["ananya"])
    chain = agent.edges[0]
    assert [a.name for a in chain[1:]] == ["evidence_researcher", "evidence_reviewer"]
    tool = chain[1].tools[0]
    assert tool()["products"][0]["current_revenue"] == 8640000

