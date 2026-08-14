#!/usr/bin/env python3
"""Fail-closed candidate GC planner for content-addressed runtime blobs.

The production OSS bridge supplies an immutable object-index snapshot.  This
program holds the lifecycle lock while deriving roots and, for a disposable
local candidate only, can execute the exact plan against a local blob mirror.
It never accepts release-prefix objects as deletion candidates.
"""

import argparse
import hashlib
import importlib.util
import json
import os
import stat
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path(__file__).resolve().parent


def load_module(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, str(ROOT / filename))
    if spec is None or spec.loader is None:
        raise RuntimeError("unable to load %s" % filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


LIFECYCLE = load_module("runtime_blob_lifecycle", "runtime-blob-release-lifecycle.py")
MATERIALIZER = load_module("runtime_blob_materializer", "materialize-runtime-blob-release.py")
INDEX_SCHEMA = "runtime-blob-gc-object-index.v1"
PLAN_SCHEMA = "runtime-blob-gc-plan.v1"
RECEIPT_SCHEMA = "runtime-blob-gc-receipt.v1"
BLOB_PREFIX = "runtime/blobs/sha256/"


def fail(message: str) -> None:
    raise ValueError(message)


def canonical(value: Any) -> bytes:
    return json.dumps(value, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def exact(value: Any, keys: List[str], label: str) -> Dict[str, Any]:
    if not isinstance(value, dict) or sorted(value.keys()) != sorted(keys):
        fail("%s has unsupported or missing fields" % label)
    return value


def read_json(path: Path, label: str) -> Dict[str, Any]:
    if path.is_symlink() or not path.is_file():
        fail("%s must be a regular non-symlink file" % label)
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail("%s is invalid JSON: %s" % (label, error))
    if not isinstance(value, dict):
        fail("%s must be an object" % label)
    return value


def require_real_directory(path: Path, label: str) -> Path:
    try:
        details = os.lstat(path)
    except OSError as error:
        fail("%s is missing: %s" % (label, error))
    if stat.S_ISLNK(details.st_mode) or not stat.S_ISDIR(details.st_mode):
        fail("%s must be a real directory" % label)
    return path.resolve()


def object_index(path: Path) -> Dict[str, Any]:
    raw = exact(read_json(path, "object index"), ["schemaVersion", "lifecycleGeneration", "lifecycleSha256", "objects"], "object index")
    if raw["schemaVersion"] != INDEX_SCHEMA:
        fail("object index has an unsupported version")
    generation = LIFECYCLE.integer(raw["lifecycleGeneration"], "object index.lifecycleGeneration", 1)
    lifecycle_sha = LIFECYCLE.sha(raw["lifecycleSha256"], "object index.lifecycleSha256")
    if not isinstance(raw["objects"], list):
        fail("object index.objects must be an array")
    objects = []
    for index, value in enumerate(raw["objects"]):
        value = exact(value, ["objectKey", "sizeBytes", "sha256"], "object index.objects[%d]" % index)
        file_sha = LIFECYCLE.sha(value["sha256"], "object index.objects[%d].sha256" % index)
        key = LIFECYCLE.string(value["objectKey"], "object index.objects[%d].objectKey" % index)
        if key != BLOB_PREFIX + file_sha:
            fail("object index contains a non-blob or mismatched key")
        objects.append({"objectKey": key, "sizeBytes": LIFECYCLE.integer(value["sizeBytes"], "object index.objects[%d].sizeBytes" % index), "sha256": file_sha})
    if objects != sorted(objects, key=lambda item: item["objectKey"]) or len({item["objectKey"] for item in objects}) != len(objects):
        fail("object index objects must be sorted and unique")
    return {"schemaVersion": INDEX_SCHEMA, "lifecycleGeneration": generation, "lifecycleSha256": lifecycle_sha, "objects": objects}


def protected_state(state_dir: Path) -> Dict[str, Any]:
    current = LIFECYCLE.read_v2(state_dir)
    values = [current["active"]] + ([current["desired"]] if current["desired"] else []) + ([current["rollback"]] if current["rollback"] else []) + current["publishing"] + [item["identity"] for item in current["retained"]]
    identities = sorted(values, key=lambda item: item["releaseId"])
    return {
        "generation": current["generation"],
        "lifecycleSha256": LIFECYCLE.digest(current),
        "releaseIds": [item["releaseId"] for item in identities],
        "identities": identities,
        "retainedLeases": current["retained"],
    }


def protected_blobs(manifests_root: Path, release_ids: List[str]) -> List[str]:
    keys = set()
    for release_id in release_ids:
        release_root = manifests_root / release_id
        manifest, manifest_wire = MATERIALIZER.parse_manifest(release_root / "manifest.json")
        if manifest["releaseId"] != release_id:
            fail("protected manifest release ID does not match its directory")
        MATERIALIZER.parse_receipt(release_root / "receipt.json", manifest, manifest_wire)
        keys.update(item["objectKey"] for item in manifest["files"])
    return sorted(keys)


def build_plan(state_dir: Path, manifests_root: Path, index_path: Path) -> Dict[str, Any]:
    state = protected_state(state_dir)
    index = object_index(index_path)
    if index["lifecycleGeneration"] != state["generation"] or index["lifecycleSha256"] != state["lifecycleSha256"]:
        fail("object index is not fenced to the current lifecycle generation")
    protected = protected_blobs(manifests_root, state["releaseIds"])
    protected_set = set(protected)
    indexed = {item["objectKey"] for item in index["objects"]}
    missing = sorted(protected_set - indexed)
    if missing:
        fail("object index is missing protected blobs: %s" % ",".join(missing))
    candidates = [item for item in index["objects"] if item["objectKey"] not in protected_set]
    base = {
        "schemaVersion": PLAN_SCHEMA,
        "lifecycleGeneration": state["generation"],
        "lifecycleSha256": state["lifecycleSha256"],
        "objectIndexSha256": digest(index),
        "protectedReleaseIds": state["releaseIds"],
        "protectedIdentities": state["identities"],
        "retainedLeases": state["retainedLeases"],
        "protectedBlobCount": len(protected),
        "deleteCandidates": candidates,
    }
    return dict(base, planSha256=digest(base))


def write_atomic(path: Path, value: Dict[str, Any]) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=".%s." % path.name, dir=str(path.parent))
    try:
        with os.fdopen(descriptor, "wb", closefd=True) as handle:
            os.fchmod(handle.fileno(), 0o600)
            handle.write(canonical(value) + b"\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, str(path))
        directory = os.open(str(path.parent), os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def file_sha256(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            value.update(chunk)
    return value.hexdigest()


def plan(args: argparse.Namespace) -> Dict[str, Any]:
    state_dir = Path(args.state_dir)
    lock = LIFECYCLE.locked(state_dir)
    try:
        result = build_plan(state_dir, Path(args.manifests_root), Path(args.object_index))
        write_atomic(Path(args.output), result)
        return result
    finally:
        lock.close()


def parsed_plan(path: Path) -> Dict[str, Any]:
    raw = exact(read_json(path, "GC plan"), ["schemaVersion", "lifecycleGeneration", "lifecycleSha256", "objectIndexSha256", "protectedReleaseIds", "protectedIdentities", "retainedLeases", "protectedBlobCount", "deleteCandidates", "planSha256"], "GC plan")
    if raw["schemaVersion"] != PLAN_SCHEMA:
        fail("GC plan has an unsupported version")
    if not isinstance(raw["protectedReleaseIds"], list) or raw["protectedReleaseIds"] != sorted(raw["protectedReleaseIds"]):
        fail("GC plan protected release IDs are invalid")
    protected_identities = LIFECYCLE.identities(raw["protectedIdentities"], "GC plan.protectedIdentities")
    if [item["releaseId"] for item in protected_identities] != raw["protectedReleaseIds"]:
        fail("GC plan protected identities do not match release IDs")
    retained_leases = LIFECYCLE.retention_leases(raw["retainedLeases"], "GC plan.retainedLeases")
    retained_ids = [item["identity"]["releaseId"] for item in retained_leases]
    if not set(retained_ids).issubset(set(raw["protectedReleaseIds"])):
        fail("GC plan retained leases are not protected roots")
    LIFECYCLE.integer(raw["protectedBlobCount"], "GC plan.protectedBlobCount", 0)
    if not isinstance(raw["deleteCandidates"], list):
        fail("GC plan delete candidates are invalid")
    candidates = []
    for index, item in enumerate(raw["deleteCandidates"]):
        item = exact(item, ["objectKey", "sizeBytes", "sha256"], "GC plan.deleteCandidates[%d]" % index)
        file_sha = LIFECYCLE.sha(item["sha256"], "GC plan.deleteCandidates[%d].sha256" % index)
        key = LIFECYCLE.string(item["objectKey"], "GC plan.deleteCandidates[%d].objectKey" % index)
        if key != BLOB_PREFIX + file_sha:
            fail("GC plan delete candidate is not a blob-addressed key")
        candidates.append({"objectKey": key, "sizeBytes": LIFECYCLE.integer(item["sizeBytes"], "GC plan.deleteCandidates[%d].sizeBytes" % index), "sha256": file_sha})
    if candidates != sorted(candidates, key=lambda item: item["objectKey"]) or len({item["objectKey"] for item in candidates}) != len(candidates):
        fail("GC plan delete candidates must be sorted and unique")
    base = dict(raw)
    plan_sha = LIFECYCLE.sha(base.pop("planSha256"), "GC plan.planSha256")
    if plan_sha != digest(base):
        fail("GC plan digest does not match canonical content")
    return raw


def execute(args: argparse.Namespace) -> Dict[str, Any]:
    state_dir = Path(args.state_dir)
    lock = LIFECYCLE.locked(state_dir)
    try:
        plan_value = parsed_plan(Path(args.plan))
        current = build_plan(state_dir, Path(args.manifests_root), Path(args.object_index))
        if current != plan_value:
            fail("GC plan is stale or lifecycle/object-index state drifted")
        delete_root = require_real_directory(Path(args.delete_root), "local disposable blob mirror")
        deleted = []
        for candidate in plan_value["deleteCandidates"]:
            filename = candidate["sha256"]
            target = delete_root / filename
            details = os.lstat(target)
            if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode):
                fail("GC candidate is not a regular blob file")
            if target.resolve().parent != delete_root or details.st_size != candidate["sizeBytes"] or file_sha256(target) != filename:
                fail("GC candidate revalidation failed")
            target.unlink()
            deleted.append(candidate)
        protected_keys = protected_blobs(Path(args.manifests_root), plan_value["protectedReleaseIds"])
        index_value = object_index(Path(args.object_index))
        index_by_key = {item["objectKey"]: item for item in index_value["objects"]}
        for object_key in protected_keys:
            expected = index_by_key.get(object_key)
            if expected is None:
                fail("protected blob is missing from the object index after deletion")
            target = delete_root / expected["sha256"]
            details = os.lstat(target)
            if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode) or details.st_size != expected["sizeBytes"] or file_sha256(target) != expected["sha256"]:
                fail("protected blob post-operation verification failed")
        remaining_deleted = [item["sha256"] for item in deleted if (delete_root / item["sha256"]).exists()]
        if remaining_deleted:
            fail("deleted blob post-operation verification failed")
        base = {
            "schemaVersion": RECEIPT_SCHEMA,
            "planSha256": plan_value["planSha256"],
            "lifecycleGeneration": plan_value["lifecycleGeneration"],
            "lifecycleSha256": plan_value["lifecycleSha256"],
            "objectIndexSha256": plan_value["objectIndexSha256"],
            "protectedReleaseIds": plan_value["protectedReleaseIds"],
            "protectedIdentities": plan_value["protectedIdentities"],
            "retainedLeases": plan_value["retainedLeases"],
            "protectedBlobCount": plan_value["protectedBlobCount"],
            "plannedDeleteCandidates": plan_value["deleteCandidates"],
            "deleted": deleted,
            "postOperation": {
                "verifiedProtectedBlobCount": len(protected_keys),
                "deletedBlobCount": len(deleted),
                "deletedCandidatesAbsent": sorted(item["sha256"] for item in deleted),
            },
        }
        receipt = dict(base, receiptSha256=digest(base))
        write_atomic(Path(args.receipt_output), receipt)
        return receipt
    finally:
        lock.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command")
    for name in ("plan", "execute"):
        command = commands.add_parser(name)
        command.add_argument("--state-dir", required=True)
        command.add_argument("--manifests-root", required=True)
        command.add_argument("--object-index", required=True)
    planner = commands.choices["plan"]
    planner.add_argument("--output", required=True)
    executor = commands.choices["execute"]
    executor.add_argument("--plan", required=True)
    executor.add_argument("--delete-root", required=True)
    executor.add_argument("--receipt-output", required=True)
    args = parser.parse_args()
    if args.command == "plan":
        result = plan(args)
    elif args.command == "execute":
        result = execute(args)
    else:
        parser.error("a command is required")
    print(json.dumps(result, separators=(",", ":"), sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print("ERROR: %s" % error, file=sys.stderr)
        sys.exit(1)
