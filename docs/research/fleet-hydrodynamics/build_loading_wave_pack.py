"""复用既有装载/水深数组，为联合物理包冻结逐工况一阶波浪绑定。"""

import argparse
import copy
import json
from pathlib import Path
import shutil
import tempfile

from build_destroyer_pack import sha256, write_json
from build_loading_cases import fnv1a, read_pack
from build_wave_pack import asset
from export_teaching_first_order import export_first_order


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-pack', type=Path, required=True)
    parser.add_argument('--evidence', type=Path, required=True)
    parser.add_argument('--symmetry-proofs', type=Path, required=True)
    parser.add_argument('--model-version', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    manifest, parameters = read_pack(args.base_pack)
    if args.output.exists() or manifest['model_version'] == args.model_version:
        raise ValueError('波浪联合包须写入尚不存在的新版本')
    prefix = {'lng-changheng': 'lng', 'container-msc': 'container'}.get(manifest['vessel'])
    if prefix is None:
        raise ValueError('仅用于现有LNG与集装箱离散装载表')
    loading = json.loads((args.base_pack/'loading-cases.json').read_text())
    hydrodynamics = json.loads((args.base_pack/'hydrodynamic-cases.json').read_text())
    evidence = json.loads((args.evidence/'validation.json').read_text())
    base_geometry = parameters['geometry']
    base_fnv = fnv1a((args.base_pack/'geometry.json').read_bytes())
    for table in [loading, hydrodynamics]:
        if (table['vessel'] != manifest['vessel'] or table['model_version'] != manifest['model_version']
                or table['base_geometry_fnv1a'] != base_fnv):
            raise ValueError('联合表与冻结基准包的身份不一致')
    inputs = {args.base_pack/'manifest.json', args.base_pack/'loading-cases.json',
        args.base_pack/'hydrodynamic-cases.json', args.evidence/'validation.json',
        args.evidence/'coefficient-arrays.npz', Path(__file__),
        Path(__file__).with_name('export_teaching_first_order.py')}
    helpers = ['build_destroyer_pack.py', 'build_loading_cases.py', 'build_wave_pack.py']
    inputs.update(Path(__file__).with_name(name) for name in helpers)
    for case in hydrodynamics['cases']:
        inputs.add(args.symmetry_proofs/f'{prefix}{round(case["loading_ratio"]*100):03d}.json')
    input_hashes = {path: sha256(path) for path in inputs}
    assets = {'schema': 'act.vessel-wave-assets.v1', 'vessel': manifest['vessel'],
        'model_version': args.model_version, 'first_order': None,
        'full_difference': None, 'conditions': []}
    validations = []
    with tempfile.TemporaryDirectory(prefix='.wave-export-', dir=args.output.parent) as temporary:
        temporary = Path(temporary)
        output = temporary/'pack'
        shutil.copytree(args.base_pack, output)
        export_base = temporary/'case'
        export_base.mkdir()
        shutil.copy2(args.base_pack/'manifest.json', export_base/'manifest.json')
        for case in hydrodynamics['cases']:
            ratio, depth = case['loading_ratio'], case['water_depth_m']
            source_geometry = case['provenance']['source_geometry_sha256']
            matches = [(index, entry) for index, entry in enumerate(evidence['cases'])
                if entry['provenance']['geometry_sha256'] == source_geometry
                and entry['provenance']['configuration']['water_depth_m'] == depth]
            if len(matches) != 1:
                raise ValueError('已冻结的入射波浪工况缺失或重复')
            source_index, _ = matches[0]
            selected = base_geometry if ratio == loading['baseline_loading_ratio'] else next(
                item['geometry'] for item in loading['cases'] if item['loading_ratio'] == ratio)
            if any(selected.get(key) != value for key, value in case['geometry_condition'].items()):
                raise ValueError('波浪与辐射的装载质量、重心、惯量或姿态不同')
            write_json(export_base/'geometry.json', selected)
            source_mesh = args.base_pack if ratio == loading['baseline_loading_ratio'] else (
                args.base_pack/'loadings'/f'{round(ratio*100):03d}')
            for name in ['hull.dat', 'lid.dat']:
                shutil.copy2(source_mesh/name, export_base/name)
            relative = Path('waves')/f'{depth:06.1f}'/f'{round(ratio*100):03d}'
            directory = output/relative
            symmetry = args.symmetry_proofs/f'{prefix}{round(ratio*100):03d}.json'
            result = export_first_order(export_base, args.evidence, directory, source_index, symmetry)
            metadata, descriptor = asset(directory, 'excitation-f32le.bin', str(relative/'metadata.json'))
            descriptor['data_file'] = str(relative/'excitation-f32le.bin')
            binding = {'first_order_metadata_fnv1a64': descriptor['metadata_fnv1a64'],
                'full_difference_metadata_fnv1a64': None, 'water_depth_m': depth,
                'mean_forward_speed_mps': 0.0}
            case['wave_model'] = binding
            case['provenance']['wave_source_evidence_sha256'] = input_hashes[args.evidence/'validation.json']
            case['provenance']['wave_source_case_index'] = source_index
            case['provenance']['wave_export_validation_file'] = str(relative/'validation.json')
            for name, unit in [('water_depth_m', 'm'), ('mean_forward_speed_mps', 'm/s')]:
                case['provenance']['entries'].append({'parameter': 'geometry.wave_model.'+name,
                    'value': binding[name], 'unit': unit, 'grade': 'T',
                    'source': 'https://github.com/yong-wei/act/issues/2157',
                    'formula_or_table': 'frozen zero-speed excitation at selected loading and depth',
                    'uncertainty': metadata['teaching_approximation']})
            condition = {'loading_ratio': ratio, 'water_depth_m': depth, 'first_order': descriptor}
            assets['conditions'].append(condition)
            validations.append({'loading_ratio': ratio, 'water_depth_m': depth,
                'source_geometry_sha256': source_geometry, 'source_case_index': source_index,
                'source_failed_matrix_checks': result['failed_source_checks'],
                'quantization_relative_l2_per_channel': metadata['quantization_relative_l2_per_channel'],
                'metadata_sha256': descriptor['metadata_sha256'], 'data_sha256': descriptor['data_sha256'],
                'symmetric_mesh_validation_sha256': input_hashes[symmetry], 'binding': binding})
            if ratio == loading['baseline_loading_ratio'] and depth == hydrodynamics['default_water_depth_m']:
                base_geometry['wave_model'] = copy.deepcopy(binding)
                assets['first_order'] = descriptor
        if assets['first_order'] is None:
            raise ValueError('默认装载与水深的一阶工况缺失')
        write_json(output/'geometry.json', base_geometry)
        for name, table in [('loading-cases.json', loading), ('hydrodynamic-cases.json', hydrodynamics)]:
            table['model_version'] = args.model_version
            table['base_geometry_fnv1a'] = fnv1a((output/'geometry.json').read_bytes())
            table['wave_generator_sha256'] = input_hashes[Path(__file__)]
            write_json(output/name, table)
        provenance = parameters['provenance']
        provenance['wave_base_manifest_sha256'] = input_hashes[args.base_pack/'manifest.json']
        provenance['wave_generator_sha256'] = input_hashes[Path(__file__)]
        provenance['wave_source_evidence_sha256'] = input_hashes[args.evidence/'validation.json']
        provenance['entries'].extend(next(case['provenance']['entries'][-2:]
            for case in hydrodynamics['cases']
            if case['loading_ratio'] == loading['baseline_loading_ratio']
            and case['water_depth_m'] == hydrodynamics['default_water_depth_m']))
        provenance['not_ready'].append('wave calibration and forward-speed diffraction correction; frozen source checks retained')
        write_json(output/'provenance.json', provenance)
        write_json(output/'wave-assets.json', assets)
        wave_validation = {'schema': 'act.loading-wave-pack.validation.v1',
            'status': 'assembled-frozen-teaching-reference',
            'base_pack_manifest_sha256': input_hashes[args.base_pack/'manifest.json'],
            'source_evidence_sha256': input_hashes[args.evidence/'validation.json'],
            'source_arrays_sha256': input_hashes[args.evidence/'coefficient-arrays.npz'],
            'generator_sha256': input_hashes[Path(__file__)],
            'helper_sha256': {name: input_hashes[Path(__file__).with_name(name)] for name in helpers},
            'approximation': 'Frozen zero-speed coefficients at discrete loading/depth. Actual position retains encounter phase.',
            'conditions': validations}
        write_json(output/'wave-source-validation.json', wave_validation)
        validation = json.loads((output/'validation.json').read_text())
        validation['wave_model'] = {'fidelity': 'research-nominal', 'asset_manifest': 'wave-assets.json',
            'source_validation': 'wave-source-validation.json', 'native_session_validation': 'pending'}
        write_json(output/'validation.json', validation)
        if any(sha256(path) != digest for path, digest in input_hashes.items()):
            raise ValueError('导出期间冻结输入发生变化')
        read_pack(args.base_pack)
        manifest['model_version'] = args.model_version
        manifest['files_sha256'] = {str(path.relative_to(output)): sha256(path)
            for path in sorted(output.rglob('*')) if path.is_file() and path.name != 'manifest.json'}
        write_json(output/'manifest.json', manifest)
        output.rename(args.output)
    print(json.dumps({'status': 'assembled-frozen-teaching-reference', 'vessel': manifest['vessel'],
        'model_version': args.model_version, 'conditions': len(validations),
        'excitation_bytes': sum(case['first_order']['data_bytes'] for case in assets['conditions'])}))


if __name__ == '__main__':
    main()
