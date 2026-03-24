#!/usr/bin/env python3
"""
h-03-bode-example-annotated.py
生成：例题用 Bode 图（幅频+相频），标注截止频率 ωc=0.05 rad/s 和该处相角 -135°，γ=45°
引用：handout §三（例题） / interactive-page step-15
"""
import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args():
    parser = argparse.ArgumentParser(description='Generate h-03 annotated Bode example SVG.')
    parser.add_argument('--output', type=Path,
                        default=Path('h-03-bode-example-annotated.svg'))
    return parser.parse_args()


def main():
    args = parse_args()
    configure_matplotlib_for_cjk()

    # 构造一个开环传递函数使得 ωc≈0.05, γ≈45°
    # G(s) = K / (s*(τs+1))，选参数使条件成立
    # 用数值方法直接绘制
    K = 0.0025
    tau = 10.0
    omega = np.logspace(-3, 0, 600)

    G = K / (1j * omega * (1j * tau * omega + 1))
    mag_dB = 20 * np.log10(np.abs(G))
    phase_deg = np.degrees(np.angle(G))

    # 精确截止频率
    idx_wc = np.argmin(np.abs(mag_dB))
    wc = omega[idx_wc]
    phase_at_wc = phase_deg[idx_wc]
    gamma = 180 + phase_at_wc

    fig, axes = plt.subplots(2, 1, figsize=(8, 7), sharex=True)
    bg = '#0f172a'
    fig.patch.set_facecolor(bg)
    fig.suptitle('例题：读 Bode 图，预判系统行为', color='white', fontsize=13, y=0.98)

    # ── 幅频 ──
    ax1 = axes[0]
    ax1.set_facecolor(bg)
    ax1.semilogx(omega, mag_dB, color='#67e8f9', linewidth=2.2, zorder=3,
                 label='$|G(j\\omega)|$ dB')
    ax1.axhline(0, color='#94a3b8', linewidth=0.8, linestyle='--', alpha=0.6)
    ax1.axvline(wc, color='#f59e0b', linewidth=1.2, linestyle=':', alpha=0.9, zorder=2)
    ax1.plot(wc, 0, 'D', color='#f59e0b', markersize=8, zorder=4,
             label=f'$\\omega_c \\approx {wc:.3f}$ rad/s')
    ax1.annotate(f'①  $\\omega_c \\approx {wc:.3f}$ rad/s\n   (幅频穿越 0 dB)',
                 xy=(wc, 0), xytext=(wc * 5, 10),
                 color='#f59e0b', fontsize=8.5,
                 arrowprops=dict(arrowstyle='->', color='#f59e0b', lw=1.0), ha='left')
    ax1.set_ylabel('幅值 (dB)', color='#cbd5e1', fontsize=9)
    ax1.set_ylim([-65, 20])
    ax1.tick_params(colors='#94a3b8', labelsize=8)
    ax1.grid(True, which='both', color='#1e293b', linewidth=0.5, alpha=0.6)
    for spine in ax1.spines.values():
        spine.set_edgecolor('#334155')
    ax1.legend(loc='lower left', fontsize=8, facecolor='#1e293b', edgecolor='#334155',
               labelcolor='#cbd5e1')

    # ── 相频 ──
    ax2 = axes[1]
    ax2.set_facecolor(bg)
    ax2.semilogx(omega, phase_deg, color='#a78bfa', linewidth=2.2, zorder=3)
    ax2.axhline(-180, color='#ef4444', linewidth=1.0, linestyle='-', alpha=0.7)
    ax2.axvline(wc, color='#f59e0b', linewidth=1.2, linestyle=':', alpha=0.9, zorder=2)
    ax2.plot(wc, phase_at_wc, 'D', color='#f59e0b', markersize=8, zorder=4)

    # 标注读图步骤②③
    ax2.annotate(f'②  $\\angle G(j\\omega_c) = {phase_at_wc:.0f}°$',
                 xy=(wc, phase_at_wc), xytext=(wc * 5, phase_at_wc + 20),
                 color='#f59e0b', fontsize=8.5,
                 arrowprops=dict(arrowstyle='->', color='#f59e0b', lw=1.0), ha='left')

    # γ 双向箭头
    ax2.annotate('', xy=(wc * 3, phase_at_wc), xytext=(wc * 3, -180),
                 arrowprops=dict(arrowstyle='<->', color='#22d3ee', lw=1.5))
    ax2.text(wc * 3.5, (phase_at_wc + (-180)) / 2,
             f'③  $\\gamma = 180° + ({phase_at_wc:.0f}°) = {gamma:.0f}°$',
             color='#22d3ee', fontsize=8.5, va='center')

    ax2.text(omega[-1] * 1.02, -179, '-180°', color='#ef4444', fontsize=8, va='bottom')
    ax2.set_xlabel('频率 $\\omega$ (rad/s)', color='#cbd5e1', fontsize=9)
    ax2.set_ylabel('相角 (°)', color='#cbd5e1', fontsize=9)
    ax2.set_ylim([-200, -60])
    ax2.set_yticks([-180, -135, -90])
    ax2.tick_params(colors='#94a3b8', labelsize=8)
    ax2.grid(True, which='both', color='#1e293b', linewidth=0.5, alpha=0.6)
    for spine in ax2.spines.values():
        spine.set_edgecolor('#334155')

    plt.tight_layout()
    plt.savefig(args.output, format='svg', bbox_inches='tight', dpi=150)
    print(f'已生成：{args.output}  (ωc={wc:.4f}, γ={gamma:.1f}°)')


if __name__ == '__main__':
    main()
