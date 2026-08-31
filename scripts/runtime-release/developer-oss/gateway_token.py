#!/usr/bin/env python3
"""Operator install and rotate for the shared developer gateway token (mode 0600)."""

from __future__ import annotations

import os
import stat
from pathlib import Path


def fail(message: str) -> None:
    raise ValueError(message)


def require_mode(path: Path, expected: int, label: str) -> None:
    details = path.lstat()
    if stat.S_ISLNK(details.st_mode):
        fail("%s must not be a symlink" % label)
    if stat.S_IMODE(details.st_mode) != expected:
        fail("%s must have mode %04o" % (label, expected))


def _require_gateway_token(token: str) -> str:
    if len(token) < 32 or "\n" in token or " " in token:
        fail("gateway token is invalid")
    lowered = token.lower()
    if "ltain" in lowered or lowered.startswith("ltai") or "accesskey" in lowered:
        fail("gateway token must not be an OSS AccessKey")
    return token


def read_token_file(path: Path) -> str:
    if not path.exists():
        fail("gateway token file is missing")
    require_mode(path, 0o600, "gateway token file")
    return _require_gateway_token(path.read_text(encoding="utf-8").strip())


def install_token_file(path: Path, token: str) -> Path:
    token = _require_gateway_token(token)
    parent = path.parent
    parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(parent, 0o700)
    details = parent.lstat()
    if not stat.S_ISDIR(details.st_mode) or stat.S_ISLNK(details.st_mode):
        fail("gateway token directory must be a real directory")
    if stat.S_IMODE(details.st_mode) != 0o700:
        fail("gateway token directory must have mode 0700")
    temporary = path.with_name(".%s.%s.tmp" % (path.name, os.getpid()))
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.write(descriptor, (token + "\n").encode("utf-8"))
        os.fchmod(descriptor, 0o600)
    finally:
        os.close(descriptor)
    os.replace(temporary, path)
    os.chmod(path, 0o600)
    require_mode(path, 0o600, "gateway token file")
    return path
