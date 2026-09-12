"""Crop the approved combined V3 comp into reproducible PNG assets."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


EXPECTED_SOURCE_SIZE = (722, 2178)
PARTS = {
    "comp-desktop-reference.png": (0, 0, 588, 2178),
    "comp-mobile-reference.png": (590, 0, 722, 2178),
    "hero-desktop.png": (272, 41, 588, 270),
    "hero-mobile.png": (600, 45, 709, 131),
    "package-dashboard.png": (21, 587, 170, 711),
    "service-training.png": (21, 875, 183, 978),
    "service-design.png": (204, 875, 366, 978),
    "service-support.png": (389, 875, 566, 978),
    "representative.png": (26, 1300, 211, 1471),
    "logo-reference.png": (13, 12, 36, 35),
    "tool-icons-reference.png": (20, 1725, 568, 1850),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = args.source.resolve()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as image:
        image.load()
        if image.size != EXPECTED_SOURCE_SIZE:
            raise ValueError(
                f"approved comp must be {EXPECTED_SOURCE_SIZE[0]}x{EXPECTED_SOURCE_SIZE[1]}, got {image.width}x{image.height}"
            )
        manifest = {
            "sourceFile": source.name,
            "sourceSize": list(image.size),
            "sourceSha256": sha256(source),
            "parts": {},
        }
        for name, crop in PARTS.items():
            part = image.crop(crop)
            part_path = output / name
            part.save(part_path, format="PNG", optimize=False)
            manifest["parts"][name] = {
                "crop": list(crop),
                "size": list(part.size),
                "sha256": sha256(part_path),
            }

    manifest_path = output / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"cropped {len(PARTS)} assets from {source.name} "
        f"({EXPECTED_SOURCE_SIZE[0]}x{EXPECTED_SOURCE_SIZE[1]}) into {output}"
    )


if __name__ == "__main__":
    main()
