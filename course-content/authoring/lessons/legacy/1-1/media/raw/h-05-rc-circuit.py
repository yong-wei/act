#!/usr/bin/env python3
import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as patches

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args():
    parser = argparse.ArgumentParser(description='Generate RC circuit SVG.')
    parser.add_argument('--output', type=Path, default=Path('h-05-rc-circuit.svg'))
    return parser.parse_args()


def main():
    args = parse_args()
    configure_matplotlib_for_cjk()

    fig, ax = plt.subplots(figsize=(8.4, 3.4))
    fig.patch.set_facecolor('#f8fafc')

    ax.plot([0.5, 2.0], [2.2, 2.2], color='#0f172a', linewidth=2)
    ax.plot([5.8, 7.0], [2.2, 2.2], color='#0f172a', linewidth=2)
    ax.plot([0.5, 0.5], [0.6, 2.2], color='#0f172a', linewidth=2)
    ax.plot([7.0, 7.0], [0.6, 2.2], color='#0f172a', linewidth=2)
    ax.plot([0.5, 7.0], [0.6, 0.6], color='#0f172a', linewidth=2)

    # resistor
    resistor_points_x = [2.0, 2.2, 2.45, 2.7, 2.95, 3.2, 3.45, 3.7, 3.95, 4.2]
    resistor_points_y = [2.2, 2.45, 1.95, 2.45, 1.95, 2.45, 1.95, 2.45, 1.95, 2.2]
    ax.plot(resistor_points_x, resistor_points_y, color='#2563eb', linewidth=2.2)
    ax.text(3.1, 2.75, 'R', fontsize=13, color='#2563eb', fontweight='bold')

    # capacitor
    ax.plot([4.8, 4.8], [1.1, 2.2], color='#dc2626', linewidth=2.3)
    ax.plot([5.1, 5.1], [1.1, 2.2], color='#dc2626', linewidth=2.3)
    ax.plot([4.2, 4.8], [2.2, 2.2], color='#0f172a', linewidth=2)
    ax.plot([5.1, 5.8], [2.2, 2.2], color='#0f172a', linewidth=2)
    ax.text(4.95, 2.75, 'C', fontsize=13, color='#dc2626', fontweight='bold', ha='center')

    ax.annotate('', xy=(1.0, 2.95), xytext=(0.25, 2.95), arrowprops=dict(arrowstyle='->', color='#16a34a', lw=2.2))
    ax.text(0.18, 3.02, '$u_i$', fontsize=12, color='#16a34a', ha='left')

    ax.annotate('', xy=(6.7, 2.95), xytext=(5.95, 2.95), arrowprops=dict(arrowstyle='->', color='#7c3aed', lw=2.2))
    ax.text(6.75, 3.02, '$u_o$', fontsize=12, color='#7c3aed', ha='left')

    ax.add_patch(patches.Circle((0.5, 0.6), 0.05, color='#0f172a'))
    ax.add_patch(patches.Circle((7.0, 0.6), 0.05, color='#0f172a'))

    ax.text(3.75, 0.08, '$RC\\dot{u}_o + u_o = u_i$', fontsize=12, ha='center', color='#0f172a')

    ax.set_xlim(0, 7.8)
    ax.set_ylim(0, 3.5)
    ax.axis('off')
    plt.tight_layout()
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
