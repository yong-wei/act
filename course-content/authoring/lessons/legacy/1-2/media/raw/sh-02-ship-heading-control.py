import argparse
from pathlib import Path

import matplotlib.patches as patches
import matplotlib.pyplot as plt

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate sh-02 ship heading control SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / 'sh-02-ship-heading-control.svg',
    )
    return parser.parse_args()


def arrow(ax, start, end, color='#334155', lw=2.0, style='->'):
    ax.annotate('', xy=end, xytext=start, arrowprops=dict(arrowstyle=style, lw=lw, color=color))


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()

    fig, ax = plt.subplots(figsize=(13, 4.6))
    ax.set_xlim(-0.8, 13.2)
    ax.set_ylim(-0.4, 4.0)
    ax.axis('off')

    compare = patches.Circle((1.4, 2.2), 0.28, facecolor='#ecfccb', edgecolor='#65a30d', linewidth=2)
    ax.add_patch(compare)
    ax.text(1.4, 2.2, 'Σ', ha='center', va='center', fontsize=13, fontweight='bold')
    ax.text(1.12, 2.42, '$+$', color='#16a34a', fontsize=10)
    ax.text(1.12, 1.85, '$-$', color='#dc2626', fontsize=10)

    ax.text(-0.2, 2.2, '$R(s)$\n期望航向', ha='right', va='center', fontsize=11)
    ax.text(2.25, 2.58, '$E(s)$', ha='center', va='bottom', fontsize=11)
    ax.text(12.4, 2.2, '$Y(s)$\n实际航向', ha='left', va='center', fontsize=11)
    ax.text(1.8, 0.5, '$B(s)$', ha='left', va='center', fontsize=11)

    arrow(ax, (0.0, 2.2), (1.12, 2.2))
    arrow(ax, (1.68, 2.2), (2.6, 2.2))

    blocks = [
        (2.6, '$G_c(s)$', '控制器 PID'),
        (5.1, '$G_a(s)$', '舵机'),
        (7.6, '$G_p(s)$', '船体'),
    ]
    for x, label, title in blocks:
        ax.add_patch(
            patches.FancyBboxPatch((x, 1.8), 1.4, 0.8, boxstyle='round,pad=0.03',
                                   facecolor='#dbeafe', edgecolor='#2563eb', linewidth=2)
        )
        ax.text(x + 0.7, 2.2, label, ha='center', va='center', fontsize=13)
        ax.text(x + 0.7, 1.45, title, ha='center', va='center', fontsize=9, color='#475569')

    arrow(ax, (4.0, 2.2), (5.1, 2.2))
    arrow(ax, (6.5, 2.2), (7.6, 2.2))
    arrow(ax, (9.0, 2.2), (11.8, 2.2))

    ax.plot(10.8, 2.2, 'o', color='black', markersize=6)
    ax.plot([10.8, 10.8], [2.2, 0.95], color='#ea580c', linewidth=1.8)
    ax.plot([10.8, 7.0], [0.95, 0.95], color='#ea580c', linewidth=1.8)
    ax.add_patch(
        patches.FancyBboxPatch((5.2, 0.55), 1.6, 0.8, boxstyle='round,pad=0.03',
                               facecolor='#ffedd5', edgecolor='#ea580c', linewidth=2)
    )
    ax.text(6.0, 0.95, '$H(s)$', ha='center', va='center', fontsize=13)
    ax.text(6.0, 0.35, '罗经', ha='center', va='center', fontsize=9, color='#7c2d12')
    arrow(ax, (5.2, 0.95), (1.4, 0.95), color='#ea580c', lw=1.8)
    arrow(ax, (1.4, 0.95), (1.4, 1.92), color='#ea580c', lw=1.8)

    ax.set_title('船舶航向控制系统结构图', fontsize=14, fontweight='bold', pad=10)
    plt.tight_layout()
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
