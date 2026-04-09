# Phase 2a — Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the SkyVault frontend foundation — Vite + React + Tailwind scaffold with a dark galactic shell, ESO Milky Way background, Photon-powered place-name search, styled info panels rendering real Gaia DR3 + JPL DE421 data, and an intro animation + idle-aware chrome state machine.

**Architecture:** Single vertical-stack layout under `client/`, backed by a small backend extension (Moon phase fields + `/api/v1/geocode` proxy). Canvas 2D sky chart rendering is deferred to Phase 2b; a "coming soon" hero region holds the slot. State split across two Zustand stores (`observerStore` for semantics, `uiStateStore` for visual chrome) with React Query for all server data.

**Tech Stack:**
- **Frontend:** React 18, Vite, Tailwind CSS, Zustand, @tanstack/react-query, Vitest + React Testing Library
- **Backend:** FastAPI + Astropy (existing) + new Photon HTTP proxy via `httpx` (already installed)
- **Asset:** ESO Gigagalaxy Zoom Milky Way (CC-BY 4.0) as WebP background
- **Typography:** Cormorant Garamond + JetBrains Mono (Google Fonts)

**Spec reference:** `docs/superpowers/specs/2026-04-08-phase-2a-frontend-foundation-design.md`

**Reality-check notes vs spec:**
- `httpx>=0.27` is **already** in `server/requirements.txt` (line 12). No dep addition required.
- CORS middleware is **already** configured in `server/app/main.py` with `settings.cors_origins = ["http://localhost:5173"]`. No CORS changes needed.
- Backend `Planet` schema has no Moon phase fields today — Part A adds them.
- Backend `Star` schema has no `name`/`designation` fields — frontend uses `source_id` as fallback per spec §8.17.

---

## Table of Contents

- **Part A — Backend extensions** (Tasks A1–A8)
- **Part B — Frontend scaffold** (Tasks B1–B5)
- **Part C — State, hooks, utilities** (Tasks C1–C9)
- **Part D — Layout shell** (Tasks D1–D6)
- **Part E — Controls strip** (Tasks E1–E5)
- **Part F — Hero + info panels** (Tasks F1–F5)
- **Part G — Frontend tests** (Tasks G1–G4)
- **Part H — Assets + docs** (Tasks H1–H3)

---

## File Structure

### Backend additions (under `server/`)
```
server/
├── app/
│   ├── main.py                              # MODIFIED — mount geocode router
│   ├── models/
│   │   └── schemas.py                       # MODIFIED — extend Planet with Moon phase fields
│   ├── routers/
│   │   └── geocode.py                       # NEW — GET /api/v1/geocode
│   ├── services/
│   │   ├── ephemeris.py                     # MODIFIED — compute Moon phase in planet loop
│   │   └── geocoder.py                      # NEW — Photon HTTP client + TTL cache
│   └── schemas/                             # NEW directory
│       ├── __init__.py                      # NEW
│       └── geocode.py                       # NEW — GeocodeCandidate + GeocodeResponse
├── tests/
│   ├── test_ephemeris.py                    # MODIFIED — moon phase assertions
│   ├── test_geocoder.py                     # NEW — unit, mocked httpx
│   ├── test_geocode_endpoint.py             # NEW — integration, mocked service
│   └── test_geocoder_acceptance.py          # NEW — network-marked
├── pytest.ini                               # MODIFIED — register `network` marker
```

### Frontend additions (under `client/`, new directory)
```
client/
├── public/
│   └── milky-way.webp                       # ESO asset, user-sourced via Task H1
├── src/
│   ├── api/
│   │   └── client.js                        # fetch wrapper, base URL
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppBackground.jsx
│   │   │   ├── FrameContainer.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── Footer.jsx
│   │   │   └── IntroSequence.jsx
│   │   ├── hero/
│   │   │   ├── HeroRegion.jsx
│   │   │   └── ExploreIn3DButton.jsx
│   │   ├── controls/
│   │   │   ├── ControlsStrip.jsx
│   │   │   ├── LocationInput.jsx
│   │   │   ├── DidYouMeanDropdown.jsx
│   │   │   ├── UseMyLocationButton.jsx
│   │   │   ├── DateInput.jsx
│   │   │   ├── TimeInput.jsx
│   │   │   ├── TimezoneToggle.jsx
│   │   │   └── SubmitButton.jsx
│   │   ├── info/
│   │   │   ├── InfoPanelsGrid.jsx
│   │   │   ├── LunarPanel.jsx
│   │   │   ├── MoonSvg.jsx
│   │   │   ├── PlanetsPanel.jsx
│   │   │   ├── StarsPanel.jsx
│   │   │   └── SourceBadge.jsx
│   │   └── ui/
│   │       ├── Panel.jsx
│   │       ├── Button.jsx
│   │       ├── LoadingSkeleton.jsx
│   │       └── ErrorCard.jsx
│   ├── hooks/
│   │   ├── useFSM.js
│   │   ├── useGeocode.js
│   │   ├── useSky.js
│   │   ├── usePlanets.js
│   │   ├── useGeolocation.js
│   │   ├── useIdle.js
│   │   └── useIntroSequence.js
│   ├── stores/
│   │   ├── observerStore.js
│   │   └── uiStateStore.js
│   ├── utils/
│   │   ├── formatCoords.js
│   │   ├── formatDatetime.js
│   │   ├── bvToColor.js
│   │   └── magnitudeToSize.js
│   ├── styles/
│   │   └── global.css
│   ├── __tests__/
│   │   ├── observerStore.test.js
│   │   ├── uiStateStore.test.js
│   │   ├── useIdle.test.js
│   │   ├── useIntroSequence.test.js
│   │   ├── LocationInput.test.jsx
│   │   └── App.test.jsx
│   ├── App.jsx
│   └── main.jsx
├── .eslintrc.cjs
├── .prettierrc
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── vitest.config.js
```

### Documentation updates
```
SKYVAULT_ROADMAP.md                          # MODIFIED — Phase 2 split, Three.js pivot
CLAUDE.md                                    # MODIFIED — Phase Status + Resume Here
```

---

## Part A — Backend Extensions

The frontend needs two things from the backend that don't exist yet:
1. **Moon phase data** — `LunarPanel` displays phase name + illumination, and those values MUST come from real ephemeris per CLAUDE.md's accuracy rule. We extend the existing `/planets` response.
2. **Geocoder proxy** — `/api/v1/geocode` wrapping the Photon OSM API, keyed + cached in memory.

Both are small and they're independent. Do moon phase first (smaller blast radius, only touches existing code), then the geocoder (new files, no changes to existing endpoints).

---

### Task A1: Extend `Planet` schema with optional Moon phase fields

**Files:**
- Modify: `server/app/models/schemas.py`

- [ ] **Step 1: Add optional Moon phase fields to the `Planet` model**

Open `server/app/models/schemas.py` and replace the `Planet` class with:

```python
class Planet(BaseModel):
    """A single solar system body in the observer's sky.

    ``phase_angle``, ``illumination``, and ``phase_name`` are populated only
    for the Moon. They're ``None`` for every other body (the Sun has no phase
    against itself; the naked-eye planets have phases but they're tiny and
    not useful at v1's visual fidelity).
    """

    name: str
    alt: float
    az: float
    distance_au: float
    phase_angle: float | None = None        # degrees; 0 = new, 180 = full
    illumination: float | None = None       # [0, 1] fraction illuminated
    phase_name: str | None = None           # e.g. "waxing crescent"
    source: str = "JPL DE421 via Astropy"
```

- [ ] **Step 2: Verify the rest of `schemas.py` is unchanged**

`Observer`, `Star`, `SkyResponse`, and `PlanetsResponse` should be untouched. The additions are backward compatible — all new fields default to `None`.

- [ ] **Step 3: Commit**

```bash
git add server/app/models/schemas.py
git commit -m "feat(api): extend Planet schema with optional Moon phase fields"
```

---

### Task A2: Write failing test for Moon phase computation

**Files:**
- Modify: `server/tests/test_ephemeris.py`

- [ ] **Step 1: Add Moon phase tests at the bottom of `test_ephemeris.py`**

Append these tests to the file (after `test_horizon_only_filter_removes_below_horizon_bodies`):

```python
def test_moon_has_phase_fields():
    """The Moon entry should include phase_angle, illumination, and phase_name."""
    results = ephemeris.compute_planet_positions(
        observer_lat=MIAMI_LAT,
        observer_lon=MIAMI_LON,
        observer_time="2026-01-15T02:00:00Z",
    )
    moon = _by_name(results)["moon"]
    assert moon["phase_angle"] is not None
    assert moon["illumination"] is not None
    assert moon["phase_name"] is not None


def test_moon_phase_angle_in_valid_range():
    """Phase angle is the Sun-Moon-Earth angle at the observer. Always [0°, 180°]."""
    results = ephemeris.compute_planet_positions(
        observer_lat=MIAMI_LAT,
        observer_lon=MIAMI_LON,
        observer_time="2026-01-15T02:00:00Z",
    )
    moon = _by_name(results)["moon"]
    assert 0.0 <= moon["phase_angle"] <= 180.0


def test_moon_illumination_matches_phase_angle_identity():
    """Physics identity: fractional illumination k = (1 + cos(phase_angle)) / 2.

    At phase_angle = 0 (full), k = 1. At phase_angle = 90, k = 0.5. At 180
    (new), k = 0. If this relationship fails we're computing one of the two
    incorrectly.
    """
    import math

    results = ephemeris.compute_planet_positions(
        observer_lat=MIAMI_LAT,
        observer_lon=MIAMI_LON,
        observer_time="2026-01-15T02:00:00Z",
    )
    moon = _by_name(results)["moon"]
    phase_rad = math.radians(moon["phase_angle"])
    expected_k = (1.0 + math.cos(phase_rad)) / 2.0
    assert abs(moon["illumination"] - expected_k) < 1e-6


def test_moon_full_near_2026_01_03():
    """2026-01-03 ~18:00 UTC is near a full moon per published almanacs
    (e.g. timeanddate.com). Illumination should be > 0.97 and phase name
    should be 'full moon' or 'waning gibbous' (close-to-full ambiguity is OK).
    """
    results = ephemeris.compute_planet_positions(
        observer_lat=MIAMI_LAT,
        observer_lon=MIAMI_LON,
        observer_time="2026-01-03T18:00:00Z",
    )
    moon = _by_name(results)["moon"]
    assert moon["illumination"] > 0.97
    assert moon["phase_name"] in {"full moon", "waxing gibbous", "waning gibbous"}


def test_non_moon_bodies_have_null_phase_fields():
    """Sun, Mercury, Mars, etc. should return None for phase fields — we
    intentionally only populate them for the Moon in v1."""
    results = ephemeris.compute_planet_positions(
        observer_lat=MIAMI_LAT,
        observer_lon=MIAMI_LON,
        observer_time="2026-01-15T02:00:00Z",
    )
    for body in results:
        if body["name"] == "moon":
            continue
        assert body.get("phase_angle") is None, f"{body['name']} has phase_angle"
        assert body.get("illumination") is None, f"{body['name']} has illumination"
        assert body.get("phase_name") is None, f"{body['name']} has phase_name"
```

- [ ] **Step 2: Run the tests — expect failures**

```bash
cd server
pytest tests/test_ephemeris.py -v -k "moon_has_phase or phase_angle_in_valid or illumination_matches or full_near or non_moon_bodies"
```

Expected: 5 FAILS with `KeyError: 'phase_angle'` or `AssertionError: ... is not None`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add server/tests/test_ephemeris.py
git commit -m "test(ephemeris): add Moon phase assertions (failing)"
```

---

### Task A3: Implement Moon phase in `ephemeris.py`

**Files:**
- Modify: `server/app/services/ephemeris.py`

- [ ] **Step 1: Add phase-name classifier helper at module level**

Open `server/app/services/ephemeris.py` and add these helpers just above the `compute_planet_positions` function:

```python
import math


def _phase_name_from_angle_and_trend(phase_angle_deg: float, waxing: bool) -> str:
    """Map (phase_angle, waxing/waning) to a human phase name.

    Phase angle is the Sun-Moon-Earth angle:
      - 0°   → full moon (Sun opposite Moon)
      - 90°  → first/last quarter
      - 180° → new moon (Sun near Moon)

    ``waxing`` disambiguates the two halves of the cycle: from new → full the
    Moon is waxing, from full → new it is waning.
    """
    # Illumination bucket (same for both halves)
    if phase_angle_deg < 7.0:
        return "full moon"
    if phase_angle_deg > 173.0:
        return "new moon"
    if abs(phase_angle_deg - 90.0) < 7.0:
        return "first quarter" if waxing else "last quarter"
    if phase_angle_deg < 90.0:
        return "waxing gibbous" if waxing else "waning gibbous"
    # 90 < phase_angle < 173
    return "waxing crescent" if waxing else "waning crescent"


def _compute_moon_phase(
    moon_gcrs,
    sun_gcrs,
    obs_time: Time,
) -> tuple[float, float, str]:
    """Return (phase_angle_deg, illumination_fraction, phase_name).

    Phase angle is the Sun-Moon-Earth angle, computed from the geocentric
    position vectors of the Sun and Moon. Illumination follows the standard
    identity ``k = (1 + cos(phase_angle)) / 2``.

    Waxing vs waning is determined by comparing the current phase angle to the
    phase angle 6 hours earlier: if the Moon is getting more illuminated
    (phase angle decreasing toward 0°/full), it's waxing — no wait, phase
    angle increases from 0 (full) to 180 (new). Reversed: phase angle
    decreasing → approaching full → WANING after full is the opposite. Use
    the lunar age instead: compare ecliptic longitudes.

    We take the simpler, robust path: sample phase_angle at obs_time and
    obs_time + 6h; if the later sample is larger → approaching new → waning;
    if smaller → approaching full → waxing. A 6-hour delta is plenty to
    disambiguate the Moon's mean motion of ~12°/day.
    """
    # Current geocentric vectors
    moon_xyz = moon_gcrs.cartesian.xyz.to(u.au).value
    sun_xyz = sun_gcrs.cartesian.xyz.to(u.au).value

    # Phase angle at Earth: angle between -moon_vector and sun_vector
    # (seen from the Moon, toward Earth and toward Sun). Equivalently:
    # angle between moon_vector and sun_vector seen from Earth, then 180° - that.
    # Use the standard formula directly.
    dot = float(
        (moon_xyz[0] * sun_xyz[0] + moon_xyz[1] * sun_xyz[1] + moon_xyz[2] * sun_xyz[2])
    )
    moon_mag = float(math.sqrt(sum(v * v for v in moon_xyz)))
    sun_mag = float(math.sqrt(sum(v * v for v in sun_xyz)))
    cos_elong = dot / (moon_mag * sun_mag)
    cos_elong = max(-1.0, min(1.0, cos_elong))   # clamp for numerical safety
    elongation = math.acos(cos_elong)
    # Phase angle is the Sun-Moon-Earth angle; for distant Sun,
    # phase_angle ≈ π - elongation (see Meeus, Astronomical Algorithms §48).
    phase_angle_rad = math.pi - elongation
    phase_angle_deg = math.degrees(phase_angle_rad)

    illumination = (1.0 + math.cos(phase_angle_rad)) / 2.0

    # Determine waxing vs waning by sampling 6 hours later
    future_time = obs_time + 6 * u.hour
    future_moon = get_body("moon", future_time)
    future_sun = get_body("sun", future_time)
    fm_xyz = future_moon.cartesian.xyz.to(u.au).value
    fs_xyz = future_sun.cartesian.xyz.to(u.au).value
    f_dot = float(
        (fm_xyz[0] * fs_xyz[0] + fm_xyz[1] * fs_xyz[1] + fm_xyz[2] * fs_xyz[2])
    )
    f_moon_mag = float(math.sqrt(sum(v * v for v in fm_xyz)))
    f_sun_mag = float(math.sqrt(sum(v * v for v in fs_xyz)))
    f_cos_elong = f_dot / (f_moon_mag * f_sun_mag)
    f_cos_elong = max(-1.0, min(1.0, f_cos_elong))
    f_elongation = math.acos(f_cos_elong)
    f_phase_angle = math.pi - f_elongation

    # If phase angle is decreasing → approaching 0 (full) → waxing past new
    # toward full. If increasing → approaching 180 (new) → waning past full.
    waxing = f_phase_angle < phase_angle_rad

    phase_name = _phase_name_from_angle_and_trend(phase_angle_deg, waxing)
    return phase_angle_deg, illumination, phase_name
```

- [ ] **Step 2: Wire phase computation into the main loop**

Replace the body of `compute_planet_positions` (the `with solar_system_ephemeris.set(kernel):` block) with:

```python
    with solar_system_ephemeris.set(kernel):
        # Precompute the Sun's geocentric position once for the moon phase
        # calculation. We still re-query it inside the loop so the returned
        # Sun entry uses the same call path as every other body — but we
        # stash the SkyCoord here for phase computation.
        sun_gcrs_at_obs = get_body("sun", obs_time)

        for name in BODIES:
            body = get_body(name, obs_time, location)
            altaz = body.transform_to(altaz_frame)
            alt_deg = float(altaz.alt.to(u.deg).value)
            az_deg = float(altaz.az.to(u.deg).value)
            distance_au = float(body.distance.to(u.au).value)

            if horizon_only and alt_deg < 0.0:
                continue

            entry: dict = {
                "name": name,
                "alt": alt_deg,
                "az": az_deg,
                "distance_au": distance_au,
                "source": SOURCE_LABEL,
                "phase_angle": None,
                "illumination": None,
                "phase_name": None,
            }

            if name == "moon":
                # Use the non-topocentric (geocentric) Moon for phase math —
                # parallax of ~1° doesn't meaningfully shift the Sun-Moon-Earth
                # angle, and geocentric is the canonical frame for lunar phase.
                moon_geocentric = get_body("moon", obs_time)
                phase_deg, illum, phase_name = _compute_moon_phase(
                    moon_geocentric, sun_gcrs_at_obs, obs_time
                )
                entry["phase_angle"] = phase_deg
                entry["illumination"] = illum
                entry["phase_name"] = phase_name

            results.append(entry)

    return results
```

- [ ] **Step 3: Run the Moon phase tests — expect pass**

```bash
cd server
pytest tests/test_ephemeris.py -v
```

Expected: all existing ephemeris tests PASS + 5 new Moon phase tests PASS. If `test_moon_full_near_2026_01_03` fails by 1-2 days of phase drift, check your date/time interpretation — the 2026-01-03T18:00 Z value was cross-referenced against a published lunar calendar.

- [ ] **Step 4: Update the `planets.py` router to pass through the new fields**

Open `server/app/routers/planets.py` and replace the `Planet(...)` list comprehension with:

```python
    planets = [
        Planet(
            name=body["name"],
            alt=body["alt"],
            az=body["az"],
            distance_au=body["distance_au"],
            phase_angle=body.get("phase_angle"),
            illumination=body.get("illumination"),
            phase_name=body.get("phase_name"),
            source=body["source"],
        )
        for body in results
    ]
```

- [ ] **Step 5: Run the planet API tests to verify the router still works**

```bash
cd server
pytest tests/test_api_planets.py -v
```

Expected: all existing planet API tests PASS. The response now includes the new optional fields but old assertions still match because they're additive.

- [ ] **Step 6: Commit**

```bash
git add server/app/services/ephemeris.py server/app/routers/planets.py
git commit -m "feat(ephemeris): compute Moon phase angle, illumination, phase name"
```

---

### Task A4: Register the `network` pytest marker

**Files:**
- Modify: `server/pytest.ini`

- [ ] **Step 1: Add the marker registration**

Replace the contents of `server/pytest.ini` with:

```ini
[pytest]
testpaths = tests
pythonpath = .
markers =
    network: tests that hit real external network services. Run with `pytest -m network`.
```

- [ ] **Step 2: Verify pytest sees the marker**

```bash
cd server
pytest --markers | grep network
```

Expected: `@pytest.mark.network: tests that hit real external network services...`

- [ ] **Step 3: Commit**

```bash
git add server/pytest.ini
git commit -m "test: register 'network' pytest marker for acceptance tests"
```

---

### Task A5: Create geocode Pydantic schemas

**Files:**
- Create: `server/app/schemas/__init__.py`
- Create: `server/app/schemas/geocode.py`

The existing backend uses `server/app/models/schemas.py` for response models. We introduce a parallel `server/app/schemas/` package for feature-scoped schemas (geocoder is not an "astronomical object"; keeping it separate avoids polluting `models/schemas.py`). Old code is untouched.

- [ ] **Step 1: Create the package init file**

Create `server/app/schemas/__init__.py` with a single line:

```python
"""Feature-scoped Pydantic schemas (non-astronomical responses)."""
```

- [ ] **Step 2: Create `server/app/schemas/geocode.py`**

```python
"""Pydantic schemas for the /api/v1/geocode endpoint.

Wraps Photon's GeoJSON FeatureCollection response in a smaller,
frontend-friendly shape. Every candidate carries the ``source`` string so
the UI can render the attribution badge.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class GeocodeCandidate(BaseModel):
    display_name: str = Field(..., description="Human-readable, e.g. 'Portoviejo, Manabí, Ecuador'")
    name: str = Field(..., description="Short place name, e.g. 'Portoviejo'")
    country: str | None = None
    state: str | None = None
    lat: float = Field(..., ge=-90.0, le=90.0)
    lon: float = Field(..., ge=-180.0, le=180.0)
    osm_type: str | None = None
    osm_id: str | None = None
    place_type: str | None = None


class GeocodeResponse(BaseModel):
    query: str
    candidates: list[GeocodeCandidate]
    count: int
    source: str = "Photon (photon.komoot.io) / OpenStreetMap"
```

- [ ] **Step 3: Commit**

```bash
git add server/app/schemas/
git commit -m "feat(api): add geocode Pydantic schemas"
```

---

### Task A6: Write failing unit tests for the geocoder service

**Files:**
- Create: `server/tests/test_geocoder.py`

- [ ] **Step 1: Create the test file with failing tests**

```python
"""Unit tests for the Photon geocoder service.

All tests mock httpx so they're network-free. Real-network acceptance tests
live in test_geocoder_acceptance.py and are gated behind the 'network' mark.
"""

from __future__ import annotations

import time
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.services import geocoder


# A minimal Photon-shaped GeoJSON response with two candidates
SAMPLE_PHOTON_RESPONSE = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [-80.4544, -1.0569]},
            "properties": {
                "name": "Portoviejo",
                "country": "Ecuador",
                "state": "Manabí",
                "osm_type": "N",
                "osm_id": 123456789,
                "type": "city",
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [-80.20, -1.10]},
            "properties": {
                "name": "Portoviejo Rural",
                "country": "Ecuador",
                "state": "Manabí",
                "osm_type": "N",
                "osm_id": 987654321,
                "type": "village",
            },
        },
    ],
}


@pytest.fixture(autouse=True)
def clear_cache():
    """Each test starts with an empty cache."""
    geocoder._CACHE.clear()
    yield
    geocoder._CACHE.clear()


@pytest.mark.asyncio
async def test_geocode_returns_parsed_candidates():
    mock_response = httpx.Response(200, json=SAMPLE_PHOTON_RESPONSE)
    with patch.object(httpx.AsyncClient, "get", AsyncMock(return_value=mock_response)):
        result = await geocoder.geocode("Portoviejo", limit=5, lang="en")

    assert result.query == "Portoviejo"
    assert result.count == 2
    assert len(result.candidates) == 2
    first = result.candidates[0]
    assert first.name == "Portoviejo"
    assert first.country == "Ecuador"
    assert first.state == "Manabí"
    assert abs(first.lat - (-1.0569)) < 1e-6
    assert abs(first.lon - (-80.4544)) < 1e-6
    assert first.display_name == "Portoviejo, Manabí, Ecuador"
    assert result.source == "Photon (photon.komoot.io) / OpenStreetMap"


@pytest.mark.asyncio
async def test_geocode_empty_result():
    mock_response = httpx.Response(200, json={"type": "FeatureCollection", "features": []})
    with patch.object(httpx.AsyncClient, "get", AsyncMock(return_value=mock_response)):
        result = await geocoder.geocode("ZzzzzNonexistent", limit=5, lang="en")

    assert result.count == 0
    assert result.candidates == []


@pytest.mark.asyncio
async def test_geocode_cache_hit_does_not_call_httpx_twice():
    mock_response = httpx.Response(200, json=SAMPLE_PHOTON_RESPONSE)
    mock_get = AsyncMock(return_value=mock_response)
    with patch.object(httpx.AsyncClient, "get", mock_get):
        await geocoder.geocode("Portoviejo", limit=5, lang="en")
        await geocoder.geocode("Portoviejo", limit=5, lang="en")
    assert mock_get.call_count == 1


@pytest.mark.asyncio
async def test_geocode_cache_key_ignores_case_and_whitespace():
    mock_response = httpx.Response(200, json=SAMPLE_PHOTON_RESPONSE)
    mock_get = AsyncMock(return_value=mock_response)
    with patch.object(httpx.AsyncClient, "get", mock_get):
        await geocoder.geocode("Portoviejo", limit=5, lang="en")
        await geocoder.geocode("  portoviejo  ", limit=5, lang="en")
        await geocoder.geocode("PORTOVIEJO", limit=5, lang="en")
    assert mock_get.call_count == 1


@pytest.mark.asyncio
async def test_geocode_cache_ttl_expiry():
    mock_response = httpx.Response(200, json=SAMPLE_PHOTON_RESPONSE)
    mock_get = AsyncMock(return_value=mock_response)
    with patch.object(httpx.AsyncClient, "get", mock_get):
        await geocoder.geocode("Portoviejo", limit=5, lang="en")

        # Fake time advance past TTL
        with patch.object(
            geocoder.time, "time",
            return_value=time.time() + geocoder.CACHE_TTL_SECONDS + 1,
        ):
            await geocoder.geocode("Portoviejo", limit=5, lang="en")
    assert mock_get.call_count == 2


@pytest.mark.asyncio
async def test_geocode_cache_eviction_drops_oldest():
    """Fill the cache to MAX+1 entries and verify the oldest are evicted."""
    mock_response = httpx.Response(200, json={"type": "FeatureCollection", "features": []})
    with patch.object(httpx.AsyncClient, "get", AsyncMock(return_value=mock_response)):
        for i in range(geocoder.CACHE_MAX_ENTRIES + geocoder.CACHE_EVICT_BATCH + 1):
            await geocoder.geocode(f"query_{i}", limit=5, lang="en")
    assert len(geocoder._CACHE) <= geocoder.CACHE_MAX_ENTRIES


@pytest.mark.asyncio
async def test_geocode_upstream_timeout_raises_unavailable():
    with patch.object(
        httpx.AsyncClient, "get", AsyncMock(side_effect=httpx.TimeoutException("slow"))
    ):
        with pytest.raises(geocoder.GeocoderUnavailableError):
            await geocoder.geocode("Portoviejo", limit=5, lang="en")


@pytest.mark.asyncio
async def test_geocode_upstream_5xx_raises_upstream_error():
    mock_response = httpx.Response(503, json={"error": "service down"})
    with patch.object(httpx.AsyncClient, "get", AsyncMock(return_value=mock_response)):
        with pytest.raises(geocoder.GeocoderUpstreamError):
            await geocoder.geocode("Portoviejo", limit=5, lang="en")


@pytest.mark.asyncio
async def test_geocode_display_name_without_state():
    payload = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [2.35, 48.85]},
                "properties": {
                    "name": "Paris",
                    "country": "France",
                    "osm_type": "R",
                    "osm_id": 7444,
                    "type": "city",
                },
            }
        ],
    }
    mock_response = httpx.Response(200, json=payload)
    with patch.object(httpx.AsyncClient, "get", AsyncMock(return_value=mock_response)):
        result = await geocoder.geocode("Paris", limit=5, lang="en")
    assert result.candidates[0].display_name == "Paris, France"
```

- [ ] **Step 2: Install `pytest-asyncio` if not already present**

Check `server/requirements.txt` — if `pytest-asyncio` is not listed, add it:

```bash
cd server
pip show pytest-asyncio || pip install pytest-asyncio
```

Then add to `requirements.txt`:
```
pytest-asyncio>=0.23.0
```

If `pytest-asyncio` was already present, skip the `requirements.txt` edit.

- [ ] **Step 3: Configure pytest-asyncio mode in `pytest.ini`**

Update `server/pytest.ini` to:
```ini
[pytest]
testpaths = tests
pythonpath = .
asyncio_mode = auto
markers =
    network: tests that hit real external network services. Run with `pytest -m network`.
```

- [ ] **Step 4: Run the failing tests**

```bash
cd server
pytest tests/test_geocoder.py -v
```

Expected: all 9 tests FAIL with `ModuleNotFoundError: app.services.geocoder`.

- [ ] **Step 5: Commit the failing tests**

```bash
git add server/tests/test_geocoder.py server/pytest.ini server/requirements.txt
git commit -m "test(geocoder): add unit tests with mocked httpx (failing)"
```

---

### Task A7: Implement the geocoder service

**Files:**
- Create: `server/app/services/geocoder.py`

- [ ] **Step 1: Create the service module**

```python
"""Photon (OSM) geocoder client with in-memory TTL cache.

Why Photon:
    - Free and public (no API key required for reasonable use).
    - Designed for autocomplete — fast responses, no rate-limit traps for
      interactive use.
    - Backed by OpenStreetMap data: global coverage, decent accuracy for
      cities/towns/villages anywhere on Earth.
    - Returns GeoJSON FeatureCollection which is straightforward to parse.

Caching strategy:
    In-memory dict keyed on (query.lower().strip(), limit, lang). Entries
    have a 1-hour TTL. When the cache grows past CACHE_MAX_ENTRIES, we sort
    by insertion time and drop the oldest CACHE_EVICT_BATCH entries. This
    is deliberately simple — async-lru and cachetools would both work but
    add a dep for what's ~30 lines of code.
"""

from __future__ import annotations

import time

import httpx

from app.schemas.geocode import GeocodeCandidate, GeocodeResponse


PHOTON_BASE_URL = "https://photon.komoot.io/api"
USER_AGENT = "SkyVault/0.1 (https://github.com/AndrewRobalino/skyvault)"
REQUEST_TIMEOUT_SECONDS = 10.0
CACHE_TTL_SECONDS = 3600
CACHE_MAX_ENTRIES = 256
CACHE_EVICT_BATCH = 32

# Module-level cache: {cache_key: (cached_at_epoch, GeocodeResponse)}
_CACHE: dict[tuple[str, int, str], tuple[float, GeocodeResponse]] = {}


class GeocoderUnavailableError(RuntimeError):
    """Raised when Photon is unreachable or times out."""


class GeocoderUpstreamError(RuntimeError):
    """Raised when Photon returns a non-2xx status code."""


def _make_cache_key(query: str, limit: int, lang: str) -> tuple[str, int, str]:
    return (query.strip().lower(), limit, lang)


def _cache_get(key: tuple[str, int, str]) -> GeocodeResponse | None:
    entry = _CACHE.get(key)
    if entry is None:
        return None
    cached_at, response = entry
    if time.time() - cached_at > CACHE_TTL_SECONDS:
        _CACHE.pop(key, None)
        return None
    return response


def _cache_put(key: tuple[str, int, str], response: GeocodeResponse) -> None:
    _CACHE[key] = (time.time(), response)
    if len(_CACHE) > CACHE_MAX_ENTRIES:
        _evict_oldest()


def _evict_oldest() -> None:
    """Drop the CACHE_EVICT_BATCH oldest entries by insertion time."""
    if not _CACHE:
        return
    sorted_keys = sorted(_CACHE.items(), key=lambda kv: kv[1][0])
    for stale_key, _ in sorted_keys[:CACHE_EVICT_BATCH]:
        _CACHE.pop(stale_key, None)


def _build_display_name(name: str, state: str | None, country: str | None) -> str:
    parts = [name]
    if state:
        parts.append(state)
    if country:
        parts.append(country)
    return ", ".join(parts)


def _parse_feature(feature: dict) -> GeocodeCandidate | None:
    """Map one Photon GeoJSON feature into a GeocodeCandidate.

    Returns None if the feature is malformed (missing coordinates, etc.) —
    we'd rather silently skip a bad row than crash the whole response.
    """
    try:
        geom = feature["geometry"]
        coords = geom["coordinates"]
        lon = float(coords[0])
        lat = float(coords[1])
    except (KeyError, IndexError, TypeError, ValueError):
        return None

    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return None

    props = feature.get("properties") or {}
    name = props.get("name") or ""
    if not name:
        return None

    country = props.get("country")
    state = props.get("state")
    osm_type = props.get("osm_type")
    osm_id_raw = props.get("osm_id")
    osm_id = str(osm_id_raw) if osm_id_raw is not None else None
    place_type = props.get("type")

    return GeocodeCandidate(
        display_name=_build_display_name(name, state, country),
        name=name,
        country=country,
        state=state,
        lat=lat,
        lon=lon,
        osm_type=osm_type,
        osm_id=osm_id,
        place_type=place_type,
    )


async def geocode(query: str, *, limit: int = 5, lang: str = "en") -> GeocodeResponse:
    """Fetch place candidates from Photon, with caching and error mapping.

    Raises:
        GeocoderUnavailableError: network failure, timeout, or connection error.
        GeocoderUpstreamError: non-2xx HTTP status from Photon.
    """
    cache_key = _make_cache_key(query, limit, lang)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    params = {"q": query, "limit": limit, "lang": lang}
    headers = {"User-Agent": USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            resp = await client.get(PHOTON_BASE_URL, params=params, headers=headers)
    except httpx.TimeoutException as exc:
        raise GeocoderUnavailableError(f"Photon request timed out: {exc}") from exc
    except httpx.RequestError as exc:
        raise GeocoderUnavailableError(f"Photon request failed: {exc}") from exc

    if resp.status_code >= 500:
        raise GeocoderUpstreamError(
            f"Photon returned HTTP {resp.status_code}"
        )
    if resp.status_code >= 400:
        # 4xx from Photon usually means a malformed query — treat as empty.
        response = GeocodeResponse(query=query, candidates=[], count=0)
        _cache_put(cache_key, response)
        return response

    payload = resp.json()
    features = payload.get("features") or []

    candidates: list[GeocodeCandidate] = []
    for feature in features:
        parsed = _parse_feature(feature)
        if parsed is not None:
            candidates.append(parsed)

    response = GeocodeResponse(
        query=query,
        candidates=candidates,
        count=len(candidates),
    )
    _cache_put(cache_key, response)
    return response
```

- [ ] **Step 2: Run the unit tests — expect all pass**

```bash
cd server
pytest tests/test_geocoder.py -v
```

Expected: all 9 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add server/app/services/geocoder.py
git commit -m "feat(geocoder): Photon HTTP client with TTL cache"
```

---

### Task A8: Write + mount the geocode router

**Files:**
- Create: `server/tests/test_geocode_endpoint.py`
- Create: `server/app/routers/geocode.py`
- Modify: `server/app/main.py`

- [ ] **Step 1: Write failing integration tests**

Create `server/tests/test_geocode_endpoint.py`:

```python
"""Integration tests for the /api/v1/geocode endpoint.

These tests hit the FastAPI router via TestClient but mock the underlying
geocoder service (no real network calls).
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.geocode import GeocodeCandidate, GeocodeResponse
from app.services import geocoder


client = TestClient(app)


@pytest.fixture
def sample_response():
    return GeocodeResponse(
        query="Portoviejo",
        candidates=[
            GeocodeCandidate(
                display_name="Portoviejo, Manabí, Ecuador",
                name="Portoviejo",
                country="Ecuador",
                state="Manabí",
                lat=-1.0569,
                lon=-80.4544,
                osm_type="N",
                osm_id="123456789",
                place_type="city",
            )
        ],
        count=1,
    )


def test_geocode_returns_200(sample_response):
    with patch("app.routers.geocode.geocoder.geocode", AsyncMock(return_value=sample_response)):
        resp = client.get("/api/v1/geocode?q=Portoviejo")
    assert resp.status_code == 200
    body = resp.json()
    assert body["query"] == "Portoviejo"
    assert body["count"] == 1
    assert body["candidates"][0]["country"] == "Ecuador"
    assert body["source"].startswith("Photon")


def test_geocode_q_too_short_returns_422():
    resp = client.get("/api/v1/geocode?q=a")
    assert resp.status_code == 422


def test_geocode_q_too_long_returns_422():
    long_q = "x" * 201
    resp = client.get(f"/api/v1/geocode?q={long_q}")
    assert resp.status_code == 422


def test_geocode_limit_out_of_range_returns_422():
    resp = client.get("/api/v1/geocode?q=Miami&limit=99")
    assert resp.status_code == 422


def test_geocode_lang_bad_format_returns_422():
    resp = client.get("/api/v1/geocode?q=Miami&lang=English")
    assert resp.status_code == 422


def test_geocode_upstream_timeout_returns_503():
    with patch(
        "app.routers.geocode.geocoder.geocode",
        AsyncMock(side_effect=geocoder.GeocoderUnavailableError("timeout")),
    ):
        resp = client.get("/api/v1/geocode?q=Portoviejo")
    assert resp.status_code == 503
    assert "temporarily unavailable" in resp.json()["detail"].lower()


def test_geocode_upstream_5xx_returns_502():
    with patch(
        "app.routers.geocode.geocoder.geocode",
        AsyncMock(side_effect=geocoder.GeocoderUpstreamError("503 from photon")),
    ):
        resp = client.get("/api/v1/geocode?q=Portoviejo")
    assert resp.status_code == 502
    assert "upstream" in resp.json()["detail"].lower()
```

- [ ] **Step 2: Run the failing tests**

```bash
cd server
pytest tests/test_geocode_endpoint.py -v
```

Expected: all 7 tests FAIL with `404 Not Found` or `ModuleNotFoundError: app.routers.geocode`.

- [ ] **Step 3: Create the router**

Create `server/app/routers/geocode.py`:

```python
"""GET /api/v1/geocode — Photon proxy for place-name lookup."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.schemas.geocode import GeocodeResponse
from app.services import geocoder


router = APIRouter(prefix="/geocode", tags=["geocode"])


@router.get("", response_model=GeocodeResponse)
async def get_geocode(
    q: str = Query(..., min_length=2, max_length=200, description="Place-name query"),
    limit: int = Query(5, ge=1, le=10, description="Max candidates to return"),
    lang: str = Query(
        "en",
        pattern=r"^[a-z]{2}$",
        description="Language code (2-letter ISO 639-1)",
    ),
) -> GeocodeResponse:
    try:
        return await geocoder.geocode(q, limit=limit, lang=lang)
    except geocoder.GeocoderUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail="Geocoder service temporarily unavailable",
        ) from exc
    except geocoder.GeocoderUpstreamError as exc:
        raise HTTPException(
            status_code=502,
            detail="Geocoder upstream error",
        ) from exc
```

- [ ] **Step 4: Mount the router in `main.py`**

Open `server/app/main.py` and update the imports + router mounts:

```python
from app.routers import constellations, geocode, objects, planets, sky
```

Then add at the bottom alongside the existing router mounts:

```python
app.include_router(geocode.router, prefix=settings.api_v1_prefix)
```

- [ ] **Step 5: Run the integration tests — expect all pass**

```bash
cd server
pytest tests/test_geocode_endpoint.py -v
```

Expected: all 7 tests PASS.

- [ ] **Step 6: Smoke test against a running server (optional but recommended)**

```bash
cd server
uvicorn app.main:app --reload --port 8000 &
sleep 3
curl -s "http://localhost:8000/api/v1/geocode?q=Portoviejo" | head -c 500
kill %1
```

Expected: a JSON response with at least one candidate and `"country": "Ecuador"`.

- [ ] **Step 7: Commit**

```bash
git add server/tests/test_geocode_endpoint.py server/app/routers/geocode.py server/app/main.py
git commit -m "feat(api): mount /api/v1/geocode Photon proxy endpoint"
```

---

### Task A9: Write network-marked acceptance tests

**Files:**
- Create: `server/tests/test_geocoder_acceptance.py`

- [ ] **Step 1: Create the acceptance test file**

```python
"""Acceptance tests that hit real Photon — gated behind the 'network' mark.

Run with: pytest -m network

These tests verify global coverage across three real-world cases:
  - Miami, Florida (US city)
  - Charlotte, North Carolina (US city, different state)
  - Portoviejo, Ecuador (small South American city)
"""

from __future__ import annotations

import pytest

from app.services import geocoder


pytestmark = pytest.mark.network


@pytest.mark.asyncio
async def test_real_geocode_miami_florida():
    result = await geocoder.geocode("Miami, FL", limit=5, lang="en")
    assert result.count >= 1
    countries = {c.country for c in result.candidates if c.country}
    assert "United States" in countries


@pytest.mark.asyncio
async def test_real_geocode_charlotte_north_carolina():
    result = await geocoder.geocode("Charlotte, NC", limit=5, lang="en")
    assert result.count >= 1
    found_nc = any(
        c.state and "Carolina" in c.state and c.country == "United States"
        for c in result.candidates
    )
    assert found_nc, f"No Charlotte NC in candidates: {[c.display_name for c in result.candidates]}"


@pytest.mark.asyncio
async def test_real_geocode_portoviejo_ecuador():
    result = await geocoder.geocode("Portoviejo", limit=5, lang="en")
    assert result.count >= 1
    countries = {c.country for c in result.candidates if c.country}
    assert "Ecuador" in countries
```

- [ ] **Step 2: Run the acceptance tests against real Photon**

```bash
cd server
pytest tests/test_geocoder_acceptance.py -v -m network
```

Expected: all 3 tests PASS. If Photon is down or slow, the tests will fail with `GeocoderUnavailableError` — wait and retry.

- [ ] **Step 3: Verify default `pytest` still skips network tests**

```bash
cd server
pytest -v 2>&1 | tail -20
```

Expected: all existing + new non-network tests run; the 3 network tests are deselected by `-m "not network"` default OR (depending on your pytest.ini) simply not collected unless explicitly requested via `-m network`.

If they run by default and you don't want them to, add `-m "not network"` to `pytest.ini`'s `addopts`:

```ini
[pytest]
testpaths = tests
pythonpath = .
asyncio_mode = auto
addopts = -m "not network"
markers =
    network: tests that hit real external network services. Run with `pytest -m network`.
```

- [ ] **Step 4: Commit**

```bash
git add server/tests/test_geocoder_acceptance.py server/pytest.ini
git commit -m "test(geocoder): add network-marked acceptance tests (Miami/Charlotte/Portoviejo)"
```

---

### Task A10: Backend checkpoint — full test suite green

- [ ] **Step 1: Run the full non-network suite**

```bash
cd server
pytest -v
```

Expected: every existing Phase 1 test + every new geocoder test + every new Moon phase test PASSES. If anything is red, fix it before proceeding to Part B.

- [ ] **Step 2: Run the network suite**

```bash
cd server
pytest -v -m network
```

Expected: 3 network tests PASS.

Part A is complete. The backend has Moon phase data on `/planets`, a working `/geocode` endpoint, full test coverage, and all existing Phase 1 functionality preserved.

---

## Part B — Frontend Scaffold

Stand up an empty Vite + React + Tailwind project with ESLint, Prettier, Vitest, and the runtime dependencies. Nothing in this part renders actual content — that starts in Part C/D. Each task ends in a commit.

---

### Task B1: Create the Vite + React JS project

**Files:**
- Create: `client/` directory and Vite-generated files

- [ ] **Step 1: Scaffold the project**

From the repo root:

```bash
cd C:/Users/andre/skyvault
npm create vite@latest client -- --template react
```

When prompted "Current directory is not empty", choose **Ignore files and continue** (the `client/` directory does not exist yet — this prompt only appears if Vite finds one).

- [ ] **Step 2: Install baseline dependencies**

```bash
cd C:/Users/andre/skyvault/client
npm install
```

- [ ] **Step 3: Verify the dev server boots**

```bash
cd C:/Users/andre/skyvault/client
npm run dev
```

Expected: Vite prints `Local: http://localhost:5173/`. Ctrl+C to stop.

- [ ] **Step 4: Delete Vite's default CSS and placeholder assets we won't use**

```bash
cd C:/Users/andre/skyvault/client
rm -f src/App.css src/index.css src/assets/react.svg
```

- [ ] **Step 5: Replace `src/App.jsx` with a minimal placeholder**

```jsx
export default function App() {
  return <div>SkyVault — scaffold placeholder</div>;
}
```

- [ ] **Step 6: Replace `src/main.jsx` (drop index.css import)**

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 7: Add `client/.gitignore` (Vite should have created one — verify)**

Check that `client/.gitignore` includes at least:
```
node_modules
dist
dist-ssr
*.local
.vite
coverage
```

If Vite didn't create one, write the file with the above contents.

- [ ] **Step 8: Commit the scaffold**

```bash
cd C:/Users/andre/skyvault
git add client/
git commit -m "chore(client): scaffold Vite + React JS project"
```

---

### Task B2: Install runtime + dev dependencies

**Files:**
- Modify: `client/package.json` (auto-updated by npm install)

- [ ] **Step 1: Install runtime deps**

```bash
cd C:/Users/andre/skyvault/client
npm install react-dom@^18 zustand @tanstack/react-query
```

React and react-dom should already be installed; the re-install is a no-op for them.

- [ ] **Step 2: Install dev deps**

```bash
cd C:/Users/andre/skyvault/client
npm install -D tailwindcss@^3 postcss autoprefixer \
  vitest @testing-library/react @testing-library/jest-dom jsdom \
  eslint eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-refresh \
  prettier
```

(Note: Tailwind v3, not v4. v4 changed the config model and we want the stable v3 flow.)

- [ ] **Step 3: Verify `package.json` lists everything**

Open `client/package.json` and confirm the `dependencies` and `devDependencies` sections include all of:

Runtime: `react`, `react-dom`, `zustand`, `@tanstack/react-query`

Dev: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `prettier`

- [ ] **Step 4: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/package.json client/package-lock.json
git commit -m "chore(client): install runtime and dev dependencies"
```

---

### Task B3: Tailwind + PostCSS config with custom palette

**Files:**
- Create: `client/tailwind.config.js`
- Create: `client/postcss.config.js`
- Create: `client/src/styles/global.css`
- Modify: `client/src/main.jsx`

- [ ] **Step 1: Initialize Tailwind config**

```bash
cd C:/Users/andre/skyvault/client
npx tailwindcss init -p
```

This creates `tailwind.config.js` and `postcss.config.js`. If it fails on Windows with a ".ps1 cannot be loaded" error, run via `npx --yes tailwindcss init -p` or install manually.

- [ ] **Step 2: Overwrite `tailwind.config.js` with the SkyVault palette**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#05060d",
          frame: "#0a0d1c",
        },
        ink: {
          DEFAULT: "#dce1f0",
          dim: "#7a8299",
        },
        accent: {
          DEFAULT: "#e8b86d",
          dim: "#6a5329",
        },
        rule: "#1e2238",
        danger: "#e08585",
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', "ui-serif", "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Verify `postcss.config.js` (Vite v5 uses the flat ESM format)**

The generated file should look like:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

If it uses CommonJS (`module.exports`) and your Vite config is ESM, convert to ESM as above. Vite 5+ is fine with either, but keep it consistent with the rest of the project.

- [ ] **Step 4: Create `client/src/styles/global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom CSS variables for things Tailwind's color scale doesn't handle cleanly. */
:root {
  --bg-panel: rgba(10, 14, 28, 0.55);
  --intro-galaxy-opacity: 0.28;
  --intro-content-opacity: 1;
}

html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
  background-color: #05060d;
  color: #dce1f0;
  font-family: "Cormorant Garamond", ui-serif, Georgia, serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Idle state machine controls — set by useIdle on document.body */
body.ui-normal .panel,
body.ui-normal .controls-strip,
body.ui-normal .header,
body.ui-normal .footer,
body.ui-normal .hero {
  opacity: 1;
  transition: opacity 600ms ease, filter 600ms ease;
}
body.ui-glass .panel,
body.ui-glass .controls-strip,
body.ui-glass .header,
body.ui-glass .footer,
body.ui-glass .hero {
  opacity: 0.55;
  filter: blur(0) saturate(0.9);
  transition: opacity 600ms ease, filter 600ms ease;
}
body.ui-hidden .panel,
body.ui-hidden .controls-strip,
body.ui-hidden .header,
body.ui-hidden .footer,
body.ui-hidden .hero {
  opacity: 0;
  transition: opacity 800ms ease;
}

/* Reduced motion — kill transitions */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}

/* Intro animation keyframes */
@keyframes galaxyFadeIn {
  from { opacity: 0; }
  to   { opacity: var(--intro-galaxy-opacity); }
}
@keyframes contentFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.intro-playing .app-background::before {
  animation: galaxyFadeIn 2000ms ease-out 1500ms both;
}
.intro-playing .intro-content {
  animation: contentFadeIn 1800ms ease-out 2700ms both;
}
.intro-done .app-background::before {
  opacity: var(--intro-galaxy-opacity);
}

/* Gold corner brackets on the frame */
.frame { position: relative; }
.frame::before, .frame::after {
  content: "";
  position: absolute;
  width: 18px;
  height: 18px;
  border: 1px solid #6a5329;
  pointer-events: none;
}
.frame::before {
  top: -1px; left: -1px;
  border-right: 0;
  border-bottom: 0;
}
.frame::after {
  bottom: -1px; right: -1px;
  border-left: 0;
  border-top: 0;
}

/* Full-viewport Milky Way background with vignette */
.app-background {
  position: fixed;
  inset: 0;
  z-index: -1;
  background-color: #05060d;
  isolation: isolate;
}
.app-background::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url("/milky-way.webp");
  background-size: cover;
  background-position: center;
  opacity: var(--intro-galaxy-opacity);
  mix-blend-mode: screen;
}
.app-background::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 40%,
    rgba(5, 6, 13, 0.7) 100%
  );
  pointer-events: none;
}
```

- [ ] **Step 5: Import `global.css` in `main.jsx`**

Update `client/src/main.jsx` to:

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Smoke test — boot dev server, open, verify dark bg**

```bash
cd C:/Users/andre/skyvault/client
npm run dev
```

Open http://localhost:5173 — the page should be near-black with light ink text saying "SkyVault — scaffold placeholder". If it's white-on-white, Tailwind isn't wired up; check `content` paths and the `global.css` import. Ctrl+C to stop.

- [ ] **Step 7: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/tailwind.config.js client/postcss.config.js client/src/styles/ client/src/main.jsx
git commit -m "feat(client): Tailwind config with galactic palette and global styles"
```

---

### Task B4: Google Fonts, Vite config, ESLint, Prettier, Vitest config

**Files:**
- Modify: `client/index.html`
- Modify: `client/vite.config.js`
- Create: `client/vitest.config.js`
- Create: `client/src/__tests__/setup.js`
- Create: `client/.eslintrc.cjs`
- Create: `client/.prettierrc`

- [ ] **Step 1: Update `client/index.html` with font preconnects + title**

Replace the existing `index.html` contents with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#05060d" />
    <title>SkyVault — The Sky Over Any Place, Any Time</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@300;400;500&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Update `vite.config.js` to set the dev server port**

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

The `/api` proxy routes frontend API calls to the FastAPI backend without hitting the browser's CORS preflight. Later (Phase 4) we swap this for a real base URL.

- [ ] **Step 3: Create `vitest.config.js`**

```js
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.js"],
    css: false,
  },
});
```

- [ ] **Step 4: Create `client/src/__tests__/setup.js`**

```js
import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 5: Create `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: "detect" },
  },
  plugins: ["react-refresh"],
  rules: {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  },
};
```

- [ ] **Step 6: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5",
  "printWidth": 90,
  "tabWidth": 2
}
```

- [ ] **Step 7: Add npm scripts to `package.json`**

Update the `scripts` section of `client/package.json` to:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "lint": "eslint src --ext .js,.jsx",
  "format": "prettier --write \"src/**/*.{js,jsx,css}\"",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 8: Verify lint and test commands work**

```bash
cd C:/Users/andre/skyvault/client
npm run lint
```

Expected: no errors (possibly warnings).

```bash
npm test
```

Expected: Vitest reports "No test files found, exiting with code 0." That's fine — we add tests in Part G.

- [ ] **Step 9: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/
git commit -m "chore(client): ESLint, Prettier, Vitest, Google Fonts, dev proxy"
```

---

### Task B5: Create the `api/client.js` fetch wrapper

**Files:**
- Create: `client/src/api/client.js`

- [ ] **Step 1: Create the module**

```js
/**
 * Thin fetch wrapper that:
 *   - Prefixes requests with /api/v1 (Vite dev proxy routes this to localhost:8000).
 *   - Parses JSON.
 *   - Throws ApiError on non-2xx responses with the server's detail string.
 */

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const API_BASE = "/api/v1";

async function request(path, params) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  let response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    throw new ApiError(`Network error: ${err.message}`, 0, null);
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Body wasn't JSON; fall through
  }

  if (!response.ok) {
    const detail = body?.detail || response.statusText || `HTTP ${response.status}`;
    throw new ApiError(detail, response.status, body);
  }

  return body;
}

export const api = {
  geocode: (q, { limit = 5, lang = "en" } = {}) =>
    request("/geocode", { q, limit, lang }),
  sky: (lat, lon, datetime, { mag_limit = 6.5 } = {}) =>
    request("/sky", { lat, lon, datetime, mag_limit }),
  planets: (lat, lon, datetime) =>
    request("/planets", { lat, lon, datetime }),
};
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/api/client.js
git commit -m "feat(client): api client wrapper with ApiError"
```

---

### Task B6: Frontend scaffold checkpoint

- [ ] **Step 1: Boot dev server, verify clean start**

```bash
cd C:/Users/andre/skyvault/client
npm run dev
```

Open http://localhost:5173. Should see near-black page with "SkyVault — scaffold placeholder" in the default serif. No console errors. Ctrl+C.

- [ ] **Step 2: Run lint + tests**

```bash
cd C:/Users/andre/skyvault/client
npm run lint && npm test
```

Expected: both pass cleanly.

Part B complete. Scaffold is ready.

---

## Part C — State, Hooks, Utilities

Build the non-visual foundation: Zustand stores, React Query hooks, and pure utility functions. These are testable in isolation and give downstream UI tasks a stable API to consume.

---

### Task C1: `useFSM` — tiny explicit state machine helper

**Files:**
- Create: `client/src/hooks/useFSM.js`

- [ ] **Step 1: Create the module**

```js
import { useCallback, useState } from "react";

/**
 * Minimal explicit finite state machine hook.
 *
 * Usage:
 *   const { state, send, can } = useFSM({
 *     initial: "normal",
 *     transitions: {
 *       normal: { IDLE: "glass" },
 *       glass:  { IDLE: "hidden", ACTIVE: "normal" },
 *       hidden: { ACTIVE: "normal" },
 *     },
 *   });
 *
 * send("IDLE") transitions state; invalid transitions are silently no-ops
 * but can be detected via `can("IDLE")`.
 */
export function useFSM({ initial, transitions }) {
  const [state, setState] = useState(initial);

  const send = useCallback(
    (event) => {
      setState((current) => {
        const next = transitions[current]?.[event];
        return next ?? current;
      });
    },
    [transitions]
  );

  const can = useCallback(
    (event) => {
      return Boolean(transitions[state]?.[event]);
    },
    [state, transitions]
  );

  return { state, send, can };
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/hooks/useFSM.js
git commit -m "feat(client): add useFSM helper hook"
```

---

### Task C2: Utility functions (formatDatetime, formatCoords, bvToColor, magnitudeToSize)

**Files:**
- Create: `client/src/utils/formatDatetime.js`
- Create: `client/src/utils/formatCoords.js`
- Create: `client/src/utils/bvToColor.js`
- Create: `client/src/utils/magnitudeToSize.js`

- [ ] **Step 1: Create `formatDatetime.js`**

```js
/**
 * Combine a YYYY-MM-DD date, optional HH:MM time, and a timezone selection
 * (Local | UTC) into an ISO 8601 UTC string.
 *
 * - If `time` is empty, defaults to the current wall-clock time.
 * - Local mode interprets the date+time in the browser's local timezone
 *   and converts to UTC via Date object math.
 * - UTC mode interprets date+time as already-UTC and returns the same
 *   moment as an ISO string.
 */
export function toIsoUtc({ date, time, timezone }) {
  if (!date) return null;

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;

  let hours = 0;
  let minutes = 0;
  if (time) {
    const [h, m] = time.split(":").map(Number);
    hours = Number.isFinite(h) ? h : 0;
    minutes = Number.isFinite(m) ? m : 0;
  } else {
    const now = new Date();
    hours = now.getHours();
    minutes = now.getMinutes();
  }

  let dt;
  if (timezone === "UTC") {
    dt = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  } else {
    dt = new Date(year, month - 1, day, hours, minutes, 0);
  }
  return dt.toISOString();
}

/**
 * Format a UTC ISO string as "08 APRIL 2026 · 22:00 UTC" for the header subhead.
 */
export function formatDisplayDatetime(isoUtc) {
  if (!isoUtc) return "";
  const d = new Date(isoUtc);
  const MONTHS = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
  ];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} · ${hh}:${mm} UTC`;
}
```

- [ ] **Step 2: Create `formatCoords.js`**

```js
/**
 * Format a lat/lon pair as "25.76°N 80.19°W".
 * Both values are in degrees; positive = N/E, negative = S/W.
 */
export function formatLatLon(lat, lon) {
  if (lat == null || lon == null) return "";
  const latHemi = lat >= 0 ? "N" : "S";
  const lonHemi = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${latHemi} ${Math.abs(lon).toFixed(2)}°${lonHemi}`;
}
```

- [ ] **Step 3: Create `bvToColor.js`**

```js
/**
 * Map a Gaia DR3 BP-RP color index to an approximate RGB hex string.
 *
 * BP-RP is a blue-minus-red magnitude (in the Gaia BP and RP bands).
 * Hotter stars (O, B, A) have BP-RP near -0.3 to 0.0 (bluish). Cooler
 * stars (K, M) have BP-RP > 1.5 (reddish/orange). The Sun sits around
 * 0.82 (yellow).
 *
 * This isn't a rigorous colorimetric mapping — it's a visual approximation
 * calibrated for the dark-UI star list. Color mapping fidelity increases
 * in Phase 2b when stars are actually rendered on the canvas.
 */
export function bvToHex(bpRp) {
  if (bpRp == null || !Number.isFinite(bpRp)) {
    return "#ffffff";
  }
  // Clamp to the range we interpolate across
  const bv = Math.max(-0.5, Math.min(2.5, bpRp));

  // Piecewise linear interpolation between calibration points
  // bv, r, g, b (approximate color of the star in hex)
  const stops = [
    [-0.5, 0xa2, 0xc0, 0xff],   // deep blue
    [0.0,  0xca, 0xd7, 0xff],   // blue-white
    [0.5,  0xf8, 0xf7, 0xff],   // near white
    [0.82, 0xff, 0xf4, 0xc8],   // yellow-white (Sun)
    [1.4,  0xff, 0xc6, 0x8a],   // orange
    [2.0,  0xff, 0x9b, 0x64],   // red-orange
    [2.5,  0xff, 0x7c, 0x5c],   // red
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, r0, g0, b0] = stops[i];
    const [x1, r1, g1, b1] = stops[i + 1];
    if (bv >= x0 && bv <= x1) {
      const t = (bv - x0) / (x1 - x0);
      const r = Math.round(r0 + (r1 - r0) * t);
      const g = Math.round(g0 + (g1 - g0) * t);
      const b = Math.round(b0 + (b1 - b0) * t);
      return `#${r.toString(16).padStart(2, "0")}${g
        .toString(16)
        .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
  }
  return "#ffffff";
}
```

- [ ] **Step 4: Create `magnitudeToSize.js`**

```js
/**
 * Map an apparent magnitude to a CSS pixel size for display purposes.
 * Lower magnitude = brighter = larger dot. Clamped to [2, 14] px.
 */
export function magnitudeToSize(magnitude) {
  if (magnitude == null || !Number.isFinite(magnitude)) return 4;
  // Rough: magnitude -1 → 14px, magnitude 6 → 2px
  const size = 14 - (magnitude + 1) * (12 / 7);
  return Math.max(2, Math.min(14, size));
}
```

- [ ] **Step 5: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/utils/
git commit -m "feat(client): formatDatetime, formatCoords, bvToColor, magnitudeToSize utils"
```

---

### Task C3: `observerStore` — semantic state

**Files:**
- Create: `client/src/stores/observerStore.js`

- [ ] **Step 1: Create the store**

```js
import { create } from "zustand";
import { toIsoUtc } from "../utils/formatDatetime.js";

/**
 * Semantic observer state: what the user wants to see.
 *
 *   rawQuery    — the string currently typed into LocationInput
 *   candidates  — geocode results after the user has submitted
 *   selected    — the chosen candidate (or current location)
 *   date/time   — user-chosen date and optional time
 *   timezone    — "Local" | "UTC"
 *   datetimeUtc — derived ISO 8601 UTC string (set on submit)
 *   submitted   — true once the user has clicked Submit and a candidate is picked
 *
 * Submit flow:
 *   1. User types + picks date + (optional) time, clicks Submit
 *   2. store.submit() sets `geocodeRequested = true` → useGeocode hook fires
 *   3. Backend returns candidates → store.setCandidates(candidates)
 *   4. DidYouMeanDropdown shows the list
 *   5. User clicks a candidate → store.selectCandidate(idx) sets selected + datetimeUtc
 *   6. useSky and usePlanets hooks (gated on `selected != null`) fire
 */
export const useObserverStore = create((set, get) => ({
  rawQuery: "",
  candidates: [],
  selected: null,
  date: "",
  time: "",
  timezone: "Local",
  datetimeUtc: null,
  submitted: false,
  geocodeRequested: false,

  setRawQuery: (rawQuery) => set({ rawQuery, candidates: [], selected: null }),

  setCandidates: (candidates) => set({ candidates }),

  selectCandidate: (idx) => {
    const { candidates, date, time, timezone } = get();
    const picked = candidates[idx];
    if (!picked) return;
    const datetimeUtc = toIsoUtc({ date, time, timezone });
    set({
      selected: {
        lat: picked.lat,
        lon: picked.lon,
        displayName: picked.display_name,
        country: picked.country ?? null,
      },
      datetimeUtc,
      submitted: true,
      geocodeRequested: false,
    });
  },

  useCurrentLocation: (lat, lon, displayName = "Current location") => {
    const { date, time, timezone } = get();
    const datetimeUtc = toIsoUtc({ date, time, timezone });
    set({
      selected: { lat, lon, displayName, country: null },
      candidates: [],
      datetimeUtc,
      submitted: true,
      geocodeRequested: false,
    });
  },

  setDate: (date) => set({ date }),
  setTime: (time) => set({ time }),
  setTimezone: (timezone) => set({ timezone }),

  submit: () => {
    const { rawQuery, date } = get();
    if (!rawQuery || rawQuery.length < 2 || !date) return;
    set({ geocodeRequested: true, submitted: false, selected: null });
  },

  reset: () =>
    set({
      rawQuery: "",
      candidates: [],
      selected: null,
      date: "",
      time: "",
      timezone: "Local",
      datetimeUtc: null,
      submitted: false,
      geocodeRequested: false,
    }),
}));
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/stores/observerStore.js
git commit -m "feat(client): observerStore with geocode submit flow"
```

---

### Task C4: `uiStateStore` — visual chrome state

**Files:**
- Create: `client/src/stores/uiStateStore.js`

- [ ] **Step 1: Create the store**

```js
import { create } from "zustand";

/**
 * Visual chrome state. Orthogonal to observerStore — changes here do not
 * re-render semantic consumers.
 *
 *   introState   — "pending" | "playing" | "done"
 *   activityState — "normal" | "glass" | "hidden"
 *   lastActivityAt — epoch ms of the last meaningful user input
 *   prefersReducedMotion — reflects @media (prefers-reduced-motion: reduce)
 */
export const useUiStateStore = create((set) => ({
  introState: "pending",
  activityState: "normal",
  lastActivityAt: Date.now(),
  prefersReducedMotion: false,

  setIntroState: (introState) => set({ introState }),

  markActive: () =>
    set({ activityState: "normal", lastActivityAt: Date.now() }),

  markGlass: () => set({ activityState: "glass" }),

  markHidden: () => set({ activityState: "hidden" }),

  setReducedMotion: (prefersReducedMotion) => set({ prefersReducedMotion }),
}));
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/stores/uiStateStore.js
git commit -m "feat(client): uiStateStore for intro + idle state"
```

---

### Task C5: React Query setup + `useGeocode` / `useSky` / `usePlanets`

**Files:**
- Create: `client/src/hooks/useGeocode.js`
- Create: `client/src/hooks/useSky.js`
- Create: `client/src/hooks/usePlanets.js`
- Modify: `client/src/main.jsx`

- [ ] **Step 1: Add QueryClientProvider to `main.jsx`**

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import "./styles/global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 2: Create `useGeocode.js`**

```js
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

/**
 * Fetch place-name candidates from /api/v1/geocode.
 *
 * Fires only when `geocodeRequested` is true AND `query.length >= 2`.
 * The flag is set by `observerStore.submit()` when the user clicks Submit,
 * implementing the submit-then-pick model (live autocomplete is Phase 4).
 */
export function useGeocode(query, geocodeRequested) {
  return useQuery({
    queryKey: ["geocode", query],
    queryFn: () => api.geocode(query),
    enabled: Boolean(geocodeRequested && query && query.length >= 2),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}
```

- [ ] **Step 3: Create `useSky.js`**

```js
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

export function useSky(selected, datetimeUtc) {
  return useQuery({
    queryKey: ["sky", selected?.lat, selected?.lon, datetimeUtc],
    queryFn: () => api.sky(selected.lat, selected.lon, datetimeUtc),
    enabled: Boolean(selected && datetimeUtc),
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 4: Create `usePlanets.js`**

```js
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

export function usePlanets(selected, datetimeUtc) {
  return useQuery({
    queryKey: ["planets", selected?.lat, selected?.lon, datetimeUtc],
    queryFn: () => api.planets(selected.lat, selected.lon, datetimeUtc),
    enabled: Boolean(selected && datetimeUtc),
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 5: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/main.jsx client/src/hooks/useGeocode.js client/src/hooks/useSky.js client/src/hooks/usePlanets.js
git commit -m "feat(client): React Query setup and useGeocode/useSky/usePlanets hooks"
```

---

### Task C6: `useGeolocation` — browser GPS wrapper

**Files:**
- Create: `client/src/hooks/useGeolocation.js`

- [ ] **Step 1: Create the hook**

```js
import { useCallback, useState } from "react";

/**
 * Imperative geolocation hook. Call `request()` to trigger a one-shot
 * lookup. 10-second timeout. Returns { position, error, isLoading }.
 *
 * Not wired to React Query because geolocation isn't a pure query —
 * the user explicitly opts in by clicking the 📍 button.
 */
export function useGeolocation() {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError({ code: "UNSUPPORTED", message: "Geolocation not supported" });
      return;
    }
    setIsLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setIsLoading(false);
      },
      (err) => {
        setError({ code: err.code, message: err.message });
        setIsLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );
  }, []);

  return { position, error, isLoading, request };
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/hooks/useGeolocation.js
git commit -m "feat(client): useGeolocation hook with 10s timeout"
```

---

### Task C7: `useIdle` — activity tracking + idle FSM

**Files:**
- Create: `client/src/hooks/useIdle.js`

- [ ] **Step 1: Create the hook**

```js
import { useEffect, useRef } from "react";
import { useUiStateStore } from "../stores/uiStateStore.js";

const ACTIVE_TO_GLASS_MS = 15_000;
const GLASS_TO_HIDDEN_MS = 5_000;

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "touchstart",
  "scroll",
  "focusin",
];

/**
 * Observes user activity and walks the uiStateStore.activityState machine:
 *
 *   (initial after intro) GLASS
 *      │ any activity → NORMAL
 *      │ 15s no activity → GLASS
 *      │ 5s more no activity → HIDDEN
 *      │ any activity → NORMAL
 *
 * Visibility handling:
 *   - Hide tab: pause the timer, record `hiddenAt`
 *   - Show tab after <5s: resume
 *   - Show tab after >5s: snap to GLASS
 *
 * Focused input immunity:
 *   While document.activeElement is an input/textarea/select, treat
 *   activity as continuous.
 *
 * Reduced motion:
 *   Transitions still happen but CSS-side durations are neutralized via
 *   the global @media rule in global.css. We don't special-case here.
 */
export function useIdle({ enabled }) {
  const { markActive, markGlass, markHidden } = useUiStateStore();
  const timerRef = useRef(null);
  const hiddenAtRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const scheduleGlass = () => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        markGlass();
        timerRef.current = setTimeout(() => {
          markHidden();
        }, GLASS_TO_HIDDEN_MS);
      }, ACTIVE_TO_GLASS_MS);
    };

    const isFormFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const onActivity = () => {
      markActive();
      scheduleGlass();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearTimer();
        hiddenAtRef.current = Date.now();
      } else if (document.visibilityState === "visible") {
        const hiddenFor = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
        hiddenAtRef.current = null;
        if (hiddenFor > 5000) {
          markGlass();
        } else {
          markActive();
        }
        scheduleGlass();
      }
    };

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Tick every second to keep focused-input state fresh without
    // requiring mousemove.
    const focusTicker = setInterval(() => {
      if (isFormFocused()) {
        markActive();
        scheduleGlass();
      }
    }, 1000);

    scheduleGlass();

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(focusTicker);
      clearTimer();
    };
  }, [enabled, markActive, markGlass, markHidden]);
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/hooks/useIdle.js
git commit -m "feat(client): useIdle activity tracking and idle state machine"
```

---

### Task C8: `useIntroSequence` — session-gated intro with ?replay override

**Files:**
- Create: `client/src/hooks/useIntroSequence.js`

- [ ] **Step 1: Create the hook**

```js
import { useEffect } from "react";
import { useUiStateStore } from "../stores/uiStateStore.js";

const STORAGE_KEY = "skyvault.introPlayed";

/**
 * Determines whether the intro should play on mount and orchestrates the
 * state transitions. Uses sessionStorage so the intro fires on a fresh tab
 * but not on in-tab refreshes. ?replay in the URL forces a replay without
 * clearing the flag.
 *
 * Respects prefers-reduced-motion: reduce → skip directly to DONE.
 */
export function useIntroSequence() {
  const { introState, setIntroState, setReducedMotion, markGlass, markActive } =
    useUiStateStore();

  useEffect(() => {
    if (introState !== "pending") return;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = mql.matches;
    setReducedMotion(reduced);

    const url = new URL(window.location.href);
    const forceReplay = url.searchParams.has("replay");
    const alreadyPlayed = sessionStorage.getItem(STORAGE_KEY) === "true";

    if ((alreadyPlayed && !forceReplay) || reduced) {
      setIntroState("done");
      markActive();
      try {
        sessionStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // sessionStorage unavailable (e.g. private mode) — ignore
      }
      return;
    }

    setIntroState("playing");

    // Total sequence ≈ 4500ms (1500ms black → 2000ms galaxy fade → 1000ms overlap)
    const doneTimer = setTimeout(() => {
      setIntroState("done");
      markGlass();
      try {
        sessionStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // ignore
      }
    }, 4500);

    return () => clearTimeout(doneTimer);
  }, [introState, setIntroState, setReducedMotion, markActive, markGlass]);
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/hooks/useIntroSequence.js
git commit -m "feat(client): useIntroSequence with sessionStorage + ?replay override"
```

---

### Task C9: Part C checkpoint — lint + quick smoke

- [ ] **Step 1: Lint + test**

```bash
cd C:/Users/andre/skyvault/client
npm run lint && npm test
```

Expected: both pass. No tests yet for these modules — they come in Part G.

- [ ] **Step 2: Dev server still boots**

```bash
cd C:/Users/andre/skyvault/client
npm run dev
```

Open http://localhost:5173. Page should still render "SkyVault — scaffold placeholder". Ctrl+C.

Part C complete. All state and hooks exist.

---

## Part D — Layout Shell

Build the outermost visual structure: background, frame with gold brackets, header, footer, intro sequence orchestrator, and the App.jsx root that ties everything together. The hero region and info panels are placeholders here — they get content in Parts E/F.

---

### Task D1: `<AppBackground>`

**Files:**
- Create: `client/src/components/layout/AppBackground.jsx`

- [ ] **Step 1: Create the component**

```jsx
/**
 * Fixed-position full-viewport Milky Way background.
 * All CSS (::before for image, ::after for vignette) lives in global.css.
 * This component just renders the div that carries the .app-background class.
 */
export default function AppBackground() {
  return <div className="app-background" aria-hidden="true" />;
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/components/layout/AppBackground.jsx
git commit -m "feat(client): AppBackground component"
```

---

### Task D2: `<FrameContainer>` with gold corner brackets

**Files:**
- Create: `client/src/components/layout/FrameContainer.jsx`

- [ ] **Step 1: Create the component**

```jsx
/**
 * Outer framed container. Max-width 1280px centered, thin accent-dim border,
 * gold corner brackets via CSS ::before / ::after pseudo-elements on the
 * `.frame` class (defined in global.css).
 */
export default function FrameContainer({ children }) {
  return (
    <div className="frame relative mx-auto w-full max-w-[1280px] border border-accent-dim/40 bg-bg-frame px-6 py-10 md:px-10 md:py-14">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/components/layout/FrameContainer.jsx
git commit -m "feat(client): FrameContainer with gold corner brackets"
```

---

### Task D3: `<Header>`

**Files:**
- Create: `client/src/components/layout/Header.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useObserverStore } from "../../stores/observerStore.js";
import { formatDisplayDatetime } from "../../utils/formatDatetime.js";
import { formatLatLon } from "../../utils/formatCoords.js";

/**
 * Top header with eyebrow, italic serif title, and metadata subhead.
 * All three update live from observerStore after a successful submit.
 */
export default function Header() {
  const { selected, datetimeUtc } = useObserverStore();

  const titlePlace = selected?.displayName
    ? selected.displayName.split(",")[0]
    : null;
  const subhead =
    selected && datetimeUtc
      ? `${formatDisplayDatetime(datetimeUtc)} · ${formatLatLon(
          selected.lat,
          selected.lon
        )}`
      : "Enter a location to begin";

  return (
    <header className="header mb-10 border-b border-rule pb-8 text-center">
      <div className="flex items-center justify-center gap-4">
        <span className="h-px w-16 bg-accent-dim" />
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
          OBSERVATORIUM · SKYVAULT
        </span>
        <span className="h-px w-16 bg-accent-dim" />
      </div>
      <h1 className="mt-5 font-serif italic text-ink text-[clamp(32px,6vw,58px)] leading-tight">
        {titlePlace ? `The Sky over ${titlePlace}` : "The Sky · SkyVault"}
      </h1>
      <p className="mt-3 font-mono text-xs uppercase tracking-widest text-ink-dim">
        {subhead}
      </p>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/components/layout/Header.jsx
git commit -m "feat(client): Header with dynamic title and subhead"
```

---

### Task D4: `<Footer>`

**Files:**
- Create: `client/src/components/layout/Footer.jsx`

- [ ] **Step 1: Create the component**

```jsx
/**
 * Attribution footer. Primary line lists data sources; secondary line
 * credits the Milky Way background image.
 */
export default function Footer() {
  return (
    <footer className="footer mt-12 border-t border-rule pt-6 text-center font-mono uppercase tracking-[0.2em] text-[11px] text-ink-dim">
      <div className="text-accent-dim">
        POWERED BY ESA GAIA DR3 · NASA JPL · IAU · ESO
      </div>
      <div className="mt-2 text-[10px] tracking-[0.15em] text-ink-dim/70">
        Milky Way: ESO/S. Brunier · CC-BY 4.0
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/components/layout/Footer.jsx
git commit -m "feat(client): Footer with data source attribution"
```

---

### Task D5: `<IntroSequence>` orchestrator

**Files:**
- Create: `client/src/components/layout/IntroSequence.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useEffect } from "react";
import { useIntroSequence } from "../../hooks/useIntroSequence.js";
import { useIdle } from "../../hooks/useIdle.js";
import { useUiStateStore } from "../../stores/uiStateStore.js";

/**
 * Orchestrates the visual intro choreography and hands off to useIdle.
 *
 * Wraps children in a div that carries `.intro-content` so global.css
 * keyframe animations target the content fade-in.
 *
 * Body classes:
 *   .intro-pending    — black screen, content invisible
 *   .intro-playing    — galaxy + content fade-in animations running
 *   .intro-done       — final state
 *   .ui-normal/glass/hidden — driven by useIdle
 */
export default function IntroSequence({ children }) {
  useIntroSequence();

  const { introState, activityState } = useUiStateStore();

  // Activate idle detection only after intro is done
  useIdle({ enabled: introState === "done" });

  // Mirror intro + activity state to document body classes for CSS
  useEffect(() => {
    const body = document.body;
    body.classList.remove("intro-pending", "intro-playing", "intro-done");
    body.classList.add(`intro-${introState}`);
  }, [introState]);

  useEffect(() => {
    const body = document.body;
    body.classList.remove("ui-normal", "ui-glass", "ui-hidden");
    body.classList.add(`ui-${activityState}`);
  }, [activityState]);

  return <div className="intro-content">{children}</div>;
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/components/layout/IntroSequence.jsx
git commit -m "feat(client): IntroSequence orchestrator with body class sync"
```

---

### Task D6: Wire the shell into `<App>`

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Replace `App.jsx` with the shell wiring**

```jsx
import AppBackground from "./components/layout/AppBackground.jsx";
import IntroSequence from "./components/layout/IntroSequence.jsx";
import FrameContainer from "./components/layout/FrameContainer.jsx";
import Header from "./components/layout/Header.jsx";
import Footer from "./components/layout/Footer.jsx";

export default function App() {
  return (
    <>
      <AppBackground />
      <IntroSequence>
        <FrameContainer>
          <Header />
          <main className="space-y-10">
            {/* HeroRegion placeholder — real content in Part F */}
            <section className="hero flex aspect-[16/9] w-full items-center justify-center border border-rule bg-bg/60 md:aspect-[16/9]">
              <p className="font-serif italic text-ink-dim text-lg">
                Interactive sky chart · arrives next session
              </p>
            </section>

            {/* ControlsStrip placeholder — real content in Part E */}
            <section className="controls-strip border border-rule bg-bg/60 p-6 text-ink-dim">
              <p className="font-mono text-xs uppercase tracking-widest">
                Controls strip placeholder
              </p>
            </section>

            {/* InfoPanelsGrid placeholder — real content in Part F */}
            <section className="space-y-6">
              <div className="panel border border-rule bg-bg/60 p-6 text-ink-dim">
                <p className="font-mono text-xs uppercase tracking-widest">
                  Info panels placeholder
                </p>
              </div>
            </section>
          </main>
          <Footer />
        </FrameContainer>
      </IntroSequence>
    </>
  );
}
```

- [ ] **Step 2: Smoke test — boot dev server, verify shell renders**

```bash
cd C:/Users/andre/skyvault/client
npm run dev
```

Open http://localhost:5173. You should see:
1. A brief black screen (~1.5s), then
2. The Milky Way background fading in (it'll be gray-noisy until Task H1 downloads the real image)
3. The framed container with eyebrow, serif title "The Sky · SkyVault", subhead "Enter a location to begin"
4. Placeholder sections for hero, controls, info panels
5. Footer attribution

After 15s idle → content fades to glass. Move mouse → snaps back.

**Note:** Without the Milky Way image on disk yet, the `::before` pseudo-element will just show the base `#05060d` color. That's fine for now — Task H1 adds the image file.

Ctrl+C to stop.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/App.jsx
git commit -m "feat(client): wire AppBackground, IntroSequence, FrameContainer shell"
```

Part D complete. The full layout shell renders with the intro animation and idle state machine wired up.

---

## Part E — Controls Strip

Build the form that drives the whole app: location input, date/time/timezone, submit button, and the candidate dropdown. Each component is small and focused; they're composed in `ControlsStrip.jsx` at the end.

---

### Task E1: UI primitives — `<Panel>`, `<Button>`, `<LoadingSkeleton>`, `<ErrorCard>`, `<SourceBadge>`

**Files:**
- Create: `client/src/components/ui/Panel.jsx`
- Create: `client/src/components/ui/Button.jsx`
- Create: `client/src/components/ui/LoadingSkeleton.jsx`
- Create: `client/src/components/ui/ErrorCard.jsx`
- Create: `client/src/components/info/SourceBadge.jsx`

- [ ] **Step 1: Create `Panel.jsx`**

```jsx
/**
 * Reusable panel primitive. Semi-transparent dark backdrop, thin rule
 * border, optional `title` rendered in mono amber.
 *
 * Carries the `.panel` class so the global idle-state CSS rules apply.
 */
export default function Panel({ title, children, className = "" }) {
  return (
    <section
      className={`panel border border-rule bg-[color:var(--bg-panel)] backdrop-blur-sm p-6 ${className}`}
    >
      {title && (
        <header className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
          {title}
        </header>
      )}
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Create `Button.jsx`**

```jsx
/**
 * Shared button primitive with three visual variants.
 *   variant="primary" — amber accent, uppercase mono (submit)
 *   variant="ghost"   — transparent with accent border
 *   variant="disabled" — for the "EXPLORE IN 3D" stub
 */
export default function Button({
  children,
  variant = "primary",
  disabled = false,
  type = "button",
  onClick,
  className = "",
  ...rest
}) {
  const base =
    "font-mono text-[12px] uppercase tracking-[0.2em] px-5 py-3 border transition-colors duration-200";
  const variants = {
    primary:
      "border-accent text-accent hover:bg-accent hover:text-bg disabled:opacity-40 disabled:cursor-not-allowed",
    ghost:
      "border-accent-dim text-ink-dim hover:border-accent hover:text-accent",
    disabled:
      "border-accent-dim text-accent-dim cursor-not-allowed",
  };

  return (
    <button
      type={type}
      disabled={disabled || variant === "disabled"}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Create `LoadingSkeleton.jsx`**

```jsx
/**
 * Simple pulsing skeleton for panel content while queries are in flight.
 */
export default function LoadingSkeleton({ lines = 3 }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 w-full animate-pulse rounded bg-rule/60"
          style={{ width: `${60 + (i % 3) * 15}%` }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `ErrorCard.jsx`**

```jsx
/**
 * Panel-scoped error display. Doesn't take over the whole app — lives
 * inside whichever parent triggered the error.
 */
export default function ErrorCard({ title = "Something went wrong", message, onRetry }) {
  return (
    <div className="border border-danger/40 bg-danger/5 p-4 text-ink-dim">
      <p className="font-mono text-xs uppercase tracking-widest text-danger">
        {title}
      </p>
      {message && (
        <p className="mt-2 font-serif italic text-sm text-ink">{message}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 font-mono text-[11px] uppercase tracking-widest text-accent hover:underline"
        >
          Retry →
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `SourceBadge.jsx`**

```jsx
/**
 * Small attribution chip. Rendered on every info row.
 */
export default function SourceBadge({ source, identifier }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-accent-dim">
      {source}
      {identifier ? ` · ${identifier}` : ""}
    </span>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/components/ui/ client/src/components/info/SourceBadge.jsx
git commit -m "feat(client): Panel, Button, LoadingSkeleton, ErrorCard, SourceBadge primitives"
```

---

### Task E2: `<LocationInput>` + `<DidYouMeanDropdown>`

**Files:**
- Create: `client/src/components/controls/LocationInput.jsx`
- Create: `client/src/components/controls/DidYouMeanDropdown.jsx`

- [ ] **Step 1: Create `DidYouMeanDropdown.jsx`**

```jsx
import { useObserverStore } from "../../stores/observerStore.js";

const FLAG_BY_COUNTRY_CODE = {
  // A tiny built-in map for visual polish. Unknown countries get a generic
  // globe emoji. Not an authoritative list — just nice to have.
  "United States": "🇺🇸",
  "Ecuador": "🇪🇨",
  "France": "🇫🇷",
  "United Kingdom": "🇬🇧",
  "Canada": "🇨🇦",
  "Mexico": "🇲🇽",
  "Brazil": "🇧🇷",
  "Argentina": "🇦🇷",
  "Colombia": "🇨🇴",
  "Peru": "🇵🇪",
  "Japan": "🇯🇵",
  "Germany": "🇩🇪",
  "Spain": "🇪🇸",
  "Italy": "🇮🇹",
  "Australia": "🇦🇺",
};

function flagFor(country) {
  return FLAG_BY_COUNTRY_CODE[country] || "🌐";
}

export default function DidYouMeanDropdown() {
  const { candidates, selectCandidate } = useObserverStore();
  if (!candidates || candidates.length === 0) return null;

  return (
    <div className="mt-2 border border-accent-dim/50 bg-[color:var(--bg-panel)] backdrop-blur-sm">
      <div className="border-b border-rule px-4 py-2 font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
        Did you mean
      </div>
      <ul>
        {candidates.map((c, idx) => (
          <li key={`${c.osm_id || idx}-${c.display_name}`}>
            <button
              type="button"
              onClick={() => selectCandidate(idx)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/10"
            >
              <span className="text-xl">{flagFor(c.country)}</span>
              <span className="font-serif italic text-ink">{c.display_name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Create `LocationInput.jsx`**

```jsx
import { useObserverStore } from "../../stores/observerStore.js";
import DidYouMeanDropdown from "./DidYouMeanDropdown.jsx";

export default function LocationInput() {
  const { rawQuery, setRawQuery, submit } = useObserverStore();

  return (
    <div className="flex-1 min-w-0">
      <label className="block font-mono text-[10px] uppercase tracking-[0.25em] text-ink-dim mb-1">
        Location
      </label>
      <input
        type="text"
        value={rawQuery}
        onChange={(e) => setRawQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="City, country (e.g., Portoviejo, Ecuador)"
        className="w-full border border-rule bg-bg/60 px-3 py-3 font-serif italic text-ink placeholder:text-ink-dim/70 focus:border-accent focus:outline-none"
      />
      <DidYouMeanDropdown />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/components/controls/LocationInput.jsx client/src/components/controls/DidYouMeanDropdown.jsx
git commit -m "feat(client): LocationInput and DidYouMeanDropdown"
```

---

### Task E3: `<UseMyLocationButton>`, `<DateInput>`, `<TimeInput>`, `<TimezoneToggle>`

**Files:**
- Create: `client/src/components/controls/UseMyLocationButton.jsx`
- Create: `client/src/components/controls/DateInput.jsx`
- Create: `client/src/components/controls/TimeInput.jsx`
- Create: `client/src/components/controls/TimezoneToggle.jsx`

- [ ] **Step 1: Create `UseMyLocationButton.jsx`**

```jsx
import { useEffect } from "react";
import { useGeolocation } from "../../hooks/useGeolocation.js";
import { useObserverStore } from "../../stores/observerStore.js";

export default function UseMyLocationButton() {
  const { position, error, isLoading, request } = useGeolocation();
  const useCurrentLocation = useObserverStore((s) => s.useCurrentLocation);

  useEffect(() => {
    if (position) {
      useCurrentLocation(position.lat, position.lon, "Current location");
    }
  }, [position, useCurrentLocation]);

  return (
    <div className="flex flex-col">
      <label className="block font-mono text-[10px] uppercase tracking-[0.25em] text-ink-dim mb-1">
        &nbsp;
      </label>
      <button
        type="button"
        onClick={request}
        disabled={isLoading}
        title="Use my current location"
        className="border border-rule bg-bg/60 px-4 py-3 text-ink hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {isLoading ? "…" : "📍"}
      </button>
      {error && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-danger">
          {error.code === 1
            ? "Location denied"
            : "Couldn't get location"}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `DateInput.jsx`**

```jsx
import { useEffect } from "react";
import { useObserverStore } from "../../stores/observerStore.js";

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DateInput() {
  const { date, setDate } = useObserverStore();

  useEffect(() => {
    if (!date) setDate(todayIso());
  }, [date, setDate]);

  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-[0.25em] text-ink-dim mb-1">
        Date
      </label>
      <input
        type="date"
        min="1900-01-01"
        max="2100-12-31"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="border border-rule bg-bg/60 px-3 py-3 font-mono text-sm text-ink focus:border-accent focus:outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 3: Create `TimeInput.jsx`**

```jsx
import { useObserverStore } from "../../stores/observerStore.js";

export default function TimeInput() {
  const { time, setTime } = useObserverStore();
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-[0.25em] text-ink-dim mb-1">
        Time (optional)
      </label>
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="border border-rule bg-bg/60 px-3 py-3 font-mono text-sm text-ink focus:border-accent focus:outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 4: Create `TimezoneToggle.jsx`**

```jsx
import { useObserverStore } from "../../stores/observerStore.js";

export default function TimezoneToggle() {
  const { timezone, setTimezone } = useObserverStore();

  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-[0.25em] text-ink-dim mb-1">
        TZ
      </label>
      <div className="inline-flex border border-rule">
        {["Local", "UTC"].map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setTimezone(opt)}
            className={`px-3 py-3 font-mono text-xs uppercase tracking-widest ${
              timezone === opt
                ? "bg-accent/20 text-accent"
                : "text-ink-dim hover:text-ink"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/components/controls/
git commit -m "feat(client): UseMyLocationButton, DateInput, TimeInput, TimezoneToggle"
```

---

### Task E4: `<SubmitButton>`

**Files:**
- Create: `client/src/components/controls/SubmitButton.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useObserverStore } from "../../stores/observerStore.js";
import Button from "../ui/Button.jsx";

export default function SubmitButton({ isGeocoding, isComputing }) {
  const { rawQuery, date, submit } = useObserverStore();
  const disabled = !rawQuery || rawQuery.length < 2 || !date;

  let label = "GO →";
  if (isGeocoding) label = "LOOKING UP…";
  else if (isComputing) label = "COMPUTING SKY…";

  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-[0.25em] text-ink-dim mb-1">
        &nbsp;
      </label>
      <Button
        variant="primary"
        disabled={disabled || isGeocoding || isComputing}
        onClick={() => submit()}
      >
        {label}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/components/controls/SubmitButton.jsx
git commit -m "feat(client): SubmitButton with loading states"
```

---

### Task E5: `<ControlsStrip>` — composition + query wiring

**Files:**
- Create: `client/src/components/controls/ControlsStrip.jsx`
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Create `ControlsStrip.jsx`**

```jsx
import { useEffect } from "react";
import { useObserverStore } from "../../stores/observerStore.js";
import { useGeocode } from "../../hooks/useGeocode.js";
import { useSky } from "../../hooks/useSky.js";
import { usePlanets } from "../../hooks/usePlanets.js";
import LocationInput from "./LocationInput.jsx";
import UseMyLocationButton from "./UseMyLocationButton.jsx";
import DateInput from "./DateInput.jsx";
import TimeInput from "./TimeInput.jsx";
import TimezoneToggle from "./TimezoneToggle.jsx";
import SubmitButton from "./SubmitButton.jsx";
import ErrorCard from "../ui/ErrorCard.jsx";

export default function ControlsStrip() {
  const { rawQuery, selected, datetimeUtc, geocodeRequested, setCandidates } =
    useObserverStore();

  // Geocode query — fires when submit() sets geocodeRequested
  const geocode = useGeocode(rawQuery, geocodeRequested);

  useEffect(() => {
    if (geocode.data?.candidates) {
      setCandidates(geocode.data.candidates);
    }
  }, [geocode.data, setCandidates]);

  // Sky + planets queries — fire when a candidate has been selected
  const sky = useSky(selected, datetimeUtc);
  const planets = usePlanets(selected, datetimeUtc);

  const isComputing = sky.isFetching || planets.isFetching;

  return (
    <section className="controls-strip border border-rule bg-[color:var(--bg-panel)] backdrop-blur-sm p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-4">
        <LocationInput />
        <UseMyLocationButton />
        <DateInput />
        <TimeInput />
        <TimezoneToggle />
        <SubmitButton
          isGeocoding={geocode.isFetching}
          isComputing={isComputing}
        />
      </div>

      {geocode.isError && (
        <div className="mt-4">
          <ErrorCard
            title="Geocoder unavailable"
            message={
              geocode.error?.status === 503
                ? "Couldn't reach the place lookup service. Try again, or use your current location."
                : geocode.error?.message || "Unknown error"
            }
            onRetry={() => geocode.refetch()}
          />
        </div>
      )}
      {geocode.data && geocode.data.count === 0 && (
        <p className="mt-4 font-serif italic text-sm text-ink-dim">
          No matches found for &ldquo;{rawQuery}&rdquo;. Try a larger nearby
          city or your current location.
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Mount `<ControlsStrip>` in `App.jsx`**

Replace the controls-strip placeholder section in `App.jsx` with:

```jsx
import ControlsStrip from "./components/controls/ControlsStrip.jsx";
```

And replace the existing placeholder:

```jsx
<ControlsStrip />
```

- [ ] **Step 3: Smoke test against the running backend**

Start the backend in one shell:
```bash
cd C:/Users/andre/skyvault/server
uvicorn app.main:app --reload --port 8000
```

Start the frontend in another shell:
```bash
cd C:/Users/andre/skyvault/client
npm run dev
```

Open http://localhost:5173:
1. Fill in `Portoviejo` as location
2. Date defaults to today
3. Click GO
4. Dropdown appears with "Did you mean..." and candidates including Portoviejo, Ecuador
5. Click Portoviejo → `sky` and `planets` queries fire (check Network tab)
6. Info panels placeholder section still shows — it gets real content in Part F

Stop both servers.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/components/controls/ControlsStrip.jsx client/src/App.jsx
git commit -m "feat(client): ControlsStrip composes inputs and wires queries"
```

Part E complete. The form is functional end-to-end against a real backend.

---

## Part F — Hero + Info Panels

The hero region holds the reserved sky chart slot (placeholder this session). The info panels render real Gaia DR3 + JPL DE421 data.

---

### Task F1: `<HeroRegion>` + `<ExploreIn3DButton>`

**Files:**
- Create: `client/src/components/hero/HeroRegion.jsx`
- Create: `client/src/components/hero/ExploreIn3DButton.jsx`

- [ ] **Step 1: Create `ExploreIn3DButton.jsx`**

```jsx
import Button from "../ui/Button.jsx";

/**
 * Disabled stub button that promises the Three.js Explore Mode.
 * Phase 4 unlocks this and routes it somewhere real.
 */
export default function ExploreIn3DButton() {
  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="disabled" disabled title="Coming in a future phase">
        EXPLORE IN 3D →
      </Button>
      <span className="font-mono text-[10px] uppercase tracking-widest text-accent-dim">
        coming soon
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create `HeroRegion.jsx`**

```jsx
import ExploreIn3DButton from "./ExploreIn3DButton.jsx";

/**
 * Reserved 16:9 slot for the Canvas 2D sky chart (Phase 2b).
 * In Phase 2a it holds a "coming soon" placeholder + 3D button stub.
 */
export default function HeroRegion() {
  return (
    <section className="hero relative aspect-[4/3] w-full overflow-hidden border border-rule bg-bg/80 md:aspect-[16/9]">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent-dim">
          Interactive Sky Chart
        </p>
        <p className="font-serif italic text-ink text-xl md:text-2xl">
          Arrives next session
        </p>
        <ExploreIn3DButton />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/components/hero/
git commit -m "feat(client): HeroRegion placeholder with ExploreIn3DButton stub"
```

---

### Task F2: `<MoonSvg>` — phase-accurate moon illustration

**Files:**
- Create: `client/src/components/info/MoonSvg.jsx`

- [ ] **Step 1: Create the component**

```jsx
/**
 * Phase-accurate 2D moon illustration.
 *
 * Rendered by computing the terminator as an elliptical arc whose horizontal
 * radius is |cos(phase_angle)| of the moon's radius, combined with either
 * a full half-circle (waxing → right half lit, waning → left half lit).
 *
 * phaseAngle: 0 = full, 90 = quarter, 180 = new
 * waxing: true → waxing (right side illuminated in Northern Hemisphere)
 */
export default function MoonSvg({ phaseAngle, phaseName, size = 120 }) {
  if (phaseAngle == null) {
    return (
      <div
        className="flex items-center justify-center border border-rule"
        style={{ width: size, height: size }}
      >
        <span className="font-mono text-[10px] text-ink-dim">no data</span>
      </div>
    );
  }

  const r = size / 2;
  const phaseRad = (phaseAngle * Math.PI) / 180;
  // Terminator is an ellipse with horizontal radius r * cos(phaseAngle)
  const rx = Math.abs(r * Math.cos(phaseRad));

  const waxing = (phaseName || "").startsWith("waxing");
  const isFull = phaseAngle < 7;
  const isNew = phaseAngle > 173;

  // Decide which side is illuminated
  // Waxing: right side lit. Waning: left side lit.
  // When phase_angle < 90, illuminated area > 50% (gibbous): full disk with
  // terminator ellipse in the opposite hemisphere darkened.
  // When phase_angle > 90, illuminated area < 50% (crescent): a thin sliver
  // shape formed by two arcs.

  const bright = "#f4ecd8";
  const dark = "#1a1f33";

  if (isNew) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={r} cy={r} r={r - 1} fill={dark} stroke="#3a3f55" />
      </svg>
    );
  }
  if (isFull) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={r} cy={r} r={r - 1} fill={bright} stroke="#888" />
      </svg>
    );
  }

  // Gibbous vs crescent
  const isGibbous = phaseAngle < 90;
  // For gibbous: full bright disc with a dark ellipse punched on one side
  // For crescent: dark disc with a bright ellipse carved out on one side

  const sweepSign = waxing ? 0 : 1; // arc sweep direction

  if (isGibbous) {
    // Disc + dark terminator ellipse path
    // The dark shape is bounded by the disc half-arc on one side and the
    // terminator ellipse on the other.
    const darkSide = waxing ? "left" : "right";
    const startX = darkSide === "left" ? 0 : size;
    const endX = darkSide === "left" ? 0 : size;
    // Arc from top (r,0) down to bottom (r, size) via the far edge
    // Then terminator ellipse back up
    const pathD =
      darkSide === "left"
        ? `M ${r},0 A ${r},${r} 0 0 0 ${r},${size} A ${rx},${r} 0 0 ${sweepSign} ${r},0 Z`
        : `M ${r},0 A ${r},${r} 0 0 1 ${r},${size} A ${rx},${r} 0 0 ${sweepSign} ${r},0 Z`;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={r} cy={r} r={r - 1} fill={bright} stroke="#888" />
        <path d={pathD} fill={dark} />
      </svg>
    );
  }

  // Crescent
  const brightSide = waxing ? "right" : "left";
  const pathD =
    brightSide === "right"
      ? `M ${r},0 A ${r},${r} 0 0 1 ${r},${size} A ${rx},${r} 0 0 ${sweepSign ? 0 : 1} ${r},0 Z`
      : `M ${r},0 A ${r},${r} 0 0 0 ${r},${size} A ${rx},${r} 0 0 ${sweepSign ? 0 : 1} ${r},0 Z`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={r} cy={r} r={r - 1} fill={dark} stroke="#3a3f55" />
      <path d={pathD} fill={bright} />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/components/info/MoonSvg.jsx
git commit -m "feat(client): MoonSvg phase-accurate illustration"
```

---

### Task F3: `<LunarPanel>`

**Files:**
- Create: `client/src/components/info/LunarPanel.jsx`

- [ ] **Step 1: Create the component**

```jsx
import Panel from "../ui/Panel.jsx";
import LoadingSkeleton from "../ui/LoadingSkeleton.jsx";
import ErrorCard from "../ui/ErrorCard.jsx";
import MoonSvg from "./MoonSvg.jsx";
import SourceBadge from "./SourceBadge.jsx";

function moonFromPlanets(data) {
  if (!data?.planets) return null;
  return data.planets.find((p) => p.name === "moon") || null;
}

export default function LunarPanel({ query }) {
  if (query.isLoading) {
    return (
      <Panel title="Lunar Conditions">
        <LoadingSkeleton lines={4} />
      </Panel>
    );
  }

  if (query.isError) {
    return (
      <Panel title="Lunar Conditions">
        <ErrorCard
          title="Failed to load lunar data"
          message={query.error?.message}
          onRetry={() => query.refetch()}
        />
      </Panel>
    );
  }

  const moon = moonFromPlanets(query.data);
  if (!moon) {
    return (
      <Panel title="Lunar Conditions">
        <p className="font-serif italic text-ink-dim">Moon below horizon</p>
      </Panel>
    );
  }

  const illuminationPct =
    moon.illumination != null ? Math.round(moon.illumination * 100) : null;

  return (
    <Panel title="Lunar Conditions">
      <div className="flex items-center gap-6">
        <MoonSvg
          phaseAngle={moon.phase_angle}
          phaseName={moon.phase_name}
          size={100}
        />
        <div className="flex-1 space-y-2">
          {moon.phase_name && (
            <p className="font-serif italic text-ink text-lg">
              {moon.phase_name}
            </p>
          )}
          {illuminationPct != null && (
            <p className="font-mono text-sm text-ink-dim">
              Illumination: <span className="text-ink">{illuminationPct}%</span>
            </p>
          )}
          <p className="font-mono text-sm text-ink-dim">
            Altitude: <span className="text-ink">{moon.alt.toFixed(1)}°</span>
          </p>
          <p className="font-mono text-sm text-ink-dim">
            Azimuth: <span className="text-ink">{moon.az.toFixed(1)}°</span>
          </p>
        </div>
      </div>
      <div className="mt-4">
        <SourceBadge source={moon.source} />
      </div>
    </Panel>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/components/info/LunarPanel.jsx
git commit -m "feat(client): LunarPanel with MoonSvg and real DE421 data"
```

---

### Task F4: `<PlanetsPanel>` + `<StarsPanel>` + `<InfoPanelsGrid>`

**Files:**
- Create: `client/src/components/info/PlanetsPanel.jsx`
- Create: `client/src/components/info/StarsPanel.jsx`
- Create: `client/src/components/info/InfoPanelsGrid.jsx`

- [ ] **Step 1: Create `PlanetsPanel.jsx`**

```jsx
import Panel from "../ui/Panel.jsx";
import LoadingSkeleton from "../ui/LoadingSkeleton.jsx";
import ErrorCard from "../ui/ErrorCard.jsx";
import SourceBadge from "./SourceBadge.jsx";

const DISPLAY_ORDER = [
  "sun",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
];

const PRETTY_NAMES = {
  sun: "The Sun",
  mercury: "Mercury",
  venus: "Venus",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uranus",
  neptune: "Neptune",
};

export default function PlanetsPanel({ query }) {
  if (query.isLoading) {
    return (
      <Panel title="Wandering Stars">
        <LoadingSkeleton lines={6} />
      </Panel>
    );
  }

  if (query.isError) {
    return (
      <Panel title="Wandering Stars">
        <ErrorCard
          title="Failed to load planet data"
          message={query.error?.message}
          onRetry={() => query.refetch()}
        />
      </Panel>
    );
  }

  const all = query.data?.planets || [];
  // Filter out Moon (handled by LunarPanel) and preserve orbital order
  const byName = new Map(all.filter((p) => p.name !== "moon").map((p) => [p.name, p]));
  const rows = DISPLAY_ORDER.map((name) => byName.get(name)).filter(Boolean);

  return (
    <Panel title="Wandering Stars">
      <table className="w-full">
        <thead>
          <tr className="font-mono text-[10px] uppercase tracking-widest text-ink-dim">
            <th className="pb-2 text-left">Body</th>
            <th className="pb-2 text-right">Alt</th>
            <th className="pb-2 text-right">Az</th>
            <th className="pb-2 text-right">Dist (AU)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const belowHorizon = p.alt < 0;
            return (
              <tr
                key={p.name}
                className={belowHorizon ? "text-ink-dim line-through decoration-ink-dim/50" : "text-ink"}
              >
                <td className="py-1 font-serif italic">
                  {PRETTY_NAMES[p.name] || p.name}
                </td>
                <td className="py-1 text-right font-mono text-sm">
                  {p.alt.toFixed(1)}°
                </td>
                <td className="py-1 text-right font-mono text-sm">
                  {p.az.toFixed(1)}°
                </td>
                <td className="py-1 text-right font-mono text-sm">
                  {p.distance_au.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-4">
        <SourceBadge source="JPL DE421 via Astropy" />
      </div>
    </Panel>
  );
}
```

- [ ] **Step 2: Create `StarsPanel.jsx`**

```jsx
import Panel from "../ui/Panel.jsx";
import LoadingSkeleton from "../ui/LoadingSkeleton.jsx";
import ErrorCard from "../ui/ErrorCard.jsx";
import SourceBadge from "./SourceBadge.jsx";
import { bvToHex } from "../../utils/bvToColor.js";

const TOP_N = 30;

export default function StarsPanel({ query }) {
  if (query.isLoading) {
    return (
      <Panel title="Brightest Stars">
        <LoadingSkeleton lines={8} />
      </Panel>
    );
  }

  if (query.isError) {
    return (
      <Panel title="Brightest Stars">
        <ErrorCard
          title="Failed to load star data"
          message={query.error?.message}
          onRetry={() => query.refetch()}
        />
      </Panel>
    );
  }

  const stars = query.data?.stars || [];
  if (stars.length === 0) {
    return (
      <Panel title="Brightest Stars">
        <p className="font-serif italic text-ink-dim">
          No stars above the horizon at this time and location.
        </p>
      </Panel>
    );
  }

  const top = [...stars]
    .sort((a, b) => a.magnitude - b.magnitude)
    .slice(0, TOP_N);

  return (
    <Panel title="Brightest Stars">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-widest text-ink-dim">
              <th className="pb-2 text-left">Star</th>
              <th className="pb-2 text-right">Mag</th>
              <th className="pb-2 text-right">Alt</th>
              <th className="pb-2 text-right">Az</th>
              <th className="pb-2 text-right">Distance (ly)</th>
            </tr>
          </thead>
          <tbody>
            {top.map((s) => (
              <tr key={s.source_id} className="border-t border-rule/40">
                <td className="py-1.5 font-mono text-xs text-ink">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: bvToHex(s.bp_rp) }}
                      aria-hidden="true"
                    />
                    <span className="text-ink-dim">Gaia</span>
                    <span>{String(s.source_id).slice(-9)}</span>
                  </span>
                </td>
                <td className="py-1.5 text-right font-mono text-xs text-ink">
                  {s.magnitude.toFixed(2)}
                </td>
                <td className="py-1.5 text-right font-mono text-xs text-ink">
                  {s.alt.toFixed(1)}°
                </td>
                <td className="py-1.5 text-right font-mono text-xs text-ink">
                  {s.az.toFixed(1)}°
                </td>
                <td className="py-1.5 text-right font-mono text-xs text-ink">
                  {s.distance_ly != null ? s.distance_ly.toFixed(1) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <SourceBadge source="Gaia DR3" />
      </div>
    </Panel>
  );
}
```

- [ ] **Step 3: Create `InfoPanelsGrid.jsx`**

```jsx
import { useObserverStore } from "../../stores/observerStore.js";
import { useSky } from "../../hooks/useSky.js";
import { usePlanets } from "../../hooks/usePlanets.js";
import LunarPanel from "./LunarPanel.jsx";
import PlanetsPanel from "./PlanetsPanel.jsx";
import StarsPanel from "./StarsPanel.jsx";

export default function InfoPanelsGrid() {
  const { selected, datetimeUtc } = useObserverStore();
  const sky = useSky(selected, datetimeUtc);
  const planets = usePlanets(selected, datetimeUtc);

  // Don't render panels until the user has submitted + selected
  if (!selected || !datetimeUtc) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <LunarPanel query={planets} />
        <PlanetsPanel query={planets} />
      </div>
      <StarsPanel query={sky} />
    </div>
  );
}
```

- [ ] **Step 4: Wire `<InfoPanelsGrid>` and `<HeroRegion>` into `App.jsx`**

Update `client/src/App.jsx` to:

```jsx
import AppBackground from "./components/layout/AppBackground.jsx";
import IntroSequence from "./components/layout/IntroSequence.jsx";
import FrameContainer from "./components/layout/FrameContainer.jsx";
import Header from "./components/layout/Header.jsx";
import Footer from "./components/layout/Footer.jsx";
import HeroRegion from "./components/hero/HeroRegion.jsx";
import ControlsStrip from "./components/controls/ControlsStrip.jsx";
import InfoPanelsGrid from "./components/info/InfoPanelsGrid.jsx";

export default function App() {
  return (
    <>
      <AppBackground />
      <IntroSequence>
        <FrameContainer>
          <Header />
          <main className="space-y-10">
            <HeroRegion />
            <ControlsStrip />
            <InfoPanelsGrid />
          </main>
          <Footer />
        </FrameContainer>
      </IntroSequence>
    </>
  );
}
```

- [ ] **Step 5: Smoke test end-to-end**

Start backend + frontend as in Task E5 Step 3. In the browser:
1. Enter `Miami, FL`
2. Pick today's date
3. Click GO
4. Pick the Miami, FL candidate
5. All three panels populate:
   - LunarPanel with Moon SVG, phase, illumination %, alt/az
   - PlanetsPanel with Sun + 7 planets (below-horizon ones struck through)
   - StarsPanel with top 30 Gaia stars, each with a color dot from BP-RP
6. Header updates to "The Sky over Miami"
7. Every panel has its source badge
8. Leave idle for 15s → content fades to glass. Mouse → NORMAL snap back.

Stop both servers.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/components/info/ client/src/App.jsx
git commit -m "feat(client): PlanetsPanel, StarsPanel, InfoPanelsGrid wiring"
```

Part F complete. The full v1 experience works against real data.

---

## Part G — Frontend Tests

Store and hook tests are pure unit tests (fake timers, mocked browser APIs). Component tests use React Testing Library with a mocked fetch layer. Visual/E2E is explicitly out of scope (Phase 4).

---

### Task G1: `observerStore` tests

**Files:**
- Create: `client/src/__tests__/observerStore.test.js`

- [ ] **Step 1: Create the test file**

```js
import { describe, it, expect, beforeEach } from "vitest";
import { useObserverStore } from "../stores/observerStore.js";

const SAMPLE_CANDIDATES = [
  {
    display_name: "Portoviejo, Manabí, Ecuador",
    name: "Portoviejo",
    country: "Ecuador",
    state: "Manabí",
    lat: -1.0569,
    lon: -80.4544,
  },
  {
    display_name: "Paris, France",
    name: "Paris",
    country: "France",
    state: null,
    lat: 48.85,
    lon: 2.35,
  },
];

describe("observerStore", () => {
  beforeEach(() => {
    useObserverStore.getState().reset();
  });

  it("has sane defaults", () => {
    const s = useObserverStore.getState();
    expect(s.rawQuery).toBe("");
    expect(s.candidates).toEqual([]);
    expect(s.selected).toBeNull();
    expect(s.submitted).toBe(false);
    expect(s.geocodeRequested).toBe(false);
  });

  it("setRawQuery clears stale candidates and selection", () => {
    const store = useObserverStore.getState();
    store.setCandidates(SAMPLE_CANDIDATES);
    store.setRawQuery("Portoviejo");
    const s = useObserverStore.getState();
    expect(s.rawQuery).toBe("Portoviejo");
    expect(s.candidates).toEqual([]);
    expect(s.selected).toBeNull();
  });

  it("submit requires both query and date", () => {
    const store = useObserverStore.getState();
    store.submit();
    expect(useObserverStore.getState().geocodeRequested).toBe(false);

    store.setRawQuery("Portoviejo");
    store.submit();
    expect(useObserverStore.getState().geocodeRequested).toBe(false);

    store.setDate("2026-04-08");
    store.submit();
    expect(useObserverStore.getState().geocodeRequested).toBe(true);
  });

  it("selectCandidate populates selected and computes datetimeUtc", () => {
    const store = useObserverStore.getState();
    store.setRawQuery("Portoviejo");
    store.setDate("2026-04-08");
    store.setTime("22:00");
    store.setTimezone("UTC");
    store.setCandidates(SAMPLE_CANDIDATES);
    store.selectCandidate(0);

    const s = useObserverStore.getState();
    expect(s.selected).toEqual({
      lat: -1.0569,
      lon: -80.4544,
      displayName: "Portoviejo, Manabí, Ecuador",
      country: "Ecuador",
    });
    expect(s.submitted).toBe(true);
    expect(s.geocodeRequested).toBe(false);
    expect(s.datetimeUtc).toBe("2026-04-08T22:00:00.000Z");
  });

  it("selectCandidate with invalid index is a no-op", () => {
    const store = useObserverStore.getState();
    store.setDate("2026-04-08");
    store.setCandidates(SAMPLE_CANDIDATES);
    store.selectCandidate(99);
    expect(useObserverStore.getState().selected).toBeNull();
  });

  it("useCurrentLocation bypasses the geocoder", () => {
    const store = useObserverStore.getState();
    store.setDate("2026-04-08");
    store.setTime("12:00");
    store.setTimezone("UTC");
    store.useCurrentLocation(25.76, -80.19, "Current location");
    const s = useObserverStore.getState();
    expect(s.selected?.lat).toBe(25.76);
    expect(s.selected?.lon).toBe(-80.19);
    expect(s.selected?.displayName).toBe("Current location");
    expect(s.submitted).toBe(true);
    expect(s.datetimeUtc).toBe("2026-04-08T12:00:00.000Z");
  });

  it("reset clears all state", () => {
    const store = useObserverStore.getState();
    store.setRawQuery("Miami");
    store.setDate("2026-04-08");
    store.setCandidates(SAMPLE_CANDIDATES);
    store.selectCandidate(0);
    store.reset();
    const s = useObserverStore.getState();
    expect(s.rawQuery).toBe("");
    expect(s.date).toBe("");
    expect(s.selected).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd C:/Users/andre/skyvault/client
npm test -- observerStore
```

Expected: all 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/__tests__/observerStore.test.js
git commit -m "test(client): observerStore unit tests"
```

---

### Task G2: `uiStateStore` + `formatDatetime` tests

**Files:**
- Create: `client/src/__tests__/uiStateStore.test.js`
- Create: `client/src/__tests__/formatDatetime.test.js`

- [ ] **Step 1: Create `uiStateStore.test.js`**

```js
import { describe, it, expect, beforeEach } from "vitest";
import { useUiStateStore } from "../stores/uiStateStore.js";

describe("uiStateStore", () => {
  beforeEach(() => {
    useUiStateStore.setState({
      introState: "pending",
      activityState: "normal",
      lastActivityAt: Date.now(),
      prefersReducedMotion: false,
    });
  });

  it("has sane defaults", () => {
    const s = useUiStateStore.getState();
    expect(s.introState).toBe("pending");
    expect(s.activityState).toBe("normal");
    expect(s.prefersReducedMotion).toBe(false);
  });

  it("setIntroState transitions through pending → playing → done", () => {
    const store = useUiStateStore.getState();
    store.setIntroState("playing");
    expect(useUiStateStore.getState().introState).toBe("playing");
    store.setIntroState("done");
    expect(useUiStateStore.getState().introState).toBe("done");
  });

  it("markActive sets activityState to normal and updates lastActivityAt", () => {
    const before = useUiStateStore.getState().lastActivityAt;
    useUiStateStore.setState({ activityState: "glass", lastActivityAt: 0 });
    useUiStateStore.getState().markActive();
    const after = useUiStateStore.getState();
    expect(after.activityState).toBe("normal");
    expect(after.lastActivityAt).toBeGreaterThan(before - 1);
  });

  it("markGlass and markHidden set activityState directly", () => {
    const store = useUiStateStore.getState();
    store.markGlass();
    expect(useUiStateStore.getState().activityState).toBe("glass");
    store.markHidden();
    expect(useUiStateStore.getState().activityState).toBe("hidden");
  });

  it("setReducedMotion updates the flag", () => {
    useUiStateStore.getState().setReducedMotion(true);
    expect(useUiStateStore.getState().prefersReducedMotion).toBe(true);
  });
});
```

- [ ] **Step 2: Create `formatDatetime.test.js`**

```js
import { describe, it, expect } from "vitest";
import { toIsoUtc, formatDisplayDatetime } from "../utils/formatDatetime.js";

describe("toIsoUtc", () => {
  it("returns null for empty date", () => {
    expect(toIsoUtc({ date: "", time: "12:00", timezone: "UTC" })).toBeNull();
  });

  it("returns UTC string directly when timezone=UTC", () => {
    const iso = toIsoUtc({
      date: "2026-04-08",
      time: "22:00",
      timezone: "UTC",
    });
    expect(iso).toBe("2026-04-08T22:00:00.000Z");
  });

  it("zero-hour time when empty time is provided in UTC mode", () => {
    const iso = toIsoUtc({ date: "2026-04-08", time: "", timezone: "UTC" });
    // Empty time falls back to "now" — just verify the date portion
    expect(iso).toMatch(/^2026-04-08T/);
  });
});

describe("formatDisplayDatetime", () => {
  it("formats an ISO UTC string as uppercase display", () => {
    const out = formatDisplayDatetime("2026-04-08T22:00:00Z");
    expect(out).toBe("08 APRIL 2026 · 22:00 UTC");
  });

  it("returns empty string for null input", () => {
    expect(formatDisplayDatetime(null)).toBe("");
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd C:/Users/andre/skyvault/client
npm test
```

Expected: all tests from G1 + G2 PASS.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/__tests__/uiStateStore.test.js client/src/__tests__/formatDatetime.test.js
git commit -m "test(client): uiStateStore and formatDatetime unit tests"
```

---

### Task G3: `useIdle` + `useIntroSequence` tests

**Files:**
- Create: `client/src/__tests__/useIdle.test.js`
- Create: `client/src/__tests__/useIntroSequence.test.js`

- [ ] **Step 1: Create `useIdle.test.js`**

```js
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIdle } from "../hooks/useIdle.js";
import { useUiStateStore } from "../stores/uiStateStore.js";

describe("useIdle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUiStateStore.setState({
      introState: "done",
      activityState: "normal",
      lastActivityAt: Date.now(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("transitions normal → glass after 15s of inactivity", () => {
    renderHook(() => useIdle({ enabled: true }));
    act(() => {
      vi.advanceTimersByTime(15_500);
    });
    expect(useUiStateStore.getState().activityState).toBe("glass");
  });

  it("transitions glass → hidden after 5 more seconds", () => {
    renderHook(() => useIdle({ enabled: true }));
    act(() => {
      vi.advanceTimersByTime(15_500);
      vi.advanceTimersByTime(5_500);
    });
    expect(useUiStateStore.getState().activityState).toBe("hidden");
  });

  it("mouse activity resets state to normal", () => {
    renderHook(() => useIdle({ enabled: true }));
    act(() => {
      vi.advanceTimersByTime(15_500);
    });
    expect(useUiStateStore.getState().activityState).toBe("glass");

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove"));
    });
    expect(useUiStateStore.getState().activityState).toBe("normal");
  });

  it("does nothing when enabled=false", () => {
    renderHook(() => useIdle({ enabled: false }));
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(useUiStateStore.getState().activityState).toBe("normal");
  });
});
```

- [ ] **Step 2: Create `useIntroSequence.test.js`**

```js
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIntroSequence } from "../hooks/useIntroSequence.js";
import { useUiStateStore } from "../stores/uiStateStore.js";

describe("useIntroSequence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    useUiStateStore.setState({
      introState: "pending",
      activityState: "normal",
      prefersReducedMotion: false,
    });
    // Mock matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays intro on first mount when sessionStorage flag is unset", () => {
    renderHook(() => useIntroSequence());
    expect(useUiStateStore.getState().introState).toBe("playing");
  });

  it("skips intro when sessionStorage flag is set", () => {
    sessionStorage.setItem("skyvault.introPlayed", "true");
    renderHook(() => useIntroSequence());
    expect(useUiStateStore.getState().introState).toBe("done");
  });

  it("forces intro on ?replay even with sessionStorage flag", () => {
    sessionStorage.setItem("skyvault.introPlayed", "true");
    const originalLocation = window.location;
    delete window.location;
    window.location = new URL("http://localhost:5173/?replay");
    renderHook(() => useIntroSequence());
    expect(useUiStateStore.getState().introState).toBe("playing");
    window.location = originalLocation;
  });

  it("skips intro when prefers-reduced-motion is reduce", () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    renderHook(() => useIntroSequence());
    expect(useUiStateStore.getState().introState).toBe("done");
    expect(useUiStateStore.getState().prefersReducedMotion).toBe(true);
  });

  it("transitions to done after the intro duration", () => {
    renderHook(() => useIntroSequence());
    expect(useUiStateStore.getState().introState).toBe("playing");
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(useUiStateStore.getState().introState).toBe("done");
    expect(sessionStorage.getItem("skyvault.introPlayed")).toBe("true");
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd C:/Users/andre/skyvault/client
npm test
```

Expected: all hook tests PASS along with the previously written ones.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/__tests__/useIdle.test.js client/src/__tests__/useIntroSequence.test.js
git commit -m "test(client): useIdle and useIntroSequence hook tests"
```

---

### Task G4: `LocationInput` component test + `App` smoke test

**Files:**
- Create: `client/src/__tests__/LocationInput.test.jsx`
- Create: `client/src/__tests__/App.test.jsx`

- [ ] **Step 1: Create `LocationInput.test.jsx`**

```jsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LocationInput from "../components/controls/LocationInput.jsx";
import { useObserverStore } from "../stores/observerStore.js";

describe("<LocationInput>", () => {
  beforeEach(() => {
    useObserverStore.getState().reset();
  });

  it("renders an input with the placeholder", () => {
    render(<LocationInput />);
    const input = screen.getByPlaceholderText(/city, country/i);
    expect(input).toBeInTheDocument();
  });

  it("updates rawQuery on typing", () => {
    render(<LocationInput />);
    const input = screen.getByPlaceholderText(/city, country/i);
    fireEvent.change(input, { target: { value: "Portoviejo" } });
    expect(useObserverStore.getState().rawQuery).toBe("Portoviejo");
  });

  it("Enter key triggers submit", () => {
    useObserverStore.setState({ date: "2026-04-08" });
    render(<LocationInput />);
    const input = screen.getByPlaceholderText(/city, country/i);
    fireEvent.change(input, { target: { value: "Portoviejo" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useObserverStore.getState().geocodeRequested).toBe(true);
  });

  it("renders DidYouMeanDropdown when candidates exist", () => {
    useObserverStore.getState().setCandidates([
      {
        display_name: "Portoviejo, Manabí, Ecuador",
        name: "Portoviejo",
        country: "Ecuador",
        state: "Manabí",
        lat: -1.0569,
        lon: -80.4544,
      },
    ]);
    render(<LocationInput />);
    expect(screen.getByText(/did you mean/i)).toBeInTheDocument();
    expect(screen.getByText(/Portoviejo, Manabí, Ecuador/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Create `App.test.jsx`**

```jsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../App.jsx";

describe("<App> smoke test", () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem("skyvault.introPlayed", "true");
    // Mock fetch to prevent React Query from actually making requests
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ query: "", candidates: [], count: 0 }),
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("mounts without throwing and renders the header eyebrow", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    expect(screen.getByText(/OBSERVATORIUM · SKYVAULT/i)).toBeInTheDocument();
  });

  it("renders the hero coming-soon message", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );
    expect(screen.getByText(/arrives next session/i)).toBeInTheDocument();
  });

  it("renders the EXPLORE IN 3D stub button", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );
    expect(screen.getByText(/EXPLORE IN 3D/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the full test suite**

```bash
cd C:/Users/andre/skyvault/client
npm test
```

Expected: all tests PASS across all G tasks.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/src/__tests__/LocationInput.test.jsx client/src/__tests__/App.test.jsx
git commit -m "test(client): LocationInput component + App smoke tests"
```

Part G complete. Frontend has unit coverage on stores, hooks, utilities, and a smoke test on the root component.

---

## Part H — Assets + Docs

Part H closes the loop: the Milky Way asset the UI expects must physically exist, and the repo-level docs (`SKYVAULT_ROADMAP.md`, `CLAUDE.md`) must reflect the Canvas 2D pivot and the Phase 2a/2b split.

### Task H1: Download + convert the ESO Milky Way background

**Files:**
- Create: `client/public/milkyway/eso0932a-4k.webp`
- Create: `client/public/milkyway/README.md`

This is a user-action step. The engineer cannot magically produce the image — we instruct them exactly how to fetch it and store it.

- [ ] **Step 1: Download the source image**

Open https://www.eso.org/public/images/eso0932a/ in a browser. Download the **4k (4000 × 2000) JPEG**. This is the ESO Gigagalaxy Zoom Project Milky Way panorama by S. Brunier, CC-BY 4.0.

If the 4k file is unavailable, fall back to the next smallest size ≥ 3000px wide. Note the chosen size in the README.

- [ ] **Step 2: Convert to WebP**

Use any tool that can produce a WebP at ~85 quality. Example with ImageMagick:

```bash
magick eso0932a.jpg -quality 85 -define webp:method=6 eso0932a-4k.webp
```

Or with `cwebp`:

```bash
cwebp -q 85 -m 6 eso0932a.jpg -o eso0932a-4k.webp
```

Verify the output file is < 2 MB. If it exceeds 2 MB, drop quality to 80 and retry. If still over, resize to 3840 wide first.

- [ ] **Step 3: Move into place**

```bash
mkdir -p C:/Users/andre/skyvault/client/public/milkyway
mv eso0932a-4k.webp C:/Users/andre/skyvault/client/public/milkyway/
```

- [ ] **Step 4: Write the attribution README**

Create `client/public/milkyway/README.md`:

```markdown
# Milky Way background asset

**File:** `eso0932a-4k.webp`

**Source:** ESO Gigagalaxy Zoom Project — https://www.eso.org/public/images/eso0932a/
**Credit:** ESO/S. Brunier
**License:** [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)

The SkyVault UI displays this image as a fixed, low-opacity backdrop behind the entire app shell. Attribution is shown in the site footer per the CC-BY 4.0 terms.

## Replacement / regeneration

To regenerate from the ESO source:

1. Download the 4k JPEG from https://www.eso.org/public/images/eso0932a/
2. Convert to WebP at quality 85: `magick eso0932a.jpg -quality 85 -define webp:method=6 eso0932a-4k.webp`
3. Verify file size < 2 MB. Reduce quality or resize if needed.
4. Replace this file in `client/public/milkyway/`.
```

- [ ] **Step 5: Verify in the dev server**

```bash
cd C:/Users/andre/skyvault/client
npm run dev
```

Open http://localhost:5173. You should see a faint Milky Way band across the background behind the frame. If the image does not load, open DevTools → Network and confirm the path `/milkyway/eso0932a-4k.webp` returns 200. Confirm `global.css` references the same path (`url('/milkyway/eso0932a-4k.webp')`) — if not, fix the CSS to match the real filename.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/andre/skyvault
git add client/public/milkyway/eso0932a-4k.webp client/public/milkyway/README.md
git commit -m "assets(client): add ESO Milky Way background (CC-BY 4.0, ESO/S. Brunier)"
```

---

### Task H2: Update `SKYVAULT_ROADMAP.md` for the Canvas 2D pivot

**Files:**
- Modify: `SKYVAULT_ROADMAP.md`

The roadmap currently says Phase 2 is Three.js rendering, and includes a "Why Three.js over D3/Canvas2D?" decision block. Both are obsolete. Phase 2 splits into **2a (Frontend Foundation)** — the scope of this plan — and **2b (2D Sky Chart)** using Canvas 2D. Three.js moves to a new **Phase 4 — Explore Mode**.

- [ ] **Step 1: Read the current roadmap**

```bash
cat C:/Users/andre/skyvault/SKYVAULT_ROADMAP.md
```

Find the Phase 2 section and the "Why Three.js" decision block. Note the exact headings and line ranges — the edits below need to match them exactly.

- [ ] **Step 2: Replace the Phase 2 section**

Use the Edit tool to find the existing `## Phase 2 — Star Map` section (or whatever heading currently exists for Phase 2) and replace it with:

```markdown
## Phase 2a — Frontend Foundation

**Goal:** Ship a full interactive shell around the existing Phase 1 APIs with a cinematic dark galactic theme, place-name search, styled info panels, and an intro animation / idle-aware chrome state machine — **without** a sky chart. This is the frontend skeleton that Phase 2b drops a canvas into.

**In scope:**
- Vite + React 18 + Tailwind scaffold under `client/`
- Zustand (`observerStore`, `uiStateStore`) + React Query hooks (`useGeocode`, `useSky`, `usePlanets`)
- Photon (OSM) geocoder proxied via a new `GET /api/v1/geocode?q=` backend route
- Moon-phase extensions to `/api/v1/planets` (phase name, illumination, phase angle)
- Layout shell: fixed Milky Way background (ESO/S. Brunier CC-BY), bordered frame with gold corner brackets, header, footer
- Controls strip: location search with "Did you mean?" dropdown, "Use my location", date/time, UTC/Local toggle, submit
- Hero region: dynamic eyebrow + title ("The sky above <place>"), placeholder for Phase 2b sky chart, stubbed "Explore in 3D" button
- Info panels: Lunar (with inline phase-accurate SVG), Planets (struck-through below-horizon), Stars (top 30 by magnitude with BP-RP color dots)
- Intro FSM: galaxy fade → content fade → hand-off to idle FSM (sessionStorage-gated, `?replay` override, `prefers-reduced-motion` honored)
- Idle FSM: normal → glass (15s) → hidden (5s more), full-screen click-to-restore, focused-input immunity
- Frontend unit + component tests (Vitest + RTL)

**Out of scope (explicitly Phase 2b):**
- The 2D sky chart itself (Canvas 2D stereographic projection)
- Star click handling, tooltips, hover states on celestial objects

**Deliverables:**
- Working `npm run dev` + `uvicorn` local experience
- Every info panel renders real Gaia DR3 / JPL DE421 data
- Place-name search resolves via Photon and disambiguates correctly
- All data sources attributed in-panel

---

## Phase 2b — 2D Sky Chart (Canvas 2D)

**Goal:** Render the actual night sky inside the hero placeholder from Phase 2a using an HTML Canvas 2D stereographic projection. Keep the rendering path lean — Canvas 2D is fast enough for ≤5000 stars and the project needs to ship a v1 before Three.js complexity is justified.

**In scope:**
- Canvas-based stereographic sky projection centered on zenith
- Star rendering: size from magnitude, color from BP-RP, subtle halo/glow for brightest
- Planet rendering: larger markers with labels
- Cardinal direction labels (N/S/E/W)
- Horizon circle
- Hover/click interaction → selects an object and shows its info panel
- Smooth re-draws on observer change (debounced)

**Out of scope:**
- Zooming / panning (deferred)
- Constellation stick figures (Phase 3)
- 3D flying camera (Phase 4)

---

## Phase 3 — Constellations + Enrichment

**Goal:** IAU constellation stick figures overlayed on the Canvas 2D sky, plus click-to-enrich any star with SIMBAD + NASA Exoplanet Archive data.

- `/api/v1/constellations` — IAU stick-figure line segments
- `/api/v1/objects/{id}` — SIMBAD lookup + exoplanet archive cross-match, server-side cached
- Info-panel tabs for "Catalog data" (Gaia) and "Enrichment" (SIMBAD / NASA)
- Constellation-name labels drawn on the Canvas 2D chart

---

## Phase 4 — Explore Mode (Three.js 3D)

**Goal:** The stubbed "EXPLORE IN 3D" button from Phase 2a routes to an immersive full-window Three.js experience — a flyable celestial sphere where you can drift around, orbit specific stars, and fly to Mars or Jupiter using real JPL Horizons small-body data.

- React Three Fiber + drei
- Full-window canvas (no frame, no chrome — the explore mode owns the screen)
- Real star distances (from Gaia parallax) used for meaningful 3D placement
- Free-cam controls + object-focus camera transitions
- Preset tours: "Tonight's visible asteroids" (JPL Horizons), "Nearest stars", "Bright exoplanet hosts"

---

## Phase 5 — Polish + Deploy

- Landing page, about page with all source attributions
- `/docker-compose.yml` production build
- Live URL (Vercel frontend + Fly.io/Railway backend or equivalent)
- README screenshots, short demo video
```

- [ ] **Step 3: Remove the "Why Three.js over D3/Canvas2D?" decision block**

Find the decision block that argues for Three.js in v1. Replace its content with:

```markdown
## Rendering decision — Canvas 2D for v1, Three.js deferred to Phase 4

Original plan was Three.js from day one. Reversed after scoping Phase 2a: the realistic v1 experience is "beautiful 2D sky chart + rich info panels + place-name search." Canvas 2D can render ≤5000 stars comfortably, is a fraction of the dependency and mental-model cost of Three.js, and ships faster. Three.js is still on the roadmap — it moves to **Phase 4 Explore Mode** as the differentiated "wow" experience (flyable 3D universe), rather than the default rendering path.

**What this buys us:**
- Phase 2a ships a polished product shell backed by the existing Phase 1 APIs without touching Three.js
- Phase 2b delivers a real sky chart in a single focused push
- Phase 4 is then *actually* differentiated (3D flythrough) instead of "the same stars again but rotatable"

**What this costs us:**
- 3D is deferred behind two more phases
- Phase 4 will need a port of whatever interaction model Phase 2b settles on
```

- [ ] **Step 4: Verify the edits**

```bash
cat C:/Users/andre/skyvault/SKYVAULT_ROADMAP.md
```

Read through top-to-bottom. Confirm: no remaining references to "Phase 2 — Star Map" or "Three.js" as the Phase 2 rendering engine. Confirm Phase 2a, 2b, 3, 4, 5 flow in order.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/andre/skyvault
git add SKYVAULT_ROADMAP.md
git commit -m "docs(roadmap): split Phase 2 into 2a frontend foundation + 2b canvas sky, defer Three.js to Phase 4"
```

---

### Task H3: Update repo-root `CLAUDE.md` Phase Status + Resume Here

**Files:**
- Modify: `CLAUDE.md`

The `CLAUDE.md` at the repo root currently says "Phase 1 — Foundation" is the active phase and "Resume Here — Next Session" points at scaffolding the server. Phase 1 is done; we're now about to execute Phase 2a.

- [ ] **Step 1: Update the Phase Status checklist**

Find the `## Phase Status` section and replace its body with:

```markdown
- [x] **Phase 1** — Foundation: Gaia ingest script, backend API serves accurate star + planet positions
- [ ] **Phase 2a** — Frontend Foundation: Vite + React shell, intro animation, controls strip, info panels (no sky chart yet)
- [ ] **Phase 2b** — 2D Sky Chart: Canvas 2D stereographic projection inside the hero placeholder
- [ ] **Phase 3** — Constellations + Enrichment: IAU overlays, SIMBAD + NASA Exoplanet Archive
- [ ] **Phase 4** — Explore Mode: Three.js 3D flyable celestial sphere (behind the "Explore in 3D" button)
- [ ] **Phase 5** — Polish + Deploy: landing, about, docker-compose, live URL
```

- [ ] **Step 2: Update the "Resume Here — Next Session" section**

Find `## Resume Here — Next Session` and replace its body with:

```markdown
**Paused:** 2026-04-08, end of Phase 2a brainstorming + planning session.

**Current state:** Phase 1 is complete. Backend serves `/api/v1/sky` (Gaia DR3) and `/api/v1/planets` (JPL DE421) with real data, tests passing. Design spec for Phase 2a is at `docs/superpowers/specs/2026-04-08-phase-2a-frontend-foundation-design.md`. Implementation plan is at `docs/superpowers/plans/2026-04-09-phase-2a-frontend-foundation.md`.

**Next up:** Execute the Phase 2a plan. Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to work task-by-task through:

- **Part A** — Backend extensions: Moon phase on `/api/v1/planets`, new `/api/v1/geocode` (Photon proxy)
- **Part B** — Frontend scaffold: Vite + React + Tailwind under `client/`, palette, global.css, api client
- **Part C** — State + hooks + utilities: Zustand stores, React Query hooks, idle/intro FSMs
- **Part D** — Layout shell: background, frame, header, footer, intro orchestrator
- **Part E** — Controls strip: location search, "Use my location", date/time, submit
- **Part F** — Hero + info panels: dynamic title, Moon SVG, Lunar/Planets/Stars panels
- **Part G** — Frontend tests: store, hook, component, smoke tests
- **Part H** — Assets + docs: ESO Milky Way background, roadmap + CLAUDE.md updates

**Pivot note:** Three.js is **not** the Phase 2 rendering engine anymore. Canvas 2D is used for Phase 2b. Three.js is deferred to Phase 4 ("Explore Mode") as a differentiated 3D flythrough. See `SKYVAULT_ROADMAP.md` for the full rationale.

**Do not start execution until Andrew says go.**
```

- [ ] **Step 3: Verify the edits**

```bash
cat C:/Users/andre/skyvault/CLAUDE.md
```

Confirm Phase 1 is checked, Phase 2a/2b/3/4/5 all unchecked and present, and Resume Here points at the plan file.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/andre/skyvault
git add CLAUDE.md
git commit -m "docs(claude): mark Phase 1 done, add 2a/2b/4 phases, point Resume Here at Phase 2a plan"
```

Part H complete. The repo now has a physical Milky Way asset the UI can load, and the top-level docs reflect the Canvas 2D pivot and Phase 2a/2b/4 split.

---

## Final checklist

Before declaring Phase 2a done, verify:

- [ ] `uvicorn app.main:app --reload --port 8000` and `npm run dev` both start clean
- [ ] Visiting http://localhost:5173 in a fresh tab plays the intro once (galaxy fade → content fade)
- [ ] Visiting it again in the same session skips the intro
- [ ] Visiting `http://localhost:5173?replay` replays the intro
- [ ] `prefers-reduced-motion: reduce` in the browser DevTools rendering panel skips the intro
- [ ] Searching "Miami" resolves, the dropdown shows at least one candidate, selecting it updates the hero title to "The sky above Miami …"
- [ ] Submitting fetches `/api/v1/sky` and `/api/v1/planets`, and the three info panels populate with real data (no "Loading…" stuck, no error cards)
- [ ] The Moon panel shows a phase-correct SVG (new/crescent/quarter/gibbous/full)
- [ ] The Planets panel strikes through bodies below the horizon
- [ ] The Stars panel lists ≤ 30 stars sorted brightest first, with coloured dots from BP-RP
- [ ] Footer shows the full source attribution line
- [ ] Idle for 15s → chrome goes glass; idle for 20s total → chrome hides; clicking anywhere restores
- [ ] Typing in the location field while idle timer would fire does **not** hide chrome
- [ ] `cd server && pytest` — all tests green (including new geocoder + Moon phase tests; network tests optional)
- [ ] `cd client && npm test` — all tests green
- [ ] No console errors in the browser on a fresh load
- [ ] No uncommitted files (`git status` clean)

If every box is ticked, Phase 2a ships. Phase 2b (Canvas 2D sky chart inside the hero) is the next plan to write.


