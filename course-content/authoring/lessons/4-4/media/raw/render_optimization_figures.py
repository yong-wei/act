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

DATA_PATH = Path(__file__).resolve().parent / 'generated-data' / '4-4-optimization-data.json'
OUT_DIR = Path(__file__).resolve().parent.parent / 'processed'

matplotlib.rcParams['font.family'] = 'Hiragino Sans GB'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'Arial Unicode MS', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'
warnings.filterwarnings('ignore', message=r"Font 'default' does not have a glyph for .*")
logging.getLogger('matplotlib').setLevel(logging.ERROR)

COLORS = {
    'initial': '#4c78a8',
    'optimized': '#d95f02',
    'uncontrolled': '#8f8f8f',
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


def style_axis(ax: plt.Axes) -> None:
    ax.grid(True, color=COLORS['grid'], linewidth=0.7)
    ax.set_facecolor('white')
    formatter = ticker.FuncFormatter(lambda x, pos: f'{x:g}')
    ax.yaxis.set_major_formatter(formatter)


def plot_ship_heading_compare(payload: dict) -> None:
    initial = payload['ship']['initial']
    optimized = payload['ship']['optimized']
    selected_weights = payload['ship']['selected_weights']

    fig, axes = plt.subplots(2, 2, figsize=(13.2, 9.2), dpi=220)
    ax_step, ax_mag = axes[0]
    ax_u, ax_phase = axes[1]

    for ax in (ax_step, ax_u):
      style_axis(ax)
    for ax in (ax_mag, ax_phase):
      style_axis(ax)
      ax.set_xscale('log')

    step_series = [
        ('初始方案', initial, COLORS['initial']),
        ('优化方案', optimized, COLORS['optimized']),
    ]

    for label, item, color in step_series:
        t = np.asarray(item['response']['t'], dtype=float)
        y = np.asarray(item['response']['y'], dtype=float)
        tu = np.asarray(item['control']['t'], dtype=float)
        u = np.asarray(item['control']['y'], dtype=float)
        w = np.asarray(item['open_loop']['w'], dtype=float)
        mag_db = np.asarray(item['open_loop']['mag_db'], dtype=float)
        phase_deg = np.asarray(item['open_loop']['phase_deg'], dtype=float)

        ax_step.plot(t, y, color=color, linewidth=2.1, label=label)
        ax_u.plot(tu, u, color=color, linewidth=2.1, label=label)
        ax_mag.plot(w, mag_db, color=color, linewidth=2.1, label=label)
        ax_phase.plot(w, phase_deg, color=color, linewidth=2.1, label=label)

    ax_step.axhline(1.0, color='#666666', linestyle='--', linewidth=0.9)
    ax_step.set_title('闭环输出阶跃响应')
    ax_step.set_xlabel('时间 / s')
    ax_step.set_ylabel('输出')
    ax_step.set_xlim(0, 120)
    ax_step.legend(frameon=False, fontsize=9)

    limit = payload['ship']['thresholds']['control_peak']
    ax_u.axhline(limit, color='#444444', linestyle='--', linewidth=0.9)
    ax_u.axhline(-limit, color='#444444', linestyle='--', linewidth=0.9)
    ax_u.set_title('控制量响应')
    ax_u.set_xlabel('时间 / s')
    ax_u.set_ylabel('控制量')
    ax_u.set_xlim(0, 120)

    ax_mag.axhline(0, color='#666666', linestyle='--', linewidth=0.9)
    ax_mag.set_title('开环幅频特性')
    ax_mag.set_xlabel(r'$\omega$ / rad/s')
    ax_mag.set_ylabel('幅值 / dB')

    ax_phase.axhline(-180, color='#666666', linestyle='--', linewidth=0.9)
    ax_phase.set_title('开环相频特性')
    ax_phase.set_xlabel(r'$\omega$ / rad/s')
    ax_phase.set_ylabel('相位 / deg')

    fig.suptitle(
        '客船航向保持：4-3 初始方案与 4-4 优化结果对比\n'
        f'选定权重 = [{selected_weights[0]:.2f}, {selected_weights[1]:.2f}, '
        f'{selected_weights[2]:.2f}, {selected_weights[3]:.2f}]',
        fontsize=15,
        y=0.98,
    )
    save(fig, '4-4-ship-heading-optimization-compare.png')


def plot_roll_optimization_compare(payload: dict) -> None:
    roll = payload['roll']
    uncontrolled = roll['uncontrolled']
    initial = roll['initial']
    optimized = roll['optimized']
    threshold = float(roll['thresholds']['control_peak'])

    fig, axes = plt.subplots(1, 3, figsize=(15.2, 4.8), dpi=220)
    ax_mag, ax_y, ax_u = axes

    for ax in axes:
        style_axis(ax)

    ax_mag.set_xscale('log')
    for label, item, color in (
        ('未补偿', uncontrolled, COLORS['uncontrolled']),
        ('初始抗扰起点', initial, COLORS['initial']),
        ('优化结果', optimized, COLORS['optimized']),
    ):
        w = np.asarray(item['channel']['w'], dtype=float)
        mag_db = np.asarray(item['channel']['mag_db'], dtype=float)
        ax_mag.plot(w, mag_db, color=color, linewidth=2.0, label=label)
    ax_mag.set_title('扰动通道幅频对比')
    ax_mag.set_xlabel(r'$\omega$ / rad/s')
    ax_mag.set_ylabel('幅值 / dB')
    ax_mag.legend(frameon=False, fontsize=9)

    for label, item, color in (
        ('未补偿', uncontrolled, COLORS['uncontrolled']),
        ('初始抗扰起点', initial, COLORS['initial']),
        ('优化结果', optimized, COLORS['optimized']),
    ):
        t = np.asarray(item['response']['t'], dtype=float)
        y = np.asarray(item['response']['y'], dtype=float)
        ax_y.plot(t, y, color=color, linewidth=2.0, label=label)
    ax_y.set_title('同频海浪激励下的横摇角')
    ax_y.set_xlabel('时间 / s')
    ax_y.set_ylabel('归一化横摇角')
    ax_y.set_xlim(0, 60)

    for label, item, color in (
        ('初始抗扰起点', initial, COLORS['initial']),
        ('优化结果', optimized, COLORS['optimized']),
    ):
        t = np.asarray(item['control']['t'], dtype=float)
        u = np.asarray(item['control']['y'], dtype=float)
        ax_u.plot(t, u, color=color, linewidth=2.0, label=label)
    ax_u.axhline(threshold, color='#666666', linestyle='--', linewidth=0.9)
    ax_u.axhline(-threshold, color='#666666', linestyle='--', linewidth=0.9)
    ax_u.set_title('减摇鳍动作对比')
    ax_u.set_xlabel('时间 / s')
    ax_u.set_ylabel('归一化鳍角命令')
    ax_u.set_xlim(0, 60)
    ax_u.legend(frameon=False, fontsize=9)

    init_metrics = initial['metrics']
    opt_metrics = optimized['metrics']
    fig.suptitle(
        '横摇边界案例：任务从航向跟踪改成抗扰后，目标函数随之重写\n'
        f'初始 k = {initial["parameters"]["k"]:.2f}, 优化后 k = {optimized["parameters"]["k"]:.3f}, '
        f'峰值 {init_metrics["resonance_peak_db"]:.2f} dB -> {opt_metrics["resonance_peak_db"]:.2f} dB',
        fontsize=14,
        y=1.02,
    )
    save(fig, '4-4-roll-optimization-compare.png')


def main() -> None:
    payload = load_payload()
    plot_ship_heading_compare(payload)
    plot_roll_optimization_compare(payload)


if __name__ == '__main__':
    main()
