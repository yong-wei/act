"""独立核验源剖面船体闭合、静水和固定设备的完整运动包络。"""

import argparse
import hashlib
import json
import math
from pathlib import Path

import capytaine as cpt
import numpy as np
import shapely
import trimesh
from shapely.geometry import LineString, MultiPoint, Point, Polygon, box
from shapely.ops import polygonize, unary_union


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    lines = (json.dumps(value, indent=2, allow_nan=False) + '\n').splitlines(keepends=True)
    with path.open('w') as stream:
        for offset in range(0, len(lines), 400):
            stream.write(''.join(lines[offset:offset + 400]))


def wet_mesh(directory):
    mesh = cpt.load_mesh(str(directory / 'hull.dat'), file_format='nemoh')
    return trimesh.Trimesh(mesh.vertices, mesh.faces[:, :3], process=True)


def hull_section(mesh, station):
    segments = trimesh.intersections.mesh_plane(mesh, [1, 0, 0], [station, 0, 0])
    if not len(segments):
        return Polygon()
    points = np.round(segments[:, :, 1:], 8)
    lines = [LineString(segment) for segment in points if np.linalg.norm(segment[0] - segment[1]) > 1e-10]
    waterline = points.reshape(-1, 2)
    waterline = waterline[abs(waterline[:, 1]) < 1e-7]
    if len(waterline) >= 2:
        lines.append(LineString([[waterline[:, 0].min(), 0], [waterline[:, 0].max(), 0]]))
    section = unary_union(list(polygonize(unary_union(lines))))
    if section.is_empty or not section.is_valid:
        raise ValueError(f'船体剖面无法闭合 x={station}')
    return section


def propeller_check(mesh, installation, diameter, kg, draft):
    position = installation['positionBodyM']
    # FRD以重心为原点，几何以平衡水线为z=0。
    center = Point(-position[1], kg - draft - position[2])
    radius = diameter / 2
    section = hull_section(mesh, position[0])
    if section.is_empty:
        gap = max(float(mesh.bounds[0, 0])-position[0], position[0]-float(mesh.bounds[1, 0]), 0.0)
        if gap <= 0:
            raise ValueError('桨盘所在纵向位置缺少可核验的船体剖面')
        return {
            'center_x_m': position[0], 'center_y_z_up_m': [center.x, center.y],
            'diameter_m': diameter, 'clearance_m': gap,
            'overlap_area_lower_bound_m2': 0.0, 'circumscribed_disk_clear': True,
            'rotation_coverage': 'complete disk plane beyond closed hull longitudinal extent',
        }
    clearance = section.distance(center) - radius
    if section.contains(center):
        clearance = -radius - section.boundary.distance(center)
    disk = center.buffer(radius, resolution=256)
    # 额外用外接多边形覆盖整个圆盘，避免内接离散圆把微小相交误判为净空。
    outer_disk = center.buffer(radius / math.cos(math.pi / 1024), resolution=256)
    return {
        'center_x_m': position[0], 'center_y_z_up_m': [center.x, center.y],
        'diameter_m': diameter, 'clearance_m': float(clearance),
        'overlap_area_lower_bound_m2': float(section.intersection(disk).area),
        'circumscribed_disk_clear': not section.intersects(outer_disk),
        'rotation_coverage': 'entire physical disk, all shaft angles',
    }


def pod_check(mesh, installation, diameter, kg, draft):
    position = installation['positionBodyM']
    center = np.array([position[0], -position[1], kg-draft-position[2]])
    closest, distances, _ = mesh.nearest.on_surface([center])
    distance = float(distances[0])
    inside = bool(mesh.contains([center])[0])
    clearance = (-distance if inside else distance)-diameter/2
    return {
        'center_body_m': position, 'diameter_m': diameter,
        'clearance_m': clearance, 'center_inside_hull': inside,
        'nearest_hull_point_bem_m': closest[0].tolist(),
        'all_angles_clear': clearance > 1e-8,
        'rotation_coverage': 'sphere equal to union of every vertical propeller disk over full horizontal azimuth',
    }


def slab_projection(mesh, first, last):
    vertices = mesh.vertices
    inside = vertices[(vertices[:, 0] >= first) & (vertices[:, 0] <= last), 1:]
    sections = [trimesh.intersections.mesh_plane(mesh, [1, 0, 0], [station, 0, 0])
                for station in [first, last]]
    points = [inside, *(segments[:, :, 1:].reshape(-1, 2) for segments in sections)]
    return MultiPoint(np.vstack(points)).convex_hull


def surface_check(mesh, surface, kg, draft):
    position = surface['installation']['positionBodyM']
    chord = math.sqrt(surface['area_m2'] / surface['aspect_ratio'])
    span = math.sqrt(surface['area_m2'] * surface['aspect_ratio'])
    radius = chord / 2
    limit = surface['servo']['max_angle_rad']
    horizontal_fin = surface['normal_body'] == [0.0, 0.0, 1.0]
    if limit >= math.pi / 2 or surface['normal_body'] not in [[0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]:
        raise ValueError('当前包络证明适用于小于90度偏角范围的垂直舵/水平鳍')
    center_y, center_z = -position[1], kg - draft - position[2]
    first, last = position[0] - radius, position[0] + radius
    longitudinal_gap = max(float(mesh.bounds[0, 0])-last, first-float(mesh.bounds[1, 0]), 0.0)
    if longitudinal_gap > 1e-8:
        return {
            'center_body_m': position, 'chord_m': chord, 'span_m': span,
            'angle_interval_rad': [-limit, limit], 'slabs': 0,
            'conservative_clearance_lower_bound_m': longitudinal_gap,
            'method': 'disjoint longitudinal bounds of complete swept surface and closed hull',
            'all_angles_clear': True,
        }
    stations = np.unique(np.r_[first, mesh.vertices[:, 0][
        (mesh.vertices[:, 0] > first) & (mesh.vertices[:, 0] < last)], last])
    clearances = []
    for left, right in zip(stations[:-1], stations[1:]):
        offsets = [left - position[0], right - position[0]]
        critical = radius * math.cos(limit)
        offsets.extend(value for value in [-critical, critical] if offsets[0] <= value <= offsets[1])
        half_width = max(min(abs(value) * math.tan(limit),
                             math.sqrt(max(0.0, radius**2 - value**2))) for value in offsets)
        envelope = (box(center_y-span/2, center_z-half_width, center_y+span/2, center_z+half_width)
                    if horizontal_fin else
                    box(center_y-half_width, center_z-span/2, center_y+half_width, center_z+span/2))
        hull_bound = slab_projection(mesh, left, right)
        if hull_bound.is_empty:
            continue
        clearance = float(hull_bound.distance(envelope))
        if clearance <= 1e-8:
            raise ValueError(f'翼面完整偏角包络未能证明净空 x=[{left}, {right}]')
        clearances.append(clearance)
    if not clearances:
        raise ValueError('翼面所在纵向区间缺少可核验的船体剖面')
    return {
        'center_body_m': position, 'chord_m': chord, 'span_m': span,
        'angle_interval_rad': [-limit, limit], 'slabs': len(clearances),
        'conservative_clearance_lower_bound_m': min(clearances),
        'method': 'triangle-clipped slab convex projection versus analytic continuous swept-chord bounds',
        'all_angles_clear': True,
    }


def static_check(directory, mesh, geometry):
    lid = cpt.load_mesh(str(directory / 'lid.dat'), file_format='nemoh')
    top = trimesh.Trimesh(lid.vertices, lid.faces[:, :3][:, ::-1], process=True)
    closed = trimesh.util.concatenate([mesh, top])
    closed.merge_vertices()
    if not closed.is_watertight or not closed.is_winding_consistent or closed.volume <= 0:
        raise ValueError('独立湿面加水线顶盖未闭合或法向不一致')
    outline = unary_union([Polygon(triangle[:, :2]) for triangle in top.triangles])
    if not outline.is_valid or abs(sum(top.area_faces) - outline.area) > 1e-7:
        raise ValueError('水线顶盖重叠或几何无效')
    mass = geometry['displacement_mass_kg']
    rho = geometry['water_density_kg_m3']
    volume_error = abs(closed.volume - mass / rho) / (mass / rho)
    if volume_error > 1e-8 or np.linalg.norm(closed.center_mass[:2]) > 1e-8:
        raise ValueError('独立体积/水平浮心与质量/重心未闭合')
    kg = geometry['kg_keel_up_m']
    draft = geometry['draft_m']
    cpt_mesh = cpt.Mesh(mesh.vertices, np.column_stack([mesh.faces, mesh.faces[:, -1]]))
    body = cpt.FloatingBody(mesh=cpt_mesh, mass=mass, center_of_mass=[0, 0, kg - draft])
    body.add_all_rigid_body_dofs()
    hydro = body.compute_hydrostatics(rho=rho, g=9.81)
    actual = hydro['hydrostatic_stiffness'].values
    expected = np.asarray(geometry['hydrostatic_stiffness_si'])
    # Capytaine和运行内核的轴向符号以相同S6变换对照。
    transform = np.diag([1, -1, -1, 1, -1, -1])
    actual = transform @ actual @ transform
    selected = np.ix_([2, 3, 4], [2, 3, 4])
    errors = abs(actual[selected] - expected[selected]) / np.maximum(abs(expected[selected]), 1)
    return {
        'watertight': bool(closed.is_watertight), 'winding_consistent': bool(closed.is_winding_consistent),
        'volume_m3': float(closed.volume), 'mass_relative_error': float(volume_error),
        'center_of_buoyancy_z_up_m': closed.center_mass.tolist(),
        'capytaine_stiffness_frd': actual.tolist(), 'exact_stiffness_frd': expected.tolist(),
        'active_stiffness_max_relative_error': float(errors.max()),
        'capytaine_check_scope': 'discrete panel hydrostatics versus exact polyhedral volume and waterplane integration',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pack', type=Path, required=True)
    parser.add_argument('--comparison-pack', type=Path, required=True)
    args = parser.parse_args()
    report = {
        'schema': 'act.hull-installation-validation.v1', 'fidelity': 'research-nominal',
        'generator_sha256': sha256(Path(__file__)),
        'dependencies': {'capytaine': cpt.__version__, 'numpy': np.__version__,
                         'trimesh': trimesh.__version__, 'shapely': shapely.__version__},
        'resolutions': [],
    }
    for directory in [args.pack, args.comparison_pack]:
        geometry = json.loads((directory / 'geometry.json').read_text())
        system = json.loads((directory / 'actuators.json').read_text())['system']
        mesh = wet_mesh(directory)
        kg, draft = geometry['kg_keel_up_m'], geometry['draft_m']
        previous, revised = [], []
        for propeller in system['propulsors']:
            installation = propeller['installation']
            revised.append(propeller_check(mesh, installation, propeller['diameter_m'], kg, draft))
            original = {**installation, 'positionBodyM': [-0.45 * geometry['lpp_m'], *installation['positionBodyM'][1:]]}
            previous.append(propeller_check(mesh, original, propeller['diameter_m'], kg, draft))
        if any(item['circumscribed_disk_clear'] for item in previous):
            raise ValueError('旧位置冲突证明与输入几何不符')
        if not all(item['circumscribed_disk_clear'] for item in revised):
            raise ValueError('修订后的桨盘仍与船体相交')
        report['resolutions'].append({
            'inputs_sha256': {name: sha256(directory / name) for name in
                             ['geometry.json', 'hull.dat', 'lid.dat', 'actuators.json', 'source-sections.json']},
            'wet_panels': len(mesh.faces), 'geometry_normalization': geometry['wet_surface_definition'],
            'static': static_check(directory, mesh, geometry),
            'previous_propeller_installation': previous, 'revised_propeller_installation': revised,
            'control_surfaces': [surface_check(mesh, surface, kg, draft) for surface in system['surfaces']],
        })
    report['comparison_scope'] = 'section sampling sensitivity, each resolution normalized to the same fixed mass'
    report['status'] = 'passed'
    output = args.pack / 'envelope-validation.json'
    write_json(output, report)
    manifest_path = args.pack / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['files_sha256'][output.name] = sha256(output)
    write_json(manifest_path, manifest)
    print(json.dumps({'status': report['status'], 'wet_panels': [item['wet_panels'] for item in report['resolutions']],
        'propeller_clearance_m': [min(prop['clearance_m'] for prop in item['revised_propeller_installation'])
                                 for item in report['resolutions']]}))


if __name__ == '__main__':
    main()
