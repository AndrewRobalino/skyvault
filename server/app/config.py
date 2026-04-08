"""Application configuration.

Centralizes paths, catalog parameters, and runtime settings. Values can be
overridden via environment variables (see .env.example).
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


SERVER_ROOT: Path = Path(__file__).resolve().parent.parent
DATA_DIR: Path = SERVER_ROOT / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # API
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:5173"]

    # Gaia catalog ingest
    gaia_mag_cutoff: float = 9.0
    gaia_parquet_path: Path = DATA_DIR / "gaia_dr3_g9.parquet"

    # Sky query defaults
    default_mag_limit: float = 6.5


settings = Settings()
