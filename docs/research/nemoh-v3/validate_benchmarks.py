"""对照NEMOH公开参考数据，保存误差和可复算的原始数组。"""

import argparse
import hashlib
import json
import re
from pathlib import Path

import numpy as np
import xarray as xr


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def errors(computed, reference):
    scale = float(np.linalg.norm(reference))
    if scale == 0:
        raise ValueError("参考数组缺少有效幅值")
    return {
        "samples": computed.size,
        "relative_l2_complex": float(np.linalg.norm(computed - reference) / scale),
        "relative_l2_magnitude": float(np.linalg.norm(np.abs(computed) - np.abs(reference)) / scale),
        "max_absolute_error_si": float(np.abs(computed - reference).max()),
    }


def aquaplus_coefficients(path):
    records = {}
    key = None
    for line in path.read_text().splitlines():
        if line.lower().startswith("zone"):
            match = re.search(r'\s([1-6])([1-6])"', line)
            if match is None:
                raise ValueError("未识别Aquaplus力/运动通道")
            key = tuple(map(int, match.groups()))
            records[key] = []
        elif key is not None and line.strip():
            records[key].append([float(value) for value in line.split()])
    return {key: np.asarray(rows) for key, rows in records.items()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--build-dir", type=Path, required=True)
    parser.add_argument("--qtf-results", type=Path, required=True)
    parser.add_argument("--first-order-results", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    qtf_path = args.qtf_results / "results/QTF/OUT_QTFM_N.dat"
    qtf = np.loadtxt(qtf_path, skiprows=1)
    if qtf.shape[1] != 9 or not np.isfinite(qtf).all():
        raise ValueError("差频QTF全表必须为有限数")
    report = {
        "schema": "act.offline-hydrodynamics.benchmark.v1",
        "fidelity": "research-nominal", "generator_sha256": sha256(Path(__file__)),
        "qtf_output_sha256": sha256(qtf_path), "qtf_numeric_rows": qtf.shape[0],
        "qtf_all_finite": True, "qtf_comparisons": {}, "first_order_comparisons": {},
    }
    cache_path = args.build_dir / "CMakeCache.txt"
    cache = {}
    for line in cache_path.read_text().splitlines():
        if re.match(r"[A-Za-z0-9_]+:[A-Za-z_]+=", line):
            key, value = line.split("=", 1)
            cache[key.split(":")[0]] = value
    cmake_version = ".".join(cache[f"CMAKE_CACHE_{part}_VERSION"]
                             for part in ["MAJOR", "MINOR", "PATCH"])
    compiler_info = (args.build_dir / "CMakeFiles" / cmake_version
                     / "CMakeFortranCompiler.cmake").read_text()
    compiler = dict(re.findall(
        r'set\((CMAKE_Fortran_COMPILER_VERSION|CMAKE_Fortran_COMPILER_ID)\s+"([^"]+)"\)',
        compiler_info,
    ))
    report["build"] = {
        "cmake_version": cmake_version, "compiler": compiler,
        "cache_sha256": sha256(cache_path),
        "configuration": {key: cache[key] for key in [
            "CMAKE_BUILD_TYPE", "CMAKE_Fortran_FLAGS", "CMAKE_Fortran_FLAGS_RELEASE", "BUILD_TESTING"
        ]},
    }
    arrays = {"qtf_normalized_output": qtf}
    reference_dir = args.source_dir / "TestCases/8b_QTF_Cylinder/reference/hydrostar/mesh634_floating"
    for dof, name in [(1, "QTFFx.rao"), (3, "QTFFz.rao"), (5, "QTFMy.rao")]:
        reference_path = reference_dir / name
        data = np.loadtxt(reference_path, comments="#")
        frequencies = data[:, 0]
        complex_values = data[:, 1::2] + 1j * data[:, 2::2]
        native, reference = [], []
        for row in qtf[qtf[:, 4] == dof]:
            # NEMOH输出频率保留三位小数，按参考网格恢复其点号。
            if row[0] > frequencies.max() + 0.000501:
                continue
            high = int(np.argmin(np.abs(frequencies - row[0])))
            low = int(np.argmin(np.abs(frequencies - row[1])))
            if max(abs(frequencies[high] - row[0]), abs(frequencies[low] - row[1])) > 0.000501:
                raise ValueError("NEMOH与参考频率无法对应")
            difference = high - low
            if difference < 0 or difference >= complex_values.shape[1]:
                raise ValueError("参考差频范围不匹配")
            native.append(complex(row[7], row[8]) * 1025.0 * 9.81)
            reference.append(complex_values[low, difference])
        native, reference = np.asarray(native), np.asarray(reference)
        record = errors(native, reference)
        record["reference_sha256"] = sha256(reference_path)
        report["qtf_comparisons"][str(dof)] = record
        arrays[f"qtf_si_dof{dof}"] = native
        arrays[f"hydrostar_si_dof{dof}"] = reference

    reference_path = args.source_dir / "TestCases/1_Cylinder/reference_results/Aquaplus/Cw.tec"
    coefficients = aquaplus_coefficients(reference_path)
    dataset_path = args.first_order_results / "hydro.nc"
    dataset = xr.load_dataset(dataset_path, engine="h5netcdf")
    report["first_order_output_sha256"] = sha256(dataset_path)
    report["aquaplus_source_sha256"] = sha256(reference_path)
    for index, dof in [(1, "Surge"), (3, "Heave"), (5, "Pitch")]:
        data = coefficients[(index, index)]
        order = np.argsort(data[:, 0])
        omega = dataset.omega.values
        for quantity, column in [("added_mass", 2), ("radiation_damping", 1)]:
            computed = dataset[quantity].sel(radiating_dof=dof, influenced_dof=dof).values.squeeze()
            reference = np.interp(omega, data[order, 0], data[order, column])
            report["first_order_comparisons"][f"{dof}_{quantity}"] = errors(computed, reference)
            arrays[f"capytaine_{dof}_{quantity}"] = computed
            arrays[f"aquaplus_{dof}_{quantity}"] = reference
    arrays["first_order_omega_rad_s"] = dataset.omega.values
    output = args.output / "comparison-arrays.npz"
    np.savez_compressed(output, **arrays)
    report["comparison_arrays_sha256"] = sha256(output)
    report["execution"] = json.loads((args.qtf_results / "execution.json").read_text())
    report["execution"].pop("input_sha256", None)
    report["execution"].pop("output_sha256", None)
    (args.output / "validation.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(json.dumps({"qtf": report["qtf_comparisons"], "first_order": report["first_order_comparisons"]}))


if __name__ == "__main__":
    main()
