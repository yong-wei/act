"""为981完整差频贡献生成有四个立柱开孔的对称自由面网格。"""

import argparse
from collections import Counter
import json
import math
from pathlib import Path
import shutil

import numpy as np
from scipy.spatial import Delaunay, cKDTree
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from build_destroyer_pack import sha256, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-case', type=Path, required=True)
    parser.add_argument('--geometry', type=Path, required=True)
    parser.add_argument('--radius-m', type=float, default=200)
    parser.add_argument('--inner-spacing-m', type=float, default=5)
    parser.add_argument('--radial-points', type=int, default=129)
    parser.add_argument('--bessel-modes', type=int, default=128)
    parser.add_argument('--probe-headings', action='store_true')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    geometry = json.loads(args.geometry.read_text())
    case = json.loads((args.base_case/'case-provenance.json').read_text())
    if (case['geometry_sha256'] != sha256(args.geometry) or geometry['vessel'] != 'semisub-981'
            or case['mesh_sha256'] != sha256(args.base_case/'nemoh-body.dat')):
        raise ValueError('源几何和冻结NEMOH案例不一致')
    radius, spacing = args.radius_m, args.inner_spacing_m
    if not math.isfinite(radius) or radius < 100 or not 1 <= spacing <= 10:
        raise ValueError('自由面网格范围或间距无效')
    if args.radial_points < 3 or args.bessel_modes < 1:
        raise ValueError('渐近积分和Bessel截断参数无效')
    columns = [item for item in geometry['boxes_keel_up_m'] if item[2][0] < geometry['draft_m'] <= item[2][1]]
    holes = [box(*[item[axis][side] for side in [0, 1] for axis in [0, 1]]) for item in columns]
    if len(holes) != 4 or not all(radius > math.hypot(*hole.bounds[2:]) for hole in holes):
        raise ValueError('自由面须包含四个实际水线立柱孔')
    angles = np.linspace(0, math.pi/2, 129)
    quarter_arc = np.column_stack([radius*np.cos(angles), radius*np.sin(angles)])
    outer_quarter = Polygon([(0, 0), *quarter_arc])
    quarter = outer_quarter.difference(unary_union(holes))
    points = [(0.0, 0.0), *map(tuple, quarter_arc)]
    for x in np.arange(0, 71, spacing):
        for y in np.arange(0, 71, spacing):
            if quarter.covers(Point(x, y)): points.append((x, y))
    for ring in np.arange(80, radius, 20):
        for angle in np.linspace(0, math.pi/2, max(3, math.ceil(math.pi*ring/(2*10))+1)):
            points.append((ring*math.cos(angle), ring*math.sin(angle)))
    for hole in holes:
        if hole.centroid.x < 0 or hole.centroid.y < 0: continue
        corners = list(hole.exterior.coords)[:-1]
        for start, end in zip(corners, corners[1:]+corners[:1]):
            count = math.ceil(math.dist(start, end)/spacing)
            points.extend(tuple(np.asarray(start)+(np.asarray(end)-start)*i/count) for i in range(count))
    points = np.unique(np.round(points, 10), axis=0)
    triangles = []
    for indices in Delaunay(points).simplices:
        triangle = Polygon(points[indices])
        if quarter.buffer(1e-8).covers(triangle): triangles.append(points[indices])
    union = unary_union([Polygon(triangle) for triangle in triangles])
    area_error = union.symmetric_difference(quarter).area
    if area_error > 1e-5:
        raise ValueError(f'自由面三角化存在未覆盖或重叠区域 {area_error} m2')
    vertices, lookup, faces = [], {}, []
    for sx, sy in [(1, 1), (-1, 1), (-1, -1), (1, -1)]:
        for triangle in triangles:
            indices = []
            for coordinate in triangle*np.asarray([sx, sy]):
                key = tuple(np.round(coordinate, 10))
                if key not in lookup:
                    lookup[key] = len(vertices)
                    vertices.append(key)
                indices.append(lookup[key])
            coordinates = np.asarray([vertices[index] for index in indices])
            cross = np.cross(coordinates[1]-coordinates[0], coordinates[2]-coordinates[0])
            if cross < 0: indices.reverse()
            faces.append(indices)
    vertices = np.asarray(vertices)
    edges = Counter(tuple(sorted((face[i], face[(i+1)%3]))) for face in faces for i in range(3))
    if max(edges.values()) > 2:
        raise ValueError('自由面包含非流形面元')
    boundary = []
    for (a, b), count in edges.items():
        if count != 1: continue
        center = (vertices[a]+vertices[b])/2
        if abs(np.linalg.norm(center)-radius) < .01:
            origin = np.zeros(2)
        else:
            hole = min(holes, key=lambda item: item.boundary.distance(Point(*center)))
            if hole.boundary.distance(Point(*center)) > 1e-8:
                raise ValueError('自由面存在非外圆/立柱的孤立边界')
            origin = np.asarray([hole.centroid.x, hole.centroid.y])
        if np.cross(vertices[a]-origin, vertices[b]-origin) < 0: a, b = b, a
        boundary.append((a, b))
    tree = cKDTree(vertices)
    symmetry = max(float(tree.query(vertices*np.asarray(signs))[0].max())
                   for signs in [(-1, 1), (1, -1)])
    if symmetry > 1e-8:
        raise ValueError('自由面离散失去双平面对称性')
    args.output.mkdir(parents=True, exist_ok=False)
    for name in ['Nemoh.cal', 'Mesh.cal', 'input_solver.txt', 'nemoh-body.dat', 'case-provenance.json']:
        shutil.copy2(args.base_case/name, args.output/name)
    shutil.copytree(args.base_case/'Mechanics', args.output/'Mechanics')
    mesh_path = args.output/'free-surface.dat'
    with mesh_path.open('w') as stream:
        stream.write(f'0 {len(vertices)} {len(faces)} {len(boundary)}\n')
        for index, (x, y) in enumerate(vertices, 1): stream.write(f'{index} {x:.17g} {y:.17g} 0\n')
        stream.write('0 0 0 0\n')
        for a, b, c in faces: stream.write(f'{a+1} {b+1} {c+1} {c+1}\n')
        for a, b in boundary: stream.write(f'{a+1} {b+1}\n')
        stream.write('0 0\n')
    cal_path = args.output/'Nemoh.cal'
    lines = cal_path.read_text().splitlines()
    qtf = lines.index('---QTF---')
    lines[qtf+4] = '3 ! DUOK+HASBO+HASFS+ASYMP'
    lines[qtf+5] = mesh_path.name
    lines[qtf+6] = f'{radius} {args.radial_points} {args.bessel_modes}'
    lines[qtf+11] = '1 ! include HASFS+ASYMP'
    if args.probe_headings:
        index = next(i for i, line in enumerate(lines) if '! Number of wave directions' in line)
        lines[index] = '3 0.0 180.0 ! Number of wave directions, min, max (degrees)'
    cal_path.write_text('\n'.join(lines)+'\n')
    case.update(generator_sha256=sha256(Path(__file__)), qtf_scope='zero-speed DUOK+HASBO+HASFS+ASYMP',
                not_ready=['forward-speed QTF', 'full-contribution reference and mesh convergence'])
    write_json(args.output/'case-provenance.json', case)
    proof = {'schema': 'act.semisub.free-surface-mesh.v1', 'status': 'passed',
        'fidelity': 'research-nominal', 'generator_sha256': sha256(Path(__file__)),
        'source_geometry_sha256': sha256(args.geometry), 'body_mesh_sha256': case['mesh_sha256'],
        'radius_m': radius, 'inner_spacing_m': spacing, 'asymptotic_radial_points': args.radial_points,
        'bessel_modes': args.bessel_modes, 'vertices': len(vertices), 'panels': len(faces),
        'boundary_segments': len(boundary), 'waterline_columns': len(columns),
        'quarter_surface_area_m2': quarter.area, 'quarter_uncovered_area_m2': area_error,
        'mirror_mesh_distance_m': symmetry, 'free_surface_sha256': sha256(mesh_path),
        'nemoh_configuration_sha256': sha256(cal_path), 'numerical_qtf_validation': 'pending'}
    write_json(args.output/'free-surface-validation.json', proof)
    print(json.dumps(proof))


if __name__ == '__main__':
    main()
