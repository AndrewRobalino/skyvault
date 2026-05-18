"""One-time ingest: query SIMBAD for the curated naked-eye DSO list and
write ``server/data/naked_eye_dso.json``.

Run this once when the curated list changes (or for the initial seed).
Output is committed to the repo; the request path never hits SIMBAD.

Usage:
    cd server
    python scripts/ingest_dso.py
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any

import numpy as np
from astropy.coordinates import SkyCoord
import astropy.units as u

logger = logging.getLogger(__name__)


# Curated list — name = SIMBAD identifier; id = canonical short id used in API.
# Type is the *expected* type; the parser verifies SIMBAD agrees.
CURATED: list[dict[str, str]] = [
    # --- Northern + general (14) ---
    {"id": "M31", "simbad": "M 31", "common_name": "Andromeda Galaxy", "messier_id": "M31", "type": "galaxy"},
    {"id": "M33", "simbad": "M 33", "common_name": "Triangulum Galaxy", "messier_id": "M33", "type": "galaxy"},
    {"id": "M42", "simbad": "M 42", "common_name": "Orion Nebula", "messier_id": "M42", "type": "nebula"},
    {"id": "M45", "simbad": "M 45", "common_name": "Pleiades", "messier_id": "M45", "type": "open_cluster"},
    {"id": "M44", "simbad": "M 44", "common_name": "Beehive Cluster", "messier_id": "M44", "type": "open_cluster"},
    {"id": "M81", "simbad": "M 81", "common_name": "Bode's Galaxy", "messier_id": "M81", "type": "galaxy"},
    {"id": "M82", "simbad": "M 82", "common_name": "Cigar Galaxy", "messier_id": "M82", "type": "galaxy"},
    {"id": "M51", "simbad": "M 51", "common_name": "Whirlpool Galaxy", "messier_id": "M51", "type": "galaxy"},
    {"id": "M27", "simbad": "M 27", "common_name": "Dumbbell Nebula", "messier_id": "M27", "type": "nebula"},
    {"id": "M13", "simbad": "M 13", "common_name": "Hercules Globular Cluster", "messier_id": "M13", "type": "globular_cluster"},
    {"id": "M8",  "simbad": "M 8",  "common_name": "Lagoon Nebula", "messier_id": "M8",  "type": "nebula"},
    {"id": "M57", "simbad": "M 57", "common_name": "Ring Nebula", "messier_id": "M57", "type": "nebula"},
    {"id": "M67", "simbad": "M 67", "common_name": "M67 Open Cluster", "messier_id": "M67", "type": "open_cluster"},
    {"id": "M11", "simbad": "M 11", "common_name": "Wild Duck Cluster", "messier_id": "M11", "type": "open_cluster"},

    # --- Bright additions (2) ---
    {"id": "M3",   "simbad": "M 3",   "common_name": "M3 Globular Cluster", "messier_id": "M3",   "type": "globular_cluster"},
    {"id": "M104", "simbad": "M 104", "common_name": "Sombrero Galaxy",     "messier_id": "M104", "type": "galaxy"},

    # --- Southern (9) ---
    {"id": "LMC",          "simbad": "LMC",       "common_name": "Large Magellanic Cloud", "messier_id": None, "type": "galaxy"},
    {"id": "SMC",          "simbad": "SMC",       "common_name": "Small Magellanic Cloud", "messier_id": None, "type": "galaxy"},
    {"id": "OmegaCen",     "simbad": "NGC 5139", "common_name": "Omega Centauri",          "messier_id": None, "type": "globular_cluster"},
    {"id": "47Tuc",        "simbad": "NGC 104",  "common_name": "47 Tucanae",              "messier_id": None, "type": "globular_cluster"},
    {"id": "EtaCarinaeNeb","simbad": "NGC 3372", "common_name": "Eta Carinae Nebula",      "messier_id": None, "type": "nebula"},
    {"id": "Tarantula",    "simbad": "NGC 2070", "common_name": "Tarantula Nebula",        "messier_id": None, "type": "nebula"},
    {"id": "JewelBox",     "simbad": "NGC 4755", "common_name": "Jewel Box Cluster",       "messier_id": None, "type": "open_cluster"},
    {"id": "NGC253",       "simbad": "NGC 253",  "common_name": "Sculptor Galaxy",         "messier_id": None, "type": "galaxy"},
    {"id": "CenA",         "simbad": "NGC 5128", "common_name": "Centaurus A",             "messier_id": None, "type": "galaxy"},
]


# Map SIMBAD's OTYPE codes -> our type literal.
SIMBAD_TYPE_MAP = {
    "G":     "galaxy",
    "GiG":   "galaxy",   # giant galaxy
    "AGN":   "galaxy",
    "Sy1":   "galaxy",
    "Sy2":   "galaxy",
    "PaG":   "galaxy",   # pair of galaxies
    "rG":    "galaxy",   # radio galaxy
    "HII":   "nebula",
    "ISM":   "nebula",
    "RNe":   "nebula",
    "PN":    "nebula",
    "EmO":   "nebula",
    "MoC":   "nebula",
    "OpC":   "open_cluster",
    "Cl*":   "open_cluster",
    "GlC":   "globular_cluster",
}


def _is_missing(val: Any) -> bool:
    """True if val is None, NaN, or a numpy masked element."""
    if val is None:
        return True
    if isinstance(val, np.ma.core.MaskedConstant):
        return True
    try:
        if np.ma.is_masked(val):
            return True
    except (TypeError, ValueError):
        pass
    try:
        if isinstance(val, float) and np.isnan(val):
            return True
    except (TypeError, ValueError):
        pass
    return False


def parse_simbad_row(spec: dict[str, Any], row: dict[str, Any]) -> dict[str, Any]:
    """Parse one SIMBAD result row into our DSO dict shape.

    ``spec`` is the curated entry; ``row`` is the astroquery result row.
    We trust SIMBAD's coordinates, magnitude, and dimensions; we trust our
    curated list for the user-facing common_name (SIMBAD's MAIN_ID is messy).
    """
    ra_str = row["RA"]
    dec_str = row["DEC"]
    sc = SkyCoord(f"{ra_str} {dec_str}", unit=(u.hourangle, u.deg))
    otype_raw = row["OTYPE"]
    otype = otype_raw.decode() if isinstance(otype_raw, (bytes, bytearray)) else otype_raw
    otype = otype.strip()
    inferred_type = SIMBAD_TYPE_MAP.get(otype, spec["type"])

    flux_v = row.get("FLUX_V")
    major = row.get("GALDIM_MAJAXIS")
    minor = row.get("GALDIM_MINAXIS")
    angle = row.get("GALDIM_ANGLE")

    return {
        "id":                  spec["id"],
        "common_name":         spec["common_name"],
        "messier_id":          spec.get("messier_id"),
        "type":                inferred_type,
        "ra":                  float(sc.ra.deg),
        "dec":                 float(sc.dec.deg),
        "magnitude":           None if _is_missing(flux_v) else float(flux_v),
        "angular_size_arcmin": None if _is_missing(major) else float(major),
        "minor_axis_arcmin":   None if _is_missing(minor) else float(minor),
        "position_angle_deg":  None if _is_missing(angle) else float(angle),
    }


def main() -> int:
    """Query SIMBAD for the curated list, write JSON. Skip objects with
    missing critical fields (magnitude, angular size) and log them."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    from astroquery.simbad import Simbad

    simbad = Simbad()
    simbad.add_votable_fields("flux(V)", "dim", "otype")

    out_path = Path(__file__).resolve().parent.parent / "data" / "naked_eye_dso.json"
    results: list[dict[str, Any]] = []
    skipped: list[str] = []

    for spec in CURATED:
        logger.info("Querying SIMBAD: %s (%s)", spec["simbad"], spec["id"])
        table = simbad.query_object(spec["simbad"])
        if table is None or len(table) == 0:
            logger.warning("  no SIMBAD result, skipping")
            skipped.append(spec["id"])
            continue
        row = {col: table[col][0] for col in table.colnames}
        try:
            parsed = parse_simbad_row(spec, row)
        except Exception as exc:  # noqa: BLE001 -- ingest is best-effort
            logger.warning("  parse failed: %s", exc)
            skipped.append(spec["id"])
            continue
        if parsed["magnitude"] is None or parsed["angular_size_arcmin"] is None:
            logger.warning("  missing magnitude or angular size, skipping")
            skipped.append(spec["id"])
            continue
        results.append(parsed)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2, ensure_ascii=False)

    logger.info("Wrote %d objects to %s", len(results), out_path)
    if skipped:
        logger.warning("Skipped %d: %s", len(skipped), ", ".join(skipped))
    return 0


if __name__ == "__main__":
    sys.exit(main())
