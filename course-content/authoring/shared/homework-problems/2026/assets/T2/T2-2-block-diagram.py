#!/usr/bin/env python3
from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image


HERE = Path(__file__).resolve().parent
TEX_PATH = HERE / 'T2-2-block-diagram.tex'
PNG_PATH = HERE / 'T2-2-block-diagram.png'
COMPILER = Path.home() / '.agents/skills/tikz-control-draw/scripts/compile_to_png.py'


def main() -> int:
    if not TEX_PATH.is_file():
        raise SystemExit(f'Missing TikZ source: {TEX_PATH}')
    if not COMPILER.is_file():
        raise SystemExit(f'Missing tikz-control-draw compiler: {COMPILER}')

    subprocess.run(
        ['python3', str(COMPILER), str(TEX_PATH), str(PNG_PATH), '300'],
        check=True,
    )
    image = Image.open(PNG_PATH)
    if image.mode != 'RGB':
        white = Image.new('RGB', image.size, 'white')
        if image.mode in {'RGBA', 'LA'} or ('transparency' in image.info):
            rgba = image.convert('RGBA')
            white.paste(rgba, mask=rgba.getchannel('A'))
        else:
            white.paste(image.convert('RGB'))
        white.save(PNG_PATH)
    print(PNG_PATH)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
