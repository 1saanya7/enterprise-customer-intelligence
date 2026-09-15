from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_mode: str = "local"
    data_path: str = ".local/northstar-v2.sqlite3"
    bootstrap_password: str = ""
    session_ttl_seconds: int = 28800
    cookie_secure: bool = False
    login_limit: int = 10
    execution_limit: int = 20
    google_cloud_project: str = ""
    google_cloud_location: str = "us-central1"
    gemini_model: str = ""


@lru_cache
def settings() -> Settings:
    return Settings()
