"""同一源船形的排水、单一KG、变载荷/最小压载和纵倾平衡。"""

import argparse
import json
import math
import shutil
from pathlib import Path

import capytaine as cpt
import numpy as np
import trimesh
from scipy.optimize import root

from build_destroyer_pack import hull_mesh, sha256, waterplane, write_json, write_nemoh

RHO, GRAVITY = 1025.0, 9.81
DEFINITIONS = {
    'destroyer-055': dict(issue=2158, loa=180.0, lpp=171.0, beam=20.0, draft=6.6,
                         calibration_mass=13e6, baseline_mass=13e6, gm=1.5, speed=8.0),
    'lng-changheng': dict(issue=2154, loa=299.0, lpp=286.0, beam=46.4, draft=11.5,
                         moulded_depth=26.25,
                         calibration_mass=50e6 + 4*44*38*26*0.85*450,
                         baseline_mass=50e6 + 4*44*38*26*0.85*450, gm=2.5, speed=4.0),
    'container-msc': dict(issue=2159, loa=399.99, lpp=383.0, beam=61.5, draft=16.8,
                         moulded_depth=33.2,
                         calibration_mass=72e6+240e6*0.9, baseline_mass=72e6+240e6*0.6, gm=2.0, speed=8.0),
    'cruise-adora': dict(issue=2160, loa=323.6, lpp=305.0, beam=37.2, draft=8.26,
                        calibration_mass=68e6, baseline_mass=68e6, gm=1.6, speed=8.0),
    'icebreaker-xuelong2': dict(issue=2162, loa=122.5, lpp=116.0, beam=22.3, draft=8.3,
                              calibration_mass=14.3e6, baseline_mass=14.3e6, gm=1.4, speed=4.0),
    'dredger-tianjing': dict(issue=2163, loa=127.5, lpp=110.0, beam=23.0, draft=6.0,
                           calibration_mass=12e6, baseline_mass=12e6, gm=2.0, speed=0.0),
}


def source_grid(profile, definition, nx, nz):
    source_x, source_z = np.asarray(profile['x_m']), np.asarray(profile['z_m'])
    if source_z[-1] <= 0:
        raise ValueError('非线性静水模型需要水线上方船体轮廓')
    x = np.linspace(source_x[0], source_x[-1], nx + 1)
    z = np.r_[np.linspace(source_z[0], 0.0, nz + 1), np.linspace(0.0, source_z[-1], nz + 1)[1:]]
    widths = np.asarray(profile['half_breadth_m'])
    sampled = np.asarray([np.interp(z, source_z,
        [np.interp(station, source_x, widths[:, iz]) for iz in range(len(source_z))]) for station in x])
    underwater_scale = definition['draft'] / profile['source_draft_m']
    freeboard_scale = ((definition['moulded_depth'] - definition['draft']) / source_z[-1]
                      if 'moulded_depth' in definition else underwater_scale)
    scales = np.array([definition['loa'] / profile['source_full_length_m'],
                       definition['beam'] / profile['source_full_beam_m'], underwater_scale, freeboard_scale])
    height = definition['draft'] + z*np.where(z <= 0.0, underwater_scale, freeboard_scale)
    return x * scales[0], height, sampled * scales[1], scales


def closed_hull(power, grid, definition, validate=True):
    x, height, widths, _ = grid
    source = hull_mesh(power, x, height, widths, beam_m=definition['beam'], close_top=True)
    mesh = trimesh.Trimesh(source.vertices, source.faces[:, :3], process=True)
    mesh.remove_unreferenced_vertices()
    if validate and (not mesh.is_watertight or not mesh.is_winding_consistent or mesh.volume <= 0):
        edges, counts = np.unique(np.sort(mesh.edges, axis=1), axis=0, return_counts=True)
        problematic = mesh.vertices[edges[counts != 2][:5]].tolist()
        raise ValueError(f'完整船体放样未闭合 p={power:.17g}, edges={problematic}')
    return mesh


def submerged(mesh, draft, pitch=0.0):
    return mesh.slice_plane([0, 0, draft], [-math.sin(pitch), 0, -math.cos(pitch)],
                           cap=True, engine='earcut')


def calibration_volume(power, grid, definition):
    # 求根候选仅用于体积积分。最终参数才进入流形/封闭性门禁。
    mesh = closed_hull(power, grid, definition, validate=False)
    wet = mesh.slice_plane([0, 0, definition['draft']], [0, 0, -1], cap=False)
    # Trimesh按x方向散度积分，水平水线封盖的法向x分量为零。
    return float(wet.volume)


def level_draft(mesh, mass):
    low, high = float(mesh.bounds[0, 2]), float(mesh.bounds[1, 2])
    if mesh.volume * RHO < mass:
        raise ValueError('船体封闭体积不足以支持当前质量')
    for _ in range(55):
        middle = (low + high) / 2
        wet = submerged(mesh, middle)
        if wet.volume * RHO < mass:
            low = middle
        else:
            high = middle
    return (low + high) / 2


def wet_world(mesh, draft, pitch, kg):
    wet = submerged(mesh, draft, pitch)
    cosine, sine = math.cos(pitch), math.sin(pitch)
    transform = np.array([[cosine, 0, -sine], [0, 1, 0], [sine, 0, cosine]])
    points = (wet.vertices - [0.0, 0.0, kg]) @ transform.T
    cg_height = cosine * (kg - draft)
    points[:, 2] += cg_height
    # 与Trimesh的1e-8m平面分类容差一致，随后剔除水线封盖供BEM使用。
    points[abs(points[:, 2]) < 2e-8, 2] = 0.0
    faces = wet.faces[~np.all(abs(points[wet.faces, 2]) < 2e-8, axis=1)]
    return cpt.Mesh(points, np.column_stack([faces, faces[:, -1]])), wet, cg_height


def hydrostatics(mesh, draft, pitch, kg):
    wet_mesh, wet, cg_height = wet_world(mesh, draft, pitch, kg)
    polygon, area, inertia_x, inertia_y, flotation_x = waterplane(wet_mesh)
    volume = wet.volume
    center = wet.center_mass
    cosine, sine = math.cos(pitch), math.sin(pitch)
    buoyancy_world_z = sine * center[0] + cosine * (center[2] - kg) + cg_height
    lever = buoyancy_world_z - cg_height
    gm_t = lever + inertia_x / volume
    gm_l = lever + (inertia_y - area * flotation_x**2) / volume
    stiffness = np.diag([0.0, 0.0, RHO*GRAVITY*area,
                         RHO*GRAVITY*volume*gm_t, RHO*GRAVITY*(inertia_y+volume*lever), 0.0])
    stiffness[2, 4] = stiffness[4, 2] = -RHO*GRAVITY*area*flotation_x
    return dict(wet_mesh=wet_mesh, polygon=polygon, wet=wet, volume=volume,
                area=area, flotation_x=flotation_x, gm_t=gm_t, gm_l=gm_l,
                cg_height=cg_height, stiffness=stiffness, kb=float(center[2]))


def payload(definition, vessel, loading, profile, scales):
    if vessel == 'lng-changheng':
        mass = 4*44*38*26*loading*450
        height = 1.5 + loading*26/2
        positions = [[x, 0.0, height] for x in [-66.0, -22.0, 22.0, 66.0]]
        local_inertia = mass * np.array([(38**2+(26*loading)**2)/12,
                                         (44**2+(26*loading)**2)/12, (44**2+38**2)/12])
        return mass, np.asarray(positions), local_inertia, 50e6
    if vessel == 'container-msc':
        proxy = profile['source'].get('instancedMassProxy')
        if not proxy:
            raise ValueError('集装箱货载高度需要源几何实例重心证明')
        source_z = proxy['weightedCenterBemM'][2]
        height = definition['draft'] + source_z * (scales[3] if source_z >= 0.0 else scales[2])
        mass = 240e6*loading
        positions = [[x, 0.0, height] for x in [-0.25*definition['lpp'], 0.0, 0.25*definition['lpp']]]
        return mass, np.asarray(positions), np.zeros(3), 72e6
    return 0.0, np.zeros((0, 3)), np.zeros(3), definition['baseline_mass']


def point_inertias(positions, mass, center):
    if len(positions) == 0:
        return np.zeros(3)
    relative = positions - center
    return mass / len(positions) * np.sum(np.sum(relative**2, axis=1)[:, None] - relative**2, axis=0)


def loading_state(full, definition, vessel, loading, profile, scales, base_kg, base_inertia):
    baseline_loading = 0.85 if vessel == 'lng-changheng' else 0.6
    baseline_payload, baseline_positions, baseline_local, fixed_mass = payload(definition, vessel, baseline_loading, profile, scales)
    baseline_center = np.array([0.0, 0.0, base_kg])
    fixed_center = (definition['baseline_mass']*baseline_center
                    - baseline_payload*baseline_positions.mean(axis=0)) / fixed_mass
    fixed_inertia = (base_inertia - baseline_local - point_inertias(baseline_positions, baseline_payload, baseline_center)
                     - point_inertias(np.asarray([fixed_center]), fixed_mass, baseline_center))
    if np.any(fixed_inertia <= 0) or fixed_center[2] < 0:
        raise ValueError('固定部分质量/重心/惯量反算不成立')
    cargo_mass, cargo_positions, cargo_local, _ = payload(definition, vessel, loading, profile, scales)
    ballast_positions = np.array([[x, y, 1.5] for x in [-0.25*definition['lpp'], 0.0, 0.25*definition['lpp']]
                                 for y in [-0.25*definition['beam'], 0.25*definition['beam']]])
    def equilibrium(ballast):
        mass = fixed_mass+cargo_mass+ballast
        cg = (fixed_mass*fixed_center + cargo_mass*cargo_positions.mean(axis=0)
              + ballast*ballast_positions.mean(axis=0)) / mass
        def residual(value):
            draft, pitch = value
            wet = submerged(full, draft, pitch)
            if wet.volume <= 0:
                return [1e3, 1e3]
            cb = wet.center_mass
            return [(wet.volume*RHO-mass)/mass,
                    ((cb[0]-cg[0])*math.cos(pitch)-(cb[2]-cg[2])*math.sin(pitch))/definition['lpp']]
        solution = root(residual, [level_draft(full, mass), 0.0], tol=1e-10)
        error = np.linalg.norm(residual(solution.x))
        if not solution.success and error > 1e-8:
            raise ValueError('变载荷静水纵倾求解未收敛')
        draft, pitch = map(float, solution.x)
        if abs(pitch) > math.radians(5) or error > 1e-8:
            raise ValueError('变载荷静水平衡超出当前几何适用域')
        return mass, cg, draft, pitch, error
    height, radius, ballast_limit, shaft_x = ((4.0, 3.5, 35e6, -0.45*definition['lpp'])
        if vessel == 'lng-changheng' else (5.5, 5.0, 90e6, -0.46*definition['lpp']))
    def clearance(state):
        _, _, draft, pitch, _ = state
        return math.cos(pitch)*(draft-height)-math.sin(pitch)*shaft_x-radius
    ballast = 0.0
    state = equilibrium(ballast)
    if clearance(state) < 0.5:
        low, high = 0.0, ballast_limit
        if clearance(equilibrium(high)) < 0.5:
            raise ValueError('压载上限仍无法满足静态桨盘顶浸没')
        for _ in range(34):
            middle = (low+high)/2
            if clearance(equilibrium(middle)) < 0.5:
                low = middle
            else:
                high = middle
        ballast = high
        state = equilibrium(ballast)
    mass, cg, draft, pitch, error = state
    inertia = (fixed_inertia + point_inertias(np.asarray([fixed_center]), fixed_mass, cg)
               + cargo_local + point_inertias(cargo_positions, cargo_mass, cg)
               + point_inertias(ballast_positions, ballast, cg))
    return dict(mass=mass, kg=float(cg[2]), inertia=inertia, draft=draft, pitch=pitch,
                cargo_mass=cargo_mass, ballast_mass=ballast, equilibrium_residual=error,
                disk_top_immersion_m=clearance(state), fixed_mass=fixed_mass,
                fixed_center=fixed_center.tolist(), fixed_inertia=fixed_inertia.tolist(),
                payload_positions=cargo_positions.tolist(), ballast_positions=ballast_positions.tolist())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vessel', choices=DEFINITIONS, required=True)
    parser.add_argument('--source-sections', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--loading', type=float)
    parser.add_argument('--longitudinal-panels', type=int, default=86)
    parser.add_argument('--vertical-panels', type=int, default=12)
    args = parser.parse_args()
    if args.longitudinal_panels < 8 or args.longitudinal_panels % 2 or args.vertical_panels < 4:
        parser.error('纵向面元数须为至少8的偶数，垂向至少4')
    if args.loading is not None and (not np.isfinite(args.loading) or not 0.0 < args.loading <= 1.0
                                    or args.vessel not in ['lng-changheng', 'container-msc']):
        parser.error('变载荷仅用于LNG/集装箱且比例须在0至1之间')
    d = DEFINITIONS[args.vessel]
    profile = json.loads(args.source_sections.read_text())
    grid = source_grid(profile, d, args.longitudinal_panels, args.vertical_panels)
    low, high = 0.1, 8.0
    target = d['calibration_mass']/RHO
    if not calibration_volume(low, grid, d) >= target >= calibration_volume(high, grid, d):
        raise ValueError('固定排水量不在源剖面放样归一化范围内')
    for _ in range(55):
        power = (low+high)/2
        if calibration_volume(power, grid, d) > target:
            low = power
        else:
            high = power
    power = (low+high)/2
    full = closed_hull(power, grid, d)
    baseline_draft = level_draft(full, d['baseline_mass'])
    base_wet = submerged(full, baseline_draft)
    source_center_x = float(base_wet.center_mass[0])
    full.vertices[:, 0] -= source_center_x
    base = hydrostatics(full, baseline_draft, 0.0, 0.0)
    base_kg = base['gm_t']-d['gm']
    base_inertia = d['baseline_mass']*np.array([(0.35*d['beam'])**2, (0.25*d['lpp'])**2, (0.25*d['lpp'])**2])
    loading = args.loading if args.loading is not None else (
        0.85 if args.vessel == 'lng-changheng' else 0.6 if args.vessel == 'container-msc' else None)
    if args.vessel in ['lng-changheng', 'container-msc']:
        state = loading_state(full, d, args.vessel, loading, profile, grid[3], base_kg, base_inertia)
    else:
        state = dict(mass=d['baseline_mass'], kg=base_kg, inertia=base_inertia,
                     draft=baseline_draft, pitch=0.0, cargo_mass=0.0, ballast_mass=0.0)
    actual = hydrostatics(full, state['draft'], state['pitch'], state['kg'])
    mass_error = abs(actual['volume']*RHO/state['mass']-1)
    ready = min(actual['gm_t'], actual['gm_l']) > 0 and mass_error <= 1e-8
    args.output.mkdir(parents=True, exist_ok=True)
    geometry = dict(loa_m=d['loa'], lpp_m=d['lpp'], beam_m=d['beam'], draft_m=state['draft'],
        displacement_mass_kg=state['mass'], displacement_volume_m3=actual['volume'], mass_basis='stated_loading',
        water_density_kg_m3=RHO, waterline_area_m2=actual['area'], kg_keel_up_m=state['kg'], kb_keel_up_m=actual['kb'],
        gm_transverse_m=actual['gm_t'], gm_longitudinal_m=actual['gm_l'], cruise_speed_mps=d['speed'],
        equilibrium_pitch_rad=state['pitch'], center_of_flotation_x_m=actual['flotation_x'],
        center_of_mass_waterline_z_up_m=[0.0, 0.0, actual['cg_height']],
        inertia_about_cg_kg_m2=dict(zip(['ixx','iyy','izz'],state['inertia'].tolist())),
        hydrostatic_stiffness_si=actual['stiffness'].tolist(),
        wet_surface_definition=dict(grade='T', fullness_power=power, source_scale_factors=grid[3].tolist(),
            source_center_of_buoyancy_x_m=source_center_x, longitudinal_panels=args.longitudinal_panels,
            vertical_panels=args.vertical_panels), loading={key: value for key,value in state.items()
                if key not in ['mass','kg','inertia','draft','pitch']})
    write_json(args.output/'geometry.json', geometry)
    mesh = actual['wet_mesh']
    write_nemoh(args.output/'hull.dat', mesh.vertices, mesh.faces)
    polygon = actual['polygon']
    lid_points = np.vstack([np.zeros(3), np.column_stack([polygon,np.zeros(len(polygon))])])
    lid_faces = [[0,index+1,(index+1)%len(polygon)+1,(index+1)%len(polygon)+1] for index in range(len(polygon))]
    write_nemoh(args.output/'lid.dat', lid_points, lid_faces)
    write_nemoh(args.output/'full-hull.dat', full.vertices, np.column_stack([full.faces,full.faces[:,-1]]))
    write_json(args.output/'hydrostatic-hull.json', {'vertices_keel_up_m': full.vertices.tolist(), 'triangles': full.faces.tolist()})
    shutil.copy2(args.source_sections,args.output/'source-sections.json')
    write_json(args.output/'geometry-provenance.json', {'grade':'T', 'model_fidelity':'research-nominal',
        'authority':[f'https://github.com/yong-wei/act/issues/{d["issue"]}','https://github.com/yong-wei/act/issues/2147'],
        'source_sha256':sha256(args.source_sections), 'generator_sha256':sha256(Path(__file__)),
        'source_model_sha256':profile['source']['sourceSha256'], 'source_model_commit':profile['source']['sourceCommit'],
        'source_symmetry_relative_l2':profile['port_starboard_relative_l2'], 'loading':loading,
        'waterline_snap_tolerance_m':2e-8,
        'vertical_normalization':'underwater draft and published moulded depth separately, same map for cargo geometry',
        'tank_bottom_keel_up_m':1.5 if args.vessel=='lng-changheng' else None,
        'cargo_height_basis':'transformed visual container bounding-volume center' if args.vessel=='container-msc' else 'fixed equivalent tank geometry',
        'not_ready':['vessel-calibrated viscous derivatives','validated wave/radiation data','specialist coupling']})
    validation = {'schema':'act.ship-static-validation.v1','status':'passed' if ready else 'not_ready',
        'mass_relative_error':mass_error, 'gm_transverse_m':actual['gm_t'], 'gm_longitudinal_m':actual['gm_l'],
        'reason':None if ready else 'static instability or mass equilibrium failure',
        'inputs_sha256':{'source-sections.json':sha256(args.source_sections)},
        'outputs_sha256':{name:sha256(args.output/name) for name in ['geometry.json','hull.dat','lid.dat','full-hull.dat','hydrostatic-hull.json']}}
    write_json(args.output/'static-validation.json',validation)
    print(json.dumps({'vessel':args.vessel,'loading':loading,'status':validation['status'],'mass':state['mass'],'draft':state['draft'],
        'trim_deg':math.degrees(state['pitch']),'kg':state['kg'],'gm_t':actual['gm_t'],'gm_l':actual['gm_l'],
        'ballast_mass':state['ballast_mass'],'wet_panels':mesh.nb_faces}))
    if not ready:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
