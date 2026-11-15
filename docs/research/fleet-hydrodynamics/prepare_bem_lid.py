"""为波浪求解生成有分辨率界的内部自由面盖板，并核验其独立用途。"""

import argparse
import json
from pathlib import Path

import capytaine as cpt
from capytaine.io.mesh_writers import write_mesh
import numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union

from build_destroyer_pack import sha256, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pack', type=Path, required=True)
    parser.add_argument('--max-face-radius-m', type=float, default=2.0)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if not np.isfinite(args.max_face_radius_m) or args.max_face_radius_m <= 0:
        raise ValueError('面元半径上界须为有限正值')
    geometry_path = args.pack / 'geometry.json'
    hull_path = args.pack / 'hull.dat'
    closure_path = args.pack / 'lid.dat'
    hull = cpt.load_mesh(str(hull_path), file_format='nemoh')
    closure = cpt.load_mesh(str(closure_path), file_format='nemoh')
    footprint = unary_union([Polygon(closure.vertices[face, :2]) for face in closure.faces])
    if not footprint.is_valid or footprint.area <= 0:
        raise ValueError('静水封闭盖板的水线投影无效')
    lid = hull.generate_lid(z=0.0, faces_max_radius=args.max_face_radius_m)
    if lid.nb_faces == 0 or not np.isfinite(lid.vertices).all():
        raise ValueError('求解用内部盖板为空或含无效坐标')
    if (not np.allclose(lid.vertices[:, 2], 0, atol=1e-12, rtol=0)
            or not np.allclose(lid.faces_normals[:, 2], -1, atol=1e-12, rtol=0)
            or lid.faces_radiuses.max() > args.max_face_radius_m * (1 + 1e-10)):
        raise ValueError('求解盖板的高度、法向或面元分辨率未通过')
    polygons = [Polygon(lid.vertices[face, :2]) for face in lid.faces]
    union = unary_union(polygons)
    outside = union.difference(footprint).area
    overlap = sum(polygon.area for polygon in polygons) - union.area
    tolerance = max(1e-8, footprint.area * 1e-10)
    if outside > tolerance or overlap > tolerance:
        raise ValueError('求解盖板超出水线内部或存在重叠')
    args.output.mkdir(parents=True, exist_ok=False)
    lid_path = args.output / 'bem-lid.dat'
    write_mesh(str(lid_path), lid.vertices, lid.faces, file_format='nemoh')
    report = {
        'schema': 'act.bem-lid.validation.v1', 'status': 'passed',
        'generator_sha256': sha256(Path(__file__)), 'capytaine_version': cpt.__version__,
        'geometry_sha256': sha256(geometry_path), 'wet_mesh_sha256': sha256(hull_path),
        'closure_mesh_sha256': sha256(closure_path), 'bem_lid_sha256': sha256(lid_path),
        'source_closure_faces': closure.nb_faces,
        'source_closure_max_face_radius_m': float(closure.faces_radiuses.max()),
        'wet_faces': hull.nb_faces, 'wet_max_face_radius_m': float(hull.faces_radiuses.max()),
        'bem_lid_faces': lid.nb_faces, 'requested_max_face_radius_m': args.max_face_radius_m,
        'bem_lid_max_face_radius_m': float(lid.faces_radiuses.max()),
        'footprint_area_m2': float(footprint.area), 'bem_lid_area_m2': float(union.area),
        'internal_area_fraction': float(union.area / footprint.area),
        'outside_area_m2': float(outside), 'overlap_area_m2': float(overlap),
        'role': 'internal free-surface mesh for irregular-frequency removal',
        'source_closure_role': 'exact waterline closure used by hydrostatic geometry and installation checks',
        'source': 'https://capytaine.org/v2.2.1/user_manual/body.html#lid-mesh'}
    write_json(args.output / 'validation.json', report)
    print(json.dumps(report))


if __name__ == '__main__':
    main()
