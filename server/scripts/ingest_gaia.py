"""One-time Gaia DR3 ingest.

Queries the ESA Gaia TAP service (via astroquery.gaia) for every source brighter
than the configured G-band magnitude cutoff (default G < 8, ~230k stars), keeps
only the columns SkyVault actually needs, and writes the result as a parquet
file under ``server/data/``.

Run it from the ``server/`` directory:

    python scripts/ingest_gaia.py

Re-running is safe — it overwrites the parquet in place. The file is gitignored
because it's ~20-50 MB and is derived data, not source.

Data source: ESA Gaia DR3 (Gaia Collaboration, 2022), served from
https://gea.esac.esa.int/archive/ via the TAP+ protocol.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

# Allow running as `python scripts/ingest_gaia.py` from the server/ dir.
SERVER_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_ROOT))

from app.config import settings  # noqa: E402


# Columns we actually want from Gaia DR3. Keep this list in sync with the
# documented data contract — every field here must be something we'd reasonably
# show a user or need for coordinate math.
GAIA_COLUMNS: list[str] = [
    "source_id",            # unique Gaia identifier
    "ra",                   # ICRS right ascension (deg), epoch J2016.0
    "dec",                  # ICRS declination (deg), epoch J2016.0
    "pmra",                 # proper motion in RA*cos(dec) (mas/yr)
    "pmdec",                # proper motion in Dec (mas/yr)
    "parallax",             # parallax (mas)
    "parallax_error",       # parallax uncertainty (mas)
    "phot_g_mean_mag",      # G-band apparent magnitude
    "phot_bp_mean_mag",     # BP-band apparent magnitude
    "phot_rp_mean_mag",     # RP-band apparent magnitude
    "bp_rp",                # BP - RP color index
    "radial_velocity",      # radial velocity (km/s)  -- null for most stars
    "teff_gspphot",         # effective temperature from GSP-Phot (K)
    "ruwe",                 # renormalized unit weight error (astrometric quality)
]


def build_query(mag_cutoff: float) -> str:
    """Build an ADQL query pulling every Gaia DR3 source brighter than ``mag_cutoff``."""
    columns = ", ".join(GAIA_COLUMNS)
    return (
        f"SELECT {columns} "
        f"FROM gaiadr3.gaia_source "
        f"WHERE phot_g_mean_mag IS NOT NULL "
        f"  AND phot_g_mean_mag < {mag_cutoff}"
    )


def main() -> int:
    # Import lazily so `pytest` doesn't pay the astroquery import cost.
    from astroquery.gaia import Gaia

    output_path: Path = settings.gaia_parquet_path
    mag_cutoff: float = settings.gaia_mag_cutoff

    output_path.parent.mkdir(parents=True, exist_ok=True)

    query = build_query(mag_cutoff)
    print(f"[ingest_gaia] ESA Gaia DR3 TAP query — G < {mag_cutoff}")
    print(f"[ingest_gaia] Columns ({len(GAIA_COLUMNS)}): {', '.join(GAIA_COLUMNS)}")
    print(f"[ingest_gaia] Output:  {output_path}")
    print("[ingest_gaia] Launching async job (this can take a few minutes)...")

    started = time.perf_counter()

    # Async job is more robust than sync for multi-hundred-thousand-row pulls.
    job = Gaia.launch_job_async(query, dump_to_file=False)
    results = job.get_results()  # astropy.table.Table

    elapsed = time.perf_counter() - started
    row_count = len(results)
    print(f"[ingest_gaia] TAP returned {row_count:,} rows in {elapsed:.1f}s")

    if row_count == 0:
        print("[ingest_gaia] ERROR: query returned 0 rows — refusing to write empty parquet.")
        return 1

    # astropy.table.Table -> pandas -> parquet. Masked values (e.g. missing
    # radial_velocity) become NaN, which parquet handles natively.
    df = results.to_pandas()
    df.to_parquet(output_path, engine="pyarrow", compression="snappy", index=False)

    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"[ingest_gaia] Wrote parquet: {size_mb:.1f} MB, {row_count:,} rows")
    print("[ingest_gaia] Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
