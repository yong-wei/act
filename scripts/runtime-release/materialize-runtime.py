#!/usr/bin/env python3
"""Build a host view from an immutable v2 manifest without rehashing blobs."""

import argparse
import fcntl
import hashlib
import json
import os
import re
import shutil
import sys
from pathlib import Path


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
OBJECT_ID_PATTERN = re.compile(r"^(?:[0-9a-f]{40}|[0-9a-f]{64})$")
EXTERNAL_INPUT_ID_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$")
POINTER_NAMES = ("current", "live", "previous", "views")
RESERVED_VIEW_NAMES = {
    MATERIALIZED_MANIFEST,
    MATERIALIZATION_RECEIPT,
    HELPER_NAME,
    ".act-runtime-release-receipt.v2.json",
}


class MaterializeError(RuntimeError):
    def __init__(self, message, code=2):
        super(MaterializeError, self).__init__(message)
        self.code = code


def stable_stringify(value):
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
    raise MaterializeError("cannot canonicalize %s" % type(value).__name__)


def sha256_text(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalized_relative_path(value):
    if not isinstance(value, str) or "\\" in value or value.startswith("/") or not value:
        raise MaterializeError("invalid runtime path: %s" % value)
    parts = value.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise MaterializeError("invalid runtime path: %s" % value)
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise MaterializeError("invalid runtime path: %s" % value)
    if parts[0] in RESERVED_VIEW_NAMES:
        raise MaterializeError("reserved materialized path: %s" % value)
    return value


def require_int(value, label):
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise MaterializeError("%s must be a non-negative integer" % label)
    return value


def require_sha256(value, label):
    if not isinstance(value, str) or not SHA256_PATTERN.fullmatch(value):
        raise MaterializeError("%s must be a SHA-256 digest" % label)
    return value


def require_hex_object_id(value, label):
    if not isinstance(value, str) or not OBJECT_ID_PATTERN.fullmatch(value.lower()):
        raise MaterializeError("%s is invalid" % label)
    return value.lower()


def canonical_source(value, label):
    if not isinstance(value, dict):
        raise MaterializeError("%s must be an object" % label)
    keys = set(value.keys())
    if "gitObjectId" in value:
        if keys != {"gitObjectId"}:
            raise MaterializeError("%s has unsupported fields" % label)
        return {"gitObjectId": require_hex_object_id(value.get("gitObjectId"), "%s.gitObjectId" % label)}
    if "bundleSemanticSha256" in value or "bundleWireSha256" in value:
        expected = {"externalInputId", "externalInputManifestObjectId", "bundleSemanticSha256", "bundleWireSha256"}
        if keys != expected:
            raise MaterializeError("%s has unsupported fields" % label)
        input_id = value.get("externalInputId")
        if not isinstance(input_id, str) or not EXTERNAL_INPUT_ID_PATTERN.fullmatch(input_id):
            raise MaterializeError("%s.externalInputId is invalid" % label)
        return {
            "externalInputId": input_id,
            "externalInputManifestObjectId": require_hex_object_id(
                value.get("externalInputManifestObjectId"),
                "%s.externalInputManifestObjectId" % label,
            ),
            "bundleSemanticSha256": require_sha256(value.get("bundleSemanticSha256"), "%s.bundleSemanticSha256" % label),
            "bundleWireSha256": require_sha256(value.get("bundleWireSha256"), "%s.bundleWireSha256" % label),
        }
    if keys != {"externalInputId", "externalInputManifestObjectId"}:
        raise MaterializeError("%s has unsupported fields" % label)
    input_id = value.get("externalInputId")
    if not isinstance(input_id, str) or not EXTERNAL_INPUT_ID_PATTERN.fullmatch(input_id):
        raise MaterializeError("%s.externalInputId is invalid" % label)
    return {
        "externalInputId": input_id,
        "externalInputManifestObjectId": require_hex_object_id(
            value.get("externalInputManifestObjectId"),
            "%s.externalInputManifestObjectId" % label,
        ),
    }


def canonical_file_entry(item):
    if not isinstance(item, dict):
        raise MaterializeError("manifest.files entries must be objects")
    allowed = {"path", "objectKey", "sizeBytes", "sha256"}
    if "source" in item:
        allowed.add("source")
    if set(item.keys()) - allowed:
        raise MaterializeError("manifest.files entry has unsupported fields")
    relative = normalized_relative_path(item.get("path"))
    digest = require_sha256(item.get("sha256"), "%s.sha256" % relative)
    size = require_int(item.get("sizeBytes"), "%s.sizeBytes" % relative)
    object_key = item.get("objectKey")
    expected_key = "runtime/blobs/sha256/%s" % digest
    if object_key != expected_key:
        raise MaterializeError("blob key is not derived from file SHA-256: %s" % relative)
    entry = {"path": relative, "objectKey": expected_key, "sizeBytes": size, "sha256": digest}
    if "source" in item:
        entry["source"] = canonical_source(item.get("source"), "%s.source" % relative)
    return entry


def validate_manifest(raw):
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
    release_id = "runtime-%s" % sha256_text(stable_stringify({"sourceRevision": source_revision, "treeSha256": tree_sha256}))[:55]
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


def load_manifest(path):
    manifest, _wire = parse_manifest(path)
    return manifest


def parse_manifest(path):
    try:
        wire = path.read_bytes()
        raw = json.loads(wire)
    except (OSError, json.JSONDecodeError) as error:
        raise MaterializeError("manifest is not readable: %s" % path)
    return validate_manifest(raw), wire


def parse_receipt(path, manifest, wire):
    try:
        receipt = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise MaterializeError("receipt is not readable: %s" % path)
    if receipt.get("schemaVersion") != RECEIPT_SCHEMA_VERSION:
        raise MaterializeError("unsupported runtime blob release receipt version")
    if receipt.get("manifestSha256") != manifest.get("manifestSha256"):
        raise MaterializeError("receipt manifestSha256 does not match the manifest")
    if receipt.get("treeSha256") != manifest.get("treeSha256"):
        raise MaterializeError("receipt treeSha256 does not match the manifest")
    return receipt


def existing_view(state_dir, release_id):
    if not release_id:
        return None
    candidates = (state_dir / "views" / release_id, state_dir / release_id)
    for path in candidates:
        if path.is_dir() and not path.is_symlink():
            return path
    return None


def release_id_from_symlink(state_dir, name):
    link = state_dir / name
    if not link.exists() and not link.is_symlink():
        return None
    if not link.is_symlink():
        raise MaterializeError("%s pointer must be a symlink to a runtime view" % name)
    raw = os.readlink(str(link))
    target = Path(raw)
    if not target.is_absolute():
        target = state_dir / target
    release_id = target.name
    if release_id in RESERVED_VIEW_NAMES or release_id in POINTER_NAMES:
        raise MaterializeError("%s pointer does not name a runtime release" % name)
    if not RELEASE_ID_PATTERN.fullmatch(release_id):
        raise MaterializeError("%s pointer does not name a runtime release" % name)
    return release_id


def legacy_selection_release_id(state_dir):
    candidates = (state_dir / "act-runtime-selection.json", state_dir.parent / "act-runtime-selection.json")
    for path in candidates:
        if not path.is_file():
            continue
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            raise MaterializeError("legacy runtime selection is unreadable")
        if not isinstance(raw, dict):
            raise MaterializeError("legacy runtime selection is invalid")
        if raw.get("schemaVersion") == "runtime-release-active-receipt.v1":
            raw = raw.get("selection") or {}
        if not isinstance(raw, dict):
            raise MaterializeError("legacy runtime selection is invalid")
        release_id = raw.get("releaseId")
        if not isinstance(release_id, str) or not RELEASE_ID_PATTERN.fullmatch(release_id):
            raise MaterializeError("legacy runtime selection does not name a runtime release")
        return release_id
    return None


def read_recorded_pointers(state_dir):
    path = state_dir / "pointers.json"
    if not path.is_file():
        return None
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {"current": raw.get("current"), "previous": raw.get("previous")}


def read_host_pointers(state_dir):
    recorded = read_recorded_pointers(state_dir)
    current = release_id_from_symlink(state_dir, "current")
    previous = release_id_from_symlink(state_dir, "previous")
    selected = legacy_selection_release_id(state_dir)
    if selected and current and selected != current:
        raise MaterializeError("legacy runtime selection does not match the current view")
    if current is None and selected:
        if existing_view(state_dir, selected) is None:
            raise MaterializeError("legacy runtime selection does not name a materialized current view")
        current = selected
    if current is None and recorded:
        return recorded
    if current and previous is None and recorded and recorded.get("current") == current:
        previous = recorded.get("previous")
    return {"current": current, "previous": previous}


def selection_lock_path(state_dir):
    override = os.environ.get("ACT_RUNTIME_SELECTION_LOCK")
    if override:
        return Path(override)
    if state_dir.name == "blob-views":
        return state_dir.parent / ".act-runtime-selection.lock"
    return state_dir / ".act-runtime-selection.lock"


class selection_lock(object):
    def __init__(self, state_dir):
        self.path = selection_lock_path(state_dir)
        self.handle = None

    def __enter__(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.handle = open(str(self.path), "a+")
        fcntl.flock(self.handle.fileno(), fcntl.LOCK_EX)
        return self

    def __exit__(self, exc_type, exc, tb):
        if self.handle is not None:
            fcntl.flock(self.handle.fileno(), fcntl.LOCK_UN)
            self.handle.close()
            self.handle = None
        return False


def report_active(view_root):
    current = view_root / "current"
    if not current.is_symlink():
        raise MaterializeError("no materialized runtime is selected")
    release_id = release_id_from_symlink(view_root, "current")
    view = existing_view(view_root, release_id)
    if view is None:
        raise MaterializeError("selected view is missing")
    return {"activeReleaseId": release_id, "viewPath": str(view)}


def blob_path(store, digest, blob_root=None):
    if blob_root is not None:
        return Path(blob_root) / digest
    prefixed = store / "runtime" / "blobs" / "sha256" / digest
    if prefixed.is_file():
        return prefixed
    direct = store / digest
    if direct.is_file():
        return direct
    return prefixed


def manifest_path(store, release_id):
    return store / "runtime" / "blob-releases" / release_id / "manifest.json"


def file_bindings(manifest):
    bindings = {}
    for item in manifest["files"]:
        bindings[item["path"]] = item
    return bindings


def changed_paths(current, candidate):
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


def assert_blobs_visible(store, manifest, paths, blob_root=None):
    bindings = file_bindings(manifest)
    for relative in paths:
        item = bindings[relative]
        blob = blob_path(store, item["sha256"], blob_root=blob_root)
        try:
            size = blob.stat().st_size
        except OSError:
            raise MaterializeError("delta blob is not visible: %s" % item["objectKey"])
        if size != item["sizeBytes"]:
            raise MaterializeError("delta blob size mismatch: %s" % item["objectKey"])


def resolve_view_destination(view, relative):
    view_root = view.resolve()
    destination = view / relative
    parent = destination.parent.resolve()
    try:
        parent.relative_to(view_root)
    except ValueError:
        raise MaterializeError("unsafe materialized path: %s" % relative)
    return parent / destination.name


def link_or_copy(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() or destination.is_symlink():
        destination.unlink()
    try:
        os.link(source, destination)
    except OSError:
        shutil.copyfile(source, destination, follow_symlinks=False)


def place_logical_file(store, view, item, blob_root=None, use_helper_leaves=False):
    destination = resolve_view_destination(view, item["path"])
    if use_helper_leaves:
        helper_leaf = view / HELPER_NAME / item["sha256"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists() or destination.is_symlink():
            destination.unlink()
        os.symlink(os.path.relpath(str(helper_leaf), str(destination.parent)), str(destination))
        return
    source = blob_path(store, item["sha256"], blob_root=blob_root)
    if not source.is_file():
        raise MaterializeError("blob is not visible: %s" % item["objectKey"])
    link_or_copy(source, destination)


def write_materialization_artifacts(view, manifest):
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


def view_matches_manifest(view, manifest):
    marker = view / MATERIALIZED_MANIFEST
    receipt = view / MATERIALIZATION_RECEIPT
    helper = view / HELPER_NAME
    if not view.is_dir() or not marker.is_file() or not receipt.is_file():
        return False
    if not helper.is_dir() or helper.is_symlink():
        return False
    existing = json.loads(marker.read_text(encoding="utf-8"))
    return existing.get("releaseId") == manifest["releaseId"] and existing.get("manifestSha256") == manifest["manifestSha256"]


def prepare_view(view, manifest):
    validate_manifest(manifest)
    view.mkdir(parents=True, exist_ok=True)
    write_materialization_artifacts(view, manifest)
    return view


def populate_view(store, manifest, view, blob_root=None, use_helper_leaves=False):
    for item in manifest["files"]:
        place_logical_file(store, view, item, blob_root=blob_root, use_helper_leaves=use_helper_leaves)
    return view


def materialize_view(store, manifest, view, blob_root=None):
    validate_manifest(manifest)
    if view_matches_manifest(view, manifest):
        return view
    prepare_view(view, manifest)
    populate_view(store, manifest, view, blob_root=blob_root)
    return view


def build_parser():
    parser = argparse.ArgumentParser(description="Materialize a runtime view from a v2 blob manifest.")
    parser.add_argument("--store-dir", required=True)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--view", required=True)
    parser.add_argument("--blob-root")
    parser.add_argument("--manifest")
    return parser


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv and argv[0] == "active":
        parser = argparse.ArgumentParser(description="Report the selected view pointer.")
        parser.add_argument("--view-root", required=True)
        args = parser.parse_args(argv[1:])
        try:
            sys.stdout.write(json.dumps(report_active(Path(args.view_root)), separators=(",", ":")) + "\n")
        except MaterializeError as error:
            sys.stderr.write("%s\n" % error)
            return error.code
        return 0
    args = build_parser().parse_args(argv)
    store = Path(args.store_dir)
    try:
        source = Path(args.manifest) if args.manifest else manifest_path(store, args.release_id)
        manifest = load_manifest(source)
        if manifest["releaseId"] != args.release_id:
            raise MaterializeError("manifest releaseId does not match --release-id")
        materialize_view(store, manifest, Path(args.view), blob_root=args.blob_root)
    except MaterializeError as error:
        sys.stderr.write("%s\n" % error)
        return error.code
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
