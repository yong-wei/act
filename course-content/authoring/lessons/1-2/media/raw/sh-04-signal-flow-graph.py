import argparse
from pathlib import Path

import matplotlib.patches as patches
import matplotlib.pyplot as plt

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate sh-04 signal flow graph SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / 'sh-04-signal-flow-graph.svg',
    )
    return parser.parse_args()


def connect(ax, start, end, label, rad=0.0, color='#334155'):
    arrow = patches.FancyArrowPatch(start, end, arrowstyle='->', mutation_scale=12,
                                    connectionstyle=f'arc3,rad={rad}', linewidth=1.7, color=color)
    ax.add_patch(arrow)
    mx = (start[0] + end[0]) / 2
    my = (start[1] + end[1]) / 2 + (0.35 if rad >= 0 else -0.35)
    ax.text(mx, my, label, fontsize=10, ha='center', va='center', color=color)


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()

    fig, ax = plt.subplots(figsize=(9, 4.8))
    ax.set_xlim(-0.5, 8.5)
    ax.set_ylim(-1.7, 1.9)
    ax.axis('off')

    nodes = {
        'x1': (0.4, 0.0),
        'x2': (2.0, 0.8),
        'x3': (4.0, 0.8),
        'x4': (6.0, 0.8),
        'x5': (7.8, 0.0),
    }

    for name, (x, y) in nodes.items():
        circle = patches.Circle((x, y), 0.28, facecolor='#e0f2fe', edgecolor='#0284c7', linewidth=1.8)
        ax.add_patch(circle)
        ax.text(x, y, name, ha='center', va='center', fontsize=11, fontweight='bold')

    connect(ax, nodes['x1'], nodes['x2'], 'a')
    connect(ax, nodes['x2'], nodes['x3'], 'b')
    connect(ax, nodes['x3'], nodes['x4'], 'c')
    connect(ax, nodes['x4'], nodes['x5'], 'd')
    connect(ax, nodes['x2'], nodes['x4'], 'e', rad=-0.1, color='#7c3aed')
    connect(ax, nodes['x3'], nodes['x2'], 'f', rad=0.45, color='#dc2626')
    connect(ax, nodes['x4'], nodes['x3'], 'g', rad=0.45, color='#dc2626')
    connect(ax, nodes['x5'], nodes['x2'], 'h', rad=-0.32, color='#ea580c')

    ax.text(4.0, 1.45, '示例信号流图：两条前向通路 + 多个反馈回路', ha='center', va='center', fontsize=13, fontweight='bold')
    ax.text(1.0, -1.1, '前向通路 P1: x1 → x2 → x3 → x4 → x5', fontsize=10, color='#334155')
    ax.text(1.0, -1.35, '前向通路 P2: x1 → x2 → x4 → x5', fontsize=10, color='#334155')
    ax.text(5.8, -1.1, '红色：局部回路', fontsize=10, color='#dc2626')
    ax.text(5.8, -1.35, '橙色：跨层回路', fontsize=10, color='#ea580c')

    plt.tight_layout()
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
