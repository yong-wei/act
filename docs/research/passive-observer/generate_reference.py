"""以独立连续矩阵指数核验被动观测器固定航向通道。"""

import hashlib
import json
from pathlib import Path

import numpy as np
import scipy
from scipy.linalg import expm

omega = 2 * np.pi / 8
k11, k12, k2 = -2 * 0.9 * 1.1, 2 * 0.9 * omega, 1.1 * omega
matrix = np.array([
    [0, 1 - k11, -k11, 0, 0],
    [-omega**2, -0.2 * omega - k12, -k12, 0, 0],
    [0, -k2, -k2, 0, 1],
    [0, -0.002, -0.002, -0.001, 0],
    [0, -0.04, -0.04, 1, -0.05],
])
input_vector = np.array([k11, k12, k2, 0.002, 0.04])
augmented = np.zeros((6, 6))
augmented[:5, :5] = matrix
augmented[:5, 5] = input_vector
initial = np.array([0, 0, 0, 0, 0, 1])
times = [0.5, 1, 5, 20, 60]
states = [(expm(augmented * time) @ initial)[:5].tolist() for time in times]
eigenvalues = np.linalg.eigvals(matrix)
if eigenvalues.real.max() >= 0:
    raise ValueError('闭环观测器误差矩阵不稳定')
report = {
    'schema': 'act.passive-observer.reference.v1', 'grade': 'T',
    'source': 'https://fossen.biz/publications/2004%20Torsetnes%20et%20al%20CDC.pdf',
    'equations': ['29-34', '51-53'], 'wave_frequency_rad_s': float(omega),
    'configuration': {'mass': 1.0, 'linear_damping': 0.05, 'cutoff_ratio': 1.1,
                      'wave_damping': 0.1, 'desired_wave_damping': 1.0,
                      'k4_over_mass': 0.04, 'k3_over_mass': 0.002, 'bias_time_s': 1000},
    'passive_gain_ratio': 0.05,
    'closed_error_eigenvalues': [[float(value.real), float(value.imag)] for value in eigenvalues],
    'matrix': matrix.tolist(), 'input_vector': input_vector.tolist(),
    'state_order': ['wave_integral', 'wave_motion', 'position', 'bias', 'velocity'],
    'step_measurement': 1.0, 'times_s': times, 'states': states,
    'generator_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'dependencies': {'numpy': np.__version__, 'scipy': scipy.__version__},
    'scope': 'fixed heading, unit normalized mass, exact matrix exponential',
}
Path(__file__).with_name('reference.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'max_real_eigenvalue': float(eigenvalues.real.max()), 'states': states}))
