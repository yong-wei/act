"""Numerically verify the authored examples using SciPy's independent LTI routines."""
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy import signal

BATCH = Path(__file__).resolve().parent
ROOT = BATCH.parents[6]
checks = []


def close(label, actual, expected, tolerance=1e-6):
    assert abs(actual - expected) <= tolerance, (label, float(actual), expected)
    checks.append({"check": label, "value": float(actual), "expected": expected, "tolerance": tolerance})


def step(num, den, stop=40, points=40001):
    return signal.step(signal.TransferFunction(num, den), T=np.linspace(0, stop, points))


t, y = step([1], [2, 1])
close("transfer function: doubled input response at 2 s", y[2000], 1 - np.exp(-1))
t, y = step([4], [1, 2, 4])
close("second order: peak overshoot percent", 100 * (y.max() - 1), 16.30335, 0.001)
close("second order: peak time seconds", t[y.argmax()], 1.813799, 0.001)
for gain, expected in [(10, 0.2), (20, 0.1)]:
    t = np.linspace(0, 40, 40001)
    _, output, _ = signal.lsim(([gain], [1, 2, gain]), U=t, T=t)
    close(f"system type: ramp error K={gain}", t[-1] - output[-1], expected, 1e-5)
_, y = step([1, 1], [1, 5])
close("steady error: reference step", y[-1], 0.2)
_, y = step([-1], [1, 5])
close("steady error: plant-input disturbance step", y[-1], -0.2)
for frequency, amplitude, phase in [(0.1, -0.043214, -5.710593), (1, -3.010300, -45), (10, -20.043214, -84.289407)]:
    _, h = signal.freqresp(([1], [1, 1]), w=[frequency])
    close(f"Bode amplitude at {frequency}", 20 * np.log10(abs(h[0])), amplitude)
    close(f"Bode phase at {frequency}", np.angle(h[0], deg=True), phase)
_, h = signal.freqresp(([np.sqrt(2)], [1, 1, 0]), w=[1])
close("phase margin: gain crossover amplitude", abs(h[0]), 1)
close("phase margin: margin degrees", 180 + np.angle(h[0], deg=True), 45)
close("pure delay boundary seconds", np.pi / 4, 0.785398, 1e-6)
_, h = signal.freqresp(([1], [0.5, 1]), w=[2])
close("bandwidth: amplitude at 2 rad/s", abs(h[0]), 1 / np.sqrt(2))
close("bandwidth: hertz conversion", 2 / (2 * np.pi), 0.318310, 1e-6)
t, y = step([1], [1, 1, 1])
close("integral controller: final output", y[-1], 1)
close("integral controller: overshoot percent", 100 * (y.max() - 1), 16.30335, 0.001)
_, y = step([2, 1], [1, 3, 1], stop=80, points=80001)
close("PI: final output", y[-1], 1)
roots = sorted(np.roots([1, 3, 1]))
close("PI: slow pole", roots[1], -0.381966, 1e-6)
close("PI: fast pole", roots[0], -2.618034, 1e-6)
t = np.linspace(0, 80, 80001)
_, y, _ = signal.lsim(([2, 1], [1, 3, 1]), U=t, T=t)
close("PI: unit ramp error", t[-1] - y[-1], 1, 1e-5)
_, h = signal.freqresp(([1, 1], [0.25, 1]), w=[2])
close("lead: amplitude at peak phase", abs(h[0]), 2)
close("lead: peak phase", np.angle(h[0], deg=True), 36.869898, 1e-6)
_, h = signal.freqresp(([50, 5], [50, 1]), w=[1])
close("lag: amplitude at 1 rad/s", abs(h[0]), 1.004787, 1e-6)
close("lag: phase at 1 rad/s", np.angle(h[0], deg=True), -4.56483, 1e-5)
close("lag: decibels at 1 rad/s", 20 * np.log10(abs(h[0])), 0.041478, 1e-5)
for gain, imaginary in [(2, 1), (4, np.sqrt(3))]:
    roots = np.roots([1, 2, gain])
    close(f"root locus K={gain}: real part", roots[0].real, -1)
    close(f"root locus K={gain}: imaginary magnitude", abs(roots[0].imag), imaginary)
inventory = json.loads((BATCH / "inventory.json").read_text())
for card in inventory["cards"]:
    assert hashlib.sha256((ROOT / card["authoringPath"]).read_bytes()).hexdigest() == card["cardSha256"]
report = {"status": "passed", "method": "SciPy step, lsim, freqresp and NumPy roots", "cardHashes": {c["cardId"]: c["cardSha256"] for c in inventory["cards"]}, "checks": checks}
(BATCH / "numerical-verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(f"PASS: {len(checks)} numerical checks for 12 cards")
