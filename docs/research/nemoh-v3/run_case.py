"""运行独立NEMOH基准，保存每阶段日志、配置和程序哈希。"""

import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import time
from pathlib import Path

STAGES = ["preProcessor/preProc", "Mesh/hydrosCal", "Solver/solver",
          "postProcessor/postProc", "QTF/PreProcessor/QTFpreProc",
          "QTF/Solver/QTFsolver", "QTF/PostProcessor/QTFpostProc"]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--build-dir", type=Path, required=True)
    cases = parser.add_mutually_exclusive_group(required=True)
    cases.add_argument("--case")
    cases.add_argument("--case-dir", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--frequency-count", type=int)
    parser.add_argument("--qtf-frequency-count", type=int)
    parser.add_argument("--first-order-only", action="store_true")
    args = parser.parse_args()
    source = args.source_dir.resolve()
    case = (args.case_dir if args.case_dir is not None
            else source / "TestCases" / args.case).resolve()
    if args.case is not None and not case.is_relative_to(source / "TestCases"):
        parser.error("基准必须来自指定求解器的TestCases目录")
    if args.output.exists():
        parser.error("输出目录已存在，请为本次计算指定新目录")
    for count in [args.frequency_count, args.qtf_frequency_count]:
        if count is not None and count < 2:
            parser.error("频率点数至少为2")
    shutil.copytree(case, args.output)
    output = args.output.resolve()
    configuration = output / "Nemoh.cal"
    text = configuration.read_text()
    if args.frequency_count is not None:
        pattern = r"(?m)^([123]\s+)\d+(\s+[^!\n]+! ?Freq type)"
        text, count = re.subn(pattern, lambda m: m[1] + str(args.frequency_count) + m[2], text)
        if count != 1:
            raise ValueError("未找到唯一的一阶频率配置")
    if args.qtf_frequency_count is not None:
        pattern = r"(?m)^\d+(\s+[^!\n]+! Number of radial frequencies)"
        text, count = re.subn(pattern, lambda m: str(args.qtf_frequency_count) + m[1], text)
        if count != 1:
            raise ValueError("未找到唯一的二阶频率配置")
    configuration.write_text(text)
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=source, text=True).strip()
    patch = subprocess.check_output(["git", "diff", "--binary"], cwd=source)
    (output / "build-source.patch").write_bytes(patch)
    report = {
        "schema": "act.nemoh.case.v1", "solver_revision": revision,
        "source_url": "https://gitlab.com/lheea/Nemoh",
        "build_patch_sha256": hashlib.sha256(patch).hexdigest(),
        "generator_sha256": sha256(Path(__file__)),
        "case": args.case or case.name,
        "configuration_sha256": sha256(configuration),
        "input_sha256": {str(p.relative_to(output)): sha256(p)
                          for p in sorted(output.rglob("*")) if p.is_file()},
        "stages": [], "status": "running",
    }
    stages = [STAGES[0], STAGES[2], STAGES[3]] if args.first_order_only else STAGES
    provided_mechanics = any((case / "Mechanics" / name).is_file()
                             for name in ["Inertia.dat", "Kh.dat"])
    if provided_mechanics:
        stages = [stage for stage in stages if stage != "Mesh/hydrosCal"]
    report["mechanics_source"] = "provided" if provided_mechanics else "mesh-derived"
    try:
        for stage in stages:
            executable = (args.build_dir / stage).resolve()
            started = time.monotonic()
            log = output / (executable.name + ".log")
            with log.open("wb") as stream:
                result = subprocess.run([str(executable)], cwd=output, stdout=stream,
                                        stderr=subprocess.STDOUT)
            record = {"program": stage, "binary_sha256": sha256(executable),
                      "exit_code": result.returncode, "seconds": time.monotonic() - started,
                      "log_sha256": sha256(log)}
            report["stages"].append(record)
            print(json.dumps(record), flush=True)
            if result.returncode != 0:
                raise RuntimeError(f"{stage}求解失败，见对应日志")
        report["output_sha256"] = {
            str(p.relative_to(output)): sha256(p) for p in sorted(output.rglob("*"))
            if p.is_file() and p.suffix.lower() in {".tec", ".dat", ".bin"}
        }
        required = [output / "results/CM.dat", output / "results/CA.dat"]
        if not args.first_order_only:
            required.append(output / "results/QTF/OUT_QTFM_N.dat")
        for path in required:
            if not path.is_file() or path.stat().st_size == 0:
                raise ValueError(f"缺少求解结果 {path.relative_to(output)}")
        for name in ["CM.dat", "CA.dat"]:
            path = output / "results" / name
            numbers = [float(value) for line in path.read_text().splitlines()[1:]
                       for value in line.split()]
            if not numbers or not all(math.isfinite(value) for value in numbers):
                raise ValueError(f"{name}含无效系数")
        for path in (output / "results/QTF").glob("OUT_QTF*_N.dat"):
            rows = path.read_text().splitlines()[1:]
            if not rows:
                raise ValueError(f"{path.name}为空")
            for row in rows:
                values = [float(value) for value in row.split()]
                if len(values) != 9 or not all(math.isfinite(value) for value in values):
                    raise ValueError(f"{path.name}含无效系数")
        report["status"] = "computed"
        report["validation"] = "pending"
    except Exception as error:
        report["status"] = "failed"
        report["failure"] = str(error)
        raise
    finally:
        (output / "execution.json").write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
