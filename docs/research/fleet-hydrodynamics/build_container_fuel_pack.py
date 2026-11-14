"""把#2159教学燃油曲线与累计量写入集装箱新冻结参数包。"""

import argparse
import json
from pathlib import Path
import shutil

from build_destroyer_pack import sha256, write_json


MODEL = {'rated_shaft_power_w': 65e6, 'auxiliary_power_w': 2e6, 'efficiency': .95,
    'load_fractions': [.1, .25, .5, .75, 1.0], 'sfoc_g_per_kwh': [230, 195, 180, 175, 185]}
INITIAL = {'fuel_kg': 0.0, 'positive_propeller_work_j': 0.0,
    'negative_propeller_work_j': 0.0, 'engine_work_j': 0.0}


def apply_engine(actuators, provenance):
    system = actuators['system']
    if len(system['propulsors']) != 1 or system['propulsors'][0]['max_power_w'] != 65e6:
        raise ValueError('教学发动机需要冻结的65MW单轴推进系统')
    if 'fuel_model' in system or 'fuel' in actuators['initial_state']:
        raise ValueError('基准包已经包含燃油模型')
    system['fuel_model'] = MODEL
    actuators['initial_state']['fuel'] = INITIAL
    units = {'rated_shaft_power_w': 'W', 'auxiliary_power_w': 'W', 'efficiency': '1',
        'load_fractions': '1', 'sfoc_g_per_kwh': 'g/kWh', 'fuel_kg': 'kg',
        'positive_propeller_work_j': 'J', 'negative_propeller_work_j': 'J', 'engine_work_j': 'J'}
    for prefix, fields in [('actuators.system.fuel_model', MODEL), ('actuators.initial_state.fuel', INITIAL)]:
        for name, value in fields.items():
            values = enumerate(value) if isinstance(value, list) else [(None, value)]
            for index, number in values:
                suffix = f'[{index}]' if index is not None else ''
                provenance['entries'].append({'parameter': f'{prefix}.{name}{suffix}',
                    'value': number, 'unit': units[name], 'grade': 'T',
                    'source': 'https://github.com/yong-wei/act/issues/2159',
                    'formula_or_table': 'fixed piecewise-linear teaching SFOC; actual Qprop*omega; engine power includes auxiliary demand and efficiency',
                    'uncertainty': 'teaching fuel estimate, vessel engine map unavailable'})
    provenance['fuel_generator_sha256'] = sha256(Path(__file__))
    provenance['fuel_accounting'] = {
        'shaft_power': 'actual Qprop*omega at every RK stage',
        'load_fraction': 'max(positive shaft power / 65MW, 0.1) for SFOC interpolation, capped at 1',
        'engine_power': '(max(positive shaft power, 0.1*65MW)+2MW)/0.95 while running',
        'fuel_rate_kg_s': 'engine power in W * SFOC in g/kWh / 3.6e9',
        'shutdown': 'explicit engine_running=false cuts actual motor torque and sets the complete teaching engine/auxiliary fuel rate to zero',
        'braking': 'negative motor work and negative propeller work are recorded separately; neither subtracts fuel'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-pack', type=Path, required=True)
    parser.add_argument('--model-version', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads((args.base_pack/'manifest.json').read_text())
    if manifest['vessel'] != 'container-msc' or manifest['model_version'] == args.model_version:
        raise ValueError('需要集装箱基准包和新的模型版本')
    for name, expected in manifest['files_sha256'].items():
        if sha256(args.base_pack/name) != expected:
            raise ValueError('冻结基准包发生漂移')
    actuators = json.loads((args.base_pack/'actuators.json').read_text())
    provenance = json.loads((args.base_pack/'provenance.json').read_text())
    apply_engine(actuators, provenance)
    provenance['fuel_base_manifest_sha256'] = sha256(args.base_pack/'manifest.json')
    table = json.loads((args.base_pack/'loading-cases.json').read_text())
    table['model_version'] = args.model_version
    for case in table['cases']:
        apply_engine(case['actuators'], case['provenance'])
    shutil.copytree(args.base_pack, args.output)
    write_json(args.output/'actuators.json', actuators)
    write_json(args.output/'provenance.json', provenance)
    write_json(args.output/'loading-cases.json', table)
    hydro_path = args.output/'hydrodynamic-cases.json'
    hydro = json.loads(hydro_path.read_text())
    hydro['model_version'] = args.model_version
    write_json(hydro_path, hydro)
    validation = json.loads((args.output/'validation.json').read_text())
    validation['teaching_fuel'] = {'source_grade': 'T', 'runtime_validation':
        'docs/research/fleet-hydrodynamics/loading-validation/container-v2-fuel-session-validation.json'}
    write_json(args.output/'validation.json', validation)
    manifest['model_version'] = args.model_version
    manifest['files_sha256'] = {str(path.relative_to(args.output)): sha256(path)
        for path in sorted(args.output.rglob('*')) if path.is_file() and path.name != 'manifest.json'}
    write_json(args.output/'manifest.json', manifest)
    print(json.dumps({'status': 'computed', 'version': args.model_version,
        'loading_states': 1+len(table['cases']), 'fuel_curve': MODEL}))


if __name__ == '__main__':
    main()
