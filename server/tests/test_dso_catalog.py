import json
from pathlib import Path

import pytest

from app.services import dso_catalog


FIXTURE = Path(__file__).parent / "fixtures" / "naked_eye_dso_minimal.json"


def test_load_returns_all_objects():
    objects = dso_catalog.load_catalog(FIXTURE)
    assert len(objects) == 3
    ids = {o["id"] for o in objects}
    assert ids == {"M31", "LMC", "M45"}


def test_dsos_for_observer_nyc_summer_sees_andromeda():
    # NYC, 2026-08-15 02:00 UTC = 10pm EDT 8/14 -- summer night.
    # Andromeda rises in the NE and is well above the horizon by 10pm EDT.
    result = dso_catalog.dsos_for_observer(
        lat=40.7128,
        lon=-74.0060,
        time_utc="2026-08-15T02:00:00Z",
        catalog_path=FIXTURE,
    )
    by_id = {d.id: d for d in result}
    assert "M31" in by_id, "Andromeda should be visible from NYC summer late night"
    assert by_id["M31"].alt > 0
    assert by_id["M31"].source == "SIMBAD/CDS"


def test_dsos_for_observer_buenos_aires_sees_lmc():
    # Buenos Aires same instant — LMC is a southern-hemisphere object,
    # should be above the horizon.
    result = dso_catalog.dsos_for_observer(
        lat=-34.61,
        lon=-58.40,
        time_utc="2026-08-15T02:00:00Z",
        catalog_path=FIXTURE,
    )
    by_id = {d.id: d for d in result}
    assert "LMC" in by_id
    assert by_id["LMC"].alt > 0


def test_dsos_for_observer_filters_below_horizon():
    # LMC from NYC -- declination -69.7 means it never rises above NYC's horizon.
    result = dso_catalog.dsos_for_observer(
        lat=40.7128,
        lon=-74.0060,
        time_utc="2026-08-15T02:00:00Z",
        catalog_path=FIXTURE,
    )
    by_id = {d.id: d for d in result}
    assert "LMC" not in by_id


def test_dsos_for_observer_include_below_horizon_flag():
    result = dso_catalog.dsos_for_observer(
        lat=40.7128,
        lon=-74.0060,
        time_utc="2026-08-15T02:00:00Z",
        catalog_path=FIXTURE,
        horizon_only=False,
    )
    by_id = {d.id: d for d in result}
    assert "LMC" in by_id
    assert by_id["LMC"].alt < 0
