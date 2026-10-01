"""Acceptance gate for the bright-star supplement.

Fails loudly if any canonical naked-eye star is missing from the merged catalog,
mispositioned, or rendered twice. Run after touching the ingest or merge path:

    cd server
    python -m scripts.verify_bright_stars

Reference positions are the J2000 coordinates in the vendored IAU Catalog of
Star Names (data/sources/iau_csn.txt), not hand-typed values. Catalog rows are
stored at their own epoch (Gaia J2016.0, Hipparcos J1991.25), so every row is
propagated to J2000.0 before comparing. Comparing raw rows would put Sirius
~11 arcsec off purely from 8.75 years of proper motion.
"""

from __future__ import annotations

import sys

import numpy as np
import pandas as pd

from app.config import DATA_DIR
from app.services import star_catalog

# The stars any observer can name. Positions and magnitudes come from IAU-CSN.
CANONICAL = [
    "Sirius", "Canopus", "Arcturus", "Vega", "Capella", "Rigel", "Procyon",
    "Achernar", "Betelgeuse", "Altair", "Aldebaran", "Antares", "Spica",
    "Pollux", "Fomalhaut", "Deneb", "Regulus", "Castor", "Bellatrix", "Polaris",
]

POSITION_TOLERANCE_ARCSEC = 1.0

# A second source this close and this similar in brightness is the same star
# rendered twice. Mirrors the ingest dedupe (scripts/ingest_bright_stars.py).
TWIN_RADIUS_ARCSEC = 3.0
TWIN_MAX_DMAG = 1.5

# Deliberate exceptions, each with its reason. Castor: Gaia DR3 resolves the
# ~5 arcsec A-B pair and has only Castor B; the ingest keeps the Hipparcos
# combined-light row (what the eye sees, ~1.6) instead of leaving Castor at
# B's G 2.9. B's light is therefore drawn twice, as a mag-2.9 dot inside
# Castor's halo. Accepted 2026-09-28 (3-arcsec dedupe rule).
ACCEPTED_BINARIES = {"Castor": 2}


def _iau_reference() -> dict[str, tuple[float, float, float]]:
    """{name: (ra_j2000, dec_j2000, mag)} from the IAU-CSN fixed-width rows."""
    from scripts.ingest_star_enrichment import _IAU_DATE

    text = (DATA_DIR / "sources" / "iau_csn.txt").read_text(encoding="utf-8")
    out: dict[str, tuple[float, float, float]] = {}
    for line in text.splitlines():
        if not line.strip() or line.startswith(("#", "$")):
            continue
        tokens = line.split()
        date_at = next((i for i, t in enumerate(tokens) if _IAU_DATE.match(t)), None)
        if date_at is None:
            continue
        try:
            out[line[18:36].strip()] = (
                float(tokens[date_at - 2]),
                float(tokens[date_at - 1]),
                float(tokens[date_at - 6]),
            )
        except ValueError:
            continue  # '_' magnitude on a few faint exoplanet hosts
    return out


def _positions_at_j2000(catalog: pd.DataFrame) -> np.ndarray:
    """Unit vectors of every catalog row, linearly propagated to J2000.0."""
    epoch = catalog["epoch"].str.removeprefix("J").astype(float).to_numpy()
    dt = 2000.0 - epoch
    dec0 = catalog["dec"].to_numpy(dtype=float)
    pmra = np.nan_to_num(catalog["pmra"].to_numpy(dtype=float))
    pmdec = np.nan_to_num(catalog["pmdec"].to_numpy(dtype=float))
    dec = dec0 + pmdec * dt / 3.6e6
    ra = catalog["ra"].to_numpy(dtype=float) + pmra * dt / 3.6e6 / np.cos(np.radians(dec0))
    return _unit(ra, dec)


def _unit(ra_deg, dec_deg) -> np.ndarray:
    ra, dec = np.radians(ra_deg), np.radians(dec_deg)
    return np.stack(
        [np.cos(dec) * np.cos(ra), np.cos(dec) * np.sin(ra), np.sin(dec)], axis=-1
    )


def main() -> int:
    catalog = star_catalog.get_catalog()
    vectors = _positions_at_j2000(catalog)
    mags = catalog["phot_g_mean_mag"].to_numpy(dtype=float)
    reference = _iau_reference()

    print(f"merged catalog: {len(catalog):,} stars")
    print(f"{'star':<11} {'source_id':<21} {'sep (arcsec)':>12}  status")
    print("-" * 58)

    failures: list[str] = []
    for name in CANONICAL:
        ra, dec, ref_mag = reference[name]
        sep = np.degrees(np.arccos(np.clip(vectors @ _unit(ra, dec), -1, 1))) * 3600

        nearest = int(np.argmin(sep))
        twins = np.flatnonzero(
            (sep <= TWIN_RADIUS_ARCSEC) & (np.abs(mags - ref_mag) <= TWIN_MAX_DMAG)
        )
        sid = catalog["source_id"].iat[nearest]

        if sep[nearest] > POSITION_TOLERANCE_ARCSEC:
            status = "MISSING" if sep[nearest] > TWIN_RADIUS_ARCSEC else "TOO FAR"
            failures.append(f"{name}: nearest star {sid} is {sep[nearest]:.2f} arcsec away")
        elif len(twins) == ACCEPTED_BINARIES.get(name):
            status = "ok (resolved binary, see ACCEPTED_BINARIES)"
        elif len(twins) > 1:
            status = f"DUPLICATED ({len(twins)})"
            ids = ", ".join(catalog["source_id"].iloc[twins])
            failures.append(f"{name} appears {len(twins)} times: {ids}")
        else:
            status = "ok"
        print(f"{name:<11} {sid:<21} {sep[nearest]:>12.3f}  {status}")

    print()
    if failures:
        print(f"FAILED — {len(failures)} problem(s):")
        for failure in failures:
            print(f"  - {failure}")
        return 1

    print(f"OK — all {len(CANONICAL)} canonical stars present, none duplicated beyond ACCEPTED_BINARIES, within "
          f"{POSITION_TOLERANCE_ARCSEC} arcsec of their IAU J2000 position.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
