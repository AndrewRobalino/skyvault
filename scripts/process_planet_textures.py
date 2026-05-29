"""Downscale Solar System Scope planet/moon JPGs into client/public/textures/planets/.

Usage:
    python scripts/process_planet_textures.py <source_dir>

Where <source_dir> contains the 8 downloaded 2K JPGs from
https://www.solarsystemscope.com/textures/ :
    2k_mercury.jpg, 2k_venus_atmosphere.jpg, 2k_mars.jpg, 2k_jupiter.jpg,
    2k_saturn.jpg, 2k_uranus.jpg, 2k_neptune.jpg, 2k_moon.jpg

Outputs 512x256 JPGs (quality 85) + _credits.json in
client/public/textures/planets/. Idempotent.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

MAPPING = {
    "2k_mercury.jpg": "mercury.jpg",
    "2k_venus_atmosphere.jpg": "venus.jpg",
    "2k_mars.jpg": "mars.jpg",
    "2k_jupiter.jpg": "jupiter.jpg",
    "2k_saturn.jpg": "saturn.jpg",
    "2k_uranus.jpg": "uranus.jpg",
    "2k_neptune.jpg": "neptune.jpg",
    "2k_moon.jpg": "moon.jpg",
}

CREDITS = {
    "license": "CC BY 4.0",
    "license_url": "https://creativecommons.org/licenses/by/4.0/",
    "source_url": "https://www.solarsystemscope.com/textures/",
    "attribution": "Planet & Moon textures © Solar System Scope (INOVE), CC BY 4.0",
    "files": {dest: {"original": src} for src, dest in MAPPING.items()},
}


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2

    src_dir = Path(sys.argv[1]).expanduser().resolve()
    if not src_dir.is_dir():
        print(f"error: {src_dir} is not a directory", file=sys.stderr)
        return 1

    repo_root = Path(__file__).resolve().parent.parent
    out_dir = repo_root / "client" / "public" / "textures" / "planets"
    out_dir.mkdir(parents=True, exist_ok=True)

    missing = [name for name in MAPPING if not (src_dir / name).is_file()]
    if missing:
        print("error: missing source files in", src_dir, file=sys.stderr)
        for name in missing:
            print(f"  - {name}", file=sys.stderr)
        return 1

    for src_name, dest_name in MAPPING.items():
        src = src_dir / src_name
        dest = out_dir / dest_name
        with Image.open(src) as img:
            resized = img.convert("RGB").resize((512, 256), Image.LANCZOS)
            resized.save(dest, format="JPEG", quality=85, optimize=True)
        kb = dest.stat().st_size / 1024
        print(f"  {src_name:28s} -> {dest.relative_to(repo_root)}  ({kb:.1f} KB)")

    credits_path = out_dir / "_credits.json"
    credits_path.write_text(json.dumps(CREDITS, indent=2) + "\n", encoding="utf-8")
    print(f"\nwrote {credits_path.relative_to(repo_root)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
