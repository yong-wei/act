"""在冻结物理包上装配同源A_inf与六维被动辐射，形成新模型版本。"""

import argparse
import json
import shutil
from pathlib import Path

from build_destroyer_pack import parameter_entries, sha256, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-pack', type=Path, required=True)
    parser.add_argument('--radiation-fit', type=Path, required=True)
    parser.add_argument('--model-version', default='research-nominal-v2')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads((args.base_pack/'manifest.json').read_text())
    for name, digest in manifest['files_sha256'].items():
        if sha256(args.base_pack/name) != digest:
            raise ValueError('物理基准包发生文件漂移')
    validation = json.loads((args.radiation_fit/'validation.json').read_text())
    for name, key in [('radiation.json', 'radiation_sha256'), ('fit-arrays.npz', 'fit_arrays_sha256')]:
        if sha256(args.radiation_fit/name) != validation[key]:
            raise ValueError('辐射拟合输出哈希不符')
    if validation['geometry_sha256'] != sha256(args.base_pack/'geometry.json'):
        raise ValueError('辐射拟合与物理基准的质量/CG/惯量身份不一致')
    if args.model_version == manifest['model_version']:
        raise ValueError('辐射组装须使用新参数版本')
    parameters = json.loads((args.radiation_fit/'radiation.json').read_text())
    geometry = json.loads((args.base_pack/'geometry.json').read_text())
    if geometry.get('passive_radiation') is not None:
        raise ValueError('基准包已经包含辐射模型')
    geometry['passive_radiation'] = parameters
    provenance = json.loads((args.base_pack/'provenance.json').read_text())
    provenance['base_pack_manifest_sha256'] = sha256(args.base_pack/'manifest.json')
    provenance['base_generator_sha256'] = provenance['generator_sha256']
    provenance['generator_sha256'] = sha256(Path(__file__))
    provenance['radiation_fit_sha256'] = sha256(args.radiation_fit/'validation.json')
    provenance['radiation_coefficient_producer_sha256'] = sha256(Path(__file__).with_name('fit_passive_radiation.py'))
    provenance['parameter_unit_producer_sha256'] = sha256(Path(__file__).with_name('build_destroyer_pack.py'))
    provenance['radiation_error'] = {name: validation[name] for name in ['relative_a_error', 'relative_b_error']}
    entries = parameter_entries(parameters, 'geometry.passive_radiation', authority_issue=2157)
    for entry in entries:
        entry.update(grade='D', source='https://capytaine.org/v2.2.1/theory_manual/theory.html',
            formula_or_table='zero-speed B+i*omega*A, constrained PSD modal residues and A_inf, rigid-mass normalized',
            uncertainty='see radiation-fit-validation.json for frequency and channel residuals, research-nominal')
    provenance['entries'].extend(entries)
    provenance['not_ready'] = [name for name in provenance['not_ready']
        if name not in ['fitted vessel radiation', 'fitted vessel added mass and radiation']]
    provenance['not_ready'].append('radiation vessel calibration and validated forward speed')
    shutil.copytree(args.base_pack, args.output)
    for source, target in [('radiation.json', 'radiation.json'), ('validation.json', 'radiation-fit-validation.json'),
                           ('fit-arrays.npz', 'radiation-fit-arrays.npz')]:
        shutil.copy2(args.radiation_fit/source, args.output/target)
    write_json(args.output/'geometry.json', geometry)
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
    write_json(args.output/'validation.json', old_validation)
    manifest['model_version'] = args.model_version
    manifest['files_sha256'] = {str(path.relative_to(args.output)): sha256(path)
        for path in sorted(args.output.rglob('*')) if path.is_file() and path.name != 'manifest.json'}
    write_json(args.output/'manifest.json', manifest)
    print(json.dumps({'vessel': manifest['vessel'], 'version': manifest['model_version'],
        'oscillators': len(parameters['oscillators']), 'status': 'computed'}))


if __name__ == '__main__':
    main()
