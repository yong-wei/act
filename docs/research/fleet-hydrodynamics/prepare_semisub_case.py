"""由冻结的981教学几何准备NEMOH输入，保留解析质量和静水恢复。"""

import argparse
import hashlib
import json
import shutil
from pathlib import Path

import numpy as np


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--geometry-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    geometry_path = args.geometry_dir / "geometry.json"
    geometry = json.loads(geometry_path.read_text())
    mesh = args.geometry_dir / "nemoh-body.dat"
    lines = mesh.read_text().splitlines()
    separator = next(i for i, line in enumerate(lines[1:], 1)
                     if all(float(value) == 0.0 for value in line.split()))
    nodes = separator - 1
    panels = len(lines) - separator - 2
    center = geometry["center_of_mass_waterline_z_up_m"]
    if geometry["vessel"] != "semisub-981":
        raise ValueError("当前生产路径只接受981教学几何")
    dofs = ["1 1 0 0 0 0 0", "1 0 1 0 0 0 0", "1 0 0 1 0 0 0",
            *[f"2 {' '.join(str(int(i == axis)) for i in range(3))} "
              + ' '.join(str(value) for value in center) for axis in range(3)]]
    cal = [
        "--- Environment ---", "1025.0 ! rho", "9.81 ! g", "200.0 ! depth", "0.0 0.0",
        "--- Description of floating bodies ---", "1", "--- Body 1 ---", "nemoh-body.dat", f"{nodes} {panels}",
        "6", *dofs, "6", *dofs, "0", "--- Load cases to be solved ---",
        "1 200 0.025 5.0 ! Freq type 1 rad/s, count, min, max",
        "17 0.0 240.0 ! Number of wave directions, min, max (degrees)",
        "--- Post processing ---", "0 0.1 10.0", "0", "0 0.0 180.0", "0 0 0.0 0.0",
        "1 ! RAO", "1 ! frequency unit rad/s", "---QTF---", "1 ! QTF enabled",
        "93 0.2 2.5 ! Number of radial frequencies, min, max",
        "1 ! bidirectional", "2 ! DUOK+HASBO", "NA", "0 0 0", "0", "1", "1", "1", "0",
    ]
    args.output.mkdir(parents=True, exist_ok=True)
    shutil.copy2(mesh, args.output / "nemoh-body.dat")
    (args.output / "Nemoh.cal").write_text('\n'.join(cal) + '\n')
    (args.output / "Mesh.cal").write_text(
        'nemoh-body\n0\n0 0\n' + ' '.join(str(value) for value in center)
        + f'\n{panels}\n2\n0\n1\n1025\n9.81\n'
    )
    (args.output / "input_solver.txt").write_text('2\n0.001\n1\n10 1e-5 1000\n')
    mechanics = args.output / "Mechanics"
    mechanics.mkdir(exist_ok=True)
    mass = geometry["displacement_mass_kg"]
    inertia = geometry["inertia_about_cg_kg_m2"]
    rigid = np.diag([mass] * 3 + [inertia[axis] for axis in ["ixx", "iyy", "izz"]])
    for name, matrix in [
        ("Inertia.dat", rigid), ("Kh.dat", np.asarray(geometry["hydrostatic_stiffness_si"])),
        ("Km.dat", np.zeros((6, 6))), ("Badd.dat", np.zeros((6, 6))),
    ]:
        np.savetxt(mechanics / name, matrix, fmt='%.16e')
    metadata = {
        "schema": "act.semisub.nemoh-case.v1",
        "generator_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "geometry_sha256": hashlib.sha256(geometry_path.read_bytes()).hexdigest(),
        "mesh_sha256": hashlib.sha256(mesh.read_bytes()).hexdigest(),
        "qtf_scope": "zero-speed DUOK+HASBO, bidirectional 0..240 degrees, 15 degree grid",
        "angular_extension": "common 180-degree rotation of both waves on centrosymmetric geometry",
        "not_ready": ["free-surface and asymptotic contributions", "forward-speed QTF"],
        "nodes": nodes, "panels": panels,
    }
    (args.output / "case-provenance.json").write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps(metadata))


if __name__ == '__main__':
    main()
