#!/usr/bin/env python3
from __future__ import annotations

import itertools
import json
import math
import subprocess
import sys
from pathlib import Path

import matplotlib

matplotlib.use('Agg')

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Circle


ROOT = Path(__file__).resolve().parent
LESSON_DIR = ROOT.parent
OUTPUT_DIR = LESSON_DIR / 'processed'
DATA_PATH = ROOT / '3-3-plot-data.json'
COURSE_CONTENT_DIR = ROOT.parents[4]

if str(COURSE_CONTENT_DIR / 'scripts') not in sys.path:
    sys.path.insert(0, str(COURSE_CONTENT_DIR / 'scripts'))

from python_media_formula import configure_matplotlib_for_formula_svg  # noqa: E402


OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BG = '#f8fafc'
PANEL = '#ffffff'
TITLE = '#123a63'
INK = '#0f172a'
SUB = '#334155'
MUTED = '#64748b'
GRID = '#d7dee7'
BLUE = '#2563eb'
GREEN = '#16a34a'
ORANGE = '#ea580c'
RED = '#dc2626'
PURPLE = '#7c3aed'
GOLD = '#ca8a04'
TEAL = '#0891b2'


def configure_style(hashsalt: str) -> None:
    configure_matplotlib_for_formula_svg(svg_hashsalt=hashsalt, use_tex=False)
    plt.rcParams['figure.facecolor'] = BG
    plt.rcParams['axes.facecolor'] = PANEL
    plt.rcParams['savefig.facecolor'] = BG
    plt.rcParams['axes.edgecolor'] = GRID
    plt.rcParams['axes.labelcolor'] = SUB
    plt.rcParams['axes.titlecolor'] = TITLE
    plt.rcParams['xtick.color'] = SUB
    plt.rcParams['ytick.color'] = SUB
    plt.rcParams['axes.unicode_minus'] = False
    plt.rcParams['mathtext.fontset'] = 'stix'


def add_round_box(ax, x, y, w, h, fill=PANEL, edge=GRID, radius=0.03, lw=1.8):
    box = FancyBboxPatch(
        (x, y),
        w,
        h,
        boxstyle=f'round,pad=0.008,rounding_size={radius}',
        transform=ax.transAxes,
        linewidth=lw,
        edgecolor=edge,
        facecolor=fill,
    )
    ax.add_patch(box)
    return box


def add_text(ax, x, y, text, *, size=14, color=INK, weight='normal', ha='left', va='top', linespacing=1.45):
    return ax.text(
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


def add_arrow(ax, start, end, color=MUTED, lw=2.2):
    ax.add_patch(
        FancyArrowPatch(
            start,
            end,
            transform=ax.transAxes,
            arrowstyle='-|>',
            mutation_scale=20,
            linewidth=lw,
            color=color,
            shrinkA=0,
            shrinkB=0,
        )
    )


def run_octave_data_script() -> None:
    subprocess.run(
        ['octave', '--quiet', str(ROOT / '3-3-generate-plot-data.m')],
        check=True,
        cwd=ROOT,
    )


def load_plot_data() -> dict:
    run_octave_data_script()
    return json.loads(DATA_PATH.read_text(encoding='utf-8'))


def track_branches(real_matrix: np.ndarray, imag_matrix: np.ndarray) -> np.ndarray:
    roots = real_matrix + 1j * imag_matrix
    root_count, sample_count = roots.shape
    ordered = np.zeros_like(roots, dtype=np.complex128)
    first = sorted(roots[:, 0], key=lambda z: (z.real, z.imag))
    ordered[:, 0] = np.array(first, dtype=np.complex128)
    prev = ordered[:, 0].tolist()
    for column in range(1, sample_count):
        current = roots[:, column].tolist()
        best = None
        best_cost = float('inf')
        for perm in itertools.permutations(current, root_count):
            cost = sum(abs(prev[idx] - perm[idx]) for idx in range(root_count))
            if cost < best_cost:
                best_cost = cost
                best = perm
        ordered[:, column] = np.array(best, dtype=np.complex128)
        prev = list(best)
    return ordered


def styled_plot_axes(fig, rect):
    ax = fig.add_axes(rect)
    for spine in ax.spines.values():
        spine.set_color(GRID)
        spine.set_linewidth(1.2)
    ax.grid(True, color=GRID, linewidth=0.8, alpha=0.75)
    return ax


def render_pp01() -> None:
    configure_style('lesson-3-3-pp01')
    fig = plt.figure(figsize=(12, 6.8))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.axis('off')

    add_text(ax, 0.5, 0.94, '根轨迹主线图', size=26, color=TITLE, weight='bold', ha='center')

    cards = [
        (0.08, 0.62, 0.18, 0.16, '#e0f2fe', BLUE, '参数变化', '增益 / 时间常数 / 反馈系数'),
        (0.31, 0.62, 0.20, 0.16, '#dcfce7', GREEN, '闭环特征方程', r'$1 + G(s)H(s) = 0$'),
        (0.56, 0.62, 0.18, 0.16, '#fef3c7', GOLD, '两大条件', '相角判点位，幅值回参数'),
        (0.79, 0.62, 0.14, 0.16, '#ede9fe', PURPLE, '整张轨迹', '在复平面连续展开'),
    ]
    for x, y, w, h, fill, edge, title, body in cards:
        add_round_box(ax, x, y, w, h, fill=fill, edge=edge, radius=0.02)
        add_text(ax, x + w / 2, y + h - 0.045, title, size=18, weight='bold', ha='center')
        add_text(ax, x + w / 2, y + 0.06, body, size=12.5, color=SUB, ha='center', va='bottom')
    for start, end in [((0.26, 0.70), (0.31, 0.70)), ((0.51, 0.70), (0.56, 0.70)), ((0.74, 0.70), (0.79, 0.70))]:
        add_arrow(ax, start, end)

    lower_cards = [
        (0.12, 0.21, 0.22, 0.20, '法则层', '起点终点、实轴区段、渐近线\n分离点、虚轴交点、起始角'),
        (0.40, 0.21, 0.18, 0.20, '稳定性', '看是否穿越虚轴\n看稳定窗口落在哪里'),
        (0.64, 0.21, 0.24, 0.20, '动态解释', '看实部：响应快慢\n看虚部：振荡与超调趋势'),
    ]
    for x, y, w, h, title, body in lower_cards:
        add_round_box(ax, x, y, w, h)
        add_text(ax, x + w / 2, y + h - 0.035, title, size=17.5, color=TITLE, weight='bold', ha='center')
        add_text(ax, x + w / 2, y + 0.045, body, size=12.3, color=SUB, ha='center', va='bottom')

    add_text(ax, 0.5, 0.08, '先把参数变化转写成闭环特征方程，再用两大条件与完整法则读出轨迹、稳定性和动态后果。', size=14, color=TITLE, weight='bold', ha='center')

    fig.savefig(OUTPUT_DIR / '3-3-pp-01-root-locus-roadmap.svg', format='svg', bbox_inches='tight', pad_inches=0.02)
    plt.close(fig)


def render_pp02() -> None:
    configure_style('lesson-3-3-pp02')
    fig = plt.figure(figsize=(12, 6.8))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.axis('off')

    add_text(ax, 0.5, 0.93, '广义根轨迹扩展关系', size=26, color=TITLE, weight='bold', ha='center')

    blocks = [
        (0.08, 0.55, 0.24, 0.22, '#e0f2fe', BLUE, '普通根轨迹', r'$1 + K G(s)H(s) = 0$', '参数就是开环增益'),
        (0.38, 0.55, 0.24, 0.22, '#dcfce7', GREEN, '广义根轨迹', r'$1 + a \, A(s)/B(s) = 0$', '参数可来自时间常数或结构项'),
        (0.68, 0.55, 0.24, 0.22, '#fef3c7', GOLD, r'$0^\circ$ / $180^\circ$ 根轨迹', '相角目标随参数符号改变', '整图走向也会随之改变'),
    ]
    for x, y, w, h, fill, edge, title, formula, body in blocks:
        add_round_box(ax, x, y, w, h, fill=fill, edge=edge, radius=0.025)
        add_text(ax, x + w / 2, y + h - 0.05, title, size=18, color=INK, weight='bold', ha='center')
        add_text(ax, x + w / 2, y + h / 2, formula, size=16, color=INK, ha='center', va='center')
        add_text(ax, x + w / 2, y + 0.05, body, size=12.5, color=SUB, ha='center', va='bottom')
    add_arrow(ax, (0.32, 0.66), (0.38, 0.66))
    add_arrow(ax, (0.62, 0.66), (0.68, 0.66))

    add_round_box(ax, 0.15, 0.18, 0.70, 0.16, fill='#ffffff', edge=GRID, radius=0.025)
    add_text(ax, 0.5, 0.285, '统一方法', size=20, color=TITLE, weight='bold', ha='center')
    add_text(ax, 0.5, 0.215, '先把参数改写进标准形式，再把起点终点、实轴区段、渐近线和虚轴交点整套法则搬过去。', size=13.5, color=SUB, ha='center', va='bottom')

    fig.savefig(OUTPUT_DIR / '3-3-pp-02-generalized-root-locus-map.svg', format='svg', bbox_inches='tight', pad_inches=0.02)
    plt.close(fig)


def render_pp03() -> None:
    configure_style('lesson-3-3-pp03')
    fig = plt.figure(figsize=(12, 7.2))
    plot_ax = styled_plot_axes(fig, [0.07, 0.16, 0.48, 0.68])
    text_ax = fig.add_axes([0.60, 0.14, 0.34, 0.72])
    text_ax.axis('off')

    fig.text(0.5, 0.93, '相角条件与幅值条件的几何图像', fontsize=26, color=TITLE, weight='bold', ha='center')

    plot_ax.set_xlim(-4.2, 1.2)
    plot_ax.set_ylim(-2.2, 2.2)
    plot_ax.axhline(0, color=SUB, linewidth=1.6)
    plot_ax.axvline(0, color=SUB, linewidth=1.6)
    plot_ax.set_xlabel('实轴 $\\sigma$')
    plot_ax.set_ylabel('虚轴 $j\\omega$')

    poles = np.array([[-2.6, 0.0], [-0.3, 0.0]])
    zeros = np.array([[-3.5, 0.0]])
    s0 = np.array([-1.25, 1.35])

    plot_ax.scatter(poles[:, 0], poles[:, 1], marker='x', s=110, linewidths=2.6, color=RED, zorder=5)
    plot_ax.scatter(zeros[:, 0], zeros[:, 1], marker='o', s=110, linewidths=2.3, facecolors='white', edgecolors=BLUE, zorder=5)
    plot_ax.scatter([s0[0]], [s0[1]], marker='o', s=70, color=PURPLE, zorder=6)
    plot_ax.text(s0[0] + 0.08, s0[1] + 0.10, r'$s_0$', color=PURPLE, fontsize=14)

    for idx, pole in enumerate(poles, start=1):
        plot_ax.annotate('', xy=s0, xytext=pole, arrowprops=dict(arrowstyle='-|>', color=RED, lw=2.0))
        midpoint = (pole + s0) / 2
        plot_ax.text(midpoint[0] - 0.08, midpoint[1] + 0.1, rf'$\theta_{{p{idx}}}$', color=RED, fontsize=13)
    for idx, zero in enumerate(zeros, start=1):
        plot_ax.annotate('', xy=s0, xytext=zero, arrowprops=dict(arrowstyle='-|>', color=BLUE, lw=2.0))
        midpoint = (zero + s0) / 2
        plot_ax.text(midpoint[0] - 0.1, midpoint[1] + 0.12, rf'$\theta_{{z{idx}}}$', color=BLUE, fontsize=13)

    add_round_box(text_ax, 0.02, 0.57, 0.96, 0.32)
    add_text(text_ax, 0.50, 0.84, '相角条件', size=18, color=TITLE, weight='bold', ha='center')
    add_text(text_ax, 0.08, 0.72, r'$\sum \angle (s_0-z_i)-\sum \angle (s_0-p_i)=(2k+1)\,180^\circ$', size=16)
    add_text(text_ax, 0.08, 0.60, '总方向落到负实轴时，$s_0$ 才有资格属于根轨迹。', size=12.8, color=SUB)

    add_round_box(text_ax, 0.02, 0.16, 0.96, 0.32)
    add_text(text_ax, 0.50, 0.43, '幅值条件', size=18, color=TITLE, weight='bold', ha='center')
    add_text(text_ax, 0.08, 0.31, r'$|G(s_0)H(s_0)|=1$', size=17)
    add_text(text_ax, 0.08, 0.20, r'若 $G(s)H(s)=K\,G_0(s)$，则 $K=1/|G_0(s_0)|$。', size=13.0, color=SUB)

    fig.text(0.5, 0.06, '先看总方向是否满足相角条件，再由模值条件回到参数大小，根轨迹上的一点才算真正被确定。', fontsize=14, color=TITLE, weight='bold', ha='center')
    fig.savefig(OUTPUT_DIR / '3-3-pp-03-angle-and-magnitude-geometry.svg', format='svg', bbox_inches='tight', pad_inches=0.02)
    plt.close(fig)


def render_pp04(data: dict) -> None:
    configure_style('lesson-3-3-pp04')
    fig = plt.figure(figsize=(13.2, 8.0))
    plot_ax = styled_plot_axes(fig, [0.06, 0.14, 0.62, 0.74])
    side_ax = fig.add_axes([0.73, 0.15, 0.23, 0.72])
    side_ax.axis('off')

    fig.text(0.5, 0.94, r'完整法则主图：$G(s)=K/[s(s+1)(s+2)]$', fontsize=25, color=TITLE, weight='bold', ha='center')

    roots = track_branches(np.array(data['main_example']['real']), np.array(data['main_example']['imag']))
    for branch, color in zip(roots, [BLUE, GREEN, ORANGE]):
        plot_ax.plot(branch.real, branch.imag, color=color, linewidth=2.1)

    plot_ax.set_xlim(-5.0, 1.0)
    plot_ax.set_ylim(-3.0, 3.0)
    plot_ax.axhline(0, color=SUB, linewidth=1.6)
    plot_ax.axvline(0, color=SUB, linewidth=1.6)
    plot_ax.set_xlabel('实轴 $\\mathrm{Re}(s)$')
    plot_ax.set_ylabel('虚轴 $\\mathrm{Im}(s)$')
    plot_ax.scatter([0, -1, -2], [0, 0, 0], marker='x', s=120, linewidths=2.8, color=RED, zorder=5)

    centroid = -1.0
    for angle_deg in (60, 180, 300):
        rad = math.radians(angle_deg)
        plot_ax.plot(
            [centroid, centroid + 4.0 * math.cos(rad)],
            [0, 4.0 * math.sin(rad)],
            linestyle='--',
            linewidth=1.6,
            color=PURPLE,
            alpha=0.9,
        )
    plot_ax.text(-0.75, 2.35, r'$60^\circ$', color=PURPLE, fontsize=12.5)
    plot_ax.text(-4.15, 0.18, r'$180^\circ$', color=PURPLE, fontsize=12.5)
    plot_ax.text(-0.70, -2.55, r'$300^\circ$', color=PURPLE, fontsize=12.5)
    plot_ax.text(-0.86, 0.24, '渐近线中心 $-1$', color=PURPLE, fontsize=12.5)

    plot_ax.plot([-5.0, -2.0], [0, 0], color=TEAL, linewidth=6, alpha=0.22)
    plot_ax.plot([-1.0, 0.0], [0, 0], color=TEAL, linewidth=6, alpha=0.22)

    break_x = -1 + math.sqrt(3) / 3
    plot_ax.scatter([break_x], [0], s=58, color=ORANGE, zorder=7)
    plot_ax.text(break_x + 0.10, 0.20, r'分离点 $-1+\frac{\sqrt{3}}{3}$', color=ORANGE, fontsize=12.5)

    cross_y = math.sqrt(2)
    plot_ax.scatter([0, 0], [cross_y, -cross_y], s=58, color=GOLD, zorder=7)
    plot_ax.text(-0.78, cross_y + 0.20, r'$K=6,\ s=\pm j\sqrt{2}$', color=GOLD, fontsize=12.5)

    add_round_box(side_ax, 0.02, 0.56, 0.96, 0.36)
    add_text(side_ax, 0.50, 0.88, '一图串起六条常用法则', size=18, color=TITLE, weight='bold', ha='center')
    bullet_items = [
        (0.79, r'起点：$0,\ -1,\ -2$'),
        (0.71, r'实轴区段：$(-\infty,-2)$ 与 $(-1,0)$'),
        (0.62, r'渐近线：中心 $-1$，' '\n' r'角度 $60^\circ/180^\circ/300^\circ$'),
        (0.51, r'分离点：$s=-1+\frac{\sqrt{3}}{3}$' '\n' r'约为 $-0.423$'),
        (0.40, r'虚轴交点：$K=6$，$s=\pm j\sqrt{2}$'),
        (0.33, '分支数：3 条，且关于实轴对称'),
    ]
    for y, line in bullet_items:
        add_text(side_ax, 0.08, y, line, size=11.6, color=SUB, linespacing=1.45)

    add_round_box(side_ax, 0.02, 0.04, 0.96, 0.21, fill='#fffaf1', edge=GOLD)
    add_text(side_ax, 0.08, 0.20, '读图顺序', size=17, color=TITLE, weight='bold')
    add_text(side_ax, 0.08, 0.12, '先看起点终点与实轴区段，再用渐近线搭骨架，\n最后用分离点和虚轴交点修正关键节点。', size=11.6, color=SUB, linespacing=1.5)

    fig.text(0.5, 0.055, '根轨迹草图应先建立整体骨架，再回到关键参数点位做精修。', fontsize=14, color=TITLE, weight='bold', ha='center')
    fig.savefig(OUTPUT_DIR / '3-3-pp-04-complete-rules-example.svg', format='svg', bbox_inches='tight', pad_inches=0.02)
    plt.close(fig)


def render_pp05() -> None:
    configure_style('lesson-3-3-pp05')
    fig = plt.figure(figsize=(12, 5.8))
    plot_ax = styled_plot_axes(fig, [0.08, 0.28, 0.84, 0.46])
    plot_ax.set_xlim(-3.6, 1.1)
    plot_ax.set_ylim(-1.0, 1.0)
    plot_ax.axhline(0, color=SUB, linewidth=2.0)
    plot_ax.set_yticks([])
    plot_ax.set_xlabel('实轴位置')

    fig.text(0.5, 0.91, '实轴区段法则：右侧奇数个实极点/零点时，该段属于根轨迹', fontsize=24, color=TITLE, weight='bold', ha='center')

    for value in [-3, -2, -1, 0, 1]:
        plot_ax.plot([value, value], [-0.08, 0.08], color=SUB, linewidth=1.2)
    plot_ax.scatter([0, -1, -2], [0, 0, 0], marker='x', s=110, linewidths=2.6, color=RED, zorder=4)
    plot_ax.plot([-3.6, -2.0], [0, 0], color=GREEN, linewidth=7, alpha=0.25)
    plot_ax.plot([-1.0, 0.0], [0, 0], color=GREEN, linewidth=7, alpha=0.25)

    samples = [
        (-2.6, 'A', '3 个', '属于'),
        (-1.4, 'B', '2 个', '不属于'),
        (-0.4, 'C', '1 个', '属于'),
        (0.6, 'D', '0 个', '不属于'),
    ]
    for x, label, count, result in samples:
        color = GREEN if result == '属于' else MUTED
        plot_ax.scatter([x], [0], s=58, facecolors='white', edgecolors=color, linewidths=2.0, zorder=5)
        plot_ax.text(x, 0.33, label, ha='center', color=color, fontsize=14, weight='bold')
        plot_ax.text(x, 0.52, count, ha='center', color=color, fontsize=12)
        plot_ax.text(x, -0.42, result, ha='center', color=color, fontsize=12)

    note_ax = fig.add_axes([0.18, 0.08, 0.64, 0.12])
    note_ax.axis('off')
    add_round_box(note_ax, 0.00, 0.00, 1.00, 1.00, fill='#fffaf1', edge=GOLD, radius=0.03)
    add_text(note_ax, 0.5, 0.68, '从观测点向右看，每遇到一个实极点或实零点，总相角都会额外翻转 $180^\circ$。', size=13.5, color=SUB, ha='center')
    add_text(note_ax, 0.5, 0.30, r'翻转次数为奇数时，总相角落到 $(2k+1)\pi$，于是该区段属于 $180^\circ$ 根轨迹。', size=13.5, color=SUB, ha='center')

    fig.savefig(OUTPUT_DIR / '3-3-pp-05-real-axis-parity.svg', format='svg', bbox_inches='tight', pad_inches=0.02)
    plt.close(fig)


def render_pp06() -> None:
    configure_style('lesson-3-3-pp06')
    fig = plt.figure(figsize=(12, 7.0))
    plot_ax = styled_plot_axes(fig, [0.06, 0.16, 0.50, 0.70])
    side_ax = fig.add_axes([0.62, 0.14, 0.32, 0.72])
    side_ax.axis('off')
    fig.text(0.5, 0.93, '起始角 / 终止角：复极点附近要先看切线方向', fontsize=24, color=TITLE, weight='bold', ha='center')

    plot_ax.set_xlim(-5.0, 0.8)
    plot_ax.set_ylim(-3.0, 3.0)
    plot_ax.axhline(0, color=SUB, linewidth=1.6)
    plot_ax.axvline(0, color=SUB, linewidth=1.6)
    plot_ax.set_xlabel('实轴 $\\sigma$')
    plot_ax.set_ylabel('虚轴 $j\\omega$')

    upper = np.array([-2.0, 2.0])
    lower = np.array([-2.0, -2.0])
    real_pole = np.array([-4.0, 0.0])
    zero = np.array([-1.0, 0.0])
    plot_ax.scatter([upper[0], lower[0], real_pole[0]], [upper[1], lower[1], real_pole[1]], marker='x', s=110, linewidths=2.6, color=RED)
    plot_ax.scatter([zero[0]], [zero[1]], marker='o', s=110, linewidths=2.3, facecolors='white', edgecolors=BLUE)
    plot_ax.text(-1.85, 2.18, r'$p_0$', fontsize=13.5, color=RED)

    for target, color, label, shift in [
        (lower, RED, r'$90^\circ$', (-0.5, 0.0)),
        (real_pole, RED, r'$45^\circ$', (-0.7, 0.25)),
        (zero, BLUE, r'$63.4^\circ$', (-0.4, 0.35)),
    ]:
        plot_ax.annotate('', xy=target, xytext=upper, arrowprops=dict(arrowstyle='-|>', color=color, lw=1.9))
        mid = (upper + target) / 2 + np.array(shift)
        plot_ax.text(mid[0], mid[1], label, fontsize=12.5, color=color)

    phi = math.radians(108.4)
    tangent_end = upper + np.array([1.8 * math.cos(phi), 1.8 * math.sin(phi)])
    plot_ax.annotate('', xy=tangent_end, xytext=upper, arrowprops=dict(arrowstyle='-|>', color=PURPLE, lw=2.2))
    plot_ax.text(tangent_end[0] - 0.1, tangent_end[1] + 0.12, r'起始角 $\approx 108.4^\circ$', color=PURPLE, fontsize=12.6)

    add_round_box(side_ax, 0.02, 0.58, 0.96, 0.32)
    add_text(side_ax, 0.5, 0.84, '例：', size=18, color=TITLE, weight='bold', ha='center')
    add_text(side_ax, 0.5, 0.72, r'$G(s)=K\,(s+1)/[(s+4)(s^2+4s+8)]$', size=15.5, ha='center')
    add_text(side_ax, 0.08, 0.58, r'从 $p_0=-2+j2$ 出发：', size=13.2, color=SUB)
    add_text(side_ax, 0.08, 0.47, r'$\phi_d = 180^\circ + 63.4^\circ - 45^\circ - 90^\circ \approx 108.4^\circ$', size=13.2, color=SUB)

    add_round_box(side_ax, 0.02, 0.14, 0.96, 0.33, fill='#fffaf1', edge=GOLD)
    add_text(side_ax, 0.08, 0.41, '读图要点', size=17, color=TITLE, weight='bold')
    add_text(side_ax, 0.08, 0.30, '起始角和终止角负责局部修正。\n先用整图法则确定骨架，\n再用切线方向修正复极点和复零点附近的形状。', size=12.3, color=SUB, linespacing=1.55)

    fig.savefig(OUTPUT_DIR / '3-3-pp-06-departure-arrival-angle.svg', format='svg', bbox_inches='tight', pad_inches=0.02)
    plt.close(fig)


def render_pp07(data: dict) -> None:
    configure_style('lesson-3-3-pp07')
    fig = plt.figure(figsize=(13.2, 7.8))
    left_ax = fig.add_axes([0.05, 0.14, 0.27, 0.74])
    plot_ax = styled_plot_axes(fig, [0.38, 0.16, 0.58, 0.70])
    left_ax.axis('off')
    fig.text(0.5, 0.93, '广义根轨迹例图：时间常数 $T_a$ 改变时的闭环极点迁移', fontsize=24, color=TITLE, weight='bold', ha='center')

    add_round_box(left_ax, 0.02, 0.29, 0.96, 0.64)
    add_text(left_ax, 0.50, 0.88, '从原方程到标准形式', size=18, color=TITLE, weight='bold', ha='center')
    steps = [
        r'$1+\dfrac{1}{(T_a s+1)(s+1)}=0$',
        r'$(T_a s+1)(s+1)+1=0$',
        r'$T_a s^2+(T_a+1)s+2=0$',
        r'$T_a s(s+1)+(s+2)=0$',
        r'$1+T_a\,\dfrac{s(s+1)}{s+2}=0$',
    ]
    ypos = 0.79
    for idx, formula in enumerate(steps):
        add_text(left_ax, 0.08, ypos - idx * 0.112, formula, size=14.4)
        if idx < len(steps) - 1:
            add_arrow(left_ax, (0.50, ypos - idx * 0.112 - 0.048), (0.50, ypos - idx * 0.112 - 0.082))
    add_round_box(left_ax, 0.02, 0.03, 0.96, 0.20, fill='#fffaf1', edge=GOLD)
    add_text(left_ax, 0.08, 0.18, '读图要点', size=16.5, color=TITLE, weight='bold')
    add_text(
        left_ax,
        0.08,
        0.12,
        r'等效开环：$G_e(s)H_e(s)=s(s+1)/(s+2)$' '\n'
        r'轨迹先形成复根，再回到实轴进入有限零点。',
        size=11.2,
        color=SUB,
        linespacing=1.55,
    )

    roots = track_branches(np.array(data['generalized_example']['real']), np.array(data['generalized_example']['imag']))
    for branch, color in zip(roots, [BLUE, GREEN]):
        plot_ax.plot(branch.real, branch.imag, color=color, linewidth=2.2)
    plot_ax.set_xlim(-10.0, 1.2)
    plot_ax.set_ylim(-2.4, 2.4)
    plot_ax.axhline(0, color=SUB, linewidth=1.6)
    plot_ax.axvline(0, color=SUB, linewidth=1.6)
    plot_ax.set_xlabel('实轴 $\\mathrm{Re}(s)$')
    plot_ax.set_ylabel('虚轴 $\\mathrm{Im}(s)$')
    plot_ax.scatter([-2], [0], marker='x', s=120, linewidths=2.8, color=RED)
    plot_ax.scatter([-1, 0], [0, 0], marker='o', s=95, linewidths=2.3, facecolors='white', edgecolors=BLUE)

    critical_t = [3 - 2 * math.sqrt(2), 3 + 2 * math.sqrt(2)]
    critical_x = [-2 - math.sqrt(2), -2 + math.sqrt(2)]
    plot_ax.scatter(critical_x, [0, 0], color=ORANGE, s=54, zorder=6)
    plot_ax.text(-4.05, 0.20, r'$T_a=3-2\sqrt{2}$', color=ORANGE, fontsize=12.4)
    plot_ax.text(-0.95, 0.20, r'$T_a=3+2\sqrt{2}$', color=ORANGE, fontsize=12.4)
    plot_ax.annotate('', xy=(-1.7, 1.45), xytext=(-3.1, 1.45), arrowprops=dict(arrowstyle='-|>', color=GREEN, lw=2.0))
    plot_ax.annotate('', xy=(-0.15, 0.02), xytext=(-0.85, 0.02), arrowprops=dict(arrowstyle='-|>', color=GREEN, lw=2.0))
    plot_ax.text(-1.45, -0.28, '$T_a$ 增大', color=GREEN, fontsize=12.6)

    fig.savefig(OUTPUT_DIR / '3-3-pp-07-generalized-time-constant-example.svg', format='svg', bbox_inches='tight', pad_inches=0.02)
    plt.close(fig)


def render_pp08(data: dict) -> None:
    configure_style('lesson-3-3-pp08')
    fig = plt.figure(figsize=(13.0, 7.8))
    plot_ax = styled_plot_axes(fig, [0.06, 0.16, 0.58, 0.72])
    side_ax = fig.add_axes([0.70, 0.14, 0.26, 0.72])
    side_ax.axis('off')
    fig.text(0.5, 0.93, '根轨迹怎样翻译成动态变化', fontsize=24, color=TITLE, weight='bold', ha='center')

    roots = track_branches(np.array(data['main_example']['real']), np.array(data['main_example']['imag']))
    for branch, color in zip(roots, [BLUE, GREEN, ORANGE]):
        plot_ax.plot(branch.real, branch.imag, color=color, linewidth=2.0)
    plot_ax.set_xlim(-4.8, 0.8)
    plot_ax.set_ylim(-2.6, 2.6)
    plot_ax.axhline(0, color=SUB, linewidth=1.6)
    plot_ax.axvline(0, color=SUB, linewidth=1.6)
    plot_ax.set_xlabel('实轴 $\\mathrm{Re}(s)$')
    plot_ax.set_ylabel('虚轴 $\\mathrm{Im}(s)$')
    plot_ax.scatter([0, -1, -2], [0, 0, 0], marker='x', s=110, linewidths=2.6, color=RED)

    snapshots = [
        (0.8, BLUE, 'K=0.8', '主导极点仍在实轴附近\n响应平缓，振荡较弱'),
        (3.0, ORANGE, 'K=3', '主导极点进入复平面\n开始出现明显振荡'),
        (5.5, PURPLE, 'K=5.5', '共轭极点逼近虚轴\n超调增大，稳定裕量变小'),
    ]

    for idx, (k_value, color, title, body) in enumerate(snapshots):
        coeffs = [1, 3, 2, k_value]
        current_roots = np.roots(coeffs)
        for root in current_roots:
            if abs(root.imag) > 1e-9 or idx == 0:
                plot_ax.scatter(root.real, root.imag, s=46, facecolors='white', edgecolors=color, linewidths=1.8, zorder=6)
        y = 0.84 - idx * 0.27
        add_round_box(side_ax, 0.02, y - 0.14, 0.96, 0.18, fill='#ffffff', edge=GRID)
        add_text(side_ax, 0.50, y, title, size=16, color=TITLE, weight='bold', ha='center')
        add_text(side_ax, 0.50, y - 0.09, body, size=12.3, color=SUB, ha='center', va='top')

    fig.text(0.5, 0.055, '同一条根轨迹在不同参数处，对应的是不同主导极点位置，因此也对应不同动态表现。', fontsize=14, color=TITLE, weight='bold', ha='center')
    fig.savefig(OUTPUT_DIR / '3-3-pp-08-dynamics-translation.svg', format='svg', bbox_inches='tight', pad_inches=0.02)
    plt.close(fig)


def render_example01(data: dict) -> None:
    configure_style('lesson-3-3-example01')
    fig = plt.figure(figsize=(12.6, 7.4))
    plot_ax = styled_plot_axes(fig, [0.06, 0.14, 0.63, 0.74])
    side_ax = fig.add_axes([0.74, 0.14, 0.22, 0.74])
    side_ax.axis('off')

    fig.text(0.5, 0.93, r'例题 1 根轨迹图：$G(s)H(s)=K/[s(s+2)(s+4)]$', fontsize=24, color=TITLE, weight='bold', ha='center')

    roots = track_branches(np.array(data['example1']['real']), np.array(data['example1']['imag']))
    for branch, color in zip(roots, [BLUE, GREEN, ORANGE]):
        plot_ax.plot(branch.real, branch.imag, color=color, linewidth=2.2)

    plot_ax.set_xlim(-8.2, 1.2)
    plot_ax.set_ylim(-4.4, 4.4)
    plot_ax.axhline(0, color=SUB, linewidth=1.6)
    plot_ax.axvline(0, color=SUB, linewidth=1.6)
    plot_ax.set_xlabel('实轴 $\\mathrm{Re}(s)$')
    plot_ax.set_ylabel('虚轴 $\\mathrm{Im}(s)$')
    plot_ax.scatter([0, -2, -4], [0, 0, 0], marker='x', s=120, linewidths=2.8, color=RED, zorder=5)
    plot_ax.text(0.08, 0.24, '$0$', color=RED, fontsize=12)
    plot_ax.text(-2.05, 0.24, '$-2$', color=RED, fontsize=12)
    plot_ax.text(-4.20, 0.24, '$-4$', color=RED, fontsize=12)

    plot_ax.plot([-8.2, -4.0], [0, 0], color=TEAL, linewidth=7, alpha=0.22)
    plot_ax.plot([-2.0, 0.0], [0, 0], color=TEAL, linewidth=7, alpha=0.22)

    centroid = -2.0
    for angle_deg in (60, 180, 300):
        rad = math.radians(angle_deg)
        plot_ax.plot(
            [centroid, centroid + 6.0 * math.cos(rad)],
            [0, 6.0 * math.sin(rad)],
            linestyle='--',
            linewidth=1.6,
            color=PURPLE,
            alpha=0.9,
        )
    plot_ax.scatter([centroid], [0], s=54, color=PURPLE, zorder=6)
    plot_ax.text(centroid + 0.15, 0.35, '重心 $-2$', color=PURPLE, fontsize=12.5)
    plot_ax.text(0.65, 3.25, r'$60^\circ$', color=PURPLE, fontsize=12)
    plot_ax.text(-7.15, 0.22, r'$180^\circ$', color=PURPLE, fontsize=12)
    plot_ax.text(0.60, -3.55, r'$300^\circ$', color=PURPLE, fontsize=12)

    add_round_box(side_ax, 0.02, 0.58, 0.96, 0.32)
    add_text(side_ax, 0.50, 0.86, '关键位置', size=18, color=TITLE, weight='bold', ha='center')
    add_text(side_ax, 0.08, 0.73, '极点：$0,-2,-4$', size=12.2, color=SUB)
    add_text(side_ax, 0.08, 0.63, '实轴区段：$(-\\infty,-4)$ 与 $(-2,0)$', size=12.2, color=SUB)
    add_text(side_ax, 0.08, 0.52, '渐近线重心：$\\sigma_a=-2$', size=12.2, color=SUB)
    add_text(side_ax, 0.08, 0.42, r'渐近线角度：$60^\circ,180^\circ,300^\circ$', size=12.2, color=SUB)

    add_round_box(side_ax, 0.02, 0.15, 0.96, 0.26, fill='#fffaf1', edge=GOLD)
    add_text(side_ax, 0.08, 0.34, '图上阅读顺序', size=16.5, color=TITLE, weight='bold')
    add_text(side_ax, 0.08, 0.24, '先看起点终点与实轴区段，\n再用渐近线判断无穷远方向。', size=12.0, color=SUB, linespacing=1.55)

    fig.savefig(OUTPUT_DIR / '3-3-example-01-skeleton.svg', format='svg', bbox_inches='tight', pad_inches=0.02)
    plt.close(fig)


def render_example02(data: dict) -> None:
    configure_style('lesson-3-3-example02')
    fig = plt.figure(figsize=(12.8, 7.5))
    plot_ax = styled_plot_axes(fig, [0.06, 0.14, 0.63, 0.74])
    side_ax = fig.add_axes([0.74, 0.14, 0.22, 0.74])
    side_ax.axis('off')

    fig.text(0.5, 0.93, r'例题 2 根轨迹图：$G(s)H(s)=K/[s(s+1)(s+2)]$', fontsize=24, color=TITLE, weight='bold', ha='center')

    roots = track_branches(np.array(data['main_example']['real']), np.array(data['main_example']['imag']))
    for branch, color in zip(roots, [BLUE, GREEN, ORANGE]):
        plot_ax.plot(branch.real, branch.imag, color=color, linewidth=2.2)

    plot_ax.set_xlim(-5.2, 1.0)
    plot_ax.set_ylim(-3.1, 3.1)
    plot_ax.axhline(0, color=SUB, linewidth=1.6)
    plot_ax.axvline(0, color=SUB, linewidth=1.6)
    plot_ax.set_xlabel('实轴 $\\mathrm{Re}(s)$')
    plot_ax.set_ylabel('虚轴 $\\mathrm{Im}(s)$')
    plot_ax.scatter([0, -1, -2], [0, 0, 0], marker='x', s=120, linewidths=2.8, color=RED, zorder=5)

    break_x = -1 + math.sqrt(3) / 3
    cross_y = math.sqrt(2)
    plot_ax.scatter([break_x], [0], s=62, color=ORANGE, zorder=7)
    plot_ax.scatter([0, 0], [cross_y, -cross_y], s=58, color=GOLD, zorder=7)
    plot_ax.annotate('分离点\n$(-0.423,0)$', xy=(break_x, 0), xytext=(0.25, 0.95), textcoords='data',
                     arrowprops=dict(arrowstyle='-|>', color=ORANGE, lw=1.8), color=ORANGE, fontsize=12, ha='left')
    plot_ax.annotate(r'虚轴交点' '\n' r'$s=\pm j\sqrt{2}$', xy=(0, cross_y), xytext=(-1.55, 2.1), textcoords='data',
                     arrowprops=dict(arrowstyle='-|>', color=GOLD, lw=1.8), color=GOLD, fontsize=12, ha='left')
    plot_ax.text(-0.58, 1.72, '$K=6$', color=GOLD, fontsize=12)

    add_round_box(side_ax, 0.02, 0.57, 0.96, 0.35)
    add_text(side_ax, 0.50, 0.86, '关键位置', size=18, color=TITLE, weight='bold', ha='center')
    add_text(side_ax, 0.08, 0.73, r'分离点：$d=-1+\frac{\sqrt{3}}{3}$', size=12.1, color=SUB)
    add_text(side_ax, 0.08, 0.62, r'对应增益：$K\approx 0.3849$', size=12.1, color=SUB)
    add_text(side_ax, 0.08, 0.51, r'虚轴交点：$s=\pm j\sqrt{2}$', size=12.1, color=SUB)
    add_text(side_ax, 0.08, 0.40, r'临界增益：$K=6$', size=12.1, color=SUB)

    add_round_box(side_ax, 0.02, 0.15, 0.96, 0.24, fill='#fffaf1', edge=GOLD)
    add_text(side_ax, 0.08, 0.33, '阅读提示', size=16.5, color=TITLE, weight='bold')
    add_text(side_ax, 0.08, 0.22, '同一张图上，先用 $\\mathrm{d}K/\\mathrm{d}s=0$\n找实轴关键点，再用劳斯判据锁定越轴位置。', size=11.8, color=SUB, linespacing=1.55)

    fig.savefig(OUTPUT_DIR / '3-3-example-02-breakaway-crossing.svg', format='svg', bbox_inches='tight', pad_inches=0.02)
    plt.close(fig)


def render_example03(data: dict) -> None:
    configure_style('lesson-3-3-example03')
    fig = plt.figure(figsize=(12.8, 7.5))
    plot_ax = styled_plot_axes(fig, [0.06, 0.14, 0.63, 0.74])
    side_ax = fig.add_axes([0.74, 0.14, 0.22, 0.74])
    side_ax.axis('off')

    fig.text(0.5, 0.93, r'例题 3 根轨迹图：$G(s)H(s)=K/[(s+2)(s^2+2s+5)]$', fontsize=24, color=TITLE, weight='bold', ha='center')

    roots = track_branches(np.array(data['example3']['real']), np.array(data['example3']['imag']))
    for branch, color in zip(roots, [BLUE, GREEN, ORANGE]):
        plot_ax.plot(branch.real, branch.imag, color=color, linewidth=2.2)

    plot_ax.set_xlim(-8.0, 1.2)
    plot_ax.set_ylim(-5.0, 5.0)
    plot_ax.axhline(0, color=SUB, linewidth=1.6)
    plot_ax.axvline(0, color=SUB, linewidth=1.6)
    plot_ax.set_xlabel('实轴 $\\mathrm{Re}(s)$')
    plot_ax.set_ylabel('虚轴 $\\mathrm{Im}(s)$')

    upper = np.array([-1.0, 2.0])
    lower = np.array([-1.0, -2.0])
    real_pole = np.array([-2.0, 0.0])
    plot_ax.scatter([upper[0], lower[0], real_pole[0]], [upper[1], lower[1], real_pole[1]], marker='x', s=120, linewidths=2.8, color=RED, zorder=5)
    plot_ax.text(-0.82, 2.25, r'$-1+j2$', color=RED, fontsize=12)
    plot_ax.text(-0.92, -2.55, r'$-1-j2$', color=RED, fontsize=12)
    plot_ax.text(-2.38, 0.28, r'$-2$', color=RED, fontsize=12)

    dep = math.radians(26.565051)
    for start, sign in [(upper, 1), (lower, -1)]:
        end = start + np.array([2.1 * math.cos(dep), sign * 2.1 * math.sin(dep)])
        plot_ax.annotate('', xy=end, xytext=start, arrowprops=dict(arrowstyle='-|>', color=PURPLE, lw=2.0))
    plot_ax.text(1.05, 3.00, r'$+26.565^\circ$', color=PURPLE, fontsize=12)
    plot_ax.text(1.00, -3.35, r'$-26.565^\circ$', color=PURPLE, fontsize=12)

    add_round_box(side_ax, 0.02, 0.56, 0.96, 0.36)
    add_text(side_ax, 0.50, 0.86, '关键位置', size=18, color=TITLE, weight='bold', ha='center')
    add_text(side_ax, 0.08, 0.73, r'复极点：$-1\pm j2$', size=12.1, color=SUB)
    add_text(side_ax, 0.08, 0.62, r'出射角：$\pm 26.565^\circ$', size=12.1, color=SUB)
    add_text(side_ax, 0.08, 0.51, r'实极点：$-2$', size=12.1, color=SUB)
    add_text(side_ax, 0.08, 0.40, r'根和恒定：$\sum s_i(K)=-4$', size=12.1, color=SUB)

    add_round_box(side_ax, 0.02, 0.15, 0.96, 0.24, fill='#fffaf1', edge=GOLD)
    add_text(side_ax, 0.08, 0.33, '阅读提示', size=16.5, color=TITLE, weight='bold')
    add_text(side_ax, 0.08, 0.22, '先看复极点附近的离开方向，\n再用根之和原则检查整张草图是否自洽。', size=11.8, color=SUB, linespacing=1.55)

    fig.savefig(OUTPUT_DIR / '3-3-example-03-departure-sum.svg', format='svg', bbox_inches='tight', pad_inches=0.02)
    plt.close(fig)


def main() -> None:
    data = load_plot_data()
    render_pp01()
    render_pp02()
    render_pp03()
    render_pp04(data)
    render_pp05()
    render_pp06()
    render_pp07(data)
    render_pp08(data)
    render_example01(data)
    render_example02(data)
    render_example03(data)


if __name__ == '__main__':
    main()
