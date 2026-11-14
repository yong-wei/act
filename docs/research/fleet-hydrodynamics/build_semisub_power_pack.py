"""把981教学推进电力预算和单台额外推力限值写入新冻结参数包。"""

import argparse
import json
from pathlib import Path
import shutil

from build_destroyer_pack import sha256, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-pack', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--model-version', required=True)
    args = parser.parse_args()
    manifest = json.loads((args.base_pack/'manifest.json').read_text())
    if manifest['vessel'] != 'semisub-981' or manifest['model_version'] == args.model_version:
        raise ValueError('需要981基准包和新的模型版本')
    for name, expected in manifest['files_sha256'].items():
        if sha256(args.base_pack/name) != expected:
            raise ValueError('冻结基准包发生漂移')
    actuators = json.loads((args.base_pack/'actuators.json').read_text())
    system = actuators['system']
    if len(system['propulsors']) != 8 or any(item['max_power_w'] != 4.6e6 for item in system['propulsors']):
        raise ValueError('推进器安装数量或单台功率与#2161不一致')
    system['max_positive_motor_power_w'] = 32e6
    for propulsor in system['propulsors']:
        propulsor['max_thrust_n'] = 800e3
    provenance = json.loads((args.base_pack/'provenance.json').read_text())
    provenance['propulsion_base_manifest_sha256'] = sha256(args.base_pack/'manifest.json')
    provenance['propulsion_generator_sha256'] = sha256(Path(__file__))
    values = [('actuators.system.max_positive_motor_power_w', 32e6, 'W')]
    values.extend((f'actuators.system.propulsors[{i}].max_thrust_n', 800e3, 'N') for i in range(8))
    for parameter, value, unit in values:
        provenance['entries'].append({'parameter': parameter, 'value': value, 'unit': unit,
            'grade': 'T', 'source': 'https://github.com/yong-wei/act/issues/2161',
            'formula_or_table': 'eight 4.6MW drives, shared 32MW positive mechanical input and 800kN additional thrust bound',
            'uncertainty': 'fixed teaching equipment limits'})
    shutil.copytree(args.base_pack, args.output)
    write_json(args.output/'actuators.json', actuators)
    write_json(args.output/'provenance.json', provenance)
    assets_path = args.output/'wave-assets.json'
    assets = json.loads(assets_path.read_text())
    assets['model_version'] = args.model_version
    write_json(assets_path, assets)
    validation = json.loads((args.output/'validation.json').read_text())
    validation['propulsion_limits'] = {'installed_power_w': 36.8e6,
        'shared_positive_mechanical_power_w': 32e6, 'additional_thrust_limit_per_propulsor_n': 800e3,
        'runtime_validation': 'docs/research/fleet-hydrodynamics/semisub-power-session-validation.json'}
    write_json(args.output/'validation.json', validation)
    manifest['model_version'] = args.model_version
    manifest['files_sha256'] = {str(path.relative_to(args.output)): sha256(path)
        for path in sorted(args.output.rglob('*')) if path.is_file() and path.name != 'manifest.json'}
    write_json(args.output/'manifest.json', manifest)
    print(json.dumps({'status': 'computed', 'version': args.model_version, 'power_budget_w': 32e6}))


if __name__ == '__main__':
    main()
