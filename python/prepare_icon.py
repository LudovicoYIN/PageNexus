from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


def prepare_icon(source: Path, output: Path, crop_size: int, target_size: int, corner_radius: int) -> None:
    image = Image.open(source).convert("RGBA")
    width, height = image.size

    if crop_size > width or crop_size > height:
        raise ValueError(f"crop_size {crop_size} exceeds source dimensions {width}x{height}")

    left = (width - crop_size) // 2
    top = (height - crop_size) // 2
    cropped = image.crop((left, top, left + crop_size, top + crop_size))

    if cropped.size != (target_size, target_size):
        cropped = cropped.resize((target_size, target_size), Image.Resampling.LANCZOS)

    mask = Image.new("L", (target_size, target_size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(
        (0, 0, target_size - 1, target_size - 1),
        radius=corner_radius,
        fill=255,
    )

    rounded = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    rounded.alpha_composite(cropped)
    rounded.putalpha(mask)

    output.parent.mkdir(parents=True, exist_ok=True)
    rounded.save(output)


def main() -> None:
    parser = argparse.ArgumentParser(description="Crop and round an app icon source image.")
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--crop-size", type=int, default=1728)
    parser.add_argument("--target-size", type=int, default=2048)
    parser.add_argument("--corner-radius", type=int, default=460)
    args = parser.parse_args()

    prepare_icon(
        source=args.source,
        output=args.output,
        crop_size=args.crop_size,
        target_size=args.target_size,
        corner_radius=args.corner_radius,
    )


if __name__ == "__main__":
    main()
