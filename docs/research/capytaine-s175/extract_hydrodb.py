"""从锁定的S175源库重新导出测试夹具，并校验原始文件哈希。"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.io import loadmat

UPSTREAM_COMMIT = "e8ab42a105cd45770179609307a2175cede009b5"
SOURCE_SHA256 = "e95dac93a70194aa3ff0a11223c2b6d125073638b6d387e65ba299c2a4f003d1"
SOURCE_PATH = "HYDRO/vessels_capytaine/S175/s175.mat"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    digest = hashlib.sha256(args.input.read_bytes()).hexdigest()
    if digest != SOURCE_SHA256:
        raise ValueError("源文件哈希与锁定的S175数据库不一致")
    vessel = loadmat(args.input, simplify_cells=True)["vessel"]
    main = vessel["main"]
    if float(vessel["velocities"]) != 0.0:
        raise ValueError("当前夹具仅接受零航速数据库")
    main_names = {
        "lpp": "Lpp", "beam": "B", "draft": "T", "mass_kg": "m",
        "volume_m3": "nabla", "cb": "C_B", "k44": "k44", "k55": "k55",
        "k66": "k66", "gm_t": "GM_T", "gm_l": "GM_L", "cg": "CG",
    }
    result = {
        "schema": "act.s175.hydrodb.v1",
        "source": {
            "tool": str(vessel["hydrodynamic_source"]),
            "reference": str(vessel["hydrodynamic_reference"]),
            "upstream": f"MSS {SOURCE_PATH} @ {UPSTREAM_COMMIT}",
            "source_sha256": digest,
            "generator_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "url": f"https://github.com/cybergalactic/MSS/blob/{UPSTREAM_COMMIT}/{SOURCE_PATH}",
        },
        "main": {name: np.asarray(main[source]).tolist() for name, source in main_names.items()},
    }
    for name, source in {"freqs": "freqs", "mrb": "MRB", "added_mass": "A",
                         "damping": "B", "stiffness": "C"}.items():
        data = np.asarray(vessel[source])
        if not np.isfinite(data).all():
            raise ValueError(f"{source}含非有限值")
        result[name] = data.tolist()
    args.output.write_text(json.dumps(result, separators=(",", ":"), allow_nan=False) + "\n")
    print(json.dumps({"source_sha256": digest,
                      "output_sha256": hashlib.sha256(args.output.read_bytes()).hexdigest()}))


if __name__ == "__main__":
    main()
