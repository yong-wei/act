import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


CARD_COLORS = {
    'normal': '#e2e8f0',
    'highlight': '#cffafe',
    'line': '#0f172a',
    'accent': '#0891b2',
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate td-01 time-domain overview SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / 'td-01-time-domain-input-response-overview.svg',
    )
    return parser.parse_args()


def impulse_like(t: np.ndarray) -> np.ndarray:
    return np.exp(-((t - 0.2) / 0.045) ** 2)


def ramp(t: np.ndarray) -> np.ndarray:
    return np.clip(0.9 * t, 0.0, 1.0)


def first_order_output(t: np.ndarray) -> np.ndarray:
    return 1.0 - np.exp(-2.5 * t)


def impulse_response(t: np.ndarray) -> np.ndarray:
    return 2.2 * np.exp(-5.2 * t) * (t > 0)


def ramp_response(t: np.ndarray) -> np.ndarray:
    return np.clip(t - 0.22 * (1.0 - np.exp(-3.5 * t)), 0.0, 1.0)


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()

    t = np.linspace(0.0, 1.0, 500)
    columns = [
        ('单位脉冲', '典型瞬态触发', impulse_like(t), impulse_response(t), False),
        ('单位阶跃', '本课默认性能测试输入', np.where(t >= 0.15, 1.0, 0.0), first_order_output(t), True),
        ('单位斜坡', '常用于跟踪能力观察', ramp(t), ramp_response(t), False),
    ]

    fig, axes = plt.subplots(2, 3, figsize=(12.4, 6.4), sharex='col')
    fig.patch.set_facecolor('#f8fafc')

    for col, (title, subtitle, input_y, output_y, highlight) in enumerate(columns):
        face = CARD_COLORS['highlight'] if highlight else CARD_COLORS['normal']
        for row in range(2):
            ax = axes[row, col]
            ax.set_facecolor(face)
            ax.set_xlim(0.0, 1.0)
            ax.set_ylim(-0.05, 1.25)
            ax.grid(True, color='white', linewidth=1.0)
            for spine in ax.spines.values():
                spine.set_color('#cbd5e1')
            ax.tick_params(colors='#475569', labelsize=8)
            ax.set_yticks([0.0, 0.5, 1.0])
            ax.set_xticks([0.0, 0.5, 1.0])
            if row == 0:
                ax.set_title(title, fontsize=12, fontweight='bold', color='#0f172a', pad=16)
                ax.text(0.02, 1.12, subtitle, transform=ax.transAxes, fontsize=8.5, color='#155e75')
                if highlight:
                    ax.text(
                        0.98,
                        1.14,
                        '本课聚焦',
                        transform=ax.transAxes,
                        ha='right',
                        va='center',
                        fontsize=8.5,
                        color='white',
                        bbox=dict(boxstyle='round,pad=0.25', facecolor=CARD_COLORS['accent'], edgecolor='none'),
                    )

        axes[0, col].plot(t, input_y, color=CARD_COLORS['line'], linewidth=2.2)
        axes[1, col].plot(t, output_y, color=CARD_COLORS['accent'], linewidth=2.4)
        axes[0, col].text(0.05, 0.08, '输入 r(t)', transform=axes[0, col].transAxes, fontsize=9, color='#334155')
        axes[1, col].text(0.05, 0.08, '输出 c(t)', transform=axes[1, col].transAxes, fontsize=9, color='#334155')

    fig.suptitle('时域分析：输入信号决定“怎么激励”，输出曲线决定“怎么评价”', fontsize=15, fontweight='bold', y=0.98)
    fig.text(0.5, 0.02, '横轴：时间 t     纵轴：归一化幅值', ha='center', fontsize=10, color='#475569')
    plt.tight_layout(rect=(0.02, 0.05, 0.98, 0.94))
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
