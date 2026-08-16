#!/usr/bin/env python3
"""Fail-closed planner/executor for unused production OSS runtime objects.

The planner may list and HEAD.  ``execute`` is the only command that deletes,
and only after an explicit authorization flag plus an exact plan digest match.

Allowed deletion namespaces:
  * ``runtime/releases/`` — entire unused v1 prefix trees
  * ``runtime/blobs/sha256/`` — blobs unreachable from protected v2 releases

Never deleted:
  * ``runtime/blob-releases/`` manifests and receipts
  * any blob reachable from active, rollback, desired, publishing or retained
"""

import argparse
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple


ROOT = Path(__file__).resolve().parent


def load_materializer():
    spec = importlib.util.spec_from_file_location(
        "runtime_blob_materializer_for_retirement",
        str(ROOT / "materialize-runtime-blob-release.py"),
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("unable to load materialize-runtime-blob-release.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


MATERIALIZER = load_materializer()


PLAN_SCHEMA = "act-runtime-unused-oss-retirement-plan.v1"
RECEIPT_SCHEMA = "act-runtime-unused-oss-retirement-receipt.v1"
PROOF_SCHEMA = "act-runtime-unused-oss-retirement-serving-proof.v1"
V1_PREFIX = "runtime/releases/"
BLOB_PREFIX = "runtime/blobs/sha256/"
BLOB_RELEASE_PREFIX = "runtime/blob-releases/"
RELEASE_ID = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")



def fail(message: str) -> None:
    raise ValueError(message)


def canonical(value: Any) -> bytes:
    return json.dumps(value, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def read_json(path: Path, label: str) -> Dict[str, Any]:
    if path.is_symlink() or not path.is_file():
        fail("%s must be a regular non-symlink file" % label)
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        fail("%s is invalid JSON: %s" % (label, error))
    if not isinstance(value, dict):
        fail("%s must be an object" % label)
    return value


def write_atomic(path: Path, value: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=".%s." % path.name, dir=str(path.parent))
    try:
        with os.fdopen(descriptor, "wb") as handle:
            os.fchmod(handle.fileno(), 0o600)
            handle.write(json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False).encode("utf-8"))
            handle.write(b"\n")
            handle.flush()
            os.fsync(handle.fileno())
    except Exception:
        os.unlink(temporary)
        raise
    os.replace(temporary, path)


def require_release_id(value: str, label: str) -> str:
    if not isinstance(value, str) or not RELEASE_ID.fullmatch(value):
        fail("%s is not a valid release id" % label)
    return value


def require_key(value: str) -> str:
    if not isinstance(value, str) or not value:
        fail("object key is empty")
    if any(ord(char) < 32 or char == "\\" for char in value):
        fail("object key contains a control character or backslash")
    parts = value[:-1].split("/") if value.endswith("/") else value.split("/")
    if not parts or any(part in {"", ".", ".."} for part in parts):
        fail("object key is unsafe: %s" % value)
    return value


def parse_size(value: Any, label: str) -> int:
    if isinstance(value, bool) or value is None:
        fail("%s is missing" % label)
    try:
        size = int(value)
    except (TypeError, ValueError):
        fail("%s is not an integer" % label)
    if size < 0:
        fail("%s is negative" % label)
    return size


def normalize_contents(raw: Any) -> List[Dict[str, Any]]:
    if raw in (None, ""):
        return []
    if isinstance(raw, dict):
        return [raw]
    if isinstance(raw, list):
        return raw
    fail("list-objects-v2 Contents is invalid")


class OssTransport:
    def __init__(self, ossutil: str, bucket: str, endpoint: str, region: str) -> None:
        if not ossutil or not Path(ossutil).is_file():
            fail("ossutil path is missing")
        self.ossutil = ossutil
        self.bucket = bucket
        self.endpoint = endpoint
        self.region = region

    def run(self, api: str, extra: Sequence[str]) -> Dict[str, Any]:
        command = [
            self.ossutil, "api", api, "--bucket", self.bucket,
            "--endpoint", self.endpoint, "--region", self.region,
            "--output-format", "json", "-q", *extra,
        ]
        process = subprocess.run(command, check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stderr = process.stderr.decode("utf-8", errors="replace").strip()
        if process.returncode != 0:
            fail("%s failed: %s" % (api, stderr or "exit %d" % process.returncode))
        if not process.stdout.strip():
            return {}
        decoder = json.JSONDecoder()
        try:
            payload, _offset = decoder.raw_decode(process.stdout.decode("utf-8").lstrip())
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            fail("%s returned invalid JSON: %s" % (api, error))
        if not isinstance(payload, dict):
            fail("%s returned a non-object" % api)
        return payload

    def list_objects(self, prefix: str) -> List[Dict[str, Any]]:
        if prefix not in {V1_PREFIX, BLOB_PREFIX, BLOB_RELEASE_PREFIX} and not prefix.startswith(
            (V1_PREFIX, BLOB_PREFIX, BLOB_RELEASE_PREFIX)
        ):
            fail("refusing to list an unsupported prefix: %s" % prefix)
        continuation: Optional[str] = None
        seen_tokens = set()
        seen_keys = set()
        objects: List[Dict[str, Any]] = []
        while True:
            extra = ["--prefix", prefix, "--max-keys", "1000"]
            if continuation:
                extra += ["--continuation-token", continuation]
            payload = self.run("list-objects-v2", extra)
            if payload.get("Name") not in {None, self.bucket} or payload.get("Prefix") not in {None, prefix}:
                fail("list-objects-v2 returned an unexpected bucket or prefix")
            contents = normalize_contents(payload.get("Contents"))
            if "KeyCount" in payload and parse_size(payload["KeyCount"], "KeyCount") != len(contents):
                fail("list-objects-v2 KeyCount does not match Contents")
            for item in contents:
                if not isinstance(item, dict):
                    fail("list-objects-v2 object entry is invalid")
                key = require_key(item.get("Key", ""))
                if not key.startswith(prefix):
                    fail("list-objects-v2 returned a key outside %s: %s" % (prefix, key))
                if key.startswith(BLOB_RELEASE_PREFIX) and prefix == V1_PREFIX:
                    fail("v1 listing crossed into blob-releases")
                if key in seen_keys:
                    fail("duplicate object key: %s" % key)
                seen_keys.add(key)
                objects.append({"objectKey": key, "sizeBytes": parse_size(item.get("Size"), "Size for %s" % key)})
            truncated = payload.get("IsTruncated", False)
            if truncated in (False, "false", "False", None):
                break
            if truncated not in (True, "true", "True"):
                fail("list-objects-v2 IsTruncated is invalid")
            token = payload.get("NextContinuationToken")
            if not isinstance(token, str) or not token or token in seen_tokens:
                fail("list-objects-v2 continuation token is missing or repeated")
            seen_tokens.add(token)
            continuation = token
        return sorted(objects, key=lambda item: item["objectKey"])

    def get_object(self, key: str) -> bytes:
        key = require_key(key)
        command = [
            self.ossutil, "api", "get-object", "--bucket", self.bucket, "--key", key,
            "--endpoint", self.endpoint, "--region", self.region, "-q",
        ]
        process = subprocess.run(command, check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if process.returncode != 0:
            fail("get-object failed for %s: %s" % (key, process.stderr.decode("utf-8", errors="replace").strip()))
        return process.stdout

    def delete_object(self, key: str) -> None:
        self.delete_many([key])

    def delete_many(self, keys: Sequence[str]) -> None:
        unique: List[str] = []
        seen = set()
        for raw in keys:
            key = require_key(raw)
            if not allowed_deletion_key(key):
                fail("refusing to delete a key outside the unused retirement namespaces: %s" % key)
            if key in seen:
                fail("duplicate deletion key: %s" % key)
            seen.add(key)
            unique.append(key)
        for start in range(0, len(unique), 1000):
            chunk = unique[start:start + 1000]
            payload = {"Quiet": "false", "Object": [{"Key": key} for key in chunk]}
            descriptor, temporary = tempfile.mkstemp(prefix=".act-v1-retire-delete.")
            try:
                with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                    os.fchmod(handle.fileno(), 0o600)
                    handle.write(json.dumps(payload, ensure_ascii=False))
                    handle.flush()
                    os.fsync(handle.fileno())
                response = self.run("delete-multiple-objects", ["--delete", "file://%s" % temporary])
            finally:
                os.unlink(temporary)
            deleted = normalize_contents(response.get("Deleted") or response.get("Object") or chunk)
            deleted_keys = []
            for item in deleted:
                if isinstance(item, dict) and item.get("Key"):
                    deleted_keys.append(require_key(item["Key"]))
                elif isinstance(item, str):
                    deleted_keys.append(require_key(item))
            if sorted(deleted_keys) != sorted(chunk) and deleted_keys:
                missing = [key for key in chunk if key not in set(deleted_keys)]
                if missing:
                    fail("delete-multiple-objects did not confirm deletion of %s" % missing[0])
            errors = response.get("Error") or response.get("Errors")
            if errors:
                fail("delete-multiple-objects reported errors")


def allowed_deletion_key(key: str) -> bool:
    return key.startswith(V1_PREFIX) or (
        key.startswith(BLOB_PREFIX) and SHA256.fullmatch(key[len(BLOB_PREFIX) :] or "") is not None
    )


def parse_serving_proof(path: Path, expected_active: str, expected_rollback: str) -> Dict[str, Any]:
    raw = read_json(path, "serving proof")
    if raw.get("schemaVersion") != PROOF_SCHEMA:
        fail("serving proof has an unsupported schema")
    if raw.get("mode") != "v2":
        fail("serving proof is not v2; refusing to retire unused objects")
    if parse_size(raw.get("readyzHttpStatus"), "readyzHttpStatus") != 200:
        fail("serving proof readyz is not 200")
    if raw.get("v1OssfsMounted") is not False:
        fail("v1 ossfs is still mounted; refuse retirement")
    active = require_release_id(raw.get("activeReleaseId", ""), "serving proof.activeReleaseId")
    rollback = require_release_id(raw.get("rollbackReleaseId", ""), "serving proof.rollbackReleaseId")
    if active != expected_active or rollback != expected_rollback:
        fail("serving proof identities do not match the expected active/rollback pair")
    if active == rollback:
        fail("active and rollback must differ")
    protected = raw.get("protectedReleaseIds")
    if protected is None:
        protected_ids = sorted({active, rollback})
    else:
        if not isinstance(protected, list) or not protected:
            fail("serving proof.protectedReleaseIds is invalid")
        protected_ids = sorted({require_release_id(item, "protectedReleaseIds") for item in protected})
    if active not in protected_ids or rollback not in protected_ids:
        fail("protected release set must include active and rollback")
    proof = {
        "schemaVersion": PROOF_SCHEMA,
        "mode": "v2",
        "activeReleaseId": active,
        "rollbackReleaseId": rollback,
        "readyzHttpStatus": 200,
        "v1OssfsMounted": False,
        "protectedReleaseIds": protected_ids,
    }
    return dict(proof, servingProofSha256=digest(proof))


def group_v1_prefixes(objects: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}
    for item in objects:
        key = item["objectKey"]
        if not key.startswith(V1_PREFIX):
            fail("v1 object is outside runtime/releases/: %s" % key)
        remainder = key[len(V1_PREFIX) :]
        name = remainder.split("/", 1)[0]
        prefix = V1_PREFIX + name + ("/" if remainder else "")
        bucket = grouped.setdefault(prefix, {"prefix": prefix, "objectCount": 0, "totalBytes": 0})
        bucket["objectCount"] += 1
        bucket["totalBytes"] += item["sizeBytes"]
    return [grouped[name] for name in sorted(grouped)]


def load_protected_blobs(transport: OssTransport, release_ids: Sequence[str]) -> Tuple[List[str], int, List[Dict[str, Any]]]:
    protected_keys: Set[str] = set()
    identities: List[Dict[str, Any]] = []
    work = Path(tempfile.mkdtemp(prefix="act-v1-retire-manifest-"))
    try:
        for release_id in release_ids:
            manifest_key = "%s%s/manifest.json" % (BLOB_RELEASE_PREFIX, release_id)
            receipt_key = "%s%s/receipt.json" % (BLOB_RELEASE_PREFIX, release_id)
            manifest_path = work / ("%s.manifest.json" % release_id)
            receipt_path = work / ("%s.receipt.json" % release_id)
            manifest_path.write_bytes(transport.get_object(manifest_key))
            receipt_path.write_bytes(transport.get_object(receipt_key))
            manifest, wire = MATERIALIZER.parse_manifest(manifest_path)
            MATERIALIZER.parse_receipt(receipt_path, manifest, wire)
            if manifest["releaseId"] != release_id:
                fail("protected blob-release identity drifted: %s" % release_id)
            for item in manifest["files"]:
                protected_keys.add(item["objectKey"])
            identities.append(
                {
                    "releaseId": release_id,
                    "manifestSha256": manifest["manifestSha256"],
                    "treeSha256": manifest["treeSha256"],
                    "fileCount": manifest["fileCount"],
                    "totalBytes": manifest["totalBytes"],
                }
            )
    finally:
        for path in work.iterdir():
            path.unlink()
        work.rmdir()
    return sorted(protected_keys), len(protected_keys), identities


def objects_digest(objects: Sequence[Dict[str, Any]]) -> str:
    return digest([{"objectKey": item["objectKey"], "sizeBytes": item["sizeBytes"]} for item in objects])


def build_plan(args: argparse.Namespace) -> Dict[str, Any]:
    proof = parse_serving_proof(Path(args.serving_proof), args.expected_active_release, args.expected_rollback_release)
    transport = OssTransport(args.ossutil_path, args.bucket, args.endpoint, args.region)
    listed_blob_releases = transport.list_objects(BLOB_RELEASE_PREFIX)
    for item in listed_blob_releases:
        key = item["objectKey"]
        if not key.startswith(BLOB_RELEASE_PREFIX) or not key.endswith(("/manifest.json", "/receipt.json")):
            fail("unexpected object in blob-releases namespace: %s" % key)
    v1_objects = transport.list_objects(V1_PREFIX)
    for item in v1_objects:
        if not allowed_deletion_key(item["objectKey"]) or not item["objectKey"].startswith(V1_PREFIX):
            fail("refusing a non-v1 deletion candidate: %s" % item["objectKey"])
    blobs = transport.list_objects(BLOB_PREFIX)
    protected_keys, protected_count, identities = load_protected_blobs(transport, proof["protectedReleaseIds"])
    blob_by_key = {item["objectKey"]: item for item in blobs}
    missing = [key for key in protected_keys if key not in blob_by_key]
    if missing:
        fail("protected blobs are missing from the blob namespace: %s" % ",".join(missing[:8]))
    unreachable = []
    for item in blobs:
        key = item["objectKey"]
        if key in protected_keys:
            continue
        sha = key[len(BLOB_PREFIX) :]
        if not SHA256.fullmatch(sha):
            fail("blob namespace contains a non-addressed key: %s" % key)
        unreachable.append({"objectKey": key, "sizeBytes": item["sizeBytes"], "sha256": sha})
    v1_prefixes = group_v1_prefixes(v1_objects)
    protected_bytes = sum(blob_by_key[key]["sizeBytes"] for key in protected_keys)
    base = {
        "schemaVersion": PLAN_SCHEMA,
        "bucket": args.bucket,
        "expectedActiveRelease": proof["activeReleaseId"],
        "expectedRollbackRelease": proof["rollbackReleaseId"],
        "protectedReleaseIds": proof["protectedReleaseIds"],
        "protectedIdentities": identities,
        "servingProofSha256": proof["servingProofSha256"],
        "v1Prefixes": v1_prefixes,
        "v1ObjectCount": len(v1_objects),
        "v1TotalBytes": sum(item["sizeBytes"] for item in v1_objects),
        "v1ObjectsSha256": objects_digest(v1_objects),
        "protectedBlobCount": protected_count,
        "protectedBlobBytes": protected_bytes,
        "unreachableBlobCount": len(unreachable),
        "unreachableBlobBytes": sum(item["sizeBytes"] for item in unreachable),
        "unreachableBlobsSha256": objects_digest(unreachable),
        "unreachableBlobs": unreachable,
        "blobReleaseObjectCount": len(listed_blob_releases),
        "neverDeletePrefixes": [BLOB_RELEASE_PREFIX],
    }
    return dict(base, planSha256=digest(base))


def parsed_plan(path: Path) -> Dict[str, Any]:
    raw = read_json(path, "retirement plan")
    if raw.get("schemaVersion") != PLAN_SCHEMA:
        fail("retirement plan has an unsupported schema")
    copy = dict(raw)
    plan_sha = copy.pop("planSha256", None)
    if not isinstance(plan_sha, str) or not SHA256.fullmatch(plan_sha) or plan_sha != digest(copy):
        fail("retirement plan digest does not match canonical content")
    return raw


def execute(args: argparse.Namespace) -> Dict[str, Any]:
    if args.authorize_unused_oss_runtime_deletion != "yes":
        fail("execute requires --authorize-unused-oss-runtime-deletion yes")
    planned = parsed_plan(Path(args.plan))
    rebuilt = build_plan(args)
    if rebuilt["planSha256"] != planned["planSha256"] or rebuilt != planned:
        fail("retirement plan is stale or the live object set drifted")
    transport = OssTransport(args.ossutil_path, args.bucket, args.endpoint, args.region)
    live_v1 = transport.list_objects(V1_PREFIX)
    if objects_digest(live_v1) != planned["v1ObjectsSha256"]:
        fail("v1 object set drifted after the plan fence")
    deleted_v1 = [item["objectKey"] for item in live_v1]
    transport.delete_many(deleted_v1)
    deleted_blobs = [item["objectKey"] for item in planned["unreachableBlobs"]]
    transport.delete_many(deleted_blobs)
    remaining_v1 = transport.list_objects(V1_PREFIX)
    if remaining_v1:
        fail("v1 prefix still contains objects after deletion")
    remaining_blobs = {item["objectKey"] for item in transport.list_objects(BLOB_PREFIX)}
    leaked = [key for key in deleted_blobs if key in remaining_blobs]
    if leaked:
        fail("deleted blobs are still present")
    protected_keys, _, _ = load_protected_blobs(transport, planned["protectedReleaseIds"])
    missing_protected = [key for key in protected_keys if key not in remaining_blobs]
    if missing_protected:
        fail("a protected blob is missing after deletion")
    leftover_blob_releases = transport.list_objects(BLOB_RELEASE_PREFIX)
    base = {
        "schemaVersion": RECEIPT_SCHEMA,
        "planSha256": planned["planSha256"],
        "deletedV1ObjectCount": len(deleted_v1),
        "deletedUnreachableBlobCount": len(deleted_blobs),
        "remainingV1ObjectCount": 0,
        "remainingProtectedBlobCount": len(protected_keys),
        "blobReleaseObjectCount": len(leftover_blob_releases),
    }
    receipt = dict(base, receiptSha256=digest(base))
    write_atomic(Path(args.receipt_output), receipt)
    return receipt


def add_shared_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--expected-active-release", required=True)
    parser.add_argument("--expected-rollback-release", required=True)
    parser.add_argument("--serving-proof", required=True)
    parser.add_argument("--ossutil-path", required=True)
    parser.add_argument("--endpoint", default="oss-cn-hangzhou.aliyuncs.com")
    parser.add_argument("--region", default="cn-hangzhou")


def main() -> None:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command")
    planner = commands.add_parser("plan")
    add_shared_arguments(planner)
    planner.add_argument("--output", required=True)
    executor = commands.add_parser("execute")
    add_shared_arguments(executor)
    executor.add_argument("--plan", required=True)
    executor.add_argument("--authorize-unused-oss-runtime-deletion", default="")
    executor.add_argument("--receipt-output", required=True)
    args = parser.parse_args()
    if args.command == "plan":
        result = build_plan(args)
        write_atomic(Path(args.output), result)
    elif args.command == "execute":
        result = execute(args)
    else:
        parser.error("a command is required")
    summary = {
        "schemaVersion": result["schemaVersion"],
        "planSha256": result.get("planSha256"),
        "receiptSha256": result.get("receiptSha256"),
        "v1Prefixes": result.get("v1Prefixes"),
        "v1ObjectCount": result.get("v1ObjectCount"),
        "v1TotalBytes": result.get("v1TotalBytes"),
        "deletedV1ObjectCount": result.get("deletedV1ObjectCount"),
        "deletedUnreachableBlobCount": result.get("deletedUnreachableBlobCount"),
        "protectedReleaseIds": result.get("protectedReleaseIds"),
        "protectedBlobCount": result.get("protectedBlobCount") or result.get("remainingProtectedBlobCount"),
        "protectedBlobBytes": result.get("protectedBlobBytes"),
        "unreachableBlobCount": result.get("unreachableBlobCount"),
        "unreachableBlobBytes": result.get("unreachableBlobBytes"),
    }
    print(json.dumps({key: value for key, value in summary.items() if value is not None}, indent=2, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print("ERROR: %s" % error, file=sys.stderr)
        sys.exit(1)
