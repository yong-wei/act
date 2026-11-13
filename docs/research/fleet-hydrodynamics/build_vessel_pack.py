"""由已闭合源船形装配常规船的T级轴系、翼面和非线性静水参数包。"""

import argparse
import copy
import json
import math
import shutil
from pathlib import Path

import capytaine as cpt
import numpy as np
import trimesh

from build_destroyer_pack import b470_coefficients, b470_loads, parameter_entries, sha256, write_json
from build_ship_geometry import DEFINITIONS, RHO
from validate_hull_pack import pod_check, propeller_check, surface_check


LAYOUTS = {
    'lng-changheng': dict(count=2, diameter=7.0, power=15e6, rpm=110.0, height=4.0,
        prop_x=-0.45*286, prop_y=0.18*46.4, motor_tau=2.0, slew_rpm=1.0,
        rudder_x=-0.48*286, rudder_area=28.0, rudder_rate=2.3, rudder_tau=1.0),
    'container-msc': dict(count=1, diameter=10.0, power=65e6, rpm=90.0, height=5.5,
        prop_x=-0.46*383, prop_y=0.0, rudder_x=-0.49*383,
        rudder_area=90.0, rudder_rate=2.3, rudder_tau=1.0),
    'cruise-adora': dict(count=2, diameter=6.5, power=16.8e6, rpm=150.0, height=3.26,
        prop_x=-0.45*305, prop_y=0.22*37.2, pod_rate=5.0, pod_tau=1.0,
        fin_x=-0.05*305, fin_y=21.75, previous_fin_y=15.0, fin_height=5.26),
    'icebreaker-xuelong2': dict(count=2, diameter=4.5, power=7.5e6, rpm=150.0, height=4.3,
        prop_x=-53.5, previous_prop_x=-0.43*116, prop_y=5.0, pod_rate=12.0, pod_tau=0.8),
    'dredger-tianjing': dict(count=2, diameter=3.5, power=3e6, rpm=180.0, height=3.5,
        prop_x=-60.5, previous_prop_x=-0.43*110, prop_y=0.2*23,
        rudder_x=-62.5, previous_rudder_x=-0.48*110, rudder_area=8.0, rudder_rate=3.0, rudder_tau=0.6),
}


def installation(geometry, x, y, height):
    position = [x, y, geometry['kg_keel_up_m']-height]
    return {'positionBodyM': position,
            'referenceImmersionM': position[2]-geometry['center_of_mass_waterline_z_up_m'][2]}


def layout(geometry, settings):
    sides = [0] if settings['count'] == 1 else [-1, 1]
    propulsors, surfaces = [], []
    for index, side in enumerate(sides):
        propulsors.append({
            'installation': installation(geometry, settings['prop_x'], side*settings['prop_y'], settings['height']),
            'diameter_m': settings['diameter'], 'max_power_w': settings['power'],
            'rated_speed_rad_s': settings['rpm']*math.pi/30,
            'motor_time_constant_s': settings.get('motor_tau', 0.5),
            'shaft_inertia_kg_m2': 25000*(settings['diameter']/4)**5,
            'reference_slew_rad_s2': settings.get('slew_rpm', 5.0)*math.pi/30,
            'speed_control_time_s': 0.75,
            'azimuth': ({'servo': {'max_angle_rad': math.pi,
                'max_rate_rad_s': math.radians(settings['pod_rate']),
                'time_constant_s': settings['pod_tau']}, 'forbidden_sectors_rad': []}
                if 'pod_rate' in settings else None),
        })
        if 'rudder_area' in settings:
            surfaces.append({
                'installation': installation(geometry, settings['rudder_x'], side*settings['prop_y'], settings['height']),
                'area_m2': settings['rudder_area'], 'aspect_ratio': 2.0, 'normal_body': [0.0, 1.0, 0.0],
                'servo': {'max_angle_rad': math.radians(35),
                    'max_rate_rad_s': math.radians(settings['rudder_rate']), 'time_constant_s': settings['rudder_tau']},
                'wake_propulsor': index, 'normal_factor': 1.0, 'fin_servo_power': None,
            })
    if 'fin_y' in settings:
        for side in [-1, 1]:
            surfaces.append({
                'installation': installation(geometry, settings['fin_x'], side*settings['fin_y'], settings['fin_height']),
                'area_m2': 18.0, 'aspect_ratio': 2.0, 'normal_body': [0.0, 0.0, 1.0],
                'servo': {'max_angle_rad': math.radians(25), 'max_rate_rad_s': math.radians(15), 'time_constant_s': 0.4},
                'wake_propulsor': None, 'normal_factor': 1.0,
                'fin_servo_power': {'mean_chord_m': 3.0, 'efficiency': 0.65, 'standby_w': 2000.0},
            })
    return {'water_density_kg_m3': RHO, 'propulsors': propulsors, 'surfaces': surfaces}


def hull_and_geometry(directory):
    geometry = json.loads((directory/'geometry.json').read_text())
    source = cpt.load_mesh(str(directory/'full-hull.dat'), file_format='nemoh')
    points = source.vertices.copy()
    points[:, 2] -= geometry['draft_m']
    mesh = trimesh.Trimesh(points, source.faces[:, :3], process=True)
    if not mesh.is_watertight or not mesh.is_winding_consistent or mesh.volume <= 0:
        raise ValueError('设备包络核验需要法向一致的封闭完整船体')
    return geometry, mesh


def check_layout(directory, system, source_kg):
    geometry, mesh = hull_and_geometry(directory)
    kg, draft = geometry['kg_keel_up_m'], geometry['draft_m']
    # 不同离散分辨率保持同一龙骨安装高度。
    checks = {'geometry_sha256': sha256(directory/'geometry.json'),
              'full_hull_sha256': sha256(directory/'full-hull.dat'), 'propulsors': [], 'surfaces': []}
    for propeller in system['propulsors']:
        original = propeller['installation']
        transformed = copy.deepcopy(original)
        transformed['positionBodyM'][2] += kg-source_kg
        check = pod_check if propeller['azimuth'] else propeller_check
        proof = check(mesh, transformed, propeller['diameter_m'], kg, draft)
        if proof['clearance_m'] <= 1e-8:
            raise ValueError(f'完整桨盘运动包络与船体冲突 {proof}')
        checks['propulsors'].append(proof)
    for surface in system['surfaces']:
        transformed = copy.deepcopy(surface)
        transformed['installation']['positionBodyM'][2] += kg-source_kg
        point = transformed['installation']['positionBodyM']
        center = [point[0], -point[1], kg-draft-point[2]]
        if mesh.contains([center])[0]:
            raise ValueError(f'翼面中心位于封闭船体内部 {center}')
        checks['surfaces'].append(surface_check(mesh, transformed, kg, draft))
    return checks


def initial_state(geometry, system, coefficients):
    speed = geometry['cruise_speed_mps']
    propulsors, surfaces = system['propulsors'], system['surfaces']
    pitch = geometry['equilibrium_pitch_rad']
    def loads(omega):
        result = []
        for propeller in propulsors:
            point = propeller['installation']['positionBodyM']
            immersion = (-geometry['center_of_mass_waterline_z_up_m'][2]
                         -math.sin(pitch)*point[0]+math.cos(pitch)*point[2])
            result.append(b470_loads(omega, speed, coefficients, propeller['diameter_m'], immersion))
        return result
    resistance = 0.5*RHO*geometry['lpp_m']*geometry['draft_m']*speed**2*0.022
    def balance(omega):
        pairs = loads(omega)
        drag = 0.0
        for surface in surfaces:
            speed_squared = speed**2
            index = surface['wake_propulsor']
            if index is not None:
                area = math.pi*propulsors[index]['diameter_m']**2/4
                speed_squared += 2*max(pairs[index][0], 0)/(RHO*area)
            drag += 0.5*RHO*surface['area_m2']*0.01*speed_squared
        return sum(pair[0] for pair in pairs)-drag-resistance
    rated = min(propeller['rated_speed_rad_s'] for propeller in propulsors)
    low, high = 0.0, rated
    if speed == 0.0:
        omega = 0.0
    else:
        if balance(high) < 0:
            raise ValueError('额定推进能力无法支持标称初速')
        for _ in range(70):
            middle = (low+high)/2
            if balance(middle) < 0:
                low = middle
            else:
                high = middle
        omega = (low+high)/2
    torques = []
    for propeller, (_, hydraulic_torque) in zip(propulsors, loads(omega)):
        rated_torque = propeller['max_power_w']/propeller['rated_speed_rad_s']
        friction = (0.01*rated_torque*math.tanh(omega/0.1)
                    +0.005*rated_torque*omega/propeller['rated_speed_rad_s'])
        torque = hydraulic_torque+friction
        if torque*omega > propeller['max_power_w'] or abs(torque) > 1.2*rated_torque:
            raise ValueError('初始平衡点超过电机功率或扭矩限制')
        torques.append(torque)
    return {'propeller_shaft_speed_rad_s': [omega]*len(propulsors), 'motor_torques_nm': torques,
        'shaft_reference_speed_rad_s': [omega]*len(propulsors), 'azimuth_angles_rad': [0.0]*len(propulsors),
        'control_surface_angles_rad': [0.0]*len(surfaces)}, balance(omega)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vessel', choices=LAYOUTS, required=True)
    parser.add_argument('--geometry', type=Path, required=True)
    parser.add_argument('--comparison-geometry', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if json.loads((args.geometry/'static-validation.json').read_text())['status'] != 'passed':
        raise ValueError('输入静水加载尚未通过')
    definition, settings = DEFINITIONS[args.vessel], LAYOUTS[args.vessel]
    geometry, _ = hull_and_geometry(args.geometry)
    system = layout(geometry, settings)
    checks = [check_layout(directory, system, geometry['kg_keel_up_m']) for directory in
              [args.geometry, *([args.comparison_geometry] if args.comparison_geometry else [])]]
    previous_settings = settings.copy()
    for key, value in settings.items():
        if key.startswith('previous_'):
            previous_settings[key.removeprefix('previous_')] = value
    previous_system = layout(geometry, previous_settings)
    previous_checks = []
    for directory in [args.geometry, *([args.comparison_geometry] if args.comparison_geometry else [])]:
        try:
            previous_checks.append({'status': 'clear', 'proof':
                check_layout(directory, previous_system, geometry['kg_keel_up_m'])})
        except ValueError as error:
            previous_checks.append({'status': 'conflict', 'reason': str(error),
                'geometry_sha256': sha256(directory/'geometry.json'),
                'full_hull_sha256': sha256(directory/'full-hull.dat')})
    hull = json.loads((args.geometry/'hydrostatic-hull.json').read_text())
    points = np.asarray(hull['vertices_keel_up_m'])
    points[:, 1] *= -1
    points[:, 2] = geometry['kg_keel_up_m']-points[:, 2]
    geometry['nonlinear_hydrostatics'] = {'vertices_body_m': points.tolist(), 'triangles': hull['triangles'],
        'cg_waterline_height_m': geometry['center_of_mass_waterline_z_up_m'][2]}
    coefficients, coefficient_sha = b470_coefficients()
    initial, residual = initial_state(geometry, system, coefficients)
    actuators = {'system': system, 'initial_state': initial}
    mapped = {'water_density_kg_m3': RHO, 'length_m': geometry['lpp_m'], 'draft_m': geometry['draft_m'],
        'surge_coefficients': [0.022, -0.040, 0.002, 0.011, 0.771],
        'sway_coefficients': [-0.315, 0.083, -1.607, 0.379, -0.391, 0.008],
        'yaw_coefficients': [-0.137, -0.049, -0.030, -0.294, 0.055, -0.013],
        'crossflow_cd': 1.0, 'force_center_body_z_m': geometry['kg_keel_up_m']-geometry['kb_keel_up_m']}
    parameters = {key: value for key, value in geometry.items() if key not in ['nonlinear_hydrostatics', 'loading']}
    entries = [*parameter_entries(parameters, 'geometry', authority_issue=definition['issue']),
               *parameter_entries({'mapped_mmg': mapped}, 'maneuvering', authority_issue=definition['issue']),
               *parameter_entries(actuators, 'actuators', authority_issue=definition['issue'])]
    args.output.mkdir(parents=True, exist_ok=True)
    for name in ['hull.dat', 'lid.dat', 'full-hull.dat', 'hydrostatic-hull.json', 'source-sections.json',
                 'geometry-provenance.json', 'static-validation.json']:
        shutil.copy2(args.geometry/name, args.output/name)
    provenance = {'schema': 'act.model-pack.provenance.v2', 'model_fidelity': 'research-nominal',
        'authority': [f'https://github.com/yong-wei/act/issues/{definition["issue"]}',
                      'https://github.com/yong-wei/act/issues/2147'],
        'generator_sha256': sha256(Path(__file__)), 'geometry_provenance_sha256': sha256(args.geometry/'geometry-provenance.json'),
        'coefficient_generator_sha256': sha256(Path(__file__).with_name('build_destroyer_pack.py')),
        'envelope_validator_sha256': sha256(Path(__file__).with_name('validate_hull_pack.py')),
        'propeller_coefficients_sha256': coefficient_sha, 'entries': entries,
        'installation_revisions': {key: value for key, value in settings.items() if key.startswith('previous_')
            or key in ['prop_x', 'rudder_x', 'fin_y']},
        'installation_revision_basis': 'closed source hull versus complete physical actuator swept envelope',
        'not_ready': ['vessel-calibrated viscous derivatives', 'fitted vessel radiation',
                      'validated wave coefficients', 'specialist coupling and normal-page integration']}
    validation = {'schema': 'act.vessel-pack-validation.v1', 'status': 'computed',
        'initial_surge_force_residual_n': residual, 'geometry_and_installation': checks,
        'previous_layout': previous_system, 'previous_layout_checks': previous_checks,
        'native_verification': 'pending', 'fidelity': 'research-nominal'}
    for name, value in [('geometry.json', geometry), ('maneuvering.json', {'mapped_mmg': mapped}),
                        ('actuators.json', actuators), ('provenance.json', provenance), ('validation.json', validation)]:
        write_json(args.output/name, value)
    files = sorted(path.name for path in args.output.iterdir() if path.is_file() and path.name != 'manifest.json')
    write_json(args.output/'manifest.json', {'schema': 'act.model-pack.manifest.v2', 'vessel': args.vessel,
        'model_version': 'research-nominal-v1', 'model_fidelity': 'research-nominal',
        'files_sha256': {name: sha256(args.output/name) for name in files}})
    print(json.dumps({'vessel': args.vessel, 'mass_kg': geometry['displacement_mass_kg'],
        'initial_rpm': initial['propeller_shaft_speed_rad_s'][0]*30/math.pi, 'force_residual_n': residual,
        'resolutions': len(checks), 'status': validation['status']}))


if __name__ == '__main__':
    main()
