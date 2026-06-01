import json
from pathlib import Path

from scripts.ingest_constellations import build_catalog, centroid_radec, parse_index, unique_hips

FIXTURE = Path(__file__).parent / "fixtures" / "constellations_index_minimal.json"


def _load():
    with FIXTURE.open(encoding="utf-8") as fh:
        return json.load(fh)


def test_parse_index_flattens_polylines_into_consecutive_pairs():
    parsed = parse_index(_load())
    assert len(parsed) == 2
    ori = next(c for c in parsed if c["id"] == "Ori")
    # [26727,26311,25336] -> (26727,26311),(26311,25336); [27989,26727] -> (27989,26727)
    assert ori["name"] == "Orion"
    assert ori["pairs"] == [(26727, 26311), (26311, 25336), (27989, 26727)]


def test_parse_index_handles_constellation_with_no_lines():
    index = {"constellations": [
        {"id": "CON western Tst", "lines": [], "common_name": {"english": "Test"}, "iau": "Tst"}
    ]}
    parsed = parse_index(index)
    assert parsed[0]["pairs"] == []
    assert unique_hips(parsed) == set()


def test_unique_hips_collects_all_referenced_stars():
    parsed = parse_index(_load())
    hips = unique_hips(parsed)
    assert hips == {26727, 26311, 25336, 27989, 11767, 85822, 82080}


def test_centroid_radec_handles_ra_wraparound():
    # Two stars straddling RA=0 (359 and 1 deg) -> centroid near 0, not 180.
    ra, dec = centroid_radec([(359.0, 0.0), (1.0, 0.0)])
    assert min(abs(ra - 0.0), abs(ra - 360.0)) < 1e-6
    assert abs(dec) < 1e-6


def test_build_catalog_maps_pairs_to_radec_segments():
    parsed = [{"id": "Tst", "name": "Test", "pairs": [(1, 2), (2, 3)]}]
    coords = {1: (10.0, 20.0), 2: (11.0, 21.0), 3: (12.0, 22.0)}
    out = build_catalog(parsed, coords)
    const = out["constellations"][0]
    assert const["id"] == "Tst"
    assert const["segments"][0] == {"from": [10.0, 20.0], "to": [11.0, 21.0]}
    assert len(const["segments"]) == 2
    assert "label" in const
    assert out["source"]["figures_license"] == "CC BY-SA 4.0"


def test_build_catalog_skips_segments_with_unresolved_hip():
    parsed = [{"id": "Tst", "name": "Test", "pairs": [(1, 2), (2, 99)]}]
    coords = {1: (10.0, 20.0), 2: (11.0, 21.0)}  # 99 missing
    out = build_catalog(parsed, coords)
    # Only the (1,2) segment survives; (2,99) is dropped.
    assert len(out["constellations"][0]["segments"]) == 1


def test_parse_index_skips_malformed_entry():
    index = {"constellations": [
        {"lines": [[1, 2]]},  # missing iau + common_name
        {"id": "CON western Tst", "lines": [[3, 4]], "common_name": {"english": "Test"}, "iau": "Tst"},
    ]}
    parsed = parse_index(index)
    assert len(parsed) == 1
    assert parsed[0]["id"] == "Tst"
