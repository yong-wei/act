from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path('/Users/YW/Documents/Site/act.just.edu.cn')
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image

DATA_PATH = ROOT / 'course-content/authoring/lessons/3-5/media/raw/generated-data/3-5-plot-data.json'
OUT_DIR = ROOT / 'course-content/authoring/lessons/3-5/media/processed'

matplotlib.rcParams['font.family'] = 'sans-serif'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'STHeiti', 'Arial Unicode MS', 'Arial Unicode']
matplotlib.rcParams['axes.unicode_minus'] = False

COLORS = {
  'base': '#1f4e79',
  'zero_left': '#c0392b',
  'zero_between': '#117a65',
  'zero_near': '#8e44ad',
  'zero_mid': '#d35400',
  'pd': '#d94801',
  'rate': '#1f78b4',
  'lead': '#2a9d8f',
  'mp': '#2c7a3f',
  'nmp': '#b22222',
}


def flatten_to_white(path: Path) -> Image.Image:
  image = Image.open(path).convert('RGBA')
  background = Image.new('RGBA', image.size, (255, 255, 255, 255))
  return Image.alpha_composite(background, image).convert('RGB')


def save(fig: plt.Figure, filename: str) -> None:
  path = OUT_DIR / filename
  fig.savefig(path, dpi=220, facecolor='white', bbox_inches='tight')
  plt.close(fig)
  flatten_to_white(path).save(path)


def arr(block: dict, key: str) -> np.ndarray:
  return np.asarray(block[key], dtype=float)


def load_payload() -> dict:
  with DATA_PATH.open() as handle:
    return json.load(handle)


def style_root_axis(ax: plt.Axes, xlim: tuple[float, float], ylim: tuple[float, float]) -> None:
  ax.set_xlim(*xlim)
  ax.set_ylim(*ylim)
  ax.axhline(0, color='#999999', linewidth=0.8)
  ax.axvline(0, color='#999999', linewidth=0.8, linestyle='--')
  ax.grid(True, color='#dddddd', linewidth=0.7)
  ax.set_xlabel('Re(s)')
  ax.set_ylabel('Im(s)')
  ax.set_facecolor('white')


def plot_rlocus(ax: plt.Axes, locus: dict, color: str, label: str, poles: list[float], zeros: list[float] | None = None) -> None:
  x = arr(locus, 'real')
  y = arr(locus, 'imag')
  for row in range(x.shape[0]):
    ax.plot(x[row], y[row], color=color, linewidth=1.6)
  poles_arr = np.atleast_1d(np.asarray(poles, dtype=float))
  ax.scatter(poles_arr, np.zeros(poles_arr.size), marker='x', s=70, linewidths=1.8, color='black', zorder=5)
  if zeros is not None:
    zeros_arr = np.atleast_1d(np.asarray(zeros, dtype=float))
    if zeros_arr.size > 0:
      ax.scatter(zeros_arr, np.zeros(zeros_arr.size), marker='o', s=48, facecolors='white', edgecolors=color, linewidths=1.8, zorder=5)
  ax.set_title(label, fontsize=11)


def render_low_order(payload: dict) -> None:
  block = payload['low_order']
  fig, axes = plt.subplots(1, 3, figsize=(13.5, 4.2), dpi=220)
  style_root_axis(axes[0], (-3.2, 0.4), (-2.0, 2.0))
  style_root_axis(axes[1], (-3.2, 0.4), (-2.0, 2.0))
  style_root_axis(axes[2], (-3.2, 0.4), (-2.0, 2.0))

  plot_rlocus(axes[0], block['base'], COLORS['base'], '纯极点：$1/[s(s+1)]$', block['open_loop_poles'])
  plot_rlocus(axes[1], block['zero_left'], COLORS['zero_left'], '加零点 $z=-2$', block['open_loop_poles'], [-2])
  plot_rlocus(axes[2], block['zero_between'], COLORS['zero_between'], '加零点 $z=-0.5$', block['open_loop_poles'], [-0.5])

  fig.suptitle('低阶纯极点系统接入零点后根轨迹的变化', fontsize=14, fontweight='bold')
  save(fig, '3-5-rl-01-low-order-zero-compare.png')


def render_high_order(payload: dict) -> None:
  block = payload['high_order']
  fig, axes = plt.subplots(1, 3, figsize=(13.5, 4.2), dpi=220)
  for ax in axes:
    style_root_axis(ax, (-5.3, 0.6), (-4.5, 4.5))

  plot_rlocus(axes[0], block['base'], COLORS['base'], '纯极点：$1/[s(s+1)(s+4)]$', block['open_loop_poles'])
  plot_rlocus(axes[1], block['zero_near_origin'], COLORS['zero_near'], '加零点 $z=-0.4$', block['open_loop_poles'], [-0.4])
  plot_rlocus(axes[2], block['zero_middle'], COLORS['zero_mid'], '加零点 $z=-2.5$', block['open_loop_poles'], [-2.5])

  fig.suptitle('三阶纯极点系统在不同位置接入零点后的根轨迹重排', fontsize=14, fontweight='bold')
  save(fig, '3-5-rl-02-high-order-zero-compare.png')


def plot_step(ax: plt.Axes, curves: list[tuple[dict, str, str]]) -> None:
  for block, label, color in curves:
    ax.plot(arr(block, 't'), arr(block, 'y'), label=label, color=color, linewidth=1.8)
  ax.grid(True, color='#dddddd', linewidth=0.7)
  ax.set_xlabel('Time (s)')
  ax.set_ylabel('y(t)')
  ax.legend(frameon=False, fontsize=9)


def plot_bode_mag_phase(ax_mag: plt.Axes, ax_phase: plt.Axes, curves: list[tuple[dict, str, str]]) -> None:
  for block, label, color in curves:
    ax_mag.semilogx(arr(block, 'w'), arr(block, 'mag_db'), label=label, color=color, linewidth=1.7)
    ax_phase.semilogx(arr(block, 'w'), arr(block, 'phase_deg'), color=color, linewidth=1.7)
  for ax in (ax_mag, ax_phase):
    ax.grid(True, which='both', color='#dddddd', linewidth=0.7)
  ax_mag.set_ylabel('Magnitude (dB)')
  ax_phase.set_ylabel('Phase (deg)')
  ax_phase.set_xlabel('Frequency (rad/s)')
  ax_mag.legend(frameon=False, fontsize=8, loc='lower left')


def render_pd_rate(payload: dict) -> None:
  block = payload['pd_rate']
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, height_ratios=[1, 1.08], hspace=0.28, wspace=0.22)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  ax3 = fig.add_subplot(gs[1, 0])
  gs_bode = gs[1, 1].subgridspec(2, 1, hspace=0.15)
  ax4 = fig.add_subplot(gs_bode[0, 0])
  ax5 = fig.add_subplot(gs_bode[1, 0])

  style_root_axis(ax1, (-4.6, 0.8), (-4.2, 4.2))
  style_root_axis(ax2, (-4.6, 0.8), (-4.2, 4.2))
  plot_rlocus(
    ax1,
    block['root_locus_pd'],
    COLORS['pd'],
    'PD 校正后的根轨迹',
    block['open_loop_poles_pd'],
    block['open_loop_zeros_pd'],
  )
  plot_rlocus(
    ax2,
    block['root_locus_rate'],
    COLORS['rate'],
    '测速反馈校正后的根轨迹',
    block['open_loop_poles_rate'],
    block['open_loop_zeros_rate'],
  )

  plot_step(ax3, [
    (block['step_base'], '校正前 $\\zeta=0.2$', COLORS['base']),
    (block['step_pd'], 'PD 后 $\\zeta_{eq}=0.5$', COLORS['pd']),
    (block['step_rate'], '测速反馈后 $\\zeta_{eq}=0.5$', COLORS['rate']),
  ])
  ax3.set_title('同一对象的阶跃响应比较')

  plot_bode_mag_phase(ax4, ax5, [
    (block['bode_base'], '校正前', COLORS['base']),
    (block['bode_pd'], 'PD', COLORS['pd']),
    (block['bode_rate'], '测速反馈', COLORS['rate']),
  ])
  ax4.set_title('闭环频率特性比较')

  fig.suptitle('PD 与测速反馈：等效阻尼可相同，但根轨迹骨架不同', fontsize=14, fontweight='bold')
  save(fig, '3-5-rl-03-pd-rate-compare.png')


def render_pd_lead(payload: dict) -> None:
  block = payload['pd_lead']
  fig = plt.figure(figsize=(12.8, 9.2), dpi=220)
  gs = fig.add_gridspec(2, 2, hspace=0.32, wspace=0.25)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  ax3 = fig.add_subplot(gs[1, 0])
  gs_bode = gs[1, 1].subgridspec(2, 1, hspace=0.15)
  ax4 = fig.add_subplot(gs_bode[0, 0])
  ax5 = fig.add_subplot(gs_bode[1, 0])

  style_root_axis(ax1, (-18.5, 0.8), (-5.5, 5.5))
  style_root_axis(ax2, (-18.5, 0.8), (-5.5, 5.5))
  plot_rlocus(ax1, block['root_locus_pd'], COLORS['pd'], 'PD 对根轨迹的影响', [0, -0.8], [block['zero_pd']])
  plot_rlocus(ax2, block['root_locus_lead'], COLORS['lead'], '超前对根轨迹的影响', [0, -0.8, block['pole_lead']], [block['zero_lead']])

  plot_step(ax3, [
    (block['step_base'], '校正前', COLORS['base']),
    (block['step_pd'], 'PD', COLORS['pd']),
    (block['step_lead'], '超前', COLORS['lead']),
  ])
  ax3.set_title('闭环阶跃响应比较')

  plot_bode_mag_phase(ax4, ax5, [
    (block['openloop_bode_base'], '校正前', COLORS['base']),
    (block['openloop_bode_pd'], 'PD 后', COLORS['pd']),
    (block['openloop_bode_lead'], '超前后', COLORS['lead']),
  ])
  ax4.set_title('开环频率特性对比')

  fig.suptitle('PD 与超前：零点位置可以相同，但频域整形方式不同', fontsize=14, fontweight='bold')
  save(fig, '3-5-rl-04-pd-lead-compare.png')


def render_nmp(payload: dict) -> None:
  block = payload['nmp']
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, hspace=0.30, wspace=0.24)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  ax3 = fig.add_subplot(gs[1, 0])
  gs_bode = gs[1, 1].subgridspec(2, 1, hspace=0.15)
  ax4 = fig.add_subplot(gs_bode[0, 0])
  ax5 = fig.add_subplot(gs_bode[1, 0])

  style_root_axis(ax1, (-6.0, 1.5), (-5.0, 5.0))
  ax1.plot(arr(block['root_locus_mp'], 'real').T, arr(block['root_locus_mp'], 'imag').T, color=COLORS['mp'], linewidth=1.3, label='最小相')
  ax1.plot(arr(block['root_locus_nmp'], 'real').T, arr(block['root_locus_nmp'], 'imag').T, color=COLORS['nmp'], linewidth=1.3, label='非最小相')
  ax1.scatter([0, -2, -5], [0, 0, 0], marker='x', s=60, linewidths=1.7, color='black')
  ax1.scatter([-1, 1], [0, 0], marker='o', s=52, facecolors='white', edgecolors=[COLORS['mp'], COLORS['nmp']], linewidths=1.6)
  ax1.legend(frameon=False, fontsize=9)
  ax1.set_title('镜像零点导致的根轨迹差异')

  plot_step(ax2, [
    (block['step_mp'], '最小相 $z=-1$', COLORS['mp']),
    (block['step_nmp_mid'], '非最小相 $z=+1$', COLORS['nmp']),
  ])
  ax2.set_title('同一增益下的阶跃响应比较')

  plot_step(ax3, [
    (block['step_nmp_low'], f"非最小相保守控制 $K={block['k_low']}$", COLORS['base']),
    (block['step_nmp_mid'], f"非最小相中等控制 $K={block['k_mid']}$", COLORS['nmp']),
    (block['step_nmp_high'], f"非最小相激进控制 $K={block['k_high']}$", COLORS['pd']),
  ])
  ax3.set_title('非最小相对象的“保守带宽”实例')

  plot_bode_mag_phase(ax4, ax5, [
    (block['openloop_bode_mp'], '最小相开环', COLORS['mp']),
    (block['openloop_bode_nmp'], '非最小相开环', COLORS['nmp']),
  ])
  ax4.set_title('右半平面零点带来的额外相位滞后')

  fig.suptitle('右半平面零点首次引入：这就是非最小相系统', fontsize=14, fontweight='bold')
  save(fig, '3-5-rl-05-nmp-compare.png')


def main() -> None:
  OUT_DIR.mkdir(parents=True, exist_ok=True)
  payload = load_payload()
  render_low_order(payload)
  render_high_order(payload)
  render_pd_rate(payload)
  render_pd_lead(payload)
  render_nmp(payload)


if __name__ == '__main__':
  main()
