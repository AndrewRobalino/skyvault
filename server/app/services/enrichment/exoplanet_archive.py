"""NASA Exoplanet Archive ingest-time queries. NOT used on the request path."""

from __future__ import annotations

import logging

from astroquery.ipac.nexsci.nasa_exoplanet_archive import NasaExoplanetArchive

logger = logging.getLogger(__name__)


GAIA_DR3_PREFIX = "Gaia DR3 "


HIP_PREFIX = "HIP "


def _host_key(row, gaia_source_ids: set[str], hip_ids: set[str]) -> str | None:
    """Which rendered star this planet row belongs to, if any.

    Gaia DR3 id first. The Hipparcos bright-star supplement exists because Gaia
    saturates on those stars, so their archive rows usually have no DR3 id at
    all and are matched on ``hip_name`` instead, keyed ``hip:<HIP>`` like the
    supplement itself.
    """
    gaia_id = str(row["gaia_dr3_id"]).strip()
    if gaia_id.startswith(GAIA_DR3_PREFIX):
        sid = gaia_id[len(GAIA_DR3_PREFIX) :].strip()
        if sid in gaia_source_ids:
            return sid
    hip_name = str(row["hip_name"]).strip()
    if hip_name.startswith(HIP_PREFIX):
        hip = hip_name[len(HIP_PREFIX) :].strip()
        if hip in hip_ids:
            return f"hip:{hip}"
    return None


def hosts_from_rows(
    rows, gaia_source_ids: set[str], hip_ids: set[str] = frozenset()
) -> dict:
    """Aggregate pscomppars rows (one per planet) into ``{key: {count, names}}``."""
    out: dict = {}
    for row in rows:
        key = _host_key(row, gaia_source_ids, hip_ids)
        if key is None:
            continue
        name = str(row["pl_name"]).strip()
        entry = out.setdefault(key, {"count": 0, "names": []})
        # Guard against the archive ever emitting a planet twice under aliases —
        # an inflated count would be a wrong claim in the UI.
        if name and name not in entry["names"]:
            entry["names"].append(name)

    for entry in out.values():
        entry["names"].sort()
        entry["count"] = len(entry["names"])
    return out


def fetch_exoplanet_hosts(
    gaia_source_ids: set[str], hip_ids: set[str] = frozenset()
) -> dict:
    """Return ``{key: {count, names}}`` for confirmed-planet hosts we render.

    Keys are Gaia DR3 source_ids, or ``hip:<HIP>`` for supplement stars.

    pscomppars is one row per confirmed planet. The Gaia cross-match column is
    ``gaia_dr3_id`` (NOT ``gaia_id``, which does not exist), formatted as
    'Gaia DR3 12345'. A separate ``gaia_dr2_id`` column exists — do not use it,
    our catalog is DR3 and DR2/DR3 source_ids are not interchangeable.

    Hosts matching neither id can't be placed — honest partial coverage.
    """
    table = NasaExoplanetArchive.query_criteria(
        table="pscomppars", select="pl_name,hostname,gaia_dr3_id,hip_name"
    )
    out = hosts_from_rows(table, gaia_source_ids, hip_ids)
    logger.info("Exoplanet hosts matched: %d", len(out))
    return out
