#!/usr/bin/env python3
import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args():
    parser = argparse.ArgumentParser(description='Generate spring-mass-damper SVG.')
    parser.add_argument('--output', type=Path, default=Path('h-01-spring-mass-damper.svg'))
    return parser.parse_args()


def main():
    args = parse_args()
    configure_matplotlib_for_cjk()

    fig, ax = plt.subplots(figsize=(8, 3.4))
    fig.patch.set_facecolor('#f8fafc')

    ax.add_patch(patches.Rectangle((-0.65, 0.2), 0.3, 2.6, hatch='///', facecolor='#e2e8f0', edgecolor='#334155'))
    ax.plot([-0.35, 0.0], [2.2, 2.2], color='#334155', linewidth=2)
    ax.plot([-0.35, 0.0], [0.8, 0.8], color='#334155', linewidth=2)

    spring_x = np.array([0.0, 0.25, 0.45, 0.65, 0.85, 1.05, 1.25, 1.45, 1.7])
    spring_y = np.array([2.2, 2.2, 2.5, 1.9, 2.5, 1.9, 2.5, 2.2, 2.2])
    ax.plot(spring_x, spring_y, color='#2563eb', linewidth=2.3)
    ax.text(0.9, 2.65, 'k', fontsize=13, color='#2563eb', fontweight='bold')

    ax.add_patch(patches.Rectangle((0.25, 0.55), 0.55, 0.5, facecolor='white', edgecolor='#dc2626', linewidth=2))
    ax.plot([0.0, 0.25], [0.8, 0.8], color='#dc2626', linewidth=2)
    ax.plot([0.8, 1.5], [0.8, 0.8], color='#dc2626', linewidth=2)
    ax.plot([0.25, 0.25], [0.5, 1.1], color='#dc2626', linewidth=2)
    ax.text(0.55, 0.18, 'b', fontsize=13, color='#dc2626', fontweight='bold')

    ax.add_patch(
        patches.FancyBboxPatch(
            (1.7, 0.45),
            1.2,
            1.95,
            boxstyle='round,pad=0.06',
            facecolor='#cbd5e1',
            edgecolor='#0f172a',
            linewidth=2,
        )
    )
    ax.text(2.3, 1.42, 'm', ha='center', va='center', fontsize=15, color='#0f172a', fontweight='bold')

    ax.annotate('', xy=(3.85, 1.42), xytext=(3.0, 1.42), arrowprops=dict(arrowstyle='->', color='#16a34a', lw=2.5))
    ax.text(3.95, 1.42, 'f(t)', ha='left', va='center', fontsize=12, color='#16a34a')

    ax.annotate('', xy=(2.9, 2.8), xytext=(1.75, 2.8), arrowprops=dict(arrowstyle='->', color='#0f172a', lw=1.6))
    ax.text(2.32, 3.02, 'x(t)', ha='center', va='bottom', fontsize=12, color='#0f172a')

    ax.set_xlim(-0.9, 4.4)
    ax.set_ylim(-0.1, 3.3)
    ax.set_aspect('equal')
    ax.axis('off')
    plt.tight_layout()
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
