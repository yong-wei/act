#!/usr/bin/env python3
"""Durable desired-selection and active-receipt state for one ECS runtime host."""

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Any

RELEASE_ID = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
GIT_REVISION = re.compile(r"^[a-f0-9]{40}$")
IMAGE_DIGEST = re.compile(r"^sha256:[a-f0-9]{64}$")
SELECTION_FILE = "act-runtime-selection.json"
ACTIVE_RECEIPT_FILE = "act-runtime-active-receipt.json"
REPRESENTATIVE_MAX_BYTES = 4 * 1024 * 1024


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


def write_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    payload = (json.dumps(value, separators=(",", ":"), sort_keys=True) + "\n").encode("utf-8")
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "wb", closefd=True) as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
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
    if not isinstance(value, dict) or value.get("schemaVersion") != "runtime-release-verification.v1":
        fail("verification receipt is invalid")
    return {
        "releaseId": require_release_id(value.get("releaseId")),
        "manifestSha256": require_digest(value.get("manifestSha256"), "verification.manifestSha256"),
        "treeSha256": require_digest(value.get("treeSha256"), "verification.treeSha256"),
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


def active(args: argparse.Namespace):
    receipt = read_json(Path(args.state_dir) / ACTIVE_RECEIPT_FILE, require_active_receipt)
    return {"activeReleaseId": receipt["selection"]["releaseId"] if receipt else None}


def verify_mounted(args: argparse.Namespace):
    root = Path(args.runtime_root).resolve()
    if root.is_symlink() or not root.is_dir():
        fail("mounted runtime root is invalid")
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
    active_parser = subcommands.add_parser("active")
    active_parser.add_argument("--state-dir", required=True)
    mounted = subcommands.add_parser("verify-mounted")
    mounted.add_argument("--runtime-root", required=True)
    mounted.add_argument("--release-id", required=True)
    mounted.add_argument("--verification-receipt", required=True)
    args = parser.parse_args()
    if args.command is None:
        parser.error("a command is required")
    result = {"select": select, "mark-active": mark_active, "active": active, "verify-mounted": verify_mounted}[args.command](args)
    print(json.dumps(result, separators=(",", ":"), sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)
