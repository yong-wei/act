#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import sys
from pathlib import Path
from typing import Any

EXPECTED_RAM_USER = "act-runtime-dev-read"
GATEWAY_PRINCIPAL = "act-runtime-developer-gateway"
CREDENTIAL_SCHEMA = "act-runtime-dev-gateway-credential.v1"
LEGACY_CREDENTIAL_SCHEMA = "act-runtime-dev-read-credential.v1"
SELECTION_SCHEMA = "act-runtime-dev-selection.v1"
SELECTION_SCHEMA_V2 = "act-runtime-dev-selection.v2"
SHARED_MOUNT_SCHEMA = "act-runtime-dev-shared-mount.v2"
LEASE_SCHEMA = "act-runtime-dev-shared-lease.v1"
TRANSFER_SCHEMA = "act-runtime-dev-transfer.v1"
GATEWAY_SESSION_SCHEMA = "act-runtime-dev-gateway-session.v1"
GATEWAY_ADAPTER_SCHEMA = "act-runtime-dev-gateway-adapter.v1"
PUBLIC_OSS_ENDPOINT = "https://oss-cn-hangzhou.aliyuncs.com"
OSS_PUBLIC_HOST = "oss-cn-hangzhou.aliyuncs.com"
OSS_INTERNAL_HOST = "oss-cn-hangzhou-internal.aliyuncs.com"
OSS_BUCKET = "act-course-assets"
OSS_REGION = "cn-hangzhou"
ENDPOINT_CLASS_GATEWAY = "ecs-gateway"
DEFAULT_READYZ_URL = "https://act.adapt-learn.online/api/readyz"
BLOB_PREFIX = "runtime/blobs/sha256/"
RELEASE_PREFIX = "runtime/blob-releases/"
IDENTITY_KEYS = ("schemaVersion", "releaseId", "manifestSha256", "treeSha256")
READYZ_RUNTIME_KEYS = ("required", "ready", "identity")
SECRET_FIELD_NAMES = (
    "accessKeyId", "accessKeySecret", "AccessKeyId", "AccessKeySecret", "Secret",
    "token", "Bearer", "transportToken",
)
STATE_DIR_NAME = "act-runtime-dev-gateway"
SHA256 = re.compile(r"^[a-f0-9]{64}$")
RELEASE_ID = re.compile(r"^runtime-[a-z0-9]{55}$")
TOPOLOGY_SHARED = "shared"
TOPOLOGY_CHECKOUT = "checkout"
DEFAULT_CACHE_SIZE_GIB = 8
MIN_OSSFS2_VERSION = (2, 0, 8)
SELECTION_V1_KEYS = (
    "schemaVersion", "releaseId", "manifestSha256", "treeSha256",
    "blobMount", "helperMount", "viewRoot", "runtimeRoot", "startedAt",
)
SELECTION_V2_KEYS = SELECTION_V1_KEYS + ("checkoutId", "sharedMountId", "topology")
ABSOLUTE_PATH_MARKERS = re.compile(r'(^|")/(Users|home|private|mnt|opt|var|root)/')


class DeveloperRuntimeError(ValueError):
    pass


def fail(message: str) -> None:
    raise DeveloperRuntimeError(redact(message))


def redact(value: str) -> str:
    redacted = value
    for field in SECRET_FIELD_NAMES:
        redacted = re.sub(r"(?i)%s\s*[:=]\s*\S+" % re.escape(field), "%s=<redacted>" % field, redacted)
    redacted = re.sub(r"(?i)(LTAI)[A-Za-z0-9]+", r"\1<redacted>", redacted)
    redacted = re.sub(r"(?i)(Bearer\s+)\S+", r"\1<redacted>", redacted)
    redacted = re.sub(r"(?i)(token\s*[:=]\s*)\S+", r"\1<redacted>", redacted)
    return redacted


def canonical(value: Any) -> bytes:
    return json.dumps(value, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")


def require_exact_keys(value: Any, keys: tuple[str, ...] | list[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        fail("%s must be an object" % label)
    actual = tuple(sorted(value.keys()))
    expected = tuple(sorted(keys))
    if actual != expected:
        fail("%s has unsupported or missing fields" % label)
    return value


def xdg_home(kind: str, default: Path) -> Path:
    override = os.environ.get("ACT_RUNTIME_DEV_%s_HOME" % kind.upper())
    if override:
        return Path(override)
    env_name = {"config": "XDG_CONFIG_HOME", "state": "XDG_STATE_HOME", "cache": "XDG_CACHE_HOME"}[kind]
    configured = os.environ.get(env_name)
    if configured:
        return Path(configured) / STATE_DIR_NAME
    return default / STATE_DIR_NAME


def config_root() -> Path:
    return xdg_home("config", Path.home() / ".config")


def state_root() -> Path:
    return xdg_home("state", Path.home() / ".local/state")


def cache_root() -> Path:
    return xdg_home("cache", Path.home() / ".cache")


def credential_path() -> Path:
    return config_root() / "credentials.json"


def checkout_id(checkout: Path) -> str:
    return hashlib.sha256(str(checkout.resolve()).encode("utf-8")).hexdigest()[:16]


def checkout_state(checkout: Path) -> Path:
    return state_root() / "checkouts" / checkout_id(checkout)


def digest_hex(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def topology_mode() -> str:
    raw = os.environ.get("ACT_RUNTIME_DEV_MOUNT_TOPOLOGY", TOPOLOGY_SHARED)
    if raw not in (TOPOLOGY_SHARED, TOPOLOGY_CHECKOUT):
        fail("unsupported mount topology")
    return raw


def cache_size_gib() -> int:
    raw = os.environ.get("ACT_RUNTIME_DEV_CACHE_SIZE_GIB", str(DEFAULT_CACHE_SIZE_GIB))
    try:
        size = int(raw)
    except (TypeError, ValueError):
        fail("cache size must be a positive integer GiB")
    if size < 1 or size > 1024:
        fail("cache size must be a positive integer GiB")
    return size


def use_real_fuse() -> bool:
    return os.environ.get("ACT_RUNTIME_DEV_ALLOW_NON_LINUX") != "1" and sys.platform == "linux"


def shared_state_root() -> Path:
    return state_root() / "shared"


def shared_lock_path() -> Path:
    return shared_state_root() / "mount.lock"


def authority_identity(gateway_origin: str) -> dict[str, str]:
    if not isinstance(gateway_origin, str) or "://" not in gateway_origin:
        fail("shared mount gateway origin is invalid")
    return {
        "schemaVersion": SHARED_MOUNT_SCHEMA,
        "adapterSchema": GATEWAY_ADAPTER_SCHEMA,
        "blobPrefix": BLOB_PREFIX,
        "endpointClass": ENDPOINT_CLASS_GATEWAY,
        "gatewayOrigin": gateway_origin,
        "principal": GATEWAY_PRINCIPAL,
    }


def options_digest() -> str:
    return digest_hex({
        "adapter": GATEWAY_ADAPTER_SCHEMA,
        "allow_other": True,
        "blobPrefix": BLOB_PREFIX,
        "cacheSizeGiB": cache_size_gib(),
        "dir_mode": "0755",
        "file_mode": "0644",
        "ro": True,
    })


def authority_id(gateway_origin: str) -> str:
    return digest_hex(authority_identity(gateway_origin))[:16]


def shared_mount_dir(mount_id: str) -> Path:
    return shared_state_root() / "mounts" / mount_id


def persistent_cache_dir(mount_id: str) -> Path:
    return cache_root() / "mounts" / mount_id


def ossfs_cache_dir(mount_id: str) -> Path:
    return persistent_cache_dir(mount_id) / "ossfs"


def checkout_pid_dir(checkout: Path) -> Path:
    return checkout / ".logs" / "pids"


def assert_portable(value: Any, label: str = "portable receipt") -> None:
    serialized = json.dumps(value, sort_keys=True)
    lowered = serialized.lower()
    if "accesskey" in lowered or "ltain" in lowered or "secret" in lowered or "signature=" in lowered:
        fail("%s must not contain credentials" % label)
    if "accessKey" in serialized or "LTAI" in serialized or "Signature=" in serialized:
        fail("%s must not contain credentials" % label)
    if ABSOLUTE_PATH_MARKERS.search(serialized):
        fail("%s must not contain absolute paths" % label)


def require_mode(path: Path, expected: int, label: str) -> None:
    details = path.lstat()
    if stat.S_ISLNK(details.st_mode):
        fail("%s must not be a symlink" % label)
    if stat.S_IMODE(details.st_mode) != expected:
        fail("%s must have mode %04o" % (label, expected))


def require_dir_mode(path: Path, expected: int, label: str) -> None:
    details = path.lstat()
    if not stat.S_ISDIR(details.st_mode) or stat.S_ISLNK(details.st_mode):
        fail("%s must be a real directory" % label)
    if stat.S_IMODE(details.st_mode) != expected:
        fail("%s must have mode %04o" % (label, expected))


def is_inside_repository(path: Path, checkout: Path) -> bool:
    try:
        path.resolve().relative_to(checkout.resolve())
        return True
    except ValueError:
        return False
