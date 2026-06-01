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
