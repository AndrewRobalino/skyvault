"""One-time download of the JPL DE421 SPK kernel.

Astropy's built-in URL mapping for DE421 has drifted with NAIF server changes,
so we pin the download ourselves. The resulting .bsp lives in ``server/data/``
(gitignored) and is loaded directly by ``app.services.ephemeris``.

Run from the ``server/`` directory:

    python scripts/download_ephemeris.py

Source: NAIF/NASA JPL generic kernels.
"""

from __future__ import annotations

import sys
import urllib.error
import urllib.request
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_ROOT))

from app.config import settings  # noqa: E402


# Known-good mirrors for de421.bsp, in order of preference. First success wins.
DE421_URLS: tuple[str, ...] = (
    "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/a_old_versions/de421.bsp",
    "https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de421.bsp",
)


def _download(url: str, dest: Path) -> bool:
    print(f"[download_ephemeris] Trying {url}")
    try:
        with urllib.request.urlopen(url, timeout=60) as response, open(dest, "wb") as f:
            while chunk := response.read(1 << 16):
                f.write(chunk)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
        print(f"[download_ephemeris]   -> failed: {exc}")
        if dest.exists():
            dest.unlink()
        return False
    return True


def main() -> int:
    dest: Path = settings.ephemeris_kernel_path
    dest.parent.mkdir(parents=True, exist_ok=True)

    if dest.exists() and dest.stat().st_size > 0:
        size_mb = dest.stat().st_size / (1024 * 1024)
        print(f"[download_ephemeris] Already present: {dest} ({size_mb:.1f} MB)")
        return 0

    for url in DE421_URLS:
        if _download(url, dest):
            size_mb = dest.stat().st_size / (1024 * 1024)
            print(f"[download_ephemeris] Downloaded DE421: {dest} ({size_mb:.1f} MB)")
            print("[download_ephemeris] Source: NASA JPL NAIF generic kernels")
            return 0

    print("[download_ephemeris] ERROR: all mirrors failed. Check your connection or")
    print("                    update DE421_URLS with a current NAIF mirror.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
