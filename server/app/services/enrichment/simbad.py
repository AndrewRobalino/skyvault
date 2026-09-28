"""SIMBAD (CDS) ingest-time queries. NOT used on the request path."""

from __future__ import annotations

import logging

from astroquery.simbad import Simbad

logger = logging.getLogger(__name__)

# Astropy renders masked/empty table cells as "--" (and occasionally "None").
# Baking those verbatim would put a literal "--" in the tooltip's spectral-type
# row, so empty values must collapse to None.
_EMPTY_MARKERS = {"", "--", "none", "nan", "n/a"}


def _clean(value: object) -> str | None:
    """Normalize a SIMBAD table cell to a real string or None."""
    text = str(value).strip()
    return None if text.lower() in _EMPTY_MARKERS else text


# SIMBAD's TAP endpoint truncates any result set at this many rows, silently.
# Exceeding it drops whole stars off the end of a chunk with no error raised.
TAP_ROW_CAP = 10_000

# Only these identifier prefixes are consumed by build_name_fields. Filtering the
# join to them cuts the per-star row fan-out from ~30 to ~4, which is what keeps a
# chunk under TAP_ROW_CAP. Joined as a LEFT JOIN so a star with none of them still
# comes back (with spectral/object type but no names) instead of vanishing.
_IDENT_PREFIXES = ("NAME ", "* ", "HD ", "HIP ")


def fetch_simbad(gaia_source_ids: list[str], chunk_size: int = 300) -> dict:
    """Resolve Gaia DR3 source_ids to SIMBAD names/spectral type/identifiers.

    Returns ``{source_id: {proper_name, designation, catalog_ids, spectral_type,
    object_type}}`` using build_name_fields on each star's identifier list.
    Stars SIMBAD can't resolve are simply absent from the result.
    """
    from scripts.ingest_star_enrichment import build_name_fields

    ident_filter = " OR ".join(f"allids.id LIKE '{p}%'" for p in _IDENT_PREFIXES)

    out: dict = {}
    for start in range(0, len(gaia_source_ids), chunk_size):
        chunk = gaia_source_ids[start : start + chunk_size]
        gaia_ids = [f"Gaia DR3 {sid}" for sid in chunk]
        id_list = ", ".join(f"'{g}'" for g in gaia_ids)
        # basic gives sp_type/otype; ident (joined twice) gives the input Gaia id
        # (to key on) and the display identifiers (NAME/* /HD/HIP). otypedef turns
        # SIMBAD's short object-type code into readable text — basic.otype_txt is
        # a cryptic code ("PM*", "a2*"), not the display string we want to bake.
        query = f"""
            SELECT gaia.id AS gaia_id, b.sp_type AS sp_type,
                   od.otype_longname AS otype, allids.id AS ident
            FROM ident AS gaia
            JOIN basic AS b ON b.oid = gaia.oidref
            LEFT JOIN ident AS allids
                   ON allids.oidref = b.oid AND ({ident_filter})
            LEFT JOIN otypedef AS od ON od.otype = b.otype
            WHERE gaia.id IN ({id_list})
        """
        table = Simbad.query_tap(query)

        if len(table) >= TAP_ROW_CAP:
            raise RuntimeError(
                f"SIMBAD returned {len(table)} rows for a {len(chunk)}-star chunk, "
                f"at or above the {TAP_ROW_CAP}-row TAP cap — the result is "
                f"truncated and stars would be silently dropped. Lower chunk_size."
            )
        # Group rows by gaia_id (one row per identifier).
        by_star: dict = {}
        for row in table:
            gid = str(row["gaia_id"]).replace("Gaia DR3 ", "").strip()
            rec = by_star.setdefault(
                gid,
                {
                    "idents": [],
                    "sp_type": _clean(row["sp_type"]),
                    "otype": _clean(row["otype"]),
                },
            )
            ident = _clean(row["ident"])
            if ident:
                rec["idents"].append(ident)

        for gid, rec in by_star.items():
            proper, designation, catalog_ids = build_name_fields(rec["idents"])
            out[gid] = {
                "proper_name": proper,
                "designation": designation,
                "catalog_ids": catalog_ids,
                "spectral_type": rec["sp_type"],
                "object_type": rec["otype"],
            }
        logger.info("SIMBAD resolved %d/%d so far", len(out), start + len(chunk))
    return out
