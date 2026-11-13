"""对照NEMOH公开OC4半潜平台的HydroSTAR参考数组。"""

import argparse
import hashlib
import json
import re
from pathlib import Path

import numpy as np

from validate_benchmarks import errors


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def radiation_coefficients(path):
    zones = []
    for line in path.read_text().splitlines():
        if line.lower().startswith("zone"):
            zones.append([])
        elif zones and line.strip():
            zones[-1].append([float(value) for value in line.split()])
    data = np.asarray(zones)
    if data.shape[0] != 6 or data.shape[2] != 13 or not np.isfinite(data).all():
        raise ValueError("一阶辐射数据缺少六自由度通道或含非有限值")
    return data


def reference_qtf(path):
    blocks = {}
    heading1, heading2 = None, None
    for line in path.read_text().splitlines():
        match = re.match(r"#+Heading([12])\s*=\s*([-\d.]+)", line)
        if match:
            if match[1] == "1":
                heading1 = float(match[2])
            else:
                heading2 = float(match[2])
                blocks[(heading1, heading2)] = []
        elif line.strip() and not line.startswith("#"):
            blocks[(heading1, heading2)].append([float(value) for value in line.split()])
    return {key: np.asarray(rows) for key, rows in blocks.items()}


def compare_qtf(data, reference):
    computed, expected = [], []
    for row in data:
        # QTF求解器中间文本将弧度保留三位，后处理再转为度。
        # 最大显示误差约0.029度，按原输入波向恢复索引。
        heading = min(reference, key=lambda key: max(abs(key[0] - row[2]), abs(key[1] - row[3])))
        if max(abs(heading[0] - row[2]), abs(heading[1] - row[3])) > 0.03:
            raise ValueError("QTF波向与公开参考网格无法对应")
        block = reference[heading]
        frequencies = block[:, 0]
        high = int(np.argmin(abs(frequencies - row[0])))
        low = int(np.argmin(abs(frequencies - row[1])))
        if max(abs(frequencies[high] - row[0]), abs(frequencies[low] - row[1])) > 0.000501:
            raise ValueError("QTF频率与公开参考网格无法对应")
        difference = high - low
        if difference < 0 or 2 * difference + 2 >= block.shape[1]:
            raise ValueError("QTF差频超出公开参考范围")
        computed.append(complex(row[7], row[8]) * 1025.0 * 9.81)
        expected.append(complex(block[low, 1 + 2 * difference], block[low, 2 + 2 * difference]))
    return np.asarray(computed), np.asarray(expected)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--coarse-results", type=Path, required=True)
    parser.add_argument("--fine-results", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    reference_dir = args.source_dir / "TestCases/9_QTF_OC4_Semisubmersible/reference/hydrostar/mesh2200_Floating"
    report = {
        "schema": "act.offline-hydrodynamics.oc4-benchmark.v1",
        "fidelity": "research-nominal", "generator_sha256": sha256(Path(__file__)),
        "qtf_scope": "zero-speed DUOK+HASBO, including bidirectional headings 0 and 30 degrees",
        "results": {}, "reference_sha256": {},
    }
    arrays = {}
    qtf_files = ["MQTFFx.rao", "MQTFFy.rao", "MQTFFz.rao",
                 "MQTFMx.rao", "MQTFMy.rao", "MQTFMz.rao"]
    for mesh, directory in [("980", args.coarse_results), ("2200", args.fine_results)]:
        execution = json.loads((directory / "execution.json").read_text())
        if execution["status"] != "computed":
            raise ValueError(f"网格{mesh}求解尚未成功")
        radiation_path = directory / "results/RadiationCoefficients.tec"
        radiation = radiation_coefficients(radiation_path)
        qtf_path = directory / "results/QTF/OUT_QTFM_N.dat"
        qtf = np.loadtxt(qtf_path, skiprows=1)
        if qtf.shape != (51480, 9) or not np.isfinite(qtf).all():
            raise ValueError(f"网格{mesh}差频全表不完整或含非有限值")
        record = {
            "execution_sha256": sha256(directory / "execution.json"),
            "radiation_sha256": sha256(radiation_path), "qtf_sha256": sha256(qtf_path),
            "all_finite": True, "qtf_rows": len(qtf), "first_order": {}, "qtf": {},
        }
        for dof, name in enumerate(qtf_files, 1):
            path = reference_dir / name
            computed, reference = compare_qtf(qtf[qtf[:, 4] == dof], reference_qtf(path))
            record["qtf"][str(dof)] = errors(computed, reference)
            arrays[f"{mesh}_qtf_si_{dof}"] = computed
            arrays[f"hydrostar_qtf_si_{dof}"] = reference
            report["reference_sha256"][name] = sha256(path)
        for dof in range(1, 7):
            for quantity, offset in [("AddedMass", 1), ("Damping", 2)]:
                name = f"{quantity}_{dof}{dof}.dat"
                path = reference_dir / name
                reference = np.loadtxt(path, comments="#")
                values = np.interp(radiation[dof - 1, :, 0], reference[:, 0], reference[:, 1])
                computed = radiation[dof - 1, :, 2 * (dof - 1) + offset]
                record["first_order"][name] = errors(computed, values)
                arrays[f"{mesh}_{quantity}_{dof}"] = computed
                arrays[f"hydrostar_{quantity}_{dof}"] = values
                report["reference_sha256"][name] = sha256(path)
        report["results"][mesh] = record
    report["mesh_convergence"] = {
        str(dof): errors(arrays[f"980_qtf_si_{dof}"], arrays[f"2200_qtf_si_{dof}"])
        for dof in range(1, 7)
    }
    args.output.mkdir(parents=True, exist_ok=True)
    arrays_path = args.output / "comparison-arrays.npz"
    np.savez_compressed(arrays_path, **arrays)
    report["comparison_arrays_sha256"] = sha256(arrays_path)
    (args.output / "validation.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(json.dumps({mesh: value["qtf"] for mesh, value in report["results"].items()}))


if __name__ == "__main__":
    main()
