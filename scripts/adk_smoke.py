"""Run explicitly after configuring ADC, project, and a supported model in .env."""

import asyncio
import os

from intelligence.config import settings
from intelligence.cost_policy import CloudUsageDisabled, require_cloud_usage


async def main():
    require_cloud_usage("Live ADK smoke test")
    config = settings()
    if not config.google_cloud_project or not config.gemini_model:
        raise ValueError("Set GOOGLE_CLOUD_PROJECT and GEMINI_MODEL in .env first.")
    os.environ.update(
        GOOGLE_GENAI_USE_VERTEXAI="TRUE",
        GOOGLE_CLOUD_PROJECT=config.google_cloud_project,
        GOOGLE_CLOUD_LOCATION=config.google_cloud_location,
    )
    from google.adk.agents.run_config import RunConfig
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types
    from intelligence.agents import build_agent
    from intelligence.security import REFERENCE_USERS
    from intelligence.store import Store

    store = Store(config.data_path)
    store.initialize()
    agent = build_agent(config.gemini_model, store, REFERENCE_USERS["ananya"])
    sessions = InMemorySessionService()
    session = await sessions.create_session(app_name="customer_intelligence", user_id="ananya")
    runner = Runner(node=agent, app_name="customer_intelligence", session_service=sessions)
    async for event in runner.run_async(
        user_id="ananya",
        session_id=session.id,
        run_config=RunConfig(max_llm_calls=8),
        new_message=types.Content(
            role="user",
            parts=[
                types.Part(text="Investigate products declining more than 15% as of 2026-07-15.")
            ],
        ),
    ):
        if event.is_final_response() and event.content:
            print("\n".join(part.text for part in event.content.parts if part.text))


if __name__ == "__main__":
    try:
        asyncio.run(asyncio.wait_for(main(), timeout=120))
    except (CloudUsageDisabled, ValueError, asyncio.TimeoutError) as error:
        raise SystemExit(str(error) or "The ADK smoke test timed out.") from None
