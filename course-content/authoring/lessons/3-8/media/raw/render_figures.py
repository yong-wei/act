from __future__ import annotations

import csv
import json
import os
import subprocess
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
import numpy as np
from PIL import Image
from root_locus_branch_match import (
  PlotView,
  audit_root_locus,
  load_complex_points_csv,
  load_samples_csv,
  load_views_json,
  match_root_locus_branches,
  write_matched_csv,
)

DATA_PATH = Path(__file__).resolve().parent / 'generated-data' / '3-8-design-data.json'
RAW_DIR = Path(__file__).resolve().parent
DATA_DIR = RAW_DIR / 'generated-data'
OUT_DIR = RAW_DIR.parent / 'processed'
TIKZ_COMPILER = Path.home() / '.cc-switch' / 'skills' / 'tikz-control-draw' / 'scripts' / 'compile_to_png.py'
PLATFORM_BLOCK_TEX = RAW_DIR / '3-8-platform-block-diagram.tex'

matplotlib.rcParams['font.family'] = 'sans-serif'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'STHeiti', 'Arial Unicode MS', 'Arial Unicode', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'

COLORS = {
  'base': '#1f4e79',
  'gain': '#5d7ea6',
  'accent': '#d94801',
  'lead': '#2b8a3e',
  'warning': '#8b1e3f',
  'soft': '#8c99a0',
  'target': '#7a1f5c',
  'phase': '#6c757d',
  'fill': '#eef6fb',
  'slow': '#756bb1',
  'grid': '#dddddd',
}

ROOT_VIEW_LIMITS = {
  'effects-zero': {'xlim': (-4.6, 0.45), 'ylim': (-3.2, 3.2)},
  'effects-rhp-zero': {'xlim': (-6.4, 1.65), 'ylim': (-2.2, 2.2)},
  'platform-baseline': {'xlim': (-1100.0, 120.0), 'ylim': (-120.0, 120.0)},
}


def load_payload() -> dict:
  with DATA_PATH.open() as handle:
    return json.load(handle)


def flatten_to_white(path: Path) -> Image.Image:
  image = Image.open(path).convert('RGBA')
  background = Image.new('RGBA', image.size, (255, 255, 255, 255))
  return Image.alpha_composite(background, image).convert('RGB')


def save(fig: plt.Figure, filename: str) -> None:
  OUT_DIR.mkdir(parents=True, exist_ok=True)
  path = OUT_DIR / filename
  fig.savefig(path, dpi=220, facecolor='white', bbox_inches='tight')
  plt.close(fig)
  flatten_to_white(path).save(path)


def arr(block: dict, key: str) -> np.ndarray:
  return np.asarray(block[key], dtype=float)


def complex_points(block: dict) -> np.ndarray:
  return arr(block, 'real') + 1j * arr(block, 'imag')


def locus_points(block: dict) -> np.ndarray:
  return np.asarray(block['real'], dtype=float) + 1j * np.asarray(block['imag'], dtype=float)


def complex_list(block: dict) -> list[complex]:
  if 'real' not in block or 'imag' not in block:
    return []
  real_raw = block['real']
  imag_raw = block['imag']
  if isinstance(real_raw, list):
    real = np.asarray(real_raw, dtype=float)
    imag = np.asarray(imag_raw, dtype=float)
  else:
    real = np.asarray([real_raw], dtype=float)
    imag = np.asarray([imag_raw], dtype=float)
  if real.size == 0:
    return []
  return [complex(float(re), float(im)) for re, im in zip(real.tolist(), imag.tolist())]


def write_raw_root_locus_samples(path: Path, locus: dict) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  gains = arr(locus, 'k')
  real = np.asarray(locus['real'], dtype=float)
  imag = np.asarray(locus['imag'], dtype=float)
  with path.open('w', newline='', encoding='utf-8') as handle:
    writer = csv.writer(handle)
    writer.writerow(['sample_idx', 'gain', 're', 'im'])
    for sample_idx, gain in enumerate(gains):
      for root_idx in range(real.shape[0]):
        writer.writerow([sample_idx, f'{gain:.12f}', f'{real[root_idx, sample_idx]:.12f}', f'{imag[root_idx, sample_idx]:.12f}'])


def write_complex_points_csv(path: Path, points: list[complex]) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  with path.open('w', newline='', encoding='utf-8') as handle:
    writer = csv.writer(handle)
    writer.writerow(['re', 'im'])
    for point in points:
      writer.writerow([f'{point.real:.12f}', f'{point.imag:.12f}'])


def write_root_view_json(path: Path, name: str, xlim: tuple[float, float], ylim: tuple[float, float]) -> None:
  payload = {
    'views': [
      {
        'name': name,
        'role': 'standalone',
        'title': '根轨迹',
        'xlim': [float(xlim[0]), float(xlim[1])],
        'ylim': [float(ylim[0]), float(ylim[1])],
      }
    ]
  }
  path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')


def match_root_locus_for_plot(
  stem: str,
  locus: dict,
  open_poles: dict,
  open_zeros: dict,
  xlim: tuple[float, float],
  ylim: tuple[float, float],
  endpoint_tol: float = 5e-3,
) -> list[np.ndarray]:
  raw_samples_path = DATA_DIR / f'{stem}-root-locus-raw-samples.csv'
  poles_path = DATA_DIR / f'{stem}-open-loop-poles.csv'
  zeros_path = DATA_DIR / f'{stem}-open-loop-zeros.csv'
  views_path = DATA_DIR / f'{stem}-root-locus-views.json'
  matched_path = DATA_DIR / f'{stem}-root-locus-points.csv'
  audit_path = DATA_DIR / f'{stem}-root-locus-audit.json'

  write_raw_root_locus_samples(raw_samples_path, locus)
  write_complex_points_csv(poles_path, complex_list(open_poles))
  write_complex_points_csv(zeros_path, complex_list(open_zeros))
  write_root_view_json(views_path, stem, xlim, ylim)

  matched = match_root_locus_branches(load_samples_csv(raw_samples_path))
  write_matched_csv(matched_path, matched)
  report = audit_root_locus(
    matched=matched,
    open_loop_poles=load_complex_points_csv(poles_path),
    open_loop_zeros=load_complex_points_csv(zeros_path),
    endpoint_tol=endpoint_tol,
    views=load_views_json(views_path),
  )
  audit_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
  return [np.asarray(branch, dtype=complex) for branch in matched.branches]


def interp_logx(x: np.ndarray, y: np.ndarray, x0: float) -> float:
  return float(np.interp(np.log10(x0), np.log10(x), y))


def style_bode_axes(ax_mag: plt.Axes, ax_phase: plt.Axes) -> None:
  ax_mag.set_xscale('log')
  ax_phase.set_xscale('log')
  for ax in (ax_mag, ax_phase):
    ax.grid(True, which='both', color=COLORS['grid'], linewidth=0.7)
    ax.set_facecolor('white')
  ax_mag.set_ylabel('幅值 / dB')
  ax_phase.set_ylabel('相位 / deg')
  ax_phase.set_xlabel(r'$\omega$ / rad/s')


def style_step_axis(ax: plt.Axes) -> None:
  ax.grid(True, color=COLORS['grid'], linewidth=0.7)
  ax.set_facecolor('white')
  ax.set_xlabel('时间 / s')
  ax.set_ylabel('单位阶跃响应')


def style_nyquist_axis(ax: plt.Axes) -> None:
  ax.axhline(0, color='#999999', linewidth=0.8)
  ax.axvline(0, color='#999999', linewidth=0.8, linestyle='--')
  ax.grid(True, color=COLORS['grid'], linewidth=0.7)
  ax.set_facecolor('white')
  ax.set_xlabel('实部')
  ax.set_ylabel('虚部')
  ax.set_box_aspect(0.78)
  ax.set_aspect('equal', adjustable='datalim')


def style_root_axis(ax: plt.Axes) -> None:
  ax.axhline(0, color='#999999', linewidth=0.8)
  ax.axvline(0, color='#999999', linewidth=0.8, linestyle='--')
  ax.grid(True, color=COLORS['grid'], linewidth=0.7)
  ax.set_facecolor('white')
  ax.set_xlabel('实部')
  ax.set_ylabel('虚部')


def summary_box(ax: plt.Axes, title: str, lines: list[str], facecolor: str = '#f7f4ef', edgecolor: str = '#d0c6b4') -> None:
  ax.axis('off')
  text = '\n'.join([title, ''] + lines)
  ax.text(
    0.02,
    0.98,
    text,
    va='top',
    ha='left',
    fontsize=10.0,
    linespacing=1.52,
    bbox=dict(boxstyle='round,pad=0.55', facecolor=facecolor, edgecolor=edgecolor),
  )


def root_limits_from_sets(point_sets: list[np.ndarray]) -> tuple[float, float, float, float]:
  points = np.concatenate([pts.reshape(-1) for pts in point_sets if pts.size], axis=0)
  x = np.real(points)
  y = np.imag(points)
  x = np.asarray(x, dtype=float)
  y = np.asarray(y, dtype=float)
  mask = np.isfinite(x) & np.isfinite(y)
  x = x[mask]
  y = y[mask]
  if x.size == 0:
    return (-1.0, 1.0, -1.0, 1.0)
  x_min = float(np.min(x))
  x_max = float(np.max(x))
  y_min = float(np.min(y))
  y_max = float(np.max(y))
  span_x = max(x_max - x_min, 0.4)
  span_y = max(y_max - y_min, 0.6)
  return (
    x_min - 0.15 * span_x,
    x_max + 0.15 * span_x,
    y_min - 0.15 * span_y,
    y_max + 0.15 * span_y,
  )


def dedupe_legend(ax: plt.Axes, **kwargs) -> None:
  handles, labels = ax.get_legend_handles_labels()
  unique: dict[str, object] = {}
  for handle, label in zip(handles, labels):
    if label and label not in unique:
      unique[label] = handle
  if unique:
    ax.legend(unique.values(), unique.keys(), **kwargs)


def set_xy_limits(ax: plt.Axes, x: np.ndarray, y: np.ndarray, pad: float = 0.14, min_span_x: float = 0.8, min_span_y: float = 0.8) -> None:
  x = np.asarray(x, dtype=float)
  y = np.asarray(y, dtype=float)
  mask = np.isfinite(x) & np.isfinite(y)
  x = x[mask]
  y = y[mask]
  if x.size == 0:
    return
  x_min = float(np.min(x))
  x_max = float(np.max(x))
  y_min = float(np.min(y))
  y_max = float(np.max(y))
  span_x = max(x_max - x_min, min_span_x)
  span_y = max(y_max - y_min, min_span_y)
  ax.set_xlim(x_min - pad * span_x, x_max + pad * span_x)
  ax.set_ylim(y_min - pad * span_y, y_max + pad * span_y)


def apply_nyquist_limits(ax: plt.Axes, curve: dict) -> None:
  x = arr(curve, 'real')
  y = arr(curve, 'imag')
  full_x = np.concatenate([x, x, [-1.0, 0.0]])
  full_y = np.concatenate([y, -y, [0.0, 0.0]])
  set_xy_limits(ax, full_x, full_y, pad=0.18, min_span_x=1.4, min_span_y=1.0)


def apply_root_limits(ax: plt.Axes, point_sets: list[np.ndarray]) -> None:
  points = np.concatenate([pts.reshape(-1) for pts in point_sets if pts.size], axis=0)
  x = np.real(points)
  y = np.imag(points)
  set_xy_limits(ax, x, y, pad=0.15, min_span_x=0.4, min_span_y=0.6)


def add_gm_marker(ax: plt.Axes, w: np.ndarray, mag_db: np.ndarray, wg: float, gm_db: float, color: str, text_scale: float = 1.05) -> None:
  mag_at_wg = interp_logx(w, mag_db, wg)
  ax.axvline(wg, color=color, linewidth=1.0, linestyle=':')
  ax.plot([wg, wg], [mag_at_wg, 0], color=color, linewidth=1.8)
  ax.scatter([wg], [mag_at_wg], color=color, s=26, zorder=6)
  ax.text(wg * text_scale, mag_at_wg / 2, f'GM={gm_db:.1f} dB', fontsize=8.6, color=color)


def plot_effect_figure(effect: dict, filename: str, suptitle: str, artifact_prefix: str) -> None:
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, hspace=0.32, wspace=0.26)
  ax_step = fig.add_subplot(gs[0, 0])
  ax_root = fig.add_subplot(gs[1, 0])
  ax_mag = fig.add_subplot(gs[0, 1])
  ax_phase = fig.add_subplot(gs[1, 1])

  style_step_axis(ax_step)
  ax_step.plot(arr(effect['step_base'], 't'), arr(effect['step_base'], 'y'), color=COLORS['base'], linewidth=1.8, label=effect['base_label'])
  ax_step.plot(arr(effect['step_new'], 't'), arr(effect['step_new'], 'y'), color=COLORS['accent'], linewidth=1.8, label=effect['new_label'])
  ax_step.set_title('时域：闭环响应对照')
  dedupe_legend(ax_step, frameon=False, fontsize=8.8, loc='best')

  style_root_axis(ax_root)
  x0, x1, y0, y1 = root_limits_from_sets([
    locus_points(effect['root_base']),
    locus_points(effect['root_new']),
    complex_points(effect['closed_poles_base']),
    complex_points(effect['closed_poles_new']),
  ])
  view_limits = ROOT_VIEW_LIMITS.get(f'effects-{artifact_prefix}', {'xlim': (x0, x1), 'ylim': (y0, y1)})
  base_branches = match_root_locus_for_plot(
    stem=f'effects-{artifact_prefix}-base',
    locus=effect['root_base'],
    open_poles=effect['open_poles_base'],
    open_zeros=effect['open_zeros_base'],
    xlim=view_limits['xlim'],
    ylim=view_limits['ylim'],
  )
  new_branches = match_root_locus_for_plot(
    stem=f'effects-{artifact_prefix}-new',
    locus=effect['root_new'],
    open_poles=effect['open_poles_new'],
    open_zeros=effect['open_zeros_new'],
    xlim=view_limits['xlim'],
    ylim=view_limits['ylim'],
  )
  plot_root_locus(ax_root, base_branches, COLORS['soft'], f"{effect['base_label']}根轨迹", linewidth=1.15, alpha=0.85)
  plot_root_locus(ax_root, new_branches, COLORS['accent'], f"{effect['new_label']}根轨迹", linewidth=1.25, alpha=0.9)
  mark_open_loop_points(ax_root, effect['open_poles_base'], effect['open_zeros_base'], COLORS['soft'], prefix=effect['base_label'])
  mark_open_loop_points(ax_root, effect['open_poles_new'], effect['open_zeros_new'], COLORS['accent'], prefix=effect['new_label'])
  mark_closed_loop_points(ax_root, effect['closed_poles_base'], COLORS['base'], f"{effect['base_label']}闭环极点", marker='o', size=42)
  mark_closed_loop_points(ax_root, effect['closed_poles_new'], COLORS['accent'], f"{effect['new_label']}闭环极点", marker='D', size=42)
  ax_root.set_xlim(*view_limits['xlim'])
  ax_root.set_ylim(*view_limits['ylim'])
  ax_root.set_title('根轨迹：主导极点落点对照')
  dedupe_legend(ax_root, frameon=False, fontsize=7.8, loc='best')

  style_bode_axes(ax_mag, ax_phase)
  w_base = arr(effect['bode_base'], 'w')
  mag_base = arr(effect['bode_base'], 'mag_db')
  phase_base = arr(effect['bode_base'], 'phase_deg')
  w_new = arr(effect['bode_new'], 'w')
  mag_new = arr(effect['bode_new'], 'mag_db')
  phase_new = arr(effect['bode_new'], 'phase_deg')
  ax_mag.semilogx(w_base, mag_base, color=COLORS['base'], linewidth=1.8, label=effect['base_label'])
  ax_mag.semilogx(w_new, mag_new, color=COLORS['accent'], linewidth=1.8, label=effect['new_label'])
  ax_mag.axhline(0, color='#aaaaaa', linewidth=0.8, linestyle='--')
  if np.isfinite(effect['margin_base']['wc']):
    ax_mag.axvline(effect['margin_base']['wc'], color=COLORS['base'], linewidth=1.0, linestyle='--')
  if np.isfinite(effect['margin_new']['wc']):
    ax_mag.axvline(effect['margin_new']['wc'], color=COLORS['accent'], linewidth=1.0, linestyle='--')
  ax_mag.set_title('幅频：截止频率与增益裕度')
  dedupe_legend(ax_mag, frameon=False, fontsize=8.8, loc='best')

  ax_phase.semilogx(w_base, phase_base, color=COLORS['base'], linewidth=1.8)
  ax_phase.semilogx(w_new, phase_new, color=COLORS['accent'], linewidth=1.8)
  ax_phase.axhline(-180, color='#aaaaaa', linewidth=0.8, linestyle='--')
  add_pm_marker(ax_phase, w_base, phase_base, effect['margin_base']['wc'], effect['margin_base']['pm'], COLORS['base'])
  add_pm_marker(ax_phase, w_new, phase_new, effect['margin_new']['wc'], effect['margin_new']['pm'], COLORS['accent'])
  ax_phase.set_title('相频：相角裕度对照')
  fig.suptitle(suptitle, fontsize=14, fontweight='bold')
  save(fig, filename)


def render_effects(payload: dict) -> None:
  plot_effect_figure(payload['effects']['gain'], '3-8-gain-effect.png', '增益提升：整体上移，但中频余量会先变紧', 'gain')
  plot_effect_figure(payload['effects']['zero'], '3-8-zero-effect.png', '左半平面零点：重点改写中频，相位提前与高频代价同时出现', 'zero')
  plot_effect_figure(payload['effects']['pole'], '3-8-pole-effect.png', '积分极点：先增强低频精度，再压缩中频相位余量', 'pole')
  plot_effect_figure(payload['effects']['rhp_zero'], '3-8-rhp-zero-effect.png', '右半平面零点：只看幅值会误判，必须连同相位一起判断', 'rhp-zero')


def render_nyquist_quickcheck(payload: dict) -> None:
  fig = plt.figure(figsize=(11.8, 9.0), dpi=220)
  gs = fig.add_gridspec(2, 2, hspace=0.26, wspace=0.22)
  for idx, item in enumerate(payload['nyquist_quickcheck']['cases']):
    ax = fig.add_subplot(gs[idx // 2, idx % 2])
    style_nyquist_axis(ax)
    x = arr(item['curve'], 'real')
    y = arr(item['curve'], 'imag')
    ax.plot(x, y, color=COLORS['base'], linewidth=1.8)
    ax.plot(x, -y, color=COLORS['base'], linewidth=1.0, linestyle='--')
    ax.scatter([-1], [0], color='black', s=30, zorder=5)
    apply_nyquist_limits(ax, item['curve'])
    ax.set_title(f"{item['label']} | P={item['P']}  N={item['N']}  Z={item['Z']}", fontsize=11)
    ax.text(
      0.03,
      0.97,
      item['title'],
      transform=ax.transAxes,
      ha='left',
      va='top',
      fontsize=9,
      bbox=dict(boxstyle='round,pad=0.2', facecolor='white', edgecolor='#d9d9d9'),
    )
  fig.suptitle('Nyquist 快速判稳：先数 P，再数 N，最后由 Z=P-N 判断闭环稳定性', fontsize=14, fontweight='bold')
  save(fig, '3-8-nyquist-quickcheck.png')


def render_nyquist_compare(payload: dict) -> None:
  fig = plt.figure(figsize=(8.0, 6.1), dpi=220)
  ax1 = fig.add_subplot(1, 1, 1)
  style_nyquist_axis(ax1)

  for block, color in [
    (payload['nyquist_compare']['small'], COLORS['base']),
    (payload['nyquist_compare']['large'], COLORS['accent']),
  ]:
    x = arr(block, 'real')
    y = arr(block, 'imag')
    ax1.plot(x, y, color=color, linewidth=1.8)
    ax1.plot(x, -y, color=color, linewidth=1.0, linestyle='--')
  ax1.scatter([-1], [0], color='black', s=35, zorder=6)
  ax1.set_xlim(-1.8, 0.8)
  ax1.set_ylim(-1.4, 1.4)
  save(fig, '3-8-nyquist-example.png')


def render_bode(payload: dict) -> None:
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, hspace=0.32, wspace=0.24)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  ax3 = fig.add_subplot(gs[1, 0])
  ax4 = fig.add_subplot(gs[1, 1])

  style_bode_axes(ax1, ax2)
  w = arr(payload['bode']['open_loop'], 'w')
  mag_db = arr(payload['bode']['open_loop'], 'mag_db')
  phase_deg = arr(payload['bode']['open_loop'], 'phase_deg')
  wc = payload['bode']['margins']['wc']
  wg = payload['bode']['margins']['wg']
  pm = payload['bode']['margins']['pm']
  gm_db = payload['bode']['margins']['gm_db']

  ax1.semilogx(w, mag_db, color=COLORS['base'], linewidth=1.8)
  ax1.axhline(0, color='#aaaaaa', linewidth=0.8, linestyle='--')
  ax1.axvline(wc, color=COLORS['accent'], linewidth=1.1, linestyle='--')
  ax1.axvline(wg, color=COLORS['soft'], linewidth=1.1, linestyle='--')
  ax1.plot([wg, wg], [payload['bode']['mag_at_wg'], 0], color=COLORS['target'], linewidth=2.0)
  ax1.scatter([wg], [payload['bode']['mag_at_wg']], color=COLORS['target'], s=35, zorder=5)
  ax1.set_title('幅频：相位穿越频率与增益裕度线')
  ax1.text(wc * 1.05, 0.82 * ax1.get_ylim()[1], rf'$\omega_c={wc:.2f}$', fontsize=9, color=COLORS['accent'])
  ax1.text(wg * 1.05, 0.65 * ax1.get_ylim()[1], rf'$\omega_\pi={wg:.2f}$', fontsize=9, color=COLORS['soft'])
  ax1.text(wg * 1.05, payload['bode']['mag_at_wg'] / 2, f'GM = {gm_db:.1f} dB', fontsize=9, color=COLORS['target'])

  ax2.semilogx(w, phase_deg, color=COLORS['base'], linewidth=1.8)
  ax2.axhline(-180, color='#aaaaaa', linewidth=0.8, linestyle='--')
  ax2.axvline(wc, color=COLORS['accent'], linewidth=1.1, linestyle='--')
  ax2.axvline(wg, color=COLORS['soft'], linewidth=1.1, linestyle='--')
  ax2.plot([wc, wc], [payload['bode']['phase_at_wc'], -180], color=COLORS['lead'], linewidth=2.0)
  ax2.scatter([wc], [payload['bode']['phase_at_wc']], color=COLORS['lead'], s=35, zorder=5)
  ax2.set_title('相频：截止频率与相角裕度线')
  ax2.text(wc * 1.05, -95, rf'$\omega_c={wc:.2f}$', fontsize=9, color=COLORS['accent'])
  ax2.text(wg * 1.05, -120, rf'$\omega_\pi={wg:.2f}$', fontsize=9, color=COLORS['soft'])
  ax2.text(wc * 1.05, (payload['bode']['phase_at_wc'] - 180) / 2 - 90, f'PM = {pm:.1f}°', fontsize=9, color=COLORS['lead'])

  style_step_axis(ax3)
  ax3.plot(arr(payload['bode']['step'], 't'), arr(payload['bode']['step'], 'y'), color=COLORS['base'], linewidth=1.8)
  ax3.set_title('闭环阶跃：裕度不足会直接放大超调与振荡')

  lines = [
    f"截止频率 wc = {wc:.2f} rad/s",
    f"相位穿越频率 wπ = {wg:.2f} rad/s",
    f"相角裕度 PM = {pm:.1f}°",
    f"增益裕度 GM = {gm_db:.1f} dB",
    f"闭环超调 = {payload['bode']['metrics']['overshoot']:.1f}%",
  ]
  summary_box(ax4, '读图顺序', lines, facecolor='#eef8ee', edgecolor='#c4dec4')
  fig.suptitle('Bode 判稳：频率线与裕度线必须同时出现，才有完整判读信息', fontsize=14, fontweight='bold')
  save(fig, '3-8-bode-example.png')


def render_three_band(payload: dict) -> None:
  fig, ax = plt.subplots(figsize=(13.6, 5.1), dpi=220)
  w = np.asarray(payload['three_band']['w'], dtype=float)
  mag_db = np.asarray(payload['three_band']['mag_db'], dtype=float)
  b1, b2 = payload['three_band']['boundaries']

  ax.set_xscale('log')
  ax.axvspan(w.min(), b1, color='#eef6fb', alpha=0.96)
  ax.axvspan(b1, b2, color='#f8f3ea', alpha=0.96)
  ax.axvspan(b2, w.max(), color='#f7eef3', alpha=0.96)
  ax.semilogx(w, mag_db, color=COLORS['base'], linewidth=2.1)
  ax.grid(True, which='both', color=COLORS['grid'], linewidth=0.7)
  ax.set_facecolor('white')
  ax.set_xlabel(r'$\omega$ / rad/s')
  ax.set_ylabel('幅值 / dB')
  ax.set_title('三频段分工：低频保精度，中频定速度与裕度，高频承担代价')
  y_top = ax.get_ylim()[1]
  ax.text(0.028, y_top - 4.6, '低频：稳态精度、抗缓变扰动', fontsize=10.5, color=COLORS['base'])
  ax.text(0.22, y_top - 4.6, '中频：截止频率、相角裕度、超调', fontsize=10.5, color=COLORS['accent'])
  ax.text(7.5, y_top - 4.6, '高频：噪声敏感性、执行器负担', fontsize=10.5, color=COLORS['warning'])
  save(fig, '3-8-three-band-overview.png')


def plot_root_locus(ax: plt.Axes, locus: dict | list[np.ndarray], color: str, label: str, linewidth: float = 1.3, alpha: float = 0.9) -> None:
  if isinstance(locus, dict):
    branches = [np.asarray(branch, dtype=complex) for branch in locus_points(locus)]
  else:
    branches = locus
  for idx, branch in enumerate(branches):
    ax.plot(np.real(branch), np.imag(branch), color=color, linewidth=linewidth, alpha=alpha, label=label if idx == 0 else None)


def mark_open_loop_points(ax: plt.Axes, poles: dict, zeros: dict, color: str, prefix: str | None = None, alpha: float = 1.0) -> None:
  pole_label = '开环极点' if prefix is None else f'{prefix}开环极点'
  zero_label = '开环零点' if prefix is None else f'{prefix}开环零点'
  pole_points = complex_points(poles)
  if pole_points.size:
    ax.scatter(np.real(pole_points), np.imag(pole_points), marker='x', color=color, s=58, linewidths=1.6, alpha=alpha, label=pole_label, zorder=6)
  zero_points = complex_points(zeros)
  if zero_points.size:
    ax.scatter(np.real(zero_points), np.imag(zero_points), marker='o', facecolors='none', edgecolors=color, s=58, linewidths=1.6, alpha=alpha, label=zero_label, zorder=6)


def mark_closed_loop_points(ax: plt.Axes, poles: dict, color: str, label: str, marker: str = 'o', size: float = 54) -> None:
  points = complex_points(poles)
  if points.size:
    ax.scatter(np.real(points), np.imag(points), marker=marker, color=color, s=size, label=label, zorder=7)


def add_pm_marker(ax: plt.Axes, w: np.ndarray, phase_deg: np.ndarray, wc: float, pm: float, color: str, text_scale: float = 1.06) -> None:
  phase_at_wc = interp_logx(w, phase_deg, wc)
  ax.axvline(wc, color=color, linewidth=1.0, linestyle='--')
  ax.plot([wc, wc], [phase_at_wc, -180], color=color, linewidth=1.9)
  ax.scatter([wc], [phase_at_wc], color=color, s=30, zorder=6)
  ax.text(wc * text_scale, (phase_at_wc - 180) / 2 - 90, f'PM={pm:.1f}°', fontsize=8.8, color=color)


def render_heading_baseline(payload: dict) -> None:
  fig = plt.figure(figsize=(12.6, 8.6), dpi=220)
  gs = fig.add_gridspec(2, 2, hspace=0.32, wspace=0.26)
  ax_step = fig.add_subplot(gs[0, 0])
  ax_root = fig.add_subplot(gs[1, 0])
  ax_mag = fig.add_subplot(gs[0, 1])
  ax_phase = fig.add_subplot(gs[1, 1])

  style_step_axis(ax_step)
  ax_step.plot(arr(payload['heading_case']['step_base'], 't'), arr(payload['heading_case']['step_base'], 'y'), color=COLORS['base'], linewidth=2.0, label='基线闭环')
  ax_step.set_title('闭环时域：基线方案的超调与收敛速度')
  ax_step.text(0.03, 0.95, f"超调 {payload['heading_case']['metrics_base']['overshoot']:.2f}%\n调节时间 {payload['heading_case']['metrics_base']['settling_time']:.2f} s",
               transform=ax_step.transAxes, va='top', ha='left', fontsize=9.5,
               bbox=dict(boxstyle='round,pad=0.22', facecolor='white', edgecolor='#d9d9d9'))

  style_root_axis(ax_root)
  plot_root_locus(ax_root, payload['heading_case']['root_base'], COLORS['base'], '基线根轨迹', linewidth=1.4)
  mark_open_loop_points(ax_root, payload['heading_case']['open_poles_base'], payload['heading_case']['open_zeros_base'], COLORS['base'])
  mark_closed_loop_points(ax_root, payload['heading_case']['closed_poles_base'], COLORS['accent'], '当前闭环极点', marker='o', size=48)
  apply_root_limits(ax_root, [
    locus_points(payload['heading_case']['root_base']),
    complex_points(payload['heading_case']['open_poles_base']),
    complex_points(payload['heading_case']['closed_poles_base']),
  ])
  ax_root.set_title('复数域：根轨迹与当前闭环极点')
  dedupe_legend(ax_root, frameon=False, fontsize=8.6, loc='best')

  style_bode_axes(ax_mag, ax_phase)
  w = arr(payload['heading_case']['open_base'], 'w')
  mag_db = arr(payload['heading_case']['open_base'], 'mag_db')
  phase_deg = arr(payload['heading_case']['open_base'], 'phase_deg')
  wc = payload['heading_case']['margin_base']['wc']
  wg = payload['heading_case']['margin_base']['wg']
  ax_mag.semilogx(w, mag_db, color=COLORS['base'], linewidth=2.0)
  ax_mag.axhline(0, color='#aaaaaa', linewidth=0.8, linestyle='--')
  ax_mag.axvline(wc, color=COLORS['accent'], linewidth=1.0, linestyle='--')
  add_gm_marker(ax_mag, w, mag_db, wg, payload['heading_case']['margin_base']['gm_db'], COLORS['target'])
  ax_mag.text(wc * 1.06, 0.78 * ax_mag.get_ylim()[1], rf'$\omega_c={wc:.4f}$', fontsize=9, color=COLORS['accent'])
  ax_mag.text(wg * 1.05, 0.55 * ax_mag.get_ylim()[1], rf'$\omega_\pi={wg:.4f}$', fontsize=8.7, color=COLORS['target'])
  ax_mag.set_title('开环幅频：截止频率与增益裕度')

  ax_phase.semilogx(w, phase_deg, color=COLORS['base'], linewidth=2.0)
  ax_phase.axhline(-180, color='#aaaaaa', linewidth=0.8, linestyle='--')
  ax_phase.axvline(wg, color=COLORS['target'], linewidth=1.0, linestyle=':')
  add_pm_marker(ax_phase, w, phase_deg, wc, payload['heading_case']['margin_base']['pm'], COLORS['lead'])
  ax_phase.set_title('开环相频：基线相角裕度')

  fig.suptitle('航向控制基线方案：先看原始单位负反馈闭环到底慢在何处、险在何处', fontsize=14, fontweight='bold')
  save(fig, '3-8-heading-baseline.png')


def render_heading_case(payload: dict) -> None:
  fig = plt.figure(figsize=(12.6, 8.6), dpi=220)
  gs = fig.add_gridspec(2, 2, hspace=0.32, wspace=0.26)
  ax_step = fig.add_subplot(gs[0, 0])
  ax_root = fig.add_subplot(gs[1, 0])
  ax_mag = fig.add_subplot(gs[0, 1])
  ax_phase = fig.add_subplot(gs[1, 1])

  style_step_axis(ax_step)
  ax_step.plot(arr(payload['heading_case']['step_base'], 't'), arr(payload['heading_case']['step_base'], 'y'), color=COLORS['base'], linewidth=1.9, label='基线')
  ax_step.plot(arr(payload['heading_case']['step_comp'], 't'), arr(payload['heading_case']['step_comp'], 'y'), color=COLORS['accent'], linewidth=1.9, label='超前校正后')
  ax_step.set_title('闭环时域：校正后更快收敛，且超调明显下降')
  dedupe_legend(ax_step, frameon=False, fontsize=9, loc='best')

  style_root_axis(ax_root)
  plot_root_locus(ax_root, payload['heading_case']['root_base'], COLORS['soft'], '未校正根轨迹', linewidth=1.15, alpha=0.85)
  plot_root_locus(ax_root, payload['heading_case']['root_comp'], COLORS['accent'], '校正后根轨迹', linewidth=1.35, alpha=0.9)
  mark_open_loop_points(ax_root, payload['heading_case']['open_poles_base'], payload['heading_case']['open_zeros_base'], COLORS['soft'], prefix='未校正')
  mark_open_loop_points(ax_root, payload['heading_case']['open_poles_comp'], payload['heading_case']['open_zeros_comp'], COLORS['accent'], prefix='校正后')
  mark_closed_loop_points(ax_root, payload['heading_case']['closed_poles_base'], COLORS['base'], '基线闭环极点', marker='o', size=44)
  mark_closed_loop_points(ax_root, payload['heading_case']['closed_poles_comp'], COLORS['accent'], '校正后闭环极点', marker='D', size=44)
  apply_root_limits(ax_root, [
    locus_points(payload['heading_case']['root_base']),
    locus_points(payload['heading_case']['root_comp']),
    complex_points(payload['heading_case']['closed_poles_base']),
    complex_points(payload['heading_case']['closed_poles_comp']),
  ])
  ax_root.set_title('复数域：闭环极点左移并获得更有利阻尼')
  dedupe_legend(ax_root, frameon=False, fontsize=8.2, loc='best')

  style_bode_axes(ax_mag, ax_phase)
  w_base = arr(payload['heading_case']['open_base'], 'w')
  w_comp = arr(payload['heading_case']['open_comp'], 'w')
  mag_base = arr(payload['heading_case']['open_base'], 'mag_db')
  mag_comp = arr(payload['heading_case']['open_comp'], 'mag_db')
  phase_base = arr(payload['heading_case']['open_base'], 'phase_deg')
  phase_comp = arr(payload['heading_case']['open_comp'], 'phase_deg')
  wc_base = payload['heading_case']['margin_base']['wc']
  wc_comp = payload['heading_case']['margin_comp']['wc']
  wg_base = payload['heading_case']['margin_base']['wg']
  wg_comp = payload['heading_case']['margin_comp']['wg']

  ax_mag.semilogx(w_base, mag_base, color=COLORS['base'], linewidth=1.9, label='基线')
  ax_mag.semilogx(w_comp, mag_comp, color=COLORS['accent'], linewidth=1.9, label='超前校正后')
  ax_mag.axhline(0, color='#aaaaaa', linewidth=0.8, linestyle='--')
  ax_mag.axvline(wc_base, color=COLORS['base'], linewidth=1.0, linestyle='--')
  ax_mag.axvline(wc_comp, color=COLORS['accent'], linewidth=1.0, linestyle='--')
  add_gm_marker(ax_mag, w_base, mag_base, wg_base, payload['heading_case']['margin_base']['gm_db'], COLORS['base'], text_scale=1.03)
  add_gm_marker(ax_mag, w_comp, mag_comp, wg_comp, payload['heading_case']['margin_comp']['gm_db'], COLORS['accent'], text_scale=1.03)
  ax_mag.text(wc_base * 1.05, 0.83 * ax_mag.get_ylim()[1], rf'$\omega_c={wc_base:.4f}$', fontsize=8.8, color=COLORS['base'])
  ax_mag.text(wc_comp * 1.05, 0.69 * ax_mag.get_ylim()[1], rf'$\omega_c={wc_comp:.4f}$', fontsize=8.8, color=COLORS['accent'])
  ax_mag.set_title('开环幅频：截止频率、相位穿越频率与增益裕度')
  dedupe_legend(ax_mag, frameon=False, fontsize=9, loc='best')

  ax_phase.semilogx(w_base, phase_base, color=COLORS['base'], linewidth=1.9, label='基线')
  ax_phase.semilogx(w_comp, phase_comp, color=COLORS['accent'], linewidth=1.9, label='超前校正后')
  ax_phase.axhline(-180, color='#aaaaaa', linewidth=0.8, linestyle='--')
  ax_phase.axvline(wg_base, color=COLORS['base'], linewidth=1.0, linestyle=':')
  ax_phase.axvline(wg_comp, color=COLORS['accent'], linewidth=1.0, linestyle=':')
  add_pm_marker(ax_phase, w_base, phase_base, wc_base, payload['heading_case']['margin_base']['pm'], COLORS['base'])
  add_pm_marker(ax_phase, w_comp, phase_comp, wc_comp, payload['heading_case']['margin_comp']['pm'], COLORS['accent'])
  ax_phase.set_title('开环相频：目标频带补角后，相角裕度明显抬高')

  fig.suptitle('航向控制：基线方案与超前校正方案的 2×2 对照', fontsize=14, fontweight='bold')
  save(fig, '3-8-heading-case.png')


def render_platform_baseline(payload: dict) -> None:
  fig = plt.figure(figsize=(12.6, 8.6), dpi=220)
  gs = fig.add_gridspec(2, 2, hspace=0.32, wspace=0.26)
  ax_step = fig.add_subplot(gs[0, 0])
  ax_root = fig.add_subplot(gs[1, 0])
  ax_mag = fig.add_subplot(gs[0, 1])
  ax_phase = fig.add_subplot(gs[1, 1])

  style_step_axis(ax_step)
  ax_step.plot(arr(payload['platform_case']['step_fast'], 't'), arr(payload['platform_case']['step_fast'], 'y'), color=COLORS['warning'], linewidth=2.0, label=payload['platform_case']['fast_label'])
  ax_step.set_title('闭环时域：激进增益方案虽然快，但峰化与超调偏大')
  ax_step.text(0.03, 0.95, f"超调 {payload['platform_case']['metrics_fast']['overshoot']:.2f}%\n调节时间 {payload['platform_case']['metrics_fast']['settling_time']:.3f} s",
               transform=ax_step.transAxes, va='top', ha='left', fontsize=9.5,
               bbox=dict(boxstyle='round,pad=0.22', facecolor='white', edgecolor='#d9d9d9'))

  style_root_axis(ax_root)
  platform_view = ROOT_VIEW_LIMITS['platform-baseline']
  matched_platform_branches = match_root_locus_for_plot(
    stem='platform-baseline',
    locus=payload['platform_case']['root_base'],
    open_poles=payload['platform_case']['open_poles_base'],
    open_zeros=payload['platform_case']['open_zeros_base'],
    xlim=platform_view['xlim'],
    ylim=platform_view['ylim'],
  )
  plot_root_locus(ax_root, matched_platform_branches, COLORS['warning'], '名义对象根轨迹', linewidth=1.3)
  mark_open_loop_points(ax_root, payload['platform_case']['open_poles_base'], payload['platform_case']['open_zeros_base'], COLORS['warning'])
  mark_closed_loop_points(ax_root, payload['platform_case']['closed_poles_fast'], COLORS['accent'], 'K=5 闭环极点', marker='o', size=44)
  ax_root.set_xlim(*platform_view['xlim'])
  ax_root.set_ylim(*platform_view['ylim'])
  ax_root.set_title('复数域：激进增益对应的闭环极点已逼近低阻尼区域')
  dedupe_legend(ax_root, frameon=False, fontsize=8.5, loc='best')

  style_bode_axes(ax_mag, ax_phase)
  w = arr(payload['platform_case']['open_fast'], 'w')
  mag_db = arr(payload['platform_case']['open_fast'], 'mag_db')
  phase_deg = arr(payload['platform_case']['open_fast'], 'phase_deg')
  wc = payload['platform_case']['margin_fast']['wc']
  ax_mag.semilogx(w, mag_db, color=COLORS['warning'], linewidth=2.0)
  ax_mag.axhline(0, color='#aaaaaa', linewidth=0.8, linestyle='--')
  ax_mag.axvline(wc, color=COLORS['accent'], linewidth=1.0, linestyle='--')
  ax_mag.text(wc * 1.04, 0.8 * ax_mag.get_ylim()[1], rf'$\omega_c={wc:.2f}$', fontsize=8.8, color=COLORS['accent'])
  ax_mag.set_title('开环幅频：激进增益把截止频率推得很高')

  ax_phase.semilogx(w, phase_deg, color=COLORS['warning'], linewidth=2.0)
  ax_phase.axhline(-180, color='#aaaaaa', linewidth=0.8, linestyle='--')
  add_pm_marker(ax_phase, w, phase_deg, wc, payload['platform_case']['margin_fast']['pm'], COLORS['lead'])
  ax_phase.set_title('开环相频：速度是有了，但相角裕度并不充足')

  fig.suptitle('稳定平台激进基线：只靠提高增益能提速，但代价先落在中频余量上', fontsize=14, fontweight='bold')
  save(fig, '3-8-platform-baseline.png')


def render_platform_case(payload: dict) -> None:
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, hspace=0.32, wspace=0.26)
  ax_step = fig.add_subplot(gs[0, 0])
  ax_root = fig.add_subplot(gs[1, 0])
  ax_mag = fig.add_subplot(gs[0, 1])
  ax_phase = fig.add_subplot(gs[1, 1])

  style_step_axis(ax_step)
  ax_step.plot(arr(payload['platform_case']['step_fast'], 't'), arr(payload['platform_case']['step_fast'], 'y'),
               color=COLORS['warning'], linewidth=1.9, label=payload['platform_case']['fast_label'])
  ax_step.plot(arr(payload['platform_case']['step_slow'], 't'), arr(payload['platform_case']['step_slow'], 'y'),
               color=COLORS['slow'], linewidth=1.9, label=payload['platform_case']['slow_label'])
  ax_step.plot(arr(payload['platform_case']['step_comp'], 't'), arr(payload['platform_case']['step_comp'], 'y'),
               color=COLORS['lead'], linewidth=1.9, label=payload['platform_case']['comp_label'])
  ax_step.set_title('闭环时域：降增益能减超调，但速度损失明显；校正方案兼顾两者')
  dedupe_legend(ax_step, frameon=False, fontsize=8.7, loc='best')

  style_root_axis(ax_root)
  plot_root_locus(ax_root, payload['platform_case']['root_base'], COLORS['soft'], '名义对象根轨迹', linewidth=1.1, alpha=0.85)
  plot_root_locus(ax_root, payload['platform_case']['root_comp'], COLORS['lead'], '校正后根轨迹', linewidth=1.25, alpha=0.9)
  mark_open_loop_points(ax_root, payload['platform_case']['open_poles_base'], payload['platform_case']['open_zeros_base'], COLORS['soft'], prefix='名义')
  mark_open_loop_points(ax_root, payload['platform_case']['open_poles_comp'], payload['platform_case']['open_zeros_comp'], COLORS['lead'], prefix='校正后')
  mark_closed_loop_points(ax_root, payload['platform_case']['closed_poles_fast'], COLORS['warning'], 'K=5 闭环极点', marker='o', size=40)
  mark_closed_loop_points(ax_root, payload['platform_case']['closed_poles_slow'], COLORS['slow'], 'K=0.2 闭环极点', marker='s', size=40)
  mark_closed_loop_points(ax_root, payload['platform_case']['closed_poles_comp'], COLORS['lead'], '超前校正闭环极点', marker='D', size=40)
  apply_root_limits(ax_root, [
    locus_points(payload['platform_case']['root_base']),
    locus_points(payload['platform_case']['root_comp']),
    complex_points(payload['platform_case']['closed_poles_fast']),
    complex_points(payload['platform_case']['closed_poles_slow']),
    complex_points(payload['platform_case']['closed_poles_comp']),
  ])
  ax_root.set_title('复数域：校正不是简单左移，而是把极点重新布到更有利阻尼区')
  dedupe_legend(ax_root, frameon=False, fontsize=7.8, loc='best')

  style_bode_axes(ax_mag, ax_phase)
  for block, color, label, margin in [
    ('open_fast', COLORS['warning'], payload['platform_case']['fast_label'], payload['platform_case']['margin_fast']),
    ('open_slow', COLORS['slow'], payload['platform_case']['slow_label'], payload['platform_case']['margin_slow']),
    ('open_comp', COLORS['lead'], payload['platform_case']['comp_label'], payload['platform_case']['margin_comp']),
  ]:
    w = arr(payload['platform_case'][block], 'w')
    mag_db = arr(payload['platform_case'][block], 'mag_db')
    phase_deg = arr(payload['platform_case'][block], 'phase_deg')
    ax_mag.semilogx(w, mag_db, color=color, linewidth=1.8, label=label)
    ax_phase.semilogx(w, phase_deg, color=color, linewidth=1.8, label=label)
    ax_mag.axvline(margin['wc'], color=color, linewidth=0.9, linestyle='--', alpha=0.7)
    add_pm_marker(ax_phase, w, phase_deg, margin['wc'], margin['pm'], color, text_scale=1.03)
  ax_mag.axhline(0, color='#aaaaaa', linewidth=0.8, linestyle='--')
  ax_phase.axhline(-180, color='#aaaaaa', linewidth=0.8, linestyle='--')
  ax_mag.set_title('开环幅频：仅降增益会把截止频率压得过低，校正方案保持较高速度')
  ax_phase.set_title('开环相频：校正方案在保持截止频率的同时抬高相角裕度')
  dedupe_legend(ax_mag, frameon=False, fontsize=8.6, loc='best')

  fig.suptitle('稳定平台：激进基线、仅降增益与超前校正的 2×2 对照', fontsize=14, fontweight='bold')
  save(fig, '3-8-platform-case.png')


def render_platform_block_diagram() -> None:
  OUT_DIR.mkdir(parents=True, exist_ok=True)
  output = OUT_DIR / '3-8-platform-block-diagram.png'
  subprocess.run(
    ['python3', str(TIKZ_COMPILER), str(PLATFORM_BLOCK_TEX), str(output), '300'],
    check=True,
  )
  flatten_to_white(output).save(output)


def main() -> None:
  payload = load_payload()
  render_effects(payload)
  render_nyquist_quickcheck(payload)
  render_nyquist_compare(payload)
  render_bode(payload)
  render_three_band(payload)
  render_heading_baseline(payload)
  render_heading_case(payload)
  render_platform_block_diagram()
  render_platform_baseline(payload)
  render_platform_case(payload)


if __name__ == '__main__':
  main()
