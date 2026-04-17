from __future__ import annotations

import json
import os
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

RAW_DIR = ROOT / 'course-content' / 'authoring' / 'lessons' / '4-2' / 'media' / 'raw'
DATA_DIR = RAW_DIR / 'generated-data'
OUT_DIR = ROOT / 'course-content' / 'authoring' / 'lessons' / '4-2' / 'media' / 'processed'
JSON_PATH = DATA_DIR / '4-2-feedforward-panels-data.json'

matplotlib.rcParams['font.family'] = 'sans-serif'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'STHeiti', 'Arial Unicode MS', 'Arial Unicode', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'

COLORS = {
  'base': '#1f4e79',
  'ff': '#d94801',
  'grid': '#dddddd',
  'limit': '#888888',
  'reference': '#5f6b75',
  'note_bg': '#f7f4ef',
  'note_edge': '#d7c7b5',
}


def load_payload() -> dict:
  with JSON_PATH.open(encoding='utf-8') as handle:
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


def log_tick_formatter(value: float, _: object = None) -> str:
  if value <= 0:
    return ''
  exponent = np.log10(value)
  if not np.isclose(exponent, round(exponent)):
    return ''
  return rf'$10^{{{int(round(exponent))}}}$'


def linear_tick_formatter(value: float, _: object = None) -> str:
  if np.isclose(value, round(value)):
    return f'{int(round(value))}'
  return f'{value:.1f}'


def style_time_axis(ax: plt.Axes, ylabel: str) -> None:
  ax.grid(True, color=COLORS['grid'], linewidth=0.7)
  ax.set_facecolor('white')
  ax.set_xlabel('时间 / s')
  ax.set_ylabel(ylabel)
  ax.xaxis.set_major_formatter(ticker.FuncFormatter(linear_tick_formatter))
  ax.yaxis.set_major_formatter(ticker.FuncFormatter(linear_tick_formatter))


def style_root_axis(ax: plt.Axes) -> None:
  ax.axhline(0, color='#999999', linewidth=0.8)
  ax.axvline(0, color='#999999', linewidth=0.8, linestyle='--')
  ax.grid(True, color=COLORS['grid'], linewidth=0.7)
  ax.set_facecolor('white')
  ax.set_xlabel('Re(s)')
  ax.set_ylabel('Im(s)')
  ax.xaxis.set_major_formatter(ticker.FuncFormatter(linear_tick_formatter))
  ax.yaxis.set_major_formatter(ticker.FuncFormatter(linear_tick_formatter))


def style_bode_axes(ax_mag: plt.Axes, ax_phase: plt.Axes) -> None:
  for ax in (ax_mag, ax_phase):
    ax.set_xscale('log')
    ax.grid(True, which='both', color=COLORS['grid'], linewidth=0.7)
    ax.set_facecolor('white')
    ax.xaxis.set_major_locator(ticker.LogLocator(base=10.0))
    ax.xaxis.set_major_formatter(ticker.FuncFormatter(log_tick_formatter))
    ax.xaxis.set_minor_locator(ticker.LogLocator(base=10.0, subs=np.arange(2, 10) * 0.1))
    ax.xaxis.set_minor_formatter(ticker.NullFormatter())
  ax_mag.set_ylabel('幅值 / dB')
  ax_phase.set_ylabel('相位 / deg')
  ax_phase.set_xlabel(r'$\omega$ / rad/s')
  ax_mag.yaxis.set_major_formatter(ticker.FuncFormatter(linear_tick_formatter))
  ax_phase.yaxis.set_major_formatter(ticker.FuncFormatter(linear_tick_formatter))


def load_root_locus_branches(payload: dict) -> tuple[list[np.ndarray], np.ndarray, np.ndarray]:
  matched = match_root_locus_branches(load_samples_csv(DATA_DIR / '4-2-root-locus-raw-samples.csv'))
  write_matched_csv(DATA_DIR / '4-2-root-locus-points.csv', matched)

  poles = load_complex_points_csv(DATA_DIR / '4-2-open-loop-poles.csv')
  zeros = load_complex_points_csv(DATA_DIR / '4-2-open-loop-zeros.csv')

  branches = [
    np.array([(point.real, point.imag) for point in branch], dtype=float)
    for branch in matched.branches
  ]

  x_values = [branch[:, 0] for branch in branches]
  y_values = [branch[:, 1] for branch in branches]
  x_values.append(arr(payload['root_locus']['closed_loop_poles'], 'real'))
  y_values.append(arr(payload['root_locus']['closed_loop_poles'], 'imag'))
  x_values.append(arr(payload['root_locus']['open_loop_poles'], 'real'))
  y_values.append(arr(payload['root_locus']['open_loop_poles'], 'imag'))
  x = np.concatenate([values.reshape(-1) for values in x_values if values.size])
  y = np.concatenate([values.reshape(-1) for values in y_values if values.size])
  span_x = max(float(np.max(x) - np.min(x)), 0.8)
  span_y = max(float(np.max(y) - np.min(y)), 0.8)
  xlim = (float(np.min(x) - 0.18 * span_x), float(np.max(x) + 0.18 * span_x))
  ylim = (float(np.min(y) - 0.18 * span_y), float(np.max(y) + 0.18 * span_y))

  report = audit_root_locus(
    matched=matched,
    open_loop_poles=poles,
    open_loop_zeros=zeros,
    endpoint_tol=5e-3,
    views=[PlotView(name='4-2-shared-root-locus', xlim=xlim, ylim=ylim, role='subplot')],
  )
  (DATA_DIR / '4-2-root-locus-audit.json').write_text(
    json.dumps(report, ensure_ascii=False, indent=2),
    encoding='utf-8',
  )
  return branches, np.asarray(xlim, dtype=float), np.asarray(ylim, dtype=float)


def draw_root_locus(
  ax: plt.Axes,
  branches: list[np.ndarray],
  payload: dict,
  color: str,
  title: str,
  note: str,
  xlim: np.ndarray,
  ylim: np.ndarray,
) -> None:
  style_root_axis(ax)
  for branch in branches:
    ax.plot(branch[:, 0], branch[:, 1], color=color, linewidth=1.45)

  ax.scatter(
    arr(payload['root_locus']['open_loop_poles'], 'real'),
    arr(payload['root_locus']['open_loop_poles'], 'imag'),
    marker='x',
    s=62,
    linewidths=1.6,
    color='black',
    zorder=6,
  )
  closed_real = arr(payload['root_locus']['closed_loop_poles'], 'real')
  closed_imag = arr(payload['root_locus']['closed_loop_poles'], 'imag')
  ax.scatter(
    closed_real,
    closed_imag,
    marker='o',
    s=42,
    facecolors=color,
    edgecolors='white',
    linewidths=0.8,
    zorder=7,
  )
  ax.set_xlim(float(xlim[0]), float(xlim[1]))
  ax.set_ylim(float(ylim[0]), float(ylim[1]))
  ax.set_title(title, fontsize=11.2)
  ax.text(
    0.03,
    0.05,
    note,
    transform=ax.transAxes,
    fontsize=8.8,
    ha='left',
    va='bottom',
    bbox=dict(boxstyle='round,pad=0.28', facecolor='white', edgecolor='#d9d9d9'),
  )


def render_quad(
  case: dict,
  payload: dict,
  branches: list[np.ndarray],
  xlim: np.ndarray,
  ylim: np.ndarray,
  filename: str,
  time_ylabel: str,
  ref_key: str,
  ref_label: str,
  bode_no_label: str,
  bode_ff_label: str,
  root_note: str,
) -> None:
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, hspace=0.34, wspace=0.26)

  ax_time = fig.add_subplot(gs[0, 0])
  bode_gs = gs[0, 1].subgridspec(2, 1, hspace=0.12)
  ax_mag = fig.add_subplot(bode_gs[0, 0])
  ax_phase = fig.add_subplot(bode_gs[1, 0], sharex=ax_mag)
  ax_root_no = fig.add_subplot(gs[1, 0])
  ax_root_ff = fig.add_subplot(gs[1, 1])

  style_time_axis(ax_time, time_ylabel)
  ref = case[ref_key]
  ax_time.plot(arr(ref, 't'), arr(ref, 'y'), color=COLORS['reference'], linewidth=1.4, linestyle='--', label=ref_label)
  ax_time.plot(arr(case['no_ff']['time'], 't'), arr(case['no_ff']['time'], 'y'), color=COLORS['base'], linewidth=1.9, label=case['no_ff']['label'])
  ax_time.plot(arr(case['ff']['time'], 't'), arr(case['ff']['time'], 'y'), color=COLORS['ff'], linewidth=1.9, label=case['ff']['label'])
  ax_time.set_title('左上：时域对比', fontsize=11.2)
  ax_time.legend(frameon=False, fontsize=9, loc='best')

  style_bode_axes(ax_mag, ax_phase)
  w0 = arr(case['no_ff']['bode'], 'w')
  mag0 = arr(case['no_ff']['bode'], 'mag_db')
  phase0 = arr(case['no_ff']['bode'], 'phase_deg')
  w1 = arr(case['ff']['bode'], 'w')
  mag1 = arr(case['ff']['bode'], 'mag_db')
  phase1 = arr(case['ff']['bode'], 'phase_deg')
  ax_mag.semilogx(w0, mag0, color=COLORS['base'], linewidth=1.8, label=bode_no_label)
  ax_mag.semilogx(w1, mag1, color=COLORS['ff'], linewidth=1.8, label=bode_ff_label)
  ax_mag.axhline(0, color=COLORS['limit'], linewidth=0.9, linestyle='--')
  ax_mag.set_title('右上：Bode 对比', fontsize=11.2)
  ax_mag.legend(frameon=False, fontsize=8.8, loc='best')
  ax_phase.semilogx(w0, phase0, color=COLORS['base'], linewidth=1.8)
  ax_phase.semilogx(w1, phase1, color=COLORS['ff'], linewidth=1.8)
  ax_phase.axhline(-180, color=COLORS['limit'], linewidth=0.9, linestyle='--')

  draw_root_locus(
    ax_root_no,
    branches,
    payload,
    COLORS['base'],
    '左下：无前馈时的根轨迹',
    '主环路特征方程：$1+K P(s)=0$',
    xlim,
    ylim,
  )
  draw_root_locus(
    ax_root_ff,
    branches,
    payload,
    COLORS['ff'],
    '右下：有前馈时的根轨迹',
    root_note,
    xlim,
    ylim,
  )

  fig.suptitle(case['title'], fontsize=14, fontweight='bold')
  save(fig, filename)


def main() -> int:
  payload = load_payload()
  branches, xlim, ylim = load_root_locus_branches(payload)

  render_quad(
    case=payload['input_case'],
    payload=payload,
    branches=branches,
    xlim=xlim,
    ylim=ylim,
    filename='4-2-input-feedforward-quad.png',
    time_ylabel='输出 / 参考',
    ref_key='reference',
    ref_label='斜坡参考 $r(t)=t$',
    bode_no_label=r'无前馈：$T_r^{(0)}$',
    bode_ff_label=r'有前馈：$T_r^{(ff)}$',
    root_note='输入前馈只改参考通道零点，根轨迹与左图重合。',
  )
  render_quad(
    case=payload['dist_case'],
    payload=payload,
    branches=branches,
    xlim=xlim,
    ylim=ylim,
    filename='4-2-disturbance-feedforward-quad.png',
    time_ylabel='输出偏移',
    ref_key='disturbance',
    ref_label='单位扰动 $d(t)=1$',
    bode_no_label=r'无前馈：$T_{yd}^{(fb)}$',
    bode_ff_label=r'有前馈：$T_{yd}^{(ff)}$',
    root_note='扰动前馈只削弱扰动通道，主环路极点轨迹不变。',
  )
  return 0


if __name__ == '__main__':
  raise SystemExit(main())
