# Phase 3a — Constellations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggleable constellation stick-figure overlay (faint lines + name labels) to the sky chart, computed per-observer on the backend and projected on the frontend like stars.

**Architecture:** Bake a static `constellations.json` from the Stellarium Western sky culture (HIP polylines) resolved to J2000 RA/Dec via ESA Hipparcos (VizieR). A new observer-parameterized `/constellations` endpoint runs segment endpoints + figure centroids through Astropy ICRS→AltAz and flags visibility (both endpoints above horizon). The frontend gates a React Query hook on a `showConstellations` toggle, projects visible alt/az → screen, draws lines in a canvas layer behind objects, and renders centroid name labels as a DOM overlay. No boundaries, no artwork, no interaction.

**Tech Stack:** FastAPI, Astropy, astroquery (VizieR), NumPy, Pydantic, pytest (backend); React, Zustand, @tanstack/react-query, Canvas 2D, Vitest + RTL (frontend).

---

## File Structure

**Backend (create):**
- `server/data/sources/stellarium_western_index.json` — vendored Stellarium Western source (CC BY-SA), input to the bake.
- `server/scripts/ingest_constellations.py` — parse index.json → HIP pairs → VizieR Hipparcos → `constellations.json`.
- `server/data/constellations.json` — baked output (committed; carries CC BY-SA notice).
- `server/app/services/constellation_catalog.py` — load + cache + observer transform.
- `server/tests/fixtures/constellations_index_minimal.json` — small index fixture.
- `server/tests/fixtures/constellations_minimal.json` — small baked-catalog fixture.
- `server/tests/test_constellations_ingest.py`
- `server/tests/test_constellation_catalog.py`
- `server/tests/test_constellations_router.py`

**Backend (modify):**
- `server/app/models/schemas.py` — add constellation schemas.
- `server/app/routers/constellations.py` — rewrite stub → observer-parameterized.
- `server/app/config.py` — add `constellations_catalog_path`.

**Frontend (create):**
- `client/src/hooks/useConstellations.js`
- `client/src/components/hero/ConstellationLabels.jsx`
- `client/src/__tests__/useConstellations.test.jsx`
- `client/src/__tests__/projectConstellations.test.js`
- `client/src/__tests__/ConstellationLabels.test.jsx`

**Frontend (modify):**
- `client/src/stores/uiStateStore.js` — add `showConstellations` + toggle.
- `client/src/api/client.js` — add `api.constellations`.
- `client/src/utils/projection.js` — add `projectConstellations`.
- `client/src/components/hero/SkyCanvas.jsx` — draw lines behind objects.
- `client/src/components/hero/SkyChart.jsx` — wire hook + labels + toggle gating.
- `client/src/components/hero/AttributionFooter.jsx` — add constellation credit.
- `client/src/__tests__/uiStateStore.test.js` — toggle test.

**Docs (modify):**
- `README.md` — data-sources table entry.
- `CLAUDE.md` — new guardrail #21 (CC BY-SA ShareAlike on the data file).

---

## Task 1: Constellation Pydantic schemas

**Files:**
- Modify: `server/app/models/schemas.py`
- Test: `server/tests/test_constellation_schemas.py` (create)

- [ ] **Step 1: Write the failing test**

```python
# server/tests/test_constellation_schemas.py
from app.models.schemas import (
    Constellation,
    ConstellationSegment,
    ConstellationsResponse,
    Observer,
)


def test_segment_carries_both_endpoints_altaz_and_visible():
    seg = ConstellationSegment(
        from_alt=10.0, from_az=20.0, to_alt=12.0, to_az=25.0, visible=True
    )
    assert seg.visible is True
    assert seg.from_alt == 10.0


def test_constellation_groups_segments_and_label():
    c = Constellation(
        id="Ori",
        name="Orion",
        segments=[
            ConstellationSegment(
                from_alt=10.0, from_az=20.0, to_alt=12.0, to_az=25.0, visible=True
            )
        ],
        label_alt=11.0,
        label_az=22.0,
        label_visible=True,
    )
    assert c.id == "Ori"
    assert len(c.segments) == 1


def test_response_includes_source_block():
    resp = ConstellationsResponse(
        observer=Observer(lat=0.0, lon=0.0, datetime="2026-06-01T00:00:00Z"),
        constellations=[],
        count=0,
        source={"figures": "Stellarium Western sky culture"},
    )
    assert resp.source["figures"].startswith("Stellarium")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && pytest tests/test_constellation_schemas.py -v`
Expected: FAIL — `ImportError: cannot import name 'ConstellationSegment'`.

- [ ] **Step 3: Add the schemas**

Append to `server/app/models/schemas.py`:

```python
class ConstellationSegment(BaseModel):
    """One stick-figure line segment in the observer's AltAz frame.

    ``visible`` is True only when BOTH endpoints are above the horizon.
    Horizon-crossing segments are dropped at the service layer, not clipped.
    """

    from_alt: float
    from_az: float
    to_alt: float
    to_az: float
    visible: bool


class Constellation(BaseModel):
    """A single constellation: its stick-figure segments + a name label.

    ``id`` is the IAU abbreviation (e.g. "Ori"); ``name`` is the English
    common name (e.g. "Orion"). The label sits at the figure's centroid;
    ``label_visible`` is True only when the centroid is above the horizon.
    """

    id: str
    name: str
    segments: list[ConstellationSegment]
    label_alt: float
    label_az: float
    label_visible: bool


class ConstellationsResponse(BaseModel):
    observer: Observer
    constellations: list[Constellation]
    count: int
    source: dict[str, str]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && pytest tests/test_constellation_schemas.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add server/app/models/schemas.py server/tests/test_constellation_schemas.py
git commit -m "feat(constellations): add Pydantic schemas"
```

---

## Task 2: Ingest — parse `index.json` polylines into HIP-pair segments

The ingest is split into pure functions (testable against fixtures) + a thin
network resolver. This task does the pure parser.

**Files:**
- Create: `server/scripts/ingest_constellations.py`
- Create: `server/tests/fixtures/constellations_index_minimal.json`
- Test: `server/tests/test_constellations_ingest.py`

- [ ] **Step 1: Create the input fixture**

```json
// server/tests/fixtures/constellations_index_minimal.json
{
  "id": "western",
  "constellations": [
    {
      "id": "CON western Ori",
      "lines": [[26727, 26311, 25336], [27989, 26727]],
      "common_name": {"english": "Orion", "native": "Orion"},
      "iau": "Ori"
    },
    {
      "id": "CON western UMi",
      "lines": [[11767, 85822, 82080]],
      "common_name": {"english": "Little Bear", "native": "Ursa Minor"},
      "iau": "UMi"
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

```python
# server/tests/test_constellations_ingest.py
import json
from pathlib import Path

from scripts.ingest_constellations import parse_index, unique_hips

FIXTURE = Path(__file__).parent / "fixtures" / "constellations_index_minimal.json"


def _load():
    with FIXTURE.open(encoding="utf-8") as fh:
        return json.load(fh)


def test_parse_index_flattens_polylines_into_consecutive_pairs():
    parsed = parse_index(_load())
    ori = next(c for c in parsed if c["id"] == "Ori")
    # [26727,26311,25336] -> (26727,26311),(26311,25336); [27989,26727] -> (27989,26727)
    assert ori["name"] == "Orion"
    assert ori["pairs"] == [(26727, 26311), (26311, 25336), (27989, 26727)]


def test_unique_hips_collects_all_referenced_stars():
    parsed = parse_index(_load())
    hips = unique_hips(parsed)
    assert hips == {26727, 26311, 25336, 27989, 11767, 85822, 82080}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && pytest tests/test_constellations_ingest.py -v`
Expected: FAIL — `ModuleNotFoundError`/`ImportError` (functions don't exist).

- [ ] **Step 4: Write the parser**

```python
# server/scripts/ingest_constellations.py
"""One-time ingest: build ``server/data/constellations.json`` from the
Stellarium Western sky culture (HIP polylines) resolved to J2000 ICRS
coordinates via ESA Hipparcos (VizieR).

The request path never hits VizieR — output is committed to the repo.

Source (vendored): ``server/data/sources/stellarium_western_index.json``
from https://github.com/Stellarium/stellarium-skycultures (western/index.json).
Figure data is CC BY-SA; the baked output carries the same notice.

Usage:
    cd server
    python scripts/ingest_constellations.py
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

SERVER_ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = SERVER_ROOT / "data" / "sources" / "stellarium_western_index.json"
OUTPUT_PATH = SERVER_ROOT / "data" / "constellations.json"

SOURCE_BLOCK = {
    "figures": "Stellarium Western sky culture",
    "figures_license": "CC BY-SA 4.0",
    "coordinates": "ESA Hipparcos (VizieR I/239/hip_main)",
    "names": "IAU",
}


def parse_index(index: dict[str, Any]) -> list[dict[str, Any]]:
    """Flatten each constellation's HIP polylines into consecutive HIP pairs.

    A line ``[a, b, c]`` becomes segments ``(a, b)`` and ``(b, c)``.
    """
    out: list[dict[str, Any]] = []
    for c in index.get("constellations", []):
        pairs: list[tuple[int, int]] = []
        for line in c.get("lines", []):
            for a, b in zip(line, line[1:]):
                pairs.append((int(a), int(b)))
        out.append(
            {
                "id": c["iau"],
                "name": c["common_name"]["english"],
                "pairs": pairs,
            }
        )
    return out


def unique_hips(parsed: list[dict[str, Any]]) -> set[int]:
    """All distinct HIP ids referenced across every constellation."""
    hips: set[int] = set()
    for c in parsed:
        for a, b in c["pairs"]:
            hips.add(a)
            hips.add(b)
    return hips
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && pytest tests/test_constellations_ingest.py -v`
Expected: PASS (2 passed).

- [ ] **Step 6: Commit**

```bash
git add server/scripts/ingest_constellations.py server/tests/test_constellations_ingest.py server/tests/fixtures/constellations_index_minimal.json
git commit -m "feat(constellations): ingest parser for HIP polylines"
```

---

## Task 3: Ingest — build baked catalog from resolved HIP coords

Adds `build_catalog` (pure: maps HIP pairs → RA/Dec segments, computes a
wraparound-safe centroid, warns+skips missing HIPs) and the VizieR resolver +
`main()`. Only `build_catalog` is unit-tested (no network in tests).

**Files:**
- Modify: `server/scripts/ingest_constellations.py`
- Test: `server/tests/test_constellations_ingest.py`

- [ ] **Step 1: Write the failing test**

```python
# append to server/tests/test_constellations_ingest.py
from scripts.ingest_constellations import build_catalog, centroid_radec


def test_centroid_radec_handles_ra_wraparound():
    # Two stars straddling RA=0 (359 and 1 deg) -> centroid near 0, not 180.
    ra, dec = centroid_radec([(359.0, 0.0), (1.0, 0.0)])
    assert min(abs(ra - 0.0), abs(ra - 360.0)) < 1e-6
    assert abs(dec) < 1e-6


def test_build_catalog_maps_pairs_to_radec_segments():
    parsed = [{"id": "Tst", "name": "Test", "pairs": [(1, 2), (2, 3)]}]
    coords = {1: (10.0, 20.0), 2: (11.0, 21.0), 3: (12.0, 22.0)}
    out = build_catalog(parsed, coords)
    const = out["constellations"][0]
    assert const["id"] == "Tst"
    assert const["segments"][0] == {"from": [10.0, 20.0], "to": [11.0, 21.0]}
    assert len(const["segments"]) == 2
    assert "label" in const
    assert out["source"]["figures_license"] == "CC BY-SA 4.0"


def test_build_catalog_skips_segments_with_unresolved_hip():
    parsed = [{"id": "Tst", "name": "Test", "pairs": [(1, 2), (2, 99)]}]
    coords = {1: (10.0, 20.0), 2: (11.0, 21.0)}  # 99 missing
    out = build_catalog(parsed, coords)
    # Only the (1,2) segment survives; (2,99) is dropped.
    assert len(out["constellations"][0]["segments"]) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && pytest tests/test_constellations_ingest.py -v`
Expected: FAIL — `ImportError: cannot import name 'build_catalog'`.

- [ ] **Step 3: Implement build_catalog, centroid, resolver, main**

Append to `server/scripts/ingest_constellations.py`:

```python
def centroid_radec(points: list[tuple[float, float]]) -> tuple[float, float]:
    """Mean direction of (ra, dec) points via unit-vector averaging.

    Unit-vector mean is robust to the RA=0/360 wraparound (a naive arithmetic
    mean of RA degrees would place a centroid of 359° and 1° at 180°).
    """
    ra = np.radians([p[0] for p in points])
    dec = np.radians([p[1] for p in points])
    x = np.mean(np.cos(dec) * np.cos(ra))
    y = np.mean(np.cos(dec) * np.sin(ra))
    z = np.mean(np.sin(dec))
    ra_c = np.degrees(np.arctan2(y, x)) % 360.0
    dec_c = np.degrees(np.arctan2(z, np.hypot(x, y)))
    return float(ra_c), float(dec_c)


def build_catalog(
    parsed: list[dict[str, Any]],
    coords: dict[int, tuple[float, float]],
) -> dict[str, Any]:
    """Map HIP-pair segments to RA/Dec, compute centroids, skip missing HIPs."""
    constellations: list[dict[str, Any]] = []
    for c in parsed:
        segments: list[dict[str, Any]] = []
        star_points: set[tuple[float, float]] = set()
        for a, b in c["pairs"]:
            if a not in coords or b not in coords:
                logger.warning(
                    "Skipping segment %s-%s in %s: unresolved HIP", a, b, c["id"]
                )
                continue
            fa, fb = coords[a], coords[b]
            segments.append({"from": [fa[0], fa[1]], "to": [fb[0], fb[1]]})
            star_points.add(fa)
            star_points.add(fb)
        if not segments:
            logger.warning("Constellation %s has no resolvable segments", c["id"])
            continue
        ra_c, dec_c = centroid_radec(sorted(star_points))
        constellations.append(
            {
                "id": c["id"],
                "name": c["name"],
                "segments": segments,
                "label": [ra_c, dec_c],
            }
        )
    return {"source": SOURCE_BLOCK, "constellations": constellations}


def resolve_hip_coords(hips: set[int]) -> dict[int, tuple[float, float]]:
    """Resolve HIP ids to ICRS RA/Dec (deg) via VizieR Hipparcos I/239/hip_main.

    Network call — used only by main(), never by tests. Positions are the
    catalogue ICRS values (epoch J1991.25); proper-motion drift to J2000 is
    sub-arcsecond for the bright figure stars and visually irrelevant for
    stick-figure lines, so it is not applied.
    """
    from astroquery.vizier import Vizier

    v = Vizier(columns=["HIP", "RAICRS", "DEICRS"], catalog="I/239/hip_main")
    v.ROW_LIMIT = -1
    hip_list = sorted(hips)
    coords: dict[int, tuple[float, float]] = {}
    # Query in chunks to keep the constraint string manageable.
    chunk = 500
    for i in range(0, len(hip_list), chunk):
        block = hip_list[i : i + chunk]
        result = v.query_constraints(HIP="=,{}".format(",".join(map(str, block))))
        if not result:
            continue
        table = result[0]
        for row in table:
            coords[int(row["HIP"])] = (float(row["RAICRS"]), float(row["DEICRS"]))
    return coords


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    if not SOURCE_PATH.exists():
        raise SystemExit(
            f"Source not found at {SOURCE_PATH}. Download western/index.json from "
            "https://github.com/Stellarium/stellarium-skycultures and place it there."
        )
    with SOURCE_PATH.open(encoding="utf-8") as fh:
        index = json.load(fh)

    parsed = parse_index(index)
    hips = unique_hips(parsed)
    logger.info("Resolving %d unique HIP stars via VizieR...", len(hips))
    coords = resolve_hip_coords(hips)
    logger.info("Resolved %d/%d HIP stars", len(coords), len(hips))

    catalog = build_catalog(parsed, coords)
    OUTPUT_PATH.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    logger.info(
        "Wrote %d constellations to %s",
        len(catalog["constellations"]),
        OUTPUT_PATH,
    )


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && pytest tests/test_constellations_ingest.py -v`
Expected: PASS (5 passed total).

- [ ] **Step 5: Commit**

```bash
git add server/scripts/ingest_constellations.py server/tests/test_constellations_ingest.py
git commit -m "feat(constellations): build baked catalog + VizieR HIP resolver"
```

---

## Task 4: Config path + baked catalog fixture

**Files:**
- Modify: `server/app/config.py`
- Create: `server/tests/fixtures/constellations_minimal.json`

- [ ] **Step 1: Add the config path**

In `server/app/config.py`, after the `dso_catalog_path` line (currently line 35):

```python
    # Constellation figures catalog (produced once via scripts/ingest_constellations.py)
    constellations_catalog_path: Path = DATA_DIR / "constellations.json"
```

- [ ] **Step 2: Create the baked-catalog fixture**

Orion (3 belt stars + a segment) and Ursa Minor (Polaris). Coords are real
ICRS J2000 degrees so the visibility tests below are physically correct.

```json
// server/tests/fixtures/constellations_minimal.json
{
  "source": {
    "figures": "Stellarium Western sky culture",
    "figures_license": "CC BY-SA 4.0",
    "coordinates": "ESA Hipparcos (VizieR I/239/hip_main)",
    "names": "IAU"
  },
  "constellations": [
    {
      "id": "Ori",
      "name": "Orion",
      "segments": [
        { "from": [83.0016, -0.2991], "to": [84.0534, -1.2019] },
        { "from": [84.0534, -1.2019], "to": [85.1897, -1.9426] }
      ],
      "label": [84.0816, -1.1479]
    },
    {
      "id": "UMi",
      "name": "Little Bear",
      "segments": [
        { "from": [37.9529, 89.2641], "to": [236.0150, 77.7944] }
      ],
      "label": [136.9839, 83.5292]
    }
  ]
}
```

- [ ] **Step 3: Verify the fixture parses**

Run: `cd server && python -c "import json; json.load(open('tests/fixtures/constellations_minimal.json')); print('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add server/app/config.py server/tests/fixtures/constellations_minimal.json
git commit -m "feat(constellations): config path + catalog test fixture"
```

---

## Task 5: Catalog service — load + cache + DataNotFoundError

**Files:**
- Create: `server/app/services/constellation_catalog.py`
- Test: `server/tests/test_constellation_catalog.py`

- [ ] **Step 1: Write the failing test**

```python
# server/tests/test_constellation_catalog.py
from pathlib import Path

import pytest

from app.services import constellation_catalog

FIXTURE = Path(__file__).parent / "fixtures" / "constellations_minimal.json"


@pytest.fixture(autouse=True)
def clear_cache():
    constellation_catalog.load_catalog.cache_clear()
    yield
    constellation_catalog.load_catalog.cache_clear()


def test_load_returns_source_and_constellations():
    data = constellation_catalog.load_catalog(FIXTURE)
    assert data["source"]["figures_license"] == "CC BY-SA 4.0"
    ids = {c["id"] for c in data["constellations"]}
    assert ids == {"Ori", "UMi"}


def test_missing_file_raises_actionable_error():
    with pytest.raises(constellation_catalog.ConstellationCatalogNotFoundError):
        constellation_catalog.load_catalog(Path("/no/such/constellations.json"))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && pytest tests/test_constellation_catalog.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.constellation_catalog'`.

- [ ] **Step 3: Write the loader**

```python
# server/app/services/constellation_catalog.py
"""Constellation stick-figure catalog.

Loads a static JSON file produced by ``scripts/ingest_constellations.py``
(Stellarium Western HIP polylines resolved to ICRS via ESA Hipparcos). At
request time, transforms each segment endpoint and figure-label centroid into
the observer's AltAz frame using Astropy, flagging visibility.

No live VizieR queries from the request path — this stays a cold service.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import numpy as np
from astropy import units as u
from astropy.coordinates import AltAz, EarthLocation, SkyCoord
from astropy.time import Time

from app.config import settings
from app.models.schemas import Constellation, ConstellationSegment


class ConstellationCatalogNotFoundError(FileNotFoundError):
    """Raised when the constellations catalog JSON is missing at load time."""


@lru_cache(maxsize=4)
def load_catalog(path: Path | None = None) -> dict:
    """Load the static constellations catalog JSON. Cached per path."""
    p = Path(path) if path is not None else settings.constellations_catalog_path
    if not p.exists():
        raise ConstellationCatalogNotFoundError(
            f"Constellations catalog not found at {p}. "
            f"Run: cd server && python scripts/ingest_constellations.py"
        )
    with p.open(encoding="utf-8") as fh:
        return json.load(fh)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && pytest tests/test_constellation_catalog.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add server/app/services/constellation_catalog.py server/tests/test_constellation_catalog.py
git commit -m "feat(constellations): catalog loader + cache"
```

---

## Task 6: Catalog service — observer transform + visibility

**Files:**
- Modify: `server/app/services/constellation_catalog.py`
- Test: `server/tests/test_constellation_catalog.py`

- [ ] **Step 1: Write the failing test**

```python
# append to server/tests/test_constellation_catalog.py


def test_polaris_segment_visible_from_nyc():
    # Ursa Minor's segment includes Polaris (dec ~+89). From NYC (lat 40.7),
    # Polaris sits ~40 deg up year-round, so the UMi segment is visible.
    result = constellation_catalog.constellations_for_observer(
        lat=40.7128, lon=-74.0060, time_utc="2026-06-01T04:00:00Z",
        catalog_path=FIXTURE,
    )
    umi = next(c for c in result if c.id == "UMi")
    assert umi.segments[0].visible is True
    assert umi.label_alt > 0


def test_polaris_below_horizon_from_southern_hemisphere():
    # From Buenos Aires (lat -34.6), Polaris (dec +89) never rises, so the
    # UMi segment endpoints are below the horizon -> segment not visible.
    result = constellation_catalog.constellations_for_observer(
        lat=-34.61, lon=-58.40, time_utc="2026-06-01T04:00:00Z",
        catalog_path=FIXTURE,
    )
    umi = next(c for c in result if c.id == "UMi")
    assert umi.segments[0].visible is False


def test_response_shape_has_altaz_on_endpoints():
    result = constellation_catalog.constellations_for_observer(
        lat=40.7128, lon=-74.0060, time_utc="2026-06-01T04:00:00Z",
        catalog_path=FIXTURE,
    )
    ori = next(c for c in result if c.id == "Ori")
    seg = ori.segments[0]
    assert hasattr(seg, "from_alt") and hasattr(seg, "to_az")
    assert isinstance(seg.visible, bool)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && pytest tests/test_constellation_catalog.py -v`
Expected: FAIL — `AttributeError: module ... has no attribute 'constellations_for_observer'`.

- [ ] **Step 3: Implement the transform**

Append to `server/app/services/constellation_catalog.py`:

```python
def constellations_for_observer(
    lat: float,
    lon: float,
    time_utc: str,
    catalog_path: Path | None = None,
) -> list[Constellation]:
    """Return constellations with AltAz-transformed segments + labels.

    A segment is ``visible`` only when both endpoints are above the horizon.
    A label is visible only when its centroid is above the horizon. Nothing is
    dropped from the response — visibility is flagged so the client can choose.
    """
    data = load_catalog(catalog_path)
    raw = data.get("constellations", [])
    if not raw:
        return []

    location = EarthLocation(lat=lat * u.deg, lon=lon * u.deg)
    time = Time(time_utc.replace("Z", ""), scale="utc")
    frame = AltAz(obstime=time, location=location)

    # Flatten every endpoint + every label into one SkyCoord for a single
    # vectorized transform, then scatter results back by index.
    ras: list[float] = []
    decs: list[float] = []
    for c in raw:
        for seg in c["segments"]:
            ras.extend([seg["from"][0], seg["to"][0]])
            decs.extend([seg["from"][1], seg["to"][1]])
        ras.append(c["label"][0])
        decs.append(c["label"][1])

    coords = SkyCoord(ra=np.array(ras) * u.deg, dec=np.array(decs) * u.deg, frame="icrs")
    altaz = coords.transform_to(frame)
    alts = altaz.alt.deg
    azs = altaz.az.deg

    out: list[Constellation] = []
    idx = 0
    for c in raw:
        segments: list[ConstellationSegment] = []
        for _seg in c["segments"]:
            f_alt, f_az = float(alts[idx]), float(azs[idx])
            t_alt, t_az = float(alts[idx + 1]), float(azs[idx + 1])
            idx += 2
            segments.append(
                ConstellationSegment(
                    from_alt=f_alt,
                    from_az=f_az,
                    to_alt=t_alt,
                    to_az=t_az,
                    visible=(f_alt >= 0 and t_alt >= 0),
                )
            )
        label_alt, label_az = float(alts[idx]), float(azs[idx])
        idx += 1
        out.append(
            Constellation(
                id=c["id"],
                name=c["name"],
                segments=segments,
                label_alt=label_alt,
                label_az=label_az,
                label_visible=label_alt >= 0,
            )
        )
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && pytest tests/test_constellation_catalog.py -v`
Expected: PASS (5 passed total).

- [ ] **Step 5: Commit**

```bash
git add server/app/services/constellation_catalog.py server/tests/test_constellation_catalog.py
git commit -m "feat(constellations): observer AltAz transform + visibility flags"
```

---

## Task 7: Router rewrite — observer-parameterized endpoint

**Files:**
- Modify: `server/app/routers/constellations.py`
- Test: `server/tests/test_constellations_router.py`

- [ ] **Step 1: Write the failing test**

```python
# server/tests/test_constellations_router.py
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import constellation_catalog

client = TestClient(app)
FIXTURE = Path(__file__).parent / "fixtures" / "constellations_minimal.json"


@pytest.fixture(autouse=True)
def use_fixture_catalog(monkeypatch):
    constellation_catalog.load_catalog.cache_clear()
    # Force the service default path to the test fixture.
    monkeypatch.setattr(
        constellation_catalog.settings, "constellations_catalog_path", FIXTURE
    )
    yield
    constellation_catalog.load_catalog.cache_clear()


def test_endpoint_returns_constellations_with_source():
    resp = client.get(
        "/api/v1/constellations",
        params={"lat": 40.7128, "lon": -74.0060, "datetime": "2026-06-01T04:00:00Z"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"]["figures"].startswith("Stellarium")
    assert body["count"] == len(body["constellations"])
    ids = {c["id"] for c in body["constellations"]}
    assert {"Ori", "UMi"} <= ids


def test_endpoint_validates_latitude():
    resp = client.get(
        "/api/v1/constellations",
        params={"lat": 999, "lon": 0, "datetime": "2026-06-01T04:00:00Z"},
    )
    assert resp.status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && pytest tests/test_constellations_router.py -v`
Expected: FAIL — the old stub returns `{"constellations": [], "source": "IAU"}`, so `body["source"]["figures"]` raises `TypeError`/assertion fails.

- [ ] **Step 3: Rewrite the router**

Replace the entire contents of `server/app/routers/constellations.py`:

```python
"""GET /api/v1/constellations — Western stick-figure constellations for an observer.

Source: Stellarium Western sky culture (figures, CC BY-SA) + ESA Hipparcos
(coordinates) + IAU (names). See scripts/ingest_constellations.py.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import ConstellationsResponse, Observer
from app.services import constellation_catalog

router = APIRouter(prefix="/constellations", tags=["constellations"])


@router.get("", response_model=ConstellationsResponse)
async def get_constellations(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Observer latitude (deg)"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Observer longitude (deg)"),
    datetime: str = Query(..., description="Observation time, ISO 8601 UTC"),
) -> ConstellationsResponse:
    try:
        data = constellation_catalog.load_catalog()
    except constellation_catalog.ConstellationCatalogNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    constellations = constellation_catalog.constellations_for_observer(
        lat=lat, lon=lon, time_utc=datetime
    )
    return ConstellationsResponse(
        observer=Observer(lat=lat, lon=lon, datetime=datetime),
        constellations=constellations,
        count=len(constellations),
        source=data["source"],
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && pytest tests/test_constellations_router.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Run the full backend suite**

Run: `cd server && pytest -q`
Expected: all pass (74 prior + new constellation tests).

- [ ] **Step 6: Commit**

```bash
git add server/app/routers/constellations.py server/tests/test_constellations_router.py
git commit -m "feat(constellations): observer-parameterized endpoint"
```

---

## Task 8: Run the real ingest + commit baked data + vendored source

This produces the real `constellations.json`. Requires network (VizieR).

- [ ] **Step 1: Vendor the Stellarium source**

Download `western/index.json` from the Stellarium skycultures repo and save it to
`server/data/sources/stellarium_western_index.json`.

Run (PowerShell):
```powershell
New-Item -ItemType Directory -Force server\data\sources | Out-Null
Invoke-RestMethod -Uri "https://raw.githubusercontent.com/Stellarium/stellarium-skycultures/master/western/index.json" -OutFile server\data\sources\stellarium_western_index.json
```
Expected: file ~107 KB at `server/data/sources/stellarium_western_index.json`.

- [ ] **Step 2: Run the ingest**

Run: `cd server && python scripts/ingest_constellations.py`
Expected: logs "Resolving N unique HIP stars...", "Resolved N/N", "Wrote ~88 constellations to .../constellations.json". A few skipped HIPs are acceptable (logged warnings).

- [ ] **Step 3: Sanity-check the output**

Run: `cd server && python -c "import json; d=json.load(open('data/constellations.json')); print(len(d['constellations']), 'constellations'); print(d['source'])"`
Expected: ~88 constellations + the source block with `CC BY-SA 4.0`.

- [ ] **Step 4: Point the catalog tests' default at real data is NOT needed** — they use the fixture. Re-run the backend suite to confirm nothing regressed.

Run: `cd server && pytest -q`
Expected: all pass.

- [ ] **Step 5: Commit the baked data + vendored source**

```bash
git add server/data/constellations.json server/data/sources/stellarium_western_index.json
git commit -m "data(constellations): bake Western figures (Stellarium CC BY-SA + Hipparcos)"
```

> Note: `server/data/constellations.json` is committed (unlike the gitignored
> Gaia parquet) — it's small and the contract requires the figures shipped.
> Confirm it is NOT excluded by `.gitignore` (the gitignore targets `*.parquet`
> and `de421.bsp`, not JSON). If a broad `data/` ignore exists, add a
> `!server/data/constellations.json` negation.

---

## Task 9: Frontend — `showConstellations` toggle in uiStateStore

**Files:**
- Modify: `client/src/stores/uiStateStore.js`
- Test: `client/src/__tests__/uiStateStore.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// append to client/src/__tests__/uiStateStore.test.js
import { useUiStateStore } from "../stores/uiStateStore.js";

describe("showConstellations", () => {
  it("defaults to false", () => {
    expect(useUiStateStore.getState().showConstellations).toBe(false);
  });

  it("toggleConstellations flips the flag", () => {
    useUiStateStore.getState().toggleConstellations();
    expect(useUiStateStore.getState().showConstellations).toBe(true);
    useUiStateStore.getState().toggleConstellations();
    expect(useUiStateStore.getState().showConstellations).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/__tests__/uiStateStore.test.js`
Expected: FAIL — `showConstellations` is undefined.

- [ ] **Step 3: Add state + action**

In `client/src/stores/uiStateStore.js`, add to the store object (after `prefersReducedMotion: false,` and its setter):

```javascript
  showConstellations: false,

  toggleConstellations: () =>
    set((s) => ({ showConstellations: !s.showConstellations })),

  setShowConstellations: (showConstellations) => set({ showConstellations }),
```

Also update the JSDoc block to mention `showConstellations — constellation overlay toggle (default off)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/__tests__/uiStateStore.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/stores/uiStateStore.js client/src/__tests__/uiStateStore.test.js
git commit -m "feat(constellations): showConstellations toggle in uiStateStore"
```

---

## Task 10: Frontend — API client + gated `useConstellations` hook

**Files:**
- Modify: `client/src/api/client.js`
- Create: `client/src/hooks/useConstellations.js`
- Test: `client/src/__tests__/useConstellations.test.jsx`

- [ ] **Step 1: Add the API method**

In `client/src/api/client.js`, add to the `api` object (after the `dso:` line):

```javascript
  constellations: (lat, lon, datetime) =>
    request("/constellations", { lat, lon, datetime }),
```

- [ ] **Step 2: Write the failing test**

```jsx
// client/src/__tests__/useConstellations.test.jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useConstellations } from "../hooks/useConstellations.js";
import { api } from "../api/client.js";

vi.mock("../api/client.js", () => ({
  api: { constellations: vi.fn() },
}));

function wrapper({ children }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const selected = { lat: 40.7, lon: -74.0 };
const dt = "2026-06-01T04:00:00Z";

beforeEach(() => vi.clearAllMocks());

describe("useConstellations", () => {
  it("does not fetch when enabled flag is false", () => {
    renderHook(() => useConstellations(selected, dt, false), { wrapper });
    expect(api.constellations).not.toHaveBeenCalled();
  });

  it("fetches when enabled and observer present", async () => {
    api.constellations.mockResolvedValue({ constellations: [], count: 0, source: {} });
    renderHook(() => useConstellations(selected, dt, true), { wrapper });
    await waitFor(() => expect(api.constellations).toHaveBeenCalledWith(40.7, -74.0, dt));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd client && npx vitest run src/__tests__/useConstellations.test.jsx`
Expected: FAIL — hook module doesn't exist.

- [ ] **Step 4: Write the hook**

```javascript
// client/src/hooks/useConstellations.js
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

/**
 * Constellation figures for the current observer. Gated on `enabled` (the
 * showConstellations toggle) so the layer costs nothing when off.
 */
export function useConstellations(selected, datetimeUtc, enabled) {
  return useQuery({
    queryKey: ["constellations", selected?.lat, selected?.lon, datetimeUtc],
    queryFn: () => api.constellations(selected.lat, selected.lon, datetimeUtc),
    enabled: Boolean(enabled && selected && datetimeUtc),
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npx vitest run src/__tests__/useConstellations.test.jsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/api/client.js client/src/hooks/useConstellations.js client/src/__tests__/useConstellations.test.jsx
git commit -m "feat(constellations): api method + gated useConstellations hook"
```

---

## Task 11: Frontend — `projectConstellations` util

**Files:**
- Modify: `client/src/utils/projection.js`
- Test: `client/src/__tests__/projectConstellations.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// client/src/__tests__/projectConstellations.test.js
import { describe, it, expect } from "vitest";
import { projectConstellations } from "../utils/projection.js";

const W = 800;
const H = 600;

const sample = [
  {
    id: "Ori",
    name: "Orion",
    segments: [
      { from_alt: 45, from_az: 90, to_alt: 50, to_az: 95, visible: true },
      { from_alt: 10, from_az: 180, to_alt: -5, to_az: 185, visible: false },
    ],
    label_alt: 47,
    label_az: 92,
    label_visible: true,
  },
];

describe("projectConstellations", () => {
  it("returns only visible segments with screen coords", () => {
    const { lines } = projectConstellations(sample, W, H);
    // Only the first (visible) segment survives.
    expect(lines).toHaveLength(1);
    const seg = lines[0];
    expect(seg).toHaveProperty("x1");
    expect(seg).toHaveProperty("y2");
    expect(Number.isFinite(seg.x1)).toBe(true);
  });

  it("returns only visible labels with screen coords + name", () => {
    const { labels } = projectConstellations(sample, W, H);
    expect(labels).toHaveLength(1);
    expect(labels[0].name).toBe("Orion");
    expect(Number.isFinite(labels[0].x)).toBe(true);
  });

  it("handles empty input", () => {
    expect(projectConstellations([], W, H)).toEqual({ lines: [], labels: [] });
    expect(projectConstellations(undefined, W, H)).toEqual({ lines: [], labels: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/__tests__/projectConstellations.test.js`
Expected: FAIL — `projectConstellations is not a function`.

- [ ] **Step 3: Implement the projector**

Append to `client/src/utils/projection.js`:

```javascript
export function projectConstellations(constellations, width, height) {
  if (!constellations || !constellations.length || !width || !height) {
    return { lines: [], labels: [] };
  }

  const lines = [];
  const labels = [];

  for (const c of constellations) {
    for (const seg of c.segments) {
      if (!seg.visible) continue;
      const a = projectAltAz({ alt: seg.from_alt, az: seg.from_az }, width, height);
      const b = projectAltAz({ alt: seg.to_alt, az: seg.to_az }, width, height);
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    if (c.label_visible) {
      const p = projectAltAz({ alt: c.label_alt, az: c.label_az }, width, height);
      labels.push({ id: c.id, name: c.name, x: p.x, y: p.y });
    }
  }

  return { lines, labels };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/__tests__/projectConstellations.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/projection.js client/src/__tests__/projectConstellations.test.js
git commit -m "feat(constellations): projectConstellations util"
```

---

## Task 12: Frontend — draw lines in SkyCanvas (behind objects)

**Files:**
- Modify: `client/src/components/hero/SkyCanvas.jsx`
- Test: `client/src/__tests__/SkyCanvas.test.jsx` (create if absent)

- [ ] **Step 1: Write the failing test**

This asserts lines are stroked before stars are drawn (layer order) using a
mocked 2D context that records call order.

```jsx
// client/src/__tests__/SkyCanvas.test.jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import SkyCanvas from "../components/hero/SkyCanvas.jsx";

const calls = [];
const ctxStub = {
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  beginPath: () => calls.push("beginPath"),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: () => calls.push("stroke"),
  arc: () => calls.push("arc"),
  fill: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  set strokeStyle(_v) {},
  set lineWidth(_v) {},
  set globalAlpha(_v) {},
  set fillStyle(_v) {},
  set globalCompositeOperation(_v) {},
};

beforeEach(() => {
  calls.length = 0;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctxStub);
});

describe("SkyCanvas constellation lines", () => {
  it("strokes constellation lines before drawing stars", () => {
    render(
      <SkyCanvas
        projectedStars={[{ x: 100, y: 100, magnitude: 1 }]}
        projectedPlanets={[]}
        projectedDsos={[]}
        projectedLines={[{ x1: 10, y1: 10, x2: 20, y2: 20 }]}
        width={800}
        height={600}
        dpr={1}
      />
    );
    const firstStroke = calls.indexOf("stroke");
    const firstArc = calls.indexOf("arc");
    expect(firstStroke).toBeGreaterThanOrEqual(0);
    expect(firstArc).toBeGreaterThan(firstStroke);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/__tests__/SkyCanvas.test.jsx`
Expected: FAIL — no line stroking happens (`firstStroke` is -1).

- [ ] **Step 3: Add a line-drawing helper + wire it**

In `client/src/components/hero/SkyCanvas.jsx`:

Add the `projectedLines` prop to the signature:
```javascript
export default function SkyCanvas({ projectedStars, projectedPlanets, projectedDsos, projectedLines, width, height, dpr }) {
```

Immediately after `ctx.clearRect(0, 0, width, height);` (currently line 21), insert the constellation-line pass — **before** the DSO loop so lines sit behind everything:

```javascript
    // Layer order: constellation lines first (behind DSOs/stars/planets).
    const lines = projectedLines ?? [];
    if (lines.length) {
      ctx.save();
      ctx.strokeStyle = "rgba(150, 180, 220, 0.22)";
      ctx.lineWidth = dpr > 1 ? 1.5 : 1;
      for (const ln of lines) {
        ctx.beginPath();
        ctx.moveTo(ln.x1, ln.y1);
        ctx.lineTo(ln.x2, ln.y2);
        ctx.stroke();
      }
      ctx.restore();
    }
```

Add `projectedLines` to the effect dependency array:
```javascript
  }, [projectedStars, projectedPlanets, projectedDsos, projectedLines, width, height, dpr]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/__tests__/SkyCanvas.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/hero/SkyCanvas.jsx client/src/__tests__/SkyCanvas.test.jsx
git commit -m "feat(constellations): draw figure lines behind objects in SkyCanvas"
```

---

## Task 13: Frontend — ConstellationLabels DOM overlay

**Files:**
- Create: `client/src/components/hero/ConstellationLabels.jsx`
- Test: `client/src/__tests__/ConstellationLabels.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/__tests__/ConstellationLabels.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ConstellationLabels from "../components/hero/ConstellationLabels.jsx";

describe("ConstellationLabels", () => {
  it("renders a label per provided entry", () => {
    render(
      <ConstellationLabels
        labels={[
          { id: "Ori", name: "Orion", x: 100, y: 120 },
          { id: "UMi", name: "Little Bear", x: 300, y: 80 },
        ]}
      />
    );
    expect(screen.getByText("Orion")).toBeInTheDocument();
    expect(screen.getByText("Little Bear")).toBeInTheDocument();
  });

  it("renders nothing for empty labels", () => {
    const { container } = render(<ConstellationLabels labels={[]} />);
    expect(container.querySelectorAll("span")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/__tests__/ConstellationLabels.test.jsx`
Expected: FAIL — component module doesn't exist.

- [ ] **Step 3: Write the component**

Mirrors `PlanetLabels` (absolute, pointer-events-none, aria-hidden), but dimmer,
smaller, uppercase + wide tracking so it reads as ambient context.

```jsx
// client/src/components/hero/ConstellationLabels.jsx
/**
 * Constellation name labels (Phase 3a). DOM overlay mirroring PlanetLabels /
 * CardinalLabels. Non-interactive ambient context — dimmer and smaller than
 * planet labels, uppercase with wide letter-spacing.
 *
 * `labels` are pre-projected centroids (visible-only) from projectConstellations.
 */
export default function ConstellationLabels({ labels }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {(labels ?? []).map((l) => (
        <span
          key={l.id}
          style={{
            position: "absolute",
            left: `${l.x}px`,
            top: `${l.y}px`,
            transform: "translate(-50%, -50%)",
            fontSize: "9px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(170, 195, 230, 0.45)",
            textShadow: "0 0 4px rgba(0, 0, 0, 0.8)",
            whiteSpace: "nowrap",
          }}
        >
          {l.name}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/__tests__/ConstellationLabels.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/hero/ConstellationLabels.jsx client/src/__tests__/ConstellationLabels.test.jsx
git commit -m "feat(constellations): ConstellationLabels DOM overlay"
```

---

## Task 14: Frontend — wire into SkyChart + toggle control

**Files:**
- Modify: `client/src/components/hero/SkyChart.jsx`
- Test: `client/src/__tests__/SkyChart.test.jsx`

- [ ] **Step 1: Write the failing test**

Assert that toggling `showConstellations` on causes labels to render. (Mock the
hooks so the test is deterministic.)

```jsx
// add to client/src/__tests__/SkyChart.test.jsx
import { useUiStateStore } from "../stores/uiStateStore.js";
import { useConstellations } from "../hooks/useConstellations.js";

vi.mock("../hooks/useConstellations.js", () => ({
  useConstellations: vi.fn(),
}));

// In a new describe block:
describe("SkyChart constellation overlay", () => {
  it("renders constellation labels when toggle is on and data present", async () => {
    useUiStateStore.setState({ showConstellations: true });
    useConstellations.mockReturnValue({
      data: {
        constellations: [
          {
            id: "Ori",
            name: "Orion",
            segments: [{ from_alt: 45, from_az: 90, to_alt: 50, to_az: 95, visible: true }],
            label_alt: 47,
            label_az: 92,
            label_visible: true,
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    // ... render SkyChart with a selected observer (reuse existing test setup) ...
    // expect(await screen.findByText("Orion")).toBeInTheDocument();
  });
});
```

> Note to implementer: adapt this to the existing `SkyChart.test.jsx` setup
> (it already mocks `useSky`/`usePlanets`/`useDso` and sets observer state).
> Mirror that exact pattern — mock `useConstellations` the same way, set
> `observerStore` selected + datetime, and assert the label text appears.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/__tests__/SkyChart.test.jsx`
Expected: FAIL — "Orion" not in document (overlay not wired).

- [ ] **Step 3: Wire the hook, projection, canvas prop, and labels**

In `client/src/components/hero/SkyChart.jsx`:

Add imports:
```javascript
import { useUiStateStore } from "../../stores/uiStateStore.js";
import { useConstellations } from "../../hooks/useConstellations.js";
import ConstellationLabels from "./ConstellationLabels.jsx";
```
and extend the projection import:
```javascript
import { projectStars, projectPlanets, projectDsos, projectConstellations } from "../../utils/projection.js";
```

Read the toggle + query (after the existing `dsoQuery` line):
```javascript
  const showConstellations = useUiStateStore((s) => s.showConstellations);
  const constellationsQuery = useConstellations(selected, datetimeUtc, showConstellations);
```

Project constellation geometry (separate memo so it only recomputes on its own
inputs; constellations are independent of the ready/selection state):
```javascript
  const constellationGeom = useMemo(
    () =>
      projectConstellations(
        constellationsQuery.data?.constellations ?? [],
        width,
        height
      ),
    [constellationsQuery.data, width, height]
  );
```

Pass lines to the canvas (only when the toggle is on):
```javascript
      <SkyCanvas
        projectedStars={status === "ready" ? projected.stars : []}
        projectedPlanets={status === "ready" ? projected.planets : []}
        projectedDsos={status === "ready" ? projected.dsos : []}
        projectedLines={showConstellations ? constellationGeom.lines : []}
        width={width}
        height={height}
        dpr={dpr}
      />
```

Render the labels right after `<PlanetLabels .../>`:
```javascript
      {showConstellations && (
        <ConstellationLabels labels={constellationGeom.labels} />
      )}
```

> Constellation rendering does NOT gate on `status === "ready"` — it is
> independent of the star/planet/DSO queries and has its own data. It only gates
> on `showConstellations`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/__tests__/SkyChart.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/hero/SkyChart.jsx client/src/__tests__/SkyChart.test.jsx
git commit -m "feat(constellations): wire overlay into SkyChart"
```

---

## Task 15: Frontend — toggle control button

Adds a user-facing control to flip `showConstellations`. Placed with existing
chrome controls.

**Files:**
- Modify: `client/src/components/hero/SkyChart.jsx` (render the control), OR the
  existing controls component if one houses view toggles.
- Test: covered by an interaction test.

- [ ] **Step 1: Locate the controls home**

Run: `cd client && grep -rl "toggle\|Controls\|button" src/components --include=*.jsx | head`
Decide: if a controls strip/component already houses view toggles, add the
button there; otherwise add a small button inside the SkyChart container
(absolute, top-right, matching the dark chrome aesthetic).

- [ ] **Step 2: Write the failing interaction test**

```jsx
// client/src/__tests__/ConstellationToggle.test.jsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useUiStateStore } from "../stores/uiStateStore.js";
import ConstellationToggle from "../components/hero/ConstellationToggle.jsx";

beforeEach(() => useUiStateStore.setState({ showConstellations: false }));

describe("ConstellationToggle", () => {
  it("toggles showConstellations on click", () => {
    render(<ConstellationToggle />);
    const btn = screen.getByRole("button", { name: /constellation/i });
    expect(useUiStateStore.getState().showConstellations).toBe(false);
    fireEvent.click(btn);
    expect(useUiStateStore.getState().showConstellations).toBe(true);
  });

  it("reflects pressed state via aria-pressed", () => {
    render(<ConstellationToggle />);
    const btn = screen.getByRole("button", { name: /constellation/i });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd client && npx vitest run src/__tests__/ConstellationToggle.test.jsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 4: Write the toggle component**

```jsx
// client/src/components/hero/ConstellationToggle.jsx
import { useUiStateStore } from "../../stores/uiStateStore.js";

/**
 * View toggle for the constellation overlay. Dark-chrome aesthetic, sits over
 * the sky chart. Off by default (immersive sky is the hero).
 */
export default function ConstellationToggle() {
  const showConstellations = useUiStateStore((s) => s.showConstellations);
  const toggle = useUiStateStore((s) => s.toggleConstellations);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={showConstellations}
      aria-label="Toggle constellations"
      className={[
        "absolute top-3 right-3 z-10 rounded-md border px-2.5 py-1",
        "font-mono text-[10px] uppercase tracking-[0.18em] select-none",
        "backdrop-blur-sm transition-colors",
        showConstellations
          ? "border-accent-dim/60 text-accent-dim bg-white/5"
          : "border-white/10 text-white/40 bg-black/20 hover:text-white/70",
      ].join(" ")}
    >
      Constellations
    </button>
  );
}
```

- [ ] **Step 5: Render it in SkyChart**

In `client/src/components/hero/SkyChart.jsx`, import and render inside the
container (e.g. just before `<AttributionFooter />`):
```javascript
import ConstellationToggle from "./ConstellationToggle.jsx";
```
```javascript
      <ConstellationToggle />
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd client && npx vitest run src/__tests__/ConstellationToggle.test.jsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/hero/ConstellationToggle.jsx client/src/components/hero/SkyChart.jsx client/src/__tests__/ConstellationToggle.test.jsx
git commit -m "feat(constellations): view toggle control"
```

---

## Task 16: Attribution — footer + README + CLAUDE.md guardrail

**Files:**
- Modify: `client/src/components/hero/AttributionFooter.jsx`
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Test: `client/src/__tests__/AttributionFooter.test.jsx` (create or extend)

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/__tests__/AttributionFooter.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AttributionFooter from "../components/hero/AttributionFooter.jsx";

describe("AttributionFooter", () => {
  it("credits the constellation figure source", () => {
    render(<AttributionFooter />);
    expect(screen.getByText(/Constellation figures: Stellarium · CC BY-SA/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/__tests__/AttributionFooter.test.jsx`
Expected: FAIL — text not present.

- [ ] **Step 3: Add the credit line**

In `client/src/components/hero/AttributionFooter.jsx`, add after the DSO line:
```jsx
      <div>Constellation figures: Stellarium · CC BY-SA</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/__tests__/AttributionFooter.test.jsx`
Expected: PASS.

- [ ] **Step 5: Add README data-sources row**

In `README.md`, add to the Tier-1 data-sources table:
```
| **Stellarium Western sky culture** | Constellation stick-figure line topology | Stellarium | Vendored `western/index.json`, baked to `constellations.json` via ingest. **CC BY-SA — attribution + ShareAlike on the data file.** |
| **ESA Hipparcos** (VizieR I/239/hip_main) | J2000 ICRS coordinates for constellation HIP stars | **ESA** | Resolved at ingest time via astroquery VizieR |
```

- [ ] **Step 6: Add CLAUDE.md guardrail**

In `CLAUDE.md`, append guardrail #21 under "Guardrails for Claude Code":
```markdown
21. **Constellation figures are Stellarium Western sky culture (CC BY-SA) — attribution + ShareAlike on the data file.** The line topology baked into `server/data/constellations.json` is derived from Stellarium's `western/index.json` (CC BY-SA "data"). The vendored source lives at `server/data/sources/stellarium_western_index.json`. **Implementation requirements:** (a) `constellations.json` carries a `source` block naming Stellarium (figures, CC BY-SA 4.0) + ESA Hipparcos (coords) + IAU (names); (b) `AttributionFooter` credits "Constellation figures: Stellarium · CC BY-SA"; (c) README data-sources table + future `/about` page credit + license link. ShareAlike applies ONLY to the baked data file — it does not affect the rest of the codebase. We use NO Stellarium illustrations (Free Art License), stick figures only. Coordinates (Hipparcos) + names (IAU) are not the ShareAlike part.
```

- [ ] **Step 7: Commit**

```bash
git add client/src/components/hero/AttributionFooter.jsx client/src/__tests__/AttributionFooter.test.jsx README.md CLAUDE.md
git commit -m "docs(constellations): attribution footer + README + guardrail #21"
```

---

## Task 17: Full verification + visual QA + CLAUDE.md phase status

**Files:**
- Modify: `CLAUDE.md` (phase status + Resume Here)

- [ ] **Step 1: Backend suite green**

Run: `cd server && pytest -q`
Expected: all pass.

- [ ] **Step 2: Frontend suite green**

Run: `cd client && npx vitest run`
Expected: all pass.

- [ ] **Step 3: Lint clean**

Run: `cd client && npm run lint`
Expected: 0 warnings/errors.

- [ ] **Step 4: Production build**

Run: `cd client && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Live visual QA**

Start backend (`cd server && uvicorn app.main:app --reload --port 8000`) and
frontend (`cd client && npm run dev`). Verify across reference observers
(e.g. NYC, Buenos Aires, Reykjavík) at a clear night time:
- Toggle OFF by default; sky looks unchanged from before.
- Toggle ON: faint blue-white figure lines appear behind stars; recognizable
  shapes (Orion, Ursa Major/Minor) align with their bright stars.
- Name labels sit near figure centers, dim, uppercase, not competing with stars.
- Lines/labels respect the horizon (nothing drawn for below-horizon figures).
- Clicking a star through a constellation line still selects the star (lines
  are non-interactive).

- [ ] **Step 6: Update CLAUDE.md phase status**

Mark Phase 3a complete in the Phase Status list and update the "Resume Here"
section to point at Phase 3b (Enrichment: SIMBAD click-to-lookup + Exoplanet
Archive). Note that 3b remains the open half of Phase 3.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): mark Phase 3a constellations complete"
```

---

## Self-Review

**Spec coverage:**
- Toggle (default OFF) → Task 9 + Task 15. ✓
- Gated hook → Task 10. ✓
- Observer-parameterized endpoint, ICRS→AltAz, both-endpoints-visible rule → Tasks 5–7. ✓
- `index.json` polyline parsing → Task 2; build + VizieR resolve → Task 3; real bake → Task 8. ✓
- Layer order (lines behind objects) → Task 12. ✓
- DOM-overlay labels → Task 13. ✓
- Non-interactive overlay → enforced by `pointer-events-none` (Tasks 12/13) + QA Step 5 (Task 17). ✓
- CC BY-SA notice in `constellations.json` (SOURCE_BLOCK), footer, README, guardrail → Tasks 3/8/16. ✓
- Centroid wraparound handling → Task 3 `centroid_radec`. ✓
- DataNotFoundError path → Task 5 + 503 mapping in Task 7. ✓
- Out-of-scope items (boundaries, artwork, 3b enrichment, clipping) → not implemented; confirmed absent. ✓

**Placeholder scan:** Task 14's test references "reuse existing test setup" — this is an explicit instruction to mirror the documented `SkyChart.test.jsx` pattern (which already mocks the other hooks), not a code placeholder. All other steps contain complete code. ✓

**Type consistency:**
- Schema field names (`from_alt`, `from_az`, `to_alt`, `to_az`, `visible`, `label_alt`, `label_az`, `label_visible`) match across schemas (Task 1), service (Task 6), projector (Task 11), and SkyChart mock (Task 14). ✓
- `projectConstellations` returns `{ lines, labels }`; consumed as `constellationGeom.lines` / `.labels` (Task 14) and `projectedLines` prop on SkyCanvas (Task 12). ✓
- `load_catalog` / `constellations_for_observer` / `ConstellationCatalogNotFoundError` names consistent across service (5/6), router (7), tests. ✓
- `toggleConstellations` / `showConstellations` consistent across store (9), hook gating (10/14), toggle (15). ✓
