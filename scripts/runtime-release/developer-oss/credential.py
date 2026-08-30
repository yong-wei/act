#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import stat
import sys
from getpass import getpass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from common import (
    CREDENTIAL_SCHEMA,
    GATEWAY_PRINCIPAL,
    OSS_PUBLIC_HOST,
    OSS_INTERNAL_HOST,
    checkout_id,
    config_root,
    credential_path,
    fail,
    is_inside_repository,
    require_dir_mode,
    require_exact_keys,
    require_mode,
)

CREDENTIAL_KEYS = ("schemaVersion", "gatewayUrl", "token")
FORBIDDEN_CREDENTIAL_KEYS = {
    "accessKeyId", "accessKeySecret", "AccessKeyId", "AccessKeySecret",
    "accountId", "region", "sshKey", "privateKey", "roleArn", "publisher",
}


def gateway_origin(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"https", "http"} or not parsed.netloc:
        fail("gateway URL is invalid")
    host = (parsed.hostname or "").lower()
    if host in {OSS_PUBLIC_HOST, OSS_INTERNAL_HOST} or host.endswith(".aliyuncs.com"):
        fail("gateway URL must not be an OSS endpoint")
    if parsed.scheme != "https" and os.environ.get("ACT_RUNTIME_DEV_ALLOW_HTTP") != "1":
        fail("gateway URL must be HTTPS")
    return "%s://%s" % (parsed.scheme, parsed.netloc)


def parse_credential(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        fail("credential must be an object")
    forbidden = set(value) & FORBIDDEN_CREDENTIAL_KEYS
    if forbidden:
        fail("credential must not contain OSS, SSH or Publisher fields")
    raw = require_exact_keys(value, CREDENTIAL_KEYS, "credential")
    if raw["schemaVersion"] != CREDENTIAL_SCHEMA:
        fail("credential schema is unsupported")
    gateway_url = raw["gatewayUrl"]
    token = raw["token"]
    if not isinstance(gateway_url, str) or not gateway_url:
        fail("credential gatewayUrl is invalid")
    origin = gateway_origin(gateway_url)
    if not isinstance(token, str) or len(token) < 32 or " " in token:
        fail("credential token is invalid")
    lowered = token.lower()
    if lowered.startswith("ltai") or "accesskey" in lowered:
        fail("credential token must not be an OSS AccessKey")
    return {
        "schemaVersion": CREDENTIAL_SCHEMA,
        "gatewayUrl": gateway_url,
        "token": token,
        "origin": origin,
    }


def load_credential(checkout: Path) -> dict[str, str]:
    path = credential_path()
    if is_inside_repository(path, checkout):
        fail("credential path must stay outside the repository")
    parent = path.parent
    if not parent.exists():
        fail("credential directory is missing")
    require_dir_mode(parent, 0o700, "credential directory")
    if not path.exists():
        fail("credential file is missing")
    require_mode(path, 0o600, "credential file")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        fail("credential file is invalid")
    parsed = parse_credential(raw)
    parsed.pop("origin", None)
    # Keep origin derived at use site; stored file has only declared keys.
    return parse_credential(raw)


def install_credential(checkout: Path, values: dict[str, str] | None = None) -> Path:
    path = credential_path()
    if is_inside_repository(path, checkout):
        fail("refusing to store credentials inside the repository")
    parent = config_root()
    parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(parent, 0o700)
    require_dir_mode(parent, 0o700, "credential directory")
    if values is None:
        gateway_url = input("Gateway URL: ").strip()
        token = getpass("Gateway token: ")
        parsed = parse_credential({
            "schemaVersion": CREDENTIAL_SCHEMA,
            "gatewayUrl": gateway_url,
            "token": token,
        })
    else:
        parsed = parse_credential(values)
    stored = {
        "schemaVersion": parsed["schemaVersion"],
        "gatewayUrl": parsed["gatewayUrl"],
        "token": parsed["token"],
    }
    temporary = path.with_name(".credentials.%s.tmp" % checkout_id(checkout))
    payload = json.dumps(stored, indent=2, sort_keys=True) + "\n"
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
    descriptor = os.open(temporary, flags, 0o600)
    try:
        os.write(descriptor, payload.encode("utf-8"))
        os.fchmod(descriptor, 0o600)
    finally:
        os.close(descriptor)
    os.replace(temporary, path)
    os.chmod(path, 0o600)
    require_mode(path, 0o600, "credential file")
    sys.stderr.write("credential installed for %s\n" % GATEWAY_PRINCIPAL)
    return path
