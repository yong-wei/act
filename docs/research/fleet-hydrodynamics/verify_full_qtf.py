"""用SciPy四维插值及完整有序复数双重和独立生成差频回归数据。"""

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.interpolate import RegularGridInterpolator

from build_destroyer_pack import sha256, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--native-runtime-report', type=Path)
    args = parser.parse_args()
    metadata = json.loads((args.runtime_dir / 'metadata.json').read_text())
    binary = args.runtime_dir / 'qtf-f32le.bin'
    if sha256(binary) != metadata['data_sha256']:
        raise ValueError('系数数据与受控清单不符')
    frequencies = np.asarray(metadata['frequencies_rad_s'])
    headings = np.asarray(metadata['headings_rad_to'])
    nf, nd = len(frequencies), len(headings)
    triangular = np.fromfile(binary, dtype='<c8').reshape(nd, nd, 6, nf * (nf + 1) // 2)
    dense = np.zeros((nf, nf, nd, nd, 6), dtype=np.complex128)
    for index, (high, low) in enumerate(zip(*np.tril_indices(nf))):
        dense[high, low] = triangular[..., index]
        if high != low:
            dense[low, high] = triangular[..., index].swapaxes(0, 1).conj()
    interpolate = RegularGridInterpolator((frequencies, frequencies, headings, headings), dense, bounds_error=True)
    frd = np.asarray([1, -1, -1, 1, -1, -1])
    half_turn = np.asarray([-1, -1, 1, -1, -1, 1])

    def lookup(first, second, direction1, direction2):
        for rotation in [0, np.pi]:
            mapped = np.mod([-direction1 + rotation, -direction2 + rotation], 2 * np.pi)
            if np.all(mapped >= headings[0]) and np.all(mapped <= headings[-1]):
                value = interpolate([[first, second, *mapped]])[0]
                return value * frd * (half_turn if rotation else 1) * metadata['water_density_kg_m3'] * metadata['gravity_m_s2']
        raise ValueError('方向对未得到实际网格覆盖')

    lookup_inputs = [[.8, .6, -np.pi / 6, -np.pi / 3], [.6, .8, -np.pi / 3, -np.pi / 6],
        [.71, .83, np.deg2rad(173), np.deg2rad(197)], [.8, .8, -np.pi / 12, -np.pi / 4],
        [.55, 1.17, np.deg2rad(10), np.deg2rad(25)]]
    lookups = [{'input': values, 'expected_si_real_imag': np.column_stack([lookup(*values).real, lookup(*values).imag]).tolist()}
               for values in lookup_inputs]
    components = []
    gravity = metadata['gravity_m_s2']
    depth = metadata['water_depth_m']
    for frequency, amplitude, direction, phase in [(.55, .15, .3, .4), (.73, .2, .5, 1.3),
                                                  (.73, .1, .7, 2.4), (1.31, .08, .4, 1.9)]:
        # 独立二分有限水深色散关系。
        low, high = 0.0, max(1.0, frequency**2 / gravity * 2)
        for _ in range(100):
            middle = (low + high) / 2
            if gravity * middle * np.tanh(middle * depth) < frequency**2:
                low = middle
            else:
                high = middle
        components.append({'omega': frequency, 'k': (low + high) / 2,
            'amplitude': amplitude, 'direction': direction, 'phase': phase})
    mean_heading = .1
    coefficients = np.asarray([[lookup(a['omega'], b['omega'], a['direction'] - mean_heading,
        b['direction'] - mean_heading) for b in components] for a in components])
    cases = []
    for time, north, east in [(0, 0, 0), (3.7, 10, -20), (20.1, -3, 7)]:
        phasor = np.asarray([component['amplitude'] * np.exp(-1j * (component['omega'] * time
            - component['k'] * (north * np.cos(component['direction']) + east * np.sin(component['direction']))
            + component['phase'])) for component in components])
        ordered_sum = .5 * np.einsum('ijc,i,j->c', coefficients, phasor, phasor.conj()).real
        cases.append({'time_s': time, 'north_m': north, 'east_m': east, 'expected_frd_si': ordered_sum.tolist()})
    report = {'schema': 'act.full-qtf.reference.v1', 'status': 'passed',
        'generator_sha256': sha256(Path(__file__)), 'data_sha256': metadata['data_sha256'],
        'metadata_sha256': sha256(args.runtime_dir / 'metadata.json'), 'lookup_cases': lookups,
        'field': {'components': components, 'condition': {'hs_m': .75, 'tp_s': 7,
            'direction_to_deg': 90, 'water_depth_m': depth}, 'second_order_available': True},
        'mean_heading_rad': mean_heading, 'force_cases': cases,
        'reference': 'SciPy RegularGridInterpolator, reconstructed full complex matrix, ordered double sum factor 1/2',
        'source_frequency_count': nf, 'sample_only': metadata['sample_only'],
        'scope': 'controlled source arrays; validates runtime algebra and interpolation, excludes source-grid convergence'}
    if args.native_runtime_report:
        native = json.loads(args.native_runtime_report.read_text())
        wave_path = args.native_runtime_report.with_name(native['wave_file'])
        trace_path = args.native_runtime_report.with_name(native['trace_file'])
        field = json.loads(wave_path.read_text())
        wave = field['components']
        if len(wave) != native['wave_components'] or native['source_declared_sha256'] != metadata['data_sha256']:
            raise ValueError('原生运行波场或系数引用不符')
        omega = np.asarray([component['omega'] for component in wave])
        directions = np.asarray([component['direction'] for component in wave])
        mapped = np.mod(-(directions - native['mean_heading_rad']), 2 * np.pi)
        direction1, direction2 = np.meshgrid(mapped, mapped, indexing='ij')
        rotate = (direction1 < headings[0]) | (direction1 > headings[-1]) | (direction2 < headings[0]) | (direction2 > headings[-1])
        direction1 = np.mod(direction1 + rotate * np.pi, 2 * np.pi)
        direction2 = np.mod(direction2 + rotate * np.pi, 2 * np.pi)
        frequency1, frequency2 = np.meshgrid(omega, omega, indexing='ij')
        query = np.column_stack([frequency1.ravel(), frequency2.ravel(), direction1.ravel(), direction2.ravel()])
        kernel = interpolate(query).reshape(len(wave), len(wave), 6)
        kernel *= np.where(rotate[..., None], half_turn, 1) * frd * metadata['water_density_kg_m3'] * metadata['gravity_m_s2']
        trace = np.loadtxt(trace_path, delimiter=',', skiprows=1)
        phases = np.asarray([component['phase'] for component in wave])
        amplitudes = np.asarray([component['amplitude'] for component in wave])
        independent = []
        for time in trace[:, 0]:
            phasor = amplitudes * np.exp(-1j * (omega * time + phases))
            independent.append(.5 * np.einsum('ijc,i,j->c', kernel, phasor, phasor.conj()).real)
        independent = np.asarray(independent)
        errors = np.linalg.norm(independent - trace[:, 1:], axis=0) / np.maximum(np.linalg.norm(independent, axis=0), 1e-30)
        if not np.isfinite(errors).all() or np.any(errors > 1e-10):
            raise ValueError(f'原生完整差频轨迹与独立双重和不符 {errors}')
        report['native_comparison'] = {'status': 'passed', 'components': len(wave), 'samples': len(trace),
            'relative_l2_by_channel': errors.tolist(),
            'max_absolute_difference_si': np.max(np.abs(independent - trace[:, 1:]), axis=0).tolist(),
            'native_report_sha256': sha256(args.native_runtime_report),
            'wave_field_sha256': sha256(wave_path), 'native_trace_sha256': sha256(trace_path)}
    write_json(args.output, report)
    print(json.dumps({'status': 'passed', 'lookups': len(lookups), 'force_cases': len(cases)}))


if __name__ == '__main__':
    main()
