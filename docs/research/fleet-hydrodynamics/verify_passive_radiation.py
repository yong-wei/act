"""独立核对原生辐射响应、PSD拟合数组与SciPy完整状态空间解。"""

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.linalg import solve

from build_destroyer_pack import sha256, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fit', type=Path, required=True)
    parser.add_argument('--native-csv', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    packed = (args.fit/'radiation-fit-validation.json').exists()
    proof_path = args.fit/('radiation-fit-validation.json' if packed else 'validation.json')
    arrays_path = args.fit/('radiation-fit-arrays.npz' if packed else 'fit-arrays.npz')
    proof = json.loads(proof_path.read_text())
    if (sha256(arrays_path) != proof['fit_arrays_sha256']
            or sha256(args.fit/'radiation.json') != proof['radiation_sha256']):
        raise ValueError('拟合参考数组或辐射参数发生漂移')
    arrays = np.load(arrays_path)
    parameters = json.loads((args.fit/'radiation.json').read_text())
    native = np.genfromtxt(args.native_csv, delimiter=',', names=True)
    omega = arrays['omega']
    if len(native) != len(omega)*36:
        raise ValueError('原生频率/矩阵行数不一致')
    expected_omega = np.repeat(omega, 36)
    expected_row = np.tile(np.repeat(np.arange(6), 6), len(omega))
    expected_column = np.tile(np.arange(6), len(omega)*6)
    if (not np.array_equal(native['omega_rad_s'], expected_omega)
            or not np.array_equal(native['row'], expected_row)
            or not np.array_equal(native['column'], expected_column)):
        raise ValueError('原生矩阵坐标或频率与冻结参考不一致')
    scale = 1/np.sqrt(arrays['rigid_diagonal'])
    native_a = native['added_mass_si'].reshape(len(omega), 6, 6)*np.outer(scale, scale)
    native_b = native['damping_si'].reshape(len(omega), 6, 6)*np.outer(scale, scale)
    fit_a, fit_b = arrays['predicted_a_normalized'], arrays['predicted_b_normalized']
    factor_a_error = float(np.linalg.norm(native_a-fit_a)/np.linalg.norm(fit_a))
    factor_b_error = float(np.linalg.norm(native_b-fit_b)/np.linalg.norm(fit_b))
    size = 2*len(parameters['oscillators'])
    state_matrix, input_matrix, output_matrix = np.zeros((size, size)), np.zeros((size, 6)), np.zeros((6, size))
    added_mass = np.zeros((6, 6))
    for vector in parameters['added_mass_factors']:
        added_mass += np.outer(vector, vector)
    for index, mode in enumerate(parameters['oscillators']):
        position, rate = 2*index, 2*index+1
        natural = mode['natural_frequency_rad_s']
        state_matrix[position, rate] = 1
        state_matrix[rate, position] = -natural**2
        state_matrix[rate, rate] = -2*mode['damping_ratio']*natural
        input_matrix[rate] = mode['coupling']
        output_matrix[:, rate] = mode['coupling']
    independent_a, independent_b = [], []
    for frequency in omega:
        response = output_matrix@solve(1j*frequency*np.eye(size)-state_matrix, input_matrix, assume_a='gen')
        independent_a.append((added_mass+response.imag/frequency)*np.outer(scale, scale))
        independent_b.append(response.real*np.outer(scale, scale))
    independent_a, independent_b = np.asarray(independent_a), np.asarray(independent_b)
    state_a_error = float(np.linalg.norm(native_a-independent_a)/np.linalg.norm(independent_a))
    state_b_error = float(np.linalg.norm(native_b-independent_b)/np.linalg.norm(independent_b))
    if max(factor_a_error, factor_b_error, state_a_error, state_b_error) > 1e-10:
        raise ValueError('原生响应、拟合残量及独立完整状态空间响应不符')
    report = {'schema': 'act.passive-radiation-independent-validation.v1', 'status': 'passed',
        'generator_sha256': sha256(Path(__file__)), 'native_csv_sha256': sha256(args.native_csv),
        'fit_validation_sha256': sha256(proof_path),
        'frequencies': len(omega), 'channels': 6, 'radiation_states': size,
        'factorization_vs_original_psd_fit_relative_a_error': factor_a_error,
        'factorization_vs_original_psd_fit_relative_b_error': factor_b_error,
        'native_vs_full_scipy_state_space_relative_a_error': state_a_error,
        'native_vs_full_scipy_state_space_relative_b_error': state_b_error,
        'raw_bem_fit_relative_a_error': proof['relative_a_error'],
        'raw_bem_fit_relative_b_error': proof['relative_b_error'],
        'scope': 'numerical assembly agreement with frozen nominal fit, source BEM residuals retained'}
    write_json(args.output, report)
    print(json.dumps(report))


if __name__ == '__main__':
    main()
