"""比较同一物理几何的面元细化，保存原始残差与逐频率差异。"""

import argparse
import json
from pathlib import Path

import numpy as np
import xarray as xr
from capytaine.io.xarray import merge_complex_values

from build_destroyer_pack import sha256, write_json


def load(directory):
    provenance = json.loads((directory/'provenance.json').read_text())
    if sha256(directory/'hydro.nc') != provenance['output_sha256'] or provenance.get('input_drift'):
        raise ValueError('求解文件身份不一致')
    dataset = merge_complex_values(xr.load_dataset(directory/'hydro.nc', engine='h5netcdf'))
    return provenance, dataset


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--coarse', type=Path, required=True)
    parser.add_argument('--fine', type=Path, required=True)
    parser.add_argument('--geometry', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    coarse_proof, coarse = load(args.coarse)
    fine_proof, fine = load(args.fine)
    if coarse_proof['geometry_sha256'] != fine_proof['geometry_sha256'] or sha256(args.geometry) != fine_proof['geometry_sha256']:
        raise ValueError('粗细计算未使用同一质量、重心与惯量几何')
    for name in ['mass_kg', 'center_of_mass_m_z_up', 'forward_speed_mps', 'water_depth_m']:
        if coarse_proof['configuration'][name] != fine_proof['configuration'][name]:
            raise ValueError(f'粗细计算的{name}不一致')
    geometry = json.loads(args.geometry.read_text())
    diagonal = np.array([geometry['displacement_mass_kg']]*3
        + [geometry['inertia_about_cg_kg_m2'][key] for key in ['ixx', 'iyy', 'izz']])
    matrix_scale = 1/np.sqrt(np.outer(diagonal, diagonal))
    records = []
    for frequency in fine.omega.values:
        left, right = coarse.sel(omega=frequency), fine.sel(omega=frequency)
        record = {'omega_rad_s': float(frequency)}
        for name in ['added_mass', 'radiation_damping']:
            a = left[name].transpose('influenced_dof', 'radiating_dof').values*matrix_scale
            b = right[name].transpose('influenced_dof', 'radiating_dof').values*matrix_scale
            record[name] = {
                'mass_normalized_relative_difference': float(np.linalg.norm(a-b)/max(np.linalg.norm(b), 1e-30)),
                'coarse_mass_normalized_reciprocity_relative_error': float(np.linalg.norm(a-a.T)/max(np.linalg.norm(a), 1e-30)),
                'fine_mass_normalized_reciprocity_relative_error': float(np.linalg.norm(b-b.T)/max(np.linalg.norm(b), 1e-30))}
        for name in ['excitation_force', 'RAO']:
            a = left[name].sel(wave_direction=right.wave_direction)
            b = right[name]
            scale = np.sqrt(diagonal) if name == 'RAO' else 1/np.sqrt(diagonal)
            axis = 'radiating_dof' if name == 'RAO' else 'influenced_dof'
            weighting = xr.DataArray(scale, dims=[axis], coords={axis: b[axis]})
            difference = (a-b)*weighting
            normalized = b*weighting
            record[name] = {'mass_normalized_relative_difference': float(np.linalg.norm(difference.values)/max(np.linalg.norm(normalized.values), 1e-30))}
        records.append(record)
    write_json(args.output, {'schema': 'act.first-order-refinement.v1', 'fidelity': 'research-nominal',
        'generator_sha256': sha256(Path(__file__)), 'geometry_sha256': sha256(args.geometry),
        'coarse': coarse_proof, 'fine': fine_proof, 'frequency_comparison': records,
        'not_ready': ['full-frequency mesh convergence', 'independent vessel calibration']})
    print(json.dumps({'status': 'compared', 'frequencies': len(records), 'comparison': records}))


if __name__ == '__main__':
    main()
