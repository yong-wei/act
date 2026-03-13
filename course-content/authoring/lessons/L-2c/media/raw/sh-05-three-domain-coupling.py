#!/usr/bin/env python3
"""
sh-05-three-domain-coupling.py
生成：三域直觉联动全景图
  - 三角形三顶点：极点位置（s平面）/ 时域响应（超调量Mp）/ 频域特性（相位裕度γ）
  - 连接线上标注跨域公式：ζ→Mp, ζ→γ≈100ζ°, γ→Mp
  - 中心标注"ζ 是三域桥梁"
引用：handout §2.5 / interactive-page step-14
"""
import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyArrowPatch
import numpy as np

from matplotlib_font import configure_matplotlib_for_cjk


def parse_args():
    parser = argparse.ArgumentParser(description='Generate sh-05 three-domain coupling SVG.')
    parser.add_argument('--output', type=Path,
                        default=Path('sh-05-three-domain-coupling.svg'))
    return parser.parse_args()


def main():
    args = parse_args()
    configure_matplotlib_for_cjk()

    fig, ax = plt.subplots(figsize=(9, 7))
    bg = '#0f172a'
    ax.set_facecolor(bg)
    fig.patch.set_facecolor(bg)
    ax.set_xlim(-0.1, 1.1)
    ax.set_ylim(-0.15, 1.1)
    ax.axis('off')

    # ── 三角形顶点坐标 ──
    # 顶部：极点位置（s平面/阻尼比）
    top = (0.5, 0.92)
    # 左下：时域响应（超调量）
    left = (0.05, 0.10)
    # 右下：频域特性（相位裕度）
    right = (0.95, 0.10)

    # ── 顶点背景框 ──
    node_configs = [
        (top,   '#1e3a5f', '#67e8f9', '极点位置\n（s 平面）',   '$\\sigma = -\\zeta\\omega_n$\n$\\omega_d = \\omega_n\\sqrt{1-\\zeta^2}$'),
        (left,  '#1a2e1a', '#86efac', '时域响应\n（超调量 $M_p$）', '$M_p = e^{-\\pi\\zeta/\\sqrt{1-\\zeta^2}} \\times 100\\%$'),
        (right, '#2d1f3e', '#a78bfa', '频域特性\n（相位裕度 $\\gamma$）', '$\\gamma \\approx 100\\zeta°$'),
    ]

    box_w, box_h = 0.26, 0.14

    for (cx, cy), fc, tc, title, formula in node_configs:
        fancy = mpatches.FancyBboxPatch(
            (cx - box_w / 2, cy - box_h / 2), box_w, box_h,
            boxstyle='round,pad=0.015',
            facecolor=fc, edgecolor=tc, linewidth=1.8,
            zorder=4
        )
        ax.add_patch(fancy)
        ax.text(cx, cy + 0.025, title, color=tc, fontsize=9.5,
                ha='center', va='center', fontweight='bold', zorder=5)
        ax.text(cx, cy - 0.030, formula, color='#cbd5e1', fontsize=7.8,
                ha='center', va='center', zorder=5)

    # ── 三条双向箭头连线 ──
    # 连线端点需避开节点框
    def edge_point(src, dst, offset=0.08):
        """从 src 向 dst 方向移动 offset，返回箭头起终点"""
        sx, sy = src
        dx, dy = dst
        dist = np.sqrt((dx - sx)**2 + (dy - sy)**2)
        ux, uy = (dx - sx) / dist, (dy - sy) / dist
        return (sx + ux * offset, sy + uy * offset), (dx - ux * offset, dy - uy * offset)

    edges = [
        (top, left,  '#f59e0b', '① $\\zeta \\to M_p$\n$\\zeta\\uparrow \\Rightarrow M_p\\downarrow$', 0.42, 0.56),
        (top, right, '#22d3ee', '② $\\zeta \\to \\gamma$\n$\\gamma \\approx 100\\zeta°$',             0.58, 0.56),
        (left, right,'#f472b6', '③ $\\gamma \\leftrightarrow M_p$\n$\\gamma\\uparrow \\Rightarrow M_p\\downarrow$', 0.50, 0.02),
    ]

    for src, dst, color, label, lx, ly in edges:
        p1, p2 = edge_point(src, dst, offset=0.09)
        arrow = FancyArrowPatch(
            p1, p2,
            arrowstyle='<->', color=color, linewidth=1.8,
            connectionstyle='arc3,rad=0.0',
            zorder=3
        )
        ax.add_patch(arrow)
        ax.text(lx, ly, label, color=color, fontsize=8.5,
                ha='center', va='center', zorder=5,
                bbox=dict(facecolor=bg, edgecolor='none', pad=2))

    # ── 中心标注 ──
    center_x, center_y = 0.5, 0.44
    ax.text(center_x, center_y + 0.06, '阻尼比  $\\zeta$  是三域桥梁',
            color='#fde047', fontsize=11, ha='center', va='center',
            fontweight='bold', zorder=5)
    ax.text(center_x, center_y - 0.02,
            '极点位置  ↔  时域响应  ↔  频域特性',
            color='#94a3b8', fontsize=8.5, ha='center', va='center', zorder=5)

    # 中心小圆
    circle = plt.Circle((center_x, center_y - 0.065), 0.038,
                         facecolor='#1e293b', edgecolor='#fde047',
                         linewidth=1.5, zorder=4)
    ax.add_patch(circle)
    ax.text(center_x, center_y - 0.065, '$\\zeta$',
            color='#fde047', fontsize=13, ha='center', va='center',
            fontweight='bold', zorder=5)

    # ── 工程典型值 ──
    ref_data = [
        (0.3, '$\\zeta=0.3$', '$M_p=37\\%$', '$\\gamma=30°$', '#fca5a5'),
        (0.45, '$\\zeta=0.45$', '$M_p=20\\%$', '$\\gamma=45°$', '#f59e0b'),
        (0.6, '$\\zeta=0.6$', '$M_p=9\\%$',  '$\\gamma=60°$', '#86efac'),
    ]
    table_x = 0.50
    table_y_start = 0.83
    ax.text(table_x, table_y_start + 0.035,
            '工程典型对照',
            color='#94a3b8', fontsize=8, ha='center', va='center')

    col_xs = [0.35, 0.46, 0.57, 0.68]
    headers = ['$\\zeta$', '$M_p$', '$\\gamma$', '']
    for cx_, h in zip(col_xs, headers):
        ax.text(cx_, table_y_start, h, color='#64748b', fontsize=7.5,
                ha='center', va='center')

    for i, (z, lz, lm, lg, col) in enumerate(ref_data):
        ry = table_y_start - (i + 1) * 0.042
        ax.text(col_xs[0], ry, lz, color=col, fontsize=7.5, ha='center', va='center')
        ax.text(col_xs[1], ry, lm, color=col, fontsize=7.5, ha='center', va='center')
        ax.text(col_xs[2], ry, lg, color=col, fontsize=7.5, ha='center', va='center')

    # ── 标题 ──
    fig.suptitle('三域直觉联动：极点 · 时域 · 频域',
                 color='white', fontsize=13, y=0.995, fontweight='bold')

    plt.tight_layout(rect=[0, 0, 1, 0.98])
    plt.savefig(args.output, format='svg', bbox_inches='tight', dpi=150)
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
