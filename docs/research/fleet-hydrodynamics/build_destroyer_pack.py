"""生产055双轴/双舵T级参数包和独立三角湿表面。"""

import argparse
import hashlib
import json
import math
import re
import shutil
from pathlib import Path

import capytaine as cpt
import numpy as np

RHO, GRAVITY = 1025.0, 9.81
LENGTH, BEAM, DRAFT, MASS = 171.0, 20.0, 6.6, 13e6
REPOSITORY = Path(__file__).resolve().parents[3]


def write_json(path, value):
    lines = (json.dumps(value, indent=2, allow_nan=False) + '\n').splitlines(keepends=True)
    with path.open('w') as stream:
        for offset in range(0, len(lines), 400):
            stream.write(''.join(lines[offset:offset + 400]))


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_nemoh(path, vertices, faces):
    with path.open('w') as stream:
        stream.write('2 0\n')
        for index, point in enumerate(vertices, start=1):
            stream.write(f'{index} ' + ' '.join(format(value, '.17g') for value in point) + '\n')
        stream.write('0 0 0 0 0\n')
        for face in faces:
            stream.write(' '.join(str(index + 1) for index in face) + '\n')
        stream.write('0 0 0 0\n')


def parameter_entries(value, prefix, leaf='', authority_issue=2158):
    units = {
        'loa_m': 'm', 'lpp_m': 'm', 'beam_m': 'm', 'draft_m': 'm',
        'displacement_volume_m3': 'm^3', 'displacement_mass_kg': 'kg',
        'waterline_area_m2': 'm^2', 'water_density_kg_m3': 'kg/m^3',
        'kb_keel_up_m': 'm', 'kg_keel_up_m': 'm', 'gm_transverse_m': 'm',
        'gm_longitudinal_m': 'm', 'cruise_speed_mps': 'm/s',
        'center_of_mass_waterline_z_up_m': 'm', 'ixx': 'kg*m^2', 'iyy': 'kg*m^2', 'izz': 'kg*m^2',
        'longitudinal_power': '1', 'vertical_power': '1', 'longitudinal_panels': '1', 'vertical_panels': '1',
        'length_m': 'm', 'surge_coefficients': '1', 'sway_coefficients': '1', 'yaw_coefficients': '1',
        'crossflow_cd': '1', 'force_center_body_z_m': 'm',
        'positionBodyM': 'm', 'referenceImmersionM': 'm', 'diameter_m': 'm', 'max_power_w': 'W',
        'rated_speed_rad_s': 'rad/s', 'motor_time_constant_s': 's', 'shaft_inertia_kg_m2': 'kg*m^2',
        'reference_slew_rad_s2': 'rad/s^2', 'speed_control_time_s': 's', 'area_m2': 'm^2',
        'aspect_ratio': '1', 'normal_body': '1', 'max_angle_rad': 'rad', 'max_rate_rad_s': 'rad/s',
        'time_constant_s': 's', 'wake_propulsor': '1', 'normal_factor': '1',
        'fullness_power': '1', 'source_scale_factors': '1', 'wetted_length_m': 'm', 'wetted_beam_m': 'm',
        'source_center_of_buoyancy_x_m': 'm', 'center_of_flotation_x_m': 'm',
        'equilibrium_pitch_rad': 'rad', 'mean_chord_m': 'm', 'efficiency': '1', 'standby_w': 'W',
        'forbidden_sectors_rad': 'rad',
        'drag_coefficient': '1', 'stations_per_axis': '1', 'boxes_body_m': 'm',
        'center_bottom_body_m': 'm', 'width_m': 'm', 'height_m': 'm',
        'fill_ratio': '1', 'density_kg_m3': 'kg/m^3', 'damping_ratio': '1',
        'free_surface_correction_m': 'm', 'effective_gm_m': 'm',
        'frequency_band_rad_s': 'rad/s', 'natural_frequency_rad_s': 'rad/s',
        'propeller_shaft_speed_rad_s': 'rad/s', 'motor_torques_nm': 'N*m',
        'shaft_reference_speed_rad_s': 'rad/s', 'azimuth_angles_rad': 'rad', 'control_surface_angles_rad': 'rad',
    }
    if isinstance(value, dict):
        return [entry for key, child in value.items()
                for entry in parameter_entries(child, f'{prefix}.{key}', key, authority_issue)]
    if isinstance(value, list):
        return [entry for index, child in enumerate(value)
                for entry in parameter_entries(child, f'{prefix}[{index}]', leaf, authority_issue)]
    if not isinstance(value, (int, float)):
        return []
    unit = units.get(leaf)
    if leaf == 'hydrostatic_stiffness_si':
        row, column = map(int, re.findall(r'\[(\d+)\]', prefix)[-2:])
        unit = [['N/m', 'N/rad'], ['N*m/m', 'N*m/rad']][row >= 3][column >= 3]
    if leaf == 'liquid_initial_state':
        index = int(re.findall(r'\[(\d+)\]', prefix)[-1])
        unit = 'm' if index % 2 == 0 else 'm/s'
    if leaf in ['coupling', 'added_mass_factors']:
        axis = int(re.findall(r'\[(\d+)\]', prefix)[-1])
        unit = 'sqrt(kg)' if axis < 3 else 'sqrt(kg)*m'
        if leaf == 'coupling':
            unit += '/s'
    if unit is None:
        raise ValueError(f'参数缺少单位 {prefix}')
    source = f'https://github.com/yong-wei/act/issues/{authority_issue}'
    formula = 'fixed teaching definition or geometric/force-equilibrium derivation in generator'
    if any(name in prefix for name in ['surge_coefficients', 'sway_coefficients', 'yaw_coefficients']):
        source = 'https://doi.org/10.1007/s00773-014-0293-y'
        formula = 'Table 3 nondimensional derivatives, B-to-T prior at this hull Lpp/draft'
    return [{
        'parameter': prefix, 'value': value, 'unit': unit, 'grade': 'T',
        'source': source, 'formula_or_table': formula,
        'uncertainty': 'not_quantified',
    }]


def source_grid(profile, nx, nz):
    scales = np.asarray([180.0 / profile['source_full_length_m'],
                         BEAM / profile['source_full_beam_m'], DRAFT / profile['source_draft_m']])
    source_x = np.asarray(profile['x_m'])
    source_z = np.asarray(profile['z_m'])
    widths = np.asarray(profile['half_breadth_m'])
    x = np.linspace(source_x[0], source_x[-1], nx + 1)
    z = np.linspace(source_z[0], 0.0, nz + 1)
    sampled = np.asarray([np.interp(z, source_z,
        [np.interp(station, source_x, widths[:, iz]) for iz in range(len(source_z))]) for station in x])
    return x * scales[0], z * scales[2], sampled * scales[1], scales


def hull_mesh(fullness_power, x, z, half_breadths, beam_m=BEAM, close_top=False):
    vertices, faces, node_ids = [], [], {}
    grids = {}
    nx, nz = len(x) - 1, len(z) - 1
    def add_quad(quad, reverse=False):
        for triangle in [quad[:3], [quad[0], quad[2], quad[3]]]:
            if reverse:
                triangle.reverse()
            if len(set(triangle)) == 3 and any(abs(vertices[index][1]) > 1e-12 for index in triangle):
                faces.append([*triangle, triangle[-1]])
    for side in [-1, 1]:
        grid = []
        for ix in range(nx + 1):
            column = []
            for iz in range(nz + 1):
                half_width = 0.5 * beam_m * (2 * half_breadths[ix, iz] / beam_m)**fullness_power
                if half_width < 1e-5:
                    half_width = 0.0
                point = (float(x[ix]), side * half_width, float(z[iz]))
                key = tuple(round(value, 11) for value in point)
                if key not in node_ids:
                    node_ids[key] = len(vertices)
                    vertices.append(point)
                column.append(node_ids[key])
            grid.append(column)
        for ix in range(nx):
            for iz in range(nz):
                quad = [grid[ix][iz], grid[ix + 1][iz], grid[ix + 1][iz + 1], grid[ix][iz + 1]]
                add_quad(quad, reverse=side > 0)
        grids[side] = grid
    port, starboard = grids[1], grids[-1]
    for end in [0, nx]:
        for iz in range(nz):
            add_quad([port[end][iz], starboard[end][iz], starboard[end][iz + 1], port[end][iz + 1]], reverse=end == nx)
    for ix in range(nx):
        add_quad([port[ix][0], port[ix + 1][0], starboard[ix + 1][0], starboard[ix][0]])
        if close_top:
            add_quad([starboard[ix][-1], starboard[ix + 1][-1], port[ix + 1][-1], port[ix][-1]])
    return cpt.Mesh(vertices=np.asarray(vertices), faces=np.asarray(faces), name='destroyer-055-wetted')


def volume_and_buoyancy(mesh):
    triangles = mesh.vertices[mesh.faces[:, :3]]
    volumes = np.einsum('ij,ij->i', triangles[:, 0], np.cross(triangles[:, 1], triangles[:, 2])) / 6
    volume = volumes.sum()
    return float(volume), np.sum(volumes[:, None] * triangles.sum(axis=1) / 4, axis=0) / volume


def waterplane(mesh):
    triangles = mesh.faces[:, :3]
    edges = np.vstack([triangles[:, [0, 1]], triangles[:, [1, 2]], triangles[:, [2, 0]]])
    unique, counts = np.unique(np.sort(edges, axis=1), axis=0, return_counts=True)
    if (counts > 2).any():
        raise ValueError('湿面存在非流形边')
    boundary = unique[counts == 1]
    if abs(mesh.vertices[np.unique(boundary), 2]).max() > 1e-10:
        raise ValueError('湿面包含水线以外的开口')
    neighbors = {}
    for first, second in boundary:
        neighbors.setdefault(int(first), []).append(int(second))
        neighbors.setdefault(int(second), []).append(int(first))
    if any(len(adjacent) != 2 for adjacent in neighbors.values()):
        raise ValueError('水线边界含分叉或断点')
    start = min(neighbors)
    loop, previous, current = [start], None, start
    while True:
        following = next(index for index in neighbors[current] if index != previous)
        if following == start:
            break
        if following in loop:
            raise ValueError('水线边界自相交')
        loop.append(following)
        previous, current = current, following
    if len(loop) != len(neighbors):
        raise ValueError('湿面包含多个水线边界')
    polygon = mesh.vertices[loop, :2]
    following = np.roll(polygon, -1, axis=0)
    cross = polygon[:, 0] * following[:, 1] - following[:, 0] * polygon[:, 1]
    area = cross.sum() / 2
    inertia_x = np.sum((polygon[:, 1]**2 + polygon[:, 1] * following[:, 1] + following[:, 1]**2) * cross) / 12
    inertia_y = np.sum((polygon[:, 0]**2 + polygon[:, 0] * following[:, 0] + following[:, 0]**2) * cross) / 12
    first_moment_x = np.sum((polygon[:, 0] + following[:, 0]) * cross) / 6
    lid_polygon = polygon if area < 0 else polygon[::-1]
    return lid_polygon, abs(area), abs(inertia_x), abs(inertia_y), first_moment_x / area


def b470_coefficients():
    path = REPOSITORY / 'rust/control-engine/src/sixdof/benchmark_b470.rs'
    source = path.read_text()
    arrays = []
    for name in ['AT', 'BT', 'AQ', 'BQ']:
        block = re.search(r'pub const ' + name + r': \[f64; 21\] = \[(.*?)\];', source, re.S)
        values = [float(value) for value in block[1].replace('\n', '').split(',') if value.strip()]
        if len(values) != 21 or not np.isfinite(values).all():
            raise ValueError('B4-70完整系数表解析失败')
        arrays.append(values)
    return arrays, sha256(path)


def b470_loads(omega, velocity, coefficients, diameter=5.0, immersion_m=3.5):
    beta = math.atan2(velocity, 0.35 * omega * diameter)
    at, bt, aq, bq = coefficients
    ct = sum(at[k] * math.cos(k * beta) + bt[k] * math.sin(k * beta) for k in range(21))
    cq = sum(aq[k] * math.cos(k * beta) + bq[k] * math.sin(k * beta) for k in range(21))
    scale = 0.5 * RHO * math.pi / 4 * (velocity**2 + (0.35 * omega * diameter)**2)
    immersion_ratio = immersion_m / (diameter/2)
    loading = min(abs(ct), 1.0)
    critical = 1.0 + 0.6 * loading
    floor = 0.35 - 0.15 * loading
    factor = floor + (1 - floor) * (0.5 + 0.5 * math.tanh((immersion_ratio - critical) / 0.25))
    return scale * diameter**2 * ct * factor, scale * diameter**3 * cq * factor**0.75


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--longitudinal-panels', type=int, default=86)
    parser.add_argument('--vertical-panels', type=int, default=12)
    parser.add_argument('--source-sections', type=Path,
        default=REPOSITORY / 'rust/control-engine/model-data/destroyer-055/v3/source-sections.json')
    args = parser.parse_args()
    if args.longitudinal_panels < 8 or args.longitudinal_panels % 2 or args.vertical_panels < 4:
        parser.error('纵向面元数须为至少8的偶数，垂向至少4')
    profile = json.loads(args.source_sections.read_text())
    x, z, widths, scales = source_grid(profile, args.longitudinal_panels, args.vertical_panels)
    low, high = 0.1, 8.0
    if not (volume_and_buoyancy(hull_mesh(low, x, z, widths))[0] >= MASS / RHO
            >= volume_and_buoyancy(hull_mesh(high, x, z, widths))[0]):
        raise ValueError('目标排水量超出当前剖面形状的归一化范围')
    for _ in range(70):
        power = (low + high) / 2
        mesh = hull_mesh(power, x, z, widths)
        volume, center = volume_and_buoyancy(mesh)
        if volume > MASS / RHO:
            low = power
        else:
            high = power
    power = (low + high) / 2
    mesh = hull_mesh(power, x, z, widths)
    volume, center = volume_and_buoyancy(mesh)
    source_center_x = float(center[0])
    mesh = cpt.Mesh(vertices=mesh.vertices - [source_center_x, float(center[1]), 0.0], faces=mesh.faces,
                    name='destroyer-055-source-loft')
    volume, center = volume_and_buoyancy(mesh)
    polygon, area, inertia_x, inertia_y, flotation_x = waterplane(mesh)
    kb = float(center[2] + DRAFT)
    kg = kb + inertia_x / volume - 1.5
    gm_l = kb + (inertia_y - area * flotation_x**2) / volume - kg
    if abs(volume - MASS / RHO) / volume > 1e-10 or min(kg, gm_l, area) <= 0:
        raise ValueError('几何/单一KG/质量/稳性未闭合')
    stiffness = np.diag([0.0, 0.0, RHO * GRAVITY * area, MASS * GRAVITY * 1.5,
                         RHO * GRAVITY * (inertia_y + volume * (kb - kg)), 0.0])
    stiffness[2, 4] = stiffness[4, 2] = -RHO * GRAVITY * area * flotation_x
    geometry = {
        'loa_m': 180.0, 'lpp_m': LENGTH, 'beam_m': BEAM, 'draft_m': DRAFT,
        'displacement_volume_m3': volume, 'displacement_mass_kg': MASS,
        'mass_basis': 'displacement_volume', 'waterline_area_m2': area,
        'water_density_kg_m3': RHO, 'kb_keel_up_m': kb, 'kg_keel_up_m': kg,
        'gm_transverse_m': 1.5, 'gm_longitudinal_m': gm_l, 'cruise_speed_mps': 8.0,
        'center_of_flotation_x_m': float(flotation_x),
        'wetted_length_m': float(np.ptp(mesh.vertices[:, 0])),
        'wetted_beam_m': float(np.ptp(mesh.vertices[:, 1])),
        'center_of_mass_waterline_z_up_m': [0.0, 0.0, kg - DRAFT],
        'inertia_about_cg_kg_m2': dict(zip(['ixx', 'iyy', 'izz'],
            [MASS * (0.35 * BEAM)**2, MASS * (0.25 * LENGTH)**2, MASS * (0.25 * LENGTH)**2])),
        'hydrostatic_stiffness_si': stiffness.tolist(),
        'wet_surface_definition': {
            'grade': 'T', 'formula': 'paired visual-hull sections, y=+-B/2*(2*y_source/B)^p',
            'fullness_power': power, 'source_scale_factors': scales.tolist(),
            'source_center_of_buoyancy_x_m': source_center_x,
            'longitudinal_panels': args.longitudinal_panels, 'vertical_panels': args.vertical_panels,
        },
    }
    mapped = {
        'water_density_kg_m3': RHO, 'length_m': LENGTH, 'draft_m': DRAFT,
        'surge_coefficients': [0.022, -0.040, 0.002, 0.011, 0.771],
        'sway_coefficients': [-0.315, 0.083, -1.607, 0.379, -0.391, 0.008],
        'yaw_coefficients': [-0.137, -0.049, -0.030, -0.294, 0.055, -0.013],
        'crossflow_cd': 1.0, 'force_center_body_z_m': kg - kb,
    }
    coefficients, coefficients_sha = b470_coefficients()
    resistance = 0.5 * RHO * LENGTH * DRAFT * 8.0**2 * mapped['surge_coefficients'][0]
    rated = 160.0 * math.pi / 30
    def balance(omega):
        thrust, _ = b470_loads(omega, 8.0, coefficients)
        wash_speed_sq = 8.0**2 + 2 * max(thrust, 0) / (RHO * math.pi * 5.0**2 / 4)
        return 2 * (thrust - 0.5 * RHO * 12.0 * 0.01 * wash_speed_sq) - resistance
    low, high = 0.0, rated
    if balance(high) <= 0:
        raise ValueError('额定推进能力不能维持标称初速')
    for _ in range(70):
        middle = (low + high) / 2
        if balance(middle) < 0:
            low = middle
        else:
            high = middle
    omega = (low + high) / 2
    _, hydraulic_torque = b470_loads(omega, 8.0, coefficients)
    rated_torque = 15e6 / rated
    friction = 0.01 * rated_torque * math.tanh(omega / 0.1) + 0.005 * rated_torque * omega / rated
    motor_torque = hydraulic_torque + friction
    if motor_torque * omega > 15e6 or motor_torque > 1.2 * rated_torque:
        raise ValueError('初始平衡点违反电机功率或扭矩约束')
    propulsors, surfaces = [], []
    for side in [-1, 1]:
        installation = {'positionBodyM': [-78.0, side * 0.18 * BEAM, kg - 3.1], 'referenceImmersionM': 3.5}
        propulsors.append({
            'installation': installation, 'diameter_m': 5.0, 'max_power_w': 15e6,
            'rated_speed_rad_s': rated, 'motor_time_constant_s': 0.5,
            'shaft_inertia_kg_m2': 25000 * (5 / 4)**5,
            'reference_slew_rad_s2': 5 * math.pi / 30, 'speed_control_time_s': 0.75,
            'azimuth': None,
        })
        surfaces.append({
            'installation': {'positionBodyM': [-0.48 * LENGTH, side * 0.18 * BEAM, kg - 3.1], 'referenceImmersionM': 3.5},
            'area_m2': 12.0, 'aspect_ratio': 2.0, 'normal_body': [0.0, 1.0, 0.0],
            'servo': {'max_angle_rad': math.radians(35), 'max_rate_rad_s': math.radians(5), 'time_constant_s': 0.5},
            'wake_propulsor': len(propulsors) - 1, 'normal_factor': 1.0, 'fin_servo_power': None,
        })
    actuators = {
        'system': {'water_density_kg_m3': RHO, 'propulsors': propulsors, 'surfaces': surfaces},
        'initial_state': {
            'propeller_shaft_speed_rad_s': [omega] * 2, 'motor_torques_nm': [motor_torque] * 2,
            'shaft_reference_speed_rad_s': [omega] * 2, 'azimuth_angles_rad': [0.0] * 2,
            'control_surface_angles_rad': [0.0] * 2,
        },
    }
    provenance = {
        'schema': 'act.model-pack.provenance.v2', 'model_fidelity': 'research-nominal',
        'geometry_grade': 'T', 'inertia_grade': 'T', 'maneuvering_grade': 'T', 'actuator_grade': 'T',
        'authority': ['https://github.com/yong-wei/act/issues/2147', 'https://github.com/yong-wei/act/issues/2158'],
        'geometry_derivation': 'independent closed loft from verified visual-hull sections, normalized LOA/B/draft and fixed mass',
        'source_sections_sha256': sha256(args.source_sections),
        'source_model_sha256': profile['source']['sourceSha256'],
        'source_model_commit': profile['source']['sourceCommit'],
        'source_symmetry_relative_l2': profile['port_starboard_relative_l2'],
        'maneuvering_source': 'Yasukawa and Yoshimura 2015 Table 3, B-to-T nondimensional prior',
        'maneuvering_doi': '10.1007/s00773-014-0293-y',
        'propeller_source': 'Smogeli 2006 Table A.3, complete B4-70 Fourier map',
        'propeller_coefficients_sha256': coefficients_sha,
        'generator_sha256': sha256(Path(__file__)),
        'installation_revision': {
            'authority': 'https://github.com/yong-wei/act/issues/2147',
            'previous_longitudinal_position_m': -0.45 * LENGTH,
            'longitudinal_position_m': -78.0,
            'reason': 'original propeller disks intersect the source-derived hull at both section resolutions',
            'verification': 'envelope-validation.json',
            'grade': 'T',
        },
        'teaching_assumptions': {
            'shaft_speed_control_time_s': 0.75,
            'rudder_propeller_wash': 'ahead actuator-disk exit flow, reverse local flow without aft jet augmentation',
        },
        'not_ready': ['vessel-calibrated viscous derivatives', 'fitted vessel radiation', 'wave coefficient validation'],
        'entries': [*parameter_entries(geometry, 'geometry'),
                    *parameter_entries({'mapped_mmg': mapped}, 'maneuvering'),
                    *parameter_entries(actuators, 'actuators')],
    }
    args.output.mkdir(parents=True, exist_ok=True)
    if args.source_sections.resolve() != (args.output / 'source-sections.json').resolve():
        shutil.copy2(args.source_sections, args.output / 'source-sections.json')
    for name, value in [('geometry.json', geometry), ('maneuvering.json', {'mapped_mmg': mapped}),
                        ('actuators.json', actuators), ('provenance.json', provenance)]:
        write_json(args.output / name, value)
    write_nemoh(args.output / 'hull.dat', mesh.vertices, mesh.faces)
    lid_vertices = np.vstack([np.zeros(3), np.column_stack([polygon, np.zeros(len(polygon))])])
    lid_faces = [[0, index + 1, (index + 1) % len(polygon) + 1, (index + 1) % len(polygon) + 1]
                 for index in range(len(polygon))]
    write_nemoh(args.output / 'lid.dat', lid_vertices, lid_faces)
    validation = {
        'volume_relative_error': abs(volume - MASS / RHO) / volume,
        'initial_force_residual_n': balance(omega), 'initial_shaft_speed_rpm': omega * 30 / math.pi,
        'initial_motor_power_w_per_shaft': motor_torque * omega, 'wet_panels': mesh.nb_faces,
        'kg_keel_up_m': kg, 'gm_longitudinal_m': gm_l,
        'convergence': 'pending', 'fidelity': 'research-nominal',
    }
    write_json(args.output / 'validation.json', validation)
    files = ['geometry.json', 'maneuvering.json', 'actuators.json', 'provenance.json', 'hull.dat', 'lid.dat',
             'source-sections.json', 'validation.json']
    write_json(args.output / 'manifest.json', {
        'schema': 'act.model-pack.manifest.v2', 'vessel': 'destroyer-055',
        'model_version': 'research-nominal-v3', 'model_fidelity': 'research-nominal',
        'files_sha256': {name: sha256(args.output / name) for name in files},
    })
    print(json.dumps(validation))


if __name__ == '__main__':
    main()
