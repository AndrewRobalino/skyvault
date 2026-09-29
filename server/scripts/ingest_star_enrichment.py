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
import re
from pathlib import Path

logger = logging.getLogger(__name__)

NAME_SOURCE = "SIMBAD/CDS"
# Proper name from the IAU list; designation/spectral type still from SIMBAD.
IAU_NAME_SOURCE = "IAU WGSN · SIMBAD/CDS"
PLANET_SOURCE = "NASA Exoplanet Archive"

# SIMBAD abbreviates Greek letters in Bayer designations. Map to Unicode.
_GREEK = {
    "alf": "α", "bet": "β", "gam": "γ", "del": "δ", "eps": "ε", "zet": "ζ",
    "eta": "η", "the": "θ", "tet": "θ", "iot": "ι", "kap": "κ", "lam": "λ", "mu.": "μ",
    "mu": "μ", "nu.": "ν", "nu": "ν", "xi.": "ξ", "xi": "ξ", "ksi": "ξ", "omi": "ο",
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


_SUPERSCRIPT = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")

# SIMBAD's numbered Bayer letters: 'alf01', 'pi.02'.
_NUMBERED_LETTER = re.compile(r"^([a-z]{2,3}\.?)(\d+)$")


def _format_letter(raw: str) -> str:
    numbered = _NUMBERED_LETTER.match(raw.lower())
    if numbered and numbered.group(1) in _GREEK:
        index = str(int(numbered.group(2))).translate(_SUPERSCRIPT)
        return _GREEK[numbered.group(1)] + index
    return _GREEK.get(raw.lower(), raw)


def format_bayer(ident: str) -> str:
    """Format a SIMBAD '* <bayer/flamsteed> <Con> [component]' identifier.

    '* alf Lyr' -> 'α Lyrae'; '* 51 Peg' -> '51 Pegasi';
    '* alf01 Cen' -> 'α¹ Centauri'; '* alf CMa A' -> 'α Canis Majoris A'.
    Falls back to the raw token + genitive when the constellation is unknown.
    """
    token = ident[1:].strip() if ident.startswith("*") else ident.strip()
    parts = token.split()
    if len(parts) < 2:
        return token
    letter, con, component = parts[0], parts[1], parts[2:]
    return " ".join([_format_letter(letter), _GENITIVE.get(con, con), *component])


def _designation_rank(ident: str) -> tuple:
    """Sort key: Greek Bayer, then Latin-letter Bayer, then Flamsteed number;
    whole system before a component ('* alf CMa' before '* alf CMa A')."""
    parts = ident[1:].split()
    letter = parts[0].lower() if parts else ""
    greek = re.match(r"^([a-z]{2,3}\.?)\d*$", letter)
    if greek and greek.group(1) in _GREEK:
        kind = 0
    elif letter.isdigit():
        kind = 2
    else:
        kind = 1
    return (kind, len(parts) > 2, " ".join(parts))


def _is_component_name(name: str) -> bool:
    """'Sirius A', 'Polaris Aa' name one star of a system, not the system."""
    words = name.split()
    return len(words) > 1 and re.fullmatch(r"[A-Z][a-z]?", words[-1]) is not None


# The tooltip renders catalog_ids[0], so the order must be stable across stars.
# SIMBAD returns identifiers in no guaranteed order; HD is the more commonly
# cited designation, so it leads.
_CATALOG_PRIORITY = ("HD", "HIP")


def build_name_fields(
    identifiers: list[str], iau_names: dict[str, str] | None = None
) -> tuple[str | None, str | None, list[str]]:
    """From a star's SIMBAD identifiers, derive (proper_name, designation, catalog_ids).

    SIMBAD returns identifiers in no guaranteed order and often several of each
    kind (Polaris: 'Lodestar', 'Polaris', 'North Star'), so every choice is
    ranked rather than first-seen. An IAU-approved name (``iau_names``, keyed
    'HIP n' / 'HD n') beats any SIMBAD name.
    """
    names: list[str] = []
    stars: list[str] = []
    catalog_ids: list[str] = []

    for ident in identifiers:
        s = ident.strip()
        if s.startswith("NAME "):
            names.append(s[len("NAME "):].strip())
        elif s.startswith("* "):
            stars.append(s)
        elif s.startswith(("HD ", "HIP ")):
            # SIMBAD right-aligns catalog numbers to a fixed width ("HD   3712");
            # collapse that padding or it shows up verbatim in the tooltip.
            catalog_ids.append(" ".join(s.split()))

    catalog_ids.sort(
        key=lambda cid: (
            _CATALOG_PRIORITY.index(cid.split()[0])
            if cid.split()[0] in _CATALOG_PRIORITY
            else len(_CATALOG_PRIORITY)
        )
    )

    iau = next((iau_names[c] for c in catalog_ids if iau_names and c in iau_names), None)
    simbad_name = min(names, key=lambda n: (_is_component_name(n), n), default=None)
    proper_name = iau or simbad_name
    designation = format_bayer(min(stars, key=_designation_rank)) if stars else None

    return proper_name, designation, catalog_ids


_IAU_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def parse_iau_csn(text: str) -> dict[str, str]:
    """Parse the IAU Catalog of Star Names into ``{'HIP n' | 'HD n': name}``.

    Vendored at data/sources/iau_csn.txt (IAU WGSN, CC BY). Fixed-width rows;
    the diacritic name is columns 18-36. HIP and HD are the 4th and 3rd tokens
    before the adoption date, and are '_' for stars that have none.
    """
    names: dict[str, str] = {}
    for line in text.splitlines():
        if not line.strip() or line.startswith(("#", "$")):
            continue
        tokens = line.split()
        date_at = next((i for i, t in enumerate(tokens) if _IAU_DATE.match(t)), None)
        if date_at is None or date_at < 4:
            continue
        name = line[18:36].strip()
        for prefix, number in (("HIP", tokens[date_at - 4]), ("HD", tokens[date_at - 3])):
            if number.isdigit():
                names[f"{prefix} {number}"] = name
    return names


def name_source_for(catalog_ids: list[str], iau_names: dict[str, str] | None) -> str:
    """Attribution for a star's name fields: IAU when its name came from there."""
    if iau_names and any(cid in iau_names for cid in catalog_ids):
        return IAU_NAME_SOURCE
    return NAME_SOURCE


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
            "name_source": fields.get("name_source") or NAME_SOURCE,
            "planet_source": PLANET_SOURCE if planet_block else None,
        }
    return out


def load_bright_star_ids(mag_limit: float = 6.5) -> list[str]:
    """Read the rendered bright-star source_ids from the Gaia parquet."""
    import pandas as pd

    from app.config import settings

    df = pd.read_parquet(
        settings.gaia_parquet_path, columns=["source_id", "phot_g_mean_mag"]
    )
    df = df[df["phot_g_mean_mag"] <= mag_limit]
    return [str(sid) for sid in df["source_id"].tolist()]


def main() -> None:
    import pandas as pd

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    from app.config import DATA_DIR, settings
    from app.services.enrichment.exoplanet_archive import fetch_exoplanet_hosts
    from app.services.enrichment.simbad import fetch_simbad, fetch_simbad_by_hip

    iau_names = parse_iau_csn(
        (DATA_DIR / "sources" / "iau_csn.txt").read_text(encoding="utf-8")
    )
    logger.info("IAU-approved names loaded: %d", len(set(iau_names.values())))

    source_ids = load_bright_star_ids()
    logger.info("Bright stars to resolve: %d", len(source_ids))

    simbad = fetch_simbad(source_ids, iau_names)
    logger.info(
        "SIMBAD resolved: %d/%d (%.1f%%)",
        len(simbad),
        len(source_ids),
        100 * len(simbad) / max(len(source_ids), 1),
    )

    # The Hipparcos supplement (stars Gaia saturates on) has no Gaia ids; resolve
    # it by HIP identifier. These are the stars with proper names.
    bright = pd.read_parquet(settings.bright_stars_parquet_path, columns=["source_id"])
    hip_ids = [sid.removeprefix("hip:") for sid in bright["source_id"].astype(str)]
    hip_simbad = fetch_simbad_by_hip(hip_ids, iau_names)
    logger.info("SIMBAD resolved by HIP: %d/%d", len(hip_simbad), len(hip_ids))
    simbad.update(hip_simbad)

    planets = fetch_exoplanet_hosts(set(source_ids), set(hip_ids))
    logger.info("Exoplanet hosts: %d", len(planets))

    baked = merge_enrichment(simbad, planets)
    baked["__source__"] = {  # provenance block; loader skips dunder keys
        "names": "IAU WGSN Catalog of Star Names (CC BY), else SIMBAD (CDS Strasbourg)",
        "spectral_type": "SIMBAD (CDS Strasbourg)",
        "exoplanets": "NASA Exoplanet Archive (NASA/IPAC)",
    }

    out_path: Path = settings.star_enrichment_path
    out_path.write_text(
        json.dumps(baked, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    logger.info("Wrote %s (%d entries)", out_path, len(baked) - 1)


if __name__ == "__main__":
    main()
