# Phase 3b — Star Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a rendered star resolves its real name, designation, spectral type, and confirmed-exoplanet status from baked SIMBAD + NASA Exoplanet Archive data, shown by expanding the existing star tooltip.

**Architecture:** Fully baked. A one-time offline ingest (`scripts/ingest_star_enrichment.py`) resolves all naked-eye stars (mag ≤ 6.5, the default render set) through SIMBAD and cross-matches the NASA Exoplanet Archive, writing `server/data/star_enrichment.json` keyed by Gaia DR3 `source_id`. At runtime, `GET /api/v1/objects/{source_id}` is an in-memory dict lookup — **zero external calls**. The frontend fetches enrichment on star click via a gated React Query hook and renders it in `StarBody`.

**Tech Stack:** FastAPI + Pydantic + Astropy/astroquery (ingest only) on the backend; React 18 + React Query + Vitest/RTL on the frontend. Mirrors the existing DSO and constellation catalog patterns.

---

## File Structure

**Backend — create:**
- `server/app/services/star_enrichment.py` — loader (`lru_cache`) + `enrichment_for(source_id)` in-memory lookup. Mirrors `dso_catalog.py`.
- `server/scripts/ingest_star_enrichment.py` — offline bake. Pure parse/transform helpers + thin live-query glue.
- `server/data/star_enrichment.json` — baked artifact (committed, produced by the ingest).
- `server/tests/fixtures/star_enrichment_minimal.json` — 3-star test fixture (Vega named+no planets, 51 Peg host, an anonymous spectral-only star).
- `server/tests/test_star_enrichment.py` — service tests.
- `server/tests/test_objects_router.py` — endpoint tests.
- `server/tests/test_star_enrichment_ingest.py` — pure-helper tests.

**Backend — modify:**
- `server/app/config.py` — add `star_enrichment_path`.
- `server/app/models/schemas.py` — add `ExoplanetInfo`, `ObjectEnrichment`, `ObjectResponse`.
- `server/app/routers/objects.py` — replace stub with the real lookup endpoint.
- `server/app/services/enrichment/simbad.py` + `exoplanet_archive.py` — ingest-time query functions (called by the script).

**Frontend — create:**
- `client/src/hooks/useObject.js` — gated React Query hook.
- `client/src/__tests__/useObject.test.jsx` — hook gating tests.

**Frontend — modify:**
- `client/src/api/client.js` — add `api.object(sourceId)`.
- `client/src/components/hero/SkyChart.jsx` — derive sourceId from the selected star, call `useObject`, pass enrichment to the tooltip.
- `client/src/components/hero/SkyTooltip.jsx` — extend `StarBody` with enrichment rendering; thread an `enrichment` prop.
- `client/src/__tests__/SkyTooltip.test.jsx` — StarBody enrichment cases.

**Docs — modify (final task):** `README.md`, `CLAUDE.md`, `AttributionFooter.jsx` verification.

---

## Data Contract

**Baked `star_enrichment.json`** — object keyed by `source_id` (string). Only stars with at least a SIMBAD match get an entry; faint/unresolved stars are absent.

```json
{
  "91262...": {
    "proper_name": "Vega",
    "designation": "α Lyrae",
    "catalog_ids": ["HD 172167", "HIP 91262"],
    "spectral_type": "A0Va",
    "object_type": "Variable Star",
    "planets": { "count": 0, "names": [] },
    "name_source": "SIMBAD/CDS",
    "planet_source": "NASA Exoplanet Archive"
  }
}
```
- `proper_name`, `designation`, `catalog_ids`, `spectral_type`, `object_type` come from SIMBAD; any may be missing.
- `planets` is present **only** when the star is in the exoplanet host map (count ≥ 1). Absent → "No known planets".
- `name_source` / `planet_source` drive the per-star `sources` list.

**`GET /api/v1/objects/{source_id}`** returns `ObjectResponse`:
- Known star → `{ "found": true, "enrichment": { ... } }` (HTTP 200).
- Unknown source_id → `{ "found": false, "enrichment": null }` (HTTP 200 — not an error, so the tooltip degrades gracefully).
- Catalog file missing → HTTP 503.

---

### Task 1: Config + schemas

**Files:**
- Modify: `server/app/config.py`
- Modify: `server/app/models/schemas.py`
- Test: `server/tests/test_schemas_enrichment.py` (create)

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_schemas_enrichment.py`:

```python
from app.models.schemas import ExoplanetInfo, ObjectEnrichment, ObjectResponse


def test_object_response_found_with_enrichment():
    resp = ObjectResponse(
        found=True,
        enrichment=ObjectEnrichment(
            source_id="123",
            proper_name="Vega",
            designation="α Lyrae",
            catalog_ids=["HD 172167", "HIP 91262"],
            spectral_type="A0Va",
            object_type="Variable Star",
            planets=None,
            sources=["SIMBAD/CDS"],
        ),
    )
    assert resp.found is True
    assert resp.enrichment.proper_name == "Vega"
    assert resp.enrichment.planets is None


def test_object_response_not_found():
    resp = ObjectResponse(found=False, enrichment=None)
    assert resp.found is False
    assert resp.enrichment is None


def test_exoplanet_info_defaults():
    info = ExoplanetInfo(count=3, names=["51 Peg b"])
    assert info.count == 3
    assert info.names == ["51 Peg b"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_schemas_enrichment.py -v`
Expected: FAIL — `ImportError: cannot import name 'ExoplanetInfo'`.

- [ ] **Step 3: Add the schemas**

Append to `server/app/models/schemas.py`:

```python
class ExoplanetInfo(BaseModel):
    """Confirmed exoplanets for a host star (NASA Exoplanet Archive)."""

    count: int = Field(..., ge=0, description="Number of confirmed planets")
    names: list[str] = Field(default_factory=list, description="Planet designations")


class ObjectEnrichment(BaseModel):
    """SIMBAD + NASA Exoplanet Archive enrichment for one star.

    Every field except ``source_id`` may be missing — enrichment coverage is
    partial and honest. ``planets`` is present only for confirmed hosts.
    """

    source_id: str
    proper_name: str | None = None
    designation: str | None = None
    catalog_ids: list[str] = Field(default_factory=list)
    spectral_type: str | None = None
    object_type: str | None = None
    planets: ExoplanetInfo | None = None
    sources: list[str] = Field(default_factory=list)


class ObjectResponse(BaseModel):
    """Enrichment lookup response. ``found`` is False for stars with no entry."""

    found: bool
    enrichment: ObjectEnrichment | None = None
```

- [ ] **Step 4: Add the config path**

In `server/app/config.py`, after the `constellations_catalog_path` line (around line 38), add:

```python
    # Star enrichment catalog (produced once via scripts/ingest_star_enrichment.py)
    star_enrichment_path: Path = DATA_DIR / "star_enrichment.json"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_schemas_enrichment.py -v`
Expected: PASS (3 passed).

- [ ] **Step 6: Commit**

```bash
git add server/app/models/schemas.py server/app/config.py server/tests/test_schemas_enrichment.py
git commit -m "feat(enrichment): ObjectEnrichment schemas + config path"
```

---

### Task 2: Star enrichment service + fixture

**Files:**
- Create: `server/app/services/star_enrichment.py`
- Create: `server/tests/fixtures/star_enrichment_minimal.json`
- Test: `server/tests/test_star_enrichment.py`

- [ ] **Step 1: Create the test fixture**

Create `server/tests/fixtures/star_enrichment_minimal.json`:

```json
{
  "2667000000000000000": {
    "proper_name": "Vega",
    "designation": "α Lyrae",
    "catalog_ids": ["HD 172167", "HIP 91262"],
    "spectral_type": "A0Va",
    "object_type": "Variable Star",
    "planets": { "count": 0, "names": [] },
    "name_source": "SIMBAD/CDS",
    "planet_source": "NASA Exoplanet Archive"
  },
  "2835000000000000000": {
    "proper_name": "51 Pegasi",
    "designation": "51 Peg",
    "catalog_ids": ["HD 217014", "HIP 113357"],
    "spectral_type": "G2IV",
    "object_type": "High Proper Motion Star",
    "planets": { "count": 1, "names": ["51 Peg b"] },
    "name_source": "SIMBAD/CDS",
    "planet_source": "NASA Exoplanet Archive"
  },
  "4000000000000000000": {
    "proper_name": null,
    "designation": null,
    "catalog_ids": ["HD 999999"],
    "spectral_type": "K0",
    "object_type": "Star",
    "planets": null,
    "name_source": "SIMBAD/CDS",
    "planet_source": null
  }
}
```

> Note: the `planets` field for Vega here carries `count: 0` only to exercise the loader; the ingest emits `planets` **only** for hosts. The loader treats `count == 0` the same as absent (no host line distinction) — see Step 4.

- [ ] **Step 2: Write the failing test**

Create `server/tests/test_star_enrichment.py`:

```python
from pathlib import Path

import pytest

from app.services import star_enrichment

FIXTURE = Path(__file__).parent / "fixtures" / "star_enrichment_minimal.json"


@pytest.fixture(autouse=True)
def clear_cache():
    star_enrichment.load_catalog.cache_clear()
    yield
    star_enrichment.load_catalog.cache_clear()


def test_load_returns_all_entries():
    data = star_enrichment.load_catalog(FIXTURE)
    assert len(data) == 3


def test_enrichment_for_named_star():
    e = star_enrichment.enrichment_for("2667000000000000000", FIXTURE)
    assert e is not None
    assert e.proper_name == "Vega"
    assert e.designation == "α Lyrae"
    assert e.spectral_type == "A0Va"
    assert e.planets is None  # count 0 -> no host info
    assert e.sources == ["SIMBAD/CDS"]


def test_enrichment_for_host_star():
    e = star_enrichment.enrichment_for("2835000000000000000", FIXTURE)
    assert e.planets is not None
    assert e.planets.count == 1
    assert e.planets.names == ["51 Peg b"]
    assert e.sources == ["SIMBAD/CDS", "NASA Exoplanet Archive"]


def test_enrichment_for_anonymous_star():
    e = star_enrichment.enrichment_for("4000000000000000000", FIXTURE)
    assert e.proper_name is None
    assert e.spectral_type == "K0"
    assert e.catalog_ids == ["HD 999999"]


def test_enrichment_for_unknown_returns_none():
    assert star_enrichment.enrichment_for("9999999999999999999", FIXTURE) is None


def test_missing_catalog_raises():
    with pytest.raises(star_enrichment.StarEnrichmentNotFoundError):
        star_enrichment.load_catalog(Path("does/not/exist.json"))
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_star_enrichment.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.star_enrichment'`.

- [ ] **Step 4: Implement the service**

Create `server/app/services/star_enrichment.py`:

```python
"""Baked star enrichment lookup (SIMBAD names/spectral + NASA exoplanet hosts).

Loads a static JSON produced by ``scripts/ingest_star_enrichment.py``, keyed by
Gaia DR3 source_id. Pure in-memory lookup — the request path never hits SIMBAD
or NASA. This is a hot service despite living under "enrichment": all external
work happened once, at ingest time.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from app.config import settings
from app.models.schemas import ExoplanetInfo, ObjectEnrichment


class StarEnrichmentNotFoundError(FileNotFoundError):
    """Raised when the star enrichment JSON is missing at load time."""


@lru_cache(maxsize=4)
def load_catalog(path: Path | None = None) -> dict:
    """Load the baked enrichment map. Cached per path."""
    p = Path(path) if path is not None else settings.star_enrichment_path
    if not p.exists():
        raise StarEnrichmentNotFoundError(
            f"Star enrichment catalog not found at {p}. "
            f"Run: cd server && python scripts/ingest_star_enrichment.py"
        )
    with p.open(encoding="utf-8") as fh:
        return json.load(fh)


def enrichment_for(
    source_id: str, path: Path | None = None
) -> ObjectEnrichment | None:
    """Return enrichment for a Gaia DR3 source_id, or None if not catalogued."""
    raw = load_catalog(path).get(source_id)
    if raw is None:
        return None

    sources: list[str] = []
    if raw.get("name_source"):
        sources.append(raw["name_source"])

    planets = None
    planet_block = raw.get("planets")
    if planet_block and planet_block.get("count", 0) >= 1:
        planets = ExoplanetInfo(
            count=planet_block["count"],
            names=planet_block.get("names", []),
        )
        if raw.get("planet_source"):
            sources.append(raw["planet_source"])

    return ObjectEnrichment(
        source_id=source_id,
        proper_name=raw.get("proper_name"),
        designation=raw.get("designation"),
        catalog_ids=raw.get("catalog_ids", []),
        spectral_type=raw.get("spectral_type"),
        object_type=raw.get("object_type"),
        planets=planets,
        sources=sources,
    )
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_star_enrichment.py -v`
Expected: PASS (6 passed).

- [ ] **Step 6: Commit**

```bash
git add server/app/services/star_enrichment.py server/tests/test_star_enrichment.py server/tests/fixtures/star_enrichment_minimal.json
git commit -m "feat(enrichment): baked star enrichment service"
```

---

### Task 3: Objects router

**Files:**
- Modify: `server/app/routers/objects.py`
- Test: `server/tests/test_objects_router.py` (create)
- Verify: `server/app/main.py` already mounts the objects router (it mounts the stub today — confirm in Step 3).

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_objects_router.py`:

```python
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import star_enrichment

FIXTURE = Path(__file__).parent / "fixtures" / "star_enrichment_minimal.json"
client = TestClient(app)


@pytest.fixture(autouse=True)
def use_fixture_catalog(monkeypatch):
    star_enrichment.load_catalog.cache_clear()
    monkeypatch.setattr(
        star_enrichment.settings, "star_enrichment_path", FIXTURE
    )
    yield
    star_enrichment.load_catalog.cache_clear()


def test_known_host_star_returns_enrichment():
    r = client.get("/api/v1/objects/2835000000000000000")
    assert r.status_code == 200
    body = r.json()
    assert body["found"] is True
    assert body["enrichment"]["proper_name"] == "51 Pegasi"
    assert body["enrichment"]["planets"]["count"] == 1
    assert "NASA Exoplanet Archive" in body["enrichment"]["sources"]


def test_unknown_star_returns_found_false():
    r = client.get("/api/v1/objects/9999999999999999999")
    assert r.status_code == 200
    body = r.json()
    assert body["found"] is False
    assert body["enrichment"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_objects_router.py -v`
Expected: FAIL — current stub returns `{"id": ..., "enrichment": None, "sources": []}`, so `body["found"]` raises `KeyError`.

- [ ] **Step 3: Replace the router**

Overwrite `server/app/routers/objects.py`:

```python
"""GET /api/v1/objects/{source_id} — baked enrichment lookup for one star.

SIMBAD names/spectral type + NASA Exoplanet Archive host data, served from an
in-memory map (no external calls at runtime).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import ObjectResponse
from app.services import star_enrichment

router = APIRouter(prefix="/objects", tags=["objects"])


@router.get("/{source_id}", response_model=ObjectResponse)
async def get_object(source_id: str) -> ObjectResponse:
    try:
        enrichment = star_enrichment.enrichment_for(source_id)
    except star_enrichment.StarEnrichmentNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return ObjectResponse(found=enrichment is not None, enrichment=enrichment)
```

Confirm `server/app/main.py` includes the objects router (it does today for the stub). If grep shows it is **not** mounted, add `app.include_router(objects.router, prefix=settings.api_v1_prefix)` next to the other routers.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_objects_router.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Run the full backend suite (no regressions)**

Run: `cd server && .venv\Scripts\python -m pytest -q`
Expected: PASS — all prior tests (94) + the new enrichment tests green.

- [ ] **Step 6: Commit**

```bash
git add server/app/routers/objects.py server/tests/test_objects_router.py
git commit -m "feat(enrichment): GET /objects/{source_id} baked lookup endpoint"
```

---

### Task 4: Ingest pure helpers (TDD against fixtures)

The live SIMBAD/NASA queries are thin I/O wrappers (not unit-tested). All parsing/transform logic is pure and fully tested here.

**Files:**
- Create: `server/scripts/ingest_star_enrichment.py` (helpers first)
- Create: `server/app/services/enrichment/simbad.py` (ingest-time query fn — added in Task 5)
- Test: `server/tests/test_star_enrichment_ingest.py`

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_star_enrichment_ingest.py`:

```python
from scripts.ingest_star_enrichment import (
    format_bayer,
    build_name_fields,
    merge_enrichment,
)


def test_format_bayer_expands_greek_abbreviation():
    assert format_bayer("* alf Lyr") == "α Lyrae"
    assert format_bayer("* bet Ori") == "β Orionis"


def test_format_bayer_passthrough_when_no_greek():
    # Flamsteed-number designations have no Greek letter to expand.
    assert format_bayer("* 51 Peg") == "51 Pegasi"


def test_build_name_fields_picks_proper_name_and_designation():
    identifiers = [
        "NAME Vega",
        "* alf Lyr",
        "HD 172167",
        "HIP 91262",
        "TYC 3105-2070-1",
    ]
    proper, designation, catalog_ids = build_name_fields(identifiers)
    assert proper == "Vega"
    assert designation == "α Lyrae"
    assert catalog_ids == ["HD 172167", "HIP 91262"]


def test_build_name_fields_no_proper_name():
    identifiers = ["HD 999999", "* 12 Tau"]
    proper, designation, catalog_ids = build_name_fields(identifiers)
    assert proper is None
    assert designation == "12 Tauri"
    assert catalog_ids == ["HD 999999"]


def test_merge_enrichment_combines_simbad_and_planets():
    simbad = {
        "2835000000000000000": {
            "proper_name": "51 Pegasi",
            "designation": "51 Peg",
            "catalog_ids": ["HD 217014"],
            "spectral_type": "G2IV",
            "object_type": "High Proper Motion Star",
        }
    }
    planets = {"2835000000000000000": {"count": 1, "names": ["51 Peg b"]}}
    merged = merge_enrichment(simbad, planets)
    entry = merged["2835000000000000000"]
    assert entry["planets"] == {"count": 1, "names": ["51 Peg b"]}
    assert entry["name_source"] == "SIMBAD/CDS"
    assert entry["planet_source"] == "NASA Exoplanet Archive"


def test_merge_enrichment_star_without_planets_has_no_planet_source():
    simbad = {"4000000000000000000": {"proper_name": None, "spectral_type": "K0"}}
    merged = merge_enrichment(simbad, {})
    entry = merged["4000000000000000000"]
    assert entry["planets"] is None
    assert entry["planet_source"] is None
    assert entry["name_source"] == "SIMBAD/CDS"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_star_enrichment_ingest.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.ingest_star_enrichment'`.

- [ ] **Step 3: Implement the pure helpers**

Create `server/scripts/ingest_star_enrichment.py` (helpers only for now):

```python
"""One-time ingest: resolve naked-eye stars via SIMBAD and cross-match the
NASA Exoplanet Archive, writing ``server/data/star_enrichment.json``.

Run when the rendered bright-star set changes. Output is committed; the request
path never hits SIMBAD or NASA.

Usage:
    cd server
    python scripts/ingest_star_enrichment.py
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

NAME_SOURCE = "SIMBAD/CDS"
PLANET_SOURCE = "NASA Exoplanet Archive"

# SIMBAD abbreviates Greek letters in Bayer designations. Map to Unicode.
_GREEK = {
    "alf": "α", "bet": "β", "gam": "γ", "del": "δ", "eps": "ε", "zet": "ζ",
    "eta": "η", "the": "θ", "iot": "ι", "kap": "κ", "lam": "λ", "mu.": "μ",
    "mu": "μ", "nu.": "ν", "nu": "ν", "xi.": "ξ", "xi": "ξ", "omi": "ο",
    "pi.": "π", "pi": "π", "rho": "ρ", "sig": "σ", "tau": "τ", "ups": "υ",
    "phi": "φ", "chi": "χ", "psi": "ψ", "ome": "ω",
}

# Genitive forms of the 88 constellations (Bayer/Flamsteed read "<letter> <gen>").
# Abbreviated IAU code -> Latin genitive.
_GENITIVE = {
    "And": "Andromedae", "Ant": "Antliae", "Aps": "Apodis", "Aqr": "Aquarii",
    "Aql": "Aquilae", "Ara": "Arae", "Ari": "Arietis", "Aur": "Aurigae",
    "Boo": "Boötis", "Cae": "Caeli", "Cam": "Camelopardalis", "Cnc": "Cancri",
    "CVn": "Canum Venaticorum", "CMa": "Canis Majoris", "CMi": "Canis Minoris",
    "Cap": "Capricorni", "Car": "Carinae", "Cas": "Cassiopeiae", "Cen": "Centauri",
    "Cep": "Cephei", "Cet": "Ceti", "Cha": "Chamaeleontis", "Cir": "Circini",
    "Col": "Columbae", "Com": "Comae Berenices", "CrA": "Coronae Australis",
    "CrB": "Coronae Borealis", "Crv": "Corvi", "Crt": "Crateris", "Cru": "Crucis",
    "Cyg": "Cygni", "Del": "Delphini", "Dor": "Doradus", "Dra": "Draconis",
    "Equ": "Equulei", "Eri": "Eridani", "For": "Fornacis", "Gem": "Geminorum",
    "Gru": "Gruis", "Her": "Herculis", "Hor": "Horologii", "Hya": "Hydrae",
    "Hyi": "Hydri", "Ind": "Indi", "Lac": "Lacertae", "Leo": "Leonis",
    "LMi": "Leonis Minoris", "Lep": "Leporis", "Lib": "Librae", "Lup": "Lupi",
    "Lyn": "Lyncis", "Lyr": "Lyrae", "Men": "Mensae", "Mic": "Microscopii",
    "Mon": "Monocerotis", "Mus": "Muscae", "Nor": "Normae", "Oct": "Octantis",
    "Oph": "Ophiuchi", "Ori": "Orionis", "Pav": "Pavonis", "Peg": "Pegasi",
    "Per": "Persei", "Phe": "Phoenicis", "Pic": "Pictoris", "PsA": "Piscis Austrini",
    "Psc": "Piscium", "Pup": "Puppis", "Pyx": "Pyxidis", "Ret": "Reticuli",
    "Scl": "Sculptoris", "Sco": "Scorpii", "Sct": "Scuti", "Ser": "Serpentis",
    "Sex": "Sextantis", "Sge": "Sagittae", "Sgr": "Sagittarii", "Tau": "Tauri",
    "Tel": "Telescopii", "TrA": "Trianguli Australis", "Tri": "Trianguli",
    "Tuc": "Tucanae", "UMa": "Ursae Majoris", "UMi": "Ursae Minoris",
    "Vel": "Velorum", "Vir": "Virginis", "Vol": "Volantis", "Vul": "Vulpeculae",
}


def format_bayer(ident: str) -> str:
    """Format a SIMBAD '* <bayer/flamsteed> <Con>' identifier for display.

    '* alf Lyr' -> 'α Lyrae'; '* 51 Peg' -> '51 Pegasi'. Falls back to the raw
    token + genitive when the constellation is unknown.
    """
    token = ident[1:].strip() if ident.startswith("*") else ident.strip()
    parts = token.split()
    if len(parts) < 2:
        return token
    letter_raw, con = parts[0], parts[-1]
    letter = _GREEK.get(letter_raw.lower(), letter_raw)
    genitive = _GENITIVE.get(con, con)
    return f"{letter} {genitive}"


def build_name_fields(identifiers: list[str]) -> tuple[str | None, str | None, list[str]]:
    """From a star's SIMBAD identifiers, derive (proper_name, designation, catalog_ids)."""
    proper_name: str | None = None
    designation: str | None = None
    catalog_ids: list[str] = []

    for ident in identifiers:
        s = ident.strip()
        if s.startswith("NAME ") and proper_name is None:
            proper_name = s[len("NAME "):].strip()
        elif s.startswith("* ") and designation is None:
            designation = format_bayer(s)
        elif s.startswith(("HD ", "HIP ")):
            catalog_ids.append(s)

    return proper_name, designation, catalog_ids


def merge_enrichment(simbad: dict, planets: dict) -> dict:
    """Combine the SIMBAD map and the exoplanet-host map into baked entries."""
    out: dict = {}
    for source_id, fields in simbad.items():
        planet_block = planets.get(source_id)
        out[source_id] = {
            "proper_name": fields.get("proper_name"),
            "designation": fields.get("designation"),
            "catalog_ids": fields.get("catalog_ids", []),
            "spectral_type": fields.get("spectral_type"),
            "object_type": fields.get("object_type"),
            "planets": planet_block if planet_block else None,
            "name_source": NAME_SOURCE,
            "planet_source": PLANET_SOURCE if planet_block else None,
        }
    return out
```

- [ ] **Step 4: Make `scripts` importable in tests**

Confirm `server/tests` can import from `scripts`. The DSO ingest test (`test_dso_ingest.py`) already imports `from scripts.ingest_dso import ...`, so the path config exists (check `server/pytest.ini`/`pyproject`/`conftest.py`). No change needed if that test passes today.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_star_enrichment_ingest.py -v`
Expected: PASS (6 passed).

- [ ] **Step 6: Commit**

```bash
git add server/scripts/ingest_star_enrichment.py server/tests/test_star_enrichment_ingest.py
git commit -m "feat(enrichment): ingest pure helpers (name/bayer/merge) with tests"
```

---

### Task 5: Ingest live-query glue + bake the real catalog

This task has a **network-dependent run step**. The query functions are thin and not unit-tested; correctness of their output is validated by the resolution-rate logging and spot-checks in Step 4.

**Files:**
- Modify: `server/app/services/enrichment/simbad.py`
- Modify: `server/app/services/enrichment/exoplanet_archive.py`
- Modify: `server/scripts/ingest_star_enrichment.py` (add `main()` + live fetch)
- Create: `server/data/star_enrichment.json` (generated, committed)

- [ ] **Step 1: Implement the SIMBAD ingest query**

Overwrite `server/app/services/enrichment/simbad.py`:

```python
"""SIMBAD (CDS) ingest-time queries. NOT used on the request path."""

from __future__ import annotations

import logging

from astroquery.simbad import Simbad

logger = logging.getLogger(__name__)


def fetch_simbad(gaia_source_ids: list[str], chunk_size: int = 400) -> dict:
    """Resolve Gaia DR3 source_ids to SIMBAD names/spectral type/identifiers.

    Returns ``{source_id: {proper_name, designation, catalog_ids, spectral_type,
    object_type}}`` using build_name_fields on each star's identifier list.
    Stars SIMBAD can't resolve are simply absent from the result.
    """
    from scripts.ingest_star_enrichment import build_name_fields

    out: dict = {}
    for start in range(0, len(gaia_source_ids), chunk_size):
        chunk = gaia_source_ids[start : start + chunk_size]
        gaia_ids = [f"Gaia DR3 {sid}" for sid in chunk]
        id_list = ", ".join(f"'{g}'" for g in gaia_ids)
        # basic gives sp_type/otype/main_id; ident (joined twice) gives the
        # input Gaia id (to key on) and every other identifier (NAME/* /HD/HIP).
        query = f"""
            SELECT gaia.id AS gaia_id, b.sp_type AS sp_type,
                   b.otype_txt AS otype, allids.id AS ident
            FROM ident AS gaia
            JOIN basic AS b ON b.oid = gaia.oidref
            JOIN ident AS allids ON allids.oidref = b.oid
            WHERE gaia.id IN ({id_list})
        """
        table = Simbad.query_tap(query)
        # Group rows by gaia_id (one row per identifier).
        by_star: dict = {}
        for row in table:
            gid = str(row["gaia_id"]).replace("Gaia DR3 ", "").strip()
            rec = by_star.setdefault(
                gid, {"idents": [], "sp_type": str(row["sp_type"]).strip(),
                      "otype": str(row["otype"]).strip()}
            )
            rec["idents"].append(str(row["ident"]).strip())

        for gid, rec in by_star.items():
            proper, designation, catalog_ids = build_name_fields(rec["idents"])
            out[gid] = {
                "proper_name": proper,
                "designation": designation,
                "catalog_ids": catalog_ids,
                "spectral_type": rec["sp_type"] or None,
                "object_type": rec["otype"] or None,
            }
        logger.info("SIMBAD resolved %d/%d so far", len(out), start + len(chunk))
    return out
```

- [ ] **Step 2: Implement the exoplanet-host query**

Overwrite `server/app/services/enrichment/exoplanet_archive.py`:

```python
"""NASA Exoplanet Archive ingest-time queries. NOT used on the request path."""

from __future__ import annotations

import logging

from astroquery.ipac.nexsci.nasa_exoplanet_archive import NasaExoplanetArchive

logger = logging.getLogger(__name__)


def fetch_exoplanet_hosts(gaia_source_ids: set[str]) -> dict:
    """Return ``{source_id: {count, names}}`` for confirmed-planet hosts whose
    Gaia DR3 id is in ``gaia_source_ids``.

    The pscomppars table carries ``gaia_id`` as e.g. 'Gaia DR3 12345'. Hosts
    without a Gaia DR3 id can't be matched — honest partial coverage.
    """
    table = NasaExoplanetArchive.query_criteria(
        table="pscomppars", select="pl_name,hostname,gaia_id"
    )
    out: dict = {}
    for row in table:
        gaia_id = str(row["gaia_id"]).strip()
        if not gaia_id.startswith("Gaia DR3 "):
            continue
        sid = gaia_id.replace("Gaia DR3 ", "").strip()
        if sid not in gaia_source_ids:
            continue
        entry = out.setdefault(sid, {"count": 0, "names": []})
        entry["count"] += 1
        entry["names"].append(str(row["pl_name"]).strip())
    logger.info("Exoplanet hosts matched: %d", len(out))
    return out
```

- [ ] **Step 3: Add `main()` to the ingest script**

Append to `server/scripts/ingest_star_enrichment.py`:

```python
def load_bright_star_ids(mag_limit: float = 6.5) -> list[str]:
    """Read the rendered bright-star source_ids from the Gaia parquet."""
    import pandas as pd

    from app.config import settings

    df = pd.read_parquet(settings.gaia_parquet_path, columns=["source_id", "phot_g_mean_mag"])
    df = df[df["phot_g_mean_mag"] <= mag_limit]
    return [str(sid) for sid in df["source_id"].tolist()]


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    from app.config import settings
    from app.services.enrichment.simbad import fetch_simbad
    from app.services.enrichment.exoplanet_archive import fetch_exoplanet_hosts

    source_ids = load_bright_star_ids()
    logger.info("Bright stars to resolve: %d", len(source_ids))

    simbad = fetch_simbad(source_ids)
    logger.info("SIMBAD resolved: %d/%d (%.1f%%)",
                len(simbad), len(source_ids), 100 * len(simbad) / max(len(source_ids), 1))

    planets = fetch_exoplanet_hosts(set(source_ids))
    logger.info("Exoplanet hosts: %d", len(planets))

    baked = merge_enrichment(simbad, planets)
    baked["__source__"] = {  # provenance block; loader ignores non-id keys via .get
        "names": "SIMBAD (CDS Strasbourg)",
        "spectral_type": "SIMBAD (CDS Strasbourg)",
        "exoplanets": "NASA Exoplanet Archive (NASA/IPAC)",
    }

    out_path = settings.star_enrichment_path
    out_path.write_text(json.dumps(baked, ensure_ascii=False, indent=1), encoding="utf-8")
    logger.info("Wrote %s (%d entries)", out_path, len(baked) - 1)


if __name__ == "__main__":
    main()
```

> The `__source__` provenance key sits alongside id keys. `enrichment_for` looks up by exact source_id, so it never collides; a real Gaia source_id is numeric and won't equal `__source__`.

- [ ] **Step 4: Run the bake (network required)**

Run: `cd server && .venv\Scripts\python scripts/ingest_star_enrichment.py`
Expected: logs a SIMBAD resolution rate (should be high, >90% for naked-eye stars) and an exoplanet-host count (tens — bright naked-eye hosts like 51 Peg, Pollux, Fomalhaut, Aldebaran). Writes `server/data/star_enrichment.json`.

Spot-check the output:
```bash
.venv\Scripts\python -c "import json; d=json.load(open('data/star_enrichment.json', encoding='utf-8')); vega=[v for v in d.values() if isinstance(v,dict) and v.get('proper_name')=='Vega']; print('Vega:', vega[:1])"
```
Expected: Vega resolves with `spectral_type` starting `A0` and HD/HIP catalog ids.

> **If this environment has no network access:** stop here, commit Steps 1–3, and hand the bake to Andrew to run locally (same as the Gaia/DSO/constellation ingests). The frontend tasks below do not depend on the real baked file — they use mocked data and the fixture.

- [ ] **Step 5: Confirm the catalog is committed, not gitignored**

The DSO/constellation pattern allowlists committed catalogs in `.gitignore` (e.g. `!server/data/constellations.json`). Add the same for the new file. In `.gitignore`, near the other `!server/data/...` lines, add:
```
!server/data/star_enrichment.json
```

- [ ] **Step 6: Commit**

```bash
git add server/app/services/enrichment/simbad.py server/app/services/enrichment/exoplanet_archive.py server/scripts/ingest_star_enrichment.py .gitignore server/data/star_enrichment.json
git commit -m "feat(enrichment): live ingest queries + baked star_enrichment.json"
```

---

### Task 6: Frontend API client + useObject hook

**Files:**
- Modify: `client/src/api/client.js`
- Create: `client/src/hooks/useObject.js`
- Test: `client/src/__tests__/useObject.test.jsx`

- [ ] **Step 1: Add the API method**

In `client/src/api/client.js`, add to the `api` object (after `constellations`):

```javascript
  object: (sourceId) => request(`/objects/${sourceId}`),
```

- [ ] **Step 2: Write the failing test**

Create `client/src/__tests__/useObject.test.jsx`:

```javascript
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useObject } from "../hooks/useObject.js";
import { api } from "../api/client.js";

vi.mock("../api/client.js", () => ({
  api: { object: vi.fn() },
}));

function wrapper({ children }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe("useObject", () => {
  it("does not fetch when disabled", () => {
    renderHook(() => useObject("123", false), { wrapper });
    expect(api.object).not.toHaveBeenCalled();
  });

  it("does not fetch when sourceId is null", () => {
    renderHook(() => useObject(null, true), { wrapper });
    expect(api.object).not.toHaveBeenCalled();
  });

  it("fetches when enabled with a sourceId", async () => {
    api.object.mockResolvedValue({ found: true, enrichment: { proper_name: "Vega" } });
    const { result } = renderHook(() => useObject("123", true), { wrapper });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(api.object).toHaveBeenCalledWith("123");
    expect(result.current.data.enrichment.proper_name).toBe("Vega");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd client && npx vitest run src/__tests__/useObject.test.jsx`
Expected: FAIL — cannot resolve `../hooks/useObject.js`.

- [ ] **Step 4: Implement the hook**

Create `client/src/hooks/useObject.js`:

```javascript
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

/**
 * Fetch baked enrichment for a single star by Gaia DR3 source_id.
 * Gated: fires only when `enabled` and a `sourceId` is present (i.e. a star is
 * selected). Cached per source_id, so re-clicking a star is instant.
 */
export function useObject(sourceId, enabled) {
  return useQuery({
    queryKey: ["object", sourceId],
    queryFn: () => api.object(sourceId),
    enabled: Boolean(enabled && sourceId),
    staleTime: Infinity,
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npx vitest run src/__tests__/useObject.test.jsx`
Expected: PASS (3 passed).

- [ ] **Step 6: Commit**

```bash
git add client/src/api/client.js client/src/hooks/useObject.js client/src/__tests__/useObject.test.jsx
git commit -m "feat(enrichment): api.object + gated useObject hook"
```

---

### Task 7: Wire enrichment into SkyChart

**Files:**
- Modify: `client/src/components/hero/SkyChart.jsx`
- Test: covered by the SkyTooltip test in Task 8 (wiring is integration-light; no separate test here).

- [ ] **Step 1: Import the hook**

In `client/src/components/hero/SkyChart.jsx`, add after the `useConstellations` import (line 7):

```javascript
import { useObject } from "../../hooks/useObject.js";
```

- [ ] **Step 2: Derive the selected star's source_id and fetch**

After the `selectedObj` useMemo (around line 71), add:

```javascript
  const selectedStarSourceId =
    selectedObj?.kind === "star" ? selectedObj.source_id : null;
  const objectQuery = useObject(selectedStarSourceId, Boolean(selectedStarSourceId));
  const enrichment = objectQuery.data?.found ? objectQuery.data.enrichment : null;
```

- [ ] **Step 3: Pass enrichment + loading to the tooltip**

Change the `<SkyTooltip ... />` line (around line 157) to:

```javascript
      <SkyTooltip
        object={selectedObj}
        enrichment={enrichment}
        enrichmentLoading={objectQuery.isLoading && Boolean(selectedStarSourceId)}
        container={{ width, height }}
      />
```

- [ ] **Step 4: Verify the app still builds + existing tests pass**

Run: `cd client && npx vitest run src/__tests__/SkyChart.test.jsx`
Expected: PASS — existing SkyChart tests unaffected (the new props are optional and ignored by current assertions).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/hero/SkyChart.jsx
git commit -m "feat(enrichment): fetch + thread star enrichment in SkyChart"
```

---

### Task 8: Render enrichment in the tooltip

**Files:**
- Modify: `client/src/components/hero/SkyTooltip.jsx`
- Test: `client/src/__tests__/SkyTooltip.test.jsx`

- [ ] **Step 1: Write the failing tests**

The file `client/src/__tests__/SkyTooltip.test.jsx` already exists with these imports at the top — **reuse them, do not re-add**:
```javascript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SkyTooltip from "../components/hero/SkyTooltip.jsx";
const container = { width: 1200, height: 675 };
```

Append this new `describe` block to the **end** of the file (it reuses the existing `container` and imports; it only adds a local `baseStar`):

```javascript
const baseStar = {
  kind: "star",
  source_id: "2667000000000000000",
  magnitude: 0.03,
  bp_rp: 0.13,
  distance_ly: 25.0,
  alt: 60,
  az: 120,
  source: "Gaia DR3",
  x: 100,
  y: 100,
};

describe("SkyTooltip star enrichment", () => {
  it("shows the Gaia id header when no enrichment", () => {
    render(<SkyTooltip object={baseStar} container={container} />);
    expect(screen.getByText(/Gaia DR3/)).toBeInTheDocument();
  });

  it("shows the proper name and spectral type when enriched", () => {
    const enrichment = {
      source_id: baseStar.source_id,
      proper_name: "Vega",
      designation: "α Lyrae",
      catalog_ids: ["HD 172167"],
      spectral_type: "A0Va",
      planets: null,
      sources: ["SIMBAD/CDS"],
    };
    render(
      <SkyTooltip object={baseStar} enrichment={enrichment} container={container} />
    );
    expect(screen.getByText("VEGA")).toBeInTheDocument();
    expect(screen.getByText(/α Lyrae/)).toBeInTheDocument();
    expect(screen.getByText("A0Va")).toBeInTheDocument();
    expect(screen.getByText(/No known planets/)).toBeInTheDocument();
  });

  it("shows confirmed planet count for a host", () => {
    const enrichment = {
      source_id: baseStar.source_id,
      proper_name: "51 Pegasi",
      designation: "51 Peg",
      catalog_ids: ["HD 217014"],
      spectral_type: "G2IV",
      planets: { count: 1, names: ["51 Peg b"] },
      sources: ["SIMBAD/CDS", "NASA Exoplanet Archive"],
    };
    render(
      <SkyTooltip object={baseStar} enrichment={enrichment} container={container} />
    );
    expect(screen.getByText(/1 confirmed planet/)).toBeInTheDocument();
    expect(screen.getByText(/NASA Exoplanet Archive/)).toBeInTheDocument();
  });

  it("shows a loading shimmer while enrichment loads", () => {
    render(
      <SkyTooltip
        object={baseStar}
        enrichmentLoading={true}
        container={container}
      />
    );
    expect(screen.getByTestId("enrichment-loading")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/__tests__/SkyTooltip.test.jsx`
Expected: FAIL — `StarBody` ignores `enrichment`; "VEGA"/"A0Va"/shimmer not found.

- [ ] **Step 3: Rewrite `StarBody` and thread props**

In `client/src/components/hero/SkyTooltip.jsx`:

Replace the `StarBody` function (lines 35–56) with:

```javascript
function pluralPlanets(count) {
  return `${count} confirmed planet${count === 1 ? "" : "s"}`;
}

function StarBody({ object, enrichment, loading }) {
  const name = enrichment?.proper_name;
  const subtitle = [enrichment?.designation, enrichment?.catalog_ids?.[0]]
    .filter(Boolean)
    .join(" · ");
  const sourceLine = enrichment?.sources?.length
    ? enrichment.sources.join(" · ")
    : object.source;

  return (
    <>
      <div className="mb-2">
        {name ? (
          <>
            <p className="text-ink text-sm font-medium uppercase tracking-wide">{name}</p>
            {subtitle && (
              <p className="font-mono text-[11px] text-ink-dim mt-0.5">{subtitle}</p>
            )}
          </>
        ) : (
          <>
            <p className="text-ink-dim text-[11px] uppercase tracking-[0.18em]">Star</p>
            <p className="font-mono text-[11px] text-ink-dim mt-0.5 break-all">
              Gaia DR3 · {object.source_id}
            </p>
          </>
        )}
      </div>
      <div className="border-t border-rule/60 pt-2 pb-2">
        <Row label="Magnitude" value={formatNumber(object.magnitude, 2)} />
        {enrichment?.spectral_type && (
          <Row label="Spectral type" value={enrichment.spectral_type} />
        )}
        <Row label="Color index" value={formatNumber(object.bp_rp, 2)} />
        <Row label="Distance" value={formatLy(object.distance_ly)} />
        <Row label="Altitude" value={formatDeg(object.alt)} />
        <Row label="Azimuth" value={formatDeg(object.az)} />
      </div>

      {loading && (
        <div
          data-testid="enrichment-loading"
          className="border-t border-rule/60 pt-2 pb-2"
        >
          <div className="h-3 w-3/4 animate-pulse rounded bg-rule/40" />
        </div>
      )}

      {!loading && enrichment && (
        <div className="border-t border-rule/60 pt-2 pb-2">
          {enrichment.planets ? (
            <p className="text-[13px] text-ink">
              ✦ {pluralPlanets(enrichment.planets.count)}
            </p>
          ) : (
            <p className="text-[13px] text-ink-dim">✦ No known planets</p>
          )}
        </div>
      )}

      <div className="border-t border-rule/60 pt-2 font-mono text-[11px] text-accent-dim">
        Source: {sourceLine}
      </div>
    </>
  );
}
```

Then update the dispatch at the bottom (around line 157) to pass the new props:

```javascript
      {object.kind === "star" && (
        <StarBody object={object} enrichment={enrichment} loading={enrichmentLoading} />
      )}
```

And update the component signature (line 132):

```javascript
export default function SkyTooltip({ object, enrichment, enrichmentLoading, container }) {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/__tests__/SkyTooltip.test.jsx`
Expected: PASS (all star-enrichment cases green).

- [ ] **Step 5: Run the full frontend suite (no regressions)**

Run: `cd client && npx vitest run`
Expected: PASS — prior 185 tests + new ones green.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/hero/SkyTooltip.jsx client/src/__tests__/SkyTooltip.test.jsx
git commit -m "feat(enrichment): render name/spectral/exoplanets in star tooltip"
```

---

### Task 9: Attribution + docs

**Files:**
- Verify/modify: `client/src/components/hero/AttributionFooter.jsx`
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Verify the footer credits SIMBAD + NASA Exoplanet Archive**

Run: `grep -n "SIMBAD\|Exoplanet" client/src/components/hero/AttributionFooter.jsx`
Expected: both already present (added in earlier phases). If either is missing, add it to the footer credit string. Confirm by reading the file.

- [ ] **Step 2: Activate the README data-source rows**

In `README.md`, the SIMBAD and NASA Exoplanet Archive rows are marked "(Phase 3)". Update their descriptions to reflect they are now active for star click-to-lookup (remove the "(Phase 3)" deferral wording, keep institution + license columns).

- [ ] **Step 3: Update CLAUDE.md**

- In the API Contract section, replace the `GET /api/v1/objects/{id} (Phase 3+)` description with the shipped behavior: baked SIMBAD + NASA Exoplanet Archive lookup keyed by Gaia source_id, in-memory, returns `{found, enrichment}`.
- In the Tier 2 Enrichment table, the SIMBAD + Exoplanet Archive rows: note they are baked at ingest (not live on the request path).
- Add a guardrail (#22): "Star enrichment is fully baked at ingest (`ingest_star_enrichment.py` → `star_enrichment.json`). The request path makes ZERO external calls. Don't reintroduce live SIMBAD/NASA queries on `/objects/{id}`. Coverage is honest-partial — unresolved stars get no entry and the tooltip degrades to Gaia-only; never fake a name."
- Update the Phase Status: mark Phase 3b enrichment shipped (or in-branch), and update the Resume section.

- [ ] **Step 4: Run lint + full suites**

Run: `cd client && npm run lint && npx vitest run`
Run: `cd server && .venv\Scripts\python -m pytest -q`
Expected: lint clean; all frontend + backend tests green.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/hero/AttributionFooter.jsx README.md CLAUDE.md
git commit -m "docs(enrichment): activate SIMBAD/NASA attribution + guardrail #22"
```

---

## Final verification

- [ ] Backend: `cd server && .venv\Scripts\python -m pytest -q` — all green.
- [ ] Frontend: `cd client && npm run lint && npx vitest run` — lint clean, all green.
- [ ] Manual: start both servers, click a bright named star (e.g. Vega, Sirius) → tooltip shows real name + spectral type + "No known planets"; click 51 Peg / Pollux / Fomalhaut → shows confirmed planet count; click a faint anonymous star → graceful Gaia-only tooltip; planets/DSOs unaffected.
- [ ] Andrew's live visual QA + merge decision.
```
