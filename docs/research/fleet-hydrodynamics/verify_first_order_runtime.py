"""用SciPy独立插值、四元数变换和完整复相位核验一阶运行表。"""

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.interpolate import RegularGridInterpolator
from scipy.spatial.transform import Rotation

from build_destroyer_pack import sha256, write_json
from build_loading_cases import fnv1a


def reference_model(directory):
    metadata = json.loads((directory/'metadata.json').read_text())
    payload = (directory/'excitation-f32le.bin').read_bytes()
    if (metadata['data_sha256'] != sha256(directory/'excitation-f32le.bin')
            or metadata['data_fnv1a64'] != 'fnv1a-'+fnv1a(payload)):
        raise ValueError('独立读取的一阶数组身份无效')
    speeds = np.asarray(metadata['forward_speeds_mps'])
    omega = np.asarray(metadata['frequencies_rad_s'])
    headings = np.asarray(metadata['headings_rad_to'])
    values = np.frombuffer(payload, dtype='<c8').reshape(len(speeds), len(omega), len(headings), 6).astype(complex)
    if metadata['periodic_headings']:
        values = np.concatenate([values, values[:, :, :1]], axis=2)
        headings = np.r_[headings, headings[0]+2*np.pi]
    interpolation = RegularGridInterpolator((speeds, omega, headings), values, bounds_error=True)
    rotation = Rotation.from_euler('y', metadata['equilibrium_pitch_rad']).as_matrix()
    transform = rotation.T@np.diag([1, -1, -1])

    def lookup(frequency, direction, speed):
        source = interpolation([[speed, frequency, (-direction) % (2*np.pi)]])[0]
        return np.r_[transform@source[:3], transform@source[3:]]
    return metadata, lookup


def force(lookup, components, mean_heading, speed, time, north, east):
    output = np.zeros(6)
    for component in components:
        direction = component['direction']
        phase = component['omega']*time-component['k']*(north*np.cos(direction)+east*np.sin(direction))+component['phase']
        coefficient = lookup(component['omega'], direction-mean_heading, speed)
        output += (coefficient*component['amplitude']*np.exp(-1j*phase)).real
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime-dir', type=Path, required=True)
    parser.add_argument('--native-report', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    metadata, lookup = reference_model(args.runtime_dir)
    speed = metadata['forward_speeds_mps'][0]
    lookup_cases = []
    for frequency, direction in [(.2, 0), (.218, -.01), (.875, .21), (1.313, 2.7), (2.5, -1.1), (3.99, 6.27)]:
        expected = lookup(frequency, direction, speed)
        lookup_cases.append({'input': [frequency, direction, speed],
                             'expected_real_imag': np.column_stack([expected.real, expected.imag]).tolist()})
    field = {'components': [
        {'omega': .209, 'k': .02, 'amplitude': .3, 'direction': .2, 'phase': .1},
        {'omega': .9, 'k': .09, 'amplitude': .4, 'direction': 1.0, 'phase': .7},
        {'omega': 2.49, 'k': .63, 'amplitude': .2, 'direction': 2.0, 'phase': 1.7}],
        'condition': {'hs_m': .75, 'tp_s': 7, 'direction_to_deg': 90, 'water_depth_m': metadata['water_depth_m']},
        'second_order_available': False}
    heading = .13
    actual_rotation = Rotation.from_euler('ZYX', [.7, -.08, .1])
    reference_rotation = Rotation.from_euler('ZYX', [heading, metadata['equilibrium_pitch_rad'], 0])
    relative = actual_rotation.inv()*reference_rotation
    quaternion = actual_rotation.as_quat()
    quaternion = np.r_[quaternion[3], quaternion[:3]].tolist()
    force_cases = []
    for time, north, east in [(0, 0, 0), (.5, 25, -30), (1, -18, 12), (10, 100, 20)]:
        expected = force(lookup, field['components'], heading, speed, time, north, east)
        body = np.r_[relative.apply(expected[:3]), relative.apply(expected[3:])]
        force_cases.append({'time_s': time, 'north_m': north, 'east_m': east,
            'expected_reference_frd_si': expected.tolist(), 'quaternion_wxyz': quaternion,
            'expected_body_frd_si': body.tolist()})
    report = {'schema': 'act.first-order-runtime.independent-validation.v1', 'status': 'passed',
        'generator_sha256': sha256(Path(__file__)), 'metadata_sha256': sha256(args.runtime_dir/'metadata.json'),
        'data_sha256': sha256(args.runtime_dir/'excitation-f32le.bin'),
        'lookup_cases': lookup_cases, 'field': field, 'mean_heading_rad': heading,
        'mean_speed_mps': speed, 'force_cases': force_cases}
    if args.native_report:
        native = json.loads(args.native_report.read_text())
        if native['metadata_bytes_fnv1a64'] != 'fnv1a-'+fnv1a((args.runtime_dir/'metadata.json').read_bytes()):
            raise ValueError('原生数值报告与一阶运行表身份不一致')
        wave = json.loads((args.native_report.parent/native['wave_file']).read_text())
        trace = np.loadtxt(args.native_report.parent/native['trace_file'], delimiter=',', skiprows=1)
        expected = np.array([force(lookup, wave['components'], native['mean_heading_rad'], native['mean_speed_mps'],
            row[0], row[1], row[2]) for row in trace])
        errors = np.linalg.norm(trace[:, 3:9]-expected, axis=0)/np.maximum(np.linalg.norm(expected, axis=0), 1e-30)
        if np.any(errors > 1e-11):
            raise ValueError('完整波场的原生一阶载荷与独立复数合成不一致')
        report['native_comparison'] = {'rows': len(trace), 'wave_components': len(wave['components']),
            'relative_l2_per_channel': errors.tolist(), 'native_report_sha256': sha256(args.native_report),
            'trace_sha256': sha256(args.native_report.parent/native['trace_file'])}
    write_json(args.output, report)
    print(json.dumps({'status': 'passed', 'lookup_cases': len(lookup_cases), 'force_cases': len(force_cases),
                      'native_comparison': report.get('native_comparison')}))


if __name__ == '__main__':
    main()
