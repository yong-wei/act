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

    fig, ax = plt.subplots(figsize=(8.2, 6.2), facecolor='#f8fafc')
    ax.set_facecolor('#f8fafc')
    ax.spines['left'].set_position('zero')
    ax.spines['bottom'].set_position('zero')
    ax.spines['right'].set_visible(False)
    ax.spines['top'].set_visible(False)
    ax.set_xlim(-5.2, 0.8)
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

    ax.text(-0.72, 3.25, '阻尼比下界\nMp <= 10%', fontsize=10, color='#1d4ed8')
    ax.text(-SIGMA_MIN - 0.12, 3.72, '$\mathrm{Re}(s)=-2$', fontsize=10, color='#c2410c', rotation=90, va='top')
    ax.text(-4.95, -3.55, '可行域 =\n超调约束 ∩ 调节时间约束', fontsize=10, color='#5b21b6',
            bbox=dict(boxstyle='round,pad=0.35', facecolor='white', edgecolor='#c4b5fd'))

    ax.plot([-2.6], [1.2], 'o', color='#16a34a', markersize=8, zorder=5)
    ax.annotate('满足要求的主导极点', xy=(-2.6, 1.2), xytext=(-1.7, 1.9),
                fontsize=9.5, color='#166534',
                arrowprops=dict(arrowstyle='->', color='#16a34a', lw=1.3))
    ax.plot([-1.4], [2.5], 'x', color='#dc2626', markersize=10, markeredgewidth=2.3, zorder=5)
    ax.annotate('超调过大', xy=(-1.4, 2.5), xytext=(-0.45, 2.9),
                fontsize=9.5, color='#dc2626',
                arrowprops=dict(arrowstyle='->', color='#dc2626', lw=1.3))
    ax.plot([-1.4], [0.45], 'x', color='#f97316', markersize=10, markeredgewidth=2.3, zorder=5)
    ax.annotate('收敛太慢', xy=(-1.4, 0.45), xytext=(-0.45, 0.95),
                fontsize=9.5, color='#ea580c',
                arrowprops=dict(arrowstyle='->', color='#ea580c', lw=1.3))

    ax.grid(True, color='#e2e8f0')
    ax.legend(loc='lower left', frameon=False, fontsize=9)
    ax.set_title('例题二：由 $M_p \\leq 10\\%$ 与 $t_s \\leq 2\\,s$ 反推极点可行域', fontsize=14, fontweight='bold', pad=12)

    summary = (
        rf'$\zeta \geq {ZETA_MIN:.3f}$'
        rf'    $\sigma = \zeta\omega_n \geq {SIGMA_MIN:g}$'
        r'    极点必须落在左半平面阴影区域内'
    )
    ax.text(0.02, 0.95, summary, transform=ax.transAxes, fontsize=10.5, color='#0f172a',
            bbox=dict(boxstyle='round,pad=0.35', facecolor='white', edgecolor='#cbd5e1'))

    plt.tight_layout()
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
