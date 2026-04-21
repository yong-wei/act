#!/usr/bin/env python3
from __future__ import annotations

import logging
import os
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image

OUT_PATH = Path(__file__).resolve().parent.parent / 'processed' / '4-4-gradient-descent-path.png'

matplotlib.rcParams['font.family'] = 'Hiragino Sans GB'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'Arial Unicode MS', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'
warnings.filterwarnings('ignore', message=r"Font 'default' does not have a glyph for .*")
logging.getLogger('matplotlib').setLevel(logging.ERROR)

CURVE_COLOR = '#4c78a8'
PATH_COLOR = '#d95f02'
POINT_COLOR = '#c63d2f'
OPT_COLOR = '#2a9d5b'
GRID_COLOR = '#dddddd'


def objective(x: np.ndarray | float) -> np.ndarray | float:
    return (x - 3) ** 2 + 1


def gradient_descent_path(x0: float, eta: float, num_iters: int) -> list[float]:
    path = [x0]
    x = x0
    for _ in range(num_iters):
        grad = 2 * (x - 3)
        x = x - eta * grad
        path.append(x)
    return path


def flatten_to_white(path: Path) -> None:
    image = Image.open(path).convert('RGBA')
    background = Image.new('RGBA', image.size, (255, 255, 255, 255))
    Image.alpha_composite(background, image).convert('RGB').save(path)


def style_axis(ax: plt.Axes) -> None:
    ax.grid(True, color=GRID_COLOR, linewidth=0.7)
    ax.set_facecolor('white')


def main() -> None:
    x0 = 0.0
    eta = 0.25
    num_iters = 4
    path = gradient_descent_path(x0, eta, num_iters)
    iter_points = [(x, objective(x)) for x in path]

    fig, ax = plt.subplots(figsize=(8.2, 5.6), dpi=220)
    style_axis(ax)

    x_curve = np.linspace(-0.4, 5.1, 500)
    y_curve = objective(x_curve)
    ax.plot(x_curve, y_curve, color=CURVE_COLOR, linewidth=2.1)

    for index in range(len(iter_points) - 1):
        x_curr, y_curr = iter_points[index]
        x_next, y_next = iter_points[index + 1]
        ax.plot([x_curr, x_curr], [y_curr, y_next], color=PATH_COLOR, linestyle='--', linewidth=1.6)
        ax.plot([x_curr, x_next], [y_next, y_next], color=PATH_COLOR, linestyle='--', linewidth=1.6)

    for index, (x_value, y_value) in enumerate(iter_points):
        ax.scatter(x_value, y_value, s=72, color=POINT_COLOR, zorder=5)
        offset_y = 12 if index in (0, 2, 4) else -22
        ax.annotate(
            rf'$x_{index}$',
            (x_value, y_value),
            xytext=(0, offset_y),
            textcoords='offset points',
            ha='center',
            fontsize=11,
            color=POINT_COLOR,
        )

    x_opt = 3.0
    y_opt = objective(x_opt)
    ax.scatter(x_opt, y_opt, s=220, marker='*', color=OPT_COLOR, zorder=6)
    ax.annotate(
        '最优点',
        (x_opt, y_opt),
        xytext=(18, 18),
        textcoords='offset points',
        fontsize=11,
        color=OPT_COLOR,
        arrowprops=dict(arrowstyle='->', color=OPT_COLOR, linewidth=1.2),
    )

    ax.axhline(y=y_opt, color=OPT_COLOR, linestyle=':', linewidth=1.0, alpha=0.7)
    ax.set_xlim(-0.4, 5.1)
    ax.set_ylim(0.6, 10.2)
    ax.set_xlabel('参数 x')
    ax.set_ylabel('目标函数 f(x)')
    ax.set_title('梯度下降搜索路径')

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT_PATH, dpi=220, facecolor='white', bbox_inches='tight')
    plt.close(fig)
    flatten_to_white(OUT_PATH)
    print(f'Saved: {OUT_PATH}')


if __name__ == '__main__':
    main()
