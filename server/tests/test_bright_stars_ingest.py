import pandas as pd
import pytest

from scripts.ingest_bright_stars import (
    assert_no_gaia_twins,
    bp_rp_from_v_i,
    build_star_row,
    drop_positional_duplicates,
    gaia_g_from_v_bv,
    hip_source_id,
    propagate_to_gaia_epoch,
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


def test_build_star_row_rejects_star_without_astrometry():
    # A few hundred Hipparcos entries have no astrometric solution. No position
    # means nothing to draw.
    row = build_star_row(
        {"HIP": 4, "RAICRS": None, "DEICRS": None, "Vmag": 5.0,
         "B-V": 0.5, "V-I": 0.5, "Plx": None, "pmRA": None, "pmDE": None}
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


def _row(source_id, ra, dec, g, pmra=0.0, pmdec=0.0):
    return {"source_id": source_id, "ra": ra, "dec": dec, "pmra": pmra,
            "pmdec": pmdec, "phot_g_mean_mag": g}


def _gaia(*stars):
    return pd.DataFrame(
        [{"ra": ra, "dec": dec, "phot_g_mean_mag": g} for ra, dec, g in stars]
    )


ARCSEC = 1 / 3600


def test_propagate_to_gaia_epoch_applies_24_75_years_of_proper_motion():
    # 1000 mas/yr in Dec over J1991.25 -> J2016.0 = 24.75 arcsec north.
    ra, dec = propagate_to_gaia_epoch(10.0, 0.0, 0.0, 1000.0)
    assert ra == pytest.approx(10.0)
    assert dec == pytest.approx(24.75 * ARCSEC, abs=1e-9)


def test_propagate_treats_missing_proper_motion_as_zero():
    assert propagate_to_gaia_epoch(10.0, 5.0, None, None) == (10.0, 5.0)


def test_positional_dedupe_drops_star_gaia_already_has():
    # SIMBAD often links only a Gaia DR2 id, so pass 1 misses these. Same spot,
    # derived G slightly brighter (Hipparcos V is combined light).
    rows = [_row("hip:25", 10.0, 20.0, 6.06)]
    gaia = _gaia((10.0, 20.0 + 0.2 * ARCSEC, 6.10))
    assert drop_positional_duplicates(rows, gaia) == []


def test_positional_dedupe_uses_proper_motion():
    # 20 arcsec apart at J1991.25, coincident at J2016.0.
    pmdec = 20_000 / 24.75  # mas/yr
    rows = [_row("hip:1", 10.0, 0.0, 5.0, pmdec=pmdec)]
    gaia = _gaia((10.0, 20 * ARCSEC, 5.0))
    assert drop_positional_duplicates(rows, gaia) == []


def test_positional_dedupe_keeps_bright_star_next_to_faint_neighbour():
    # Sirius-like: saturated in Gaia, an unrelated G = 8.5 star 2 arcsec away.
    rows = [_row("hip:32349", 101.0, -16.0, -1.49)]
    gaia = _gaia((101.0, -16.0 + 2 * ARCSEC, 8.5))
    assert [r["source_id"] for r in drop_positional_duplicates(rows, gaia)] == ["hip:32349"]


def test_positional_dedupe_keeps_wide_binary_beyond_radius():
    # Castor-like: Gaia has one component 5.4 arcsec away. The eye sees the
    # combined light, so the Hipparcos star stays.
    rows = [_row("hip:36850", 113.6, 31.9, 1.53)]
    gaia = _gaia((113.6, 31.9 + 5.4 * ARCSEC, 2.92))
    assert len(drop_positional_duplicates(rows, gaia)) == 1


def test_positional_dedupe_drops_close_binary_inside_radius():
    # Gaia resolved a 2.3 arcsec pair; its component wins (spec: Gaia astrometry wins).
    rows = [_row("hip:88601", 271.4, 2.5, 3.77)]
    gaia = _gaia((271.4, 2.5 + 2.3 * ARCSEC, 3.99))
    assert drop_positional_duplicates(rows, gaia) == []


def test_no_gaia_twins_guard_raises_on_a_leftover_duplicate():
    rows = [_row("hip:7", 50.0, 50.0, 6.0)]
    gaia = _gaia((50.0, 50.0 + 0.5 * ARCSEC, 7.9))
    with pytest.raises(RuntimeError, match="hip:7"):
        assert_no_gaia_twins(rows, gaia)


def test_no_gaia_twins_guard_passes_clean_rows():
    rows = [_row("hip:8", 50.0, 50.0, 1.0)]
    gaia = _gaia((50.0, 50.0 + 10 * ARCSEC, 8.0))
    assert_no_gaia_twins(rows, gaia)


@pytest.mark.network
def test_hipparcos_fetch_returns_the_expected_columns():
    from scripts.ingest_bright_stars import HIP_COLUMNS, fetch_hipparcos

    records = fetch_hipparcos(mag_limit=2.0)
    assert len(records) > 20, "V <= 2.0 should yield dozens of stars"
    assert set(HIP_COLUMNS).issubset(records[0].keys())


@pytest.mark.network
def test_hip_to_gaia_resolves_a_known_star():
    from scripts.ingest_bright_stars import fetch_hip_to_gaia

    # Not Vega: Gaia saturates on it, so SIMBAD has no Gaia id for it at all.
    # HIP 1 is an ordinary G ~ 9 star with a verified DR3 link.
    mapping = fetch_hip_to_gaia(["1", "91262"])
    assert mapping["1"] == "2738327528519591936"
    assert "91262" not in mapping
