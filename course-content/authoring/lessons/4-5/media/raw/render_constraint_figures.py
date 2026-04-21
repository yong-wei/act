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


def by_id(payload: dict, item_id: str) -> dict:
    for item in payload['entries']:
        if item['id'] == item_id:
            return item
    raise KeyError(item_id)


def plot_bundle(items: list[dict], title: str, filename: str, peak_note: str) -> None:
    fig, axes = plt.subplots(2, 2, figsize=(13.2, 9.2), dpi=220)
    ax_step, ax_mag = axes[0]
    ax_u, ax_phase = axes[1]

    for ax in (ax_step, ax_u):
        style_axis(ax)
    for ax in (ax_mag, ax_phase):
        style_axis(ax)
        ax.set_xscale('log')

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

    limit = 7.0
    ax_step.axhline(1.0, color='#666666', linestyle='--', linewidth=0.9)
    ax_step.set_title('闭环输出阶跃响应')
    ax_step.set_xlabel('时间 / s')
    ax_step.set_ylabel('输出')
    ax_step.set_xlim(0, 120)
    ax_step.legend(frameon=False, fontsize=9)

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

    fig.suptitle(title, fontsize=15, y=0.98)
    fig.text(
        0.5,
        0.01,
        peak_note,
        ha='center',
        va='bottom',
        fontsize=10,
    )
    save(fig, filename)


def main() -> None:
    payload = load_payload()
    initial = by_id(payload, 'initial')
    weak = by_id(payload, 'weak')
    constrained = by_id(payload, 'constrained')

    plot_bundle(
        [initial, weak],
        '客船航向保持：若不显性引入约束，候选解会先滑向不可用区域',
        '4-5-ship-heading-unconstrained-failure-compare.png',
        (
            f"弱约束候选：超调 {weak['metrics']['overshoot']:.2f}% ，"
            f"控制峰值 {weak['metrics']['control_peak']:.2f} ，"
            f"相角裕度 {weak['metrics']['phase_margin']:.2f}°"
        ),
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
    )


if __name__ == '__main__':
    main()
