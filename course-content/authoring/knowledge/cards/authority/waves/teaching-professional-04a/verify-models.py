"""Original continuous-time state-feedback and observer teaching calculations."""
import json
from pathlib import Path
import numpy as np
from scipy.linalg import expm

BATCH = Path(__file__).resolve().parent
A = np.array([[0., 1.], [0., 0.]])
B = np.array([[0.], [1.]])
C = np.array([[1., 0.]])
K = np.array([[6., 5.]])
L = np.array([[9.], [20.]])
I = np.eye(2)

def check(actual, expected):
    assert np.allclose(actual, expected, atol=1e-10), (actual, expected)

def poles(matrix, expected):
    check(np.sort_complex(np.linalg.eigvals(matrix)), np.sort_complex(expected))

Pc = np.hstack([B, A @ B])
Po = np.vstack([C, C @ A])
check(Pc, [[0, 1], [1, 0]])
check(Po, I)
check(np.array([[0., 1.]]) @ np.linalg.solve(Pc, A @ A + 5*A + 6*I), K)
check((A @ A + 9*A + 20*I) @ np.linalg.solve(Po, np.array([[0.], [1.]])), L)
poles(A-B@K, [-2, -3])
poles(A-L@C, [-4, -5])

As = np.diag([1., -2.])
Bs = np.array([[1.], [0.]])
Cs = Bs.T
Ks = np.array([[3., 0.]])
Ls = Ks.T
assert np.linalg.matrix_rank(np.hstack([Bs, As@Bs])) == 1
assert np.linalg.matrix_rank(np.vstack([Cs, Cs@As])) == 1
poles(As-Bs@Ks, [-2, -2])
poles(As-Ls@Cs, [-2, -2])
Au = np.diag([1., 2.])
assert np.linalg.matrix_rank(np.hstack([2*I-Au, Bs])) == 1
assert np.linalg.matrix_rank(np.vstack([2*I-Au, Cs])) == 1

# Reduced observer, arbitrary samples verify the algebraic error equation.
for x1, x2, zhat, u in [(1., 2., 3., 4.), (-2., 5., -1., 0.3)]:
    z = x2 - 4*x1
    zdot = u - 4*x2
    zhatdot = -4*zhat - 16*x1 + u
    check(zdot - zhatdot, -4*(z-zhat))

M = np.block([[A-B@K, B@K], [np.zeros((2, 2)), A-L@C]])
poles(M, [-2, -3, -4, -5])
# Independent coordinate transformation from (x, xhat) to (x, x-xhat).
Mphysical = np.block([[A, -B@K], [L@C, A-B@K-L@C]])
T = np.block([[I, np.zeros((2, 2))], [I, -I]])
check(T@Mphysical@np.linalg.inv(T), M)

Ak = np.diag([-1., -2., -3., -4.])
Bk = np.array([[1.], [1.], [0.], [0.]])
Ck = np.array([[1., 0., 1., 0.]])
Wc = np.hstack([np.linalg.matrix_power(Ak, j)@Bk for j in range(4)])
Wo = np.vstack([Ck@np.linalg.matrix_power(Ak, j) for j in range(4)])
assert np.linalg.matrix_rank(Wc) == np.linalg.matrix_rank(Wo) == 2
check(Wc[2:, :], np.zeros((2, 4)))
check(Wo[:, [1, 3]], np.zeros((4, 2)))
for s in [0., 0.5, 2., 1j]:
    check((Ck@np.linalg.solve(s*np.eye(4)-Ak, Bk)).item(), 1/(s+1))

Ai = np.array([[0., 1., 0.], [-11., -6., 6.], [-1., 0., 0.]])
Br = np.array([[0.], [0.], [1.]])
xi = np.linalg.solve(-Ai, Br)
poles(Ai, [-1, -2, -3])
check(np.poly(Ai), [1, 6, 11, 6])
check(xi.ravel(), [1, 0, 11/6])
check((xi-expm(Ai*30)@xi)[0, 0], 1.)

models = {
    'state_feedback': {'K': K.tolist(), 'poles': [-2, -3]},
    'ackermann_control': {'controllabilityMatrix': Pc.tolist(), 'K': K.tolist()},
    'full_observer': {'L': L.tolist(), 'errorPoles': [-4, -5]},
    'ackermann_observer': {'observabilityMatrix': Po.tolist(), 'L': L.tolist()},
    'stabilizability_detectability': {'uncontrolledUnobservedStableMode': -2, 'counterexampleUnstableMode': 2},
    'reduced_observer': {'gain': 4, 'errorPole': -4, 'outputCoefficient': -16},
    'separation': {'closedLoop': M.tolist(), 'poles': [-2, -3, -4, -5]},
    'kalman_decomposition': {'controllabilityRank': 2, 'observabilityRank': 2, 'transferFunction': '1/(s+1)'},
    'internal_model': {'closedLoop': Ai.tolist(), 'poles': [-1, -2, -3], 'stepEquilibrium': xi.ravel().tolist()}
}
(BATCH/'model-verification.json').write_text(json.dumps({'status': 'passed', 'models': models}, ensure_ascii=False, indent=2)+'\n')
print('Passed nine original state-feedback and observer model groups')
