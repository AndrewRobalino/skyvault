import pandas as pd
import pytest

from app.services import star_catalog


@pytest.fixture(autouse=True)
def reset_catalog():
    star_catalog._catalog = None
    yield
    star_catalog._catalog = None


@pytest.fixture
def two_catalogs(tmp_path, monkeypatch):
    gaia = pd.DataFrame(
        [{"source_id": 1576683529448755328, "ra": 193.5, "dec": 55.9,
          "pmra": 1.0, "pmdec": 1.0, "parallax": 40.0,
          "phot_g_mean_mag": 1.73, "bp_rp": 0.02}]
    )
    bright = pd.DataFrame(
        [{"source_id": "hip:32349", "ra": 101.28, "dec": -16.71,
          "pmra": -546.0, "pmdec": -1223.0, "parallax": 379.21,
          "phot_g_mean_mag": -1.46, "bp_rp": 0.0,
          "epoch": "J1991.25", "source": "ESA Hipparcos",
          "magnitude_source": "derived", "color_source": "derived"}]
    )
    gaia_path = tmp_path / "gaia.parquet"
    bright_path = tmp_path / "bright.parquet"
    gaia.to_parquet(gaia_path, engine="pyarrow", index=False)
    bright.to_parquet(bright_path, engine="pyarrow", index=False)

    monkeypatch.setattr(star_catalog.settings, "gaia_parquet_path", gaia_path)
    monkeypatch.setattr(star_catalog.settings, "bright_stars_parquet_path", bright_path)
    return gaia_path, bright_path


def test_catalog_contains_both_sources(two_catalogs):
    df = star_catalog.get_catalog()
    assert len(df) == 2
    assert set(df["source_id"]) == {"1576683529448755328", "hip:32349"}


def test_source_id_is_string_dtype_throughout(two_catalogs):
    """Gaia ids are int64 on disk and exceed JS MAX_SAFE_INTEGER; the merged
    frame must be strings so the two catalogs concatenate cleanly."""
    df = star_catalog.get_catalog()
    assert all(isinstance(s, str) for s in df["source_id"])


def test_gaia_rows_get_the_default_epoch(two_catalogs):
    df = star_catalog.get_catalog()
    gaia_row = df[df["source_id"] == "1576683529448755328"].iloc[0]
    assert gaia_row["epoch"] == "J2016.0"
    assert gaia_row["source"] == "Gaia DR3"


def test_bright_rows_keep_their_own_epoch_and_source(two_catalogs):
    df = star_catalog.get_catalog()
    hip_row = df[df["source_id"] == "hip:32349"].iloc[0]
    assert hip_row["epoch"] == "J1991.25"
    assert hip_row["source"] == "ESA Hipparcos"


def test_magnitude_filter_spans_both_catalogs(two_catalogs):
    visible = star_catalog.query_visible_stars(mag_limit=0.0)
    # Only Sirius at G = -1.46 is brighter than 0.0.
    assert list(visible["source_id"]) == ["hip:32349"]


def test_missing_bright_parquet_raises_actionable_error(two_catalogs, monkeypatch):
    from pathlib import Path

    monkeypatch.setattr(
        star_catalog.settings, "bright_stars_parquet_path", Path("does/not/exist.parquet")
    )
    with pytest.raises(star_catalog.CatalogNotIngestedError) as exc:
        star_catalog.get_catalog()
    assert "ingest_bright_stars" in str(exc.value)


def test_concurrent_first_requests_load_the_catalog_once(two_catalogs, monkeypatch):
    # Routes run in FastAPI's threadpool, so two cold requests can race into
    # get_catalog(). Each load is a full parquet read; only one should happen.
    import threading
    import time

    calls = []
    real_load = star_catalog._load_catalog

    def slow_load(path):
        calls.append(path)
        time.sleep(0.2)
        return real_load(path)

    monkeypatch.setattr(star_catalog, "_load_catalog", slow_load)
    threads = [threading.Thread(target=star_catalog.get_catalog) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(calls) == 1
