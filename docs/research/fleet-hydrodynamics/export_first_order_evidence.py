"""保存实际一阶求解的原始数组、维度、数值检查及适用域状态。"""

import argparse
import json
from pathlib import Path

import numpy as np
import xarray as xr
from capytaine.io.xarray import merge_complex_values

from build_destroyer_pack import sha256, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--first-order-dirs', type=Path, nargs='+', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    arrays = {}
    report = {'schema': 'act.vessel.first-order-evidence.v1', 'fidelity': 'research-nominal',
        'generator_sha256': sha256(Path(__file__)), 'cases': [],
        'coefficient_axes': 'Capytaine x-forward, y-port, z-up, right-handed rotation',
        'body_frd_transform_six': [1, -1, -1, 1, -1, -1],
        'not_ready': ['independent vessel calibration', 'mesh and peak convergence',
                      'validated forward-speed radiation realization', 'online wave-domain consumption']}
    for index, directory in enumerate(args.first_order_dirs):
        provenance = json.loads((directory/'provenance.json').read_text())
        output = directory/'hydro.nc'
        if sha256(output) != provenance['output_sha256']:
            raise ValueError('求解数组与输入证明哈希不符')
        dataset = merge_complex_values(xr.load_dataset(output, engine='h5netcdf'))
        frozen = provenance['configuration']
        if (not np.array_equal(dataset.omega.values, frozen['frequencies_rad_s'])
                or not np.array_equal(dataset.wave_direction.values, np.deg2rad(frozen['headings_deg_to']))):
            raise ValueError('数组频率或波向与冻结工况不一致')
        prefix = f'case{index}_'
        dimensions = {}
        for coordinate in ['omega', 'wave_direction', 'forward_speed']:
            if coordinate in dataset.coords:
                arrays[prefix+coordinate] = dataset[coordinate].values
        for quantity in ['added_mass', 'radiation_damping', 'excitation_force', 'RAO']:
            values = dataset[quantity]
            if not np.isfinite(values.values).all():
                raise ValueError(f'求解{quantity}包含非有限值')
            arrays[prefix+quantity] = values.values
            dimensions[quantity] = {'dimensions': list(values.dims), 'shape': list(values.shape)}
        failures = [record for record in provenance['checks']
                    if record.get('symmetry_relative_error', 0) > 0.01
                    or record.get('normalized_min_eigenvalue', 0) < -0.01]
        report['cases'].append({'array_prefix': prefix, 'all_finite': True,
            'dimensions': dimensions, 'dof_order': dataset.radiating_dof.values.tolist(),
            'raw_dataset_sha256': sha256(output), 'provenance_sha256': sha256(directory/'provenance.json'),
            'provenance': provenance, 'failed_matrix_checks': failures})
    args.output.mkdir(parents=True, exist_ok=True)
    arrays_path = args.output/'coefficient-arrays.npz'
    np.savez_compressed(arrays_path, **arrays)
    report['coefficient_arrays_sha256'] = sha256(arrays_path)
    write_json(args.output/'validation.json', report)
    print(json.dumps({'cases': len(report['cases']), 'arrays_bytes': arrays_path.stat().st_size,
        'failed_matrix_checks': [len(case['failed_matrix_checks']) for case in report['cases']],
        'status': 'computed, validation incomplete'}))


if __name__ == '__main__':
    main()
