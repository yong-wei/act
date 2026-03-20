import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Arc

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args():
    parser = argparse.ArgumentParser(description='Generate sh-03 optimal damping SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path('sh-03-root-locus-optimal-damping.svg'),
        help='Output SVG path.',
    )
    return parser.parse_args()


def main():
    args = parse_args()
    configure_matplotlib_for_cjk()

    fig, ax = plt.subplots(figsize=(7, 8))
    ax.set_facecolor('#0f172a')
    fig.patch.set_facecolor('#0f172a')

    cyan = '#22d3ee'
    white = '#f1f5f9'
    orange = '#fb923c'

    K_real = np.linspace(0.001, 1, 100)
    sigma1 = -1 + np.sqrt(1 - K_real)
    sigma2 = -1 - np.sqrt(1 - K_real)
    ax.plot(sigma1, np.zeros_like(sigma1), color=cyan, linewidth=2.5, alpha=0.7)
    ax.plot(sigma2, np.zeros_like(sigma2), color=cyan, linewidth=2.5, alpha=0.7)

    K_complex = np.linspace(1, 12, 300)
    omega = np.sqrt(K_complex - 1)
    ax.plot(-np.ones_like(omega), omega, color=cyan, linewidth=2.5, alpha=0.7, label='根轨迹')
    ax.plot(-np.ones_like(omega), -omega, color=cyan, linewidth=2.5, alpha=0.7)

    t = np.linspace(0, 3.2, 100)
    ax.plot(-t, t, color=orange, linewidth=2, linestyle='--', label='ζ=0.707线（θ=45°）')
    ax.plot(-t, -t, color=orange, linewidth=2, linestyle='--')

    arc = Arc((0, 0), 0.6, 0.6, angle=0, theta1=135, theta2=180, color=orange, lw=1.5)
    ax.add_patch(arc)
    ax.text(-0.45, 0.18, '45°', color=orange, fontsize=9)

    ax.plot([-1, -1], [0, 1], color='#94a3b8', linewidth=1.2, linestyle=':')
    ax.plot([0, -1], [0, 0], color='#94a3b8', linewidth=1.2, linestyle=':')
    ax.text(-0.55, -0.2, '1', color='#94a3b8', fontsize=9, ha='center')
    ax.text(-1.18, 0.5, '1', color='#94a3b8', fontsize=9, ha='right')
    ax.plot([-1, -0.88], [0.12, 0.12], color='#94a3b8', lw=1)
    ax.plot([-0.88, -0.88], [0, 0.12], color='#94a3b8', lw=1)

    ax.plot(-1, 1, 'o', color=cyan, markersize=14, zorder=6)
    ax.plot(-1, -1, 'o', color=cyan, markersize=14, zorder=6)
    ax.annotate(
        '目标极点\ns = -1 + j\n（K=2，ζ=0.707）',
        xy=(-1, 1),
        xytext=(-2.9, 2.2),
        color=cyan,
        fontsize=9.5,
        fontweight='bold',
        arrowprops=dict(arrowstyle='->', color=cyan, lw=1.5),
    )

    result_text = '$\\zeta = \\cos 45° = 0.707$\n极点：$s = -1 \\pm j$\n$K = \\sigma^2 + \\omega_d^2 = 2$'
    ax.text(
        0.05,
        -2.5,
        result_text,
        color=white,
        fontsize=9,
        bbox=dict(boxstyle='round,pad=0.5', facecolor='#1e293b', edgecolor=cyan, alpha=0.9),
    )

    ax.plot(0, 0, 'o', color=white, markersize=6, zorder=5)
    ax.axvline(0, color='#f87171', linewidth=1, linestyle='--', alpha=0.5)
    ax.axhline(0, color=white, linewidth=0.5, alpha=0.3)

    ax.set_xlim(-3.2, 0.8)
    ax.set_ylim(-3.5, 3.5)
    ax.set_xlabel('实部 σ', color='#94a3b8', fontsize=12)
    ax.set_ylabel('虚部 jω', color='#94a3b8', fontsize=12)
    ax.tick_params(colors='#64748b')
    for spine in ax.spines.values():
        spine.set_edgecolor('#334155')

    ax.legend(loc='lower right', fontsize=8.5, facecolor='#1e293b', edgecolor='#334155', labelcolor='#94a3b8')
    ax.set_title('45°射线定位最佳阻尼比（ζ=0.707）\n射线与根轨迹交点对应 K=2', color=white, fontsize=11, pad=12)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout()
    plt.savefig(args.output, format='svg', dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
    plt.close(fig)


if __name__ == '__main__':
    main()
