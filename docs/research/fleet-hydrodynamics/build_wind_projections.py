"""从已冻结的完整船模和当前加载几何计算遮挡合并后的风载投影。"""

import argparse
import json
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import box

from build_destroyer_pack import sha256, write_json


def above_water(triangles, height, pitch):
    signed = height + np.sin(pitch)*triangles[:, :, 0] - np.cos(pitch)*triangles[:, :, 2]
    inside = signed >= 0
    parts = [triangles[inside.all(axis=1)]]
    for triangle, distances in zip(triangles[inside.any(axis=1) & ~inside.all(axis=1)],
                                   signed[inside.any(axis=1) & ~inside.all(axis=1)]):
        polygon = []
        for index in range(3):
            start, end = triangle[index], triangle[(index+1) % 3]
            left, right = distances[index], distances[(index+1) % 3]
            if left >= 0:
                polygon.append(start)
            if (left >= 0) != (right >= 0):
                polygon.append(start + left/(left-right)*(end-start))
        parts.append(np.array([[polygon[0], polygon[index], polygon[index+1]]
                               for index in range(1, len(polygon)-1)]))
    return np.concatenate(parts)


def silhouette(triangles, axes):
    points = triangles[:, :, axes]
    area = np.cross(points[:, 1]-points[:, 0], points[:, 2]-points[:, 0])
    points = np.round(points[abs(area) > 1e-12], 7)
    # 循环顶点和反向绕序具有相同投影，先排序去重以避免重复实例放大工作量。
    ordering = np.lexsort((points[:, :, 1], points[:, :, 0]), axis=1)
    points = np.take_along_axis(points, ordering[:, :, None], axis=1)
    points = np.unique(points.reshape(-1, 6), axis=0).reshape(-1, 3, 2)
    unions = []
    for offset in range(0, len(points), 5000):
        polygons = shapely.polygons(points[offset:offset+5000])
        unions.append(shapely.union_all(polygons))
    merged = shapely.union_all(unions)
    if merged.is_empty or not merged.is_valid or merged.area <= 0:
        raise ValueError('风载投影未形成有效遮挡合并区域')
    return merged


def cells(polygon, normal_axis, width):
    low_x, low_z, high_x, high_z = polygon.bounds
    output = []
    for x in np.arange(low_x, high_x, width):
        for z in np.arange(low_z, high_z, width):
            part = polygon.intersection(box(x, z, min(x+width, high_x), min(z+width, high_z)))
            if part.area <= 1e-12:
                continue
            point = [0.0, 0.0, part.centroid.y]
            point[1-normal_axis] = part.centroid.x
            output.append({'point_body_m': point, 'normal_axis': normal_axis,
                           'projected_area_m2': part.area})
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--geometry', type=Path, required=True)
    parser.add_argument('--reference-draft-m', type=float, required=True)
    parser.add_argument('--source-sections', type=Path)
    parser.add_argument('--platform', action='store_true')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    generator_sha = sha256(Path(__file__))
    inputs = [args.geometry, args.source/'source.json', args.source/'vertices.f64', args.source/'triangles.u32']
    if args.source_sections:
        inputs.append(args.source_sections)
    frozen_inputs = [sha256(path) for path in inputs]
    if not np.isfinite(args.reference_draft_m) or args.reference_draft_m <= 0:
        raise ValueError('源模型平均水线的龙骨高度无效')
    proof = json.loads((args.source/'source.json').read_text())
    for name, expected in proof['outputSha256'].items():
        if sha256(args.source/name) != expected:
            raise ValueError('完整船模提取物发生漂移')
    geometry = json.loads(args.geometry.read_text())
    raw = np.fromfile(args.source/'vertices.f64', dtype='<f8').reshape(-1, 3)
    faces = np.fromfile(args.source/'triangles.u32', dtype='<u4').reshape(-1, 3)
    transform = np.array(proof['modelToSceneMatrix']).reshape(4, 4)
    scene = np.column_stack([raw, np.ones(len(raw))])@transform.T
    points = scene[:, [2, 0, 1]]
    shape = geometry.get('wet_surface_definition')
    if shape:
        if args.source_sections is None:
            raise ValueError('常规船须提供同源船形剖面证明')
        profile = json.loads(args.source_sections.read_text())
        for name in ['sourceSha256', 'manifestSha256', 'decoderSha256']:
            if profile['source'][name] != proof[name]:
                raise ValueError('风载模型与物理船形的源GLB或解码器身份不一致')
        scale = shape['source_scale_factors']
        points[:, 0] = points[:, 0]*scale[0]-shape['source_center_of_buoyancy_x_m']
        points[:, 1] *= scale[1]
        # 基准映射的龙骨高度由原型固定吃水确定，随后按本次加载水线裁切。
        points[:, 2] = args.reference_draft_m + points[:, 2]*np.where(points[:, 2] <= 0, scale[2], scale[-1])
    else:
        if not args.platform:
            raise ValueError('常规船缺少冻结的源船形尺度')
        points[:, 2] += args.reference_draft_m
    points[:, 1] *= -1
    points[:, 2] = geometry['kg_keel_up_m']-points[:, 2]
    triangles = above_water(points[faces], geometry['center_of_mass_waterline_z_up_m'][2],
                            geometry.get('equilibrium_pitch_rad', 0.0))
    front, side = silhouette(triangles, [1, 2]), silhouette(triangles, [0, 2])
    if args.platform:
        wind = {'kind': 'projected', 'geometry': {'air_density_kg_m3': 1.225, 'drag_coefficient': 1.2,
            'panels': cells(front, 0, 5.0)+cells(side, 1, 5.0)}}
    else:
        midship = (profile['x_m'][0]+profile['x_m'][-1])*scale[0]/2-shape['source_center_of_buoyancy_x_m']
        deck_height = args.reference_draft_m+profile['z_m'][-1]*scale[-1]
        low_x, low_z, high_x, _ = side.bounds
        deck_area = side.intersection(box(low_x, low_z, high_x, geometry['kg_keel_up_m']-deck_height)).area
        pitch = geometry.get('equilibrium_pitch_rad', 0.0)
        height = geometry['center_of_mass_waterline_z_up_m'][2]
        wind = {'kind': 'fujiwara', 'geometry': {'frontal_area_m2': front.area, 'lateral_area_m2': side.area,
            'superstructure_lateral_area_m2': deck_area, 'loa_m': geometry['loa_m'], 'beam_m': geometry['beam_m'],
            'center_lateral_from_midship_m': side.centroid.x-midship,
            'center_lateral_above_waterline_m': height+np.sin(pitch)*side.centroid.x-np.cos(pitch)*side.centroid.y,
            'superstructure_height_m': float(np.max(height+np.sin(pitch)*points[:, 0]-np.cos(pitch)*points[:, 2])),
            'midship_body_x_m': midship, 'pressure_center_body_m': [side.centroid.x, front.centroid.x, side.centroid.y],
            'frontal_center_body_z_m': front.centroid.y, 'cg_waterline_height_m': height}}
    if (sha256(Path(__file__)) != generator_sha
            or [sha256(path) for path in inputs] != frozen_inputs):
        raise ValueError('生成期间风载来源或生成器发生漂移')
    args.output.mkdir(parents=True, exist_ok=False)
    write_json(args.output/'wind.json', wind)
    for name, polygon in [('frontal', front), ('lateral', side)]:
        (args.output/f'{name}.wkb').write_bytes(polygon.wkb)
    write_json(args.output/'validation.json', {'schema': 'act.vessel-wind-projection.v1', 'grade': 'T',
        'fidelity': 'research-nominal', 'generator_sha256': generator_sha,
        'source_proof_sha256': sha256(args.source/'source.json'), 'source': proof,
        'geometry_sha256': sha256(args.geometry), 'wind_sha256': sha256(args.output/'wind.json'),
        'reference_draft_m': args.reference_draft_m,
        'source_sections_sha256': sha256(args.source_sections) if args.source_sections else None,
        'frontal_area_m2': front.area, 'lateral_area_m2': side.area,
        'frontal_centroid_body_yz_m': list(front.centroid.coords)[0],
        'lateral_centroid_body_xz_m': list(side.centroid.coords)[0],
        'projection_coordinate_rounding_m': 1e-7, 'shapely_version': shapely.__version__,
        'fujiwara_source': 'https://www.jstage.jst.go.jp/article/jjasnaoe/2/0/2_0_243/_article/-char/en',
        'fujiwara_equations': '7/8/12/14-22/25/26 and Table 3, C1 blend over 80 to 100 degrees',
        'airdraft_basis': 'highest default-pose model point, T assumption',
        'projection_files_sha256': {name: sha256(args.output/name) for name in ['frontal.wkb', 'lateral.wkb']},
        'scope': 'default visual arrangement, affine source scale and frozen mean-waterline clipping, union removes overlapping silhouettes',
        'not_ready': ['independent aerodynamic calibration', 'time-varying cargo and movable-equipment silhouette']})
    print(json.dumps({'status': 'computed', 'frontal_area_m2': front.area, 'lateral_area_m2': side.area,
                      'panels': len(wind['geometry'].get('panels', []))}), flush=True)


if __name__ == '__main__':
    main()
