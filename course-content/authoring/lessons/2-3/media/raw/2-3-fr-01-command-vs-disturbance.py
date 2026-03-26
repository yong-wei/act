import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate 2-3 fr-01 command vs disturbance SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / '2-3-fr-01-command-vs-disturbance.svg',
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()

    t = np.linspace(0, 20, 1200)
    low_in = np.sin(0.45 * t)
    low_out = 0.92 * np.sin(0.45 * t - 0.18)
    high_in = 0.9 * np.sin(3.8 * t)
    high_out = 0.22 * np.sin(3.8 * t - 1.1)

    fig, axes = plt.subplots(2, 1, figsize=(11.5, 7.2), sharex=True)
    fig.patch.set_facecolor('#f8fafc')

    configs = [
        (axes[0], low_in, low_out, '低频指令：系统基本跟得上', '#0ea5e9', '#0f766e'),
        (axes[1], high_in, high_out, '高频扰动：系统明显压制并滞后', '#f97316', '#9333ea'),
    ]

    for ax, src, dst, title, src_color, dst_color in configs:
        ax.set_facecolor('#f8fafc')
        ax.plot(t, src, color=src_color, linewidth=2.2, label='输入')
        ax.plot(t, dst, color=dst_color, linewidth=2.6, label='输出')
        ax.grid(True, color='#e2e8f0')
        ax.set_ylim(-1.2, 1.2)
        ax.set_xlim(0, 20)
        ax.set_ylabel('幅值')
        ax.set_title(title, fontsize=13, fontweight='bold', pad=10)
        ax.legend(loc='upper right', frameon=False)
        for spine in ax.spines.values():
            spine.set_color('#cbd5e1')

    axes[0].annotate('输出几乎贴着输入\n只是稍微慢半拍', xy=(11.6, -0.78), xytext=(10.2, 0.88), fontsize=10, color='#115e59',
                     arrowprops=dict(arrowstyle='->', lw=1.4, color='#115e59'))
    axes[1].annotate('高频成分被明显削弱', xy=(7.3, 0.18), xytext=(10.5, 0.72), fontsize=10, color='#7e22ce',
                     arrowprops=dict(arrowstyle='->', lw=1.4, color='#7e22ce'))
    axes[1].set_xlabel('时间 t / s')

    fig.suptitle('同一个系统会“挑节奏”：低频更容易通过，高频更容易被压制', fontsize=15, fontweight='bold', y=0.97)
    plt.tight_layout(rect=(0.03, 0.04, 0.98, 0.95))
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
