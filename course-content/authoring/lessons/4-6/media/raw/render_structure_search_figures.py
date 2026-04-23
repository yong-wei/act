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


DATA_PATH = Path(__file__).resolve().parent / 'generated-data' / '4-6-structure-search-data.json'
OUT_DIR = Path(__file__).resolve().parent.parent / 'processed'

matplotlib.rcParams['font.family'] = 'Hiragino Sans GB'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'Arial Unicode MS', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'
warnings.filterwarnings('ignore', message=r"Font 'default' does not have a glyph for .*")
logging.getLogger('matplotlib').setLevel(logging.ERROR)

COLORS = {
    'reference': '#6c757d',
    'expected': '#6c757d',
    'passenger_fixed': '#d1495b',
    'passenger_variable': '#edae49',
    'destroyer_fixed': '#00798c',
    'destroyer_variable': '#30638e',
    'ga': '#2b8a3e',
    'pso': '#f58518',
    'grid': '#dddddd',
}

EXPERIMENT_ORDER = [
    ('passenger_cost_fixed_structure', COLORS['passenger_fixed']),
    ('passenger_cost_variable_structure', COLORS['passenger_variable']),
    ('destroyer_cost_fixed_structure', COLORS['destroyer_fixed']),
    ('destroyer_cost_variable_structure', COLORS['destroyer_variable']),
]


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
    ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, pos: f'{x:g}'))


def plot_mismatch_evidence(payload: dict) -> None:
    experiment = payload['destroyer_experiments']['passenger_cost_fixed_structure']
    fig, axes = plt.subplots(1, 2, figsize=(13.6, 5.4), dpi=220)
    ax_track, ax_traj = axes
    style_axis(ax_track)
    style_axis(ax_traj)

    ref = experiment['time_response']['reference']
    resp = experiment['time_response']['response']
    traj_expected = experiment['trajectory']['expected']
    traj_actual = experiment['trajectory']['actual']

    t = np.asarray(ref['t'], dtype=float)
    r = np.asarray(ref['y'], dtype=float)
    y = np.asarray(resp['y'], dtype=float)
    x_expected = np.asarray(traj_expected['x'], dtype=float)
    y_expected = np.asarray(traj_expected['y'], dtype=float)
    x_actual = np.asarray(traj_actual['x'], dtype=float)
    y_actual = np.asarray(traj_actual['y'], dtype=float)

    ax_track.step(t, r, where='post', color=COLORS['reference'], linestyle='--', linewidth=1.2, label='方波参考')
    ax_track.plot(t, y, color=COLORS['passenger_fixed'], linewidth=2.2, label='实际航向')
    ax_track.set_title('客船代价函数 + 固定超前结构：方波跟踪', fontsize=12)
    ax_track.set_xlabel('时间 / s')
    ax_track.set_ylabel('航向 / rad')
    ax_track.legend(frameon=False, fontsize=9, loc='upper right')

    ax_traj.plot(x_expected, y_expected, color=COLORS['expected'], linestyle='--', linewidth=1.2, label='期望航迹')
    ax_traj.plot(x_actual, y_actual, color=COLORS['passenger_fixed'], linewidth=2.2, label='实际航迹')
    ax_traj.set_title('客船代价函数 + 固定超前结构：航迹偏离', fontsize=12)
    ax_traj.set_xlabel('x / m')
    ax_traj.set_ylabel('y / m')
    ax_traj.set_aspect('equal', adjustable='box')
    ax_traj.legend(frameon=False, fontsize=9, loc='upper right')

    metrics = experiment['metrics']
    fig.suptitle('客船代价函数和固定超前结构在驱逐舰对象上的失配证据', fontsize=15, y=0.995)
    fig.text(
        0.5,
        0.02,
        (
            f"过渡误差={metrics['transition_error']:.2f}，"
            f"航迹偏离={metrics['trajectory_error']:.2f}，"
            f"u_max={metrics['u_max']:.2f}，"
            f"筛选={'通过' if experiment['screening']['passed'] else '未通过'}。"
        ),
        ha='center',
        fontsize=9.5,
    )
    save(fig, '4-6-destroyer-mismatch-evidence.png')


def plot_comparison(payload: dict) -> None:
    experiments = payload['destroyer_experiments']
    fig, axes = plt.subplots(4, 2, figsize=(14.5, 14.8), dpi=220)

    for row, (key, color) in enumerate(EXPERIMENT_ORDER):
        experiment = experiments[key]
        ax_track, ax_traj = axes[row]
        style_axis(ax_track)
        style_axis(ax_traj)

        ref = experiment['time_response']['reference']
        resp = experiment['time_response']['response']
        traj_expected = experiment['trajectory']['expected']
        traj_actual = experiment['trajectory']['actual']

        t = np.asarray(ref['t'], dtype=float)
        r = np.asarray(ref['y'], dtype=float)
        y = np.asarray(resp['y'], dtype=float)
        x_expected = np.asarray(traj_expected['x'], dtype=float)
        y_expected = np.asarray(traj_expected['y'], dtype=float)
        x_actual = np.asarray(traj_actual['x'], dtype=float)
        y_actual = np.asarray(traj_actual['y'], dtype=float)

        ax_track.step(t, r, where='post', color=COLORS['reference'], linestyle='--', linewidth=1.2, label='方波参考')
        ax_track.plot(t, y, color=color, linewidth=2.2, label='实际航向')
        ax_track.set_ylabel('航向 / rad')
        ax_track.set_title(f"{experiment['label']}：方波跟踪", fontsize=11.5)
        ax_track.legend(frameon=False, fontsize=8, loc='upper right')

        ax_traj.plot(x_expected, y_expected, color=COLORS['expected'], linestyle='--', linewidth=1.2, label='期望航迹')
        ax_traj.plot(x_actual, y_actual, color=color, linewidth=2.2, label='实际航迹')
        ax_traj.set_aspect('equal', adjustable='box')
        ax_traj.set_ylabel('y / m')
        ax_traj.set_title(f"{experiment['label']}：期望航迹与实际航迹", fontsize=11.5)
        ax_traj.legend(frameon=False, fontsize=8, loc='upper right')

        metrics = experiment['metrics']
        ax_track.text(
            0.01,
            0.04,
            (
                f"t90={metrics['t90']:.2f}s  "
                f"过渡误差={metrics['transition_error']:.2f}  "
                f"轨迹误差={metrics['trajectory_error']:.2f}"
            ),
            transform=ax_track.transAxes,
            fontsize=8.5,
            va='bottom',
        )
        ax_traj.text(
            0.01,
            0.04,
            (
                f"u_max={metrics['u_max']:.2f}  "
                f"E_u={metrics['control_energy']:.1f}  "
                f"筛选={'通过' if experiment['screening']['passed'] else '未通过'}"
            ),
            transform=ax_traj.transAxes,
            fontsize=8.5,
            va='bottom',
        )

    axes[-1, 0].set_xlabel('时间 / s')
    axes[-1, 1].set_xlabel('x / m')
    fig.suptitle('驱逐舰方波机动中的四类方案比较', fontsize=16, y=0.995)
    fig.text(
        0.5,
        0.008,
        '左列为方波航向跟踪，右列为由方向方波与固定航速积分得到的期望航迹，以及由实际航向积分得到的实际航迹。',
        ha='center',
        fontsize=9.5,
    )
    save(fig, '4-6-ship-heading-hybrid-search-comparison.png')


def plot_convergence(payload: dict) -> None:
    history = payload['convergence_history']
    steps = np.asarray(history['steps'], dtype=float)

    fig, axes = plt.subplots(1, 2, figsize=(14.0, 5.8), dpi=220)
    for ax in axes:
        style_axis(ax)

    left = history['passenger_cost_variable_structure']
    right = history['destroyer_cost_variable_structure']

    axes[0].plot(steps, np.asarray(left['ga']['mean_best'], dtype=float), color=COLORS['ga'], linewidth=2.2, label='GA')
    axes[0].plot(steps, np.asarray(left['pso']['mean_best'], dtype=float), color=COLORS['pso'], linewidth=2.2, label='PSO')
    axes[0].set_title('客船代价函数 + 变结构搜索')
    axes[0].set_xlabel('迭代轮次')
    axes[0].set_ylabel('平均最优代价')
    axes[0].legend(frameon=False, fontsize=9)

    axes[1].plot(steps, np.asarray(right['ga']['mean_best'], dtype=float), color=COLORS['ga'], linewidth=2.2, label='GA')
    axes[1].plot(steps, np.asarray(right['pso']['mean_best'], dtype=float), color=COLORS['pso'], linewidth=2.2, label='PSO')
    axes[1].set_title('驱逐舰专用代价函数 + 变结构搜索')
    axes[1].set_xlabel('迭代轮次')
    axes[1].set_ylabel('平均最优代价')
    axes[1].legend(frameon=False, fontsize=9)

    fig.suptitle('驱逐舰场景下的结构选择证据', fontsize=16, y=1.01)
    fig.text(
        0.5,
        -0.02,
        '两组图都保留 GA/PSO 20 代搜索，但只有驱逐舰专用代价函数把收敛方向稳定压向可交付的机动方案。',
        ha='center',
        fontsize=9.5,
    )
    save(fig, '4-6-ship-heading-hybrid-search-convergence.png')


def main() -> None:
    payload = load_payload()
    plot_mismatch_evidence(payload)
    plot_comparison(payload)
    plot_convergence(payload)


if __name__ == '__main__':
    main()
