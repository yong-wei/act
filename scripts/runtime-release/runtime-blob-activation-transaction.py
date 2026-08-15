#!/usr/bin/env python3
"""Compatibility entry point for lifecycle-owned cross-state activation.

The lifecycle authority owns the lock, activation journal, CAS transition and
v1 host-receipt projection. Keeping this wrapper lets existing deployment
scripts retain one stable executable without creating a second transaction
owner.
"""

import argparse
import importlib.util
import json
import subprocess
import sys
from pathlib import Path


def load_lifecycle():
    path = Path(__file__).with_name("runtime-blob-release-lifecycle.py")
    spec = importlib.util.spec_from_file_location("runtime_blob_activation_lifecycle", str(path))
    if spec is None or spec.loader is None:
        raise ValueError("runtime lifecycle module is unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


LIFECYCLE = load_lifecycle()


def script_path(value, default_name):
    path = Path(value) if value else Path(__file__).with_name(default_name)
    if path.is_symlink() or not path.is_file():
        raise ValueError("required runtime script is unavailable: %s" % path)
    return path


def run(command):
    result = subprocess.run(
        [sys.executable] + [str(item) for item in command],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "command failed"
        raise ValueError(detail)
    try:
        value = json.loads(result.stdout)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("command returned invalid JSON: %s" % error)
    if not isinstance(value, dict):
        raise ValueError("command returned a non-object JSON result")
    return value


def main():
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command")
    for name in ("recover", "activate", "rollback"):
        command = commands.add_parser(name)
        command.add_argument("--state-dir", required=True)
        command.add_argument("--lifecycle-script")
        command.add_argument("--host-state-script")
    commands.choices["activate"].add_argument("--expected-generation", required=True, type=int)
    commands.choices["activate"].add_argument("--identity", required=True)
    commands.choices["rollback"].add_argument("--expected-generation", required=True, type=int)
    args = parser.parse_args()
    if args.command is None:
        parser.error("a command is required")
    lifecycle_script = script_path(args.lifecycle_script, "runtime-blob-release-lifecycle.py")
    host_script = script_path(args.host_state_script, "runtime-release-host-state.py")
    if args.command == "recover":
        result = run([
            lifecycle_script,
            "recover-and-project",
            "--state-dir", args.state_dir,
            "--host-state-script", host_script,
        ])
    elif args.command == "activate":
        result = run([
            lifecycle_script,
            "activate-and-project",
            "--state-dir", args.state_dir,
            "--expected-generation", args.expected_generation,
            "--identity", args.identity,
            "--host-state-script", host_script,
        ])
    else:
        result = run([
            lifecycle_script,
            "rollback-and-project",
            "--state-dir", args.state_dir,
            "--expected-generation", args.expected_generation,
            "--host-state-script", host_script,
        ])
    print(json.dumps(result, separators=(",", ":"), sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print("ERROR: %s" % error, file=sys.stderr)
        sys.exit(1)
