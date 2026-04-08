"""Tests for the Gaia DR3 star catalog service.

These tests hit the real parquet on disk. If the parquet is missing, they skip
with a clear message — never mock catalog data, per project guardrails.
"""

from __future__ import annotations

import pandas as pd
import pytest

from app.config import settings
from app.services import star_catalog


pytestmark = pytest.mark.skipif(
    not settings.gaia_parquet_path.exists(),
    reason=(
        f"Gaia parquet not found at {settings.gaia_parquet_path}. "
        f"Run `python scripts/ingest_gaia.py` first."
    ),
)


EXPECTED_COLUMNS = {
    "source_id",
    "ra",
    "dec",
    "pmra",
    "pmdec",
    "parallax",
    "parallax_error",
    "phot_g_mean_mag",
    "phot_bp_mean_mag",
    "phot_rp_mean_mag",
    "bp_rp",
    "radial_velocity",
    "teff_gspphot",
    "ruwe",
}


def test_catalog_loads_nonempty_dataframe():
    df = star_catalog.get_catalog()
    assert isinstance(df, pd.DataFrame)
    assert len(df) > 0


def test_catalog_has_expected_columns():
    df = star_catalog.get_catalog()
    missing = EXPECTED_COLUMNS - set(df.columns)
    assert not missing, f"Missing expected Gaia columns: {missing}"


def test_catalog_respects_ingest_cutoff():
    df = star_catalog.get_catalog()
    assert df["phot_g_mean_mag"].max() < settings.gaia_mag_cutoff


def test_catalog_row_count_is_reasonable():
    # Sanity range for G<9. The exact count varies slightly with Gaia releases,
    # but anything far outside this band means the ingest or cutoff broke.
    df = star_catalog.get_catalog()
    assert 100_000 < len(df) < 300_000


def test_ra_dec_ranges_are_valid():
    df = star_catalog.get_catalog()
    assert df["ra"].min() >= 0.0
    assert df["ra"].max() <= 360.0
    assert df["dec"].min() >= -90.0
    assert df["dec"].max() <= 90.0


def test_query_visible_stars_applies_magnitude_filter():
    naked_eye = star_catalog.query_visible_stars(mag_limit=6.5)
    binocular = star_catalog.query_visible_stars(mag_limit=8.0)

    # Magnitude filter: fainter limit -> strictly more stars.
    assert len(naked_eye) < len(binocular)
    assert naked_eye["phot_g_mean_mag"].max() <= 6.5
    assert binocular["phot_g_mean_mag"].max() <= 8.0


def test_query_visible_stars_returns_copy_not_view():
    # The returned DataFrame should be safe to mutate without corrupting the
    # cached catalog.
    result = star_catalog.query_visible_stars(mag_limit=6.5)
    original_len = len(star_catalog.get_catalog())
    result.drop(result.index, inplace=True)
    assert len(star_catalog.get_catalog()) == original_len
