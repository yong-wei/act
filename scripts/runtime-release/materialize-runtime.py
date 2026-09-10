#!/usr/bin/env python3
"""Build a host view from an immutable v2 manifest without rehashing blobs."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any


SCHEMA_VERSION = "act-runtime-release.v2"
RECEIPT_SCHEMA_VERSION = "act-runtime-release-receipt.v2"
MATERIALIZED_MANIFEST = ".act-runtime-release.v2.json"
LOCAL_MANIFEST = MATERIALIZED_MANIFEST
RELEASE_ID_PATTERN = __import__("re").compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")


class MaterializeError(RuntimeError):
    def __init__(self, message: str, *, code: int = 2) -> None:
        super().__init__(message)
        self.code = code


def load_manifest(path: Path) -> dict[str, Any]:
    manifest, _wire = parse_manifest(path)
    return manifest


def parse_manifest(path: Path) -> tuple[dict[str, Any], bytes]:
    try:
        wire = path.read_bytes()
        raw = json.loads(wire)
    except (OSError, json.JSONDecodeError) as error:
        raise MaterializeError(f"manifest is not readable: {path}") from error
    if raw.get("schemaVersion") != SCHEMA_VERSION:
        raise MaterializeError("unsupported runtime blob release manifest version")
    files = raw.get("files")
    if not isinstance(files, list) or not files:
        raise MaterializeError("manifest.files must be a non-empty array")
    return raw, wire


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


def link_or_copy(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() or destination.is_symlink():
        destination.unlink()
    try:
        os.link(source, destination)
    except OSError:
        shutil.copyfile(source, destination, follow_symlinks=False)


def materialize_view(store: Path, manifest: dict[str, Any], view: Path) -> Path:
    marker = view / MATERIALIZED_MANIFEST
    if view.is_dir() and marker.is_file():
        existing = json.loads(marker.read_text(encoding="utf-8"))
        if existing.get("releaseId") == manifest["releaseId"] and existing.get("manifestSha256") == manifest["manifestSha256"]:
            return view
    view.mkdir(parents=True, exist_ok=True)
    for item in manifest["files"]:
        source = blob_path(store, item["sha256"])
        if not source.is_file():
            raise MaterializeError(f"blob is not visible: {item['objectKey']}")
        link_or_copy(source, view / item["path"])
    marker.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
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
