#!/usr/bin/env python3
"""Restricted ECS-side bridge for immutable runtime release publishing.

The only mutating protocol is ``publish``.  It acquires one exclusive lock for
the complete release transaction, validates the prefix, consumes only the
missing object frames, writes the completion manifest last, and re-reads every
object before returning a receipt.  Object bytes are passed directly from the
SSH stream to ``ossutil cp -``; no runtime staging directory is created.
"""

import argparse
import base64
import fcntl
import hashlib
import json
import os
import re
import subprocess
import sys
from typing import Any, Dict, List, NoReturn, Optional, Tuple
from urllib.error import URLError
from urllib.request import ProxyHandler, Request, build_opener


KEY_PREFIX = "runtime/releases/"
MANIFEST_NAME = ".act-runtime-release.v1.json"
BUCKET_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$")
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
ROLE_NAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
EXPECTED_ECS_ROLE_NAME = "act-runtime-oss-publisher"
OSS_ENDPOINT = "oss-cn-hangzhou-internal.aliyuncs.com"
DEFAULT_OSSUTIL_PATH = "/usr/local/bin/ossutil"
DEFAULT_IMDS_ROLE_URL = "http://100.100.100.200/latest/meta-data/ram/security-credentials/"
OBJECT_NUMBER_SUMMARY = re.compile(r"^Object Number is:? [0-9]+$")
TOTAL_SIZE_SUMMARY = re.compile(r"^Total Size is:? [0-9]+$")
_CURRENT_ROLE_NAME: Optional[str] = None
_IMDS_OPENER = build_opener(ProxyHandler({}))


def fail(message: str) -> NoReturn:
    raise RuntimeError(message)


def decode_value(value: str, label: str) -> str:
    try:
        decoded = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)).decode("utf-8")
    except (ValueError, UnicodeDecodeError) as error:
        fail(f"{label} is not valid base64url: {error}")
    if any(ord(char) < 0x20 or ord(char) == 0x7F for char in decoded):
        fail(f"{label} contains a control character")
    return decoded


def validate_bucket(bucket: str) -> str:
    if not BUCKET_PATTERN.fullmatch(bucket):
        fail("OSS bucket is invalid")
    return bucket


def validate_key(key: str) -> str:
    if not key.startswith(KEY_PREFIX) or "\\" in key:
        fail("Object key is outside the immutable runtime release prefix")
    parts = key.split("/")
    if any(not part or part in {".", ".."} for part in parts):
        fail("Object key contains an unsafe path component")
    return key


def validate_prefix(prefix: str) -> str:
    if not prefix.startswith(KEY_PREFIX) or not prefix.endswith("/"):
        fail("Release prefix is outside the immutable runtime release prefix")
    parts = prefix.split("/")
    if any(not part or part in {".", ".."} for part in parts[:-1]):
        fail("Release prefix contains an unsafe path component")
    return prefix


def destination(bucket: str, key: str) -> str:
    return f"oss://{validate_bucket(bucket)}/{validate_key(key)}"


def prefix_destination(bucket: str, prefix: str) -> str:
    return f"oss://{validate_bucket(bucket)}/{validate_prefix(prefix)}"


def ossutil_command() -> str:
    override = os.environ.get("ACT_RUNTIME_RELEASE_OSSUTIL")
    if override is None:
        return DEFAULT_OSSUTIL_PATH
    if os.environ.get("ACT_RUNTIME_RELEASE_TEST_MODE") != "1":
        fail("ossutil path override is restricted to the explicit test mode")
    if not override.startswith("/") or any(ord(char) < 0x20 or ord(char) == 0x7F for char in override):
        fail("ossutil test override must be an absolute path without control characters")
    return override


def current_ecs_role_name() -> str:
    global _CURRENT_ROLE_NAME
    if _CURRENT_ROLE_NAME is not None:
        return _CURRENT_ROLE_NAME
    metadata_override = os.environ.get("ACT_RUNTIME_RELEASE_IMDS_ROLE_URL")
    if metadata_override is not None and os.environ.get("ACT_RUNTIME_RELEASE_TEST_MODE") != "1":
        fail("ECS RAM role metadata URL override is restricted to the explicit test mode")
    metadata_url = metadata_override or DEFAULT_IMDS_ROLE_URL
    if not metadata_url.startswith("http://") or any(ord(char) < 0x20 or ord(char) == 0x7F for char in metadata_url):
        fail("ECS RAM role metadata URL is invalid")
    try:
        response = _IMDS_OPENER.open(Request(metadata_url, headers={"User-Agent": "act-runtime-release-bridge"}), timeout=2)
        payload = response.read(4096).decode("ascii")
        response.close()
    except (OSError, UnicodeDecodeError, URLError, ValueError) as error:
        fail(f"unable to read ECS RAM role metadata: {error}")
    role_names = [line.strip() for line in payload.splitlines() if line.strip()]
    if len(role_names) != 1 or not ROLE_NAME_PATTERN.fullmatch(role_names[0]) or role_names[0] != EXPECTED_ECS_ROLE_NAME:
        fail("ECS RAM role metadata does not match the restricted publisher role")
    _CURRENT_ROLE_NAME = role_names[0]
    return _CURRENT_ROLE_NAME


def ossutil_argv(arguments: List[str]) -> List[str]:
    return [ossutil_command()] + arguments + [
        "--mode", "EcsRamRole",
        "--ecs-role-name", current_ecs_role_name(),
        "--endpoint", OSS_ENDPOINT,
    ]


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def remote_digest(bucket: str, key: str) -> Dict[str, Any]:
    process = subprocess.Popen(
        ossutil_argv(["cat", destination(bucket, key)]),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    digest = hashlib.sha256()
    size = 0
    assert process.stdout is not None
    for chunk in iter(lambda: process.stdout.read(1024 * 1024), b""):
        digest.update(chunk)
        size += len(chunk)
    stderr = process.stderr.read().decode("utf-8", errors="replace") if process.stderr else ""
    return_code = process.wait()
    if return_code != 0:
        fail(f"ossutil cat failed for {key}: {stderr.strip()}")
    return {"sizeBytes": size, "sha256": digest.hexdigest()}


def list_objects(bucket: str, prefix: str) -> List[Dict[str, Any]]:
    process = subprocess.run(
        ossutil_argv(["ls", prefix_destination(bucket, prefix), "-s"]),
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        encoding="utf-8",
        errors="strict",
    )
    if process.returncode != 0:
        fail(f"ossutil ls failed: {process.stderr.strip()}")
    if process.stderr.strip():
        fail(f"ossutil ls emitted unexpected stderr: {process.stderr.strip()}")
    object_prefix = f"oss://{bucket}/"
    normalized: List[Dict[str, Any]] = []
    seen = set()
    # Split only on LF.  ``str.splitlines`` also treats other control bytes
    # (for example form-feed and record-separator) as line boundaries, which
    # would let malformed writer output evade the control-character check.
    for raw_line in process.stdout.split("\n"):
        line = raw_line.rstrip("\r\n")
        if not line:
            continue
        if OBJECT_NUMBER_SUMMARY.fullmatch(line) or TOTAL_SIZE_SUMMARY.fullmatch(line):
            continue
        if any(ord(char) < 0x20 or ord(char) == 0x7F for char in line):
            fail("ossutil ls output contains a control character")
        if not line.startswith(object_prefix):
            fail(f"ossutil ls output contains an unknown line: {line}")
        key = line[len(object_prefix):]
        if not key or not key.startswith(prefix):
            fail(f"ossutil ls output contains an object outside the requested prefix: {line}")
        validate_key(key)
        if key in seen:
            fail(f"remote release list contains duplicate object: {key}")
        seen.add(key)
        # ossutil v1 -s output is an object URL listing; size is deliberately
        # unknown and every object is re-read before it can be accepted.
        normalized.append({"key": key, "sizeBytes": -1})
    return sorted(normalized, key=lambda entry: entry["key"])


def write_json(value: Any) -> None:
    sys.stdout.write(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def lock_path(prefix: str) -> str:
    lock_dir = os.environ.get("ACT_RUNTIME_RELEASE_LOCK_DIR", "/var/lib/act/runtime-release-locks")
    if not lock_dir.startswith("/") or any(ord(char) < 0x20 or ord(char) == 0x7F for char in lock_dir):
        fail("runtime release lock directory must be an absolute path")
    os.makedirs(lock_dir, mode=0o700, exist_ok=True)
    token = hashlib.sha256(prefix.encode("utf-8")).hexdigest()
    return os.path.join(lock_dir, f"act-runtime-release-{token}.lock")


def expected_manifest_files(manifest: Dict[str, Any], release_id: str) -> List[Dict[str, Any]]:
    files = manifest.get("files")
    if not isinstance(files, list) or not files:
        fail("manifest.files is invalid")
    expected: List[Dict[str, Any]] = []
    for item in files:
        if not isinstance(item, dict):
            fail("manifest file entry is invalid")
        key = item.get("objectKey")
        size = item.get("sizeBytes")
        digest = item.get("sha256")
        if not isinstance(key, str) or not isinstance(size, int) or size < 0 or not isinstance(digest, str) or not SHA256_PATTERN.fullmatch(digest):
            fail("manifest file expectation is invalid")
        expected_key = f"{KEY_PREFIX}{release_id}/{item.get('path')}"
        if key != expected_key:
            fail("manifest object key is not release-bound")
        validate_key(key)
        expected.append({"key": key, "sizeBytes": size, "sha256": digest})
    return expected


def validate_publish_header(header: Dict[str, Any], bucket: str) -> Tuple[str, Dict[str, Any], bytes, str, List[Dict[str, Any]]]:
    if header.get("protocol") != "act-runtime-release-stream.v1":
        fail("unsupported publish protocol")
    release_id = header.get("releaseId")
    prefix = header.get("prefix")
    encoded = header.get("manifestWireBase64")
    wire_sha = header.get("wireSha256")
    semantic_sha = header.get("manifestSha256")
    if not isinstance(release_id, str) or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", release_id):
        fail("release id is invalid")
    if prefix != f"{KEY_PREFIX}{release_id}/":
        fail("publish prefix does not match release id")
    validate_prefix(prefix)
    if not isinstance(encoded, str) or not isinstance(wire_sha, str) or not SHA256_PATTERN.fullmatch(wire_sha) or not isinstance(semantic_sha, str) or not SHA256_PATTERN.fullmatch(semantic_sha):
        fail("manifest digest fields are invalid")
    try:
        wire = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        manifest = json.loads(wire.decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"manifest wire bytes are invalid: {error}")
    if hashlib.sha256(wire).hexdigest() != wire_sha:
        fail("manifest wire digest does not match the serialized bytes")
    if not isinstance(manifest, dict) or manifest.get("releaseId") != release_id or manifest.get("manifestSha256") != semantic_sha:
        fail("manifest identity does not match publish header")
    source_revision = manifest.get("sourceRevision")
    tree_sha = manifest.get("treeSha256")
    if not isinstance(source_revision, str) or not re.fullmatch(r"[0-9a-f]{40}", source_revision) or not isinstance(tree_sha, str) or not SHA256_PATTERN.fullmatch(tree_sha):
        fail("manifest source identity is invalid")
    expected_release_id = "runtime-" + hashlib.sha256(canonical_json({"sourceRevision": source_revision, "treeSha256": tree_sha})).hexdigest()[:55]
    if release_id != expected_release_id:
        fail("release id is not content-addressed")
    if canonical_json(manifest) + b"\n" != wire:
        fail("manifest wire bytes are not canonical")
    without_digest = dict(manifest)
    without_digest.pop("manifestSha256", None)
    if hashlib.sha256(canonical_json(without_digest)).hexdigest() != semantic_sha:
        fail("manifest semantic digest does not match canonical content")
    expected = expected_manifest_files(manifest, release_id)
    return prefix, manifest, wire, wire_sha, expected


def assert_object_set(objects: List[Dict[str, Any]], expected: Dict[str, int], allow_manifest: bool) -> None:
    actual = {str(entry["key"]): int(entry["sizeBytes"]) for entry in objects}
    if len(actual) != len(objects):
        fail("remote release prefix contains duplicate objects")
    for key, size in actual.items():
        if key not in expected:
            fail(f"remote release contains an unexpected object: {key}")
        if size >= 0 and size != expected[key]:
            fail(f"remote release object size differs from the manifest: {key}")
    if allow_manifest and set(actual) != set(expected):
        fail("remote release is missing an expected object")


def put_bytes(bucket: str, key: str, payload: bytes, expected_size: int, expected_sha: str, wire_sha: Optional[str] = None) -> Dict[str, Any]:
    if len(payload) != expected_size or hashlib.sha256(payload).hexdigest() != expected_sha:
        fail(f"source bytes differ from manifest for {key}")
    process = subprocess.Popen(
        ossutil_argv(["cp", "-", destination(bucket, key), "--force=false"]),
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    assert process.stdin is not None
    try:
        process.stdin.write(payload)
        process.stdin.close()
    except (BrokenPipeError, OSError) as error:
        process.kill()
        process.wait()
        fail(f"ossutil cp stdin failed: {error}")
    stderr = process.stderr.read().decode("utf-8", errors="replace") if process.stderr else ""
    if process.wait() != 0:
        fail(f"ossutil cp failed for {key}: {stderr.strip()}")
    remote = remote_digest(bucket, key)
    if remote != {"sizeBytes": expected_size, "sha256": expected_sha}:
        fail(f"remote object differs from source stream for {key}")
    if wire_sha is not None:
        remote["wireSha256"] = wire_sha
    return remote


def put_frame(bucket: str, key: str, expected_size: int, expected_sha: str) -> Dict[str, Any]:
    process = subprocess.Popen(
        ossutil_argv(["cp", "-", destination(bucket, key), "--force=false"]),
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    digest = hashlib.sha256()
    size = 0
    remaining = expected_size
    assert process.stdin is not None
    try:
        while remaining:
            chunk = sys.stdin.buffer.read(min(1024 * 1024, remaining))
            if not chunk:
                fail("publisher stream ended before the expected object bytes")
            digest.update(chunk)
            size += len(chunk)
            remaining -= len(chunk)
            process.stdin.write(chunk)
        process.stdin.close()
    except (BrokenPipeError, OSError) as error:
        process.kill()
        process.wait()
        fail(f"ossutil cp stdin failed: {error}")
    stderr = process.stderr.read().decode("utf-8", errors="replace") if process.stderr else ""
    if process.wait() != 0:
        fail(f"ossutil cp failed for {key}: {stderr.strip()}")
    local = {"sizeBytes": size, "sha256": digest.hexdigest()}
    if local != {"sizeBytes": expected_size, "sha256": expected_sha}:
        fail(f"source bytes differ from manifest for {key}")
    remote = remote_digest(bucket, key)
    if remote != local:
        fail(f"remote object differs from source stream for {key}")
    return remote


def publish(bucket: str, requested_prefix: str) -> None:
    raw_header = sys.stdin.buffer.readline()
    if not raw_header:
        fail("publish stream ended before its header")
    try:
        header = json.loads(raw_header.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"publish header is invalid: {error}")
    if not isinstance(header, dict):
        fail("publish header must be an object")
    prefix, manifest, wire, wire_sha, files = validate_publish_header(header, bucket)
    if prefix != requested_prefix:
        fail("publish stream prefix does not match the SSH argument")
    manifest_key = f"{prefix}{MANIFEST_NAME}"
    expected_sizes = {entry["key"]: entry["sizeBytes"] for entry in files}
    expected_sizes[manifest_key] = len(wire)
    lock_file = open(lock_path(prefix), "a+b")
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        objects = list_objects(bucket, prefix)
        existing = {str(entry["key"]): int(entry["sizeBytes"]) for entry in objects}
        if manifest_key in existing:
            assert_object_set(objects, expected_sizes, allow_manifest=True)
            if remote_digest(bucket, manifest_key) != {"sizeBytes": len(wire), "sha256": wire_sha}:
                fail("existing completion manifest differs from the submitted immutable identity")
            for entry in files:
                if remote_digest(bucket, entry["key"]) != {"sizeBytes": entry["sizeBytes"], "sha256": entry["sha256"]}:
                    fail(f"remote object differs from manifest for {entry['key']}")
            write_json({"status": "complete", "releaseId": manifest["releaseId"], "manifestSha256": manifest["manifestSha256"], "wireSha256": wire_sha, "treeSha256": manifest["treeSha256"], "fileCount": manifest["fileCount"], "totalBytes": manifest["totalBytes"], "putCount": 0})
            return
        partial_expected = {entry["key"]: entry["sizeBytes"] for entry in files}
        assert_object_set(objects, partial_expected, allow_manifest=False)
        for entry in files:
            if entry["key"] in existing and remote_digest(bucket, entry["key"]) != {"sizeBytes": entry["sizeBytes"], "sha256": entry["sha256"]}:
                fail(f"remote object differs from manifest for {entry['key']}")
        missing = [entry for entry in files if entry["key"] not in existing]
        write_json({"status": "stream", "missingKeys": [entry["key"] for entry in missing]})
        put_count = 0
        for entry in missing:
            raw_frame_header = sys.stdin.buffer.readline()
            if not raw_frame_header:
                fail("publisher stream ended before a missing object frame")
            try:
                frame = json.loads(raw_frame_header.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                fail(f"object frame header is invalid: {error}")
            if not isinstance(frame, dict) or frame.get("key") != entry["key"] or frame.get("sizeBytes") != entry["sizeBytes"] or frame.get("sha256") != entry["sha256"]:
                fail(f"object frame does not match the manifest for {entry['key']}")
            put_frame(bucket, entry["key"], entry["sizeBytes"], entry["sha256"])
            put_count += 1
        if sys.stdin.buffer.readline().strip() != b"DONE":
            fail("publisher stream did not terminate its object frames with DONE")
        put_bytes(bucket, manifest_key, wire, len(wire), wire_sha, wire_sha)
        put_count += 1
        final_objects = list_objects(bucket, prefix)
        assert_object_set(final_objects, expected_sizes, allow_manifest=True)
        if remote_digest(bucket, manifest_key) != {"sizeBytes": len(wire), "sha256": wire_sha}:
            fail("remote completion manifest failed final verification")
        for entry in files:
            if remote_digest(bucket, entry["key"]) != {"sizeBytes": entry["sizeBytes"], "sha256": entry["sha256"]}:
                fail(f"remote object failed final verification for {entry['key']}")
        write_json({"status": "complete", "releaseId": manifest["releaseId"], "manifestSha256": manifest["manifestSha256"], "wireSha256": wire_sha, "treeSha256": manifest["treeSha256"], "fileCount": manifest["fileCount"], "totalBytes": manifest["totalBytes"], "putCount": put_count})
    finally:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
        lock_file.close()


def list_operation(bucket: str, prefix_b64: str) -> None:
    write_json(list_objects(bucket, decode_value(prefix_b64, "prefix")))


def main() -> None:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--operation", choices=("list", "get", "publish"), required=True)
    parser.add_argument("--prefix-b64")
    parser.add_argument("--key-b64")
    arguments = parser.parse_args()
    bucket = validate_bucket(arguments.bucket)
    if arguments.operation == "list":
        if not arguments.prefix_b64:
            fail("list requires --prefix-b64")
        list_operation(bucket, arguments.prefix_b64)
        return
    if arguments.operation == "publish":
        if not arguments.prefix_b64:
            fail("publish requires --prefix-b64")
        # The prefix argument is validated both at the SSH argv boundary and
        # against the stream header before the lock is acquired.
        requested_prefix = validate_prefix(decode_value(arguments.prefix_b64, "prefix"))
        publish(bucket, requested_prefix)
        return
    if not arguments.key_b64:
        fail("get requires --key-b64")
    key = decode_value(arguments.key_b64, "key")
    os.execvp(ossutil_command(), ossutil_argv(["cat", destination(bucket, key)]))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001 - bridge must return a concise non-zero failure to SSH.
        sys.stderr.write(f"runtime-release-bridge: {error}\n")
        sys.exit(1)
