import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate 2-3 fr-02 square-wave harmonics SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / '2-3-fr-02-square-wave-harmonics.svg',
    )
    return parser.parse_args()


def series_square(t: np.ndarray, terms: list[int]) -> np.ndarray:
    y = np.zeros_like(t)
    for n in terms:
        y += (4 / np.pi) * (1 / n) * np.sin(n * t)
    return y


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()

    t = np.linspace(0, 2 * np.pi, 1600)
    base = (4 / np.pi) * np.sin(t)
    three = series_square(t, [1, 3, 5])
    seven = series_square(t, [1, 3, 5, 7, 9, 11, 13])
    filtered = 0.95 * np.sin(t) + 0.18 * (4 / np.pi / 3) * np.sin(3 * t)

    fig, axes = plt.subplots(2, 2, figsize=(11.8, 7.4), sharex=True, sharey=True)
    fig.patch.set_facecolor('#f8fafc')

    panels = [
        ('只保留基波', base, '#0ea5e9', '只有最慢的节奏，边角明显变圆'),
        ('加入 3、5 次谐波', three, '#10b981', '开始出现方波轮廓，但边缘仍较圆'),
        ('加入更多高频谐波', seven, '#f97316', '高频越多，边缘越锋利'),
        ('系统压制高频后重构', filtered, '#8b5cf6', '高频被削弱，输出重新变平滑'),
    ]

    for ax, (title, y, color, note) in zip(axes.flat, panels):
        ax.set_facecolor('#f8fafc')
        ax.plot(t, y, color=color, linewidth=2.4)
        ax.grid(True, color='#e2e8f0')
        ax.set_title(title, fontsize=12.5, fontweight='bold', pad=10)
        ax.text(0.03, 0.08, note, transform=ax.transAxes, fontsize=9, color='#334155')
        ax.set_xlim(0, 2 * np.pi)
        ax.set_ylim(-1.45, 1.45)
        for spine in ax.spines.values():
            spine.set_color('#cbd5e1')

    fig.suptitle('方波可以拆成谐波：高频分量越多，波形边缘越锋利', fontsize=15, fontweight='bold', y=0.97)
    fig.text(0.5, 0.03, '横轴：时间（相位展开）     纵轴：归一化幅值', ha='center', fontsize=10, color='#475569')
    plt.tight_layout(rect=(0.03, 0.06, 0.98, 0.94))
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
