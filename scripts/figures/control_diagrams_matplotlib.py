#!/Library/Frameworks/Python.framework/Versions/3.11/bin/python3
"""
Control System Diagrams using pure Matplotlib
Following reference images exactly.
"""
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Rectangle, FancyArrowPatch
from matplotlib.lines import Line2D
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'images'
OUT.mkdir(exist_ok=True)

def draw_block_reference():
    """
    绘制 block_ref.png 风格的框图
    关键元素：输入圆点、求和点(带Sigma)、传递函数框、分支点、反馈回路
    """
    fig, ax = plt.subplots(figsize=(14, 6))
    ax.set_xlim(-0.5, 13)
    ax.set_ylim(-3, 3)
    ax.set_aspect('equal')
    ax.axis('off')
    fig.patch.set_facecolor('white')

    # ========== 输入 R ==========
    # 小圆点表示输入
    circle = Circle((0, 0), 0.08, fill=True, edgecolor='black', facecolor='black', linewidth=1.5)
    ax.add_patch(circle)
    ax.text(-0.4, 0, r'$R$', fontsize=14, ha='center', va='center')

    # 输入箭头
    ax.annotate('', xy=(0.8, 0), xytext=(0.15, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # ========== 求和点 1 ==========
    # 圆圈
    circle = Circle((1.4, 0), 0.4, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(circle)
    # Sigma 符号
    ax.text(1.4, 0, r'$\Sigma$', fontsize=13, ha='center', va='center')
    # +/- 标签
    ax.text(1.05, 0.5, r'$+$', fontsize=11, ha='center', va='center')
    ax.text(1.05, -0.5, r'$-$', fontsize=11, ha='center', va='center')

    # 输出箭头
    ax.annotate('', xy=(2.2, 0), xytext=(1.8, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # ========== 块 G1/(1-G1G3) ==========
    rect = Rectangle((2.2, -0.6), 2.0, 1.2, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect)
    ax.text(3.2, 0, r'$\frac{G_1}{1-G_1G_3}$', fontsize=12, ha='center', va='center')

    # 箭头
    ax.annotate('', xy=(4.7, 0), xytext=(4.2, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # ========== 块 G2 ==========
    rect = Rectangle((4.7, -0.5), 1.2, 1.0, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect)
    ax.text(5.3, 0, r'$G_2$', fontsize=13, ha='center', va='center')

    # 箭头到分支点
    ax.annotate('', xy=(6.4, 0), xytext=(5.9, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # ========== 分支点 ==========
    branch_x, branch_y = 6.6, 0
    circle = Circle((branch_x, branch_y), 0.08, fill=True, edgecolor='black',
                    facecolor='black', linewidth=1.5)
    ax.add_patch(circle)

    # 上分支到 G6/G2
    ax.plot([branch_x, branch_x], [branch_y, 1.5], 'k-', lw=1.5)
    ax.annotate('', xy=(7.2, 1.5), xytext=(branch_x, 1.5),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # 块 G6/G2
    rect = Rectangle((7.2, 1.0), 1.0, 1.0, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect)
    ax.text(7.7, 1.5, r'$\frac{G_6}{G_2}$', fontsize=11, ha='center', va='center')

    # 从 G6/G2 到输出求和点
    ax.annotate('', xy=(9.0, 1.5), xytext=(8.2, 1.5),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
    ax.plot([9.0, 9.0], [1.5, 0.4], 'k-', lw=1.5)

    # 主通路到 G5
    ax.annotate('', xy=(7.2, 0), xytext=(branch_x, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # ========== 块 G5 ==========
    rect = Rectangle((7.2, -0.5), 1.0, 1.0, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect)
    ax.text(7.7, 0, r'$G_5$', fontsize=13, ha='center', va='center')

    # 箭头到求和点
    ax.annotate('', xy=(9.0, 0), xytext=(8.2, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # ========== 输出求和点 ==========
    circle = Circle((9.6, 0), 0.4, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(circle)
    ax.text(9.6, 0, r'$\Sigma$', fontsize=13, ha='center', va='center')
    ax.text(9.25, 0.55, r'$+$', fontsize=11, ha='center', va='center')
    ax.text(9.25, -0.55, r'$+$', fontsize=11, ha='center', va='center')

    # 输出箭头
    ax.annotate('', xy=(10.4, 0), xytext=(10.0, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # 输出 Y
    circle = Circle((10.6, 0), 0.08, fill=True, edgecolor='black', facecolor='black', linewidth=1.5)
    ax.add_patch(circle)
    ax.text(11.0, 0, r'$Y$', fontsize=14, ha='center', va='center')

    # ========== 反馈回路 G4 ==========
    # 从分支点向下
    ax.plot([branch_x, branch_x], [branch_y, -2.2], 'k-', lw=1.5)
    ax.annotate('', xy=(branch_x, -2.2), xytext=(branch_x, -2.35),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # 块 G4
    rect = Rectangle((5.8, -2.7), 1.0, 1.0, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect)
    ax.text(6.3, -2.2, r'$G_4$', fontsize=13, ha='center', va='center')

    # 反馈线回到求和点1
    ax.plot([5.8, 1.4], [-2.2, -2.2], 'k-', lw=1.5)
    ax.plot([1.4, 1.4], [-2.2, -0.4], 'k-', lw=1.5)
    ax.annotate('', xy=(1.4, -0.4), xytext=(1.4, -0.55),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    fig.savefig(OUT / 'block_diagram_ref.png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    print('✓ block_diagram_ref.png')


def draw_signal_flow_reference():
    """
    绘制 signal_ref.png 风格的信号流图
    关键元素：蓝色圆圈节点、弧线连接、自环、前向/反馈通路
    """
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.set_xlim(-1, 11)
    ax.set_ylim(-3, 3)
    ax.set_aspect('equal')
    ax.axis('off')
    fig.patch.set_facecolor('white')

    # 节点位置
    nodes = {
        'Xs': (0, 0),
        'Xi': (2.5, 0),
        'Xj': (5.5, 0),
        'Xo': (8.5, 0),
    }

    # 颜色 - 参考图中的蓝色
    color = '#2E5090'
    lw = 2.5

    # ========== 绘制节点 ==========
    for name, (x, y) in nodes.items():
        circle = Circle((x, y), 0.5, fill=False, edgecolor=color, linewidth=lw)
        ax.add_patch(circle)
        # 标签
        label = name.replace('s', '_S').replace('i', '_i').replace('j', '_j').replace('o', '_O')
        ax.text(x, y, f'${label}$', ha='center', va='center', fontsize=14, color=color)

    # ========== 前向通路 a21 ==========
    ax.annotate('', xy=(2.0, 0), xytext=(0.5, 0),
                arrowprops=dict(arrowstyle='->', color=color, lw=lw))
    ax.text(1.25, 0.3, r'$a_{21}$', fontsize=12, ha='center', va='bottom', color=color)

    # ========== 虚线 P (Xi 到 Xj) ==========
    ax.plot([3.0, 5.0], [0, 0], '--', color=color, lw=1.5, alpha=0.7)
    # 箭头
    ax.annotate('', xy=(5.0, 0), xytext=(4.85, 0),
                arrowprops=dict(arrowstyle='->', color=color, lw=lw))
    ax.text(4.0, -0.35, r'$P$', fontsize=12, ha='center', va='top', color=color)

    # ========== 前向通路 a12 ==========
    ax.annotate('', xy=(8.0, 0), xytext=(6.0, 0),
                arrowprops=dict(arrowstyle='->', color=color, lw=lw))
    ax.text(7.0, 0.3, r'$a_{12}$', fontsize=12, ha='center', va='bottom', color=color)

    # ========== 自环 a22 在 Xi ==========
    # 使用圆弧
    theta = np.linspace(0.3, np.pi - 0.3, 50)
    r = 0.7
    cx, cy = 2.5, 0
    arc_x = cx + r * np.cos(theta)
    arc_y = cy + r * np.sin(theta) + 0.1
    ax.plot(arc_x, arc_y, color=color, lw=lw)
    # 箭头
    arrow_idx = -5
    ax.annotate('', xy=(arc_x[arrow_idx], arc_y[arrow_idx]),
                xytext=(arc_x[arrow_idx-1], arc_y[arrow_idx-1]),
                arrowprops=dict(arrowstyle='->', color=color, lw=lw))
    ax.text(2.5, 0.9, r'$a_{22}$', fontsize=12, ha='center', va='bottom', color=color)

    # ========== 大反馈 a11 (Xs 到 Xo) ==========
    # 使用连接样式的大弧线，不超出边界
    from matplotlib.patches import ConnectionPatch
    # 使用二次贝塞尔曲线绘制底部弧线
    arc_x = np.linspace(0.5, 8.0, 100)
    # 抛物线形状
    arc_y = -0.8 - 1.5 * ((arc_x - 4.25) / 3.75) ** 2
    ax.plot(arc_x, arc_y, color=color, lw=lw)
    # 箭头在右侧
    ax.annotate('', xy=(7.9, arc_y[-2]), xytext=(7.7, arc_y[-5]),
                arrowprops=dict(arrowstyle='->', color=color, lw=lw))
    ax.text(4.25, -2.0, r'$a_{11}$', fontsize=12, ha='center', va='top', color=color)

    fig.savefig(OUT / 'signal_flow_ref.png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    print('✓ signal_flow_ref.png')


def draw_cascade_control():
    """串级 PID 控制系统框图"""
    fig, ax = plt.subplots(figsize=(16, 8))
    ax.set_xlim(-0.5, 16)
    ax.set_ylim(-4, 3)
    ax.set_aspect('equal')
    ax.axis('off')
    fig.patch.set_facecolor('white')

    # 输入 R(s)
    ax.plot(0, 0, 'ko', markersize=6)
    ax.text(-0.4, 0, r'$R(s)$', fontsize=13, ha='center', va='center')
    ax.annotate('', xy=(0.8, 0), xytext=(0.1, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # ========== 求和点 1 (外环) ==========
    circle = Circle((1.4, 0), 0.4, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(circle)
    ax.text(1.4, 0, r'$\Sigma$', fontsize=13, ha='center', va='center')
    ax.text(1.05, 0.5, r'$+$', fontsize=10, ha='center', va='center')
    ax.text(1.05, -0.5, r'$-$', fontsize=10, ha='center', va='center')

    # 输入反馈箭头
    ax.plot([1.4, 1.4], [0.4, 0.6], 'k-', lw=1.5)
    ax.plot([1.1, 1.7], [0.6, 0.6], 'k-', lw=1.5)
    ax.annotate('', xy=(1.25, 0.6), xytext=(1.1, 0.6),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
    ax.annotate('', xy=(1.7, 0.6), xytext=(1.55, 0.6),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    ax.annotate('', xy=(2.3, 0), xytext=(1.8, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # ========== 位置控制器 C1 ==========
    rect = Rectangle((2.3, -0.5), 2.0, 1.0, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect)
    ax.text(3.3, 0, r'$C_1(s)$', fontsize=12, ha='center', va='center')

    ax.annotate('', xy=(4.8, 0), xytext=(4.3, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # ========== 求和点 2 (内环) ==========
    circle = Circle((5.2, 0), 0.4, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(circle)
    ax.text(5.2, 0, r'$\Sigma$', fontsize=13, ha='center', va='center')
    ax.text(4.85, 0.5, r'$+$', fontsize=10, ha='center', va='center')
    ax.text(4.85, -0.5, r'$-$', fontsize=10, ha='center', va='center')

    ax.plot([5.2, 5.2], [0.4, 0.6], 'k-', lw=1.5)
    ax.plot([4.9, 5.5], [0.6, 0.6], 'k-', lw=1.5)
    ax.annotate('', xy=(5.05, 0.6), xytext=(4.9, 0.6),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
    ax.annotate('', xy=(5.5, 0.6), xytext=(5.35, 0.6),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    ax.annotate('', xy=(6.1, 0), xytext=(5.55, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # ========== 速度控制器 C2 ==========
    rect = Rectangle((6.1, -0.5), 2.0, 1.0, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect)
    ax.text(7.1, 0, r'$C_2(s)$', fontsize=12, ha='center', va='center')

    ax.annotate('', xy=(8.6, 0), xytext=(8.1, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # ========== 求和点 3 (扰动) ==========
    circle = Circle((9.0, 0), 0.4, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(circle)
    ax.text(9.0, 0, r'$\Sigma$', fontsize=13, ha='center', va='center')
    ax.text(8.65, -0.5, r'$+$', fontsize=10, ha='center', va='center')

    # 扰动 D(s) 输入
    ax.plot([9.0, 9.0], [-0.4, -0.9], 'k-', lw=1.5)
    ax.plot([7.5, 9.0], [-0.9, -0.9], 'k-', lw=1.5)
    ax.annotate('', xy=(7.65, -0.9), xytext=(7.5, -0.9),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
    ax.plot(7.4, -0.9, 'ko', markersize=5)
    ax.text(7.4, -1.3, r'$D(s)$', fontsize=12, ha='center', va='center')

    ax.annotate('', xy=(9.5, 0), xytext=(9.35, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # ========== 被控对象 G ==========
    rect = Rectangle((9.5, -0.6), 1.8, 1.2, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect)
    ax.text(10.4, 0, r'$G(s)$', fontsize=12, ha='center', va='center')

    ax.annotate('', xy=(11.8, 0), xytext=(11.3, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # ========== 输出 Y(s) ==========
    ax.plot(11.9, 0, 'ko', markersize=6)
    ax.text(12.4, 0, r'$Y(s)$', fontsize=13, ha='center', va='center')

    # ========== 速度反馈 H2 ==========
    ax.plot([11.2, 11.2], [0, -2.0], 'k-', lw=1.5)
    ax.annotate('', xy=(11.2, -2.0), xytext=(11.2, -2.15),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
    rect = Rectangle((9.8, -2.4), 1.6, 0.8, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect)
    ax.text(10.6, -2.0, r'$H_2(s)$', fontsize=11, ha='center', va='center')
    ax.plot([9.8, 6.2], [-2.0, -2.0], 'k-', lw=1.5)
    ax.plot([6.2, 6.2], [-2.0, -0.4], 'k-', lw=1.5)
    ax.annotate('', xy=(6.2, -0.4), xytext=(6.2, -0.55),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # ========== 位置反馈 H1 ==========
    ax.plot([11.7, 11.7], [0, -3.2], 'k-', lw=1.5)
    rect = Rectangle((6.8, -3.6), 1.6, 0.8, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect)
    ax.text(7.6, -3.2, r'$H_1(s)$', fontsize=11, ha='center', va='center')
    ax.plot([6.8, 1.4], [-3.2, -3.2], 'k-', lw=1.5)
    ax.plot([1.4, 1.4], [-3.2, -0.4], 'k-', lw=1.5)
    ax.annotate('', xy=(1.4, -0.4), xytext=(1.4, -0.55),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    fig.savefig(OUT / 'cascade_control.png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    print('✓ cascade_control.png')


def draw_mason_formula():
    """Mason增益公式示例信号流图"""
    fig, ax = plt.subplots(figsize=(14, 7))
    ax.set_xlim(-1, 12)
    ax.set_ylim(-3, 3)
    ax.set_aspect('equal')
    ax.axis('off')
    fig.patch.set_facecolor('white')

    color = '#2E5090'
    lw = 2.5

    # 节点位置
    X0_pos = (0, 0)
    X1_pos = (2.5, 0)
    X2_pos = (5.0, 0)
    X3_pos = (7.5, 0)
    X4_pos = (10.0, 0)

    # 绘制节点
    for pos, label in [(X0_pos, 'X_0'), (X1_pos, 'X_1'), (X2_pos, 'X_2'),
                       (X3_pos, 'X_3'), (X4_pos, 'X_4')]:
        circle = Circle(pos, 0.4, fill=False, edgecolor=color, linewidth=lw)
        ax.add_patch(circle)
        ax.text(pos[0], pos[1], f'${label}$', ha='center', va='center',
                fontsize=13, color=color)

    # 前向通路 a, b, c, d (直线)
    for (start, end, label, y_offset) in [
        (X0_pos, X1_pos, 'a', 0.3),
        (X1_pos, X2_pos, 'b', 0.3),
        (X2_pos, X3_pos, 'c', 0.3),
        (X3_pos, X4_pos, 'd', 0.3)
    ]:
        ax.annotate('', xy=(end[0] - 0.45, end[1]), xytext=(start[0] + 0.45, start[1]),
                    arrowprops=dict(arrowstyle='->', color=color, lw=lw))
        mid_x = (start[0] + end[0]) / 2
        ax.text(mid_x, y_offset, f'${label}$', fontsize=12, ha='center', va='bottom', color=color)

    # 自环 e 在 X1 (上圆弧)
    theta = np.linspace(0.3, np.pi - 0.3, 50)
    r = 0.55
    cx, cy = X1_pos[0], X1_pos[1]
    arc_x = cx + r * np.cos(theta)
    arc_y = cy + r * np.sin(theta) + 0.05
    ax.plot(arc_x, arc_y, color=color, lw=lw)
    ax.annotate('', xy=(arc_x[-3], arc_y[-3]), xytext=(arc_x[-4], arc_y[-4]),
                arrowprops=dict(arrowstyle='->', color=color, lw=lw))
    ax.text(X1_pos[0], 0.75, r'$e$', fontsize=12, ha='center', va='bottom', color=color)

    # 反馈 f (X2 到 X1) - 下圆弧
    theta = np.linspace(np.pi + 0.3, 2*np.pi - 0.3, 50)
    r = 0.6
    cx, cy = (X1_pos[0] + X2_pos[0]) / 2, -0.4
    arc_x = cx + r * np.cos(theta)
    arc_y = cy + r * np.sin(theta)
    ax.plot(arc_x, arc_y, color=color, lw=lw)
    ax.annotate('', xy=(arc_x[-3], arc_y[-3]), xytext=(arc_x[-4], arc_y[-4]),
                arrowprops=dict(arrowstyle='->', color=color, lw=lw))
    ax.text((X1_pos[0] + X2_pos[0]) / 2, -1.0, r'$f$', fontsize=12, ha='center', va='top', color=color)

    # 反馈 g (X3 到 X2) - 下圆弧
    theta = np.linspace(np.pi + 0.3, 2*np.pi - 0.3, 50)
    r = 0.6
    cx, cy = (X2_pos[0] + X3_pos[0]) / 2, -0.4
    arc_x = cx + r * np.cos(theta)
    arc_y = cy + r * np.sin(theta)
    ax.plot(arc_x, arc_y, color=color, lw=lw)
    ax.annotate('', xy=(arc_x[-3], arc_y[-3]), xytext=(arc_x[-4], arc_y[-4]),
                arrowprops=dict(arrowstyle='->', color=color, lw=lw))
    ax.text((X2_pos[0] + X3_pos[0]) / 2, -1.0, r'$g$', fontsize=12, ha='center', va='top', color=color)

    # 反馈 h (X4 到 X3) - 下圆弧
    theta = np.linspace(np.pi + 0.3, 2*np.pi - 0.3, 50)
    r = 0.6
    cx, cy = (X3_pos[0] + X4_pos[0]) / 2, -0.4
    arc_x = cx + r * np.cos(theta)
    arc_y = cy + r * np.sin(theta)
    ax.plot(arc_x, arc_y, color=color, lw=lw)
    ax.annotate('', xy=(arc_x[-3], arc_y[-3]), xytext=(arc_x[-4], arc_y[-4]),
                arrowprops=dict(arrowstyle='->', color=color, lw=lw))
    ax.text((X3_pos[0] + X4_pos[0]) / 2, -1.0, r'$h$', fontsize=12, ha='center', va='top', color=color)

    # 跨接 i (X0 到 X2) - 上圆弧
    theta = np.linspace(0.15, np.pi - 0.15, 80)
    r = 2.5
    cx, cy = (X0_pos[0] + X2_pos[0]) / 2, -0.2
    arc_x = cx + r * np.cos(theta)
    arc_y = cy + r * np.sin(theta)
    ax.plot(arc_x, arc_y, color=color, lw=lw)
    ax.annotate('', xy=(arc_x[-3], arc_y[-3]), xytext=(arc_x[-4], arc_y[-4]),
                arrowprops=dict(arrowstyle='->', color=color, lw=lw))
    ax.text((X0_pos[0] + X2_pos[0]) / 2, 2.2, r'$i$', fontsize=12, ha='center', va='bottom', color=color)

    # 跨接 j (X1 到 X3) - 上圆弧
    theta = np.linspace(0.15, np.pi - 0.15, 80)
    r = 2.5
    cx, cy = (X1_pos[0] + X3_pos[0]) / 2, -0.2
    arc_x = cx + r * np.cos(theta)
    arc_y = cy + r * np.sin(theta)
    ax.plot(arc_x, arc_y, color=color, lw=lw)
    ax.annotate('', xy=(arc_x[-3], arc_y[-3]), xytext=(arc_x[-4], arc_y[-4]),
                arrowprops=dict(arrowstyle='->', color=color, lw=lw))
    ax.text((X1_pos[0] + X3_pos[0]) / 2, 2.2, r'$j$', fontsize=12, ha='center', va='bottom', color=color)

    fig.savefig(OUT / 'mason_formula.png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    print('✓ mason_formula.png')


if __name__ == '__main__':
    print(f'Generating matplotlib control diagrams → {OUT}\n')
    draw_block_reference()
    draw_signal_flow_reference()
    draw_cascade_control()
    draw_mason_formula()
    print(f'\nDone! 4 diagrams saved.')
