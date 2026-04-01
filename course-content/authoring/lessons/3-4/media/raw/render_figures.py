from __future__ import annotations

import csv
import os
from pathlib import Path

ROOT = Path('/Users/YW/Documents/Site/act.just.edu.cn')
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image
from matplotlib.patches import FancyBboxPatch

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
    branches: dict[int, list[tuple[float, float]]] = {}
    with (DATA_DIR / 'root_locus_points.csv').open(newline='') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            branch = int(row['branch'])
            branches.setdefault(branch, []).append((float(row['re']), float(row['im'])))
    return {key: np.array(value) for key, value in branches.items()}


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
    bode_data = load_bode_data()
    metrics = load_metrics()

    render_root_locus_summary(branches, markers)
    render_root_locus_keynodes(branches, markers)
    render_root_locus_reference_b(branches, markers)
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
