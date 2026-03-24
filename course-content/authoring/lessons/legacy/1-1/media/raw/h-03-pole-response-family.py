#!/usr/bin/env python3
import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args():
    parser = argparse.ArgumentParser(description='Generate pole response family SVG.')
    parser.add_argument('--output', type=Path, default=Path('h-03-pole-response-family.svg'))
    return parser.parse_args()


def main():
    args = parse_args()
    configure_matplotlib_for_cjk()

    t = np.linspace(0, 8, 600)
    fig, axes = plt.subplots(2, 2, figsize=(11.2, 7.6))
    fig.patch.set_facecolor('#f8fafc')

    y1 = 1 - np.exp(-2 * t)
    y2 = 1 - np.exp(-1.0 * t) * (np.cos(2.0 * t) + 0.45 * np.sin(2.0 * t))
    y3 = 1 - np.cos(2 * t)
    y4 = 0.2 + np.exp(0.45 * t) / 5.5

    plots = [
        ('家族1：负实极点', 'p=-2', '单调上升', y1, '#2563eb'),
        ('家族2：共轭复极点', 'p=-1±2j', '振荡衰减', y2, '#dc2626'),
        ('家族3：纯虚极点', 'p=±2j', '持续振荡', y3, '#16a34a'),
        ('家族4：正实部极点', 'p=+0.45', '发散', y4, '#9333ea'),
    ]

    for ax, (title, pole, subtitle, y, color) in zip(axes.flat, plots):
        ax.plot(t, y, color=color, linewidth=2.2)
        ax.axhline(1, color='#94a3b8', linestyle='--', linewidth=1)
        ax.set_title(f'{title}\n{pole}\n{subtitle}', fontsize=10.5)
        ax.grid(True, alpha=0.25)
        ax.set_xlabel('t (s)')
        ax.set_ylabel('y(t)')
        ax.set_facecolor('white')
        for spine in ax.spines.values():
            spine.set_color('#cbd5e1')

    plt.suptitle('四种极点类型与响应家族', fontsize=14, fontweight='bold')
    plt.tight_layout(rect=(0, 0, 1, 0.95))
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
