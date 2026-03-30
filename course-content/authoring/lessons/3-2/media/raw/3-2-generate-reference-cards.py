#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle

COURSE_CONTENT_DIR = Path(__file__).resolve().parents[5]
if str(COURSE_CONTENT_DIR / 'scripts') not in sys.path:
    sys.path.insert(0, str(COURSE_CONTENT_DIR / 'scripts'))

from python_media_formula import (  # noqa: E402
    choose_formula_mode,
    configure_matplotlib_for_formula_svg,
)

ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT.parent / 'processed'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

FIG_SIZE = (16, 9)
BG = '#f7f4ec'
INK = '#1f2937'
MUTED = '#5b6472'
TEAL = '#1f6f78'
ORANGE = '#c96b2c'
GOLD = '#d7a742'
PURPLE = '#7a5ea6'


SPECIAL_CASE_FORMULAS = [
    r'\varepsilon',
    r'b_1 = 0,\ b_2 \neq 0',
    r'A(s)=a s^{m+1}+b s^{m-1}+\cdots',
    r"A'(s)",
]

PARAMETER_FLOW_FORMULAS = [
    r'D(s,k)',
    r's^2,\ s^1,\ s^0',
    r'-2 < k < 18',
    r's = z - \sigma',
    r'\mathrm{Re}(s) < -0.5',
    r'-\frac{3}{8} < k < 4',
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate lesson 3-2 reference cards as formula-safe SVG assets.')
    parser.add_argument(
        '--output',
        help='Optional single output path. Supported names: 3-2-special-cases-card.svg, 3-2-parameter-range-flow.svg',
    )
    return parser.parse_args()


def create_figure(header_fill: str) -> tuple[plt.Figure, plt.Axes]:
    fig, ax = plt.subplots(figsize=FIG_SIZE)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')
    ax.add_patch(Rectangle((0, 0.88), 1, 0.12, transform=ax.transAxes, facecolor=header_fill, edgecolor='none'))
    return fig, ax


def add_round_box(ax: plt.Axes, x: float, y: float, w: float, h: float, fill: str, outline: str, rounding: float = 0.03) -> None:
    ax.add_patch(
        FancyBboxPatch(
            (x, y),
            w,
            h,
            boxstyle=f'round,pad=0.006,rounding_size={rounding}',
            transform=ax.transAxes,
            linewidth=2.0,
            edgecolor=outline,
            facecolor=fill,
        )
    )


def add_text(
    ax: plt.Axes,
    x: float,
    y: float,
    text: str,
    *,
    size: float,
    color: str = INK,
    weight: str = 'normal',
    ha: str = 'left',
    va: str = 'top',
    linespacing: float = 1.45,
) -> None:
    ax.text(
        x,
        y,
        text,
        transform=ax.transAxes,
        fontsize=size,
        color=color,
        fontweight=weight,
        ha=ha,
        va=va,
        linespacing=linespacing,
    )


def add_arrow(ax: plt.Axes, start: tuple[float, float], end: tuple[float, float]) -> None:
    ax.add_patch(
        FancyArrowPatch(
            start,
            end,
            transform=ax.transAxes,
            arrowstyle='-|>',
            mutation_scale=28,
            linewidth=2.4,
            color=INK,
            shrinkA=0,
            shrinkB=0,
        )
    )


def render_special_cases_card(output_path: Path) -> None:
    mode = choose_formula_mode(SPECIAL_CASE_FORMULAS)
    configure_matplotlib_for_formula_svg(svg_hashsalt='lesson-3-2-special-cases-card', use_tex=mode == 'svg-latex-engine')

    fig, ax = create_figure('#efe7d6')
    add_text(ax, 0.045, 0.965, '劳斯表特殊情况处理方法卡', size=30, weight='bold')
    add_text(ax, 0.045, 0.915, '先辨识结构，再进入对应算法；不要把两类情况混成同一套步骤。', size=14, color=MUTED)

    add_round_box(ax, 0.05, 0.18, 0.43, 0.64, '#f2f8f7', TEAL)
    add_round_box(ax, 0.52, 0.18, 0.43, 0.64, '#fcf3eb', ORANGE)

    add_text(ax, 0.068, 0.78, '首位为 0，非全零行', size=20, color=TEAL, weight='bold')
    add_text(ax, 0.538, 0.78, '全零行', size=20, color=ORANGE, weight='bold')

    left_lines = '\n'.join(
        [
            '1. 发现某行第一列为 $0$，但该行仍有非零项。',
            r'2. 用极小正数 $\varepsilon$ 替代首项，保持符号连续性。',
            '3. 继续完成递推，只读取第一列符号变化次数。',
            r'4. $\varepsilon$ 不是物理参数，只服务“连续化”处理。',
        ]
    )
    right_lines = '\n'.join(
        [
            '1. 发现某一整行为 $0$，说明存在对称根结构。',
            r'2. 从上一行直接写出辅助方程 $A(s)$。',
            r"3. 对 $A(s)$ 求导，用导数系数替换全零行。",
            r"4. 先解 $A(s)=0$，再判断是纯虚根还是其他对称根。",
        ]
    )
    add_text(ax, 0.068, 0.705, left_lines, size=16, linespacing=1.55)
    add_text(ax, 0.538, 0.705, right_lines, size=16, linespacing=1.55)

    add_text(ax, 0.068, 0.435, '典型表达：', size=19, color=TEAL, weight='bold')
    add_text(ax, 0.538, 0.435, '典型表达：', size=19, color=ORANGE, weight='bold')

    left_examples = '\n'.join(
        [
            r'$b_1 = 0,\ b_2 \neq 0$',
            r'$0 \rightarrow \varepsilon \rightarrow$ 继续列表',
            r'右半平面根数 $=$ 第一列变号次数',
        ]
    )
    right_examples = '\n'.join(
        [
            r'$s^m$ 行全零',
            r'$A(s)=a s^{m+1}+b s^{m-1}+\cdots$',
            r"用 $A'(s)$ 的系数替换全零行",
        ]
    )
    add_text(ax, 0.068, 0.38, left_examples, size=16, linespacing=1.65)
    add_text(ax, 0.538, 0.38, right_examples, size=16, linespacing=1.65)

    add_round_box(ax, 0.05, 0.06, 0.90, 0.06, '#fffaf1', GOLD, rounding=0.015)
    add_text(
        ax,
        0.075,
        0.095,
        '课堂口令：先辨识，再处理。看到 $0$ 先问“只是首位为 $0$，还是整行全零？”',
        size=16,
    )

    fig.savefig(output_path, format='svg', bbox_inches='tight', pad_inches=0.02)
    plt.close(fig)


def render_parameter_flow(output_path: Path) -> None:
    mode = choose_formula_mode(PARAMETER_FLOW_FORMULAS)
    configure_matplotlib_for_formula_svg(svg_hashsalt='lesson-3-2-parameter-range-flow', use_tex=mode == 'svg-latex-engine')

    fig, ax = create_figure('#ebe6f5')
    add_text(ax, 0.045, 0.965, '参数可行域求解流程图', size=30, weight='bold')
    add_text(ax, 0.045, 0.915, '劳斯判据不止回答“稳不稳”，还回答“参数该落在哪一段里”。', size=14, color=MUTED)

    titles = ['写特征方程', '列劳斯表', '取第一列条件', '合并区间', '若有区域约束']
    bodies = [
        '统一主对象或目标系统的\n$D(s,k)$',
        '先写前两行，再递推出\n$s^2$、$s^1$、$s^0$ 行',
        '把全部首列元素写成\n不等式',
        '得到稳定可行域\n例如 $-2 < k < 18$',
        '先做变量平移\n$s = z - \\sigma$',
    ]
    fills = ['#eef6f7', '#eef6f7', '#fff8ec', '#fff8ec', '#f4eefb']
    outlines = [TEAL, TEAL, GOLD, GOLD, PURPLE]
    x_positions = [0.05, 0.24, 0.43, 0.62, 0.81]
    width = 0.145
    height = 0.24

    for index, (x, title, body, fill, outline) in enumerate(zip(x_positions, titles, bodies, fills, outlines)):
        add_round_box(ax, x, 0.47, width, height, fill, outline, rounding=0.02)
        add_text(ax, x + 0.012, 0.73, title, size=18, weight='bold')
        add_text(ax, x + 0.012, 0.645, body, size=15, color=MUTED, linespacing=1.55)
        if index < len(x_positions) - 1:
            add_arrow(ax, (x + width + 0.008, 0.59), (x_positions[index + 1] - 0.008, 0.59))

    add_round_box(ax, 0.08, 0.12, 0.84, 0.24, '#fffaf1', GOLD, rounding=0.02)
    add_text(ax, 0.10, 0.325, '本课两条代表结论', size=20, weight='bold')
    note_lines = '\n'.join(
        [
            r'稳定底线：$-2 < k < 18$',
            r'若要求 $\mathrm{Re}(s) < -0.5$：先平移，再列劳斯表，得到 $-\frac{3}{8} < k < 4$',
            '出口意识：先保可行域，再在可行域内讨论动态品质与设计选择',
        ]
    )
    add_text(ax, 0.10, 0.26, note_lines, size=16, linespacing=1.65)

    fig.savefig(output_path, format='svg', bbox_inches='tight', pad_inches=0.02)
    plt.close(fig)


OUTPUT_BUILDERS = {
    '3-2-special-cases-card.svg': render_special_cases_card,
    '3-2-parameter-range-flow.svg': render_parameter_flow,
}


def main() -> None:
    args = parse_args()
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        builder = OUTPUT_BUILDERS.get(output_path.name)
        if builder is None:
            supported = ', '.join(sorted(OUTPUT_BUILDERS))
            raise SystemExit(f'Unsupported output `{output_path.name}`. Supported outputs: {supported}')
        builder(output_path)
        return

    for output_name, builder in OUTPUT_BUILDERS.items():
        builder(OUTPUT_DIR / output_name)


if __name__ == '__main__':
    main()
