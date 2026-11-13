"""保存981各网格静水、一阶响应及互易性检查的可复算对照。"""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import xarray as xr
from capytaine.io.xarray import merge_complex_values


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative_error(computed, reference):
    scale = np.linalg.norm(reference)
    return float(np.linalg.norm(computed - reference) / scale) if scale else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--geometry-dirs", type=Path, nargs="+", required=True)
    parser.add_argument("--first-order-dirs", type=Path, nargs="+", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = {
        "schema": "act.semisub.mesh-validation.v1", "fidelity": "research-nominal",
        "generator_sha256": sha256(Path(__file__)), "geometry": [], "first_order": [],
        "convergence": [], "precision_reference_targets": {
            "volume_relative_error": 0.01, "response_peak_relative_change": 0.03,
        },
        "not_ready": ["validated full-frequency reciprocity", "converged response peaks",
                      "forward-speed coefficients", "online consumption"],
    }
    arrays, datasets = {}, []
    geometry_hashes = set()
    for directory in args.geometry_dirs:
        validation = json.loads((directory / "geometry-validation.json").read_text())
        geometry_hashes.add(sha256(directory / "geometry.json"))
        report["geometry"].append(validation)
    if len(geometry_hashes) != 1:
        raise ValueError("网格对照必须绑定同一几何/质量/重心")
    report["geometry_sha256"] = geometry_hashes.pop()
    normalization = np.asarray([1.0] * 3 + [1.0 / 110.0] * 3)
    for directory in args.first_order_dirs:
        provenance = json.loads((directory / "provenance.json").read_text())
        if provenance["geometry_sha256"] != report["geometry_sha256"]:
            raise ValueError("一阶数据使用了其他几何/加载条件")
        data_path = directory / "hydro.nc"
        if sha256(data_path) != provenance["output_sha256"]:
            raise ValueError("一阶数据与求解证明哈希不符")
        dataset = merge_complex_values(xr.load_dataset(data_path, engine="h5netcdf"))
        for quantity in ["added_mass", "radiation_damping", "excitation_force", "RAO"]:
            if not np.isfinite(dataset[quantity].values).all():
                raise ValueError(f"一阶{quantity}含非有限值")
        checks = provenance["checks"]
        failures = [check for check in checks if check["symmetry_relative_error"] > 0.01
                    or check.get("normalized_min_eigenvalue", 0.0) < -0.01]
        report["first_order"].append({
            "wet_panels": provenance["hydrostatics"]["wet_panels"],
            "provenance_sha256": sha256(directory / "provenance.json"),
            "output_sha256": sha256(data_path), "solver_status": provenance["status"],
            "configuration": provenance["configuration"], "resolution": provenance["resolution"],
            "all_finite": True, "failed_matrix_checks": failures,
        })
        datasets.append(dataset)
    for index, (coarse, fine) in enumerate(zip(datasets[:-1], datasets[1:])):
        omega = np.intersect1d(coarse.omega.values, fine.omega.values)
        headings = np.intersect1d(coarse.wave_direction.values, fine.wave_direction.values)
        selection = {"omega": omega, "wave_direction": headings}
        values, changes = {}, {}
        for quantity in ["added_mass", "radiation_damping", "excitation_force", "RAO"]:
            values[quantity] = []
            for tag, dataset in [("coarse", coarse), ("fine", fine)]:
                source = dataset[quantity]
                selected = source.sel({key: value for key, value in selection.items() if key in source.dims})
                if "radiating_dof" in selected.dims:
                    selected = selected * xr.DataArray(normalization, dims="radiating_dof")
                if "influenced_dof" in selected.dims:
                    selected = selected * xr.DataArray(normalization, dims="influenced_dof")
                if quantity == "RAO":
                    selected = selected / xr.DataArray(normalization, dims="radiating_dof")
                values[quantity].append(selected.values)
                arrays[f"pair{index}_{tag}_{quantity}"] = selected.values
            changes[quantity] = relative_error(*values[quantity])
        response_peaks = [np.max(abs(value), axis=tuple(range(value.ndim - 1)))
                          for value in values["RAO"]]
        peak_changes = np.divide(abs(response_peaks[0] - response_peaks[1]), response_peaks[1],
                                 out=np.zeros(6), where=response_peaks[1] > 1e-12)
        report["convergence"].append({
            "coarse_wet_panels": report["first_order"][index]["wet_panels"],
            "fine_wet_panels": report["first_order"][index + 1]["wet_panels"],
            "common_omega_rad_s": omega.tolist(), "common_headings_rad": headings.tolist(),
            "length_normalized_relative_l2": changes,
            "rao_channel_order": fine.radiating_dof.values.tolist(),
            "rao_peak_relative_change": peak_changes.tolist(),
            "peak_comparison_scope": "common discrete samples only",
        })
        arrays[f"pair{index}_omega_rad_s"] = omega
        arrays[f"pair{index}_headings_rad"] = headings
    args.output.mkdir(parents=True, exist_ok=True)
    arrays_path = args.output / "comparison-arrays.npz"
    np.savez_compressed(arrays_path, **arrays)
    report["comparison_arrays_sha256"] = sha256(arrays_path)
    lines = (json.dumps(report, indent=2, allow_nan=False) + "\n").splitlines(keepends=True)
    with (args.output / "validation.json").open("w") as stream:
        for offset in range(0, len(lines), 400):
            stream.write(''.join(lines[offset:offset + 400]))
    print(json.dumps(report["convergence"]))


if __name__ == "__main__":
    main()
