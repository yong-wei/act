#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import re
import stat
from pathlib import Path
from typing import Any

EXPECTED_RAM_USER = "act-runtime-dev-read"
CREDENTIAL_SCHEMA = "act-runtime-dev-read-credential.v1"
SELECTION_SCHEMA = "act-runtime-dev-selection.v1"
PUBLIC_OSS_ENDPOINT = "https://oss-cn-hangzhou.aliyuncs.com"
OSS_BUCKET = "act-course-assets"
OSS_REGION = "cn-hangzhou"
DEFAULT_READYZ_URL = "https://act.adapt-learn.online/api/readyz"
BLOB_PREFIX = "runtime/blobs/sha256/"
RELEASE_PREFIX = "runtime/blob-releases/"
IDENTITY_KEYS = ("schemaVersion", "releaseId", "manifestSha256", "treeSha256")
READYZ_RUNTIME_KEYS = ("required", "ready", "identity")
SECRET_FIELD_NAMES = ("accessKeyId", "accessKeySecret", "AccessKeyId", "AccessKeySecret", "Secret")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
RELEASE_ID = re.compile(r"^runtime-[a-z0-9]{55}$")


class DeveloperRuntimeError(ValueError):
    pass


def fail(message: str) -> None:
    raise DeveloperRuntimeError(redact(message))


def redact(value: str) -> str:
    redacted = value
    for field in SECRET_FIELD_NAMES:
        redacted = re.sub(r"(?i)%s\s*[:=]\s*\S+" % re.escape(field), "%s=<redacted>" % field, redacted)
    redacted = re.sub(r"(?i)(LTAI)[A-Za-z0-9]+", r"\1<redacted>", redacted)
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
        return Path(configured) / "act-runtime-dev-read"
    return default / "act-runtime-dev-read"


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
