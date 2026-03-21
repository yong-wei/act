import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk
from td_math import first_order_step_response


COLORS = ['#0f766e', '#0284c7', '#ea580c']


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate td-02 first-order step response SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / 'td-02-first-order-step-time-constant.svg',
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()

    t = np.linspace(0.0, 6.0, 900)
    time_constants = [0.5, 1.0, 2.0]

    fig, ax = plt.subplots(figsize=(10.8, 5.8))
    fig.patch.set_facecolor('#f8fafc')
    ax.set_facecolor('#f8fafc')

    ax.axhline(1.0, color='#64748b', linestyle='--', linewidth=1.2)
    ax.axhline(0.632, color='#94a3b8', linestyle=':', linewidth=1.2)
    ax.text(6.02, 1.0, '终值 1', fontsize=9, color='#475569', va='center')
    ax.text(6.02, 0.632, '63.2%', fontsize=9, color='#475569', va='center')

    for idx, time_constant in enumerate(time_constants):
        y = first_order_step_response(t, gain=1.0, time_constant=time_constant)
        label = f'T = {time_constant:.1f} s'
        ax.plot(t, y, linewidth=2.6, color=COLORS[idx], label=label)
        y_mark = first_order_step_response(np.array([time_constant]), gain=1.0, time_constant=time_constant)[0]
        ax.plot([time_constant], [y_mark], 'o', color=COLORS[idx], markersize=7)
        ax.vlines(time_constant, 0.0, y_mark, colors=COLORS[idx], linestyles=':', linewidth=1.4)
        ax.text(time_constant + 0.06, y_mark + 0.03, f't = T\n{label}', fontsize=8.5, color=COLORS[idx])

    ax.annotate(
        '时间常数越大，响应越慢',
        xy=(2.5, 0.72),
        xytext=(3.6, 0.35),
        fontsize=10,
        color='#7c2d12',
        arrowprops=dict(arrowstyle='->', color='#ea580c', lw=1.5),
    )

    ax.set_title('一阶系统单位阶跃响应：时间常数 $T$ 决定快慢尺度', fontsize=14, fontweight='bold', pad=12)
    ax.set_xlabel('时间 t / s')
    ax.set_ylabel('输出 c(t)')
    ax.set_xlim(0.0, 6.0)
    ax.set_ylim(0.0, 1.08)
    ax.grid(True, color='#e2e8f0')
    ax.legend(loc='lower right', frameon=False)

    plt.tight_layout()
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
