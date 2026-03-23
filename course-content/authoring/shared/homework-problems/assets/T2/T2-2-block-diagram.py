"""
T2-2 控制系统结构图
双环反馈系统：内环反馈 H1 + 外环反馈 H2
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np

# 使用默认字体（英文标注避免字体问题）
plt.rcParams['axes.unicode_minus'] = False

fig, ax = plt.subplots(1, 1, figsize=(14, 6))
ax.set_xlim(0, 14)
ax.set_ylim(0, 6)
ax.axis('off')

# 定义颜色
color_block = '#E8F4F8'
color_sum = '#FFE4E1'
color_arrow = '#333333'

def draw_sum_circle(ax, x, y, label='', sign_top='-', sign_right='', sign_left=''):
    """绘制求和点（圆圈内带符号）"""
    circle = plt.Circle((x, y), 0.25, fill=True, facecolor=color_sum,
                        edgecolor='black', linewidth=1.5)
    ax.add_patch(circle)
    ax.text(x, y, '⊕', ha='center', va='center', fontsize=12, fontweight='bold')
    if sign_top:
        ax.text(x, y + 0.35, sign_top, ha='center', va='bottom', fontsize=10, color='red')
    if sign_right:
        ax.text(x + 0.35, y, sign_right, ha='left', va='center', fontsize=10)
    if sign_left:
        ax.text(x - 0.35, y, sign_left, ha='right', va='center', fontsize=10)
    return circle

def draw_block(ax, x, y, width, height, text, fontsize=10):
    """绘制传递函数方块"""
    box = FancyBboxPatch((x - width/2, y - height/2), width, height,
                         boxstyle="square,pad=0.02",
                         facecolor=color_block, edgecolor='black', linewidth=1.5)
    ax.add_patch(box)
    ax.text(x, y, text, ha='center', va='center', fontsize=fontsize)
    return box

def draw_arrow(ax, x1, y1, x2, y2, label=''):
    """绘制带箭头的线段"""
    arrow = FancyArrowPatch((x1, y1), (x2, y2),
                           arrowstyle='->', mutation_scale=15,
                           linewidth=1.5, color=color_arrow)
    ax.add_patch(arrow)
    if label:
        mid_x = (x1 + x2) / 2
        mid_y = (y1 + y2) / 2
        ax.text(mid_x, mid_y + 0.2, label, ha='center', va='bottom', fontsize=9)

def draw_line(ax, x1, y1, x2, y2):
    """绘制普通线段"""
    ax.plot([x1, x2], [y1, y2], 'k-', linewidth=1.5)

# ========== 主前向通路 ==========
# 输入 R(s)
ax.text(0.3, 3, r'$R(s)$', fontsize=11, ha='left', va='center')

# 第一个求和点（外环）
draw_sum_circle(ax, 2, 3, sign_top='-')

# G1 方块
draw_block(ax, 4, 3, 1.5, 0.8, r'$G_1(s)=\frac{2}{s+1}$', fontsize=9)
draw_arrow(ax, 2.25, 3, 3.25, 3)

# 第二个求和点（内环）
draw_sum_circle(ax, 5.5, 3, sign_top='-')
draw_arrow(ax, 4.75, 3, 5.25, 3)

# G2 方块
draw_block(ax, 7.5, 3, 1.5, 0.8, r'$G_2(s)=\frac{3}{s+2}$', fontsize=9)
draw_arrow(ax, 5.75, 3, 6.75, 3)

# 输出 C(s)
draw_arrow(ax, 8.25, 3, 9.5, 3)
ax.text(9.7, 3, r'$C(s)$', fontsize=11, ha='left', va='center')

# ========== 内环反馈 H1 ==========
# 从 G2 输出引出
branch_x, branch_y = 8, 3
draw_line(ax, branch_x, branch_y, branch_x, 1.5)

# H1 方块
draw_block(ax, 8, 1.5, 1.2, 0.7, r'$H_1(s)=0.5$', fontsize=9)

# 反馈线到内环求和点
draw_line(ax, 7.4, 1.5, 5.5, 1.5)
draw_line(ax, 5.5, 1.5, 5.5, 2.75)
# 内环负号标记
ax.text(5.65, 2.4, r'$-$', fontsize=11, color='red', fontweight='bold')

# ========== 外环反馈 H2 ==========
# 从 G2 输出（分支点）
draw_line(ax, 8.5, 3, 8.5, 4.5)

# H2 方块
draw_block(ax, 8.5, 4.5, 1.2, 0.7, r'$H_2(s)=1$', fontsize=9)

# 反馈线到外环求和点
draw_line(ax, 7.9, 4.5, 2, 4.5)
draw_line(ax, 2, 4.5, 2, 3.25)
# 外环负号标记
ax.text(2.15, 3.55, r'$-$', fontsize=11, color='red', fontweight='bold')

# ========== 结构说明标注 ==========
ax.text(7, 0.5, 'Inner Loop', fontsize=9, ha='center', va='center',
        style='italic', color='#666666')
ax.text(5, 5.3, 'Outer Loop', fontsize=9, ha='center', va='center',
        style='italic', color='#666666')

# 标题
ax.text(7, 5.7, 'T2-2 Dual-Loop Control System', fontsize=13, ha='center',
        va='center', fontweight='bold')

plt.tight_layout()
plt.savefig('/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/shared/homework-problems/assets/T2/T2-2-block-diagram.svg',
            format='svg', bbox_inches='tight', dpi=150)
plt.savefig('/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/shared/homework-problems/assets/T2/T2-2-block-diagram.png',
            format='png', bbox_inches='tight', dpi=150)
plt.close()

print("T2-2 结构图已生成")
