"""Earth-orientation (IERS) data for an offline server.

Astropy normally downloads fresh IERS-A tables on demand. In production there
is no network, and with downloads simply disabled every date past the bundled
table's 30-day prediction window raises. So:

* ``auto_download = False``: never reach for the network. In astropy 7.2 this
  makes IERS_Auto use the bundled ``astropy-iers-data`` table (the download
  cache is ignored), which the Docker build refreshes and the monthly rebuild
  keeps current.
* ``auto_max_age = None``: accept predictions of any age. Verified 2026-09-28:
  1900, today, 2035 and 2100 all transform, worst difference vs. fresh data ~2"
  even with six-month-old tables.
"""

from __future__ import annotations

from astropy.utils import iers


def configure_offline_iers() -> None:
    iers.conf.auto_download = False
    iers.conf.auto_max_age = None
