#!/usr/bin/env python3
import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args():
    parser = argparse.ArgumentParser(description='Generate typical elements SVG.')
    parser.add_argument('--output', type=Path, default=Path('h-04-typical-elements.svg'))
    return parser.parse_args()


def main():
    args = parse_args()
    configure_matplotlib_for_cjk()

    t = np.linspace(0, 8, 600)
    y_prop = np.ones_like(t) * 1.4
    y_int = t / 3
    y_inertia = 1 - np.exp(-t / 1.2)
    y_osc = 1 - np.exp(-0.55 * t) * (np.cos(2.1 * t) + 0.2 * np.sin(2.1 * t))
    pulse = np.exp(-((t - 1.2) / 0.18) ** 2)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12.4, 4.8), gridspec_kw={'width_ratios': [3.2, 1.2]})
    fig.patch.set_facecolor('#f8fafc')

    ax1.plot(t, y_prop, linewidth=2.1, label='比例 $G(s)=K$', color='#0f172a')
    ax1.plot(t, y_int, linewidth=2.1, label='积分 $G(s)=1/s$', color='#2563eb')
    ax1.plot(t, y_inertia, linewidth=2.1, label='惯性 $G(s)=1/(Ts+1)$', color='#dc2626')
    ax1.plot(
        t,
        y_osc,
        linewidth=2.1,
        label='振荡 $G(s)=\\omega_n^2/(s^2+2\\zeta\\omega_n s+\\omega_n^2)$',
        color='#16a34a',
    )
    ax1.set_title('典型环节阶跃响应对比', fontsize=12)
    ax1.set_xlabel('t (s)')
    ax1.set_ylabel('y(t)')
    ax1.grid(True, alpha=0.25)
    ax1.legend(frameon=False, fontsize=8.4, loc='upper left')

    ax2.plot(t, pulse, linewidth=2.2, color='#9333ea')
    ax2.set_title('微分环节\nG(s)=s', fontsize=11)
    ax2.set_xlabel('t (s)')
    ax2.set_ylabel('脉冲')
    ax2.grid(True, alpha=0.25)

    for axis in (ax1, ax2):
        axis.set_facecolor('white')
        for spine in axis.spines.values():
            spine.set_color('#cbd5e1')

    plt.tight_layout()
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
