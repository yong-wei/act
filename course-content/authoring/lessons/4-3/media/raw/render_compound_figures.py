from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[6]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))
LESSON_SCRIPT_DIR = ROOT / '.agents' / 'skills' / 'lesson' / 'scripts'
if str(LESSON_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(LESSON_SCRIPT_DIR))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import ticker
import numpy as np
from PIL import Image
from root_locus_branch_match import (
    PlotView,
    audit_root_locus,
    load_complex_points_csv,
    load_samples_csv,
    match_root_locus_branches,
    write_matched_csv,
)

DATA_PATH = Path(__file__).resolve().parent / 'generated-data' / '4-3-compound-design-data.json'
DATA_DIR = Path(__file__).resolve().parent / 'generated-data'
OUT_DIR = Path(__file__).resolve().parent.parent / 'processed'

matplotlib.rcParams['font.family'] = 'sans-serif'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'STHeiti', 'Arial Unicode MS', 'Arial Unicode', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'

COLORS = {
    'before': '#1f4e79',
    'after': '#d94801',
    'controller': '#2b8a3e',
    'plant': '#1f4e79',
    'loop': '#d94801',
    'grid': '#dddddd',
    'limit': '#888888',
    'note_bg': '#f7f4ef',
    'note_edge': '#d0c6b4',
    'pole': '#c1121f',
    'zero': '#c97a00',
    'resonance': '#7a1f5c',
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


def arr(block: dict, key: str) -> np.ndarray:
    return np.asarray(block[key], dtype=float)


def style_step_axis(ax: plt.Axes) -> None:
    ax.grid(True, color=COLORS['grid'], linewidth=0.7)
    ax.set_facecolor('white')
    ax.set_xlabel('时间 / s')
    ax.set_ylabel('单位阶跃响应')


def style_root_axis(ax: plt.Axes) -> None:
    ax.axhline(0, color='#999999', linewidth=0.8)
    ax.axvline(0, color='#999999', linewidth=0.8, linestyle='--')
    ax.grid(True, color=COLORS['grid'], linewidth=0.7)
    ax.set_facecolor('white')
    ax.set_xlabel('Re(s)')
    ax.set_ylabel('Im(s)')


def style_bode_axes(ax_mag: plt.Axes, ax_phase: plt.Axes) -> None:
    for ax in (ax_mag, ax_phase):
        ax.set_xscale('log')
        ax.grid(True, which='both', color=COLORS['grid'], linewidth=0.7)
        ax.set_facecolor('white')
        ax.xaxis.set_major_locator(ticker.LogLocator(base=10.0))
        ax.xaxis.set_minor_locator(ticker.LogLocator(base=10.0, subs=np.arange(2, 10) * 0.1))
        ax.xaxis.set_minor_formatter(ticker.NullFormatter())
    ax_mag.set_ylabel('幅值 / dB')
    ax_phase.set_ylabel('相位 / deg')
    ax_phase.set_xlabel(r'$\omega$ / rad/s')


def compute_root_limits(branch_sets: list[list[np.ndarray]], blocks: list[dict]) -> tuple[tuple[float, float], tuple[float, float]]:
    x_parts: list[np.ndarray] = []
    y_parts: list[np.ndarray] = []

    for branches in branch_sets:
        for branch in branches:
            x_parts.append(branch[:, 0])
            y_parts.append(branch[:, 1])

    for block in blocks:
        for prefix in ('open_loop_poles', 'closed_poles', 'closed_loop_poles'):
            if prefix in block:
                x_parts.append(arr(block[prefix], 'real'))
                y_parts.append(arr(block[prefix], 'imag'))
        for prefix in ('open_loop_zeros',):
            if prefix in block:
                zeros_real = arr(block[prefix], 'real')
                zeros_imag = arr(block[prefix], 'imag')
                if zeros_real.size:
                    x_parts.append(zeros_real)
                    y_parts.append(zeros_imag)

    x = np.concatenate([part.reshape(-1) for part in x_parts if part.size])
    y = np.concatenate([part.reshape(-1) for part in y_parts if part.size])
    x = x[np.isfinite(x)]
    y = y[np.isfinite(y)]
    x_min = float(np.min(x))
    x_max = float(np.max(x))
    y_min = float(np.min(y))
    y_max = float(np.max(y))
    span_x = max(x_max - x_min, 0.8)
    span_y = max(y_max - y_min, 0.8)
    return (x_min - 0.18 * span_x, x_max + 0.18 * span_x), (y_min - 0.18 * span_y, y_max + 0.18 * span_y)


def demo_root_limits(block_id: str) -> tuple[tuple[float, float], tuple[float, float]] | None:
    if block_id == 'pi_lead':
        return (-6.0, 1.0), (-2.0, 2.0)
    if block_id == 'lag_lead':
        return (-15.0, 1.0), (-7.0, 7.0)
    return None


def load_root_locus_branches(prefix: str, block: dict) -> list[np.ndarray]:
    matched = match_root_locus_branches(load_samples_csv(DATA_DIR / f'{prefix}_root_locus_raw_samples.csv'))
    write_matched_csv(DATA_DIR / f'{prefix}_root_locus_points.csv', matched)
    xlim, ylim = compute_root_limits(
        [[np.array([(point.real, point.imag) for point in branch], dtype=float) for branch in matched.branches]],
        [block],
    )
    report = audit_root_locus(
        matched=matched,
        open_loop_poles=load_complex_points_csv(DATA_DIR / f'{prefix}_open_loop_poles.csv'),
        open_loop_zeros=load_complex_points_csv(DATA_DIR / f'{prefix}_open_loop_zeros.csv'),
        endpoint_tol=5e-3,
        views=[PlotView(name=f'{prefix}-main', xlim=xlim, ylim=ylim, role='subplot')],
    )
    (DATA_DIR / f'{prefix}_root_locus_audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return [
        np.array([(point.real, point.imag) for point in branch], dtype=float)
        for branch in matched.branches
    ]


def attach_branches(payload: dict) -> dict:
    for key in ('pi_lead', 'lag_lead', 'pid', 'heading_case'):
        block = payload[key]
        block['before_branches'] = load_root_locus_branches(f'{block["id"]}_before', {
            'open_loop_poles': block['before_open_loop_poles'],
            'open_loop_zeros': block['before_open_loop_zeros'],
            'closed_loop_poles': block['before_closed_poles'],
        })
        block['after_branches'] = load_root_locus_branches(f'{block["id"]}_after', {
            'open_loop_poles': block['after_open_loop_poles'],
            'open_loop_zeros': block['after_open_loop_zeros'],
            'closed_loop_poles': block['after_closed_poles'],
        })
    return payload


def draw_root_locus(
    ax: plt.Axes,
    branches: list[np.ndarray],
    open_poles: dict,
    open_zeros: dict,
    closed_poles: dict,
    title: str,
    curve_color: str,
    closed_color: str,
    limits: tuple[tuple[float, float], tuple[float, float]] | None = None,
) -> None:
    style_root_axis(ax)
    for branch in branches:
        ax.plot(branch[:, 0], branch[:, 1], color=curve_color, linewidth=1.25, alpha=0.9)

    ax.scatter(
        arr(open_poles, 'real'),
        arr(open_poles, 'imag'),
        marker='x',
        s=56,
        linewidths=1.5,
        color=COLORS['pole'],
        zorder=6,
        label='开环极点',
    )
    zeros_real = arr(open_zeros, 'real')
    zeros_imag = arr(open_zeros, 'imag')
    if zeros_real.size:
        ax.scatter(
            zeros_real,
            zeros_imag,
            marker='o',
            s=42,
            facecolors='white',
            edgecolors=COLORS['zero'],
            linewidths=1.5,
            zorder=6,
            label='开环零点',
        )
    ax.scatter(
        arr(closed_poles, 'real'),
        arr(closed_poles, 'imag'),
        marker='o',
        s=42,
        facecolors=closed_color,
        edgecolors='white',
        linewidths=0.8,
        zorder=7,
        label='当前闭环极点',
    )
    if limits is None:
        xlim, ylim = compute_root_limits([branches], [
            {'open_loop_poles': open_poles, 'open_loop_zeros': open_zeros, 'closed_loop_poles': closed_poles}
        ])
    else:
        xlim, ylim = limits
    ax.set_xlim(*xlim)
    ax.set_ylim(*ylim)
    ax.set_title(title)
    ax.legend(frameon=False, fontsize=8.2, loc='best')


def plot_design_quad(block: dict, filename: str) -> None:
    fig = plt.figure(figsize=(13.2, 9.0), dpi=220)
    outer = fig.add_gridspec(2, 2, hspace=0.32, wspace=0.22)
    ax_step = fig.add_subplot(outer[0, 0])
    bode_grid = outer[0, 1].subgridspec(2, 1, hspace=0.12)
    ax_mag = fig.add_subplot(bode_grid[0, 0])
    ax_phase = fig.add_subplot(bode_grid[1, 0])
    ax_root_before = fig.add_subplot(outer[1, 0])
    ax_root_after = fig.add_subplot(outer[1, 1])

    style_step_axis(ax_step)
    t_before = arr(block['step_before'], 't')
    y_before = arr(block['step_before'], 'y')
    t_after = arr(block['step_after'], 't')
    y_after = arr(block['step_after'], 'y')
    ax_step.plot(t_before, y_before, color=COLORS['before'], linewidth=1.9, label='校正前闭环')
    ax_step.plot(t_after, y_after, color=COLORS['after'], linewidth=1.9, label='校正后闭环')
    ax_step.axhline(1.0, color=COLORS['limit'], linewidth=0.9, linestyle=':')
    ax_step.set_title('时域响应对比')
    ax_step.legend(frameon=False, fontsize=8.6, loc='lower right')
    ymax = max(np.max(y_before), np.max(y_after))
    ax_step.set_ylim(0, max(1.08, ymax * 1.08))

    style_bode_axes(ax_mag, ax_phase)
    w = arr(block['bode_plant'], 'w')
    ax_mag.plot(w, arr(block['bode_plant'], 'mag_db'), color=COLORS['plant'], linewidth=1.8, label='原始对象')
    ax_mag.plot(w, arr(block['bode_controller'], 'mag_db'), color=COLORS['controller'], linewidth=1.8, label='校正结构')
    ax_mag.plot(w, arr(block['bode_loop_after'], 'mag_db'), color=COLORS['loop'], linewidth=1.8, label='校正后开环')
    ax_mag.axhline(0, color=COLORS['limit'], linewidth=0.9, linestyle='--')
    ax_mag.set_title('伯德图对比')
    ax_mag.legend(frameon=False, fontsize=8.5, loc='best')

    ax_phase.plot(w, arr(block['bode_plant'], 'phase_deg'), color=COLORS['plant'], linewidth=1.8)
    ax_phase.plot(w, arr(block['bode_controller'], 'phase_deg'), color=COLORS['controller'], linewidth=1.8)
    ax_phase.plot(w, arr(block['bode_loop_after'], 'phase_deg'), color=COLORS['loop'], linewidth=1.8)
    ax_phase.axhline(-180, color=COLORS['limit'], linewidth=0.9, linestyle='--')

    fixed_limits = demo_root_limits(block['id'])
    draw_root_locus(
        ax_root_before,
        block['before_branches'],
        block['before_open_loop_poles'],
        block['before_open_loop_zeros'],
        block['before_closed_poles'],
        '原系统根轨迹',
        COLORS['before'],
        COLORS['before'],
        limits=fixed_limits,
    )
    draw_root_locus(
        ax_root_after,
        block['after_branches'],
        block['after_open_loop_poles'],
        block['after_open_loop_zeros'],
        block['after_closed_poles'],
        '校正后系统根轨迹',
        COLORS['after'],
        COLORS['after'],
        limits=fixed_limits,
    )

    save(fig, filename)


def plot_roll_boundary(block: dict) -> None:
    fig = plt.figure(figsize=(12.8, 5.2), dpi=220)
    outer = fig.add_gridspec(1, 2, wspace=0.26)
    ax_time = fig.add_subplot(outer[0, 0])
    bode_grid = outer[0, 1].subgridspec(2, 1, hspace=0.12)
    ax_mag = fig.add_subplot(bode_grid[0, 0])
    ax_phase = fig.add_subplot(bode_grid[1, 0])

    ax_time.grid(True, color=COLORS['grid'], linewidth=0.7)
    ax_time.set_facecolor('white')
    t = arr(block['disturbance_input'], 't')
    m = arr(block['disturbance_input'], 'y')
    y_open = arr(block['time_open'], 'y')
    y_closed = arr(block['time_closed'], 'y')
    ax_time.plot(t, m, color='#666666', linewidth=1.5, linestyle='--', label='输入扰动力矩')
    ax_time.plot(t, y_open, color=COLORS['before'], linewidth=1.9, label='校正前横摇响应')
    ax_time.plot(t, y_closed, color=COLORS['after'], linewidth=1.9, label='校正后横摇响应')
    ax_time.set_title('时域响应对比')
    ax_time.set_xlabel('时间 / s')
    ax_time.set_ylabel('归一化幅值')
    ax_time.legend(frameon=False, fontsize=8.7, loc='upper right')

    style_bode_axes(ax_mag, ax_phase)
    w = arr(block['bode_before'], 'w')
    mag_before = arr(block['bode_before'], 'mag_db')
    mag_after = arr(block['bode_after'], 'mag_db')
    phase_before = arr(block['bode_before'], 'phase_deg')
    phase_after = arr(block['bode_after'], 'phase_deg')

    ax_mag.plot(w, mag_before, color=COLORS['before'], linewidth=2.0, label='校正前扰动通道')
    ax_mag.plot(w, mag_after, color=COLORS['after'], linewidth=2.0, label='校正后扰动通道')
    ax_mag.axhline(0, color=COLORS['limit'], linewidth=0.9, linestyle='--')
    ax_mag.axvline(block['resonance']['open_w'], color=COLORS['resonance'], linewidth=1.0, linestyle=':')
    ax_mag.scatter([block['resonance']['open_w']], [block['resonance']['open_peak_db']], color=COLORS['before'], s=28, zorder=5)
    ax_mag.scatter([block['resonance']['closed_w']], [block['resonance']['closed_peak_db']], color=COLORS['after'], s=28, zorder=5)
    ax_mag.set_title('伯德图对比')
    ax_mag.legend(frameon=False, fontsize=8.7, loc='best')

    ax_phase.plot(w, phase_before, color=COLORS['before'], linewidth=2.0)
    ax_phase.plot(w, phase_after, color=COLORS['after'], linewidth=2.0)
    ax_phase.axhline(-180, color=COLORS['limit'], linewidth=0.9, linestyle='--')

    save(fig, '4-3-roll-boundary-compare.png')


def main() -> None:
    payload = attach_branches(load_payload())
    plot_design_quad(payload['pi_lead'], '4-3-pi-lead-compound-quad.png')
    plot_design_quad(payload['lag_lead'], '4-3-lag-lead-compound-quad.png')
    plot_design_quad(payload['pid'], '4-3-pid-compound-quad.png')
    plot_design_quad(payload['heading_case'], '4-3-heading-case-quad.png')
    plot_roll_boundary(payload['roll_boundary'])


if __name__ == '__main__':
    main()
