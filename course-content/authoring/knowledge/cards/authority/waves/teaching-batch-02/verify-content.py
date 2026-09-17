import hashlib
import json
from pathlib import Path

import numpy as np
from scipy import signal

BATCH = Path(__file__).resolve().parent
ROOT = BATCH.parents[6]
checks = []


def check(name, actual, expected, tolerance=1e-6):
    assert abs(actual - expected) <= tolerance, (name, actual, expected)
    checks.append({'check': name, 'actual': float(actual), 'expected': expected, 'tolerance': tolerance})


time = np.linspace(0, 20, 20001)
_, y = signal.step(([2], [1, 3]), T=time)
check('negative feedback final output', y[-1], 2 / 3)
check('negative feedback K=9 unstable roots', sum(np.roots([1, 3, 3, 10]).real > 0), 2)
_, y = signal.step(([2], [0.5, 1]), T=time)
for index, expected in [(500, 1.264241), (1500, 1.900426), (2000, 1.963369)]:
    check(f'first order at {time[index]} seconds', y[index], expected)
check('first order 10-90 rise time', 0.5 * np.log(9), 1.098612, 1e-6)
check('first order 2 percent settling', -0.5 * np.log(0.02), 1.956012, 1e-6)
for den in [[1, 2, 4], [1, 4, 16]]:
    roots = np.roots(den)
    check(f'damping from poles {den}', -roots[0].real / abs(roots[0]), 0.5)
check('critical damping', 6 / (2 * np.sqrt(9)), 1)
check('offset step overshoot percent', (12.3 - 12) / (12 - 10) * 100, 15)
check('standard second order overshoot percent', 100 * np.exp(-np.pi * 0.5 / np.sqrt(0.75)), 16.303353, 1e-6)
for den, expected in [([1, 2, 3, 4], 0), ([1, 2, 1, 4], 2), ([1, 3, 2, 7], 2)]:
    check(f'Routh independent roots {den}', sum(np.roots(den).real > 0), expected)
_, h = signal.freqresp(([2], [1, 1]), w=[0, 1, 10])
check('Nyquist at omega=1 real', h[1].real, 1)
check('Nyquist at omega=1 imaginary', h[1].imag, -1)
check('Nyquist circle residual', np.max(abs((h.real - 1) ** 2 + h.imag ** 2 - 1)), 0)
_, h = signal.freqresp(([2], [1, 3, 2, 0]), w=[np.sqrt(2)])
check('gain margin crossing real', h[0].real, -1 / 3)
check('gain margin crossing imaginary', h[0].imag, 0)
check('gain margin decibels', -20 * np.log10(abs(h[0])), 9.542425, 1e-6)
check('gain boundary has imaginary-axis roots', min(abs(np.roots([1, 3, 2, 6]).real)), 0)
hold = (1 - np.exp(-1j * 2 * 0.1)) / (1j * 2 * 0.1)
check('normalized hold amplitude', abs(hold), 0.998334, 1e-6)
check('hold phase degrees', np.angle(hold, deg=True), -5.729578, 1e-6)
a = np.exp(-0.1)
_, y = signal.dlsim(([1 - a], [1, -a], 0.1), np.ones(5))
check('pulse first sample', y[1, 0], 0.095163, 1e-6)
check('pulse second sample', y[2, 0], 0.181269, 1e-6)
for a1, a0, stable in [(-0.7, 0.1, True), (-1.3, 0.24, False), (-1.2, 0.2, False), (0.2, 0.5, True)]:
    roots = np.roots([1, a1, a0])
    check(f'Jury independent roots {a1},{a0}', int(np.max(abs(roots)) < 1 - 1e-9), int(stable))
    conditions = abs(a0) < 1 and 1 + a1 + a0 > 1e-9 and 1 - a1 + a0 > 1e-9
    check(f'Jury inequalities {a1},{a0}', int(conditions), int(stable))
A = np.array([[0, 1], [-2, -3]])
B = np.array([[0], [1]])
controllability = np.hstack([B, A @ B])
check('controllability rank', np.linalg.matrix_rank(controllability), 2)
check('controllability determinant', np.linalg.det(controllability), -1)
A = np.diag([-1, -2])
B = np.array([[1], [0]])
check('uncontrollable example rank', np.linalg.matrix_rank(np.hstack([B, A @ B])), 1)
C = np.array([[1, 1]])
O = np.vstack([C, C @ A])
check('observability rank', np.linalg.matrix_rank(O), 2)
check('observability determinant', np.linalg.det(O), -1)
x = np.linalg.solve(O, [3, -5])
check('reconstructed state one', x[0], 1)
check('reconstructed state two', x[1], 2)
check('equal modes unobservable', np.linalg.matrix_rank(np.vstack([C, C @ -np.eye(2)])), 1)
inventory = json.loads((BATCH / 'inventory.json').read_text())
for card in inventory['cards']:
    assert hashlib.sha256((ROOT / card['authoringPath']).read_bytes()).hexdigest() == card['cardSha256']
(BATCH / 'numerical-verification.json').write_text(json.dumps({'status': 'passed', 'cardHashes': {r['cardId']: r['cardSha256'] for r in inventory['cards']}, 'checks': checks}, ensure_ascii=False, indent=2) + '\n')
print(f'PASS: {len(checks)} numerical checks')
