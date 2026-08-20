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
O_PATH = getattr(os, "O_PATH", 0)


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


def lexical_path(raw: str) -> Path:
    path = Path(raw)
    if path.is_absolute() is False:
        fail("path must be absolute")
    if ".." in path.as_posix().split("/"):
        fail("path must not contain ..")
    return Path(os.path.abspath(path))


def open_directory_nofollow(path: Path) -> int:
    fd = os.open("/", os.O_RDONLY | os.O_DIRECTORY | O_PATH)
    try:
        for part in path.as_posix().strip("/").split("/"):
            if part in ("", ".", ".."):
                fail("path must not contain ..")
            next_fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | O_PATH, dir_fd=fd)
            os.close(fd)
            fd = next_fd
        return fd
    except OSError:
        os.close(fd)
        fail("path is outside the developer runtime allowlist")
        return -1


def fd_path(fd: int) -> Path:
    proc = "/proc/self/fd/%d" % fd
    if os.path.isdir("/proc/self/fd"):
        return Path(os.readlink(proc))
    try:
        import fcntl
        getter = getattr(fcntl, "F_GETPATH", 50)
        result = fcntl.fcntl(fd, getter, b"\0" * 1024)
        text = result.split(b"\x00", 1)[0].decode("utf-8") if isinstance(result, bytes) else ""
        if text:
            return Path(text)
    except OSError:
        pass
    fail("cannot resolve pinned directory")
    return Path("/")


def mount_fd_path(fd: int) -> str:
    proc = "/proc/self/fd/%d" % fd
    if os.path.isdir("/proc/self/fd"):
        return proc
    fail("Linux /proc is required to execute privileged mounts")
    return proc


def pin_allowed_dir(raw: str) -> int:
    lexical = lexical_path(raw)
    if not allowed_runtime_or_state(lexical):
        fail("path is outside the developer runtime allowlist")
    real = Path(os.path.realpath(lexical))
    if not allowed_runtime_or_state(real):
        fail("path is outside the developer runtime allowlist")
    fd = open_directory_nofollow(real)
    pinned = fd_path(fd)
    if not allowed_runtime_or_state(pinned):
        os.close(fd)
        fail("path is outside the developer runtime allowlist")
    return fd


def run_mount(args: list[str], fds: tuple[int, ...]) -> None:
    completed = subprocess.run(
        [first_executable(MOUNT_BINARIES, "mount"), *args],
        check=False,
        pass_fds=fds,
    )
    if completed.returncode != 0:
        fail("mount failed")


def run_umount(fd: int) -> None:
    umount = first_executable(UMOUNT_BINARIES, "umount")
    completed = subprocess.run(
        [umount, mount_fd_path(fd)],
        check=False,
        pass_fds=(fd,),
    )
    if completed.returncode != 0:
        fail("umount failed")


def close_fds(*fds: int) -> None:
    for fd in fds:
        if fd >= 0:
            os.close(fd)


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
        source_fd = pin_allowed_dir(args.source)
        destination_fd = -1
        try:
            destination_fd = pin_allowed_dir(args.destination)
            run_mount(
                ["--bind", mount_fd_path(source_fd), mount_fd_path(destination_fd)],
                (source_fd, destination_fd),
            )
        finally:
            close_fds(source_fd, destination_fd)
    elif args.command == "remount-ro":
        destination_fd = pin_allowed_dir(args.destination)
        try:
            run_mount(
                ["-o", "remount,bind,ro", mount_fd_path(destination_fd)],
                (destination_fd,),
            )
        finally:
            close_fds(destination_fd)
    elif args.command == "umount":
        path_fd = pin_allowed_dir(args.path)
        try:
            run_umount(path_fd)
        finally:
            close_fds(path_fd)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BrokenPipeError:
        raise SystemExit(1)
