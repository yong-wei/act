"""把同一加载/水深的Capytaine复数激励导出为受控一阶波浪运行表。"""

import argparse
import json
from pathlib import Path

from capytaine.io.xarray import merge_complex_values
import numpy as np
import xarray as xr

from build_destroyer_pack import sha256, write_json
from build_loading_cases import fnv1a


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--first-order-dirs', type=Path, nargs='+', required=True)
    parser.add_argument('--geometry', type=Path, required=True)
    parser.add_argument('--vessel', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    generator_sha = sha256(Path(__file__))
    geometry_sha = sha256(args.geometry)
    geometry = json.loads(args.geometry.read_text())
    sources, rows = [], []
    frequencies = headings = depth = density = gravity = None
    for directory in args.first_order_dirs:
        proof = json.loads((directory/'provenance.json').read_text())
        if (proof.get('input_drift') or proof['geometry_sha256'] != geometry_sha
                or proof['output_sha256'] != sha256(directory/'hydro.nc')
                or proof['solver']['version'] != '2.2.1'):
            raise ValueError('一阶源数据与冻结几何、输出身份或求解器版本不一致')
        configuration = proof['configuration']
        source_depth = float(configuration['water_depth_m'])
        source_density = float(configuration['density_kg_m3'])
        with xr.open_dataset(directory/'hydro.nc') as raw:
            dataset = merge_complex_values(raw)
            values = (dataset['diffraction_force']+dataset['Froude_Krylov_force']).transpose(
                'omega', 'wave_direction', 'influenced_dof').values
            source_frequencies = dataset.omega.values.copy()
            source_headings = dataset.wave_direction.values.copy()
            dofs = list(map(str, dataset.influenced_dof.values))
            source_gravity = float(dataset.g.values)
        if dofs != ['Surge', 'Sway', 'Heave', 'Roll', 'Pitch', 'Yaw'] or not np.isfinite(values).all():
            raise ValueError('一阶复数通道顺序或有限值无效')
        if frequencies is None:
            frequencies, headings, depth = source_frequencies, source_headings, source_depth
            density, gravity = source_density, source_gravity
        if (not np.array_equal(frequencies, source_frequencies) or not np.array_equal(headings, source_headings)
                or depth != source_depth or density != source_density or gravity != source_gravity
                or density != geometry['water_density_kg_m3'] or gravity != 9.81):
            raise ValueError('不同航速源数据的频率、波向或水深网格不一致')
        rows.append((configuration['forward_speed_mps'], values))
        sources.append({'provenance_sha256': sha256(directory/'provenance.json'),
                        'provenance': proof})
    rows.sort(key=lambda row: row[0])
    speeds = np.asarray([row[0] for row in rows], dtype=float)
    if not np.isfinite(speeds).all() or speeds[0] < 0 or np.any(np.diff(speeds) <= 0):
        raise ValueError('平均航速须为非负、有限且独立的网格点')
    original = np.asarray([row[1] for row in rows])
    quantized = original.astype('<c8')
    if not np.isfinite(quantized).all():
        raise ValueError('一阶复数系数超出f32有限范围')
    errors = [float(np.linalg.norm(quantized[..., channel]-original[..., channel])
                    /max(np.linalg.norm(original[..., channel]), 1e-30)) for channel in range(6)]
    args.output.mkdir(parents=True, exist_ok=False)
    data_path = args.output/'excitation-f32le.bin'
    payload = quantized.tobytes(order='C')
    data_path.write_bytes(payload)
    metadata = {'schema': 'act.first-order-excitation.v1', 'vessel': args.vessel,
        'model_fidelity': 'research-nominal', 'frequencies_rad_s': frequencies.tolist(),
        'headings_rad_to': headings.tolist(), 'forward_speeds_mps': speeds.tolist(),
        'water_depth_m': depth, 'water_density_kg_m3': density, 'gravity_m_s2': gravity,
        'draft_m': geometry['draft_m'],
        'equilibrium_pitch_rad': geometry.get('equilibrium_pitch_rad', 0.0),
        'geometry_sha256': geometry_sha,
        'periodic_headings': bool(np.allclose(headings, np.arange(24)*np.pi/12, rtol=0, atol=1e-12)),
        'storage': 'complex-f32-little-endian-speed-frequency-heading-dof',
        'normalization': 'force-per-unit-wave-amplitude-si',
        'time_convention': 'real-part-of-exp-minus-i-omega-t',
        'source_axes': 'x-forward-y-port-z-up', 'data_fnv1a64': 'fnv1a-'+fnv1a(payload),
        'data_sha256': sha256(data_path), 'data_bytes': len(payload), 'generator_sha256': generator_sha,
        'source_provenances': sources, 'quantization_relative_l2_per_channel': errors,
        'not_ready': ['independent vessel wave calibration', 'speeds outside the actual data grid'],
        'source': 'https://capytaine.org/v2.2.1/theory_manual/theory.html'}
    if geometry_sha != sha256(args.geometry) or generator_sha != sha256(Path(__file__)):
        raise ValueError('运行表导出时源几何或生成器发生变化')
    write_json(args.output/'metadata.json', metadata)
    write_json(args.output/'validation.json', {'schema': 'act.first-order-runtime.validation.v1',
        'status': 'computed', 'model_fidelity': 'research-nominal',
        'generator_sha256': generator_sha, 'metadata_sha256': sha256(args.output/'metadata.json'),
        'data_sha256': sha256(data_path), 'array_shape_speed_frequency_heading_channel': list(quantized.shape),
        'quantization_relative_l2_per_channel': errors,
        'source_reference_checks': [source['provenance']['status'] for source in sources]})
    print(json.dumps({'status': 'computed', 'vessel': args.vessel,
        'data_bytes': len(payload), 'speeds_mps': speeds.tolist(), 'water_depth_m': depth}))


if __name__ == '__main__':
    main()
