"""冻结同一船壳和固定质量分布的加载状态，运行时共享完整船壳顶点。"""

import argparse
import json
import shutil
from pathlib import Path

import numpy as np

from build_destroyer_pack import sha256, write_json


def fnv1a(data):
    value = 0xcbf29ce484222325
    for byte in data:
        value = ((value ^ byte)*0x100000001b3) & 0xffffffffffffffff
    return f'{value:016x}'


def read_pack(directory):
    manifest = json.loads((directory/'manifest.json').read_text())
    for name, digest in manifest['files_sha256'].items():
        if sha256(directory/name) != digest:
            raise ValueError(f'参数包文件漂移 {name}')
    return manifest, {name: json.loads((directory/f'{name}.json').read_text())
        for name in ['geometry', 'maneuvering', 'actuators', 'provenance']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-pack', type=Path, required=True)
    parser.add_argument('--loading-packs', type=Path, nargs='+', required=True)
    args = parser.parse_args()
    manifest, base = read_pack(args.base_pack)
    geometry = base['geometry']
    if manifest['vessel'] not in ['lng-changheng', 'container-msc']:
        raise ValueError('加载表仅用于已经定义变载荷规则的两船')
    if (args.base_pack/'loading-cases.json').exists():
        raise ValueError('加载表已冻结，修改时须重新生成参数包')
    table = {'schema': 'act.vessel-loading-cases.v1', 'vessel': manifest['vessel'],
        'model_version': manifest['model_version'],
        'baseline_loading_ratio': geometry['loading']['loading_ratio'],
        'base_geometry_fnv1a': fnv1a((args.base_pack/'geometry.json').read_bytes()),
        'generator_sha256': sha256(Path(__file__)), 'cases': []}
    base_points = np.asarray(geometry['nonlinear_hydrostatics']['vertices_body_m'])
    ratios = {table['baseline_loading_ratio']}
    for directory in args.loading_packs:
        candidate_manifest, candidate = read_pack(directory)
        actual = candidate['geometry']
        ratio = actual['loading']['loading_ratio']
        if ratio in ratios or candidate_manifest['vessel'] != manifest['vessel']:
            raise ValueError('加载状态重复或船型不同')
        ratios.add(ratio)
        for name in ['fixed_mass', 'fixed_center', 'fixed_inertia']:
            if not np.array_equal(actual['loading'][name], geometry['loading'][name]):
                raise ValueError(f'加载状态改动固定质量分布 {name}')
        shift = np.array([0.0, 0.0, actual['kg_keel_up_m']-geometry['kg_keel_up_m']])
        hull = actual.pop('nonlinear_hydrostatics')
        if (not np.array_equal(hull['triangles'], geometry['nonlinear_hydrostatics']['triangles'])
                or not np.allclose(hull['vertices_body_m'], base_points+shift, rtol=0, atol=1e-12)
                or sha256(directory/'full-hull.dat') != sha256(args.base_pack/'full-hull.dat')):
            raise ValueError('加载状态改动同一源船体或重心坐标变换不一致')
        candidate['loading_ratio'] = ratio
        candidate['hull_origin_shift_body_m'] = shift.tolist()
        candidate['source_manifest_sha256'] = sha256(directory/'manifest.json')
        table['cases'].append(candidate)
        relative = Path('loadings')/f'{round(ratio*100):03d}'
        output = args.base_pack/relative
        output.mkdir(parents=True, exist_ok=False)
        for name in ['hull.dat', 'lid.dat', 'geometry-provenance.json', 'static-validation.json', 'validation.json']:
            shutil.copy2(directory/name, output/name)
    table['cases'].sort(key=lambda case: case['loading_ratio'])
    write_json(args.base_pack/'loading-cases.json', table)
    manifest['files_sha256'] = {str(path.relative_to(args.base_pack)): sha256(path)
        for path in sorted(args.base_pack.rglob('*')) if path.is_file() and path.name != 'manifest.json'}
    write_json(args.base_pack/'manifest.json', manifest)
    print(json.dumps({'vessel': manifest['vessel'], 'loading_ratios': sorted(ratios),
        'loading_cases_bytes': (args.base_pack/'loading-cases.json').stat().st_size,
        'all_fixed_distributions_identical': True, 'all_full_hulls_identical': True}))


if __name__ == '__main__':
    main()
