from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image

DATA_PATH = Path(__file__).resolve().parent / 'generated-data' / '3-8-design-data.json'
OUT_DIR = Path(__file__).resolve().parent.parent / 'processed'

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


def style_bode_axes(ax_mag: plt.Axes, ax_phase: plt.Axes) -> None:
  ax_mag.set_xscale('log')
  ax_phase.set_xscale('log')
  for ax in (ax_mag, ax_phase):
    ax.grid(True, which='both', color='#dddddd', linewidth=0.7)
    ax.set_facecolor('white')
  ax_mag.set_ylabel('幅值 / dB')
  ax_phase.set_ylabel('相位 / deg')
  ax_phase.set_xlabel(r'$\omega$ / rad/s')


def style_step_axis(ax: plt.Axes) -> None:
  ax.grid(True, color='#dddddd', linewidth=0.7)
  ax.set_facecolor('white')
  ax.set_xlabel('时间 / s')
  ax.set_ylabel('单位阶跃响应')


def style_nyquist_axis(ax: plt.Axes) -> None:
  ax.axhline(0, color='#999999', linewidth=0.8)
  ax.axvline(0, color='#999999', linewidth=0.8, linestyle='--')
  ax.grid(True, color='#dddddd', linewidth=0.7)
  ax.set_facecolor('white')
  ax.set_xlabel('实部')
  ax.set_ylabel('虚部')
  ax.set_aspect('equal', adjustable='box')


def summary_box(ax: plt.Axes, title: str, lines: list[str], facecolor: str = '#f7f4ef', edgecolor: str = '#d0c6b4') -> None:
  ax.axis('off')
  text = '\n'.join([title, ''] + lines)
  ax.text(
    0.02,
    0.98,
    text,
    va='top',
    ha='left',
    fontsize=10.1,
    linespacing=1.55,
    bbox=dict(boxstyle='round,pad=0.6', facecolor=facecolor, edgecolor=edgecolor),
  )


def plot_effect_figure(effect: dict, filename: str, suptitle: str, summary_title: str) -> None:
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, height_ratios=[1, 1], hspace=0.32, wspace=0.24)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  ax3 = fig.add_subplot(gs[1, 0])
  ax4 = fig.add_subplot(gs[1, 1])

  style_bode_axes(ax1, ax2)
  ax1.semilogx(arr(effect['bode_base'], 'w'), arr(effect['bode_base'], 'mag_db'), color=COLORS['base'], linewidth=1.8, label=effect['base_label'])
  ax1.semilogx(arr(effect['bode_new'], 'w'), arr(effect['bode_new'], 'mag_db'), color=COLORS['accent'], linewidth=1.8, label=effect['new_label'])
  ax1.axhline(0, color='#aaaaaa', linewidth=0.8, linestyle='--')
  if np.isfinite(effect['margin_base']['wc']):
    ax1.axvline(effect['margin_base']['wc'], color=COLORS['base'], linewidth=1.0, linestyle='--')
  if np.isfinite(effect['margin_new']['wc']):
    ax1.axvline(effect['margin_new']['wc'], color=COLORS['accent'], linewidth=1.0, linestyle='--')
  ax1.set_title('幅频：先看改写主要落在哪一段频带')
  ax1.legend(frameon=False, fontsize=9, loc='best')

  ax2.semilogx(arr(effect['bode_base'], 'w'), arr(effect['bode_base'], 'phase_deg'), color=COLORS['base'], linewidth=1.8)
  ax2.semilogx(arr(effect['bode_new'], 'w'), arr(effect['bode_new'], 'phase_deg'), color=COLORS['accent'], linewidth=1.8)
  ax2.axhline(-180, color='#aaaaaa', linewidth=0.8, linestyle='--')
  ax2.set_title('相频：再看中频相位余量是否被压缩')

  style_step_axis(ax3)
  ax3.plot(arr(effect['step_base'], 't'), arr(effect['step_base'], 'y'), color=COLORS['base'], linewidth=1.8, label=effect['base_label'])
  ax3.plot(arr(effect['step_new'], 't'), arr(effect['step_new'], 'y'), color=COLORS['accent'], linewidth=1.8, label=effect['new_label'])
  ax3.legend(frameon=False, fontsize=9, loc='best')
  ax3.set_title('闭环阶跃：最后把频域变化读回时域后果')

  lines = [
    f"观察重点：{effect['focus_text']}",
    f"主要收益：{effect['gain_text']}",
    f"主要代价：{effect['cost_text']}",
    f"基线 PM = {effect['margin_base']['pm']:.1f}°，新方案 PM = {effect['margin_new']['pm']:.1f}°",
    f"基线超调 = {effect['metrics_base']['overshoot']:.1f}% ，新方案超调 = {effect['metrics_new']['overshoot']:.1f}%",
  ]
  summary_box(ax4, summary_title, lines)
  fig.suptitle(suptitle, fontsize=14, fontweight='bold')
  save(fig, filename)


def render_effects(payload: dict) -> None:
  plot_effect_figure(payload['effects']['gain'], '3-8-gain-effect.png', '增益提升：整体上移，但中频余量会先变紧', '图像摘要')
  plot_effect_figure(payload['effects']['zero'], '3-8-zero-effect.png', '左半平面零点：重点改写中频，相位提前与高频代价同时出现', '图像摘要')
  plot_effect_figure(payload['effects']['pole'], '3-8-pole-effect.png', '积分极点：先增强低频精度，再压缩中频相位余量', '图像摘要')
  plot_effect_figure(payload['effects']['rhp_zero'], '3-8-rhp-zero-effect.png', '右半平面零点：只看幅值会误判，必须连同相位一起判断', '图像摘要')


def render_nyquist_quickcheck(payload: dict) -> None:
  fig = plt.figure(figsize=(11.8, 9.0), dpi=220)
  gs = fig.add_gridspec(2, 2, hspace=0.26, wspace=0.20)
  for idx, item in enumerate(payload['nyquist_quickcheck']['cases']):
    ax = fig.add_subplot(gs[idx // 2, idx % 2])
    style_nyquist_axis(ax)
    x = arr(item['curve'], 'real')
    y = arr(item['curve'], 'imag')
    ax.plot(x, y, color=COLORS['base'], linewidth=1.6)
    ax.plot(x, -y, color=COLORS['base'], linewidth=1.0, linestyle='--')
    ax.scatter([-1], [0], color='black', s=30, zorder=5)
    ax.set_xlim(-2.6, 1.2)
    ax.set_ylim(-2.2, 2.2)
    ax.set_title(f"{item['label']} | P={item['P']}  N={item['N']}  Z={item['Z']}", fontsize=11)
    ax.text(0.03, 0.97, item['title'], transform=ax.transAxes, ha='left', va='top', fontsize=9,
            bbox=dict(boxstyle='round,pad=0.2', facecolor='white', edgecolor='#d9d9d9'))
  fig.suptitle('Nyquist 快速判稳：先数 P，再数 N，最后由 Z=P-N 判断闭环稳定性', fontsize=14, fontweight='bold')
  save(fig, '3-8-nyquist-quickcheck.png')


def render_nyquist_compare(payload: dict) -> None:
  fig = plt.figure(figsize=(12.8, 6.8), dpi=220)
  gs = fig.add_gridspec(1, 2, width_ratios=[1.6, 1.0], wspace=0.18)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  style_nyquist_axis(ax1)

  for block, color, linestyle, label in [
    (payload['nyquist_compare']['small'], COLORS['base'], '-', payload['nyquist_compare']['small_label']),
    (payload['nyquist_compare']['large'], COLORS['accent'], '-', payload['nyquist_compare']['large_label']),
  ]:
    x = arr(block, 'real')
    y = arr(block, 'imag')
    ax1.plot(x, y, color=color, linewidth=1.8, linestyle=linestyle, label=label)
    ax1.plot(x, -y, color=color, linewidth=1.0, linestyle='--')
  ax1.scatter([-1], [0], color='black', s=35, zorder=6)
  ax1.text(-0.92, 0.12, '临界点 (-1,0)', fontsize=10)
  ax1.set_xlim(-3.1, 1.0)
  ax1.set_ylim(-2.3, 2.3)
  ax1.legend(frameon=False, fontsize=9, loc='lower right')
  ax1.set_title('同一对象、不同增益下的 Nyquist 曲线')

  summary_box(ax2, '判读摘要', payload['nyquist_compare']['summary'], facecolor='#eef6fb', edgecolor='#bfd7e7')
  fig.suptitle('Nyquist 增益对比：真正要看的是对临界点的包围关系，而不是曲线大小', fontsize=14, fontweight='bold')
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
    f"闭环超调 = {payload['bode']['metrics']['overshoot']:.1f}%"
  ]
  summary_box(ax4, '读图顺序', lines, facecolor='#eef8ee', edgecolor='#c4dec4')
  fig.suptitle('Bode 判稳：频率线与裕度线必须同时出现，才有完整判读信息', fontsize=14, fontweight='bold')
  save(fig, '3-8-bode-example.png')


def render_three_band(payload: dict) -> None:
  fig = plt.figure(figsize=(12.8, 5.8), dpi=220)
  gs = fig.add_gridspec(1, 2, width_ratios=[1.7, 1.0], wspace=0.18)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])

  w = np.asarray(payload['three_band']['w'], dtype=float)
  mag_db = np.asarray(payload['three_band']['mag_db'], dtype=float)
  b1, b2 = payload['three_band']['boundaries']
  ax1.set_xscale('log')
  ax1.axvspan(w.min(), b1, color='#eef6fb', alpha=0.9)
  ax1.axvspan(b1, b2, color='#f8f3ea', alpha=0.9)
  ax1.axvspan(b2, w.max(), color='#f7eef3', alpha=0.9)
  ax1.semilogx(w, mag_db, color=COLORS['base'], linewidth=1.9)
  ax1.grid(True, which='both', color='#dddddd', linewidth=0.7)
  ax1.set_facecolor('white')
  ax1.set_xlabel(r'$\omega$ / rad/s')
  ax1.set_ylabel('幅值 / dB')
  ax1.set_title('三频段分工：精度、速度与代价各落在不同频带')
  ylim = ax1.get_ylim()
  ax1.text(0.025, ylim[1] - 5, '低频：精度与抗扰', fontsize=10)
  ax1.text(0.24, ylim[1] - 5, '中频：截止频率与稳定裕度', fontsize=10)
  ax1.text(9.0, ylim[1] - 5, '高频：噪声与执行器代价', fontsize=10)

  lines = [
    '低频段先回答：稳态误差能不能压下去',
    '中频段再回答：速度与超调是否平衡',
    '高频段最后回答：为这些收益付出了多大代价',
  ]
  summary_box(ax2, '如何使用这张图', lines, facecolor='#fbf0ea', edgecolor='#e6c3b2')
  save(fig, '3-8-three-band-overview.png')


def render_heading_case(payload: dict) -> None:
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, hspace=0.32, wspace=0.24)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  ax3 = fig.add_subplot(gs[1, 0])
  ax4 = fig.add_subplot(gs[1, 1])

  style_bode_axes(ax1, ax2)
  ax1.semilogx(arr(payload['heading_case']['open_base'], 'w'), arr(payload['heading_case']['open_base'], 'mag_db'),
               color=COLORS['base'], linewidth=1.8, label='基线')
  ax1.semilogx(arr(payload['heading_case']['open_comp'], 'w'), arr(payload['heading_case']['open_comp'], 'mag_db'),
               color=COLORS['accent'], linewidth=1.8, label='超前校正后')
  ax1.set_title('开环幅频：超前校正把截止频率向右推')
  ax1.legend(frameon=False, fontsize=9, loc='best')

  ax2.semilogx(arr(payload['heading_case']['open_base'], 'w'), arr(payload['heading_case']['open_base'], 'phase_deg'),
               color=COLORS['base'], linewidth=1.8)
  ax2.semilogx(arr(payload['heading_case']['open_comp'], 'w'), arr(payload['heading_case']['open_comp'], 'phase_deg'),
               color=COLORS['accent'], linewidth=1.8)
  ax2.axhline(-180, color='#aaaaaa', linewidth=0.8, linestyle='--')
  ax2.set_title('开环相频：超前校正在中频补角')

  style_step_axis(ax3)
  ax3.plot(arr(payload['heading_case']['step_base'], 't'), arr(payload['heading_case']['step_base'], 'y'),
           color=COLORS['base'], linewidth=1.8, label='基线')
  ax3.plot(arr(payload['heading_case']['step_comp'], 't'), arr(payload['heading_case']['step_comp'], 'y'),
           color=COLORS['accent'], linewidth=1.8, label='超前校正后')
  ax3.legend(frameon=False, fontsize=9, loc='best')
  ax3.set_title('闭环阶跃：更快收敛，同时明显压低超调')

  lines = [
    f"基线 PM = {payload['heading_case']['margin_base']['pm']:.2f}°，校正后 PM = {payload['heading_case']['margin_comp']['pm']:.2f}°",
    f"基线 wc = {payload['heading_case']['margin_base']['wc']:.4f}，校正后 wc = {payload['heading_case']['margin_comp']['wc']:.4f}",
    f"基线超调 = {payload['heading_case']['metrics_base']['overshoot']:.2f}% ，校正后 = {payload['heading_case']['metrics_comp']['overshoot']:.2f}%",
    f"基线 ts = {payload['heading_case']['metrics_base']['settling_time']:.2f}s ，校正后 = {payload['heading_case']['metrics_comp']['settling_time']:.2f}s",
    f"基线 Mr = {payload['heading_case']['peak_base']['mr']:.3f}，校正后 Mr = {payload['heading_case']['peak_comp']['mr']:.3f}",
  ]
  summary_box(ax4, '航向控制设计结论', lines, facecolor='#eef6fb', edgecolor='#bfd7e7')
  fig.suptitle('航向控制案例：问题在中频余量偏小，超前校正把“更快”和“更稳”同时拉回可接受区间', fontsize=14, fontweight='bold')
  save(fig, '3-8-heading-case.png')


def render_platform_case(payload: dict) -> None:
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, hspace=0.32, wspace=0.24)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  ax3 = fig.add_subplot(gs[1, 0])
  ax4 = fig.add_subplot(gs[1, 1])

  style_bode_axes(ax1, ax2)
  ax1.semilogx(arr(payload['platform_case']['open_fast'], 'w'), arr(payload['platform_case']['open_fast'], 'mag_db'),
               color=COLORS['warning'], linewidth=1.8, label=payload['platform_case']['fast_label'])
  ax1.semilogx(arr(payload['platform_case']['open_slow'], 'w'), arr(payload['platform_case']['open_slow'], 'mag_db'),
               color=COLORS['soft'], linewidth=1.8, linestyle='--', label=payload['platform_case']['slow_label'])
  ax1.semilogx(arr(payload['platform_case']['open_comp'], 'w'), arr(payload['platform_case']['open_comp'], 'mag_db'),
               color=COLORS['lead'], linewidth=1.8, label=payload['platform_case']['comp_label'])
  ax1.set_title('开环幅频：仅降增益会把速度压得过低')
  ax1.legend(frameon=False, fontsize=8.5, loc='best')

  ax2.semilogx(arr(payload['platform_case']['open_fast'], 'w'), arr(payload['platform_case']['open_fast'], 'phase_deg'),
               color=COLORS['warning'], linewidth=1.8)
  ax2.semilogx(arr(payload['platform_case']['open_slow'], 'w'), arr(payload['platform_case']['open_slow'], 'phase_deg'),
               color=COLORS['soft'], linewidth=1.8, linestyle='--')
  ax2.semilogx(arr(payload['platform_case']['open_comp'], 'w'), arr(payload['platform_case']['open_comp'], 'phase_deg'),
               color=COLORS['lead'], linewidth=1.8)
  ax2.axhline(-180, color='#aaaaaa', linewidth=0.8, linestyle='--')
  ax2.set_title('开环相频：超前校正把中频相位余量拉高')

  style_step_axis(ax3)
  ax3.plot(arr(payload['platform_case']['step_fast'], 't'), arr(payload['platform_case']['step_fast'], 'y'),
           color=COLORS['warning'], linewidth=1.8, label=payload['platform_case']['fast_label'])
  ax3.plot(arr(payload['platform_case']['step_slow'], 't'), arr(payload['platform_case']['step_slow'], 'y'),
           color=COLORS['soft'], linewidth=1.8, linestyle='--', label=payload['platform_case']['slow_label'])
  ax3.plot(arr(payload['platform_case']['step_comp'], 't'), arr(payload['platform_case']['step_comp'], 'y'),
           color=COLORS['lead'], linewidth=1.8, label=payload['platform_case']['comp_label'])
  ax3.legend(frameon=False, fontsize=8.5, loc='best')
  ax3.set_title('闭环阶跃：校正方案兼顾速度与平稳')

  lines = [
    f"K=5: PM {payload['platform_case']['margin_fast']['pm']:.2f}°，Mp {payload['platform_case']['metrics_fast']['overshoot']:.2f}%，ts {payload['platform_case']['metrics_fast']['settling_time']:.3f}s",
    f"K=0.2: PM {payload['platform_case']['margin_slow']['pm']:.2f}°，Mp {payload['platform_case']['metrics_slow']['overshoot']:.2f}%，ts {payload['platform_case']['metrics_slow']['settling_time']:.3f}s",
    f"超前校正: PM {payload['platform_case']['margin_comp']['pm']:.2f}°，Mp {payload['platform_case']['metrics_comp']['overshoot']:.2f}%，ts {payload['platform_case']['metrics_comp']['settling_time']:.3f}s",
    f"仅降增益时 wc 降到 {payload['platform_case']['margin_slow']['wc']:.2f} rad/s，速度损失过大",
    f"超前校正把 Mr 压到 {payload['platform_case']['peak_comp']['mr']:.3f}，峰化最轻",
  ]
  summary_box(ax4, '稳定平台设计结论', lines, facecolor='#eef8ee', edgecolor='#c4dec4')
  fig.suptitle('稳定平台案例：单纯降增益不够，超前校正更能同时兼顾速度、余量与峰化', fontsize=14, fontweight='bold')
  save(fig, '3-8-platform-case.png')


def main() -> None:
  payload = load_payload()
  render_effects(payload)
  render_nyquist_quickcheck(payload)
  render_nyquist_compare(payload)
  render_bode(payload)
  render_three_band(payload)
  render_heading_case(payload)
  render_platform_case(payload)


if __name__ == '__main__':
  main()
