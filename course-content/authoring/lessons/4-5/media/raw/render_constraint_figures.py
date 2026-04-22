from __future__ import annotations

import json
import logging
import os
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import ticker
import numpy as np
from PIL import Image

DATA_PATH = Path(__file__).resolve().parent / 'generated-data' / '4-5-constraint-data.json'
OUT_DIR = Path(__file__).resolve().parent.parent / 'processed'

matplotlib.rcParams['font.family'] = 'Hiragino Sans GB'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'Arial Unicode MS', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'
warnings.filterwarnings('ignore', message=r"Font 'default' does not have a glyph for .*")
logging.getLogger('matplotlib').setLevel(logging.ERROR)

COLORS = {
    'initial': '#4c78a8',
    'weak': '#e45756',
    'constrained': '#2b8a3e',
    'same_weight_initial': '#4c78a8',
    'same_weight_unconstrained': '#f58518',
    'same_weight_constrained': '#2b8a3e',
    'weight_a': '#e45756',
    'weight_b': '#72b7b2',
    'weight_c': '#54a24b',
    'structure_leadlag': '#4c78a8',
    'structure_pid': '#e45756',
    'grid': '#dddddd',
}


def load_payload() -> dict:
    with DATA_PATH.open(encoding='utf-8') as handle:
        return json.load(handle)


def flatten_to_white(path: Path) -> None:
    image = Image.open(path).convert('RGBA')
    background = Image.new('RGBA', image.size, (255, 255, 255, 255))
    Image.alpha_composite(background, image).convert('RGB').save(path)


def save(fig: plt.Figure, filename: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / filename
    fig.savefig(path, dpi=220, facecolor='white', bbox_inches='tight')
    plt.close(fig)
    flatten_to_white(path)


def style_axis(ax: plt.Axes, log_x: bool = False) -> None:
    ax.grid(True, color=COLORS['grid'], linewidth=0.7)
    ax.set_facecolor('white')
    formatter = ticker.FuncFormatter(lambda x, pos: f'{x:g}')
    ax.yaxis.set_major_formatter(formatter)
    if log_x:
        ax.set_xscale('log')


def by_id(items: list[dict], item_id: str) -> dict:
    for item in items:
        if item['id'] == item_id:
            return item
    raise KeyError(item_id)


def plot_bundle(
    items: list[dict],
    title: str,
    filename: str,
    peak_note: str,
    *,
    limit: float,
    x_max: float,
) -> None:
    fig, axes = plt.subplots(2, 2, figsize=(13.2, 9.2), dpi=220)
    ax_step, ax_mag = axes[0]
    ax_u, ax_phase = axes[1]

    for ax in (ax_step, ax_u):
        style_axis(ax)
    for ax in (ax_mag, ax_phase):
        style_axis(ax, log_x=True)

    for item in items:
        color = COLORS[item['id']]
        t = np.asarray(item['response']['t'], dtype=float)
        y = np.asarray(item['response']['y'], dtype=float)
        tu = np.asarray(item['control']['t'], dtype=float)
        u = np.asarray(item['control']['y'], dtype=float)
        w = np.asarray(item['open_loop']['w'], dtype=float)
        mag_db = np.asarray(item['open_loop']['mag_db'], dtype=float)
        phase_deg = np.asarray(item['open_loop']['phase_deg'], dtype=float)

        ax_step.plot(t, y, color=color, linewidth=2.1, label=item['label'])
        ax_u.plot(tu, u, color=color, linewidth=2.1, label=item['label'])
        ax_mag.plot(w, mag_db, color=color, linewidth=2.1, label=item['label'])
        ax_phase.plot(w, phase_deg, color=color, linewidth=2.1, label=item['label'])

    ax_step.axhline(1.0, color='#666666', linestyle='--', linewidth=0.9)
    ax_step.set_title('闭环输出阶跃响应')
    ax_step.set_xlabel('时间 / s')
    ax_step.set_ylabel('输出')
    ax_step.set_xlim(0, x_max)
    ax_step.legend(frameon=False, fontsize=9)

    ax_u.axhline(limit, color='#444444', linestyle='--', linewidth=0.9)
    ax_u.axhline(-limit, color='#444444', linestyle='--', linewidth=0.9)
    ax_u.set_title('控制量响应')
    ax_u.set_xlabel('时间 / s')
    ax_u.set_ylabel('控制量')
    ax_u.set_xlim(0, x_max)

    ax_mag.axhline(0, color='#666666', linestyle='--', linewidth=0.9)
    ax_mag.set_title('开环幅频特性')
    ax_mag.set_xlabel(r'$\omega$ / rad/s')
    ax_mag.set_ylabel('幅值 / dB')

    ax_phase.axhline(-180, color='#666666', linestyle='--', linewidth=0.9)
    ax_phase.set_title('开环相频特性')
    ax_phase.set_xlabel(r'$\omega$ / rad/s')
    ax_phase.set_ylabel('相位 / deg')

    fig.suptitle(title, fontsize=15, y=0.98)
    fig.text(0.5, 0.01, peak_note, ha='center', va='bottom', fontsize=10)
    save(fig, filename)


def plot_weight_sweep_summary(entries: list[dict], filename: str) -> None:
    labels = [item['label'] for item in entries]
    x = np.arange(len(labels))
    width = 0.18

    settling = [item['metrics']['settling_time'] for item in entries]
    itae = [item['metrics']['itae'] for item in entries]
    control_energy = [item['metrics']['control_energy'] for item in entries]
    overshoot = [item['metrics']['overshoot'] for item in entries]
    control_peak = [item['metrics']['control_peak'] for item in entries]
    phase_margin = [item['metrics']['phase_margin'] for item in entries]

    fig, axes = plt.subplots(1, 2, figsize=(13.2, 5.6), dpi=220)
    ax_left, ax_right = axes
    style_axis(ax_left)
    style_axis(ax_right)

    ax_left.bar(x - width, settling, width=width, label='调节时间 / s', color='#4c78a8')
    ax_left.bar(x, itae, width=width, label='ITAE', color='#72b7b2')
    ax_left.bar(x + width, control_energy, width=width, label='控制能量', color='#54a24b')
    ax_left.set_xticks(x, labels)
    ax_left.set_title('约束内权重变化对软目标分配的影响')
    ax_left.set_ylabel('指标值')
    ax_left.legend(frameon=False, fontsize=9)

    ax_right.plot(x, overshoot, marker='o', linewidth=2.0, color='#e45756', label='超调 / %')
    ax_right.plot(x, control_peak, marker='s', linewidth=2.0, color='#f58518', label='控制峰值')
    ax_right.plot(x, phase_margin, marker='^', linewidth=2.0, color='#2b8a3e', label='相角裕度 / deg')
    ax_right.axhline(20, color='#e45756', linestyle='--', linewidth=0.9)
    ax_right.axhline(7, color='#f58518', linestyle='--', linewidth=0.9)
    ax_right.axhline(45, color='#2b8a3e', linestyle='--', linewidth=0.9)
    ax_right.set_xticks(x, labels)
    ax_right.set_title('约束内可行解的边界占用情况')
    ax_right.set_ylabel('读数')
    ax_right.legend(frameon=False, fontsize=9)

    fig.suptitle('同一结构下，权重改变会重排可行解的收益分布', fontsize=15, y=1.02)
    save(fig, filename)


def main() -> None:
    payload = load_payload()

    initial = by_id(payload['entries'], 'initial')
    weak = by_id(payload['entries'], 'weak')
    constrained = by_id(payload['entries'], 'constrained')
    same_weight_items = payload['same_weight']['entries']
    structure_items = payload['structure_case']['entries']

    same_weight_unconstrained = by_id(same_weight_items, 'same_weight_unconstrained')
    same_weight_constrained = by_id(same_weight_items, 'same_weight_constrained')
    structure_pid = by_id(structure_items, 'structure_pid')
    structure_leadlag = by_id(structure_items, 'structure_leadlag')

    plot_bundle(
        [initial, weak],
        '客船航向保持：若不显性引入约束，候选解会先滑向不可用区域',
        '4-5-ship-heading-unconstrained-failure-compare.png',
        (
            f"弱约束候选：超调 {weak['metrics']['overshoot']:.2f}% ，"
            f"控制峰值 {weak['metrics']['control_peak']:.2f} ，"
            f"相角裕度 {weak['metrics']['phase_margin']:.2f}°"
        ),
        limit=7.0,
        x_max=120.0,
    )
    plot_bundle(
        [initial, weak, constrained],
        '客船航向保持：加入显性约束后，参数优化才回到可用设计空间',
        '4-5-ship-heading-constraint-closure-compare.png',
        (
            f"带约束可用解：超调 {constrained['metrics']['overshoot']:.2f}% ，"
            f"控制峰值 {constrained['metrics']['control_peak']:.2f} ，"
            f"相角裕度 {constrained['metrics']['phase_margin']:.2f}°"
        ),
        limit=7.0,
        x_max=120.0,
    )
    plot_bundle(
        same_weight_items,
        '平衡权重下：无约束最优与带约束最优为什么会分出两组不同解',
        '4-5-ship-heading-same-weight-constraint-compare.png',
        (
            f"同权重无约束解：峰值 {same_weight_unconstrained['metrics']['control_peak']:.2f} ，"
            f"同权重带约束解：峰值 {same_weight_constrained['metrics']['control_peak']:.2f}"
        ),
        limit=7.0,
        x_max=120.0,
    )
    plot_weight_sweep_summary(
        payload['weight_sweep']['entries'],
        '4-5-weight-sweep-constrained-summary.png',
    )
    plot_bundle(
        structure_items,
        '客船航向保持：同一性能指标函数下，结构改变会把最优点带向不同区间',
        '4-5-ship-heading-pid-vs-leadlag-compare.png',
        (
            f"优化超前结构：t_s={structure_leadlag['metrics']['settling_time']:.1f}s ，"
            f"优化 PID：t_s={structure_pid['metrics']['settling_time']:.1f}s"
        ),
        limit=7.0,
        x_max=200.0,
    )


if __name__ == '__main__':
    main()
