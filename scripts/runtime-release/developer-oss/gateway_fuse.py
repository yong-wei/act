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
import secrets
import stat
import sys
import threading
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from common import SHA256, TRANSFER_SCHEMA, cache_size_gib, fail  # noqa: E402
from gateway_client import GatewayClient  # noqa: E402
from gateway_service import GatewayError  # noqa: E402

DIGEST_PATH = re.compile(r"^/?([a-f0-9]{64})$")
BODY_TRANSFER = "gateway-body-transfer"
CACHE_HIT = "cache-hit"
HEARTBEAT_INTERVAL_SECONDS = 60
_BLOB_LOCKS_GUARD = threading.Lock()
_BLOB_LOCKS: dict[str, threading.Lock] = {}
_CACHE_QUOTA_LOCK = threading.Lock()


def write_cached_bytes(path: Path, payload: bytes) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(path.parent, 0o700)
    temporary = path.with_name(".%s.%s.%s.tmp" % (path.name, os.getpid(), secrets.token_hex(8)))
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    try:
        os.write(descriptor, payload)
        os.fchmod(descriptor, 0o644)
    finally:
        os.close(descriptor)
    os.replace(temporary, path)
    os.chmod(path, 0o644)


def cache_operations_path(cache_dir: Path) -> Path:
    return cache_dir.parent / "operations.jsonl"


def record_blob_operation(cache_dir: Path, op_class: str, digest: str, size_bytes: int) -> None:
    if op_class not in (BODY_TRANSFER, CACHE_HIT):
        fail("unsupported transfer operation class")
    if not SHA256.fullmatch(digest):
        fail("transfer digest is invalid")
    if not isinstance(size_bytes, int) or size_bytes < 0:
        fail("transfer size is invalid")
    row = {
        "schemaVersion": TRANSFER_SCHEMA,
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "opClass": op_class,
        "sha256": digest,
        "sizeBytes": size_bytes,
    }
    path = cache_operations_path(cache_dir)
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(path.parent, 0o700)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    try:
        os.write(descriptor, (json.dumps(row, sort_keys=True) + "\n").encode("utf-8"))
        os.fchmod(descriptor, 0o600)
    finally:
        os.close(descriptor)


def object_cache_usage(cache_dir: Path) -> int:
    objects = cache_dir / "objects"
    if not objects.is_dir():
        return 0
    total = 0
    for path in objects.iterdir():
        if path.is_file() and not path.is_symlink() and SHA256.fullmatch(path.name):
            total += path.stat().st_size
    return total


def enforce_object_cache_quota(
    cache_dir: Path,
    incoming: int,
    keep: set[str],
    limit_bytes: int | None = None,
) -> None:
    limit = cache_size_gib() * 1024 * 1024 * 1024 if limit_bytes is None else limit_bytes
    if incoming > limit:
        fail("blob exceeds the configured cache quota")
    objects = cache_dir / "objects"
    while object_cache_usage(cache_dir) + incoming > limit:
        candidates = []
        if objects.is_dir():
            for path in objects.iterdir():
                if path.is_file() and not path.is_symlink() and SHA256.fullmatch(path.name) and path.name not in keep:
                    candidates.append(path)
        if not candidates:
            fail("shared cache exceeds the configured quota")
        oldest = min(candidates, key=lambda item: item.stat().st_mtime)
        oldest.unlink()


def _blob_lock(digest: str) -> threading.Lock:
    with _BLOB_LOCKS_GUARD:
        lock = _BLOB_LOCKS.get(digest)
        if lock is None:
            lock = threading.Lock()
            _BLOB_LOCKS[digest] = lock
        return lock


def cached_blob_path(cache_dir: Path, digest: str) -> Path:
    return cache_dir / "objects" / digest


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def quarantine_cached_blob(path: Path) -> None:
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
    elif isinstance(session.get("leaseId"), str):
        entries.append(session)
    return entries


def iter_live_lease_entries(session_path: Path, session: dict) -> list[dict]:
    leases = session.get("leases")
    if isinstance(leases, dict) and leases:
        from shared_mount import live_shared_session_lease_rows
        live, _dead = live_shared_session_lease_rows(session_path.parent.name, leases)
        return live
    if isinstance(session.get("leaseId"), str):
        return [session]
    return []


def heartbeat_session_leases(session_path: Path) -> None:
    """Prove each gateway lease from its owning checkout, not the shared FUSE.

    Shared topology: heartbeat only checkouts whose recorded owning processes
    are still alive; proven-dead checkouts are DELETE'd and dropped from the
    session so a surviving worktree cannot keep a crashed checkout's A-only
    lease live. Empty pids and missing local records are dead. Checkout
    topology: this FUSE process is the checkout.
    """
    try:
        session = json.loads(session_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    if not isinstance(session, dict):
        return
    url = session.get("gatewayUrl")
    token = session.get("token")
    if not isinstance(url, str) or not isinstance(token, str):
        return
    client = GatewayClient(url, token)
    leases_map = session.get("leases")
    if isinstance(leases_map, dict) and leases_map:
        from shared_mount import live_shared_session_lease_rows
        live_rows, dead = live_shared_session_lease_rows(session_path.parent.name, leases_map)
        seen: set[str] = set()
        for entry in live_rows:
            lease_id = entry.get("leaseId")
            if not isinstance(lease_id, str) or lease_id in seen:
                continue
            seen.add(lease_id)
            try:
                client.heartbeat(lease_id)
            except GatewayError:
                continue
        remaining = dict(leases_map)
        changed = False
        for checkout_key, lease_id in dead:
            try:
                client.stop_lease(lease_id)
            except GatewayError:
                pass
            remaining.pop(checkout_key, None)
            changed = True
        if changed:
            session["leases"] = remaining
            persist_session_payload(session_path, session)
        return
    lease_id = session.get("leaseId")
    if isinstance(lease_id, str):
        try:
            client.heartbeat(lease_id)
        except GatewayError:
            return


def _session_heartbeat_loop(
    session_path: Path,
    stop: threading.Event,
    interval: float = HEARTBEAT_INTERVAL_SECONDS,
) -> None:
    while True:
        try:
            heartbeat_session_leases(session_path)
        except Exception:
            pass
        if stop.wait(interval):
            return


def declared_blob_size(session_path: Path, digest: str) -> int | None:
    if not SHA256.fullmatch(digest):
        return None
    session = read_session(session_path)
    for lease in iter_live_lease_entries(session_path, session):
        sizes = lease.get("blobSizes")
        if not isinstance(sizes, dict):
            continue
        size = sizes.get(digest)
        if isinstance(size, int) and size >= 0:
            return size
    return None


def persist_session_payload(session_path: Path, session: dict) -> None:
    descriptor = os.open(session_path, os.O_RDWR)
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX)
        encoded = (json.dumps(session, indent=2, sort_keys=True) + "\n").encode("utf-8")
        os.lseek(descriptor, 0, os.SEEK_SET)
        os.ftruncate(descriptor, 0)
        os.write(descriptor, encoded)
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


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
    leases = iter_live_lease_entries(session_path, session)
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


def ensure_cached_blob(session_path: Path, cache_dir: Path, digest: str, loader=None) -> Path:
    if not SHA256.fullmatch(digest):
        fail("blob digest is invalid")
    with _blob_lock(digest):
        cached = cached_blob_path(cache_dir, digest)
        if cached.is_file() and not cached.is_symlink():
            if hash_file(cached) == digest:
                record_blob_operation(cache_dir, CACHE_HIT, digest, cached.stat().st_size)
                return cached
            quarantine_cached_blob(cached)
        data = loader(digest) if loader is not None else _fetch_blob(session_path, digest)
        if hashlib.sha256(data).hexdigest() != digest:
            fail("developer runtime gateway returned a mismatched blob")
        with _CACHE_QUOTA_LOCK:
            enforce_object_cache_quota(cache_dir, len(data), {digest})
            write_cached_bytes(cached, data)
            if hash_file(cached) != digest:
                quarantine_cached_blob(cached)
                fail("cached blob failed SHA-256 verification")
            record_blob_operation(cache_dir, BODY_TRANSFER, digest, len(data))
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

        def init(self, *args, **kwargs):
            self._heartbeat_stop = threading.Event()
            thread = threading.Thread(
                target=_session_heartbeat_loop,
                args=(session_path, self._heartbeat_stop),
                daemon=True,
                name="gateway-lease-heartbeat",
            )
            thread.start()

        def destroy(self, *args, **kwargs):
            stop = getattr(self, "_heartbeat_stop", None)
            if stop is not None:
                stop.set()

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
            cached = cached_blob_path(cache_dir, digest)
            if not cached.is_file() or cached.is_symlink():
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
