#!/usr/bin/env python3
"""
sh-04-phase-margin-vs-overshoot.py
生成：相位裕度 γ 与超调量 Mp 的关系曲线
  - 精确二阶系统曲线
  - γ≈100ζ° 近似直线
  - 三个工程参考点：γ=30°/45°/60°
引用：handout §2.4 / interactive-page step-09, step-13
"""
import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args():
    parser = argparse.ArgumentParser(description='Generate sh-04 phase margin vs overshoot SVG.')
    parser.add_argument('--output', type=Path,
                        default=Path('sh-04-phase-margin-vs-overshoot.svg'))
    return parser.parse_args()


def zeta_to_mp(zeta):
    """精确超调量公式"""
    return np.exp(-np.pi * zeta / np.sqrt(1 - zeta**2)) * 100


def zeta_to_gamma_exact(zeta):
    """二阶系统精确相位裕度（对应 ωc 处）"""
    # ωc 满足：|G(jωc)| = 1，对标准二阶闭环系统
    # 开环 G(s) = ωn²/(s(s+2ζωn))
    # |G(jωc)|=1 → ωc = ωn*sqrt(sqrt(1+4ζ⁴) - 2ζ²)
    u = np.sqrt(np.sqrt(1 + 4 * zeta**4) - 2 * zeta**2)  # ωc/ωn
    gamma = np.degrees(np.arctan(2 * zeta / u))
    return gamma


zeta_arr = np.linspace(0.05, 0.95, 300)
# 过滤非稳定范围
valid = (zeta_arr > 0) & (zeta_arr < 1)
zeta_arr = zeta_arr[valid]

mp_exact = zeta_to_mp(zeta_arr)
gamma_exact = zeta_to_gamma_exact(zeta_arr)
gamma_approx = zeta_arr * 100  # γ≈100ζ°

# 插值：以 γ 为横轴
gamma_range = np.linspace(5, 90, 300)
zeta_interp = np.interp(gamma_range, np.sort(gamma_exact),
                        zeta_arr[np.argsort(gamma_exact)])
mp_interp = zeta_to_mp(zeta_interp)
mp_approx_interp = zeta_to_mp(gamma_range / 100)  # 用近似ζ算Mp


def main():
    configure_matplotlib_for_cjk()

    fig, ax = plt.subplots(figsize=(8, 5))
    bg = '#0f172a'
    ax.set_facecolor(bg)
    fig.patch.set_facecolor(bg)

    # 精确曲线
    ax.plot(gamma_range, mp_interp, color='#67e8f9', linewidth=2.2,
            label='精确二阶系统', zorder=3)
    # 近似曲线（γ≈100ζ°代入Mp公式）
    ax.plot(gamma_range, mp_approx_interp, color='#a78bfa', linewidth=1.5,
            linestyle='--', label='近似（$\\gamma \\approx 100\\zeta°$）', zorder=3)

    # 三个工程参考点
    ref_gammas = [30, 45, 60]
    ref_colors = ['#fca5a5', '#f59e0b', '#86efac']
    for g, c in zip(ref_gammas, ref_colors):
        z = g / 100
        mp_val = zeta_to_mp(z)
        ax.plot(g, mp_val, 'o', color=c, markersize=9, zorder=5)
        ax.annotate(f'$\\gamma={g}°$\n$M_p \\approx {mp_val:.0f}\\%$',
                    xy=(g, mp_val), xytext=(g + 4, mp_val + 3),
                    color=c, fontsize=8.5,
                    arrowprops=dict(arrowstyle='->', color=c, lw=0.8))

    # 工程良好区（30°~60°）背景色
    ax.axvspan(30, 60, alpha=0.06, color='#22c55e', zorder=0,
               label='工程良好范围 (30°~60°)')

    ax.set_xlabel('相位裕度 $\\gamma$ (°)', color='#cbd5e1', fontsize=10)
    ax.set_ylabel('超调量 $M_p$ (%)', color='#cbd5e1', fontsize=10)
    ax.set_title('相位裕度 $\\gamma$ 与超调量 $M_p$ 的关系', color='white', fontsize=12, pad=10)
    ax.set_xlim([5, 85])
    ax.set_ylim([0, 80])
    ax.tick_params(colors='#94a3b8', labelsize=8)
    ax.grid(True, color='#1e293b', linewidth=0.5, alpha=0.7)
    for spine in ax.spines.values():
        spine.set_edgecolor('#334155')
    ax.legend(loc='upper right', fontsize=8.5, facecolor='#1e293b',
              edgecolor='#334155', labelcolor='#cbd5e1')

    plt.tight_layout()
    from pathlib import Path
    output = Path('sh-04-phase-margin-vs-overshoot.svg')
    plt.savefig(output, format='svg', bbox_inches='tight', dpi=150)
    print(f'已生成：{output}')


if __name__ == '__main__':
    main()
