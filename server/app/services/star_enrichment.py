"""Baked star enrichment lookup (SIMBAD names/spectral + NASA exoplanet hosts).

Loads a static JSON produced by ``scripts/ingest_star_enrichment.py``, keyed by
Gaia DR3 source_id. Pure in-memory lookup — the request path never hits SIMBAD
or NASA. This is a hot service despite living under "enrichment": all external
work happened once, at ingest time.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from app.config import settings
from app.models.schemas import ExoplanetInfo, ObjectEnrichment

# The bake stores metadata (e.g. the "__source__" provenance block) alongside
# the source_id keys. Dunder-wrapped keys are reserved and never resolve as stars.
_RESERVED_KEY_PREFIX = "__"


class StarEnrichmentNotFoundError(FileNotFoundError):
    """Raised when the star enrichment JSON is missing at load time."""


@lru_cache(maxsize=4)
def load_catalog(path: Path | None = None) -> dict:
    """Load the baked enrichment map. Cached per path."""
    p = Path(path) if path is not None else settings.star_enrichment_path
    if not p.exists():
        raise StarEnrichmentNotFoundError(
            f"Star enrichment catalog not found at {p}. "
            f"Run: cd server && python scripts/ingest_star_enrichment.py"
        )
    with p.open(encoding="utf-8") as fh:
        return json.load(fh)


def enrichment_for(
    source_id: str, path: Path | None = None
) -> ObjectEnrichment | None:
    """Return enrichment for a Gaia DR3 source_id, or None if not catalogued."""
    if source_id.startswith(_RESERVED_KEY_PREFIX):
        return None

    raw = load_catalog(path).get(source_id)
    if raw is None:
        return None

    sources: list[str] = []
    if raw.get("name_source"):
        sources.append(raw["name_source"])

    planets = None
    planet_block = raw.get("planets")
    if planet_block and planet_block.get("count", 0) >= 1:
        planets = ExoplanetInfo(
            count=planet_block["count"],
            names=planet_block.get("names", []),
        )
        if raw.get("planet_source"):
            sources.append(raw["planet_source"])

    return ObjectEnrichment(
        source_id=source_id,
        proper_name=raw.get("proper_name"),
        designation=raw.get("designation"),
        catalog_ids=raw.get("catalog_ids", []),
        spectral_type=raw.get("spectral_type"),
        object_type=raw.get("object_type"),
        planets=planets,
        sources=sources,
    )
