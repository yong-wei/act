from __future__ import annotations

import csv
import json
import os
import sys
from pathlib import Path

ROOT = Path('/Users/YW/Documents/Site/act.just.edu.cn')
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))
LESSON_SCRIPT_DIR = ROOT / '.agents' / 'skills' / 'lesson' / 'scripts'
if str(LESSON_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(LESSON_SCRIPT_DIR))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image
from matplotlib.patches import FancyBboxPatch
from matplotlib.lines import Line2D
from mpl_toolkits.axes_grid1.inset_locator import inset_axes, mark_inset
from root_locus_branch_match import (
    PlotView,
    audit_root_locus,
    load_complex_points_csv,
    load_samples_csv,
    match_root_locus_branches,
    write_matched_csv,
)

matplotlib.rcParams['font.family'] = ['Songti SC', 'Arial Unicode MS', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False

DATA_DIR = ROOT / 'course-content/authoring/lessons/3-4/media/raw/generated-data'
OUT_DIR = ROOT / 'course-content/authoring/lessons/3-4/media/processed'

X_LIMITS = (-2.35, 0.15)
Y_LIMITS = (-0.55, 0.55)

COLORS = {
    'locus': '#1e4fa8',
    'A': '#1d8b3c',
    'B': '#d55c21',
    'C': '#b22222',
    'split': '#1d8b3c',
    'cross': '#b22222',
}


def load_root_locus_points() -> dict[int, np.ndarray]:
    matched = match_root_locus_branches(load_samples_csv(DATA_DIR / 'root_locus_raw_samples.csv'))
    write_matched_csv(DATA_DIR / 'root_locus_points.csv', matched)
    report = audit_root_locus(
        matched=matched,
        open_loop_poles=load_complex_points_csv(DATA_DIR / 'root_locus_open_loop_poles.csv'),
        open_loop_zeros=load_complex_points_csv(DATA_DIR / 'root_locus_open_loop_zeros.csv'),
        endpoint_tol=5e-3,
        views=[PlotView(name='root-locus-main', xlim=X_LIMITS, ylim=Y_LIMITS, role='standalone')],
    )
    (DATA_DIR / 'root_locus_audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return {
        idx + 1: np.array([(point.real, point.imag) for point in branch], dtype=float)
        for idx, branch in enumerate(matched.branches)
    }


def load_markers() -> dict[str, list[dict[str, float | str]]]:
    groups: dict[str, list[dict[str, float | str]]] = {}
    with (DATA_DIR / 'markers.csv').open(newline='') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            groups.setdefault(row['group'], []).append(
                {
                    'label': row['label'],
                    're': float(row['re']),
                    'im': float(row['im']),
                }
            )
    return groups


def load_generalized_markers() -> dict[str, list[dict[str, float | str]]]:
    groups: dict[str, list[dict[str, float | str]]] = {}
    with (DATA_DIR / 'generalized_markers.csv').open(newline='') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            groups.setdefault(row['group'], []).append(
                {
                    'label': row['label'],
                    're': float(row['re']),
                    'im': float(row['im']),
                }
            )
    return groups


def load_generalized_root_locus_points() -> dict[int, np.ndarray]:
    matched = match_root_locus_branches(load_samples_csv(DATA_DIR / 'generalized_root_locus_raw_samples.csv'))
    write_matched_csv(DATA_DIR / 'generalized_root_locus_points.csv', matched)
    report = audit_root_locus(
        matched=matched,
        open_loop_poles=load_complex_points_csv(DATA_DIR / 'generalized_open_loop_poles.csv'),
        open_loop_zeros=load_complex_points_csv(DATA_DIR / 'generalized_open_loop_zeros.csv'),
        endpoint_tol=5e-4,
        views=[
            PlotView(name='generalized-main', xlim=(-2.32, 0.06), ylim=(-0.062, 0.062), role='standalone'),
            PlotView(name='generalized-detail', xlim=(-0.07, 0.01), ylim=(-0.06, 0.06), role='subplot'),
        ],
    )
    (DATA_DIR / 'generalized_root_locus_audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return {
        idx + 1: np.array([(point.real, point.imag) for point in branch], dtype=float)
        for idx, branch in enumerate(matched.branches)
    }


def load_bode_data() -> dict[str, dict[str, np.ndarray]]:
    buckets: dict[str, dict[str, list[float]]] = {}
    with (DATA_DIR / 'bode_data.csv').open(newline='') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            version = row['version']
            bucket = buckets.setdefault(version, {'w': [], 'mag_db': [], 'phase_deg': []})
            bucket['w'].append(float(row['w']))
            bucket['mag_db'].append(float(row['mag_db']))
            bucket['phase_deg'].append(float(row['phase_deg']))
    return {
        version: {key: np.array(value) for key, value in values.items()}
        for version, values in buckets.items()
    }


def load_metrics() -> list[dict[str, float | str]]:
    with (DATA_DIR / 'frequency_metrics.csv').open(newline='') as handle:
        reader = csv.DictReader(handle)
        return [
            {
                'version': row['version'],
                'K': float(row['K']),
                'phase_margin_deg': float(row['phase_margin_deg']),
                'gain_margin': float(row['gain_margin']),
                'crossover_rad_s': float(row['crossover_rad_s']),
                'bandwidth_rad_s': float(row['bandwidth_rad_s']),
                'peak_db': float(row['peak_db']),
                'peak_rad_s': float(row['peak_rad_s']),
            }
            for row in reader
        ]


def load_step_compare() -> dict[str, np.ndarray]:
    data = {'t': [], 'exact': [], 'approx': []}
    with (DATA_DIR / 'step_compare.csv').open(newline='') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            data['t'].append(float(row['t']))
            data['exact'].append(float(row['exact']))
            data['approx'].append(float(row['approx']))
    return {key: np.array(value) for key, value in data.items()}


def load_ramp_track(version: str) -> dict[str, np.ndarray]:
    data = {
        't': [],
        'ref_deg': [],
        'out_deg': [],
        'x_ref_nm': [],
        'y_ref_nm': [],
        'x_out_nm': [],
        'y_out_nm': [],
    }
    with (DATA_DIR / f'ramp_track_{version}.csv').open(newline='') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            for key in data:
                data[key].append(float(row[key]))
    return {key: np.array(value) for key, value in data.items()}


def setup_root_locus_axes() -> tuple[plt.Figure, plt.Axes]:
    fig, ax = plt.subplots(figsize=(9.8, 6.2), dpi=220)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')
    ax.set_xlim(*X_LIMITS)
    ax.set_ylim(*Y_LIMITS)
    ax.grid(True, color='#d9d9d9', linewidth=0.8)
    ax.axvline(0, color='#808080', linestyle='--', linewidth=1.0)
    ax.set_xlabel('Re(s)')
    ax.set_ylabel('Im(s)')
    ax.tick_params(labelsize=11)
    fig.subplots_adjust(left=0.11, right=0.98, bottom=0.12, top=0.97)
    return fig, ax


def setup_generalized_root_locus_axes() -> tuple[plt.Figure, plt.Axes]:
    fig, ax = plt.subplots(figsize=(9.4, 5.4), dpi=220)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')
    ax.set_xlim(-2.32, 0.06)
    ax.set_ylim(-0.062, 0.062)
    ax.grid(True, color='#d9d9d9', linewidth=0.8)
    ax.axvline(0, color='#808080', linestyle='--', linewidth=1.0)
    ax.set_xlabel('Re(s)')
    ax.set_ylabel('Im(s)')
    ax.tick_params(labelsize=11)
    fig.subplots_adjust(left=0.11, right=0.98, bottom=0.14, top=0.96)
    return fig, ax


def plot_root_locus_background(ax: plt.Axes, branches: dict[int, np.ndarray], markers: dict[str, list[dict[str, float | str]]]) -> None:
    for points in branches.values():
        ax.plot(points[:, 0], points[:, 1], color=COLORS['locus'], linewidth=1.8)
    open_loop = markers['open_loop']
    ax.scatter(
        [item['re'] for item in open_loop],
        [item['im'] for item in open_loop],
        marker='x',
        s=90,
        linewidths=2.0,
        color='black',
        zorder=4,
    )


def save_figure(fig: plt.Figure, name: str) -> None:
    path = OUT_DIR / name
    fig.savefig(path, facecolor='white', transparent=False)
    plt.close(fig)
    flatten_to_white(path).save(path)


def render_root_locus_summary(branches: dict[int, np.ndarray], markers: dict[str, list[dict[str, float | str]]]) -> None:
    fig, ax = setup_root_locus_axes()
    plot_root_locus_background(ax, branches, markers)

    for version in ['A', 'B', 'C']:
        data = markers[version]
        ax.scatter(
            [item['re'] for item in data],
            [item['im'] for item in data],
            s=48,
            color=COLORS[version],
            zorder=5,
        )

    anchor_map = {
        'A': (-0.30, 0.11, markers['A'][0]['re'], markers['A'][0]['im']),
        'B': (-0.22, 0.18, markers['B'][0]['re'], markers['B'][0]['im']),
        'C': (-0.32, 0.46, markers['C'][0]['re'], markers['C'][0]['im']),
    }
    for version, (tx, ty, px, py) in anchor_map.items():
        ax.annotate(
            version,
            xy=(px, py),
            xytext=(tx, ty),
            fontsize=13,
            fontweight='bold',
            color=COLORS[version],
            arrowprops={'arrowstyle': '-', 'color': COLORS[version], 'linewidth': 1.0},
        )

    save_figure(fig, '3-4-root-locus-summary.png')


def render_root_locus_keynodes(branches: dict[int, np.ndarray], markers: dict[str, list[dict[str, float | str]]]) -> None:
    fig, ax = setup_root_locus_axes()
    plot_root_locus_background(ax, branches, markers)

    split = markers['split'][0]
    crosses = markers['cross']

    ax.scatter([split['re']], [split['im']], s=55, color=COLORS['split'], zorder=5)
    ax.annotate(
        'split',
        xy=(split['re'], split['im']),
        xytext=(-0.30, 0.06),
        fontsize=12,
        fontweight='bold',
        color=COLORS['split'],
        arrowprops={'arrowstyle': '-', 'color': COLORS['split'], 'linewidth': 1.0},
    )

    for label, point, text_y in [('j0.4626', crosses[0], 0.48), ('-j0.4626', crosses[1], -0.50)]:
        ax.scatter([point['re']], [point['im']], s=55, color=COLORS['cross'], zorder=5)
        ax.annotate(
            label,
            xy=(point['re'], point['im']),
            xytext=(-0.42, text_y),
            fontsize=12,
            fontweight='bold',
            color=COLORS['cross'],
            arrowprops={'arrowstyle': '-', 'color': COLORS['cross'], 'linewidth': 1.0},
        )

    save_figure(fig, '3-4-root-locus-keynodes.png')


def render_root_locus_reference_b(branches: dict[int, np.ndarray], markers: dict[str, list[dict[str, float | str]]]) -> None:
    fig, ax = setup_root_locus_axes()
    plot_root_locus_background(ax, branches, markers)

    split = markers['split'][0]
    b_points = markers['B']

    ax.scatter(
        [item['re'] for item in b_points],
        [item['im'] for item in b_points],
        s=55,
        color=COLORS['B'],
        zorder=5,
    )
    ax.scatter([split['re']], [split['im']], s=45, color=COLORS['split'], zorder=5)

    ax.annotate(
        'B pair',
        xy=(b_points[0]['re'], b_points[0]['im']),
        xytext=(-0.23, 0.16),
        fontsize=12,
        fontweight='bold',
        color=COLORS['B'],
        arrowprops={'arrowstyle': '-', 'color': COLORS['B'], 'linewidth': 1.0},
    )
    ax.annotate(
        'split',
        xy=(split['re'], split['im']),
        xytext=(-0.28, -0.09),
        fontsize=11,
        fontweight='bold',
        color=COLORS['split'],
        arrowprops={'arrowstyle': '-', 'color': COLORS['split'], 'linewidth': 1.0},
    )

    save_figure(fig, '3-4-root-locus-reference-b.png')


def render_generalized_root_locus(branches: dict[int, np.ndarray], markers: dict[str, list[dict[str, float | str]]]) -> None:
    fig, ax = setup_generalized_root_locus_axes()
    for points in branches.values():
        ax.plot(points[:, 0], points[:, 1], color=COLORS['locus'], linewidth=1.8)

    open_loop_poles = markers['a0.0']
    zero_points = [
        {'re': 0.0, 'im': 0.0},
        {'re': -0.1, 'im': 0.0},
    ]
    ax.scatter(
        [item['re'] for item in open_loop_poles],
        [item['im'] for item in open_loop_poles],
        marker='x',
        s=88,
        linewidths=1.8,
        color='black',
        zorder=6,
    )
    ax.scatter(
        [item['re'] for item in zero_points],
        [item['im'] for item in zero_points],
        marker='o',
        s=110,
        facecolors='white',
        edgecolors='#1d8b3c',
        linewidths=1.8,
        zorder=6,
    )

    axins = inset_axes(ax, width='35%', height='48%', loc='lower left', borderpad=2.0)
    axins.set_facecolor('white')
    for points in branches.values():
        axins.plot(points[:, 0], points[:, 1], color=COLORS['locus'], linewidth=1.5)
    axins.scatter(
        [item['re'] for item in open_loop_poles],
        [item['im'] for item in open_loop_poles],
        marker='x',
        s=48,
        linewidths=1.3,
        color='black',
        zorder=6,
    )
    axins.scatter(
        [item['re'] for item in zero_points],
        [item['im'] for item in zero_points],
        marker='o',
        s=62,
        facecolors='white',
        edgecolors='#1d8b3c',
        linewidths=1.4,
        zorder=6,
    )
    axins.set_xlim(-0.07, 0.01)
    axins.set_ylim(-0.06, 0.06)
    axins.grid(True, color='#e2e2e2', linewidth=0.7)
    axins.tick_params(labelsize=8)
    axins.axvline(0, color='#808080', linestyle='--', linewidth=0.8)

    highlight_order = [
        ('a0.0', '#d55c21', '$a=0$'),
        ('a0.2', '#1d8b3c', '$a=0.2$'),
        ('a0.5', '#8a5fbf', '$a=0.5$'),
        ('a1.0', '#b22222', '$a=1.0$'),
    ]
    anchor_text = {
        'a0.0': (-0.19, 0.048),
        'a0.2': (-0.27, 0.042),
        'a0.5': (-0.37, 0.023),
        'a1.0': (-0.30, -0.028),
    }

    for group, color, label in highlight_order:
        pts = markers[group]
        imag_peak = max(abs(float(item['im'])) for item in pts)
        if imag_peak > 1e-8:
            target = max(pts, key=lambda item: float(item['im']))
        else:
            target = max(pts, key=lambda item: float(item['re']))
        ax.scatter(
            [item['re'] for item in pts],
            [item['im'] for item in pts],
            color=color,
            s=42,
            zorder=5,
        )
        text_x, text_y = anchor_text[group]
        ax.annotate(
            label,
            xy=(target['re'], target['im']),
            xytext=(text_x, text_y),
            fontsize=12,
            fontweight='bold',
            color=color,
            arrowprops={'arrowstyle': '-', 'color': color, 'linewidth': 1.0},
        )
        axins.scatter(
            [item['re'] for item in pts],
            [item['im'] for item in pts],
            color=color,
            s=28,
            zorder=5,
        )

    legend_handles = [
        Line2D([0], [0], color=COLORS['locus'], linewidth=1.8, label='根轨迹'),
        Line2D([0], [0], marker='x', color='black', linestyle='None', markersize=8, markeredgewidth=1.6, label='开环极点'),
        Line2D([0], [0], marker='o', color='#1d8b3c', markerfacecolor='white', linestyle='None', markersize=8, markeredgewidth=1.6, label='开环零点'),
    ]
    ax.legend(
        handles=legend_handles,
        loc='lower center',
        bbox_to_anchor=(0.46, 0.06),
        ncol=3,
        frameon=True,
        fancybox=False,
        edgecolor='#999999',
        fontsize=9,
    )

    ax.annotate(
        '开环极点',
        xy=(open_loop_poles[1]['re'], open_loop_poles[1]['im']),
        xytext=(-0.58, -0.047),
        fontsize=10,
        color='#333333',
        arrowprops={'arrowstyle': '-', 'color': '#666666', 'linewidth': 0.9},
    )
    ax.annotate(
        '开环零点',
        xy=(-0.1, 0.0),
        xytext=(-0.34, -0.012),
        fontsize=10,
        color='#1d8b3c',
        arrowprops={'arrowstyle': '-', 'color': '#1d8b3c', 'linewidth': 0.9},
    )
    ax.text(-2.20, 0.052, '实轴分支', fontsize=10, color='#555555')
    ax.text(-0.70, 0.052, '主导极点局部放大', fontsize=10, color='#555555')
    mark_inset(ax, axins, loc1=2, loc2=4, fc='none', ec='#888888', lw=0.8)

    save_figure(fig, '3-4-generalized-root-locus.png')


def render_step_compare(step_data: dict[str, np.ndarray]) -> None:
    fig, ax = plt.subplots(figsize=(6.1, 4.8), dpi=220)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')
    ax.grid(True, color='#e5e5e5', linewidth=0.8)
    ax.plot(step_data['t'], step_data['exact'], color='#1e6bb8', linewidth=1.9, label='原系统')
    ax.plot(step_data['t'], step_data['approx'], color='#d55c21', linewidth=1.7, label='主导极点近似')
    ax.set_xlim(0, 200)
    ax.set_ylim(0, 1.2)
    ax.set_xlabel('时间(seconds)')
    ax.set_ylabel('幅值')
    ax.tick_params(labelsize=10)
    ax.legend(loc='upper right', frameon=True, fancybox=False, edgecolor='#999999', fontsize=10)
    fig.subplots_adjust(left=0.12, right=0.97, bottom=0.13, top=0.97)
    save_figure(fig, '3-4-step-compare.png')


def render_ramp_track(version: str, data: dict[str, np.ndarray], color: str, filename: str) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(7.2, 3.7), dpi=220)
    fig.patch.set_facecolor('white')
    fig.subplots_adjust(left=0.08, right=0.98, bottom=0.16, top=0.95, wspace=0.32)

    for ax in axes:
        ax.set_facecolor('white')
        ax.grid(True, color='#e9e9e9', linewidth=0.8)
        ax.tick_params(labelsize=9)

    axes[0].plot(data['t'], data['out_deg'], color='#1e6bb8', linewidth=1.8, label='航向响应')
    axes[0].plot(data['t'], data['ref_deg'], color='#d55c21', linewidth=1.5, label='给定航向')
    axes[0].set_xlim(0, 200)
    axes[0].set_ylim(0, 1200)
    axes[0].set_xlabel('时间(seconds)')
    axes[0].set_ylabel('幅值')
    axes[0].legend(loc='lower right', frameon=True, fancybox=False, edgecolor='#999999', fontsize=9)

    axes[1].plot(data['x_out_nm'], data['y_out_nm'], color='#1e6bb8', linewidth=1.8)
    axes[1].plot(data['x_ref_nm'], data['y_ref_nm'], color='#d55c21', linewidth=1.5)
    axes[1].scatter([0], [0], color='#f4b000', marker='+', s=60, linewidths=1.2, zorder=5)
    axes[1].set_xlabel('东西方向（海里）')
    axes[1].set_ylabel('南北方向（海里）')

    if version == 'B':
        axes[1].set_xlim(-0.04, 0.12)
        axes[1].set_ylim(-0.02, 0.14)
    else:
        axes[1].set_xlim(-0.04, 0.045)
        axes[1].set_ylim(-0.005, 0.08)

    axes[1].set_aspect('equal', adjustable='box')
    save_figure(fig, filename)


def render_bode_compare(bode_data: dict[str, dict[str, np.ndarray]]) -> None:
    fig, axes = plt.subplots(2, 1, figsize=(9.8, 7.6), dpi=220)
    fig.patch.set_facecolor('white')
    fig.subplots_adjust(left=0.11, right=0.98, bottom=0.10, top=0.97, hspace=0.18)

    labels = {'A': 'A: K=0.2', 'B': 'B: K=0.6064', 'C': 'C: K=20'}

    for ax in axes:
        ax.set_facecolor('white')
        ax.grid(True, which='both', color='#d9d9d9', linewidth=0.8)
        ax.tick_params(labelsize=11)

    for version in ['A', 'B', 'C']:
        axes[0].semilogx(
            bode_data[version]['w'],
            bode_data[version]['mag_db'],
            linewidth=1.8,
            color=COLORS[version],
            label=labels[version],
        )
        axes[1].semilogx(
            bode_data[version]['w'],
            bode_data[version]['phase_deg'],
            linewidth=1.8,
            color=COLORS[version],
        )

    axes[0].set_ylabel('Magnitude (dB)')
    axes[1].set_ylabel('Phase (deg)')
    axes[1].set_xlabel('Frequency (rad/s)')
    axes[0].legend(loc='lower left', frameon=False, fontsize=10)

    save_figure(fig, '3-4-bode-compare.png')


def render_info_graphic(metrics: list[dict[str, float | str]]) -> None:
    fig, ax = plt.subplots(figsize=(9.8, 6.2), dpi=220)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')
    ax.axis('off')

    ax.text(0.04, 0.92, '3-4 Root-Locus Quick Sheet', fontsize=22, fontweight='bold')
    ax.text(0.04, 0.84, 'Object: G(s) = 0.01715K / [s(s+0.1)(s+2.14375)]', fontsize=13)
    ax.text(0.04, 0.78, 'Key nodes: split s = -0.0494, stability limit K = 28.05, imag-axis crossing = ±j0.4626', fontsize=12)

    judgments = {
        'A': 'safe but slow',
        'B': 'balanced reference',
        'C': 'stronger tracking, weaker margin',
    }

    box_y = 0.54
    box_w = 0.26
    starts = [0.04, 0.37, 0.70]
    version_order = ['A', 'B', 'C']

    for left, version in zip(starts, version_order):
        record = next(item for item in metrics if item['version'] == version)
        patch = FancyBboxPatch(
            (left, box_y),
            box_w,
            0.20,
            boxstyle='round,pad=0.01,rounding_size=0.02',
            linewidth=1.5,
            edgecolor=COLORS[version],
            facecolor='white',
            transform=ax.transAxes,
        )
        ax.add_patch(patch)
        ax.text(left + 0.02, box_y + 0.145, f'{version}: K = {record["K"]:.4g}', fontsize=13, fontweight='bold', transform=ax.transAxes)
        ax.text(left + 0.02, box_y + 0.095, f'bandwidth = {record["bandwidth_rad_s"]:.3f} rad/s', fontsize=11, transform=ax.transAxes)
        ax.text(left + 0.02, box_y + 0.055, f'phase margin = {record["phase_margin_deg"]:.1f} deg', fontsize=11, transform=ax.transAxes)
        ax.text(left + 0.02, box_y + 0.015, judgments[version], fontsize=11, transform=ax.transAxes)

    ax.text(0.04, 0.34, 'Three-domain closure', fontsize=16, fontweight='bold')
    lines = [
        'Root locus: A/B/C are separated by split point, dominant pole area, and stability boundary.',
        'Time domain: A is slow, B is balanced, C shows stronger oscillation and longer settling.',
        'Frequency domain: bandwidth rises from A to C, but phase margin drops sharply at C.',
    ]
    for idx, line in enumerate(lines):
        ax.text(0.04, 0.28 - idx * 0.07, line, fontsize=12)

    save_figure(fig, '3-4-info.png')


def flatten_to_white(path: Path) -> Image.Image:
    image = Image.open(path).convert('RGBA')
    canvas = Image.new('RGBA', image.size, (255, 255, 255, 255))
    canvas.alpha_composite(image)
    return canvas.convert('RGB')


def trim_white_margins(path: Path, padding: int = 12) -> None:
    image = flatten_to_white(path)
    array = np.asarray(image)
    mask = np.any(array < 245, axis=2)
    coords = np.argwhere(mask)
    if coords.size == 0:
        image.save(path)
        return

    top, left = coords.min(axis=0)
    bottom, right = coords.max(axis=0)
    top = max(top - padding, 0)
    left = max(left - padding, 0)
    bottom = min(bottom + padding + 1, image.height)
    right = min(right + padding + 1, image.width)
    image.crop((left, top, right, bottom)).save(path)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    branches = load_root_locus_points()
    markers = load_markers()
    generalized_branches = load_generalized_root_locus_points()
    generalized_markers = load_generalized_markers()
    bode_data = load_bode_data()
    metrics = load_metrics()
    step_data = load_step_compare()
    ramp_track_b = load_ramp_track('B')
    ramp_track_c = load_ramp_track('C')

    render_root_locus_summary(branches, markers)
    render_root_locus_keynodes(branches, markers)
    render_root_locus_reference_b(branches, markers)
    render_generalized_root_locus(generalized_branches, generalized_markers)
    render_step_compare(step_data)
    render_ramp_track('B', ramp_track_b, COLORS['B'], '3-4-turning-track-k06064.png')
    render_ramp_track('C', ramp_track_c, COLORS['C'], '3-4-turning-track-k20.png')
    render_bode_compare(bode_data)
    render_info_graphic(metrics)

    for name in [
        '3-4-step-compare.png',
        '3-4-turning-track-k06064.png',
        '3-4-turning-track-k20.png',
    ]:
        trim_white_margins(OUT_DIR / name)


if __name__ == '__main__':
    main()
