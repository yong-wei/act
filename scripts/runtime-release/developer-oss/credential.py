#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import stat
import sys
from getpass import getpass
from pathlib import Path
from typing import Any

from common import (
    CREDENTIAL_SCHEMA,
    EXPECTED_RAM_USER,
    OSS_REGION,
    checkout_id,
    config_root,
    credential_path,
    fail,
    is_inside_repository,
    require_dir_mode,
    require_exact_keys,
    require_mode,
)

CREDENTIAL_KEYS = ("schemaVersion", "accountId", "accessKeyId", "accessKeySecret", "region")


def parse_credential(value: Any) -> dict[str, str]:
    raw = require_exact_keys(value, CREDENTIAL_KEYS, "credential")
    schema = raw["schemaVersion"]
    account_id = raw["accountId"]
    access_key_id = raw["accessKeyId"]
    access_key_secret = raw["accessKeySecret"]
    region = raw["region"]
    if schema != CREDENTIAL_SCHEMA:
        fail("credential schema is unsupported")
    if not isinstance(account_id, str) or not account_id.isdigit() or len(account_id) < 12:
        fail("credential accountId is invalid")
    if not isinstance(access_key_id, str) or not access_key_id or " " in access_key_id:
        fail("credential accessKeyId is invalid")
    if not isinstance(access_key_secret, str) or len(access_key_secret) < 16:
        fail("credential accessKeySecret is invalid")
    if region != OSS_REGION:
        fail("credential region must be cn-hangzhou")
    return {
        "schemaVersion": CREDENTIAL_SCHEMA,
        "accountId": account_id,
        "accessKeyId": access_key_id,
        "accessKeySecret": access_key_secret,
        "region": region,
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
        account_id = input("RAM account ID: ").strip()
        access_key_id = input("AccessKey ID: ").strip()
        access_key_secret = getpass("AccessKey Secret: ")
        values = parse_credential({
            "schemaVersion": CREDENTIAL_SCHEMA,
            "accountId": account_id,
            "accessKeyId": access_key_id,
            "accessKeySecret": access_key_secret,
            "region": OSS_REGION,
        })
    else:
        values = parse_credential(values)
    temporary = path.with_name(".credentials.%s.tmp" % checkout_id(checkout))
    payload = json.dumps(values, indent=2, sort_keys=True) + "\n"
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
    sys.stderr.write("credential installed for %s\n" % EXPECTED_RAM_USER)
    return path


def expected_arn(account_id: str) -> str:
    return "acs:ram::%s:user/%s" % (account_id, EXPECTED_RAM_USER)


def assert_developer_principal(identity: dict[str, Any], credential: dict[str, str]) -> None:
    if not isinstance(identity, dict):
        fail("caller identity must be an object")
    extra = set(identity) - {"AccountId", "Arn", "UserId"}
    missing = {"AccountId", "Arn", "UserId"} - set(identity)
    if extra or missing:
        fail("caller identity has unsupported or missing fields")
    account_id = identity["AccountId"]
    arn = identity["Arn"]
    if account_id != credential["accountId"]:
        fail("caller identity account does not match the installed credential")
    if arn != expected_arn(credential["accountId"]):
        fail("caller identity is not the dedicated developer reader")
    lowered = str(arn).lower()
    if "publisher" in lowered or ":role/" in lowered or "operator" in lowered:
        fail("caller identity is not the dedicated developer reader")
