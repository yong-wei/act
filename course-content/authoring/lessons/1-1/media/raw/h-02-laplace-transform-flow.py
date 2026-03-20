#!/usr/bin/env python3
import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as patches

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args():
    parser = argparse.ArgumentParser(description='Generate Laplace transform flow SVG.')
    parser.add_argument('--output', type=Path, default=Path('h-02-laplace-transform-flow.svg'))
    return parser.parse_args()


def main():
    args = parse_args()
    configure_matplotlib_for_cjk()

    fig, ax = plt.subplots(figsize=(7.2, 5.4))
    fig.patch.set_facecolor('#f8fafc')

    boxes = {
        'tl': (0.6, 3.5, '时域微分方程\n$J\\ddot{\\theta}+B\\dot{\\theta}=Ku$'),
        'tr': (4.7, 3.5, '$s$域代数方程\n$(Js^2+Bs)\\Theta(s)=KU(s)$'),
        'br': (4.7, 0.7, '$s$域求解\n$\\Theta(s)/U(s)=G(s)$'),
        'bl': (0.6, 0.7, '时域响应\n$\\theta(t)=\\mathcal{L}^{-1}[\\Theta(s)]$'),
    }

    for x, y, text in boxes.values():
      ax.add_patch(
          patches.FancyBboxPatch(
              (x, y),
              2.7,
              1.0,
              boxstyle='round,pad=0.08',
              facecolor='#e0f2fe',
              edgecolor='#0284c7',
              linewidth=2,
          )
      )
      ax.text(x + 1.35, y + 0.5, text, ha='center', va='center', fontsize=11, color='#0f172a')

    ax.annotate('', xy=(4.6, 4.0), xytext=(3.4, 4.0), arrowprops=dict(arrowstyle='->', lw=2.4, color='#16a34a'))
    ax.text(4.0, 4.3, '拉氏变换', fontsize=10, color='#16a34a', ha='center', fontweight='bold')

    ax.annotate('', xy=(6.0, 1.8), xytext=(6.0, 3.45), arrowprops=dict(arrowstyle='->', lw=2.4, color='#2563eb'))
    ax.text(6.35, 2.65, '代数求解', fontsize=10, color='#2563eb', rotation=90, va='center', fontweight='bold')

    ax.annotate('', xy=(3.4, 1.2), xytext=(4.6, 1.2), arrowprops=dict(arrowstyle='->', lw=2.4, color='#f59e0b'))
    ax.text(4.0, 0.82, '拉氏反变换', fontsize=10, color='#f59e0b', ha='center', fontweight='bold')

    ax.annotate('', xy=(1.95, 1.85), xytext=(1.95, 3.45), arrowprops=dict(arrowstyle='->', lw=1.4, color='#94a3b8', linestyle='dashed'))
    ax.text(1.25, 2.65, '直接求解\n（繁琐）', fontsize=10, color='#64748b', rotation=90, va='center')

    ax.set_xlim(0, 7.6)
    ax.set_ylim(0, 5.0)
    ax.axis('off')
    plt.tight_layout()
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
