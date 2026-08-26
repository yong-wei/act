#!/usr/bin/env python3
"""Durable desired-selection and active-receipt state for one ECS runtime host."""

import argparse
import hashlib
import importlib.util
import json
import os
import re
import shutil
import stat
import sys
import tempfile
from pathlib import Path
from typing import Any, Optional

RELEASE_ID = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
GIT_REVISION = re.compile(r"^[a-f0-9]{40}$")
IMAGE_DIGEST = re.compile(r"^sha256:[a-f0-9]{64}$")
SELECTION_FILE = "act-runtime-selection.json"
ACTIVE_RECEIPT_FILE = "act-runtime-active-receipt.json"
REPRESENTATIVE_MAX_BYTES = 4 * 1024 * 1024
V2_VERIFICATION_SCHEMA = "runtime-release-verification.v2"
V2_RELEASE_RECEIPT_SCHEMA = "act-runtime-release-receipt.v2"
V2_MATERIALIZATION_SCHEMA = "runtime-blob-materialization.v1"
V2_MANIFEST_OBJECT_PREFIX = "runtime/blob-releases/"
V2_MANIFEST_FILENAME = "manifest.json"



def fail(message: str) -> None:
    raise ValueError(message)


def require_digest(value: Any, name: str) -> str:
    if not isinstance(value, str) or not SHA256.fullmatch(value):
        fail(f"{name} must be a lowercase SHA-256 digest")
    return value


def require_release_id(value: Any, name: str = "releaseId") -> str:
    if not isinstance(value, str) or not RELEASE_ID.fullmatch(value):
        fail(f"{name} is invalid")
    return value


def require_git_revision(value: Any, name: str) -> str:
    if not isinstance(value, str) or not GIT_REVISION.fullmatch(value):
        fail(f"{name} must be a lowercase Git revision")
    return value


def require_image_digest(value: Any, name: str) -> str:
    if not isinstance(value, str) or not IMAGE_DIGEST.fullmatch(value):
        fail(f"{name} must be a sha256 image digest")
    return value


def require_deployment(value: Any):
    if value is None:
        return None
    if not isinstance(value, dict):
        fail("active receipt deployment is invalid")
    return {
        "appRevision": require_git_revision(value.get("appRevision"), "deployment.appRevision"),
        "imageDigest": require_image_digest(value.get("imageDigest"), "deployment.imageDigest"),
        "releaseLocatorSha256": require_digest(value.get("releaseLocatorSha256"), "deployment.releaseLocatorSha256"),
    }


def require_selection(value: Any):
    if not isinstance(value, dict) or value.get("schemaVersion") != "runtime-release-selection.v1":
        fail("selection is invalid")
    generation = value.get("generation")
    if not isinstance(generation, int) or generation < 1:
        fail("selection.generation is invalid")
    return {
        "schemaVersion": "runtime-release-selection.v1",
        "generation": generation,
        "releaseId": require_release_id(value.get("releaseId")),
        "manifestSha256": require_digest(value.get("manifestSha256"), "selection.manifestSha256"),
        "treeSha256": require_digest(value.get("treeSha256"), "selection.treeSha256"),
    }


def require_active_receipt(value: Any):
    if not isinstance(value, dict) or value.get("schemaVersion") != "runtime-release-active-receipt.v1":
        fail("active receipt is invalid")
    if value.get("healthCheck") != "readyz":
        fail("active receipt does not prove readyz")
    receipt = {
        "schemaVersion": "runtime-release-active-receipt.v1",
        "selection": require_selection(value.get("selection")),
        "healthCheck": "readyz",
    }
    deployment = require_deployment(value.get("deployment"))
    if deployment:
        receipt["deployment"] = deployment
    return receipt


def read_json(path: Path, validator):
    if path.is_symlink():
        fail(f"state path must not be a symlink: {path.name}")
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as handle:
        return validator(json.load(handle))


def require_real_directory(path: Path, label: str) -> Path:
    try:
        details = os.lstat(path)
    except OSError as error:
        fail(f"{label} is unavailable: {error}")
    if stat.S_ISLNK(details.st_mode) or not stat.S_ISDIR(details.st_mode):
        fail(f"{label} must be a real directory")
    return path.resolve()


def write_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    payload = (json.dumps(value, separators=(",", ":"), sort_keys=True) + "\n").encode("utf-8")
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        os.fchmod(descriptor, 0o644 if path.name == ACTIVE_RECEIPT_FILE else 0o600)
        with os.fdopen(descriptor, "wb", closefd=True) as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        if path.name == ACTIVE_RECEIPT_FILE and os.environ.get("ACT_RUNTIME_HOST_STATE_CRASH_AT") == "active-receipt-before-rename":
            os._exit(86)
        os.replace(temporary, path)
        if path.name == ACTIVE_RECEIPT_FILE and os.environ.get("ACT_RUNTIME_HOST_STATE_CRASH_AT") == "active-receipt-after-rename":
            os._exit(87)
        directory = os.open(path.parent, os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def read_verified_receipt(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict) or not isinstance(value.get("schemaVersion"), str):
        fail("verification receipt is invalid")
    if value["schemaVersion"] == "runtime-release-verification.v2":
        required = {
            "schemaVersion", "releaseId", "manifestObjectKey", "manifestSha256", "wireSha256",
            "wireSizeBytes", "treeSha256", "fileCount", "totalBytes",
        }
        if set(value) != required:
            fail("v2 verification receipt is invalid")
        release_id = require_release_id(value.get("releaseId"))
        if value.get("manifestObjectKey") != f"{V2_MANIFEST_OBJECT_PREFIX}{release_id}/{V2_MANIFEST_FILENAME}":
            fail("v2 verification receipt manifest object key is invalid")
        require_digest(value.get("wireSha256"), "v2 verification.wireSha256")
        require_non_negative_integer(value.get("wireSizeBytes"), "v2 verification.wireSizeBytes")
        require_non_negative_integer(value.get("fileCount"), "v2 verification.fileCount", positive=True)
        require_non_negative_integer(value.get("totalBytes"), "v2 verification.totalBytes")
        return {
            "releaseId": release_id,
            "manifestSha256": require_digest(value.get("manifestSha256"), "v2 verification.manifestSha256"),
            "treeSha256": require_digest(value.get("treeSha256"), "v2 verification.treeSha256"),
        }
    if value["schemaVersion"] != "runtime-release-verification.v1":
        fail("verification receipt is invalid")
    return {
        "releaseId": require_release_id(value.get("releaseId")),
        "manifestSha256": require_digest(value.get("manifestSha256"), "verification.manifestSha256"),
        "treeSha256": require_digest(value.get("treeSha256"), "verification.treeSha256"),
    }


def load_v2_materializer():
    module_path = Path(__file__).with_name("materialize-runtime-blob-release.py")
    spec = importlib.util.spec_from_file_location("runtime_blob_materializer_for_host_state", module_path)
    if spec is None or spec.loader is None:
        fail("v2 materializer module is unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_regular_json(path: Path, label: str):
    try:
        details = os.lstat(path)
    except OSError as error:
        fail(f"{label} is unavailable: {error}")
    if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode):
        fail(f"{label} must be a regular non-symlink file")
    try:
        with path.open("rb") as handle:
            wire = handle.read()
        return json.loads(wire.decode("utf-8")), wire
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"{label} is not valid JSON: {error}")


def require_non_negative_integer(value: Any, name: str, *, positive: bool = False) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0 or (positive and value < 1):
        fail(f"{name} is invalid")
    return value


def verify_v2_receipt(path: Path, manifest: dict, manifest_wire: bytes, release_id: str, materializer):
    value, _ = read_regular_json(path, "v2 verification receipt")
    if not isinstance(value, dict) or not isinstance(value.get("schemaVersion"), str):
        fail("v2 verification receipt is invalid")
    manifest_sha256 = manifest["manifestSha256"]
    wire_sha256 = hashlib.sha256(manifest_wire).hexdigest()
    expected_identity = {
        "releaseId": release_id,
        "manifestSha256": manifest_sha256,
        "treeSha256": manifest["treeSha256"],
        "fileCount": manifest["fileCount"],
        "totalBytes": manifest["totalBytes"],
    }
    if value["schemaVersion"] == V2_VERIFICATION_SCHEMA:
        required = {
            "schemaVersion", "releaseId", "manifestObjectKey", "manifestSha256", "wireSha256",
            "wireSizeBytes", "treeSha256", "fileCount", "totalBytes",
        }
        if set(value) != required:
            fail("v2 verification receipt has unsupported or missing fields")
        if value.get("manifestObjectKey") != f"{V2_MANIFEST_OBJECT_PREFIX}{release_id}/{V2_MANIFEST_FILENAME}":
            fail("v2 verification receipt manifest object key is invalid")
        require_digest(value.get("manifestSha256"), "v2 verification.manifestSha256")
        require_digest(value.get("wireSha256"), "v2 verification.wireSha256")
        require_digest(value.get("treeSha256"), "v2 verification.treeSha256")
        require_non_negative_integer(value.get("wireSizeBytes"), "v2 verification.wireSizeBytes")
        require_non_negative_integer(value.get("fileCount"), "v2 verification.fileCount", positive=True)
        require_non_negative_integer(value.get("totalBytes"), "v2 verification.totalBytes")
        if {
            "releaseId": value.get("releaseId"),
            "manifestSha256": value.get("manifestSha256"),
            "treeSha256": value.get("treeSha256"),
            "fileCount": value.get("fileCount"),
            "totalBytes": value.get("totalBytes"),
        } != expected_identity or value.get("wireSha256") != wire_sha256 or value.get("wireSizeBytes") != len(manifest_wire):
            fail("v2 verification receipt identity does not match the mounted manifest")
        return {
            **expected_identity,
            "wireSha256": wire_sha256,
            "wireSizeBytes": len(manifest_wire),
        }
    if value["schemaVersion"] == V2_RELEASE_RECEIPT_SCHEMA:
        # Reuse the materializer's strict release receipt parser instead of
        # maintaining a weaker second implementation here.
        parsed = materializer.parse_receipt(path, manifest, manifest_wire)
        if parsed.get("manifestWireSha256") != wire_sha256:
            fail("v2 release receipt wire identity does not match the mounted manifest")
        return {
            **expected_identity,
            "wireSha256": wire_sha256,
            "wireSizeBytes": len(manifest_wire),
        }
    if value["schemaVersion"] in {V2_MATERIALIZATION_SCHEMA, materializer.MATERIALIZATION_CACHE_SCHEMA}:
        materializer.parse_materialization_receipt(value, manifest, wire_sha256)
        return {
            **expected_identity,
            "wireSha256": wire_sha256,
            "wireSizeBytes": len(manifest_wire),
        }
    fail("v2 verification receipt schema is unsupported")


def restore_control_plane_overlays(parent_runtime_root: Path, candidate_runtime_root: Path):
    materializer = load_v2_materializer()
    parent = materializer.require_real_directory(Path(parent_runtime_root), "parent overlay view")
    candidate = materializer.require_real_directory(Path(candidate_runtime_root), "candidate overlay view")
    skip_dirs = {materializer.RUNTIME_BLOB_HELPER_NAME}
    skip_files = {materializer.LOCAL_MANIFEST, materializer.LOCAL_RECEIPT}
    cache_paths = set(materializer.TEXTBOOK_RETRIEVAL_CACHE_PATHS) | set(materializer.LEGACY_TEXTBOOK_RETRIEVAL_CACHE_PATHS)
    allowlist = set(materializer.CONTROL_PLANE_OVERLAY_PATHS)
    copied = []
    skipped = []

    def copy_regular(relative: str, *, replace_symlink: bool = False) -> bool:
        source = parent / relative
        try:
            details = os.lstat(source)
        except OSError:
            return False
        if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode):
            skipped.append(relative)
            return False
        if relative in cache_paths or relative in skip_files:
            skipped.append(relative)
            return False
        destination = candidate / relative
        if destination.is_symlink():
            if not replace_symlink:
                skipped.append(relative)
                return False
            destination.unlink()
        destination.parent.mkdir(parents=True, exist_ok=True)
        os.chmod(destination.parent, 0o755)
        if destination.exists() or destination.is_symlink():
            destination.unlink()
        shutil.copy2(source, destination)
        copied.append(relative)
        return True

    os.chmod(candidate, 0o755)
    for root, directories, filenames in os.walk(parent, followlinks=False):
        directories[:] = [name for name in directories if name not in skip_dirs]
        for name in filenames:
            source = Path(root) / name
            relative = source.relative_to(parent).as_posix()
            if relative in skip_files:
                continue
            details = os.lstat(source)
            if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode):
                continue
            if relative in cache_paths or relative not in allowlist:
                skipped.append(relative)
                continue
            copy_regular(relative, replace_symlink=True)
    for pointer_relative in materializer.CONTROL_PLANE_OVERLAY_PATHS:
        pointer_path = candidate / pointer_relative
        try:
            details = os.lstat(pointer_path)
        except OSError:
            continue
        if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode):
            continue
        pointer = materializer.read_control_plane_pointer(pointer_path)
        for kind, relative in materializer.control_plane_payload_targets(pointer_relative, pointer):
            if kind in {"file", "optional_file", "any_file"}:
                copy_regular(relative)
            else:
                for source_relative in sorted(materializer.regular_files_under(parent, relative)):
                    copy_regular(source_relative)
    materializer.require_control_plane_overlay_payloads(candidate)
    copied_set = set(copied)
    return {
        "copied": sorted(copied_set),
        "skipped": sorted(set(skipped) - copied_set),
        "allowlist": sorted(allowlist),
    }


def inherited_v2_paths(parent_runtime_root: Optional[Path], manifest: dict, materializer):
    if parent_runtime_root in {None, ""}:
        return set()
    parent_root = materializer.require_real_directory(Path(parent_runtime_root), "parent mounted runtime root")
    parent_manifest, _ = materializer.parse_manifest(parent_root / materializer.LOCAL_MANIFEST)
    parent_by_path = {entry["path"]: entry for entry in parent_manifest["files"]}
    return {
        entry["path"]
        for entry in manifest["files"]
        if entry["path"] in parent_by_path
        and parent_by_path[entry["path"]]["sizeBytes"] == entry["sizeBytes"]
        and parent_by_path[entry["path"]]["sha256"] == entry["sha256"]
    }


def verify_mounted_v2(
    runtime_root: Path,
    verification_receipt: Path,
    release_id: str,
    blob_root: Optional[Path] = None,
    parent_runtime_root: Optional[Path] = None,
):
    materializer = load_v2_materializer()
    root = materializer.require_real_directory(Path(runtime_root), "mounted runtime root")
    helper = materializer.require_helper_directory(root)
    if blob_root not in {None, ""}:
        provided = materializer.require_real_directory(Path(blob_root), "blob root")
        if provided != helper:
            fail(
                "v2 mounted verification requires the helper root at runtime_root/%s"
                % materializer.RUNTIME_BLOB_HELPER_NAME
            )
    manifest_path = root / materializer.LOCAL_MANIFEST
    manifest, manifest_wire = materializer.parse_manifest(manifest_path)
    if manifest["releaseId"] != release_id:
        fail("mounted runtime manifest release does not match requested release")
    if manifest["sourceRevision"] != manifest["sourceRevision"].lower():
        fail("mounted runtime manifest source revision must be lowercase")
    if materializer.canonical(manifest) + b"\n" != manifest_wire:
        fail("mounted runtime manifest wire bytes are not canonical")
    receipt_identity = verify_v2_receipt(Path(verification_receipt), manifest, manifest_wire, release_id, materializer)
    overlay_paths = set(materializer.CONTROL_PLANE_OVERLAY_PATHS)
    overlay_paths.update(materializer.discover_control_plane_overlay_regular_paths(root))
    materializer.require_control_plane_overlay_payloads(root)
    view_receipt, _ = materializer.verify_view_structure(
        root,
        release_id,
        allowed_extra_regular_paths=overlay_paths,
    )
    verification_value, _ = read_regular_json(Path(verification_receipt), "v2 verification receipt")
    if (
        verification_value.get("schemaVersion") in {V2_MATERIALIZATION_SCHEMA, materializer.MATERIALIZATION_CACHE_SCHEMA}
        and verification_value != view_receipt
    ):
        fail("v2 materialization receipt does not match the mounted view")
    cached_paths = set(materializer.cached_logical_paths(view_receipt))
    inherited_paths = inherited_v2_paths(parent_runtime_root, manifest, materializer)
    changed_paths = {entry["path"] for entry in manifest["files"]} - inherited_paths
    textbook_cache_paths = set(materializer.TEXTBOOK_RETRIEVAL_CACHE_PATHS) | set(
        materializer.LEGACY_TEXTBOOK_RETRIEVAL_CACHE_PATHS
    )

    expected_paths = {entry["path"] for entry in manifest["files"]}
    expected_directories = set()
    for relative in expected_paths:
        parts = relative.split("/")[:-1]
        expected_directories.update("/".join(parts[:index]) for index in range(1, len(parts) + 1))
    actual_paths = set()
    actual_directories = set()
    helper_name = materializer.RUNTIME_BLOB_HELPER_NAME
    for current, directories, filenames in os.walk(root, followlinks=False):
        current_path = Path(current)
        if current_path == root:
            directories[:] = [directory for directory in directories if directory != helper_name]
        for directory in directories:
            candidate = current_path / directory
            details = os.lstat(candidate)
            if stat.S_ISLNK(details.st_mode) or not stat.S_ISDIR(details.st_mode):
                fail("mounted runtime contains a symlinked or non-directory logical directory")
            actual_directories.add(candidate.relative_to(root).as_posix())
        for filename in filenames:
            candidate = current_path / filename
            relative = candidate.relative_to(root).as_posix()
            if relative in {materializer.LOCAL_MANIFEST, materializer.LOCAL_RECEIPT}:
                continue
            actual_paths.add(relative)
    undeclared = actual_paths - expected_paths - overlay_paths
    if undeclared:
        fail("mounted runtime contains undeclared non-overlay files")
    if expected_paths - actual_paths:
        fail("mounted runtime file set differs from manifest")
    overlay_directories = set()
    for relative in (actual_paths & overlay_paths) | (expected_paths & overlay_paths):
        parts = relative.split("/")[:-1]
        overlay_directories.update("/".join(parts[:index]) for index in range(1, len(parts) + 1))
    if actual_directories - expected_directories - overlay_directories:
        fail("mounted runtime directory set differs from manifest")
    if expected_directories - actual_directories:
        fail("mounted runtime directory set differs from manifest")

    representative_candidates = [entry for entry in manifest["files"] if entry["sizeBytes"] <= REPRESENTATIVE_MAX_BYTES]
    if not representative_candidates:
        fail("mounted runtime has no bounded representative file for content smoke")
    representative_indexes = sorted({0, len(representative_candidates) // 2, len(representative_candidates) - 1})
    representative_paths = {representative_candidates[index]["path"] for index in representative_indexes}
    verified_body_paths = changed_paths | representative_paths | (textbook_cache_paths & expected_paths)
    for entry in manifest["files"]:
        logical = root / entry["path"]
        details = os.lstat(logical)
        if entry["path"] in overlay_paths and not stat.S_ISLNK(details.st_mode):
            if not stat.S_ISREG(details.st_mode):
                fail(f"mounted runtime overlay is not a regular file: {entry['path']}")
            continue
        if entry["path"] in cached_paths:
            if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode):
                fail(f"mounted runtime cache entry is not a regular file: {entry['path']}")
            if details.st_size != entry["sizeBytes"]:
                fail(f"mounted runtime logical file does not match manifest content: {entry['path']}")
            if entry["path"] in verified_body_paths and materializer.hash_file(logical) != entry["sha256"]:
                fail(f"mounted runtime logical file does not match manifest content: {entry['path']}")
            continue
        if not stat.S_ISLNK(details.st_mode):
            fail(f"mounted runtime logical file is not a symlink: {entry['path']}")
        materializer.require_relative_helper_link(logical, entry["path"], entry["sha256"])
        if entry["path"] not in verified_body_paths:
            continue
        target = Path(os.path.realpath(logical))
        try:
            expected_blob = materializer.blob_path(helper, entry["sha256"])
        except OSError as error:
            fail(f"mounted runtime helper target is missing: {entry['path']} ({error})")
        if target != expected_blob or target.parent != helper or target.name != entry["sha256"]:
            fail(f"mounted runtime logical file points outside its manifest blob: {entry['path']}")
        blob_details = os.lstat(target)
        if stat.S_ISLNK(blob_details.st_mode) or not stat.S_ISREG(blob_details.st_mode):
            fail(f"mounted runtime blob is not a regular file: {entry['path']}")
        if blob_details.st_size != entry["sizeBytes"]:
            fail(f"mounted runtime logical file does not match manifest content: {entry['path']}")
        if entry["path"] in verified_body_paths and materializer.hash_file(target) != entry["sha256"]:
            fail(f"mounted runtime logical file does not match manifest content: {entry['path']}")
    return {
        **receipt_identity,
        "inheritedPathCount": len(inherited_paths),
        "changedPathCount": len(changed_paths),
        "changedBodyReadCount": len(changed_paths),
        "representativeSampleCount": len(representative_paths),
        "helperLookupCount": len(verified_body_paths - cached_paths),
    }


def select(args: argparse.Namespace):
    state_dir = Path(args.state_dir)
    previous = read_json(state_dir / SELECTION_FILE, require_selection)
    active = read_json(state_dir / ACTIVE_RECEIPT_FILE, require_active_receipt)
    expected_active = None if args.expected_active_release == "none" else require_release_id(args.expected_active_release, "expected active release")
    if expected_active != (active["selection"]["releaseId"] if active else None):
        fail("expected active release does not match active receipt")
    verification = read_verified_receipt(Path(args.verification_receipt))
    selection = {
        "schemaVersion": "runtime-release-selection.v1",
        "generation": (previous["generation"] if previous else 0) + 1,
        **verification,
    }
    write_atomic(state_dir / SELECTION_FILE, selection)
    return selection


def mark_active(args: argparse.Namespace):
    state_dir = Path(args.state_dir)
    selection = read_json(state_dir / SELECTION_FILE, require_selection)
    if not selection:
        fail("desired runtime selection is absent")
    if args.release_id != selection["releaseId"]:
        fail("requested active release does not match desired selection")
    deployment_values = [args.app_revision, args.image_digest, args.release_locator_sha256]
    if any(value is not None for value in deployment_values) and not all(value is not None for value in deployment_values):
        fail("active receipt deployment proof is incomplete")
    receipt = {
        "schemaVersion": "runtime-release-active-receipt.v1",
        "selection": selection,
        "healthCheck": "readyz",
    }
    if all(value is not None for value in deployment_values):
        receipt["deployment"] = require_deployment({
            "appRevision": args.app_revision,
            "imageDigest": args.image_digest,
            "releaseLocatorSha256": args.release_locator_sha256,
        })
    write_atomic(state_dir / ACTIVE_RECEIPT_FILE, receipt)
    return receipt


def mark_active_v2(args: argparse.Namespace):
    """Project one committed v2 lifecycle identity into the v1 files.

    The v2 transaction helper owns the cross-file fence. This command keeps
    the old selector/receipt schema for existing consumers while allowing
    recovery to rebuild a missing, damaged, or stale active receipt from the
    v2 authority.
    """
    state_dir = Path(args.state_dir)
    release = require_release_id(args.release_id)
    manifest_sha = require_digest(args.manifest_sha256, "manifestSha256")
    tree_sha = require_digest(args.tree_sha256, "treeSha256")
    previous_selection = None
    previous_receipt = None
    try:
        previous_selection = read_json(state_dir / SELECTION_FILE, require_selection)
    except (OSError, ValueError, json.JSONDecodeError):
        previous_selection = None
    try:
        previous_receipt = read_json(state_dir / ACTIVE_RECEIPT_FILE, require_active_receipt)
    except (OSError, ValueError, json.JSONDecodeError):
        previous_receipt = None
    current_generation = 0
    for value in (previous_selection, previous_receipt.get("selection") if previous_receipt else None):
        if value and value.get("generation", 0) > current_generation:
            current_generation = value["generation"]
    if previous_selection and previous_selection["releaseId"] == release and previous_selection["manifestSha256"] == manifest_sha and previous_selection["treeSha256"] == tree_sha:
        selection = previous_selection
    else:
        selection = {
            "schemaVersion": "runtime-release-selection.v1",
            "generation": current_generation + 1,
            "releaseId": release,
            "manifestSha256": manifest_sha,
            "treeSha256": tree_sha,
        }
        write_atomic(state_dir / SELECTION_FILE, selection)
    receipt = {
        "schemaVersion": "runtime-release-active-receipt.v1",
        "selection": selection,
        "healthCheck": "readyz",
    }
    write_atomic(state_dir / ACTIVE_RECEIPT_FILE, receipt)
    return receipt


def write_candidate_readyz_receipt(args: argparse.Namespace):
    """Write a container-scoped readiness receipt for the selected candidate.

    This deliberately does not update the canonical active receipt.  Runtime
    activation needs the candidate container to validate its own immutable
    manifest before the lifecycle transaction can truthfully project that
    candidate as globally active.  The caller mounts this file only into the
    candidate container, then must rebind it to the canonical receipt after
    activation commits.
    """
    state_dir = require_real_directory(Path(args.state_dir), "state directory")
    selection = read_json(state_dir / SELECTION_FILE, require_selection)
    if selection is None:
        fail("desired runtime selection is absent")
    expected = {
        "releaseId": require_release_id(args.release_id),
        "manifestSha256": require_digest(args.manifest_sha256, "manifestSha256"),
        "treeSha256": require_digest(args.tree_sha256, "treeSha256"),
    }
    if {key: selection[key] for key in expected} != expected:
        fail("desired runtime selection does not match candidate identity")
    receipt_dir = require_real_directory(Path(args.receipt_dir), "candidate receipt directory")
    receipt_path = receipt_dir / ACTIVE_RECEIPT_FILE
    if receipt_path.is_symlink():
        fail("candidate receipt path must not be a symlink")
    receipt = {
        "schemaVersion": "runtime-release-active-receipt.v1",
        "selection": selection,
        "healthCheck": "readyz",
    }
    write_atomic(receipt_path, receipt)
    persisted = read_json(receipt_path, require_active_receipt)
    if persisted != receipt:
        fail("candidate readiness receipt does not match selected identity")
    return receipt


def active(args: argparse.Namespace):
    receipt = read_json(Path(args.state_dir) / ACTIVE_RECEIPT_FILE, require_active_receipt)
    return {
        "activeReleaseId": receipt["selection"]["releaseId"] if receipt else None,
        "selection": receipt["selection"] if receipt else None,
    }


def restore_overlays(args: argparse.Namespace):
    return restore_control_plane_overlays(Path(args.parent_runtime_root), Path(args.candidate_runtime_root))


def verify_mounted(args: argparse.Namespace):
    if getattr(args, "format", "v1") == "v2":
        return verify_mounted_v2(
            Path(args.runtime_root),
            Path(args.verification_receipt),
            require_release_id(args.release_id),
            Path(args.blob_root) if args.blob_root else None,
            Path(args.parent_runtime_root) if args.parent_runtime_root else None,
        )
    root_path = Path(args.runtime_root)
    try:
        root_details = os.lstat(root_path)
    except OSError as error:
        fail(f"mounted runtime root is invalid: {error}")
    if stat.S_ISLNK(root_details.st_mode) or not stat.S_ISDIR(root_details.st_mode):
        fail("mounted runtime root is invalid")
    root = root_path.resolve()
    verification = read_verified_receipt(Path(args.verification_receipt))
    if verification["releaseId"] != args.release_id:
        fail("verification receipt release does not match requested release")
    manifest_path = root / ".act-runtime-release.v1.json"
    if manifest_path.is_symlink():
        fail("mounted runtime manifest must not be a symlink")
    with manifest_path.open("rb") as handle:
        manifest = json.load(handle)
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != "act-runtime-release.v1":
        fail("mounted runtime manifest is invalid")
    if manifest.get("releaseId") != verification["releaseId"]:
        fail("mounted runtime manifest release does not match verification receipt")
    manifest_digest = manifest.get("manifestSha256")
    without_digest = {key: value for key, value in manifest.items() if key != "manifestSha256"}
    canonical = json.dumps(without_digest, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")
    if hashlib.sha256(canonical).hexdigest() != manifest_digest or manifest_digest != verification["manifestSha256"]:
        fail("mounted runtime manifest digest does not match verification receipt")
    if manifest.get("treeSha256") != verification["treeSha256"] or not isinstance(manifest.get("files"), list):
        fail("mounted runtime tree identity does not match verification receipt")
    expected = {}
    for entry in manifest["files"]:
        if not isinstance(entry, dict):
            fail("mounted runtime manifest file entry is invalid")
        relative = entry.get("path")
        if not isinstance(relative, str) or not relative or relative.startswith("/") or "\\" in relative or any(part in {"", ".", ".."} for part in relative.split("/")):
            fail("mounted runtime manifest path is invalid")
        size = entry.get("sizeBytes")
        digest = entry.get("sha256")
        if not isinstance(size, int) or size < 0 or not isinstance(digest, str) or not SHA256.fullmatch(digest):
            fail("mounted runtime manifest file identity is invalid")
        if relative in expected:
            fail("mounted runtime manifest contains duplicate paths")
        expected[relative] = (size, digest)
    if manifest.get("fileCount") != len(expected):
        fail("mounted runtime manifest file count does not match its entries")
    if manifest.get("totalBytes") != sum(size for size, _ in expected.values()):
        fail("mounted runtime manifest total bytes do not match its entries")
    tree_entries = [
        {"path": relative, "sizeBytes": size, "sha256": digest}
        for relative, (size, digest) in sorted(expected.items())
    ]
    tree_payload = json.dumps(tree_entries, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")
    if hashlib.sha256(tree_payload).hexdigest() != manifest.get("treeSha256"):
        fail("mounted runtime manifest tree digest does not match its entries")
    actual = set()
    for current, directories, filenames in os.walk(root, followlinks=False):
        current_path = Path(current)
        for directory in directories:
            if (current_path / directory).is_symlink():
                fail("mounted runtime contains a symlink")
        for filename in filenames:
            absolute = current_path / filename
            relative = absolute.relative_to(root).as_posix()
            if relative == ".act-runtime-release.v1.json":
                continue
            if absolute.is_symlink() or not absolute.is_file():
                fail("mounted runtime contains a non-regular file")
            actual.add(relative)
    if actual != set(expected):
        fail("mounted runtime file set differs from manifest")
    for relative, (size, digest) in expected.items():
        absolute = root / relative
        if absolute.stat().st_size != size:
            fail(f"mounted runtime size mismatch: {relative}")
    candidates = [
        (relative, size, digest)
        for relative, (size, digest) in sorted(expected.items())
        if size <= REPRESENTATIVE_MAX_BYTES
    ]
    if not candidates:
        fail("mounted runtime has no bounded representative file for content smoke")
    selected_indexes = sorted({0, len(candidates) // 2, len(candidates) - 1})
    for index in selected_indexes:
        relative, _, digest = candidates[index]
        hash_value = hashlib.sha256()
        absolute = root / relative
        with absolute.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                hash_value.update(chunk)
        if hash_value.hexdigest() != digest:
            fail(f"mounted runtime representative hash mismatch: {relative}")
    return {
        "releaseId": verification["releaseId"],
        "fileCount": len(expected),
        "totalBytes": sum(size for size, _ in expected.values()),
        "representativeSampleCount": len(selected_indexes),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    subcommands = parser.add_subparsers(dest="command")
    selector = subcommands.add_parser("select")
    selector.add_argument("--state-dir", required=True)
    selector.add_argument("--expected-active-release", required=True)
    selector.add_argument("--verification-receipt", required=True)
    marker = subcommands.add_parser("mark-active")
    marker.add_argument("--state-dir", required=True)
    marker.add_argument("--release-id", required=True)
    marker.add_argument("--app-revision")
    marker.add_argument("--image-digest")
    marker.add_argument("--release-locator-sha256")
    marker_v2 = subcommands.add_parser("mark-active-v2")
    marker_v2.add_argument("--state-dir", required=True)
    marker_v2.add_argument("--release-id", required=True)
    marker_v2.add_argument("--manifest-sha256", required=True)
    marker_v2.add_argument("--tree-sha256", required=True)
    candidate_receipt = subcommands.add_parser("candidate-readyz-receipt")
    candidate_receipt.add_argument("--state-dir", required=True)
    candidate_receipt.add_argument("--release-id", required=True)
    candidate_receipt.add_argument("--manifest-sha256", required=True)
    candidate_receipt.add_argument("--tree-sha256", required=True)
    candidate_receipt.add_argument("--receipt-dir", required=True)
    active_parser = subcommands.add_parser("active")
    active_parser.add_argument("--state-dir", required=True)
    mounted = subcommands.add_parser("verify-mounted")
    mounted.add_argument("--runtime-root", required=True)
    mounted.add_argument("--release-id", required=True)
    mounted.add_argument("--verification-receipt", required=True)
    mounted.add_argument("--format", choices=("v1", "v2"), default="v1")
    mounted.add_argument("--blob-root")
    mounted.add_argument("--parent-runtime-root")
    restore = subcommands.add_parser("restore-overlays")
    restore.add_argument("--parent-runtime-root", required=True)
    restore.add_argument("--candidate-runtime-root", required=True)
    args = parser.parse_args()
    if args.command is None:
        parser.error("a command is required")
    result = {
        "select": select,
        "mark-active": mark_active,
        "mark-active-v2": mark_active_v2,
        "candidate-readyz-receipt": write_candidate_readyz_receipt,
        "active": active,
        "verify-mounted": verify_mounted,
        "restore-overlays": restore_overlays,
    }[args.command](args)
    print(json.dumps(result, separators=(",", ":"), sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)
