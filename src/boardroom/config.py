"""Configuration loaded once from the environment / .env file.

Anywhere you need a key or model name:

    from boardroom.config import settings
    print(settings.openai_model)
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Field names map to UPPERCASE env vars (case-insensitive),
    # read from the .env file in the project root.
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"


# One shared instance imported across the project.
settings = Settings()
