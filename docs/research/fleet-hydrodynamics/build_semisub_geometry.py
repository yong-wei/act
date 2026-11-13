"""按#2147和#2161生成981矩形教学湿表面及静水参数。"""

import argparse
import hashlib
import itertools
import json
from pathlib import Path

import capytaine as cpt
import numpy as np
from capytaine.io.mesh_writers import write_mesh

DRAFT_M = 19.0
DENSITY = 1025.0
GRAVITY = 9.81
BOXES = [((-55.0, 55.0), (y - 8.5, y + 8.5), (0.0, 10.0)) for y in [-31.0, 31.0]]
BOXES += [((x - 10.0, x + 10.0), (y - 10.0, y + 10.0), (10.0, DRAFT_M))
          for x, y in itertools.product([-35.0, 35.0], [-31.0, 31.0])]


def mesh_axes(max_edge_m, boxes=BOXES):
    axes = []
    for axis in range(3):
        limits = sorted({value for box in boxes for value in box[axis]})
        points = []
        for low, high in zip(limits[:-1], limits[1:]):
            count = int(np.ceil((high - low) / max_edge_m))
            points.extend(np.linspace(low, high, count + 1)[:-1])
        axes.append(np.asarray([*points, limits[-1]]))
    return axes


def surface_mesh(max_edge_m, boxes=BOXES):
    axes = mesh_axes(max_edge_m, boxes)
    centers = [(axis[:-1] + axis[1:]) / 2 for axis in axes]
    shape = tuple(len(axis) for axis in centers)
    occupied = np.zeros(shape, dtype=bool)
    for cell in np.ndindex(shape):
        point = [centers[axis][cell[axis]] for axis in range(3)]
        occupied[cell] = any(all(box[axis][0] <= point[axis] <= box[axis][1]
                                 for axis in range(3)) for box in boxes)
    vertices, node_ids, wet_faces, lid_faces = [], {}, [], []
    for cell in np.ndindex(shape):
        if not occupied[cell]:
            continue
        for normal_axis, sign in itertools.product(range(3), [-1, 1]):
            neighbor = list(cell)
            neighbor[normal_axis] += sign
            inside = all(0 <= neighbor[axis] < shape[axis] for axis in range(3))
            if inside and occupied[tuple(neighbor)]:
                continue
            u, v = (normal_axis + 1) % 3, (normal_axis + 2) % 3
            corners = [(0, 0), (1, 0), (1, 1), (0, 1)]
            if sign < 0:
                corners.reverse()
            face = []
            for du, dv in corners:
                index = list(cell)
                index[normal_axis] += int(sign > 0)
                index[u] += du
                index[v] += dv
                key = tuple(index)
                if key not in node_ids:
                    node_ids[key] = len(vertices)
                    point = [axes[axis][index[axis]] for axis in range(3)]
                    point[2] -= DRAFT_M
                    vertices.append(point)
                face.append(node_ids[key])
            is_lid = normal_axis == 2 and sign > 0 and cell[2] == shape[2] - 1
            if is_lid:
                lid_faces.append(face[::-1])
            else:
                wet_faces.append(face)
    return np.asarray(vertices), np.asarray(wet_faces), np.asarray(lid_faces)


def physical_properties():
    pontoon_volume = 2 * 110.0 * 17.0 * 10.0
    column_volume = 4 * 20.0 * 20.0 * 9.0
    volume = pontoon_volume + column_volume
    kb = (pontoon_volume * 5.0 + column_volume * 14.5) / volume
    waterplane_transverse_inertia = 4 * (20.0 * 20.0**3 / 12.0 + 400.0 * 31.0**2)
    waterplane_longitudinal_inertia = 4 * (20.0 * 20.0**3 / 12.0 + 400.0 * 35.0**2)
    kg = kb + waterplane_transverse_inertia / volume - 2.0
    gm_l = kb + waterplane_longitudinal_inertia / volume - kg
    mass = DENSITY * volume
    radii = np.asarray([0.35 * 89.0, 0.35 * 114.0, 0.25 * np.hypot(114.0, 89.0)])
    inertia = mass * radii**2
    stiffness = np.diag([0.0, 0.0, DENSITY * GRAVITY * 1600.0,
                         mass * GRAVITY * 2.0, mass * GRAVITY * gm_l, 0.0])
    return volume, mass, kb, kg, gm_l, inertia, stiffness


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-edge-m", type=float, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not np.isfinite(args.max_edge_m) or args.max_edge_m <= 0:
        parser.error("网格最大边长须为有限正值")
    vertices, wet_faces, lid_faces = surface_mesh(args.max_edge_m)
    hull = cpt.Mesh(vertices=vertices, faces=wet_faces, name="semisub-981-wetted")
    lid = cpt.Mesh(vertices=vertices, faces=lid_faces, name="semisub-981-lid")
    volume, mass, kb, kg, gm_l, inertia, stiffness = physical_properties()
    center_of_mass = [0.0, 0.0, kg - DRAFT_M]
    body = cpt.FloatingBody(mesh=hull, lid_mesh=lid, name="semisub-981-research",
                            mass=mass, center_of_mass=center_of_mass)
    body.add_all_rigid_body_dofs()
    hydrostatics = body.compute_hydrostatics(rho=DENSITY, g=GRAVITY)
    actual_volume = float(hydrostatics["disp_volume"])
    volume_error = abs(actual_volume - volume) / volume
    if volume_error > 1e-10:
        raise ValueError(f"湿表面体积与几何定义不闭合，relative_error={volume_error}")
    actual_stiffness = np.asarray(hydrostatics["hydrostatic_stiffness"])
    relative_stiffness_error = np.abs(np.diag(actual_stiffness)[2:5]
                                      - np.diag(stiffness)[2:5]) / np.diag(stiffness)[2:5]
    if not np.isfinite(actual_stiffness).all():
        raise ValueError("静水恢复矩阵含非有限值")
    args.output.mkdir(parents=True, exist_ok=True)
    for name, faces in [("hull.dat", wet_faces), ("lid.dat", lid_faces),
                        ("nemoh-body.dat", np.vstack([wet_faces, lid_faces]))]:
        write_mesh(str(args.output / name), vertices, faces, file_format="nemoh")
    geometry = {
        "schema": "act.model-pack.geometry.v1", "vessel": "semisub-981",
        "model_fidelity": "research-nominal", "loa_m": 114.0, "lpp_m": 110.0,
        "beam_m": 89.0, "wetted_beam_m": 82.0, "draft_m": DRAFT_M,
        "displacement_volume_m3": volume, "displacement_mass_kg": mass,
        "mass_basis": "displacement_volume", "water_density_kg_m3": DENSITY,
        "waterline_area_m2": 1600.0, "kb_keel_up_m": kb, "kg_keel_up_m": kg,
        "gm_transverse_m": 2.0, "gm_longitudinal_m": gm_l,
        "center_of_mass_waterline_z_up_m": center_of_mass,
        "inertia_about_cg_kg_m2": dict(zip(["ixx", "iyy", "izz"], inertia.tolist())),
        "hydrostatic_stiffness_si": stiffness.tolist(),
        "boxes_keel_up_m": BOXES,
        "source": {
            "geometry_grade": "T", "mass_and_stability_grade": "T",
            "authority": ["https://github.com/yong-wei/act/issues/2147",
                          "https://github.com/yong-wei/act/issues/2161"],
            "formulas": ["mass=rho*volume", "KG=KB+I_waterplane_transverse/volume-GM_T",
                         "GM_L=KB+I_waterplane_longitudinal/volume-KG"],
        },
    }
    (args.output / "geometry.json").write_text(json.dumps(geometry, indent=2) + "\n")
    report = {
        "schema": "act.semisub.geometry.validation.v1",
        "generator_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "capytaine_version": cpt.__version__, "max_edge_m": args.max_edge_m,
        "wet_panels": len(wet_faces), "lid_panels": len(lid_faces),
        "volume_relative_error": volume_error,
        "hydrostatic_stiffness_diagonal_relative_error": relative_stiffness_error.tolist(),
        "capytaine_stiffness_si": actual_stiffness.tolist(),
        "output_sha256": {name: hashlib.sha256((args.output / name).read_bytes()).hexdigest()
                          for name in ["geometry.json", "hull.dat", "lid.dat", "nemoh-body.dat"]},
    }
    (args.output / "geometry-validation.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"volume_m3": volume, "mass_kg": mass, "kg_m": kg, "gm_l_m": gm_l,
                      "wet_panels": len(wet_faces), "lid_panels": len(lid_faces),
                      "stiffness_relative_errors": relative_stiffness_error.tolist()}))


if __name__ == "__main__":
    main()
