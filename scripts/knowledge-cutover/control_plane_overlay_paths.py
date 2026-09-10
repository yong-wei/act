#!/usr/bin/env python3
"""Control-plane overlay path helpers used by successor Teaching installers."""

import json
import os
import re
import stat
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple


MANIFEST_SCHEMA = "act-runtime-release.v2"
RECEIPT_SCHEMA = "act-runtime-release-receipt.v2"
MATERIALIZATION_SCHEMA = "runtime-blob-materialization.v1"
MATERIALIZATION_CACHE_SCHEMA = "runtime-blob-materialization.v2"
AUDIT_SCHEMA = "runtime-blob-audit.v1"
LOCAL_MANIFEST = ".act-runtime-release.v2.json"
LOCAL_RECEIPT = ".act-runtime-release-materialization.v1.json"
LOCAL_RELEASE_RECEIPT = ".act-runtime-release-receipt.v2.json"
VIEW_CONTROL_REGULAR_FILES = frozenset({LOCAL_MANIFEST, LOCAL_RECEIPT, LOCAL_RELEASE_RECEIPT})
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
CONTROL_PLANE_OVERLAY_PATHS = (
    "knowledge/projection/current.json",
    "knowledge/prerequisites/current.json",
    "knowledge/authority-domain-catalog/current.json",
    "knowledge/authority-domain-shards/current.json",
    "knowledge/consumer-activation/current.json",
    "knowledge/production-cutover-transactions/current.json",
    "knowledge/teaching-projection/domain-fragments/current.json",
)
OVERLAY_IDENTITY = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,126}$")
LEGACY_TEXTBOOK_RETRIEVAL_CACHE_PATHS = (
    "resources/textbook-retrieval/bodies.utf8",
    "resources/textbook-retrieval/lexical-postings.bin",
    "resources/textbook-retrieval/vectors.f32",
)

def fail(message: str) -> None:
    raise ValueError(message)


def require_overlay_identity(value: Any, label: str) -> str:
    if not isinstance(value, str) or not OVERLAY_IDENTITY.fullmatch(value) or ".." in value or "/" in value:
        fail("control-plane overlay %s is invalid" % label)
    return value


def read_control_plane_pointer(path: Path) -> Dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        fail("control-plane overlay is not valid JSON: %s (%s)" % (path.as_posix(), error))
    if not isinstance(value, dict):
        fail("control-plane overlay is not a JSON object: %s" % path.as_posix())
    return value


def control_plane_payload_targets(pointer_relative: str, pointer: Dict[str, Any]) -> List[Tuple[str, str]]:
    targets: List[Tuple[str, str]] = []
    if pointer_relative == "knowledge/projection/current.json" and pointer.get("projectionId"):
        identity = require_overlay_identity(pointer["projectionId"], "projectionId")
        targets.append(("prefix", "knowledge/projection/releases/%s" % identity))
    elif pointer_relative == "knowledge/prerequisites/current.json" and pointer.get("publicationId"):
        identity = require_overlay_identity(pointer["publicationId"], "publicationId")
        targets.append(("prefix", "knowledge/prerequisites/releases/%s" % identity))
    elif pointer_relative == "knowledge/authority-domain-catalog/current.json":
        targets.append(("file", "knowledge/authority-domain-catalog/catalog.json"))
    elif pointer_relative == "knowledge/authority-domain-shards/current.json" and pointer.get("shardSetId"):
        identity = require_overlay_identity(pointer["shardSetId"], "shardSetId")
        targets.append(("prefix", "knowledge/authority-domain-shards/sets/%s" % identity))
    elif pointer_relative == "knowledge/consumer-activation/current.json":
        if pointer.get("activationId"):
            identity = require_overlay_identity(pointer["activationId"], "activationId")
            targets.append(("prefix", "knowledge/consumer-activation/releases/%s" % identity))
        if pointer.get("activationReceiptId"):
            identity = require_overlay_identity(pointer["activationReceiptId"], "activationReceiptId")
            targets.append(("any_file", "knowledge/consumer-activation/activations/%s.json" % identity))
            targets.append(("any_file", "knowledge/consumer-activation/rollbacks/%s.json" % identity))
    elif pointer_relative == "knowledge/production-cutover-transactions/current.json" and pointer.get("transactionId"):
        identity = require_overlay_identity(pointer["transactionId"], "transactionId")
        targets.append(("file", "knowledge/production-cutover-transactions/%s.json" % identity))
        targets.append(("file", "knowledge/consumer-activation/first-activation-transactions/%s.json" % identity))
        targets.append(("optional_file", "knowledge/production-cutover-transactions/%s.rollback.json" % identity))
    elif pointer_relative == "knowledge/teaching-projection/domain-fragments/current.json" and pointer.get("projectionId"):
        identity = require_overlay_identity(pointer["projectionId"], "projectionId")
        targets.append(("prefix", "knowledge/teaching-projection/domain-fragments/releases/%s" % identity))
    return targets


def regular_files_under(root: Path, prefix: str) -> Set[str]:
    directory = root / prefix
    found: Set[str] = set()
    try:
        details = os.lstat(directory)
    except OSError:
        return found
    if stat.S_ISLNK(details.st_mode) or not stat.S_ISDIR(details.st_mode):
        return found
    for current, directories, filenames in os.walk(str(directory), followlinks=False):
        current_path = Path(current)
        directories[:] = [
            name for name in directories
            if not os.path.islink(str(current_path / name))
        ]
        for name in filenames:
            absolute = current_path / name
            file_details = os.lstat(absolute)
            if stat.S_ISLNK(file_details.st_mode) or not stat.S_ISREG(file_details.st_mode):
                continue
            found.add(absolute.relative_to(root).as_posix())
    return found


def payload_present(root: Path, kind: str, relative: str) -> bool:
    if kind == "file":
        candidate = root / relative
        try:
            details = os.lstat(candidate)
        except OSError:
            return False
        return stat.S_ISREG(details.st_mode) or stat.S_ISLNK(details.st_mode)
    directory = root / relative
    try:
        details = os.lstat(directory)
    except OSError:
        return False
    if stat.S_ISLNK(details.st_mode) or not stat.S_ISDIR(details.st_mode):
        return False
    for current, _, filenames in os.walk(str(directory), followlinks=False):
        if filenames:
            return True
    return False


def discover_control_plane_overlay_regular_paths(view: Path) -> Set[str]:
    extras: Set[str] = set()
    for pointer_relative in CONTROL_PLANE_OVERLAY_PATHS:
        pointer_path = view / pointer_relative
        try:
            details = os.lstat(pointer_path)
        except OSError:
            continue
        if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode):
            continue
        extras.add(pointer_relative)
        pointer = read_control_plane_pointer(pointer_path)
        for kind, relative in control_plane_payload_targets(pointer_relative, pointer):
            if kind in {"file", "optional_file", "any_file"}:
                candidate = view / relative
                try:
                    file_details = os.lstat(candidate)
                except OSError:
                    continue
                if stat.S_ISLNK(file_details.st_mode) or not stat.S_ISREG(file_details.st_mode):
                    continue
                extras.add(relative)
            else:
                extras.update(regular_files_under(view, relative))
    return extras


def require_authority_domain_catalog_overlay_match(view: Path, pointer: Dict[str, Any]) -> None:
    """Require a host-owned catalog payload to close over its active pointer.

    A regular catalog ``current.json`` is a host control-plane overlay.  Its
    payload cannot be satisfied by an arbitrary manifest leaf: the runtime
    loader binds catalog and Authority snapshot/release identities before it
    serves the active graph.  Validate the same closure before a candidate
    view is selected so a stale symlinked catalog cannot survive an overlay
    restore and fail only after consumers switch.
    """
    relative = "knowledge/authority-domain-catalog/catalog.json"
    path = view / relative
    try:
        details = os.lstat(path)
    except OSError as error:
        fail("control-plane authority catalog payload is unavailable: %s (%s)" % (relative, error))
    if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode):
        fail("control-plane authority catalog payload must be a regular non-symlink file: %s" % relative)
    runtime = read_control_plane_pointer(path)
    binding = runtime.get("authorityBinding")
    if not isinstance(binding, dict):
        fail("control-plane authority catalog payload has no authority binding")
    expected = {
        "catalogId": pointer.get("catalogId"),
        "catalogHash": pointer.get("catalogHash"),
        "snapshotId": pointer.get("snapshotId"),
        "snapshotHash": pointer.get("snapshotHash"),
        "releaseId": pointer.get("releaseId"),
    }
    actual = {
        "catalogId": runtime.get("catalogId"),
        "catalogHash": runtime.get("catalogHash"),
        "snapshotId": binding.get("snapshotId"),
        "snapshotHash": binding.get("snapshotHash"),
        "releaseId": binding.get("releaseId"),
    }
    if actual != expected:
        fail("control-plane authority catalog runtime does not match current pointer")


def require_control_plane_overlay_payloads(view: Path) -> None:
    for pointer_relative in CONTROL_PLANE_OVERLAY_PATHS:
        pointer_path = view / pointer_relative
        try:
            details = os.lstat(pointer_path)
        except OSError:
            continue
        if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode):
            continue
        pointer = read_control_plane_pointer(pointer_path)
        if pointer_relative == "knowledge/authority-domain-catalog/current.json":
            require_authority_domain_catalog_overlay_match(view, pointer)
        any_files = []
        for kind, relative in control_plane_payload_targets(pointer_relative, pointer):
            if kind == "optional_file":
                continue
            if kind == "any_file":
                any_files.append(relative)
                continue
            if not payload_present(view, kind, relative):
                fail("control-plane overlay payload is missing: %s" % relative)
        if any_files and not any(payload_present(view, "file", relative) for relative in any_files):
            fail("control-plane overlay payload is missing: %s" % any_files[0])


