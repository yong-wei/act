#!/usr/bin/env python3
"""Read-only FUSE adapter that serves SHA-256 Blobs from the ECS developer gateway cache."""

from __future__ import annotations

import argparse
import errno
import json
import os
import re
import stat
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from common import SHA256, fail  # noqa: E402
from gateway_client import GatewayClient  # noqa: E402
from gateway_service import GatewayError  # noqa: E402

DIGEST_PATH = re.compile(r"^/?([a-f0-9]{64})$")


def write_cached_bytes(path: Path, payload: bytes) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(path.parent, 0o700)
    temporary = path.with_name(".%s.%s.tmp" % (path.name, os.getpid()))
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    try:
        os.write(descriptor, payload)
        os.fchmod(descriptor, 0o644)
    finally:
        os.close(descriptor)
    os.replace(temporary, path)
    os.chmod(path, 0o644)


def cached_blob_path(cache_dir: Path, digest: str) -> Path:
    return cache_dir / "objects" / digest


def ensure_cached_blob(session_path: Path, cache_dir: Path, digest: str) -> Path:
    if not SHA256.fullmatch(digest):
        fail("blob digest is invalid")
    cached = cached_blob_path(cache_dir, digest)
    if cached.is_file() and not cached.is_symlink():
        return cached
    try:
        session = json.loads(session_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        fail("gateway session is missing")
    gateway_url = session.get("gatewayUrl")
    token = session.get("token")
    if not isinstance(gateway_url, str) or not isinstance(token, str):
        fail("gateway session is invalid")
    client = GatewayClient(gateway_url, token)
    leases = session.get("leases")
    if not isinstance(leases, dict) or not leases:
        fail("gateway session has no live lease")
    last_error: GatewayError | None = None
    for lease in leases.values():
        if not isinstance(lease, dict):
            continue
        lease_id = lease.get("leaseId")
        transport = lease.get("transport")
        if not isinstance(lease_id, str) or not isinstance(transport, str):
            continue
        try:
            data = client.get_blob(lease_id, transport, digest)
        except GatewayError as error:
            last_error = error
            continue
        write_cached_bytes(cached, data)
        return cached
    if last_error is not None and last_error.status in (401, 403, 409):
        fail("developer runtime gateway refused the blob")
    fail("developer runtime gateway could not serve the blob")
    return cached


def main() -> int:
    parser = argparse.ArgumentParser(prog="act-runtime-dev-gateway-fuse")
    parser.add_argument("--mount", required=True)
    parser.add_argument("--session", required=True)
    parser.add_argument("--cache-dir", required=True)
    args = parser.parse_args()
    mountpoint = Path(args.mount)
    session_path = Path(args.session)
    cache_dir = Path(args.cache_dir)
    mountpoint.mkdir(mode=0o755, parents=True, exist_ok=True)
    cache_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(cache_dir, 0o700)
    try:
        from fuse import FUSE, FuseOSError, Operations
    except ImportError:
        fail("python3-fuse is required for the gateway Blob adapter")

    class GatewayFS(Operations):
        def _digest(self, path: str) -> str | None:
            match = DIGEST_PATH.fullmatch(path)
            return match.group(1) if match else None

        def getattr(self, path, fh=None):
            now = int(time.time())
            if path == "/":
                return dict(
                    st_mode=(stat.S_IFDIR | 0o555),
                    st_nlink=2,
                    st_uid=os.getuid(),
                    st_gid=os.getgid(),
                    st_size=0,
                    st_atime=now,
                    st_mtime=now,
                    st_ctime=now,
                )
            digest = self._digest(path)
            if digest is None:
                raise FuseOSError(errno.ENOENT)
            try:
                cached = ensure_cached_blob(session_path, cache_dir, digest)
            except Exception:
                raise FuseOSError(errno.ENOENT) from None
            stat_result = cached.stat()
            return dict(
                st_mode=(stat.S_IFREG | 0o444),
                st_nlink=1,
                st_uid=os.getuid(),
                st_gid=os.getgid(),
                st_size=stat_result.st_size,
                st_atime=now,
                st_mtime=now,
                st_ctime=now,
            )

        def readdir(self, path, fh):
            if path != "/":
                raise FuseOSError(errno.ENOENT)
            return [".", ".."]

        def open(self, path, flags):
            if flags & (os.O_WRONLY | os.O_RDWR | os.O_APPEND | os.O_CREAT | os.O_TRUNC):
                raise FuseOSError(errno.EROFS)
            digest = self._digest(path)
            if digest is None:
                raise FuseOSError(errno.ENOENT)
            try:
                ensure_cached_blob(session_path, cache_dir, digest)
            except Exception:
                raise FuseOSError(errno.ENOENT) from None
            return 0

        def read(self, path, size, offset, fh):
            digest = self._digest(path)
            if digest is None:
                raise FuseOSError(errno.ENOENT)
            try:
                cached = ensure_cached_blob(session_path, cache_dir, digest)
            except Exception:
                raise FuseOSError(errno.ENOENT) from None
            with cached.open("rb") as handle:
                handle.seek(offset)
                return handle.read(size)

    FUSE(
        GatewayFS(),
        str(mountpoint),
        foreground=False,
        ro=True,
        allow_other=True,
        default_permissions=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
