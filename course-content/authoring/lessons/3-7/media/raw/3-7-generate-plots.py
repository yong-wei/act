from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image
import control


OUT_DIR = ROOT / 'course-content/authoring/lessons/3-7/media/processed'
OUT_DIR.mkdir(parents=True, exist_ok=True)

matplotlib.rcParams['font.family'] = 'sans-serif'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'STHeiti', 'Arial Unicode MS', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False

BLUE = '#1f4e79'
RED = '#c0392b'
GREEN = '#117a65'
PURPLE = '#6c3483'
GRAY = '#888888'


def flatten_to_white(path: Path) -> None:
  image = Image.open(path).convert('RGBA')
  background = Image.new('RGBA', image.size, (255, 255, 255, 255))
  Image.alpha_composite(background, image).convert('RGB').save(path)


def save(fig: plt.Figure, filename: str) -> None:
  path = OUT_DIR / filename
  fig.savefig(path, dpi=220, facecolor='white', bbox_inches='tight', pad_inches=0.08)
  plt.close(fig)
  flatten_to_white(path)


def step_metrics(sys, t_end: float) -> tuple[float, float, float]:
  t = np.linspace(0, t_end, int(t_end * 120) + 1)
  t, y = control.step_response(sys, t)
  final_value = float(y[-1])
  overshoot = max((float(np.max(y)) - final_value) / final_value * 100.0, 0.0)
  band = 0.02 * abs(final_value)
  idx = np.where(np.abs(y - final_value) > band)[0]
  if len(idx) == 0:
    settling_time = 0.0
  elif idx[-1] == len(t) - 1:
    settling_time = float('nan')
  else:
    settling_time = float(t[idx[-1] + 1])
  return settling_time, overshoot, final_value


def ramp_response(sys, t_end: float) -> tuple[np.ndarray, np.ndarray]:
  t = np.linspace(0, t_end, int(t_end * 120) + 1)
  _, y = control.forced_response(sys, t, t)
  return t, y


def bode_arrays(sys, w: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
  mag, phase, _ = control.bode(sys, w, plot=False)
  return 20 * np.log10(np.asarray(mag).squeeze()), np.rad2deg(np.asarray(phase).squeeze())


def rlocus_lines(sys, k_max: float = 20.0, points: int = 400) -> list[np.ndarray]:
  kvect = np.linspace(0, k_max, points)
  roots, _ = control.root_locus(sys, gains=kvect, plot=False)
  return [roots[:, i] for i in range(roots.shape[1])]


def add_feasible_region(ax: plt.Axes, zeta_min: float, sigma_min: float, x_max: float, y_max: float) -> None:
  sigma = np.linspace(0, x_max, 200)
  theta = np.arccos(zeta_min)
  omega = sigma * np.tan(theta)
  ax.axvline(-sigma_min, color=GRAY, linestyle='--', linewidth=1.0)
  ax.plot(-sigma, omega, '--', color=GRAY, linewidth=1.0)
  ax.plot(-sigma, -omega, '--', color=GRAY, linewidth=1.0)
  ax.set_xlim(-x_max, 1.0)
  ax.set_ylim(-y_max, y_max)


def render_pi_time_domain_design() -> None:
  s = control.TransferFunction.s
  g = 4 / (s * (s + 4))
  pure = control.feedback(g, 1)
  pure_k10 = control.feedback(10 * g, 1)
  pi_design = control.feedback(0.8 * (s + 0.3) / s * g, 1)

  fig = plt.figure(figsize=(11.4, 12.0), dpi=220)
  gs = fig.add_gridspec(3, 1, hspace=0.28)

  ax1 = fig.add_subplot(gs[0, 0])
  for locus in rlocus_lines(g):
    ax1.plot(locus.real, locus.imag, color=BLUE, linewidth=1.15)
  for locus in rlocus_lines((s + 0.3) / s * g):
    ax1.plot(locus.real, locus.imag, color=RED, linewidth=1.15)
  add_feasible_region(ax1, zeta_min=0.456, sigma_min=0.333, x_max=6.5, y_max=6.0)
  pure_k10_poles = np.array(control.poles(control.feedback(10 * g, 1)))
  pi_poles = np.array(control.poles(pi_design))
  ax1.scatter(pure_k10_poles.real, pure_k10_poles.imag, color=BLUE, s=34, marker='o', zorder=3)
  ax1.scatter(pi_poles.real, pi_poles.imag, color=RED, s=38, marker='s', zorder=3)
  ax1.grid(True, color='#dddddd')
  ax1.set_xlabel('实轴')
  ax1.set_ylabel('虚轴')
  ax1.set_title('纯增益与 PI 的根轨迹：纯增益只能沿固定骨架上移，PI 改写低频结构')
  ax1.legend(['纯增益根轨迹', 'PI 根轨迹', '纯增益 K=10 极点', 'PI 设计极点'], loc='lower left', frameon=False)

  ax2 = fig.add_subplot(gs[1, 0])
  t = np.linspace(0, 18, 18 * 120 + 1)
  t, y_pure = control.step_response(pure, t)
  _, y_pure_k10 = control.step_response(pure_k10, t)
  _, y_pi = control.step_response(pi_design, t)
  _, os_k10, _ = step_metrics(pure_k10, 18)
  ts_pi, os_pi, _ = step_metrics(pi_design, 18)
  ax2.plot(t, y_pure, color=BLUE, label='纯增益 K=1')
  ax2.plot(t, y_pure_k10, color=BLUE, linestyle='--', label='纯增益 K=10')
  ax2.plot(t, y_pi, color=RED, label='PI 设计')
  ax2.axhline(1.0, color=GRAY, linestyle=':', linewidth=1.0)
  ax2.grid(True, color='#dddddd')
  ax2.set_xlabel('时间 t / s')
  ax2.set_ylabel('阶跃响应')
  ax2.set_title(f'阶跃响应：纯增益 K=10 时 M_p={os_k10:.1f}%，PI 后 M_p={os_pi:.1f}%，t_s={ts_pi:.1f} s')
  ax2.legend(frameon=False, loc='lower right')

  ax3 = fig.add_subplot(gs[2, 0])
  t_ramp, y_pure_ramp = ramp_response(pure, 18)
  _, y_pure_k10_ramp = ramp_response(pure_k10, 18)
  _, y_pi_ramp = ramp_response(pi_design, 18)
  ax3.plot(t_ramp, t_ramp, color=GRAY, linestyle=':', label='参考斜坡')
  ax3.plot(t_ramp, y_pure_ramp, color=BLUE, label='纯增益 K=1')
  ax3.plot(t_ramp, y_pure_k10_ramp, color=BLUE, linestyle='--', label='纯增益 K=10')
  ax3.plot(t_ramp, y_pi_ramp, color=RED, label='PI 设计')
  ax3.grid(True, color='#dddddd')
  ax3.set_xlabel('时间 t / s')
  ax3.set_ylabel('斜坡响应')
  ax3.set_title('斜坡跟踪：纯增益只能压小误差，PI 通过提高型别把斜坡误差压到 0')
  ax3.legend(frameon=False, loc='upper left')

  save(fig, '3-7-pi-time-domain-design.png')


def render_lag_time_domain_design() -> None:
  s = control.TransferFunction.s
  g = 4 / (s * (s + 4))
  pure = control.feedback(g, 1)
  pure_k10 = control.feedback(10 * g, 1)
  lag_design = control.feedback((s + 0.2) / (s + 0.02) * g, 1)

  fig = plt.figure(figsize=(11.4, 12.0), dpi=220)
  gs = fig.add_gridspec(3, 1, hspace=0.28)

  ax1 = fig.add_subplot(gs[0, 0])
  for locus in rlocus_lines(g):
    ax1.plot(locus.real, locus.imag, color=BLUE, linewidth=1.15)
  for locus in rlocus_lines((s + 0.2) / (s + 0.02) * g):
    ax1.plot(locus.real, locus.imag, color=GREEN, linewidth=1.15)
  add_feasible_region(ax1, zeta_min=0.456, sigma_min=0.333, x_max=6.5, y_max=6.0)
  pure_k10_poles = np.array(control.poles(control.feedback(10 * g, 1)))
  lag_poles = np.array(control.poles(lag_design))
  ax1.scatter(pure_k10_poles.real, pure_k10_poles.imag, color=BLUE, s=34, marker='o', zorder=3)
  ax1.scatter(lag_poles.real, lag_poles.imag, color=GREEN, s=38, marker='s', zorder=3)
  ax1.grid(True, color='#dddddd')
  ax1.set_xlabel('实轴')
  ax1.set_ylabel('虚轴')
  ax1.set_title('滞后校正的根轨迹：零点在左、极点在右，重点抬升低频增益')
  ax1.legend(['纯增益根轨迹', '滞后根轨迹', '纯增益 K=10 极点', '滞后设计极点'], loc='lower left', frameon=False)

  ax2 = fig.add_subplot(gs[1, 0])
  t = np.linspace(0, 18, 18 * 120 + 1)
  t, y_pure = control.step_response(pure, t)
  _, y_pure_k10 = control.step_response(pure_k10, t)
  _, y_lag = control.step_response(lag_design, t)
  ts_lag, os_lag, _ = step_metrics(lag_design, 18)
  ax2.plot(t, y_pure, color=BLUE, label='纯增益 K=1')
  ax2.plot(t, y_pure_k10, color=BLUE, linestyle='--', label='纯增益 K=10')
  ax2.plot(t, y_lag, color=GREEN, label='滞后设计')
  ax2.axhline(1.0, color=GRAY, linestyle=':', linewidth=1.0)
  ax2.grid(True, color='#dddddd')
  ax2.set_xlabel('时间 t / s')
  ax2.set_ylabel('阶跃响应')
  ax2.set_title(f'阶跃响应：滞后后 M_p={os_lag:.1f}%，t_s={ts_lag:.1f} s，同时避免纯增益 K=10 的低阻尼')
  ax2.legend(frameon=False, loc='lower right')

  ax3 = fig.add_subplot(gs[2, 0])
  t_ramp, y_pure_ramp = ramp_response(pure, 18)
  _, y_pure_k10_ramp = ramp_response(pure_k10, 18)
  _, y_lag_ramp = ramp_response(lag_design, 18)
  ax3.plot(t_ramp, t_ramp, color=GRAY, linestyle=':', label='参考斜坡')
  ax3.plot(t_ramp, y_pure_ramp, color=BLUE, label='纯增益 K=1')
  ax3.plot(t_ramp, y_pure_k10_ramp, color=BLUE, linestyle='--', label='纯增益 K=10')
  ax3.plot(t_ramp, y_lag_ramp, color=GREEN, label='滞后设计')
  ax3.grid(True, color='#dddddd')
  ax3.set_xlabel('时间 t / s')
  ax3.set_ylabel('斜坡响应')
  ax3.set_title('斜坡跟踪：滞后在型别不变时把 K_v 提高约 10 倍')
  ax3.legend(frameon=False, loc='upper left')

  save(fig, '3-7-lag-time-domain-design.png')


def render_pi_frequency_design() -> None:
  s = control.TransferFunction.s
  g = 4 / (s * (s + 4))
  gain4 = 4 * g
  gain10 = 10 * g
  pi_design = 3 * (s + 0.125) / s * g
  w = np.logspace(-2, 2, 600)
  mag_g4, phase_g4 = bode_arrays(gain4, w)
  mag_g10, phase_g10 = bode_arrays(gain10, w)
  mag_pi, phase_pi = bode_arrays(pi_design, w)
  _, pm_pi, _, wcp_pi = control.margin(pi_design)

  fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10.8, 8.2), dpi=220, sharex=True)
  ax1.semilogx(w, mag_g4, color=BLUE, label='纯增益 K=4')
  ax1.semilogx(w, mag_g10, color=BLUE, linestyle='--', label='纯增益 K=10')
  ax1.semilogx(w, mag_pi, color=RED, label='PI: 3(s+0.125)/s')
  ax1.axhline(0, color=GRAY, linestyle=':', linewidth=1.0)
  ax1.axvline(2.5, color=GRAY, linestyle=':', linewidth=1.0)
  ax1.grid(True, which='both', color='#dddddd')
  ax1.set_ylabel('幅值 / dB')
  ax1.set_title('PI 频域设计：纯增益兼顾不了 K_v 与相位裕度，只能先改低频结构')
  ax1.legend(frameon=False, loc='lower left')

  ax2.semilogx(w, phase_g4, color=BLUE)
  ax2.semilogx(w, phase_g10, color=BLUE, linestyle='--')
  ax2.semilogx(w, phase_pi, color=RED)
  ax2.axhline(-180, color=GRAY, linestyle=':', linewidth=1.0)
  ax2.axvline(2.5, color=GRAY, linestyle=':', linewidth=1.0)
  ax2.grid(True, which='both', color='#dddddd')
  ax2.set_xlabel('频率 ω / rad/s')
  ax2.set_ylabel('相位 / deg')
  ax2.text(0.018, -118, f'PI 设计结果：PM={pm_pi:.1f}°，ωc={wcp_pi:.2f} rad/s', color=RED, fontsize=11)

  save(fig, '3-7-pi-frequency-design.png')


def render_pi_pd_comparison() -> None:
  s = control.TransferFunction.s
  g = 4 / (s * (s + 4))
  t_pi = control.feedback(3 * (s + 0.125) / s * g, 1)
  t_pd = control.feedback(8 * (1 + 0.1 * s) * g, 1)

  fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10.8, 8.2), dpi=220)
  t = np.linspace(0, 12, 12 * 120 + 1)
  t, y_pi = control.step_response(t_pi, t)
  _, y_pd = control.step_response(t_pd, t)
  ax1.plot(t, y_pi, color=RED, label='PI')
  ax1.plot(t, y_pd, color=PURPLE, label='PD')
  ax1.axhline(1.0, color=GRAY, linestyle=':', linewidth=1.0)
  ax1.grid(True, color='#dddddd')
  ax1.set_xlabel('时间 t / s')
  ax1.set_ylabel('阶跃响应')
  ax1.set_title('频域设计后的阶跃响应：PI 更重低频精度，PD 更重动态速度')
  ax1.legend(frameon=False, loc='lower right')

  t_ramp, y_pi_ramp = ramp_response(t_pi, 12)
  _, y_pd_ramp = ramp_response(t_pd, 12)
  ax2.plot(t_ramp, t_ramp, color=GRAY, linestyle=':', label='参考斜坡')
  ax2.plot(t_ramp, y_pi_ramp, color=RED, label='PI')
  ax2.plot(t_ramp, y_pd_ramp, color=PURPLE, label='PD')
  ax2.grid(True, color='#dddddd')
  ax2.set_xlabel('时间 t / s')
  ax2.set_ylabel('斜坡响应')
  ax2.set_title('斜坡跟踪：PI 消除斜坡误差，PD 保留有限误差')
  ax2.legend(frameon=False, loc='upper left')

  save(fig, '3-7-pi-pd-comparison.png')


if __name__ == '__main__':
  render_pi_time_domain_design()
  render_lag_time_domain_design()
  render_pi_frequency_design()
  render_pi_pd_comparison()
  print(f'已生成 {OUT_DIR / "3-7-pi-time-domain-design.png"}')
  print(f'已生成 {OUT_DIR / "3-7-lag-time-domain-design.png"}')
  print(f'已生成 {OUT_DIR / "3-7-pi-frequency-design.png"}')
  print(f'已生成 {OUT_DIR / "3-7-pi-pd-comparison.png"}')
