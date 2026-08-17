from scripts.ingest_star_enrichment import (
    format_bayer,
    build_name_fields,
    merge_enrichment,
)


def test_format_bayer_expands_greek_abbreviation():
    assert format_bayer("* alf Lyr") == "α Lyrae"
    assert format_bayer("* bet Ori") == "β Orionis"


def test_format_bayer_passthrough_when_no_greek():
    # Flamsteed-number designations have no Greek letter to expand.
    assert format_bayer("* 51 Peg") == "51 Pegasi"


def test_build_name_fields_picks_proper_name_and_designation():
    identifiers = [
        "NAME Vega",
        "* alf Lyr",
        "HD 172167",
        "HIP 91262",
        "TYC 3105-2070-1",
    ]
    proper, designation, catalog_ids = build_name_fields(identifiers)
    assert proper == "Vega"
    assert designation == "α Lyrae"
    assert catalog_ids == ["HD 172167", "HIP 91262"]


def test_build_name_fields_no_proper_name():
    identifiers = ["HD 999999", "* 12 Tau"]
    proper, designation, catalog_ids = build_name_fields(identifiers)
    assert proper is None
    assert designation == "12 Tauri"
    assert catalog_ids == ["HD 999999"]


def test_merge_enrichment_combines_simbad_and_planets():
    simbad = {
        "2835000000000000000": {
            "proper_name": "51 Pegasi",
            "designation": "51 Peg",
            "catalog_ids": ["HD 217014"],
            "spectral_type": "G2IV",
            "object_type": "High Proper Motion Star",
        }
    }
    planets = {"2835000000000000000": {"count": 1, "names": ["51 Peg b"]}}
    merged = merge_enrichment(simbad, planets)
    entry = merged["2835000000000000000"]
    assert entry["planets"] == {"count": 1, "names": ["51 Peg b"]}
    assert entry["name_source"] == "SIMBAD/CDS"
    assert entry["planet_source"] == "NASA Exoplanet Archive"


def test_merge_enrichment_star_without_planets_has_no_planet_source():
    simbad = {"4000000000000000000": {"proper_name": None, "spectral_type": "K0"}}
    merged = merge_enrichment(simbad, {})
    entry = merged["4000000000000000000"]
    assert entry["planets"] is None
    assert entry["planet_source"] is None
    assert entry["name_source"] == "SIMBAD/CDS"
