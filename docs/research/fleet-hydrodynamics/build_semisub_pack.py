"""装配981矩形教学船体、下挂八轴和构件低频阻力的基础参数包。"""

import argparse
import json
import shutil
from pathlib import Path

import numpy as np
import trimesh

from build_destroyer_pack import b470_coefficients, parameter_entries, sha256, write_json, write_nemoh
from build_semisub_geometry import BOXES, DRAFT_M, surface_mesh
from build_vessel_pack import initial_state, installation, layout


POSITIONS = [(-45, -30), (-45, 30), (-30, -35), (-30, 35),
             (45, -30), (45, 30), (30, -35), (30, 35)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--geometry-dir', type=Path, required=True)
    parser.add_argument('--column-top-height-m', type=float, default=40.0)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if not np.isfinite(args.column_top_height_m) or args.column_top_height_m <= DRAFT_M:
        raise ValueError('立柱上沿须高于平均工作水面')
    geometry = json.loads((args.geometry_dir / 'geometry.json').read_text())
    validation = json.loads((args.geometry_dir / 'geometry-validation.json').read_text())
    qtf_proof_path = Path(__file__).with_name('semisub-qtf-validation') / 'validation.json'
    qtf_proof = json.loads(qtf_proof_path.read_text())
    for name in ['geometry.json', 'hull.dat', 'lid.dat', 'nemoh-body.dat']:
        if sha256(args.geometry_dir / name) != validation['output_sha256'][name]:
            raise ValueError(f'输入几何与证明不一致 {name}')
    if geometry['vessel'] != 'semisub-981':
        raise ValueError('当前装配器接受981冻结矩形定义')
    if (sha256(args.geometry_dir / 'geometry.json') != qtf_proof['case']['geometry_sha256']
            or sha256(args.geometry_dir / 'nemoh-body.dat') != qtf_proof['case']['mesh_sha256']):
        raise ValueError('基础参数包与实际差频求解几何不一致')
    geometry['cruise_speed_mps'] = 0.0
    geometry['equilibrium_pitch_rad'] = 0.0
    full_boxes = [*BOXES, *[(box[0], box[1], (DRAFT_M, args.column_top_height_m)) for box in BOXES[2:]]]
    vertices, sides, top = surface_mesh(5.0, full_boxes)
    quads = np.vstack([sides, top[:, ::-1]])
    triangles = np.vstack([quads[:, [0, 1, 2]], quads[:, [0, 2, 3]]])
    mesh = trimesh.Trimesh(vertices, triangles, process=True)
    if not mesh.is_watertight or not mesh.is_winding_consistent or mesh.volume <= 0:
        raise ValueError('完整浮筒/立柱船体未形成正向封闭体积')
    kg = geometry['kg_keel_up_m']
    body_points = mesh.vertices.copy()
    body_points[:, 1] *= -1
    body_points[:, 2] = kg - DRAFT_M - body_points[:, 2]
    geometry['nonlinear_hydrostatics'] = {'vertices_body_m': body_points.tolist(),
        'triangles': mesh.faces.tolist(), 'cg_waterline_height_m': kg-DRAFT_M}
    settings = dict(count=1, diameter=4.5, power=4.6e6, rpm=180.0, height=-3.0,
        prop_x=0.0, prop_y=0.0, pod_rate=15.0, pod_tau=1.0)
    propulsors = []
    for x, y in POSITIONS:
        propeller = layout(geometry, settings)['propulsors'][0]
        propeller['installation'] = installation(geometry, x, y, -3.0)
        propulsors.append(propeller)
    system = {'water_density_kg_m3': 1025.0, 'propulsors': propulsors, 'surfaces': []}
    coefficients, coefficient_sha = b470_coefficients()
    initial, residual = initial_state(geometry, system, coefficients)
    actuators = {'system': system, 'initial_state': initial}
    boxes_body = [[[box[0][0], box[0][1]], [-box[1][1], -box[1][0]],
                   [kg-box[2][1], kg-box[2][0]]] for box in BOXES]
    maneuvering = {'component_drag': {'water_density_kg_m3': 1025.0,
        'drag_coefficient': 1.0, 'stations_per_axis': 21, 'boxes_body_m': boxes_body}}
    clearance = min(propeller['installation']['positionBodyM'][2] - propeller['diameter_m']/2
                    - body_points[:, 2].max() for propeller in propulsors)
    if clearance < .75 - 1e-10:
        raise ValueError('下挂推进器完整球包络净空失败')
    parameters = {key: value for key, value in geometry.items()
                  if key not in ['nonlinear_hydrostatics', 'boxes_keel_up_m', 'source']}
    entries = [*parameter_entries(parameters, 'geometry', authority_issue=2161),
               *parameter_entries(maneuvering, 'maneuvering', authority_issue=2157),
               *parameter_entries(actuators, 'actuators', authority_issue=2147),
               {'parameter': 'freeboard.column_top_height_m', 'value': args.column_top_height_m,
                'unit': 'm', 'grade': 'T', 'source': 'https://github.com/yong-wei/act/issues/2157',
                'formula_or_table': 'generator-selected T assumption; same column sections extended above frozen 19m waterline',
                'uncertainty': 'not_quantified'}]
    args.output.mkdir(parents=True, exist_ok=True)
    for name in ['hull.dat', 'lid.dat', 'nemoh-body.dat', 'geometry-validation.json']:
        shutil.copy2(args.geometry_dir / name, args.output / name)
    write_nemoh(args.output / 'full-hull.dat', mesh.vertices + [0, 0, DRAFT_M], mesh.faces[:, [0, 1, 2, 2]])
    provenance = {'schema': 'act.model-pack.provenance.v2', 'model_fidelity': 'research-nominal',
        'generator_sha256': sha256(Path(__file__)), 'entries': entries,
        'source_geometry_sha256': sha256(args.geometry_dir / 'geometry.json'),
        'geometry_generator_sha256': sha256(Path(__file__).with_name('build_semisub_geometry.py')),
        'actuator_layout_generator_sha256': sha256(Path(__file__).with_name('build_vessel_pack.py')),
        'qtf_validation_sha256': sha256(qtf_proof_path),
        'nemoh_mesh_sha256': sha256(args.geometry_dir / 'nemoh-body.dat'),
        'propeller_coefficients_sha256': coefficient_sha,
        'drag_scope': 'low-frequency rigid-body velocity relative to mean uniform current on frozen mean wetted component projections',
        'not_ready': ['fitted vessel added mass and radiation', 'online diffraction and full complex QTF',
            'wave-orbital viscous drag', 'thruster interference and operating thrust caps',
            '32MW power allocation and DP controller', 'normal-page integration']}
    result = {'schema': 'act.semisub-pack.validation.v1', 'status': 'computed',
        'mass_kg': geometry['displacement_mass_kg'], 'gm_transverse_m': geometry['gm_transverse_m'],
        'gm_longitudinal_m': geometry['gm_longitudinal_m'], 'kg_keel_up_m': kg,
        'closed_full_hull': bool(mesh.is_watertight), 'full_triangles': len(mesh.faces),
        'all_azimuth_envelope_clearance_lower_bound_m': float(clearance),
        'initial_surge_force_residual_n': residual, 'propulsors': len(propulsors),
        'native_verification': 'pending'}
    for name, value in [('geometry.json', geometry), ('maneuvering.json', maneuvering),
        ('actuators.json', actuators), ('provenance.json', provenance), ('validation.json', result)]:
        write_json(args.output / name, value)
    files = sorted(path.name for path in args.output.iterdir() if path.is_file() and path.name != 'manifest.json')
    write_json(args.output / 'manifest.json', {'schema': 'act.model-pack.manifest.v2', 'vessel': 'semisub-981',
        'model_version': 'research-nominal-v1', 'model_fidelity': 'research-nominal',
        'files_sha256': {name: sha256(args.output / name) for name in files}})
    print(json.dumps(result))


if __name__ == '__main__':
    main()
