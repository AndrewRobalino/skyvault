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

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Curated list
#
# ``simbad``           — identifier passed to SIMBAD TAP
# ``id``               — canonical short id used in the API
# ``magnitude_fallback`` — published V magnitude used when SIMBAD lacks one
#
# magnitude_fallback sources (V magnitude, integrated for extended objects):
#   RC3       — de Vaucouleurs et al. 1991 (Third Reference Catalog of Bright Galaxies)
#   Harris96  — Harris 1996 GC catalog (globular clusters)
#   SkyCat    — Sky Catalog 2000.0 (Hirshfeld & Sinnott)
#   NED-L5    — NED-LEVEL5 integrated values
#   H&W67     — Hodge & Wright 1967 (LMC/SMC)
#   Acker92   — Acker et al. 1992 PN catalog (planetary nebulae)
# ---------------------------------------------------------------------------
CURATED: list[dict[str, Any]] = [
    # --- Northern + general (14) ---
    {
        "id": "M31", "simbad": "M 31",
        "common_name": "Andromeda Galaxy", "messier_id": "M31",
        "type": "galaxy",
        "magnitude_fallback": 3.44,  # SIMBAD; Schmidt-Kaler 1965
    },
    {
        "id": "M33", "simbad": "M 33",
        "common_name": "Triangulum Galaxy", "messier_id": "M33",
        "type": "galaxy",
        "magnitude_fallback": 5.72,  # RC3
    },
    {
        "id": "M42", "simbad": "M 42",
        "common_name": "Orion Nebula", "messier_id": "M42",
        "type": "nebula",
        "magnitude_fallback": 4.0,   # NED-L5 integrated
    },
    {
        "id": "M45", "simbad": "M 45",
        "common_name": "Pleiades", "messier_id": "M45",
        "type": "open_cluster",
        "magnitude_fallback": 1.6,   # Hipparcos-based integrated star cluster mag
    },
    {
        "id": "M44", "simbad": "M 44",
        "common_name": "Beehive Cluster", "messier_id": "M44",
        "type": "open_cluster",
        "magnitude_fallback": 3.7,   # SkyCat
    },
    {
        "id": "M81", "simbad": "M 81",
        "common_name": "Bode's Galaxy", "messier_id": "M81",
        "type": "galaxy",
        "magnitude_fallback": 6.94,  # RC3
    },
    {
        "id": "M82", "simbad": "M 82",
        "common_name": "Cigar Galaxy", "messier_id": "M82",
        "type": "galaxy",
        "magnitude_fallback": 8.41,  # RC3
    },
    {
        "id": "M51", "simbad": "M 51",
        "common_name": "Whirlpool Galaxy", "messier_id": "M51",
        "type": "galaxy",
        "magnitude_fallback": 8.4,   # RC3
    },
    {
        "id": "M27", "simbad": "M 27",
        "common_name": "Dumbbell Nebula", "messier_id": "M27",
        "type": "nebula",
        "magnitude_fallback": 7.5,   # Acker92
    },
    {
        "id": "M13", "simbad": "M 13",
        "common_name": "Hercules Globular Cluster", "messier_id": "M13",
        "type": "globular_cluster",
        "magnitude_fallback": 5.8,   # Harris96
    },
    {
        "id": "M8",  "simbad": "M 8",
        "common_name": "Lagoon Nebula", "messier_id": "M8",
        "type": "nebula",
        "magnitude_fallback": 6.0,   # NED-L5
    },
    {
        "id": "M57", "simbad": "M 57",
        "common_name": "Ring Nebula", "messier_id": "M57",
        "type": "nebula",
        "magnitude_fallback": 8.8,   # Acker92
    },
    {
        "id": "M67", "simbad": "M 67",
        "common_name": "M67 Open Cluster", "messier_id": "M67",
        "type": "open_cluster",
        "magnitude_fallback": 6.9,   # SkyCat
    },
    {
        "id": "M11", "simbad": "M 11",
        "common_name": "Wild Duck Cluster", "messier_id": "M11",
        "type": "open_cluster",
        "magnitude_fallback": 6.3,   # SkyCat
    },

    # --- Bright additions (2) ---
    {
        "id": "M3",   "simbad": "M 3",
        "common_name": "M3 Globular Cluster", "messier_id": "M3",
        "type": "globular_cluster",
        "magnitude_fallback": 6.2,   # Harris96
    },
    {
        "id": "M104", "simbad": "M 104",
        "common_name": "Sombrero Galaxy", "messier_id": "M104",
        "type": "galaxy",
        "magnitude_fallback": 8.0,   # RC3
    },

    # --- Southern (9) ---
    {
        "id": "LMC",          "simbad": "LMC",
        "common_name": "Large Magellanic Cloud", "messier_id": None,
        "type": "galaxy",
        "magnitude_fallback": 0.9,   # H&W67
    },
    {
        "id": "SMC",          "simbad": "SMC",
        "common_name": "Small Magellanic Cloud", "messier_id": None,
        "type": "galaxy",
        "magnitude_fallback": 2.7,   # H&W67
    },
    {
        "id": "OmegaCen",     "simbad": "NGC 5139",
        "common_name": "Omega Centauri", "messier_id": None,
        "type": "globular_cluster",
        "magnitude_fallback": 3.7,   # Harris96
    },
    {
        "id": "47Tuc",        "simbad": "NGC 104",
        "common_name": "47 Tucanae", "messier_id": None,
        "type": "globular_cluster",
        "magnitude_fallback": 4.0,   # Harris96
    },
    {
        "id": "EtaCarinaeNeb", "simbad": "NGC 3372",
        "common_name": "Eta Carinae Nebula", "messier_id": None,
        "type": "nebula",
        "magnitude_fallback": 1.0,   # integrated; Smith 2002
    },
    {
        "id": "Tarantula",    "simbad": "NGC 2070",
        "common_name": "Tarantula Nebula", "messier_id": None,
        "type": "nebula",
        "magnitude_fallback": 8.0,   # NED-L5
    },
    {
        "id": "JewelBox",     "simbad": "NGC 4755",
        "common_name": "Jewel Box Cluster", "messier_id": None,
        "type": "open_cluster",
        "magnitude_fallback": 4.2,   # SkyCat
    },
    {
        "id": "NGC253",       "simbad": "NGC 253",
        "common_name": "Sculptor Galaxy", "messier_id": None,
        "type": "galaxy",
        "magnitude_fallback": 7.1,   # RC3
    },
    {
        "id": "CenA",         "simbad": "NGC 5128",
        "common_name": "Centaurus A", "messier_id": None,
        "type": "galaxy",
        "magnitude_fallback": 6.84,  # RC3
    },
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
    """Parse one SIMBAD TAP result row into our DSO dict shape.

    ``row`` keys come from the new astroquery >= 0.4.8 TAP API (lowercase column
    names, decimal-degree coordinates). When SIMBAD's V magnitude is masked
    (typical for nebulae and clusters), fall back to the curated reference
    value with `magnitude_source: "reference"`.
    """
    ra = float(row["ra"])
    dec = float(row["dec"])

    otype_raw = row.get("otype", "")
    otype = otype_raw.decode() if isinstance(otype_raw, (bytes, bytearray)) else str(otype_raw)
    otype = otype.strip()
    inferred_type = SIMBAD_TYPE_MAP.get(otype, spec["type"])

    v_raw = row.get("V")
    major = row.get("galdim_majaxis")
    minor = row.get("galdim_minaxis")
    angle = row.get("galdim_angle")

    if _is_missing(v_raw):
        magnitude = spec["magnitude_fallback"]
        magnitude_source = "reference"
    else:
        magnitude = float(v_raw)
        magnitude_source = "SIMBAD"

    return {
        "id":                  spec["id"],
        "common_name":         spec["common_name"],
        "messier_id":          spec.get("messier_id"),
        "type":                inferred_type,
        "ra":                  ra,
        "dec":                 dec,
        "magnitude":           magnitude,
        "magnitude_source":    magnitude_source,
        "angular_size_arcmin": None if _is_missing(major) else float(major),
        "minor_axis_arcmin":   None if _is_missing(minor) else float(minor),
        "position_angle_deg":  None if _is_missing(angle) else float(angle),
    }


def main() -> int:
    """Query SIMBAD TAP for the curated list, write JSON.

    Uses LEFT JOIN allfluxes so objects without a V magnitude in SIMBAD are
    not silently dropped (the old add_votable_fields approach did an INNER JOIN
    and filtered out all diffuse DSOs). Missing V magnitudes fall back to
    curated reference values from published catalogs (see CURATED entries).
    Objects are only skipped when SIMBAD returns no angular size at all.
    """
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    from astroquery.simbad import Simbad

    out_path = Path(__file__).resolve().parent.parent / "data" / "naked_eye_dso.json"
    results: list[dict[str, Any]] = []
    skipped: list[str] = []

    for spec in CURATED:
        logger.info("Querying SIMBAD TAP: %s (%s)", spec["simbad"], spec["id"])
        safe_id = spec["simbad"].replace("'", "''")
        sql = f"""
        SELECT b.main_id, b.ra, b.dec, b.otype,
               b.galdim_majaxis, b.galdim_minaxis, b.galdim_angle,
               af.V
        FROM basic AS b
        LEFT JOIN allfluxes AS af ON b.oid = af.oidref
        JOIN ident AS i ON b.oid = i.oidref
        WHERE i.id = '{safe_id}'
        """
        try:
            table = Simbad.query_tap(sql)
        except Exception as exc:  # noqa: BLE001
            logger.warning("  TAP query failed: %s", exc)
            skipped.append(spec["id"])
            continue
        if table is None or len(table) == 0:
            logger.warning("  no SIMBAD result, skipping")
            skipped.append(spec["id"])
            continue
        row = {col: table[col][0] for col in table.colnames}
        try:
            parsed = parse_simbad_row(spec, row)
        except Exception as exc:  # noqa: BLE001
            logger.warning("  parse failed: %s", exc)
            skipped.append(spec["id"])
            continue
        if parsed["angular_size_arcmin"] is None:
            logger.warning("  missing angular size, skipping")
            skipped.append(spec["id"])
            continue
        results.append(parsed)
        logger.info(
            "  ok: V=%.2f (%s), size=%.1f'",
            parsed["magnitude"],
            parsed["magnitude_source"],
            parsed["angular_size_arcmin"],
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2, ensure_ascii=False)

    logger.info("Wrote %d objects to %s", len(results), out_path)
    if skipped:
        logger.warning("Skipped %d: %s", len(skipped), ", ".join(skipped))
    return 0


if __name__ == "__main__":
    sys.exit(main())
