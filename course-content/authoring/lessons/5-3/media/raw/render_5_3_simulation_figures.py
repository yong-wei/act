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
from matplotlib.patches import Circle, FancyArrowPatch, Rectangle
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

  def detect_plot_slots(image):
    arr = np.asarray(image)
    height, width = arr.shape[:2]
    mask = (
      (arr[:, :, 0] > 170)
      & (arr[:, :, 0] < 230)
      & (arr[:, :, 1] > 180)
      & (arr[:, :, 1] < 235)
      & (arr[:, :, 2] > 190)
      & (arr[:, :, 2] < 245)
      & ((arr[:, :, 2].astype(int) - arr[:, :, 0].astype(int)) > 5)
    )
    seen = np.zeros(mask.shape, dtype=bool)
    boxes = []
    for row in range(height):
      for col in np.where(mask[row] & ~seen[row])[0]:
        if seen[row, col] or not mask[row, col]:
          continue
        stack = [(row, col)]
        seen[row, col] = True
        xs, ys = [], []
        while stack:
          y0, x0 = stack.pop()
          xs.append(x0)
          ys.append(y0)
          for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y0 + dy, x0 + dx
            if 0 <= yy < height and 0 <= xx < width and mask[yy, xx] and not seen[yy, xx]:
              seen[yy, xx] = True
              stack.append((yy, xx))
        x1, x2 = min(xs), max(xs)
        y1, y2 = min(ys), max(ys)
        if x2 - x1 > 80 and y2 - y1 > 35:
          boxes.append((x1, y1, x2, y2))
    boxes = sorted(boxes, key=lambda box: ((box[1] + box[3]) / 2, box[0]))
    if len(boxes) != 12:
      raise RuntimeError(f'Expected 12 plot boxes in sensor noise chain, found {len(boxes)}')
    groups = [boxes[:5], boxes[5:6], boxes[6:11], boxes[11:12]]
    keys = [
      ['r_top', 'e_top', 'c_top', 'a_top', 'y_top'],
      ['m_top'],
      ['r_bottom', 'e_bottom', 'c_bottom', 'a_bottom', 'y_bottom'],
      ['m_bottom'],
    ]
    slots = {}
    for group, key_group in zip(groups, keys):
      for key, (x1, y1, x2, y2) in zip(key_group, sorted(group, key=lambda box: box[0])):
        bw = (x2 - x1) / width
        bh = (y2 - y1) / height
        x = x1 / width + bw * 0.08
        y = 1 - y2 / height + bh * 0.12
        slots[key] = (x, y, bw * 0.84, bh * 0.70)
    return slots

  plot_slots = detect_plot_slots(background)

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
  label_box = dict(facecolor='white', edgecolor='none', alpha=0.90, pad=1.6)
  fig.text(
    0.070,
    0.892,
    '无传感器滤波：噪声直接进入误差与控制量',
    fontsize=13,
    weight='bold',
    ha='left',
    va='center',
    bbox=label_box,
  )
  fig.text(
    0.070,
    0.398,
    '加入一阶传感器滤波：反馈更平滑，执行器动作减轻',
    fontsize=13,
    weight='bold',
    ha='left',
    va='center',
    bbox=label_box,
  )
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
  ax.legend(loc='upper left', frameon=True, facecolor='white', framealpha=0.92, edgecolor='#d5dbe3')
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
    ('估计 R=35 m', load('turn_R35.csv'), RED),
    ('估计 R=65 m', load('turn_R65.csv'), ORANGE),
    ('估计 R=140 m', load('turn_R140.csv'), GREEN),
  ]
  fig, axes = plt.subplots(1, 2, figsize=(14.4, 5.0), constrained_layout=True)
  ax = axes[0]
  for label, d, color in curves:
    ax.plot(d['t'], d['delta_target'], color=color, lw=1.3, linestyle='--', alpha=0.70)
    ax.plot(d['t'], d['delta'], color=color, lw=2.0, label=label)
  ax.axhline(18, color=GRAY, lw=1.0, linestyle='--', label='舵角饱和边界')
  ax.axhline(-18, color=GRAY, lw=1.0, linestyle='--')
  ax.set_ylim(-2, 48)
  ax.set_title('进入避障启动圈后的舵角指令')
  ax.set_xlabel('时间 / s')
  ax.set_ylabel('舵角 / deg')
  ax.legend(loc='upper right')
  ax = axes[1]
  base = curves[0][1]
  obstacle_center = (float(base['obstacle_x'][0]), float(base['obstacle_y'][0]))
  obstacle_radius = float(base['obstacle_radius'][0])
  clearance = float(base['clearance'][0])
  obstacle = Circle(obstacle_center, obstacle_radius, color=RED, alpha=0.16, ec=RED, lw=1.5)
  ax.add_patch(obstacle)
  safety = Circle(obstacle_center, clearance, fill=False, ec=GRAY, lw=1.0, linestyle=':', alpha=0.70)
  ax.add_patch(safety)
  ax.text(
    obstacle_center[0],
    obstacle_center[1] - 18,
    '障碍物',
    color=RED,
    ha='center',
    va='center',
    fontsize=10,
    bbox=dict(facecolor='white', edgecolor='none', alpha=0.74, pad=1.2),
  )
  for label, d, color in curves:
    ax.plot(d['x'], d['y'], color=color, lw=2.0, label=label)
    start_circle = Circle(
      obstacle_center,
      float(d['start_radius'][0]),
      fill=False,
      ec=color,
      lw=1.4,
      linestyle=(0, (5, 4)),
      alpha=0.70,
    )
    ax.add_patch(start_circle)
    hit = np.where(d['collision'] > 0.5)[0]
    if len(hit) > 0:
      k = int(hit[0])
      ax.scatter(d['x'][k], d['y'][k], marker='x', color=color, s=70, linewidths=2.0, zorder=5)
      ax.text(
        d['x'][k] - 28,
        d['y'][k] + 11,
        '碰撞点',
        color=color,
        fontsize=9,
        bbox=dict(facecolor='white', edgecolor='none', alpha=0.78, pad=1.1),
      )
  ax.set_aspect('equal', adjustable='box')
  ax.set_title('沿航线接近障碍物并按启动圈开始避障')
  ax.set_xlabel('x / m')
  ax.set_ylabel('y / m')
  ax.set_xlim(0, 260)
  ax.set_ylim(-45, 165)
  ax.legend(loc='upper left')
  fig.suptitle('过小转弯半径会低估避障启动距离，饱和后可能撞上障碍物', fontsize=15, weight='bold')
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
