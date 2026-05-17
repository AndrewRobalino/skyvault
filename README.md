# SkyVault

> Explore the night sky from any place, any moment in time.

**SkyVault** is an interactive web app that renders an accurate night sky for any date, time, and location on Earth. Star positions come from **ESA Gaia DR3**, planet positions from **NASA JPL DE421**, constellations from the **IAU**, enrichment data from **NASA Exoplanet Archive** and **CDS SIMBAD**, and the photo-realistic Milky Way backdrop is the **ESO/S. Brunier GigaGalaxy Zoom panorama** (eso0932a). Every data point is attributed — no faked values, no approximations.

Built with React, Vite, Canvas 2D + WebGL, FastAPI, and Astropy.

## Status

✅ Phase 1 — Foundation
✅ Phase 2a — Frontend Foundation
✅ Phase 2b — 2D Sky Chart (Canvas 2D)
🚧 Phase 2c — Visual Polish + Milky Way Backdrop (in progress)

See [`SKYVAULT_ROADMAP.md`](./SKYVAULT_ROADMAP.md) for the full phase breakdown.

## Data Sources

SkyVault uses real, attributed institutional data sources. No values are faked or approximated.

| Source | Provides | Institution | License |
|---|---|---|---|
| **Gaia DR3** | Star positions, magnitudes, parallax, BP-RP color | ESA | CC BY-SA 3.0 IGO |
| **JPL DE421 ephemeris** | Sun, Moon, Mercury–Neptune positions | NASA JPL | Public domain (US Gov) |
| **IAU constellations** | Official 88 constellations + stick figures (Phase 3) | IAU | Public domain |
| **NASA Exoplanet Archive** | Confirmed exoplanets and host stars (Phase 3) | NASA / IPAC | Public domain |
| **CDS SIMBAD** | Canonical object metadata (Phase 3) | CDS Strasbourg | Free for academic / non-commercial use |
| **ESO/S. Brunier panorama** (eso0932a) | All-sky Milky Way backdrop image (galactic equirectangular, 4000×2000) | ESO / Serge Brunier (GigaGalaxy Zoom Project) | CC BY 4.0 |

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

Phase 1 setup instructions will land here as the backend scaffold comes up. For now, see [`CLAUDE.md`](./CLAUDE.md) for the full project context and [`SKYVAULT_ROADMAP.md`](./SKYVAULT_ROADMAP.md) for the plan.

## Author

Andrew Robalino Garcia — CS @ FIU. Building toward the space industry via CS.
