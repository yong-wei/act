#!/usr/bin/env python3
"""In-memory and disk host views used by the developer runtime gateway."""

from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from typing import Any, Mapping

from gateway_service import SHA256, GatewayError, DENIED_BODY, require_identity

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import runtime_media_storage as MEDIA
spec = importlib.util.spec_from_file_location('gateway_materializer', str(Path(__file__).resolve().parents[1] / 'materialize-runtime.py'))
MATERIALIZE = importlib.util.module_from_spec(spec)
spec.loader.exec_module(MATERIALIZE)


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


class DiskHost:
    """Follow current for new leases; retain pinned manifests for existing leases."""

    def __init__(self, view_root: Path, blob_root: Path, media_root: Path | None = None, media_directory: Path | None = None) -> None:
        self.view_root = view_root
        self.blob_root = blob_root
        self.media_root = media_root or view_root.parent / 'ossfs' / 'public-media'
        self.media_directory = media_directory or MEDIA.catalog_path(view_root)

    def storage_lock(self):
        return MATERIALIZE.selection_lock(self.view_root)

    def active_identity(self) -> dict[str, str]:
        manifest = self.view_root / "current" / ".act-runtime-release.v2.json"
        raw = json.loads(manifest.read_bytes())
        return require_identity({key: raw.get(key) for key in ("schemaVersion", "releaseId", "manifestSha256", "treeSha256")})

    def _view_dir(self, identity: Mapping[str, str]) -> Path:
        current = self.view_root / "current"
        pinned = self.view_root / "views" / identity["releaseId"]
        for candidate in (pinned, self.view_root / identity['releaseId'], current):
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

    def blob_bytes(self, digest: str) -> bytes | None:
        if not SHA256.fullmatch(digest):
            return None
        try:
            catalog, canonical = MEDIA.load_catalog(self.media_directory)
            location = MEDIA.object_map(catalog).get(digest) if canonical else None
            path = MEDIA.public_blob_path(None, digest, location, self.media_root) if location else self.blob_root / digest
            if not path.is_file() or path.is_symlink():
                return None
            payload = path.read_bytes()
            if location and (len(payload) != location['sizeBytes'] or hashlib.sha256(payload).hexdigest() != digest):
                return None
            return payload
        except (MEDIA.MediaStorageError, OSError, ValueError):
            return None
