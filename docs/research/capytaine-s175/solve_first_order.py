"""使用固定版本Capytaine对独立湿表面网格生成一阶水动力数据。"""

import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path

import capytaine as cpt
import numpy as np
import xarray as xr
from capytaine.io.xarray import separate_complex_values
from capytaine.post_pro.rao import rao


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def dependency_identity(name):
    distribution = importlib.metadata.distribution(name)
    digest = hashlib.sha256()
    for entry in sorted(distribution.files or [], key=str):
        if entry.suffix == ".pyc" or "__pycache__" in entry.parts:
            continue
        path = Path(distribution.locate_file(entry))
        if path.is_file():
            digest.update(str(entry).encode())
            digest.update(bytes.fromhex(sha256(path)))
    return {"version": distribution.version, "files_sha256": digest.hexdigest()}


def matrix_checks(dataset, speed, length_m):
    checks = []
    if speed != 0:
        return [{"scope": "forward_speed", "zero_speed_passivity": "not_applicable"}]
    for name in ["added_mass", "radiation_damping"]:
        values = dataset[name].transpose(
            "omega", "radiating_dof", "influenced_dof", ...
        ).values
        for index, matrix in enumerate(values):
            # 使用统一船长把角速度和力矩通道变为线性速度、力的尺度。
            # 零阻尼自由度的舍入残差按全矩阵谱范数评估。
            coordinates = np.array([1.0, 1.0, 1.0, length_m, length_m, length_m])
            matrix = matrix / np.outer(coordinates, coordinates)
            scale = max(float(np.max(np.abs(matrix))), 1.0)
            symmetry_error = float(np.max(np.abs(matrix - matrix.T)) / scale)
            record = {"quantity": name, "frequency_index": index,
                      "symmetry_relative_error": symmetry_error}
            if name == "radiation_damping":
                eigenvalues = np.linalg.eigvalsh((matrix + matrix.T) / 2)
                eigen_scale = max(float(np.abs(eigenvalues).max()), 1e-30)
                record["normalized_min_eigenvalue"] = float(eigenvalues.min() / eigen_scale)
            checks.append(record)
    return checks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mesh", type=Path, required=True)
    parser.add_argument("--mesh-format")
    parser.add_argument("--lid-mesh", type=Path)
    parser.add_argument("--geometry-file", type=Path)
    parser.add_argument("--name", required=True)
    parser.add_argument("--center-of-mass", type=float, nargs=3)
    parser.add_argument("--mass-kg", type=float)
    parser.add_argument("--density-kg-m3", type=float, default=1025.0)
    parser.add_argument("--water-depth-m", type=float, default=200.0)
    parser.add_argument("--forward-speed-mps", type=float, default=0.0)
    parser.add_argument("--frequencies", type=float, nargs="+", required=True)
    parser.add_argument("--headings-deg", type=float, nargs="+", default=[0.0])
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    geometry = None
    if args.geometry_file is not None:
        geometry = json.loads(args.geometry_file.read_text())
        frozen_center = geometry["center_of_mass_waterline_z_up_m"]
        frozen_mass = geometry["displacement_mass_kg"]
        if args.center_of_mass is not None and not np.allclose(
            args.center_of_mass, frozen_center, rtol=0, atol=1e-10
        ):
            parser.error("显式重心与几何包不一致")
        if args.mass_kg is not None and not np.isclose(args.mass_kg, frozen_mass, rtol=1e-10):
            parser.error("显式质量与几何包不一致")
        if args.density_kg_m3 != geometry["water_density_kg_m3"]:
            parser.error("水密度与几何包不一致")
        args.center_of_mass, args.mass_kg = frozen_center, frozen_mass
    if args.center_of_mass is None:
        parser.error("需要重心坐标或完整几何包")
    if cpt.__version__ != "2.2.1":
        parser.error("本生产路径要求capytaine==2.2.1")
    numbers = [*args.center_of_mass, args.density_kg_m3, args.forward_speed_mps,
               *args.frequencies, *args.headings_deg]
    if not np.isfinite(numbers).all():
        parser.error("几何和工况必须为有限值")
    if (np.isnan(args.water_depth_m) or args.water_depth_m <= 0 or args.density_kg_m3 <= 0
            or min(args.frequencies) <= 0 or args.forward_speed_mps < 0):
        parser.error("水深、频率须为正，前进速度须非负")
    if args.mass_kg is not None and (not np.isfinite(args.mass_kg) or args.mass_kg <= 0):
        parser.error("质量须为有限正值")

    mesh = cpt.load_mesh(str(args.mesh), file_format=args.mesh_format)
    lid_mesh = cpt.load_mesh(str(args.lid_mesh), file_format=args.mesh_format) if args.lid_mesh else None
    body = cpt.FloatingBody(mesh=mesh, name=args.name,
                            center_of_mass=args.center_of_mass, mass=args.mass_kg, lid_mesh=lid_mesh)
    body.add_all_rigid_body_dofs()
    body = body.immersed_part(water_depth=args.water_depth_m)
    hydrostatics = body.compute_hydrostatics(rho=args.density_kg_m3, g=9.81)
    volume = float(hydrostatics["disp_volume"])
    if not np.isfinite(volume) or volume <= 0 or body.mesh.nb_faces < 4:
        raise ValueError("湿表面排水体积或面元数量无效")
    if args.mass_kg is not None and abs(args.mass_kg - args.density_kg_m3 * volume) / args.mass_kg > 1e-3:
        raise ValueError("当前网格水线下体积与给定质量不闭合，需先求解平衡吃水")
    if geometry is not None:
        inertia = geometry["inertia_about_cg_kg_m2"]
        rigid = np.diag([args.mass_kg] * 3 + [inertia[axis] for axis in ["ixx", "iyy", "izz"]])
        stiffness = np.asarray(geometry["hydrostatic_stiffness_si"])
        if (not np.isfinite(rigid).all() or np.min(np.diag(rigid)) <= 0
                or stiffness.shape != (6, 6) or not np.isfinite(stiffness).all()):
            raise ValueError("几何包惯量或恢复矩阵无效")
        coordinates = {"influenced_dof": list(body.dofs), "radiating_dof": list(body.dofs)}
        body.inertia_matrix = xr.DataArray(rigid, dims=list(coordinates), coords=coordinates)
        body.hydrostatic_stiffness = xr.DataArray(stiffness, dims=list(coordinates), coords=coordinates)

    matrix = xr.Dataset(coords={
        "omega": sorted(set(args.frequencies)),
        "wave_direction": np.deg2rad(sorted(set(args.headings_deg))),
        "radiating_dof": list(body.dofs),
        "water_depth": [args.water_depth_m],
        "forward_speed": [args.forward_speed_mps],
        "rho": [args.density_kg_m3], "g": [9.81],
    })
    dataset = cpt.BEMSolver().fill_dataset(matrix, body)
    if geometry is not None:
        dataset["RAO"] = rao(dataset)
        if not np.isfinite(dataset["RAO"].values).all():
            raise ValueError("运动响应含非有限值")
    for name in ["added_mass", "radiation_damping", "diffraction_force", "Froude_Krylov_force"]:
        if not np.isfinite(dataset[name].values).all():
            raise ValueError(f"{name}含非有限系数")
    length_m = float(np.ptp(body.mesh.vertices, axis=0).max())
    checks = matrix_checks(dataset, args.forward_speed_mps, length_m)
    panel_radius = float(body.mesh.faces_radiuses.max())
    underresolved = [frequency for frequency in sorted(set(args.frequencies))
                     if panel_radius > cpt.RadiationProblem(
                         body=body, omega=frequency, water_depth=args.water_depth_m,
                         rho=args.density_kg_m3,
                     ).wavelength / 8.0]
    failed = [record for record in checks
              if record.get("symmetry_relative_error", 0) > 0.01
              or record.get("normalized_min_eigenvalue", 0) < -0.01]
    args.output.mkdir(parents=True, exist_ok=True)
    output = args.output / "hydro.nc"
    separate_complex_values(dataset).to_netcdf(output, engine="h5netcdf")
    report = {
        "schema": "act.hydrodynamics.first-order.v1",
        "status": "failed" if failed else "computed",
        "fidelity": "research-nominal",
        "solver": dependency_identity("capytaine"),
        "dependencies": {name: dependency_identity(name)
                         for name in ["numpy", "scipy", "xarray", "h5netcdf"]},
        "generator_sha256": sha256(__file__),
        "mesh_sha256": sha256(args.mesh), "output_sha256": sha256(output),
        "lid_mesh_sha256": sha256(args.lid_mesh) if args.lid_mesh else None,
        "geometry_sha256": sha256(args.geometry_file) if args.geometry_file else None,
        "resolution": {"max_panel_radius_m": panel_radius,
                       "underresolved_frequencies_rad_s": underresolved},
        "configuration": {
            "name": args.name, "center_of_mass_m_z_up": args.center_of_mass,
            "mass_kg": args.mass_kg, "density_kg_m3": args.density_kg_m3,
            "water_depth_m": args.water_depth_m if np.isfinite(args.water_depth_m) else "infinite",
            "forward_speed_mps": args.forward_speed_mps,
            "frequencies_rad_s": sorted(set(args.frequencies)),
            "headings_deg_to": sorted(set(args.headings_deg)),
        },
        "hydrostatics": {
            "displacement_volume_m3": volume,
            "equilibrium_mass_kg": volume * args.density_kg_m3,
            "center_of_buoyancy_m_z_up": np.asarray(hydrostatics["center_of_buoyancy"]).tolist(),
            "stiffness": np.asarray(hydrostatics["hydrostatic_stiffness"]).tolist(),
            "wet_panels": body.mesh.nb_faces,
        },
        "checks": checks,
        "validation": {"independent_benchmark": "pending", "mesh_convergence": "pending"},
    }
    (args.output / "provenance.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    )
    print(json.dumps({"status": report["status"], "panels": body.mesh.nb_faces,
                      "volume_m3": volume, "failed_checks": len(failed)}))
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
