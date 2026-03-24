#!/usr/bin/env python3
"""
h-01-bode-magnitude-regions.py
生成：典型二阶系统幅频曲线，标注通过区/过渡区/衰减区三段 + 截止频率 ωc + 0dB参考线
引用：handout §2.1 / interactive-page step-05
"""
import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args():
    parser = argparse.ArgumentParser(description='Generate h-01 Bode magnitude regions SVG.')
    parser.add_argument('--output', type=Path,
                        default=Path('h-01-bode-magnitude-regions.svg'))
    return parser.parse_args()


def main():
    args = parse_args()
    configure_matplotlib_for_cjk()

    # 二阶系统参数：ζ=0.45, ωn=0.05 rad/s（船舶典型）
    zeta = 0.45
    wn = 0.05
    omega = np.logspace(-3, 0, 500)  # 0.001 ~ 1 rad/s

    # 闭环频率响应（标准二阶）
    H = 1 / (-(omega / wn)**2 + 2j * zeta * (omega / wn) + 1)
    mag_dB = 20 * np.log10(np.abs(H))

    # 截止频率（幅值=1处，0dB）
    idx_wc = np.argmin(np.abs(mag_dB))
    wc = omega[idx_wc]

    fig, ax = plt.subplots(figsize=(8, 5))
    bg = '#0f172a'
    ax.set_facecolor(bg)
    fig.patch.set_facecolor(bg)

    # 背景色区：通过区（绿色调）、过渡区（黄色调）、衰减区（红色调）
    ax.axvspan(omega[0], wc * 0.4, alpha=0.08, color='#22c55e', zorder=0)
    ax.axvspan(wc * 0.4, wc * 2.5, alpha=0.08, color='#eab308', zorder=0)
    ax.axvspan(wc * 2.5, omega[-1], alpha=0.08, color='#ef4444', zorder=0)

    # 0 dB 参考线
    ax.axhline(0, color='#94a3b8', linewidth=0.8, linestyle='--', alpha=0.7, zorder=1)
    ax.text(omega[-1] * 1.05, 0.8, '0 dB', color='#94a3b8', fontsize=9,
            va='center', ha='left')

    # 幅频曲线
    ax.semilogx(omega, mag_dB, color='#67e8f9', linewidth=2.2, zorder=3)

    # 截止频率标注
    ax.axvline(wc, color='#f59e0b', linewidth=1.2, linestyle=':', alpha=0.9, zorder=2)
    ax.plot(wc, 0, 'o', color='#f59e0b', markersize=7, zorder=4)
    ax.annotate(f'截止频率\n$\\omega_c \\approx {wc:.3f}$ rad/s',
                xy=(wc, 0), xytext=(wc * 3, 5),
                color='#f59e0b', fontsize=9,
                arrowprops=dict(arrowstyle='->', color='#f59e0b', lw=1.0),
                ha='left')

    # 三区域文字标注
    ax.text(omega[0] * 3, 4, '通过区\n≈ 0 dB', color='#86efac', fontsize=9,
            ha='left', va='top', alpha=0.9)
    ax.text(wc * 0.6, -8, '过渡区', color='#fde047', fontsize=9,
            ha='center', va='top', alpha=0.9)
    ax.text(wc * 4, -18, '衰减区\n< 0 dB', color='#fca5a5', fontsize=9,
            ha='center', va='top', alpha=0.9)

    # 坐标轴
    ax.set_xlabel('频率 $\\omega$ (rad/s)', color='#cbd5e1', fontsize=10)
    ax.set_ylabel('幅值 (dB)', color='#cbd5e1', fontsize=10)
    ax.set_title('Bode 幅频曲线——三区域结构', color='white', fontsize=12, pad=10)
    ax.tick_params(colors='#94a3b8', labelsize=8)
    for spine in ax.spines.values():
        spine.set_edgecolor('#334155')
    ax.set_xlim([omega[0], omega[-1]])
    ax.set_ylim([-35, 12])
    ax.grid(True, which='both', color='#1e293b', linewidth=0.5, alpha=0.7)

    plt.tight_layout()
    plt.savefig(args.output, format='svg', bbox_inches='tight', dpi=150)
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
