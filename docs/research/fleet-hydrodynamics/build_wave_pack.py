"""在已冻结物理包中登记同源一阶/差频资产，保留外部大数组的数据身份。"""

import argparse
import json
from pathlib import Path
import shutil

from build_destroyer_pack import sha256, write_json
from build_loading_cases import fnv1a


def asset(directory, binary, target):
    metadata_path = directory/'metadata.json'
    metadata = json.loads(metadata_path.read_text())
    data_path = directory/binary
    if metadata['data_sha256'] != sha256(data_path) or metadata['data_bytes'] != data_path.stat().st_size:
        raise ValueError('波浪数组与运行清单不一致')
    return metadata, {'metadata_file': target, 'metadata_sha256': sha256(metadata_path),
        'metadata_fnv1a64': 'fnv1a-'+fnv1a(metadata_path.read_bytes()),
        'data_file': binary, 'data_sha256': metadata['data_sha256'], 'data_bytes': metadata['data_bytes'],
        'object_key': f'simulation-hydrodynamics/{metadata["data_sha256"]}/{binary}'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-pack', type=Path, required=True)
    parser.add_argument('--source-geometry', type=Path, required=True)
    parser.add_argument('--first-order', type=Path, required=True)
    parser.add_argument('--full-difference', type=Path)
    parser.add_argument('--qtf-source-geometry', type=Path)
    parser.add_argument('--mean-forward-speed-mps', type=float, required=True)
    parser.add_argument('--model-version', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads((args.base_pack/'manifest.json').read_text())
    for name, expected in manifest['files_sha256'].items():
        if sha256(args.base_pack/name) != expected:
            raise ValueError('冻结物理包发生文件漂移')
    if manifest['model_version'] == args.model_version:
        raise ValueError('波浪挂表须形成新版本')
    geometry = json.loads((args.base_pack/'geometry.json').read_text())
    source = json.loads(args.source_geometry.read_text())
    if any(value != geometry.get(key) for key, value in source.items()):
        raise ValueError('波浪源几何与当前物理包存在差异')
    first, first_asset = asset(args.first_order, 'excitation-f32le.bin', 'first-order-wave.json')
    if first['geometry_sha256'] != sha256(args.source_geometry) or first['vessel'] != manifest['vessel']:
        raise ValueError('一阶资产与源几何或船型不一致')
    speeds = first['forward_speeds_mps']
    if not speeds[0] <= args.mean_forward_speed_mps <= speeds[-1]:
        raise ValueError('平均航速超出实际一阶数据域')
    binding = {'first_order_metadata_fnv1a64': first_asset['metadata_fnv1a64'],
        'full_difference_metadata_fnv1a64': None, 'water_depth_m': first['water_depth_m'],
        'mean_forward_speed_mps': args.mean_forward_speed_mps}
    assets = {'schema': 'act.vessel-wave-assets.v1', 'vessel': manifest['vessel'],
              'model_version': args.model_version, 'first_order': first_asset, 'full_difference': None}
    second = None
    if args.full_difference:
        if args.qtf_source_geometry is None:
            raise ValueError('完整差频资产需要原始求解几何')
        second, second_asset = asset(args.full_difference, 'qtf-f32le.bin', 'full-difference-wave.json')
        qtf_geometry = json.loads(args.qtf_source_geometry.read_text())
        if (second['sample_only'] or second['geometry_sha256'] != sha256(args.qtf_source_geometry)
                or any(value != geometry.get(key) for key, value in qtf_geometry.items())
                or second['vessel'] != manifest['vessel']
                or second['water_depth_m'] != first['water_depth_m']
                or second['mean_forward_speed_mps'] != args.mean_forward_speed_mps):
            raise ValueError('完整差频源条件与当前物理包或平均工况不一致')
        binding['full_difference_metadata_fnv1a64'] = second_asset['metadata_fnv1a64']
        assets['full_difference'] = second_asset
    geometry['wave_model'] = binding
    provenance = json.loads((args.base_pack/'provenance.json').read_text())
    provenance['wave_base_manifest_sha256'] = sha256(args.base_pack/'manifest.json')
    provenance['wave_generator_sha256'] = sha256(Path(__file__))
    provenance['wave_source_geometry_sha256'] = sha256(args.source_geometry)
    provenance['wave_asset_metadata_sha256'] = {name: descriptor['metadata_sha256']
        for name, descriptor in [('first_order', first_asset), ('full_difference', assets['full_difference'])] if descriptor}
    for name, unit in [('water_depth_m', 'm'), ('mean_forward_speed_mps', 'm/s')]:
        provenance['entries'].append({'parameter': 'geometry.wave_model.'+name,
            'value': binding[name], 'unit': unit, 'grade': 'T',
            'source': 'https://github.com/yong-wei/act/issues/2157',
            'formula_or_table': 'fixed first-order and QTF mean condition',
            'uncertainty': 'restricted to the actual runtime coefficient grid'})
    provenance['not_ready'] = [name for name in provenance['not_ready']
        if name != 'online diffraction and full complex QTF']
    provenance['not_ready'].append('wave coefficient reference and convergence domains, see wave source proofs')
    args.output.mkdir(parents=True, exist_ok=False)
    shutil.copytree(args.base_pack, args.output, dirs_exist_ok=True)
    write_json(args.output/'geometry.json', geometry)
    write_json(args.output/'provenance.json', provenance)
    write_json(args.output/'wave-assets.json', assets)
    validation = json.loads((args.base_pack/'validation.json').read_text())
    validation['wave_model'] = {'fidelity': 'research-nominal', 'binding': binding,
        'asset_manifest': 'wave-assets.json',
        'mean_state_approximation': 'fixed mean speed and heading, current position phase and full attitude rotation',
        'native_session_validation': 'docs/research/fleet-hydrodynamics/semisub-wave-session-validation.json'}
    write_json(args.output/'validation.json', validation)
    write_json(args.output/first_asset['metadata_file'], first)
    if second is not None:
        write_json(args.output/assets['full_difference']['metadata_file'], second)
    for descriptor in [first_asset, assets['full_difference']]:
        if descriptor and sha256(args.output/descriptor['metadata_file']) != descriptor['metadata_sha256']:
            raise ValueError('波浪元数据复制后发生字节变化')
    manifest['model_version'] = args.model_version
    manifest['files_sha256'] = {str(path.relative_to(args.output)): sha256(path)
        for path in sorted(args.output.rglob('*')) if path.is_file() and path.name != 'manifest.json'}
    write_json(args.output/'manifest.json', manifest)
    print(json.dumps({'status': 'computed', 'vessel': manifest['vessel'], 'model_version': args.model_version,
                      'binding': binding, 'external_data_bytes': sum(item['data_bytes'] for item in
                          [first_asset, assets['full_difference']] if item)}))


if __name__ == '__main__':
    main()
