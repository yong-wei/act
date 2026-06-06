#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image


RAW_DIR = Path(__file__).resolve().parent
DATA_DIR = RAW_DIR / 'generated-data'
OUT_DIR = RAW_DIR.parent / 'processed'


matplotlib.rcParams['font.family'] = 'sans-serif'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'STHeiti', 'Arial Unicode MS', 'Arial Unicode', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'


def flatten_to_white(path: Path) -> None:
    image = Image.open(path).convert('RGBA')
    background = Image.new('RGBA', image.size, (255, 255, 255, 255))
    Image.alpha_composite(background, image).convert('RGB').save(path)


def save(fig: plt.Figure, filename: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / filename
    fig.savefig(path, dpi=220, facecolor='white', bbox_inches='tight')
    plt.close(fig)
    flatten_to_white(path)


def main() -> None:
    # Replace with lesson-specific data loading and plotting.
    x = np.linspace(0, 1, 100)
    fig, ax = plt.subplots(figsize=(7.2, 4.2))
    ax.plot(x, x, linewidth=2.0)
    ax.grid(True, color='#d9dee5', linewidth=0.7)
    ax.set_xlabel('x')
    ax.set_ylabel('y')
    save(fig, 'example.png')


if __name__ == '__main__':
    main()
