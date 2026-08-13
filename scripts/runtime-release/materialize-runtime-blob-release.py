#!/usr/bin/env python3
"""Materialize a verified v2 runtime manifest into a host-owned symlink view.

The blob mount is never exposed to the application.  This helper only creates
real logical directories and validated leaf symlinks, then atomically changes
one local ``current`` pointer under an exclusive host lock.
"""

import argparse
import fcntl
import hashlib
import json
import os
import re
import shutil
import stat
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Tuple


MANIFEST_SCHEMA = "act-runtime-release.v2"
RECEIPT_SCHEMA = "act-runtime-release-receipt.v2"
MATERIALIZATION_SCHEMA = "runtime-blob-materialization.v1"
LOCAL_MANIFEST = ".act-runtime-release.v2.json"
LOCAL_RECEIPT = ".act-runtime-release-materialization.v1.json"
RELEASE_ID = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
GIT_REVISION = re.compile(r"^[a-f0-9]{40}$")
BLOB_PREFIX = "runtime/blobs/sha256/"


def fail(message: str) -> None:
    raise ValueError(message)


def canonical(value: Any) -> bytes:
    return json.dumps(value, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def hash_file(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def require_regular(path: Path, label: str) -> None:
    try:
        details = os.lstat(path)
    except OSError as error:
        fail("%s is missing: %s" % (label, error))
    if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode):
        fail("%s must be a regular non-symlink file" % label)


def require_real_directory(path: Path, label: str) -> Path:
    try:
        details = os.lstat(path)
    except OSError as error:
        fail("%s is missing: %s" % (label, error))
    if stat.S_ISLNK(details.st_mode) or not stat.S_ISDIR(details.st_mode):
        fail("%s must be a real directory" % label)
    return path.resolve()


def require_string(value: Any, label: str) -> str:
    if not isinstance(value, str):
        fail("%s must be a string" % label)
    return value


def require_digest(value: Any, label: str) -> str:
    value = require_string(value, label)
    if not SHA256.fullmatch(value):
        fail("%s must be a SHA-256 digest" % label)
    return value


def require_integer(value: Any, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        fail("%s must be a non-negative integer" % label)
    return value


def require_release_id(value: Any, label: str = "releaseId") -> str:
    value = require_string(value, label)
    if not RELEASE_ID.fullmatch(value):
        fail("%s is invalid" % label)
    return value


def require_exact_keys(value: Any, keys: List[str], label: str) -> Dict[str, Any]:
    if not isinstance(value, dict) or sorted(value.keys()) != sorted(keys):
        fail("%s has unsupported or missing fields" % label)
    return value


def require_relative_path(value: Any, label: str) -> str:
    value = require_string(value, label)
    if not value or value.startswith("/") or "\\" in value or any(part in {"", ".", ".."} for part in value.split("/")):
        fail("%s is not a safe logical runtime path" % label)
    return value


def derive_release_id(source_revision: str, tree_sha256: str) -> str:
    return "runtime-" + digest({"sourceRevision": source_revision, "treeSha256": tree_sha256})[:55]


def parse_manifest(path: Path) -> Tuple[Dict[str, Any], bytes]:
    require_regular(path, "manifest")
    wire = path.read_bytes()
    try:
        raw = json.loads(wire.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail("manifest is not valid JSON: %s" % error)
    raw = require_exact_keys(raw, [
        "schemaVersion", "releaseId", "sourceRevision", "fileCount", "totalBytes", "treeSha256", "manifestSha256", "files",
    ], "manifest")
    if raw["schemaVersion"] != MANIFEST_SCHEMA:
        fail("manifest version is unsupported")
    release_id = require_release_id(raw["releaseId"])
    source_revision = require_string(raw["sourceRevision"], "manifest.sourceRevision").lower()
    if not GIT_REVISION.fullmatch(source_revision):
        fail("manifest.sourceRevision must be a Git revision")
    if not isinstance(raw["files"], list) or not raw["files"]:
        fail("manifest.files must be a non-empty array")
    files = []
    for index, item in enumerate(raw["files"]):
        item = require_exact_keys(item, ["path", "objectKey", "sizeBytes", "sha256"], "manifest.files[%d]" % index)
        relative = require_relative_path(item["path"], "manifest.files[%d].path" % index)
        file_sha = require_digest(item["sha256"], "manifest.files[%d].sha256" % index)
        object_key = require_string(item["objectKey"], "manifest.files[%d].objectKey" % index)
        if object_key != BLOB_PREFIX + file_sha:
            fail("manifest.files[%d].objectKey is not blob-addressed" % index)
        files.append({"path": relative, "objectKey": object_key, "sizeBytes": require_integer(item["sizeBytes"], "manifest.files[%d].sizeBytes" % index), "sha256": file_sha})
    if files != sorted(files, key=lambda item: item["path"]):
        fail("manifest.files must be strictly code-point sorted")
    if len({item["path"] for item in files}) != len(files):
        fail("manifest.files contains duplicate logical paths")
    file_count = require_integer(raw["fileCount"], "manifest.fileCount")
    total_bytes = require_integer(raw["totalBytes"], "manifest.totalBytes")
    tree_sha = require_digest(raw["treeSha256"], "manifest.treeSha256")
    semantic_sha = require_digest(raw["manifestSha256"], "manifest.manifestSha256")
    if file_count != len(files) or total_bytes != sum(item["sizeBytes"] for item in files):
        fail("manifest summary does not match its files")
    tree = digest([{"path": item["path"], "sizeBytes": item["sizeBytes"], "sha256": item["sha256"]} for item in files])
    if tree != tree_sha:
        fail("manifest tree digest does not match its files")
    if derive_release_id(source_revision, tree_sha) != release_id:
        fail("manifest release ID is not content-addressed")
    without_digest = dict(raw)
    without_digest.pop("manifestSha256")
    if digest(without_digest) != semantic_sha:
        fail("manifest semantic digest does not match canonical content")
    return raw, wire


def parse_receipt(path: Path, manifest: Dict[str, Any], manifest_wire: bytes) -> Dict[str, Any]:
    require_regular(path, "release receipt")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail("release receipt is not valid JSON: %s" % error)
    raw = require_exact_keys(raw, [
        "schemaVersion", "releaseId", "manifestVersion", "manifestObjectKey", "manifestSha256", "manifestWireSha256", "manifestWireSizeBytes", "treeSha256", "fileCount", "totalBytes", "blobs", "receiptSha256",
    ], "release receipt")
    release_id = manifest["releaseId"]
    if raw["schemaVersion"] != RECEIPT_SCHEMA or raw["manifestVersion"] != MANIFEST_SCHEMA:
        fail("release receipt has an unsupported version")
    if raw["releaseId"] != release_id or raw["manifestObjectKey"] != "runtime/releases/%s/manifest.json" % release_id:
        fail("release receipt does not bind this manifest object")
    if raw["manifestSha256"] != manifest["manifestSha256"] or raw["treeSha256"] != manifest["treeSha256"]:
        fail("release receipt identity does not match manifest")
    if raw["manifestWireSha256"] != hashlib.sha256(manifest_wire).hexdigest() or raw["manifestWireSizeBytes"] != len(manifest_wire):
        fail("release receipt wire identity does not match manifest bytes")
    if raw["fileCount"] != manifest["fileCount"] or raw["totalBytes"] != manifest["totalBytes"]:
        fail("release receipt aggregate identity does not match manifest")
    blobs = raw["blobs"]
    if not isinstance(blobs, list) or not blobs:
        fail("release receipt blobs is invalid")
    expected = sorted({(item["objectKey"], item["sizeBytes"], item["sha256"]) for item in manifest["files"]})
    actual = []
    for index, item in enumerate(blobs):
        item = require_exact_keys(item, ["objectKey", "sizeBytes", "sha256"], "release receipt.blobs[%d]" % index)
        sha = require_digest(item["sha256"], "release receipt.blobs[%d].sha256" % index)
        key = require_string(item["objectKey"], "release receipt.blobs[%d].objectKey" % index)
        if key != BLOB_PREFIX + sha:
            fail("release receipt blob is not blob-addressed")
        actual.append((key, require_integer(item["sizeBytes"], "release receipt.blobs[%d].sizeBytes" % index), sha))
    if actual != sorted(actual) or actual != expected:
        fail("release receipt blob set does not match manifest")
    receipt_sha = require_digest(raw["receiptSha256"], "release receipt.receiptSha256")
    without_digest = dict(raw)
    without_digest.pop("receiptSha256")
    if digest(without_digest) != receipt_sha:
        fail("release receipt semantic digest does not match canonical content")
    return raw


def blob_path(blob_root: Path, file_sha: str) -> Path:
    candidate = blob_root / file_sha
    details = os.lstat(candidate)
    if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode):
        fail("blob must be a regular non-symlink file: %s" % file_sha)
    if candidate.resolve().parent != blob_root:
        fail("blob escapes its mounted root: %s" % file_sha)
    return candidate


def materialization_payload(manifest: Dict[str, Any], receipt: Dict[str, Any]) -> Dict[str, Any]:
    base = {
        "schemaVersion": MATERIALIZATION_SCHEMA,
        "releaseId": manifest["releaseId"],
        "manifestVersion": MANIFEST_SCHEMA,
        "manifestSha256": manifest["manifestSha256"],
        "manifestWireSha256": receipt["manifestWireSha256"],
        "treeSha256": manifest["treeSha256"],
        "fileCount": manifest["fileCount"],
        "totalBytes": manifest["totalBytes"],
    }
    return dict(base, materializationSha256=digest(base))


def write_regular(path: Path, value: bytes) -> None:
    with path.open("wb") as handle:
        handle.write(value)
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(path, 0o444)


def verify_view(view: Path, blob_root: Path, release_id: str) -> Dict[str, Any]:
    require_real_directory(view, "materialized view")
    manifest, wire = parse_manifest(view / LOCAL_MANIFEST)
    if manifest["releaseId"] != release_id:
        fail("materialized view manifest release does not match requested release")
    receipt_path = view / LOCAL_RECEIPT
    require_regular(receipt_path, "materialization receipt")
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    expected_receipt = materialization_payload(manifest, {
        "manifestWireSha256": hashlib.sha256(wire).hexdigest(),
    })
    if receipt != expected_receipt:
        fail("materialization receipt does not match manifest")
    expected_paths = set(item["path"] for item in manifest["files"])
    actual_paths = set()
    for current, directories, filenames in os.walk(str(view), followlinks=False):
        current_path = Path(current)
        for directory in directories:
            if os.path.islink(str(current_path / directory)):
                fail("materialized view contains a symlinked directory")
        for filename in filenames:
            absolute = current_path / filename
            relative = absolute.relative_to(view).as_posix()
            if relative in {LOCAL_MANIFEST, LOCAL_RECEIPT}:
                continue
            if not os.path.islink(str(absolute)):
                fail("materialized view contains a non-symlink logical file: %s" % relative)
            actual_paths.add(relative)
    if actual_paths != expected_paths:
        fail("materialized view file set differs from manifest")
    for entry in manifest["files"]:
        logical = view / entry["path"]
        target = Path(os.path.realpath(str(logical)))
        expected_blob = blob_path(blob_root, entry["sha256"]).resolve()
        if target != expected_blob:
            fail("materialized logical file points outside its manifest blob: %s" % entry["path"])
        details = target.stat()
        if details.st_size != entry["sizeBytes"] or hash_file(target) != entry["sha256"]:
            fail("materialized logical file does not match manifest content: %s" % entry["path"])
    return materialization_payload(manifest, {"manifestWireSha256": hashlib.sha256(wire).hexdigest()})


def with_lock(view_root: Path):
    view_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    require_real_directory(view_root, "view root")
    handle = (view_root / ".runtime-blob-materialization.lock").open("a+")
    fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
    return handle


def prepare(args: argparse.Namespace) -> Dict[str, Any]:
    view_root = Path(args.view_root)
    blob_root = require_real_directory(Path(args.blob_root), "blob root")
    manifest, manifest_wire = parse_manifest(Path(args.manifest))
    receipt = parse_receipt(Path(args.receipt), manifest, manifest_wire)
    views = view_root / "views"
    lock = with_lock(view_root)
    temporary = None
    try:
        views.mkdir(mode=0o700, parents=True, exist_ok=True)
        require_real_directory(views, "view collection")
        final = views / manifest["releaseId"]
        if final.exists():
            result = verify_view(final, blob_root, manifest["releaseId"])
            return dict(result, prepared=True, reused=True, viewPath=str(final))
        temporary = Path(tempfile.mkdtemp(prefix=".%s." % manifest["releaseId"], dir=str(views)))
        for entry in manifest["files"]:
            blob = blob_path(blob_root, entry["sha256"])
            if blob.stat().st_size != entry["sizeBytes"] or hash_file(blob) != entry["sha256"]:
                fail("mounted blob does not match manifest: %s" % entry["path"])
            logical = temporary / entry["path"]
            logical.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
            os.symlink(str(blob), str(logical))
        write_regular(temporary / LOCAL_MANIFEST, manifest_wire)
        materialization = materialization_payload(manifest, receipt)
        write_regular(temporary / LOCAL_RECEIPT, canonical(materialization) + b"\n")
        for current, directories, _ in os.walk(str(temporary), topdown=False, followlinks=False):
            for directory in directories:
                os.chmod(str(Path(current) / directory), 0o555)
        os.chmod(str(temporary), 0o555)
        result = verify_view(temporary, blob_root, manifest["releaseId"])
        os.replace(str(temporary), str(final))
        temporary = None
        directory = os.open(str(views), os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
        return dict(result, prepared=True, reused=False, viewPath=str(final))
    finally:
        if temporary and temporary.exists():
            shutil.rmtree(str(temporary))
        lock.close()


def select(args: argparse.Namespace) -> Dict[str, Any]:
    view_root = Path(args.view_root)
    blob_root = require_real_directory(Path(args.blob_root), "blob root")
    release_id = require_release_id(args.release_id)
    lock = with_lock(view_root)
    try:
        view = view_root / "views" / release_id
        receipt = verify_view(view, blob_root, release_id)
        current = view_root / "current"
        temporary = view_root / (".current.%d" % os.getpid())
        if temporary.exists() or temporary.is_symlink():
            fail("materialization current temporary path already exists")
        os.symlink("views/%s" % release_id, str(temporary))
        os.replace(str(temporary), str(current))
        directory = os.open(str(view_root), os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
        return dict(receipt, selected=True, viewPath=str(view))
    finally:
        lock.close()


def active(args: argparse.Namespace) -> Dict[str, Any]:
    view_root = require_real_directory(Path(args.view_root), "view root")
    current = view_root / "current"
    if not current.is_symlink():
        fail("no materialized runtime is selected")
    target = os.readlink(str(current))
    if not re.fullmatch(r"views/" + RELEASE_ID.pattern[1:-1], target):
        fail("materialized current pointer is invalid")
    return {"activeReleaseId": target.split("/", 1)[1], "viewPath": str((view_root / target).resolve())}


def verify(args: argparse.Namespace) -> Dict[str, Any]:
    view_root = require_real_directory(Path(args.view_root), "view root")
    blob_root = require_real_directory(Path(args.blob_root), "blob root")
    release_id = require_release_id(args.release_id)
    return verify_view(view_root / "views" / release_id, blob_root, release_id)


def main() -> None:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command")
    for name in ("prepare",):
        command = commands.add_parser(name)
        command.add_argument("--manifest", required=True)
        command.add_argument("--receipt", required=True)
        command.add_argument("--blob-root", required=True)
        command.add_argument("--view-root", required=True)
    selector = commands.add_parser("select")
    selector.add_argument("--release-id", required=True)
    selector.add_argument("--blob-root", required=True)
    selector.add_argument("--view-root", required=True)
    active_parser = commands.add_parser("active")
    active_parser.add_argument("--view-root", required=True)
    verifier = commands.add_parser("verify")
    verifier.add_argument("--release-id", required=True)
    verifier.add_argument("--blob-root", required=True)
    verifier.add_argument("--view-root", required=True)
    args = parser.parse_args()
    if args.command == "prepare":
        result = prepare(args)
    elif args.command == "select":
        result = select(args)
    elif args.command == "active":
        result = active(args)
    elif args.command == "verify":
        result = verify(args)
    else:
        parser.error("a command is required")
    print(json.dumps(result, separators=(",", ":"), sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print("ERROR: %s" % error, file=sys.stderr)
        sys.exit(1)
