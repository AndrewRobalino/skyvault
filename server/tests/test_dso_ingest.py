from unittest.mock import MagicMock

import numpy as np
import numpy.ma as ma

from scripts.ingest_dso import parse_simbad_row, CURATED


def test_parse_simbad_row_galaxy():
    # Simulated astroquery row -- it's a dict-like with keys we depend on.
    row = {
        "MAIN_ID": b"M  31",
        "RA": "00 42 44.330",
        "DEC": "+41 16 07.50",
        "FLUX_V": 3.44,
        "GALDIM_MAJAXIS": 178.0,
        "GALDIM_MINAXIS": 63.0,
        "GALDIM_ANGLE": 35.0,
        "OTYPE": b"GiG",
    }
    spec = next(s for s in CURATED if s["id"] == "M31")
    out = parse_simbad_row(spec, row)
    assert out["id"] == "M31"
    assert out["type"] == "galaxy"
    assert out["magnitude"] == 3.44
    assert abs(out["ra"] - 10.6847) < 0.01
    assert abs(out["dec"] - 41.2687) < 0.01
    assert out["angular_size_arcmin"] == 178.0
    assert out["minor_axis_arcmin"] == 63.0
    assert out["position_angle_deg"] == 35.0


def test_parse_simbad_row_open_cluster_no_minor_axis():
    row = {
        "MAIN_ID": b"M  45",
        "RA": "03 47 00",
        "DEC": "+24 07 00",
        "FLUX_V": 1.6,
        "GALDIM_MAJAXIS": 110.0,
        "GALDIM_MINAXIS": None,
        "GALDIM_ANGLE": None,
        "OTYPE": b"OpC",
    }
    spec = next(s for s in CURATED if s["id"] == "M45")
    out = parse_simbad_row(spec, row)
    assert out["type"] == "open_cluster"
    assert out["minor_axis_arcmin"] is None
    assert out["position_angle_deg"] is None


def test_curated_list_is_25_objects():
    assert len(CURATED) == 25
    assert len({s["id"] for s in CURATED}) == 25, "ids must be unique"


def test_parse_simbad_row_string_otype():
    """OTYPE may come as a string (not bytes) — must not crash."""
    row = {
        "MAIN_ID": "M  31",
        "RA": "00 42 44.330",
        "DEC": "+41 16 07.50",
        "FLUX_V": 3.44,
        "GALDIM_MAJAXIS": 178.0,
        "GALDIM_MINAXIS": 63.0,
        "GALDIM_ANGLE": 35.0,
        "OTYPE": "G",
    }
    spec = next(s for s in CURATED if s["id"] == "M31")
    out = parse_simbad_row(spec, row)
    assert out["type"] == "galaxy"


def test_parse_simbad_row_unknown_otype_falls_back_to_spec_type():
    """If SIMBAD returns an OTYPE we don't recognize, use the curated type."""
    row = {
        "MAIN_ID": b"???",
        "RA": "00 00 00",
        "DEC": "+00 00 00",
        "FLUX_V": 5.0,
        "GALDIM_MAJAXIS": 50.0,
        "GALDIM_MINAXIS": None,
        "GALDIM_ANGLE": None,
        "OTYPE": b"XYZ",
    }
    spec = next(s for s in CURATED if s["id"] == "M67")  # open_cluster
    out = parse_simbad_row(spec, row)
    assert out["type"] == "open_cluster"


def test_parse_simbad_row_masked_magnitude_returns_none():
    """SIMBAD may return a numpy masked value (not Python None) for missing fields."""
    masked_mag = ma.masked
    row = {
        "MAIN_ID": b"NGC  ?",
        "RA": "12 00 00",
        "DEC": "+00 00 00",
        "FLUX_V": masked_mag,
        "GALDIM_MAJAXIS": 30.0,
        "GALDIM_MINAXIS": ma.masked,
        "GALDIM_ANGLE": np.nan,
        "OTYPE": b"G",
    }
    spec = next(s for s in CURATED if s["id"] == "M31")
    out = parse_simbad_row(spec, row)
    assert out["magnitude"] is None, "Masked FLUX_V must become None"
    assert out["minor_axis_arcmin"] is None, "Masked GALDIM_MINAXIS must become None"
    assert out["position_angle_deg"] is None, "NaN GALDIM_ANGLE must become None"
    assert out["angular_size_arcmin"] == 30.0
