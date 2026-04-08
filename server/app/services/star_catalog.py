"""Gaia DR3 star catalog — loading and querying.

The catalog parquet is loaded **once** into a module-level DataFrame on first
access, then reused for every subsequent query. This keeps the render hot path
fast: all queries are in-memory pandas filters, no disk I/O.

Data source: ESA Gaia DR3, ingested via ``scripts/ingest_gaia.py``.

Phase 1 scope: magnitude filtering only. The ICRS -> AltAz transform and
proper-motion correction live in ``coordinates.py`` and compose on top of this.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

import pandas as pd

from app.config import settings


logger = logging.getLogger(__name__)

_catalog: pd.DataFrame | None = None


class CatalogNotIngestedError(RuntimeError):
    """Raised when the Gaia parquet is missing at load time."""


def _load_catalog(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise CatalogNotIngestedError(
            f"Gaia parquet not found at {path}. "
            f"Run `python scripts/ingest_gaia.py` to generate it."
        )

    started = time.perf_counter()
    df = pd.read_parquet(path, engine="pyarrow")
    elapsed_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "Loaded Gaia DR3 catalog: %s rows from %s in %.0f ms",
        f"{len(df):,}",
        path.name,
        elapsed_ms,
    )
    return df


def get_catalog() -> pd.DataFrame:
    """Return the in-memory Gaia catalog, loading it on first call."""
    global _catalog
    if _catalog is None:
        _catalog = _load_catalog(settings.gaia_parquet_path)
    return _catalog


def query_visible_stars(mag_limit: float | None = None) -> pd.DataFrame:
    """Return stars at or brighter than ``mag_limit`` (apparent G magnitude).

    Phase 1 is a magnitude filter only — no AltAz transform yet. The returned
    DataFrame is an independent copy so callers can mutate it freely without
    corrupting the cached catalog.
    """
    if mag_limit is None:
        mag_limit = settings.default_mag_limit

    catalog = get_catalog()
    mask = catalog["phot_g_mean_mag"] <= mag_limit
    return catalog.loc[mask].copy()
