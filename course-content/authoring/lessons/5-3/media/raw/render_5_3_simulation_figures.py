from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path('/Users/YW/Documents/Site/act.just.edu.cn')
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyArrowPatch, Rectangle
from PIL import Image

RAW = ROOT / 'course-content/authoring/lessons/5-3/media/raw'
DATA = RAW / 'generated-data'
OUT = ROOT / 'course-content/authoring/lessons/5-3/media/processed'

plt.rcParams.update(
  {
    'font.sans-serif': ['Arial Unicode MS', 'PingFang SC', 'Hiragino Sans GB', 'Heiti SC', 'DejaVu Sans'],
    'axes.unicode_minus': False,
    'figure.dpi': 150,
    'savefig.dpi': 240,
    'axes.grid': True,
    'grid.alpha': 0.24,
    'axes.spines.top': False,
    'axes.spines.right': False,
    'legend.frameon': False,
  }
)

BLUE = '#1f5a8a'
ORANGE = '#d46a1f'
GREEN = '#2a7f62'
RED = '#b33b2e'
PURPLE = '#6f4aa0'
GRAY = '#68707a'
LIGHT = '#f7f9fb'


def load(name: str) -> np.ndarray:
  return np.genfromtxt(DATA / name, delimiter=',', names=True)


def flatten(path: Path) -> None:
  image = Image.open(path).convert('RGBA')
  bg = Image.new('RGBA', image.size, (255, 255, 255, 255))
  Image.alpha_composite(bg, image).convert('RGB').save(path)


def save(fig: plt.Figure, name: str) -> None:
  path = OUT / name
  fig.savefig(path, bbox_inches='tight', facecolor='white')
  plt.close(fig)
  flatten(path)


def compile_tikz_png(tex_name: str, png_name: str, output_dir: Path = OUT) -> Path:
  tex_path = RAW / tex_name
  pdf_path = RAW / f'{tex_path.stem}.pdf'
  output_dir.mkdir(parents=True, exist_ok=True)
  png_path = output_dir / png_name
  xelatex = shutil.which('xelatex')
  magick = shutil.which('magick') or shutil.which('convert')
  if xelatex is None or magick is None:
    raise RuntimeError('xelatex and ImageMagick are required for TikZ rendering')
  subprocess.run(
    [xelatex, '-interaction=nonstopmode', '-halt-on-error', f'-output-directory={RAW}', str(tex_path)],
    cwd=RAW,
    check=True,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
  )
  subprocess.run(
    [magick, '-density', '300', str(pdf_path), '-background', 'white', '-alpha', 'remove', '-flatten', str(png_path)],
    cwd=RAW,
    check=True,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
  )
  flatten(png_path)
  return png_path


def block(ax, xy, wh, label, color='#dfe8f3'):
  rect = Rectangle(xy, wh[0], wh[1], facecolor=color, edgecolor='#51606f', linewidth=1.0)
  ax.add_patch(rect)
  ax.text(xy[0] + wh[0] / 2, xy[1] + wh[1] / 2, label, ha='center', va='center', fontsize=10, weight='bold')


def arrow(ax, start, end):
  ax.add_patch(FancyArrowPatch(start, end, arrowstyle='-|>', mutation_scale=11, linewidth=1.0, color='#49525c'))


def mini_axis(fig, parent, x0, y0, w, h):
  px, py, pw, ph = parent.get_position().bounds
  return fig.add_axes([px + x0 * pw, py + y0 * ph, w * pw, h * ph])


def tiny_plot(ax, t, series, color, title, ylim=None):
  ax.plot(t, series, color=color, linewidth=1.05)
  ax.set_title(title, fontsize=8, pad=2)
  if ylim is not None:
    ax.set_ylim(*ylim)
  ax.set_xticks([])
  ax.set_yticks([])
  ax.grid(True, alpha=0.18)
  for spine in ax.spines.values():
    spine.set_visible(True)
    spine.set_linewidth(0.6)
    spine.set_color('#c8d0d8')


def render_sensor_noise_chain():
  background_path = compile_tikz_png(
    '5-3-sensor-noise-filter-chain.tex',
    '5-3-sensor-noise-filter-chain-background.png',
    DATA,
  )
  background = Image.open(background_path).convert('RGB')
  nof = load('sensor_no_filter.csv')
  flt = load('sensor_with_filter.csv')

  aspect = background.width / background.height
  fig = plt.figure(figsize=(15.5, 15.5 / aspect))
  bg_ax = fig.add_axes([0, 0, 1, 1])
  bg_ax.imshow(background)
  bg_ax.axis('off')

  plot_slots = {
    'r_top': (0.045, 0.810, 0.090, 0.045),
    'e_top': (0.285, 0.810, 0.090, 0.045),
    'c_top': (0.440, 0.810, 0.090, 0.045),
    'a_top': (0.610, 0.810, 0.090, 0.045),
    'y_top': (0.800, 0.810, 0.090, 0.045),
    'm_top': (0.617, 0.500, 0.103, 0.045),
    'r_bottom': (0.045, 0.360, 0.090, 0.045),
    'e_bottom': (0.285, 0.360, 0.090, 0.045),
    'c_bottom': (0.440, 0.360, 0.090, 0.045),
    'a_bottom': (0.610, 0.360, 0.090, 0.045),
    'y_bottom': (0.800, 0.360, 0.090, 0.045),
    'm_bottom': (0.617, 0.048, 0.103, 0.045),
  }

  def add_plot(slot, t, series, color, ylim):
    ax = fig.add_axes(plot_slots[slot])
    ax.plot(t, series, color=color, linewidth=1.05)
    ax.set_xlim(t.min(), t.max())
    ax.set_ylim(*ylim)
    ax.set_xticks([])
    ax.set_yticks([])
    ax.grid(True, alpha=0.14)
    for spine in ax.spines.values():
      spine.set_visible(False)

  rows = [
    ('top', nof, nof['ym']),
    ('bottom', flt, flt['yf']),
  ]
  for suffix, d, feedback in rows:
    t = d['t']
    add_plot(f'r_{suffix}', t, d['r'], BLUE, (0.05, 0.8))
    add_plot(f'e_{suffix}', t, d['e'], RED, (-0.28, 0.8))
    add_plot(f'c_{suffix}', t, d['u'], ORANGE, (-0.7, 1.5))
    add_plot(f'a_{suffix}', t, d['delta'], PURPLE, (-0.6, 1.25))
    add_plot(f'y_{suffix}', t, d['y'], GREEN, (0.0, 0.8))
    add_plot(f'm_{suffix}', t, feedback, GRAY, (0.0, 0.85))
  save(fig, '5-3-sensor-noise-filter-chain.png')


def render_sensor_delay_heading_track():
  ideal = load('delay_ideal.csv')
  delayed = load('delay_measured.csv')
  fig, axes = plt.subplots(1, 2, figsize=(14.4, 5.0), constrained_layout=True)
  ax = axes[0]
  ax.plot(ideal['t'], ideal['psi_ref'], color=BLUE, lw=2.0, label='给定避障参考航向')
  ax.plot(ideal['t'], ideal['psi'], color=GREEN, lw=2.0, label='无延迟校准后的航向')
  ax.plot(delayed['t'], delayed['psi'], color=RED, lw=2.0, label='同一控制器叠加测量延迟')
  ax.plot(delayed['t'], delayed['psi_meas'], color=ORANGE, lw=1.8, linestyle='--', label='传感器测量航向（延迟）')
  ax.set_title('航向信号：同一控制器在延迟系统中出现滞后')
  ax.set_xlabel('时间 / s')
  ax.set_ylabel('航向角 / deg')
  ax.legend(loc='lower right')
  ax = axes[1]
  ax.plot(ideal['x'], ideal['y'], color=GRAY, lw=2.0, linestyle='--', label='理想航迹（无测量延迟）')
  ax.plot(delayed['x'], delayed['y'], color=RED, lw=2.1, label='实际航迹（测量延迟）')
  ax.set_aspect('equal', adjustable='box')
  ax.set_title('航迹对比：延迟放大避障后的横向偏差')
  ax.set_xlabel('纵向位置 / m')
  ax.set_ylabel('横向位置 / m')
  ax.legend(loc='best')
  fig.suptitle('传感器测量延迟导致航向控制滞后与航迹偏移', fontsize=15, weight='bold')
  save(fig, '5-3-sensor-delay-heading-track.png')


def render_planning_comparison():
  rows = [
    ('只追求最短折线', load('planning_shortest.csv'), '#fff3ea'),
    ('频繁重规划的锯齿参考', load('planning_replan.csv'), '#f5f0ff'),
    ('吸收转弯半径后的平滑参考', load('planning_feasible.csv'), '#eef8f1'),
  ]
  fig, axes = plt.subplots(3, 4, figsize=(15.6, 9.2), constrained_layout=True)
  col_titles = ['规划航迹', '翻译得到的航向参考', '控制器输出', '实际舵角输出']
  for j, title in enumerate(col_titles):
    axes[0, j].set_title(title, fontsize=12, weight='bold')
  for i, (label, d, face) in enumerate(rows):
    for ax in axes[i]:
      ax.set_facecolor(face)
    axes[i, 0].plot(d['x'], d['y'], color=BLUE, lw=2.1)
    axes[i, 0].set_ylabel(label, fontsize=10)
    axes[i, 0].set_xlabel('x / m')
    axes[i, 0].set_ylim(-28, 32)
    axes[i, 1].plot(d['t'], d['psi_ref'], color=GREEN, lw=2.0)
    axes[i, 1].set_xlabel('时间 / s')
    axes[i, 1].set_ylabel('deg')
    axes[i, 2].plot(d['t'], d['u'], color=ORANGE, lw=1.7)
    axes[i, 2].axhline(30, color=RED, lw=0.9, linestyle='--')
    axes[i, 2].axhline(-30, color=RED, lw=0.9, linestyle='--')
    axes[i, 2].set_ylim(-55, 55)
    axes[i, 2].set_xlabel('时间 / s')
    axes[i, 2].set_ylabel('deg')
    axes[i, 3].plot(d['t'], d['delta'], color=PURPLE, lw=1.8)
    axes[i, 3].axhline(30, color=RED, lw=0.9, linestyle='--')
    axes[i, 3].axhline(-30, color=RED, lw=0.9, linestyle='--')
    axes[i, 3].set_ylim(-35, 35)
    axes[i, 3].set_xlabel('时间 / s')
    axes[i, 3].set_ylabel('deg')
  fig.suptitle('规划参考的形状如何传递为控制输出与执行器负担', fontsize=15, weight='bold')
  save(fig, '5-3-planning-path-control-comparison.png')


def render_actuator_limits():
  raw = load('actuator_raw.csv')
  sat = load('actuator_sat.csv')
  rate = load('actuator_rate.csv')
  fig, axes = plt.subplots(1, 3, figsize=(15.4, 4.8), constrained_layout=True)
  ax = axes[0]
  ax.plot(raw['t'], raw['u_raw'], color=BLUE, lw=1.8, label='原始控制量')
  ax.plot(sat['t'], sat['u_sat'], color=ORANGE, lw=1.8, label='饱和后')
  ax.plot(rate['t'], rate['u_rate'], color=GREEN, lw=1.8, label='再叠加变化率限幅')
  ax.axhline(16, color=RED, linestyle='--', lw=0.9)
  ax.axhline(-16, color=RED, linestyle='--', lw=0.9)
  ax.set_ylim(-35, 75)
  ax.text(
    0.02,
    0.92,
    '原始峰值超出显示范围',
    transform=ax.transAxes,
    color=GRAY,
    fontsize=9,
    va='top',
  )
  ax.set_title('控制量处理链')
  ax.set_xlabel('时间 / s')
  ax.set_ylabel('舵角 / deg')
  ax.legend()
  ax = axes[1]
  ax.plot(raw['t'], raw['psi'], color=BLUE, lw=1.8, label='原始控制')
  ax.plot(sat['t'], sat['psi'], color=ORANGE, lw=1.8, label='饱和')
  ax.plot(rate['t'], rate['psi'], color=GREEN, lw=1.8, label='饱和 + 速率限制')
  ax.plot(raw['t'], raw['ref'], color=GRAY, lw=1.2, linestyle='--', label='参考')
  ax.set_title('阶跃响应')
  ax.set_xlabel('时间 / s')
  ax.set_ylabel('航向 / deg')
  ax.legend()
  ax = axes[2]
  ax.plot(raw['x'], raw['y'], color=BLUE, lw=1.8, label='原始控制')
  ax.plot(sat['x'], sat['y'], color=ORANGE, lw=1.8, label='饱和')
  ax.plot(rate['x'], rate['y'], color=GREEN, lw=1.8, label='饱和 + 速率限制')
  ax.set_aspect('equal', adjustable='box')
  ax.set_title('航迹差异')
  ax.set_xlabel('x / m')
  ax.set_ylabel('y / m')
  ax.legend()
  fig.suptitle('执行约束改变闭环响应，而不只是裁剪一条控制曲线', fontsize=15, weight='bold')
  save(fig, '5-3-actuator-limits-response-track.png')


def render_turning_radius():
  curves = [
    ('R=35 m', load('turn_R35.csv'), RED),
    ('R=65 m', load('turn_R65.csv'), ORANGE),
    ('R=140 m', load('turn_R140.csv'), GREEN),
  ]
  fig, axes = plt.subplots(1, 2, figsize=(14.4, 5.0), constrained_layout=True)
  ax = axes[0]
  for label, d, color in curves:
    ax.plot(d['t'], d['delta'], color=color, lw=1.9, label=label)
    ax.plot(d['t'], np.minimum(d['delta_needed'], 18), color=color, alpha=0.20, lw=4.0)
  ax.axhline(18, color=GRAY, lw=1.0, linestyle='--', label='舵角饱和边界')
  ax.set_title('不同转弯半径下的舵角指令（含饱和）')
  ax.set_xlabel('时间 / s')
  ax.set_ylabel('舵角 / deg')
  ax.legend()
  ax = axes[1]
  obstacle = plt.Circle((88, 30), 20, color=RED, alpha=0.13, ec=RED, lw=1.5)
  ax.add_patch(obstacle)
  ax.text(88, 30, '名义障碍物', color=RED, ha='center', va='center', fontsize=10)
  for label, d, color in curves:
    ax.plot(d['x'], d['y'], color=color, lw=2.0, label=label)
  ax.set_aspect('equal', adjustable='box')
  ax.set_title('同一执行器驱动下的实际航迹')
  ax.set_xlabel('x / m')
  ax.set_ylabel('y / m')
  ax.legend()
  fig.suptitle('转弯半径越小，规划参考越容易触碰舵角边界', fontsize=15, weight='bold')
  save(fig, '5-3-turning-radius-saturation-comparison.png')


def main():
  OUT.mkdir(parents=True, exist_ok=True)
  render_sensor_noise_chain()
  render_sensor_delay_heading_track()
  render_planning_comparison()
  render_actuator_limits()
  render_turning_radius()


if __name__ == '__main__':
  main()
