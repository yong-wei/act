import argparse
from pathlib import Path

import matplotlib.pyplot as plt

from matplotlib_font import configure_matplotlib_for_cjk
from td_math import second_order_step_response


CASES = [
    ('无阻尼', 0.0, '#c2410c', '始终振荡，不收敛到静稳过程'),
    ('欠阻尼', 0.25, '#0284c7', '有超调但衰减回稳，工程最常见'),
    ('临界阻尼', 1.0, '#0f766e', '不振荡且通常是非振荡条件下最快'),
    ('过阻尼', 1.5, '#7c3aed', '无超调但更慢，拖尾明显'),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate td-03 second-order response families SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / 'td-03-second-order-response-families.svg',
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()

    fig, axes = plt.subplots(2, 2, figsize=(11.5, 7.2), sharex=True, sharey=True)
    fig.patch.set_facecolor('#f8fafc')

    for ax, (title, zeta, color, caption) in zip(axes.flat, CASES):
        t, y = second_order_step_response(zeta=zeta, wn=1.0, duration=10.0, dt=0.004)
        ax.set_facecolor('#f8fafc')
        ax.plot(t, y, color=color, linewidth=2.3)
        ax.axhline(1.0, color='#94a3b8', linewidth=1.0, linestyle='--')
        ax.set_title(f'{title}  ($\\zeta = {zeta:g}$)', fontsize=12, fontweight='bold', color='#0f172a')
        ax.text(0.03, 0.08, caption, transform=ax.transAxes, fontsize=8.8, color='#334155')
        ax.grid(True, color='#e2e8f0')
        ax.set_xlim(0.0, 10.0)
        ax.set_ylim(0.0, 1.75)
        for spine in ax.spines.values():
            spine.set_color('#cbd5e1')

    fig.suptitle('标准二阶系统四种响应家族：阻尼比变化决定曲线形态', fontsize=15, fontweight='bold', y=0.97)
    fig.text(0.5, 0.03, '横轴：时间 t / s     纵轴：输出 c(t)', ha='center', fontsize=10, color='#475569')
    plt.tight_layout(rect=(0.03, 0.06, 0.98, 0.94))
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
