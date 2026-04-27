# SkyVault

> Explore the night sky from any place, any moment in time.

**SkyVault** is an interactive web app that renders an accurate night sky for any date, time, and location on Earth. Star positions come from **ESA Gaia DR3**, planet positions from **NASA JPL DE421**, constellations from the **IAU**, enrichment data from **NASA Exoplanet Archive** and **CDS SIMBAD**, and the photo-realistic Milky Way backdrop is **Axel Mellinger's All-Sky Milky Way Panorama 2.0**. Every data point is attributed — no faked values, no approximations.

Built with React, Vite, Canvas 2D + WebGL, FastAPI, and Astropy.

## Status

✅ Phase 1 — Foundation
✅ Phase 2a — Frontend Foundation
✅ Phase 2b — 2D Sky Chart (Canvas 2D)
🚧 Phase 2c — Visual Polish + Milky Way Backdrop (in progress)

See [`SKYVAULT_ROADMAP.md`](./SKYVAULT_ROADMAP.md) for the full phase breakdown.

## Data Sources

- **ESA Gaia DR3** — stellar positions, magnitudes, parallax, color
- **NASA JPL DE421** — Sun, Moon, and planetary ephemerides (via Astropy)
- **IAU** — official 88 constellations + stick figures
- **NASA Exoplanet Archive** — confirmed exoplanets and host stars
- **CDS SIMBAD** — canonical object metadata
- **Mellinger 2.0 All-Sky Milky Way Panorama** — © Axel Mellinger ([source](https://galaxy.phys.cmich.edu/~axel/mwpan2/)). Non-commercial license; SkyVault is a free public portfolio site with no ads or monetization. See [`CLAUDE.md`](./CLAUDE.md) guardrail #11 for full license terms.

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
