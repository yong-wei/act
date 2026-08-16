#!/usr/bin/env python3
"""Journaled local authority state for non-selected v2 blob release candidates.

This script does not mount, select, publish or delete OSS objects.  It gives
candidate materialization and later GC one durable, generation-fenced source of
truth while retaining v1 authority until a v2 marker is committed.
"""

import argparse
from datetime import datetime, timedelta, timezone
import fcntl
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


LIFECYCLE_SCHEMA = "runtime-blob-release-lifecycle.v2"
MARKER_SCHEMA = "runtime-release-authority.v2"
JOURNAL_SCHEMA = "runtime-blob-release-lifecycle-journal.v1"
IDENTITY_SCHEMA = "runtime-blob-release-identity.v1"
RETENTION_POLICY_VERSION = "runtime-media-signed-url-retention.v1"
MIN_SIGNED_URL_MAX_SECONDS = 300
LIFECYCLE_FILE = "act-runtime-blob-lifecycle.v2.json"
MARKER_FILE = "act-runtime-authority.v2.json"
JOURNAL_FILE = "act-runtime-blob-lifecycle.journal.json"
LOCK_FILE = ".act-runtime-blob-lifecycle.lock"
ACTIVATION_SCHEMA = "runtime-blob-activation-journal.v1"
ACTIVATION_FILE = ".act-runtime-blob-activation.journal.json"
RELEASE_ID = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
RFC3339_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


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


def string(value: Any, label: str) -> str:
    if not isinstance(value, str):
        fail("%s must be a string" % label)
    return value


def sha(value: Any, label: str) -> str:
    value = string(value, label)
    if not SHA256.fullmatch(value):
        fail("%s must be a SHA-256 digest" % label)
    return value


def integer(value: Any, label: str, minimum: int = 0) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < minimum:
        fail("%s is invalid" % label)
    return value


def release_id(value: Any, label: str = "releaseId") -> str:
    value = string(value, label)
    if not RELEASE_ID.fullmatch(value):
        fail("%s is invalid" % label)
    return value


def utc_timestamp(value: Any, label: str) -> datetime:
    value = string(value, label)
    if not RFC3339_UTC.fullmatch(value):
        fail("%s must be an RFC3339 UTC timestamp" % label)
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        fail("%s is not a valid UTC timestamp" % label)


def format_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def effective_now(value: Optional[str]) -> datetime:
    return utc_timestamp(value, "--now") if value is not None else datetime.now(timezone.utc).replace(microsecond=0)


def signed_url_ttl(value: Any, label: str = "signedUrlMaxSeconds") -> int:
    value = integer(value, label, MIN_SIGNED_URL_MAX_SECONDS)
    return value


def identity(value: Any, label: str = "identity") -> Dict[str, Any]:
    value = exact(value, ["schemaVersion", "releaseId", "manifestVersion", "manifestSha256", "manifestWireSha256", "manifestWireSizeBytes", "treeSha256"], label)
    if value["schemaVersion"] != IDENTITY_SCHEMA or value["manifestVersion"] != "act-runtime-release.v2":
        fail("%s has an unsupported version" % label)
    return {
        "schemaVersion": IDENTITY_SCHEMA,
        "releaseId": release_id(value["releaseId"], label + ".releaseId"),
        "manifestVersion": "act-runtime-release.v2",
        "manifestSha256": sha(value["manifestSha256"], label + ".manifestSha256"),
        "manifestWireSha256": sha(value["manifestWireSha256"], label + ".manifestWireSha256"),
        "manifestWireSizeBytes": integer(value["manifestWireSizeBytes"], label + ".manifestWireSizeBytes", 1),
        "treeSha256": sha(value["treeSha256"], label + ".treeSha256"),
    }


def optional_identity(value: Any, label: str) -> Optional[Dict[str, Any]]:
    return None if value is None else identity(value, label)


def identities(value: Any, label: str) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        fail("%s must be an array" % label)
    parsed = [identity(item, "%s[%d]" % (label, index)) for index, item in enumerate(value)]
    if [item["releaseId"] for item in parsed] != sorted(item["releaseId"] for item in parsed):
        fail("%s must be sorted by release ID" % label)
    if len({item["releaseId"] for item in parsed}) != len(parsed):
        fail("%s contains duplicate release IDs" % label)
    return parsed


def retention_lease(value: Any, label: str = "retentionLease") -> Dict[str, Any]:
    value = exact(value, ["identity", "retainedAt", "signedUrlMaxSeconds", "notBeforeReleaseAt", "retentionPolicyVersion"], label)
    parsed_identity = identity(value["identity"], label + ".identity")
    retained_at = utc_timestamp(value["retainedAt"], label + ".retainedAt")
    ttl = signed_url_ttl(value["signedUrlMaxSeconds"], label + ".signedUrlMaxSeconds")
    not_before = utc_timestamp(value["notBeforeReleaseAt"], label + ".notBeforeReleaseAt")
    if not_before != retained_at + timedelta(seconds=ttl):
        fail("%s.notBeforeReleaseAt must equal retainedAt plus signedUrlMaxSeconds" % label)
    policy = string(value["retentionPolicyVersion"], label + ".retentionPolicyVersion")
    if policy != RETENTION_POLICY_VERSION:
        fail("%s.retentionPolicyVersion is unsupported" % label)
    return {
        "identity": parsed_identity,
        "retainedAt": format_utc(retained_at),
        "signedUrlMaxSeconds": ttl,
        "notBeforeReleaseAt": format_utc(not_before),
        "retentionPolicyVersion": policy,
    }


def retention_leases(value: Any, label: str) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        fail("%s must be an array" % label)
    parsed = [retention_lease(item, "%s[%d]" % (label, index)) for index, item in enumerate(value)]
    if [item["identity"]["releaseId"] for item in parsed] != sorted(item["identity"]["releaseId"] for item in parsed):
        fail("%s must be sorted by release ID" % label)
    if len({item["identity"]["releaseId"] for item in parsed}) != len(parsed):
        fail("%s contains duplicate release IDs" % label)
    return parsed


def lifecycle(value: Any) -> Dict[str, Any]:
    value = exact(value, ["schemaVersion", "generation", "transactionId", "desired", "active", "rollback", "publishing", "retained"], "lifecycle")
    if value["schemaVersion"] != LIFECYCLE_SCHEMA:
        fail("lifecycle has an unsupported version")
    transaction_id = string(value["transactionId"], "lifecycle.transactionId")
    if not re.fullmatch(r"[a-f0-9]{32}", transaction_id):
        fail("lifecycle.transactionId is invalid")
    active = identity(value["active"], "lifecycle.active")
    desired = optional_identity(value["desired"], "lifecycle.desired")
    rollback = optional_identity(value["rollback"], "lifecycle.rollback")
    publishing = identities(value["publishing"], "lifecycle.publishing")
    retained = retention_leases(value["retained"], "lifecycle.retained")
    release_ids = [active["releaseId"]] + ([desired["releaseId"]] if desired else []) + ([rollback["releaseId"]] if rollback else []) + [item["releaseId"] for item in publishing] + [item["identity"]["releaseId"] for item in retained]
    if len(release_ids) != len(set(release_ids)):
        fail("lifecycle release identities must not overlap across state fields")
    return {
        "schemaVersion": LIFECYCLE_SCHEMA,
        "generation": integer(value["generation"], "lifecycle.generation", 1),
        "transactionId": transaction_id,
        "desired": desired,
        "active": active,
        "rollback": rollback,
        "publishing": publishing,
        "retained": retained,
    }


def marker(value: Any) -> Dict[str, Any]:
    if not isinstance(value, dict):
        fail("authority marker is invalid")
    mode = value.get("mode")
    if mode == "v2":
        value = exact(value, ["schemaVersion", "mode", "generation", "lifecycleSha256"], "authority marker")
        return {"schemaVersion": MARKER_SCHEMA, "mode": "v2", "generation": integer(value["generation"], "marker.generation", 1), "lifecycleSha256": sha(value["lifecycleSha256"], "marker.lifecycleSha256")}
    if mode == "v1-rollback":
        value = exact(value, ["schemaVersion", "mode", "generation", "v1SelectionSha256", "v1ActiveReceiptSha256"], "authority marker")
        return {"schemaVersion": MARKER_SCHEMA, "mode": "v1-rollback", "generation": integer(value["generation"], "marker.generation", 1), "v1SelectionSha256": sha(value["v1SelectionSha256"], "marker.v1SelectionSha256"), "v1ActiveReceiptSha256": sha(value["v1ActiveReceiptSha256"], "marker.v1ActiveReceiptSha256")}
    fail("authority marker mode is invalid")


def read_json(path: Path, validator):
    if path.is_symlink():
        fail("state path must not be a symlink: %s" % path.name)
    if not path.exists():
        return None
    try:
        return validator(json.loads(path.read_text(encoding="utf-8")))
    except json.JSONDecodeError as error:
        fail("%s is invalid JSON: %s" % (path.name, error))


def write_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=".%s." % path.name, dir=str(path.parent))
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "wb", closefd=True) as handle:
            handle.write(canonical(value) + b"\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, str(path))
        directory = os.open(str(path.parent), os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def locked(state_dir: Path):
    state_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    handle = (state_dir / LOCK_FILE).open("a+")
    fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
    return handle


def journal(value: Any) -> Dict[str, Any]:
    value = exact(value, ["schemaVersion", "status", "transactionId", "afterLifecycle", "afterLifecycleSha256", "afterMarker"], "lifecycle journal")
    if value["schemaVersion"] != JOURNAL_SCHEMA or value["status"] not in {"prepared", "committed"}:
        fail("lifecycle journal is invalid")
    transaction_id = string(value["transactionId"], "journal.transactionId")
    if not re.fullmatch(r"[a-f0-9]{32}", transaction_id):
        fail("journal.transactionId is invalid")
    after = lifecycle(value["afterLifecycle"])
    after_sha = sha(value["afterLifecycleSha256"], "journal.afterLifecycleSha256")
    if after_sha != digest(after):
        fail("lifecycle journal does not bind its after-image")
    return {"schemaVersion": JOURNAL_SCHEMA, "status": value["status"], "transactionId": transaction_id, "afterLifecycle": after, "afterLifecycleSha256": after_sha, "afterMarker": marker(value["afterMarker"])}


def activation_journal(value: Any) -> Dict[str, Any]:
    value = exact(value, [
        "schemaVersion", "status", "transactionId", "expectedGeneration",
        "targetGeneration", "previousIdentity", "targetIdentity",
        "targetLifecycleSha256",
    ], "activation journal")
    if value["schemaVersion"] != ACTIVATION_SCHEMA or value["status"] not in {"prepared", "lifecycle-committed", "receipt-committed", "complete"}:
        fail("activation journal is invalid")
    transaction_id = string(value["transactionId"], "activation journal.transactionId")
    if not re.fullmatch(r"[a-f0-9]{32}", transaction_id):
        fail("activation journal.transactionId is invalid")
    expected = integer(value["expectedGeneration"], "activation journal.expectedGeneration", 1)
    target_generation = integer(value["targetGeneration"], "activation journal.targetGeneration", 1)
    if target_generation != expected + 1:
        fail("activation journal.targetGeneration is invalid")
    previous = identity(value["previousIdentity"], "activation journal.previousIdentity")
    target = identity(value["targetIdentity"], "activation journal.targetIdentity")
    if previous["releaseId"] == target["releaseId"]:
        fail("activation journal target must differ from previous active")
    lifecycle_sha = value["targetLifecycleSha256"]
    if lifecycle_sha != "" and not SHA256.fullmatch(string(lifecycle_sha, "activation journal.targetLifecycleSha256")):
        fail("activation journal.targetLifecycleSha256 is invalid")
    if value["status"] == "prepared" and lifecycle_sha != "":
        fail("prepared activation journal must not claim a committed lifecycle")
    if value["status"] != "prepared" and lifecycle_sha == "":
        fail("committed activation journal must bind a lifecycle digest")
    return {
        "schemaVersion": ACTIVATION_SCHEMA,
        "status": value["status"],
        "transactionId": transaction_id,
        "expectedGeneration": expected,
        "targetGeneration": target_generation,
        "previousIdentity": previous,
        "targetIdentity": target,
        "targetLifecycleSha256": lifecycle_sha,
    }


def transaction(state_dir: Path, after: Dict[str, Any]) -> Dict[str, Any]:
    after = lifecycle(after)
    marker_value = {"schemaVersion": MARKER_SCHEMA, "mode": "v2", "generation": after["generation"], "lifecycleSha256": digest(after)}
    journal_value = {"schemaVersion": JOURNAL_SCHEMA, "status": "prepared", "transactionId": after["transactionId"], "afterLifecycle": after, "afterLifecycleSha256": digest(after), "afterMarker": marker_value}
    write_atomic(state_dir / JOURNAL_FILE, journal_value)
    write_atomic(state_dir / LIFECYCLE_FILE, after)
    write_atomic(state_dir / MARKER_FILE, marker_value)
    journal_value["status"] = "committed"
    write_atomic(state_dir / JOURNAL_FILE, journal_value)
    return after


def read_identity_file(path: str) -> Dict[str, Any]:
    return read_json(Path(path), identity)


def make_retention_lease(candidate: Dict[str, Any], now: datetime, ttl: int) -> Dict[str, Any]:
    ttl = signed_url_ttl(ttl)
    retained_at = now.replace(microsecond=0)
    not_before = retained_at + timedelta(seconds=ttl)
    return retention_lease({
        "identity": candidate,
        "retainedAt": format_utc(retained_at),
        "signedUrlMaxSeconds": ttl,
        "notBeforeReleaseAt": format_utc(not_before),
        "retentionPolicyVersion": RETENTION_POLICY_VERSION,
    })


def merge_retention_lease(existing: List[Dict[str, Any]], candidate: Dict[str, Any], now: datetime, ttl: int) -> List[Dict[str, Any]]:
    proposed = make_retention_lease(candidate, now, ttl)
    result = []
    replaced = False
    for lease in existing:
        if lease["identity"]["releaseId"] != candidate["releaseId"]:
            result.append(lease)
            continue
        if lease["identity"] != candidate:
            fail("retained identity does not match its existing lease")
        if utc_timestamp(proposed["notBeforeReleaseAt"], "retentionLease.notBeforeReleaseAt") > utc_timestamp(lease["notBeforeReleaseAt"], "retentionLease.notBeforeReleaseAt"):
            result.append(proposed)
        else:
            result.append(lease)
        replaced = True
    if not replaced:
        result.append(proposed)
    return sorted(result, key=lambda item: item["identity"]["releaseId"])


def read_v2(state_dir: Path) -> Dict[str, Any]:
    marker_value = read_json(state_dir / MARKER_FILE, marker)
    if marker_value is None:
        fail("v2 authority marker is absent")
    if marker_value["mode"] != "v2":
        fail("v2 authority is not active")
    current = read_json(state_dir / LIFECYCLE_FILE, lifecycle)
    if not current or current["generation"] != marker_value["generation"] or digest(current) != marker_value["lifecycleSha256"]:
        fail("v2 lifecycle does not match its authority marker")
    return current


def read_activation_journal(state_dir: Path) -> Tuple[Optional[Dict[str, Any]], bool]:
    path = state_dir / ACTIVATION_FILE
    if path.is_symlink():
        fail("activation journal must not be a symlink")
    if not path.exists():
        return None, False
    try:
        return activation_journal(json.loads(path.read_text(encoding="utf-8"))), False
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
        return None, True


def remove_activation_journal(state_dir: Path) -> None:
    path = state_dir / ACTIVATION_FILE
    if path.exists() or path.is_symlink():
        path.unlink()


def activation_crash(stage: str) -> None:
    if os.environ.get("ACT_RUNTIME_BLOB_ACTIVATION_CRASH_AT") == stage:
        os._exit(86)


def require_runtime_script(path_value: str, label: str) -> Path:
    path = Path(path_value)
    if path.is_symlink() or not path.is_file():
        fail("%s is unavailable: %s" % (label, path))
    return path


def host_active(state_dir: Path, host_script: Path) -> Optional[Dict[str, Any]]:
    result = subprocess.run(
        [sys.executable, str(host_script), "active", "--state-dir", str(state_dir)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
    )
    if result.returncode != 0:
        return None
    try:
        value = json.loads(result.stdout)
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def project_host_active(state_dir: Path, host_script: Path, target: Dict[str, Any]) -> Dict[str, Any]:
    result = subprocess.run(
        [
            sys.executable, str(host_script), "mark-active-v2",
            "--state-dir", str(state_dir),
            "--release-id", target["releaseId"],
            "--manifest-sha256", target["manifestSha256"],
            "--tree-sha256", target["treeSha256"],
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
    )
    if result.returncode != 0:
        fail(result.stderr.strip() or result.stdout.strip() or "host active receipt projection failed")
    active = host_active(state_dir, host_script)
    selection = active.get("selection") if active else None
    if (
        not active
        or active.get("activeReleaseId") != target["releaseId"]
        or not isinstance(selection, dict)
        or selection.get("manifestSha256") != target["manifestSha256"]
        or selection.get("treeSha256") != target["treeSha256"]
    ):
        fail("host active receipt does not match the v2 lifecycle active identity")
    try:
        return json.loads(result.stdout)
    except (UnicodeDecodeError, json.JSONDecodeError):
        fail("host active receipt projection returned invalid JSON")


def active_after(current: Dict[str, Any], operation: str, args: argparse.Namespace) -> Dict[str, Any]:
    after = dict(current)
    after["generation"] += 1
    after["transactionId"] = uuid.uuid4().hex
    if operation == "activate":
        candidate = read_identity_file(args.identity)
        if current["desired"] != candidate:
            fail("only the exact desired candidate may be activated")
        previous_rollback = current["rollback"]
        after["active"] = candidate
        after["rollback"] = current["active"]
        after["desired"] = None
        after["publishing"] = [item for item in current["publishing"] if item["releaseId"] != candidate["releaseId"]]
        if previous_rollback:
            after["retained"] = merge_retention_lease(current["retained"], previous_rollback, effective_now(getattr(args, "now", None)), MIN_SIGNED_URL_MAX_SECONDS)
    elif operation == "rollback":
        if current["rollback"] is None:
            fail("there is no verified rollback release")
        after["active"] = current["rollback"]
        after["rollback"] = current["active"]
    else:
        fail("unsupported active transition")
    return after


def read_recoverable_lifecycle(path: Path) -> Optional[Dict[str, Any]]:
    try:
        return read_json(path, lifecycle)
    except ValueError:
        return None


def finish_prepared_journal(state_dir: Path, journal_value: Dict[str, Any]) -> bool:
    """Commit a journal whose after-image is already authoritative.

    A crash after writing the marker but before writing the committed journal
    leaves a valid authority marker and a prepared journal.  The marker is
    already the durable authority, so recovery only has to finish the journal
    record.  Returning whether a write occurred keeps recovery receipts
    deterministic for already-committed state.
    """
    if journal_value["status"] != "prepared":
        return False
    journal_value = dict(journal_value)
    journal_value["status"] = "committed"
    write_atomic(state_dir / JOURNAL_FILE, journal_value)
    return True


def initialize(args: argparse.Namespace) -> Dict[str, Any]:
    state_dir = Path(args.state_dir)
    lock = locked(state_dir)
    try:
        if read_json(state_dir / MARKER_FILE, marker) is not None:
            fail("authority marker already exists")
        if (state_dir / LIFECYCLE_FILE).exists() or (state_dir / JOURNAL_FILE).exists():
            fail("uncommitted lifecycle state exists; recover it before migration")
        desired = read_identity_file(args.desired_identity) if args.desired_identity else None
        active = read_identity_file(args.active_identity)
        if desired and desired["releaseId"] == active["releaseId"]:
            desired = None
        after = {"schemaVersion": LIFECYCLE_SCHEMA, "generation": 1, "transactionId": uuid.uuid4().hex, "desired": desired, "active": active, "rollback": None, "publishing": [], "retained": []}
        return transaction(state_dir, after)
    finally:
        lock.close()


def mutate(args: argparse.Namespace, operation: str) -> Dict[str, Any]:
    state_dir = Path(args.state_dir)
    lock = locked(state_dir)
    try:
        current = read_v2(state_dir)
        if args.expected_generation != current["generation"]:
            fail("expected lifecycle generation does not match current authority")
        after = dict(current)
        after["generation"] += 1
        after["transactionId"] = uuid.uuid4().hex
        if operation == "begin-publish":
            candidate = read_identity_file(args.identity)
            occupied = {current["active"]["releaseId"]}
            for item in (current["desired"], current["rollback"]):
                if item:
                    occupied.add(item["releaseId"])
            occupied.update(item["releaseId"] for item in current["publishing"])
            occupied.update(item["identity"]["releaseId"] for item in current["retained"])
            if candidate["releaseId"] in occupied:
                fail("publishing candidate overlaps an existing lifecycle identity")
            after["publishing"] = sorted(current["publishing"] + [candidate], key=lambda item: item["releaseId"])
        elif operation == "cancel-publishing":
            candidate = read_identity_file(args.identity)
            if not any(item == candidate for item in current["publishing"]):
                fail("only an exact publishing identity may be cancelled")
            after["publishing"] = [
                item for item in current["publishing"]
                if item["releaseId"] != candidate["releaseId"]
            ]
        elif operation == "set-desired":
            candidate = read_identity_file(args.identity)
            if candidate["releaseId"] == current["active"]["releaseId"]:
                fail("desired candidate must differ from active release")
            if candidate not in current["publishing"]:
                fail("desired candidate must first be a verified publishing identity")
            after["desired"] = candidate
            after["publishing"] = [item for item in current["publishing"] if item["releaseId"] != candidate["releaseId"]]
        elif operation == "cancel-desired":
            if current["desired"] is None:
                fail("there is no desired candidate to cancel")
            after["desired"] = None
        elif operation == "retire-rollback":
            if current["rollback"] is None:
                fail("there is no verified rollback release")
            retiring = current["rollback"]
            after["rollback"] = None
            after["retained"] = merge_retention_lease(current["retained"], retiring, effective_now(getattr(args, "now", None)), signed_url_ttl(getattr(args, "signed_url_max_seconds", MIN_SIGNED_URL_MAX_SECONDS)))
        elif operation == "retain":
            candidate = read_identity_file(args.identity)
            if candidate["releaseId"] in {current["active"]["releaseId"], current["desired"]["releaseId"] if current["desired"] else "", current["rollback"]["releaseId"] if current["rollback"] else ""}:
                fail("active, desired and rollback identities are retained implicitly")
            if candidate in current["publishing"]:
                fail("publishing identities are retained implicitly")
            after["retained"] = merge_retention_lease(current["retained"], candidate, effective_now(getattr(args, "now", None)), signed_url_ttl(getattr(args, "signed_url_max_seconds", MIN_SIGNED_URL_MAX_SECONDS)))
        elif operation == "release-retained":
            candidate = read_identity_file(args.identity)
            lease = next((item for item in current["retained"] if item["identity"]["releaseId"] == candidate["releaseId"]), None)
            if lease is None or lease["identity"] != candidate:
                fail("only an exact retained identity may be released")
            now = effective_now(getattr(args, "now", None))
            retained_at = utc_timestamp(lease["retainedAt"], "retentionLease.retainedAt")
            not_before = utc_timestamp(lease["notBeforeReleaseAt"], "retentionLease.notBeforeReleaseAt")
            if now < retained_at:
                fail("retention lease cannot be released before retainedAt")
            if now < not_before:
                fail("retention lease has not reached its release deadline")
            after["retained"] = [item for item in current["retained"] if item["identity"]["releaseId"] != candidate["releaseId"]]
        else:
            fail("unsupported lifecycle operation")
        return transaction(state_dir, after)
    finally:
        lock.close()


def protected(args: argparse.Namespace) -> Dict[str, Any]:
    state_dir = Path(args.state_dir)
    lock = locked(state_dir)
    try:
        current = read_v2(state_dir)
        values = [current["active"]] + ([current["desired"]] if current["desired"] else []) + ([current["rollback"]] if current["rollback"] else []) + current["publishing"] + [item["identity"] for item in current["retained"]]
        return {"schemaVersion": "runtime-blob-release-protected-set.v1", "generation": current["generation"], "releaseIds": sorted(item["releaseId"] for item in values), "retainedLeases": current["retained"], "lifecycleSha256": digest(current)}
    finally:
        lock.close()


def inspect(args: argparse.Namespace) -> Dict[str, Any]:
    """Read the v2 lifecycle under its lock without changing its generation."""
    state_dir = Path(args.state_dir)
    lock = locked(state_dir)
    try:
        return read_v2(state_dir)
    finally:
        lock.close()


def recover_unlocked(state_dir: Path) -> Dict[str, Any]:
    marker_value = read_json(state_dir / MARKER_FILE, marker)
    current = read_recoverable_lifecycle(state_dir / LIFECYCLE_FILE)
    journal_value = read_json(state_dir / JOURNAL_FILE, journal)
    if marker_value is None:
        if current is None and journal_value is None:
            return {"mode": "v1", "recovered": False}
        lifecycle_path = state_dir / LIFECYCLE_FILE
        if journal_value and journal_value["status"] == "prepared" and journal_value["afterMarker"]["mode"] in {"v2", "v1-rollback"}:
            if lifecycle_path.exists() and current is None:
                fail("marker is absent and the interrupted lifecycle record is invalid")
            if current is not None and current != journal_value["afterLifecycle"]:
                fail("marker is absent and the interrupted lifecycle record does not match its journal")
            for path in (state_dir / LIFECYCLE_FILE, state_dir / JOURNAL_FILE):
                if path.exists():
                    path.unlink()
            return {"mode": "v1", "recovered": True}
        fail("marker is absent but lifecycle state cannot be safely discarded")
    if marker_value["mode"] == "v1-rollback":
        recovered = False
        if journal_value is not None:
            if journal_value["afterMarker"] != marker_value:
                fail("v1 rollback marker does not match its journal")
            recovered = finish_prepared_journal(state_dir, journal_value)
        return {"mode": "v1-rollback", "generation": marker_value["generation"], "recovered": recovered}
    if current and current["generation"] == marker_value["generation"] and digest(current) == marker_value["lifecycleSha256"]:
        recovered = False
        if journal_value is not None:
            if journal_value["afterMarker"] != marker_value or journal_value["afterLifecycleSha256"] != marker_value["lifecycleSha256"]:
                fail("v2 lifecycle and its journal disagree with the authority marker")
            recovered = finish_prepared_journal(state_dir, journal_value)
        return {"mode": "v2", "generation": current["generation"], "recovered": recovered}
    if journal_value and journal_value["afterMarker"] == marker_value and journal_value["afterLifecycleSha256"] == marker_value["lifecycleSha256"]:
        write_atomic(state_dir / LIFECYCLE_FILE, journal_value["afterLifecycle"])
        finish_prepared_journal(state_dir, journal_value)
        return {"mode": "v2", "generation": journal_value["afterLifecycle"]["generation"], "recovered": True}
    fail("v2 lifecycle is invalid and no matching committed journal can recover it")


def recover(args: argparse.Namespace) -> Dict[str, Any]:
    state_dir = Path(args.state_dir)
    lock = locked(state_dir)
    try:
        return recover_unlocked(state_dir)
    finally:
        lock.close()


def recover_and_project_unlocked(state_dir: Path, host_script: Path) -> Dict[str, Any]:
    recovery = recover_unlocked(state_dir)
    if recovery.get("mode") != "v2":
        return recovery
    current = read_v2(state_dir)
    journal_value, malformed = read_activation_journal(state_dir)
    current_digest = digest(current)
    if journal_value is not None and journal_value["targetLifecycleSha256"] and journal_value["targetLifecycleSha256"] != current_digest:
        journal_value = None
        malformed = True
    # Recovery itself must be able to repair the receipt even when a test seam
    # injected a crash into the interrupted activation's receipt write.
    host_crash = os.environ.pop("ACT_RUNTIME_HOST_STATE_CRASH_AT", None)
    try:
        project_host_active(state_dir, host_script, current["active"])
    finally:
        if host_crash is not None:
            os.environ["ACT_RUNTIME_HOST_STATE_CRASH_AT"] = host_crash
    if journal_value is not None:
        if current["active"] == journal_value["targetIdentity"] and current["generation"] == journal_value["targetGeneration"]:
            completed = dict(journal_value)
            completed["status"] = "complete"
            completed["targetLifecycleSha256"] = current_digest
            write_atomic(state_dir / ACTIVATION_FILE, completed)
        elif current["active"] == journal_value["previousIdentity"]:
            remove_activation_journal(state_dir)
        else:
            remove_activation_journal(state_dir)
    elif malformed:
        remove_activation_journal(state_dir)
    if (state_dir / ACTIVATION_FILE).exists():
        remove_activation_journal(state_dir)
    return {
        "active": current["active"],
        "generation": current["generation"],
        "recovered": bool(recovery.get("recovered") or journal_value or malformed),
    }


def recover_and_project(args: argparse.Namespace) -> Dict[str, Any]:
    state_dir = Path(args.state_dir)
    host_script = require_runtime_script(args.host_state_script, "host state script")
    lock = locked(state_dir)
    try:
        return recover_and_project_unlocked(state_dir, host_script)
    finally:
        lock.close()


def activate_and_project(args: argparse.Namespace, operation: str) -> Dict[str, Any]:
    state_dir = Path(args.state_dir)
    host_script = require_runtime_script(args.host_state_script, "host state script")
    lock = locked(state_dir)
    try:
        recover_and_project_unlocked(state_dir, host_script)
        current = read_v2(state_dir)
        if args.expected_generation != current["generation"]:
            fail("expected lifecycle generation does not match current authority")
        candidate = read_identity_file(args.identity) if operation == "activate" else current["rollback"]
        if candidate is None:
            fail("there is no verified rollback release")
        if operation == "activate" and current["desired"] != candidate:
            fail("only the exact desired candidate may be activated")
        journal_value = {
            "schemaVersion": ACTIVATION_SCHEMA,
            "status": "prepared",
            "transactionId": uuid.uuid4().hex,
            "expectedGeneration": current["generation"],
            "targetGeneration": current["generation"] + 1,
            "previousIdentity": current["active"],
            "targetIdentity": candidate,
            "targetLifecycleSha256": "",
        }
        write_atomic(state_dir / ACTIVATION_FILE, journal_value)
        activation_crash("after-intent")
        after = active_after(current, operation, args)
        committed = transaction(state_dir, after)
        activation_crash("after-lifecycle")
        committed = read_v2(state_dir)
        if committed["generation"] != journal_value["targetGeneration"] or committed["active"] != candidate:
            fail("lifecycle active transition did not commit the requested identity")
        journal_value = dict(journal_value)
        journal_value["status"] = "lifecycle-committed"
        journal_value["targetLifecycleSha256"] = digest(committed)
        write_atomic(state_dir / ACTIVATION_FILE, journal_value)
        activation_crash("after-lifecycle-journal")
        project_host_active(state_dir, host_script, committed["active"])
        activation_crash("after-receipt-readback")
        journal_value["status"] = "receipt-committed"
        write_atomic(state_dir / ACTIVATION_FILE, journal_value)
        activation_crash("after-receipt-committed")
        journal_value["status"] = "complete"
        write_atomic(state_dir / ACTIVATION_FILE, journal_value)
        activation_crash("after-complete")
        remove_activation_journal(state_dir)
        return {"active": committed, "generation": committed["generation"], "completed": True}
    finally:
        lock.close()


def verified_v1_rollback_inputs(selection_path: str, active_receipt_path: str) -> Dict[str, str]:
    normalized_selection, _ = validated_v1_authority(selection_path, active_receipt_path)
    return {
        "v1SelectionSha256": hashlib.sha256(Path(selection_path).read_bytes()).hexdigest(),
        "v1ActiveReceiptSha256": hashlib.sha256(Path(active_receipt_path).read_bytes()).hexdigest(),
    }


def validated_v1_selection(selection_path: str, label: str = "v1 selection") -> Dict[str, Any]:
    path = Path(selection_path)
    if path.is_symlink() or not path.is_file():
        fail("%s must be a regular non-symlink file" % label)
    try:
        selection = json.loads(path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail("%s is invalid JSON: %s" % (label, error))
    selection = exact(selection, ["schemaVersion", "generation", "releaseId", "manifestSha256", "treeSha256"], label)
    if selection["schemaVersion"] != "runtime-release-selection.v1":
        fail("%s has an unsupported version" % label)
    return {
        "schemaVersion": "runtime-release-selection.v1",
        "generation": integer(selection["generation"], label + ".generation", 1),
        "releaseId": release_id(selection["releaseId"], label + ".releaseId"),
        "manifestSha256": sha(selection["manifestSha256"], label + ".manifestSha256"),
        "treeSha256": sha(selection["treeSha256"], label + ".treeSha256"),
    }


def validated_v1_authority(selection_path: str, active_receipt_path: str):
    def payload(path_value: str, label: str) -> Dict[str, Any]:
        path = Path(path_value)
        if path.is_symlink() or not path.is_file():
            fail("%s must be a regular non-symlink file" % label)
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            fail("%s is invalid JSON: %s" % (label, error))

    normalized_selection = validated_v1_selection(selection_path)
    receipt = payload(active_receipt_path, "v1 active receipt")
    if not isinstance(receipt, dict) or receipt.get("schemaVersion") != "runtime-release-active-receipt.v1" or receipt.get("healthCheck") != "readyz" or receipt.get("selection") != normalized_selection:
        fail("v1 active receipt does not bind the verified selection")
    return normalized_selection, receipt


def identity_from_v1_selection(selection: Dict[str, Any], identity_path: str, label: str) -> Dict[str, Any]:
    imported = read_identity_file(identity_path)
    if imported["releaseId"] != selection["releaseId"] or imported["manifestSha256"] != selection["manifestSha256"] or imported["treeSha256"] != selection["treeSha256"]:
        fail("%s does not bind the v1 selection" % label)
    return imported


def initialize_from_v1(args: argparse.Namespace) -> Dict[str, Any]:
    state_dir = Path(args.state_dir)
    lock = locked(state_dir)
    try:
        if read_json(state_dir / MARKER_FILE, marker) is not None:
            fail("authority marker already exists")
        if (state_dir / LIFECYCLE_FILE).exists() or (state_dir / JOURNAL_FILE).exists():
            fail("uncommitted lifecycle state exists; recover it before migration")
        active_selection, _ = validated_v1_authority(args.v1_active_selection_file, args.v1_active_receipt_file)
        active = identity_from_v1_selection(active_selection, args.active_identity_file, "active identity")
        desired = None
        if args.v1_desired_selection_file:
            desired_selection = validated_v1_selection(args.v1_desired_selection_file, "v1 desired selection")
            if desired_selection["releaseId"] != active_selection["releaseId"]:
                if not args.desired_identity_file:
                    fail("--desired-identity-file is required for a divergent v1 desired selection")
                desired = identity_from_v1_selection(desired_selection, args.desired_identity_file, "desired identity")
            elif desired_selection != active_selection:
                fail("v1 desired selection must exactly match active selection when release IDs are equal")
        elif args.desired_identity_file:
            fail("--v1-desired-selection-file is required with --desired-identity-file")
        after = {"schemaVersion": LIFECYCLE_SCHEMA, "generation": 1, "transactionId": uuid.uuid4().hex, "desired": desired, "active": active, "rollback": None, "publishing": [], "retained": []}
        return transaction(state_dir, after)
    finally:
        lock.close()


def rollback_to_v1(args: argparse.Namespace) -> Dict[str, Any]:
    state_dir = Path(args.state_dir)
    lock = locked(state_dir)
    try:
        current = read_v2(state_dir)
        if args.expected_generation != current["generation"]:
            fail("expected lifecycle generation does not match current authority")
        inputs = verified_v1_rollback_inputs(args.v1_selection_file, args.v1_active_receipt_file)
        after_marker = {"schemaVersion": MARKER_SCHEMA, "mode": "v1-rollback", "generation": current["generation"] + 1, **inputs}
        journal_value = {"schemaVersion": JOURNAL_SCHEMA, "status": "prepared", "transactionId": uuid.uuid4().hex, "afterLifecycle": current, "afterLifecycleSha256": digest(current), "afterMarker": after_marker}
        write_atomic(state_dir / JOURNAL_FILE, journal_value)
        write_atomic(state_dir / MARKER_FILE, after_marker)
        journal_value["status"] = "committed"
        write_atomic(state_dir / JOURNAL_FILE, journal_value)
        return after_marker
    finally:
        lock.close()


def verify_v1_rollback(args: argparse.Namespace) -> Dict[str, Any]:
    state_dir = Path(args.state_dir)
    lock = locked(state_dir)
    try:
        current_marker = read_json(state_dir / MARKER_FILE, marker)
        if not current_marker or current_marker["mode"] != "v1-rollback":
            fail("v1 rollback authority marker is absent")
        inputs = verified_v1_rollback_inputs(args.v1_selection_file, args.v1_active_receipt_file)
        if inputs["v1SelectionSha256"] != current_marker["v1SelectionSha256"] or inputs["v1ActiveReceiptSha256"] != current_marker["v1ActiveReceiptSha256"]:
            fail("v1 rollback files do not match the authority marker")
        return {"mode": "v1-rollback", "generation": current_marker["generation"], **inputs}
    finally:
        lock.close()


def resume_v2_from_v1_rollback(args: argparse.Namespace) -> Dict[str, Any]:
    """Re-enter v2 after an explicit v1-rollback without deleting the marker."""
    state_dir = Path(args.state_dir)
    lock = locked(state_dir)
    try:
        current_marker = read_json(state_dir / MARKER_FILE, marker)
        if not current_marker or current_marker["mode"] != "v1-rollback":
            fail("v1 rollback authority marker is absent")
        if args.expected_generation != current_marker["generation"]:
            fail("expected lifecycle generation does not match current authority")
        inputs = verified_v1_rollback_inputs(args.v1_selection_file, args.v1_active_receipt_file)
        if inputs["v1SelectionSha256"] != current_marker["v1SelectionSha256"] or inputs["v1ActiveReceiptSha256"] != current_marker["v1ActiveReceiptSha256"]:
            fail("v1 rollback files do not match the authority marker")
        desired = read_identity_file(args.desired_identity) if args.desired_identity else None
        active = read_identity_file(args.active_identity)
        if desired and desired["releaseId"] == active["releaseId"]:
            desired = None
        after = {
            "schemaVersion": LIFECYCLE_SCHEMA,
            "generation": current_marker["generation"] + 1,
            "transactionId": uuid.uuid4().hex,
            "desired": desired,
            "active": active,
            "rollback": None,
            "publishing": [],
            "retained": [],
        }
        return transaction(state_dir, after)
    finally:
        lock.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command")
    initialize_parser = commands.add_parser("initialize-v2")
    initialize_parser.add_argument("--state-dir", required=True)
    initialize_parser.add_argument("--active-identity", required=True)
    initialize_parser.add_argument("--desired-identity")
    import_parser = commands.add_parser("initialize-v2-from-v1")
    import_parser.add_argument("--state-dir", required=True)
    import_parser.add_argument("--v1-active-selection-file", required=True)
    import_parser.add_argument("--v1-active-receipt-file", required=True)
    import_parser.add_argument("--active-identity-file", required=True)
    import_parser.add_argument("--v1-desired-selection-file")
    import_parser.add_argument("--desired-identity-file")
    for name in ("begin-publish", "cancel-publishing", "set-desired", "retain", "release-retained"):
        command = commands.add_parser(name)
        command.add_argument("--state-dir", required=True)
        command.add_argument("--expected-generation", required=True, type=int)
        command.add_argument("--identity", required=True)
    for name in ("retain", "release-retained"):
        commands.choices[name].add_argument("--now", help=argparse.SUPPRESS)
    activate_parser = commands.add_parser("activate")
    activate_parser.add_argument("--state-dir", required=True)
    activate_parser.add_argument("--expected-generation", required=True, type=int)
    activate_parser.add_argument("--identity", required=True)
    activate_parser.add_argument("--host-state-script", required=True)
    activate_parser.add_argument("--now", help=argparse.SUPPRESS)
    rollback_parser = commands.add_parser("rollback")
    rollback_parser.add_argument("--state-dir", required=True)
    rollback_parser.add_argument("--expected-generation", required=True, type=int)
    rollback_parser.add_argument("--host-state-script", required=True)
    rollback_parser.add_argument("--now", help=argparse.SUPPRESS)
    for name in ("retain", "retire-rollback"):
        if name == "retire-rollback":
            command = commands.add_parser(name)
            command.add_argument("--state-dir", required=True)
            command.add_argument("--expected-generation", required=True, type=int)
        commands.choices[name].add_argument("--signed-url-max-seconds", type=int, default=MIN_SIGNED_URL_MAX_SECONDS, help=argparse.SUPPRESS)
    commands.choices["retire-rollback"].add_argument("--now", help=argparse.SUPPRESS)
    for name in ("cancel-desired",):
        command = commands.add_parser(name)
        command.add_argument("--state-dir", required=True)
        command.add_argument("--expected-generation", required=True, type=int)
    v1_rollback_parser = commands.add_parser("rollback-to-v1")
    v1_rollback_parser.add_argument("--state-dir", required=True)
    v1_rollback_parser.add_argument("--expected-generation", required=True, type=int)
    v1_rollback_parser.add_argument("--v1-selection-file", required=True)
    v1_rollback_parser.add_argument("--v1-active-receipt-file", required=True)
    verify_v1_parser = commands.add_parser("verify-v1-rollback")
    verify_v1_parser.add_argument("--state-dir", required=True)
    verify_v1_parser.add_argument("--v1-selection-file", required=True)
    verify_v1_parser.add_argument("--v1-active-receipt-file", required=True)
    resume_parser = commands.add_parser("resume-v2-from-v1-rollback")
    resume_parser.add_argument("--state-dir", required=True)
    resume_parser.add_argument("--expected-generation", required=True, type=int)
    resume_parser.add_argument("--v1-selection-file", required=True)
    resume_parser.add_argument("--v1-active-receipt-file", required=True)
    resume_parser.add_argument("--active-identity", required=True)
    resume_parser.add_argument("--desired-identity")
    protected_parser = commands.add_parser("protected-set")
    protected_parser.add_argument("--state-dir", required=True)
    inspect_parser = commands.add_parser("inspect")
    inspect_parser.add_argument("--state-dir", required=True)
    recover_parser = commands.add_parser("recover")
    recover_parser.add_argument("--state-dir", required=True)
    project_recover_parser = commands.add_parser("recover-and-project")
    project_recover_parser.add_argument("--state-dir", required=True)
    project_recover_parser.add_argument("--host-state-script", required=True)
    for name in ("activate-and-project", "rollback-and-project"):
        command = commands.add_parser(name)
        command.add_argument("--state-dir", required=True)
        command.add_argument("--expected-generation", required=True, type=int)
        command.add_argument("--host-state-script", required=True)
    commands.choices["activate-and-project"].add_argument("--identity", required=True)
    args = parser.parse_args()
    if args.command == "initialize-v2":
        result = initialize(args)
    elif args.command == "initialize-v2-from-v1":
        result = initialize_from_v1(args)
    elif args.command in {"begin-publish", "cancel-publishing", "set-desired", "cancel-desired", "retire-rollback", "retain", "release-retained"}:
        result = mutate(args, args.command)
    elif args.command == "protected-set":
        result = protected(args)
    elif args.command == "inspect":
        result = inspect(args)
    elif args.command == "recover":
        result = recover(args)
    elif args.command == "recover-and-project":
        result = recover_and_project(args)
    elif args.command == "activate":
        result = activate_and_project(args, "activate")
    elif args.command == "rollback":
        result = activate_and_project(args, "rollback")
    elif args.command == "activate-and-project":
        result = activate_and_project(args, "activate")
    elif args.command == "rollback-and-project":
        result = activate_and_project(args, "rollback")
    elif args.command == "rollback-to-v1":
        result = rollback_to_v1(args)
    elif args.command == "verify-v1-rollback":
        result = verify_v1_rollback(args)
    elif args.command == "resume-v2-from-v1-rollback":
        result = resume_v2_from_v1_rollback(args)
    else:
        parser.error("a command is required")
    print(json.dumps(result, separators=(",", ":"), sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print("ERROR: %s" % error, file=sys.stderr)
        sys.exit(1)
