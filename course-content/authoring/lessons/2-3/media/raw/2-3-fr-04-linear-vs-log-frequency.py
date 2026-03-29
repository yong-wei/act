import argparse
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Generate 2-3 fr-04 linear vs log frequency SVG.'
    )
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / '2-3-fr-04-linear-vs-log-frequency.svg',
    )
    return parser.parse_args()


def bode_like_magnitude(omega: np.ndarray, omega_b: float) -> np.ndarray:
    mag = 1.0 / np.sqrt(1.0 + (omega / omega_b) ** 2)
    return 20.0 * np.log10(mag)


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()
    plt.rcParams['axes.unicode_minus'] = False

    omega = np.logspace(-1, 3, 1200)
    omega_b = 10.0
    mag_db = bode_like_magnitude(omega, omega_b)
    breakpoints = [1.0, 10.0, 100.0]
    breakpoint_labels = ['1', '10', '100']

    fig, axes = plt.subplots(1, 2, figsize=(12.2, 6.5), sharey=True)
    fig.patch.set_facecolor('#f8fafc')

    panel_specs = [
        (
            axes[0],
            '线性频率坐标',
            False,
            '同样跨三个数量级，但低频端被压在左侧',
            '#0ea5e9',
        ),
        (
            axes[1],
            '对数频率坐标',
            True,
            '每个十倍频程等宽，转折频率更容易读',
            '#f97316',
        ),
    ]

    for ax, title, use_log, note, curve_color in panel_specs:
        ax.set_facecolor('#f8fafc')
        if use_log:
            ax.set_xscale('log')
            ax.plot(omega, mag_db, color=curve_color, linewidth=2.8)
        else:
            ax.plot(omega, mag_db, color=curve_color, linewidth=2.8)
            ax.set_xlim(0, 120)
        for bp, label in zip(breakpoints, breakpoint_labels):
            ax.axvline(bp, color='#94a3b8', linestyle='--', linewidth=1.1)
            ax.scatter([bp], [bode_like_magnitude(np.array([bp]), omega_b)[0]], color='#334155', s=26, zorder=3)
            ax.text(
                bp,
                -36.0 if use_log else -38.0,
                rf'$\omega={label}$',
                ha='center',
                va='top',
                fontsize=9.5,
                color='#334155',
            )
        ax.grid(True, color='#e2e8f0', which='both')
        ax.set_ylim(-42, 2)
        ax.yaxis.set_major_formatter(FuncFormatter(lambda value, _: f'{value:.0f}'))
        ax.set_title(title, fontsize=13, fontweight='bold', pad=12)
        ax.text(0.04, 0.08, note, transform=ax.transAxes, fontsize=10, color='#475569')
        ax.set_xlabel(r'频率 $\omega$ / rad/s')
        for spine in ax.spines.values():
            spine.set_color('#cbd5e1')

    axes[0].set_ylabel(r'幅值 $20\log_{10}|G(j\omega)|$ / dB')
    axes[0].annotate(
        '0~10 rad/s 的变化都挤在左边',
        xy=(8, bode_like_magnitude(np.array([8.0]), omega_b)[0]),
        xytext=(36, -8),
        fontsize=10,
        color='#0369a1',
        arrowprops=dict(arrowstyle='->', lw=1.3, color='#0369a1'),
    )
    axes[1].annotate(
        '十倍频程等宽后\n转折附近更容易看清',
        xy=(10, bode_like_magnitude(np.array([10.0]), omega_b)[0]),
        xytext=(17, -10),
        fontsize=10,
        color='#9a3412',
        arrowprops=dict(arrowstyle='->', lw=1.3, color='#9a3412'),
    )

    fig.suptitle('为什么 Bode 图使用对数频率坐标', fontsize=15, fontweight='bold', y=0.97)
    fig.text(
        0.5,
        0.02,
        '同一对象放到两种坐标里看：对数坐标不是“画法偏好”，而是为了把跨数量级的频率变化真正展开。',
        ha='center',
        fontsize=10,
        color='#475569',
    )
    plt.tight_layout(rect=(0.03, 0.06, 0.98, 0.94))
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
