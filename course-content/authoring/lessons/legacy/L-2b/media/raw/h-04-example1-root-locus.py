import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args():
    parser = argparse.ArgumentParser(description='Generate h-04 example root locus SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path('h-04-example1-root-locus.svg'),
        help='Output SVG path.',
    )
    return parser.parse_args()


def main():
    args = parse_args()
    configure_matplotlib_for_cjk()

    fig, ax = plt.subplots(figsize=(7, 6))
    ax.set_facecolor('#0f172a')
    fig.patch.set_facecolor('#0f172a')

    cyan = '#22d3ee'
    white = '#f1f5f9'

    K_vals = np.linspace(0, 50, 2000)
    roots_upper, roots_lower = [], []

    for K in K_vals:
        coeffs = [1, 5 + K, 3 * K]
        r = np.roots(coeffs)
        r_sorted = sorted(r, key=lambda x: x.imag)
        roots_lower.append(r_sorted[0])
        roots_upper.append(r_sorted[1])

    ru = np.array(roots_upper)
    rl = np.array(roots_lower)
    ax.plot(ru.real, ru.imag, color=cyan, linewidth=2.5)
    ax.plot(rl.real, rl.imag, color=cyan, linewidth=2.5)

    ax.plot(0, 0, 'x', color=white, markersize=12, markeredgewidth=2.5, label='开环极点 ×')
    ax.plot(-5, 0, 'x', color=white, markersize=12, markeredgewidth=2.5)
    ax.plot(-3, 0, 'o', color='#fbbf24', markersize=10, markerfacecolor='none', markeredgewidth=2.5, label='开环零点 ○')

    ax.annotate('p1=(0,0)', xy=(0, 0), xytext=(0.15, 0.4), color=white, fontsize=9)
    ax.annotate('p2=(-5,0)', xy=(-5, 0), xytext=(-5.5, 0.4), color=white, fontsize=9)
    ax.annotate('z=(-3,0)', xy=(-3, 0), xytext=(-3.5, -0.6), color='#fbbf24', fontsize=9)

    ax.plot(-2.5, 0, 'D', color='#f59e0b', markersize=8)
    ax.annotate(
        '分离点≈(-2.5, 0)',
        xy=(-2.5, 0),
        xytext=(-5, -1.5),
        color='#f59e0b',
        fontsize=8.5,
        arrowprops=dict(arrowstyle='->', color='#f59e0b', lw=1),
    )

    ax.axvline(0, color='#f87171', linewidth=1, linestyle='--', alpha=0.5)
    ax.axhline(0, color=white, linewidth=0.5, alpha=0.3)
    ax.set_xlim(-6.5, 1)
    ax.set_ylim(-4, 4)
    ax.set_xlabel('实部 σ', color='#94a3b8', fontsize=11)
    ax.set_ylabel('虚部 jω', color='#94a3b8', fontsize=11)
    ax.tick_params(colors='#64748b')
    for spine in ax.spines.values():
        spine.set_edgecolor('#334155')
    ax.legend(loc='upper right', fontsize=8.5, facecolor='#1e293b', edgecolor='#334155', labelcolor='#94a3b8')
    ax.set_title('例题1：根轨迹图（开环零点z=-3，极点p=0,-5）', color=white, fontsize=10, pad=10)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout()
    plt.savefig(args.output, format='svg', dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
    plt.close(fig)


if __name__ == '__main__':
    main()
