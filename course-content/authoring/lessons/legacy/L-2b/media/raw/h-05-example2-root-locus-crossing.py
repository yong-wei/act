import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args():
    parser = argparse.ArgumentParser(description='Generate h-05 root locus crossing SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path('h-05-example2-root-locus-crossing.svg'),
        help='Output SVG path.',
    )
    return parser.parse_args()


def main():
    args = parse_args()
    configure_matplotlib_for_cjk()

    fig, ax = plt.subplots(figsize=(7, 7))
    ax.set_facecolor('#0f172a')
    fig.patch.set_facecolor('#0f172a')

    cyan = '#22d3ee'
    white = '#f1f5f9'

    K_vals = np.linspace(0.01, 80, 5000)
    all_roots = []
    for K in K_vals:
        r = np.roots([1, 4, 3, K])
        all_roots.append(sorted(r, key=lambda x: x.imag))

    all_roots = np.array(all_roots)
    for i in range(3):
        branch = all_roots[:, i]
        stable_mask = branch.real <= 0
        unstable_mask = branch.real > 0
        ax.plot(branch[stable_mask].real, branch[stable_mask].imag, color=cyan, linewidth=2.2)
        if unstable_mask.any():
            ax.plot(branch[unstable_mask].real, branch[unstable_mask].imag, color='#f87171', linewidth=2, linestyle='--')

    ax.axvspan(0, 5, alpha=0.08, color='#ef4444')
    ax.text(1.5, 3.5, '不稳定\n区域', color='#f87171', fontsize=9, ha='center')

    ax.axvline(0, color='#f87171', linewidth=1.5, linestyle='--', alpha=0.7)
    ax.axhline(0, color=white, linewidth=0.5, alpha=0.3)

    cross_omega = np.sqrt(3)
    ax.plot(0, cross_omega, 'o', color='#ef4444', markersize=12, zorder=6)
    ax.plot(0, -cross_omega, 'o', color='#ef4444', markersize=12, zorder=6)
    ax.annotate(
        f'Kc=12，临界稳定\ns = ±j√3 ≈ ±j1.73',
        xy=(0, cross_omega),
        xytext=(-3.5, 2.8),
        color='#f87171',
        fontsize=9,
        arrowprops=dict(arrowstyle='->', color='#f87171', lw=1.5),
    )

    for p, label in [(0, 'p=0'), (-1, 'p=-1'), (-3, 'p=-3')]:
        ax.plot(p, 0, 'x', color=white, markersize=11, markeredgewidth=2.5)
        ax.annotate(label, xy=(p, 0), xytext=(p - 0.1, -0.4), color=white, fontsize=8.5, ha='center')

    ax.set_xlim(-5, 5)
    ax.set_ylim(-4.5, 4.5)
    ax.set_xlabel('实部 σ', color='#94a3b8', fontsize=11)
    ax.set_ylabel('虚部 jω', color='#94a3b8', fontsize=11)
    ax.tick_params(colors='#64748b')
    for spine in ax.spines.values():
        spine.set_edgecolor('#334155')
    ax.set_title('例题2：三阶系统根轨迹\n$G(s)=K/[s(s+1)(s+3)]$，临界增益 $K_c=12$', color=white, fontsize=10, pad=10)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout()
    plt.savefig(args.output, format='svg', dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
    plt.close(fig)


if __name__ == '__main__':
    main()
