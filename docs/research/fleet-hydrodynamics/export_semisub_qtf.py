"""导出实际981差频求解，保留完整复数、原始坐标及对称性残差。"""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

from build_destroyer_pack import write_json


def file_hash(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def channel_residual(actual, expected):
    actual = np.moveaxis(actual, 2, 0).reshape(6, -1)
    expected = np.moveaxis(expected, 2, 0).reshape(6, -1)
    return [{'relative_l2': float(np.linalg.norm(a - b) / max(np.linalg.norm(b), 1e-30)),
             'max_absolute_normalized': float(np.max(np.abs(a - b)))}
            for a, b in zip(actual, expected)]


def common_rotation_exists(first, second, headings):
    for rotation in [0, 180]:
        mapped = np.mod([first + rotation, second + rotation], 360)
        if np.all((mapped >= headings[0]-1e-10) & (mapped <= headings[-1]+1e-10)):
            return True
    return False


def contribution_arrays(case_dir, execution, headings, frequencies, shape):
    lines = (case_dir/'Nemoh.cal').read_text().splitlines()
    qtf = lines.index('---QTF---')
    contribution = int(lines[qtf+4].split('!')[0])
    include_surface = int(lines[qtf+11].split('!')[0])
    if contribution not in [2, 3] or include_surface not in [0, 1]:
        raise ValueError('当前导出器需要DUOK+HASBO或四项完整贡献')
    names = ['DUOK', 'HASBO']
    if contribution == 3 and include_surface:
        names.extend(['HASFS', 'ASYMP'])
    high = np.concatenate([np.arange(offset, len(frequencies)) for offset in range(len(frequencies))])
    low = np.concatenate([np.arange(len(frequencies)-offset) for offset in range(len(frequencies))])
    canonical = high*(high+1)//2+low
    rounded_headings = np.round(np.deg2rad(headings), 3)
    arrays, proofs = {}, {}
    for name in names:
        relative = f'results/QTF/QTFM_{name}.dat'
        path = case_dir/relative
        if file_hash(path) != execution['output_sha256'][relative]:
            raise ValueError('原始差频分项哈希变化')
        rows = np.loadtxt(path, skiprows=1)
        if rows.shape != (int(np.prod(shape)), 7) or not np.isfinite(rows).all():
            raise ValueError('差频分项行数或有限值检查失败')
        rows = rows.reshape(len(headings), len(headings), len(high), 6, 7).transpose(0, 1, 3, 2, 4)
        if (not np.allclose(rows[..., 0], frequencies[high], atol=5e-7, rtol=0)
                or not np.allclose(rows[..., 1], frequencies[low], atol=5e-7, rtol=0)
                or not np.array_equal(rows[..., 4], np.broadcast_to(np.arange(1, 7)[None, None, :, None], shape))
                or not np.allclose(rows[..., 2], rounded_headings[:, None, None, None], atol=5e-7, rtol=0)
                or not np.allclose(rows[..., 3], rounded_headings[None, :, None, None], atol=5e-7, rtol=0)):
            raise ValueError('差频分项频率对、波向或通道顺序错误')
        values = np.empty(shape, dtype=np.complex128)
        values[..., canonical] = (rows[..., 5]+1j*rows[..., 6])/(1025*9.81)
        arrays[name] = values
        proofs[name] = {'sha256': file_hash(path), 'bytes': path.stat().st_size,
            'normalized_l2_per_channel': np.linalg.norm(np.moveaxis(values, 2, 0).reshape(6, -1), axis=1).tolist()}
    return arrays, proofs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--case-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--full-array', type=Path, required=True)
    args = parser.parse_args()
    execution_path = args.case_dir / 'execution.json'
    execution = json.loads(execution_path.read_text())
    metadata = json.loads((args.case_dir / 'case-provenance.json').read_text())
    raw_path = args.case_dir / 'results/QTF/OUT_QTFM_N.dat'
    if (execution['status'] != 'computed'
            or any(stage['exit_code'] != 0 for stage in execution['stages'])
            or file_hash(raw_path) != execution['output_sha256']['results/QTF/OUT_QTFM_N.dat']):
        raise ValueError('实际求解没有成功完成，或原始差频数组哈希变化')
    if (file_hash(args.case_dir / 'Nemoh.cal') != execution['configuration_sha256']
            or file_hash(args.case_dir / 'nemoh-body.dat') != metadata['mesh_sha256']):
        raise ValueError('输入几何或配置与求解证明不一致')
    mesh_lines = (args.case_dir / 'nemoh-body.dat').read_text().splitlines()
    separator = metadata['nodes'] + 1
    vertices = np.asarray([[float(value) for value in line.split()[1:4]]
                           for line in mesh_lines[1:separator]])
    faces = np.asarray([[int(value) - 1 for value in line.split()]
                        for line in mesh_lines[separator + 1:-1]])
    centers_z = vertices[faces, 2].mean(axis=1)
    lid_count = int(np.count_nonzero(centers_z == 0))
    if len(faces) != metadata['panels'] or np.any(centers_z > 0):
        raise ValueError('湿表面和水线盖板的面元计数或坐标错误')
    lines = (args.case_dir / 'Nemoh.cal').read_text().splitlines()
    heading_line = next(line for line in lines if '! Number of wave directions' in line)
    frequency_line = next(line for line in lines if '! Number of radial frequencies' in line)
    count_h, low_h, high_h = map(float, heading_line.split('!')[0].split())
    count_f, low_f, high_f = map(float, frequency_line.split('!')[0].split())
    headings = np.linspace(low_h, high_h, int(count_h))
    frequencies = np.linspace(low_f, high_f, int(count_f))
    if len(headings) < 2 or len(frequencies) < 2 or headings[0] < 0 or headings[-1] > 360:
        raise ValueError('冻结差频网格无效')
    runtime_grid = (len(headings) == 17 and np.allclose(headings, np.arange(17)*15)
        and len(frequencies) == 93 and np.allclose(frequencies, .2+np.arange(93)*.025))
    high, low = np.tril_indices(len(frequencies))
    rows = np.loadtxt(raw_path, skiprows=1, usecols=(0, 1, 2, 3, 4, 7, 8))
    shape = (len(headings), len(headings), 6, len(high))
    if rows.shape != (int(np.prod(shape)), 7) or not np.isfinite(rows).all():
        raise ValueError('差频结果的行数、列数或有限值检查失败')
    rows = rows.reshape(6, len(headings), len(headings), len(high), 7).transpose(1, 2, 0, 3, 4)
    if (not np.allclose(rows[..., 0], frequencies[high], atol=5e-7, rtol=0)
            or not np.allclose(rows[..., 1], frequencies[low], atol=5e-7, rtol=0)
            or not np.array_equal(rows[..., 4], np.broadcast_to(np.arange(1, 7)[None, None, :, None], shape))):
        raise ValueError('差频结果的频率对或六通道顺序错误')
    # NEMOH原始分项把rad波向按F12.3输出，再转回degree，报告坐标因此有舍入。
    reported_headings = rows[:, 0, 0, 0, 2].copy()
    rounded_headings = np.round(np.round(np.deg2rad(headings), 3) * 180 / np.pi, 3)
    if (not np.allclose(reported_headings, rounded_headings, atol=.001, rtol=0)
            or not np.array_equal(rows[..., 2], np.broadcast_to(reported_headings[:, None, None, None], shape))
            or not np.array_equal(rows[..., 3], np.broadcast_to(reported_headings[None, :, None, None], shape))):
        raise ValueError('差频波向与冻结输入及原始文本舍入不一致')
    coefficients = rows[..., 5] + 1j * rows[..., 6]
    del rows
    components, component_proofs = contribution_arrays(args.case_dir, execution, headings, frequencies, shape)
    component_sum = sum(components.values())
    sum_residual = channel_residual(coefficients, component_sum)
    if max(item['relative_l2'] for item in sum_residual) > 1e-6:
        raise ValueError('差频总载荷与实际分项之和不一致')
    quantized = coefficients.astype(np.complex64)
    quantization = channel_residual(quantized, coefficients)
    diagonal = coefficients[..., high == low]
    self_diagonal = diagonal[np.arange(len(headings)), np.arange(len(headings))]
    hermitian = channel_residual(diagonal, diagonal.swapaxes(0, 1).conj())
    rotation_sign = np.asarray([-1, -1, 1, -1, -1, 1])[None, None, :, None]
    rotation_pairs = [(i, int(np.argmin(abs(headings-heading-180)))) for i, heading in enumerate(headings)
        if np.min(abs(headings-heading-180)) < 1e-8]
    original, rotated = np.asarray(rotation_pairs).T if rotation_pairs else ([], [])
    half_turn = channel_residual(coefficients[rotated][:, rotated], coefficients[original][:, original]*rotation_sign) if rotation_pairs else []
    args.full_array.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(args.full_array, frequencies_rad_s=frequencies, headings_deg_to=headings,
                        reported_headings_deg=reported_headings, frequency_pair_high=high,
                        frequency_pair_low=low, qtf_normalized_complex=quantized)
    sample_indices = np.asarray([0, 8, 16, 24, 32, 48, 72, 92]) if runtime_grid else np.unique(np.linspace(0, len(frequencies)-1, min(8, len(frequencies))).astype(int))
    selected = np.isin(high, sample_indices) & np.isin(low, sample_indices)
    args.output.mkdir(parents=True, exist_ok=True)
    sample_path = args.output / 'comparison-arrays.npz'
    np.savez_compressed(sample_path, frequencies_rad_s=frequencies[sample_indices],
                        headings_deg_to=headings, reported_headings_deg=reported_headings,
                        original_frequency_pair_high=high[selected], original_frequency_pair_low=low[selected],
                        qtf_normalized_complex=coefficients[..., selected],
                        **{f'qtf_{name.lower()}_normalized_complex': values[..., selected] for name, values in components.items()})
    arbitrary_pairs = [(first, second) for first in np.arange(0, 360, 15)
                       for second in np.arange(0, 360, 15)]
    missing_pairs = [list(map(float, pair)) for pair in arbitrary_pairs if not common_rotation_exists(*pair, headings)]
    spread_pairs = [(mean + first, mean + second) for mean in np.arange(0, 360, .5)
                    for first in np.arange(-30, 31, 10) for second in np.arange(-30, 31, 10)]
    spread_coverage = all(common_rotation_exists(*pair, headings) for pair in spread_pairs)
    per_channel = []
    for dof in range(6):
        block = coefficients[:, :, dof]
        own_diagonal = self_diagonal[:, dof]
        per_channel.append({'dof_one_based': dof + 1,
            'max_absolute_normalized': float(np.max(np.abs(block))),
            'signed_self_diagonal_range_normalized': [float(own_diagonal.real.min()), float(own_diagonal.real.max())],
            'self_diagonal_max_imaginary_normalized': float(np.max(np.abs(own_diagonal.imag))),
            'self_diagonal_imaginary_relative_l2': float(np.linalg.norm(own_diagonal.imag) / max(np.linalg.norm(own_diagonal.real), 1e-30))})
    report = {'schema': 'act.semisub.qtf-validation.v1', 'status': 'computed',
        'fidelity': 'research-nominal', 'generator_sha256': file_hash(Path(__file__)),
        'solver_revision': execution['solver_revision'], 'solver_patch_sha256': execution['build_patch_sha256'],
        'source_url': execution['source_url'], 'execution_sha256': file_hash(execution_path),
        'configuration_sha256': execution['configuration_sha256'],
        'case': metadata, 'stages': execution['stages'], 'rows': int(np.prod(shape)),
        'array_dimensions': ['heading1', 'heading2', 'dof', 'triangular_frequency_pair'],
        'array_shape': list(shape), 'all_finite': True,
        'scope': f'zero-speed, depth 200m, {"+".join(components)}, difference-frequency',
        'runtime_grid': runtime_grid,
        'contributions': component_proofs, 'component_sum_residuals': sum_residual,
        'normalization': 'QTF/(rho*g), rho=1025kg/m^3, g=9.81m/s^2; preserve signed real and imaginary values',
        'axes': 'x forward, y port, z up, right-handed rotations',
        'mesh_panels': {'wetted': len(faces) - lid_count, 'irregular_frequency_lid': lid_count, 'total': metadata['panels'],
            'lid_handling': 'NEMOH BodyConditions assigns zero boundary forcing at z=0; FORCES and MQSolver exclude these panels from load integration',
            'source_revision': execution['solver_revision']},
        'body_frd_transform_six': [1, -1, -1, 1, -1, -1],
        'angular_coordinate_rounding': {'input_deg': headings.tolist(), 'reported_deg': reported_headings.tolist(),
            'reason': 'MQSolverOutputFiles writes beta in radians using F12.3; MQpostproc converts that text to degrees',
            'max_absolute_degree_difference': float(np.max(np.abs(headings - reported_headings)))},
        'equal_frequency_heading_hermitian_residuals': hermitian,
        'common_half_turn_residuals': half_turn, 'per_channel': per_channel,
        'complex64_quantization_residuals': quantization,
        'coverage': {'actual_headings_deg': headings.tolist(), 'common_rotation_degrees': [0, 180],
            'rotation_force_signs': rotation_sign.ravel().tolist(), 'spread_half_width_degrees': 30,
            'spread_pair_samples': len(spread_pairs), 'spread_pair_geometric_coverage': spread_coverage,
            'arbitrary_24_by_24_missing_pairs': missing_pairs},
        'full_array': {'file': args.full_array.name, 'bytes': args.full_array.stat().st_size,
            'sha256': file_hash(args.full_array), 'dtype': 'complex64', 'stored_separately': True},
        'comparison_array': {'sha256': file_hash(sample_path), 'frequency_indices': sample_indices.tolist()},
        'raw_output': {'bytes': raw_path.stat().st_size, 'sha256': file_hash(raw_path)},
        'not_ready': ([] if 'HASFS' in components else ['free-surface and asymptotic contributions'])+['nonzero-speed QTF',
            'mesh and peak convergence of this QTF', 'independent vessel QTF calibration',
            'unrestricted 24-by-24 directional pairs']+([] if runtime_grid else ['full frequency and directional runtime grid'])}
    if 'HASFS' in components:
        proof_path = args.case_dir/'free-surface-validation.json'
        proof = json.loads(proof_path.read_text())
        if (proof['status'] != 'passed' or proof['free_surface_sha256'] != file_hash(args.case_dir/'free-surface.dat')
                or file_hash(proof_path) != execution['input_sha256']['free-surface-validation.json']):
            raise ValueError('自由面网格与实际求解证明不一致')
        report['free_surface_mesh'] = proof
    write_json(args.output / 'validation.json', report)
    (args.output / 'Nemoh.cal').write_bytes((args.case_dir / 'Nemoh.cal').read_bytes())
    print(json.dumps({'status': report['status'], 'rows': report['rows'],
        'full_array_bytes': report['full_array']['bytes'], 'comparison_bytes': sample_path.stat().st_size,
        'half_turn_relative_l2': [item['relative_l2'] for item in half_turn],
        'hermitian_relative_l2': [item['relative_l2'] for item in hermitian],
        'missing_arbitrary_heading_pairs': len(missing_pairs)}, allow_nan=False))


if __name__ == '__main__':
    main()
