# Phase 5: Public Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put SkyVault live: the FastAPI backend on Google Cloud Run, the React frontend on Cloudflare Pages, with CI, keyless auto-deploy on merge, and a hard cost ceiling.

**Architecture:** The browser loads static files from `skyvault.pages.dev` and calls the Cloud Run API directly (`VITE_API_BASE` + CORS). One container (`max-instances=1`) holds every catalog in memory and makes no network calls at runtime except the geocoder. GitHub Actions runs the tests on every PR. A merge to `main` builds the image, deploys it through Workload Identity Federation (no stored keys) and smoke-tests the live service.

**Tech Stack:** Python 3.14 / FastAPI / Astropy / uvicorn in `python:3.14-slim`; React 18 + Vite; GitHub Actions; Google Cloud Run, Artifact Registry, Cloud Billing budgets, Cloud Functions (gen2); Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-09-28-phase-5-deploy-design.md` (approved by Andrew 2026-10-01). Read it before starting. The amendments below override it where they conflict.

## Spec amendments (found while planning, 2026-10-01)

1. **IERS (spec §4.4) — the build-time download does nothing.** In astropy 7.2, `IERS_Auto.open()` with `conf.auto_download = False` reads only the *bundled* `astropy-iers-data` table and ignores the download cache (`astropy/utils/iers/iers.py:807-812`). Freshness therefore comes from the **`astropy-iers-data` package version**. The Dockerfile upgrades that one data-only package at build time, and the monthly scheduled rebuild (spec §7.3) picks up a fresh table. Runtime still sets `auto_download = False` and `auto_max_age = None`.
2. **Already done in the 2026-09-30 sweep:** OSM attribution (spec §6.5) is in the footer credits list. "Local" time is place-local. CORS is GET-only. Don't redo these.
3. **Memory:** warm RSS measured ~355 MiB locally, not the spec's ~240. Task 5 measures it inside the container. If the peak under the smoke test exceeds 420 MiB, **stop and ask Andrew** before using `--memory=1Gi`. Cloud Run's free tier covers either size at this traffic.
4. **Concurrency:** routes now run in a threadpool, so `--concurrency=10` caps simultaneous requests per instance. Without it, the default of 80 concurrent `/sky` computations could exceed the memory limit.
5. **First deploy is done by the setup script with Andrew's credentials,** including the one-time `allUsers` invoker binding. The CI deployer therefore keeps only `roles/run.developer`, which cannot change IAM policy. That is the least privilege the spec asked for.

## Global Constraints

- Cost: **$0/month normal**, **$5 spend cap** on Cloud Run with alerts at 50/90/100%, plus the kill-switch function as a second trigger.
- Cloud Run: `us-east1`, `--max-instances=1 --cpu=1 --memory=512Mi --concurrency=10`, request-based billing, scale to zero, one uvicorn worker.
- Frontend host: Cloudflare Pages, production origin `https://skyvault.pages.dev`, preview origins `https://<hash>.skyvault.pages.dev`.
- No new runtime dependencies. `server/requirements.txt` stays pinned exactly. The one exception is `astropy-iers-data`, which the Dockerfile upgrades on purpose (amendment 1).
- No secrets anywhere: keyless GitHub→GCP auth via Workload Identity Federation.
- API changes must be additive and backward-compatible: the frontend and backend deploy independently.
- Every data source stays credited (CLAUDE.md guardrails #11, #16, #21, #27, #28).
- Commit convention: `feat(scope): …`, `fix(scope): …`, `docs(scope): …`, `ci: …`. End every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Andrew decides when to push and merge.
- Windows tooling notes (this machine): run `npm`/`npx`/`git push`/`gh` from **PowerShell**, not bash. Backend Python is `server/.venv/Scripts/python.exe`. Source files are CRLF in the working tree.

## Review Focus

1. **Rate-limit key collapses to one IP behind Google's front end.** If `X-Forwarded-For`'s rightmost entry is a Google proxy, every visitor shares one 120/min bucket and the site 429s for everyone. Task 3 makes the position configurable; Task 15 verifies it on the live service before launch.
2. **Cold start after idle.** The first visitor after ~15 min waits for container start plus catalog load (~2 s locally). The UI must say "waking up" rather than look broken (Task 8). Lifespan preloading must not crash the boot (Task 1).
3. **Far-future and far-past dates in production with no network.** 2100-12-31 must return 200 on `/sky` (Task 1 test + smoke test). Planets outside DE421 stay a 422 (already tested).
4. **A preview deploy calling the API.** PR preview URLs (`https://abc123.skyvault.pages.dev`) must pass CORS, and look-alike origins (`https://skyvault.pages.dev.evil.example`) must not (Task 4).
5. **Backend paused by the spend cap.** The frontend must show the friendly "temporarily offline" card for 503s and network errors, never a raw error (Task 8).

---

## File Structure

| File | Responsibility |
|---|---|
| `server/app/services/iers_config.py` (new) | One function: put Astropy in offline Earth-orientation mode |
| `server/app/main.py` (modify) | Call IERS config at import; lifespan preloads catalogs; GZip; rate-limit middleware; CORS from settings |
| `server/app/services/rate_limit.py` (new) | Fixed-window per-key limiter + client-IP extraction |
| `server/app/config.py` (modify) | Env-driven deploy settings: CORS regex, rate limits, forwarded-for trust/index |
| `server/app/routers/sky.py` (modify) | Round serialized numbers |
| `server/app/services/geocoder.py` (modify) | Global 1 req/s Nominatim throttle |
| `server/Dockerfile`, `server/.dockerignore` (new) | Production image |
| `server/scripts/smoke_test_live.py` (new) | Post-deploy checks against any base URL |
| `.gitignore` (modify) | Track `gaia_dr3_g9.parquet` (spec D6) |
| `client/src/api/client.js` (modify) | `VITE_API_BASE`, health ping |
| `client/src/hooks/useDelayedFlag.js` (new) | "Has this been loading for >3 s?" |
| `client/src/components/hero/SkyStatusOverlay.jsx`, `controls/ControlsStrip.jsx` (modify) | Waking-up / 429 / offline messages |
| `client/src/stores/observerStore.js`, `controls/SubmitButton.jsx`, `controls/UseMyLocationButton.jsx` (modify) | GPS fixes |
| `client/src/components/layout/credits.js` (new) | Single source of the credits list (footer + /about) |
| `client/src/components/about/AboutPage.jsx` (new) | `/about`: full credits, acknowledgements, method notes |
| `client/src/App.jsx` (modify) | Path-based `/about` switch, wake-up ping |
| `client/public/_redirects` (new) | SPA fallback on Cloudflare Pages |
| `scripts/reencode_milky_way.py` (new) | Reproducible panorama re-encode |
| `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` (new) | CI and backend deploy |
| `deploy/gcp_setup.sh`, `deploy/cloudrun.env.yaml`, `deploy/ar-cleanup-policy.json`, `deploy/kill_switch/*` (new) | One-time GCP setup, runtime env, kill switch |

---

### Task 1: Offline IERS config + startup preload

**Files:**
- Create: `server/app/services/iers_config.py`
- Modify: `server/app/main.py`
- Test: `server/tests/test_iers_offline.py`
- Modify: `docs/superpowers/specs/2026-09-28-phase-5-deploy-design.md` (status line + §4.4 note pointing at amendment 1)

**Interfaces:**
- Produces: `configure_offline_iers() -> None` (idempotent). `app.main` calls it at import time, before any transform can run.

- [ ] **Step 1: Write the failing tests**

```python
# server/tests/test_iers_offline.py
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
```

- [ ] **Step 2: Run and confirm the first and third fail**

Run: `cd server && .venv/Scripts/python.exe -m pytest tests/test_iers_offline.py -v`
Expected: `test_app_puts_astropy_in_offline_iers_mode` FAILS (`auto_download` is True) and `test_startup_preloads_catalogs` FAILS. `test_far_future_sky_works_without_network` may already pass on a dev machine because of the local download cache. That is why the first test pins the configuration itself.

- [ ] **Step 3: Implement**

```python
# server/app/services/iers_config.py
"""Earth-orientation (IERS) data for an offline server.

Astropy normally downloads fresh IERS-A tables on demand. In production there
is no network, and with downloads simply disabled every date past the bundled
table's 30-day prediction window raises. So:

* ``auto_download = False``: never reach for the network. In astropy 7.2 this
  makes IERS_Auto use the bundled ``astropy-iers-data`` table (the download
  cache is ignored), which the Docker build refreshes and the monthly rebuild
  keeps current.
* ``auto_max_age = None``: accept predictions of any age. Verified 2026-09-28:
  1900, today, 2035 and 2100 all transform, worst difference vs. fresh data ~2"
  even with six-month-old tables.
"""

from __future__ import annotations

from astropy.utils import iers


def configure_offline_iers() -> None:
    iers.conf.auto_download = False
    iers.conf.auto_max_age = None
```

In `server/app/main.py`, replace the imports and lifespan block (lines 1-17) with:

```python
"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.services.iers_config import configure_offline_iers

# Before anything can run a coordinate transform.
configure_offline_iers()

from app.routers import constellations, dso, geocode, objects, planets, sky  # noqa: E402
from app.services import (  # noqa: E402
    constellation_catalog,
    dso_catalog,
    ephemeris,
    geocoder,
    star_catalog,
    star_enrichment,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Load every catalog once at boot so the first visitor after a cold start
    # doesn't also pay the parquet/JSON parse. A missing file fails the boot,
    # which makes Cloud Run keep the previous healthy revision.
    star_catalog.get_catalog()
    dso_catalog.load_catalog()
    constellation_catalog.load_catalog()
    star_enrichment.load_catalog()
    ephemeris._resolve_kernel()
    yield
    # Release the geocoder's pooled HTTP connections on shutdown.
    await geocoder.close_client()
```

- [ ] **Step 4: Run the tests, then the full suite**

Run: `.venv/Scripts/python.exe -m pytest tests/test_iers_offline.py -v` → 3 PASS
Run: `.venv/Scripts/python.exe -m pytest -q` → all PASS (≈220)

- [ ] **Step 5: Update the spec status, then commit**

In the spec, change the `**Status:**` line to `**Status:** Approved 2026-10-01. Implementation plan: docs/superpowers/plans/2026-10-01-phase-5-launch.md (see its "Spec amendments")`. Append to §4.4: `> Amended 2026-10-01: with auto_download off, Astropy reads only the bundled astropy-iers-data table, so freshness comes from that package's version. See the plan's amendment 1.`

```bash
git add server/app/services/iers_config.py server/app/main.py server/tests/test_iers_offline.py docs/superpowers/specs/2026-09-28-phase-5-deploy-design.md
git commit -m "feat(server): offline IERS mode and catalog preload at startup"
```

---

### Task 2: Response size — gzip + rounded coordinates

**Files:**
- Modify: `server/app/main.py`, `server/app/routers/sky.py`
- Test: `server/tests/test_api_sky.py` (append)

**Interfaces:**
- Produces: `/sky` numbers rounded as `ra/dec/alt/az` → 5 decimals, `magnitude/bp_rp` → 3, `parallax_mas` → 3, `distance_ly` → 2, `teff_k` → 0. Responses over 1 KB are gzip-encoded when the client accepts it.

- [ ] **Step 1: Write the failing tests** (append to `server/tests/test_api_sky.py`)

```python
def _decimals(x: float) -> int:
    s = repr(float(x))
    return len(s.split(".")[1]) if "." in s and "e" not in s else 0


def test_sky_numbers_are_rounded_for_transport():
    # 0.00001 deg = 0.04": far below the pipeline's real error budget (no
    # refraction alone is ~0.5 deg). Cuts the payload with no visible change.
    body = client.get("/api/v1/sky", params={**MIAMI, "mag_limit": 6.5}).json()
    for star in body["stars"][:200]:
        for key in ("ra", "dec", "alt", "az"):
            assert _decimals(star[key]) <= 5, (key, star[key])
        assert _decimals(star["magnitude"]) <= 3
        if star["distance_ly"] is not None:
            assert _decimals(star["distance_ly"]) <= 2


def test_sky_response_is_gzipped():
    response = client.get(
        "/api/v1/sky", params={**MIAMI, "mag_limit": 6.5}, headers={"Accept-Encoding": "gzip"}
    )
    assert response.headers.get("content-encoding") == "gzip"
```

- [ ] **Step 2: Run to confirm both fail**

Run: `.venv/Scripts/python.exe -m pytest tests/test_api_sky.py -k "rounded or gzipped" -v` → 2 FAIL

- [ ] **Step 3: Implement**

In `server/app/main.py`, add the import `from fastapi.middleware.gzip import GZipMiddleware` and, directly after `app = FastAPI(...)`:

```python
# /sky is ~2 MB of JSON raw, ~0.6 MB gzipped: egress is the main running cost.
app.add_middleware(GZipMiddleware, minimum_size=1000)
```

In `server/app/routers/sky.py`, add below `_safe_str`:

```python
def _round(value: float | None, digits: int) -> float | None:
    return None if value is None else round(value, digits)
```

and change the `Star(...)` construction to:

```python
        Star(
            # Gaia ids arrive as int64 or str, Hipparcos ids as "hip:<n>".
            source_id=str(rec["source_id"]),
            # Rounded for transport: 1e-5 deg = 0.04", far below the pipeline's
            # error budget (no refraction alone is ~0.5 deg).
            ra=round(float(rec["ra"]), 5),
            dec=round(float(rec["dec"]), 5),
            alt=round(float(rec["alt"]), 5),
            az=round(float(rec["az"]), 5),
            magnitude=round(float(rec["phot_g_mean_mag"]), 3),
            bp_rp=_round(_safe(rec.get("bp_rp")), 3),
            parallax_mas=_round(_safe(rec.get("parallax")), 3),
            distance_ly=_round(_safe(distance_ly[i]), 2),
            teff_k=_round(_safe(rec.get("teff_gspphot")), 0),
            source=_safe_str(rec.get("source")) or "Gaia DR3",
            magnitude_source=_safe_str(rec.get("magnitude_source")),
            color_source=_safe_str(rec.get("color_source")),
        )
```

- [ ] **Step 4: Run tests and measure**

Run: `.venv/Scripts/python.exe -m pytest -q` → all PASS.
Measure and note for Task 15: `PYTHONPATH=. .venv/Scripts/python.exe -c "from fastapi.testclient import TestClient; from app.main import app; r=TestClient(app).get('/api/v1/sky',params=dict(lat=25.76,lon=-80.19,datetime='2026-01-15T02:00:00Z'),headers={'Accept-Encoding':'identity'}); print(len(r.content))"` (raw bytes; was 1,995 KB). The gzipped size is visible in the browser devtools Network tab.

- [ ] **Step 5: Commit**

```bash
git add server/app/main.py server/app/routers/sky.py server/tests/test_api_sky.py
git commit -m "feat(server): gzip responses and round /sky numbers for transport"
```

---

### Task 3: Per-IP rate limiting + Nominatim throttle

**Files:**
- Create: `server/app/services/rate_limit.py`
- Modify: `server/app/config.py`, `server/app/main.py`, `server/app/services/geocoder.py`
- Test: `server/tests/test_rate_limit.py` (new); `server/tests/test_geocoder.py` and `server/tests/test_geocoder_acceptance.py` (add a reset fixture)

**Interfaces:**
- Produces: `FixedWindowLimiter(limit: int, window_s: float = 60.0, max_keys: int = 10_000, clock=time.monotonic)` with `.hit(key: str) -> float | None` (None = allowed, else seconds until retry). `client_ip(headers: Mapping[str, str], peer: str | None, *, trust_forwarded_for: bool, forwarded_for_index: int) -> str`.
- Settings (env-overridable): `rate_limit_data_per_min: int = 120`, `rate_limit_geocode_per_min: int = 20`, `trust_forwarded_for: bool = False`, `forwarded_for_index: int = -1`, `log_forwarded_for: bool = False`.

- [ ] **Step 1: Write the failing tests**

```python
# server/tests/test_rate_limit.py
"""Per-IP limits (spec §4.2). One process (max-instances=1) => one table."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app, data_limiter, geocode_limiter
from app.services.rate_limit import FixedWindowLimiter, client_ip


class FakeClock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


def test_limiter_allows_up_to_the_limit_then_reports_retry_after():
    clock = FakeClock()
    lim = FixedWindowLimiter(limit=3, window_s=60, clock=clock)
    assert [lim.hit("a") for _ in range(3)] == [None, None, None]
    retry = lim.hit("a")
    assert retry is not None and 0 < retry <= 60
    assert lim.hit("b") is None  # other keys unaffected


def test_limiter_window_resets():
    clock = FakeClock()
    lim = FixedWindowLimiter(limit=1, window_s=60, clock=clock)
    assert lim.hit("a") is None
    assert lim.hit("a") is not None
    clock.t += 61
    assert lim.hit("a") is None


def test_limiter_table_is_bounded():
    clock = FakeClock()
    lim = FixedWindowLimiter(limit=5, window_s=60, max_keys=100, clock=clock)
    for i in range(1000):
        lim.hit(f"ip{i}")
    assert len(lim._windows) <= 100


def test_client_ip_ignores_forwarded_for_unless_trusted():
    headers = {"x-forwarded-for": "6.6.6.6, 1.2.3.4"}
    assert client_ip(headers, "9.9.9.9", trust_forwarded_for=False, forwarded_for_index=-1) == "9.9.9.9"


def test_client_ip_takes_the_configured_entry_from_the_right():
    # Clients can prepend anything; only entries appended by Google's front
    # end are trustworthy, so we count from the right.
    headers = {"x-forwarded-for": "6.6.6.6, 1.2.3.4, 35.191.0.1"}
    kw = {"trust_forwarded_for": True}
    assert client_ip(headers, "9.9.9.9", forwarded_for_index=-1, **kw) == "35.191.0.1"
    assert client_ip(headers, "9.9.9.9", forwarded_for_index=-2, **kw) == "1.2.3.4"
    assert client_ip({}, "9.9.9.9", forwarded_for_index=-1, **kw) == "9.9.9.9"


def test_data_routes_return_429_with_retry_after(monkeypatch):
    monkeypatch.setattr(data_limiter, "limit", 2)
    data_limiter._windows.clear()
    c = TestClient(app)
    for _ in range(2):
        assert c.get("/api/v1/objects/hip:32349").status_code == 200
    r = c.get("/api/v1/objects/hip:32349")
    assert r.status_code == 429
    assert int(r.headers["retry-after"]) >= 1
    assert "give it a minute" in r.json()["detail"]
    data_limiter._windows.clear()


def test_429_still_carries_cors_headers(monkeypatch):
    # If the limiter sat outside CORS, the browser would see an opaque network
    # error instead of a readable 429 and could never show "give it a minute".
    monkeypatch.setattr(data_limiter, "limit", 0)
    data_limiter._windows.clear()
    origin = settings.cors_origins[0]
    r = TestClient(app).get("/api/v1/objects/hip:32349", headers={"Origin": origin})
    assert r.status_code == 429
    assert r.headers.get("access-control-allow-origin") == origin
    data_limiter._windows.clear()


def test_health_is_never_limited(monkeypatch):
    monkeypatch.setattr(data_limiter, "limit", 0)
    c = TestClient(app)
    assert c.get("/health").status_code == 200
    data_limiter._windows.clear()


def test_geocode_has_its_own_tighter_bucket(monkeypatch):
    monkeypatch.setattr(geocode_limiter, "limit", 0)
    geocode_limiter._windows.clear()
    r = TestClient(app).get("/api/v1/geocode", params={"q": "Paris"})
    assert r.status_code == 429
    geocode_limiter._windows.clear()


def test_default_limits_match_the_spec():
    assert settings.rate_limit_data_per_min == 120
    assert settings.rate_limit_geocode_per_min == 20
```

Append to `server/tests/test_geocoder.py`:

```python
@pytest.fixture(autouse=True)
def reset_nominatim_throttle():
    geocoder._last_nominatim_call = float("-inf")
    yield
    geocoder._last_nominatim_call = float("-inf")


@pytest.mark.asyncio
async def test_nominatim_fallback_is_throttled_to_one_per_second():
    # Nominatim's usage policy is ~1 req/s; abuse through us would get OUR
    # server banned. A second fallback inside the second fails fast instead.
    photon_down = httpx.Response(503)
    nominatim_ok = httpx.Response(200, json=SAMPLE_NOMINATIM_RESPONSE)
    mock_get = AsyncMock(side_effect=[photon_down, nominatim_ok, photon_down])
    with patch.object(httpx.AsyncClient, "get", mock_get):
        await geocoder.geocode("Charlotte", limit=5, lang="en")
        with pytest.raises(geocoder.GeocoderUnavailableError):
            await geocoder.geocode("Raleigh", limit=5, lang="en")
    assert mock_get.call_count == 3  # the throttled call never reached Nominatim
```

Add the same `reset_nominatim_throttle` fixture (fixture only, not the test) to `server/tests/test_geocoder_acceptance.py`.

- [ ] **Step 2: Run to confirm failure**

Run: `.venv/Scripts/python.exe -m pytest tests/test_rate_limit.py tests/test_geocoder.py -v`
Expected: ImportError for `rate_limit` / `data_limiter`, and the throttle test fails.

- [ ] **Step 3: Implement**

```python
# server/app/services/rate_limit.py
"""In-memory per-key rate limiting.

Valid only because production runs one process (Cloud Run max-instances=1,
one uvicorn worker): one table sees every request. Fixed windows are coarse
but cheap; rejecting an abuser costs a dict lookup.
"""

from __future__ import annotations

import time
from collections.abc import Callable, Mapping


class FixedWindowLimiter:
    def __init__(
        self,
        limit: int,
        window_s: float = 60.0,
        max_keys: int = 10_000,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.limit = limit
        self.window_s = window_s
        self.max_keys = max_keys
        self._clock = clock
        self._windows: dict[str, tuple[float, int]] = {}

    def hit(self, key: str) -> float | None:
        """Count one request. None if allowed, else seconds until the window resets."""
        now = self._clock()
        start, count = self._windows.get(key, (now, 0))
        if now - start >= self.window_s:
            start, count = now, 0
        if count >= self.limit:
            return max(1.0, self.window_s - (now - start))
        self._windows[key] = (start, count + 1)
        if len(self._windows) > self.max_keys:
            self._prune(now)
        return None

    def _prune(self, now: float) -> None:
        live = {k: v for k, v in self._windows.items() if now - v[0] < self.window_s}
        if len(live) > self.max_keys:  # a flood of distinct keys: keep the newest half
            newest = sorted(live.items(), key=lambda kv: kv[1][0])[-(self.max_keys // 2):]
            live = dict(newest)
        self._windows = live


def client_ip(
    headers: Mapping[str, str],
    peer: str | None,
    *,
    trust_forwarded_for: bool,
    forwarded_for_index: int,
) -> str:
    """The caller's IP. Behind Cloud Run the TCP peer is Google's front end,
    so the real client comes from X-Forwarded-For, counted from the RIGHT
    (entries on the left are whatever the client chose to send)."""
    if trust_forwarded_for:
        raw = headers.get("x-forwarded-for", "")
        parts = [p.strip() for p in raw.split(",") if p.strip()]
        if parts:
            try:
                return parts[forwarded_for_index]
            except IndexError:
                return parts[0]
    return peer or "unknown"
```

In `server/app/config.py`, add inside `Settings` after `cors_origins`:

```python
    # Preview deploys: https://<hash>.skyvault.pages.dev (Task 4)
    cors_origin_regex: str | None = None

    # Rate limits (spec §4.2), per client IP per minute
    rate_limit_data_per_min: int = 120
    rate_limit_geocode_per_min: int = 20

    # Behind Cloud Run the TCP peer is Google's front end; the client IP is in
    # X-Forwarded-For. Off locally. forwarded_for_index counts from the right
    # (-1 = rightmost) and is verified against the live service (plan Task 15).
    trust_forwarded_for: bool = False
    forwarded_for_index: int = -1
    log_forwarded_for: bool = False
```

In `server/app/main.py`, add imports `import logging`, `import math`, `from fastapi import Request` (extend the existing fastapi import), `from fastapi.responses import JSONResponse`, `from app.services.rate_limit import FixedWindowLimiter, client_ip`. After the GZip middleware add:

```python
logger = logging.getLogger("skyvault")

data_limiter = FixedWindowLimiter(settings.rate_limit_data_per_min)
geocode_limiter = FixedWindowLimiter(settings.rate_limit_geocode_per_min)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    path = request.url.path
    if not path.startswith(settings.api_v1_prefix):
        return await call_next(request)  # /health and docs are never limited
    if settings.log_forwarded_for:
        logger.warning("x-forwarded-for=%r peer=%r", request.headers.get("x-forwarded-for"), request.client)
    ip = client_ip(
        request.headers,
        request.client.host if request.client else None,
        trust_forwarded_for=settings.trust_forwarded_for,
        forwarded_for_index=settings.forwarded_for_index,
    )
    limiter = geocode_limiter if path.startswith(f"{settings.api_v1_prefix}/geocode") else data_limiter
    retry_after = limiter.hit(ip)
    if retry_after is not None:
        return JSONResponse(
            {"detail": "Too many requests — give it a minute."},
            status_code=429,
            headers={"Retry-After": str(math.ceil(retry_after))},
        )
    return await call_next(request)
```

Middleware order matters. Starlette makes the **last-added** middleware the outermost, so define this `@app.middleware("http")` function **before** the `app.add_middleware(CORSMiddleware, ...)` call. CORS then wraps the limiter, and a 429 still carries `Access-Control-Allow-Origin`. Without it the browser hides the 429 as an opaque network error. `test_429_still_carries_cors_headers` pins this.

In `server/app/services/geocoder.py`, add after `CACHE_EVICT_BATCH = 32`:

```python
# Nominatim's usage policy: at most ~1 request/second. Abuse routed through
# our fallback would get OUR server banned, so excess fallbacks fail fast.
NOMINATIM_MIN_INTERVAL_S = 1.0
_last_nominatim_call: float = float("-inf")
```

and at the start of `_call_nominatim`, before building `params`:

```python
    global _last_nominatim_call
    now = time.monotonic()
    if now - _last_nominatim_call < NOMINATIM_MIN_INTERVAL_S:
        raise GeocoderUnavailableError("Nominatim fallback throttled (1 req/s usage policy)")
    _last_nominatim_call = now
```

- [ ] **Step 4: Run tests**

Run: `.venv/Scripts/python.exe -m pytest -q` → all PASS. Then `-m network` → PASS (the acceptance fixture resets the throttle).

- [ ] **Step 5: Commit**

```bash
git add server/app/services/rate_limit.py server/app/config.py server/app/main.py server/app/services/geocoder.py server/tests/test_rate_limit.py server/tests/test_geocoder.py server/tests/test_geocoder_acceptance.py
git commit -m "feat(server): per-IP rate limits and a 1 req/s Nominatim throttle"
```

---

### Task 4: CORS from settings (production + preview origins)

**Files:**
- Modify: `server/app/main.py`, `server/.env.example`
- Create: `deploy/cloudrun.env.yaml`
- Test: `server/tests/test_cors.py`

**Interfaces:**
- Consumes: `settings.cors_origins`, `settings.cors_origin_regex` (Task 3).
- Produces: `deploy/cloudrun.env.yaml`, read by `gcloud run deploy --env-vars-file` (Task 13).

- [ ] **Step 1: Write the failing test**

```python
# server/tests/test_cors.py
from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient

PROD = "https://skyvault.pages.dev"
REGEX = r"https://[a-z0-9-]+\.skyvault\.pages\.dev"


@pytest.fixture
def prod_app(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", f'["{PROD}"]')
    monkeypatch.setenv("CORS_ORIGIN_REGEX", REGEX)
    import app.config
    import app.main

    importlib.reload(app.config)
    importlib.reload(app.main)
    yield app.main.app
    monkeypatch.delenv("CORS_ORIGINS")
    monkeypatch.delenv("CORS_ORIGIN_REGEX")
    importlib.reload(app.config)
    importlib.reload(app.main)


@pytest.mark.parametrize(
    ("origin", "allowed"),
    [
        (PROD, True),
        ("https://4f2a9c1e.skyvault.pages.dev", True),  # PR preview deploy
        ("https://evil.example", False),
        ("https://skyvault.pages.dev.evil.example", False),  # look-alike
        ("http://skyvault.pages.dev", False),  # not https
    ],
)
def test_cors_allows_only_our_pages_origins(prod_app, origin, allowed):
    r = TestClient(prod_app).get("/health", headers={"Origin": origin})
    assert (r.headers.get("access-control-allow-origin") == origin) is allowed
```

- [ ] **Step 2: Run to confirm failure**

Run: `.venv/Scripts/python.exe -m pytest tests/test_cors.py -v` → the preview-origin case FAILS (no regex support yet).

- [ ] **Step 3: Implement**

In `server/app/main.py`, change the CORS block to:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # Cloudflare Pages preview deploys. Starlette full-matches this regex, so
    # look-alikes such as skyvault.pages.dev.evil.example are rejected.
    allow_origin_regex=settings.cors_origin_regex,
    # Read-only public API: no cookies or auth headers cross origins.
    allow_methods=["GET"],
    allow_headers=["*"],
)
```

Create `deploy/cloudrun.env.yaml`:

```yaml
# Runtime env for the skyvault-api Cloud Run service (gcloud --env-vars-file).
# If the Pages project name isn't "skyvault", update both origins.
CORS_ORIGINS: '["https://skyvault.pages.dev"]'
CORS_ORIGIN_REGEX: 'https://[a-z0-9-]+\.skyvault\.pages\.dev'
TRUST_FORWARDED_FOR: "true"
FORWARDED_FOR_INDEX: "-1"
LOG_FORWARDED_FOR: "false"
```

Append to `server/.env.example`:

```
# Production values live in deploy/cloudrun.env.yaml
# CORS_ORIGIN_REGEX=https://[a-z0-9-]+\.skyvault\.pages\.dev
# RATE_LIMIT_DATA_PER_MIN=120
# RATE_LIMIT_GEOCODE_PER_MIN=20
# TRUST_FORWARDED_FOR=false
# FORWARDED_FOR_INDEX=-1
```

- [ ] **Step 4: Run tests** → `tests/test_cors.py` 5 PASS; full suite PASS (the fixture reloads modules back, so later tests see default settings).

- [ ] **Step 5: Commit**

```bash
git add server/app/main.py server/.env.example server/tests/test_cors.py deploy/cloudrun.env.yaml
git commit -m "feat(server): CORS origins from settings, incl. Pages preview deploys"
```

---

### Task 5: Production container (+ track the Gaia parquet)

**Files:**
- Create: `server/Dockerfile`, `server/.dockerignore`
- Modify: `.gitignore` (track `server/data/gaia_dr3_g9.parquet`, spec D6)

**Interfaces:**
- Produces: an image serving on `$PORT` (Cloud Run sets 8080) with every catalog, DE421 and a fresh IERS table baked in.

- [ ] **Step 1: Track the Gaia parquet.** In `.gitignore`, under `server/data/gaia_dr3_*.parquet`, add `!server/data/gaia_dr3_g9.parquet` and change the comment above to `# Gaia DR3 subsets: only the verified G<9 file is tracked (Phase 5 spec D6)`. Then `git add server/data/gaia_dr3_g9.parquet` (18.1 MB, under GitHub's 50 MB warning). This is the exact file the bright-star dedupe was verified against. Never regenerate it casually.

- [ ] **Step 2: Write the Dockerfile**

```dockerfile
# server/Dockerfile — SkyVault API (Cloud Run). Build from server/:
#   docker build -t skyvault-api .
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/app \
    PORT=8080

WORKDIR /app

COPY requirements.txt .
# astropy-iers-data is upgraded on purpose: it carries the Earth-orientation
# predictions, and the monthly rebuild must pick up a fresh table (plan
# amendment 1). Everything else installs at its pinned version.
RUN pip install --no-cache-dir -r requirements.txt \
 && pip install --no-cache-dir --upgrade astropy-iers-data

COPY app ./app
COPY data ./data
COPY scripts/__init__.py scripts/download_ephemeris.py ./scripts/

# JPL DE421 from NASA NAIF (public domain), fetched at build time.
RUN python scripts/download_ephemeris.py

RUN useradd --create-home --home-dir /home/skyvault --uid 10001 skyvault \
 && chown -R skyvault /app
USER skyvault

# One worker: one copy of the catalogs in memory, one rate-limit table.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers 1
```

```
# server/.dockerignore
.venv
.pytest_cache
**/__pycache__
tests
data/sources
data/de421.bsp
scripts/*
!scripts/__init__.py
!scripts/download_ephemeris.py
.env
```

- [ ] **Step 3: Build and run locally** (PowerShell, from `server/`)

```powershell
docker build -t skyvault-api .
docker run --rm -d --name skyvault-api -p 8080:8080 skyvault-api
Start-Sleep 10; curl.exe -s http://localhost:8080/health
```

Expected: `{"status":"ok",...}`. If the build fails on a wheel for Python 3.14 (spec open item), note which package and stop to report. Don't silently drop to 3.13, because the spec pins the same minor version as local and CI.

- [ ] **Step 4: Measure** (record the numbers in the commit message; they feed Task 15)

```powershell
docker images skyvault-api --format "{{.Size}}"
docker stats skyvault-api --no-stream --format "{{.MemUsage}}"   # after boot
# then after Task 6's smoke test runs against it:
docker stats skyvault-api --no-stream --format "{{.MemUsage}}"
```

If the post-smoke memory exceeds **420 MiB**, stop and ask Andrew about `--memory=1Gi` (amendment 3).

- [ ] **Step 5: Commit**

```bash
git add .gitignore server/Dockerfile server/.dockerignore server/data/gaia_dr3_g9.parquet
git commit -m "feat(deploy): production Dockerfile; track the verified Gaia parquet"
```

---

### Task 6: Live smoke test script

**Files:**
- Create: `server/scripts/smoke_test_live.py`
- Test: run it against the local container from Task 5.

**Interfaces:**
- Produces: `python server/scripts/smoke_test_live.py <base_url> [--origin https://skyvault.pages.dev]`. Exit 0 on pass, 1 on any failure. Uses only `httpx`, so CI can run it without the app's dependencies.

- [ ] **Step 1: Write the script** (it is the test)

```python
"""Post-deploy smoke test (spec §8.1). Usage:

    python scripts/smoke_test_live.py https://skyvault-api-xxxx.run.app \
        --origin https://skyvault.pages.dev
"""

from __future__ import annotations

import argparse
import sys

import httpx

MIAMI = {"lat": 25.76, "lon": -80.19}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("base_url")
    ap.add_argument("--origin", default=None, help="allowed frontend origin to check CORS for")
    args = ap.parse_args()
    base = args.base_url.rstrip("/")
    failures: list[str] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        print(f"{'PASS' if ok else 'FAIL'}  {name}{('  -- ' + detail) if detail and not ok else ''}")
        if not ok:
            failures.append(name)

    with httpx.Client(timeout=60, headers={"Accept-Encoding": "gzip"}) as c:
        r = c.get(f"{base}/health")
        check("health 200", r.status_code == 200, r.text[:200])

        r = c.get(f"{base}/api/v1/sky", params={**MIAMI, "datetime": "2026-01-15T02:00:00Z"})
        check("sky 200", r.status_code == 200, r.text[:200])
        check("sky gzip", r.headers.get("content-encoding") == "gzip", str(r.headers))
        if r.status_code == 200:
            body = r.json()
            sirius = next((s for s in body["stars"] if s["source_id"] == "hip:32349"), None)
            check("Sirius served from ESA Hipparcos", bool(sirius) and sirius["source"] == "ESA Hipparcos")
            check("sky count in range", 2000 <= body["count"] <= 8000, str(body["count"]))

        r = c.get(f"{base}/api/v1/objects/hip:32349")
        check("Sirius enrichment", r.status_code == 200 and r.json()["enrichment"]["proper_name"] == "Sirius", r.text[:200])

        r = c.get(f"{base}/api/v1/sky", params={**MIAMI, "datetime": "2100-12-31T02:00:00Z"})
        check("far-future sky works offline (IERS config)", r.status_code == 200, r.text[:200])

        r = c.get(f"{base}/api/v1/planets", params={**MIAMI, "datetime": "2060-01-01T00:00:00Z"})
        check("out-of-DE421 planets is 422", r.status_code == 422, r.text[:200])

        if args.origin:
            r = c.get(f"{base}/health", headers={"Origin": args.origin})
            check("CORS allows the frontend", r.headers.get("access-control-allow-origin") == args.origin)
            r = c.get(f"{base}/health", headers={"Origin": "https://evil.example"})
            check("CORS refuses other origins", "access-control-allow-origin" not in r.headers)

    print(f"\n{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run against the local container**

Run: `server/.venv/Scripts/python.exe server/scripts/smoke_test_live.py http://localhost:8080`
Expected: every line PASS (CORS lines skipped without `--origin`). Then run `docker stats` (Task 5 Step 4) and `docker stop skyvault-api`.

- [ ] **Step 3: Prove it can fail.** Run it against `http://localhost:1`, where nothing is listening, and confirm a non-zero exit code. A smoke test that can't fail proves nothing.

- [ ] **Step 4: Commit**

```bash
git add server/scripts/smoke_test_live.py
git commit -m "feat(deploy): post-deploy smoke test script"
```

---

### Task 7: Frontend API base URL + wake-up ping

**Files:**
- Modify: `client/src/api/client.js`, `client/src/App.jsx`, `client/vite.config.js`
- Test: `client/src/__tests__/apiClient.test.js` (append)

**Interfaces:**
- Produces: `api.health(): Promise<void>` (never throws). `API_BASE` = `import.meta.env.VITE_API_BASE ?? "/api/v1"`. The health URL is `API_BASE` with the trailing `/api/v1` replaced by `/health`.

- [ ] **Step 1: Write the failing tests** (append to `apiClient.test.js`, which already imports `afterEach`/`vi` and defines `stubFetch`)

```js
describe("API base URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("calls an absolute API origin when VITE_API_BASE is set (production)", async () => {
    vi.stubEnv("VITE_API_BASE", "https://skyvault-api-abc.a.run.app/api/v1");
    vi.resetModules();
    const { api: prodApi } = await import("../api/client.js");
    const fetchMock = stubFetch();
    await prodApi.dso(1, 2, "2026-01-15T02:00:00.000Z");
    expect(fetchMock.mock.calls[0][0]).toMatch(/^https:\/\/skyvault-api-abc\.a\.run\.app\/api\/v1\/dso\?/);
  });

  it("health pings the API origin's /health and swallows failures", async () => {
    vi.stubEnv("VITE_API_BASE", "https://skyvault-api-abc.a.run.app/api/v1");
    vi.resetModules();
    const { api: prodApi } = await import("../api/client.js");
    const fetchMock = vi.fn(async () => {
      throw new TypeError("offline");
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(prodApi.health()).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe("https://skyvault-api-abc.a.run.app/health");
  });
});
```

- [ ] **Step 2: Run to confirm failure** → `npx vitest run src/__tests__/apiClient.test.js`: both new tests FAIL.

- [ ] **Step 3: Implement.** In `client/src/api/client.js`, replace `const API_BASE = "/api/v1";` with:

```js
// Production: the Cloud Run URL (set at build time on Cloudflare Pages).
// Dev: relative, proxied to localhost:8000 by Vite.
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";
const HEALTH_URL = API_BASE.replace(/\/api\/v1\/?$/, "") + "/health";
```

and add to the `api` object:

```js
  // Fire-and-forget on page load: wakes a scaled-to-zero backend while the
  // visitor is still typing a place name. Never throws.
  health: async () => {
    try {
      await fetch(new URL(HEALTH_URL, window.location.origin).toString());
    } catch {
      // the real requests will surface any problem
    }
  },
```

In `client/src/App.jsx`, add `import { useEffect } from "react";` and `import { api } from "./api/client.js";`. As the first lines of `App()`:

```js
  useEffect(() => {
    api.health();
  }, []);
```

In `client/vite.config.js`, add next to the `/api` proxy entry: `"/health": { target: "http://localhost:8000", changeOrigin: true },`.

- [ ] **Step 4: Run** `npx vitest run` → all PASS; `npm run lint` clean.

- [ ] **Step 5: Commit**

```bash
git add client/src/api/client.js client/src/App.jsx client/vite.config.js client/src/__tests__/apiClient.test.js
git commit -m "feat(client): VITE_API_BASE for production and a wake-up ping"
```

---

### Task 8: Waking-up, rate-limited and offline states

**Files:**
- Create: `client/src/hooks/useDelayedFlag.js`
- Modify: `client/src/components/hero/SkyStatusOverlay.jsx`, `client/src/components/hero/SkyChart.jsx`, `client/src/components/controls/ControlsStrip.jsx`
- Test: `client/src/__tests__/SkyStatusOverlay.test.jsx` (new), `client/src/__tests__/useDelayedFlag.test.js` (new)

**Interfaces:**
- Produces: `useDelayedFlag(active: boolean, delayMs: number): boolean`, true once `active` has stayed true for `delayMs`. `<SkyStatusOverlay slow={bool} …/>`.

- [ ] **Step 1: Write the failing tests**

```js
// client/src/__tests__/useDelayedFlag.test.js
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDelayedFlag } from "../hooks/useDelayedFlag.js";

afterEach(() => vi.useRealTimers());

describe("useDelayedFlag", () => {
  it("turns on only after the delay and resets when inactive", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ on }) => useDelayedFlag(on, 3000), {
      initialProps: { on: true },
    });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(3100));
    expect(result.current).toBe(true);
    rerender({ on: false });
    expect(result.current).toBe(false);
  });
});
```

```jsx
// client/src/__tests__/SkyStatusOverlay.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SkyStatusOverlay from "../components/hero/SkyStatusOverlay.jsx";

describe("<SkyStatusOverlay> launch states", () => {
  it("explains a cold start once loading is slow", () => {
    render(<SkyStatusOverlay state="loading" placeName="Tokyo" slow />);
    expect(screen.getByText(/waking up the observatory/i)).toBeInTheDocument();
  });

  it("does not mention waking up for a normal fast load", () => {
    render(<SkyStatusOverlay state="loading" placeName="Tokyo" slow={false} />);
    expect(screen.queryByText(/waking up/i)).not.toBeInTheDocument();
  });

  it("says to wait a minute on 429", () => {
    render(<SkyStatusOverlay state="error" error={{ status: 429 }} onRetry={() => {}} />);
    expect(screen.getByText(/too many requests/i)).toBeInTheDocument();
  });

  it.each([[503], [0]])("shows the friendly offline card for status %s", (status) => {
    render(<SkyStatusOverlay state="error" error={{ status }} onRetry={() => {}} />);
    expect(screen.getByText(/temporarily offline/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm failure** → both files FAIL (missing hook; old messages).

- [ ] **Step 3: Implement**

```js
// client/src/hooks/useDelayedFlag.js
import { useEffect, useState } from "react";

/** True once `active` has stayed true for `delayMs` (e.g. "this load is slow"). */
export function useDelayedFlag(active, delayMs) {
  const [fired, setFired] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(() => setFired(true), delayMs);
    return () => {
      clearTimeout(t);
      setFired(false);
    };
  }, [active, delayMs]);
  return active && fired;
}
```

In `SkyStatusOverlay.jsx`, replace `errorMessage` and the error branch, and accept `slow`:

```jsx
function errorContent(error) {
  const status = error?.status;
  if (status === 429) {
    return { title: "Too many requests", message: "Too many requests — give it a minute." };
  }
  if (status === 0 || status === 503) {
    return {
      title: "SkyVault's backend is temporarily offline",
      message: "The sky will be back shortly. Try again in a few minutes.",
    };
  }
  if (status === 404 || status === 422) {
    return { title: "Something went wrong", message: "Location could not be computed." };
  }
  if (status >= 500) {
    return { title: "Something went wrong", message: "Sky computation failed. Please try again." };
  }
  return { title: "Something went wrong", message: error?.message || "Something went wrong." };
}
```

with the signature `export default function SkyStatusOverlay({ state, placeName, error, onRetry, slow = false })`. In the loading branch, after the `for {placeName}` paragraph:

```jsx
        {slow && (
          <p className="max-w-xs font-mono text-[10px] uppercase tracking-[0.2em] text-ink-dim">
            Waking up the observatory — the first load after a quiet period takes a few seconds.
          </p>
        )}
```

and in the error branch: `const { title, message } = errorContent(error);` then `<ErrorCard title={title} message={message} onRetry={onRetry} />`.

In `SkyChart.jsx`: `import { useDelayedFlag } from "../../hooks/useDelayedFlag.js";`, then after `status` is computed: `const slow = useDelayedFlag(status === "loading", 3000);`. Pass `slow={slow}` to `<SkyStatusOverlay>`.

In `ControlsStrip.jsx`, change the geocode error `message` to:

```jsx
            message={
              geocode.error?.status === 429
                ? "Too many lookups — give it a minute."
                : geocode.error?.status === 503 || geocode.error?.status === 0
                  ? "Couldn't reach the place lookup service. Try again, or use your current location."
                  : geocode.error?.message || "Unknown error"
            }
```

- [ ] **Step 4: Run** `npx vitest run` → all PASS (the existing SkyChart error test still finds a Retry button); `npm run lint` clean.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useDelayedFlag.js client/src/components/hero/SkyStatusOverlay.jsx client/src/components/hero/SkyChart.jsx client/src/components/controls/ControlsStrip.jsx client/src/__tests__/useDelayedFlag.test.js client/src/__tests__/SkyStatusOverlay.test.jsx
git commit -m "feat(client): cold-start, rate-limit and offline messages"
```

---

### Task 9: GPS fixes (spec §6.7)

**Files:**
- Modify: `client/src/stores/observerStore.js`, `client/src/components/controls/SubmitButton.jsx`, `client/src/hooks/useGeolocation.js`, `client/src/components/controls/UseMyLocationButton.jsx`
- Test: `client/src/__tests__/observerStore.test.js` (append), `client/src/__tests__/UseMyLocationButton.test.jsx` (new)

**Interfaces:**
- Produces: `useGeolocation()` additionally returns `clearError(): void`.

- [ ] **Step 1: Write the failing tests**

Append to `observerStore.test.js`:

```js
  it("GO after a GPS fix recomputes the sky even with an empty search box", () => {
    const store = useObserverStore.getState();
    store.setDate("2026-04-08");
    store.setTime("22:00");
    store.setTimezone("UTC");
    store.useCurrentLocation(25.76, -80.19);
    store.setDate("2026-04-09");
    store.submit();
    expect(useObserverStore.getState().datetimeUtc).toBe("2026-04-09T22:00:00.000Z");
  });
```

```jsx
// client/src/__tests__/UseMyLocationButton.test.jsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import UseMyLocationButton from "../components/controls/UseMyLocationButton.jsx";
import SubmitButton from "../components/controls/SubmitButton.jsx";
import { useObserverStore } from "../stores/observerStore.js";

beforeEach(() => {
  useObserverStore.getState().reset();
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: (_ok, fail) => fail({ code: 1, message: "denied" }) },
  });
});

describe("GPS fixes", () => {
  it("a stale 'Location denied' clears once a location is selected", () => {
    render(<UseMyLocationButton />);
    fireEvent.click(screen.getByRole("button", { name: /gps/i }));
    expect(screen.getByText(/location denied/i)).toBeInTheDocument();
    act(() => {
      useObserverStore.setState({
        selected: { lat: 1, lon: 2, displayName: "Quito, Ecuador", timezone: "America/Guayaquil" },
      });
    });
    expect(screen.queryByText(/location denied/i)).not.toBeInTheDocument();
  });

  it("GO is enabled after a GPS fix with an empty search box", () => {
    useObserverStore.setState({
      date: "2026-04-08",
      rawQuery: "",
      selected: { lat: 1, lon: 2, displayName: "Current location", timezone: "UTC" },
    });
    render(<SubmitButton isGeocoding={false} isComputing={false} />);
    expect(screen.getByRole("button", { name: "GO" })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run to confirm failure** → the three new tests FAIL.

- [ ] **Step 3: Implement**

`observerStore.submit`:

```js
  submit: () => {
    const { rawQuery, date, time, timezone, selected } = get();
    if (!isSupportedDate(date)) return;

    // A location is already chosen (search pick or GPS fix): GO means
    // "recompute for the current date/time". The search box may be empty
    // after GPS, so don't require it here. Typing a new location clears
    // `selected` (see setRawQuery), which sends GO through the geocoder.
    if (selected) {
      set({
        datetimeUtc: toIsoUtc({ date, time, timezone, zone: selected.timezone }),
      });
      return;
    }

    if (!rawQuery || rawQuery.length < 2) return;
    set({ geocodeRequested: true, submitted: false });
  },
```

`SubmitButton.jsx`: add `const selected = useObserverStore((s) => s.selected);` and change `disabled` to:

```js
  const hasPlace = Boolean(selected) || (rawQuery && rawQuery.length >= 2);
  const disabled = !hasPlace || !isSupportedDate(date);
```

`useGeolocation.js`: add `const clearError = useCallback(() => setError(null), []);` and return `{ position, error, isLoading, request, clearError }`.

`UseMyLocationButton.jsx`:

```jsx
  const { position, error, isLoading, request, clearError } = useGeolocation();
  const setCurrentLocation = useObserverStore((s) => s.useCurrentLocation);
  const selected = useObserverStore((s) => s.selected);

  // Any successful location choice makes an old GPS error irrelevant.
  useEffect(() => {
    if (selected) clearError();
  }, [selected, clearError]);
```

- [ ] **Step 4: Run** `npx vitest run` → all PASS. The existing "submit requires both query and date" test still holds: it has no selection, so the query is required.

- [ ] **Step 5: Commit**

```bash
git add client/src/stores/observerStore.js client/src/components/controls/SubmitButton.jsx client/src/hooks/useGeolocation.js client/src/components/controls/UseMyLocationButton.jsx client/src/__tests__/observerStore.test.js client/src/__tests__/UseMyLocationButton.test.jsx
git commit -m "fix(client): GO works after a GPS fix; stale GPS errors clear"
```

---

### Task 10: `/about` page (no router) + shared credits

**Files:**
- Create: `client/src/components/layout/credits.js`, `client/src/components/about/AboutPage.jsx`, `client/public/_redirects`
- Modify: `client/src/components/layout/Footer.jsx`, `client/src/App.jsx`
- Test: `client/src/__tests__/AboutPage.test.jsx` (new), `client/src/__tests__/App.test.jsx` (append)

**Interfaces:**
- Produces: `CREDITS` array of `{ what, who, href?, license?, licenseHref?, note? }` exported from `credits.js` (moved verbatim from `Footer.jsx`). `ACKNOWLEDGEMENTS` array of `{ source, text }`.

- [ ] **Step 1: Write the failing tests**

```jsx
// client/src/__tests__/AboutPage.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AboutPage from "../components/about/AboutPage.jsx";

describe("<AboutPage>", () => {
  it.each([
    [/made use of the SIMBAD database, operated at CDS, Strasbourg, France/],
    [/made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology/],
    [/European Space Agency \(ESA\) mission\s+Gaia/],
    [/Riello et al\. 2021/],
  ])("carries the acknowledgement %s", (text) => {
    render(<AboutPage />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("links the ESO source image and the CC BY 4.0 license", () => {
    render(<AboutPage />);
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links).toContain("https://www.eso.org/public/images/eso0932a/");
    expect(links).toContain("https://creativecommons.org/licenses/by/4.0/");
    expect(links).toContain("https://www.openstreetmap.org/copyright");
  });

  it("lists the documented approximations honestly", () => {
    render(<AboutPage />);
    expect(screen.getByText(/atmospheric refraction/i)).toBeInTheDocument();
  });

  it("links back to the sky", () => {
    render(<AboutPage />);
    expect(screen.getByRole("link", { name: /back to the sky/i })).toHaveAttribute("href", "/");
  });
});
```

Append to `App.test.jsx`:

```jsx
  it("serves /about from the same bundle without a router", () => {
    window.history.pushState({}, "", "/about");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );
    expect(screen.getByRole("heading", { name: /about skyvault/i })).toBeInTheDocument();
    window.history.pushState({}, "", "/");
  });
```

- [ ] **Step 2: Run to confirm failure.**

- [ ] **Step 3: Implement**

Move the `CC_BY_4` constant and `CREDITS` array from `Footer.jsx` into `client/src/components/layout/credits.js` as named exports. Footer imports them; Footer behavior is unchanged and its tests stay green. Add to `credits.js`:

```js
// Requested acknowledgement wording, quoted from each provider's usage terms.
export const ACKNOWLEDGEMENTS = [
  {
    source: "ESA Gaia",
    text:
      "This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium).",
  },
  {
    source: "CDS SIMBAD",
    text: "This research has made use of the SIMBAD database, operated at CDS, Strasbourg, France.",
  },
  {
    source: "NASA Exoplanet Archive",
    text:
      "This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.",
  },
  {
    source: "Photometric transformations",
    text:
      "Hipparcos magnitudes and colours are converted to the Gaia system with the relations of Riello et al. 2021, A&A 649, A3 (Table 5.7); converted values are marked \"derived\".",
  },
];

export const APPROXIMATIONS = [
  "No atmospheric refraction (under 0.5° near the horizon; it depends on weather we don't ask for).",
  "The Milky Way backdrop uses J2000 galactic axes with of-date coordinates (about 0.4° on a diffuse image).",
  "Sidereal time for the backdrop ignores UT1−UTC (under 13 arcseconds).",
  "The Moon icon's terminator is simplified; its illumination and phase are computed exactly.",
];
```

```jsx
// client/src/components/about/AboutPage.jsx
import { ACKNOWLEDGEMENTS, APPROXIMATIONS, CREDITS } from "../layout/credits.js";

const link = "underline decoration-ink-dim/40 underline-offset-2 hover:text-accent";

/** /about: full credits, licenses, acknowledgements and method notes. */
export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10 font-serif text-ink">
      <header className="space-y-3 border-b border-rule pb-6">
        <a href="/" className={`font-mono text-[11px] uppercase tracking-[0.25em] text-accent ${link}`}>
          ← Back to the sky
        </a>
        <h1 className="text-[clamp(28px,5vw,48px)] italic leading-tight">About SkyVault</h1>
        <p className="text-lg text-ink-dim">
          The real sky for any place and moment between 1900 and 2053: star positions from ESA
          Gaia DR3 and Hipparcos, the Sun, Moon and planets from NASA JPL DE421, all transformed to
          your horizon with Astropy. Built by Andrew Robalino Garcia.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Data &amp; licenses</h2>
        <ul className="space-y-2 text-base">
          {CREDITS.map(({ what, who, href, license, licenseHref, note }) => (
            <li key={what}>
              <span className="text-ink-dim">{what}: </span>
              {href ? <a href={href} className={link}>{who}</a> : who}
              {license && (
                <>
                  {" · "}
                  {licenseHref ? <a href={licenseHref} className={link}>{license}</a> : license}
                </>
              )}
              {note && <span className="text-ink-dim"> ({note})</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Acknowledgements</h2>
        {ACKNOWLEDGEMENTS.map(({ source, text }) => (
          <p key={source} className="text-base text-ink-dim">{text}</p>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Known approximations</h2>
        <ul className="list-disc space-y-1 pl-5 text-base text-ink-dim">
          {APPROXIMATIONS.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </section>
    </article>
  );
}
```

`App.jsx`: render `AboutPage` instead of the sky when the path is `/about`:

```jsx
import AboutPage from "./components/about/AboutPage.jsx";

const isAboutPath = () => window.location.pathname.replace(/\/+$/, "") === "/about";

export default function App() {
  useEffect(() => {
    api.health();
  }, []);

  if (isAboutPath()) {
    return (
      <>
        <AppBackground />
        <FrameContainer>
          <AboutPage />
          <Footer />
        </FrameContainer>
      </>
    );
  }
  // ...existing return unchanged
}
```

`client/public/_redirects` (Cloudflare Pages SPA fallback so a direct `/about` link works):

```
/* /index.html 200
```

In `Footer.jsx`, after the `<ul id="credits">`, add:

```jsx
      <a href="/about" className="mt-4 inline-block text-[10px] uppercase tracking-[0.2em] text-accent-dim hover:text-accent">
        About &amp; full acknowledgements
      </a>
```

- [ ] **Step 4: Run** `npx vitest run` → all PASS; `npm run lint`; `npm run build` (confirm `dist/_redirects` exists).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/layout/credits.js client/src/components/about/AboutPage.jsx client/public/_redirects client/src/components/layout/Footer.jsx client/src/App.jsx client/src/__tests__/AboutPage.test.jsx client/src/__tests__/App.test.jsx
git commit -m "feat(client): /about page with full acknowledgements, no router"
```

---

### Task 11: Re-encode the Milky Way panorama (4.7 MB → ~1 MB)

**Files:**
- Create: `scripts/reencode_milky_way.py`
- Modify: `client/public/milky-way.jpg`, `client/src/components/layout/credits.js` (ESO `note`)
- Test: `client/src/__tests__/Footer.test.jsx` (append)

**Interfaces:**
- Consumes: `CREDITS` (Task 10).

- [ ] **Step 1: Write the failing test** (append to `Footer.test.jsx`). CC BY 4.0 requires indicating changes.

```jsx
  it("discloses that the ESO panorama was re-encoded (CC BY 4.0 indicate changes)", () => {
    const { container } = render(<Footer />);
    expect(container.querySelector("#credits").textContent).toMatch(/re-encoded/i);
  });
```

- [ ] **Step 2: Run to confirm failure.**

- [ ] **Step 3: Write the script, run it, record the result**

```python
"""Re-encode the ESO/S. Brunier panorama (eso0932a, CC BY 4.0) for the web.

Same 4000x2000 pixels; JPEG quality lowered and progressive encoding on,
so the 4.7 MB original becomes ~1 MB. The change is disclosed in the credits
("re-encoded"), as CC BY 4.0 requires. The original is in git history and at
https://www.eso.org/public/images/eso0932a/.

    python scripts/reencode_milky_way.py <source.jpg> client/public/milky-way.jpg --quality 80

Requires Pillow (like process_planet_textures.py). Without a local Pillow, run
it in a throwaway container:
    docker run --rm -v "${PWD}:/w" -w /w python:3.14-slim sh -c "pip install -q pillow && python scripts/reencode_milky_way.py /w/orig.jpg /w/client/public/milky-way.jpg --quality 80"
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("source", type=Path)
    ap.add_argument("dest", type=Path)
    ap.add_argument("--quality", type=int, default=80)
    args = ap.parse_args()

    img = Image.open(args.source).convert("RGB")
    assert img.size == (4000, 2000), f"expected 4000x2000, got {img.size}"
    img.save(args.dest, "JPEG", quality=args.quality, progressive=True, optimize=True, subsampling=0)
    print(f"{args.dest}: {args.dest.stat().st_size / 1e6:.2f} MB at quality {args.quality}")


if __name__ == "__main__":
    main()
```

Run it: copy the current file to a temp `orig.jpg` (outside the repo), then run the docker command. Try `--quality 80`, then 85 or 75, aiming for ≤ 1.2 MB. **Andrew picks the quality** after a side-by-side look at the dev server: chart backdrop and page background, old vs new. Record the chosen quality and size in the commit message.

Set the ESO entry's `note` in `credits.js` to `"re-encoded to a smaller JPEG"`. The footer renders `note` the same way `AboutPage` does: add `{note && <span className="text-ink-dim/60"> ({note})</span>}` after the license in the Footer `<li>`.

- [ ] **Step 4: Verify**

Run: `npx vitest run` → PASS. Run `server/.venv/Scripts/python.exe server/scripts/verify_backdrop_projection.py` → still `0.375 deg` (the image changed, the projection math didn't). Then Andrew's visual check.

- [ ] **Step 5: Commit**

```bash
git add scripts/reencode_milky_way.py client/public/milky-way.jpg client/src/components/layout/credits.js client/src/components/layout/Footer.jsx client/src/__tests__/Footer.test.jsx
git commit -m "perf(client): re-encode the ESO panorama 4.7 MB -> <size> MB (quality <q>), disclosed"
```

---

### Task 12: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: a workflow named `CI` with jobs `backend` and `frontend`. Task 13's deploy workflow triggers on its completion.

- [ ] **Step 1: Write the workflow**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: server
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.14"
          cache: pip
          cache-dependency-path: server/requirements*.txt
      - run: pip install -r requirements-dev.txt
      - name: Cache DE421 kernel
        uses: actions/cache@v4
        with:
          path: server/data/de421.bsp
          key: de421-v1
      - run: python scripts/download_ephemeris.py
      - run: python -m pytest -q
      - run: python -m scripts.verify_bright_stars
      - run: python scripts/verify_backdrop_projection.py

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: client
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: client/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npx vitest run
      - run: npm run build
```

Notes: `download_ephemeris.py` must be a no-op when the cached kernel exists. Check it, and if it re-downloads unconditionally, add an early return when `settings.ephemeris_kernel_path.exists()` in the same commit. The `network`-marked tests stay excluded by `pytest.ini`.

- [ ] **Step 2: Push the branch and open the PR** (PowerShell; Andrew approves the push)

```powershell
git add .github/workflows/ci.yml; git commit -m "ci: backend + frontend checks on every PR"
git push origin feat/phase-5-deploy
gh pr create --base main --head feat/phase-5-deploy --title "Phase 5: public launch" --body-file <tmpfile>
```

PR #6 must already be merged (Andrew), so the diff is Phase 5 only.

- [ ] **Step 3: Verify** with `gh pr checks <n> --watch` → both jobs green. If `verify_bright_stars` needs anything beyond the committed data, fix it here.

---

### Task 13: GCP setup script, deploy workflow, kill switch

**Files:**
- Create: `deploy/gcp_setup.sh`, `deploy/ar-cleanup-policy.json`, `.github/workflows/deploy.yml`, `deploy/kill_switch/main.py`, `deploy/kill_switch/requirements.txt`, `deploy/kill_switch/test_main.py`

**Interfaces:**
- Consumes: `deploy/cloudrun.env.yaml` (Task 4), `server/Dockerfile` (Task 5), `server/scripts/smoke_test_live.py` (Task 6), workflow `CI` (Task 12).
- Produces: GitHub repository **variables** (not secrets) `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`, `GCP_RUNTIME_SA`, printed by the setup script.

- [ ] **Step 1: Kill-switch function, test-first**

```python
# deploy/kill_switch/test_main.py  (run: python -m pytest deploy/kill_switch -q)
import base64
import json

from main import should_cut_billing


def _event(cost, budget):
    data = base64.b64encode(json.dumps({"costAmount": cost, "budgetAmount": budget}).encode())
    return {"message": {"data": data}}


def test_no_cut_under_budget():
    assert should_cut_billing(_event(4.99, 5.0)) is False


def test_cut_at_or_over_budget():
    assert should_cut_billing(_event(5.0, 5.0)) is True
    assert should_cut_billing(_event(12.3, 5.0)) is True
```

```python
# deploy/kill_switch/main.py
"""Second trigger behind the $5 Cloud Run spend cap: when the budget's
Pub/Sub notification reports cost >= budget, detach the project's billing
account. That stops all paid services until Andrew re-links billing.
Google's documented pattern:
https://docs.cloud.google.com/billing/docs/how-to/disable-billing-with-notifications
"""

from __future__ import annotations

import base64
import json
import os

import functions_framework

PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "")


def should_cut_billing(event_data: dict) -> bool:
    payload = json.loads(base64.b64decode(event_data["message"]["data"]).decode())
    return float(payload["costAmount"]) >= float(payload["budgetAmount"])


@functions_framework.cloud_event
def stop_billing(cloud_event) -> None:
    if not should_cut_billing(cloud_event.data):
        return
    from googleapiclient import discovery

    billing = discovery.build("cloudbilling", "v1", cache_discovery=False)
    name = f"projects/{PROJECT_ID}"
    if billing.projects().getBillingInfo(name=name).execute().get("billingEnabled"):
        billing.projects().updateBillingInfo(name=name, body={"billingAccountName": ""}).execute()
        print(f"Billing disabled for {PROJECT_ID}: budget exceeded")
```

```
# deploy/kill_switch/requirements.txt
functions-framework==3.*
google-api-python-client==2.*
```

Run the test in a scratch venv with `functions-framework` installed: RED (no module) → GREEN.

- [ ] **Step 2: Setup script** (Andrew runs it once in Cloud Shell; it never runs in CI)

```bash
#!/usr/bin/env bash
# deploy/gcp_setup.sh — one-time GCP setup for SkyVault (plan Task 14).
# Usage (Cloud Shell, as the project owner):  bash deploy/gcp_setup.sh <PROJECT_ID>
set -euo pipefail
PROJECT_ID="$1"
REGION=us-east1
REPO="AndrewRobalino/skyvault"
gcloud config set project "$PROJECT_ID"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com cloudbilling.googleapis.com \
  billingbudgets.googleapis.com pubsub.googleapis.com cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com eventarc.googleapis.com

gcloud artifacts repositories create skyvault --repository-format=docker \
  --location="$REGION" --description="SkyVault API images" || true
gcloud artifacts repositories set-cleanup-policies skyvault --location="$REGION" \
  --policy=deploy/ar-cleanup-policy.json --no-dry-run

RUNTIME_SA="skyvault-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOY_SA="skyvault-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts create skyvault-runtime --display-name="SkyVault API runtime (no roles)" || true
gcloud iam service-accounts create skyvault-deployer --display-name="SkyVault CI deployer" || true
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOY_SA" --role=roles/run.developer --condition=None
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOY_SA" --role=roles/artifactregistry.writer --condition=None
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --member="serviceAccount:$DEPLOY_SA" --role=roles/iam.serviceAccountUser

gcloud iam workload-identity-pools create github --location=global --display-name="GitHub Actions" || true
gcloud iam workload-identity-pools providers create-oidc github --location=global \
  --workload-identity-pool=github --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${REPO}'" || true
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}"

# First deploy with the owner's credentials: Google's sample container plus the
# real limits, made public once. CI later swaps the image only; run.developer
# can't (and needn't) change IAM.
gcloud run deploy skyvault-api --image=us-docker.pkg.dev/cloudrun/container/hello \
  --region="$REGION" --service-account="$RUNTIME_SA" --max-instances=1 --cpu=1 \
  --memory=512Mi --concurrency=10 --timeout=30 --allow-unauthenticated

echo
echo "Set these as GitHub repository VARIABLES (Settings > Secrets and variables > Actions > Variables):"
echo "  GCP_PROJECT_ID=$PROJECT_ID"
echo "  GCP_WIF_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github"
echo "  GCP_DEPLOY_SA=$DEPLOY_SA"
echo "  GCP_RUNTIME_SA=$RUNTIME_SA"
echo "Service URL (for VITE_API_BASE): $(gcloud run services describe skyvault-api --region=$REGION --format='value(status.url)')"
```

```json
[
  { "name": "keep-last-3", "action": { "type": "Keep" }, "mostRecentVersions": { "keepCount": 3 } },
  { "name": "delete-older", "action": { "type": "Delete" }, "condition": { "tagState": "ANY" } }
]
```

- [ ] **Step 3: Deploy workflow**

```yaml
# .github/workflows/deploy.yml
name: Deploy backend

on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]
  schedule:
    - cron: "17 6 1 * *"   # monthly rebuild: fresh astropy-iers-data (plan amendment 1)
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

concurrency:
  group: deploy-backend
  cancel-in-progress: false

env:
  REGION: us-east1
  SERVICE: skyvault-api
  IMAGE: us-east1-docker.pkg.dev/${{ vars.GCP_PROJECT_ID }}/skyvault/api

jobs:
  deploy:
    if: github.event_name != 'workflow_run' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha || github.sha }}
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_DEPLOY_SA }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: gcloud auth configure-docker us-east1-docker.pkg.dev --quiet
      - name: Build and push
        run: |
          TAG="${{ github.event.workflow_run.head_sha || github.sha }}"
          docker build -t "$IMAGE:$TAG" server
          docker push "$IMAGE:$TAG"
          echo "TAG=$TAG" >> "$GITHUB_ENV"
      - name: Deploy
        run: |
          gcloud run deploy "$SERVICE" --image="$IMAGE:$TAG" --region="$REGION" \
            --service-account="${{ vars.GCP_RUNTIME_SA }}" \
            --env-vars-file=deploy/cloudrun.env.yaml \
            --max-instances=1 --cpu=1 --memory=512Mi --concurrency=10 --timeout=30
      - name: Smoke test
        run: |
          URL=$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')
          pip install --quiet httpx
          python server/scripts/smoke_test_live.py "$URL" --origin https://skyvault.pages.dev
```

- [ ] **Step 4: Validate syntax.** Push and confirm in the Actions tab that both workflows parse. The deploy workflow only runs from `main`, so it stays idle until Task 15.

- [ ] **Step 5: Commit**

```bash
git add deploy/ .github/workflows/deploy.yml
git commit -m "ci(deploy): keyless Cloud Run deploy, monthly rebuild, setup script, kill switch"
```

---

### Task 14: Andrew's one-time setup (guided, ~30–45 min)

No code. Claude walks Andrew through it live, one step at a time, and verifies each step before moving on. Claude never enters payment details or passwords (Andrew types those himself).

- [ ] **Step 1: Google Cloud account + billing account.** Try a low-limit virtual card first (spec §5.1 layer 5); fall back to a normal card if it's rejected. Create project `skyvault` (the ID may get a suffix; note it).
- [ ] **Step 2: Budget.** Billing → Budgets & alerts → create: scope = project `skyvault`, **services = All services** (amended after the final review: internet egress, the main cost, may not bill under the Cloud Run service, so a Cloud-Run-only budget might never trip the kill switch); amount **$5**; alerts at 50/90/100%; enable the **spend cap** for Cloud Run if the Preview option is offered (spec §12). Connect a Pub/Sub topic `budget-alerts` under "Manage notifications".
- [ ] **Step 3: Run the setup script.** In Cloud Shell: `git clone https://github.com/AndrewRobalino/skyvault && cd skyvault && git checkout feat/phase-5-deploy && bash deploy/gcp_setup.sh <PROJECT_ID>`. Copy the four printed variables into GitHub repo variables. Note the service URL.
- [ ] **Step 4: Kill switch.** In Cloud Shell, create an SA `skyvault-billing-killer`, grant it **only** `roles/billing.projectManager` on the project (it holds `resourcemanager.projects.deleteBillingAssignment`, which is all detaching billing needs; amended after the final review — no billing-account admin), then:
  `gcloud functions deploy stop-billing --gen2 --region=us-east1 --runtime=python312 --source=deploy/kill_switch --entry-point=stop_billing --trigger-topic=budget-alerts --service-account=skyvault-billing-killer@<PROJECT_ID>.iam.gserviceaccount.com --set-env-vars=GCP_PROJECT_ID=<PROJECT_ID>`
  Verify it with a test message under budget: `gcloud pubsub topics publish budget-alerts --message='{"costAmount":0.01,"budgetAmount":5}'`. The function logs show no action taken.
- [ ] **Step 5: Emergency-stop rehearsal** (spec §9.2): `gcloud run services update skyvault-api --region=us-east1 --ingress=internal`, then confirm the URL refuses, then `--ingress=all`.
- [ ] **Step 6: Cloudflare Pages.** Create an account → Workers & Pages → Create → Pages → connect GitHub `AndrewRobalino/skyvault`. Project name `skyvault` (if taken, note the actual name and update `deploy/cloudrun.env.yaml` + the smoke-test `--origin` in `deploy.yml`). Production branch `main`; root directory `client`; build command `npm run build`; output `dist`; env vars for both Production and Preview: `NODE_VERSION=22`, `VITE_API_BASE=<service URL>/api/v1`.
- [ ] **Step 7: Branch protection** on `main`: require the `CI` checks (`backend`, `frontend`) to pass before merging.

---

### Task 15: First live deploy, measurements, docs

**Files:**
- Modify: `README.md`, `CLAUDE.md`, the spec (§8.2 results), possibly `deploy/cloudrun.env.yaml` (forwarded-for index)

- [ ] **Step 1: Merge the Phase 5 PR** (Andrew). CI must be green. The deploy workflow then builds, deploys and smoke-tests. Watch with `gh run watch`. Cloudflare Pages builds the frontend.
- [ ] **Step 2: Verify the client-IP position (Review Focus #1).** Temporarily set `LOG_FORWARDED_FOR: "true"` (one-off `gcloud run services update skyvault-api --region=us-east1 --update-env-vars=LOG_FORWARDED_FOR=true`). Send `curl -H "X-Forwarded-For: 203.0.113.9" <URL>/api/v1/objects/hip:32349` from your machine, then read the log line: `gcloud logging read 'resource.labels.service_name="skyvault-api" AND textPayload:"x-forwarded-for"' --limit=5`. Your real public IP should sit at the position `FORWARDED_FOR_INDEX` selects. If it doesn't, set the index in `deploy/cloudrun.env.yaml` (`-2` if Google appends its own hop). Then turn the logging back off.
- [ ] **Step 3: Measure (spec §8.2) and record in the spec:** cold start (wait 20+ min idle, time the first `/sky`); a 429 fires (`for i in $(seq 1 130); do curl -s -o /dev/null -w "%{http_code}\n" ...; done | sort | uniq -c`); `/sky` gzipped size; image size from Artifact Registry; memory from Cloud Run metrics.
- [ ] **Step 4: Andrew's checks (spec §8.3):** the live site on his phone and laptop (search, GPS, Save image, /about, constellations). Check billing after week 1 (expect $0).
- [ ] **Step 5: Docs.** README: live link at the top and a short "Deployment" section (Cloud Run + Pages, merge = ship). CLAUDE.md: Phase 5 ✅, plus guardrail #29 covering (a) offline IERS mode and why `astropy-iers-data` floats in the image, (b) API changes must be additive (independent deploys), (c) the browser calls Cloud Run directly (no proxy, by decision), (d) `deploy/cloudrun.env.yaml` is the runtime config. Update the "Resume Here" section. Commit `docs: SkyVault is live` and open the PR (Andrew merges).

---

## Self-review notes

- **Spec coverage:**
  - §4.1 → T2; §4.2 → T3 (+T15 verify); §4.3 → T4; §4.4 → T1; §4.5 → T5; §4.6 → T3/T4.
  - §5 → T13/T14; §6.1-6.3 → T7/T8; §6.4 → T10; §6.5 → done in sweep; §6.6 → T11; §6.7 → T9.
  - §7.1 → T12; §7.2-7.3 → T13; §7.4 → T14.6; §7.5 → T15 docs.
  - §8.1 → T6/T13; §8.2-8.3 → T15; §9.1 is a runbook (no code); §9.2 → T14.5; §10 → T14; §11 → task order.
  - §12 open items → T5 (wheels, memory), T14.2 (spend cap), T15.2 (XFF), T11 (quality).
- **Review Focus** items map to: #1 T3 + T15.2; #2 T1 (preload) + T8 (slow); #3 T1 test + T6; #4 T4 test; #5 T8 test.

---

## Render pivot (2026-10-02) — replaces Tasks 13–15's Google Cloud parts

Spec: see "Amendment 2026-10-02" at the end of the spec. Tasks 1–12 and the final-review fixes stand.

### Task R1: Cold-start copy + smoke-test timeout for Render
- Modify `client/src/components/hero/SkyStatusOverlay.jsx`: waking-up line says the first load "can take up to a minute". Test: `SkyStatusOverlay.test.jsx` asserts `/up to a minute/i` (RED first).
- Modify `server/scripts/smoke_test_live.py`: timeout 60 → 150 s so a cold Render start doesn't fail the smoke test.

### Task R2: Render Blueprint, workflows, remove GCP files
- Create `render.yaml` (service `skyvault-api`, web, docker, free, virginia, `dockerfilePath: ./server/Dockerfile`, `dockerContext: ./server`, `healthCheckPath: /health`, `autoDeployTrigger: checksPass`, `branch: main`, env vars from the old `deploy/cloudrun.env.yaml`).
- Create `.github/workflows/rebuild.yml` (monthly + manual: POST to `secrets.RENDER_DEPLOY_HOOK`) and `.github/workflows/smoke.yml` (on `deployment_status` success + manual: run `smoke_test_live.py` against `vars.RENDER_API_URL --origin https://skyvault.pages.dev`).
- Delete `deploy/` and `.github/workflows/deploy.yml`.
- Verify: YAML parses; the Render spec fields match https://render.com/docs/blueprint-spec.

### Task R3: Docs
- CLAUDE.md: Phase 5 status and guardrail #29 (Render free, no card; checksPass; deploy hook; additive API changes; browser calls the API directly). README deployment section.

### Task R4 (Andrew, ~15 min, no card anywhere)
1. Merge PR #7 (CI green).
2. render.com, sign in with GitHub, **New → Blueprint**, pick `AndrewRobalino/skyvault`, branch `main`, apply. Copy the service URL. In the service settings, copy the **Deploy Hook** URL.
3. GitHub repo, Settings → Secrets and variables → Actions: secret `RENDER_DEPLOY_HOOK`, variable `RENDER_API_URL`.
4. Cloudflare (sign up free), Workers & Pages → Pages → connect `AndrewRobalino/skyvault`. Project name `skyvault`, production branch `main`, root `client`, build `npm run build`, output `dist`, env `NODE_VERSION=22`, `VITE_API_BASE=<Render URL>/api/v1` (Production and Preview).
5. Branch protection on `main`: require CI `backend` + `frontend`.

### Task 15 (unchanged intent)
Live smoke test, verify X-Forwarded-For position on Render, measurements, phone check, docs: README live link.
