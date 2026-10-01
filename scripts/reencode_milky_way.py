"""Re-encode the ESO/S. Brunier panorama (eso0932a, CC BY 4.0) for the web.

Same 4000x2000 pixels; JPEG quality lowered and progressive encoding on,
so the 4.7 MB original becomes ~1 MB. The change is disclosed in the credits
("re-encoded"), as CC BY 4.0 requires. The original is in git history and at
https://www.eso.org/public/images/eso0932a/.

    python scripts/reencode_milky_way.py <source.jpg> client/public/milky-way.jpg --quality 80

Requires Pillow (like process_planet_textures.py). Without a local Pillow, run
it in a throwaway container:
    docker run --rm -v "${PWD}:/w" -w /w python:3.14-slim sh -c \
      "pip install -q pillow && python scripts/reencode_milky_way.py orig.jpg client/public/milky-way.jpg --quality 80"
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("source", type=Path)
    ap.add_argument("dest", type=Path)
    ap.add_argument("--quality", type=int, default=80)
    # 2 = 4:2:0 chroma (standard for photos; a diffuse starfield shows no
    # difference), 0 = 4:4:4.
    ap.add_argument("--subsampling", type=int, default=2, choices=(0, 1, 2))
    args = ap.parse_args()

    img = Image.open(args.source).convert("RGB")
    assert img.size == (4000, 2000), f"expected 4000x2000, got {img.size}"
    img.save(args.dest, "JPEG", quality=args.quality, progressive=True, optimize=True, subsampling=args.subsampling)
    print(f"{args.dest}: {args.dest.stat().st_size / 1e6:.2f} MB at quality {args.quality}, subsampling {args.subsampling}")


if __name__ == "__main__":
    main()
