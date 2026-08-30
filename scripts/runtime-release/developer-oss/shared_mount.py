#!/usr/bin/env python3
from __future__ import annotations

import contextlib
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Callable, Iterator

from common import (
    BLOB_PREFIX,
    DEFAULT_CACHE_SIZE_GIB,
    GATEWAY_PRINCIPAL,
    GATEWAY_SESSION_SCHEMA,
    LEASE_SCHEMA,
    SHA256,
    SHARED_MOUNT_SCHEMA,
    TOPOLOGY_CHECKOUT,
    TOPOLOGY_SHARED,
    TRANSFER_SCHEMA,
    assert_portable,
    authority_id,
    authority_identity,
    cache_size_gib,
    checkout_id,
    checkout_pid_dir,
    checkout_state,
    fail,
    options_digest,
    ossfs_cache_dir,
    persistent_cache_dir,
    redact,
    require_mode,
    shared_lock_path,
    shared_mount_dir,
    shared_state_root,
    topology_mode,
    use_real_fuse,
)

MOUNT_HELPER = Path(__file__).with_name("privileged-mount.py")
BODY_TRANSFER = "gateway-body-transfer"
CACHE_HIT = "cache-hit"
OSSFS_GETOBJECT = re.compile(r"GetObject|\"GET\"\s+/\S+", re.IGNORECASE)
OSSFS_CACHE_HIT = re.compile(r"cache hit|disk_data_cache.*hit", re.IGNORECASE)
OSSFS_VERSION = re.compile(r"(\d+)\.(\d+)\.(\d+)")
UnmountFn = Callable[[Path], None]


def which(name: str) -> str:
    path = shutil.which(name)
    if not path:
        fail("required tool is missing: %s" % name)
    return path


def run(command: list[str], env: dict[str, str] | None = None, cwd: Path | None = None) -> str:
    try:
        completed = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            env=env,
            cwd=str(cwd) if cwd else None,
        )
    except subprocess.CalledProcessError as error:
        fail("%s failed" % command[0])
        raise error
    return completed.stdout


def mount_helper_path() -> str:
    configured = os.environ.get("ACT_RUNTIME_DEV_MOUNT_HELPER")
    if configured:
        return configured
    installed = Path("/usr/local/sbin/act-runtime-dev-mount")
    if installed.exists():
        return str(installed)
    fail("install /usr/local/sbin/act-runtime-dev-mount; do not grant unrestricted mount sudo")
    return ""


def privileged_mount(args: list[str]) -> list[str]:
    if os.geteuid() == 0:
        return [sys.executable, str(MOUNT_HELPER), *args]
    return [which("sudo"), "-n", mount_helper_path(), *args]


def utcnow() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def ensure_private_dir(path: Path, mode: int = 0o700) -> None:
    path.mkdir(mode=mode, parents=True, exist_ok=True)
    os.chmod(path, mode)


def write_private_bytes(path: Path, payload: bytes, mode: int = 0o600) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(path.parent, 0o700)
    temporary = path.with_name(".%s.%s.tmp" % (path.name, os.getpid()))
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, mode)
    try:
        os.write(descriptor, payload)
        os.fchmod(descriptor, mode)
    finally:
        os.close(descriptor)
    os.replace(temporary, path)
    os.chmod(path, mode)


def write_private_json(path: Path, payload: dict[str, Any]) -> None:
    serialized = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    if "accessKey" in serialized or "LTAI" in serialized or "Secret" in serialized:
        fail("local state must not contain credentials")
    write_private_bytes(path, serialized.encode("utf-8"))


def read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    require_mode(path, 0o600, str(path.name))
    return json.loads(path.read_text(encoding="utf-8"))


def acquire_global_lock() -> int:
    import fcntl
    root = shared_state_root()
    ensure_private_dir(root)
    lock_path = shared_lock_path()
    descriptor = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o600)
    fcntl.flock(descriptor, fcntl.LOCK_EX)
    return descriptor


def acquire_checkout_lock(checkout: Path) -> int:
    import fcntl
    state = checkout_state(checkout)
    ensure_private_dir(state)
    lock_path = state / "prepare.lock"
    descriptor = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o600)
    fcntl.flock(descriptor, fcntl.LOCK_EX)
    return descriptor


@contextlib.contextmanager
def adapter_locks(checkout: Path) -> Iterator[None]:
    global_fd = acquire_global_lock()
    try:
        checkout_fd = acquire_checkout_lock(checkout)
        try:
            yield
        finally:
            os.close(checkout_fd)
    finally:
        os.close(global_fd)


def mount_fields(path: Path) -> tuple[str, str]:
    helper = os.environ.get("ACT_RUNTIME_DEV_FINDMNT")
    binary = helper or shutil.which("findmnt")
    if not binary:
        if not use_real_fuse():
            return "", ""
        fail("required tool is missing: findmnt")
    completed = subprocess.run([binary, "-n", "-o", "FSTYPE,OPTIONS", str(path)], capture_output=True, text=True)
    output = (completed.stdout or "").strip()
    if completed.returncode != 0 or not output:
        return "", ""
    fields = output.split(None, 1)
    fstype = fields[0] if fields else ""
    options = fields[1] if len(fields) > 1 else ""
    return fstype, options


def is_mounted(path: Path) -> bool:
    fstype, _ = mount_fields(path)
    return bool(fstype)


def is_fuse_readonly(path: Path) -> bool:
    fstype, options = mount_fields(path)
    return "fuse" in fstype.lower() and "ro" in options.split(",")


def is_readonly_mount(path: Path) -> bool:
    _, options = mount_fields(path)
    return "ro" in options.split(",")


def parse_ossfs2_version(text: str) -> tuple[int, int, int]:
    match = OSSFS_VERSION.search(text or "")
    if not match:
        fail("ossfs2 version is unreadable")
    return int(match.group(1)), int(match.group(2)), int(match.group(3))


def require_ossfs2_version() -> str:
    fail("ossfs2 is not the developer Blob data plane")
    return ""


def ossfs_config_lines(credential: dict[str, str], cache_dir: Path | None, log_dir: Path | None) -> list[str]:
    fail("public ossfs2 is not the developer data plane")
    return []


def write_ossfs_config(
    path: Path,
    credential: dict[str, str],
    cache_dir: Path | None = None,
    log_dir: Path | None = None,
) -> None:
    write_private_bytes(path, ("\n".join(ossfs_config_lines(credential, cache_dir, log_dir)) + "\n").encode("utf-8"))
    require_mode(path, 0o600, "ossfs config")


def remove_ossfs_config(path: Path) -> None:
    if path.exists() and path.is_file() and not path.is_symlink():
        os.remove(path)


def mount_blobs(blob_root: Path, config_path: Path) -> None:
    fail("public ossfs2 is not the developer data plane")


def unmount(path: Path) -> None:
    fstype, _ = mount_fields(path)
    if not fstype:
        return
    if "fuse" in fstype.lower():
        fusermount = shutil.which("fusermount")
        if fusermount:
            subprocess.run([fusermount, "-u", str(path)], check=False, capture_output=True)
    subprocess.run(privileged_mount(["umount", str(path)]), check=False, capture_output=True)
    remaining, _ = mount_fields(path)
    if remaining:
        fail("failed to unmount a developer runtime mount")


def unmount_best_effort(path: Path) -> None:
    try:
        unmount(path)
    except Exception:
        return


def pid_is_alive(pid: int) -> bool:
    if pid <= 1:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def checkout_service_pids(checkout: Path) -> list[int]:
    directory = checkout_pid_dir(checkout)
    if not directory.is_dir():
        return []
    pids: list[int] = []
    for path in sorted(directory.glob("*.pid")):
        try:
            pid = int(path.read_text(encoding="utf-8").strip())
        except (OSError, ValueError):
            continue
        pids.append(pid)
    return pids


def bind_is_present(runtime_root: str | None) -> bool:
    if not runtime_root:
        return False
    return is_mounted(Path(runtime_root))


def lease_is_live(lease: dict[str, Any], checkout: Path | None = None) -> bool:
    runtime = lease.get("runtimeRoot")
    if bind_is_present(runtime):
        return True
    pids = list(lease.get("pids") or [])
    if checkout is not None:
        pids.extend(checkout_service_pids(checkout))
    if any(isinstance(pid, int) and pid_is_alive(pid) for pid in pids):
        return True
    if not use_real_fuse():
        return bool(runtime) and Path(str(runtime)).exists()
    return False


def record_path(mount_id: str) -> Path:
    return shared_mount_dir(mount_id) / "mount.json"


def leases_path(mount_id: str) -> Path:
    return shared_mount_dir(mount_id) / "leases.json"


def operations_path(mount_id: str) -> Path:
    return persistent_cache_dir(mount_id) / "operations.jsonl"


def read_shared_record(mount_id: str) -> dict[str, Any] | None:
    return read_json(record_path(mount_id))


def read_leases(mount_id: str) -> dict[str, Any]:
    payload = read_json(leases_path(mount_id))
    if not payload:
        return {"schemaVersion": LEASE_SCHEMA, "leases": {}}
    if payload.get("schemaVersion") != LEASE_SCHEMA or not isinstance(payload.get("leases"), dict):
        fail("shared lease schema is unsupported")
    return payload


def write_leases(mount_id: str, payload: dict[str, Any]) -> None:
    write_private_json(leases_path(mount_id), payload)


def live_lease_ids(mount_id: str) -> list[str]:
    payload = read_leases(mount_id)
    live = []
    for key, lease in payload.get("leases", {}).items():
        if isinstance(lease, dict) and lease_is_live(lease):
            live.append(key)
    return live


def reclaim_stale_leases(mount_id: str) -> list[str]:
    payload = read_leases(mount_id)
    reclaimed: list[str] = []
    remaining: dict[str, Any] = {}
    for key, lease in payload.get("leases", {}).items():
        if not isinstance(lease, dict):
            fail("shared lease record is invalid")
        if lease_is_live(lease):
            remaining[key] = lease
            continue
        if bind_is_present(lease.get("runtimeRoot")):
            fail("stale lease still has a live bind; unmount only the recorded runtime path")
        reclaimed.append(key)
    payload["leases"] = remaining
    payload["schemaVersion"] = LEASE_SCHEMA
    write_leases(mount_id, payload)
    return reclaimed


def verify_shared_identity(record: dict[str, Any], gateway_origin: str) -> None:
    expected = authority_identity(gateway_origin)
    identity = record.get("identity")
    if not isinstance(identity, dict):
        fail("shared mount identity is missing")
    for key, value in expected.items():
        if identity.get(key) != value:
            fail("shared mount identity drifted")
    if record.get("optionsDigest") != options_digest():
        fail("shared mount options drifted")
    if record.get("principal") not in (None, GATEWAY_PRINCIPAL):
        fail("shared mount principal drifted")


def verify_live_mount(mountpoint: Path) -> None:
    if not is_fuse_readonly(mountpoint):
        fail("shared Blob mount must stay a read-only FUSE filesystem")
    fstype, options = mount_fields(mountpoint)
    if "rw" in options.split(","):
        fail("shared Blob mount is writable")
    if fstype and "fuse" not in fstype.lower():
        fail("shared Blob mount source drifted")


def verify_shared_record(record: dict[str, Any], gateway_origin: str) -> None:
    verify_shared_identity(record, gateway_origin)
    mountpoint = Path(str(record.get("mountpoint") or ""))
    if use_real_fuse() and is_mounted(mountpoint):
        verify_live_mount(mountpoint)


def fixture_mount(blob_root: Path) -> None:
    blob_root.mkdir(mode=0o755, parents=True, exist_ok=True)


def gateway_session_path(mount_id: str) -> Path:
    return shared_mount_dir(mount_id) / "gateway-session.json"


def checkout_gateway_session_path(checkout: Path) -> Path:
    return checkout_state(checkout) / "gateway-session.json"


def write_shared_gateway_session(
    mount_id: str,
    credential: dict[str, str],
    leases: dict[str, Any] | None = None,
) -> None:
    path = gateway_session_path(mount_id)
    existing: dict[str, Any] = {}
    if path.exists():
        try:
            loaded = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                existing = loaded
        except (OSError, json.JSONDecodeError):
            existing = {}
    payload = {
        "schemaVersion": GATEWAY_SESSION_SCHEMA,
        "gatewayUrl": credential["gatewayUrl"],
        "leases": leases if leases is not None else existing.get("leases") or {},
        "token": credential["token"],
    }
    write_private_bytes(path, (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8"))


def register_checkout_gateway_lease(
    checkout: Path,
    credential: dict[str, str],
    lease: dict[str, Any],
    mount_id: str | None,
) -> None:
    transport = lease.get("transport")
    token = transport.get("token") if isinstance(transport, dict) else None
    if not isinstance(token, str) or not isinstance(lease.get("leaseId"), str):
        fail("gateway lease is invalid")
    blob_sizes = lease.get("blobSizes") if isinstance(lease.get("blobSizes"), dict) else {}
    checkout_payload = {
        "schemaVersion": GATEWAY_SESSION_SCHEMA,
        "checkoutId": checkout_id(checkout),
        "gatewayUrl": credential["gatewayUrl"],
        "leaseId": lease["leaseId"],
        "releaseId": lease.get("releaseId"),
        "transport": token,
        "blobSizes": blob_sizes,
    }
    write_private_bytes(
        checkout_gateway_session_path(checkout),
        (json.dumps(checkout_payload, indent=2, sort_keys=True) + "\n").encode("utf-8"),
    )
    if not mount_id:
        return
    path = gateway_session_path(mount_id)
    leases: dict[str, Any] = {}
    if path.exists():
        try:
            loaded = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict) and isinstance(loaded.get("leases"), dict):
                leases = dict(loaded["leases"])
        except (OSError, json.JSONDecodeError):
            leases = {}
    leases[checkout_id(checkout)] = {
        "leaseId": lease["leaseId"],
        "releaseId": lease.get("releaseId"),
        "transport": token,
        "blobSizes": blob_sizes,
    }
    write_shared_gateway_session(mount_id, credential, leases)


def unregister_checkout_gateway_lease(checkout: Path, mount_id: str | None) -> None:
    path = checkout_gateway_session_path(checkout)
    if path.exists() and path.is_file() and not path.is_symlink():
        os.remove(path)
    if not mount_id:
        return
    shared = gateway_session_path(mount_id)
    if not shared.exists():
        return
    try:
        loaded = json.loads(shared.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    leases = loaded.get("leases")
    if isinstance(leases, dict):
        leases.pop(checkout_id(checkout), None)
        loaded["leases"] = leases
        write_private_bytes(shared, (json.dumps(loaded, indent=2, sort_keys=True) + "\n").encode("utf-8"))


def mount_gateway_blobs(blob_root: Path, session_path: Path | None = None, cache_dir: Path | None = None) -> None:
    blob_root.mkdir(mode=0o755, parents=True, exist_ok=True)
    if not use_real_fuse():
        return
    helper = Path(__file__).with_name("gateway_fuse.py")
    if not helper.is_file():
        fail("gateway FUSE adapter is missing")
    if session_path is None or cache_dir is None:
        fail("gateway FUSE session and cache directory are required")
    run([
        sys.executable,
        str(helper),
        "--mount", str(blob_root),
        "--session", str(session_path),
        "--cache-dir", str(cache_dir),
    ])
    if not is_fuse_readonly(blob_root):
        fail("blob mount must be a read-only FUSE filesystem")


def ensure_shared_mount(credential: dict[str, str], _legacy: str | None = None) -> dict[str, Any]:
    origin = credential.get("origin")
    if not origin:
        fail("gateway origin is missing")
    mount_id = authority_id(origin)
    root = shared_mount_dir(mount_id)
    cache = ossfs_cache_dir(mount_id)
    logs = persistent_cache_dir(mount_id) / "logs"
    blob_root = root / "blobs"
    ensure_private_dir(root)
    ensure_private_dir(persistent_cache_dir(mount_id))
    cache.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(cache, 0o700)
    logs.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(logs, 0o700)
    write_shared_gateway_session(mount_id, credential)
    record = read_shared_record(mount_id)
    expected_identity = authority_identity(origin)
    if record:
        verify_shared_identity(record, origin)
        if use_real_fuse():
            if is_mounted(blob_root):
                verify_live_mount(blob_root)
            else:
                if shutil.disk_usage(str(cache)).free < cache_size_gib() * 1024 * 1024 * 1024:
                    fail("shared cache disk is smaller than the configured quota")
                mount_gateway_blobs(blob_root, gateway_session_path(mount_id), cache)
                verify_live_mount(blob_root)
        else:
            fixture_mount(blob_root)
    else:
        if use_real_fuse():
            usage = shutil.disk_usage(str(cache))
            required = cache_size_gib() * 1024 * 1024 * 1024
            if usage.free < required:
                fail("shared cache disk is smaller than the configured quota")
            mount_gateway_blobs(blob_root, gateway_session_path(mount_id), cache)
        else:
            fixture_mount(blob_root)
        record = {
            "schemaVersion": SHARED_MOUNT_SCHEMA,
            "adapter": "ecs-gateway",
            "cachePolicy": "on-demand",
            "cacheSizeGiB": cache_size_gib(),
            "createdAt": utcnow(),
            "identity": expected_identity,
            "identityId": mount_id,
            "optionsDigest": options_digest(),
            "principal": GATEWAY_PRINCIPAL,
            "status": "mounted",
        }
    record["mountpoint"] = str(blob_root)
    record["cacheDir"] = str(cache)
    record["logDir"] = str(logs)
    record["updatedAt"] = utcnow()
    record["status"] = "mounted"
    portable = {key: value for key, value in record.items() if key not in ("configPath",)}
    write_private_json(record_path(mount_id), portable)
    reclaim_stale_leases(mount_id)
    if not operations_path(mount_id).exists():
        write_private_bytes(operations_path(mount_id), b"")
    return record


def acquire_lease(checkout: Path, mount_id: str, selection: dict[str, Any]) -> None:
    payload = read_leases(mount_id)
    key = checkout_id(checkout)
    payload["schemaVersion"] = LEASE_SCHEMA
    payload["leases"][key] = {
        "checkoutId": key,
        "helperMount": selection.get("helperMount"),
        "heartbeatAt": utcnow(),
        "pids": checkout_service_pids(checkout),
        "releaseId": selection.get("releaseId"),
        "runtimeRoot": selection.get("runtimeRoot"),
        "startedAt": selection.get("startedAt") or utcnow(),
        "viewRoot": selection.get("viewRoot"),
    }
    write_leases(mount_id, payload)


def heartbeat_lease(checkout: Path, mount_id: str, selection: dict[str, Any] | None = None) -> None:
    payload = read_leases(mount_id)
    key = checkout_id(checkout)
    lease = payload.get("leases", {}).get(key)
    if not isinstance(lease, dict):
        if selection is None:
            fail("shared mount lease is missing for a live checkout")
        acquire_lease(checkout, mount_id, selection)
        return
    lease["heartbeatAt"] = utcnow()
    lease["pids"] = checkout_service_pids(checkout)
    if selection:
        lease["helperMount"] = selection.get("helperMount") or lease.get("helperMount")
        lease["releaseId"] = selection.get("releaseId") or lease.get("releaseId")
        lease["runtimeRoot"] = selection.get("runtimeRoot") or lease.get("runtimeRoot")
        lease["viewRoot"] = selection.get("viewRoot") or lease.get("viewRoot")
    payload["leases"][key] = lease
    write_leases(mount_id, payload)


def release_lease(checkout: Path, mount_id: str, unmount_blob: UnmountFn) -> None:
    payload = read_leases(mount_id)
    key = checkout_id(checkout)
    payload.get("leases", {}).pop(key, None)
    write_leases(mount_id, payload)
    if live_lease_ids(mount_id):
        return
    record = read_shared_record(mount_id)
    mountpoint = Path(str((record or {}).get("mountpoint") or shared_mount_dir(mount_id) / "blobs"))
    unmount_blob(mountpoint)
    if record:
        record["status"] = "unmounted"
        record["updatedAt"] = utcnow()
        write_private_json(record_path(mount_id), record)
    remove_ossfs_config(shared_mount_dir(mount_id) / "ossfs.conf")


def refuse_legacy_checkout_mount(checkout: Path) -> None:
    legacy = checkout_state(checkout) / "blobs"
    if use_real_fuse() and is_mounted(legacy):
        fail("stop the leftover checkout-owned Blob mount before shared mode")


def refuse_live_shared_for_checkout_topology(gateway_origin: str) -> None:
    mount_id = authority_id(gateway_origin)
    record = read_shared_record(mount_id)
    if not record:
        return
    if live_lease_ids(mount_id) or (use_real_fuse() and is_mounted(Path(str(record.get("mountpoint") or "")))):
        fail("shared Blob mount is still live; stop shared consumers before checkout topology")


def record_operation(mount_id: str, op_class: str, digest: str, size_bytes: int) -> None:
    if op_class not in (BODY_TRANSFER, CACHE_HIT):
        fail("unsupported transfer operation class")
    if not SHA256.fullmatch(digest):
        fail("transfer digest is invalid")
    if not isinstance(size_bytes, int) or size_bytes < 0:
        fail("transfer size is invalid")
    row = {
        "schemaVersion": TRANSFER_SCHEMA,
        "at": utcnow(),
        "opClass": op_class,
        "sha256": digest,
        "sizeBytes": size_bytes,
    }
    assert_portable(row, "transfer operation")
    path = operations_path(mount_id)
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(path.parent, 0o700)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    try:
        os.write(descriptor, (json.dumps(row, sort_keys=True) + "\n").encode("utf-8"))
        os.fchmod(descriptor, 0o600)
    finally:
        os.close(descriptor)


def load_operations(mount_id: str) -> list[dict[str, Any]]:
    path = operations_path(mount_id)
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        rows.append(json.loads(line))
    return rows


def summarize_transfers(mount_id: str) -> dict[str, Any]:
    body: dict[str, int] = {}
    hits: dict[str, int] = {}
    for row in load_operations(mount_id):
        digest = row.get("sha256")
        if not isinstance(digest, str):
            continue
        if row.get("opClass") == BODY_TRANSFER:
            body[digest] = body.get(digest, 0) + 1
        elif row.get("opClass") == CACHE_HIT:
            hits[digest] = hits.get(digest, 0) + 1
    return {"bodyTransfers": body, "cacheHits": hits}


def parse_ossfs_log(text: str) -> list[dict[str, Any]]:
    operations: list[dict[str, Any]] = []
    for index, line in enumerate(text.splitlines(), start=1):
        if "Signature=" in line or "accessKey" in line.lower() or "LTAI" in line:
            continue
        if OSSFS_CACHE_HIT.search(line):
            operations.append({"opClass": CACHE_HIT, "line": index})
        elif OSSFS_GETOBJECT.search(line):
            operations.append({"opClass": BODY_TRANSFER, "line": index})
    return operations


def fixture_cache_object(mount_id: str, digest: str) -> Path:
    return ossfs_cache_dir(mount_id) / "objects" / digest


def read_blob_with_evidence(mount_id: str, digest: str, source: Path, fetch=None) -> bytes:
    if not SHA256.fullmatch(digest):
        fail("blob digest is invalid")
    cached = fixture_cache_object(mount_id, digest)
    if cached.is_file() and not cached.is_symlink():
        data = cached.read_bytes()
        verify_blob_bytes(data, digest)
        record_operation(mount_id, CACHE_HIT, digest, len(data))
        return data
    if fetch is not None:
        data = fetch(digest)
    else:
        data = source.read_bytes()
    verify_blob_bytes(data, digest)
    record_operation(mount_id, BODY_TRANSFER, digest, len(data))
    cached.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(cached.parent, 0o700)
    write_private_bytes(cached, data, 0o644)
    return data


def verify_blob_bytes(data: bytes, digest: str, size_bytes: int | None = None) -> None:
    if hashlib.sha256(data).hexdigest() != digest:
        fail("cached blob failed SHA-256 verification")
    if size_bytes is not None and len(data) != size_bytes:
        fail("cached blob failed size or SHA-256 verification")


def ossfs_log_text(mount_id: str) -> str:
    log_dir = persistent_cache_dir(mount_id) / "logs"
    if not log_dir.is_dir():
        return ""
    chunks: list[str] = []
    for path in sorted(log_dir.rglob("*")):
        if path.is_file() and not path.is_symlink():
            chunks.append(path.read_text(encoding="utf-8", errors="replace"))
    return "\n".join(chunks)


def count_log_body_transfers(text: str) -> int:
    return sum(1 for row in parse_ossfs_log(text) if row.get("opClass") == BODY_TRANSFER)


def quarantine_cache_entry(mount_id: str, digest: str) -> Path:
    if not SHA256.fullmatch(digest):
        fail("blob digest is invalid")
    source = fixture_cache_object(mount_id, digest)
    quarantine = persistent_cache_dir(mount_id) / "quarantine"
    ensure_private_dir(quarantine)
    target = quarantine / digest
    if source.exists() and source.is_file() and not source.is_symlink():
        os.replace(source, target)
    elif not target.exists():
        write_private_bytes(target, b"", 0o644)
    return target


def cache_usage_bytes(mount_id: str) -> int:
    root = persistent_cache_dir(mount_id)
    if not root.exists():
        return 0
    total = 0
    for path in root.rglob("*"):
        if path.is_file() and not path.is_symlink():
            total += path.stat().st_size
    return total


def portable_start_payload(selection: dict[str, Any]) -> dict[str, Any]:
    topology = selection.get("topology") or TOPOLOGY_CHECKOUT
    payload = {
        "cachePolicy": "on-demand" if topology == TOPOLOGY_SHARED else "none",
        "manifestSha256": selection["manifestSha256"],
        "ready": True,
        "releaseId": selection["releaseId"],
        "schemaVersion": selection["schemaVersion"],
        "sharedMountId": selection.get("sharedMountId"),
        "topology": topology,
        "treeSha256": selection["treeSha256"],
    }
    assert_portable(payload, "startup receipt")
    return payload


def shared_status(gateway_origin: str | None = None) -> dict[str, Any]:
    topology = topology_mode()
    payload: dict[str, Any] = {
        "cachePolicy": "on-demand" if topology == TOPOLOGY_SHARED else "none",
        "cacheSizeGiB": cache_size_gib() if topology == TOPOLOGY_SHARED else 0,
        "defaultCacheSizeGiB": DEFAULT_CACHE_SIZE_GIB,
        "minOssfs2": None,
        "adapter": "ecs-gateway",
        "topology": topology,
    }
    if gateway_origin:
        mount_id = authority_id(gateway_origin)
        record = read_shared_record(mount_id)
        payload["sharedMountId"] = mount_id
        payload["leaseCount"] = len(live_lease_ids(mount_id)) if record else 0
        payload["cacheUsageBytes"] = cache_usage_bytes(mount_id)
        payload["status"] = (record or {}).get("status") or "absent"
        payload["readOnly"] = True
    assert_portable(payload, "status")
    return payload
