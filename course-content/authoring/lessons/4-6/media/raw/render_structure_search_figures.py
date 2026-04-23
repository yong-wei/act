from __future__ import annotations

import json
import logging
import os
import warnings
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import ticker
import numpy as np
from PIL import Image

DATA_PATH = Path(__file__).resolve().parent / 'generated-data' / '4-6-structure-search-data.json'
OUT_DIR = Path(__file__).resolve().parent.parent / 'processed'

matplotlib.rcParams['font.family'] = 'Hiragino Sans GB'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'Arial Unicode MS', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'
warnings.filterwarnings('ignore', message=r"Font 'default' does not have a glyph for .*")
logging.getLogger('matplotlib').setLevel(logging.ERROR)

COLORS = {
    'baseline': '#4c78a8',
    'selected': '#e45756',
    'ga': '#2b8a3e',
    'pso': '#f58518',
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


def plot_comparison(payload: dict) -> None:
    baseline = payload['time_response']['baseline']
    selected = payload['time_response']['selected']
    freq_baseline = payload['frequency_response']['baseline']['open_loop']
    freq_selected = payload['frequency_response']['selected']['open_loop']

    fig, axes = plt.subplots(2, 2, figsize=(13.4, 9.2), dpi=220)
    ax_step, ax_control = axes[0]
    ax_mag, ax_phase = axes[1]

    for ax in (ax_step, ax_control):
        style_axis(ax)
    for ax in (ax_mag, ax_phase):
        style_axis(ax, log_x=True)

    for item, color in ((baseline, COLORS['baseline']), (selected, COLORS['selected'])):
        t = np.asarray(item['response']['t'], dtype=float)
        y = np.asarray(item['response']['y'], dtype=float)
        tu = np.asarray(item['control']['t'], dtype=float)
        u = np.asarray(item['control']['y'], dtype=float)
        ax_step.plot(t, y, linewidth=2.2, color=color, label=item['label'])
        ax_control.plot(tu, u, linewidth=2.2, color=color, label=item['label'])

    ax_step.axhline(1.0, color='#666666', linestyle='--', linewidth=0.9)
    ax_step.set_title('闭环输出响应')
    ax_step.set_xlabel('时间 / s')
    ax_step.set_ylabel('输出')
    ax_step.set_xlim(0, 80)
    ax_step.legend(frameon=False, fontsize=9)

    ax_control.axhline(7.0, color='#666666', linestyle='--', linewidth=0.9)
    ax_control.axhline(-7.0, color='#666666', linestyle='--', linewidth=0.9)
    ax_control.set_title('控制量响应')
    ax_control.set_xlabel('时间 / s')
    ax_control.set_ylabel('控制量')
    ax_control.set_xlim(0, 80)

    for item, color in ((freq_baseline, COLORS['baseline']), (freq_selected, COLORS['selected'])):
        w = np.asarray(item['w'], dtype=float)
        mag_db = np.asarray(item['mag_db'], dtype=float)
        phase_deg = np.asarray(item['phase_deg'], dtype=float)
        label = '4-5 固定超前可用解' if color == COLORS['baseline'] else '4-6 联合搜索代表解'
        ax_mag.plot(w, mag_db, linewidth=2.2, color=color, label=label)
        ax_phase.plot(w, phase_deg, linewidth=2.2, color=color, label=label)

    ax_mag.axhline(0.0, color='#666666', linestyle='--', linewidth=0.9)
    ax_mag.set_title('开环幅频特性')
    ax_mag.set_xlabel(r'$\omega$ / rad/s')
    ax_mag.set_ylabel('幅值 / dB')

    ax_phase.axhline(-180.0, color='#666666', linestyle='--', linewidth=0.9)
    ax_phase.set_title('开环相频特性')
    ax_phase.set_xlabel(r'$\omega$ / rad/s')
    ax_phase.set_ylabel('相位 / deg')

    selected_metrics = selected['metrics']
    fig.suptitle('航向对象上的结构-参数联合搜索结果对照', fontsize=15, y=0.98)
    fig.text(
        0.5,
        0.01,
        (
            f"代表解：{payload['selected_solution']['structure_name']}，"
            f"t90={selected_metrics['t90']:.2f}s，"
            f"控制峰值={selected_metrics['control_peak']:.2f}，"
            f"相角裕度={selected_metrics['phase_margin']:.2f}°"
        ),
        ha='center',
        va='bottom',
        fontsize=10,
    )
    save(fig, '4-6-ship-heading-hybrid-search-comparison.png')


def plot_convergence(payload: dict) -> None:
    history = payload['convergence_history']
    steps = np.asarray(history['steps'], dtype=float)
    ga_mean = np.asarray(history['ga']['mean_best'], dtype=float)
    pso_mean = np.asarray(history['pso']['mean_best'], dtype=float)
    ga_rep = np.asarray(history['ga']['representative_best'], dtype=float)
    pso_rep = np.asarray(history['pso']['representative_best'], dtype=float)

    ga_counts = Counter(run['structure_id'] for run in payload['ga_runs'])
    pso_counts = Counter(run['structure_id'] for run in payload['pso_runs'])

    labels = ['1', '2', '3', '4', '5']
    x = np.arange(len(labels))
    width = 0.34

    fig, axes = plt.subplots(1, 2, figsize=(13.4, 5.7), dpi=220)
    ax_curve, ax_bar = axes
    style_axis(ax_curve)
    style_axis(ax_bar)

    ax_curve.plot(steps, ga_mean, color=COLORS['ga'], linewidth=2.3, label='GA 平均最优代价')
    ax_curve.plot(steps, pso_mean, color=COLORS['pso'], linewidth=2.3, label='PSO 平均最优代价')
    ax_curve.plot(steps, ga_rep, color=COLORS['ga'], linewidth=1.4, linestyle='--', label='GA 代表种子')
    ax_curve.plot(steps, pso_rep, color=COLORS['pso'], linewidth=1.4, linestyle='--', label='PSO 代表种子')
    ax_curve.set_title('多次独立随机种子下的收敛曲线')
    ax_curve.set_xlabel('迭代轮次')
    ax_curve.set_ylabel('最优代价')
    ax_curve.legend(frameon=False, fontsize=9)

    ga_values = [ga_counts.get(i, 0) for i in range(1, 6)]
    pso_values = [pso_counts.get(i, 0) for i in range(1, 6)]
    ax_bar.bar(x - width / 2, ga_values, width=width, color=COLORS['ga'], label='GA')
    ax_bar.bar(x + width / 2, pso_values, width=width, color=COLORS['pso'], label='PSO')
    ax_bar.set_xticks(x, labels)
    ax_bar.set_xlabel('最终结构编号')
    ax_bar.set_ylabel('出现次数')
    ax_bar.set_title('最终解码结构的分布')
    ax_bar.legend(frameon=False, fontsize=9)
    ax_bar.annotate(
        '结构 3 为主导收敛族',
        xy=(2, max(ga_values[2], pso_values[2])),
        xytext=(2.8, max(ga_values[2], pso_values[2]) + 0.8),
        arrowprops={'arrowstyle': '->', 'color': '#444444'},
        fontsize=10,
    )

    fig.suptitle('GA 与 PSO 在同一航向对象上的收敛对照', fontsize=15, y=1.02)
    save(fig, '4-6-ship-heading-hybrid-search-convergence.png')


def main() -> None:
    payload = load_payload()
    plot_comparison(payload)
    plot_convergence(payload)


if __name__ == '__main__':
    main()
