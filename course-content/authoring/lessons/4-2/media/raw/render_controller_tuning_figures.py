from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import ticker
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[6]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))
RAW_DIR = ROOT / 'course-content' / 'authoring' / 'lessons' / '4-2' / 'media' / 'raw'
DATA_DIR = RAW_DIR / 'generated-data'
OUT_DIR = ROOT / 'course-content' / 'authoring' / 'lessons' / '4-2' / 'media' / 'processed'
ROOT_LOCUS_MATCHER = ROOT / '.codex' / 'skills' / 'lesson' / 'scripts' / 'root_locus_branch_match.py'

matplotlib.rcParams['font.family'] = 'sans-serif'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'STHeiti', 'Arial Unicode MS', 'Arial Unicode', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'

COLORS = {
  'base': '#3b4a5a',
  'lag': '#2f855a',
  'pi': '#c05621',
  'lead': '#2b6cb0',
  'lead_lag': '#805ad5',
  'grid': '#d9dee5',
  'text': '#1f2933',
}

LABELS = {
  'base': '基准 P',
  'lag': '滞后',
  'pi': 'PI',
  'lead': '超前',
  'lead_lag': '超前-滞后',
}


def load_csv(name: str) -> np.ndarray:
  return np.genfromtxt(DATA_DIR / name, delimiter=',', names=True)


def as_rows(data: np.ndarray) -> np.ndarray:
  return np.atleast_1d(data)


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


def style_log_axis(ax: plt.Axes) -> None:
  ax.set_xscale('log')
  ax.grid(True, which='both', color=COLORS['grid'], linewidth=0.7)
  ax.set_facecolor('white')
  ax.xaxis.set_major_locator(ticker.LogLocator(base=10.0))
  ax.xaxis.set_major_formatter(ticker.FuncFormatter(lambda v, _: rf'$10^{{{int(np.log10(v))}}}$' if v > 0 and np.isclose(np.log10(v), round(np.log10(v))) else ''))
  ax.xaxis.set_minor_locator(ticker.LogLocator(base=10.0, subs=np.arange(2, 10) * 0.1))
  ax.xaxis.set_minor_formatter(ticker.NullFormatter())


def style_linear_axis(ax: plt.Axes) -> None:
  ax.grid(True, color=COLORS['grid'], linewidth=0.7)
  ax.set_facecolor('white')


def plot_controller_frequency() -> None:
  mag = load_csv('4-2-controller-frequency-magnitude.csv')
  phase = load_csv('4-2-controller-frequency-phase.csv')
  items = [
    ('PI', 'PI：低频抬升'),
    ('PD', 'PD：中频相位'),
    ('PID', 'PID：低频+中频'),
    ('lead', '超前：补相位'),
    ('lag', '滞后：补低频'),
    ('lead_lag', '超前-滞后：兼顾'),
  ]
  palette = {
    'PI': '#c05621',
    'PD': '#2b6cb0',
    'PID': '#7b341e',
    'lead': '#3182ce',
    'lag': '#2f855a',
    'lead_lag': '#805ad5',
  }
  fig, axes = plt.subplots(2, 3, figsize=(12.0, 7.0), sharex=True)
  for ax, (name, title) in zip(axes.ravel(), items):
    ax2 = ax.twinx()
    ax.plot(mag['w'], mag[name], color=palette[name], linewidth=1.8, label='幅值')
    ax2.plot(phase['w'], phase[name], color='#4a5568', linewidth=1.5, linestyle='--', label='相位')
    style_log_axis(ax)
    ax2.grid(False)
    ax.axhline(0, color='#9aa5b1', linestyle=':', linewidth=0.8)
    ax2.axhline(0, color='#9aa5b1', linestyle=':', linewidth=0.8)
    ax.set_title(title, fontsize=11.2)
    ax.set_ylabel('幅值 / dB')
    ax2.set_ylabel('相位 / deg')
    ax.tick_params(axis='both', labelsize=8.4)
    ax2.tick_params(axis='y', labelsize=8.4)
    ax.set_ylim(np.nanmin(mag[name]) - 4, np.nanmax(mag[name]) + 4)
    pmin = np.nanmin(phase[name])
    pmax = np.nanmax(phase[name])
    ax2.set_ylim(pmin - 8, pmax + 8)
  for ax in axes[-1, :]:
    ax.set_xlabel(r'频率 $\omega$ / rad/s')
  fig.suptitle('六类控制结构的 Bode 特性矩阵', fontsize=15, fontweight='bold')
  fig.tight_layout(rect=[0, 0, 1, 0.94])
  save(fig, '4-2-controller-frequency-characteristics.png')


def run_root_locus_match(prefix: str, side: str) -> None:
  base = DATA_DIR / f'{prefix}-{side}'
  cmd = [
    sys.executable,
    str(ROOT_LOCUS_MATCHER),
    '--samples',
    str(base.with_name(base.name + '-rl-samples.csv')),
    '--out-branches',
    str(base.with_name(base.name + '-rl-branches.csv')),
    '--out-report',
    str(base.with_name(base.name + '-rl-report.json')),
    '--poles',
    str(base.with_name(base.name + '-rl-poles.csv')),
    '--zeros',
    str(base.with_name(base.name + '-rl-zeros.csv')),
  ]
  subprocess.run(cmd, check=True)


def prepare_example_root_loci(prefix: str) -> None:
  run_root_locus_match(prefix, 'before')
  run_root_locus_match(prefix, 'after')


def load_points(path: Path) -> np.ndarray:
  if path.exists() and path.stat().st_size > len('re,im\n'):
    return as_rows(np.genfromtxt(path, delimiter=',', names=True))
  return np.array([], dtype=[('re', float), ('im', float)])


def plot_root_locus_panel(ax: plt.Axes, prefix: str, side: str, title: str) -> None:
  branches = as_rows(load_csv(f'{prefix}-{side}-rl-branches.csv'))
  poles = load_points(DATA_DIR / f'{prefix}-{side}-rl-poles.csv')
  zeros = load_points(DATA_DIR / f'{prefix}-{side}-rl-zeros.csv')
  branch_ids = np.unique(branches['branch'])
  xs: list[float] = []
  ys: list[float] = []
  for branch_id in branch_ids:
    part = branches[branches['branch'] == branch_id]
    ax.plot(part['re'], part['im'], color='#2b6cb0', linewidth=1.1, alpha=0.82)
    xs.extend(part['re'].tolist())
    ys.extend(part['im'].tolist())
  if len(poles):
    ax.scatter(poles['re'], poles['im'], marker='x', s=42, color='#c53030', linewidth=1.5, label='极点', zorder=4)
    xs.extend(poles['re'].tolist())
    ys.extend(poles['im'].tolist())
  if len(zeros):
    ax.scatter(zeros['re'], zeros['im'], marker='o', s=34, facecolor='white', edgecolor='#2f855a', linewidth=1.5, label='零点', zorder=4)
    xs.extend(zeros['re'].tolist())
    ys.extend(zeros['im'].tolist())
  ax.axhline(0, color='#9aa5b1', linewidth=0.8)
  ax.axvline(0, color='#9aa5b1', linewidth=0.8, linestyle='--')
  style_linear_axis(ax)
  ax.set_title(title, fontsize=11)
  ax.set_xlabel('实部')
  ax.set_ylabel('虚部')
  anchor_x: list[float] = []
  anchor_y: list[float] = []
  if len(poles):
    anchor_x.extend(poles['re'].tolist())
    anchor_y.extend(poles['im'].tolist())
  if len(zeros):
    anchor_x.extend(zeros['re'].tolist())
    anchor_y.extend(zeros['im'].tolist())
  if anchor_x:
    x_min = min(anchor_x)
    x_max = max(anchor_x)
    y_min = min(anchor_y) if anchor_y else 0.0
    y_max = max(anchor_y) if anchor_y else 0.0
    x_span = max(0.5, x_max - x_min)
    y_span = max(0.5, y_max - y_min)
    ax.set_xlim(x_min - 0.2 * x_span, x_max + 0.2 * x_span)
    ax.set_ylim(y_min - 0.2 * y_span, y_max + 0.2 * y_span)
  elif xs and ys:
    x_min, x_max = np.percentile(xs, [10, 90])
    y_abs = max(0.5, np.percentile(np.abs(ys), 90))
    pad_x = max(0.5, (x_max - x_min) * 0.2)
    ax.set_xlim(x_min - pad_x, x_max + pad_x)
    ax.set_ylim(-y_abs * 1.18, y_abs * 1.18)


def plot_example_quad(prefix: str, title: str, time_ylabel: str = '输出', with_root_locus: bool = True) -> None:
  if with_root_locus:
    prepare_example_root_loci(prefix)
  time = load_csv(f'{prefix}-time.csv')
  bode = load_csv(f'{prefix}-bode.csv')
  if with_root_locus:
    fig, axes = plt.subplots(2, 2, figsize=(11.4, 8.2))
    ax_time = axes[0, 0]
    ax_bode = axes[0, 1]
  else:
    fig, axes = plt.subplots(1, 2, figsize=(11.2, 4.3))
    ax_time = axes[0]
    ax_bode = axes[1]

  ax_time.plot(time['t'], time['before'], color=COLORS['base'], linewidth=1.8, label='校正前')
  ax_time.plot(time['t'], time['after'], color='#c05621', linewidth=1.8, label='校正后')
  style_linear_axis(ax_time)
  ax_time.set_title('时域响应')
  ax_time.set_xlabel('时间 / s')
  ax_time.set_ylabel(time_ylabel)
  ax_time.legend(frameon=False, fontsize=9)

  ax_phase = ax_bode.twinx()
  ax_bode.plot(bode['w'], bode['mag_before'], color=COLORS['base'], linewidth=1.7, label='校正前')
  ax_bode.plot(bode['w'], bode['mag_after'], color='#c05621', linewidth=1.7, label='校正后')
  ax_phase.plot(bode['w'], bode['phase_before'], color=COLORS['base'], linestyle='--', linewidth=1.2, alpha=0.75)
  ax_phase.plot(bode['w'], bode['phase_after'], color='#c05621', linestyle='--', linewidth=1.2, alpha=0.75)
  style_log_axis(ax_bode)
  ax_phase.grid(False)
  ax_bode.axhline(0, color='#9aa5b1', linestyle=':', linewidth=0.8)
  ax_bode.set_title('Bode 对比：实线幅值，虚线相位')
  ax_bode.set_xlabel(r'频率 $\omega$ / rad/s')
  ax_bode.set_ylabel('幅值 / dB')
  ax_phase.set_ylabel('相位 / deg')
  ax_bode.legend(frameon=False, fontsize=8.6, loc='best')

  if with_root_locus:
    plot_root_locus_panel(axes[1, 0], prefix, 'before', '校正前根轨迹')
    plot_root_locus_panel(axes[1, 1], prefix, 'after', '校正后根轨迹')

  fig.suptitle(title, fontsize=15, fontweight='bold')
  fig.tight_layout(rect=[0, 0, 1, 0.94])
  suffix = 'correction-quadrants' if with_root_locus else 'feedforward-comparison'
  save(fig, f'{prefix}-{suffix}.png')


def plot_zn_steps() -> None:
  data = load_csv('4-2-example-5-4-zn-steps.csv')
  items = [
    ('k2', '$K_p=2$：响应保守'),
    ('k5', '$K_p=5$：振荡加重'),
    ('k8', '$K_p=K_u=8$：等幅振荡'),
    ('pid', '按 Z-N 表得到 PID'),
  ]
  fig, axes = plt.subplots(2, 2, figsize=(10.8, 7.4), sharex=True)
  for ax, (field, title) in zip(axes.ravel(), items):
    ax.plot(data['t'], data[field], color='#2b6cb0' if field != 'pid' else '#c05621', linewidth=1.8)
    ax.axhline(1, color='#9aa5b1', linestyle='--', linewidth=0.8)
    style_linear_axis(ax)
    ax.set_title(title, fontsize=11.2)
    ax.set_xlabel('时间 / s')
    ax.set_ylabel('输出')
  fig.suptitle('Ziegler-Nichols 临界比例实验过程', fontsize=15, fontweight='bold')
  fig.tight_layout(rect=[0, 0, 1, 0.94])
  save(fig, '4-2-example-5-4-zn-steps.png')


def draw_box(ax: plt.Axes, xy: tuple[float, float], text: str, color: str, width: float = 0.23, height: float = 0.1) -> None:
  x, y = xy
  ax.add_patch(plt.Rectangle((x - width / 2, y - height / 2), width, height, facecolor=color, edgecolor='#425466', linewidth=1.2, zorder=2))
  ax.text(x, y, text, ha='center', va='center', fontsize=9.5, color=COLORS['text'], zorder=3)


def arrow(ax: plt.Axes, start: tuple[float, float], end: tuple[float, float]) -> None:
  ax.annotate('', xy=end, xytext=start, arrowprops=dict(arrowstyle='-|>', color='#425466', linewidth=1.1, shrinkA=8, shrinkB=8))


def plot_decision_tree() -> None:
  fig, ax = plt.subplots(figsize=(11.0, 7.2))
  ax.set_xlim(0, 1)
  ax.set_ylim(0, 1)
  ax.axis('off')
  draw_box(ax, (0.5, 0.92), '任务证据\n时域 + 频域 + 约束', '#edf2f7', 0.26, 0.09)
  draw_box(ax, (0.25, 0.74), '低频误差或\n慢扰动为主', '#e6fffa')
  draw_box(ax, (0.5, 0.74), '超调、振荡或\n相位裕度不足', '#ebf8ff')
  draw_box(ax, (0.75, 0.74), '给定或扰动\n通道已知', '#faf5ff')
  draw_box(ax, (0.13, 0.55), '要求消除静差\nPI', '#fff5f0', 0.17, 0.085)
  draw_box(ax, (0.34, 0.55), '动态基本可接受\n滞后', '#f0fff4', 0.18, 0.085)
  draw_box(ax, (0.52, 0.55), '目标是补相位\nPD / 超前', '#ebf8ff', 0.18, 0.085)
  draw_box(ax, (0.71, 0.55), '稳态与动态都紧\nPID / 超前-滞后', '#f7fafc', 0.2, 0.085)
  draw_box(ax, (0.9, 0.55), '参考/扰动可测\n前馈 + 反馈', '#faf5ff', 0.18, 0.085)
  draw_box(ax, (0.25, 0.34), '整定入口\n频域 PI / 滞后\nIMC / 极点配置', '#fffff0', 0.28, 0.12)
  draw_box(ax, (0.58, 0.34), '整定入口\n频域 PD / 超前\n二阶匹配 / Z-N', '#fffff0', 0.3, 0.12)
  draw_box(ax, (0.84, 0.34), '补偿入口\n逆模型 / 扰动抵消\n50%-80% 起步', '#fffff0', 0.26, 0.12)
  draw_box(ax, (0.5, 0.13), '复核边界\n截止频率、相角裕度、低频灵敏度、控制量、噪声、饱和', '#edf2f7', 0.62, 0.09)
  for x in (0.25, 0.5, 0.75):
    arrow(ax, (0.5, 0.875), (x, 0.79))
  for start, end in [((0.25, 0.69), (0.13, 0.595)), ((0.25, 0.69), (0.34, 0.595)), ((0.5, 0.69), (0.52, 0.595)), ((0.5, 0.69), (0.71, 0.595)), ((0.75, 0.69), (0.9, 0.595)), ((0.25, 0.505), (0.25, 0.405)), ((0.58, 0.505), (0.58, 0.405)), ((0.84, 0.505), (0.84, 0.405)), ((0.25, 0.28), (0.5, 0.18)), ((0.58, 0.28), (0.5, 0.18)), ((0.84, 0.28), (0.5, 0.18))]:
    arrow(ax, start, end)
  ax.set_title('控制器结构选型决策树', fontsize=16, fontweight='bold', y=0.98)
  save(fig, '4-2-controller-selection-decision-tree.png')


def plot_ship_bode() -> None:
  mag = load_csv('4-2-ship-controller-loop-mag.csv')
  phase = load_csv('4-2-ship-controller-loop-phase.csv')
  fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(9.2, 7.0), sharex=True)
  for key, color in COLORS.items():
    if key in LABELS:
      ax1.plot(mag['w'], mag[key], label=LABELS[key], color=color, linewidth=1.8)
      ax2.plot(phase['w'], phase[key], label=LABELS[key], color=color, linewidth=1.8)
  for ax in (ax1, ax2):
    style_log_axis(ax)
  ax1.axhline(0, color='#9aa5b1', linestyle='--', linewidth=0.9)
  ax2.axhline(-180, color='#9aa5b1', linestyle='--', linewidth=0.9)
  ax1.set_ylabel('开环幅值 / dB')
  ax2.set_ylabel('开环相位 / deg')
  ax2.set_xlabel(r'频率 $\omega$ / rad/s')
  ax1.legend(frameon=False, ncol=3, fontsize=9.0, loc='lower left')
  fig.suptitle('客船航向控制候选结构的开环 Bode 对比', fontsize=15, fontweight='bold')
  save(fig, '4-2-ship-controller-candidates-bode.png')


def plot_ship_time() -> None:
  step = load_csv('4-2-ship-controller-step.csv')
  dist = load_csv('4-2-ship-controller-disturbance.csv')
  fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11.2, 4.6))
  for key, color in COLORS.items():
    if key in LABELS:
      ax1.plot(step['t'], step[key], label=LABELS[key], color=color, linewidth=1.8)
      ax2.plot(dist['t'], dist[key], label=LABELS[key], color=color, linewidth=1.8)
  for ax in (ax1, ax2):
    style_linear_axis(ax)
    ax.set_xlabel('时间 / s')
  ax1.set_title('给定阶跃响应')
  ax1.set_ylabel('航向输出')
  ax2.set_title('输入端单位扰动响应')
  ax2.set_ylabel('扰动引起的输出偏移')
  ax1.legend(frameon=False, fontsize=8.8, loc='lower right')
  fig.suptitle('客船航向控制候选结构的时域证据', fontsize=15, fontweight='bold')
  save(fig, '4-2-ship-controller-candidates-step-disturbance.png')


def plot_summary() -> None:
  metrics = load_csv('4-2-ship-controller-metrics.csv')
  keys = ['base', 'lag', 'pi', 'lead', 'lead_lag']
  x = np.arange(len(keys))
  fig, axes = plt.subplots(2, 2, figsize=(10.5, 7.2))
  items = [
    ('pm', '相角裕度 / deg', '越高越稳健'),
    ('overshoot', '超调 / %', '越低越平顺'),
    ('disturbance_peak', '扰动峰值', '越低抗扰越好'),
    ('u_peak', '控制量峰值', '越低越省执行器'),
  ]
  for ax, (field, ylabel, subtitle) in zip(axes.ravel(), items):
    values = [float(metrics[field][i]) for i in range(len(keys))]
    ax.bar(x, values, color=[COLORS[k] for k in keys], width=0.68)
    ax.set_xticks(x)
    ax.set_xticklabels([LABELS[k] for k in keys], rotation=18, ha='right')
    ax.set_ylabel(ylabel)
    ax.set_title(subtitle, fontsize=11)
    style_linear_axis(ax)
    for i, value in enumerate(values):
      if np.isfinite(value):
        ax.text(i, value, f'{value:.2g}', ha='center', va='bottom', fontsize=8.4)
  fig.suptitle('客船候选结构的整定效果比较', fontsize=15, fontweight='bold')
  fig.tight_layout(rect=[0, 0, 1, 0.94])
  save(fig, '4-2-ship-controller-candidates-summary.png')


def main() -> None:
  plot_controller_frequency()
  plot_decision_tree()
  plot_example_quad('4-2-example-5-1', '例题 5.1 频域 PI 校正前后对比')
  plot_example_quad('4-2-example-5-2', '例题 5.2 超前校正前后对比')
  plot_example_quad('4-2-example-5-3', '例题 5.3 滞后校正前后对比')
  plot_example_quad('4-2-example-5-4', '例题 5.4 Ziegler-Nichols PID 校正前后对比')
  plot_example_quad('4-2-example-5-5', '例题 5.5 扰动前馈补偿前后对比', time_ylabel='扰动引起的输出', with_root_locus=False)
  plot_zn_steps()
  plot_ship_bode()
  plot_ship_time()
  plot_summary()


if __name__ == '__main__':
  main()
