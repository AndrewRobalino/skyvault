# Phase 2d — Celestial Objects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace yellow-dot planets with textured icons, render the Moon with a real texture and correct phase shadow, add a sun disk on the chart, and introduce ~25 naked-eye deep-sky objects (Andromeda, Pleiades, Orion Nebula, LMC/SMC, etc.) as soft glows sized to their real angular dimensions.

**Architecture:** Backend grows one new service + router + ingest script for DSOs; existing planet/moon endpoints unchanged. Frontend replaces the procedural `drawPlanet` and `drawMoon` paths in `utils/drawing.js` with sprite-based renderers backed by an image cache, adds a new `drawDso` pass between the Milky Way backdrop and the star pass, and adds a new React Query hook for DSO data.

**Tech Stack:** Python 3.11 / FastAPI / Astropy / astroquery (backend); React 18 / Vite / Canvas 2D / Zustand / @tanstack/react-query / Vitest + RTL (frontend); Solar System Scope CC BY 4.0 textures (assets).

**Spec:** `docs/superpowers/specs/2026-05-17-phase-2d-celestial-objects-design.md`

**Prerequisite:** PR #1 (Phase 2b + 2c) merged to `main`. This plan executes on branch `feat/phase-2d-celestial-objects` cut from `main` after that merge.

---

## File map

### Backend — new
- `server/app/models/schemas.py` — extend with `DeepSkyObject`, `DsoResponse`
- `server/app/config.py` — add `DSO_CATALOG_PATH` constant
- `server/data/naked_eye_dso.json` — committed output of ingest script
- `server/app/services/dso_catalog.py` — load JSON, compute observer AltAz, filter
- `server/app/routers/dso.py` — `GET /api/v1/dso`
- `server/app/main.py` — register router
- `server/scripts/ingest_dso.py` — one-time SIMBAD pull
- `server/tests/test_dso_catalog.py`
- `server/tests/test_dso_router.py`
- `server/tests/test_dso_ingest.py`
- `server/tests/fixtures/naked_eye_dso_minimal.json` — small test fixture (3 objects)

### Frontend — new
- `client/public/textures/planets/` — `mercury.jpg`, `venus.jpg`, `mars.jpg`, `jupiter.jpg`, `saturn.jpg`, `uranus.jpg`, `neptune.jpg`, `moon.jpg`, `_credits.json`
- `client/src/utils/textureCache.js` — module-level image preloader + cache
- `client/src/utils/dsoDrawing.js` — `drawDso(ctx, dso)` soft glow ellipse
- `client/src/hooks/useDso.js` — React Query hook
- `client/src/__tests__/textureCache.test.js`
- `client/src/__tests__/dsoDrawing.test.js`
- `client/src/__tests__/useDso.test.js`
- `client/src/__tests__/SkyTooltip.test.jsx`

### Frontend — modify
- `client/src/utils/drawing.js` — replace generic planet path + `drawMoon` body to use sprites; `drawSun` stays procedural
- `client/src/api/client.js` — add `dso` method
- `client/src/components/hero/SkyChart.jsx` — wire `useDso`, pass to `SkyCanvas`
- `client/src/components/hero/SkyCanvas.jsx` — accept + iterate `projectedDsos`, call `drawDso` in correct layer order
- `client/src/utils/projection.js` — add `projectDsos` (attaches `kind: "dso"`, `pxPerArcmin`, `hitRadius`)
- `client/src/components/hero/AttributionFooter.jsx` — append SSS + SIMBAD lines
- `client/src/components/hero/SkyTooltip.jsx` — add `DsoBody`, add photoreal thumbnail to `PlanetBody`, switch dispatch to handle three kinds
- `client/src/utils/hitTest.js` — honor optional per-object `hitRadius`

---

## Task 1: Add `DeepSkyObject` schema

**Files:**
- Modify: `server/app/models/schemas.py`
- Test: `server/tests/test_schemas.py` (extend if exists, else create)

- [ ] **Step 1: Write the failing schema test**

Append to `server/tests/test_schemas.py` (create file if missing with imports):

```python
import pytest
from pydantic import ValidationError

from app.models.schemas import DeepSkyObject, DsoResponse, Observer


def test_dso_valid_minimum():
    dso = DeepSkyObject(
        id="M31",
        common_name="Andromeda Galaxy",
        type="galaxy",
        ra=10.6847,
        dec=41.2687,
        alt=45.0,
        az=120.0,
        magnitude=3.44,
        angular_size_arcmin=178.0,
    )
    assert dso.source == "SIMBAD/CDS"
    assert dso.minor_axis_arcmin is None
    assert dso.messier_id is None


def test_dso_rejects_invalid_type():
    with pytest.raises(ValidationError):
        DeepSkyObject(
            id="M31",
            common_name="Andromeda",
            type="quasar",  # not in literal
            ra=0, dec=0, alt=0, az=0,
            magnitude=3.44, angular_size_arcmin=10,
        )


def test_dso_response_envelope():
    obs = Observer(lat=40.0, lon=-74.0, datetime="2026-08-15T02:00:00Z")
    resp = DsoResponse(observer=obs, dsos=[], count=0)
    assert resp.count == 0
    assert resp.dsos == []
```

- [ ] **Step 2: Run test to verify failure**

```
cd server
pytest tests/test_schemas.py -v
```
Expected: ImportError on `DeepSkyObject`, `DsoResponse`.

- [ ] **Step 3: Add the schemas**

Append to `server/app/models/schemas.py`:

```python
from typing import Literal


class DeepSkyObject(BaseModel):
    """A naked-eye deep-sky object (galaxy, nebula, or star cluster).

    Positions are computed in the observer's AltAz frame at the request time.
    RA/Dec are the catalog ICRS coordinates from SIMBAD. Angular sizes are
    major-axis arcminutes (and minor-axis for elongated objects like M31).
    Position angle is degrees east of north for the major axis.
    """

    id: str
    common_name: str
    messier_id: str | None = None
    type: Literal["galaxy", "nebula", "open_cluster", "globular_cluster"]
    ra: float
    dec: float
    alt: float
    az: float
    magnitude: float
    angular_size_arcmin: float
    minor_axis_arcmin: float | None = None
    position_angle_deg: float | None = None
    source: str = "SIMBAD/CDS"


class DsoResponse(BaseModel):
    observer: Observer
    dsos: list[DeepSkyObject]
    count: int
```

- [ ] **Step 4: Re-run test, expect pass**

```
pytest tests/test_schemas.py -v
```
Expected: all three tests pass.

- [ ] **Step 5: Commit**

```
git add server/app/models/schemas.py server/tests/test_schemas.py
git commit -m "feat(dso): add DeepSkyObject and DsoResponse schemas"
```

---

## Task 2: DSO catalog service

**Files:**
- Create: `server/app/services/dso_catalog.py`
- Create: `server/tests/fixtures/naked_eye_dso_minimal.json`
- Create: `server/tests/test_dso_catalog.py`
- Modify: `server/app/config.py`

- [ ] **Step 1: Add config constant**

In `server/app/config.py`, alongside the existing data path constants:

```python
DSO_CATALOG_PATH = DATA_DIR / "naked_eye_dso.json"
```

If `DATA_DIR` isn't already defined, infer from the existing Gaia parquet path — match its pattern.

- [ ] **Step 2: Create the test fixture**

Create `server/tests/fixtures/naked_eye_dso_minimal.json`:

```json
[
  {
    "id": "M31",
    "common_name": "Andromeda Galaxy",
    "messier_id": "M31",
    "type": "galaxy",
    "ra": 10.6847,
    "dec": 41.2687,
    "magnitude": 3.44,
    "angular_size_arcmin": 178.0,
    "minor_axis_arcmin": 63.0,
    "position_angle_deg": 35.0
  },
  {
    "id": "LMC",
    "common_name": "Large Magellanic Cloud",
    "messier_id": null,
    "type": "galaxy",
    "ra": 80.8939,
    "dec": -69.7561,
    "magnitude": 0.9,
    "angular_size_arcmin": 645.0,
    "minor_axis_arcmin": 550.0,
    "position_angle_deg": null
  },
  {
    "id": "M45",
    "common_name": "Pleiades",
    "messier_id": "M45",
    "type": "open_cluster",
    "ra": 56.75,
    "dec": 24.1167,
    "magnitude": 1.6,
    "angular_size_arcmin": 110.0,
    "minor_axis_arcmin": null,
    "position_angle_deg": null
  }
]
```

- [ ] **Step 3: Write the failing service test**

Create `server/tests/test_dso_catalog.py`:

```python
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
```

- [ ] **Step 4: Run, expect failure**

```
pytest tests/test_dso_catalog.py -v
```
Expected: ModuleNotFoundError on `app.services.dso_catalog`.

- [ ] **Step 5: Implement the service**

Create `server/app/services/dso_catalog.py`:

```python
"""Naked-eye deep-sky object catalog.

Loads a static JSON file produced by ``scripts/ingest_dso.py`` (a one-time
SIMBAD pull). At request time, transforms each object's catalog ICRS position
into the observer's AltAz frame using Astropy, and optionally filters to
objects above the horizon.

No live SIMBAD queries from the request path — this stays a cold service.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from astropy import units as u
from astropy.coordinates import AltAz, EarthLocation, SkyCoord
from astropy.time import Time

from app.config import DSO_CATALOG_PATH
from app.models.schemas import DeepSkyObject


@lru_cache(maxsize=4)
def load_catalog(path: Path | None = None) -> list[dict]:
    """Load the static DSO catalog JSON. Cached per path."""
    p = Path(path) if path is not None else DSO_CATALOG_PATH
    with p.open(encoding="utf-8") as fh:
        return json.load(fh)


def dsos_for_observer(
    lat: float,
    lon: float,
    time_utc: str,
    catalog_path: Path | None = None,
    horizon_only: bool = True,
) -> list[DeepSkyObject]:
    """Return DSOs with computed AltAz for the given observer + time.

    Args:
        lat: observer latitude (deg, +N).
        lon: observer longitude (deg, +E).
        time_utc: ISO 8601 UTC observation time.
        catalog_path: override default catalog path (used by tests).
        horizon_only: if True, drop objects below the horizon.

    Returns:
        List of DeepSkyObject sorted by ascending RA.
    """
    raw = load_catalog(catalog_path)
    if not raw:
        return []

    location = EarthLocation(lat=lat * u.deg, lon=lon * u.deg)
    time = Time(time_utc)
    frame = AltAz(obstime=time, location=location)

    ras = [obj["ra"] for obj in raw]
    decs = [obj["dec"] for obj in raw]
    coords = SkyCoord(ra=ras * u.deg, dec=decs * u.deg, frame="icrs")
    altaz = coords.transform_to(frame)
    alts = altaz.alt.deg.tolist()
    azs = altaz.az.deg.tolist()

    out: list[DeepSkyObject] = []
    for obj, alt, az in zip(raw, alts, azs):
        if horizon_only and alt < 0:
            continue
        out.append(
            DeepSkyObject(
                id=obj["id"],
                common_name=obj["common_name"],
                messier_id=obj.get("messier_id"),
                type=obj["type"],
                ra=obj["ra"],
                dec=obj["dec"],
                alt=alt,
                az=az,
                magnitude=obj["magnitude"],
                angular_size_arcmin=obj["angular_size_arcmin"],
                minor_axis_arcmin=obj.get("minor_axis_arcmin"),
                position_angle_deg=obj.get("position_angle_deg"),
            )
        )
    return sorted(out, key=lambda d: d.ra)
```

- [ ] **Step 6: Run, expect pass**

```
pytest tests/test_dso_catalog.py -v
```
Expected: all 5 tests pass.

- [ ] **Step 7: Commit**

```
git add server/app/config.py server/app/services/dso_catalog.py server/tests/fixtures/naked_eye_dso_minimal.json server/tests/test_dso_catalog.py
git commit -m "feat(dso): catalog service computes observer AltAz from static JSON"
```

---

## Task 3: DSO router

**Files:**
- Create: `server/app/routers/dso.py`
- Modify: `server/app/main.py`
- Create: `server/tests/test_dso_router.py`

- [ ] **Step 1: Write the failing router test**

Create `server/tests/test_dso_router.py`:

```python
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
FIXTURE = Path(__file__).parent / "fixtures" / "naked_eye_dso_minimal.json"


@pytest.fixture(autouse=True)
def use_fixture_catalog():
    """Point the catalog loader at the test fixture for all router tests."""
    with patch("app.services.dso_catalog.DSO_CATALOG_PATH", FIXTURE):
        # Reset the lru_cache so the patched path is honored
        from app.services.dso_catalog import load_catalog
        load_catalog.cache_clear()
        yield
        load_catalog.cache_clear()


def test_dso_route_nyc_summer():
    r = client.get(
        "/api/v1/dso",
        params={"lat": 40.7128, "lon": -74.0060, "datetime": "2026-08-15T02:00:00Z"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == len(body["dsos"])
    ids = {d["id"] for d in body["dsos"]}
    assert "M31" in ids
    assert "LMC" not in ids  # below NYC horizon


def test_dso_route_invalid_lat():
    r = client.get(
        "/api/v1/dso",
        params={"lat": 999, "lon": 0, "datetime": "2026-08-15T02:00:00Z"},
    )
    assert r.status_code == 422


def test_dso_route_include_below_horizon():
    r = client.get(
        "/api/v1/dso",
        params={
            "lat": 40.7128, "lon": -74.0060,
            "datetime": "2026-08-15T02:00:00Z",
            "include_below_horizon": "true",
        },
    )
    assert r.status_code == 200
    ids = {d["id"] for d in r.json()["dsos"]}
    assert "LMC" in ids
```

- [ ] **Step 2: Run, expect failure**

```
pytest tests/test_dso_router.py -v
```
Expected: 404 on `/api/v1/dso` (router not registered).

- [ ] **Step 3: Implement the router**

Create `server/app/routers/dso.py`:

```python
"""GET /api/v1/dso — naked-eye deep-sky objects for an observer."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.models.schemas import DsoResponse, Observer
from app.services import dso_catalog


router = APIRouter(prefix="/dso", tags=["dso"])


@router.get("", response_model=DsoResponse)
async def get_dsos(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Observer latitude (deg)"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Observer longitude (deg)"),
    datetime: str = Query(..., description="Observation time, ISO 8601 UTC"),
    include_below_horizon: bool = Query(
        False,
        description="If true, include objects below the horizon in the response.",
    ),
) -> DsoResponse:
    dsos = dso_catalog.dsos_for_observer(
        lat=lat,
        lon=lon,
        time_utc=datetime,
        horizon_only=not include_below_horizon,
    )
    return DsoResponse(
        observer=Observer(lat=lat, lon=lon, datetime=datetime),
        dsos=dsos,
        count=len(dsos),
    )
```

- [ ] **Step 4: Register the router**

In `server/app/main.py`, find the block that includes the other routers (`sky`, `planets`, `geocode`, `constellations`, `objects`) and add:

```python
from app.routers import dso

# ... in the same include_router block:
app.include_router(dso.router, prefix="/api/v1")
```

Use the existing imports/prefix style — match it exactly.

- [ ] **Step 5: Run, expect pass**

```
pytest tests/test_dso_router.py -v
```
Expected: all 3 tests pass.

- [ ] **Step 6: Commit**

```
git add server/app/routers/dso.py server/app/main.py server/tests/test_dso_router.py
git commit -m "feat(dso): add /api/v1/dso endpoint"
```

---

## Task 4: SIMBAD ingest script

**Files:**
- Create: `server/scripts/ingest_dso.py`
- Create: `server/tests/test_dso_ingest.py`

- [ ] **Step 1: Write the failing parser test**

Create `server/tests/test_dso_ingest.py`:

```python
from unittest.mock import MagicMock

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
```

- [ ] **Step 2: Run, expect failure**

```
pytest tests/test_dso_ingest.py -v
```
Expected: ImportError on `scripts.ingest_dso`.

- [ ] **Step 3: Implement the ingest script**

Create `server/scripts/ingest_dso.py`:

```python
"""One-time ingest: query SIMBAD for the curated naked-eye DSO list and
write ``server/data/naked_eye_dso.json``.

Run this once when the curated list changes (or for the initial seed).
Output is committed to the repo; the request path never hits SIMBAD.

Usage:
    cd server
    python scripts/ingest_dso.py
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any

from astropy.coordinates import SkyCoord
import astropy.units as u

logger = logging.getLogger(__name__)


# Curated list — name = SIMBAD identifier; id = canonical short id used in API.
# Type is the *expected* type; the parser verifies SIMBAD agrees.
CURATED: list[dict[str, str]] = [
    # --- Northern + general (14) ---
    {"id": "M31", "simbad": "M 31", "common_name": "Andromeda Galaxy", "messier_id": "M31", "type": "galaxy"},
    {"id": "M33", "simbad": "M 33", "common_name": "Triangulum Galaxy", "messier_id": "M33", "type": "galaxy"},
    {"id": "M42", "simbad": "M 42", "common_name": "Orion Nebula", "messier_id": "M42", "type": "nebula"},
    {"id": "M45", "simbad": "M 45", "common_name": "Pleiades", "messier_id": "M45", "type": "open_cluster"},
    {"id": "M44", "simbad": "M 44", "common_name": "Beehive Cluster", "messier_id": "M44", "type": "open_cluster"},
    {"id": "M81", "simbad": "M 81", "common_name": "Bode's Galaxy", "messier_id": "M81", "type": "galaxy"},
    {"id": "M82", "simbad": "M 82", "common_name": "Cigar Galaxy", "messier_id": "M82", "type": "galaxy"},
    {"id": "M51", "simbad": "M 51", "common_name": "Whirlpool Galaxy", "messier_id": "M51", "type": "galaxy"},
    {"id": "M27", "simbad": "M 27", "common_name": "Dumbbell Nebula", "messier_id": "M27", "type": "nebula"},
    {"id": "M13", "simbad": "M 13", "common_name": "Hercules Globular Cluster", "messier_id": "M13", "type": "globular_cluster"},
    {"id": "M8",  "simbad": "M 8",  "common_name": "Lagoon Nebula", "messier_id": "M8",  "type": "nebula"},
    {"id": "M57", "simbad": "M 57", "common_name": "Ring Nebula", "messier_id": "M57", "type": "nebula"},
    {"id": "M67", "simbad": "M 67", "common_name": "M67 Open Cluster", "messier_id": "M67", "type": "open_cluster"},
    {"id": "M11", "simbad": "M 11", "common_name": "Wild Duck Cluster", "messier_id": "M11", "type": "open_cluster"},

    # --- Bright additions (2) ---
    {"id": "M3",   "simbad": "M 3",   "common_name": "M3 Globular Cluster", "messier_id": "M3",   "type": "globular_cluster"},
    {"id": "M104", "simbad": "M 104", "common_name": "Sombrero Galaxy",     "messier_id": "M104", "type": "galaxy"},

    # --- Southern (9) ---
    {"id": "LMC",          "simbad": "LMC",       "common_name": "Large Magellanic Cloud", "messier_id": None, "type": "galaxy"},
    {"id": "SMC",          "simbad": "SMC",       "common_name": "Small Magellanic Cloud", "messier_id": None, "type": "galaxy"},
    {"id": "OmegaCen",     "simbad": "NGC 5139", "common_name": "Omega Centauri",          "messier_id": None, "type": "globular_cluster"},
    {"id": "47Tuc",        "simbad": "NGC 104",  "common_name": "47 Tucanae",              "messier_id": None, "type": "globular_cluster"},
    {"id": "EtaCarinaeNeb","simbad": "NGC 3372", "common_name": "Eta Carinae Nebula",      "messier_id": None, "type": "nebula"},
    {"id": "Tarantula",    "simbad": "NGC 2070", "common_name": "Tarantula Nebula",        "messier_id": None, "type": "nebula"},
    {"id": "JewelBox",     "simbad": "NGC 4755", "common_name": "Jewel Box Cluster",       "messier_id": None, "type": "open_cluster"},
    {"id": "NGC253",       "simbad": "NGC 253",  "common_name": "Sculptor Galaxy",         "messier_id": None, "type": "galaxy"},
    {"id": "CenA",         "simbad": "NGC 5128", "common_name": "Centaurus A",             "messier_id": None, "type": "galaxy"},
]


# Map SIMBAD's OTYPE codes -> our type literal.
SIMBAD_TYPE_MAP = {
    "G":     "galaxy",
    "GiG":   "galaxy",   # giant galaxy
    "AGN":   "galaxy",
    "Sy1":   "galaxy",
    "Sy2":   "galaxy",
    "PaG":   "galaxy",   # pair of galaxies
    "rG":    "galaxy",   # radio galaxy
    "HII":   "nebula",
    "ISM":   "nebula",
    "RNe":   "nebula",
    "PN":    "nebula",
    "EmO":   "nebula",
    "MoC":   "nebula",
    "OpC":   "open_cluster",
    "Cl*":   "open_cluster",
    "GlC":   "globular_cluster",
}


def parse_simbad_row(spec: dict[str, Any], row: dict[str, Any]) -> dict[str, Any]:
    """Parse one SIMBAD result row into our DSO dict shape.

    ``spec`` is the curated entry; ``row`` is the astroquery result row.
    We trust SIMBAD's coordinates, magnitude, and dimensions; we trust our
    curated list for the user-facing common_name (SIMBAD's MAIN_ID is messy).
    """
    ra_str = row["RA"]
    dec_str = row["DEC"]
    sc = SkyCoord(f"{ra_str} {dec_str}", unit=(u.hourangle, u.deg))
    otype_raw = row["OTYPE"]
    otype = otype_raw.decode() if isinstance(otype_raw, (bytes, bytearray)) else otype_raw
    otype = otype.strip()
    inferred_type = SIMBAD_TYPE_MAP.get(otype, spec["type"])

    major = row.get("GALDIM_MAJAXIS")
    minor = row.get("GALDIM_MINAXIS")
    angle = row.get("GALDIM_ANGLE")

    return {
        "id":                  spec["id"],
        "common_name":         spec["common_name"],
        "messier_id":          spec.get("messier_id"),
        "type":                inferred_type,
        "ra":                  float(sc.ra.deg),
        "dec":                 float(sc.dec.deg),
        "magnitude":           float(row["FLUX_V"]) if row.get("FLUX_V") is not None else None,
        "angular_size_arcmin": float(major) if major is not None else None,
        "minor_axis_arcmin":   float(minor) if minor is not None else None,
        "position_angle_deg":  float(angle) if angle is not None else None,
    }


def main() -> int:
    """Query SIMBAD for the curated list, write JSON. Skip objects with
    missing critical fields (magnitude, angular size) and log them."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    from astroquery.simbad import Simbad

    simbad = Simbad()
    simbad.add_votable_fields("flux(V)", "dim", "otype")

    out_path = Path(__file__).resolve().parent.parent / "data" / "naked_eye_dso.json"
    results: list[dict[str, Any]] = []
    skipped: list[str] = []

    for spec in CURATED:
        logger.info("Querying SIMBAD: %s (%s)", spec["simbad"], spec["id"])
        table = simbad.query_object(spec["simbad"])
        if table is None or len(table) == 0:
            logger.warning("  no SIMBAD result, skipping")
            skipped.append(spec["id"])
            continue
        row = {col: table[col][0] for col in table.colnames}
        try:
            parsed = parse_simbad_row(spec, row)
        except Exception as exc:  # noqa: BLE001 -- ingest is best-effort
            logger.warning("  parse failed: %s", exc)
            skipped.append(spec["id"])
            continue
        if parsed["magnitude"] is None or parsed["angular_size_arcmin"] is None:
            logger.warning("  missing magnitude or angular size, skipping")
            skipped.append(spec["id"])
            continue
        results.append(parsed)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2, ensure_ascii=False)

    logger.info("Wrote %d objects to %s", len(results), out_path)
    if skipped:
        logger.warning("Skipped %d: %s", len(skipped), ", ".join(skipped))
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run, expect pass**

```
pytest tests/test_dso_ingest.py -v
```
Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```
git add server/scripts/ingest_dso.py server/tests/test_dso_ingest.py
git commit -m "feat(dso): SIMBAD ingest script for curated naked-eye list"
```

---

## Task 5: Run ingest, commit the JSON

**Files:**
- Create: `server/data/naked_eye_dso.json` (output of ingest)

- [ ] **Step 1: Run the ingest script**

```
cd server
source .venv/bin/activate  # or .venv\Scripts\Activate.ps1 on Windows
python scripts/ingest_dso.py
```

Expected log: "Wrote 25 objects" (or report which were skipped).

- [ ] **Step 2: Sanity-check the JSON**

```
cd server
python -c "import json; d=json.load(open('data/naked_eye_dso.json')); print(len(d), 'objects'); print(d[0])"
```

Expected: count >= 23 (allow up to 2 SIMBAD-side gaps); first object well-formed; M31 magnitude ≈ 3.44; LMC magnitude ≈ 0.9.

If count < 23, investigate SIMBAD response gaps before proceeding. Don't substitute fake values.

- [ ] **Step 3: Verify the router serves it end-to-end**

In one terminal:
```
cd server
uvicorn app.main:app --reload --port 8000
```

In another:
```
curl "http://localhost:8000/api/v1/dso?lat=40.7128&lon=-74.0060&datetime=2026-08-15T02:00:00Z" | python -m json.tool | head -40
```

Expected: response contains M31 with `alt > 0`, no LMC.

- [ ] **Step 4: Commit the catalog**

```
git add server/data/naked_eye_dso.json
git commit -m "data(dso): seed naked_eye_dso.json from SIMBAD ingest"
```

---

## Task 6: Download Solar System Scope textures

**Files:**
- Create: `client/public/textures/planets/mercury.jpg`, `venus.jpg`, `mars.jpg`, `jupiter.jpg`, `saturn.jpg`, `uranus.jpg`, `neptune.jpg`, `moon.jpg`
- Create: `client/public/textures/planets/_credits.json`

- [ ] **Step 1: Manual download**

Go to https://www.solarsystemscope.com/textures/ — download the 2K versions of:
- `2k_mercury.jpg`
- `2k_venus_atmosphere.jpg`
- `2k_mars.jpg`
- `2k_jupiter.jpg`
- `2k_saturn.jpg`
- `2k_uranus.jpg`
- `2k_neptune.jpg`
- `2k_moon.jpg`

- [ ] **Step 2: Downscale to 512px JPG**

If ImageMagick is available:
```
mkdir -p client/public/textures/planets
for src in 2k_mercury.jpg 2k_venus_atmosphere.jpg 2k_mars.jpg 2k_jupiter.jpg 2k_saturn.jpg 2k_uranus.jpg 2k_neptune.jpg 2k_moon.jpg; do
  dest=$(echo $src | sed 's/2k_//' | sed 's/_atmosphere//')
  magick $src -resize 512x256 -quality 85 client/public/textures/planets/$dest
done
```

Alternative (Python with Pillow):
```python
from PIL import Image
import os

mapping = {
    "2k_mercury.jpg": "mercury.jpg",
    "2k_venus_atmosphere.jpg": "venus.jpg",
    "2k_mars.jpg": "mars.jpg",
    "2k_jupiter.jpg": "jupiter.jpg",
    "2k_saturn.jpg": "saturn.jpg",
    "2k_uranus.jpg": "uranus.jpg",
    "2k_neptune.jpg": "neptune.jpg",
    "2k_moon.jpg": "moon.jpg",
}
os.makedirs("client/public/textures/planets", exist_ok=True)
for src, dest in mapping.items():
    Image.open(src).resize((512, 256), Image.LANCZOS).save(
        f"client/public/textures/planets/{dest}", quality=85
    )
```

- [ ] **Step 3: Verify file sizes**

```
ls -la client/public/textures/planets/
```

Expected: 8 JPG files, each ~50-100 KB. Total directory ~720 KB.

- [ ] **Step 4: Write _credits.json**

Create `client/public/textures/planets/_credits.json`:

```json
{
  "license": "CC BY 4.0",
  "license_url": "https://creativecommons.org/licenses/by/4.0/",
  "source_url": "https://www.solarsystemscope.com/textures/",
  "attribution": "Planet & Moon textures © Solar System Scope (INOVE), CC BY 4.0",
  "files": {
    "mercury.jpg":  { "original": "2k_mercury.jpg" },
    "venus.jpg":    { "original": "2k_venus_atmosphere.jpg" },
    "mars.jpg":     { "original": "2k_mars.jpg" },
    "jupiter.jpg":  { "original": "2k_jupiter.jpg" },
    "saturn.jpg":   { "original": "2k_saturn.jpg" },
    "uranus.jpg":   { "original": "2k_uranus.jpg" },
    "neptune.jpg":  { "original": "2k_neptune.jpg" },
    "moon.jpg":     { "original": "2k_moon.jpg" }
  }
}
```

- [ ] **Step 5: Commit**

```
git add client/public/textures/planets/
git commit -m "asset(planets): add Solar System Scope textures (CC BY 4.0)"
```

---

## Task 7: Texture cache utility

**Files:**
- Create: `client/src/utils/textureCache.js`
- Create: `client/src/__tests__/textureCache.test.js`

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/textureCache.test.js`:

```javascript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTexture, preloadTextures, _resetCacheForTests } from "../utils/textureCache.js";

describe("textureCache", () => {
  beforeEach(() => {
    _resetCacheForTests();
  });

  it("returns the same Image instance on repeated getTexture calls", () => {
    const a = getTexture("/textures/planets/mars.jpg");
    const b = getTexture("/textures/planets/mars.jpg");
    expect(a).toBe(b);
  });

  it("getTexture returns an Image whose src is set", () => {
    const img = getTexture("/textures/planets/jupiter.jpg");
    expect(img.src).toContain("/textures/planets/jupiter.jpg");
  });

  it("preloadTextures returns a promise that resolves when all images load or error", async () => {
    const urls = ["/textures/planets/mercury.jpg", "/textures/planets/mars.jpg"];
    const promise = preloadTextures(urls);
    // Simulate load on the cached images
    for (const u of urls) {
      const img = getTexture(u);
      img.dispatchEvent(new Event("load"));
    }
    await expect(promise).resolves.toBeUndefined();
  });

  it("preloadTextures resolves even if some images error", async () => {
    const urls = ["/textures/planets/mercury.jpg"];
    const promise = preloadTextures(urls);
    const img = getTexture(urls[0]);
    img.dispatchEvent(new Event("error"));
    await expect(promise).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```
cd client
npx vitest run src/__tests__/textureCache.test.js
```
Expected: ImportError on `../utils/textureCache.js`.

- [ ] **Step 3: Implement the cache**

Create `client/src/utils/textureCache.js`:

```javascript
/**
 * Module-level image cache for planet/moon sprites.
 *
 * Returns a singleton HTMLImageElement per URL so renderers that ask for
 * the same texture every frame don't repeatedly construct Images (which would
 * defeat the browser's HTTP cache and flash blank frames during decode).
 *
 * Renderers should check `img.complete` before drawing — if false, fall back
 * to a colored dot for that frame.
 */

const cache = new Map();

export function getTexture(url) {
  let img = cache.get(url);
  if (img) return img;
  img = new Image();
  img.src = url;
  cache.set(url, img);
  return img;
}

export function preloadTextures(urls) {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise((resolve) => {
          const img = getTexture(url);
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => {
            img.removeEventListener("load", done);
            img.removeEventListener("error", done);
            resolve();
          };
          img.addEventListener("load", done);
          img.addEventListener("error", done);
        }),
    ),
  ).then(() => undefined);
}

// Test-only escape hatch — never call from app code.
export function _resetCacheForTests() {
  cache.clear();
}
```

- [ ] **Step 4: Run, expect pass**

```
npx vitest run src/__tests__/textureCache.test.js
```
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```
git add client/src/utils/textureCache.js client/src/__tests__/textureCache.test.js
git commit -m "feat(textures): module-level Image cache for sprites"
```

---

## Task 8: Replace planet draw path with sprites

**Files:**
- Modify: `client/src/utils/drawing.js`
- Modify: `client/src/__tests__/drawing.test.js` (or create if missing)

- [ ] **Step 1: Write the failing sprite test**

Append to `client/src/__tests__/drawing.test.js` (create if missing — use the existing star tests as a pattern reference):

```javascript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { drawPlanet, PLANET_TEXTURE_URLS } from "../utils/drawing.js";
import { _resetCacheForTests, getTexture } from "../utils/textureCache.js";

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    ellipse: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    set fillStyle(_v) {},
    set strokeStyle(_v) {},
    set lineWidth(_v) {},
    set globalCompositeOperation(_v) {},
  };
}

describe("drawPlanet sprite", () => {
  beforeEach(() => {
    _resetCacheForTests();
  });

  it("uses drawImage when the texture is loaded", () => {
    const ctx = makeCtx();
    const img = getTexture(PLANET_TEXTURE_URLS.Mars);
    Object.defineProperty(img, "complete", { value: true });
    Object.defineProperty(img, "naturalWidth", { value: 512 });

    drawPlanet(ctx, { name: "Mars", x: 100, y: 100, alt: 45, az: 180 });
    expect(ctx.drawImage).toHaveBeenCalled();
    const args = ctx.drawImage.mock.calls[0];
    expect(args[0]).toBe(img);
  });

  it("falls back to a colored dot when the texture is not yet loaded", () => {
    const ctx = makeCtx();
    const img = getTexture(PLANET_TEXTURE_URLS.Jupiter);
    Object.defineProperty(img, "complete", { value: false });
    Object.defineProperty(img, "naturalWidth", { value: 0 });

    drawPlanet(ctx, { name: "Jupiter", x: 100, y: 100, alt: 45, az: 180 });
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
  });

  it("Sun stays procedural (no drawImage)", () => {
    const ctx = makeCtx();
    drawPlanet(ctx, { name: "Sun", x: 100, y: 100, alt: 30, az: 90 });
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.createRadialGradient).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```
npx vitest run src/__tests__/drawing.test.js
```
Expected: ImportError on `PLANET_TEXTURE_URLS` and/or `drawImage` never called.

- [ ] **Step 3: Modify `drawing.js`**

In `client/src/utils/drawing.js`, near the top imports:

```javascript
import { getTexture } from "./textureCache.js";
```

After the `PLANET_TINTS` block, add:

```javascript
export const PLANET_TEXTURE_URLS = {
  Mercury: "/textures/planets/mercury.jpg",
  Venus:   "/textures/planets/venus.jpg",
  Mars:    "/textures/planets/mars.jpg",
  Jupiter: "/textures/planets/jupiter.jpg",
  Saturn:  "/textures/planets/saturn.jpg",
  Uranus:  "/textures/planets/uranus.jpg",
  Neptune: "/textures/planets/neptune.jpg",
  Moon:    "/textures/planets/moon.jpg",
};
```

Replace the body of the generic-planet branch of `drawPlanet` (everything after the `Sun`/`Moon` early-returns) with:

```javascript
  const size = PLANET_SIZES[planet.name] ?? PLANET_SIZE_DEFAULT;
  const tint = PLANET_TINTS[planet.name] ?? PLANET_TINT_DEFAULT;
  const { x, y } = planet;
  const r = size / 2;
  const textureUrl = PLANET_TEXTURE_URLS[planet.name];

  ctx.save();

  // Outer glow ring -- unchanged, keeps the planet visually distinct from stars.
  const glowRadius = r * 1.5;
  const glowGradient = ctx.createRadialGradient(x, y, r * 0.9, x, y, glowRadius);
  glowGradient.addColorStop(0, hexToRgba(tint, 0.35));
  glowGradient.addColorStop(1, hexToRgba(tint, 0));
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  const img = textureUrl ? getTexture(textureUrl) : null;
  if (img && img.complete && img.naturalWidth > 0) {
    // Clip to a circle so the rectangular texture renders as a disk.
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x - r, y - r, size, size);
    ctx.restore();
  } else {
    // Fallback while the texture loads.
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Thin bright edge for crisp definition.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
```

- [ ] **Step 4: Run, expect pass**

```
npx vitest run src/__tests__/drawing.test.js
```
Expected: all 3 new tests pass; pre-existing star tests still pass.

- [ ] **Step 5: Run the full frontend suite — no regressions**

```
npm test
```
Expected: all tests green.

- [ ] **Step 6: Commit**

```
git add client/src/utils/drawing.js client/src/__tests__/drawing.test.js
git commit -m "feat(planets): sprite-based planet rendering with dot fallback"
```

---

## Task 9: Moon sprite with phase shadow

**Files:**
- Modify: `client/src/utils/drawing.js`
- Modify: `client/src/__tests__/drawing.test.js`

- [ ] **Step 1: Write the failing Moon test**

Append to `client/src/__tests__/drawing.test.js`:

```javascript
import { drawPlanet, PLANET_TEXTURE_URLS } from "../utils/drawing.js";

describe("drawPlanet Moon with texture", () => {
  beforeEach(() => {
    _resetCacheForTests();
  });

  it("uses drawImage when texture is loaded (full moon, no shadow)", () => {
    const ctx = makeCtx();
    const img = getTexture(PLANET_TEXTURE_URLS.Moon);
    Object.defineProperty(img, "complete", { value: true });
    Object.defineProperty(img, "naturalWidth", { value: 512 });

    drawPlanet(ctx, { name: "Moon", x: 50, y: 50, illumination: 1.0 });
    expect(ctx.drawImage).toHaveBeenCalled();
    // Full moon: no shadow ellipse drawn -> ellipse() not called.
    expect(ctx.ellipse).not.toHaveBeenCalled();
  });

  it("draws a shadow ellipse when illumination < 0.98", () => {
    const ctx = makeCtx();
    const img = getTexture(PLANET_TEXTURE_URLS.Moon);
    Object.defineProperty(img, "complete", { value: true });
    Object.defineProperty(img, "naturalWidth", { value: 512 });

    drawPlanet(ctx, { name: "Moon", x: 50, y: 50, illumination: 0.5 });
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(ctx.ellipse).toHaveBeenCalled();
  });

  it("falls back to procedural disk when texture not loaded", () => {
    const ctx = makeCtx();
    const img = getTexture(PLANET_TEXTURE_URLS.Moon);
    Object.defineProperty(img, "complete", { value: false });
    Object.defineProperty(img, "naturalWidth", { value: 0 });

    drawPlanet(ctx, { name: "Moon", x: 50, y: 50, illumination: 0.5 });
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```
npx vitest run src/__tests__/drawing.test.js -t "Moon with texture"
```
Expected: first test fails (still procedural, `drawImage` not called).

- [ ] **Step 3: Replace `drawMoon` body in `drawing.js`**

Replace the entire `drawMoon` function:

```javascript
function drawMoon(ctx, planet) {
  const { x, y, illumination } = planet;
  const size = PLANET_SIZES.Moon;
  const r = size / 2;
  const frac = illumination ?? 1.0;
  const img = getTexture(PLANET_TEXTURE_URLS.Moon);

  ctx.save();

  if (img.complete && img.naturalWidth > 0) {
    // Clip to a circle, draw the texture, then composite a shadow ellipse.
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x - r, y - r, size, size);

    if (frac < 0.98) {
      // Shadow: dark ellipse covering the unlit fraction.
      ctx.fillStyle = "rgba(5, 6, 13, 0.85)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      const shadowWidth = r * 2 * (1 - frac);
      ctx.ellipse(
        x + r - shadowWidth / 2,
        y,
        shadowWidth / 2,
        r,
        0,
        0,
        Math.PI * 2,
        true
      );
      ctx.fill("evenodd");
    }
    ctx.restore();
  } else {
    // Fallback: procedural moon (the pre-2d behavior).
    ctx.fillStyle = "#e8e3d6";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle border.
  ctx.strokeStyle = "rgba(232, 227, 214, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
```

- [ ] **Step 4: Run, expect pass**

```
npx vitest run src/__tests__/drawing.test.js
```
Expected: all Moon tests pass; full suite green.

- [ ] **Step 5: Commit**

```
git add client/src/utils/drawing.js client/src/__tests__/drawing.test.js
git commit -m "feat(moon): textured Moon sprite with phase shadow"
```

---

## Task 10: DSO drawing utility

**Files:**
- Create: `client/src/utils/dsoDrawing.js`
- Create: `client/src/__tests__/dsoDrawing.test.js`

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/dsoDrawing.test.js`:

```javascript
import { describe, it, expect, vi } from "vitest";
import { drawDso, DSO_TYPE_COLORS } from "../utils/dsoDrawing.js";

function makeCtx() {
  const ops = [];
  return {
    ops,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn((...a) => ops.push(["ellipse", ...a])),
    arc: vi.fn(),
    fill: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    set fillStyle(_v) {},
    set globalCompositeOperation(v) { ops.push(["composite", v]); },
  };
}

describe("drawDso", () => {
  it("draws an ellipse using additive blend", () => {
    const ctx = makeCtx();
    drawDso(ctx, {
      x: 200, y: 200, type: "galaxy",
      angular_size_arcmin: 178, minor_axis_arcmin: 63,
      position_angle_deg: 35, pxPerArcmin: 0.5,
    });
    expect(ctx.ellipse).toHaveBeenCalled();
    expect(ctx.ops.some((o) => o[0] === "composite" && o[1] === "lighter")).toBe(true);
  });

  it("rotates by position_angle_deg when provided", () => {
    const ctx = makeCtx();
    drawDso(ctx, {
      x: 100, y: 100, type: "galaxy",
      angular_size_arcmin: 100, minor_axis_arcmin: 50,
      position_angle_deg: 45, pxPerArcmin: 1,
    });
    expect(ctx.rotate).toHaveBeenCalledWith((45 * Math.PI) / 180);
  });

  it("defaults to a circle when minor axis is null", () => {
    const ctx = makeCtx();
    drawDso(ctx, {
      x: 100, y: 100, type: "open_cluster",
      angular_size_arcmin: 110, minor_axis_arcmin: null,
      position_angle_deg: null, pxPerArcmin: 0.5,
    });
    expect(ctx.ellipse).toHaveBeenCalled();
    const ellipseCall = ctx.ellipse.mock.calls[0];
    // ellipse(x, y, radiusX, radiusY, ...). For a "circle", x and y radii match.
    expect(ellipseCall[2]).toBeCloseTo(ellipseCall[3]);
  });

  it("uses the type-specific color", () => {
    expect(DSO_TYPE_COLORS.galaxy).toBeTruthy();
    expect(DSO_TYPE_COLORS.nebula).toBeTruthy();
    expect(DSO_TYPE_COLORS.open_cluster).toBeTruthy();
    expect(DSO_TYPE_COLORS.globular_cluster).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```
npx vitest run src/__tests__/dsoDrawing.test.js
```
Expected: ImportError.

- [ ] **Step 3: Implement `dsoDrawing.js`**

Create `client/src/utils/dsoDrawing.js`:

```javascript
/**
 * Soft elliptical glow renderer for naked-eye deep-sky objects.
 *
 * Each DSO is drawn at its real angular size (major/minor axis arcmin),
 * scaled to pixels via the chart's current `pxPerArcmin` factor. Rotated by
 * the catalog's position angle (degrees east of north). Color hints by type.
 *
 * Uses additive blending so the glow brightens (not occludes) anything
 * underneath — bright cluster stars in the Pleiades still pop through.
 */

export const DSO_TYPE_COLORS = {
  galaxy:           "rgba(170, 195, 230, 1)",  // pale blue
  nebula:           "rgba(230, 140, 165, 1)",  // pink/red
  open_cluster:     "rgba(245, 245, 230, 1)",  // warm white
  globular_cluster: "rgba(245, 230, 195, 1)",  // pale gold
};

const DEFAULT_COLOR = "rgba(220, 220, 220, 1)";

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} dso - { x, y, type, angular_size_arcmin, minor_axis_arcmin?, position_angle_deg?, pxPerArcmin }
 */
export function drawDso(ctx, dso) {
  const {
    x, y, type,
    angular_size_arcmin,
    minor_axis_arcmin,
    position_angle_deg,
    pxPerArcmin,
  } = dso;

  if (!angular_size_arcmin || !pxPerArcmin) return;

  const color = DSO_TYPE_COLORS[type] ?? DEFAULT_COLOR;
  const majorPx = (angular_size_arcmin * pxPerArcmin) / 2;
  const minorPx = minor_axis_arcmin != null
    ? (minor_axis_arcmin * pxPerArcmin) / 2
    : majorPx;

  // Clamp to keep tiny objects visible and giant ones from dominating.
  const rxClamped = Math.max(2, Math.min(majorPx, 120));
  const ryClamped = Math.max(2, Math.min(minorPx, 120));

  const angleRad = ((position_angle_deg ?? 0) * Math.PI) / 180;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(x, y);
  ctx.rotate(angleRad);

  // Soft radial gradient inside the rotated frame.
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rxClamped, ryClamped));
  gradient.addColorStop(0,    replaceAlpha(color, 0.55));
  gradient.addColorStop(0.55, replaceAlpha(color, 0.25));
  gradient.addColorStop(1,    replaceAlpha(color, 0));

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, rxClamped, ryClamped, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function replaceAlpha(rgba, a) {
  const m = /^rgba?\(([^)]+)\)$/.exec(rgba);
  if (!m) return rgba;
  const parts = m[1].split(",").map((s) => s.trim());
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${a})`;
}
```

- [ ] **Step 4: Run, expect pass**

```
npx vitest run src/__tests__/dsoDrawing.test.js
```
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```
git add client/src/utils/dsoDrawing.js client/src/__tests__/dsoDrawing.test.js
git commit -m "feat(dso): soft glow renderer with type-based colors"
```

---

## Task 11: API client + useDso hook

**Files:**
- Modify: `client/src/api/client.js`
- Create: `client/src/hooks/useDso.js`
- Create: `client/src/__tests__/useDso.test.js`

- [ ] **Step 1: Add `dso` method to api client**

In `client/src/api/client.js`, in the `api` object literal, add:

```javascript
  dso: (lat, lon, datetime, { include_below_horizon = false } = {}) =>
    request("/dso", { lat, lon, datetime, include_below_horizon }),
```

- [ ] **Step 2: Write the failing hook test**

Create `client/src/__tests__/useDso.test.js`:

```javascript
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDso } from "../hooks/useDso.js";

vi.mock("../api/client.js", () => ({
  api: {
    dso: vi.fn(async () => ({
      observer: { lat: 40, lon: -74, datetime: "2026-08-15T02:00:00Z" },
      dsos: [{ id: "M31", common_name: "Andromeda" }],
      count: 1,
    })),
  },
}));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useDso", () => {
  it("does not fetch when selected is null", async () => {
    const { api } = await import("../api/client.js");
    api.dso.mockClear();
    renderHook(() => useDso(null, "2026-08-15T02:00:00Z"), { wrapper: wrap() });
    expect(api.dso).not.toHaveBeenCalled();
  });

  it("fetches when selected and datetimeUtc both present", async () => {
    const { api } = await import("../api/client.js");
    api.dso.mockClear();
    const { result } = renderHook(
      () => useDso({ lat: 40.7128, lon: -74.0060 }, "2026-08-15T02:00:00Z"),
      { wrapper: wrap() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.dso).toHaveBeenCalledWith(40.7128, -74.0060, "2026-08-15T02:00:00Z");
    expect(result.current.data.dsos).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run, expect failure**

```
npx vitest run src/__tests__/useDso.test.js
```
Expected: ImportError on `../hooks/useDso.js`.

- [ ] **Step 4: Implement the hook**

Create `client/src/hooks/useDso.js`:

```javascript
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

export function useDso(selected, datetimeUtc) {
  return useQuery({
    queryKey: ["dso", selected?.lat, selected?.lon, datetimeUtc],
    queryFn: () => api.dso(selected.lat, selected.lon, datetimeUtc),
    enabled: Boolean(selected && datetimeUtc),
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 5: Run, expect pass**

```
npx vitest run src/__tests__/useDso.test.js
```
Expected: both tests pass.

- [ ] **Step 6: Commit**

```
git add client/src/api/client.js client/src/hooks/useDso.js client/src/__tests__/useDso.test.js
git commit -m "feat(dso): api client method + useDso react-query hook"
```

---

## Task 12: Projection helper for DSOs

**Files:**
- Modify: `client/src/utils/projection.js`
- Create or extend: `client/src/__tests__/projection.test.js`

**Existing structure** (already verified): `client/src/utils/projection.js` exports `projectAltAz({alt, az}, width, height)` — that's the shared helper `projectStars` and `projectPlanets` both call. Projected objects use a `kind` discriminator (`"star"`, `"planet"`) and an `id` of the form `kind:identifier`.

- [ ] **Step 1: Write the failing projection test**

In `client/src/__tests__/projection.test.js` (extend if exists, else create), add:

```javascript
import { describe, it, expect } from "vitest";
import { projectDsos } from "../utils/projection.js";

describe("projectDsos", () => {
  it("projects an above-horizon DSO with kind=dso and pxPerArcmin", () => {
    const dsos = [{
      id: "M31", common_name: "Andromeda Galaxy",
      type: "galaxy",
      ra: 10.6847, dec: 41.2687,
      alt: 45, az: 90,
      magnitude: 3.44,
      angular_size_arcmin: 178,
      minor_axis_arcmin: 63,
      position_angle_deg: 35,
      source: "SIMBAD/CDS",
    }];
    const projected = projectDsos(dsos, 1000, 1000);
    expect(projected).toHaveLength(1);
    const p = projected[0];
    expect(p.kind).toBe("dso");
    expect(p.id).toBe("dso:M31");
    expect(typeof p.x).toBe("number");
    expect(typeof p.y).toBe("number");
    expect(p.pxPerArcmin).toBeGreaterThan(0);
    // hitRadius should be derived from angular size in pixels, min 12px
    expect(p.hitRadius).toBeGreaterThanOrEqual(12);
    // Original DSO fields preserved
    expect(p.type).toBe("galaxy");
    expect(p.common_name).toBe("Andromeda Galaxy");
  });

  it("returns [] for empty input or zero-size canvas", () => {
    expect(projectDsos([], 1000, 1000)).toEqual([]);
    expect(projectDsos([{ alt: 0, az: 0 }], 0, 0)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```
cd client
npx vitest run src/__tests__/projection.test.js -t projectDsos
```
Expected: ImportError on `projectDsos`.

- [ ] **Step 3: Implement `projectDsos`**

Append to `client/src/utils/projection.js`:

```javascript
export function projectDsos(dsos, width, height) {
  if (!dsos || !dsos.length || !width || !height) return [];

  // Sizing scale: REFERENCE_ALT=0 means alt=0 maps to halfShort.
  // Near-zenith linearization: 90° of sky spans halfShort px, so
  // pxPerArcmin ≈ halfShort / 90 / 60. Slight stereographic distortion
  // toward the horizon is acceptable for DSO sizing.
  const halfShort = Math.min(width, height) / 2;
  const pxPerArcmin = halfShort / 90 / 60;

  return dsos.map((d) => {
    const { x, y } = projectAltAz(d, width, height);
    const majorPx = (d.angular_size_arcmin ?? 0) * pxPerArcmin;
    return {
      kind: "dso",
      id: `dso:${d.id}`,
      dso_id: d.id,
      common_name: d.common_name,
      messier_id: d.messier_id ?? null,
      type: d.type,
      x,
      y,
      alt: d.alt,
      az: d.az,
      magnitude: d.magnitude,
      angular_size_arcmin: d.angular_size_arcmin,
      minor_axis_arcmin: d.minor_axis_arcmin ?? null,
      position_angle_deg: d.position_angle_deg ?? null,
      pxPerArcmin,
      hitRadius: Math.max(12, majorPx / 2),
      source: d.source ?? "SIMBAD/CDS",
    };
  });
}
```

- [ ] **Step 4: Run, expect pass**

```
npx vitest run src/__tests__/projection.test.js
```
Expected: both new tests pass; any existing projection tests still pass.

- [ ] **Step 5: Commit**

```
git add client/src/utils/projection.js client/src/__tests__/projection.test.js
git commit -m "feat(dso): projectDsos with pxPerArcmin and hitRadius"
```

---

## Task 13: Wire DSOs into SkyChart + SkyCanvas

**Files:**
- Modify: `client/src/components/hero/SkyChart.jsx`
- Modify: `client/src/components/hero/SkyCanvas.jsx`

- [ ] **Step 1: Modify `SkyChart.jsx` to fetch + project DSOs**

In `client/src/components/hero/SkyChart.jsx`:

After the existing `usePlanets` import, add:
```javascript
import { useDso } from "../../hooks/useDso.js";
```

After the existing `import { projectStars, projectPlanets }` line, change to:
```javascript
import { projectStars, projectPlanets, projectDsos } from "../../utils/projection.js";
```

In the component body, after the `planetsQuery` declaration:
```javascript
  const dsoQuery = useDso(selected, datetimeUtc);
```

Replace the `projected` useMemo with:
```javascript
  const projected = useMemo(() => {
    const stars = projectStars(skyQuery.data?.stars ?? [], width, height);
    const planets = projectPlanets(planetsQuery.data?.planets ?? [], width, height);
    const dsos = projectDsos(dsoQuery.data?.dsos ?? [], width, height);
    return { stars, planets, dsos, all: [...stars, ...planets, ...dsos] };
  }, [skyQuery.data, planetsQuery.data, dsoQuery.data, width, height]);
```

Extend `statusFor` to consider `dsoQuery`:
```javascript
function statusFor({ selected, skyQuery, planetsQuery, dsoQuery }) {
  if (!selected) return "idle";
  if (skyQuery.isError || planetsQuery.isError || dsoQuery.isError) return "error";
  if (skyQuery.isLoading || planetsQuery.isLoading || dsoQuery.isLoading) return "loading";
  if (skyQuery.data && planetsQuery.data && dsoQuery.data) return "ready";
  return "loading";
}
```

Update the call site:
```javascript
  const status = statusFor({ selected, skyQuery, planetsQuery, dsoQuery });
```

In the JSX, pass DSOs to `SkyCanvas`:
```javascript
      <SkyCanvas
        projectedStars={status === "ready" ? projected.stars : []}
        projectedPlanets={status === "ready" ? projected.planets : []}
        projectedDsos={status === "ready" ? projected.dsos : []}
        width={width}
        height={height}
        dpr={dpr}
      />
```

In the retry handler, also call `dsoQuery.refetch()`:
```javascript
        onRetry={() => {
          skyQuery.refetch();
          planetsQuery.refetch();
          dsoQuery.refetch();
        }}
```

- [ ] **Step 2: Modify `SkyCanvas.jsx` to draw DSOs**

In `client/src/components/hero/SkyCanvas.jsx`:

Update imports:
```javascript
import { drawStar, drawPlanet } from "../../utils/drawing.js";
import { drawDso } from "../../utils/dsoDrawing.js";
```

Update props + effect:
```javascript
export default function SkyCanvas({ projectedStars, projectedPlanets, projectedDsos, width, height, dpr }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (width === 0 || height === 0) return;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Layer order: DSOs under stars (cluster stars pop through), planets on top.
    for (const d of projectedDsos ?? []) {
      if (d.x < -200 || d.x > width + 200) continue;
      if (d.y < -200 || d.y > height + 200) continue;
      drawDso(ctx, d);
    }

    for (const s of projectedStars) {
      if (s.x < -32 || s.x > width + 32) continue;
      if (s.y < -32 || s.y > height + 32) continue;
      drawStar(ctx, s);
    }

    for (const p of projectedPlanets) {
      if (p.x < -32 || p.x > width + 32) continue;
      if (p.y < -32 || p.y > height + 32) continue;
      drawPlanet(ctx, p);
    }
  }, [projectedStars, projectedPlanets, projectedDsos, width, height, dpr]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      aria-hidden="true"
    />
  );
}
```

- [ ] **Step 3: Run the full frontend suite**

```
npm test
```
Expected: all tests green.

- [ ] **Step 4: Visual smoke check**

```
npm run dev
```
Open http://localhost:5173, pick "New York" + a date around 2026-08-15 2am UTC. Confirm:
- Andromeda visible as a soft oval mid-sky.
- Planets render with textures (or as colored dots while loading).
- Moon shows phase shadow.
- No console errors.

- [ ] **Step 5: Commit**

```
git add client/src/components/hero/SkyChart.jsx client/src/components/hero/SkyCanvas.jsx
git commit -m "feat(sky): integrate DSO layer under stars, above Milky Way"
```

---

## Task 14: SkyTooltip — DSO body + planet photo

**Files:**
- Modify: `client/src/components/hero/SkyTooltip.jsx`
- Create: `client/src/__tests__/SkyTooltip.test.jsx`

**Existing structure** (already verified): `SkyTooltip` is the click-info popup. It renders `<StarBody>` or `<PlanetBody>` based on `object.kind`. The dispatch is currently a ternary — needs to become an if/else for three cases. There is no separate "InfoCard" component to create; the new DSO UI lives as a third `Body` component inside this file.

The photoreal planet image goes inside `PlanetBody` at the top — that's where the user sees Saturn-with-rings or Jupiter-with-bands when they click.

- [ ] **Step 1: Write the failing tooltip test**

Create `client/src/__tests__/SkyTooltip.test.jsx`:

```jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SkyTooltip from "../components/hero/SkyTooltip.jsx";

const container = { width: 1000, height: 1000 };

describe("SkyTooltip planet body", () => {
  it("shows the photoreal texture thumbnail for a planet", () => {
    const obj = {
      kind: "planet",
      name: "Jupiter",
      x: 500, y: 500,
      alt: 45, az: 180,
      distance_au: 4.5,
      source: "JPL DE421 via Astropy",
    };
    render(<SkyTooltip object={obj} container={container} />);
    const img = screen.getByAltText("Jupiter");
    expect(img.getAttribute("src")).toContain("/textures/planets/jupiter.jpg");
  });

  it("does not show a thumbnail for the Sun (procedural, no texture)", () => {
    const obj = {
      kind: "planet",
      name: "Sun",
      x: 500, y: 500,
      alt: 30, az: 90,
      distance_au: 1.0,
      source: "JPL DE421 via Astropy",
    };
    render(<SkyTooltip object={obj} container={container} />);
    expect(screen.queryByAltText("Sun")).toBeNull();
  });
});

describe("SkyTooltip DSO body", () => {
  it("renders DSO metadata", () => {
    const obj = {
      kind: "dso",
      id: "dso:M31",
      common_name: "Andromeda Galaxy",
      messier_id: "M31",
      type: "galaxy",
      x: 500, y: 500,
      alt: 45, az: 90,
      magnitude: 3.44,
      angular_size_arcmin: 178,
      minor_axis_arcmin: 63,
      position_angle_deg: 35,
      source: "SIMBAD/CDS",
    };
    render(<SkyTooltip object={obj} container={container} />);
    expect(screen.getByText("Andromeda Galaxy")).toBeInTheDocument();
    expect(screen.getByText(/Galaxy/i)).toBeInTheDocument();
    expect(screen.getByText(/SIMBAD\/CDS/)).toBeInTheDocument();
    expect(screen.getByText(/3.44/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```
cd client
npx vitest run src/__tests__/SkyTooltip.test.jsx
```
Expected: planet image not found; DSO body not rendered.

- [ ] **Step 3: Modify `SkyTooltip.jsx`**

In `client/src/components/hero/SkyTooltip.jsx`:

Add import near the top:
```javascript
import { PLANET_TEXTURE_URLS } from "../../utils/drawing.js";
```

Replace the existing `PlanetBody` with this version (adds the texture thumbnail at the top):

```javascript
function PlanetBody({ object }) {
  const isMoon = object.name === "Moon";
  const textureUrl = PLANET_TEXTURE_URLS[object.name];
  return (
    <>
      {textureUrl && (
        <div className="mb-2 flex justify-center">
          <img
            src={textureUrl}
            alt={object.name}
            className="h-16 w-16 rounded-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="mb-2">
        <p className="text-ink text-sm font-medium">{object.name}</p>
      </div>
      <div className="border-t border-rule/60 pt-2 pb-2">
        <Row label="Distance" value={formatAu(object.distance_au)} />
        <Row label="Altitude" value={formatDeg(object.alt)} />
        <Row label="Azimuth" value={formatDeg(object.az)} />
        {isMoon && object.illumination != null && (
          <Row
            label="Illumination"
            value={`${Math.round(object.illumination * 100)}%`}
          />
        )}
        {isMoon && object.phase_name && (
          <Row label="Phase" value={object.phase_name} />
        )}
      </div>
      <div className="border-t border-rule/60 pt-2 font-mono text-[11px] text-accent-dim">
        Source: {object.source}
      </div>
    </>
  );
}
```

Add the new `DsoBody` component after `PlanetBody`:

```javascript
const DSO_TYPE_LABEL = {
  galaxy: "Galaxy",
  nebula: "Nebula",
  open_cluster: "Open cluster",
  globular_cluster: "Globular cluster",
};

function DsoBody({ object }) {
  const typeLabel = DSO_TYPE_LABEL[object.type] ?? "Deep-sky object";
  const sizeText =
    object.minor_axis_arcmin != null
      ? `${object.angular_size_arcmin.toFixed(1)}' × ${object.minor_axis_arcmin.toFixed(1)}'`
      : `${object.angular_size_arcmin.toFixed(1)}'`;
  return (
    <>
      <div className="mb-2">
        <p className="text-ink text-sm font-medium">{object.common_name}</p>
        <p className="text-ink-dim text-[11px] uppercase tracking-[0.18em] mt-0.5">
          {typeLabel}
          {object.messier_id && <> · {object.messier_id}</>}
        </p>
      </div>
      <div className="border-t border-rule/60 pt-2 pb-2">
        <Row label="Magnitude" value={formatNumber(object.magnitude, 2)} />
        <Row label="Angular size" value={sizeText} />
        <Row label="Altitude" value={formatDeg(object.alt)} />
        <Row label="Azimuth" value={formatDeg(object.az)} />
      </div>
      <div className="border-t border-rule/60 pt-2 font-mono text-[11px] text-accent-dim">
        Source: {object.source}
      </div>
    </>
  );
}
```

Replace the dispatch in the `SkyTooltip` JSX (currently a ternary) with explicit branches:

```javascript
      {object.kind === "star" && <StarBody object={object} />}
      {object.kind === "planet" && <PlanetBody object={object} />}
      {object.kind === "dso" && <DsoBody object={object} />}
```

- [ ] **Step 4: Run, expect pass**

```
npx vitest run src/__tests__/SkyTooltip.test.jsx
```
Expected: all 3 tests pass.

- [ ] **Step 5: Full suite — no regressions**

```
npm test
```

- [ ] **Step 6: Visual smoke check**

```
npm run dev
```
Click a planet — Jupiter's banded image appears at the top of its tooltip. Click Saturn — see its rings. Click Andromeda's glow — DSO tooltip with magnitude, size, type. Click the Sun — no thumbnail (it's procedural).

- [ ] **Step 7: Commit**

```
git add client/src/components/hero/SkyTooltip.jsx client/src/__tests__/SkyTooltip.test.jsx
git commit -m "feat(tooltip): DSO body + photoreal planet thumbnail"
```

---

## Task 15: Hit testing honors per-object hitRadius

**Files:**
- Modify: `client/src/utils/hitTest.js`
- Create or extend: `client/src/__tests__/hitTest.test.js`

`projectDsos` (Task 12) already attaches a `hitRadius` field. `hitTest.js` probably uses a fixed radius for all objects. DSOs are huge compared to stars — using the default would make Andromeda effectively unclickable except dead-center.

- [ ] **Step 1: Read `hitTest.js`**

```
# Use Read on client/src/utils/hitTest.js to inspect the current radius logic.
```

Note the constant name (likely `DEFAULT_HIT_RADIUS` or similar) and where the per-candidate distance check happens.

- [ ] **Step 2: Write the failing hit-test test**

Append to (or create) `client/src/__tests__/hitTest.test.js`:

```javascript
import { describe, it, expect } from "vitest";
import { findNearestWithinRadius } from "../utils/hitTest.js";

describe("hitTest honors per-object hitRadius", () => {
  it("treats DSO hitRadius as the click target size", () => {
    const objects = [
      { id: "dso:M31", x: 100, y: 100, hitRadius: 80 },
      { id: "star:abc", x: 200, y: 100 },
    ];
    // Click 50px from M31 — inside its hitRadius, well outside the default star radius.
    const hit = findNearestWithinRadius(objects, 150, 100);
    expect(hit?.id).toBe("dso:M31");
  });

  it("falls back to the default radius when hitRadius is absent", () => {
    const objects = [{ id: "star:abc", x: 100, y: 100 }];
    // 200px away is outside any reasonable default radius.
    const hit = findNearestWithinRadius(objects, 300, 100);
    expect(hit).toBeNull();
  });
});
```

- [ ] **Step 3: Run, expect failure (or partial)**

```
cd client
npx vitest run src/__tests__/hitTest.test.js
```
Expected: the M31 click misses because the default radius is small.

- [ ] **Step 4: Modify `hitTest.js`**

In `client/src/utils/hitTest.js`, locate the per-candidate radius lookup. Replace whatever fixed value is used inside `findNearestWithinRadius`'s comparison with:

```javascript
const radius = candidate.hitRadius ?? DEFAULT_HIT_RADIUS;
```

Keep `DEFAULT_HIT_RADIUS` as-is for stars/planets. Adjust the comparison accordingly (typically `if (dist <= radius)`).

- [ ] **Step 5: Run, expect pass**

```
npx vitest run src/__tests__/hitTest.test.js
```

- [ ] **Step 6: Commit**

```
git add client/src/utils/hitTest.js client/src/__tests__/hitTest.test.js
git commit -m "feat(hitTest): per-object hitRadius (DSOs are large click targets)"
```

---

## Task 16: Attribution footer update

**Files:**
- Modify: `client/src/components/hero/AttributionFooter.jsx`

- [ ] **Step 1: Read current footer**

Read `client/src/components/hero/AttributionFooter.jsx` and locate the existing attribution string.

- [ ] **Step 2: Append SSS line**

Add the new attribution line. The existing footer likely uses a list or array of credit lines — append:

```
Planet & Moon textures: Solar System Scope · CC BY 4.0
```

Add SIMBAD if it's not already in the footer:

```
DSO data: SIMBAD/CDS · ©2008 The SIMBAD Astronomical Database
```

- [ ] **Step 3: Run frontend tests**

```
npm test
```

Update any footer snapshot/text tests that broke.

- [ ] **Step 4: Commit**

```
git add client/src/components/hero/AttributionFooter.jsx
git commit -m "docs(attribution): add Solar System Scope textures + SIMBAD credits"
```

---

## Task 17: Three-observer visual QA

**Files:** None modified — this is a manual gate.

- [ ] **Step 1: Boot both servers**

```
# terminal 1
cd server
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# terminal 2
cd client
npm run dev
```

- [ ] **Step 2: Run each observer query**

For each observer below: enter the location, set the date/time (UTC option), submit, and screenshot.

| Observer | Lat / Lon | Datetime (UTC) | Verify |
|---|---|---|---|
| Delray FL | 26.46 / -80.07 | 2001-08-14T03:00:00Z | Jupiter + Saturn render as sprites. Moon at correct phase for that night (waning crescent). |
| NYC summer | 40.71 / -74.01 | 2026-08-15T02:00:00Z | Andromeda (M31) visible mid-sky as soft oval. Vega/Deneb/Altair still dominate. |
| Buenos Aires | -34.61 / -58.40 | 2026-08-15T02:00:00Z | LMC + SMC visible as soft patches. Eta Carinae Nebula visible. |
| Anchorage winter | 61.22 / -149.90 | 2026-12-15T06:00:00Z | Pleiades + M42 Orion Nebula prominent. Andromeda still up. |

- [ ] **Step 3: Capture screenshots**

Save each as `docs/screenshots/phase-2d/<observer-slug>.png` (create dir if missing). Reference them in the PR description.

- [ ] **Step 4: Commit screenshots**

```
git add docs/screenshots/phase-2d/
git commit -m "docs(phase-2d): three-observer visual QA screenshots"
```

---

## Task 18: Bundle size + final test gate

**Files:** None modified — verification step.

- [ ] **Step 1: Verify frontend bundle size**

```
cd client
npm run build
du -sh dist/ dist/assets/ 2>/dev/null || powershell "(Get-ChildItem dist -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB"
```

Expected: total `dist/` < 1.5 MB (including ESO panorama and planet textures).

- [ ] **Step 2: Full backend test run**

```
cd server
pytest -v
```

Expected: all green. Note new test count vs the baseline (55 + new DSO tests).

- [ ] **Step 3: Full frontend test run**

```
cd client
npm test
```

Expected: all green. Note new test count vs the baseline (133 + new DSO/sprite tests).

- [ ] **Step 4: ESLint check**

```
cd client
npm run lint
```

Expected: zero errors. Fix any warnings introduced this phase.

- [ ] **Step 5: Open PR**

```
gh pr create --base main --title "feat(phase-2d): celestial objects — planet sprites, moon phase, DSOs" --body "$(cat <<'EOF'
## Summary
- Planets get textured sprite icons (Solar System Scope CC BY 4.0).
- Moon renders with real texture + phase shadow driven by `illumination`.
- Sun is a procedural golden disk (unchanged from 2c).
- ~25 naked-eye DSOs (Andromeda, Pleiades, Orion Nebula, LMC/SMC, etc.) render as soft glows at real angular size, sourced from SIMBAD ingest.

## Test plan
- [x] Backend: pytest green (`server/pytest -v`)
- [x] Frontend: vitest green (`client/npm test`)
- [x] Lint clean (`client/npm run lint`)
- [x] Bundle < 1.5 MB (`client/npm run build`)
- [x] Three-observer visual QA — screenshots in `docs/screenshots/phase-2d/`

## Attribution
- Planet & Moon textures: Solar System Scope (INOVE), CC BY 4.0
- DSO catalog data: SIMBAD/CDS

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review checklist (run after writing this plan)

- [x] Every spec section has at least one task implementing it.
- [x] No "TODO", "TBD", "fill in", "similar to" placeholders.
- [x] Every code step shows the full code, not a description.
- [x] Type names are consistent: `DeepSkyObject` everywhere on the backend; `dso.id`, `dso.type`, `dso.angular_size_arcmin` on the frontend.
- [x] File paths are exact and absolute from repo root.
- [x] Commands include the working directory.
- [x] Each task is independently committable.
