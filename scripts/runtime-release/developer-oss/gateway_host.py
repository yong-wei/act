#!/usr/bin/env python3
"""In-memory and disk host views used by the developer runtime gateway."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Mapping

from gateway_service import SHA256, GatewayError, DENIED_BODY, require_identity


class MemoryHost:
    def __init__(self) -> None:
        self._active: dict[str, str] | None = None
        self._manifests: dict[str, bytes] = {}
        self._receipts: dict[str, bytes] = {}
        self._blobs: dict[str, bytes] = {}
        self.blob_reads: list[str] = []

    def set_active(self, identity: Mapping[str, str]) -> None:
        self._active = require_identity(dict(identity))

    def put_manifest(self, identity: Mapping[str, str], payload: bytes) -> None:
        self._manifests[identity["manifestSha256"]] = payload

    def put_receipt(self, identity: Mapping[str, str], payload: bytes) -> None:
        self._receipts[identity["manifestSha256"]] = payload

    def put_blob(self, digest: str, payload: bytes) -> None:
        if hashlib.sha256(payload).hexdigest() != digest:
            raise ValueError("fixture blob digest mismatch")
        self._blobs[digest] = payload

    def active_identity(self) -> dict[str, str]:
        if self._active is None:
            raise GatewayError(409, "denied", DENIED_BODY)
        return dict(self._active)

    def manifest_bytes(self, identity: Mapping[str, str]) -> bytes | None:
        return self._manifests.get(identity["manifestSha256"])

    def receipt_bytes(self, identity: Mapping[str, str]) -> bytes | None:
        return self._receipts.get(identity["manifestSha256"])

    def blob_bytes(self, digest: str) -> bytes | None:
        self.blob_reads.append(digest)
        return self._blobs.get(digest)


def load_active_identity(receipt_path: Path) -> dict[str, str]:
    raw = json.loads(receipt_path.read_text(encoding="utf-8"))
    selection = raw.get("selection") if isinstance(raw, dict) else None
    if not isinstance(selection, dict):
        raise GatewayError(409, "denied", DENIED_BODY)
    identity = {
        "schemaVersion": "act-runtime-release.v2",
        "releaseId": selection.get("releaseId"),
        "manifestSha256": selection.get("manifestSha256"),
        "treeSha256": selection.get("treeSha256"),
    }
    return require_identity(identity)


class DiskHost:
    """Reads ECS-local active receipt, materialized v2 manifest, and ossfs Blob files."""

    def __init__(self, receipt_path: Path, view_root: Path, blob_root: Path) -> None:
        self.receipt_path = receipt_path
        self.view_root = view_root
        self.blob_root = blob_root

    def active_identity(self) -> dict[str, str]:
        return load_active_identity(self.receipt_path)

    def _view_dir(self, identity: Mapping[str, str]) -> Path:
        current = self.view_root / "current"
        pinned = self.view_root / "views" / identity["releaseId"]
        for candidate in (pinned, current):
            manifest = candidate / ".act-runtime-release.v2.json"
            if manifest.is_file() and not manifest.is_symlink():
                try:
                    payload = json.loads(manifest.read_text(encoding="utf-8"))
                except (OSError, UnicodeDecodeError, json.JSONDecodeError):
                    continue
                if (
                    payload.get("releaseId") == identity["releaseId"]
                    and payload.get("manifestSha256") == identity["manifestSha256"]
                    and payload.get("treeSha256") == identity["treeSha256"]
                ):
                    return candidate
        raise GatewayError(409, "denied", DENIED_BODY)

    def manifest_bytes(self, identity: Mapping[str, str]) -> bytes | None:
        path = self._view_dir(identity) / ".act-runtime-release.v2.json"
        if not path.is_file() or path.is_symlink():
            return None
        return path.read_bytes()

    def receipt_bytes(self, identity: Mapping[str, str]) -> bytes | None:
        path = self._view_dir(identity) / ".act-runtime-release-receipt.v2.json"
        if not path.is_file() or path.is_symlink():
            return None
        return path.read_bytes()

    def blob_bytes(self, digest: str) -> bytes | None:
        if not SHA256.fullmatch(digest):
            return None
        path = self.blob_root / digest
        if not path.is_file() or path.is_symlink():
            return None
        return path.read_bytes()
