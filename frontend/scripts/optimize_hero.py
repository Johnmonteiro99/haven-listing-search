"""Rebuild the six hero WebP derivatives; run with frontend/.venv Python.

Install Pillow in that ignored tooling environment. Original PNGs are never
modified. Quality 82 is lossy; review the derivatives before changing quality.
"""

from pathlib import Path

from PIL import Image

HERO_DIR = Path(__file__).resolve().parents[1] / "public" / "images" / "hero"

for theme in ("light", "dark"):
    original = HERO_DIR / f"hero-{theme}.png"
    with Image.open(original) as image:
        for width in (640, 1024, 1672):
            height = round(image.height * width / image.width)
            resized = image.resize((width, height), Image.Resampling.LANCZOS)
            target = HERO_DIR / f"hero-{theme}-{width}.webp"
            resized.save(target, format="WEBP", quality=82, method=6)
            print(f"{target.name}: {width}x{height}, {target.stat().st_size} bytes")
