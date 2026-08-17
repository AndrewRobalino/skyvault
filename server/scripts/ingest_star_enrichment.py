"""One-time ingest: resolve naked-eye stars via SIMBAD and cross-match the
NASA Exoplanet Archive, writing ``server/data/star_enrichment.json``.

Run when the rendered bright-star set changes. Output is committed; the request
path never hits SIMBAD or NASA.

Usage:
    cd server
    python scripts/ingest_star_enrichment.py
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

NAME_SOURCE = "SIMBAD/CDS"
PLANET_SOURCE = "NASA Exoplanet Archive"

# SIMBAD abbreviates Greek letters in Bayer designations. Map to Unicode.
_GREEK = {
    "alf": "α", "bet": "β", "gam": "γ", "del": "δ", "eps": "ε", "zet": "ζ",
    "eta": "η", "the": "θ", "iot": "ι", "kap": "κ", "lam": "λ", "mu.": "μ",
    "mu": "μ", "nu.": "ν", "nu": "ν", "xi.": "ξ", "xi": "ξ", "omi": "ο",
    "pi.": "π", "pi": "π", "rho": "ρ", "sig": "σ", "tau": "τ", "ups": "υ",
    "phi": "φ", "chi": "χ", "psi": "ψ", "ome": "ω",
}

# Genitive forms of the 88 constellations (Bayer/Flamsteed read "<letter> <gen>").
# Abbreviated IAU code -> Latin genitive.
_GENITIVE = {
    "And": "Andromedae", "Ant": "Antliae", "Aps": "Apodis", "Aqr": "Aquarii",
    "Aql": "Aquilae", "Ara": "Arae", "Ari": "Arietis", "Aur": "Aurigae",
    "Boo": "Boötis", "Cae": "Caeli", "Cam": "Camelopardalis", "Cnc": "Cancri",
    "CVn": "Canum Venaticorum", "CMa": "Canis Majoris", "CMi": "Canis Minoris",
    "Cap": "Capricorni", "Car": "Carinae", "Cas": "Cassiopeiae", "Cen": "Centauri",
    "Cep": "Cephei", "Cet": "Ceti", "Cha": "Chamaeleontis", "Cir": "Circini",
    "Col": "Columbae", "Com": "Comae Berenices", "CrA": "Coronae Australis",
    "CrB": "Coronae Borealis", "Crv": "Corvi", "Crt": "Crateris", "Cru": "Crucis",
    "Cyg": "Cygni", "Del": "Delphini", "Dor": "Doradus", "Dra": "Draconis",
    "Equ": "Equulei", "Eri": "Eridani", "For": "Fornacis", "Gem": "Geminorum",
    "Gru": "Gruis", "Her": "Herculis", "Hor": "Horologii", "Hya": "Hydrae",
    "Hyi": "Hydri", "Ind": "Indi", "Lac": "Lacertae", "Leo": "Leonis",
    "LMi": "Leonis Minoris", "Lep": "Leporis", "Lib": "Librae", "Lup": "Lupi",
    "Lyn": "Lyncis", "Lyr": "Lyrae", "Men": "Mensae", "Mic": "Microscopii",
    "Mon": "Monocerotis", "Mus": "Muscae", "Nor": "Normae", "Oct": "Octantis",
    "Oph": "Ophiuchi", "Ori": "Orionis", "Pav": "Pavonis", "Peg": "Pegasi",
    "Per": "Persei", "Phe": "Phoenicis", "Pic": "Pictoris", "PsA": "Piscis Austrini",
    "Psc": "Piscium", "Pup": "Puppis", "Pyx": "Pyxidis", "Ret": "Reticuli",
    "Scl": "Sculptoris", "Sco": "Scorpii", "Sct": "Scuti", "Ser": "Serpentis",
    "Sex": "Sextantis", "Sge": "Sagittae", "Sgr": "Sagittarii", "Tau": "Tauri",
    "Tel": "Telescopii", "TrA": "Trianguli Australis", "Tri": "Trianguli",
    "Tuc": "Tucanae", "UMa": "Ursae Majoris", "UMi": "Ursae Minoris",
    "Vel": "Velorum", "Vir": "Virginis", "Vol": "Volantis", "Vul": "Vulpeculae",
}


def format_bayer(ident: str) -> str:
    """Format a SIMBAD '* <bayer/flamsteed> <Con>' identifier for display.

    '* alf Lyr' -> 'α Lyrae'; '* 51 Peg' -> '51 Pegasi'. Falls back to the raw
    token + genitive when the constellation is unknown.
    """
    token = ident[1:].strip() if ident.startswith("*") else ident.strip()
    parts = token.split()
    if len(parts) < 2:
        return token
    letter_raw, con = parts[0], parts[-1]
    letter = _GREEK.get(letter_raw.lower(), letter_raw)
    genitive = _GENITIVE.get(con, con)
    return f"{letter} {genitive}"


def build_name_fields(identifiers: list[str]) -> tuple[str | None, str | None, list[str]]:
    """From a star's SIMBAD identifiers, derive (proper_name, designation, catalog_ids)."""
    proper_name: str | None = None
    designation: str | None = None
    catalog_ids: list[str] = []

    for ident in identifiers:
        s = ident.strip()
        if s.startswith("NAME ") and proper_name is None:
            proper_name = s[len("NAME "):].strip()
        elif s.startswith("* ") and designation is None:
            designation = format_bayer(s)
        elif s.startswith(("HD ", "HIP ")):
            catalog_ids.append(s)

    return proper_name, designation, catalog_ids


def merge_enrichment(simbad: dict, planets: dict) -> dict:
    """Combine the SIMBAD map and the exoplanet-host map into baked entries."""
    out: dict = {}
    for source_id, fields in simbad.items():
        planet_block = planets.get(source_id)
        out[source_id] = {
            "proper_name": fields.get("proper_name"),
            "designation": fields.get("designation"),
            "catalog_ids": fields.get("catalog_ids", []),
            "spectral_type": fields.get("spectral_type"),
            "object_type": fields.get("object_type"),
            "planets": planet_block if planet_block else None,
            "name_source": NAME_SOURCE,
            "planet_source": PLANET_SOURCE if planet_block else None,
        }
    return out
