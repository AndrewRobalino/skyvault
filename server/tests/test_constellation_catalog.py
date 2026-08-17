from pathlib import Path

import pytest

from app.services import constellation_catalog

FIXTURE = Path(__file__).parent / "fixtures" / "constellations_minimal.json"


@pytest.fixture(autouse=True)
def clear_cache():
    constellation_catalog.load_catalog.cache_clear()
    yield
    constellation_catalog.load_catalog.cache_clear()


def test_load_returns_source_and_constellations():
    data = constellation_catalog.load_catalog(FIXTURE)
    assert data["source"]["figures_license"] == "CC BY-SA 4.0"
    ids = {c["id"] for c in data["constellations"]}
    assert ids == {"Ori", "UMi"}


def test_missing_file_raises_actionable_error():
    with pytest.raises(constellation_catalog.ConstellationCatalogNotFoundError):
        constellation_catalog.load_catalog(Path("/no/such/constellations.json"))


def test_polaris_segment_visible_from_nyc():
    # Ursa Minor's segment includes Polaris (dec ~+89). From NYC (lat 40.7),
    # Polaris sits ~40 deg up year-round, so the UMi segment is visible.
    result = constellation_catalog.constellations_for_observer(
        lat=40.7128, lon=-74.0060, time_utc="2026-06-01T04:00:00Z",
        catalog_path=FIXTURE,
    )
    umi = next(c for c in result if c.id == "UMi")
    assert umi.segments[0].visible is True
    assert umi.label_alt > 0
    assert umi.label_visible is True


def test_polaris_below_horizon_from_southern_hemisphere():
    # From Buenos Aires (lat -34.6), Polaris (dec +89) never rises, so the
    # UMi segment endpoints are below the horizon -> segment not visible.
    result = constellation_catalog.constellations_for_observer(
        lat=-34.61, lon=-58.40, time_utc="2026-06-01T04:00:00Z",
        catalog_path=FIXTURE,
    )
    umi = next(c for c in result if c.id == "UMi")
    assert umi.segments[0].visible is False
    assert umi.label_visible is False


def test_response_shape_has_altaz_on_endpoints():
    # Orion is below the horizon at this UTC time; this checks response SHAPE only.
    result = constellation_catalog.constellations_for_observer(
        lat=40.7128, lon=-74.0060, time_utc="2026-06-01T04:00:00Z",
        catalog_path=FIXTURE,
    )
    ori = next(c for c in result if c.id == "Ori")
    seg = ori.segments[0]
    assert seg.from_alt is not None and seg.from_az is not None
    assert seg.to_alt is not None and seg.to_az is not None
    assert isinstance(seg.visible, bool)
