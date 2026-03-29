import argparse
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Generate 2-3 fr-05 bode axes and typical cards SVG.'
    )
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / '2-3-fr-05-bode-axes-and-typical-cards.svg',
    )
    return parser.parse_args()


def draw_card(ax, x, y, w, h, title, lines, face_color, edge_color):
    patch = FancyBboxPatch(
        (x, y),
        w,
        h,
        boxstyle='round,pad=0.012,rounding_size=0.02',
        linewidth=1.5,
        edgecolor=edge_color,
        facecolor=face_color,
    )
    ax.add_patch(patch)
    ax.text(x + 0.02, y + h - 0.06, title, fontsize=11.5, fontweight='bold', color='#0f172a')
    for idx, line in enumerate(lines):
        ax.text(x + 0.02, y + h - 0.13 - idx * 0.055, line, fontsize=9.4, color='#334155')


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()

    fig = plt.figure(figsize=(12.2, 7.1))
    fig.patch.set_facecolor('#f8fafc')

    ax_left = fig.add_axes([0.05, 0.11, 0.42, 0.78])
    ax_right = fig.add_axes([0.52, 0.08, 0.43, 0.82])

    for ax in [ax_left, ax_right]:
        ax.set_facecolor('#f8fafc')
        ax.set_xticks([])
        ax.set_yticks([])
        for spine in ax.spines.values():
            spine.set_visible(False)

    ax_left.set_xlim(0, 1)
    ax_left.set_ylim(0, 1)
    ax_right.set_xlim(0, 1)
    ax_right.set_ylim(0, 1)

    ax_left.add_patch(Rectangle((0.05, 0.56), 0.88, 0.31, linewidth=1.3, edgecolor='#cbd5e1', facecolor='white'))
    ax_left.add_patch(Rectangle((0.05, 0.14), 0.88, 0.27, linewidth=1.3, edgecolor='#cbd5e1', facecolor='white'))

    ax_left.annotate('', xy=(0.9, 0.60), xytext=(0.12, 0.60), arrowprops=dict(arrowstyle='->', lw=1.6, color='#334155'))
    ax_left.annotate('', xy=(0.18, 0.84), xytext=(0.18, 0.18), arrowprops=dict(arrowstyle='->', lw=1.6, color='#334155'))
    ax_left.text(0.91, 0.58, r'$\log \omega$', fontsize=12, color='#0f172a')
    ax_left.text(0.08, 0.84, r'$20\log_{10}|G(j\omega)|$', fontsize=11.5, color='#0f172a', rotation=90, va='top')
    ax_left.text(0.08, 0.40, r'$\angle G(j\omega)$', fontsize=11.5, color='#0f172a', rotation=90, va='top')

    ax_left.plot([0.18, 0.45, 0.62, 0.88], [0.77, 0.77, 0.63, 0.52], color='#0ea5e9', linewidth=2.4)
    ax_left.plot([0.18, 0.45, 0.62, 0.88], [0.31, 0.31, 0.22, 0.16], color='#8b5cf6', linewidth=2.4)
    for x, label in [(0.45, r'$\omega_1$'), (0.62, r'$\omega_2$')]:
        ax_left.plot([x, x], [0.16, 0.79], linestyle='--', color='#94a3b8', linewidth=1.0)
        ax_left.text(x, 0.11, label, ha='center', fontsize=10, color='#334155')

    ax_left.text(0.05, 0.92, '左侧先认坐标：上图看幅值，下图看相位', fontsize=12.2, fontweight='bold', color='#0f172a')
    ax_left.text(0.23, 0.81, '低频端看起势', fontsize=9.8, color='#0369a1')
    ax_left.text(0.64, 0.67, '转折后斜率变化', fontsize=9.8, color='#0369a1')
    ax_left.text(0.58, 0.24, '相位通常更慢地变化', fontsize=9.6, color='#6d28d9')

    ax_right.text(0.02, 0.95, '右侧做第一判断：先认对象更偏哪一段频率', fontsize=12.2, fontweight='bold', color='#0f172a')
    draw_card(ax_right, 0.02, 0.68, 0.45, 0.20, '比例环节', ['全频段等比例通过', '幅值整体平移', '相位基本不变'], '#eff6ff', '#60a5fa')
    draw_card(ax_right, 0.52, 0.68, 0.45, 0.20, '积分环节', ['更偏低频', '幅值随频率升高而降', '相位长期滞后'], '#ecfdf5', '#34d399')
    draw_card(ax_right, 0.02, 0.40, 0.45, 0.20, '微分环节', ['更偏高频', '幅值随频率升高而升', '相位长期超前'], '#fff7ed', '#fb923c')
    draw_card(ax_right, 0.52, 0.40, 0.45, 0.20, '一阶惯性环节', ['低频基本通过', '过转折后逐步压高频', '相位逐渐拖后'], '#faf5ff', '#c084fc')
    draw_card(ax_right, 0.27, 0.12, 0.45, 0.20, '振荡环节', ['某一段频率可能更敏感', '两侧又会回落', '后续再谈峰起与阻尼'], '#fefce8', '#facc15')

    fig.suptitle('Bode 图先认两件事：坐标含义与典型环节第一判断', fontsize=15, fontweight='bold', y=0.97)
    fig.text(0.5, 0.025, '本讲只要求学生先会“看坐标、认对象、判趋势”，不提前扩成复杂作图技巧训练。', ha='center', fontsize=10, color='#475569')
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
