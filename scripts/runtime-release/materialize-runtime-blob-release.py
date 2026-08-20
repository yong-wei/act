#!/usr/bin/env python3
"""Materialize a verified v2 runtime manifest into a host-owned symlink view.

Each selected view owns one reserved real directory ``.act-runtime-blobs``.
The host bind-mounts the shared blob namespace there; this helper never
embeds host or ``/app`` paths in leaf links.  ``prepare`` may wait for that
attachment, and ``select`` moves ``current`` only after helper verification.
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
import time
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple


MANIFEST_SCHEMA = "act-runtime-release.v2"
RECEIPT_SCHEMA = "act-runtime-release-receipt.v2"
MATERIALIZATION_SCHEMA = "runtime-blob-materialization.v1"
MATERIALIZATION_CACHE_SCHEMA = "runtime-blob-materialization.v2"
AUDIT_SCHEMA = "runtime-blob-audit.v1"
LOCAL_MANIFEST = ".act-runtime-release.v2.json"
LOCAL_RECEIPT = ".act-runtime-release-materialization.v1.json"
RUNTIME_BLOB_HELPER_NAME = ".act-runtime-blobs"
RELEASE_ID = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
GIT_REVISION = re.compile(r"^[a-f0-9]{40}$")
GIT_OBJECT_ID = re.compile(r"^(?:[a-f0-9]{40}|[a-f0-9]{64})$")
EXTERNAL_INPUT_ID = re.compile(r"^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$")
BLOB_PREFIX = "runtime/blobs/sha256/"
TEXTBOOK_RETRIEVAL_CACHE_PATHS = (
    "resources/textbook-hybrid-retrieval/bge-m3/bodies.utf8",
    "resources/textbook-hybrid-retrieval/bge-m3/lexical-postings.bin",
    "resources/textbook-hybrid-retrieval/bge-m3/vectors.f32",
)
LEGACY_TEXTBOOK_RETRIEVAL_CACHE_PATHS = (
    "resources/textbook-retrieval/bodies.utf8",
    "resources/textbook-retrieval/lexical-postings.bin",
    "resources/textbook-retrieval/vectors.f32",
)


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
    parts = value.split("/")
    if (
        not value
        or value.startswith("/")
        or "\\" in value
        or any(part in {"", ".", "..", RUNTIME_BLOB_HELPER_NAME} for part in parts)
    ):
        fail("%s is not a safe logical runtime path" % label)
    return value


def derive_release_id(source_revision: str, tree_sha256: str) -> str:
    return "runtime-" + digest({"sourceRevision": source_revision, "treeSha256": tree_sha256})[:55]


def parse_manifest_source(source: Any, label: str) -> Dict[str, str]:
    if not isinstance(source, dict):
        fail("%s is invalid" % label)
    keys = set(source)
    if keys == {"gitObjectId"}:
        git_object_id = require_string(source["gitObjectId"], "%s.gitObjectId" % label).lower()
        if not GIT_OBJECT_ID.fullmatch(git_object_id):
            fail("%s.gitObjectId is invalid" % label)
        return {"gitObjectId": git_object_id}
    if keys == {"externalInputId", "externalInputManifestObjectId", "bundleSemanticSha256", "bundleWireSha256"}:
        external_input_id = require_string(source["externalInputId"], "%s.externalInputId" % label)
        manifest_object_id = require_string(
            source["externalInputManifestObjectId"],
            "%s.externalInputManifestObjectId" % label,
        ).lower()
        bundle_semantic = require_digest(source["bundleSemanticSha256"], "%s.bundleSemanticSha256" % label)
        bundle_wire = require_digest(source["bundleWireSha256"], "%s.bundleWireSha256" % label)
        if not EXTERNAL_INPUT_ID.fullmatch(external_input_id) or not GIT_OBJECT_ID.fullmatch(manifest_object_id):
            fail("%s is invalid" % label)
        return {
            "externalInputId": external_input_id,
            "externalInputManifestObjectId": manifest_object_id,
            "bundleSemanticSha256": bundle_semantic,
            "bundleWireSha256": bundle_wire,
        }
    if keys == {"externalInputId", "externalInputManifestObjectId"}:
        external_input_id = require_string(source["externalInputId"], "%s.externalInputId" % label)
        manifest_object_id = require_string(
            source["externalInputManifestObjectId"],
            "%s.externalInputManifestObjectId" % label,
        ).lower()
        if not EXTERNAL_INPUT_ID.fullmatch(external_input_id):
            fail("%s.externalInputId is invalid" % label)
        if not GIT_OBJECT_ID.fullmatch(manifest_object_id):
            fail("%s.externalInputManifestObjectId is invalid" % label)
        return {
            "externalInputId": external_input_id,
            "externalInputManifestObjectId": manifest_object_id,
        }
    fail("%s has unsupported or missing fields" % label)


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
        item = require_exact_keys(item, ["path", "objectKey", "sizeBytes", "sha256", "source"] if "source" in item else ["path", "objectKey", "sizeBytes", "sha256"], "manifest.files[%d]" % index)
        relative = require_relative_path(item["path"], "manifest.files[%d].path" % index)
        file_sha = require_digest(item["sha256"], "manifest.files[%d].sha256" % index)
        object_key = require_string(item["objectKey"], "manifest.files[%d].objectKey" % index)
        if object_key != BLOB_PREFIX + file_sha:
            fail("manifest.files[%d].objectKey is not blob-addressed" % index)
        parsed = {"path": relative, "objectKey": object_key, "sizeBytes": require_integer(item["sizeBytes"], "manifest.files[%d].sizeBytes" % index), "sha256": file_sha}
        if "source" in item:
            parsed["source"] = parse_manifest_source(item["source"], "manifest.files[%d].source" % index)
        files.append(parsed)
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
    receipt_keys = [
        "schemaVersion", "releaseId", "manifestVersion", "manifestObjectKey", "manifestSha256", "manifestWireSha256", "manifestWireSizeBytes", "treeSha256", "fileCount", "totalBytes", "blobs", "receiptSha256",
    ]
    if "sourceProvenanceProofSha256" in raw:
        receipt_keys.insert(-1, "sourceProvenanceProofSha256")
    raw = require_exact_keys(raw, receipt_keys, "release receipt")
    release_id = manifest["releaseId"]
    if raw["schemaVersion"] != RECEIPT_SCHEMA or raw["manifestVersion"] != MANIFEST_SCHEMA:
        fail("release receipt has an unsupported version")
    if raw["releaseId"] != release_id or raw["manifestObjectKey"] != "runtime/blob-releases/%s/manifest.json" % release_id:
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
    if "sourceProvenanceProofSha256" in raw:
        require_digest(raw["sourceProvenanceProofSha256"], "release receipt.sourceProvenanceProofSha256")
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


def helper_root(view: Path) -> Path:
    return view / RUNTIME_BLOB_HELPER_NAME


def require_helper_directory(view: Path) -> Path:
    helper = helper_root(view)
    require_real_directory(helper, "runtime helper root")
    if helper.resolve() != view.resolve() / RUNTIME_BLOB_HELPER_NAME:
        fail("runtime helper root escaped the materialized view")
    return helper.resolve()


def relative_helper_link(logical_path: str, file_sha: str) -> str:
    require_digest(file_sha, "helper blob digest")
    return ("%s%s/%s" % ("../" * logical_path.count("/"), RUNTIME_BLOB_HELPER_NAME, file_sha))


def require_relative_helper_link(logical: Path, logical_path: str, file_sha: str) -> str:
    raw = os.readlink(str(logical))
    if (
        os.path.isabs(raw)
        or raw.startswith("/")
        or "\\" in raw
        or raw == "/app"
        or raw.startswith("/app/")
        or "/app/" in raw
    ):
        fail("logical leaf symlink must be a relative helper-root link: %s" % logical_path)
    expected = relative_helper_link(logical_path, file_sha)
    if raw != expected:
        fail("logical leaf symlink must be a relative helper-root link: %s" % logical_path)
    return raw


def textbook_retrieval_cache_paths() -> Tuple[str, ...]:
    return TEXTBOOK_RETRIEVAL_CACHE_PATHS


def require_textbook_retrieval_cache(
    manifest: Dict[str, Any], paths: Tuple[str, ...] = TEXTBOOK_RETRIEVAL_CACHE_PATHS
) -> List[str]:
    if paths not in (TEXTBOOK_RETRIEVAL_CACHE_PATHS, LEGACY_TEXTBOOK_RETRIEVAL_CACHE_PATHS):
        fail("textbook retrieval cache path tuple is unsupported")
    manifest_paths = {item["path"] for item in manifest["files"]}
    missing = [path for path in paths if path not in manifest_paths]
    if missing:
        fail("textbook retrieval cache path is absent from manifest: %s" % missing[0])
    return list(paths)


def materialization_payload(
    manifest: Dict[str, Any],
    receipt: Dict[str, Any],
    cache_enabled: bool = False,
    cache_paths: Tuple[str, ...] = TEXTBOOK_RETRIEVAL_CACHE_PATHS,
) -> Dict[str, Any]:
    cached_paths = require_textbook_retrieval_cache(manifest, cache_paths) if cache_enabled else []
    base = {
        "schemaVersion": MATERIALIZATION_CACHE_SCHEMA if cache_enabled else MATERIALIZATION_SCHEMA,
        "releaseId": manifest["releaseId"],
        "manifestVersion": MANIFEST_SCHEMA,
        "manifestSha256": manifest["manifestSha256"],
        "manifestWireSha256": receipt["manifestWireSha256"],
        "treeSha256": manifest["treeSha256"],
        "fileCount": manifest["fileCount"],
        "totalBytes": manifest["totalBytes"],
    }
    if cache_enabled:
        base["cachedLogicalPaths"] = cached_paths
        base["textbookRetrievalCacheEnabled"] = True
    return dict(base, materializationSha256=digest(base))


def parse_materialization_receipt(
    raw: Any,
    manifest: Dict[str, Any],
    wire_sha256: str,
) -> Dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("schemaVersion"), str):
        fail("materialization receipt is invalid")
    schema = raw["schemaVersion"]
    if schema == MATERIALIZATION_SCHEMA:
        expected = materialization_payload(manifest, {"manifestWireSha256": wire_sha256}, cache_enabled=False)
        if raw != expected:
            fail("materialization receipt does not match manifest")
        return expected
    if schema == MATERIALIZATION_CACHE_SCHEMA:
        for cache_paths in (TEXTBOOK_RETRIEVAL_CACHE_PATHS, LEGACY_TEXTBOOK_RETRIEVAL_CACHE_PATHS):
            try:
                expected = materialization_payload(
                    manifest,
                    {"manifestWireSha256": wire_sha256},
                    cache_enabled=True,
                    cache_paths=cache_paths,
                )
            except ValueError:
                continue
            if raw == expected:
                return expected
        fail("materialization receipt does not match manifest")
    fail("materialization receipt has an unsupported version")


def cached_logical_paths(receipt: Dict[str, Any]) -> List[str]:
    if receipt.get("textbookRetrievalCacheEnabled") is True:
        return list(receipt["cachedLogicalPaths"])
    return []


def copy_regular_readonly(source: Path, dest: Path) -> None:
    with source.open("rb") as src, dest.open("wb") as dst:
        shutil.copyfileobj(src, dst)
        dst.flush()
        os.fsync(dst.fileno())
    os.chmod(dest, 0o444)


def copy_regular_readonly_verified(source: Path, dest: Path, entry: Dict[str, Any]) -> None:
    value = hashlib.sha256()
    total = 0
    try:
        with source.open("rb") as src, dest.open("wb") as dst:
            for chunk in iter(lambda: src.read(1024 * 1024), b""):
                total += len(chunk)
                value.update(chunk)
                dst.write(chunk)
            dst.flush()
            os.fsync(dst.fileno())
        if total != entry["sizeBytes"] or value.hexdigest() != entry["sha256"]:
            fail("cached logical file does not match manifest: %s" % entry["path"])
        os.chmod(dest, 0o444)
    except Exception:
        if dest.exists() or dest.is_symlink():
            dest.unlink()
        raise


def write_regular(path: Path, value: bytes) -> None:
    with path.open("wb") as handle:
        handle.write(value)
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(path, 0o444)


def verify_view(view: Path, release_id: str, *, require_helper_contents: bool = True) -> Dict[str, Any]:
    receipt, manifest = verify_view_structure(view, release_id)
    cached_paths = set(cached_logical_paths(receipt))
    if not require_helper_contents:
        return receipt
    helper = require_helper_directory(view)
    for entry in manifest["files"]:
        logical = view / entry["path"]
        if entry["path"] in cached_paths:
            details = os.lstat(logical)
            if details.st_size != entry["sizeBytes"] or hash_file(logical) != entry["sha256"]:
                fail("materialized logical file does not match manifest content: %s" % entry["path"])
            continue
        try:
            expected_blob = blob_path(helper, entry["sha256"])
        except OSError as error:
            fail("runtime helper target is missing: %s (%s)" % (entry["path"], error))
        target = Path(os.path.realpath(str(logical)))
        if target != expected_blob:
            fail("materialized logical file points outside its manifest blob: %s" % entry["path"])
        details = target.stat()
        if details.st_size != entry["sizeBytes"]:
            fail("materialized logical file size does not match manifest content: %s" % entry["path"])
    return receipt


def verify_view_structure(view: Path, release_id: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    require_real_directory(view, "materialized view")
    require_helper_directory(view)
    manifest, wire = parse_manifest(view / LOCAL_MANIFEST)
    if manifest["releaseId"] != release_id:
        fail("materialized view manifest release does not match requested release")
    receipt_path = view / LOCAL_RECEIPT
    require_regular(receipt_path, "materialization receipt")
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    expected_receipt = parse_materialization_receipt(receipt, manifest, hashlib.sha256(wire).hexdigest())
    cached_paths = set(cached_logical_paths(expected_receipt))
    expected_paths = set(item["path"] for item in manifest["files"])
    actual_paths = set()
    for current, directories, filenames in os.walk(str(view), followlinks=False):
        current_path = Path(current)
        if current_path == view:
            directories[:] = [directory for directory in directories if directory != RUNTIME_BLOB_HELPER_NAME]
        for directory in directories:
            if os.path.islink(str(current_path / directory)):
                fail("materialized view contains a symlinked directory")
        for filename in filenames:
            absolute = current_path / filename
            relative = absolute.relative_to(view).as_posix()
            if relative in {LOCAL_MANIFEST, LOCAL_RECEIPT}:
                continue
            if relative in cached_paths:
                details = os.lstat(absolute)
                if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode):
                    fail("declared cache entry is not a regular file: %s" % relative)
            elif not os.path.islink(str(absolute)):
                fail("materialized view contains a non-symlink logical file: %s (mode=%s)" % (relative, oct(os.lstat(str(absolute)).st_mode)))
            actual_paths.add(relative)
    if actual_paths != expected_paths:
        fail("materialized view file set differs from manifest")
    for entry in manifest["files"]:
        logical = view / entry["path"]
        if entry["path"] in cached_paths:
            require_regular(logical, "declared cache entry %s" % entry["path"])
            details = os.lstat(logical)
            if details.st_size != entry["sizeBytes"]:
                fail("materialized logical file size does not match manifest content: %s" % entry["path"])
            continue
        require_relative_helper_link(logical, entry["path"], entry["sha256"])
    return expected_receipt, manifest


def require_optional_helper_blob_root(view: Path, blob_root: Any) -> Path:
    helper = require_helper_directory(view)
    if blob_root in {None, ""}:
        return helper
    provided = require_real_directory(Path(blob_root), "blob root")
    if provided != helper:
        fail("v2 verification requires the helper root at %s" % helper_root(view))
    return helper


def with_lock(view_root: Path):
    view_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    require_real_directory(view_root, "view root")
    handle = (view_root / ".runtime-blob-materialization.lock").open("a+")
    fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
    return handle


def parent_entries(view: Path) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Any]]:
    # Imported-equivalent views may contain regular logical files. Parent
    # inheritance only needs the parent manifest identity, not a symlink-forest
    # re-verification of that older view.
    require_real_directory(view, "parent materialized view")
    manifest, wire = parse_manifest(view / LOCAL_MANIFEST)
    receipt_path = view / LOCAL_RECEIPT
    require_regular(receipt_path, "parent materialization receipt")
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    expected_receipt = parse_materialization_receipt(receipt, manifest, hashlib.sha256(wire).hexdigest())
    return {entry["path"]: entry for entry in manifest["files"]}, expected_receipt


def manifest_release_id(view: Path) -> str:
    manifest, _ = parse_manifest(view / LOCAL_MANIFEST)
    return manifest["releaseId"]


def verify_changed_blob(blob_root: Path, entry: Dict[str, Any]) -> None:
    blob = blob_path(blob_root, entry["sha256"])
    if blob.stat().st_size != entry["sizeBytes"] or hash_file(blob) != entry["sha256"]:
        fail("mounted changed blob does not match manifest: %s" % entry["path"])


def copy_parent_cached_file(parent_view: Path, temporary: Path, relative: str, entry: Dict[str, Any]) -> bool:
    source = parent_view / relative
    try:
        require_regular(source, "parent cached logical file %s" % relative)
        details = os.lstat(source)
    except (OSError, ValueError):
        return False
    if details.st_size != entry["sizeBytes"]:
        return False
    destination = temporary / relative
    destination.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
    try:
        os.link(str(source), str(destination))
    except OSError:
        return False
    os.chmod(destination, 0o444)
    return True


def prepare(args: argparse.Namespace) -> Dict[str, Any]:
    view_root = Path(args.view_root)
    blob_root = require_real_directory(Path(args.blob_root), "blob root")
    manifest, manifest_wire = parse_manifest(Path(args.manifest))
    receipt = parse_receipt(Path(args.receipt), manifest, manifest_wire)
    cache_enabled = bool(getattr(args, "cache_textbook_retrieval", False))
    if cache_enabled:
        require_textbook_retrieval_cache(manifest)
    cached_paths = set(TEXTBOOK_RETRIEVAL_CACHE_PATHS) if cache_enabled else set()
    views = view_root / "views"
    lock = with_lock(view_root)
    temporary = None
    try:
        views.mkdir(mode=0o700, parents=True, exist_ok=True)
        require_real_directory(views, "view collection")
        final = views / manifest["releaseId"]
        if final.exists():
            result = verify_view(final, manifest["releaseId"], require_helper_contents=False)
            if (result.get("textbookRetrievalCacheEnabled") is True) != cache_enabled:
                fail("materialization receipt cache binding does not match prepare request")
            return dict(result, prepared=True, reused=True, viewPath=str(final))
        parent_view = Path(args.parent_view) if getattr(args, "parent_view", None) else None
        parent_by_path: Dict[str, Dict[str, Any]] = {}
        parent_cache_enabled = False
        if parent_view is not None:
            parent_view = require_real_directory(parent_view, "parent materialized view")
            parent_by_path, parent_receipt = parent_entries(parent_view)
            parent_cache_enabled = parent_receipt.get("textbookRetrievalCacheEnabled") is True
        temporary = Path(tempfile.mkdtemp(prefix=".%s." % manifest["releaseId"], dir=str(views)))
        helper = temporary / RUNTIME_BLOB_HELPER_NAME
        helper.mkdir(mode=0o755)
        inherited_path_count = 0
        verified_changed_paths: List[str] = []
        verified_changed_blobs: Set[str] = set()
        verified_changed_blob_sizes: Dict[str, int] = {}
        for entry in manifest["files"]:
            logical = temporary / entry["path"]
            logical.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
            parent_entry = parent_by_path.get(entry["path"])
            inherited = parent_entry is not None and (
                parent_entry["sizeBytes"] == entry["sizeBytes"]
                and parent_entry["sha256"] == entry["sha256"]
            )
            if inherited:
                inherited_path_count += 1
            if entry["path"] in cached_paths:
                reused_cache = False
                if inherited and parent_view is not None and parent_cache_enabled:
                    reused_cache = copy_parent_cached_file(parent_view, temporary, entry["path"], entry)
                if not reused_cache:
                    if entry["sha256"] not in verified_changed_blobs:
                        copy_regular_readonly_verified(blob_path(blob_root, entry["sha256"]), logical, entry)
                        verified_changed_blobs.add(entry["sha256"])
                        verified_changed_blob_sizes[entry["sha256"]] = entry["sizeBytes"]
                    else:
                        copy_regular_readonly(blob_path(blob_root, entry["sha256"]), logical)
                    verified_changed_paths.append(entry["path"])
            else:
                os.symlink(relative_helper_link(entry["path"], entry["sha256"]), str(logical))
                if not inherited and entry["sha256"] not in verified_changed_blobs:
                    verify_changed_blob(blob_root, entry)
                    verified_changed_blobs.add(entry["sha256"])
                    verified_changed_blob_sizes[entry["sha256"]] = entry["sizeBytes"]
                if not inherited:
                    verified_changed_paths.append(entry["path"])
        write_regular(temporary / LOCAL_MANIFEST, manifest_wire)
        materialization = materialization_payload(manifest, receipt, cache_enabled=cache_enabled)
        write_regular(temporary / LOCAL_RECEIPT, canonical(materialization) + b"\n")
        for current, directories, _ in os.walk(str(temporary), topdown=False, followlinks=False):
            for directory in directories:
                os.chmod(str(Path(current) / directory), 0o555)
        os.chmod(str(temporary), 0o555)
        result = verify_view(temporary, manifest["releaseId"], require_helper_contents=False)
        os.replace(str(temporary), str(final))
        temporary = None
        directory = os.open(str(views), os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
        changed_paths = set(verified_changed_paths)
        return dict(
            result,
            prepared=True,
            reused=False,
            viewPath=str(final),
            inheritedPathCount=inherited_path_count,
            verifiedChangedPathCount=len(verified_changed_paths),
            verifiedChangedBytes=sum(item["sizeBytes"] for item in manifest["files"] if item["path"] in changed_paths),
            verifiedChangedBlobCount=len(verified_changed_blobs),
            verifiedChangedBodyBytes=sum(verified_changed_blob_sizes.values()),
        )
    finally:
        if temporary and temporary.exists():
            try:
                with open("/tmp/act-failed-materialize-view.txt", "w") as handle:
                    handle.write("%s\n" % temporary)
            except OSError:
                pass
            if os.environ.get("ACT_RUNTIME_KEEP_FAILED_VIEW") != "1":
                shutil.rmtree(str(temporary))
        lock.close()


def attach_helper(args: argparse.Namespace) -> Dict[str, Any]:
    if not args.test_fixture:
        fail("attach-helper is fixture-only; production must use a read-only host bind mount")
    view_root = Path(args.view_root)
    release_id = require_release_id(args.release_id)
    source = require_real_directory(Path(args.blob_root), "blob root")
    lock = with_lock(view_root)
    try:
        view = require_real_directory(view_root / "views" / release_id, "materialized view")
        helper = require_helper_directory(view)
        if source == helper:
            receipt = verify_view(view, release_id, require_helper_contents=True)
            return dict(receipt, attached=True, reused=True, helperPath=str(helper))
        if helper in source.parents or source in helper.parents:
            fail("helper source must be an external blob root")
        manifest, _ = parse_manifest(view / LOCAL_MANIFEST)
        if manifest["releaseId"] != release_id:
            fail("materialized view manifest release does not match requested release")
        os.chmod(helper, 0o755)
        attached = set()
        for entry in manifest["files"]:
            blob = blob_path(source, entry["sha256"])
            if blob.stat().st_size != entry["sizeBytes"] or hash_file(blob) != entry["sha256"]:
                fail("mounted blob does not match manifest: %s" % entry["path"])
            dest = helper / entry["sha256"]
            if dest.exists() or dest.is_symlink():
                existing = blob_path(helper, entry["sha256"])
                if existing.stat().st_size != entry["sizeBytes"] or hash_file(existing) != entry["sha256"]:
                    fail("helper blob does not match manifest: %s" % entry["sha256"])
            else:
                try:
                    os.link(str(blob), str(dest))
                except OSError:
                    copy_regular_readonly(blob, dest)
            attached.add(entry["sha256"])
        os.chmod(helper, 0o555)
        return {
            "attached": True,
            "reused": False,
            "releaseId": release_id,
            "helperPath": str(helper),
            "blobCount": len(attached),
        }
    finally:
        lock.close()


def select(args: argparse.Namespace) -> Dict[str, Any]:
    view_root = Path(args.view_root)
    release_id = require_release_id(args.release_id)
    lock = with_lock(view_root)
    try:
        view = view_root / "views" / release_id
        require_optional_helper_blob_root(view, getattr(args, "blob_root", None))
        receipt, _ = verify_view_structure(view, release_id)
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
    release_id = require_release_id(args.release_id)
    view = view_root / "views" / release_id
    require_optional_helper_blob_root(view, getattr(args, "blob_root", None))
    return verify_view(view, release_id, require_helper_contents=True)


def audit(args: argparse.Namespace) -> Dict[str, Any]:
    """Read a bounded deterministic sample or every unique mounted blob.

    This command is deliberately separate from daily prepare/select paths.
    """
    started = time.monotonic()
    view_root = require_real_directory(Path(args.view_root), "view root")
    release_id = require_release_id(args.release_id)
    view = view_root / "views" / release_id
    receipt, manifest = verify_view_structure(view, release_id)
    helper = require_helper_directory(view)
    unique = {}
    for entry in manifest["files"]:
        existing = unique.get(entry["sha256"])
        if existing is not None and existing["sizeBytes"] != entry["sizeBytes"]:
            fail("manifest uses one blob digest with conflicting sizes")
        unique[entry["sha256"]] = entry
    ordered = [unique[key] for key in sorted(unique)]
    if args.mode == "full":
        selected = ordered
    else:
        sample_size = args.sample_size
        if sample_size < 1 or sample_size > 64:
            fail("sample size must be between 1 and 64")
        if len(ordered) <= sample_size:
            selected = ordered
        else:
            indexes = sorted({(index * (len(ordered) - 1)) // (sample_size - 1) for index in range(sample_size)}) if sample_size > 1 else [0]
            selected = [ordered[index] for index in indexes]
    audited_bytes = 0
    for entry in selected:
        blob = blob_path(helper, entry["sha256"])
        if blob.stat().st_size != entry["sizeBytes"] or hash_file(blob) != entry["sha256"]:
            fail("runtime blob audit content does not match manifest: %s" % entry["sha256"])
        audited_bytes += entry["sizeBytes"]
    return {
        "schemaVersion": AUDIT_SCHEMA,
        "mode": args.mode,
        "releaseId": manifest["releaseId"],
        "manifestSha256": manifest["manifestSha256"],
        "treeSha256": manifest["treeSha256"],
        "uniqueBlobCount": len(ordered),
        "auditedBlobCount": len(selected),
        "auditedBytes": audited_bytes,
        "materializationSha256": receipt["materializationSha256"],
        "elapsedMilliseconds": round((time.monotonic() - started) * 1000, 3),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command")
    for name in ("prepare",):
        command = commands.add_parser(name)
        command.add_argument("--manifest", required=True)
        command.add_argument("--receipt", required=True)
        command.add_argument("--blob-root", required=True)
        command.add_argument("--view-root", required=True)
        command.add_argument("--parent-view")
        command.add_argument("--cache-textbook-retrieval", action="store_true")
    selector = commands.add_parser("select")
    selector.add_argument("--release-id", required=True)
    selector.add_argument("--view-root", required=True)
    selector.add_argument("--blob-root")
    active_parser = commands.add_parser("active")
    active_parser.add_argument("--view-root", required=True)
    verifier = commands.add_parser("verify")
    verifier.add_argument("--release-id", required=True)
    verifier.add_argument("--view-root", required=True)
    verifier.add_argument("--blob-root")
    auditor = commands.add_parser("audit")
    auditor.add_argument("--release-id", required=True)
    auditor.add_argument("--view-root", required=True)
    auditor.add_argument("--mode", choices=("sample", "full"), required=True)
    auditor.add_argument("--sample-size", type=int, default=3)
    attacher = commands.add_parser("attach-helper")
    attacher.add_argument("--release-id", required=True)
    attacher.add_argument("--view-root", required=True)
    attacher.add_argument("--blob-root", required=True)
    attacher.add_argument("--test-fixture", action="store_true")
    args = parser.parse_args()
    if args.command == "prepare":
        result = prepare(args)
    elif args.command == "attach-helper":
        result = attach_helper(args)
    elif args.command == "select":
        result = select(args)
    elif args.command == "active":
        result = active(args)
    elif args.command == "verify":
        result = verify(args)
    elif args.command == "audit":
        result = audit(args)
    else:
        parser.error("a command is required")
    print(json.dumps(result, separators=(",", ":"), sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print("ERROR: %s" % error, file=sys.stderr)
        sys.exit(1)
