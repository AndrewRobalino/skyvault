"""Star catalog — Gaia DR3 plus the Hipparcos bright-star supplement.

The catalog parquet is loaded **once** into a module-level DataFrame on first
access, then reused for every subsequent query. This keeps the render hot path
fast: all queries are in-memory pandas filters, no disk I/O.

Data sources: ESA Gaia DR3, ingested via ``scripts/ingest_gaia.py``, and the
stars Gaia saturates on (G < ~2.7) from ESA Hipparcos, baked by
``scripts/ingest_bright_stars.py``. The two are concatenated once at load.

Phase 1 scope: magnitude filtering only. The ICRS -> AltAz transform and
proper-motion correction live in ``coordinates.py`` and compose on top of this.
"""

from __future__ import annotations

import logging
import threading
import time
from pathlib import Path

import pandas as pd

from app.config import settings


logger = logging.getLogger(__name__)

_catalog: pd.DataFrame | None = None
# Routes run in FastAPI's threadpool; the lock keeps two cold requests from
# each reading the parquet.
_catalog_lock = threading.Lock()

# Catalog reference epochs. Gaia rows carry no epoch column of their own.
GAIA_EPOCH = "J2016.0"
GAIA_SOURCE = "Gaia DR3"


class CatalogNotIngestedError(RuntimeError):
    """Raised when a catalog parquet is missing at load time."""


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


def _load_bright_stars(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise CatalogNotIngestedError(
            f"Bright-star supplement not found at {path}. "
            f"Run `python -m scripts.ingest_bright_stars` to generate it."
        )
    df = pd.read_parquet(path, engine="pyarrow")
    logger.info("Loaded bright-star supplement: %s rows", f"{len(df):,}")
    return df


def _merge_catalogs(gaia: pd.DataFrame, bright: pd.DataFrame) -> pd.DataFrame:
    """Concatenate the Gaia catalog with the bright-star supplement.

    Gaia source_ids are int64 on disk and exceed JS MAX_SAFE_INTEGER, so both
    frames are cast to string before concatenation — otherwise the mixed column
    lands as object dtype with ints still inside it.

    The supplement is already deduped against Gaia at ingest time
    (scripts/ingest_bright_stars.py), so no dedupe happens here.
    """
    gaia = gaia.copy()
    gaia["source_id"] = gaia["source_id"].astype(str)
    gaia["epoch"] = GAIA_EPOCH
    gaia["source"] = GAIA_SOURCE

    bright = bright.copy()
    bright["source_id"] = bright["source_id"].astype(str)

    return pd.concat([gaia, bright], ignore_index=True, sort=False)


def get_catalog() -> pd.DataFrame:
    """Return the in-memory star catalog, loading and merging on first call."""
    global _catalog
    if _catalog is None:
        with _catalog_lock:
            if _catalog is None:
                gaia = _load_catalog(settings.gaia_parquet_path)
                bright = _load_bright_stars(settings.bright_stars_parquet_path)
                _catalog = _merge_catalogs(gaia, bright)
                logger.info("Merged star catalog: %s rows", f"{len(_catalog):,}")
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
