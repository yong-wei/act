#!/Library/Frameworks/Python.framework/Versions/3.11/bin/python3
"""
Control System Diagrams using Schemdraw - v2
Following reference image styles exactly.
"""
import warnings
warnings.filterwarnings('ignore')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import schemdraw
import schemdraw.flow as flow
from schemdraw.util import Point
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'images'
OUT.mkdir(exist_ok=True)

# Style configuration
schemdraw.theme('default')


def draw_block_diagram():
    """
    Block diagram style like block_ref.png:
    - White background
    - Summing junctions with Σ and +/- labels outside
    - Clean connections at circle edges
    - Branch points as small dots
    - Proper signal flow lines
    """
    fig, ax = plt.subplots(figsize=(14, 6))
    ax.set_xlim(-1, 14)
    ax.set_ylim(-3, 3)
    ax.set_aspect('equal')
    ax.axis('off')
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')

    with schemdraw.Drawing(ax=ax) as d:
        d.config(unit=1.0, fontsize=12, lw=1.2)

        # Input R
        d.add(flow.Dot(radius=0.08).at((0, 0)))
        ax.text(-0.3, 0, r'$R$', fontsize=14, ha='center', va='center')

        # Arrow to summing junction
        d.add(flow.Arrow().at((0.1, 0)).to((0.8, 0)))

        # Summing junction with Σ inside
        sum1 = d.add(flow.Circle(r=0.4).at((1.2, 0)))
        ax.text(1.2, 0, r'$\Sigma$', fontsize=14, ha='center', va='center')

        # +/- labels outside the circle
        ax.text(1.0, 0.5, r'$+$', fontsize=11, ha='center', va='center', color='black')
        ax.text(1.0, -0.5, r'$-$', fontsize=11, ha='center', va='center', color='black')

        # Arrow to first block
        d.add(flow.Arrow().at((1.6, 0)).to((2.4, 0)))

        # Block G1/(1-G1G3)
        block1 = d.add(flow.Box(w=2.2, h=1.0).at((3.5, 0)).label(r'$\frac{G_1}{1-G_1G_3}$'))

        # Arrow to G2
        d.add(flow.Arrow().at((4.6, 0)).to((5.4, 0)))

        # Block G2
        block2 = d.add(flow.Box(w=1.2, h=0.8).at((6.0, 0)).label(r'$G_2$'))

        # Arrow to branch point
        d.add(flow.Arrow().at((6.6, 0)).to((7.2, 0)))

        # Branch point (dot)
        branch = d.add(flow.Dot(radius=0.08).at((7.4, 0)))

        # Upper path: to G6/G2
        d.add(flow.Line().at((7.4, 0)).up(1.2))
        d.add(flow.Arrow().to((8.2, 1.2)))

        block3 = d.add(flow.Box(w=1.0, h=0.8).at((8.8, 1.2)).label(r'$\frac{G_6}{G_2}$'))

        d.add(flow.Arrow().at((9.3, 1.2)).to((10.2, 1.2)))
        d.add(flow.Line().down(0.7))

        # Lower path from branch: to G5
        d.add(flow.Arrow().at((7.4, 0)).to((8.2, 0)))

        block4 = d.add(flow.Box(w=1.0, h=0.8).at((8.8, 0)).label(r'$G_5$'))

        d.add(flow.Arrow().at((9.3, 0)).to((10.0, 0)))

        # Second summing junction
        sum2 = d.add(flow.Circle(r=0.4).at((10.4, 0)))
        ax.text(10.4, 0, r'$\Sigma$', fontsize=14, ha='center', va='center')
        ax.text(10.2, 0.5, r'$+$', fontsize=11, ha='center', va='center')
        ax.text(10.2, -0.4, r'$+$', fontsize=11, ha='center', va='center')

        # Output arrow and Y
        d.add(flow.Arrow().at((10.8, 0)).to((11.6, 0)))
        d.add(flow.Dot(radius=0.08).at((11.7, 0)))
        ax.text(12.0, 0, r'$Y$', fontsize=14, ha='center', va='center')

        # Feedback path from branch down to G4
        d.add(flow.Line().at((7.4, 0)).down(1.5))
        d.add(flow.Arrow().to((7.4, -1.8)))

        block5 = d.add(flow.Box(w=1.0, h=0.8).at((7.4, -2.2)).label(r'$G_4$'))

        d.add(flow.Line().at((6.9, -2.2)).left(4.5))
        d.add(flow.Line().up(1.8))
        d.add(flow.Arrow().to((2.4, -0.4)))

    fig.savefig(OUT / '09_block_diagram_v2.png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    print('✓ 09_block_diagram_v2.png')


def draw_signal_flow_graph():
    """
    Signal flow graph style like signal_ref.png:
    - White background
    - Nodes as circles with variable names inside
    - Smooth arcs (not straight lines) for connections
    - Gain labels on arcs
    - Different arrow styles for different paths
    """
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.set_xlim(-0.5, 11)
    ax.set_ylim(-2, 3)
    ax.set_aspect('equal')
    ax.axis('off')
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')

    with schemdraw.Drawing(ax=ax) as d:
        d.config(unit=1.0, fontsize=12, lw=1.5)

        # Nodes
        Xs = d.add(flow.Circle(r=0.5).at((0, 0)))
        ax.text(0, 0, r'$x_S$', fontsize=14, ha='center', va='center', color='#2E5090')

        Xi = d.add(flow.Circle(r=0.5).at((2.5, 0)))
        ax.text(2.5, 0, r'$x_i$', fontsize=14, ha='center', va='center', color='#2E5090')

        Xj = d.add(flow.Circle(r=0.5).at((5.5, 0)))
        ax.text(5.5, 0, r'$x_j$', fontsize=14, ha='center', va='center', color='#2E5090')

        Xo = d.add(flow.Circle(r=0.5).at((8.5, 0)))
        ax.text(8.5, 0, r'$x_O$', fontsize=14, ha='center', va='center', color='#2E5090')

        # Forward path: Xs -> Xi (a21)
        d.add(flow.Arrow().at((0.5, 0)).to((2.0, 0)))
        ax.text(1.25, 0.3, r'$a_{21}$', fontsize=12, ha='center', va='bottom', color='#2E5090')

        # Dashed line: Xi -> Xj (P)
        line = flow.Line().at((3.0, 0)).to((5.0, 0))
        line.linestyle('--')
        d.add(line)
        ax.text(4.0, -0.3, r'$P$', fontsize=12, ha='center', va='top', color='#2E5090')

        # Forward path: Xj -> Xo (a12)
        d.add(flow.Arrow().at((6.0, 0)).to((8.0, 0)))
        ax.text(7.0, 0.3, r'$a_{12}$', fontsize=12, ha='center', va='bottom', color='#2E5090')

        # Self-loop at Xi (a22) - upper arc
        d.add(flow.Arc2(k=0.6, arrow='->').at((2.0, 0.3)).to((3.0, 0.3)))
        ax.text(2.5, 1.1, r'$a_{22}$', fontsize=12, ha='center', va='bottom', color='#2E5090')

        # Feedback from Xs to Xo (a11) - large lower arc
        d.add(flow.Arc2(k=-0.8, arrow='->').at((0.3, -0.4)).to((8.2, -0.4)))
        ax.text(4.25, -1.6, r'$a_{11}$', fontsize=12, ha='center', va='top', color='#2E5090')

    fig.savefig(OUT / '10_signal_flow_v2.png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    print('✓ 10_signal_flow_v2.png')


def draw_cascade_control():
    """串级控制系统框图 - 改进版"""
    fig, ax = plt.subplots(figsize=(16, 8))
    ax.set_xlim(-1, 16)
    ax.set_ylim(-4, 4)
    ax.set_aspect('equal')
    ax.axis('off')
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')

    with schemdraw.Drawing(ax=ax) as d:
        d.config(unit=1.0, fontsize=11, lw=1.2)

        # Input R(s)
        d.add(flow.Dot(radius=0.08).at((0, 0)))
        ax.text(-0.3, 0, r'$R(s)$', fontsize=13, ha='center', va='center')
        d.add(flow.Arrow().to((0.8, 0)))

        # Summing junction 1 (outer loop)
        sum1 = d.add(flow.Circle(r=0.4).at((1.2, 0)))
        ax.text(1.2, 0, r'$\Sigma$', fontsize=14, ha='center', va='center')
        ax.text(0.9, 0.55, r'$+$', fontsize=10, ha='center', va='center')
        ax.text(0.9, -0.55, r'$-$', fontsize=10, ha='center', va='center')

        # Input arrows to sum1
        d.add(flow.Line().at((1.2, 0.4)).up(0.2))
        d.add(flow.Line().left(0.3))
        d.add(flow.Arrow().left(0.2))
        d.add(flow.Line().right(0.3).at((1.5, 0.6)))
        d.add(flow.Arrow().right(0.2))

        d.add(flow.Arrow().at((1.6, 0)).to((2.3, 0)))

        # Position Controller
        C1 = d.add(flow.Box(w=2.0, h=0.9).at((3.3, 0)).label(r'$C_1(s)$'))
        d.add(flow.Arrow().at((4.3, 0)).to((5.0, 0)))

        # Summing junction 2 (inner loop)
        sum2 = d.add(flow.Circle(r=0.4).at((5.4, 0)))
        ax.text(5.4, 0, r'$\Sigma$', fontsize=14, ha='center', va='center')
        ax.text(5.1, 0.55, r'$+$', fontsize=10, ha='center', va='center')
        ax.text(5.1, -0.55, r'$-$', fontsize=10, ha='center', va='center')

        d.add(flow.Line().at((5.4, 0.4)).up(0.2))
        d.add(flow.Line().left(0.3))
        d.add(flow.Arrow().left(0.2))
        d.add(flow.Line().right(0.3).at((5.7, 0.6)))
        d.add(flow.Arrow().right(0.2))

        d.add(flow.Arrow().at((5.8, 0)).to((6.5, 0)))

        # Velocity Controller
        C2 = d.add(flow.Box(w=2.0, h=0.9).at((7.5, 0)).label(r'$C_2(s)$'))
        d.add(flow.Arrow().at((8.5, 0)).to((9.2, 0)))

        # Summing junction 3 (disturbance)
        sum3 = d.add(flow.Circle(r=0.4).at((9.6, 0)))
        ax.text(9.6, 0, r'$\Sigma$', fontsize=14, ha='center', va='center')
        ax.text(9.3, -0.55, r'$+$', fontsize=10, ha='center', va='center')

        d.add(flow.Arrow().at((10.0, 0)).to((10.7, 0)))

        # Plant
        G = d.add(flow.Box(w=1.8, h=1.0).at((11.6, 0)).label(r'$G(s)$'))
        d.add(flow.Arrow().at((12.5, 0)).to((13.3, 0)))

        # Output
        d.add(flow.Dot(radius=0.08).at((13.5, 0)))
        ax.text(13.9, 0, r'$Y(s)$', fontsize=13, ha='center', va='center')

        # Velocity feedback H2 (from output of Plant)
        d.add(flow.Line().at((12.2, 0)).down(1.8))
        d.add(flow.Arrow().to((12.2, -2.0)))
        H2 = d.add(flow.Box(w=1.6, h=0.7).at((10.4, -2.0)).anchor('center').label(r'$H_2(s)$'))
        d.add(flow.Line().at((9.4, -2.0)).left(3.4))
        d.add(flow.Line().up(1.6))
        d.add(flow.Arrow().to((6.0, -0.4)))

        # Position feedback H1 (from Y)
        d.add(flow.Line().at((13.3, 0)).down(3.2))
        H1 = d.add(flow.Box(w=1.6, h=0.7).at((7.5, -3.2)).anchor('center').label(r'$H_1(s)$'))
        d.add(flow.Line().at((6.7, -3.2)).left(5.0))
        d.add(flow.Line().up(2.9))
        d.add(flow.Arrow().to((1.6, -0.4)))

        # Disturbance D(s)
        d.add(flow.Line().at((9.6, -0.4)).down(0.5))
        d.add(flow.Line().left(1.5))
        d.add(flow.Arrow().to((8.1, -0.9)))
        d.add(flow.Dot(radius=0.08).at((8.0, -0.9)))
        ax.text(8.0, -1.3, r'$D(s)$', fontsize=12, ha='center', va='center')

    fig.savefig(OUT / '11_cascade_control_v2.png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    print('✓ 11_cascade_control_v2.png')


def draw_complex_signal_flow():
    """复杂信号流图 - Mason公式示例"""
    fig, ax = plt.subplots(figsize=(14, 7))
    ax.set_xlim(-0.5, 12)
    ax.set_ylim(-3, 3)
    ax.set_aspect('equal')
    ax.axis('off')
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')

    with schemdraw.Drawing(ax=ax) as d:
        d.config(unit=1.0, fontsize=11, lw=1.2)

        # Nodes in a line
        X0 = d.add(flow.Circle(r=0.4).at((0, 0)))
        ax.text(0, 0, r'$X_0$', fontsize=13, ha='center', va='center', color='#2E5090')

        X1 = d.add(flow.Circle(r=0.4).at((2.5, 0)))
        ax.text(2.5, 0, r'$X_1$', fontsize=13, ha='center', va='center', color='#2E5090')

        X2 = d.add(flow.Circle(r=0.4).at((5.0, 0)))
        ax.text(5.0, 0, r'$X_2$', fontsize=13, ha='center', va='center', color='#2E5090')

        X3 = d.add(flow.Circle(r=0.4).at((7.5, 0)))
        ax.text(7.5, 0, r'$X_3$', fontsize=13, ha='center', va='center', color='#2E5090')

        X4 = d.add(flow.Circle(r=0.4).at((10.0, 0)))
        ax.text(10.0, 0, r'$X_4$', fontsize=13, ha='center', va='center', color='#2E5090')

        # Forward paths (straight arrows)
        d.add(flow.Arrow().at((0.4, 0)).to((2.1, 0)))
        ax.text(1.25, 0.35, r'$a$', fontsize=12, ha='center', va='bottom', color='#2E5090')

        d.add(flow.Arrow().at((2.9, 0)).to((4.6, 0)))
        ax.text(3.75, 0.35, r'$b$', fontsize=12, ha='center', va='bottom', color='#2E5090')

        d.add(flow.Arrow().at((5.4, 0)).to((7.1, 0)))
        ax.text(6.25, 0.35, r'$c$', fontsize=12, ha='center', va='bottom', color='#2E5090')

        d.add(flow.Arrow().at((7.9, 0)).to((9.6, 0)))
        ax.text(8.75, 0.35, r'$d$', fontsize=12, ha='center', va='bottom', color='#2E5090')

        # Self-loop at X1 (e) - upper arc
        d.add(flow.Arc2(k=0.5, arrow='->').at((2.1, 0.25)).to((2.9, 0.25)))
        ax.text(2.5, 0.9, r'$e$', fontsize=12, ha='center', va='bottom', color='#2E5090')

        # Feedback f (X2 to X1) - lower arc
        d.add(flow.Arc2(k=-0.4, arrow='->').at((4.6, -0.3)).to((2.9, -0.3)))
        ax.text(3.75, -0.85, r'$f$', fontsize=12, ha='center', va='top', color='#2E5090')

        # Feedback g (X3 to X2) - lower arc
        d.add(flow.Arc2(k=-0.4, arrow='->').at((7.1, -0.3)).to((5.4, -0.3)))
        ax.text(6.25, -0.85, r'$g$', fontsize=12, ha='center', va='top', color='#2E5090')

        # Feedback h (X4 to X3) - lower arc
        d.add(flow.Arc2(k=-0.4, arrow='->').at((9.6, -0.3)).to((7.9, -0.3)))
        ax.text(8.75, -0.85, r'$h$', fontsize=12, ha='center', va='top', color='#2E5090')

        # Skip path i (X0 to X2) - upper arc
        d.add(flow.Arc2(k=-0.6, arrow='->').at((0.3, 0.3)).to((4.7, 0.3)))
        ax.text(2.5, 1.3, r'$i$', fontsize=12, ha='center', va='bottom', color='#2E5090')

        # Skip path j (X1 to X3) - upper arc
        d.add(flow.Arc2(k=-0.6, arrow='->').at((2.8, 0.3)).to((7.2, 0.3)))
        ax.text(5.0, 1.3, r'$j$', fontsize=12, ha='center', va='bottom', color='#2E5090')

    fig.savefig(OUT / '12_mason_formula_v2.png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    print('✓ 12_mason_formula_v2.png')


if __name__ == '__main__':
    print(f'Generating improved schemdraw diagrams → {OUT}\n')
    draw_block_diagram()
    draw_signal_flow_graph()
    draw_cascade_control()
    draw_complex_signal_flow()
    print(f'\nDone! 4 diagrams saved.')
