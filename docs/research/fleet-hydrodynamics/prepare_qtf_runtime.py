"""把已核验的复数差频档案导出为可由Rust直接读取的受控f32数据。"""

import argparse
import json
from pathlib import Path

import numpy as np

from build_destroyer_pack import sha256, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--validation-report', type=Path, required=True)
    parser.add_argument('--case-dir', type=Path, required=True)
    parser.add_argument('--geometry', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--sample', action='store_true')
    args = parser.parse_args()
    report = json.loads(args.validation_report.read_text())
    proof = report['comparison_array'] if args.sample else report['full_array']
    geometry = json.loads(args.geometry.read_text())
    if (sha256(args.archive) != proof['sha256']
            or sha256(args.geometry) != report['case']['geometry_sha256']
            or sha256(args.case_dir / 'Nemoh.cal') != report['configuration_sha256']):
        raise ValueError('档案、源几何或输入配置与计算证明不一致')
    with np.load(args.archive, allow_pickle=False) as archive:
        frequencies = archive['frequencies_rad_s']
        headings = np.deg2rad(archive['headings_deg_to'])
        values = archive['qtf_normalized_complex']
    expected_shape = (len(headings), len(headings), 6, len(frequencies) * (len(frequencies) + 1) // 2)
    if values.shape != expected_shape or not np.isfinite(values).all():
        raise ValueError('受控数组的形状或有限值无效')
    args.output.mkdir(parents=True, exist_ok=True)
    binary_path = args.output / 'qtf-f32le.bin'
    payload = values.astype('<c8').tobytes(order='C')
    binary_path.write_bytes(payload)
    content_hash = 0xcbf29ce484222325
    for byte in payload:
        content_hash = ((content_hash ^ byte) * 0x100000001b3) & 0xffffffffffffffff
    cal = (args.case_dir / 'Nemoh.cal').read_text().splitlines()
    metadata = {
        'schema': 'act.full-difference-qtf.v1', 'vessel': 'semisub-981',
        'model_fidelity': 'research-nominal',
        'frequencies_rad_s': frequencies.tolist(), 'headings_rad_to': headings.tolist(),
        'water_density_kg_m3': float(cal[1].split()[0]), 'gravity_m_s2': float(cal[2].split()[0]),
        'water_depth_m': float(cal[3].split()[0]), 'mean_forward_speed_mps': 0.0,
        'draft_m': geometry['draft_m'], 'mesh_sha256': report['case']['mesh_sha256'],
        'periodic_headings': False, 'half_turn_symmetry': True,
        'half_turn_relative_l2': [item['relative_l2'] for item in report['common_half_turn_residuals']],
        'storage': 'complex-f32-little-endian-heading1-heading2-dof-triangular-frequency',
        'normalization': 'qtf-divided-by-rho-g',
        'time_convention': 'real-part-of-exp-minus-i-omega-t',
        'source_axes': 'x-forward-y-port-z-up',
        'full_double_sum_factor': 0.5,
        'contributions': 'DUOK+HASBO', 'sample_only': args.sample,
        'data_sha256': sha256(binary_path), 'data_fnv1a64': f'fnv1a-{content_hash:016x}',
        'data_bytes': len(payload), 'archive_sha256': proof['sha256'],
        'validation_report_sha256': sha256(args.validation_report),
        'generator_sha256': sha256(Path(__file__)), 'solver_revision': report['solver_revision'],
        'sources': ['https://lheea.gitlab.io/Nemoh/description.html#expression-of-physical-quantities',
                    'https://lheea.gitlab.io/Nemoh/input-output.html#quadratic-transfer-function',
                    'https://doi.org/10.5281/zenodo.7418379'],
        'not_ready': report['not_ready'],
    }
    write_json(args.output / 'metadata.json', metadata)
    print(json.dumps({'status': 'computed', 'sample_only': args.sample,
        'bytes': len(payload), 'fnv1a64': metadata['data_fnv1a64'],
        'sha256': metadata['data_sha256']}))


if __name__ == '__main__':
    main()
