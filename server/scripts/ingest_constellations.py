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
        pairs: list[tuple[int, int]] = []
        for line in c.get("lines", []):
            for a, b in zip(line, line[1:]):
                pairs.append((int(a), int(b)))
        out.append(
            {
                "id": c["iau"],
                "name": c["common_name"]["english"],
                "pairs": pairs,
            }
        )
    return out


def unique_hips(parsed: list[dict[str, Any]]) -> set[int]:
    """All distinct HIP ids referenced across every constellation."""
    hips: set[int] = set()
    for c in parsed:
        for a, b in c["pairs"]:
            hips.add(a)
            hips.add(b)
    return hips
