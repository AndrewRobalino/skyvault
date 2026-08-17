from __future__ import annotations

from app.models.schemas import (
    Constellation,
    ConstellationSegment,
    ConstellationsResponse,
    Observer,
)


def test_segment_carries_both_endpoints_altaz_and_visible():
    seg = ConstellationSegment(
        from_alt=10.0, from_az=20.0, to_alt=12.0, to_az=25.0, visible=True
    )
    assert seg.visible is True
    assert seg.from_alt == 10.0
    assert seg.from_az == 20.0
    assert seg.to_alt == 12.0
    assert seg.to_az == 25.0


def test_constellation_groups_segments_and_label():
    c = Constellation(
        id="Ori",
        name="Orion",
        segments=[
            ConstellationSegment(
                from_alt=10.0, from_az=20.0, to_alt=12.0, to_az=25.0, visible=True
            )
        ],
        label_alt=11.0,
        label_az=22.0,
        label_visible=True,
    )
    assert c.id == "Ori"
    assert len(c.segments) == 1
    assert c.label_alt == 11.0
    assert c.label_az == 22.0
    assert c.label_visible is True


def test_constellation_allows_empty_segments():
    c = Constellation(
        id="X",
        name="X",
        segments=[],
        label_alt=0.0,
        label_az=0.0,
        label_visible=False,
    )
    assert c.segments == []


def test_response_includes_source_block():
    resp = ConstellationsResponse(
        observer=Observer(lat=0.0, lon=0.0, datetime="2026-06-01T00:00:00Z"),
        constellations=[],
        count=0,
        source={"figures": "Stellarium Western sky culture"},
    )
    assert resp.source["figures"].startswith("Stellarium")
