import pytest

from scripts.ingest_bright_stars import (
    bp_rp_from_v_i,
    build_star_row,
    gaia_g_from_v_bv,
    hip_source_id,
    select_missing,
)


def test_g_from_v_bv_at_zero_color():
    # G - V = c0 when B-V = 0, so G = V + c0 = 5.0 + (-0.04749)
    assert gaia_g_from_v_bv(5.0, 0.0) == pytest.approx(4.95251, abs=1e-5)


def test_g_from_v_bv_at_unit_color():
    # G - V = -0.04749 - 0.0124 - 0.2901 + 0.02008 = -0.32991
    assert gaia_g_from_v_bv(5.0, 1.0) == pytest.approx(4.67009, abs=1e-5)


def test_g_from_v_bv_is_always_brighter_than_v_for_red_stars():
    # Gaia's G band is broad and red-sensitive: a red star is brighter in G.
    assert gaia_g_from_v_bv(2.0, 1.5) < 2.0


def test_g_from_v_bv_returns_none_outside_valid_color_range():
    # Table 5.7 states the relation holds for -0.4 < B-V < 3.3.
    assert gaia_g_from_v_bv(5.0, 4.0) is None
    assert gaia_g_from_v_bv(5.0, -1.0) is None


def test_g_from_v_bv_returns_none_without_color():
    assert gaia_g_from_v_bv(5.0, None) is None


def test_bp_rp_at_zero_color():
    assert bp_rp_from_v_i(0.0) == pytest.approx(-0.03298, abs=1e-5)


def test_bp_rp_at_unit_color():
    # -0.03298 + 1.259 - 0.1279 + 0.01631 = 1.11443
    assert bp_rp_from_v_i(1.0) == pytest.approx(1.11443, abs=1e-5)


def test_bp_rp_increases_with_v_i():
    assert bp_rp_from_v_i(0.5) < bp_rp_from_v_i(1.5)


def test_bp_rp_returns_none_outside_valid_range():
    # Table 5.7 states the relation holds for -0.4 < V-I < 5.0.
    assert bp_rp_from_v_i(6.0) is None
    assert bp_rp_from_v_i(-1.0) is None


def test_bp_rp_returns_none_without_color():
    assert bp_rp_from_v_i(None) is None


def test_hip_source_id_is_prefixed():
    assert hip_source_id(91262) == "hip:91262"


def test_build_star_row_maps_to_gaia_column_names():
    row = build_star_row(
        {"HIP": 91262, "RAICRS": 279.234, "DEICRS": 38.783, "Vmag": 0.03,
         "B-V": 0.0, "V-I": 0.0, "Plx": 130.23, "pmRA": 200.94, "pmDE": 286.23}
    )
    # coordinates.py consumes ra/dec/pmra/pmdec/parallax by these exact names.
    assert row["source_id"] == "hip:91262"
    assert row["ra"] == pytest.approx(279.234)
    assert row["dec"] == pytest.approx(38.783)
    assert row["pmra"] == pytest.approx(200.94)
    assert row["pmdec"] == pytest.approx(286.23)
    assert row["parallax"] == pytest.approx(130.23)
    assert row["epoch"] == "J1991.25"
    assert row["source"] == "ESA Hipparcos"


def test_build_star_row_derives_photometry_with_provenance():
    row = build_star_row(
        {"HIP": 1, "RAICRS": 0.0, "DEICRS": 0.0, "Vmag": 5.0,
         "B-V": 0.0, "V-I": 0.0, "Plx": 10.0, "pmRA": 0.0, "pmDE": 0.0}
    )
    assert row["phot_g_mean_mag"] == pytest.approx(4.95251, abs=1e-5)
    assert row["bp_rp"] == pytest.approx(-0.03298, abs=1e-5)
    assert "Riello" in row["magnitude_source"]
    assert "Riello" in row["color_source"]


def test_build_star_row_rejects_star_without_derivable_magnitude():
    # No B-V means no G, and the renderer sizes stars by G. Drop it rather than
    # invent a magnitude.
    row = build_star_row(
        {"HIP": 2, "RAICRS": 0.0, "DEICRS": 0.0, "Vmag": 5.0,
         "B-V": None, "V-I": 0.5, "Plx": 10.0, "pmRA": 0.0, "pmDE": 0.0}
    )
    assert row is None


def test_build_star_row_allows_missing_color():
    # Color is optional — the renderer has a neutral fallback. Magnitude is not.
    row = build_star_row(
        {"HIP": 3, "RAICRS": 0.0, "DEICRS": 0.0, "Vmag": 5.0,
         "B-V": 0.5, "V-I": None, "Plx": 10.0, "pmRA": 0.0, "pmDE": 0.0}
    )
    assert row is not None
    assert row["bp_rp"] is None
    assert row["color_source"] is None


def test_select_missing_drops_stars_gaia_already_has():
    records = [
        {"HIP": 100, "RAICRS": 1.0, "DEICRS": 1.0, "Vmag": 2.0, "B-V": 0.0,
         "V-I": 0.0, "Plx": 10.0, "pmRA": 0.0, "pmDE": 0.0},
        {"HIP": 200, "RAICRS": 2.0, "DEICRS": 2.0, "Vmag": 2.0, "B-V": 0.0,
         "V-I": 0.0, "Plx": 10.0, "pmRA": 0.0, "pmDE": 0.0},
    ]
    hip_to_gaia = {"100": "555000000000000000"}   # HIP 100 is in Gaia
    gaia_ids = {"555000000000000000"}

    kept = select_missing(records, hip_to_gaia, gaia_ids)

    assert [r["source_id"] for r in kept] == ["hip:200"]


def test_select_missing_keeps_star_whose_gaia_id_is_outside_our_subset():
    # SIMBAD knows a Gaia id, but that source is not in our G<9 parquet
    # (bright stars often have null phot_g_mean_mag) — so we still need it.
    records = [
        {"HIP": 300, "RAICRS": 3.0, "DEICRS": 3.0, "Vmag": 1.0, "B-V": 0.0,
         "V-I": 0.0, "Plx": 10.0, "pmRA": 0.0, "pmDE": 0.0},
    ]
    kept = select_missing(records, {"300": "999000000000000000"}, set())
    assert [r["source_id"] for r in kept] == ["hip:300"]
