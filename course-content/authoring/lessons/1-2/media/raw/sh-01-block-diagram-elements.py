import argparse
from pathlib import Path

import matplotlib.patches as patches
import matplotlib.pyplot as plt

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate sh-01 block diagram elements SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / 'sh-01-block-diagram-elements.svg',
    )
    return parser.parse_args()


def draw_arrow(ax, start, end, color='#334155', lw=1.8):
    ax.annotate('', xy=end, xytext=start, arrowprops=dict(arrowstyle='->', lw=lw, color=color))


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()

    fig, ax = plt.subplots(figsize=(12, 3.8))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 3.6)
    ax.axis('off')

    for x in (3, 6, 9):
        ax.plot([x, x], [0.4, 3.2], color='#cbd5e1', linestyle='--', linewidth=1)

    # Block
    ax.text(1.5, 3.1, '方框 Block', ha='center', va='center', fontsize=12, fontweight='bold')
    ax.add_patch(
        patches.FancyBboxPatch((0.8, 1.5), 1.4, 0.8, boxstyle='round,pad=0.03',
                               facecolor='#e8f4fd', edgecolor='#2563eb', linewidth=2)
    )
    draw_arrow(ax, (0.2, 1.9), (0.8, 1.9))
    draw_arrow(ax, (2.2, 1.9), (2.8, 1.9))
    ax.text(0.1, 1.9, '$X(s)$', ha='right', va='center', fontsize=11)
    ax.text(2.9, 1.9, '$Y(s)$', ha='left', va='center', fontsize=11)
    ax.text(1.5, 1.9, '$G(s)$', ha='center', va='center', fontsize=13)
    ax.text(1.5, 0.9, '$Y(s)=G(s)X(s)$', ha='center', va='center', fontsize=10, color='#475569')

    # Signal line
    ax.text(4.5, 3.1, '信号线 Signal Line', ha='center', va='center', fontsize=12, fontweight='bold')
    draw_arrow(ax, (3.5, 1.9), (5.5, 1.9), lw=2.2)
    ax.text(4.5, 2.25, '$X(s)$', ha='center', va='bottom', fontsize=11)
    ax.text(4.5, 0.9, '信号沿箭头方向单向传播', ha='center', va='center', fontsize=10, color='#475569')

    # Summing junction
    ax.text(7.5, 3.1, '比较点 Summing Junction', ha='center', va='center', fontsize=12, fontweight='bold')
    circle = patches.Circle((7.5, 1.9), 0.28, facecolor='#ecfccb', edgecolor='#65a30d', linewidth=2)
    ax.add_patch(circle)
    ax.text(7.5, 1.9, 'Σ', ha='center', va='center', fontsize=13, fontweight='bold')
    draw_arrow(ax, (6.4, 2.25), (7.22, 2.02))
    draw_arrow(ax, (7.5, 0.9), (7.5, 1.62))
    draw_arrow(ax, (7.78, 1.9), (8.7, 1.9))
    ax.text(6.25, 2.3, '$R(s)$', ha='right', va='center', fontsize=10)
    ax.text(7.72, 0.82, '$B(s)$', ha='left', va='center', fontsize=10)
    ax.text(8.82, 1.9, '$E(s)$', ha='left', va='center', fontsize=10)
    ax.text(7.16, 2.18, '$+$', color='#16a34a', fontsize=10)
    ax.text(7.66, 1.36, '$-$', color='#dc2626', fontsize=10)
    ax.text(7.5, 0.9, '$E(s)=R(s)-B(s)$', ha='center', va='center', fontsize=10, color='#475569')

    # Pickoff point
    ax.text(10.5, 3.1, '引出点 Pickoff Point', ha='center', va='center', fontsize=12, fontweight='bold')
    ax.plot([9.5, 11.4], [1.9, 1.9], color='#334155', linewidth=2)
    ax.plot(10.3, 1.9, 'o', color='black', markersize=7)
    ax.plot([10.3, 10.3], [1.9, 1.2], color='#334155', linewidth=1.8)
    draw_arrow(ax, (10.3, 1.2), (11.0, 1.2), lw=1.5)
    draw_arrow(ax, (11.0, 1.9), (11.4, 1.9), lw=1.5)
    ax.text(10.5, 0.9, '各支路信号相同', ha='center', va='center', fontsize=10, color='#475569')

    plt.tight_layout()
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
