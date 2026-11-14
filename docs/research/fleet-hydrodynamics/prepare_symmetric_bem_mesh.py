"""为同源左右对称船体建立成对面元，核验实际曲面和静水量保持一致。"""

import argparse
import json
import shutil
from pathlib import Path

import capytaine as cpt
import numpy as np
import trimesh

from build_destroyer_pack import sha256, write_json, write_nemoh


def triangles(mesh):
    faces = []
    for face in mesh.faces:
        faces.append(face[:3])
        if face[3] != face[0]:
            faces.append(face[[0, 2, 3]])
    return trimesh.Trimesh(vertices=mesh.vertices, faces=np.asarray(faces), process=False)


def surface_error(first, second):
    first, second = triangles(first), triangles(second)
    points = np.vstack([first.vertices[np.unique(first.faces)], first.triangles_center,
                        (first.triangles[:, 0]+first.triangles[:, 1])/2,
                        (first.triangles[:, 1]+first.triangles[:, 2])/2,
                        (first.triangles[:, 2]+first.triangles[:, 0])/2])
    distance = trimesh.proximity.closest_point(second, points)[1]
    return {'samples': len(points), 'maximum_distance_m': float(distance.max()),
            'rms_distance_m': float(np.sqrt(np.mean(distance**2)))}


def symmetric(mesh):
    mesh.heal_mesh()
    return cpt.ReflectionSymmetricMesh(mesh.clipped(cpt.xOz_Plane), cpt.xOz_Plane).merged()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pack', type=Path, required=True)
    parser.add_argument('--lid', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    original = cpt.load_mesh(str(args.pack/'hull.dat'), file_format='nemoh')
    lid = cpt.load_mesh(str(args.lid), file_format='nemoh')
    mirrored, mirrored_lid = symmetric(original), symmetric(lid)
    args.output.mkdir(parents=True, exist_ok=False)
    write_nemoh(args.output/'hull.dat', mirrored.vertices, mirrored.faces)
    write_nemoh(args.output/'bem-lid.dat', mirrored_lid.vertices, mirrored_lid.faces)
    shutil.copy2(args.pack/'geometry.json', args.output/'geometry.json')
    restored = cpt.load_mesh(str(args.output/'hull.dat'), file_format='nemoh')
    restored.heal_mesh()
    restored_lid = cpt.load_mesh(str(args.output/'bem-lid.dat'), file_format='nemoh')
    restored_lid.heal_mesh()
    records = {'source_to_symmetric': surface_error(original, restored),
               'symmetric_to_source': surface_error(restored, original),
               'lid_source_to_symmetric': surface_error(lid, restored_lid),
               'lid_symmetric_to_source': surface_error(restored_lid, lid)}
    volume_error = float(abs(restored.volume/original.volume-1))
    area_error = float(abs(restored.faces_areas.sum()/original.faces_areas.sum()-1))
    geometry = json.loads((args.pack/'geometry.json').read_text())
    scale = geometry['loa_m']
    # 这里检验成对离散是否仍表示同一曲面，精度等级由后续BEM结果单独记录。
    passed = (volume_error <= 1e-9 and area_error <= 1e-9
              and all(row['maximum_distance_m'] <= scale*1e-7 for row in records.values())
              and np.allclose(restored_lid.faces_normals[:, 2], -1, rtol=0, atol=1e-12)
              and np.allclose(restored_lid.vertices[:, 2], 0, rtol=0, atol=1e-12))
    report = {'schema': 'act.symmetric-bem-mesh.validation.v1',
        'status': 'passed' if passed else 'failed', 'generator_sha256': sha256(Path(__file__)),
        'source_mesh_sha256': sha256(args.pack/'hull.dat'), 'source_lid_sha256': sha256(args.lid),
        'geometry_sha256': sha256(args.pack/'geometry.json'),
        'output_mesh_sha256': sha256(args.output/'hull.dat'), 'output_lid_sha256': sha256(args.output/'bem-lid.dat'),
        'source_faces': original.nb_faces, 'symmetric_faces': restored.nb_faces,
        'relative_volume_error': volume_error, 'relative_area_error': area_error,
        'surface_comparison': records, 'mass_cg_inertia_configuration': 'unchanged source geometry',
        'surface_sampling': 'referenced vertices, triangle centroids and three edge midpoints',
        'construction': 'clip at source y=0, mirror y<=0 panels, merge and serialize full mesh',
        'capytaine_version': cpt.__version__,
        'source': 'https://capytaine.org/v2.2.1/user_manual/mesh.html#creating-a-symmetric-mesh'}
    write_json(args.output/'validation.json', report)
    print(json.dumps(report))
    if not passed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
