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
from matplotlib.patches import Polygon
import numpy as np
from PIL import Image

DATA_PATH = Path(__file__).resolve().parent / 'generated-data' / '4-1-case-data.json'
OUT_DIR = Path(__file__).resolve().parent.parent / 'processed'

matplotlib.rcParams['font.family'] = 'sans-serif'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'STHeiti', 'Arial Unicode MS', 'Arial Unicode', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'

COLORS = {
    'curve': '#1f4e79',
    'pole': '#c1121f',
    'zero': '#d97706',
    'margin': '#2b8a3e',
    'gm': '#7a1f5c',
    'grid': '#dddddd',
    'limit': '#888888',
    'region': '#dbeafe',
    'region_edge': '#2563eb',
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


def style_time_axis(ax: plt.Axes) -> None:
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


def draw_feasible_region(ax: plt.Axes, case: dict) -> None:
    zeta = case['feasible_region']['zeta_min']
    sigma = case['feasible_region']['sigma_min']
    x_left = case['root_xlim'][0]
    theta = np.arccos(zeta)
    ymax = (-x_left) * np.tan(theta)
    polygon = np.array([
        [x_left, -ymax],
        [x_left, ymax],
        [-sigma, sigma * np.tan(theta)],
        [-sigma, -sigma * np.tan(theta)],
    ])
    ax.add_patch(
        Polygon(
            polygon,
            closed=True,
            facecolor=COLORS['region'],
            edgecolor=COLORS['region_edge'],
            alpha=0.22,
            linewidth=1.2,
        )
    )
    xs = np.linspace(x_left, 0, 240)
    ys = (-xs) * np.tan(theta)
    ax.plot(xs, ys, color=COLORS['region_edge'], linewidth=1.0, linestyle='--')
    ax.plot(xs, -ys, color=COLORS['region_edge'], linewidth=1.0, linestyle='--')
    ax.axvline(-sigma, color=COLORS['region_edge'], linewidth=1.0, linestyle=':')
    anchor = case.get('root_note_anchor', 'upper_left')
    x = 0.98 if anchor == 'upper_right' else 0.02
    ha = 'right' if anchor == 'upper_right' else 'left'
    ax.text(
        x,
        0.96,
        rf'$M_p\leq {case["feasible_region"]["mp_ratio"]*100:.0f}\%$' '\n'
        rf'$t_s\leq {case["feasible_region"]["settling_time"]:.2f}\,\mathrm{{s}}$',
        transform=ax.transAxes,
        ha=ha,
        va='top',
        fontsize=8.8,
        bbox=dict(boxstyle='round,pad=0.25', facecolor='white', edgecolor='#d9d9d9'),
    )


def draw_margin_lines_on_mag(ax: plt.Axes, w: np.ndarray, mag: np.ndarray, margins: dict) -> None:
    ax.axhline(0, color=COLORS['limit'], linewidth=0.9, linestyle='--')
    ax.axvline(margins['wc'], color=COLORS['curve'], linewidth=1.0, linestyle='--', alpha=0.85)
    ax.axvline(margins['wg'], color=COLORS['gm'], linewidth=1.0, linestyle=':', alpha=0.85)
    mag_at_wg = float(np.interp(np.log10(margins['wg']), np.log10(w), mag))
    ax.plot([margins['wg'], margins['wg']], [mag_at_wg, 0], color=COLORS['gm'], linewidth=1.8, alpha=0.95)
    ax.scatter([margins['wg']], [mag_at_wg], color=COLORS['gm'], s=22, zorder=5)


def draw_margin_lines_on_phase(ax: plt.Axes, w: np.ndarray, phase: np.ndarray, margins: dict) -> None:
    ax.axhline(-180, color=COLORS['limit'], linewidth=0.9, linestyle='--')
    ax.axvline(margins['wc'], color=COLORS['curve'], linewidth=1.0, linestyle='--', alpha=0.85)
    phase_at_wc = float(np.interp(np.log10(margins['wc']), np.log10(w), phase))
    ax.plot([margins['wc'], margins['wc']], [phase_at_wc, -180], color=COLORS['margin'], linewidth=1.8, alpha=0.95)
    ax.scatter([margins['wc']], [phase_at_wc], color=COLORS['margin'], s=22, zorder=5)


def set_root_limits(ax: plt.Axes, case: dict) -> None:
    ax.set_xlim(case['root_xlim'])
    ax.set_ylim(case['root_ylim'])


def plot_case_quad(case: dict, filename: str) -> None:
    fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
    gs = fig.add_gridspec(2, 2, hspace=0.32, wspace=0.24)
    ax1 = fig.add_subplot(gs[0, 0])
    ax2 = fig.add_subplot(gs[1, 0])
    ax3 = fig.add_subplot(gs[0, 1])
    ax4 = fig.add_subplot(gs[1, 1])

    style_time_axis(ax1)
    t = arr(case['step'], 't')
    y = arr(case['step'], 'y')
    ax1.plot(t, y, color=COLORS['curve'], linewidth=1.9)
    ax1.axhline(1.0, color=COLORS['limit'], linewidth=0.9, linestyle=':')
    ax1.set_title('左上：闭环时域响应')
    metrics = case['step_metrics']
    ax1.text(
        0.02,
        0.96,
        (
            f"M_p = {metrics['overshoot']:.2f}%\n"
            f"t_s = {metrics['settling_time']:.2f} s\n"
            f"t_r = {metrics['rise_time']:.2f} s"
        ),
        transform=ax1.transAxes,
        ha='left',
        va='top',
        fontsize=8.8,
        bbox=dict(boxstyle='round,pad=0.25', facecolor='white', edgecolor='#d9d9d9'),
    )

    style_root_axis(ax2)
    draw_feasible_region(ax2, case)
    rl_real = np.asarray(case['root_locus']['real'], dtype=float)
    rl_imag = np.asarray(case['root_locus']['imag'], dtype=float)
    for row in range(rl_real.shape[0]):
        ax2.plot(rl_real[row], rl_imag[row], color=COLORS['curve'], linewidth=1.2, alpha=0.85)
    ax2.scatter(arr(case['open_loop_poles'], 'real'), arr(case['open_loop_poles'], 'imag'), marker='x', s=58, linewidths=1.5, color=COLORS['pole'], zorder=6, label='开环极点')
    zeros_real = arr(case['open_loop_zeros'], 'real')
    zeros_imag = arr(case['open_loop_zeros'], 'imag')
    if zeros_real.size:
        ax2.scatter(zeros_real, zeros_imag, marker='o', s=42, facecolors='white', edgecolors=COLORS['zero'], linewidths=1.5, zorder=6, label='开环零点')
    ax2.scatter(arr(case['closed_loop_poles'], 'real'), arr(case['closed_loop_poles'], 'imag'), marker='o', s=42, facecolors=COLORS['curve'], edgecolors='white', linewidths=0.8, zorder=7, label='当前闭环极点')
    set_root_limits(ax2, case)
    ax2.set_title('左下：根轨迹与设计可行域')
    ax2.legend(frameon=False, fontsize=8.6, loc=case.get('root_legend_loc', 'best'))

    style_bode_axes(ax3, ax4)
    w = arr(case['bode'], 'w')
    mag = arr(case['bode'], 'mag_db')
    phase = arr(case['bode'], 'phase_deg')
    ax3.semilogx(w, mag, color=COLORS['curve'], linewidth=1.8)
    draw_margin_lines_on_mag(ax3, w, mag, case['margins'])
    ax3.set_title('右上：开环 Bode 幅频')

    ax4.semilogx(w, phase, color=COLORS['curve'], linewidth=1.8)
    draw_margin_lines_on_phase(ax4, w, phase, case['margins'])
    ax4.set_title('右下：开环相频与裕度')
    ax4.text(
        0.02,
        0.03,
        (
            f"PM = {case['margins']['pm']:.2f}°\n"
            f"GM = {case['margins']['gm_db']:.2f} dB\n"
            f"ωc = {case['margins']['wc']:.4g} rad/s"
        ),
        transform=ax4.transAxes,
        ha='left',
        va='bottom',
        fontsize=8.8,
        bbox=dict(boxstyle='round,pad=0.25', facecolor='white', edgecolor='#d9d9d9'),
    )

    fig.suptitle(f"{case['title']} | {case['task_tag']}", fontsize=14, fontweight='bold')
    save(fig, filename)


def main() -> None:
    payload = load_payload()
    files = {
        'ship_heading': '4-1-ship-heading-quad.png',
        'platform_pitch': '4-1-platform-pitch-quad.png',
    }
    for key, filename in files.items():
        plot_case_quad(payload['cases'][key], filename)


if __name__ == '__main__':
    main()
