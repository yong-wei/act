from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from matplotlib import ticker
import numpy as np
from PIL import Image

DATA_PATH = ROOT / 'course-content/authoring/lessons/3-7/media/raw/generated-data/3-7-design-data.json'
OUT_DIR = ROOT / 'course-content/authoring/lessons/3-7/media/processed'

matplotlib.rcParams['font.family'] = 'sans-serif'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'STHeiti', 'Arial Unicode MS', 'Arial Unicode', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'

COLORS = {
  'base': '#1f4e79',
  'gain': '#7f8c8d',
  'pi': '#d94801',
  'lag': '#1f78b4',
  'lead': '#228b22',
  'pd': '#7a3e9d',
  'target': '#7a1f5c',
  'region': '#d9ecff',
  'limit': '#888888',
}


def flatten_to_white(path: Path) -> None:
  image = Image.open(path).convert('RGBA')
  background = Image.new('RGBA', image.size, (255, 255, 255, 255))
  Image.alpha_composite(background, image).convert('RGB').save(path)


def save(fig: plt.Figure, filename: str) -> None:
  path = OUT_DIR / filename
  fig.savefig(path, dpi=220, facecolor='white', bbox_inches='tight')
  plt.close(fig)
  flatten_to_white(path)


def arr(block: dict, key: str) -> np.ndarray:
  return np.asarray(block[key], dtype=float)


def load_payload() -> dict:
  with DATA_PATH.open(encoding='utf-8') as handle:
    return json.load(handle)


def style_root_axis(ax: plt.Axes) -> None:
  ax.set_xlim(-4.6, 0.6)
  ax.set_ylim(-3.4, 3.4)
  ax.axhline(0, color='#999999', linewidth=0.8)
  ax.axvline(0, color='#999999', linewidth=0.8, linestyle='--')
  ax.grid(True, color='#dddddd', linewidth=0.7)
  ax.set_xlabel('Re(s)')
  ax.set_ylabel('Im(s)')
  ax.set_facecolor('white')


def style_bode_axes(ax_mag: plt.Axes, ax_phase: plt.Axes) -> None:
  ax_mag.set_xscale('log')
  ax_phase.set_xscale('log')
  for ax in (ax_mag, ax_phase):
    style_log_xaxis(ax)
    ax.grid(True, which='both', color='#dddddd', linewidth=0.7)
    ax.set_facecolor('white')
  ax_mag.set_ylabel('Magnitude (dB)')
  ax_phase.set_ylabel('Phase (deg)')
  ax_phase.set_xlabel(r'$\omega$ (rad/s)')


def style_time_axis(ax: plt.Axes, xlabel: str, ylabel: str) -> None:
  ax.grid(True, color='#dddddd', linewidth=0.7)
  ax.set_facecolor('white')
  ax.set_xlabel(xlabel)
  ax.set_ylabel(ylabel)


def log_tick_formatter(value: float, _: object = None) -> str:
  if value <= 0:
    return ''
  exponent = np.log10(value)
  if not np.isclose(exponent, round(exponent)):
    return ''
  return f"10^{int(round(exponent))}"


def style_log_xaxis(ax: plt.Axes) -> None:
  ax.xaxis.set_major_locator(ticker.LogLocator(base=10.0))
  ax.xaxis.set_major_formatter(ticker.FuncFormatter(log_tick_formatter))
  ax.xaxis.set_minor_locator(ticker.LogLocator(base=10.0, subs=np.arange(2, 10) * 0.1))
  ax.xaxis.set_minor_formatter(ticker.NullFormatter())


def add_feasible_region(ax: plt.Axes, zeta_min: float, sigma_min: float) -> None:
  y = np.linspace(-3.4, 3.4, 400)
  x = -sigma_min * np.ones_like(y)
  ax.fill_betweenx(y, -4.6, x, color=COLORS['region'], alpha=0.35, zorder=0)
  ax.axvline(-sigma_min, color=COLORS['limit'], linestyle='--', linewidth=1.4)
  theta = np.arccos(zeta_min)
  xline = np.linspace(0.0, 4.6, 400)
  yline = np.tan(theta) * xline
  ax.plot(-xline, yline, color=COLORS['limit'], linestyle=':', linewidth=1.4)
  ax.plot(-xline, -yline, color=COLORS['limit'], linestyle=':', linewidth=1.4)
  ax.text(-1.05, 3.05, rf'$\mathrm{{Re}}(s)=-{sigma_min:.3f}$', fontsize=9, color='#555555')
  ax.text(-2.55, 2.35, rf'$\zeta={zeta_min:.3f}$', fontsize=9, color='#555555')


def plot_rlocus(ax: plt.Axes, locus: dict, poles: list[float], zeros: list[float], color: str, title: str) -> None:
  real = arr(locus, 'real')
  imag = arr(locus, 'imag')
  for row in range(real.shape[0]):
    ax.plot(real[row], imag[row], color=color, linewidth=1.5)
  poles_arr = np.asarray(poles, dtype=float)
  ax.scatter(poles_arr, np.zeros_like(poles_arr), marker='x', s=70, linewidths=1.8, color='black', zorder=5)
  zeros_arr = np.asarray(zeros, dtype=float)
  if zeros_arr.size:
    ax.scatter(zeros_arr, np.zeros_like(zeros_arr), marker='o', s=48, facecolors='white', edgecolors=color, linewidths=1.8, zorder=5)
  ax.set_title(title, fontsize=11)


def add_root_locus_legend(ax: plt.Axes, base_label: str, design_label: str, design_color: str, loc: str = 'lower left') -> None:
  handles = [
    Line2D([0], [0], color=COLORS['gain'], linewidth=1.8, label=base_label),
    Line2D([0], [0], color=design_color, linewidth=1.8, label=design_label),
    Line2D([0], [0], marker='x', color='black', linestyle='None', markersize=8, markeredgewidth=1.8, label='开环极点'),
    Line2D([0], [0], marker='o', markerfacecolor='white', markeredgecolor=design_color, linestyle='None', markersize=7, label='附加零点'),
  ]
  ax.legend(handles=handles, frameon=False, fontsize=9, loc=loc)


def summary_box(ax: plt.Axes, title: str, lines: list[str], facecolor: str, edgecolor: str) -> None:
  ax.axis('off')
  ax.text(
    0.02,
    0.98,
    '\n'.join([title, '', *lines]),
    va='top',
    ha='left',
    fontsize=10.2,
    linespacing=1.52,
    bbox=dict(boxstyle='round,pad=0.6', facecolor=facecolor, edgecolor=edgecolor),
  )


def render_low_frequency(payload: dict) -> None:
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, height_ratios=[1, 1], hspace=0.32, wspace=0.24)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  ax3 = fig.add_subplot(gs[1, 0])
  ax4 = fig.add_subplot(gs[1, 1])

  for ax in (ax1, ax2, ax3):
    ax.set_xscale('log')
    style_log_xaxis(ax)
    ax.grid(True, which='both', color='#dddddd', linewidth=0.7)
    ax.set_facecolor('white')
    ax.set_ylabel('Magnitude (dB)')
    ax.set_xlabel(r'$\omega$ (rad/s)')

  pi_mag = arr(payload['pi']['bode'], 'mag_db')
  ax1.plot(arr(payload['pi']['bode'], 'w'), pi_mag, color=COLORS['pi'], linewidth=1.8)
  ax1.axvline(payload['pi']['zero'], color=COLORS['limit'], linestyle='--', linewidth=1.2)
  ax1.set_title('PI：先下折，再被零点拉平', fontsize=11)
  ax1.set_ylim(pi_mag.min() - 3.0, pi_mag.max() + 3.0)
  ax1.text(0.18, 0.18, r'$\omega_z=0.5$', transform=ax1.transAxes, fontsize=9, color='#666666')

  ax2.plot(arr(payload['lag']['bode'], 'w'), arr(payload['lag']['bode'], 'mag_db'), color=COLORS['lag'], linewidth=1.8)
  ax2.axvline(payload['lag']['pole'], color=COLORS['limit'], linestyle='--', linewidth=1.2)
  ax2.axvline(payload['lag']['zero'], color=COLORS['limit'], linestyle='--', linewidth=1.2)
  ax2.set_title('滞后：先下折，再回到原斜率', fontsize=11)
  ax2.set_ylim(-25, 5)
  ax2.text(0.013, -3.3, r'$\omega_p=0.02$', fontsize=9, color='#666666')
  ax2.text(0.11, -17.0, r'$\omega_z=0.2$', fontsize=9, color='#666666')

  ax3.plot(arr(payload['lead']['bode'], 'w'), arr(payload['lead']['bode'], 'mag_db'), color=COLORS['lead'], linewidth=1.8)
  ax3.axvline(payload['lead']['zero'], color=COLORS['limit'], linestyle='--', linewidth=1.2)
  ax3.axvline(payload['lead']['pole'], color=COLORS['limit'], linestyle='--', linewidth=1.2)
  ax3.set_title('超前：先上折，再回到原斜率', fontsize=11)
  ax3.set_ylim(-15, 20)
  ax3.text(0.11, 3.0, r'$\omega_z=0.2$', fontsize=9, color='#666666')
  ax3.text(0.72, 11.0, r'$\omega_p=1$', fontsize=9, color='#666666')

  summary_box(
    ax4,
    '低频补偿摘要',
    [
      'PI 在低频引入积分环节，直接改变系统型别。',
      '滞后保持型别不变，但把低频增益抬高。',
      '超前主要服务于目标频带的相位补偿。',
      '三者本质差异体现在零点、极点对应转折频率的先后顺序。',
    ],
    facecolor='#f3f7fd',
    edgecolor='#c7d7eb',
  )

  fig.suptitle('任务 0：PI、滞后与超前的低频补偿图像统一按同一版式比较', fontsize=14, fontweight='bold')
  save(fig, '3-7-low-frequency-compensators.png')


def render_pi_time_design(payload: dict, specs: dict) -> None:
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, height_ratios=[1, 1], hspace=0.30, wspace=0.22)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  ax3 = fig.add_subplot(gs[1, 0])
  ax4 = fig.add_subplot(gs[1, 1])

  style_root_axis(ax1)
  add_feasible_region(ax1, specs['zeta_min'], specs['sigma_min'])
  plot_rlocus(ax1, payload['pure']['root_locus'], payload['pure']['open_loop_poles'], payload['pure']['open_loop_zeros'], COLORS['gain'], '根轨迹与设计可行域')
  plot_rlocus(ax1, payload['pi']['root_locus'], payload['pi']['open_loop_poles'], payload['pi']['open_loop_zeros'], COLORS['pi'], '根轨迹与设计可行域')
  add_root_locus_legend(ax1, '纯增益根轨迹', 'PI 校正后根轨迹', COLORS['pi'])
  ax1.text(-0.55, 0.22, r'$z=-0.3$', fontsize=9, color=COLORS['pi'])

  style_time_axis(ax2, 'Time (s)', 'y(t)')
  pure_step = payload['pure']['step_k1']
  pure_k10_step = payload['pure']['step_k10']
  pi_step = payload['pi']['metrics']['response']
  ax2.plot(arr(pure_step, 't'), arr(pure_step, 'y'), color=COLORS['base'], linewidth=1.8, label='纯增益 K=1')
  ax2.plot(arr(pure_k10_step, 't'), arr(pure_k10_step, 'y'), color=COLORS['gain'], linewidth=1.8, linestyle='--', label='纯增益 K=10')
  ax2.plot(arr(pi_step, 't'), arr(pi_step, 'y'), color=COLORS['pi'], linewidth=1.8, label='PI 设计')
  ax2.axhline(1.0, color=COLORS['limit'], linestyle=':', linewidth=1.0)
  ax2.set_title('阶跃响应：增益增大虽压低误差，但会牺牲阻尼', fontsize=11)
  ax2.legend(frameon=False, fontsize=9, loc='lower right')

  style_time_axis(ax3, 'Time (s)', 'e(t)')
  pure_err = payload['pure']['ramp_error_k1']
  pure_k10_err = payload['pure']['ramp_error_k10']
  pi_err = payload['pi']['ramp_error']
  ax3.plot(arr(pure_err, 't'), arr(pure_err, 'y'), color=COLORS['base'], linewidth=1.8, label='纯增益 K=1')
  ax3.plot(arr(pure_k10_err, 't'), arr(pure_k10_err, 'y'), color=COLORS['gain'], linewidth=1.8, linestyle='--', label='纯增益 K=10')
  ax3.plot(arr(pi_err, 't'), arr(pi_err, 'y'), color=COLORS['pi'], linewidth=1.8, label='PI 设计')
  ax3.axhline(0.0, color=COLORS['limit'], linestyle=':', linewidth=1.0)
  ax3.set_title('斜坡稳态误差：PI 通过改型把误差压到 0', fontsize=11)
  ax3.legend(frameon=False, fontsize=9, loc='upper right')

  summary_box(
    ax4,
    '任务 A 设计摘要',
    [
      r'指标：$e_{ss,\mathrm{ramp}}=0$，并保持可接受阻尼。',
      r'纯增益：$K$ 增大时误差常数提高，但闭环极点向低阻尼移动。',
      rf"纯增益 $K=10$：$M_p={payload['pure']['k10_metrics']['overshoot']:.1f}\%$。",
      rf"PI 设计：$M_p={payload['pi']['metrics']['overshoot']:.1f}\%$，$t_s={payload['pi']['metrics']['settling_time_2pct']:.1f}\,\mathrm{{s}}$。",
      r'积分环节把系统由 I 型提高到 II 型。',
    ],
    facecolor='#f7f4ef',
    edgecolor='#d0c6b4',
  )

  fig.suptitle('任务 A：纯增益只能压小斜坡误差，PI 通过改型完成结构性修正', fontsize=14, fontweight='bold')
  save(fig, '3-7-pi-time-domain-design.png')


def render_lag_time_design(payload: dict, specs: dict) -> None:
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, height_ratios=[1, 1], hspace=0.30, wspace=0.22)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  ax3 = fig.add_subplot(gs[1, 0])
  ax4 = fig.add_subplot(gs[1, 1])

  style_root_axis(ax1)
  add_feasible_region(ax1, specs['zeta_min'], specs['sigma_min'])
  plot_rlocus(ax1, payload['pure']['root_locus'], payload['pure']['open_loop_poles'], payload['pure']['open_loop_zeros'], COLORS['gain'], '根轨迹与同一设计可行域')
  plot_rlocus(ax1, payload['lag']['root_locus'], payload['lag']['open_loop_poles'], payload['lag']['open_loop_zeros'], COLORS['lag'], '根轨迹与同一设计可行域')
  add_root_locus_legend(ax1, '纯增益根轨迹', '滞后校正后根轨迹', COLORS['lag'])
  ax1.text(-0.36, 0.24, r'$z=-0.2$', fontsize=9, color=COLORS['lag'])
  ax1.text(-0.22, -0.38, r'$p=-0.02$', fontsize=9, color=COLORS['lag'])

  style_time_axis(ax2, 'Time (s)', 'y(t)')
  pure_step = payload['pure']['step_k1']
  pure_k10_step = payload['pure']['step_k10']
  lag_step = payload['lag']['metrics']['response']
  ax2.plot(arr(pure_step, 't'), arr(pure_step, 'y'), color=COLORS['base'], linewidth=1.8, label='纯增益 K=1')
  ax2.plot(arr(pure_k10_step, 't'), arr(pure_k10_step, 'y'), color=COLORS['gain'], linewidth=1.8, linestyle='--', label='纯增益 K=10')
  ax2.plot(arr(lag_step, 't'), arr(lag_step, 'y'), color=COLORS['lag'], linewidth=1.8, label='滞后设计')
  ax2.axhline(1.0, color=COLORS['limit'], linestyle=':', linewidth=1.0)
  ax2.set_title('阶跃响应：滞后在低频增益提升的同时维持可接受阻尼', fontsize=11)
  ax2.legend(frameon=False, fontsize=9, loc='lower right')

  style_time_axis(ax3, 'Time (s)', 'e(t)')
  pure_err = payload['pure']['ramp_error_k1']
  pure_k10_err = payload['pure']['ramp_error_k10']
  lag_err = payload['lag']['ramp_error']
  ax3.plot(arr(pure_err, 't'), arr(pure_err, 'y'), color=COLORS['base'], linewidth=1.8, label='纯增益 K=1')
  ax3.plot(arr(pure_k10_err, 't'), arr(pure_k10_err, 'y'), color=COLORS['gain'], linewidth=1.8, linestyle='--', label='纯增益 K=10')
  ax3.plot(arr(lag_err, 't'), arr(lag_err, 'y'), color=COLORS['lag'], linewidth=1.8, label='滞后设计')
  ax3.axhline(0.0, color=COLORS['limit'], linestyle=':', linewidth=1.0)
  ax3.set_title('斜坡稳态误差：滞后只能减小误差，不能把误差变成 0', fontsize=11)
  ax3.legend(frameon=False, fontsize=9, loc='upper right')

  summary_box(
    ax4,
    '任务 B 设计摘要',
    [
      r'目标：保持同一设计可行域，同时把低频误差常数继续抬高。',
      r'纯增益：$K=10$ 可继续减小误差，但阻尼明显下降。',
      r'滞后：零点在左、极点在右，重点是抬高低频增益而不改型。',
      rf"滞后设计：$M_p={payload['lag']['metrics']['overshoot']:.1f}\%$，$t_s={payload['lag']['metrics']['settling_time_2pct']:.1f}\,\mathrm{{s}}$。",
      r'因此滞后适合“误差要更小、但无需把误差彻底消除”的场景。',
    ],
    facecolor='#eef6fb',
    edgecolor='#bfd7e7',
  )

  fig.suptitle('任务 B：滞后校正用结构而非单纯增益去换取更高的低频精度', fontsize=14, fontweight='bold')
  save(fig, '3-7-lag-time-domain-design.png')


def render_pi_frequency_design(payload: dict) -> None:
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, height_ratios=[1, 1], hspace=0.32, wspace=0.24)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  ax3 = fig.add_subplot(gs[1, 0])
  ax4 = fig.add_subplot(gs[1, 1])

  style_bode_axes(ax1, ax2)
  gain4 = payload['gain4']['bode']
  gain10 = payload['gain10']['bode']
  pi = payload['pi']['bode']
  ax1.plot(arr(gain4, 'w'), arr(gain4, 'mag_db'), color=COLORS['gain'], linewidth=1.8, label='纯增益 K=4')
  ax1.plot(arr(gain10, 'w'), arr(gain10, 'mag_db'), color=COLORS['base'], linewidth=1.8, linestyle='--', label='纯增益 K=10')
  ax1.plot(arr(pi, 'w'), arr(pi, 'mag_db'), color=COLORS['pi'], linewidth=1.8, label='PI 设计')
  ax1.axhline(0, color=COLORS['limit'], linestyle=':', linewidth=1.0)
  ax1.axvline(2.5, color=COLORS['limit'], linestyle='--', linewidth=1.2)
  ax1.set_title('幅频：纯增益要兼顾 $K_v$ 与裕度时很快失衡', fontsize=11)
  ax1.legend(frameon=False, fontsize=9, loc='lower left')

  ax2.plot(arr(gain4, 'w'), arr(gain4, 'phase_deg'), color=COLORS['gain'], linewidth=1.8)
  ax2.plot(arr(gain10, 'w'), arr(gain10, 'phase_deg'), color=COLORS['base'], linewidth=1.8, linestyle='--')
  ax2.plot(arr(pi, 'w'), arr(pi, 'phase_deg'), color=COLORS['pi'], linewidth=1.8)
  ax2.axhline(-180, color=COLORS['limit'], linestyle=':', linewidth=1.0)
  ax2.axvline(2.5, color=COLORS['limit'], linestyle='--', linewidth=1.2)
  ax2.set_ylim(-220, -80)
  ax2.set_title('相频：先确定目标截止频率，再看需要保留的相位裕度', fontsize=11)
  ax2.text(2.5 * 1.05, -168, rf"$PM={payload['pi']['margins']['pm']:.1f}^\circ$", fontsize=9, color=COLORS['pi'])

  style_time_axis(ax3, 'Time (s)', 'y(t)')
  gain4_step = payload['gain4']['step']
  gain10_step = payload['gain10']['step']
  pi_step = payload['pi']['metrics']['response']
  ax3.plot(arr(gain4_step, 't'), arr(gain4_step, 'y'), color=COLORS['gain'], linewidth=1.8, label='纯增益 K=4')
  ax3.plot(arr(gain10_step, 't'), arr(gain10_step, 'y'), color=COLORS['base'], linewidth=1.8, linestyle='--', label='纯增益 K=10')
  ax3.plot(arr(pi_step, 't'), arr(pi_step, 'y'), color=COLORS['pi'], linewidth=1.8, label='PI 设计')
  ax3.axhline(1.0, color=COLORS['limit'], linestyle=':', linewidth=1.0)
  ax3.set_title('时域验收：频域设计仍需回到闭环响应核验', fontsize=11)
  ax3.legend(frameon=False, fontsize=9, loc='lower right')

  summary_box(
    ax4,
    '任务 C 设计摘要',
    [
      r'步骤 1：先给出目标截止频率 $\omega_c\approx 2.5\,\mathrm{rad/s}$。',
      r'步骤 2：把 PI 零点放在截止频率左侧，避免高频段额外失真。',
      r'步骤 3：用幅值条件求解比例系数，再由相位裕度验收。',
      rf"验算：$PM={payload['pi']['margins']['pm']:.1f}^\circ$，$\omega_c={payload['pi']['margins']['wcp']:.2f}\,\mathrm{{rad/s}}$。",
      rf"闭环：$M_p={payload['pi']['metrics']['overshoot']:.1f}\%$，$t_s={payload['pi']['metrics']['settling_time_2pct']:.1f}\,\mathrm{{s}}$。",
    ],
    facecolor='#eef8ee',
    edgecolor='#c4dec4',
  )

  fig.suptitle('任务 C：PI 频域设计必须把“速度、裕度、低频精度”一起纳入同一张图', fontsize=14, fontweight='bold')
  save(fig, '3-7-pi-frequency-design.png')


def render_pi_pd_comparison(payload: dict) -> None:
  fig = plt.figure(figsize=(12.8, 4.6), dpi=220)
  gs = fig.add_gridspec(1, 2, wspace=0.24)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])

  style_time_axis(ax1, 'Time (s)', 'y(t)')
  pi_step = payload['pi']['metrics']['response']
  pd_step = payload['pd']['metrics']['response']
  ax1.plot(arr(pi_step, 't'), arr(pi_step, 'y'), color=COLORS['pi'], linewidth=1.8, label='PI')
  ax1.plot(arr(pd_step, 't'), arr(pd_step, 'y'), color=COLORS['pd'], linewidth=1.8, label='PD')
  ax1.axhline(1.0, color=COLORS['limit'], linestyle=':', linewidth=1.0)
  ax1.set_title('阶跃响应：PD 更快，但 PI 更强调低频精度', fontsize=11)
  ax1.legend(frameon=False, fontsize=9, loc='lower right')

  style_time_axis(ax2, 'Time (s)', 'e(t)')
  pi_err = payload['pi']['ramp_error']
  pd_err = payload['pd']['ramp_error']
  ax2.plot(arr(pi_err, 't'), arr(pi_err, 'y'), color=COLORS['pi'], linewidth=1.8, label='PI')
  ax2.plot(arr(pd_err, 't'), arr(pd_err, 'y'), color=COLORS['pd'], linewidth=1.8, label='PD')
  ax2.axhline(0.0, color=COLORS['limit'], linestyle=':', linewidth=1.0)
  ax2.set_title('斜坡误差：PI 消除误差，PD 只保留有限误差', fontsize=11)
  ax2.legend(frameon=False, fontsize=9, loc='upper right')
  save(fig, '3-7-pi-pd-comparison.png')


def main() -> None:
  OUT_DIR.mkdir(parents=True, exist_ok=True)
  payload = load_payload()
  render_low_frequency(payload['lowfreq'])
  render_pi_time_design(payload['pi_time'], payload['specs'])
  render_lag_time_design(payload['lag_time'], payload['specs'])
  render_pi_frequency_design(payload['pi_freq'])
  render_pi_pd_comparison(payload['pi_pd'])
  print(f'已生成 {OUT_DIR / "3-7-low-frequency-compensators.png"}')
  print(f'已生成 {OUT_DIR / "3-7-pi-time-domain-design.png"}')
  print(f'已生成 {OUT_DIR / "3-7-lag-time-domain-design.png"}')
  print(f'已生成 {OUT_DIR / "3-7-pi-frequency-design.png"}')
  print(f'已生成 {OUT_DIR / "3-7-pi-pd-comparison.png"}')


if __name__ == '__main__':
  main()
