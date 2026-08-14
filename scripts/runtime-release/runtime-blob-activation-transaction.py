#!/usr/bin/env python3
"""Cross-state v2 activation transaction and recovery.

The v2 lifecycle is authoritative.  This helper only projects its committed
active identity into the compatible v1 selector/active-receipt files.  The
activation journal makes a process crash between those two authorities
recoverable without guessing which side should win.
"""

import argparse
import fcntl
import importlib.util
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, Optional


ACTIVATION_SCHEMA = "runtime-blob-activation-journal.v1"
ACTIVATION_FILE = ".act-runtime-blob-activation.journal.json"
ACTIVATION_LOCK = ".act-runtime-blob-activation.lock"
STATUS = {"prepared", "lifecycle-committed", "receipt-committed", "complete"}


def load_lifecycle():
    path = Path(__file__).with_name("runtime-blob-release-lifecycle.py")
    spec = importlib.util.spec_from_file_location("runtime_blob_activation_lifecycle", str(path))
    if spec is None or spec.loader is None:
        raise ValueError("runtime lifecycle module is unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


LIFECYCLE = load_lifecycle()


def fail(message: str) -> None:
    raise ValueError(message)


def write_atomic(path: Path, value: Any) -> None:
    LIFECYCLE.write_atomic(path, value)


def exact(value: Any, keys, label: str) -> Dict[str, Any]:
    if not isinstance(value, dict) or sorted(value.keys()) != sorted(keys):
        fail("%s has unsupported or missing fields" % label)
    return value


def identity(value: Any, label: str = "identity") -> Dict[str, Any]:
    return LIFECYCLE.identity(value, label)


def activation_journal(value: Any) -> Dict[str, Any]:
    value = exact(value, [
        "schemaVersion", "status", "transactionId", "expectedGeneration",
        "targetGeneration", "previousIdentity", "targetIdentity",
        "targetLifecycleSha256",
    ], "activation journal")
    if value["schemaVersion"] != ACTIVATION_SCHEMA or value["status"] not in STATUS:
        fail("activation journal has an unsupported status or schema")
    transaction_id = value["transactionId"]
    if not isinstance(transaction_id, str) or len(transaction_id) != 32:
        fail("activation journal transactionId is invalid")
    expected = value["expectedGeneration"]
    target_generation = value["targetGeneration"]
    if not isinstance(expected, int) or isinstance(expected, bool) or expected < 1:
        fail("activation journal expectedGeneration is invalid")
    if not isinstance(target_generation, int) or isinstance(target_generation, bool) or target_generation != expected + 1:
        fail("activation journal targetGeneration is invalid")
    previous = identity(value["previousIdentity"], "activation journal.previousIdentity")
    target = identity(value["targetIdentity"], "activation journal.targetIdentity")
    if previous["releaseId"] == target["releaseId"]:
        fail("activation journal target must differ from previous active")
    lifecycle_sha = value["targetLifecycleSha256"]
    if lifecycle_sha != "" and (not isinstance(lifecycle_sha, str) or not LIFECYCLE.SHA256.fullmatch(lifecycle_sha)):
        fail("activation journal targetLifecycleSha256 is invalid")
    if value["status"] == "prepared" and lifecycle_sha != "":
        fail("prepared activation journal must not claim a committed lifecycle")
    if value["status"] != "prepared" and lifecycle_sha == "":
        fail("committed activation journal must bind a lifecycle digest")
    return {
        "schemaVersion": ACTIVATION_SCHEMA,
        "status": value["status"],
        "transactionId": transaction_id,
        "expectedGeneration": expected,
        "targetGeneration": target_generation,
        "previousIdentity": previous,
        "targetIdentity": target,
        "targetLifecycleSha256": lifecycle_sha,
    }


def lock_state(state_dir: Path):
    state_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    handle = (state_dir / ACTIVATION_LOCK).open("a+")
    fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
    return handle


def crash_if(stage: str) -> None:
    if os.environ.get("ACT_RUNTIME_BLOB_ACTIVATION_CRASH_AT") == stage:
        os._exit(86)


def run_json(command) -> Dict[str, Any]:
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "command failed"
        fail(detail)
    try:
        value = json.loads(result.stdout)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail("command returned invalid JSON: %s" % error)
    if not isinstance(value, dict):
        fail("command returned a non-object JSON result")
    return value


def script_path(value: Optional[str], default_name: str) -> Path:
    path = Path(value) if value else Path(__file__).with_name(default_name)
    if path.is_symlink() or not path.is_file():
        fail("required runtime script is unavailable: %s" % path)
    return path


def lifecycle_command(script: Path, *args) -> Dict[str, Any]:
    return run_json([sys.executable, str(script)] + list(args))


def host_command(script: Path, *args) -> Dict[str, Any]:
    return run_json([sys.executable, str(script)] + list(args))


def lifecycle_state(state_dir: Path, script: Path) -> Dict[str, Any]:
    return lifecycle_command(script, "inspect", "--state-dir", str(state_dir))


def host_active(state_dir: Path, script: Path) -> Optional[Dict[str, Any]]:
    result = subprocess.run(
        [sys.executable, str(script), "active", "--state-dir", str(state_dir)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
    )
    if result.returncode != 0:
        return None
    try:
        value = json.loads(result.stdout)
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def project_host_active(state_dir: Path, host_script: Path, target: Dict[str, Any]) -> Dict[str, Any]:
    result = host_command(
        host_script,
        "mark-active-v2",
        "--state-dir", str(state_dir),
        "--release-id", target["releaseId"],
        "--manifest-sha256", target["manifestSha256"],
        "--tree-sha256", target["treeSha256"],
    )
    active = host_active(state_dir, host_script)
    if not active or active.get("activeReleaseId") != target["releaseId"]:
        fail("v1 active receipt does not project the v2 lifecycle active identity")
    selection = active.get("selection")
    if not isinstance(selection, dict) or selection.get("manifestSha256") != target["manifestSha256"] or selection.get("treeSha256") != target["treeSha256"]:
        fail("v1 active receipt identity does not match the v2 lifecycle active identity")
    return result


def read_journal(state_dir: Path):
    path = state_dir / ACTIVATION_FILE
    if path.is_symlink():
        fail("activation journal must not be a symlink")
    if not path.exists():
        return None, False
    try:
        return activation_journal(json.loads(path.read_text(encoding="utf-8"))), False
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
        return None, True


def remove_journal(state_dir: Path) -> None:
    path = state_dir / ACTIVATION_FILE
    if path.exists() or path.is_symlink():
        path.unlink()


def recover_locked(state_dir: Path, lifecycle_script: Path, host_script: Path) -> Dict[str, Any]:
    # Lifecycle recovery is always first: its marker/journal is the authority
    # that decides whether an activation CAS committed.
    lifecycle_command(lifecycle_script, "recover", "--state-dir", str(state_dir))
    current = lifecycle_state(state_dir, lifecycle_script)
    journal, malformed = read_journal(state_dir)
    target = current["active"]
    if journal is not None and journal["targetLifecycleSha256"] and journal["targetLifecycleSha256"] != LIFECYCLE.digest(current):
        # The lifecycle itself is authoritative. A damaged cross-state intent
        # is discarded after projecting the committed lifecycle identity.
        journal = None
        malformed = True
    active = host_active(state_dir, host_script)
    if not active or active.get("activeReleaseId") != target["releaseId"] or active.get("selection", {}).get("manifestSha256") != target["manifestSha256"] or active.get("selection", {}).get("treeSha256") != target["treeSha256"]:
        project_host_active(state_dir, host_script, target)
    if journal is not None:
        if target == journal["targetIdentity"] and current["generation"] == journal["targetGeneration"]:
            updated = dict(journal)
            updated["status"] = "complete"
            updated["targetLifecycleSha256"] = LIFECYCLE.digest(current)
            write_atomic(state_dir / ACTIVATION_FILE, updated)
        elif target == journal["previousIdentity"]:
            # The lifecycle CAS did not commit. Preserve the v2 active A and
            # discard only the abandoned intent for B.
            remove_journal(state_dir)
        else:
            # A newer lifecycle transaction is authoritative; its projection
            # has already been repaired above, so this stale intent is safe to
            # discard rather than replaying an old candidate.
            remove_journal(state_dir)
    elif malformed:
        # A missing or damaged intent cannot override a committed v2 active.
        # The projection was repaired from that active identity above.
        remove_journal(state_dir)
    if (state_dir / ACTIVATION_FILE).exists():
        remove_journal(state_dir)
    return {"active": target, "generation": current["generation"], "recovered": bool(journal or malformed)}


def activate(args: argparse.Namespace) -> Dict[str, Any]:
    state_dir = Path(args.state_dir)
    lifecycle_script = script_path(args.lifecycle_script, "runtime-blob-release-lifecycle.py")
    host_script = script_path(args.host_state_script, "runtime-release-host-state.py")
    candidate = identity(json.loads(Path(args.identity).read_text(encoding="utf-8")), "activation identity")
    lock = lock_state(state_dir)
    try:
        recover_locked(state_dir, lifecycle_script, host_script)
        current = lifecycle_state(state_dir, lifecycle_script)
        if args.expected_generation != current["generation"]:
            fail("expected lifecycle generation does not match current authority")
        if current["desired"] != candidate:
            fail("only the exact desired candidate may be activated")
        previous = current["active"]
        journal_value = {
            "schemaVersion": ACTIVATION_SCHEMA,
            "status": "prepared",
            "transactionId": uuid.uuid4().hex,
            "expectedGeneration": current["generation"],
            "targetGeneration": current["generation"] + 1,
            "previousIdentity": previous,
            "targetIdentity": candidate,
            "targetLifecycleSha256": "",
        }
        write_atomic(state_dir / ACTIVATION_FILE, journal_value)
        crash_if("after-intent")
        lifecycle_command(
            lifecycle_script,
            "activate",
            "--state-dir", str(state_dir),
            "--expected-generation", str(current["generation"]),
            "--identity", str(args.identity),
        )
        committed = lifecycle_state(state_dir, lifecycle_script)
        if committed["generation"] != journal_value["targetGeneration"] or committed["active"] != candidate:
            fail("lifecycle activation did not commit the requested identity")
        crash_if("after-lifecycle")
        journal_value = dict(journal_value)
        journal_value["status"] = "lifecycle-committed"
        journal_value["targetLifecycleSha256"] = LIFECYCLE.digest(committed)
        write_atomic(state_dir / ACTIVATION_FILE, journal_value)
        crash_if("after-lifecycle-journal")
        project_host_active(state_dir, host_script, candidate)
        crash_if("after-receipt-readback")
        journal_value["status"] = "receipt-committed"
        write_atomic(state_dir / ACTIVATION_FILE, journal_value)
        crash_if("after-receipt-committed")
        journal_value["status"] = "complete"
        write_atomic(state_dir / ACTIVATION_FILE, journal_value)
        crash_if("after-complete")
        remove_journal(state_dir)
        return {"active": committed, "generation": committed["generation"], "completed": True}
    finally:
        lock.close()


def recover(args: argparse.Namespace) -> Dict[str, Any]:
    state_dir = Path(args.state_dir)
    lifecycle_script = script_path(args.lifecycle_script, "runtime-blob-release-lifecycle.py")
    host_script = script_path(args.host_state_script, "runtime-release-host-state.py")
    lock = lock_state(state_dir)
    try:
        return recover_locked(state_dir, lifecycle_script, host_script)
    finally:
        lock.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command")
    for name in ("recover", "activate"):
        command = commands.add_parser(name)
        command.add_argument("--state-dir", required=True)
        command.add_argument("--lifecycle-script")
        command.add_argument("--host-state-script")
    commands.choices["activate"].add_argument("--expected-generation", required=True, type=int)
    commands.choices["activate"].add_argument("--identity", required=True)
    args = parser.parse_args()
    if args.command == "recover":
        result = recover(args)
    elif args.command == "activate":
        result = activate(args)
    else:
        parser.error("a command is required")
    print(json.dumps(result, separators=(",", ":"), sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print("ERROR: %s" % error, file=sys.stderr)
        sys.exit(1)
