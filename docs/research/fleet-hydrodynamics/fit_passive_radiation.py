"""从冻结零速A/B联合拟合半正定残量振子与同源A_inf，保留实际拟合误差。"""

import argparse
import json
import time
from pathlib import Path

import numpy as np
import xarray as xr
from capytaine.io.xarray import merge_complex_values
from scipy.optimize import minimize

from build_destroyer_pack import sha256, write_json


def fit_block(omega, raw_a, raw_b, natural_start, damping_start, iterations, projected_iterations):
    count, dimension = len(natural_start), raw_a.shape[1]
    weights = 1/np.sqrt(omega)
    weight_a = weights/np.linalg.norm(weights[:, None, None]*raw_a)
    weight_b = weights/np.linalg.norm(weights[:, None, None]*raw_b)
    desired = np.concatenate([raw_b*weight_b[:, None, None], raw_a*weight_a[:, None, None]])

    def model(parameters, details=False):
        natural, damping = np.exp(parameters[:count]), np.exp(parameters[count:])
        s = 1j*omega[:, None]
        denominator = s*s+2*damping*natural*s+natural*natural
        phi = s/denominator
        basis_a = np.column_stack([phi.imag/omega[:, None], np.ones(len(omega))])
        basis_b = np.column_stack([phi.real, np.zeros(len(omega))])
        basis = np.concatenate([basis_b*weight_b[:, None], basis_a*weight_a[:, None]])
        norms = np.linalg.norm(basis, axis=0)
        design = basis/norms
        gram = design.T@design
        forcing = np.einsum('fk,fij->kij', design, desired)
        step = 1/np.linalg.eigvalsh(gram).max()
        matrices = np.zeros((count+1, dimension, dimension))
        accelerated, rate = matrices.copy(), 1.0
        for _ in range(projected_iterations):
            gradient = np.einsum('kl,lij->kij', gram, accelerated)-forcing
            candidate = accelerated-step*gradient
            eigenvalues, eigenvectors = np.linalg.eigh((candidate+candidate.swapaxes(1, 2))/2)
            updated = np.einsum('kij,kj,klj->kil', eigenvectors, np.maximum(eigenvalues, 0), eigenvectors)
            next_rate = (1+np.sqrt(1+4*rate*rate))/2
            accelerated = updated+(rate-1)/next_rate*(updated-matrices)
            matrices, rate = updated, next_rate
        matrices = matrices/norms[:, None, None]
        residual = np.einsum('fk,kij->fij', basis, matrices)-desired
        if details:
            memory = np.einsum('fk,kij->fij', phi, matrices[:-1])
            return natural, damping, matrices, matrices[-1]+memory.imag/omega[:, None, None], memory.real
        derivatives = [-s*(2*natural**2+2*damping*natural*s)/denominator**2,
            -s*(2*damping*natural*s)/denominator**2]
        gradient = []
        for derivative in derivatives:
            scaled = np.concatenate([derivative.real*weight_b[:, None],
                derivative.imag/omega[:, None]*weight_a[:, None]])
            direction = np.einsum('fk,kij->kfij', scaled, matrices[:-1])
            gradient.extend(np.einsum('fij,kfij->k', residual, direction))
        return 0.5*np.linalg.norm(residual)**2, np.asarray(gradient)

    started = time.monotonic()
    result = minimize(model, np.r_[np.log(natural_start), np.log(damping_start)], jac=True, method='L-BFGS-B',
        bounds=[(np.log(.02), np.log(15))]*count+[(np.log(.01), np.log(5))]*count,
        options={'maxiter': iterations, 'ftol': 1e-10, 'gtol': 1e-7, 'maxls': 20})
    natural, damping, matrices, predicted_a, predicted_b = model(result.x, details=True)
    report = {'success': bool(result.success), 'message': str(result.message), 'iterations': int(result.nit),
        'seconds': time.monotonic()-started, 'relative_a_error': float(np.linalg.norm(predicted_a-raw_a)/np.linalg.norm(raw_a)),
        'relative_b_error': float(np.linalg.norm(predicted_b-raw_b)/np.linalg.norm(raw_b)),
        'weighted_a_error': float(np.linalg.norm(weight_a[:, None, None]*(predicted_a-raw_a))),
        'weighted_b_error': float(np.linalg.norm(weight_b[:, None, None]*(predicted_b-raw_b)))}
    return natural, damping, matrices, predicted_a, predicted_b, report


def factors(matrix):
    eigenvalues, eigenvectors = np.linalg.eigh((matrix+matrix.T)/2)
    result = []
    for index, value in enumerate(eigenvalues):
        if value > 0:
            vector = np.sqrt(value)*eigenvectors[:, index]
            if vector[np.argmax(abs(vector))] < 0:
                vector *= -1
            result.append(vector)
    return result


def discrete_stability(parameters, rigid_diagonal):
    count = len(parameters['oscillators'])
    size = 6+2*count
    state_matrix, energy = np.zeros((size, size)), np.zeros((size, size))
    added_mass = sum((np.outer(vector, vector) for vector in parameters['added_mass_factors']), np.zeros((6, 6)))
    mass = np.diag(rigid_diagonal)+added_mass
    energy[:6, :6] = mass
    for index, mode in enumerate(parameters['oscillators']):
        position, rate = 6+2*index, 7+2*index
        coupling = np.asarray(mode['coupling'])
        natural = mode['natural_frequency_rad_s']
        state_matrix[:6, rate] = -np.linalg.solve(mass, coupling)
        state_matrix[position, rate] = 1.0
        state_matrix[rate, :6] = coupling
        state_matrix[rate, position] = -natural**2
        state_matrix[rate, rate] = -2*mode['damping_ratio']*natural
        energy[position, position], energy[rate, rate] = natural**2, 1.0
    energy_factor = np.linalg.cholesky(energy).T
    normalized = energy_factor@state_matrix@np.linalg.inv(energy_factor)
    poles = np.linalg.eigvals(normalized)
    samples = []
    for dt in [1/120, 1/240]:
        value = dt*normalized
        update = np.eye(size)+value+value@value/2+np.linalg.matrix_power(value, 3)/6+np.linalg.matrix_power(value, 4)/24
        amplification = float(np.linalg.eigvalsh(update.T@update).max())
        samples.append({'dt_s': dt, 'maximum_energy_amplification': amplification,
            'spectral_radius': float(abs(np.linalg.eigvals(update)).max())})
        if amplification > 1+1e-10:
            raise ValueError('耦合刚体/辐射的固定步长更新超出储能收缩容差')
    if poles.real.max() > 1e-10:
        raise ValueError('耦合刚体/辐射连续极点不稳定')
    return {'state_count': size, 'maximum_continuous_pole_real_per_s': float(poles.real.max()),
        'energy_symmetric_part_max_eigenvalue': float(np.linalg.eigvalsh(normalized+normalized.T).max()),
        'updates': samples}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--first-order-dirs', type=Path, nargs='+', required=True)
    parser.add_argument('--geometry', type=Path, required=True)
    parser.add_argument('--initialization', type=Path, required=True)
    parser.add_argument('--frequency-min', type=float, default=.025)
    parser.add_argument('--frequency-max', type=float, default=2.5)
    parser.add_argument('--iterations', type=int, default=2000)
    parser.add_argument('--projected-iterations', type=int, default=3000)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    generator_sha = sha256(Path(__file__))
    geometry_sha, initialization_sha = sha256(args.geometry), sha256(args.initialization)
    geometry = json.loads(args.geometry.read_text())
    initialization = json.loads(args.initialization.read_text())
    blocks = initialization['blocks']
    axes = [axis for block in blocks for axis in block['axes']]
    if (sorted(axes) != list(range(6)) or any(not 2 <= len(block['natural_frequency_rad_s']) <= 12 for block in blocks)
            or args.iterations <= 0 or args.projected_iterations <= 0
            or not 0 < args.frequency_min < args.frequency_max):
        raise ValueError('拟合通道、频带或阶数/迭代设置无效')
    diagonal = np.array([geometry['displacement_mass_kg']]*3
        + [geometry['inertia_about_cg_kg_m2'][key] for key in ['ixx', 'iyy', 'izz']])
    scale = np.array([1, -1, -1, 1, -1, -1])/np.sqrt(diagonal)
    sources, records, frequencies = [], [], set()
    for directory in args.first_order_dirs:
        provenance = json.loads((directory/'provenance.json').read_text())
        if (sha256(directory/'hydro.nc') != provenance['output_sha256']
                or provenance['configuration']['forward_speed_mps'] != 0 or provenance.get('input_drift')
                or not np.allclose(provenance['configuration']['center_of_mass_m_z_up'],
                    geometry['center_of_mass_waterline_z_up_m'], rtol=0, atol=1e-10)
                or not np.isclose(provenance['configuration']['mass_kg'], diagonal[0], rtol=1e-12)):
            raise ValueError('求解源身份、零速状态或CG/质量与拟合基准不一致')
        dataset = merge_complex_values(xr.load_dataset(directory/'hydro.nc', engine='h5netcdf'))
        added = dataset.added_mass.transpose('omega', 'influenced_dof', 'radiating_dof').values
        damping = dataset.radiation_damping.transpose('omega', 'influenced_dof', 'radiating_dof').values
        for index, frequency in enumerate(dataset.omega.values):
            if args.frequency_min <= frequency <= args.frequency_max:
                if frequency in frequencies:
                    raise ValueError('频率输入重叠')
                frequencies.add(frequency)
                records.append((frequency, added[index], damping[index]))
        sources.append({'dataset_sha256': provenance['output_sha256'],
            'provenance_sha256': sha256(directory/'provenance.json'), 'provenance': provenance})
    records.sort(key=lambda record: record[0])
    omega = np.asarray([record[0] for record in records])
    raw_a = np.asarray([record[1] for record in records])*np.outer(scale, scale)
    raw_b = np.asarray([record[2] for record in records])*np.outer(scale, scale)
    if len(omega) < 10 or not np.isfinite([raw_a, raw_b]).all():
        raise ValueError('拟合数据不足或包含非有限值')
    predicted_a, predicted_b = np.zeros_like(raw_a), np.zeros_like(raw_b)
    parameters = {'schema': 'act.passive-radiation.v1', 'frequency_band_rad_s': [float(omega[0]), float(omega[-1])],
        'added_mass_factors': [], 'oscillators': []}
    reports, arrays = [], {}
    for block in blocks:
        selected = block['axes']
        natural, damping, matrices, fitted_a, fitted_b, report = fit_block(omega,
            raw_a[:, selected][:, :, selected], raw_b[:, selected][:, :, selected],
            block['natural_frequency_rad_s'], block['damping_ratio'], args.iterations, args.projected_iterations)
        for row, axis in enumerate(selected):
            for column, other in enumerate(selected):
                predicted_a[:, axis, other], predicted_b[:, axis, other] = fitted_a[:, row, column], fitted_b[:, row, column]
        for vector in factors(matrices[-1]):
            physical = np.zeros(6)
            physical[selected] = vector*np.sqrt(diagonal[selected])
            parameters['added_mass_factors'].append(physical.tolist())
        for index in range(len(natural)):
            for vector in factors(matrices[index]):
                physical = np.zeros(6)
                physical[selected] = vector*np.sqrt(diagonal[selected])
                parameters['oscillators'].append({'natural_frequency_rad_s': float(natural[index]),
                    'damping_ratio': float(damping[index]), 'coupling': physical.tolist()})
        report['axes'] = selected
        reports.append(report)
        prefix = 'block'+''.join(map(str, selected))+'_'
        arrays.update({prefix+'natural': natural, prefix+'damping': damping, prefix+'matrices_normalized': matrices})
        print(json.dumps(report), flush=True)
    stability = discrete_stability(parameters, diagonal)
    if (sha256(Path(__file__)) != generator_sha or sha256(args.geometry) != geometry_sha
            or sha256(args.initialization) != initialization_sha):
        raise ValueError('拟合过程中生成器或固定输入发生变化')
    args.output.mkdir(parents=True, exist_ok=False)
    arrays.update(omega=omega, raw_a_normalized=raw_a, raw_b_normalized=raw_b,
        predicted_a_normalized=predicted_a, predicted_b_normalized=predicted_b, rigid_diagonal=diagonal)
    np.savez_compressed(args.output/'fit-arrays.npz', **arrays)
    write_json(args.output/'radiation.json', parameters)
    report = {'schema': 'act.passive-radiation-fit.v1', 'fidelity': 'research-nominal',
        'generator_sha256': generator_sha, 'geometry_sha256': geometry_sha, 'initialization_sha256': initialization_sha,
        'status': 'computed', 'sources': sources, 'blocks': reports, 'projected_iterations': args.projected_iterations,
        'normalization': 'FRD congruence by inverse square root of rigid-body diagonal',
        'objective_weights': 'omega^-1/2, separate unit global norms of A and B in each symmetry block',
        'relative_a_error': float(np.linalg.norm(predicted_a-raw_a)/np.linalg.norm(raw_a)),
        'relative_b_error': float(np.linalg.norm(predicted_b-raw_b)/np.linalg.norm(raw_b)),
        'discrete_stability': stability, 'radiation_sha256': sha256(args.output/'radiation.json'),
        'fit_arrays_sha256': sha256(args.output/'fit-arrays.npz'),
        'not_ready': ['independent vessel calibration', 'validated forward-speed realization', 'online physical assembly']}
    write_json(args.output/'validation.json', report)
    print(json.dumps({'status': 'computed', 'oscillators': len(parameters['oscillators']),
        'relative_a_error': report['relative_a_error'], 'relative_b_error': report['relative_b_error'],
        'discrete_stability': stability}), flush=True)


if __name__ == '__main__':
    main()
