#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER = ROOT / "scripts" / "lib" / "validate-readyz.py"


def check(payload: dict, required: bool) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["python3", str(CHECKER), "true" if required else "false"],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        check=False,
    )


base = {"db": True, "redis": True}
required_worker = {
    "required": True,
    "ready": True,
    "detailsAfterReady": {"configReady": True},
    "configReady": True,
    "capabilities": {"auditSecret": True},
}
optional_worker = {"ready": True, "diagnostic": "kept-after-ready", "required": False}

assert check({**base, "mathDocumentGradingWorker": required_worker}, True).returncode == 0
assert check({**base, "mathDocumentGradingWorker": optional_worker}, False).returncode == 0
assert check({**base, "mathDocumentGradingWorker": {**required_worker, "ready": False}}, True).returncode != 0
assert check({**base, "mathDocumentGradingWorker": optional_worker}, True).returncode != 0
print("readyz JSON validation tests passed")
