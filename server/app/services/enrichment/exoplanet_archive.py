"""NASA Exoplanet Archive ingest-time queries. NOT used on the request path."""

from __future__ import annotations

import logging

from astroquery.ipac.nexsci.nasa_exoplanet_archive import NasaExoplanetArchive

logger = logging.getLogger(__name__)


GAIA_DR3_PREFIX = "Gaia DR3 "


def fetch_exoplanet_hosts(gaia_source_ids: set[str]) -> dict:
    """Return ``{source_id: {count, names}}`` for confirmed-planet hosts whose
    Gaia DR3 id is in ``gaia_source_ids``.

    pscomppars is one row per confirmed planet. The Gaia cross-match column is
    ``gaia_dr3_id`` (NOT ``gaia_id``, which does not exist), formatted as
    'Gaia DR3 12345'. A separate ``gaia_dr2_id`` column exists — do not use it,
    our catalog is DR3 and DR2/DR3 source_ids are not interchangeable.

    Hosts without a Gaia DR3 id can't be matched — honest partial coverage.
    """
    table = NasaExoplanetArchive.query_criteria(
        table="pscomppars", select="pl_name,hostname,gaia_dr3_id"
    )
    out: dict = {}
    for row in table:
        gaia_id = str(row["gaia_dr3_id"]).strip()
        if not gaia_id.startswith(GAIA_DR3_PREFIX):
            continue
        sid = gaia_id[len(GAIA_DR3_PREFIX) :].strip()
        if sid not in gaia_source_ids:
            continue
        name = str(row["pl_name"]).strip()
        entry = out.setdefault(sid, {"count": 0, "names": []})
        # Guard against the archive ever emitting a planet twice under aliases —
        # an inflated count would be a wrong claim in the UI.
        if name and name not in entry["names"]:
            entry["names"].append(name)

    for entry in out.values():
        entry["names"].sort()
        entry["count"] = len(entry["names"])

    logger.info("Exoplanet hosts matched: %d", len(out))
    return out
