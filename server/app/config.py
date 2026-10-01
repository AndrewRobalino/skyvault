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
    # Preview deploys: https://<hash>.skyvault.pages.dev
    cors_origin_regex: str | None = None

    # Rate limits (spec §4.2), per client IP per minute
    rate_limit_data_per_min: int = 120
    rate_limit_geocode_per_min: int = 20

    # Behind Cloud Run the TCP peer is Google's front end; the client IP is in
    # X-Forwarded-For. Off locally. forwarded_for_index counts from the right
    # (-1 = rightmost) and is verified against the live service (plan Task 15).
    trust_forwarded_for: bool = False
    forwarded_for_index: int = -1
    log_forwarded_for: bool = False

    # Gaia catalog ingest
    gaia_mag_cutoff: float = 9.0
    gaia_parquet_path: Path = DATA_DIR / "gaia_dr3_g9.parquet"

    # Bright-star supplement — the stars Gaia DR3 saturates on
    # (produced once via scripts/ingest_bright_stars.py)
    bright_stars_parquet_path: Path = DATA_DIR / "bright_stars.parquet"

    # JPL DE421 planetary ephemeris (downloaded once via download_ephemeris.py)
    ephemeris_kernel_path: Path = DATA_DIR / "de421.bsp"

    # Naked-eye DSO catalog (produced once via scripts/ingest_dso.py)
    dso_catalog_path: Path = DATA_DIR / "naked_eye_dso.json"

    # Constellation figures catalog (produced once via scripts/ingest_constellations.py)
    constellations_catalog_path: Path = DATA_DIR / "constellations.json"

    # Star enrichment catalog (produced once via scripts/ingest_star_enrichment.py)
    star_enrichment_path: Path = DATA_DIR / "star_enrichment.json"

    # Sky query defaults
    default_mag_limit: float = 6.5


settings = Settings()
