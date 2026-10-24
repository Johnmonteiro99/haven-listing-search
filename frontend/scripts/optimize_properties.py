"""Build responsive property illustrations; preserve the original PNG sources."""
from pathlib import Path
from PIL import Image

IMAGE_DIR = Path(__file__).resolve().parents[1] / "public/images/properties"


def main() -> None:
    """Resize all six illustrations to 480/800px, using lossy WebP quality 82."""
    for source in sorted(IMAGE_DIR.glob("*.png")):
        with Image.open(source) as original:
            for width in (480, 800):
                height = round(original.height * width / original.width)
                resized = original.resize((width, height), Image.Resampling.LANCZOS)
                target = source.with_name(f"{source.stem}-{width}.webp")
                resized.save(target, "WEBP", quality=82, method=6)
                print(f"{target.name}: {width}x{height}, {target.stat().st_size} bytes")


if __name__ == "__main__":
    main()
