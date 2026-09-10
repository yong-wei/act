#!/usr/bin/env python3
"""Build a host view from an immutable v2 manifest without rehashing blobs."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Any


SCHEMA_VERSION = "act-runtime-release.v2"
RECEIPT_SCHEMA_VERSION = "act-runtime-release-receipt.v2"
MATERIALIZATION_SCHEMA = "runtime-blob-materialization.v1"
MATERIALIZED_MANIFEST = ".act-runtime-release.v2.json"
MATERIALIZATION_RECEIPT = ".act-runtime-release-materialization.v1.json"
HELPER_NAME = ".act-runtime-blobs"
LOCAL_MANIFEST = MATERIALIZED_MANIFEST
RELEASE_ID_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
GIT_REVISION_PATTERN = re.compile(r"^[0-9a-f]{40}$")
RESERVED_VIEW_NAMES = {
    MATERIALIZED_MANIFEST,
    MATERIALIZATION_RECEIPT,
    HELPER_NAME,
    ".act-runtime-release-receipt.v2.json",
}


class MaterializeError(RuntimeError):
    def __init__(self, message: str, *, code: int = 2) -> None:
        super().__init__(message)
        self.code = code


def stable_stringify(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    if isinstance(value, list):
        return "[" + ",".join(stable_stringify(item) for item in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value.keys())
        return "{" + ",".join(f"{json.dumps(key, ensure_ascii=False)}:{stable_stringify(value[key])}" for key in keys) + "}"
    raise MaterializeError(f"cannot canonicalize {type(value).__name__}")


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalized_relative_path(value: object) -> str:
    if not isinstance(value, str) or "\\" in value or value.startswith("/") or not value:
        raise MaterializeError(f"invalid runtime path: {value}")
    parts = value.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise MaterializeError(f"invalid runtime path: {value}")
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise MaterializeError(f"invalid runtime path: {value}")
    if parts[0] in RESERVED_VIEW_NAMES:
        raise MaterializeError(f"reserved materialized path: {value}")
    return value


def require_int(value: object, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise MaterializeError(f"{label} must be a non-negative integer")
    return value


def require_sha256(value: object, label: str) -> str:
    if not isinstance(value, str) or not SHA256_PATTERN.fullmatch(value):
        raise MaterializeError(f"{label} must be a SHA-256 digest")
    return value


def canonical_file_entry(item: object) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise MaterializeError("manifest.files entries must be objects")
    relative = normalized_relative_path(item.get("path"))
    digest = require_sha256(item.get("sha256"), f"{relative}.sha256")
    size = require_int(item.get("sizeBytes"), f"{relative}.sizeBytes")
    object_key = item.get("objectKey")
    expected_key = f"runtime/blobs/sha256/{digest}"
    if object_key != expected_key:
        raise MaterializeError(f"blob key is not derived from file SHA-256: {relative}")
    return {"path": relative, "objectKey": expected_key, "sizeBytes": size, "sha256": digest}


def validate_manifest(raw: object) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise MaterializeError("manifest must be a JSON object")
    if raw.get("schemaVersion") != SCHEMA_VERSION:
        raise MaterializeError("unsupported runtime blob release manifest version")
    files = raw.get("files")
    if not isinstance(files, list) or not files:
        raise MaterializeError("manifest.files must be a non-empty array")
    entries = [canonical_file_entry(item) for item in files]
    paths = [item["path"] for item in entries]
    if len(set(paths)) != len(paths):
        raise MaterializeError("manifest contains duplicate runtime paths")
    source_revision = raw.get("sourceRevision")
    if not isinstance(source_revision, str) or not GIT_REVISION_PATTERN.fullmatch(source_revision):
        raise MaterializeError("sourceRevision must be a 40-character Git SHA")
    tree_sha256 = sha256_text(stable_stringify([{"path": item["path"], "sizeBytes": item["sizeBytes"], "sha256": item["sha256"]} for item in entries]))
    release_id = f"runtime-{sha256_text(stable_stringify({'sourceRevision': source_revision, 'treeSha256': tree_sha256}))[:55]}"
    if not RELEASE_ID_PATTERN.fullmatch(release_id):
        raise MaterializeError("derived release id is invalid")
    file_count = require_int(raw.get("fileCount"), "fileCount")
    total_bytes = require_int(raw.get("totalBytes"), "totalBytes")
    if file_count != len(entries):
        raise MaterializeError("manifest fileCount does not match files")
    if total_bytes != sum(item["sizeBytes"] for item in entries):
        raise MaterializeError("manifest totalBytes does not match files")
    if raw.get("treeSha256") != tree_sha256:
        raise MaterializeError("manifest treeSha256 does not match canonical file bindings")
    if raw.get("releaseId") != release_id:
        raise MaterializeError("manifest releaseId does not match canonical file bindings")
    without_digest = {
        "schemaVersion": SCHEMA_VERSION,
        "releaseId": release_id,
        "sourceRevision": source_revision,
        "fileCount": file_count,
        "totalBytes": total_bytes,
        "treeSha256": tree_sha256,
        "files": entries,
    }
    if raw.get("manifestSha256") != sha256_text(stable_stringify(without_digest)):
        raise MaterializeError("manifestSha256 does not match canonical file bindings")
    return raw


def load_manifest(path: Path) -> dict[str, Any]:
    manifest, _wire = parse_manifest(path)
    return manifest


def parse_manifest(path: Path) -> tuple[dict[str, Any], bytes]:
    try:
        wire = path.read_bytes()
        raw = json.loads(wire)
    except (OSError, json.JSONDecodeError) as error:
        raise MaterializeError(f"manifest is not readable: {path}") from error
    return validate_manifest(raw), wire


def parse_receipt(path: Path, manifest: dict[str, Any], wire: bytes) -> dict[str, Any]:
    try:
        receipt = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise MaterializeError(f"receipt is not readable: {path}") from error
    if receipt.get("schemaVersion") != RECEIPT_SCHEMA_VERSION:
        raise MaterializeError("unsupported runtime blob release receipt version")
    if receipt.get("manifestSha256") != manifest.get("manifestSha256"):
        raise MaterializeError("receipt manifestSha256 does not match the manifest")
    if receipt.get("treeSha256") != manifest.get("treeSha256"):
        raise MaterializeError("receipt treeSha256 does not match the manifest")
    return receipt


def report_active(view_root: Path) -> dict[str, str]:
    current = view_root / "current"
    if not current.is_symlink():
        raise MaterializeError("no materialized runtime is selected")
    target = os.readlink(current)
    if not target.startswith("views/") or not RELEASE_ID_PATTERN.fullmatch(target.split("/", 1)[1]):
        raise MaterializeError("materialized current pointer is invalid")
    release_id = target.split("/", 1)[1]
    view = (view_root / target).resolve()
    if not view.is_dir():
        raise MaterializeError("selected view is missing")
    return {"activeReleaseId": release_id, "viewPath": str(view)}


def blob_path(store: Path, digest: str) -> Path:
    return store / "runtime" / "blobs" / "sha256" / digest


def manifest_path(store: Path, release_id: str) -> Path:
    return store / "runtime" / "blob-releases" / release_id / "manifest.json"


def file_bindings(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    bindings: dict[str, dict[str, Any]] = {}
    for item in manifest["files"]:
        bindings[item["path"]] = item
    return bindings


def changed_paths(current: dict[str, Any] | None, candidate: dict[str, Any]) -> list[str]:
    if current is None:
        return [item["path"] for item in candidate["files"]]
    before = file_bindings(current)
    after = file_bindings(candidate)
    changed = []
    for path, item in after.items():
        previous = before.get(path)
        if previous is None or previous.get("sha256") != item.get("sha256") or previous.get("sizeBytes") != item.get("sizeBytes"):
            changed.append(path)
    return changed


def assert_blobs_visible(store: Path, manifest: dict[str, Any], paths: list[str]) -> None:
    bindings = file_bindings(manifest)
    for relative in paths:
        item = bindings[relative]
        blob = blob_path(store, item["sha256"])
        try:
            size = blob.stat().st_size
        except OSError as error:
            raise MaterializeError(f"delta blob is not visible: {item['objectKey']}") from error
        if size != item["sizeBytes"]:
            raise MaterializeError(f"delta blob size mismatch: {item['objectKey']}")


def resolve_view_destination(view: Path, relative: str) -> Path:
    view_root = view.resolve()
    destination = (view / relative).resolve()
    try:
        destination.relative_to(view_root)
    except ValueError as error:
        raise MaterializeError(f"unsafe materialized path: {relative}") from error
    return destination


def link_or_copy(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() or destination.is_symlink():
        destination.unlink()
    try:
        os.link(source, destination)
    except OSError:
        shutil.copyfile(source, destination, follow_symlinks=False)


def write_materialization_artifacts(view: Path, manifest: dict[str, Any]) -> None:
    (view / MATERIALIZED_MANIFEST).write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    receipt = {
        "schemaVersion": MATERIALIZATION_SCHEMA,
        "releaseId": manifest["releaseId"],
        "manifestSha256": manifest["manifestSha256"],
        "treeSha256": manifest["treeSha256"],
        "fileCount": manifest["fileCount"],
        "totalBytes": manifest["totalBytes"],
    }
    (view / MATERIALIZATION_RECEIPT).write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    helper = view / HELPER_NAME
    if helper.is_symlink() or helper.is_file():
        helper.unlink()
    helper.mkdir(parents=True, exist_ok=True)


def view_matches_manifest(view: Path, manifest: dict[str, Any]) -> bool:
    marker = view / MATERIALIZED_MANIFEST
    receipt = view / MATERIALIZATION_RECEIPT
    helper = view / HELPER_NAME
    if not view.is_dir() or not marker.is_file() or not receipt.is_file():
        return False
    if not helper.is_dir() or helper.is_symlink():
        return False
    existing = json.loads(marker.read_text(encoding="utf-8"))
    return existing.get("releaseId") == manifest["releaseId"] and existing.get("manifestSha256") == manifest["manifestSha256"]


def materialize_view(store: Path, manifest: dict[str, Any], view: Path) -> Path:
    validate_manifest(manifest)
    if view_matches_manifest(view, manifest):
        return view
    view.mkdir(parents=True, exist_ok=True)
    for item in manifest["files"]:
        source = blob_path(store, item["sha256"])
        if not source.is_file():
            raise MaterializeError(f"blob is not visible: {item['objectKey']}")
        link_or_copy(source, resolve_view_destination(view, item["path"]))
    write_materialization_artifacts(view, manifest)
    return view


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Materialize a runtime view from a v2 blob manifest.")
    parser.add_argument("--store-dir", required=True)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--view", required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv and argv[0] == "active":
        parser = argparse.ArgumentParser(description="Report the selected view pointer.")
        parser.add_argument("--view-root", required=True)
        args = parser.parse_args(argv[1:])
        try:
            sys.stdout.write(json.dumps(report_active(Path(args.view_root)), separators=(",", ":")) + "\n")
        except MaterializeError as error:
            sys.stderr.write(f"{error}\n")
            return error.code
        return 0
    args = build_parser().parse_args(argv)
    store = Path(args.store_dir)
    try:
        manifest = load_manifest(manifest_path(store, args.release_id))
        if manifest["releaseId"] != args.release_id:
            raise MaterializeError("manifest releaseId does not match --release-id")
        materialize_view(store, manifest, Path(args.view))
    except MaterializeError as error:
        sys.stderr.write(f"{error}\n")
        return error.code
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
