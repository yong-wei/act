#!/Library/Frameworks/Python.framework/Versions/3.11/bin/python3
"""
Control System Diagrams - Final Version
White background, proper connections, arc-style signal flow graphs.
"""
import warnings
warnings.filterwarnings('ignore')
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import schemdraw
import schemdraw.flow as flow
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'images'
OUT.mkdir(exist_ok=True)

# Configure matplotlib for white background
plt.rcParams['figure.facecolor'] = 'white'
plt.rcParams['axes.facecolor'] = 'white'
plt.rcParams['savefig.facecolor'] = 'white'


def draw_block_reference():
    """Replicate block_ref.png style using matplotlib directly"""
    fig, ax = plt.subplots(figsize=(14, 5))
    ax.set_xlim(-1, 13)
    ax.set_ylim(-3.5, 2.5)
    ax.set_aspect('equal')
    ax.axis('off')
    fig.patch.set_facecolor('white')

    # Input R
    ax.plot(0, 0, 'ko', markersize=6)
    ax.text(-0.3, 0, r'$R$', fontsize=14, ha='center', va='center')
    ax.annotate('', xy=(0.8, 0), xytext=(0.1, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # Summing junction 1
    circle1 = plt.Circle((1.4, 0), 0.4, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(circle1)
    ax.text(1.4, 0, r'$\Sigma$', fontsize=14, ha='center', va='center')
    ax.text(1.05, 0.55, r'$+$', fontsize=11, ha='center', va='center')
    ax.text(1.05, -0.55, r'$-$', fontsize=11, ha='center', va='center')
    ax.annotate('', xy=(2.2, 0), xytext=(1.8, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # Block G1/(1-G1G3)
    rect1 = plt.Rectangle((2.2, -0.6), 2.0, 1.2, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect1)
    ax.text(3.2, 0, r'$\frac{G_1}{1-G_1G_3}$', fontsize=12, ha='center', va='center')
    ax.annotate('', xy=(4.7, 0), xytext=(4.2, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # Block G2
    rect2 = plt.Rectangle((4.7, -0.5), 1.2, 1.0, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect2)
    ax.text(5.3, 0, r'$G_2$', fontsize=13, ha='center', va='center')
    ax.annotate('', xy=(6.4, 0), xytext=(5.9, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # Branch point
    ax.plot(6.6, 0, 'ko', markersize=5)

    # Upper path to G6/G2
    ax.plot([6.6, 6.6], [0, 1.5], 'k-', lw=1.5)
    ax.annotate('', xy=(7.2, 1.5), xytext=(6.6, 1.5),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
    rect3 = plt.Rectangle((7.2, 1.0), 1.0, 1.0, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect3)
    ax.text(7.7, 1.5, r'$\frac{G_6}{G_2}$', fontsize=11, ha='center', va='center')
    ax.annotate('', xy=(9.0, 1.5), xytext=(8.2, 1.5),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
    ax.plot([9.0, 9.0], [1.5, 0.4], 'k-', lw=1.5)

    # Lower path to G5
    ax.annotate('', xy=(7.2, 0), xytext=(6.6, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
    rect4 = plt.Rectangle((7.2, -0.5), 1.0, 1.0, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect4)
    ax.text(7.7, 0, r'$G_5$', fontsize=13, ha='center', va='center')
    ax.annotate('', xy=(9.0, 0), xytext=(8.2, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # Output summing junction
    circle2 = plt.Circle((9.6, 0), 0.4, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(circle2)
    ax.text(9.6, 0, r'$\Sigma$', fontsize=14, ha='center', va='center')
    ax.text(9.25, 0.55, r'$+$', fontsize=11, ha='center', va='center')
    ax.text(9.25, -0.55, r'$+$', fontsize=11, ha='center', va='center')
    ax.annotate('', xy=(10.4, 0), xytext=(10.0, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # Output Y
    ax.plot(10.6, 0, 'ko', markersize=6)
    ax.text(11.0, 0, r'$Y$', fontsize=14, ha='center', va='center')

    # Feedback from branch down to G4
    ax.plot([6.6, 6.6], [0, -2.2], 'k-', lw=1.5)
    ax.annotate('', xy=(6.6, -2.2), xytext=(6.6, -2.35),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
    rect5 = plt.Rectangle((5.8, -2.7), 1.0, 1.0, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect5)
    ax.text(6.3, -2.2, r'$G_4$', fontsize=13, ha='center', va='center')
    ax.plot([5.8, 1.4], [-2.2, -2.2], 'k-', lw=1.5)
    ax.plot([1.4, 1.4], [-2.2, -0.4], 'k-', lw=1.5)
    ax.annotate('', xy=(1.4, -0.4), xytext=(1.4, -0.55),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    fig.savefig(OUT / '09_block_diagram_final.png', dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print('✓ 09_block_diagram_final.png')


def draw_signal_flow_reference():
    """Replicate signal_ref.png style - arcs not straight lines"""
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.set_xlim(-1, 11)
    ax.set_ylim(-2.5, 2.5)
    ax.set_aspect('equal')
    ax.axis('off')
    fig.patch.set_facecolor('white')

    # Node positions
    nodes = {
        'Xs': (0, 0),
        'Xi': (2.5, 0),
        'Xj': (5.5, 0),
        'Xo': (8.5, 0),
    }

    # Draw nodes (circles with thick blue borders)
    for name, (x, y) in nodes.items():
        circle = plt.Circle((x, y), 0.5, fill=False, edgecolor='#2E5090', linewidth=2.5)
        ax.add_patch(circle)
        ax.text(x, y, f'${name}$', ha='center', va='center', fontsize=14, color='#2E5090')

    # Forward arrows (straight)
    ax.annotate('', xy=(2.0, 0), xytext=(0.5, 0),
                arrowprops=dict(arrowstyle='->', color='#2E5090', lw=2))
    ax.text(1.25, 0.3, r'$a_{21}$', fontsize=12, ha='center', va='bottom', color='#2E5090')

    # Dashed line Xi -> Xj
    ax.plot([3.0, 5.0], [0, 0], 'b--', alpha=0.6, lw=1.5)
    ax.text(4.0, -0.3, r'$P$', fontsize=12, ha='center', va='top', color='#2E5090')

    ax.annotate('', xy=(5.0, 0), xytext=(3.0, 0),
                arrowprops=dict(arrowstyle='->', color='#2E5090', lw=2,
                              connectionstyle='arc3,rad=0'))

    ax.annotate('', xy=(8.0, 0), xytext=(6.0, 0),
                arrowprops=dict(arrowstyle='->', color='#2E5090', lw=2))
    ax.text(7.0, 0.3, r'$a_{12}$', fontsize=12, ha='center', va='bottom', color='#2E5090')

    # Self-loop at Xi (upper arc) - using arc
    arc_xi = np.linspace(2.0, 3.0, 50)
    arc_yi = 0.4 + 0.6 * np.sin(np.pi * (arc_xi - 2.0) / 1.0)
    ax.plot(arc_xi, arc_yi, color='#2E5090', lw=2)
    ax.annotate('', xy=(2.8, 0.55), xytext=(2.7, 0.6),
                arrowprops=dict(arrowstyle='->', color='#2E5090', lw=2))
    ax.text(2.5, 1.1, r'$a_{22}$', fontsize=12, ha='center', va='bottom', color='#2E5090')

    # Large feedback arc from Xs to Xo (lower)
    arc_xs = np.linspace(0.3, 8.2, 100)
    arc_ys = -0.5 - 1.0 * np.sin(np.pi * (arc_xs - 0.3) / 7.9)
    ax.plot(arc_xs, arc_ys, color='#2E5090', lw=2)
    ax.annotate('', xy=(8.0, -0.55), xytext=(7.9, -0.6),
                arrowprops=dict(arrowstyle='->', color='#2E5090', lw=2))
    ax.text(4.25, -1.7, r'$a_{11}$', fontsize=12, ha='center', va='top', color='#2E5090')

    fig.savefig(OUT / '10_signal_flow_final.png', dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print('✓ 10_signal_flow_final.png')


def draw_cascade_control():
    """串级控制系统 - 白色背景，标准框图样式"""
    fig, ax = plt.subplots(figsize=(16, 8))
    ax.set_xlim(-1, 16)
    ax.set_ylim(-4, 3)
    ax.set_aspect('equal')
    ax.axis('off')
    fig.patch.set_facecolor('white')

    # Input R(s)
    ax.plot(0, 0, 'ko', markersize=6)
    ax.text(-0.4, 0, r'$R(s)$', fontsize=13, ha='center', va='center')
    ax.annotate('', xy=(0.8, 0), xytext=(0.1, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # Summing junction 1 (outer)
    circle1 = plt.Circle((1.4, 0), 0.35, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(circle1)
    ax.text(1.4, 0, r'$\Sigma$', fontsize=13, ha='center', va='center')
    ax.text(1.1, 0.5, r'$+$', fontsize=10, ha='center', va='center')
    ax.text(1.1, -0.5, r'$-$', fontsize=10, ha='center', va='center')

    # Feedback arrows to sum1
    ax.plot([1.4, 1.4], [0.35, 0.55], 'k-', lw=1.5)
    ax.plot([1.1, 1.7], [0.55, 0.55], 'k-', lw=1.5)
    ax.annotate('', xy=(1.25, 0.55), xytext=(1.1, 0.55),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
    ax.annotate('', xy=(1.7, 0.55), xytext=(1.55, 0.55),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    ax.annotate('', xy=(2.3, 0), xytext=(1.75, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # Position Controller
    rect1 = plt.Rectangle((2.3, -0.5), 2.0, 1.0, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect1)
    ax.text(3.3, 0, r'$C_1(s)$', fontsize=12, ha='center', va='center')

    ax.annotate('', xy=(4.8, 0), xytext=(4.3, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # Summing junction 2 (inner)
    circle2 = plt.Circle((5.2, 0), 0.35, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(circle2)
    ax.text(5.2, 0, r'$\Sigma$', fontsize=13, ha='center', va='center')
    ax.text(4.9, 0.5, r'$+$', fontsize=10, ha='center', va='center')
    ax.text(4.9, -0.5, r'$-$', fontsize=10, ha='center', va='center')

    # Feedback arrows to sum2
    ax.plot([5.2, 5.2], [0.35, 0.55], 'k-', lw=1.5)
    ax.plot([4.9, 5.5], [0.55, 0.55], 'k-', lw=1.5)
    ax.annotate('', xy=(5.05, 0.55), xytext=(4.9, 0.55),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
    ax.annotate('', xy=(5.5, 0.55), xytext=(5.35, 0.55),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    ax.annotate('', xy=(6.1, 0), xytext=(5.55, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # Velocity Controller
    rect2 = plt.Rectangle((6.1, -0.5), 2.0, 1.0, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect2)
    ax.text(7.1, 0, r'$C_2(s)$', fontsize=12, ha='center', va='center')

    ax.annotate('', xy=(8.6, 0), xytext=(8.1, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # Summing junction 3 (disturbance)
    circle3 = plt.Circle((9.0, 0), 0.35, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(circle3)
    ax.text(9.0, 0, r'$\Sigma$', fontsize=13, ha='center', va='center')
    ax.text(8.7, -0.5, r'$+$', fontsize=10, ha='center', va='center')

    # Disturbance input
    ax.plot([9.0, 9.0], [-0.35, -0.8], 'k-', lw=1.5)
    ax.plot([7.5, 9.0], [-0.8, -0.8], 'k-', lw=1.5)
    ax.annotate('', xy=(7.65, -0.8), xytext=(7.5, -0.8),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
    ax.plot(7.4, -0.8, 'ko', markersize=6)
    ax.text(7.4, -1.2, r'$D(s)$', fontsize=12, ha='center', va='center')

    ax.annotate('', xy=(9.5, 0), xytext=(9.35, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # Plant
    rect3 = plt.Rectangle((9.5, -0.6), 1.8, 1.2, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect3)
    ax.text(10.4, 0, r'$G(s)$', fontsize=12, ha='center', va='center')

    ax.annotate('', xy=(11.8, 0), xytext=(11.3, 0),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # Output
    ax.plot(11.9, 0, 'ko', markersize=6)
    ax.text(12.4, 0, r'$Y(s)$', fontsize=13, ha='center', va='center')

    # Velocity feedback H2
    ax.plot([11.2, 11.2], [0, -2.0], 'k-', lw=1.5)
    ax.annotate('', xy=(11.2, -2.0), xytext=(11.2, -2.15),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
    rect_h2 = plt.Rectangle((9.8, -2.4), 1.6, 0.8, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect_h2)
    ax.text(10.6, -2.0, r'$H_2(s)$', fontsize=11, ha='center', va='center')
    ax.plot([9.8, 6.2], [-2.0, -2.0], 'k-', lw=1.5)
    ax.plot([6.2, 6.2], [-2.0, -0.35], 'k-', lw=1.5)
    ax.annotate('', xy=(6.2, -0.35), xytext=(6.2, -0.5),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # Position feedback H1
    ax.plot([11.7, 11.7], [0, -3.2], 'k-', lw=1.5)
    rect_h1 = plt.Rectangle((6.8, -3.6), 1.6, 0.8, fill=False, edgecolor='black', linewidth=1.5)
    ax.add_patch(rect_h1)
    ax.text(7.6, -3.2, r'$H_1(s)$', fontsize=11, ha='center', va='center')
    ax.plot([6.8, 1.4], [-3.2, -3.2], 'k-', lw=1.5)
    ax.plot([1.4, 1.4], [-3.2, -0.35], 'k-', lw=1.5)
    ax.annotate('', xy=(1.4, -0.35), xytext=(1.4, -0.5),
                arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    fig.savefig(OUT / '11_cascade_control_final.png', dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print('✓ 11_cascade_control_final.png')


def draw_mason_formula():
    """Mason公式信号流图 - 全弧线连接"""
    fig, ax = plt.subplots(figsize=(14, 7))
    ax.set_xlim(-1, 12)
    ax.set_ylim(-3, 3)
    ax.set_aspect('equal')
    ax.axis('off')
    fig.patch.set_facecolor('white')

    import numpy as np

    # Node positions
    X0_pos = (0, 0)
    X1_pos = (2.5, 0)
    X2_pos = (5.0, 0)
    X3_pos = (7.5, 0)
    X4_pos = (10.0, 0)

    # Draw nodes
    for pos, label in [(X0_pos, 'X_0'), (X1_pos, 'X_1'), (X2_pos, 'X_2'),
                       (X3_pos, 'X_3'), (X4_pos, 'X_4')]:
        circle = plt.Circle(pos, 0.4, fill=False, edgecolor='#2E5090', linewidth=2)
        ax.add_patch(circle)
        ax.text(pos[0], pos[1], f'${label}$', ha='center', va='center',
                fontsize=13, color='#2E5090')

    # Forward arrows (straight)
    ax.annotate('', xy=(2.1, 0), xytext=(0.4, 0),
                arrowprops=dict(arrowstyle='->', color='#2E5090', lw=2))
    ax.text(1.25, 0.3, r'$a$', fontsize=12, ha='center', va='bottom', color='#2E5090')

    ax.annotate('', xy=(4.6, 0), xytext=(2.9, 0),
                arrowprops=dict(arrowstyle='->', color='#2E5090', lw=2))
    ax.text(3.75, 0.3, r'$b$', fontsize=12, ha='center', va='bottom', color='#2E5090')

    ax.annotate('', xy=(7.1, 0), xytext=(5.4, 0),
                arrowprops=dict(arrowstyle='->', color='#2E5090', lw=2))
    ax.text(6.25, 0.3, r'$c$', fontsize=12, ha='center', va='bottom', color='#2E5090')

    ax.annotate('', xy=(9.6, 0), xytext=(7.9, 0),
                arrowprops=dict(arrowstyle='->', color='#2E5090', lw=2))
    ax.text(8.75, 0.3, r'$d$', fontsize=12, ha='center', va='bottom', color='#2E5090')

    # Self-loop at X1 (e) - upper arc
    arc_x = np.linspace(2.1, 2.9, 50)
    arc_y = 0.4 + 0.5 * np.sin(np.pi * (arc_x - 2.1) / 0.8)
    ax.plot(arc_x, arc_y, color='#2E5090', lw=2)
    ax.annotate('', xy=(2.75, 0.55), xytext=(2.65, 0.6),
                arrowprops=dict(arrowstyle='->', color='#2E5090', lw=2))
    ax.text(2.5, 1.0, r'$e$', fontsize=12, ha='center', va='bottom', color='#2E5090')

    # Feedback f (X2 to X1) - lower arc
    arc_x = np.linspace(4.6, 2.9, 50)
    arc_y = -0.4 - 0.5 * np.sin(np.pi * (arc_x - 2.9) / 1.7)
    ax.plot(arc_x, arc_y, color='#2E5090', lw=2)
    ax.annotate('', xy=(3.05, -0.5), xytext=(3.15, -0.55),
                arrowprops=dict(arrowstyle='->', color='#2E5090', lw=2))
    ax.text(3.75, -0.9, r'$f$', fontsize=12, ha='center', va='top', color='#2E5090')

    # Feedback g (X3 to X2) - lower arc
    arc_x = np.linspace(7.1, 5.4, 50)
    arc_y = -0.4 - 0.5 * np.sin(np.pi * (arc_x - 5.4) / 1.7)
    ax.plot(arc_x, arc_y, color='#2E5090', lw=2)
    ax.annotate('', xy=(5.55, -0.5), xytext=(5.65, -0.55),
                arrowprops=dict(arrowstyle='->', color='#2E5090', lw=2))
    ax.text(6.25, -0.9, r'$g$', fontsize=12, ha='center', va='top', color='#2E5090')

    # Feedback h (X4 to X3) - lower arc
    arc_x = np.linspace(9.6, 7.9, 50)
    arc_y = -0.4 - 0.5 * np.sin(np.pi * (arc_x - 7.9) / 1.7)
    ax.plot(arc_x, arc_y, color='#2E5090', lw=2)
    ax.annotate('', xy=(8.05, -0.5), xytext=(8.15, -0.55),
                arrowprops=dict(arrowstyle='->', color='#2E5090', lw=2))
    ax.text(8.75, -0.9, r'$h$', fontsize=12, ha='center', va='top', color='#2E5090')

    # Skip path i (X0 to X2) - upper arc
    arc_x = np.linspace(0.4, 4.6, 100)
    arc_y = 0.6 + 0.8 * np.sin(np.pi * (arc_x - 0.4) / 4.2)
    ax.plot(arc_x, arc_y, color='#2E5090', lw=2)
    ax.annotate('', xy=(4.45, 0.9), xytext=(4.35, 0.95),
                arrowprops=dict(arrowstyle='->', color='#2E5090', lw=2))
    ax.text(2.5, 1.5, r'$i$', fontsize=12, ha='center', va='bottom', color='#2E5090')

    # Skip path j (X1 to X3) - upper arc
    arc_x = np.linspace(2.9, 7.1, 100)
    arc_y = 0.6 + 0.8 * np.sin(np.pi * (arc_x - 2.9) / 4.2)
    ax.plot(arc_x, arc_y, color='#2E5090', lw=2)
    ax.annotate('', xy=(6.95, 0.9), xytext=(6.85, 0.95),
                arrowprops=dict(arrowstyle='->', color='#2E5090', lw=2))
    ax.text(5.0, 1.5, r'$j$', fontsize=12, ha='center', va='bottom', color='#2E5090')

    fig.savefig(OUT / '12_mason_formula_final.png', dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print('✓ 12_mason_formula_final.png')


if __name__ == '__main__':
    print(f'Generating final schemdraw diagrams → {OUT}\n')
    draw_block_reference()
    draw_signal_flow_reference()
    draw_cascade_control()
    draw_mason_formula()
    print(f'\nDone! 4 diagrams saved.')
