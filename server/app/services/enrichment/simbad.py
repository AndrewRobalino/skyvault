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


def fetch_simbad(
    gaia_source_ids: list[str], iau_names: dict[str, str] | None = None, chunk_size: int = 300
) -> dict:
    """Resolve Gaia DR3 source_ids to SIMBAD names/spectral type/identifiers.

    Returns ``{source_id: {proper_name, designation, catalog_ids, spectral_type,
    object_type}}`` using build_name_fields on each star's identifier list.
    Stars SIMBAD can't resolve are simply absent from the result.
    """
    return _fetch_by_ident(
        [f"Gaia DR3 {sid}" for sid in gaia_source_ids],
        key=lambda ident: ident.removeprefix("Gaia DR3 ").strip(),
        iau_names=iau_names,
        chunk_size=chunk_size,
    )


def fetch_simbad_by_hip(
    hip_ids: list[str], iau_names: dict[str, str] | None = None, chunk_size: int = 300
) -> dict:
    """Same as fetch_simbad, for the Hipparcos bright-star supplement.

    Those stars have no Gaia row (that is why they were supplemented), so they
    are looked up by HIP identifier and keyed ``hip:<HIP>``.
    """
    return _fetch_by_ident(
        [f"HIP {h}" for h in hip_ids],
        key=lambda ident: "hip:" + ident.removeprefix("HIP ").strip(),
        iau_names=iau_names,
        chunk_size=chunk_size,
    )


def _fetch_by_ident(
    lookup_ids: list[str], key, iau_names: dict[str, str] | None, chunk_size: int
) -> dict:
    """Resolve SIMBAD identifiers, keying each result with ``key(lookup_id)``.

    ``iau_names`` (IAU WGSN, keyed 'HIP n' / 'HD n') overrides SIMBAD's names.
    """
    from scripts.ingest_star_enrichment import build_name_fields, name_source_for

    ident_filter = " OR ".join(f"allids.id LIKE '{p}%'" for p in _IDENT_PREFIXES)

    out: dict = {}
    for start in range(0, len(lookup_ids), chunk_size):
        chunk = lookup_ids[start : start + chunk_size]
        id_list = ", ".join(f"'{i}'" for i in chunk)
        # basic gives sp_type/otype; ident (joined twice) gives the lookup id
        # (to key on) and the display identifiers (NAME/* /HD/HIP). otypedef turns
        # SIMBAD's short object-type code into readable text — basic.otype_txt is
        # a cryptic code ("PM*", "a2*"), not the display string we want to bake.
        query = f"""
            SELECT src.id AS src_id, b.sp_type AS sp_type,
                   od.otype_longname AS otype, allids.id AS ident
            FROM ident AS src
            JOIN basic AS b ON b.oid = src.oidref
            LEFT JOIN ident AS allids
                   ON allids.oidref = b.oid AND ({ident_filter})
            LEFT JOIN otypedef AS od ON od.otype = b.otype
            WHERE src.id IN ({id_list})
        """
        table = Simbad.query_tap(query)

        if len(table) >= TAP_ROW_CAP:
            raise RuntimeError(
                f"SIMBAD returned {len(table)} rows for a {len(chunk)}-star chunk, "
                f"at or above the {TAP_ROW_CAP}-row TAP cap — the result is "
                f"truncated and stars would be silently dropped. Lower chunk_size."
            )
        # Group rows by lookup id (one row per identifier).
        by_star: dict = {}
        for row in table:
            rec = by_star.setdefault(
                key(str(row["src_id"])),
                {
                    "idents": [],
                    "sp_type": _clean(row["sp_type"]),
                    "otype": _clean(row["otype"]),
                },
            )
            ident = _clean(row["ident"])
            if ident:
                rec["idents"].append(ident)

        for star_key, rec in by_star.items():
            proper, designation, catalog_ids = build_name_fields(rec["idents"], iau_names)
            out[star_key] = {
                "proper_name": proper,
                "designation": designation,
                "catalog_ids": catalog_ids,
                "spectral_type": rec["sp_type"],
                "object_type": rec["otype"],
                "name_source": name_source_for(catalog_ids, iau_names),
            }
        logger.info("SIMBAD resolved %d/%d so far", len(out), start + len(chunk))
    return out
