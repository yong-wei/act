#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from PIL import Image


# Deprecated source kept for history only. The maintained Figure 2 source is
# T3-2-root-locus-reading-corrected.m, which uses true root-locus data from
# s^3 + 8s^2 + 12s + K_r = 0 and data-attached Octave arrow helpers.
OUT = Path(__file__).with_name('T3-2-root-locus-reading.png')


def main() -> None:
    plt.rcParams['font.sans-serif'] = [
        'Arial Unicode MS',
        'PingFang SC',
        'Microsoft YaHei',
        'Noto Sans CJK SC',
        'SimHei',
        'DejaVu Sans',
    ]
    plt.rcParams['axes.unicode_minus'] = False
    fig, ax = plt.subplots(figsize=(8.8, 5.4))

    # This is a reading diagram reconstructed from the stated anchor points in
    # the problem stem. It is not a newly inferred transfer-function root locus.
    real_branch = np.linspace(-6.0, 0.0, 300)
    ax.plot(real_branch, np.zeros_like(real_branch), color='#9aa4b2', lw=1.2, ls='--')

    left = np.linspace(-6.0, -1.12, 140)
    right = np.linspace(0.0, -0.82, 100)
    ax.plot(left, np.zeros_like(left), color='#2563eb', lw=2.4)
    ax.plot(right, np.zeros_like(right), color='#2563eb', lw=2.4)

    t = np.linspace(0, 1, 220)
    x = -0.8 + 0.62 * (t ** 1.2)
    y = 2.4 * (t ** 1.05)
    ax.plot(x, y, color='#dc2626', lw=2.4)
    ax.plot(x, -y, color='#dc2626', lw=2.4)

    poles = [(0, 0), (-2, 0), (-6, 0)]
    for px, py in poles:
        ax.plot(px, py, marker='x', markersize=9, markeredgewidth=2.2, color='#111827')
        ax.text(px, py - 0.23, f'{px:g}', ha='center', va='top', fontsize=10)

    anchors = [
        (-0.8, 0.0, '分离点\nKr≈1.6', (0.15, -0.62)),
        (-0.72, 0.78, 'Kr=2', (-0.85, 0.16)),
        (-0.18, 1.92, 'Kr=5', (-0.88, 0.10)),
        (0.0, 2.4, 'j2.4, Kr=6', (0.16, -0.05)),
        (0.0, -2.4, '-j2.4, Kr=6', (0.16, -0.10)),
    ]
    for x0, y0, label, offset in anchors:
        ax.plot(x0, y0, 'o', color='#f97316', markersize=5.8)
        ax.annotate(
            label,
            xy=(x0, y0),
            xytext=(x0 + offset[0], y0 + offset[1]),
            arrowprops={'arrowstyle': '->', 'lw': 1.0, 'color': '#374151'},
            fontsize=9,
            ha='left',
            va='center',
        )

    ax.axvline(0, color='#111827', lw=1.2)
    ax.axhline(0, color='#111827', lw=1.0)
    ax.fill_betweenx([-2.8, 2.8], 0, 0.75, color='#fee2e2', alpha=0.8)
    ax.text(0.34, 2.52, '不稳定侧', color='#991b1b', fontsize=9, ha='center')
    ax.text(-3.5, 2.52, '穿越前稳定侧', color='#1e3a8a', fontsize=9, ha='center')

    ax.annotate('', xy=(-0.58, 0.30), xytext=(-0.78, 0.05),
                arrowprops={'arrowstyle': '->', 'lw': 1.2, 'color': '#dc2626'})
    ax.annotate('', xy=(-0.42, 1.43), xytext=(-0.56, 1.05),
                arrowprops={'arrowstyle': '->', 'lw': 1.2, 'color': '#dc2626'})
    ax.annotate('', xy=(-1.20, 0), xytext=(-1.70, 0),
                arrowprops={'arrowstyle': '->', 'lw': 1.2, 'color': '#2563eb'})

    ax.set_xlim(-6.6, 0.75)
    ax.set_ylim(-2.85, 2.85)
    ax.set_xlabel('实轴')
    ax.set_ylabel('虚轴')
    ax.set_title('根轨迹读图示意（依据题干关键点绘制）')
    ax.grid(True, color='#e5e7eb', linewidth=0.8)
    ax.set_aspect('equal', adjustable='box')
    fig.tight_layout()
    fig.savefig(OUT, dpi=220, bbox_inches='tight', facecolor='white', transparent=False)
    plt.close(fig)

    image = Image.open(OUT)
    if image.mode != 'RGB':
        white = Image.new('RGB', image.size, 'white')
        if image.mode in {'RGBA', 'LA'} or ('transparency' in image.info):
            white.paste(image.convert('RGBA'), mask=image.convert('RGBA').getchannel('A'))
        else:
            white.paste(image.convert('RGB'))
        white.save(OUT)
    print(OUT)


if __name__ == '__main__':
    main()
