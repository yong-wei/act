"""在冻结物理包上装配同源A_inf与六维被动辐射，形成新模型版本。"""

import argparse
import json
import shutil
from pathlib import Path

from build_destroyer_pack import parameter_entries, sha256, write_json
from build_loading_cases import fnv1a


def radiation_parameters(directory, geometry_sha):
    validation = json.loads((directory/'validation.json').read_text())
    for name, key in [('radiation.json', 'radiation_sha256'), ('fit-arrays.npz', 'fit_arrays_sha256')]:
        if sha256(directory/name) != validation[key]:
            raise ValueError('辐射拟合输出哈希不符')
    if validation['geometry_sha256'] != geometry_sha:
        raise ValueError('辐射拟合与质量/CG/惯量身份不一致')
    return json.loads((directory/'radiation.json').read_text()), validation


def wind_parameters(directory, geometry_sha):
    validation = json.loads((directory/'validation.json').read_text())
    if (validation['geometry_sha256'] != geometry_sha
            or sha256(directory/'wind.json') != validation['wind_sha256']):
        raise ValueError('风投影与当前质量/CG/加载状态身份不一致')
    for name, expected in validation['projection_files_sha256'].items():
        if sha256(directory/name) != expected:
            raise ValueError('风投影区域文件哈希不符')
    return json.loads((directory/'wind.json').read_text()), validation


def radiation_entries(parameters):
    entries = parameter_entries(parameters, 'geometry.passive_radiation', authority_issue=2157)
    for entry in entries:
        entry.update(grade='D', source='https://capytaine.org/v2.2.1/theory_manual/theory.html',
            formula_or_table='zero-speed B+i*omega*A, constrained PSD modal residues and A_inf, rigid-mass normalized',
            uncertainty='see radiation-fit-validation.json for frequency and channel residuals, research-nominal')
    return entries


def wind_entries(parameters):
    entries = parameter_entries(parameters, 'geometry.wind_model', authority_issue=2156)
    for entry in entries:
        entry.update(source='https://github.com/yong-wei/act/issues/2156',
            formula_or_table='union of current-loading source-mesh projections, nominal component regression or panel drag',
            uncertainty='T geometry and aerodynamic assumptions, see wind-validation.json')
    return entries


def write_models(output, radiation_directory, wind_directory):
    for source, target in [('radiation.json', 'radiation.json'), ('validation.json', 'radiation-fit-validation.json'),
                           ('fit-arrays.npz', 'radiation-fit-arrays.npz')]:
        shutil.copy2(radiation_directory/source, output/target)
    if wind_directory:
        shutil.copy2(wind_directory/'validation.json', output/'wind-validation.json')
        for name in ['wind.json', 'frontal.wkb', 'lateral.wkb']:
            shutil.copy2(wind_directory/name, output/name)


def upgrade_loading_models(output, definitions, version):
    table_path = output/'loading-cases.json'
    if not table_path.exists():
        if definitions:
            raise ValueError('该船型没有加载表')
        return
    if definitions is None:
        raise ValueError('加载表的每种状态均须提供同源辐射与风投影')
    definitions = json.loads(definitions.read_text())
    table = json.loads(table_path.read_text())
    ratios = [case['loading_ratio'] for case in table['cases']]
    if sorted(item['loading_ratio'] for item in definitions) != sorted(ratios):
        raise ValueError('加载模型定义缺失、重复或超出冻结比例')
    for case in table['cases']:
        definition = next(item for item in definitions if item['loading_ratio'] == case['loading_ratio'])
        geometry_path = Path(definition['geometry'])
        source = json.loads(geometry_path.read_text())
        if any(value != case['geometry'].get(key) for key, value in source.items() if key != 'nonlinear_hydrostatics'):
            raise ValueError('加载模型与已冻结质量分布或物理几何不一致')
        radiation_directory, wind_directory = Path(definition['radiation_fit']), Path(definition['wind_projection'])
        radiation, fit_proof = radiation_parameters(radiation_directory, sha256(geometry_path))
        wind, _ = wind_parameters(wind_directory, sha256(geometry_path))
        case['geometry'].update(passive_radiation=radiation, wind_model=wind)
        case['provenance']['entries'].extend(radiation_entries(radiation)+wind_entries(wind))
        case['provenance']['radiation_fit_sha256'] = sha256(radiation_directory/'validation.json')
        case['provenance']['wind_validation_sha256'] = sha256(wind_directory/'validation.json')
        case['provenance']['radiation_error'] = {key: fit_proof[key] for key in ['relative_a_error', 'relative_b_error']}
        case['provenance']['not_ready'] = [name for name in case['provenance'].get('not_ready', [])
            if name not in ['fitted vessel radiation', 'fitted vessel added mass and radiation']]
        case['provenance']['not_ready'].append('radiation vessel calibration and validated forward speed')
        write_models(output/'loadings'/f'{round(case["loading_ratio"]*100):03d}', radiation_directory, wind_directory)
    table['model_version'] = version
    table['base_geometry_fnv1a'] = fnv1a((output/'geometry.json').read_bytes())
    table['environment_model_generator_sha256'] = sha256(Path(__file__))
    write_json(table_path, table)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-pack', type=Path, required=True)
    parser.add_argument('--radiation-fit', type=Path, required=True)
    parser.add_argument('--wind-projection', type=Path)
    parser.add_argument('--loading-models', type=Path)
    parser.add_argument('--native-verification-prefix')
    parser.add_argument('--model-version', default='research-nominal-v2')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads((args.base_pack/'manifest.json').read_text())
    for name, digest in manifest['files_sha256'].items():
        if sha256(args.base_pack/name) != digest:
            raise ValueError('物理基准包发生文件漂移')
    parameters, validation = radiation_parameters(args.radiation_fit, sha256(args.base_pack/'geometry.json'))
    if args.model_version == manifest['model_version']:
        raise ValueError('辐射组装须使用新参数版本')
    geometry = json.loads((args.base_pack/'geometry.json').read_text())
    if geometry.get('passive_radiation') is not None:
        raise ValueError('基准包已经包含辐射模型')
    geometry['passive_radiation'] = parameters
    provenance = json.loads((args.base_pack/'provenance.json').read_text())
    provenance['base_pack_manifest_sha256'] = sha256(args.base_pack/'manifest.json')
    provenance['base_generator_sha256'] = provenance['generator_sha256']
    provenance['generator_sha256'] = sha256(Path(__file__))
    provenance['radiation_fit_sha256'] = sha256(args.radiation_fit/'validation.json')
    provenance['radiation_coefficient_producer_sha256'] = validation['generator_sha256']
    provenance['parameter_unit_producer_sha256'] = sha256(Path(__file__).with_name('build_destroyer_pack.py'))
    provenance['radiation_error'] = {name: validation[name] for name in ['relative_a_error', 'relative_b_error']}
    provenance['entries'].extend(radiation_entries(parameters))
    if args.wind_projection:
        wind, _ = wind_parameters(args.wind_projection, sha256(args.base_pack/'geometry.json'))
        geometry['wind_model'] = wind
        provenance['wind_validation_sha256'] = sha256(args.wind_projection/'validation.json')
        provenance['entries'].extend(wind_entries(wind))
    provenance['not_ready'] = [name for name in provenance['not_ready']
        if name not in ['fitted vessel radiation', 'fitted vessel added mass and radiation']]
    provenance['not_ready'].append('radiation vessel calibration and validated forward speed')
    shutil.copytree(args.base_pack, args.output)
    write_models(args.output, args.radiation_fit, args.wind_projection)
    write_json(args.output/'geometry.json', geometry)
    upgrade_loading_models(args.output, args.loading_models, args.model_version)
    write_json(args.output/'provenance.json', provenance)
    old_validation = json.loads((args.output/'validation.json').read_text())
    old_validation['radiation'] = {'fidelity': 'research-nominal',
        'relative_a_error': validation['relative_a_error'], 'relative_b_error': validation['relative_b_error'],
        'discrete_stability': validation['discrete_stability'],
        'fit_validation_sha256': sha256(args.output/'radiation-fit-validation.json')}
    old_validation['native_verification'] = 'separate verification artifacts'
    old_validation['native_verification_paths'] = [
        'docs/research/fleet-hydrodynamics/semisub-radiation-validation/independent-validation.json',
        'docs/research/fleet-hydrodynamics/semisub-radiation-session-validation.json']
    if args.native_verification_prefix:
        old_validation['native_verification_paths'] = [args.native_verification_prefix+'-independent-validation.json',
                                                       args.native_verification_prefix+'-session-validation.json']
    write_json(args.output/'validation.json', old_validation)
    manifest['model_version'] = args.model_version
    manifest['files_sha256'] = {str(path.relative_to(args.output)): sha256(path)
        for path in sorted(args.output.rglob('*')) if path.is_file() and path.name != 'manifest.json'}
    write_json(args.output/'manifest.json', manifest)
    print(json.dumps({'vessel': manifest['vessel'], 'version': manifest['model_version'],
        'oscillators': len(parameters['oscillators']), 'status': 'computed'}))


if __name__ == '__main__':
    main()
