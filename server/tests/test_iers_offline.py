"""Production runs with no network: Astropy must never try to download IERS
tables, and must not refuse far-future dates because the bundled predictions
are older than 30 days (spec §4.4, amendment 1 in the Phase 5 plan)."""

from __future__ import annotations

import pytest
from astropy.utils import iers
from fastapi.testclient import TestClient

from app.main import app


def test_app_puts_astropy_in_offline_iers_mode():
    assert iers.conf.auto_download is False
    assert iers.conf.auto_max_age is None


@pytest.mark.filterwarnings("ignore::erfa.ErfaWarning")
@pytest.mark.filterwarnings("ignore::astropy.utils.exceptions.AstropyWarning")
def test_far_future_sky_works_without_network():
    response = TestClient(app).get(
        "/api/v1/sky",
        params={"lat": 25.76, "lon": -80.19, "datetime": "2100-12-31T02:00:00Z"},
    )
    assert response.status_code == 200
    assert response.json()["count"] > 0


def test_startup_preloads_catalogs():
    from app.services import star_catalog

    star_catalog._catalog = None
    with TestClient(app):  # runs the lifespan
        assert star_catalog._catalog is not None
