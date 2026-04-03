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

DATA_PATH = ROOT / 'course-content/authoring/lessons/3-6/media/raw/generated-data/3-6-design-data.json'
OUT_DIR = ROOT / 'course-content/authoring/lessons/3-6/media/processed'

matplotlib.rcParams['font.family'] = 'sans-serif'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'STHeiti', 'Arial Unicode MS', 'Arial Unicode', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'

COLORS = {
  'base': '#1f4e79',
  'gain': '#7f8c8d',
  'pd': '#d94801',
  'rate': '#1f78b4',
  'lead': '#228b22',
  'nmp': '#8b1e3f',
  'region': '#d9ecff',
  'target': '#7a1f5c',
  'limit': '#888888',
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


def num_list(values: object) -> np.ndarray:
  return np.atleast_1d(np.asarray(values, dtype=float))


def load_payload() -> dict:
  with DATA_PATH.open() as handle:
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
    ax.grid(True, which='both', color='#dddddd', linewidth=0.7)
    ax.set_facecolor('white')
  ax_mag.set_ylabel('Magnitude (dB)')
  ax_phase.set_ylabel('Phase (deg)')
  ax_phase.set_xlabel(r'$\omega$ (rad/s)')


def add_design_pole_note(ax: plt.Axes) -> None:
  ax.text(
    0.03,
    0.05,
    '★ 设计极点',
    transform=ax.transAxes,
    fontsize=9.0,
    color=COLORS['target'],
    ha='left',
    va='bottom',
    bbox=dict(boxstyle='round,pad=0.2', facecolor='white', edgecolor='#cccccc'),
  )


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
  ax.text(-1.02, 3.05, r'$\mathrm{Re}(s)=-1$', fontsize=9, color='#555555')
  ax.text(-2.55, 2.35, rf'$\zeta={zeta_min:.3f}$', fontsize=9, color='#555555')


def plot_rlocus(ax: plt.Axes, locus: dict, poles: object, zeros: object, color: str, title: str) -> None:
  x = arr(locus, 'real')
  y = arr(locus, 'imag')
  for row in range(x.shape[0]):
    ax.plot(x[row], y[row], color=color, linewidth=1.5)
  poles_arr = num_list(poles)
  ax.scatter(poles_arr, np.zeros(poles_arr.size), marker='x', s=70, linewidths=1.8, color='black', zorder=5)
  zeros_arr = num_list(zeros) if len(num_list(zeros)) and np.isfinite(num_list(zeros)).all() else np.array([])
  if zeros_arr.size and not (zeros_arr.size == 1 and zeros_arr[0] == 0 and isinstance(zeros, list) and not zeros):
    ax.scatter(zeros_arr, np.zeros(zeros_arr.size), marker='o', s=48, facecolors='white', edgecolors=color, linewidths=1.8, zorder=5)
  ax.set_title(title, fontsize=11)


def add_pd_angle_annotations(ax: plt.Axes, target_real: float, target_imag: float, zero_real: float) -> None:
  ax.plot([0, target_real], [0, target_imag], linestyle='--', color='#666666', linewidth=1.0)
  ax.plot([-0.8, target_real], [0, target_imag], linestyle='--', color='#666666', linewidth=1.0)
  ax.plot([zero_real, target_real], [0, target_imag], linestyle='--', color=COLORS['pd'], linewidth=1.0)
  ax.text(target_real * 0.46, target_imag * 0.56, r'$\theta_1$', fontsize=10, color='#444444')
  ax.text(-0.8 + (target_real + 0.8) * 0.42, target_imag * 0.68, r'$\theta_2$', fontsize=10, color='#444444')
  ax.text(zero_real + (target_real - zero_real) * 0.56, target_imag * 0.30, r'$\theta_z$', fontsize=10, color=COLORS['pd'])


def plot_step(ax: plt.Axes, curves: list[tuple[np.ndarray, np.ndarray, str, str]]) -> None:
  for t, y, label, color in curves:
    ax.plot(t, y, label=label, color=color, linewidth=1.8)
  ax.grid(True, color='#dddddd', linewidth=0.7)
  ax.set_xlabel('Time (s)')
  ax.set_ylabel('y(t)')
  ax.legend(frameon=False, fontsize=9, loc='best')


def plot_bode_curve(ax_mag: plt.Axes, ax_phase: plt.Axes, bode: dict, label: str, color: str, linestyle: str = '-') -> None:
  w = arr(bode, 'w')
  ax_mag.semilogx(w, arr(bode, 'mag_db'), label=label, color=color, linewidth=1.8, linestyle=linestyle)
  ax_phase.semilogx(w, arr(bode, 'phase_deg'), label=label, color=color, linewidth=1.8, linestyle=linestyle)


def interp_series(bode: dict, key: str, omega: float) -> float:
  w = arr(bode, 'w')
  values = arr(bode, key)
  return float(np.interp(np.log10(omega), np.log10(w), values))


def mark_target_frequency(ax_mag: plt.Axes, ax_phase: plt.Axes, omega: float, label: str = None) -> None:
  for ax in (ax_mag, ax_phase):
    ax.axvline(omega, color=COLORS['limit'], linestyle='--', linewidth=1.2)
  if label:
    ax_phase.text(omega * 1.04, ax_phase.get_ylim()[0] + 8, label, fontsize=9, color='#555555')


def render_pd(payload: dict) -> None:
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, height_ratios=[1, 1], hspace=0.30, wspace=0.22)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  ax3 = fig.add_subplot(gs[1, 0])
  ax4 = fig.add_subplot(gs[1, 1])

  for ax in (ax1, ax2):
    style_root_axis(ax)
    add_feasible_region(ax, payload['specs']['zeta_min'], payload['specs']['sigma_min'])

  plot_rlocus(
    ax1,
    payload['base']['root_locus'],
    payload['base']['open_loop_poles'],
    payload['base']['open_loop_zeros'],
    COLORS['base'],
    '纯增益根轨迹：全部复根都卡在 $\\mathrm{Re}(s)=-0.4$',
  )
  plot_rlocus(
    ax2,
    payload['pd']['root_locus'],
    payload['pd']['open_loop_poles'],
    payload['pd']['open_loop_zeros'],
    COLORS['pd'],
    '加入 $z=-2.857$ 后：根轨迹穿过设计可行域',
  )

  target_real = payload['pd']['target_pole']['real']
  target_imag = payload['pd']['target_pole']['imag']
  zero_real = float(num_list(payload['pd']['open_loop_zeros'])[0])
  for ax in (ax1, ax2):
    ax.scatter([target_real], [target_imag], marker='*', s=150, color=COLORS['target'], zorder=6)
    ax.scatter([target_real], [-target_imag], marker='*', s=150, color=COLORS['target'], zorder=6)
    add_design_pole_note(ax)
  add_pd_angle_annotations(ax2, target_real, target_imag, zero_real)

  plot_step(
    ax3,
    [
      (
        arr(payload['base']['limit_metrics']['response'], 't'),
        arr(payload['base']['limit_metrics']['response'], 'y'),
        rf"纯增益极限点 $K={payload['base']['limit_metrics']['k']:.3f}$",
        COLORS['base'],
      ),
      (
        arr(payload['pd']['metrics']['response'], 't'),
        arr(payload['pd']['metrics']['response'], 'y'),
        rf"PD 设计点 $K={payload['pd']['K']:.2f},\,T_d={payload['pd']['Td']:.2f}$",
        COLORS['pd'],
      ),
    ],
  )
  ax3.set_title('同样满足低超调诉求时，PD 显著缩短调节时间')

  ax4.axis('off')
  summary = '\n'.join([
    '任务 A 设计摘要',
    '',
    r'指标：$M_p\leq 20\%$, $t_s(2\%)\leq 4\,\mathrm{s}$',
    r'可行域：$\zeta\geq 0.456$, $\mathrm{Re}(s)\leq -1$',
    r'纯增益：$s^2+0.8s+4K=0 \Rightarrow \mathrm{Re}(s)=-0.4$',
    '',
    r'取目标点：$s_d=-1.1\pm j1.67$',
    r'相角条件：$\theta_z=\theta_1+\theta_2-180^\circ$',
    r'零点：$z_c=2.857 \Rightarrow T_d=0.35$',
    r'模值条件：$K=1.00$',
    '',
    rf"Octave 验证：$M_p={payload['pd']['metrics']['overshoot']:.2f}\%$",
    rf"$t_s={payload['pd']['metrics']['settling_time_2pct']:.2f}\,\mathrm{{s}}$",
  ])
  ax4.text(
    0.02,
    0.98,
    summary,
    va='top',
    ha='left',
    fontsize=10.4,
    linespacing=1.55,
    bbox=dict(boxstyle='round,pad=0.6', facecolor='#f7f4ef', edgecolor='#d0c6b4'),
  )
  fig.suptitle('任务 A：必须先用 PD 改写根轨迹，纯增益无法进入设计可行域', fontsize=14, fontweight='bold')
  save(fig, '3-6-pd-design.png')


def render_rate(payload: dict) -> None:
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, height_ratios=[1, 1], hspace=0.30, wspace=0.22)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  ax3 = fig.add_subplot(gs[1, 0])
  ax4 = fig.add_subplot(gs[1, 1])

  for ax in (ax1, ax2):
    style_root_axis(ax)
    add_feasible_region(ax, payload['specs']['zeta_min'], payload['specs']['sigma_min'])

  plot_rlocus(
    ax1,
    payload['base']['root_locus'],
    payload['base']['open_loop_poles'],
    payload['base']['open_loop_zeros'],
    COLORS['base'],
    '原比例根轨迹：由 $0$ 与 $-0.8$ 两极点决定',
  )
  plot_rlocus(
    ax2,
    payload['rate']['root_locus'],
    payload['rate']['open_loop_poles'],
    payload['rate']['open_loop_zeros'],
    COLORS['rate'],
    '广义根轨迹等效后：极点移到 $-2.2$',
  )

  target_real = payload['rate']['target_pole']['real']
  target_imag = payload['rate']['target_pole']['imag']
  for ax in (ax1, ax2):
    ax.scatter([target_real], [target_imag], marker='*', s=150, color=COLORS['target'], zorder=6)
    ax.scatter([target_real], [-target_imag], marker='*', s=150, color=COLORS['target'], zorder=6)
    add_design_pole_note(ax)

  plot_step(
    ax3,
    [
      (
        arr(payload['base']['limit_metrics']['response'], 't'),
        arr(payload['base']['limit_metrics']['response'], 'y'),
        rf"纯增益极限点 $K={payload['base']['limit_metrics']['k']:.3f}$",
        COLORS['base'],
      ),
      (
        arr(payload['rate']['metrics']['response'], 't'),
        arr(payload['rate']['metrics']['response'], 'y'),
        rf"测速反馈 $K_t={payload['rate']['Kt']:.2f},\,K={payload['rate']['K']:.2f}$",
        COLORS['rate'],
      ),
    ],
  )
  ax3.set_title('等效极点左移后，比例增益即可把闭环极点送入可行域')

  ax4.axis('off')
  summary = '\n'.join([
    '任务 B 设计摘要',
    '',
    r'$T_v(s)=\dfrac{4K}{s^2+(0.8+4K_t)s+4K}$',
    r'$\Rightarrow 1+\dfrac{4K}{s(s+0.8+4K_t)}=0$',
    '',
    r'取等效极点：$p_e=2.2$',
    r'$0.8+4K_t=2.2 \Rightarrow K_t=0.35$',
    r'目标点仍取：$s_d=-1.1\pm j1.67$',
    r'模值条件：$K=\dfrac{|s_d(s_d+2.2)|}{4}=1.00$',
    '',
    rf"Octave 验证：$M_p={payload['rate']['metrics']['overshoot']:.2f}\%$",
    rf"$t_s={payload['rate']['metrics']['settling_time_2pct']:.2f}\,\mathrm{{s}}$",
  ])
  ax4.text(
    0.02,
    0.98,
    summary,
    va='top',
    ha='left',
    fontsize=10.4,
    linespacing=1.55,
    bbox=dict(boxstyle='round,pad=0.6', facecolor='#eef6fb', edgecolor='#bfd7e7'),
  )
  fig.suptitle('任务 B：测速反馈先改等效极点位置，再用 K 选定设计点', fontsize=14, fontweight='bold')
  save(fig, '3-6-rate-feedback-design.png')


def render_lead(payload: dict) -> None:
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, height_ratios=[1, 1], hspace=0.32, wspace=0.24)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  ax3 = fig.add_subplot(gs[1, 0])
  ax4 = fig.add_subplot(gs[1, 1])

  style_bode_axes(ax1, ax2)
  plot_bode_curve(ax1, ax2, payload['freq_base']['bode'], '仅调增益使 $\\omega_c\\approx 3$', COLORS['gain'])
  plot_bode_curve(ax1, ax2, payload['lead']['bode'], '超前补偿后', COLORS['lead'])
  ax1.set_title('幅频：超前在目标频带抬升幅值')
  ax2.set_title('相频：超前在目标频带补角')
  ax2.set_ylim(-220, -80)
  mark_target_frequency(ax1, ax2, payload['freq_specs']['wc_target'], r'$\omega_c^\ast=3$')

  phase_gain = interp_series(payload['freq_base']['bode'], 'phase_deg', payload['freq_specs']['wc_target'])
  phase_lead = interp_series(payload['lead']['bode'], 'phase_deg', payload['freq_specs']['wc_target'])
  ax2.scatter([payload['freq_specs']['wc_target']], [phase_gain], color=COLORS['gain'], s=40, zorder=5)
  ax2.scatter([payload['freq_specs']['wc_target']], [phase_lead], color=COLORS['lead'], s=40, zorder=5)
  ax2.text(payload['freq_specs']['wc_target'] * 1.06, phase_gain + 4, r'$PM\approx 14.9^\circ$', fontsize=9, color=COLORS['gain'])
  ax2.text(payload['freq_specs']['wc_target'] * 1.06, phase_lead + 4, r'$PM\approx 58^\circ$', fontsize=9, color=COLORS['lead'])
  ax1.legend(frameon=False, fontsize=9, loc='lower left')

  plot_step(
    ax3,
    [
      (
        arr(payload['freq_base']['metrics']['response'], 't'),
        arr(payload['freq_base']['metrics']['response'], 'y'),
        rf"仅调增益 $K={payload['freq_base']['K']:.3f}$",
        COLORS['gain'],
      ),
      (
        arr(payload['lead']['metrics']['response'], 't'),
        arr(payload['lead']['metrics']['response'], 'y'),
        rf"超前 $K_c={payload['lead']['Kc']:.3f},\,a={payload['lead']['a']:.3f},\,T={payload['lead']['T']:.3f}$",
        COLORS['lead'],
      ),
    ],
  )
  ax3.set_title('仅推高交叉频率会丢失裕度；超前能同步补角')

  ax4.axis('off')
  summary = '\n'.join([
    '任务 C：超前校正详细步骤',
    '',
    rf"目标：PM >= {payload['freq_specs']['pm_target']:.0f} deg, wc ≈ {payload['freq_specs']['wc_target']:.0f} rad/s",
    rf"若只调增益：Kg = {payload['freq_base']['K']:.3f}, PM = {payload['freq_base']['margins']['pm']:.2f} deg",
    '',
    r'所需最大超前角：',
    rf"psi_m = {payload['lead']['target_pm']:.0f} - {payload['freq_base']['pm_at_target']:.2f} + {payload['lead']['extra_phase']:.0f} = {payload['lead']['phi_required']:.2f} deg",
    rf"a = (1 + sin psi_m) / (1 - sin psi_m) = {payload['lead']['a']:.3f}",
    rf"T = 1 / (wc*sqrt(a)) = {payload['lead']['T']:.4f} s",
    rf"Kc = 1 / (|G(jwc)|*sqrt(a)) = {payload['lead']['Kc']:.4f}",
    '',
    rf"验算：PM = {payload['lead']['margins']['pm']:.2f} deg, wc = {payload['lead']['margins']['wcp']:.2f}",
    rf"Mp = {payload['lead']['metrics']['overshoot']:.2f}%, ts = {payload['lead']['metrics']['settling_time_2pct']:.2f} s",
  ])
  ax4.text(
    0.02,
    0.98,
    summary,
    va='top',
    ha='left',
    fontsize=10.2,
    linespacing=1.52,
    bbox=dict(boxstyle='round,pad=0.6', facecolor='#eef8ee', edgecolor='#c4dec4'),
  )
  fig.suptitle('任务 C：频域目标驱动的超前校正，把“补角 + 交叉频率”直接变成参数', fontsize=14, fontweight='bold')
  save(fig, '3-6-lead-design.png')


def render_pd_frequency(payload: dict) -> None:
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, height_ratios=[1, 1], hspace=0.32, wspace=0.24)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  ax3 = fig.add_subplot(gs[1, 0])
  ax4 = fig.add_subplot(gs[1, 1])

  style_bode_axes(ax1, ax2)
  plot_bode_curve(ax1, ax2, payload['freq_base']['bode'], '仅调增益使 $\\omega_c\\approx 3$', COLORS['gain'])
  plot_bode_curve(ax1, ax2, payload['pd_freq']['bode'], '频域视角下的 PD', COLORS['pd'])
  ax1.set_title('幅频：PD 同样把交叉频率推到目标位置')
  ax2.set_title('相频：PD 用零点提供所需相角')
  ax2.set_ylim(-220, -80)
  mark_target_frequency(ax1, ax2, payload['freq_specs']['wc_target'], r'$\omega_c^\ast=3$')

  phase_gain = interp_series(payload['freq_base']['bode'], 'phase_deg', payload['freq_specs']['wc_target'])
  phase_pd = interp_series(payload['pd_freq']['bode'], 'phase_deg', payload['freq_specs']['wc_target'])
  ax2.scatter([payload['freq_specs']['wc_target']], [phase_gain], color=COLORS['gain'], s=40, zorder=5)
  ax2.scatter([payload['freq_specs']['wc_target']], [phase_pd], color=COLORS['pd'], s=40, zorder=5)
  ax2.text(payload['freq_specs']['wc_target'] * 1.06, phase_gain + 4, r'$PM\approx 14.9^\circ$', fontsize=9, color=COLORS['gain'])
  ax2.text(payload['freq_specs']['wc_target'] * 1.06, phase_pd + 4, r'$PM\approx 50^\circ$', fontsize=9, color=COLORS['pd'])
  ax1.legend(frameon=False, fontsize=9, loc='lower left')

  plot_step(
    ax3,
    [
      (
        arr(payload['freq_base']['metrics']['response'], 't'),
        arr(payload['freq_base']['metrics']['response'], 'y'),
        rf"仅调增益 $K={payload['freq_base']['K']:.3f}$",
        COLORS['gain'],
      ),
      (
        arr(payload['pd_freq']['metrics']['response'], 't'),
        arr(payload['pd_freq']['metrics']['response'], 'y'),
        rf"PD $K={payload['pd_freq']['K']:.3f},\,T_d={payload['pd_freq']['Td']:.3f}$",
        COLORS['pd'],
      ),
    ],
  )
  ax3.set_title('同样频域指标下，PD 达标但高频放大与超调更明显')

  ax4.axis('off')
  summary = '\n'.join([
    '任务 D：频域视角下的 PD 设计',
    '',
    rf"目标：PM >= {payload['freq_specs']['pm_target']:.0f} deg, wc ≈ {payload['freq_specs']['wc_target']:.0f} rad/s",
    rf"若只调增益：PM = {payload['freq_base']['margins']['pm']:.2f} deg，仍然严重不足",
    '',
    r'在 $\omega_c^\ast$ 处使用相角条件：',
    rf"phi_d = {payload['pd_freq']['target_pm']:.0f} - {payload['freq_base']['pm_at_target']:.2f} = {payload['pd_freq']['phi_required']:.2f} deg",
    rf"Td = tan(phi_d) / wc = {payload['pd_freq']['Td']:.4f} s",
    rf"zc = 1 / Td = {payload['pd_freq']['zero_location']:.3f}",
    rf"K = 1 / (|G(jwc)|*|1 + jwcTd|) = {payload['pd_freq']['K']:.4f}",
    '',
    rf"验算：PM = {payload['pd_freq']['margins']['pm']:.2f} deg, wc = {payload['pd_freq']['margins']['wcp']:.2f}",
    rf"Mp = {payload['pd_freq']['metrics']['overshoot']:.2f}%, ts = {payload['pd_freq']['metrics']['settling_time_2pct']:.2f} s",
  ])
  ax4.text(
    0.02,
    0.98,
    summary,
    va='top',
    ha='left',
    fontsize=10.2,
    linespacing=1.52,
    bbox=dict(boxstyle='round,pad=0.6', facecolor='#fbf0ea', edgecolor='#e6c3b2'),
  )
  fig.suptitle('任务 D：在同一频域指标下，用 PD 直接补相位并把交叉频率推到目标位置', fontsize=14, fontweight='bold')
  save(fig, '3-6-pd-frequency-design.png')


def render_nmp(payload: dict) -> None:
  fig = plt.figure(figsize=(12.8, 8.8), dpi=220)
  gs = fig.add_gridspec(2, 2, height_ratios=[1, 1], hspace=0.30, wspace=0.24)
  ax1 = fig.add_subplot(gs[0, 0])
  ax2 = fig.add_subplot(gs[0, 1])
  ax3 = fig.add_subplot(gs[1, 0])
  ax4 = fig.add_subplot(gs[1, 1])

  ax1.set_xscale('log')
  ax1.grid(True, which='both', color='#dddddd', linewidth=0.7)
  ax1.set_facecolor('white')
  ax1.semilogx(arr(payload['nmp']['reference_bode'], 'w'), arr(payload['nmp']['reference_bode'], 'phase_deg'), color=COLORS['base'], linewidth=1.8, label='原纯极点对象')
  ax1.semilogx(arr(payload['nmp']['plant_bode'], 'w'), arr(payload['nmp']['plant_bode'], 'phase_deg'), color=COLORS['nmp'], linewidth=1.8, label='含 RHP 零点对象')
  ax1.axvline(payload['nmp']['recommended_wc_ceiling'], color=COLORS['lead'], linestyle='--', linewidth=1.2)
  ax1.axvline(payload['nmp']['aggressive_wc'], color=COLORS['pd'], linestyle='--', linewidth=1.2)
  ax1.axvline(payload['nmp']['zero_location'], color=COLORS['nmp'], linestyle=':', linewidth=1.2)
  ax1.text(payload['nmp']['recommended_wc_ceiling'] * 1.05, -105, r'推荐带宽上限', fontsize=9, color=COLORS['lead'])
  ax1.text(payload['nmp']['aggressive_wc'] * 1.05, -140, r'原目标 $\omega_c=3$', fontsize=9, color=COLORS['pd'])
  ax1.text(payload['nmp']['zero_location'] * 1.03, -220, r'$\omega_z=3.33$', fontsize=9, color=COLORS['nmp'])
  ax1.set_ylim(-260, -80)
  ax1.set_xlabel(r'$\omega$ (rad/s)')
  ax1.set_ylabel('Phase (deg)')
  ax1.set_title('RHP 零点会显著压缩可接受的交叉频率上限')
  ax1.legend(frameon=False, fontsize=9, loc='lower left')

  plot_step(
    ax2,
    [
      (
        arr(payload['nmp']['pd_example']['metrics']['response'], 't'),
        arr(payload['nmp']['pd_example']['metrics']['response'], 'y'),
        'PD 保守设计',
        COLORS['pd'],
      ),
      (
        arr(payload['nmp']['lead_example']['metrics']['response'], 't'),
        arr(payload['nmp']['lead_example']['metrics']['response'], 'y'),
        '超前保守设计',
        COLORS['lead'],
      ),
      (
        arr(payload['nmp']['rate_example']['metrics']['response'], 't'),
        arr(payload['nmp']['rate_example']['metrics']['response'], 'y'),
        '测速反馈保守设计',
        COLORS['rate'],
      ),
    ],
  )
  ax2.set_ylim(-0.08, 1.25)
  ax2.set_title('三种保守设计都保留了逆响应，但副作用程度不同')

  ax3.axis('off')
  summary_left = '\n'.join([
    '任务 E：非最小相下的结构选择',
    '',
    r'若强行沿用原频域目标 wc = 3：',
    rf"K = {payload['nmp']['aggressive_gain']:.3f} 时，PM = {payload['nmp']['aggressive_margins']['pm']:.2f} deg",
    r'说明原来的提速目标已经失效。',
    '',
    '选择原则：',
    '1. 只需温和补角，且目标带宽远低于 RHP 零点频率，可选 PD；',
    '2. 主要想压低超调和逆响应，不想继续抬升带宽，优先测速反馈；',
    '3. 既要补角又要适度提升带宽，且仍能把带宽控制在约 wz/3 以下，优先超前。',
  ])
  ax3.text(
    0.02,
    0.98,
    summary_left,
    va='top',
    ha='left',
    fontsize=10.0,
    linespacing=1.55,
    bbox=dict(boxstyle='round,pad=0.6', facecolor='#f8f2f5', edgecolor='#dcc2ce'),
  )

  ax4.axis('off')
  summary_right = '\n'.join([
    '附录示例参数（均经 Octave 验证）',
    '',
    rf"PD：K = {payload['nmp']['pd_example']['K']:.3f}, Td = {payload['nmp']['pd_example']['Td']:.3f}",
    rf"Mp = {payload['nmp']['pd_example']['metrics']['overshoot']:.2f}%, ts = {payload['nmp']['pd_example']['metrics']['settling_time_2pct']:.2f} s",
    '',
    rf"测速反馈：K = {payload['nmp']['rate_example']['K']:.2f}, Kt = {payload['nmp']['rate_example']['Kt']:.2f}",
    rf"Mp = {payload['nmp']['rate_example']['metrics']['overshoot']:.2f}%, ts = {payload['nmp']['rate_example']['metrics']['settling_time_2pct']:.2f} s",
    '',
    rf"超前：Kc = {payload['nmp']['lead_example']['Kc']:.3f}, a = {payload['nmp']['lead_example']['a']:.3f}, T = {payload['nmp']['lead_example']['T']:.3f}",
    rf"Mp = {payload['nmp']['lead_example']['metrics']['overshoot']:.2f}%, ts = {payload['nmp']['lead_example']['metrics']['settling_time_2pct']:.2f} s",
  ])
  ax4.text(
    0.02,
    0.98,
    summary_right,
    va='top',
    ha='left',
    fontsize=10.0,
    linespacing=1.55,
    bbox=dict(boxstyle='round,pad=0.6', facecolor='#f4f7fb', edgecolor='#cad5e4'),
  )
  fig.suptitle('任务 E：右半平面零点不是“再补一点角”就能绕开的，它会先改写可行目标', fontsize=14, fontweight='bold')
  save(fig, '3-6-rhp-boundary.png')


def main() -> None:
  OUT_DIR.mkdir(parents=True, exist_ok=True)
  payload = load_payload()
  render_pd(payload)
  render_rate(payload)
  render_lead(payload)
  render_pd_frequency(payload)
  render_nmp(payload)


if __name__ == '__main__':
  main()
