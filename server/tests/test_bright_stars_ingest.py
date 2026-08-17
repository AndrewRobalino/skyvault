import pytest

from scripts.ingest_bright_stars import (
    bp_rp_from_v_i,
    gaia_g_from_v_bv,
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
