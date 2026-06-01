import json
from pathlib import Path

from scripts.ingest_constellations import parse_index, unique_hips

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
