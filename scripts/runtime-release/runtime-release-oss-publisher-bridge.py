#!/usr/bin/env python3
"""Restricted ECS-side bridge for immutable runtime release publishing.

The ECS bridge is deliberately a small protocol adapter.  Runtime bytes are
streamed over SSH into one private, bounded spool file at a time.  The file is
hashed before the OSS v2 conditional put, and is removed only after the put
attempt completes.  A completion manifest is written last.  A killed process
therefore leaves a detectable spool entry instead of allowing a later process
to guess which bytes are safe to reuse.
"""

import argparse
import base64
import fcntl
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import tempfile
from typing import Any, Dict, List, NoReturn, Optional, Tuple
from urllib.error import URLError
from urllib.request import ProxyHandler, Request, build_opener


KEY_PREFIX = "runtime/releases/"
MANIFEST_NAME = ".act-runtime-release.v1.json"
MANIFEST_SCHEMA_VERSION = "act-runtime-release.v1"
BUCKET_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$")
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
ROLE_NAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
PUBLISHER_ECS_ROLE_NAME = "act-runtime-oss-publisher"
READER_ECS_ROLE_NAME = "act-runtime-oss-read"
EXPECTED_ECS_ROLE_NAME = PUBLISHER_ECS_ROLE_NAME
OSS_ENDPOINT = "oss-cn-hangzhou-internal.aliyuncs.com"
OSS_REGION = "cn-hangzhou"
DEFAULT_OSSUTIL_PATH = "/opt/act-ops/ossutil-2.3.0/ossutil"
DEFAULT_V1_OSSUTIL_PATH = "/usr/local/bin/ossutil"
DEFAULT_IMDS_ROLE_URL = "http://100.100.100.200/latest/meta-data/ram/security-credentials/"
DEFAULT_SPOOL_DIR = "/var/lib/act/runtime-release-spool"
DEFAULT_LOCK_DIR = "/var/lib/act/runtime-release-locks"
EXPECTED_OSSUTIL_SHA256 = "1a0b6d3f955d464a6dec9d7c3f81c036781619f012311d20a4c69a4c626ed356"
MAX_FRAME_BYTES = 256 * 1024 * 1024
MIN_FREE_BYTES = 1024 * 1024 * 1024
MAX_SAFE_INTEGER = 9007199254740991
OBJECT_NUMBER_SUMMARY = re.compile(r"^Object Number is:? [0-9]+$")
TOTAL_SIZE_SUMMARY = re.compile(r"^Total Size is:? [0-9]+$")
ELAPSED_SUMMARY = re.compile(r"^[0-9]+(?:\.[0-9]+)?\(s\) elapsed$")
_CURRENT_ROLE_NAME: Optional[str] = None
_V2_WRITER_VALIDATED = False
_IMDS_OPENER = build_opener(ProxyHandler({}))


def fail(message: str) -> NoReturn:
    raise RuntimeError(message)


def test_mode() -> bool:
    return os.environ.get("ACT_RUNTIME_RELEASE_TEST_MODE") == "1"


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
    if any(ord(char) < 0x20 or ord(char) == 0x7F for char in key):
        fail("Object key contains a control character")
    if not key.startswith(KEY_PREFIX) or "\\" in key:
        fail("Object key is outside the immutable runtime release prefix")
    parts = key.split("/")
    if any(not part or part in {".", ".."} for part in parts):
        fail("Object key contains an unsafe path component")
    return key


def validate_prefix(prefix: str) -> str:
    if any(ord(char) < 0x20 or ord(char) == 0x7F for char in prefix):
        fail("Release prefix contains a control character")
    if not prefix.startswith(KEY_PREFIX) or not prefix.endswith("/"):
        fail("Release prefix is outside the immutable runtime release prefix")
    parts = prefix.split("/")
    if any(not part or part in {".", ".."} for part in parts[:-1]):
        fail("Release prefix contains an unsafe path component")
    return prefix


def destination(bucket: str, key: str) -> str:
    return f"oss://{validate_bucket(bucket)}/{validate_key(key)}"


def ossutil_command(version: str = "v2") -> str:
    global _V2_WRITER_VALIDATED
    override = os.environ.get("ACT_RUNTIME_RELEASE_OSSUTIL")
    if override is not None:
        if not test_mode():
            fail("ossutil path override is restricted to the explicit test mode")
        if not override.startswith("/") or any(ord(char) < 0x20 or ord(char) == 0x7F for char in override):
            fail("ossutil test override must be an absolute path without control characters")
        return override
    if version == "v1":
        v1_override = os.environ.get("ACT_RUNTIME_RELEASE_V1_OSSUTIL")
        if v1_override is not None:
            if not test_mode():
                fail("v1 ossutil path override is restricted to the explicit test mode")
            if not v1_override.startswith("/") or any(ord(char) < 0x20 or ord(char) == 0x7F for char in v1_override):
                fail("v1 ossutil test override must be an absolute path without control characters")
            return v1_override
        return DEFAULT_V1_OSSUTIL_PATH
    if not _V2_WRITER_VALIDATED:
        try:
            details = os.lstat(DEFAULT_OSSUTIL_PATH)
        except OSError as error:
            fail(f"unable to stat the fixed ossutil v2 writer: {error}")
        if not stat.S_ISREG(details.st_mode) or details.st_uid != 0 or stat.S_IMODE(details.st_mode) & 0o022:
            fail("fixed ossutil v2 writer must be a root-owned regular file without group/other write permissions")
        digest = hashlib.sha256()
        try:
            with open(DEFAULT_OSSUTIL_PATH, "rb") as binary:
                for chunk in iter(lambda: binary.read(1024 * 1024), b""):
                    digest.update(chunk)
        except OSError as error:
            fail(f"unable to hash the fixed ossutil v2 writer: {error}")
        if digest.hexdigest() != EXPECTED_OSSUTIL_SHA256:
            fail("fixed ossutil v2 writer SHA-256 does not match the pinned release")
        _V2_WRITER_VALIDATED = True
    return DEFAULT_OSSUTIL_PATH


def current_ecs_role_name() -> str:
    global _CURRENT_ROLE_NAME
    if _CURRENT_ROLE_NAME is not None:
        return _CURRENT_ROLE_NAME
    metadata_override = os.environ.get("ACT_RUNTIME_RELEASE_IMDS_ROLE_URL")
    if metadata_override is not None and not test_mode():
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


def ossutil_argv(version: str, arguments: List[str]) -> List[str]:
    role = current_ecs_role_name()
    if version == "v1":
        auth = ["--mode", "EcsRamRole", "--ecs-role-name", role, "--endpoint", OSS_ENDPOINT]
    else:
        auth = ["--mode", "EcsRamRole", "--endpoint", OSS_ENDPOINT, "--region", OSS_REGION]
    return [ossutil_command(version)] + arguments + auth


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def run_v2(arguments: List[str]) -> Tuple[bytes, bytes]:
    process = subprocess.run(
        ossutil_argv("v2", arguments),
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return process.stdout, process.stderr


def parse_decimal(value: Any, label: str) -> int:
    if isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= MAX_SAFE_INTEGER:
        return value
    if isinstance(value, str) and re.fullmatch(r"[0-9]+", value):
        number = int(value)
        if number >= 0:
            return number
    fail(f"{label} is not a non-negative integer")


def manifest_integer(value: Any, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0 or value > MAX_SAFE_INTEGER:
        fail(f"{label} is not a non-negative safe integer")
    return value


def remote_digest(bucket: str, key: str) -> Dict[str, Any]:
    process = subprocess.Popen(
        ossutil_argv("v2", ["api", "get-object", "--bucket", bucket, "--key", validate_key(key), "-q"]),
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
        fail(f"ossutil v2 get-object failed for {key}: {stderr.strip()}")
    return {"sizeBytes": size, "sha256": digest.hexdigest()}


def read_manifest_wire(bucket: str, key: str) -> bytes:
    process = subprocess.Popen(
        ossutil_argv("v2", ["api", "get-object", "--bucket", bucket, "--key", validate_key(key), "-q"]),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    chunks: List[bytes] = []
    size = 0
    assert process.stdout is not None
    for chunk in iter(lambda: process.stdout.read(1024 * 1024), b""):
        size += len(chunk)
        if size > MAX_FRAME_BYTES:
            fail("runtime release manifest exceeds the maximum accepted size")
        chunks.append(chunk)
    stderr = process.stderr.read().decode("utf-8", errors="replace") if process.stderr else ""
    if process.wait() != 0:
        fail(f"ossutil v2 get-object failed for {key}: {stderr.strip()}")
    return b"".join(chunks)


def list_objects_v2(bucket: str, prefix: str) -> List[Dict[str, Any]]:
    validate_prefix(prefix)
    continuation: Optional[str] = None
    seen_tokens = set()
    seen_keys = set()
    normalized: List[Dict[str, Any]] = []
    while True:
        arguments = [
            "api", "list-objects-v2", "--bucket", bucket, "--prefix", prefix,
            "--max-keys", "1000", "--output-format", "json", "-q",
        ]
        if continuation is not None:
            arguments += ["--continuation-token", continuation]
        stdout, stderr = run_v2(arguments)
        if stderr.strip():
            fail(f"ossutil v2 list-objects-v2 emitted unexpected stderr: {stderr.decode('utf-8', errors='replace').strip()}")
        try:
            payload = json.loads(stdout.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            fail(f"ossutil v2 list-objects-v2 returned invalid JSON: {error}")
        if not isinstance(payload, dict) or payload.get("Name") not in {None, bucket} or payload.get("Prefix") not in {None, prefix}:
            fail("ossutil v2 list-objects-v2 returned an invalid bucket or prefix")
        raw_contents = payload.get("Contents", [])
        if isinstance(raw_contents, dict):
            contents = [raw_contents]
        elif isinstance(raw_contents, list):
            contents = raw_contents
        else:
            fail("ossutil v2 list-objects-v2 Contents is invalid")
        if "KeyCount" in payload and parse_decimal(payload["KeyCount"], "KeyCount") != len(contents):
            fail("ossutil v2 list-objects-v2 KeyCount does not match Contents")
        for item in contents:
            if not isinstance(item, dict) or not isinstance(item.get("Key"), str):
                fail("ossutil v2 list-objects-v2 object entry is invalid")
            key = validate_key(item["Key"])
            if not key.startswith(prefix):
                fail(f"ossutil v2 list-objects-v2 returned an object outside the requested prefix: {key}")
            if key in seen_keys:
                fail(f"remote release list contains duplicate object: {key}")
            seen_keys.add(key)
            normalized.append({"key": key, "sizeBytes": parse_decimal(item.get("Size"), f"Size for {key}")})
        truncated = payload.get("IsTruncated", False)
        if truncated in (False, "false", "False", None):
            break
        if truncated not in (True, "true", "True"):
            fail("ossutil v2 list-objects-v2 IsTruncated is invalid")
        next_token = payload.get("NextContinuationToken")
        if not isinstance(next_token, str) or not next_token or next_token in seen_tokens:
            fail("ossutil v2 list-objects-v2 continuation token is missing or repeated")
        seen_tokens.add(next_token)
        continuation = next_token
    return sorted(normalized, key=lambda entry: entry["key"])


def list_objects_v1(bucket: str, prefix: str) -> List[Dict[str, Any]]:
    process = subprocess.run(
        ossutil_argv("v1", ["ls", f"oss://{validate_bucket(bucket)}/{validate_prefix(prefix)}", "-s"]),
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        encoding="utf-8",
        errors="strict",
    )
    if process.returncode != 0:
        fail(f"ossutil v1 ls failed: {process.stderr.strip()}")
    if process.stderr.strip():
        fail(f"ossutil v1 ls emitted unexpected stderr: {process.stderr.strip()}")
    object_prefix = f"oss://{bucket}/"
    normalized: List[Dict[str, Any]] = []
    seen = set()
    for raw_line in process.stdout.split("\n"):
        line = raw_line.rstrip("\r\n")
        if not line:
            continue
        if OBJECT_NUMBER_SUMMARY.fullmatch(line) or TOTAL_SIZE_SUMMARY.fullmatch(line) or ELAPSED_SUMMARY.fullmatch(line):
            continue
        if any(ord(char) < 0x20 or ord(char) == 0x7F for char in line):
            fail("ossutil v1 ls output contains a control character")
        if not line.startswith(object_prefix):
            fail(f"ossutil v1 ls output contains an unknown line: {line}")
        key = line[len(object_prefix):]
        if not key.startswith(prefix):
            fail(f"ossutil v1 ls output contains an object outside the requested prefix: {line}")
        validate_key(key)
        if key in seen:
            fail(f"remote release list contains duplicate object: {key}")
        seen.add(key)
        normalized.append({"key": key, "sizeBytes": -1})
    return sorted(normalized, key=lambda entry: entry["key"])


def cross_check_v1_keys(bucket: str, prefix: str, v2_objects: List[Dict[str, Any]]) -> None:
    v2_keys = {entry["key"] for entry in v2_objects}
    v1_keys = {entry["key"] for entry in list_objects_v1(bucket, prefix)}
    if v1_keys != v2_keys:
        fail("ossutil v1 read-only cross-check does not match the v2 object set")


def list_objects(bucket: str, prefix: str) -> List[Dict[str, Any]]:
    return list_objects_v2(bucket, prefix)


def write_json(value: Any) -> None:
    sys.stdout.write(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def lock_path(prefix: str) -> str:
    lock_dir = os.environ.get("ACT_RUNTIME_RELEASE_LOCK_DIR", DEFAULT_LOCK_DIR)
    if not lock_dir.startswith("/") or any(ord(char) < 0x20 or ord(char) == 0x7F for char in lock_dir):
        fail("runtime release lock directory must be an absolute path")
    os.makedirs(lock_dir, mode=0o700, exist_ok=True)
    token = hashlib.sha256(prefix.encode("utf-8")).hexdigest()
    return os.path.join(lock_dir, f"act-runtime-release-{token}.lock")


def spool_root() -> str:
    override = os.environ.get("ACT_RUNTIME_RELEASE_SPOOL_DIR")
    if override is not None and not test_mode():
        fail("runtime release spool directory override is restricted to the explicit test mode")
    value = override or DEFAULT_SPOOL_DIR
    if not value.startswith("/") or any(ord(char) < 0x20 or ord(char) == 0x7F for char in value):
        fail("runtime release spool directory must be an absolute path")
    return value


def checked_directory(path: str, mode: int, label: str) -> None:
    if os.path.islink(path):
        fail(f"{label} must not be a symbolic link")
    try:
        details = os.stat(path)
    except OSError as error:
        fail(f"unable to stat {label}: {error}")
    if not stat.S_ISDIR(details.st_mode) or stat.S_IMODE(details.st_mode) != mode:
        fail(f"{label} must be a directory with mode {mode:04o}")
    if not test_mode() and details.st_uid != 0:
        fail(f"{label} must be owned by root")


def release_spool_directory(prefix: str) -> str:
    root = spool_root()
    if not os.path.exists(root):
        os.makedirs(root, mode=0o700)
    checked_directory(root, 0o700, "runtime release spool root")
    release_dir = os.path.join(root, hashlib.sha256(prefix.encode("utf-8")).hexdigest())
    if os.path.exists(release_dir):
        checked_directory(release_dir, 0o700, "runtime release spool directory")
    else:
        os.mkdir(release_dir, 0o700)
        checked_directory(release_dir, 0o700, "runtime release spool directory")
    entries = os.listdir(release_dir)
    if entries:
        fail("runtime release spool contains residual files; manual inspection is required")
    return release_dir


def remove_temp(path: Optional[str]) -> None:
    if path is None:
        return
    try:
        details = os.lstat(path)
    except FileNotFoundError:
        return
    if not stat.S_ISREG(details.st_mode):
        fail("runtime release spool entry is not a regular file")
    os.unlink(path)


def new_spool_file(directory: str, expected_size: int) -> Tuple[int, str]:
    available = os.statvfs(directory).f_bavail * os.statvfs(directory).f_frsize
    if available < expected_size + MIN_FREE_BYTES:
        fail("runtime release spool does not have the required object space and 1 GiB reserve")
    fd, path = tempfile.mkstemp(prefix=".frame-", suffix=".part", dir=directory)
    os.chmod(path, 0o600)
    details = os.stat(path)
    if stat.S_IMODE(details.st_mode) != 0o600 or (not test_mode() and details.st_uid != 0):
        remove_temp(path)
        fail("runtime release spool file has unsafe ownership or mode")
    return fd, path


def expected_manifest_files(manifest: Dict[str, Any], release_id: str) -> List[Dict[str, Any]]:
    files = manifest.get("files")
    if not isinstance(files, list) or not files:
        fail("manifest.files is invalid")
    if manifest_integer(manifest.get("fileCount"), "manifest.fileCount") != len(files):
        fail("manifest.fileCount does not match manifest.files")
    expected: List[Dict[str, Any]] = []
    seen = set()
    total = 0
    previous_path: Optional[str] = None
    for item in files:
        if not isinstance(item, dict) or set(item) != {"path", "objectKey", "sizeBytes", "sha256"}:
            fail("manifest file entry is invalid")
        path = item.get("path")
        key = item.get("objectKey")
        size = item.get("sizeBytes")
        digest = item.get("sha256")
        if (
            not isinstance(path, str)
            or not path
            or path.startswith("/")
            or re.match(r"^[A-Za-z]:/", path)
            or "\\" in path
            or any(ord(char) < 0x20 or ord(char) == 0x7F for char in path)
            or any(part in {"", ".", ".."} for part in path.split("/"))
        ):
            fail("manifest file path is invalid")
        if not isinstance(key, str) or not isinstance(digest, str) or not SHA256_PATTERN.fullmatch(digest):
            fail("manifest file expectation is invalid")
        size = manifest_integer(size, f"manifest file size for {path}")
        if size > MAX_FRAME_BYTES:
            fail("manifest file exceeds the maximum runtime frame size")
        expected_key = f"{KEY_PREFIX}{release_id}/{path}"
        if key != expected_key:
            fail("manifest object key is not release-bound")
        validate_key(key)
        if previous_path is not None and previous_path >= path:
            fail("manifest.files must be strictly code-point sorted")
        previous_path = path
        if key in seen:
            fail("manifest contains duplicate object keys")
        seen.add(key)
        total += size
        if total > MAX_SAFE_INTEGER:
            fail("manifest totalBytes exceeds the maximum safe integer")
        expected.append({"path": path, "key": key, "sizeBytes": size, "sha256": digest})
    if manifest_integer(manifest.get("totalBytes"), "manifest.totalBytes") != total:
        fail("manifest.totalBytes does not match manifest.files")
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
    required_fields = {"schemaVersion", "releaseId", "sourceRevision", "fileCount", "totalBytes", "treeSha256", "manifestSha256", "files"}
    if not isinstance(manifest, dict) or set(manifest) != required_fields or manifest.get("schemaVersion") != MANIFEST_SCHEMA_VERSION or manifest.get("releaseId") != release_id or manifest.get("manifestSha256") != semantic_sha:
        fail("manifest identity does not match publish header")
    source_revision = manifest.get("sourceRevision")
    tree_sha = manifest.get("treeSha256")
    if not isinstance(source_revision, str) or not re.fullmatch(r"[0-9a-f]{40}", source_revision) or not isinstance(tree_sha, str) or not SHA256_PATTERN.fullmatch(tree_sha):
        fail("manifest source identity is invalid")
    expected = expected_manifest_files(manifest, release_id)
    calculated_tree_sha = hashlib.sha256(canonical_json([{"path": entry["path"], "sizeBytes": entry["sizeBytes"], "sha256": entry["sha256"]} for entry in expected])).hexdigest()
    if tree_sha != calculated_tree_sha:
        fail("manifest tree digest does not match its files")
    expected_release_id = "runtime-" + hashlib.sha256(canonical_json({"sourceRevision": source_revision, "treeSha256": tree_sha})).hexdigest()[:55]
    if release_id != expected_release_id:
        fail("release id is not content-addressed")
    if canonical_json(manifest) + b"\n" != wire:
        fail("manifest wire bytes are not canonical")
    without_digest = {
        "schemaVersion": MANIFEST_SCHEMA_VERSION,
        "releaseId": release_id,
        "sourceRevision": source_revision,
        "fileCount": manifest["fileCount"],
        "totalBytes": manifest["totalBytes"],
        "treeSha256": tree_sha,
        "files": [{"path": entry["path"], "objectKey": entry["key"], "sizeBytes": entry["sizeBytes"], "sha256": entry["sha256"]} for entry in expected],
    }
    if hashlib.sha256(canonical_json(without_digest)).hexdigest() != semantic_sha:
        fail("manifest semantic digest does not match canonical content")
    return prefix, manifest, wire, wire_sha, expected


def read_validated_manifest(bucket: str, prefix: str) -> Tuple[Dict[str, Any], bytes, str, List[Dict[str, Any]]]:
    prefix = validate_prefix(prefix)
    release_id = prefix.rstrip("/").split("/")[-1]
    wire = read_manifest_wire(bucket, f"{prefix}{MANIFEST_NAME}")
    try:
        decoded = json.loads(wire.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"remote runtime release manifest is invalid: {error}")
    if not isinstance(decoded, dict):
        fail("remote runtime release manifest must be an object")
    manifest_sha = decoded.get("manifestSha256")
    if not isinstance(manifest_sha, str):
        fail("remote runtime release manifest semantic digest is invalid")
    verified_prefix, manifest, _, wire_sha, files = validate_publish_header({
        "protocol": "act-runtime-release-stream.v1",
        "releaseId": release_id,
        "prefix": prefix,
        "manifestSha256": manifest_sha,
        "wireSha256": hashlib.sha256(wire).hexdigest(),
        "manifestWireBase64": base64.urlsafe_b64encode(wire).decode("ascii").rstrip("="),
    }, bucket)
    if verified_prefix != prefix:
        fail("remote runtime release manifest prefix is invalid")
    return manifest, wire, wire_sha, files


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


def put_spooled_file(bucket: str, key: str, path: str, expected_size: int, expected_sha: str) -> Dict[str, Any]:
    arguments = [
        "api", "put-object", "--bucket", bucket, "--key", validate_key(key),
        "--body", f"file://{path}", "--forbid-overwrite", "-q",
    ]
    process = subprocess.run(
        ossutil_argv("v2", arguments),
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    if process.returncode != 0:
        try:
            remote = remote_digest(bucket, key)
        except RuntimeError:
            remote = None
        if remote == {"sizeBytes": expected_size, "sha256": expected_sha}:
            return remote
        detail = process.stderr.decode("utf-8", errors="replace").strip()
        fail(f"ossutil v2 conditional put failed for {key}: {detail}")
    remote = remote_digest(bucket, key)
    if remote != {"sizeBytes": expected_size, "sha256": expected_sha}:
        fail(f"remote object differs from source spool for {key}")
    return remote


def put_payload(bucket: str, key: str, payload: bytes, expected_sha: str, directory: str) -> Dict[str, Any]:
    if len(payload) > MAX_FRAME_BYTES:
        fail("payload exceeds the maximum runtime frame size")
    if hashlib.sha256(payload).hexdigest() != expected_sha:
        fail(f"payload digest does not match the expected value for {key}")
    fd, path = new_spool_file(directory, len(payload))
    try:
        with os.fdopen(fd, "wb") as output:
            output.write(payload)
            output.flush()
            os.fsync(output.fileno())
        return put_spooled_file(bucket, key, path, len(payload), expected_sha)
    finally:
        remove_temp(path)


def receive_frame(directory: str, expected_size: int, expected_sha: str) -> str:
    if expected_size > MAX_FRAME_BYTES:
        fail("runtime frame exceeds the 256 MiB limit")
    fd, path = new_spool_file(directory, expected_size)
    digest = hashlib.sha256()
    size = 0
    try:
        with os.fdopen(fd, "wb") as output:
            remaining = expected_size
            while remaining:
                chunk = sys.stdin.buffer.read(min(1024 * 1024, remaining))
                if not chunk:
                    fail("publisher stream ended before the expected object bytes")
                output.write(chunk)
                digest.update(chunk)
                size += len(chunk)
                remaining -= len(chunk)
            output.flush()
            os.fsync(output.fileno())
        if size != expected_size or digest.hexdigest() != expected_sha:
            fail("source bytes differ from manifest")
        return path
    except Exception:
        remove_temp(path)
        raise


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
    spool_directory: Optional[str] = None
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        spool_directory = release_spool_directory(prefix)
        objects = list_objects(bucket, prefix)
        existing = {str(entry["key"]): int(entry["sizeBytes"]) for entry in objects}
        if manifest_key in existing:
            assert_object_set(objects, expected_sizes, allow_manifest=True)
            if remote_digest(bucket, manifest_key) != {"sizeBytes": len(wire), "sha256": wire_sha}:
                fail("existing completion manifest differs from the submitted immutable identity")
            for entry in files:
                if remote_digest(bucket, entry["key"]) != {"sizeBytes": entry["sizeBytes"], "sha256": entry["sha256"]}:
                    fail(f"remote object differs from manifest for {entry['key']}")
            cross_check_v1_keys(bucket, prefix, objects)
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
            temp_path = receive_frame(spool_directory, entry["sizeBytes"], entry["sha256"])
            try:
                put_spooled_file(bucket, entry["key"], temp_path, entry["sizeBytes"], entry["sha256"])
            finally:
                remove_temp(temp_path)
            put_count += 1
        if sys.stdin.buffer.readline().strip() != b"DONE":
            fail("publisher stream did not terminate its object frames with DONE")
        put_payload(bucket, manifest_key, wire, wire_sha, spool_directory)
        put_count += 1
        final_objects = list_objects(bucket, prefix)
        assert_object_set(final_objects, expected_sizes, allow_manifest=True)
        cross_check_v1_keys(bucket, prefix, final_objects)
        if remote_digest(bucket, manifest_key) != {"sizeBytes": len(wire), "sha256": wire_sha}:
            fail("remote completion manifest failed final verification")
        for entry in files:
            if remote_digest(bucket, entry["key"]) != {"sizeBytes": entry["sizeBytes"], "sha256": entry["sha256"]}:
                fail(f"remote object failed final verification for {entry['key']}")
        write_json({"status": "complete", "releaseId": manifest["releaseId"], "manifestSha256": manifest["manifestSha256"], "wireSha256": wire_sha, "treeSha256": manifest["treeSha256"], "fileCount": manifest["fileCount"], "totalBytes": manifest["totalBytes"], "putCount": put_count})
    finally:
        if spool_directory is not None:
            try:
                os.rmdir(spool_directory)
            except OSError:
                pass
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
        lock_file.close()


def verify_operation(bucket: str, prefix_b64: str) -> None:
    prefix = validate_prefix(decode_value(prefix_b64, "prefix"))
    manifest, wire, wire_sha, files = read_validated_manifest(bucket, prefix)
    manifest_key = f"{prefix}{MANIFEST_NAME}"
    expected_sizes = {entry["key"]: entry["sizeBytes"] for entry in files}
    expected_sizes[manifest_key] = len(wire)
    objects = list_objects(bucket, prefix)
    assert_object_set(objects, expected_sizes, allow_manifest=True)
    cross_check_v1_keys(bucket, prefix, objects)
    if remote_digest(bucket, manifest_key) != {"sizeBytes": len(wire), "sha256": wire_sha}:
        fail("remote completion manifest failed read-role verification")
    for entry in files:
        if remote_digest(bucket, entry["key"]) != {"sizeBytes": entry["sizeBytes"], "sha256": entry["sha256"]}:
            fail(f"remote object failed read-role verification for {entry['key']}")
    write_json({
        "schemaVersion": "runtime-release-verification.v1",
        "releaseId": manifest["releaseId"],
        "manifestSha256": manifest["manifestSha256"],
        "wireSha256": wire_sha,
        "treeSha256": manifest["treeSha256"],
        "fileCount": manifest["fileCount"],
        "totalBytes": manifest["totalBytes"],
    })


def list_operation(bucket: str, prefix_b64: str) -> None:
    write_json(list_objects(bucket, decode_value(prefix_b64, "prefix")))


def main() -> None:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--operation", choices=("list", "get", "publish", "verify"), required=True)
    parser.add_argument("--prefix-b64")
    parser.add_argument("--key-b64")
    arguments = parser.parse_args()
    bucket = validate_bucket(arguments.bucket)
    global EXPECTED_ECS_ROLE_NAME
    EXPECTED_ECS_ROLE_NAME = PUBLISHER_ECS_ROLE_NAME if arguments.operation == "publish" else READER_ECS_ROLE_NAME
    if arguments.operation == "list":
        if not arguments.prefix_b64:
            fail("list requires --prefix-b64")
        list_operation(bucket, arguments.prefix_b64)
        return
    if arguments.operation == "publish":
        if not arguments.prefix_b64:
            fail("publish requires --prefix-b64")
        requested_prefix = validate_prefix(decode_value(arguments.prefix_b64, "prefix"))
        publish(bucket, requested_prefix)
        return
    if arguments.operation == "verify":
        if not arguments.prefix_b64:
            fail("verify requires --prefix-b64")
        verify_operation(bucket, arguments.prefix_b64)
        return
    if not arguments.key_b64:
        fail("get requires --key-b64")
    key = decode_value(arguments.key_b64, "key")
    os.execvp(ossutil_command("v2"), ossutil_argv("v2", ["api", "get-object", "--bucket", bucket, "--key", validate_key(key), "-q"]))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001 - bridge must return a concise non-zero failure to SSH.
        sys.stderr.write(f"runtime-release-bridge: {error}\n")
        sys.exit(1)
