"""Exoplanet host cross-match — pure aggregation over pscomppars rows."""

from app.services.enrichment.exoplanet_archive import hosts_from_rows


def _row(pl_name, gaia_dr3_id="", hip_name=""):
    return {"pl_name": pl_name, "gaia_dr3_id": gaia_dr3_id, "hip_name": hip_name}


def test_matches_gaia_hosts_by_dr3_id():
    rows = [_row("HD 1 b", gaia_dr3_id="Gaia DR3 111")]
    assert hosts_from_rows(rows, {"111"}) == {"111": {"count": 1, "names": ["HD 1 b"]}}


def test_matches_supplement_hosts_by_hip_name():
    # Pollux: the archive has no Gaia DR3 id for it (Gaia saturates), and it is
    # rendered from the Hipparcos supplement as hip:37826.
    rows = [_row("HD 62509 b", hip_name="HIP 37826")]
    hosts = hosts_from_rows(rows, set(), {"37826"})
    assert hosts == {"hip:37826": {"count": 1, "names": ["HD 62509 b"]}}


def test_hip_match_ignored_for_stars_not_in_the_supplement():
    rows = [_row("HD 2 b", hip_name="HIP 999")]
    assert hosts_from_rows(rows, set(), {"37826"}) == {}


def test_gaia_id_wins_over_hip_name():
    # A host we render from Gaia must key on its Gaia id, never also on hip:.
    rows = [_row("HD 3 b", gaia_dr3_id="Gaia DR3 333", hip_name="HIP 3")]
    assert set(hosts_from_rows(rows, {"333"}, {"3"})) == {"333"}


def test_counts_distinct_planets_sorted():
    rows = [_row("X c", hip_name="HIP 5"), _row("X b", hip_name="HIP 5"),
            _row("X b", hip_name="HIP 5")]
    assert hosts_from_rows(rows, set(), {"5"}) == {
        "hip:5": {"count": 2, "names": ["X b", "X c"]}
    }
