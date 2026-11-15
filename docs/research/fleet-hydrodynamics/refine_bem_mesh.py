"""保持原三角湿面精确几何，以统一四分细化核验BEM离散敏感性。"""

import argparse
import json
import shutil
from pathlib import Path

import capytaine as cpt
import numpy as np
import trimesh

from build_destroyer_pack import sha256, volume_and_buoyancy, waterplane, write_json, write_nemoh


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pack', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    source = cpt.load_mesh(str(args.pack/'hull.dat'), file_format='nemoh')
    geometry = json.loads((args.pack/'geometry.json').read_text())
    mesh = trimesh.Trimesh(source.vertices, source.faces[:, :3], process=False).subdivide()
    refined = cpt.Mesh(mesh.vertices, np.column_stack([mesh.faces, mesh.faces[:, -1]]))
    source_volume, source_center = volume_and_buoyancy(source)
    volume, center = volume_and_buoyancy(refined)
    _, source_area, source_ix, source_iy, _ = waterplane(source)
    _, area, ix, iy, _ = waterplane(refined)
    errors = {'volume': abs(volume/source_volume-1), 'waterplane_area': abs(area/source_area-1),
        'waterplane_ix': abs(ix/source_ix-1), 'waterplane_iy': abs(iy/source_iy-1),
        'center_absolute_m': float(np.max(abs(center-source_center)))}
    if max(errors.values()) > 1e-9 or abs(volume*1025/geometry['displacement_mass_kg']-1) > 1e-8:
        raise ValueError('细分后源船形的体积/浮心/水线积分发生变化')
    args.output.mkdir(parents=True, exist_ok=False)
    write_nemoh(args.output/'hull.dat', refined.vertices, refined.faces)
    for name in ['geometry.json', 'lid.dat']:
        shutil.copy2(args.pack/name, args.output/name)
    report = {'schema': 'act.bem-triangle-refinement.v1', 'status': 'passed',
        'generator_sha256': sha256(Path(__file__)), 'source_geometry_sha256': sha256(args.pack/'geometry.json'),
        'source_mesh_sha256': sha256(args.pack/'hull.dat'), 'refined_mesh_sha256': sha256(args.output/'hull.dat'),
        'source_faces': source.nb_faces, 'refined_faces': refined.nb_faces,
        'source_max_radius_m': float(source.faces_radiuses.max()),
        'refined_max_radius_m': float(refined.faces_radiuses.max()), 'geometric_errors': errors,
        'refinement': 'each source triangle uniformly subdivided into four coplanar triangles'}
    write_json(args.output/'refinement-validation.json', report)
    print(json.dumps(report))


if __name__ == '__main__':
    main()
