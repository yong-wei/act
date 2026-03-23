#!/Library/Frameworks/Python.framework/Versions/3.11/bin/python3
"""
Control System Diagrams using Schemdraw
Generates block diagrams and signal flow graphs.
"""
import warnings
warnings.filterwarnings('ignore')
import schemdraw
import schemdraw.flow as flow
from pathlib import Path

OUT = Path(__file__).parent.parent / 'images'
OUT.mkdir(exist_ok=True)


def draw_cascade_control():
    """串级 PID 控制系统框图"""
    with schemdraw.Drawing(show=False) as d:
        d.config(unit=0.8, fontsize=11)

        # Input R(s)
        R = d.add(flow.Box(w=1.0, h=0.6).label(r'$R(s)$'))
        d.add(flow.Arrow().right(0.5))

        # Summing junction 1 (outer loop)
        sum1 = d.add(flow.Circle(r=0.4))
        d.add(flow.Line().at(sum1.N).up(0.3))
        d.add(flow.Line().left(0.3))
        d.add(flow.Arrow().left(0.3))
        d.add(flow.Arrow().right(0.3).at((sum1.N[0]+0.3, sum1.N[1]+0.3)))
        d.add(flow.Line().right(0.3))

        # + - labels
        d.add(flow.Dot(radius=0).at((sum1.N[0]-0.15, sum1.N[1]+0.15)).label('+', 'center', fontsize=9))
        d.add(flow.Dot(radius=0).at((sum1.N[0]+0.15, sum1.N[1]+0.15)).label('−', 'center', fontsize=9))

        d.add(flow.Arrow().at(sum1.E).right(0.5))

        # Position Controller
        C1 = d.add(flow.Box(w=2.2, h=1.0).label('Position\nController $C_1$'))
        d.add(flow.Arrow().right(0.5))

        # Summing junction 2 (inner loop)
        sum2 = d.add(flow.Circle(r=0.4))
        d.add(flow.Line().at(sum2.N).up(0.3))
        d.add(flow.Line().left(0.3))
        d.add(flow.Arrow().left(0.3))
        d.add(flow.Arrow().right(0.3).at((sum2.N[0]+0.3, sum2.N[1]+0.3)))
        d.add(flow.Line().right(0.3))

        d.add(flow.Dot(radius=0).at((sum2.N[0]-0.15, sum2.N[1]+0.15)).label('+', 'center', fontsize=9))
        d.add(flow.Dot(radius=0).at((sum2.N[0]+0.15, sum2.N[1]+0.15)).label('−', 'center', fontsize=9))

        d.add(flow.Arrow().at(sum2.E).right(0.5))

        # Velocity Controller
        C2 = d.add(flow.Box(w=2.2, h=1.0).label('Velocity\nController $C_2$'))
        d.add(flow.Arrow().right(0.5))

        # Summing junction 3 (disturbance)
        sum3 = d.add(flow.Circle(r=0.4))
        d.add(flow.Arrow().at(sum3.E).right(0.5))

        # Plant
        G = d.add(flow.Box(w=2.0, h=1.2).label('Plant\n$G(s)$'))
        d.add(flow.Arrow().right(0.5))

        # Output Y(s)
        Y = d.add(flow.Box(w=1.0, h=0.6).label(r'$Y(s)$'))

        # Inner feedback H2 (velocity)
        d.add(flow.Line().at((G.E[0]-0.3, 0)).down(2.0))
        H2 = d.add(flow.Box(w=1.8, h=0.8).at((C2.E[0], -2.0)).anchor('center').label('Velocity\nSensor $H_2$'))
        d.add(flow.Line().at(H2.W).left(2.2))
        d.add(flow.Line().up(1.6))
        d.add(flow.Arrow().at(sum2.S).theta(90))

        # Outer feedback H1 (position)
        d.add(flow.Line().at((Y.E[0]-0.4, 0)).down(3.5))
        H1 = d.add(flow.Box(w=1.8, h=0.8).at((C1.E[0]-1.0, -3.5)).anchor('center').label('Position\nSensor $H_1$'))
        d.add(flow.Line().at(H1.W).left(4.0))
        d.add(flow.Line().up(3.1))
        d.add(flow.Arrow().at(sum1.S).theta(90))

        # Disturbance D(s)
        d.add(flow.Line().at(sum3.S).down(1.0))
        d.add(flow.Line().left(1.5))
        D = d.add(flow.Box(w=1.0, h=0.6).at((sum3.S[0]-1.5, sum3.S[1]-1.0)).anchor('center').label(r'$D(s)$'))
        d.add(flow.Arrow().at((sum3.S[0], sum3.S[1]-0.6)).theta(90))

        d.add(flow.Dot(radius=0).at((sum3.S[0]-0.12, sum3.S[1]-0.5)).label('+', 'center', fontsize=9))
        d.add(flow.Dot(radius=0).at((sum3.S[0]+0.12, sum3.S[1]-0.5)).label('+', 'center', fontsize=9))

    d.save(OUT / '09_cascade_control_block.png')
    print('✓ 09_cascade_control_block.png')


def draw_signal_flow_graph():
    """状态空间信号流图"""
    with schemdraw.Drawing(show=False) as d:
        d.config(unit=0.9, fontsize=11)

        # Nodes
        R = d.add(flow.Circle(r=0.35).label(r'$R$', 'center'))
        d.add(flow.Arrow().right(0.8))

        E = d.add(flow.Circle(r=0.35).label(r'$E$', 'center'))
        d.add(flow.Arrow().right(0.8))
        d.add(flow.Dot(radius=0).at((E.E[0]+0.4, E.E[1]+0.2)).label('1', 'center', fontsize=10))

        U = d.add(flow.Circle(r=0.35).label(r'$U$', 'center'))
        d.add(flow.Arrow().right(0.8))
        d.add(flow.Dot(radius=0).at((U.E[0]+0.4, U.E[1]+0.2)).label(r'$G_c$', 'center', fontsize=10))

        X1 = d.add(flow.Circle(r=0.35).label(r'$X_1$', 'center'))
        d.add(flow.Arrow().right(0.8))
        d.add(flow.Dot(radius=0).at((X1.E[0]+0.4, X1.E[1]+0.2)).label(r'$\frac{1}{s}$', 'center', fontsize=10))

        X2 = d.add(flow.Circle(r=0.35).label(r'$X_2$', 'center'))
        d.add(flow.Arrow().right(0.8))
        d.add(flow.Dot(radius=0).at((X2.E[0]+0.4, X2.E[1]+0.2)).label(r'$\frac{1}{s}$', 'center', fontsize=10))

        C = d.add(flow.Circle(r=0.35).label(r'$C$', 'center'))

        # Feedback -H
        d.add(flow.Line().at(C.S).down(2.5))
        d.add(flow.Line().left(11.0))
        d.add(flow.Arrow().up(2.15))
        fb = d.add(flow.Box(w=0.9, h=0.5).at((5.5, -2.5)).anchor('center').label(r'$-H$'))

        # State feedback -a1
        d.add(flow.Line().at(X2.S).down(1.5))
        d.add(flow.Line().left(2.7))
        d.add(flow.Arrow().up(1.15))
        d.add(flow.Box(w=0.8, h=0.45).at((X1.E[0]+0.9, -1.5)).anchor('center').label(r'$-a_1$'))

        # State feedback -a2
        d.add(flow.Line().at(X2.S).down(2.5))
        d.add(flow.Line().left(5.7))
        d.add(flow.Line().up(2.15))
        d.add(flow.Box(w=0.8, h=0.45).at((U.E[0]+0.9, -2.5)).anchor('center').label(r'$-a_2$'))

        # Direct path b0
        d.add(flow.Arc2(k=-0.3, arrow='->').at((U.E[0]+0.2, 0.2)).to((X2.W[0]-0.2, 0.2)))
        d.add(flow.Dot(radius=0).at((U.E[0]+2.0, 0.7)).label(r'$b_0$', 'center', fontsize=10))

        # Path b1
        d.add(flow.Dot(radius=0).at((U.E[0]+0.9, 0.25)).label(r'$b_1$', 'center', fontsize=10))

    d.save(OUT / '10_signal_flow_graph.png')
    print('✓ 10_signal_flow_graph.png')


def draw_multiloop_system():
    """多回路系统"""
    with schemdraw.Drawing(show=False) as d:
        d.config(unit=0.8, fontsize=10)

        # Forward path
        R = d.add(flow.Box(w=0.8, h=0.5).label(r'$R$'))
        d.add(flow.Arrow().right(0.4))

        sum1 = d.add(flow.Circle(r=0.35))
        d.add(flow.Line().at(sum1.N).up(0.25))
        d.add(flow.Line().left(0.25))
        d.add(flow.Arrow().left(0.25))
        d.add(flow.Arrow().right(0.25).at((sum1.N[0]+0.25, sum1.N[1]+0.25)))
        d.add(flow.Line().right(0.25))
        d.add(flow.Dot(radius=0).at((sum1.N[0]-0.12, sum1.N[1]+0.12)).label('+', 'center', fontsize=8))
        d.add(flow.Dot(radius=0).at((sum1.N[0]+0.12, sum1.N[1]+0.12)).label('−', 'center', fontsize=8))
        d.add(flow.Arrow().right(0.4))

        G1 = d.add(flow.Box(w=1.6, h=0.8).label(r'$G_1$'))
        d.add(flow.Arrow().right(0.4))

        sum2 = d.add(flow.Circle(r=0.35))
        d.add(flow.Line().at(sum2.N).up(0.25))
        d.add(flow.Line().left(0.25))
        d.add(flow.Arrow().left(0.25))
        d.add(flow.Arrow().right(0.25).at((sum2.N[0]+0.25, sum2.N[1]+0.25)))
        d.add(flow.Line().right(0.25))
        d.add(flow.Dot(radius=0).at((sum2.N[0]-0.12, sum2.N[1]+0.12)).label('+', 'center', fontsize=8))
        d.add(flow.Dot(radius=0).at((sum2.N[0]+0.12, sum2.N[1]+0.12)).label('+', 'center', fontsize=8))
        d.add(flow.Arrow().right(0.4))

        G2 = d.add(flow.Box(w=1.6, h=0.8).label(r'$G_2$'))
        d.add(flow.Arrow().right(0.4))

        sum3 = d.add(flow.Circle(r=0.35))
        d.add(flow.Arrow().right(0.4))

        G3 = d.add(flow.Box(w=1.6, h=0.8).label(r'$G_3$'))
        d.add(flow.Arrow().right(0.4))

        C_out = d.add(flow.Box(w=0.8, h=0.5).label(r'$C$'))

        # Feedback H1 (around G3)
        d.add(flow.Line().at((G3.E[0]-0.15, 0)).down(1.5))
        d.add(flow.Box(w=1.2, h=0.6).at((sum2.E[0]+0.8, -1.5)).anchor('center').label(r'$H_1$'))
        d.add(flow.Line().left(2.8))
        d.add(flow.Line().up(1.15))
        d.add(flow.Arrow().at(sum2.S).theta(90))

        # Feedback H2 (around G2G3)
        d.add(flow.Line().at((G3.E[0]-0.1, 0)).down(2.5))
        d.add(flow.Box(w=1.2, h=0.6).at((sum1.E[0]+2.0, -2.5)).anchor('center').label(r'$H_2$'))
        d.add(flow.Line().left(4.0))
        d.add(flow.Line().up(2.15))
        d.add(flow.Arrow().at(sum1.S).theta(90))

        # Feedback H3 (around G1, top)
        d.add(flow.Line().at((G1.E[0]-0.1, 0)).up(1.5))
        d.add(flow.Box(w=1.0, h=0.5).at((sum1.E[0]+0.8, 1.5)).anchor('center').label(r'$H_3$'))
        d.add(flow.Line().left(1.6))
        d.add(flow.Line().down(1.15))
        d.add(flow.Arrow().at(sum1.N).theta(-90))

        # Disturbance N
        d.add(flow.Line().at(sum3.S).down(0.8))
        d.add(flow.Box(w=0.8, h=0.45).at((sum3.S[0], sum3.S[1]-0.8)).anchor('center').label(r'$N$'))
        d.add(flow.Arrow().up(0.45))
        d.add(flow.Dot(radius=0).at((sum3.S[0]-0.1, sum3.S[1]-0.4)).label('+', 'center', fontsize=8))
        d.add(flow.Dot(radius=0).at((sum3.S[0]+0.1, sum3.S[1]-0.4)).label('+', 'center', fontsize=8))

    d.save(OUT / '11_multiloop_system.png')
    print('✓ 11_multiloop_system.png')


def draw_mason_example():
    """Mason 增益公式示例"""
    with schemdraw.Drawing(show=False) as d:
        d.config(unit=0.9, fontsize=11)

        # Nodes
        X0 = d.add(flow.Circle(r=0.3).label(r'$X_0$', 'center'))
        d.add(flow.Arrow().right(0.8))
        d.add(flow.Dot(radius=0).at((X0.E[0]+0.4, 0.2)).label(r'$a$', 'center', fontsize=10))

        X1 = d.add(flow.Circle(r=0.3).label(r'$X_1$', 'center'))
        d.add(flow.Arrow().right(0.8))
        d.add(flow.Dot(radius=0).at((X1.E[0]+0.4, 0.2)).label(r'$b$', 'center', fontsize=10))

        X2 = d.add(flow.Circle(r=0.3).label(r'$X_2$', 'center'))
        d.add(flow.Arrow().right(0.8))
        d.add(flow.Dot(radius=0).at((X2.E[0]+0.4, 0.2)).label(r'$c$', 'center', fontsize=10))

        X3 = d.add(flow.Circle(r=0.3).label(r'$X_3$', 'center'))
        d.add(flow.Arrow().right(0.8))
        d.add(flow.Dot(radius=0).at((X3.E[0]+0.4, 0.2)).label(r'$d$', 'center', fontsize=10))

        X4 = d.add(flow.Circle(r=0.3).label(r'$X_4$', 'center'))

        # Self-loop at X1 (gain e) - using Arc2 instead of ArcLoop
        d.add(flow.Arc2(k=0.5, arrow='->').at((X1.N[0]-0.2, X1.N[1]+0.1)).to((X1.N[0]+0.2, X1.N[1]+0.5)))
        d.add(flow.Line().at((X1.N[0]+0.2, X1.N[1]+0.5)).right(0.3))
        d.add(flow.Line().down(0.6))
        d.add(flow.Arrow().at((X1.N[0]+0.5, X1.N[1])).down(0.3))
        d.add(flow.Dot(radius=0).at((X1.N[0]+0.5, X1.N[1]+0.6)).label(r'$e$', 'center', fontsize=10))

        # Feedback f
        d.add(flow.Arc2(k=0.3, arrow='->').at((X2.S[0], X2.S[1]+0.1)).to((X1.S[0], X1.S[1]+0.1)))
        d.add(flow.Dot(radius=0).at((X1.E[0]+0.85, -0.5)).label(r'$f$', 'center', fontsize=10))

        # Feedback g
        d.add(flow.Arc2(k=0.3, arrow='->').at((X3.S[0], X3.S[1]+0.1)).to((X2.S[0], X2.S[1]+0.1)))
        d.add(flow.Dot(radius=0).at((X2.E[0]+0.85, -0.5)).label(r'$g$', 'center', fontsize=10))

        # Feedback h
        d.add(flow.Arc2(k=0.3, arrow='->').at((X4.S[0], X4.S[1]+0.1)).to((X3.S[0], X3.S[1]+0.1)))
        d.add(flow.Dot(radius=0).at((X3.E[0]+0.85, -0.5)).label(r'$h$', 'center', fontsize=10))

        # Skip path i (X0 to X2)
        d.add(flow.Arc2(k=-0.4, arrow='->').at((X0.E[0]+0.1, 0.2)).to((X2.W[0]-0.1, 0.2)))
        d.add(flow.Dot(radius=0).at((X1.E[0], 0.7)).label(r'$i$', 'center', fontsize=10))

        # Skip path j (X1 to X3)
        d.add(flow.Arc2(k=-0.4, arrow='->').at((X1.E[0]+0.1, 0.2)).to((X3.W[0]-0.1, 0.2)))
        d.add(flow.Dot(radius=0).at((X2.E[0], 0.7)).label(r'$j$', 'center', fontsize=10))

    d.save(OUT / '12_mason_formula_example.png')
    print('✓ 12_mason_formula_example.png')


if __name__ == '__main__':
    print(f'Generating schemdraw diagrams → {OUT}\n')
    draw_cascade_control()
    draw_signal_flow_graph()
    draw_multiloop_system()
    draw_mason_example()
    print(f'\nDone! 4 diagrams saved.')
