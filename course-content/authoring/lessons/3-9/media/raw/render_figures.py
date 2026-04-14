from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[6]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))
LESSON_SCRIPT_DIR = ROOT / '.codex' / 'skills' / 'lesson' / 'scripts'
if str(LESSON_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(LESSON_SCRIPT_DIR))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import patches, ticker
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

DATA_PATH = Path(__file__).resolve().parent / 'generated-data' / '3-9-design-data.json'
DATA_DIR = Path(__file__).resolve().parent / 'generated-data'
OUT_DIR = Path(__file__).resolve().parent.parent / 'processed'
RUNTIME_MEDIA_DIR = ROOT / 'course-content' / 'runtime' / 'lessons' / '3-9' / 'media'
PRESERVED_RUNTIME_ASSETS = (
    '3-9-cover-comic.png',
    '3-9-info.png',
)

matplotlib.rcParams['font.family'] = 'sans-serif'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'STHeiti', 'Arial Unicode MS', 'Arial Unicode', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'

COLORS = {
    'before': '#1f4e79',
    'after': '#d94801',
    'pm': '#2b8a3e',
    'gm': '#7a1f5c',
    'grid': '#dddddd',
    'limit': '#888888',
    'soft_bg': '#f7f4ef',
    'blue_bg': '#eef6fb',
    'pink_bg': '#fff1f2',
    'green_bg': '#eef8ef',
}

VARIANT_COLORS = {
    'baseline': COLORS['before'],
    'zero_line': COLORS['after'],
    'pi_weak': COLORS['after'],
    'pi_strong': COLORS['after'],
    'pi_corrected': COLORS['after'],
    'lag': COLORS['after'],
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


def sync_preserved_runtime_assets() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename in PRESERVED_RUNTIME_ASSETS:
        source = RUNTIME_MEDIA_DIR / filename
        if not source.exists():
            raise FileNotFoundError(f'缺少运行态生成图，无法同步：{source}')
        shutil.copy2(source, OUT_DIR / filename)


def arr(block: dict, key: str) -> np.ndarray:
    return np.asarray(block[key], dtype=float)


def root_branch_arrays(variant: dict) -> list[np.ndarray]:
    return variant['root_locus_branches']


def compute_root_limits(branch_sets: list[list[np.ndarray]], variants: list[dict]) -> tuple[tuple[float, float], tuple[float, float]]:
    x_parts: list[np.ndarray] = []
    y_parts: list[np.ndarray] = []

    for branches in branch_sets:
        for branch in branches:
            x_parts.append(branch[:, 0])
            y_parts.append(branch[:, 1])

    for variant in variants:
        x_parts.append(arr(variant['open_loop_poles'], 'real'))
        y_parts.append(arr(variant['open_loop_poles'], 'imag'))
        x_parts.append(arr(variant['closed_loop_poles'], 'real'))
        y_parts.append(arr(variant['closed_loop_poles'], 'imag'))
        zeros_real = arr(variant['open_loop_zeros'], 'real')
        zeros_imag = arr(variant['open_loop_zeros'], 'imag')
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


def load_root_locus_branches(variant_id: str, variant: dict) -> list[np.ndarray]:
    matched = match_root_locus_branches(load_samples_csv(DATA_DIR / f'{variant_id}_root_locus_raw_samples.csv'))
    write_matched_csv(DATA_DIR / f'{variant_id}_root_locus_points.csv', matched)
    xlim, ylim = compute_root_limits([[
        np.array([(point.real, point.imag) for point in branch], dtype=float)
        for branch in matched.branches
    ]], [variant])
    report = audit_root_locus(
        matched=matched,
        open_loop_poles=load_complex_points_csv(DATA_DIR / f'{variant_id}_open_loop_poles.csv'),
        open_loop_zeros=load_complex_points_csv(DATA_DIR / f'{variant_id}_open_loop_zeros.csv'),
        endpoint_tol=5e-3,
        views=[PlotView(name=f'{variant_id}-main', xlim=xlim, ylim=ylim, role='subplot')],
    )
    (DATA_DIR / f'{variant_id}_root_locus_audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return [
        np.array([(point.real, point.imag) for point in branch], dtype=float)
        for branch in matched.branches
    ]


def attach_root_locus_branches(payload: dict) -> dict:
    for variant_id, variant in payload['variants'].items():
        variant['root_locus_branches'] = load_root_locus_branches(variant_id, variant)
    return payload


def style_root_axis(ax: plt.Axes) -> None:
    ax.axhline(0, color='#999999', linewidth=0.8)
    ax.axvline(0, color='#999999', linewidth=0.8, linestyle='--')
    ax.grid(True, color=COLORS['grid'], linewidth=0.7)
    ax.set_facecolor('white')
    ax.set_xlabel('Re(s)')
    ax.set_ylabel('Im(s)')


def style_time_axis(ax: plt.Axes, ylabel: str) -> None:
    ax.grid(True, color=COLORS['grid'], linewidth=0.7)
    ax.set_facecolor('white')
    ax.set_xlabel('时间 / s')
    ax.set_ylabel(ylabel)


def style_bode_axes(ax_mag: plt.Axes, ax_phase: plt.Axes) -> None:
    ax_mag.set_xscale('log')
    ax_phase.set_xscale('log')
    for ax in (ax_mag, ax_phase):
        ax.grid(True, which='both', color=COLORS['grid'], linewidth=0.7)
        ax.set_facecolor('white')
        style_log_xaxis(ax)
    ax_mag.set_ylabel('幅值 / dB')
    ax_phase.set_ylabel('相位 / deg')
    ax_phase.set_xlabel(r'$\omega$ / rad/s')


def style_log_xaxis(ax: plt.Axes) -> None:
    ax.xaxis.set_major_locator(ticker.LogLocator(base=10.0))
    ax.xaxis.set_minor_locator(ticker.LogLocator(base=10.0, subs=np.arange(2, 10) * 0.1))
    ax.xaxis.set_minor_formatter(ticker.NullFormatter())


def summary_box(ax: plt.Axes, title: str, lines: list[str], facecolor: str = '#f7f4ef', edgecolor: str = '#d0c6b4') -> None:
    ax.axis('off')
    text = '\n'.join([title, '', *lines])
    ax.text(
        0.02,
        0.98,
        text,
        va='top',
        ha='left',
        fontsize=10.0,
        linespacing=1.48,
        bbox=dict(boxstyle='round,pad=0.55', facecolor=facecolor, edgecolor=edgecolor),
    )


def set_root_limits(ax: plt.Axes, before: dict, variant: dict) -> None:
    branch_sets = [root_branch_arrays(before)]
    variants = [before]
    if variant['id'] != 'baseline':
        branch_sets.append(root_branch_arrays(variant))
        variants.append(variant)
    xlim, ylim = compute_root_limits(branch_sets, variants)
    ax.set_xlim(*xlim)
    ax.set_ylim(*ylim)


def draw_margin_lines_on_mag(ax: plt.Axes, w: np.ndarray, mag: np.ndarray, margins: dict, color: str) -> None:
    ax.axvline(margins['wc'], color=color, linewidth=1.0, linestyle='--', alpha=0.85)
    ax.axvline(margins['wg'], color=color, linewidth=1.0, linestyle=':', alpha=0.85)
    mag_at_wg = float(np.interp(np.log10(margins['wg']), np.log10(w), mag))
    ax.plot([margins['wg'], margins['wg']], [mag_at_wg, 0], color=COLORS['gm'], linewidth=1.8, alpha=0.95)
    ax.scatter([margins['wg']], [mag_at_wg], color=COLORS['gm'], s=22, zorder=5)


def draw_margin_lines_on_phase(ax: plt.Axes, w: np.ndarray, phase: np.ndarray, margins: dict, color: str) -> None:
    ax.axvline(margins['wc'], color=color, linewidth=1.0, linestyle='--', alpha=0.85)
    ax.axvline(margins['wg'], color=color, linewidth=1.0, linestyle=':', alpha=0.85)
    phase_at_wc = float(np.interp(np.log10(margins['wc']), np.log10(w), phase))
    ax.plot([margins['wc'], margins['wc']], [phase_at_wc, -180], color=COLORS['pm'], linewidth=1.8, alpha=0.95)
    ax.scatter([margins['wc']], [phase_at_wc], color=COLORS['pm'], s=22, zorder=5)


def plot_variant_quad(before: dict, variant: dict, filename: str) -> None:
    after_color = VARIANT_COLORS[variant['id']]
    before_color = COLORS['before']
    fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
    gs = fig.add_gridspec(2, 2, hspace=0.32, wspace=0.24)
    ax1 = fig.add_subplot(gs[0, 0])
    ax2 = fig.add_subplot(gs[1, 0])
    ax3 = fig.add_subplot(gs[0, 1])
    ax4 = fig.add_subplot(gs[1, 1])

    ylabel = '单位阶跃响应' if variant['time_mode'] == 'step' else '斜坡跟踪误差'
    style_time_axis(ax1, ylabel)
    if variant['id'] == 'baseline':
        ax1.plot(arr(variant['step'], 't'), arr(variant['step'], 'y'), color=before_color, linewidth=1.9, label='基准')
        ax1.axhline(1.0, color=COLORS['limit'], linewidth=0.9, linestyle=':')
        ax1.set_title('左上：时域响应')
        ax1.legend(frameon=False, fontsize=8.6, loc='best')
    elif variant['time_mode'] == 'step':
        ax1.plot(arr(before['step'], 't'), arr(before['step'], 'y'), color=before_color, linewidth=1.8, label='校正前')
        ax1.plot(arr(variant['step'], 't'), arr(variant['step'], 'y'), color=after_color, linewidth=1.8, label='校正后')
        ax1.axhline(1.0, color=COLORS['limit'], linewidth=0.9, linestyle=':')
        ax1.set_title('左上：校正前/后时域响应')
        ax1.legend(frameon=False, fontsize=8.6, loc='best')
    else:
        ax1.plot(arr(before['ramp_error'], 't'), arr(before['ramp_error'], 'y'), color=before_color, linewidth=1.8, label='校正前')
        ax1.plot(arr(variant['ramp_error'], 't'), arr(variant['ramp_error'], 'y'), color=after_color, linewidth=1.8, label='校正后')
        ax1.axhline(0.0, color=COLORS['limit'], linewidth=0.9, linestyle=':')
        ax1.set_title('左上：校正前/后单位斜坡误差')
        ax1.legend(frameon=False, fontsize=8.6, loc='best')

    style_root_axis(ax2)
    for branch in root_branch_arrays(before):
        ax2.plot(branch[:, 0], branch[:, 1], color=before_color, linewidth=1.2, alpha=0.8)
    if variant['id'] != 'baseline':
        for branch in root_branch_arrays(variant):
            ax2.plot(branch[:, 0], branch[:, 1], color=after_color, linewidth=1.35, alpha=0.9)
    ax2.scatter(arr(before['open_loop_poles'], 'real'), arr(before['open_loop_poles'], 'imag'), marker='x', s=58, linewidths=1.5, color=before_color, zorder=6, label='校正前开环极点')
    ax2.scatter(arr(before['closed_loop_poles'], 'real'), arr(before['closed_loop_poles'], 'imag'), marker='o', s=40, facecolors=before_color, edgecolors='white', linewidths=0.8, zorder=7, label='校正前闭环极点')
    if variant['id'] != 'baseline':
        ax2.scatter(arr(variant['open_loop_poles'], 'real'), arr(variant['open_loop_poles'], 'imag'), marker='x', s=58, linewidths=1.5, color=after_color, zorder=6, label='校正后开环极点')
        zeros_real = arr(variant['open_loop_zeros'], 'real')
        zeros_imag = arr(variant['open_loop_zeros'], 'imag')
        if zeros_real.size:
            ax2.scatter(zeros_real, zeros_imag, marker='o', s=40, facecolors='white', edgecolors=after_color, linewidths=1.5, zorder=6, label='校正后开环零点')
        ax2.scatter(arr(variant['closed_loop_poles'], 'real'), arr(variant['closed_loop_poles'], 'imag'), marker='o', s=42, facecolors=after_color, edgecolors='white', linewidths=0.8, zorder=7, label='校正后闭环极点')
    else:
        zeros_real = arr(variant['open_loop_zeros'], 'real')
        zeros_imag = arr(variant['open_loop_zeros'], 'imag')
        if zeros_real.size:
            ax2.scatter(zeros_real, zeros_imag, marker='o', s=40, facecolors='white', edgecolors=before_color, linewidths=1.5, zorder=6, label='开环零点')
    set_root_limits(ax2, before, variant)
    ax2.set_title('左下：校正前/后根轨迹与极点位置')
    ax2.legend(frameon=False, fontsize=8.6, loc='best')

    style_bode_axes(ax3, ax4)
    w0 = arr(before['bode'], 'w')
    mag0 = arr(before['bode'], 'mag_db')
    phase0 = arr(before['bode'], 'phase_deg')
    ax3.semilogx(w0, mag0, color=before_color, linewidth=1.8, label='校正前')
    ax3.axhline(0, color=COLORS['limit'], linewidth=0.9, linestyle='--')
    draw_margin_lines_on_mag(ax3, w0, mag0, before['margins'], before_color)
    if variant['id'] != 'baseline':
        w = arr(variant['bode'], 'w')
        mag = arr(variant['bode'], 'mag_db')
        phase = arr(variant['bode'], 'phase_deg')
        ax3.semilogx(w, mag, color=after_color, linewidth=1.8, label='校正后')
        draw_margin_lines_on_mag(ax3, w, mag, variant['margins'], after_color)
        ax4.semilogx(w, phase, color=after_color, linewidth=1.8, label='校正后')
        draw_margin_lines_on_phase(ax4, w, phase, variant['margins'], after_color)
    ax3.set_title('右上：校正前/后幅频特性（含增益裕度）')
    ax3.legend(frameon=False, fontsize=8.6, loc='best')

    ax4.semilogx(w0, phase0, color=before_color, linewidth=1.8, label='校正前')
    ax4.axhline(-180, color=COLORS['limit'], linewidth=0.9, linestyle='--')
    draw_margin_lines_on_phase(ax4, w0, phase0, before['margins'], before_color)
    ax4.set_title('右下：校正前/后相频特性（含相角裕度）')
    ax4.text(
        0.02,
        0.03,
        (
            f"校正前 PM = {before['margins']['pm']:.2f}°  GM = {before['margins']['gm_db']:.2f} dB\n"
            + (
                '' if variant['id'] == 'baseline'
                else f"校正后 PM = {variant['margins']['pm']:.2f}°  GM = {variant['margins']['gm_db']:.2f} dB"
            )
        ).strip(),
        transform=ax4.transAxes,
        ha='left',
        va='bottom',
        fontsize=8.8,
        bbox=dict(boxstyle='round,pad=0.25', facecolor='white', edgecolor='#d9d9d9'),
    )
    ax4.legend(frameon=False, fontsize=8.6, loc='lower left')

    fig.suptitle(f"{variant['title']} | {variant['task_tag']}", fontsize=14, fontweight='bold')
    save(fig, filename)


def panel_box(ax: plt.Axes, xy, wh, facecolor, title, lines, accent):
    x, y = xy
    w, h = wh
    box = patches.FancyBboxPatch((x, y), w, h, boxstyle='round,pad=0.012,rounding_size=0.03', linewidth=1.2, edgecolor=accent, facecolor=facecolor)
    ax.add_patch(box)
    ax.text(x + 0.03 * w, y + h - 0.10 * h, title, fontsize=13, fontweight='bold', color=accent, va='top')
    ax.text(x + 0.03 * w, y + h - 0.22 * h, '\n'.join(lines), fontsize=10.4, color='#333333', va='top', linespacing=1.45)


def draw_boat(ax: plt.Axes, center, scale, color, heading_deg, wave_color='#9ecae1'):
    x, y = center
    hull = np.array([[-0.18, -0.04], [0.12, -0.04], [0.22, 0.0], [0.12, 0.04], [-0.18, 0.04]]) * scale
    theta = np.deg2rad(heading_deg)
    rot = np.array([[np.cos(theta), -np.sin(theta)], [np.sin(theta), np.cos(theta)]])
    hull = hull @ rot.T + np.array([x, y])
    ax.add_patch(patches.Polygon(hull, closed=True, facecolor=color, edgecolor='#2f2f2f', linewidth=1.0))
    mast = np.array([[0.0, -0.02], [0.0, 0.09]]) * scale
    mast = mast @ rot.T + np.array([x, y])
    ax.plot(mast[:, 0], mast[:, 1], color='#2f2f2f', linewidth=1.1)
    ax.plot([x - 0.18 * scale, x + 0.18 * scale], [y - 0.085 * scale, y - 0.085 * scale], color=wave_color, linewidth=2.0)


def render_cover(payload: dict) -> None:
    fig = plt.figure(figsize=(12.5, 7.0), dpi=220)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')
    ax.add_patch(patches.Rectangle((0, 0), 1, 1, facecolor='#fffdf8', edgecolor='none'))

    ax.text(0.05, 0.95, '3-9 稳定、动态与稳态的综合映射', fontsize=22, fontweight='bold', color='#14324a', va='top')
    ax.text(0.05, 0.90, '同一艘船，不同结构变化，先看哪一域最先说话', fontsize=11.5, color='#4d5b68', va='top')

    positions = [
        (0.05, 0.52, 0.27, 0.28, '基准版', ['超调 31.95%', 'PM 37.43°', '像一艘会动但还不够从容的船'], VARIANT_COLORS['baseline'], 18),
        (0.37, 0.52, 0.27, 0.28, '零点线补强', ['主导极点左移', 'PM 67.58°', '先把速度和阻尼整理好'], VARIANT_COLORS['zero_line'], 6),
        (0.69, 0.52, 0.26, 0.28, '强积分', ['斜坡误差近 0', 'PM 25.09°', '精度最强，代价也最重'], VARIANT_COLORS['pi_strong'], 26),
        (0.05, 0.14, 0.27, 0.28, '弱积分', ['误差开始下降', 'PM 34.97°', '先看到收益，也先看到慢极点'], VARIANT_COLORS['pi_weak'], 20),
        (0.37, 0.14, 0.27, 0.28, '积分校正', ['误差近 0 且动态恢复', 'PM 55.77°', '保留积分任务，同时整理中频'], VARIANT_COLORS['pi_corrected'], 8),
        (0.69, 0.14, 0.26, 0.28, '滞后对照', ['误差降到 2.78', 'PM 31.20°', '抬高低频，但型别不变'], VARIANT_COLORS['lag'], 16),
    ]

    for x, y, w, h, title, lines, color, heading in positions:
        panel = patches.FancyBboxPatch((x, y), w, h, boxstyle='round,pad=0.012,rounding_size=0.03', linewidth=1.2, edgecolor=color, facecolor='white')
        ax.add_patch(panel)
        draw_boat(ax, (x + 0.16 * w, y + 0.68 * h), 0.22 * w, color, heading)
        ax.text(x + 0.36 * w, y + 0.86 * h, title, fontsize=12.5, fontweight='bold', color=color, va='top')
        ax.text(x + 0.36 * w, y + 0.70 * h, '\n'.join(lines), fontsize=9.9, color='#333333', va='top', linespacing=1.4)

    ax.text(0.71, 0.07, '模块 3 的出口不是背控制器名单，而是学会先给任务贴标签。', fontsize=11.2, color='#5d3a1a')
    save(fig, '3-9-cover-comic.png')


def render_info(payload: dict) -> None:
    fig = plt.figure(figsize=(12.5, 8.0), dpi=220)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')
    ax.add_patch(patches.Rectangle((0, 0), 1, 1, facecolor='#ffffff', edgecolor='none'))

    ax.text(0.05, 0.95, '本讲信息图：从结构变化到任务标签', fontsize=21, fontweight='bold', color='#12344d', va='top')
    ax.text(0.05, 0.905, '统一对象下，先看根轨迹第一信号，再用时域和频域读回后果', fontsize=11.2, color='#51606d', va='top')

    panel_box(ax, (0.05, 0.58), (0.26, 0.26), '#eef6fb', '动态改善路线', [
        '代表：零点线补强',
        '第一信号：主导极点左移',
        '时域后果：更快、超调更可控',
        '频域后果：中频相位与交叉频率一起上去',
    ], VARIANT_COLORS['zero_line'])
    panel_box(ax, (0.37, 0.58), (0.26, 0.26), '#fff5ef', '稳态改善路线', [
        '代表：弱积分、强积分、滞后',
        '第一信号：低频误差开始下降',
        '时域代价：慢极点更明显或超调上升',
        '频域代价：相角裕度先变紧',
    ], VARIANT_COLORS['pi_strong'])
    panel_box(ax, (0.69, 0.58), (0.26, 0.26), '#eef8ef', '综合折中路线', [
        '代表：积分校正',
        '第一信号：低频任务保留，中频重新整理',
        '时域后果：误差继续小，动态也能恢复',
        '频域后果：PM 回升，交叉频率提高',
    ], VARIANT_COLORS['pi_corrected'])

    flow_y = 0.34
    steps = [
        ('1 结构变化', '增益、零点、积分、滞后'),
        ('2 根轨迹', '先看主导极点往哪边走'),
        ('3 时域结果', '快慢、超调、收束、误差'),
        ('4 频域解释', '带宽、PM、GM、三频段'),
        ('5 任务标签', '更快 / 更准 / 更稳'),
    ]
    x_positions = [0.07, 0.26, 0.45, 0.64, 0.83]
    for (title, subtitle), x in zip(steps, x_positions):
        rect = patches.FancyBboxPatch((x - 0.07, flow_y), 0.14, 0.11, boxstyle='round,pad=0.012,rounding_size=0.025', linewidth=1.1, edgecolor='#7fa1ba', facecolor='#f8fbfd')
        ax.add_patch(rect)
        ax.text(x, flow_y + 0.074, title, ha='center', va='center', fontsize=11.4, fontweight='bold', color='#1f4e79')
        ax.text(x, flow_y + 0.033, subtitle, ha='center', va='center', fontsize=8.8, color='#4f5d6a')
    for x1, x2 in zip(x_positions[:-1], x_positions[1:]):
        ax.annotate('', xy=(x2 - 0.08, flow_y + 0.055), xytext=(x1 + 0.08, flow_y + 0.055), arrowprops=dict(arrowstyle='->', color='#7fa1ba', linewidth=1.6))

    panel_box(ax, (0.05, 0.08), (0.42, 0.16), '#fffaf0', '三条最该带走的判断', [
        '看到“更快”，先回到根轨迹和中频相位。',
        '看到“更准”，先问是否真的需要改变型别。',
        '看到“又快又准”，通常意味着低频与中频要一起整理。',
    ], '#9c6b1a')
    panel_box(ax, (0.53, 0.08), (0.42, 0.16), '#f8f6ff', '进入 4-1 之前', [
        '不要先猜控制器名称。',
        '先说清：收益会先落在哪一域，代价又会先落在哪一域。',
        '模块 4 再继续讨论可行域、指标与整定。',
    ], '#5f4b8b')
    save(fig, '3-9-info.png')


def render_all(payload: dict) -> None:
    baseline = payload['variants']['baseline']
    variant_files = {
        'baseline': '3-9-baseline-quad.png',
        'zero_line': '3-9-zero-line-quad.png',
        'pi_weak': '3-9-integral-weak-quad.png',
        'pi_strong': '3-9-integral-strong-quad.png',
        'pi_corrected': '3-9-integral-corrected-quad.png',
        'lag': '3-9-lag-quad.png',
    }
    for key, filename in variant_files.items():
        plot_variant_quad(baseline, payload['variants'][key], filename)
    # 封面漫画与信息图为外部生成图，不允许被本脚本的 matplotlib 渲染结果覆盖。
    sync_preserved_runtime_assets()


if __name__ == '__main__':
    render_all(attach_root_locus_branches(load_payload()))
