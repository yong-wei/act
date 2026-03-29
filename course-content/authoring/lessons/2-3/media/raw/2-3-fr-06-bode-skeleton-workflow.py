import argparse
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Generate 2-3 fr-06 bode skeleton workflow SVG.'
    )
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / '2-3-fr-06-bode-skeleton-workflow.svg',
    )
    return parser.parse_args()


def draw_step(ax, x, y, w, h, title, lines, face_color):
    patch = FancyBboxPatch(
        (x, y),
        w,
        h,
        boxstyle='round,pad=0.015,rounding_size=0.025',
        linewidth=1.6,
        edgecolor='#94a3b8',
        facecolor=face_color,
    )
    ax.add_patch(patch)
    ax.text(x + 0.025, y + h - 0.07, title, fontsize=12, fontweight='bold', color='#0f172a')
    for idx, line in enumerate(lines):
        ax.text(x + 0.025, y + h - 0.14 - idx * 0.058, line, fontsize=9.8, color='#334155')


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()

    fig, ax = plt.subplots(figsize=(12.4, 5.8))
    fig.patch.set_facecolor('#f8fafc')
    ax.set_facecolor('#f8fafc')
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    steps = [
        (
            0.03,
            '第 1 步：写标准型',
            ['先把对象写成比例、积分、惯性、振荡等标准形式', '目的是先认对象属于哪一类'],
            '#eff6ff',
        ),
        (
            0.28,
            '第 2 步：列转折频率',
            ['把每个环节带来的关键频率先列出来', '还不追求精细曲线，只先定“在哪开始变”'],
            '#ecfdf5',
        ),
        (
            0.53,
            '第 3 步：判低频段',
            ['先看最低频率附近的起始高度和起始斜率', '不要一上来就盯高频端'],
            '#fff7ed',
        ),
        (
            0.78,
            '第 4 步：逐段加趋势',
            ['每过一个转折点，就按规则调整斜率', '先画像，再在后续课程里谈精修'],
            '#faf5ff',
        ),
    ]

    width = 0.18
    height = 0.46
    for x, title, lines, color in steps:
        draw_step(ax, x, 0.33, width, height, title, lines, color)

    arrow_y = 0.56
    for start_x in [0.22, 0.47, 0.72]:
        ax.annotate(
            '',
            xy=(start_x + 0.04, arrow_y),
            xytext=(start_x, arrow_y),
            arrowprops=dict(arrowstyle='->', lw=1.8, color='#475569'),
        )

    ax.text(0.5, 0.9, 'Bode 首轮骨架四步流程', ha='center', fontsize=16, fontweight='bold', color='#0f172a')
    ax.text(0.5, 0.84, '课堂目标不是一次画到很精，而是先把对象的趋势结构画对。', ha='center', fontsize=10.2, color='#475569')
    ax.text(0.5, 0.15, '口令：先写标准型，再列转折；先判低频端，再逐段加趋势。', ha='center', fontsize=11, color='#0f172a')

    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
