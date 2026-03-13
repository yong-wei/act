#!/usr/bin/env python3
"""
h-02-phase-margin-diagram.py
生成：相位裕度示意图——标注截止频率 ωc、-180° 危险边界、γ 角度
引用：handout §2.3 / interactive-page step-09
"""
import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args():
    parser = argparse.ArgumentParser(description='Generate h-02 phase margin diagram SVG.')
    parser.add_argument('--output', type=Path,
                        default=Path('h-02-phase-margin-diagram.svg'))
    return parser.parse_args()


def main():
    args = parse_args()
    configure_matplotlib_for_cjk()

    # 典型二阶系统：ζ=0.45, ωn=0.05
    zeta = 0.45
    wn = 0.05
    omega = np.logspace(-3, 0, 600)

    H_ol = wn**2 / (1j * omega * (1j * omega + 2 * zeta * wn))  # 简化开环
    phase_deg = np.degrees(np.angle(H_ol))
    mag_dB = 20 * np.log10(np.abs(H_ol))

    # 找截止频率（幅值最接近0dB处）
    idx_wc = np.argmin(np.abs(mag_dB))
    wc = omega[idx_wc]
    phase_at_wc = phase_deg[idx_wc]
    gamma = 180 + phase_at_wc  # 相位裕度

    fig, axes = plt.subplots(2, 1, figsize=(8, 7), sharex=True)
    bg = '#0f172a'
    fig.patch.set_facecolor(bg)

    # ── 上图：幅频曲线 ──
    ax1 = axes[0]
    ax1.set_facecolor(bg)
    ax1.semilogx(omega, mag_dB, color='#67e8f9', linewidth=2, zorder=3)
    ax1.axhline(0, color='#94a3b8', linewidth=0.8, linestyle='--', alpha=0.7)
    ax1.axvline(wc, color='#f59e0b', linewidth=1.2, linestyle=':', alpha=0.9)
    ax1.plot(wc, 0, 'o', color='#f59e0b', markersize=7, zorder=4)
    ax1.text(wc * 1.3, 2, f'$\\omega_c$', color='#f59e0b', fontsize=11)
    ax1.set_ylabel('幅值 (dB)', color='#cbd5e1', fontsize=9)
    ax1.set_title('相位裕度 $\\gamma$：在截止频率处量', color='white', fontsize=12, pad=8)
    ax1.set_ylim([-55, 15])
    ax1.tick_params(colors='#94a3b8', labelsize=8)
    ax1.grid(True, which='both', color='#1e293b', linewidth=0.5, alpha=0.7)
    for spine in ax1.spines.values():
        spine.set_edgecolor('#334155')
    ax1.text(omega[-1] * 1.02, 1.5, '0 dB', color='#94a3b8', fontsize=8, va='center')

    # ── 下图：相频曲线 ──
    ax2 = axes[1]
    ax2.set_facecolor(bg)
    ax2.semilogx(omega, phase_deg, color='#a78bfa', linewidth=2, zorder=3)

    # -180° 危险边界
    ax2.axhline(-180, color='#ef4444', linewidth=1.2, linestyle='-', alpha=0.8, zorder=2)
    ax2.text(omega[-1] * 1.02, -179, '-180°\n危险边界', color='#ef4444',
             fontsize=8, va='bottom')

    # 截止频率竖线
    ax2.axvline(wc, color='#f59e0b', linewidth=1.2, linestyle=':', alpha=0.9, zorder=2)
    ax2.plot(wc, phase_at_wc, 'o', color='#f59e0b', markersize=7, zorder=4)

    # γ 标注：双向箭头 from -180 to phase_at_wc，在 wc*2 处
    ax2.annotate('', xy=(wc * 2, phase_at_wc), xytext=(wc * 2, -180),
                 arrowprops=dict(arrowstyle='<->', color='#22d3ee', lw=1.5))
    ax2.text(wc * 2.5, (phase_at_wc - 180) / 2 - 180 + gamma / 2,
             f'$\\gamma = {gamma:.0f}°$', color='#22d3ee', fontsize=10, va='center')

    # 截止频率处相角标注
    ax2.text(wc * 1.3, phase_at_wc - 5,
             f'$\\angle G(j\\omega_c) = {phase_at_wc:.0f}°$',
             color='#f59e0b', fontsize=8, va='top')

    ax2.set_xlabel('频率 $\\omega$ (rad/s)', color='#cbd5e1', fontsize=9)
    ax2.set_ylabel('相角 (°)', color='#cbd5e1', fontsize=9)
    ax2.set_ylim([-210, -50])
    ax2.set_yticks([-180, -135, -90, -45])
    ax2.tick_params(colors='#94a3b8', labelsize=8)
    ax2.grid(True, which='both', color='#1e293b', linewidth=0.5, alpha=0.7)
    for spine in ax2.spines.values():
        spine.set_edgecolor('#334155')

    plt.tight_layout()
    plt.savefig(args.output, format='svg', bbox_inches='tight', dpi=150)
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
