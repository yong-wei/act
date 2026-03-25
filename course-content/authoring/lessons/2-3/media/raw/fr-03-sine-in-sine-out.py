import argparse
from pathlib import Path
import math

import matplotlib.pyplot as plt
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate fr-03 sine-in-sine-out SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / 'fr-03-sine-in-sine-out.svg',
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()

    t = np.linspace(0, 8, 1000)
    omega = 2.4
    input_y = np.sin(omega * t)
    output_y = 0.58 * np.sin(omega * t - 0.95)

    fig = plt.figure(figsize=(11.6, 6.6))
    fig.patch.set_facecolor('#f8fafc')
    gs = fig.add_gridspec(2, 2, width_ratios=[1.8, 1], height_ratios=[1, 1], wspace=0.18, hspace=0.24)
    ax_wave = fig.add_subplot(gs[:, 0])
    ax_amp = fig.add_subplot(gs[0, 1])
    ax_phase = fig.add_subplot(gs[1, 1])

    ax_wave.set_facecolor('#f8fafc')
    ax_wave.plot(t, input_y, color='#0ea5e9', linewidth=2.2, label='输入 $r(t)=A\\sin(\\omega t)$')
    ax_wave.plot(t, output_y, color='#f97316', linewidth=2.6, label='输出 $c_{ss}(t)=A|G(j\\omega)|\\sin(\\omega t+\\angle G(j\\omega))$')
    ax_wave.grid(True, color='#e2e8f0')
    ax_wave.set_xlim(0, 8)
    ax_wave.set_ylim(-1.25, 1.25)
    ax_wave.set_xlabel('时间 t / s')
    ax_wave.set_ylabel('幅值')
    ax_wave.set_title('正弦输入经过系统后：频率不变，只改幅值和相位', fontsize=14, fontweight='bold', pad=12)
    ax_wave.legend(loc='upper right', frameon=False)
    ax_wave.annotate('输出振幅更小', xy=(2.1, 0.58), xytext=(2.7, 1.02), fontsize=10, color='#9a3412',
                     arrowprops=dict(arrowstyle='->', lw=1.4, color='#9a3412'))
    ax_wave.annotate('输出整体向右拖后', xy=(5.6, -0.3), xytext=(6.1, -0.95), fontsize=10, color='#7c2d12',
                     arrowprops=dict(arrowstyle='->', lw=1.4, color='#7c2d12'))
    for spine in ax_wave.spines.values():
        spine.set_color('#cbd5e1')

    labels = ['输入', '输出']
    amp_values = [1.0, 0.58]
    phase_values = [0.0, -math.degrees(0.95)]

    for ax, values, title, color in [
        (ax_amp, amp_values, '幅值对比', '#0f766e'),
        (ax_phase, phase_values, '相位对比', '#9333ea'),
    ]:
        ax.set_facecolor('#f8fafc')
        bars = ax.bar(labels, values, color=['#0ea5e9', '#f97316'], width=0.55)
        ax.set_title(title, fontsize=12.5, fontweight='bold', color=color, pad=10)
        ax.grid(True, axis='y', color='#e2e8f0')
        for spine in ax.spines.values():
            spine.set_color('#cbd5e1')
        for bar, value in zip(bars, values):
            ax.text(bar.get_x() + bar.get_width() / 2, value + (0.04 if value >= 0 else -4.5),
                    f'{value:.2f}' + ('°' if title == '相位对比' else ''),
                    ha='center', va='bottom' if value >= 0 else 'top', fontsize=9.5, color='#334155')

    ax_amp.set_ylim(0, 1.15)
    ax_phase.axhline(0, color='#94a3b8', linewidth=1.1)
    ax_phase.set_ylim(-70, 15)
    ax_phase.set_ylabel('角度 / °')

    fig.subplots_adjust(left=0.06, right=0.97, bottom=0.08, top=0.92)
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
