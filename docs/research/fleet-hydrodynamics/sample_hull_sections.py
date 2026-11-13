"""从已核验GLB提取物采样独立湿面所需的横剖面外轮廓。"""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import trimesh


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--longitudinal-panels', type=int, default=172)
    parser.add_argument('--vertical-panels', type=int, default=48)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if min(args.longitudinal_panels, args.vertical_panels) < 8:
        parser.error('每个方向至少8个采样间隔')
    proof_path = args.source / 'source.json'
    proof = json.loads(proof_path.read_text())
    for name, expected in proof['outputSha256'].items():
        if sha256(args.source / name) != expected:
            raise ValueError('提取物与GLB来源证明不一致')
    points = np.fromfile(args.source / 'vertices.f64', dtype='<f8').reshape(-1, 3)
    faces = np.fromfile(args.source / 'triangles.u32', dtype='<u4').reshape(-1, 3)
    if len(points) != proof['vertices'] or len(faces) != proof['triangles']:
        raise ValueError('提取物记录数与来源证明不符')
    # 清单为行主序，渲染挂载处通过Matrix4.set应用同一变换。
    model_to_scene = np.asarray(proof['modelToSceneMatrix']).reshape(4, 4)
    scene_points = np.column_stack([points, np.ones(len(points))]) @ model_to_scene.T
    # 场景+Z为艏、+X为左舷、+Y向上，换成一阶求解器的x艏/y左/z上。
    vertices = scene_points[:, [2, 0, 1]]
    vertices[abs(vertices[:, 2]) < 2e-5, 2] = 0.0
    mesh = trimesh.Trimesh(vertices, faces, process=True)
    wet_points = mesh.vertices[mesh.vertices[:, 2] <= 0.0]
    x = np.linspace(wet_points[:, 0].min(), wet_points[:, 0].max(), args.longitudinal_panels + 1)
    z = np.linspace(wet_points[:, 2].min(), 0.0, args.vertical_panels + 1)
    port = np.zeros((len(x), len(z)))
    starboard = np.zeros_like(port)
    for ix, station in enumerate(x):
        segments = trimesh.intersections.mesh_plane(mesh, [1.0, 0.0, 0.0], [station, 0.0, 0.0])
        delta_z = segments[:, 1, 2] - segments[:, 0, 2]
        for iz, height in enumerate(z):
            fraction = np.divide(height - segments[:, 0, 2], delta_z,
                                 out=np.full(len(delta_z), -1.0), where=abs(delta_z) > 1e-12)
            valid = (fraction >= -1e-9) & (fraction <= 1.0 + 1e-9)
            if valid.any():
                transverse = segments[valid, 0, 1] + fraction[valid] * (segments[valid, 1, 1] - segments[valid, 0, 1])
                port[ix, iz] = max(0.0, float(transverse.max()))
                starboard[ix, iz] = max(0.0, float(-transverse.min()))
    widths = (port + starboard) / 2.0
    asymmetry = float(np.linalg.norm(port - starboard) / np.linalg.norm(widths))
    if not np.isfinite(widths).all() or widths.max() <= 0:
        raise ValueError('横剖面轮廓为空或含非有限值')
    integral_volume = float(2 * np.trapz(np.trapz(widths, z, axis=1), x))
    output = {
        'schema': 'act.visual-hull-sections.v1', 'source': proof,
        'extract_proof_sha256': sha256(proof_path), 'generator_sha256': sha256(Path(__file__)),
        'dependencies': {'numpy': np.__version__, 'trimesh': trimesh.__version__},
        'coordinate_basis': 'x forward, y port, z up, equilibrium waterline z=0',
        'source_topology': {'watertight': bool(mesh.is_watertight),
                            'winding_consistent': bool(mesh.is_winding_consistent),
                            'vertices': len(mesh.vertices), 'faces': len(mesh.faces)},
        'source_full_beam_m': float(np.ptp(mesh.vertices[:, 1])),
        'source_full_length_m': float(np.ptp(mesh.vertices[:, 0])),
        'source_wetted_beam_m': float(widths.max() * 2),
        'source_draft_m': float(-z[0]), 'source_wetted_length_m': float(np.ptp(x)),
        'section_integral_volume_m3': integral_volume,
        'port_starboard_relative_l2': asymmetry,
        'symmetry_operation': 'mean paired port/starboard half-breadths',
        'x_m': x.tolist(), 'z_m': z.tolist(), 'half_breadth_m': widths.tolist(),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    lines = (json.dumps(output, indent=2, allow_nan=False) + '\n').splitlines(keepends=True)
    with args.output.open('w') as stream:
        for offset in range(0, len(lines), 400):
            stream.write(''.join(lines[offset:offset + 400]))
    print(json.dumps({key: output[key] for key in ['source_full_beam_m', 'source_wetted_beam_m',
        'source_draft_m', 'source_wetted_length_m', 'section_integral_volume_m3', 'port_starboard_relative_l2']}))


if __name__ == '__main__':
    main()
