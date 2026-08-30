#!/usr/bin/env python3
"""Read-only FUSE adapter that serves SHA-256 Blobs from the ECS developer gateway cache."""

from __future__ import annotations

import argparse
import errno
import fcntl
import hashlib
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
_verified_cache: set[str] = set()


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


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def quarantine_cached_blob(path: Path) -> None:
    _verified_cache.discard(str(path))
    target = path.with_name("%s.quarantine" % path.name)
    try:
        os.replace(path, target)
    except OSError:
        try:
            path.unlink()
        except OSError:
            pass


def read_session(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        fail("gateway session is missing")
    if not isinstance(payload, dict):
        fail("gateway session is invalid")
    return payload


def iter_lease_entries(session: dict) -> list[dict]:
    entries: list[dict] = []
    leases = session.get("leases")
    if isinstance(leases, dict):
        for item in leases.values():
            if isinstance(item, dict):
                entries.append(item)
    if isinstance(session.get("leaseId"), str):
        entries.append(session)
    return entries


def declared_blob_size(session_path: Path, digest: str) -> int | None:
    if not SHA256.fullmatch(digest):
        return None
    session = read_session(session_path)
    for lease in iter_lease_entries(session):
        sizes = lease.get("blobSizes")
        if not isinstance(sizes, dict):
            continue
        size = sizes.get(digest)
        if isinstance(size, int) and size >= 0:
            return size
    return None


def persist_transport(session_path: Path, lease_id: str, token: str) -> None:
    descriptor = os.open(session_path, os.O_RDWR)
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX)
        os.lseek(descriptor, 0, os.SEEK_SET)
        raw = os.read(descriptor, 16 * 1024 * 1024)
        try:
            session = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            fail("gateway session is invalid")
        if not isinstance(session, dict):
            fail("gateway session is invalid")
        if session.get("leaseId") == lease_id:
            session["transport"] = token
        leases = session.get("leases")
        if isinstance(leases, dict):
            for item in leases.values():
                if isinstance(item, dict) and item.get("leaseId") == lease_id:
                    item["transport"] = token
        encoded = (json.dumps(session, indent=2, sort_keys=True) + "\n").encode("utf-8")
        os.lseek(descriptor, 0, os.SEEK_SET)
        os.ftruncate(descriptor, 0)
        os.write(descriptor, encoded)
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _client_from_session(session: dict) -> GatewayClient:
    gateway_url = session.get("gatewayUrl")
    token = session.get("token")
    if not isinstance(gateway_url, str) or not isinstance(token, str):
        fail("gateway session is invalid")
    return GatewayClient(gateway_url, token)


def _fetch_blob(session_path: Path, digest: str) -> bytes:
    session = read_session(session_path)
    client = _client_from_session(session)
    leases = iter_lease_entries(session)
    if not leases:
        fail("gateway session has no live lease")
    last_error: GatewayError | None = None
    for lease in leases:
        lease_id = lease.get("leaseId")
        transport = lease.get("transport")
        if not isinstance(lease_id, str) or not isinstance(transport, str):
            continue
        try:
            return client.get_blob(lease_id, transport, digest)
        except GatewayError as error:
            last_error = error
            if error.status != 401:
                continue
            try:
                renewed = client.renew_transport(lease_id)
            except GatewayError as renew_error:
                last_error = renew_error
                continue
            token = renewed.get("transport", {}).get("token") if isinstance(renewed.get("transport"), dict) else None
            if not isinstance(token, str):
                continue
            persist_transport(session_path, lease_id, token)
            try:
                return client.get_blob(lease_id, token, digest)
            except GatewayError as retry_error:
                last_error = retry_error
                continue
    if last_error is not None and last_error.status in (401, 403, 409):
        fail("developer runtime gateway refused the blob")
    fail("developer runtime gateway could not serve the blob")
    return b""


def ensure_cached_blob(session_path: Path, cache_dir: Path, digest: str) -> Path:
    if not SHA256.fullmatch(digest):
        fail("blob digest is invalid")
    cached = cached_blob_path(cache_dir, digest)
    if cached.is_file() and not cached.is_symlink():
        if str(cached) in _verified_cache or hash_file(cached) == digest:
            _verified_cache.add(str(cached))
            return cached
        quarantine_cached_blob(cached)
    data = _fetch_blob(session_path, digest)
    if hashlib.sha256(data).hexdigest() != digest:
        fail("developer runtime gateway returned a mismatched blob")
    write_cached_bytes(cached, data)
    if hash_file(cached) != digest:
        quarantine_cached_blob(cached)
        fail("cached blob failed SHA-256 verification")
    _verified_cache.add(str(cached))
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
            size = declared_blob_size(session_path, digest)
            if size is None:
                raise FuseOSError(errno.ENOENT)
            return dict(
                st_mode=(stat.S_IFREG | 0o444),
                st_nlink=1,
                st_uid=os.getuid(),
                st_gid=os.getgid(),
                st_size=size,
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
            if digest is None or declared_blob_size(session_path, digest) is None:
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
