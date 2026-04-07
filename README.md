# SkyVault

> Explore the night sky from any place, any moment in time.

**SkyVault** is an interactive web app that renders an accurate 3D night sky for any date, time, and location on Earth. Star positions come from **ESA Gaia DR3**, planet positions from **NASA JPL DE421**, constellations from the **IAU**, enrichment data from **NASA Exoplanet Archive** and **CDS SIMBAD**. Every data point is attributed — no faked values, no approximations.

Built with React, Three.js, FastAPI, and Astropy.

## Status

🚧 Phase 1 — Foundation (in progress)

See [`SKYVAULT_ROADMAP.md`](./SKYVAULT_ROADMAP.md) for the full phase breakdown.

## Data Sources

- **ESA Gaia DR3** — stellar positions, magnitudes, parallax, color
- **NASA JPL DE421** — Sun, Moon, and planetary ephemerides (via Astropy)
- **IAU** — official 88 constellations + stick figures
- **NASA Exoplanet Archive** — confirmed exoplanets and host stars
- **CDS SIMBAD** — canonical object metadata

## Structure

```
skyvault/
├── client/    # React + Vite + Three.js frontend
├── server/    # FastAPI + Astropy backend
└── ...
```

## Getting Started

Phase 1 setup instructions will land here as the backend scaffold comes up. For now, see [`CLAUDE.md`](./CLAUDE.md) for the full project context and [`SKYVAULT_ROADMAP.md`](./SKYVAULT_ROADMAP.md) for the plan.

## Author

Andrew Robalino Garcia — CS @ FIU. Building toward the space industry via CS.
