from pathlib import Path

import pytest

from app.services import star_enrichment

FIXTURE = Path(__file__).parent / "fixtures" / "star_enrichment_minimal.json"


@pytest.fixture(autouse=True)
def clear_cache():
    star_enrichment.load_catalog.cache_clear()
    yield
    star_enrichment.load_catalog.cache_clear()


def test_load_returns_all_entries():
    data = star_enrichment.load_catalog(FIXTURE)
    assert len(data) == 3


def test_enrichment_for_named_star():
    e = star_enrichment.enrichment_for("2667000000000000000", FIXTURE)
    assert e is not None
    assert e.proper_name == "Vega"
    assert e.designation == "α Lyrae"
    assert e.spectral_type == "A0Va"
    assert e.planets is None  # count 0 -> no host info
    assert e.sources == ["SIMBAD/CDS"]


def test_enrichment_for_host_star():
    e = star_enrichment.enrichment_for("2835000000000000000", FIXTURE)
    assert e.planets is not None
    assert e.planets.count == 1
    assert e.planets.names == ["51 Peg b"]
    assert e.sources == ["SIMBAD/CDS", "NASA Exoplanet Archive"]


def test_enrichment_for_anonymous_star():
    e = star_enrichment.enrichment_for("4000000000000000000", FIXTURE)
    assert e.proper_name is None
    assert e.spectral_type == "K0"
    assert e.catalog_ids == ["HD 999999"]


def test_enrichment_for_unknown_returns_none():
    assert star_enrichment.enrichment_for("9999999999999999999", FIXTURE) is None


def test_provenance_key_is_not_a_lookupable_object():
    """The bake stores a ``__source__`` provenance block alongside id keys.

    It is not a star, so it must never resolve as one.
    """
    assert star_enrichment.enrichment_for("__source__", FIXTURE) is None


def test_missing_catalog_raises():
    with pytest.raises(star_enrichment.StarEnrichmentNotFoundError):
        star_enrichment.load_catalog(Path("does/not/exist.json"))
