# Phase 5 — Public Launch (Deploy) Design

**Date:** 2026-09-28
**Status:** Approved 2026-10-01. Implementation plan: `docs/superpowers/plans/2026-10-01-phase-5-launch.md` (see its "Spec amendments")
**Branch:** `feat/phase-5-deploy` (stacked on `feat/bright-stars`, PR #6)

---

## 1. Intent

Get SkyVault live at a public URL so real people use it and it works as a portfolio link. Core function and accuracy must hold up on day one; polish comes after launch, driven by real feedback.

### What Andrew said
- **Cost:** $0/month. It's a personal, non-commercial project.
- **User experience:** the best possible within free tiers.
- **Maintenance:** easy to maintain; merging a PR ships it.
- **Domain:** a free subdomain.
- **Abuse:** "iron-clad" against someone deliberately running up costs. Past roughly **$5**, the backend is killed and stays off until he turns it back on.
- **After launch:** his HCI list, the frontend redesign, and a full code review.

### Success criteria
1. A visitor on a laptop or phone searches a city (or uses GPS) and gets an accurate sky. A few seconds' wait at most when the backend is cold; about 1 s when warm.
2. Every data source is credited: the footer, plus an `/about` page with full license links.
3. Merging a PR to `main` runs the test suites and ships the frontend and backend.
4. Hosting cost is $0 in normal months. Worst-case spend is bounded, and Andrew is alerted before it matters.

### Out of scope (post-launch)
- Landing page, demo video, custom domain.
- The HCI fixes and the redesign.
- A full code-review pass.
- Phase 4 (Three.js).
- The signed-gateway hardening (§9.3). It's documented here as the ready response if abuse ever appears.

---

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | **Backend on Google Cloud Run** (us-east1, request-based billing, scale to zero) | Full vCPU per request: an awake `/sky` takes ~0.2 s. The free allowance covers this traffic many times over. Render free (0.1 CPU) would make every sky take ~1.5–2 s and wake in ~1 min+. Hugging Face Docker Spaces now require a paid plan. An Oracle VM means running a server yourself. |
| D2 | **Frontend on Cloudflare Pages** (`skyvault.pages.dev`) | Unlimited static bandwidth and requests on the free plan, with Cloudflare's DDoS protection in front. Vercel Hobby pauses the whole project for up to 30 days once it passes 100 GB of transfer. |
| D3 | **The browser calls Cloud Run directly**, not through a frontend-host rewrite | Proxying the API through the frontend host counts against that host's origin-transfer limit (Vercel Hobby: 10 GB, about 8k visitors). A rewrite also adds no security, because the Cloud Run URL is public either way. |
| D4 | **Deploys run automatically on merge to `main`** via GitHub Actions, with keyless auth (Workload Identity Federation) | Shipping = merging. No long-lived service-account key sits in GitHub. |
| D5 | **Cost protection has four layers, plus an optional limited card** (§5) | "Iron-clad" as far as a pay-per-use cloud allows: the spend *rate* is capped by construction, and the *total* is capped by the spend cap. |
| D6 | **The Gaia parquet is committed to the repo** (17.7 MB) | It's the exact file the bright-star dedupe was verified against; re-querying Gaia could reintroduce duplicates. It's under GitHub's 50 MB warning. Gaia DR3 is CC BY-SA 3.0 IGO: redistribution is allowed with attribution, and the README already attributes it. |
| D7 | **DE421 is downloaded from NASA NAIF at image build time** | Public domain, stable source, no need to bloat the repo. |
| D8 | **IERS Earth-orientation data is fetched at build time; runtime downloads are off; the age check is disabled; a monthly scheduled rebuild keeps it fresh** | See §4.4. Turning off downloads alone makes **every** request error in production. |

---

## 3. Architecture

```
 Browser ──(static: HTML/JS/images)──► skyvault.pages.dev        Cloudflare Pages (free)
    │                                     unlimited bandwidth · DDoS-protected · PR previews
    │
    └──(API: /api/v1/*, gzip)──► skyvault-api-<hash>.run.app      Google Cloud Run, us-east1
                                   1 container · max-instances 1 · 1 vCPU · 512 MiB
                                   per-IP rate limit · CORS: pages.dev origins only
                                   image contains: Gaia parquet · Hipparcos supplement ·
                                   enrichment/DSO/constellation JSON · DE421 · fresh IERS
                                   zero network calls at runtime except the geocoder
                                     (Photon / Nominatim)
                                   │
                                   ▼
                     $5 spend cap (pauses Cloud Run) · email alerts at 50/90/100%
                     kill-switch function (disables billing) as a second trigger
```

**Measured backend footprint** (local, 2026-09-28):
- import 1.3 s
- first `/sky` 0.8 s; warm `/sky` 0.17 s
- ~240 MB resident once warm
- `/sky` response 1,995 KB raw, 584 KB gzipped

---

## 4. Backend changes

### 4.1 Response size
- `GZipMiddleware` (FastAPI built-in, no new dependency).
- Round serialized coordinates:
  - `ra`/`dec`/`alt`/`az`: 5 decimals (0.00001° ≈ 0.04″, far below the pipeline's real error budget; the missing refraction alone is ~0.5°).
  - `magnitude`/`bp_rp`: 3 decimals.
  - distances: 2 decimals.
- Existing tests assert positions to arcminute precision, so they are unaffected. Measure the payload before and after and record it here.

### 4.2 Per-IP rate limiting
No new dependency. An in-memory limiter, which is valid because `max-instances=1` gives a single process and a single table. Rejections return `429` with `Retry-After`.

| Scope | Limit (starting point, tune after launch) | Why |
|---|---|---|
| Sky/planets/dso/constellations/objects | 120 requests/min per IP | A page load is ~4 requests; clicking stars adds 1 each. No human gets near this. |
| `/geocode` | 20 requests/min per IP, **plus a global limit of 1 request/s on the Nominatim fallback** | The endpoint forwards to Photon and OSM's Nominatim. Nominatim's usage policy caps traffic at ~1 req/s, and abuse through us would get **our** server banned. The User-Agent already identifies the app (`geocoder.py:36`). |
| `/health` | Exempt | The wake-up ping. |

**Client IP on Cloud Run:** take it from `X-Forwarded-For`. The exact trustworthy position in the header (Google's front end appends the real client IP; anything the client sends comes first) **must be verified against a live deploy** before relying on it. Until then, fall back to the rightmost entry.

### 4.3 CORS
`cors_origins` comes from an env var: `https://skyvault.pages.dev`, plus an `allow_origin_regex` for Cloudflare preview deploys (`https://[a-z0-9-]+\.skyvault\.pages\.dev`). No wildcard. Localhost stays for development.

### 4.4 Earth-orientation data (IERS)
Tested on 2026-09-28 with astropy 7.2.0 and the bundled `astropy-iers-data` 0.2026.4.6:
- **`iers.conf.auto_download = False` alone breaks production.** Every date after the bundled data, *including today*, raises `ValueError: interpolating from IERS_Auto using predictive values that are more than 30.0 days old`. It works on a dev laptop only because Astropy has already cached a fresh download there.
- **Fix:**
  1. At `docker build`, download current IERS-A and the leap-second table into the image's Astropy cache.
  2. At runtime, set `auto_download = False` and `auto_max_age = None`.
- **Verified:** with the age check off, 1900, today, 2027, 2035 and 2100 all transform. The worst position difference against fresh data is ~2″, even using six-month-old bundled data.
- **Freshness:** a monthly scheduled rebuild (§7.3) keeps the baked predictions under ~1 month old.
- Configure this in one place at app startup (`app/main.py` lifespan or a small `app/services/iers_config.py`), with a test that transforms a far-future date with downloads off.

> Amended 2026-10-01: with `auto_download` off, Astropy reads only the bundled `astropy-iers-data` table (the download cache is ignored), so freshness comes from that package's version. See the plan's amendment 1.

### 4.5 Container
- `server/Dockerfile`: slim base with the **same Python minor version as local and CI (3.14)**, and a non-root user.
- One `uvicorn` worker: a single copy of the catalog in memory, and a single rate-limit table.
- Data files copied in; DE421 and IERS fetched in build steps.
- The app loads all catalogs at startup (lifespan), so the first *user* request doesn't pay the parquet-load cost.
- `.dockerignore` excludes `.venv`, `tests/`, `__pycache__`, and `data/sources/` (only needed at bake time). `scripts/` stays: it is small, and `app/services/enrichment/` imports from it at ingest time.
- Measure the image size and record it (for the Artifact Registry storage estimate).

### 4.6 Config
- All deploy-specific values come from env vars through the existing `pydantic-settings` `Settings`: CORS origins, rate limits, log level.
- No secrets exist in this design.

---

## 5. Cost and abuse model

### 5.1 Layers

| Layer | Mechanism | Guarantee |
|---|---|---|
| 1 | `max-instances=1`, 1 vCPU, 512 MiB | Hard ceiling on work done: one container's throughput, however many clients there are. |
| 2 | gzip + rounded coordinates | Cuts per-request egress by more than 3.4×. |
| 3 | Per-IP rate limit (§4.2) | Stops a single abuser outright; cheap rejections. |
| 4 | **$5 spend cap on Cloud Run** (Google Cloud Billing "spend cap budgets", **Preview**), alerts at 50/90/100%, **plus** the documented "disable billing" Pub/Sub function as a second trigger | Stops the total. Cloud Run stays paused until Andrew lifts the cap. |
| 5 (optional) | Low-limit virtual card on the billing account | The only absolute ceiling: charges beyond it decline. Andrew tries it at signup and falls back to a normal card if it's rejected. |

### 5.2 Worst-case reasoning
- **Requests beyond capacity.** When the single instance is saturated, Google's front end rejects extra requests before they reach a container. Cloud Run bills requests that *reach the container*. That no-billing claim is an **inference** from the general billing rule; the docs don't state it explicitly for the max-instances `429` case. It is why botnet size doesn't scale the bill.
- **Maximum burn rate.** One saturated instance costs ~$1.5–3/hour, whether from egress while serving skies or request fees while issuing cheap `429`s. These are estimates at ~$0.12/GB egress and $0.40 per million requests.
- **Totals.**
  - Realistic worst case with the cap and billing lag: **~$10–40**.
  - Theoretical worst, if the cap and the kill switch both failed for a full day: **~$70**.
  - With a limited card: bounded by the card limit.
- **What an attacker can do:** take the backend offline (degraded until the cap trips, then paused). They cannot make it expensive.

### 5.3 Normal-month estimate
- **Compute:** inside the free tier.
- **Egress:** 1 GiB/month free (North America), which is ~1,700 gzipped skies. 10k sky views ≈ 6 GB ≈ under $1.
- **Artifact Registry:** a cleanup policy keeps the last 3 images. Storage is expected to be cents at most; confirm against the measured image size.
- **Frontend:** $0 on Cloudflare Pages.

---

## 6. Frontend changes

1. **API base URL** comes from `import.meta.env.VITE_API_BASE`.
   - Default: `/api/v1`, so local dev through the Vite proxy is unchanged.
   - Production: the Cloud Run URL.
2. **Wake-up ping:** fire-and-forget `GET /health` on app mount.
3. **Loading and error states** in the sky chart:
   - More than ~3 s pending: "Waking up the observatory — the first load after a quiet period takes a few seconds."
   - `429`: "Too many requests — give it a minute."
   - Network failure or `503` (backend paused/offline): a friendly "SkyVault's backend is temporarily offline" card instead of a raw error.
4. **`/about` page** handled inside the app from `window.location.pathname`, with **no router dependency**, plus Cloudflare Pages `_redirects` (`/* /index.html 200`) so `/about` works as a direct link. It carries the full credit and license link for every source:
   - ESA Gaia DR3 (CC BY-SA 3.0 IGO)
   - ESA Hipparcos
   - Riello et al. 2021
   - NASA JPL DE421
   - CDS SIMBAD (with CDS's requested acknowledgement)
   - NASA Exoplanet Archive (with its requested acknowledgement)
   - IAU WGSN (CC BY)
   - Stellarium Western (CC BY-SA)
   - ESO/S. Brunier eso0932a (CC BY 4.0, "re-encoded")
   - Solar System Scope (CC BY 4.0)
   - OpenStreetMap
5. **OpenStreetMap attribution — missing today.** The geocoder returns OSM data (Photon and Nominatim), and the ODbL requires "© OpenStreetMap contributors". Add it to `AttributionFooter` and `/about`.
6. **Re-encode `client/public/milky-way.jpg`:**
   - 4.7 MB → about 1 MB, same 4000×2000 resolution (progressive JPEG).
   - Credits note the re-encode, as CC BY 4.0 requires indicating changes.
   - `verify_backdrop_projection.py` must still pass, plus a side-by-side visual check.
   - Keep the original re-encodable from source (record the command).
7. **GPS fixes:**
   - The geolocation error clears once any location is selected.
   - GO recomputes the sky whenever a location is selected, even with an empty search box (`observerStore.submit`).

---

## 7. CI/CD

### 7.1 CI: `.github/workflows/ci.yml` (on PRs and pushes to `main`)
- **Backend:**
  - pip install
  - `pytest` (default markers; the `network` tests are excluded so CI doesn't depend on SIMBAD or NASA uptime)
  - `python -m scripts.verify_bright_stars`
  - `python -m scripts.verify_backdrop_projection`
- **Frontend:** `npm ci`, `npm run lint`, `npx vitest run`, `npm run build`.
- **Branch protection on `main`:** CI required to merge (Andrew sets this once).

### 7.2 Backend deploy: `.github/workflows/deploy.yml` (on push to `main`, after CI passes)
1. Authenticate via Workload Identity Federation (GitHub OIDC → deploy service account). The service account's roles are limited to deploying: Cloud Run developer, Artifact Registry writer, service-account user on the runtime SA.
2. Build and push the image to Artifact Registry (`us-east1`).
3. `gcloud run deploy` with the §4.5/§5.1 flags: `--max-instances=1 --cpu=1 --memory=512Mi --region=us-east1 --allow-unauthenticated`, and env vars for CORS.
4. Run the smoke test (§8.1). A failing smoke test marks the workflow red.

### 7.3 Scheduled rebuild
A monthly `schedule:` trigger on the deploy workflow re-runs build + deploy to refresh the baked IERS data (§4.4).

### 7.4 Frontend deploy
- The Cloudflare Pages GitHub integration builds `client/` on push to `main` and gives every PR a preview URL.
- Build env: `VITE_API_BASE=<Cloud Run URL>/api/v1`.

### 7.5 Compatibility rule (goes into CLAUDE.md)
The frontend and backend deploy independently and can briefly run different versions, so **API changes must be additive and backward-compatible**.

---

## 8. Verification

### 8.1 Automated smoke test (`server/scripts/smoke_test_live.py`, run after every deploy)
- `GET /health` → 200.
- `GET /api/v1/sky` for Miami 2026-01-15T02:00Z:
  - 200
  - response is `Content-Encoding: gzip`
  - contains `hip:32349` with `source == "ESA Hipparcos"`
  - count is in the expected range
- `GET /api/v1/objects/hip:32349` → `proper_name == "Sirius"`.
- CORS: the `skyvault.pages.dev` origin is allowed, and `https://evil.example` gets no `Access-Control-Allow-Origin`.
- `GET /api/v1/sky` for **2100-12-31** → 200. Guards the IERS configuration.

### 8.2 Measured once by hand; results recorded in this spec
- Cold-start time to the first `/sky` after more than 20 min idle.
- The rate limit fires (a burst over the limit → `429`).
- The `X-Forwarded-For` shape on Cloud Run (§4.2).
- Image size.

### 8.3 Andrew
- Opens the live site on his phone and laptop.
- Checks the billing report after week 1 (expected $0).

---

## 9. Runbook

### 9.1 Rollback
- **Backend:** `gcloud run services update-traffic skyvault-api --to-revisions=<previous>=100 --region=us-east1`. Previous revisions are kept.
- **Frontend:** the Cloudflare Pages dashboard → Deployments → Rollback.

### 9.2 Emergency stop (without waiting for the spend cap)
`gcloud run services update skyvault-api --ingress=internal --region=us-east1` blocks all public traffic immediately without deleting anything; `--ingress=all` restores it. Verified once during setup (§10). The frontend stays up and shows the "backend offline" card from §6.3.

### 9.3 If abuse ever appears: the signed gateway (not built at launch)
1. Remove `allUsers` invoker from Cloud Run, so it requires Google-signed identity tokens.
2. Put a free Cloudflare Worker in front. It holds a service-account credential in Worker secrets, mints identity tokens and forwards requests.
3. Unauthenticated direct traffic is then rejected at Google's edge. IAM-denied requests are explicitly **not billed**, and Cloudflare absorbs the flood.

Cost: key handling in the Worker, a second deploy target, and about a day of work.

---

## 10. One-time setup (Andrew, guided; ~30–45 min)

1. Create a Google Cloud account and billing account (try a low-limit virtual card), and a project `skyvault`.
2. Create the budget: a $5 spend cap scoped to Cloud Run in `skyvault`, alerts at 50/90/100%, and the kill-switch Pub/Sub topic and function.
3. Run the setup script from the plan. It enables the APIs, creates the Artifact Registry repo and its cleanup policy, and sets up the runtime and deploy service accounts and the Workload Identity pool/provider bound to `AndrewRobalino/skyvault`.
4. Create a Cloudflare account, connect the repo to Pages, set the build config and `VITE_API_BASE`.
5. Set up branch protection on `main`.
6. First deploy via merge; smoke test green; manual checks from §8.2.

---

## 11. Sequencing

1. PR #6 (bright stars) merges to `main`. This branch stacks on it.
2. Code changes (§4, §6) land TDD-first, with the local suites green.
3. Dockerfile, verified by building and running locally and running the smoke test against `localhost`.
4. CI workflow, green on the PR.
5. Andrew's cloud setup (§10), then the deploy workflow, then the first live deploy and the smoke test.
6. Manual measurements recorded (§8.2) and docs updated: README live link, CLAUDE.md guardrails for the IERS config, the API compatibility rule and the no-rewrite decision.

---

## 12. Open items to settle during planning/implementation

- The `X-Forwarded-For` trust position on Cloud Run (§4.2).
- Whether Cloud Run spend caps are available on Andrew's account (Preview). If not, the kill-switch function becomes the primary trigger.
- Whether `max-instances` 429s go unbilled (§5.2). Stated as an inference; revisit if the billing report ever shows request charges without matching traffic.
- Exact Docker base image tag for Python 3.14, and that all wheels (numpy, pandas, pyarrow, astropy) install on it.
- The Milky Way re-encode quality setting (pick by visual comparison).

---

## Sources

- Render free tier: <https://render.com/docs/free>, <https://community.render.com/t/the-free-instance-type-e-g-512mb-ram-0-1-cpu/39044>
- Hugging Face Spaces hardware/billing: <https://huggingface.co/docs/hub/spaces-gpus>
- Koyeb free tier: <https://www.srvrlss.io/provider/koyeb/>
- Cloud Run pricing and cost practices: <https://cloud.google.com/run/pricing>, <https://docs.cloud.google.com/run/docs/tips/services-cost-optimization>
- Cloud Billing spend caps: <https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps>
- Disable billing via notifications: <https://docs.cloud.google.com/billing/docs/how-to/disable-billing-with-notifications>
- Cloud Run 429 behaviour: <https://github.com/ahmetb/cloud-run-faq/issues/54>
- Vercel limits and fair use: <https://vercel.com/docs/limits>, <https://vercel.com/docs/limits/fair-use-guidelines>
- Cloudflare Pages limits and plans: <https://developers.cloudflare.com/pages/platform/limits/>, <https://www.cloudflare.com/plans/developer-platform/>

---

## Amendment 2026-10-02: backend on Render free, not Cloud Run (Andrew's decision)

Andrew will not attach any payment method, so Google Cloud (which requires a billing account even inside the free tier) is out. Decided: **backend on Render's free web service**, frontend unchanged on Cloudflare Pages.

- **No card ever.** Render's documented behavior with no payment method is to *suspend* free services for the rest of the month when a limit is hit, never to bill. This replaces the whole cost model of §5 (spend cap, kill switch, virtual card): with nothing linked, nothing can be charged.
- **Limits (verified 2026-10-02):** 512 MB / 0.1 CPU; spins down after 15 min idle, ~1 min to wake; 750 instance-hours/month (one service always fits); **5 GB/month bandwidth** (~14k gzipped sky loads), then suspension until the next month.
- **Speed traded away:** ~1.5–2 s per sky warm (vs ~0.2 s on Cloud Run) and a ~1 min cold start. The wake-up ping and "waking up" message now say "up to a minute".
- **Deploy:** `render.yaml` Blueprint (Docker, `server/Dockerfile`, `healthCheckPath: /health`, `autoDeployTrigger: checksPass` so only green `main` commits ship). Render's health check keeps the previous version serving if a new one fails to boot. Monthly rebuild for fresh IERS data = a scheduled GitHub Action calling Render's deploy hook (stored as a GitHub secret). Post-deploy smoke test runs from Actions against the live URL.
- **Removed:** `deploy/gcp_setup.sh`, `deploy/kill_switch/`, `deploy/ar-cleanup-policy.json`, `deploy/cloudrun.env.yaml`, `.github/workflows/deploy.yml` (recoverable from git history if SkyVault ever moves to Cloud Run).
- **Unchanged:** rate limits (they now protect the 5 GB bandwidth), gzip/rounding, CORS, offline IERS, the container, every frontend change.
- **To verify live:** the X-Forwarded-For position on Render (plan Task 15 step 2 still applies).
