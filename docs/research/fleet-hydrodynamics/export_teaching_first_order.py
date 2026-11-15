"""复用已冻结BEM激励数组，装配教学一阶波浪包，保留原始误差与零速近似域。"""

import argparse
import json
from pathlib import Path

import numpy as np

from build_destroyer_pack import sha256, write_json
from build_loading_cases import fnv1a


def export_first_order(base, evidence, output, case_index=0, symmetry_proof=None):
    manifest = json.loads((base/'manifest.json').read_text())
    geometry = json.loads((base/'geometry.json').read_text())
    proof = json.loads((evidence/'validation.json').read_text())
    arrays_path = evidence/'coefficient-arrays.npz'
    if sha256(arrays_path) != proof['coefficient_arrays_sha256']:
        raise ValueError('已冻结BEM数组的身份不符')
    if not 0 <= case_index < len(proof['cases']):
        raise ValueError('代表工况索引无效')
    case = proof['cases'][case_index]
    source = case['provenance']
    configuration = source['configuration']
    source_mesh = sha256(base/'hull.dat')
    bridge = None
    if symmetry_proof is not None:
        bridge = json.loads(symmetry_proof.read_text())
        if (bridge['schema'] != 'act.symmetric-bem-mesh.validation.v1'
                or bridge['status'] != 'passed'
                or bridge['source_mesh_sha256'] != source_mesh
                or bridge['output_mesh_sha256'] != source['mesh_sha256']
                or bridge['geometry_sha256'] != source['geometry_sha256']
                or bridge['output_lid_sha256'] != source['lid_mesh_sha256']):
            raise ValueError('对称湿面证明与原船壳、求解面或质量几何身份不符')
        source_mesh = bridge['output_mesh_sha256']
    if (source['mesh_sha256'] != source_mesh
            or not np.allclose(configuration['center_of_mass_m_z_up'],
                               geometry['center_of_mass_waterline_z_up_m'], rtol=0, atol=1e-10)
            or configuration['mass_kg'] != geometry['displacement_mass_kg']
            or configuration['density_kg_m3'] != geometry['water_density_kg_m3']
            or configuration['forward_speed_mps'] != 0):
        raise ValueError('代表工况的湿面、重心、质量或零速条件与目标包不符')
    prefix = case['array_prefix']
    with np.load(arrays_path) as arrays:
        frequencies = arrays[prefix+'omega'].copy()
        headings = arrays[prefix+'wave_direction'].copy()
        dimensions = case['dimensions']['excitation_force']['dimensions']
        values = arrays[prefix+'excitation_force'].copy()
    if dimensions != ['omega', 'wave_direction', 'influenced_dof']:
        values = np.transpose(values, [dimensions.index(key)
            for key in ['omega', 'wave_direction', 'influenced_dof']])
    if not np.isfinite(values).all() or len(headings) != 24:
        raise ValueError('代表工况复数激励非有限或方向域不完整')
    if case['dof_order'] != ['Surge', 'Sway', 'Heave', 'Roll', 'Pitch', 'Yaw']:
        raise ValueError('BEM通道顺序不符')
    quantized = values.astype('<c8')[None, ...]
    errors = [float(np.linalg.norm(quantized[0, ..., axis]-values[..., axis])
                    /max(np.linalg.norm(values[..., axis]), 1e-30)) for axis in range(6)]
    waves = output
    waves.mkdir(parents=True, exist_ok=False)
    data = waves/'excitation-f32le.bin'
    data.write_bytes(quantized.tobytes(order='C'))
    metadata = {'schema': 'act.first-order-excitation.v1', 'vessel': manifest['vessel'],
        'model_fidelity': 'research-nominal', 'frequencies_rad_s': frequencies.tolist(),
        'headings_rad_to': headings.tolist(), 'forward_speeds_mps': [0.0],
        'water_depth_m': configuration['water_depth_m'], 'water_density_kg_m3': geometry['water_density_kg_m3'],
        'gravity_m_s2': 9.81, 'draft_m': geometry['draft_m'],
        'equilibrium_pitch_rad': geometry.get('equilibrium_pitch_rad', 0.0),
        'geometry_sha256': source['geometry_sha256'],
        'rigid_condition': {'mass_kg': geometry['displacement_mass_kg'],
            'center_of_mass_waterline_z_up_m': geometry['center_of_mass_waterline_z_up_m'],
            'inertia_about_cg_kg_m2': [geometry['inertia_about_cg_kg_m2'][key] for key in ['ixx', 'iyy', 'izz']]},
        'periodic_headings': True, 'storage': 'complex-f32-little-endian-speed-frequency-heading-dof',
        'normalization': 'force-per-unit-wave-amplitude-si', 'time_convention': 'real-part-of-exp-minus-i-omega-t',
        'source_axes': 'x-forward-y-port-z-up', 'data_fnv1a64': 'fnv1a-'+fnv1a(data.read_bytes()),
        'data_sha256': sha256(data), 'data_bytes': data.stat().st_size,
        'source_evidence_sha256': sha256(evidence/'validation.json'),
        'source_case_index': case_index,
        'source_mesh_sha256': source['mesh_sha256'], 'generator_sha256': sha256(Path(__file__)),
        'quantization_relative_l2_per_channel': errors,
        'teaching_approximation': 'Frozen zero-speed excitation coefficients. Actual world position retains encounter phase. Forward-speed diffraction corrections are deferred.',
        'not_ready': ['independent vessel wave calibration', 'forward-speed diffraction correction',
                      'mesh and peak convergence', 'second-order wave loads'],
        'source': 'https://capytaine.org/v2.2.1/theory_manual/theory.html'}
    if bridge is not None:
        metadata['symmetric_mesh_validation_sha256'] = sha256(symmetry_proof)
    write_json(waves/'metadata.json', metadata)
    write_json(waves/'validation.json', {
        'schema': 'act.teaching-first-order-export.v1', 'status': 'assembled-frozen-teaching-reference',
        'base_pack_manifest_sha256': sha256(base/'manifest.json'),
        'source_evidence_sha256': sha256(evidence/'validation.json'),
        'source_case_index': case_index, 'metadata_sha256': sha256(waves/'metadata.json'),
        'data_sha256': sha256(data), 'failed_source_checks': len(case['failed_matrix_checks']),
        'quantization_relative_l2_per_channel': errors,
        'approximation': metadata['teaching_approximation']})
    return {'vessel': manifest['vessel'], 'excitation_bytes': data.stat().st_size,
        'failed_source_checks': len(case['failed_matrix_checks']),
        'status': 'assembled-frozen-teaching-reference'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', type=Path, required=True)
    parser.add_argument('--evidence', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--case-index', type=int, default=0)
    parser.add_argument('--symmetry-proof', type=Path)
    args = parser.parse_args()
    print(json.dumps(export_first_order(args.base, args.evidence, args.output,
        args.case_index, args.symmetry_proof)))


if __name__ == '__main__':
    main()
