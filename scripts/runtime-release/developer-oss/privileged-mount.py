#!/usr/bin/env python3
"""Root helper that only bind-mounts or unmounts developer OSS runtime paths."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

ALLOWED_STATE_MARKER = "/act-runtime-dev-read/"
ALLOWED_RUNTIME_SUFFIX = "/course-content/runtime"
MOUNT_BINARIES = ("/bin/mount", "/usr/bin/mount")
UMOUNT_BINARIES = ("/bin/umount", "/usr/bin/umount")


def fail(message: str) -> None:
    print("ERROR: %s" % message, file=sys.stderr)
    raise SystemExit(1)


def first_executable(candidates: tuple[str, ...], label: str) -> str:
    for candidate in candidates:
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    fail("%s binary is missing" % label)
    return ""


def allowed_runtime_or_state(path: Path) -> bool:
    posix = path.as_posix().rstrip("/")
    return posix.endswith(ALLOWED_RUNTIME_SUFFIX) or ALLOWED_STATE_MARKER in posix + "/"


def normalize(raw: str) -> Path:
    path = Path(raw)
    if path.is_absolute() is False:
        fail("path must be absolute")
    parts = path.as_posix().split("/")
    if ".." in parts:
        fail("path must not contain ..")
    lexical = Path(os.path.abspath(path))
    real = Path(os.path.realpath(path))
    if not allowed_runtime_or_state(lexical) or not allowed_runtime_or_state(real):
        fail("path is outside the developer runtime allowlist")
    return real


def run_mount(args: list[str]) -> None:
    completed = subprocess.run([first_executable(MOUNT_BINARIES, "mount"), *args], check=False)
    if completed.returncode != 0:
        fail("mount failed")


def run_umount(path: Path) -> None:
    umount = first_executable(UMOUNT_BINARIES, "umount")
    completed = subprocess.run([umount, str(path)], check=False)
    if completed.returncode != 0:
        fail("umount failed")


def main() -> int:
    parser = argparse.ArgumentParser(prog="act-runtime-dev-mount")
    commands = parser.add_subparsers(dest="command", required=True)
    bind = commands.add_parser("bind")
    bind.add_argument("source")
    bind.add_argument("destination")
    remount = commands.add_parser("remount-ro")
    remount.add_argument("destination")
    unmount = commands.add_parser("umount")
    unmount.add_argument("path")
    args = parser.parse_args()

    if args.command == "bind":
        source = normalize(args.source)
        destination = normalize(args.destination)
        run_mount(["--bind", str(source), str(destination)])
    elif args.command == "remount-ro":
        destination = normalize(args.destination)
        run_mount(["-o", "remount,bind,ro", str(destination)])
    elif args.command == "umount":
        run_umount(normalize(args.path))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BrokenPipeError:
        raise SystemExit(1)
