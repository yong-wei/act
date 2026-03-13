import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args():
    parser = argparse.ArgumentParser(description='Generate sh-01 pole migration locus SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path('sh-01-pole-migration-locus.svg'),
        help='Output SVG path.',
    )
    return parser.parse_args()


def main():
    args = parse_args()
    configure_matplotlib_for_cjk()

    fig, ax = plt.subplots(figsize=(7, 8))
    ax.set_facecolor('#0f172a')
    fig.patch.set_facecolor('#0f172a')

    # 坐标轴设置
    ax.axhline(0, color='white', linewidth=0.5, alpha=0.4)
    ax.axvline(0, color='#f87171', linewidth=1.2, linestyle='--', alpha=0.7, label='虚轴（稳定边界）')
    ax.set_xlim(-3, 0.8)
    ax.set_ylim(-3.5, 3.5)
    ax.set_xlabel('实部 σ', color='#94a3b8', fontsize=12)
    ax.set_ylabel('虚部 jω', color='#94a3b8', fontsize=12)
    ax.tick_params(colors='#64748b')
    for spine in ax.spines.values():
        spine.set_edgecolor('#334155')

    cyan = '#22d3ee'
    white = '#f1f5f9'

    # K=0~1：两段实轴轨迹
    K_real = np.linspace(0, 1, 100)
    sigma1 = -1 + np.sqrt(1 - K_real)  # 从 0 到 -1
    sigma2 = -1 - np.sqrt(1 - K_real)  # 从 -2 到 -1
    ax.plot(sigma1, np.zeros_like(sigma1), color=cyan, linewidth=2.5)
    ax.plot(sigma2, np.zeros_like(sigma2), color=cyan, linewidth=2.5)

    # K=1~10：复数极点，实部=-1，虚部增大
    K_complex = np.linspace(1, 10, 200)
    omega = np.sqrt(K_complex - 1)
    ax.plot(-np.ones_like(omega), omega, color=cyan, linewidth=2.5)
    ax.plot(-np.ones_like(omega), -omega, color=cyan, linewidth=2.5)

    # 箭头：K增大方向
    ax.annotate('', xy=(-1, 2.2), xytext=(-1, 1.2), arrowprops=dict(arrowstyle='->', color=cyan, lw=1.8))
    ax.annotate('', xy=(-1, -2.2), xytext=(-1, -1.2), arrowprops=dict(arrowstyle='->', color=cyan, lw=1.8))
    ax.annotate('', xy=(-0.3, 0), xytext=(-0.9, 0), arrowprops=dict(arrowstyle='->', color=cyan, lw=1.8))
    ax.annotate('', xy=(-1.7, 0), xytext=(-1.1, 0), arrowprops=dict(arrowstyle='->', color=cyan, lw=1.8))

    # 关键点标注
    ax.plot(0, 0, 'x', color=white, markersize=10, markeredgewidth=2.5)
    ax.annotate('K=0\n(0, 0)', xy=(0, 0), xytext=(0.15, 0.3), color=white, fontsize=9, ha='left')
    ax.plot(-2, 0, 'x', color=white, markersize=10, markeredgewidth=2.5)
    ax.annotate('K=0\n(-2, 0)', xy=(-2, 0), xytext=(-2.9, 0.3), color=white, fontsize=9, ha='left')

    ax.plot(-1, 0, 'D', color='#fbbf24', markersize=9)
    ax.annotate(
        'K=1\n分叉点(-1, 0)',
        xy=(-1, 0),
        xytext=(-2.8, -0.6),
        color='#fbbf24',
        fontsize=9,
        arrowprops=dict(arrowstyle='->', color='#fbbf24', lw=1.2),
    )

    ax.plot(-1, 1, 'o', color=cyan, markersize=10, zorder=5)
    ax.annotate(
        'K=2\nζ=0.707\n(-1, +j)',
        xy=(-1, 1),
        xytext=(-2.8, 1.5),
        color=cyan,
        fontsize=9,
        arrowprops=dict(arrowstyle='->', color=cyan, lw=1.2),
    )

    ax.plot(-1, 2, 'o', color='#f59e0b', markersize=8, zorder=5)
    ax.annotate(
        'K=5\n超调≈20%\n(-1, +2j)',
        xy=(-1, 2),
        xytext=(-2.8, 2.6),
        color='#f59e0b',
        fontsize=9,
        arrowprops=dict(arrowstyle='->', color='#f59e0b', lw=1.2),
    )

    ax.plot(-1, -1, 'o', color=cyan, markersize=10, zorder=5)
    ax.plot(-1, -2, 'o', color='#f59e0b', markersize=8, zorder=5)

    ax.text(-0.6, 2.8, 'K 增大 →', color=cyan, fontsize=9, rotation=90, va='bottom')
    ax.set_title('根轨迹：$G(s)=K/[s(s+2)]$\n极点随增益K的迁移路径', color=white, fontsize=11, pad=12)
    ax.legend(loc='lower right', fontsize=8, facecolor='#1e293b', edgecolor='#334155', labelcolor='#94a3b8')

    args.output.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout()
    plt.savefig(args.output, format='svg', dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
    plt.close(fig)


if __name__ == '__main__':
    main()
