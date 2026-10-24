"""Rebuild filter-panel WebP derivatives with frontend/.venv Python and Pillow.

Original matching day/night PNGs are preserved. Quality 82 is lossy; inspect
crops and detail before changing quality. Never upscale beyond source width.
"""
from pathlib import Path
from PIL import Image

FILTERS_DIR = Path(__file__).resolve().parents[1] / "public" / "images" / "filters"

for theme in ("day", "night"):
    with Image.open(FILTERS_DIR / f"haven-filters-panel-{theme}.png") as image:
        for width in (480, image.width):
            height = round(image.height * width / image.width)
            target = FILTERS_DIR / f"haven-filters-panel-{theme}-{width}.webp"
            image.resize((width, height), Image.Resampling.LANCZOS).save(target, format="WEBP", quality=82, method=6)
            print(f"{target.name}: {width}x{height}, {target.stat().st_size} bytes")
