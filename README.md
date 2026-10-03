# SkyVault

> Explore the night sky from any place, any moment in time.

**SkyVault** is an interactive web app that renders an accurate night sky for any date, time, and location on Earth. Star positions come from **ESA Gaia DR3**, with **ESA Hipparcos** filling in the brightest stars Gaia saturates on, planet positions from **NASA JPL DE421**, constellation names from the **IAU** (public domain) with stick-figure line topology from the **Stellarium Western sky culture** (CC BY-SA), star names from the **IAU Working Group on Star Names**, enrichment data from **NASA Exoplanet Archive** and **CDS SIMBAD**, and the photo-realistic Milky Way backdrop is the **ESO/S. Brunier GigaGalaxy Zoom panorama** (eso0932a). Every data point is attributed — no faked values, and every approximation is documented and labelled.

Built with React, Vite, Canvas 2D + WebGL, FastAPI, and Astropy.

## Features

- **Real sky, any place and moment (1900 to 2053).** Search a place or use GPS, pick a date and time (in the place's own local time, or UTC), and get the visible sky computed server-side by Astropy: ICRS to AltAz with proper motion propagated from each star's catalog epoch.
- **Stars** from ESA Gaia DR3 down to naked-eye magnitude 6.5, with ESA Hipparcos for the brightest stars Gaia saturates on.
- **Sun, Moon and planets** from NASA JPL DE421, with lunar phase and apparent-size scaling.
- **Deep-sky objects, constellation figures, and star enrichment** (IAU names, spectral types, confirmed exoplanet hosts), all baked at ingest so the request path makes no external calls.
- **Milky Way backdrop** projected through the same stereographic chart in a WebGL shader, numerically verified against Astropy (worst error 0.375°).

## Status

Phases 1 to 3b plus the bright-star supplement are built and tested. Next is Phase 5, the public launch (Cloud Run + Cloudflare Pages). The Three.js "Explore in 3D" mode (Phase 4) comes after launch. See [`SKYVAULT_ROADMAP.md`](./SKYVAULT_ROADMAP.md) for the full phase breakdown.

## Data Sources

SkyVault uses real, attributed institutional data sources. No values are faked. The few modelling approximations (no atmospheric refraction, for example) are documented in [`CLAUDE.md`](./CLAUDE.md), and transformed photometry is labelled "derived" in the UI. The app's footer carries the full credits list.

| Source | Provides | Institution | License |
|---|---|---|---|
| **Gaia DR3** | Star positions, magnitudes, parallax, BP-RP color | ESA | CC BY-SA 3.0 IGO |
| **JPL DE421 ephemeris** | Sun, Moon, Mercury–Neptune positions | NASA JPL | Public domain (US Gov) |
| **IAU constellations** | Official 88 constellation names | IAU | Public domain |
| **Stellarium Western sky culture** | Constellation stick-figure line topology | Stellarium | CC BY-SA (attribution + ShareAlike on the derived data file) |
| **ESA Hipparcos** (VizieR I/239/hip_main) | ICRS positions (epoch J1991.25) for constellation stars, plus the 72 naked-eye stars Gaia DR3 saturates on (Sirius, Vega, Betelgeuse... everything brighter than G ≈ 2.7), deduped against Gaia by identifier and position | ESA | Public / scientific data |
| **Gaia EDR3 photometric relations** (Riello et al. 2021, Table 5.7) | Johnson V, B−V, V−I → Gaia G and BP−RP for the Hipparcos stars; every transformed value is labelled "derived" in the UI | ESA / DPAC | Published, cited |
| **IAU Catalog of Star Names** (WGSN) | Official proper names for 331 rendered stars, keyed by HIP/HD; vendored at `server/data/sources/iau_csn.txt` | IAU Working Group on Star Names | CC BY |
| **NASA Exoplanet Archive** | Confirmed exoplanets and host stars, cross-matched to Gaia DR3 source ids and baked into the star enrichment catalog | NASA / IPAC | Public domain |
| **CDS SIMBAD** | Canonical object metadata — Bayer/Flamsteed designations, proper names where the IAU list has none, HD/HIP ids, spectral and object types for naked-eye stars, plus DSO metadata | CDS Strasbourg | Free for academic / non-commercial use |
| **ESO/S. Brunier panorama** (eso0932a) | All-sky Milky Way backdrop image (galactic equirectangular, 4000×2000) | ESO / Serge Brunier (GigaGalaxy Zoom Project) | CC BY 4.0 |
| **Solar System Scope textures** | Planet and Moon images in the tooltips and lunar panel | INOVE / Solar System Scope | CC BY 4.0 |
| **OpenStreetMap** via Photon and Nominatim | Place search | © OpenStreetMap contributors | ODbL |
| **timezone-boundary-builder** via `timezonefinder` | The IANA time zone of the searched place, so "Local" time is that place's | © OpenStreetMap contributors | ODbL |

The Milky Way panorama is © ESO/S. Brunier from the GigaGalaxy Zoom Project,
licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
For the original image and project notes, see:
<https://www.eso.org/public/images/eso0932a/>. Attribution rules in
[`CLAUDE.md`](./CLAUDE.md) guardrail #11.

## Structure

```
skyvault/
├── client/    # React + Vite + Canvas 2D + WebGL frontend
├── server/    # FastAPI + Astropy backend
└── ...
```

## Getting Started

**Backend** (Python 3.11+, developed on 3.14):

```bash
cd server
python -m venv .venv
source .venv/bin/activate          # Windows: .venv/Scripts/activate
pip install -r requirements-dev.txt # runtime deps + pytest + astroquery for the ingest scripts
python scripts/download_ephemeris.py   # JPL DE421 kernel from NASA NAIF (~17 MB)
python scripts/ingest_gaia.py          # Gaia DR3 subset, G < 9 (one-time TAP query)
uvicorn app.main:app --reload --port 8000
pytest                                 # add -m network for the live-service tests
```

The other catalogs (bright-star supplement, star enrichment, DSOs, constellations) are committed under `server/data/`.

**Frontend** (Node 20+):

```bash
cd client
npm install
npm run dev     # http://localhost:5173, proxies /api to :8000
npm test
```

See [`CLAUDE.md`](./CLAUDE.md) for architecture, conventions, and the accuracy guardrails.

## Deployment

- **API:** Render free web service, defined in [`render.yaml`](./render.yaml) (Docker image from `server/Dockerfile`). It deploys only after CI passes on `main`. The account has no payment method, so hitting a free-tier limit suspends the service; it can never bill.
- **Frontend:** Cloudflare Pages builds `client/` with `VITE_API_BASE` pointing at the API.
- **Merging a PR ships it.** A monthly rebuild refreshes the Earth-orientation data, and a post-deploy smoke test checks the live API.

## Author

Andrew Robalino Garcia — CS @ FIU. Building toward the space industry via CS.
