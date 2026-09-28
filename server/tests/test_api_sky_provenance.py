"""GET /api/v1/sky passes per-star provenance through from a mixed catalog.

Uses a stubbed catalog frame shaped the way pd.concat leaves it: Gaia rows
carry NaN (not None) in the Hipparcos-only columns.
"""

from __future__ import annotations

import math

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import star_catalog

client = TestClient(app)

# Near the zenith for this observer, so both survive the horizon cull.
MIAMI = {"lat": 25.76, "lon": -80.19, "datetime": "2026-01-15T02:00:00Z",
         "include_below_horizon": True}


@pytest.fixture
def mixed_catalog(monkeypatch):
    frame = pd.DataFrame([
        {"source_id": "1576683529448755328", "ra": 193.5, "dec": 55.9,
         "pmra": 1.0, "pmdec": 1.0, "parallax": 40.0,
         "phot_g_mean_mag": 1.73, "bp_rp": 0.02, "source": "Gaia DR3",
         "magnitude_source": math.nan, "color_source": math.nan},
        {"source_id": "hip:32349", "ra": 101.28, "dec": -16.71,
         "pmra": -546.0, "pmdec": -1223.0, "parallax": 379.21,
         "phot_g_mean_mag": -1.49, "bp_rp": -0.06, "source": "ESA Hipparcos",
         "magnitude_source": "Derived (Riello et al. 2021)",
         "color_source": "Derived (Riello et al. 2021)"},
    ])
    monkeypatch.setattr(star_catalog, "query_visible_stars", lambda mag_limit: frame)


def _by_id(body):
    return {s["source_id"]: s for s in body["stars"]}


def test_hipparcos_star_keeps_its_prefixed_id_and_source(mixed_catalog):
    response = client.get("/api/v1/sky", params=MIAMI)
    assert response.status_code == 200
    sirius = _by_id(response.json())["hip:32349"]
    assert sirius["source"] == "ESA Hipparcos"
    assert "Riello" in sirius["magnitude_source"]
    assert "Riello" in sirius["color_source"]


def test_gaia_row_nan_provenance_serialises_as_null(mixed_catalog):
    body = client.get("/api/v1/sky", params=MIAMI).json()
    gaia = _by_id(body)["1576683529448755328"]
    assert gaia["source"] == "Gaia DR3"
    assert gaia["magnitude_source"] is None
    assert gaia["color_source"] is None
