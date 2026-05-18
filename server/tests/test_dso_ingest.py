import numpy as np
import numpy.ma as ma

from scripts.ingest_dso import parse_simbad_row, CURATED, _is_missing


def test_parse_simbad_row_galaxy_with_simbad_magnitude():
    row = {
        "main_id": "M  31",
        "ra": 10.6847,
        "dec": 41.2687,
        "V": 3.44,
        "galdim_majaxis": 178.0,
        "galdim_minaxis": 63.0,
        "galdim_angle": 35.0,
        "otype": "AGN",
    }
    spec = next(s for s in CURATED if s["id"] == "M31")
    out = parse_simbad_row(spec, row)
    assert out["id"] == "M31"
    assert out["type"] == "galaxy"
    assert out["magnitude"] == 3.44
    assert out["magnitude_source"] == "SIMBAD"
    assert out["ra"] == 10.6847
    assert out["dec"] == 41.2687
    assert out["angular_size_arcmin"] == 178.0
    assert out["minor_axis_arcmin"] == 63.0
    assert out["position_angle_deg"] == 35.0


def test_parse_simbad_row_diffuse_uses_reference_magnitude():
    """Orion Nebula has no V in SIMBAD -- fall back to magnitude_fallback."""
    row = {
        "main_id": "M  42",
        "ra": 83.8201,
        "dec": -5.3876,
        "V": ma.masked,
        "galdim_majaxis": 66.0,
        "galdim_minaxis": 66.0,
        "galdim_angle": 90,
        "otype": "HII",
    }
    spec = next(s for s in CURATED if s["id"] == "M42")
    out = parse_simbad_row(spec, row)
    assert out["type"] == "nebula"
    assert out["magnitude"] == spec["magnitude_fallback"]
    assert out["magnitude_source"] == "reference"


def test_parse_simbad_row_open_cluster_no_minor_axis():
    row = {
        "main_id": "Cl Melotte   22",
        "ra": 56.65,
        "dec": 24.17,
        "V": ma.masked,
        "galdim_majaxis": 110.0,
        "galdim_minaxis": ma.masked,
        "galdim_angle": ma.masked,
        "otype": "OpC",
    }
    spec = next(s for s in CURATED if s["id"] == "M45")
    out = parse_simbad_row(spec, row)
    assert out["type"] == "open_cluster"
    assert out["magnitude"] == spec["magnitude_fallback"]
    assert out["magnitude_source"] == "reference"
    assert out["minor_axis_arcmin"] is None
    assert out["position_angle_deg"] is None


def test_parse_simbad_row_unknown_otype_falls_back_to_spec_type():
    row = {
        "main_id": "?",
        "ra": 0.0,
        "dec": 0.0,
        "V": 5.0,
        "galdim_majaxis": 50.0,
        "galdim_minaxis": None,
        "galdim_angle": None,
        "otype": "XYZ",
    }
    spec = next(s for s in CURATED if s["id"] == "M67")
    out = parse_simbad_row(spec, row)
    assert out["type"] == "open_cluster"


def test_curated_list_is_25_objects():
    assert len(CURATED) == 25
    assert len({s["id"] for s in CURATED}) == 25
    # Every entry must have a magnitude_fallback
    for spec in CURATED:
        assert "magnitude_fallback" in spec
        assert isinstance(spec["magnitude_fallback"], (int, float))
