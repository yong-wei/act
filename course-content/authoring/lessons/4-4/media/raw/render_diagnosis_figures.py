from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import ticker
import numpy as np
from PIL import Image

DATA_PATH = Path(__file__).resolve().parent / 'generated-data' / '4-4-diagnosis-data.json'
OUT_DIR = Path(__file__).resolve().parent.parent / 'processed'

matplotlib.rcParams['font.family'] = 'Hiragino Sans GB'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'Arial Unicode MS', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'

COLORS = {
    'baseline': '#4c78a8',
    'lf_only': '#f58518',
    'aggressive': '#e45756',
    'repair': '#2b8a3e',
    'grid': '#dddddd',
    'text': '#333333',
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


def apply_ascii_minus(ax: plt.Axes) -> None:
    formatter = ticker.FuncFormatter(lambda x, pos: f'{x:g}')
    ax.yaxis.set_major_formatter(formatter)


def style_axis(ax: plt.Axes) -> None:
    ax.grid(True, color=COLORS['grid'], linewidth=0.7)
    ax.set_facecolor('white')
    apply_ascii_minus(ax)


def style_bode_axis(ax: plt.Axes, xlim: tuple[float, float]) -> None:
    style_axis(ax)
    ax.set_xscale('log')
    ax.set_xlim(*xlim)


def get_ship_controllers(payload: dict, controller_ids: list[str]) -> list[dict]:
    wanted = set(controller_ids)
    return [item for item in payload['ship']['controllers'] if item['id'] in wanted]


def ship_u_ylim(controllers: list[dict], limit: float) -> tuple[float, float]:
    values = np.concatenate([
        np.asarray(item['control']['y'], dtype=float) for item in controllers
    ])
    peak = max(abs(values.min()), abs(values.max()), limit)
    margin = max(1.2, 0.1 * peak)
    return values.min() - margin, values.max() + margin


def ship_y_ylim(controllers: list[dict]) -> tuple[float, float]:
    values = np.concatenate([
        np.asarray(item['response']['y'], dtype=float) for item in controllers
    ])
    margin = max(0.06, 0.08 * (values.max() - values.min()))
    return values.min() - margin, values.max() + margin


def plot_ship_bundle(payload: dict, controller_ids: list[str], filename: str, title: str) -> None:
    controllers = get_ship_controllers(payload, controller_ids)
    if not controllers:
        raise ValueError(f'No ship controllers found for {controller_ids}')

    fig, axes = plt.subplots(2, 2, figsize=(13.2, 9.2), dpi=220)
    ax_step, ax_mag = axes[0]
    ax_u, ax_phase = axes[1]

    for ax in (ax_step, ax_u):
        style_axis(ax)

    w_min = min(float(np.min(np.asarray(item['open_loop']['w'], dtype=float))) for item in controllers)
    w_max = max(float(np.max(np.asarray(item['open_loop']['w'], dtype=float))) for item in controllers)
    bode_xlim = (w_min, w_max)
    style_bode_axis(ax_mag, bode_xlim)
    style_bode_axis(ax_phase, bode_xlim)

    for item in controllers:
        color = COLORS[item['id']]
        t = np.asarray(item['response']['t'], dtype=float)
        y = np.asarray(item['response']['y'], dtype=float)
        u = np.asarray(item['control']['t'], dtype=float)
        uy = np.asarray(item['control']['y'], dtype=float)
        w = np.asarray(item['open_loop']['w'], dtype=float)
        mag_db = np.asarray(item['open_loop']['mag_db'], dtype=float)
        phase_deg = np.asarray(item['open_loop']['phase_deg'], dtype=float)

        ax_step.plot(t, y, label=item['label'], color=color, linewidth=2.0)
        ax_u.plot(u, uy, label=item['label'], color=color, linewidth=2.0)
        ax_mag.plot(w, mag_db, label=item['label'], color=color, linewidth=2.0)
        ax_phase.plot(w, phase_deg, label=item['label'], color=color, linewidth=2.0)

    ax_step.axhline(1.0, color='#666666', linestyle='--', linewidth=0.9)
    ax_step.set_title('闭环输出阶跃响应')
    ax_step.set_xlabel('时间 / s')
    ax_step.set_ylabel('输出')
    ax_step.set_xlim(0, 200)
    ax_step.set_ylim(*ship_y_ylim(controllers))
    ax_step.legend(frameon=False, ncol=2, fontsize=9)

    limit = float(payload['ship']['limit'])
    ax_u.axhline(limit, color='#444444', linestyle='--', linewidth=0.9)
    ax_u.axhline(-limit, color='#444444', linestyle='--', linewidth=0.9)
    ax_u.set_title('控制量时域响应')
    ax_u.set_xlabel('时间 / s')
    ax_u.set_ylabel('归一化控制量')
    ax_u.set_xlim(0, 200)
    ax_u.set_ylim(*ship_u_ylim(controllers, limit))

    ax_mag.axhline(0, color='#666666', linestyle='--', linewidth=0.9)
    ax_mag.set_title('开环幅频特性')
    ax_mag.set_xlabel(r'$\omega$ / rad/s')
    ax_mag.set_ylabel('幅值 / dB')

    ax_phase.axhline(-180, color='#666666', linestyle='--', linewidth=0.9)
    ax_phase.set_title('开环相频特性')
    ax_phase.set_xlabel(r'$\omega$ / rad/s')
    ax_phase.set_ylabel('相位 / deg')

    fig.suptitle(title, fontsize=16, y=0.98)
    save(fig, filename)


def plot_roll_case(payload: dict) -> None:
    fig, (ax_mag, ax_time) = plt.subplots(1, 2, figsize=(12.8, 5.2), dpi=220)
    for ax in (ax_mag, ax_time):
        style_axis(ax)

    w = np.asarray(payload['roll']['open_loop']['w'], dtype=float)
    mag_open = np.asarray(payload['roll']['open_loop']['mag_db'], dtype=float)
    mag_closed = np.asarray(payload['roll']['closed_loop']['mag_db'], dtype=float)

    ax_mag.set_xscale('log')
    ax_mag.plot(w, mag_open, color='#4c78a8', linewidth=2.2, label='未补偿扰动通道')
    ax_mag.plot(w, mag_closed, color='#2b8a3e', linewidth=2.2, label='补偿后扰动通道')
    ax_mag.set_title('横摇减摇鳍关注的是扰动通道')
    ax_mag.set_xlabel(r'$\omega$ / rad/s')
    ax_mag.set_ylabel('幅值 / dB')
    ax_mag.legend(frameon=False, fontsize=9)

    resonance = payload['roll']['resonance']
    open_w = resonance['open_w']
    ax_mag.axvline(open_w, color='#666666', linestyle='--', linewidth=0.9)
    ax_mag.scatter([open_w], [resonance['open_peak_db']], color='#4c78a8', s=30, zorder=5)
    ax_mag.scatter([open_w], [resonance['closed_peak_db']], color='#2b8a3e', s=30, zorder=5)
    ax_mag.text(
        open_w * 1.08,
        resonance['open_peak_db'] - 1.0,
        f"谐振峰 {resonance['open_peak_db']:.2f} dB -> {resonance['closed_peak_db']:.2f} dB",
        fontsize=9,
        ha='left',
        va='top',
        bbox=dict(boxstyle='round,pad=0.2', facecolor='white', edgecolor='#d9d9d9'),
    )

    t = np.asarray(payload['roll']['time_open']['t'], dtype=float)
    y_open = np.asarray(payload['roll']['time_open']['y'], dtype=float)
    y_closed = np.asarray(payload['roll']['time_closed']['y'], dtype=float)
    ax_time.plot(t, y_open, color='#4c78a8', linewidth=2.0, label='未补偿横摇角')
    ax_time.plot(t, y_closed, color='#2b8a3e', linewidth=2.0, label='补偿后横摇角')
    ax_time.set_title('同频扰动下的时域结果')
    ax_time.set_xlabel('时间 / s')
    ax_time.set_ylabel('归一化横摇角')
    ax_time.set_xlim(0, 60)
    ax_time.legend(frameon=False, fontsize=9)
    ax_time.text(
        0.02,
        0.95,
        f"稳态振幅比 = {resonance['amplitude_ratio']:.3f}",
        transform=ax_time.transAxes,
        ha='left',
        va='top',
        fontsize=10,
        bbox=dict(boxstyle='round,pad=0.25', facecolor='white', edgecolor='#d9d9d9'),
    )

    fig.suptitle('对照案例：横摇减摇鳍的失败要按抗扰通道来读', fontsize=15, y=0.98)
    save(fig, '4-4-roll-channel-contrast.png')


def main() -> None:
    payload = load_payload()
    plot_ship_bundle(
        payload,
        ['baseline', 'lf_only', 'aggressive', 'repair'],
        '4-4-ship-heading-diagnosis-compare.png',
        '客船航向控制首轮验证对比',
    )
    plot_ship_bundle(
        payload,
        ['baseline', 'lf_only'],
        '4-4-ship-heading-selection-mismatch-compare.png',
        '基线方案与选型失配方案对比',
    )
    plot_ship_bundle(
        payload,
        ['baseline', 'aggressive'],
        '4-4-ship-heading-parameter-mismatch-compare.png',
        '基线方案与参数方向失配方案对比',
    )
    plot_roll_case(payload)


if __name__ == '__main__':
    main()
