import argparse
from pathlib import Path

import matplotlib.patches as patches
import matplotlib.pyplot as plt

from matplotlib_font import configure_matplotlib_for_cjk


RULES = [
    ('规则1 比较点前移', '逆流补乘 $G(s)$', 'sum_pre'),
    ('规则2 比较点后移', '顺流补除 $G(s)$', 'sum_post'),
    ('规则3 引出点前移', '逆流补除 $G(s)$', 'pick_pre'),
    ('规则4 引出点后移', '顺流补乘 $G(s)$', 'pick_post'),
    ('规则5 比较点交换', '相邻比较点可交换', 'sum_swap'),
    ('规则6 引出点交换', '相邻引出点可交换', 'pick_swap'),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate sh-03 equivalent transform rules SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / 'sh-03-equivalent-transform-rules.svg',
    )
    return parser.parse_args()


def arrow(ax, start, end, color='#334155', lw=1.4):
    ax.annotate('', xy=end, xytext=start, arrowprops=dict(arrowstyle='->', lw=lw, color=color))


def block(ax, x, y, label, face='#dbeafe', edge='#2563eb'):
    ax.add_patch(patches.FancyBboxPatch((x, y), 0.85, 0.42, boxstyle='round,pad=0.02', facecolor=face, edgecolor=edge, linewidth=1.4))
    ax.text(x + 0.425, y + 0.21, label, ha='center', va='center', fontsize=9)


def summing(ax, x, y):
    ax.add_patch(patches.Circle((x, y), 0.14, facecolor='#ecfccb', edgecolor='#65a30d', linewidth=1.2))
    ax.text(x, y, 'Σ', ha='center', va='center', fontsize=8, fontweight='bold')


def pickoff(ax, x, y):
    ax.plot(x, y, 'o', color='black', markersize=4.5)


def draw_variant(ax, variant, offset=0.0):
    if variant == 'sum_pre':
        summing(ax, 1.0 + offset, 0.55)
        block(ax, 1.35 + offset, 0.34, '$G$')
        block(ax, 0.74 + offset, 0.02, '$G^{-1}$', face='#fee2e2', edge='#dc2626')
        arrow(ax, (0.3 + offset, 0.55), (0.86 + offset, 0.55))
        arrow(ax, (1.14 + offset, 0.55), (1.35 + offset, 0.55))
        arrow(ax, (2.2 + offset, 0.55), (2.7 + offset, 0.55))
    elif variant == 'sum_post':
        block(ax, 0.7 + offset, 0.34, '$G$')
        summing(ax, 1.95 + offset, 0.55)
        block(ax, 1.69 + offset, 0.02, '$G^{-1}$', face='#fee2e2', edge='#dc2626')
        arrow(ax, (0.1 + offset, 0.55), (0.7 + offset, 0.55))
        arrow(ax, (1.55 + offset, 0.55), (1.81 + offset, 0.55))
        arrow(ax, (2.09 + offset, 0.55), (2.7 + offset, 0.55))
    elif variant == 'pick_pre':
        pickoff(ax, 1.0 + offset, 0.55)
        block(ax, 1.35 + offset, 0.34, '$G$')
        block(ax, 1.05 + offset, 0.02, '$G^{-1}$', face='#fee2e2', edge='#dc2626')
        arrow(ax, (0.3 + offset, 0.55), (0.95 + offset, 0.55))
        arrow(ax, (1.05 + offset, 0.55), (1.35 + offset, 0.55))
        ax.plot([1.0 + offset, 1.0 + offset], [0.55, 0.18], color='#334155', linewidth=1.2)
        arrow(ax, (1.05 + offset, 0.18), (1.65 + offset, 0.18), lw=1.2)
    elif variant == 'pick_post':
        block(ax, 0.7 + offset, 0.34, '$G$')
        pickoff(ax, 1.95 + offset, 0.55)
        block(ax, 1.69 + offset, 0.02, '$G$', face='#fee2e2', edge='#dc2626')
        arrow(ax, (0.1 + offset, 0.55), (0.7 + offset, 0.55))
        arrow(ax, (1.55 + offset, 0.55), (1.9 + offset, 0.55))
        arrow(ax, (2.0 + offset, 0.55), (2.7 + offset, 0.55))
        ax.plot([1.95 + offset, 1.95 + offset], [0.55, 0.18], color='#334155', linewidth=1.2)
        arrow(ax, (2.0 + offset, 0.18), (2.6 + offset, 0.18), lw=1.2)
    elif variant == 'sum_swap':
        summing(ax, 0.95 + offset, 0.55)
        summing(ax, 1.95 + offset, 0.55)
        arrow(ax, (0.2 + offset, 0.55), (0.81 + offset, 0.55))
        arrow(ax, (1.09 + offset, 0.55), (1.81 + offset, 0.55))
        arrow(ax, (2.09 + offset, 0.55), (2.7 + offset, 0.55))
    elif variant == 'pick_swap':
        pickoff(ax, 0.95 + offset, 0.55)
        pickoff(ax, 1.95 + offset, 0.55)
        arrow(ax, (0.2 + offset, 0.55), (2.7 + offset, 0.55))
        ax.plot([0.95 + offset, 0.95 + offset], [0.55, 0.18], color='#334155', linewidth=1.2)
        ax.plot([1.95 + offset, 1.95 + offset], [0.55, 0.18], color='#334155', linewidth=1.2)
        arrow(ax, (1.0 + offset, 0.18), (1.45 + offset, 0.18), lw=1.2)
        arrow(ax, (2.0 + offset, 0.18), (2.45 + offset, 0.18), lw=1.2)


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()

    fig, axes = plt.subplots(len(RULES), 2, figsize=(12, 16))
    fig.suptitle('等效变换规则对照图', fontsize=16, fontweight='bold', y=0.995)

    for row, (title, memo, variant) in enumerate(RULES):
        for col in range(2):
            ax = axes[row][col]
            ax.set_xlim(0, 3.2)
            ax.set_ylim(-0.1, 1.1)
            ax.axis('off')
            if col == 0:
                ax.set_title(f'{title}｜变换前', fontsize=10, loc='left')
                draw_variant(ax, variant if 'swap' not in variant else variant)
            else:
                ax.set_title('变换后', fontsize=10, loc='left')
                draw_variant(ax, variant, offset=0.0)
                ax.text(3.05, 0.08, memo, ha='right', va='bottom', fontsize=9, color='#b91c1c')
        axes[row][0].text(3.07, 0.52, '=>', ha='left', va='center', fontsize=16, color='#475569')

    plt.tight_layout(rect=(0, 0, 1, 0.985))
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
