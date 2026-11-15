"""独立核验声明纵倾处的BEM到FRD变换及六维功率/二次型不变性。"""

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.linalg import block_diag
from scipy.spatial.transform import Rotation

from build_destroyer_pack import sha256, write_json
from fit_passive_radiation import source_to_body_transform


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    random = np.random.default_rng(20261106)
    factor = random.normal(size=(6, 6))
    body_matrix = factor@factor.T + np.eye(6)
    records = []
    for pitch in [0.0, 0.0008612432764895889, 0.4, -0.3]:
        actual = source_to_body_transform(pitch)
        quaternion = [0.0, np.sin(pitch/2), 0.0, np.cos(pitch/2)]
        rotation = Rotation.from_quat(quaternion).inv()
        columns = rotation.apply(np.diag([1.0, -1.0, -1.0]).T).T
        expected = block_diag(columns, columns)
        source_matrix = expected.T@body_matrix@expected
        restored = actual@source_matrix@actual.T
        source_velocity, source_force = random.normal(size=6), random.normal(size=6)
        work_error = abs((actual@source_velocity)@(actual@source_force)-source_velocity@source_force)
        energy_error = abs((actual@source_velocity)@restored@(actual@source_velocity)
                           -source_velocity@source_matrix@source_velocity)
        transform_error = float(np.max(abs(actual-expected)))
        matrix_error = float(np.linalg.norm(restored-body_matrix)/np.linalg.norm(body_matrix))
        if transform_error > 1e-14 or matrix_error > 1e-14 or max(work_error, energy_error) > 1e-12:
            raise ValueError('纵倾坐标变换未保持矩阵、功率或二次型')
        records.append({'equilibrium_pitch_rad': pitch, 'scipy_quaternion_transform_error': transform_error,
            'matrix_roundtrip_relative_error': matrix_error, 'work_error': float(work_error),
            'quadratic_energy_error': float(energy_error)})
    write_json(args.output, {'schema': 'act.radiation-coordinate-validation.v1', 'status': 'passed',
        'generator_sha256': sha256(Path(__file__)),
        'fit_generator_sha256': sha256(Path(__file__).with_name('fit_passive_radiation.py')),
        'cases': records})
    print(json.dumps({'status': 'passed', 'cases': len(records),
        'maximum_transform_error': max(x['scipy_quaternion_transform_error'] for x in records)}))


if __name__ == '__main__':
    main()
