"""Build responsive footer WebPs with the existing frontend/.venv Pillow tool.

Quality 82 is lossy. Keep the original PNGs and visually review derivatives
when changing these settings. Paths do not depend on the working directory.
"""

from pathlib import Path

from PIL import Image

FOOTER_DIR = Path(__file__).resolve().parents[1] / "public" / "images" / "footer"

for theme in ("light", "dark"):
    with Image.open(FOOTER_DIR / f"footer-{theme}.png") as image:
        for width in (640, 1024):
            height = round(image.height * width / image.width)
            resized = image.resize((width, height), Image.Resampling.LANCZOS)
            target = FOOTER_DIR / f"footer-{theme}-{width}.webp"
            resized.save(target, format="WEBP", quality=82, method=6)
            print(f"{target.name}: {width}x{height}, {target.stat().st_size} bytes")
