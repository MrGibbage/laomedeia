"""Create Laomedeia PNG and Windows ICO assets from the approved concept tile."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
CONCEPT = ROOT / "assets" / "branding" / "laomedeia-concept-sheet.png"
SOURCE = ROOT / "assets" / "branding" / "laomedeia-icon.png"
BUILD_PNG = ROOT / "build" / "icon.png"
BUILD_ICO = ROOT / "build" / "icon.ico"
PUBLIC_PNG = ROOT / "public" / "icon.png"

# Pixel bounds of the approved upper-left compass tile in the 1254px concept sheet.
APPROVED_TILE = (131, 107, 591, 567)
SOURCE_SIZE = 1024
CORNER_RADIUS = 182


def rounded_mask(size: int, radius: int) -> Image.Image:
    scale = 4
    mask = Image.new("L", (size * scale, size * scale), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(
        (0, 0, size * scale - 1, size * scale - 1),
        radius=radius * scale,
        fill=255,
    )
    return mask.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    concept = Image.open(CONCEPT).convert("RGBA")
    icon = concept.crop(APPROVED_TILE).resize(
        (SOURCE_SIZE, SOURCE_SIZE), Image.Resampling.LANCZOS
    )
    icon.putalpha(rounded_mask(SOURCE_SIZE, CORNER_RADIUS))

    for parent in {SOURCE.parent, BUILD_PNG.parent, PUBLIC_PNG.parent}:
        parent.mkdir(parents=True, exist_ok=True)

    icon.save(SOURCE, optimize=True)
    icon.save(BUILD_PNG, optimize=True)
    icon.resize((512, 512), Image.Resampling.LANCZOS).save(PUBLIC_PNG, optimize=True)
    icon.save(
        BUILD_ICO,
        format="ICO",
        sizes=[(16, 16), (20, 20), (24, 24), (32, 32), (40, 40), (48, 48),
               (64, 64), (128, 128), (256, 256)],
    )


if __name__ == "__main__":
    main()
