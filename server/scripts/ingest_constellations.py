"""One-time ingest: build ``server/data/constellations.json`` from the
Stellarium Western sky culture (HIP polylines) resolved to J2000 ICRS
coordinates via ESA Hipparcos (VizieR).

The request path never hits VizieR — output is committed to the repo.

Source (vendored): ``server/data/sources/stellarium_western_index.json``
from https://github.com/Stellarium/stellarium-skycultures (western/index.json).
Figure data is CC BY-SA; the baked output carries the same notice.

Usage:
    cd server
    python scripts/ingest_constellations.py
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

SERVER_ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = SERVER_ROOT / "data" / "sources" / "stellarium_western_index.json"
OUTPUT_PATH = SERVER_ROOT / "data" / "constellations.json"

SOURCE_BLOCK = {
    "figures": "Stellarium Western sky culture",
    "figures_license": "CC BY-SA 4.0",
    "coordinates": "ESA Hipparcos (VizieR I/239/hip_main)",
    "names": "IAU",
}


def parse_index(index: dict[str, Any]) -> list[dict[str, Any]]:
    """Flatten each constellation's HIP polylines into consecutive HIP pairs.

    A line ``[a, b, c]`` becomes segments ``(a, b)`` and ``(b, c)``.
    """
    out: list[dict[str, Any]] = []
    for c in index.get("constellations", []):
        try:
            iau = c["iau"]
            name = c["common_name"]["english"]
        except (KeyError, TypeError) as exc:
            logger.warning("Skipping malformed constellation entry: %s", exc)
            continue
        pairs: list[tuple[int, int]] = []
        for line in c.get("lines", []):
            for a, b in zip(line, line[1:]):
                pairs.append((int(a), int(b)))
        out.append({"id": iau, "name": name, "pairs": pairs})
    return out


def unique_hips(parsed: list[dict[str, Any]]) -> set[int]:
    """All distinct HIP ids referenced across every constellation."""
    hips: set[int] = set()
    for c in parsed:
        for a, b in c["pairs"]:
            hips.add(a)
            hips.add(b)
    return hips


def centroid_radec(points: list[tuple[float, float]]) -> tuple[float, float]:
    """Mean direction of (ra, dec) points via unit-vector averaging.

    Unit-vector mean is robust to the RA=0/360 wraparound (a naive arithmetic
    mean of RA degrees would place a centroid of 359 and 1 deg at 180).
    """
    ra = np.radians([p[0] for p in points])
    dec = np.radians([p[1] for p in points])
    x = np.mean(np.cos(dec) * np.cos(ra))
    y = np.mean(np.cos(dec) * np.sin(ra))
    z = np.mean(np.sin(dec))
    ra_c = np.degrees(np.arctan2(y, x)) % 360.0
    dec_c = np.degrees(np.arctan2(z, np.hypot(x, y)))
    return float(ra_c), float(dec_c)


def build_catalog(
    parsed: list[dict[str, Any]],
    coords: dict[int, tuple[float, float]],
) -> dict[str, Any]:
    """Map HIP-pair segments to RA/Dec, compute centroids, skip missing HIPs."""
    constellations: list[dict[str, Any]] = []
    for c in parsed:
        segments: list[dict[str, Any]] = []
        star_points: set[tuple[float, float]] = set()
        for a, b in c["pairs"]:
            if a not in coords or b not in coords:
                logger.warning(
                    "Skipping segment %s-%s in %s: unresolved HIP", a, b, c["id"]
                )
                continue
            fa, fb = coords[a], coords[b]
            segments.append({"from": [fa[0], fa[1]], "to": [fb[0], fb[1]]})
            star_points.add(fa)
            star_points.add(fb)
        if not segments:
            logger.warning("Constellation %s has no resolvable segments", c["id"])
            continue
        ra_c, dec_c = centroid_radec(sorted(star_points))
        constellations.append(
            {
                "id": c["id"],
                "name": c["name"],
                "segments": segments,
                "label": [ra_c, dec_c],
            }
        )
    return {"source": SOURCE_BLOCK, "constellations": constellations}


def resolve_hip_coords(hips: set[int]) -> dict[int, tuple[float, float]]:
    """Resolve HIP ids to ICRS RA/Dec (deg) via VizieR Hipparcos I/239/hip_main.

    Network call — used only by main(), never by tests. Positions are the
    catalogue ICRS values (epoch J1991.25); proper-motion drift to J2000 is
    sub-arcsecond for the bright figure stars and visually irrelevant for
    stick-figure lines, so it is not applied.
    """
    from astroquery.vizier import Vizier

    v = Vizier(columns=["HIP", "RAICRS", "DEICRS"], catalog="I/239/hip_main")
    v.ROW_LIMIT = -1
    hip_list = sorted(hips)
    coords: dict[int, tuple[float, float]] = {}
    # Query in chunks to keep the constraint string manageable.
    chunk = 500
    for i in range(0, len(hip_list), chunk):
        block = hip_list[i : i + chunk]
        result = v.query_constraints(HIP="=,{}".format(",".join(map(str, block))))
        if not result:
            continue
        table = result[0]
        for row in table:
            coords[int(row["HIP"])] = (float(row["RAICRS"]), float(row["DEICRS"]))
    return coords


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    if not SOURCE_PATH.exists():
        raise SystemExit(
            f"Source not found at {SOURCE_PATH}. Download western/index.json from "
            "https://github.com/Stellarium/stellarium-skycultures and place it there."
        )
    with SOURCE_PATH.open(encoding="utf-8") as fh:
        index = json.load(fh)

    parsed = parse_index(index)
    hips = unique_hips(parsed)
    logger.info("Resolving %d unique HIP stars via VizieR...", len(hips))
    coords = resolve_hip_coords(hips)
    logger.info("Resolved %d/%d HIP stars", len(coords), len(hips))

    catalog = build_catalog(parsed, coords)
    OUTPUT_PATH.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    logger.info(
        "Wrote %d constellations to %s",
        len(catalog["constellations"]),
        OUTPUT_PATH,
    )


if __name__ == "__main__":
    main()
