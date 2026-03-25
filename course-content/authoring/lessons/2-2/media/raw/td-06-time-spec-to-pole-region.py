import argparse
import math
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


MP_LIMIT = 0.10
TS_LIMIT = 2.0
ZETA_MIN = abs(math.log(MP_LIMIT)) / math.sqrt(math.pi ** 2 + math.log(MP_LIMIT) ** 2)
PHI = math.acos(ZETA_MIN)
SIGMA_MIN = 4.0 / TS_LIMIT


def add_panel_box(ax, y: float, title: str, body: str, accent: str) -> None:
    ax.text(
        0.05,
        y,
        f'{title}\n{body}',
        transform=ax.transAxes,
        fontsize=10,
        color='#0f172a',
        va='top',
        bbox=dict(
            boxstyle='round,pad=0.42',
            facecolor='white',
            edgecolor=accent,
            linewidth=1.3,
        ),
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate td-06 time spec to pole region SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / 'td-06-time-spec-to-pole-region.svg',
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()

    fig = plt.figure(figsize=(10.4, 6.4), facecolor='#f8fafc')
    grid = fig.add_gridspec(1, 2, width_ratios=[4.8, 2.2], wspace=0.12)
    ax = fig.add_subplot(grid[0, 0])
    panel = fig.add_subplot(grid[0, 1])

    ax.set_facecolor('#f8fafc')
    panel.set_facecolor('#f8fafc')
    panel.axis('off')

    ax.spines['left'].set_position('zero')
    ax.spines['bottom'].set_position('zero')
    ax.spines['right'].set_visible(False)
    ax.spines['top'].set_visible(False)
    ax.set_xlim(-5.2, 0.55)
    ax.set_ylim(-4.2, 4.2)
    ax.set_xlabel('Re(s)', loc='right', fontsize=11)
    ax.set_ylabel('Im(s)', loc='top', fontsize=11, rotation=0)

    radius = 5.0
    x_ray = np.linspace(-radius * math.cos(PHI), 0.0, 300)
    y_upper = -x_ray * math.tan(PHI)
    y_lower = x_ray * math.tan(PHI)

    ax.plot(x_ray, y_upper, color='#2563eb', linewidth=2.0, label=rf'$\zeta = {ZETA_MIN:.3f}$ 边界')
    ax.plot(x_ray, y_lower, color='#2563eb', linewidth=2.0)
    ax.axvline(x=-SIGMA_MIN, color='#ea580c', linewidth=2.1, linestyle='--', label=rf'$\sigma = {SIGMA_MIN:g}$ 边界')

    x_vals = np.linspace(-5.2, -SIGMA_MIN, 600)
    y_cap = np.minimum(-x_vals * math.tan(PHI), 4.2)
    ax.fill_between(x_vals, -y_cap, y_cap, color='#8b5cf6', alpha=0.22, label='满足双约束的可行域')
    ax.fill_betweenx([-4.2, 4.2], -5.2, -SIGMA_MIN, color='#fed7aa', alpha=0.18)

    ax.text(
        -3.52,
        3.38,
        '阻尼比下界\n$M_p \\leq 10\\%$',
        fontsize=10,
        color='#1d4ed8',
        bbox=dict(boxstyle='round,pad=0.32', facecolor='white', edgecolor='#93c5fd'),
    )
    ax.text(
        -2.08,
        3.92,
        '$\\sigma = 2$ 边界',
        fontsize=10,
        color='#c2410c',
        rotation=90,
        va='top',
        ha='right',
        bbox=dict(boxstyle='round,pad=0.20', facecolor='white', edgecolor='#fdba74'),
    )
    ax.text(
        -4.92,
        -3.58,
        '可行域 =\n超调约束 ∩ 调节时间约束',
        fontsize=10,
        color='#5b21b6',
        bbox=dict(boxstyle='round,pad=0.35', facecolor='white', edgecolor='#c4b5fd'),
    )

    points = {
        'A': {'xy': (-2.6, 1.2), 'marker': 'o', 'color': '#16a34a', 'size': 8},
        'B': {'xy': (-1.4, 2.5), 'marker': 'x', 'color': '#dc2626', 'size': 10},
        'C': {'xy': (-1.4, 0.45), 'marker': 'x', 'color': '#f97316', 'size': 10},
    }
    for label, spec in points.items():
        x, y = spec['xy']
        if spec['marker'] == 'x':
            ax.plot([x], [y], spec['marker'], color=spec['color'], markersize=spec['size'], markeredgewidth=2.3, zorder=6)
        else:
            ax.plot([x], [y], spec['marker'], color=spec['color'], markersize=spec['size'], zorder=6)
        ax.text(
            x + 0.10,
            y + 0.18,
            label,
            fontsize=10,
            fontweight='bold',
            color=spec['color'],
            bbox=dict(boxstyle='round,pad=0.18', facecolor='white', edgecolor=spec['color']),
            zorder=7,
        )

    ax.grid(True, color='#e2e8f0')
    ax.legend(loc='lower left', frameon=False, fontsize=9)
    ax.set_title('例题二：由 $M_p \\leq 10\\%$ 与 $t_s \\leq 2\\,s$ 反推极点可行域', fontsize=14, fontweight='bold', pad=12)

    summary = (
        '指标约束写成极点约束：\n'
        rf'$\zeta \geq {ZETA_MIN:.3f}$' '\n'
        rf'$\sigma = \zeta\omega_n \geq {SIGMA_MIN:g}$' '\n'
        '极点必须落在阴影区域内'
    )
    panel.text(
        0.05,
        0.95,
        summary,
        transform=panel.transAxes,
        fontsize=10.5,
        color='#0f172a',
        va='top',
        bbox=dict(boxstyle='round,pad=0.42', facecolor='white', edgecolor='#cbd5e1'),
    )
    add_panel_box(panel, 0.64, 'A  满足要求的主导极点', '同时位于阻尼比边界内侧，且实部足够靠左。', '#16a34a')
    add_panel_box(panel, 0.42, 'B  超调过大', '距离虚轴过近，振荡太强，不满足超调限制。', '#dc2626')
    add_panel_box(panel, 0.20, 'C  收敛太慢', '虽然振荡不重，但实部绝对值不足，收敛速度不够。', '#f97316')

    fig.subplots_adjust(left=0.06, right=0.98, top=0.88, bottom=0.10)
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
