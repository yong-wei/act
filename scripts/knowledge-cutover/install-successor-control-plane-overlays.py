#!/usr/bin/env python3
"""Install successor Teaching control-plane overlays onto a selected blob-view.

#1509 10.7 commits host Authority, then activate-runtime-blob-release restores
parent Teaching overlays onto the successor Runtime view. That leaves host
Authority on v0.37 while blob-view Teaching stays on v0.22.

This installer does not write Authority current.json, Runtime identity, OSS
objects, or a new Runtime release. It copies successor overlay pointers from a
Git runtime snapshot, then removes predecessor overlay regular files that would
fail view verification.
"""

from __future__ import print_function

import argparse
import hashlib
import importlib.util
import json
import os
import stat
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional


REQUIRED_POINTER_RELATIVES = (
    "knowledge/projection/current.json",
    "knowledge/prerequisites/current.json",
    "knowledge/authority-domain-catalog/current.json",
    "knowledge/authority-domain-shards/current.json",
    "knowledge/consumer-activation/current.json",
    "knowledge/teaching-projection/domain-fragments/current.json",
)
PREFIX_PAYLOAD_POINTER_RELATIVES = (
    "knowledge/teaching-projection/domain-fragments/current.json",
)
CATALOG_PAYLOAD_RELATIVE = "knowledge/authority-domain-catalog/catalog.json"


def fail(message):
    # type: (str) -> None
    raise ValueError(message)


def load_materializer():
    candidates = [
        Path(__file__).resolve().parents[1] / "materialize-runtime-blob-release.py",
        Path(__file__).resolve().parents[1] / "runtime-release" / "materialize-runtime-blob-release.py",
    ]
    last_error = "materializer is unavailable"
    for path in candidates:
        if not path.is_file() or path.is_symlink():
            continue
        spec = importlib.util.spec_from_file_location("materialize_runtime_blob_release", str(path))
        if spec is None or spec.loader is None:
            continue
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        if hasattr(module, "read_control_plane_pointer") and hasattr(module, "discover_control_plane_overlay_regular_paths"):
            return module
        last_error = "materializer %s lacks control-plane overlay helpers" % path
    fail(last_error)


def require_real_directory(path, label):
    # type: (Path, str) -> Path
    try:
        details = os.lstat(str(path))
    except OSError as error:
        fail("%s is missing: %s" % (label, error))
    if stat.S_ISLNK(details.st_mode) or not stat.S_ISDIR(details.st_mode):
        fail("%s must be a real directory" % label)
    return path.resolve()


def require_regular_file(path, label):
    # type: (Path, str) -> Path
    try:
        details = os.lstat(str(path))
    except OSError as error:
        fail("%s is missing: %s" % (label, error))
    if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode):
        fail("%s must be a regular non-symlink file" % label)
    return path


def read_json(path):
    # type: (Path) -> Dict[str, Any]
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        fail("%s is not a JSON object" % path)
    return value


def sha256_file(path):
    # type: (Path) -> str
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_regular_bytes(path, body):
    # type: (Path, bytes) -> None
    path.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(str(path.parent), 0o755)
    temporary = path.parent / (".%s.%s.tmp" % (path.name, os.getpid()))
    if temporary.exists() or temporary.is_symlink():
        temporary.unlink()
    with temporary.open("wb") as handle:
        handle.write(body)
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(str(temporary), 0o644)
    os.replace(str(temporary), str(path))


def copy_regular(source, destination):
    # type: (Path, Path) -> str
    require_regular_file(source, str(source))
    with source.open("rb") as handle:
        body = handle.read()
    write_regular_bytes(destination, body)
    return sha256_file(destination)


def unlink_regular(path):
    # type: (Path) -> bool
    try:
        details = os.lstat(str(path))
    except OSError:
        return False
    if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode):
        return False
    path.unlink()
    return True


def prune_empty_directories(root, relative):
    # type: (Path, str) -> None
    current = (root / relative).resolve()
    root_resolved = root.resolve()
    while current != root_resolved and str(current).startswith(str(root_resolved) + os.sep):
        try:
            details = os.lstat(str(current))
        except OSError:
            return
        if stat.S_ISLNK(details.st_mode) or not stat.S_ISDIR(details.st_mode):
            return
        try:
            os.rmdir(str(current))
        except OSError:
            return
        current = current.parent


def pointer_authority_release_id(pointer):
    # type: (Dict[str, Any]) -> Optional[str]
    for key in ("authorityReleaseId", "releaseId"):
        value = pointer.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def collect_source_overlay_files(source_root, materializer):
    # type: (Path, Any) -> List[str]
    relatives = list(REQUIRED_POINTER_RELATIVES)
    relatives.append(CATALOG_PAYLOAD_RELATIVE)
    files = []
    seen = set()
    for relative in relatives:
        require_regular_file(source_root / relative, relative)
        if relative not in seen:
            files.append(relative)
            seen.add(relative)
        if not relative.endswith("/current.json"):
            continue
        pointer = materializer.read_control_plane_pointer(source_root / relative)
        for kind, payload_relative in materializer.control_plane_payload_targets(relative, pointer):
            if kind == "prefix":
                if relative not in PREFIX_PAYLOAD_POINTER_RELATIVES:
                    continue
                for extra in sorted(materializer.regular_files_under(source_root, payload_relative)):
                    require_regular_file(source_root / extra, extra)
                    if extra not in seen:
                        files.append(extra)
                        seen.add(extra)
            elif kind in {"file", "any_file"}:
                candidate = source_root / payload_relative
                try:
                    details = os.lstat(str(candidate))
                except OSError:
                    continue
                if stat.S_ISREG(details.st_mode) and not stat.S_ISLNK(details.st_mode):
                    if payload_relative not in seen:
                        files.append(payload_relative)
                        seen.add(payload_relative)
    return files


def require_domain_teaching_closure(source_root, pointer, expected_hash):
    # type: (Path, Dict[str, Any], str) -> None
    projection_id = pointer.get("projectionId")
    projection_hash = pointer.get("projectionHash")
    if not isinstance(projection_id, str) or not projection_id:
        fail("domain teaching projectionId is missing")
    if projection_hash != expected_hash:
        fail("successor domain teaching projection hash does not match the expected identity")
    release = source_root / "knowledge/teaching-projection/domain-fragments/releases" / projection_id
    manifest_path = release / "composed-manifest.json"
    require_regular_file(manifest_path, "knowledge/teaching-projection/domain-fragments/releases/%s/composed-manifest.json" % projection_id)
    manifest = read_json(manifest_path)
    if manifest.get("projectionId") != projection_id or manifest.get("projectionHash") != expected_hash:
        fail("composed-manifest identity does not match the expected domain teaching projection")
    fragments = manifest.get("fragments")
    if not isinstance(fragments, list) or not fragments:
        fail("composed-manifest does not declare any domain teaching fragments")
    ordered = []
    for item in fragments:
        if not isinstance(item, dict):
            fail("composed-manifest fragment ref is invalid")
        ordered.append(item)
    ordered.sort(key=lambda item: item["order"] if isinstance(item.get("order"), int) else -1)
    for ref in ordered:
        fragment_id = ref.get("fragmentId")
        fragment_digest = ref.get("fragmentDigest")
        if not isinstance(fragment_id, str) or not fragment_id:
            fail("composed-manifest fragmentId is missing")
        relative = "knowledge/teaching-projection/domain-fragments/releases/%s/fragments/%s.json" % (
            projection_id,
            fragment_id,
        )
        require_regular_file(source_root / relative, relative)
        fragment = read_json(source_root / relative)
        if fragment.get("fragmentId") != fragment_id:
            fail("domain teaching fragment %s identity drifted" % fragment_id)
        if isinstance(fragment_digest, str) and fragment.get("fragmentDigest") != fragment_digest:
            fail("domain teaching fragment %s digest drifted" % fragment_id)


def plan_install(
    view,
    source_root,
    expected_authority_release_id,
    expected_teaching_projection_hash,
    expected_domain_teaching_projection_hash,
    materializer,
):
    # type: (Path, Path, str, str, str, Any) -> Dict[str, Any]
    source_files = collect_source_overlay_files(source_root, materializer)
    successor_pointers = {}
    for relative in REQUIRED_POINTER_RELATIVES:
        pointer = materializer.read_control_plane_pointer(source_root / relative)
        authority = pointer_authority_release_id(pointer)
        if authority is not None and authority != expected_authority_release_id:
            fail("%s authority identity is not the expected successor (%s keys=%s)" % (
                relative, authority, sorted(pointer.keys()),
            ))
        successor_pointers[relative] = pointer
    teaching_hash = successor_pointers["knowledge/projection/current.json"].get("projectionHash")
    if teaching_hash != expected_teaching_projection_hash:
        fail("successor teaching projection hash does not match the expected identity")
    domain_hash = successor_pointers["knowledge/teaching-projection/domain-fragments/current.json"].get("projectionHash")
    if domain_hash != expected_domain_teaching_projection_hash:
        fail("successor domain teaching projection hash does not match the expected identity")
    require_domain_teaching_closure(
        source_root,
        successor_pointers["knowledge/teaching-projection/domain-fragments/current.json"],
        expected_domain_teaching_projection_hash,
    )
    predecessor_regular = set(materializer.discover_control_plane_overlay_regular_paths(view))
    return {
        "successorPointers": successor_pointers,
        "predecessorRegularPaths": sorted(predecessor_regular),
        "sourceFiles": source_files,
    }


def apply_install(
    view,
    source_root,
    expected_authority_release_id,
    expected_teaching_projection_hash,
    expected_domain_teaching_projection_hash,
    materializer,
):
    # type: (Path, Path, str, str, str, Any) -> Dict[str, Any]
    plan = plan_install(
        view,
        source_root,
        expected_authority_release_id,
        expected_teaching_projection_hash,
        expected_domain_teaching_projection_hash,
        materializer,
    )
    copied = {}
    for relative in plan["sourceFiles"]:
        copied[relative] = copy_regular(source_root / relative, view / relative)
    successor_regular = set(materializer.discover_control_plane_overlay_regular_paths(view))
    removed = []
    for relative in plan["predecessorRegularPaths"]:
        if relative in successor_regular:
            continue
        if unlink_regular(view / relative):
            removed.append(relative)
            prune_empty_directories(view, str(Path(relative).parent))
    materializer.require_control_plane_overlay_payloads(view)
    leftover = set(plan["predecessorRegularPaths"]) - successor_regular
    leftover_regular = []
    for relative in leftover:
        path = view / relative
        try:
            details = os.lstat(str(path))
        except OSError:
            continue
        if stat.S_ISREG(details.st_mode) and not stat.S_ISLNK(details.st_mode):
            leftover_regular.append(relative)
    if leftover_regular:
        fail("predecessor overlay regular files remain: %s" % leftover_regular[0])
    return {
        "copied": copied,
        "removed": removed,
        "successorRegularPaths": sorted(successor_regular),
        "teachingProjectionHash": expected_teaching_projection_hash,
        "domainTeachingProjectionHash": expected_domain_teaching_projection_hash,
        "authorityReleaseId": expected_authority_release_id,
    }


def snapshot_overlays(view, snapshot_root, materializer):
    # type: (Path, Path, Any) -> Dict[str, Any]
    if snapshot_root.exists() or snapshot_root.is_symlink():
        fail("overlay snapshot path already exists")
    snapshot_root.mkdir(parents=True)
    os.chmod(str(snapshot_root), 0o755)
    copied = {}
    for relative in sorted(materializer.discover_control_plane_overlay_regular_paths(view)):
        copied[relative] = copy_regular(view / relative, snapshot_root / relative)
    return {"snapshotRoot": str(snapshot_root), "files": copied}


def restore_overlays(view, snapshot_root, materializer):
    # type: (Path, Path, Any) -> Dict[str, Any]
    snapshot = require_real_directory(snapshot_root, "overlay snapshot")
    snapshot_files = set()
    for current, directories, filenames in os.walk(str(snapshot), followlinks=False):
        current_path = Path(current)
        directories[:] = [
            name for name in directories
            if not os.path.islink(str(current_path / name))
        ]
        for name in filenames:
            absolute = current_path / name
            details = os.lstat(str(absolute))
            if stat.S_ISREG(details.st_mode) and not stat.S_ISLNK(details.st_mode):
                snapshot_files.add(absolute.relative_to(snapshot).as_posix())
    current = set(materializer.discover_control_plane_overlay_regular_paths(view))
    removed = []
    for relative in sorted(current - snapshot_files):
        if unlink_regular(view / relative):
            removed.append(relative)
            prune_empty_directories(view, str(Path(relative).parent))
    restored = {}
    for relative in sorted(snapshot_files):
        restored[relative] = copy_regular(snapshot / relative, view / relative)
    return {"restored": restored, "removed": removed}


def parse_args(argv):
    # type: (Optional[List[str]]) -> argparse.Namespace
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--view", required=True, help="resolved blob-view directory")
    parser.add_argument("--source", help="Git runtime root containing successor overlays")
    parser.add_argument("--expected-authority-release-id")
    parser.add_argument("--expected-teaching-projection-hash")
    parser.add_argument("--expected-domain-teaching-projection-hash")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--receipt", help="optional JSON receipt path written after --apply")
    parser.add_argument("--snapshot-to", help="copy current overlay regular files to this directory")
    parser.add_argument("--restore-from", help="restore overlay regular files from a snapshot directory")
    return parser.parse_args(argv)


def main(argv=None):
    # type: (Optional[List[str]]) -> int
    args = parse_args(argv)
    view = require_real_directory(Path(args.view), "view")
    materializer = load_materializer()
    if args.snapshot_to:
        result = snapshot_overlays(view, Path(args.snapshot_to), materializer)
    elif args.restore_from:
        result = restore_overlays(view, Path(args.restore_from), materializer)
    else:
        if (
            not args.source
            or not args.expected_authority_release_id
            or not args.expected_teaching_projection_hash
            or not args.expected_domain_teaching_projection_hash
        ):
            fail("source and successor identities are required")
        source = require_real_directory(Path(args.source), "source")
        if args.apply:
            result = apply_install(
                view,
                source,
                args.expected_authority_release_id,
                args.expected_teaching_projection_hash,
                args.expected_domain_teaching_projection_hash,
                materializer,
            )
            result["applied"] = True
            if args.receipt:
                write_regular_bytes(
                    Path(args.receipt),
                    (json.dumps(result, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode("utf-8"),
                )
        else:
            result = plan_install(
                view,
                source,
                args.expected_authority_release_id,
                args.expected_teaching_projection_hash,
                args.expected_domain_teaching_projection_hash,
                materializer,
            )
            result["applied"] = False
    print(json.dumps(result, separators=(",", ":"), sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print("ERROR: %s" % error, file=sys.stderr)
        sys.exit(1)
