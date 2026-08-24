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
BLOB_RELEASE_KEY_PREFIX = "runtime/blob-releases/"
BLOB_KEY_PREFIX = "runtime/blobs/sha256/"
MANIFEST_NAME = ".act-runtime-release.v1.json"
MANIFEST_SCHEMA_VERSION = "act-runtime-release.v1"
BLOB_MANIFEST_NAME = "manifest.json"
BLOB_MANIFEST_SCHEMA_VERSION = "act-runtime-release.v2"
BLOB_RECEIPT_NAME = "receipt.json"
BLOB_RECEIPT_SCHEMA_VERSION = "act-runtime-release-receipt.v2"
BUCKET_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$")
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
ETAG_PATTERN = re.compile(r'^"?[0-9a-fA-F]{32}(?:-[0-9]+)?"?$')
EXTERNAL_INPUT_ID_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$")
SOURCE_OBJECT_ID_PATTERN = re.compile(r"^(?:[0-9a-f]{40}|[0-9a-f]{64})$")
ROLE_NAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
ECS_ROLE_NAME = "act-runtime-oss-release-operator-ecs"
EXPECTED_ECS_ROLE_NAME = ECS_ROLE_NAME
ECS_OSS_ENDPOINT = "oss-cn-hangzhou-internal.aliyuncs.com"
LOCAL_OSS_ENDPOINT = "https://oss-cn-hangzhou.aliyuncs.com"
OSS_REGION = "cn-hangzhou"
DEFAULT_OSSUTIL_PATH = "/opt/act-ops/ossutil-2.3.0/ossutil"
DEFAULT_V1_OSSUTIL_PATH = "/usr/local/bin/ossutil"
DEFAULT_IMDS_ROLE_URL = "http://100.100.100.200/latest/meta-data/ram/security-credentials/"
DEFAULT_SPOOL_DIR = "/var/lib/act/runtime-release-spool"
DEFAULT_LOCK_DIR = "/var/lib/act/runtime-release-locks"
EXPECTED_OSSUTIL_SHA256 = "1a0b6d3f955d464a6dec9d7c3f81c036781619f012311d20a4c69a4c626ed356"
MAX_FRAME_BYTES = 256 * 1024 * 1024
READINESS_SAMPLE_MAX_BYTES = 4 * 1024 * 1024
MIN_FREE_BYTES = 1024 * 1024 * 1024
MAX_SAFE_INTEGER = 9007199254740991
OBJECT_NUMBER_SUMMARY = re.compile(r"^Object Number is:? [0-9]+$")
TOTAL_SIZE_SUMMARY = re.compile(r"^Total Size is:? [0-9]+$")
ELAPSED_SUMMARY = re.compile(r"^[0-9]+(?:\.[0-9]+)?\(s\) elapsed$")
_CURRENT_ROLE_NAME: Optional[str] = None
_V2_WRITER_VALIDATED = False
_IMDS_OPENER = build_opener(ProxyHandler({}))
_CREDENTIAL_MODE = "ecs"
_LOCAL_OSSUTIL_PATH: Optional[str] = None
_LOCAL_OSSUTIL_SHA256: Optional[str] = None
_LOCAL_IDENTITY_COMMAND_PATH: Optional[str] = None
_LOCAL_IDENTITY_COMMAND_SHA256: Optional[str] = None
_LOCAL_EXPECTED_ACCOUNT_ID: Optional[str] = None
_LOCAL_EXPECTED_PRINCIPAL_ARN: Optional[str] = None
_LOCAL_CREDENTIAL_PROFILE: Optional[str] = None
_LOCAL_LOCK_DIR: Optional[str] = None
_LOCAL_SPOOL_DIR: Optional[str] = None
_LOCAL_PRINCIPAL_VALIDATED = False


def fail(message: str) -> NoReturn:
    raise RuntimeError(message)


def test_mode() -> bool:
    return os.environ.get("ACT_RUNTIME_RELEASE_TEST_MODE") == "1"


def safe_absolute_path(value: str, label: str) -> str:
    if not value.startswith("/") or any(ord(char) < 0x20 or ord(char) == 0x7F for char in value):
        fail(f"{label} must be an absolute path without control characters")
    return value


def sha256_file(path: str, label: str) -> str:
    try:
        details = os.lstat(path)
    except OSError as error:
        fail(f"unable to stat {label}: {error}")
    if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode) or stat.S_IMODE(details.st_mode) & 0o022:
        fail(f"{label} must be a non-symlink regular file without group/other write permissions")
    digest = hashlib.sha256()
    try:
        with open(path, "rb") as binary:
            for chunk in iter(lambda: binary.read(1024 * 1024), b""):
                digest.update(chunk)
    except OSError as error:
        fail(f"unable to hash {label}: {error}")
    return digest.hexdigest()


def configure_local_publisher(arguments: argparse.Namespace) -> None:
    global _CREDENTIAL_MODE, _LOCAL_OSSUTIL_PATH, _LOCAL_OSSUTIL_SHA256
    global _LOCAL_IDENTITY_COMMAND_PATH, _LOCAL_IDENTITY_COMMAND_SHA256
    global _LOCAL_EXPECTED_ACCOUNT_ID, _LOCAL_EXPECTED_PRINCIPAL_ARN, _LOCAL_CREDENTIAL_PROFILE
    global _LOCAL_LOCK_DIR, _LOCAL_SPOOL_DIR
    _CREDENTIAL_MODE = arguments.credential_mode
    local_values = [
        arguments.ossutil_path, arguments.ossutil_sha256, arguments.identity_command_path,
        arguments.identity_command_sha256, arguments.operator_account_id,
        arguments.operator_principal_arn, arguments.lock_dir, arguments.spool_dir,
    ]
    if _CREDENTIAL_MODE == "ecs":
        if any(value is not None for value in local_values) or arguments.credential_profile is not None:
            fail("local publisher options are invalid in ECS credential mode")
        return
    if any(value is None for value in local_values):
        fail("local publisher requires pinned ossutil and identity binaries, expected principal, lock directory and spool directory")
    _LOCAL_OSSUTIL_PATH = safe_absolute_path(arguments.ossutil_path, "local ossutil path")
    _LOCAL_IDENTITY_COMMAND_PATH = safe_absolute_path(arguments.identity_command_path, "local identity command path")
    _LOCAL_LOCK_DIR = safe_absolute_path(arguments.lock_dir, "local lock directory")
    _LOCAL_SPOOL_DIR = safe_absolute_path(arguments.spool_dir, "local spool directory")
    _LOCAL_OSSUTIL_SHA256 = arguments.ossutil_sha256
    _LOCAL_IDENTITY_COMMAND_SHA256 = arguments.identity_command_sha256
    if not SHA256_PATTERN.fullmatch(_LOCAL_OSSUTIL_SHA256) or not SHA256_PATTERN.fullmatch(_LOCAL_IDENTITY_COMMAND_SHA256):
        fail("local publisher binary SHA-256 pins are invalid")
    if sha256_file(_LOCAL_OSSUTIL_PATH, "local ossutil") != _LOCAL_OSSUTIL_SHA256:
        fail("local ossutil SHA-256 does not match its configured pin")
    if sha256_file(_LOCAL_IDENTITY_COMMAND_PATH, "local identity command") != _LOCAL_IDENTITY_COMMAND_SHA256:
        fail("local identity command SHA-256 does not match its configured pin")
    _LOCAL_EXPECTED_ACCOUNT_ID = arguments.operator_account_id
    _LOCAL_EXPECTED_PRINCIPAL_ARN = arguments.operator_principal_arn
    if not re.fullmatch(r"[0-9]{12,32}", _LOCAL_EXPECTED_ACCOUNT_ID) or not _LOCAL_EXPECTED_PRINCIPAL_ARN.startswith("acs:ram::"):
        fail("local publisher expected account or principal is invalid")
    if arguments.credential_profile is not None:
        if not ROLE_NAME_PATTERN.fullmatch(arguments.credential_profile):
            fail("local credential profile is invalid")
        _LOCAL_CREDENTIAL_PROFILE = arguments.credential_profile


def current_local_principal() -> None:
    global _LOCAL_PRINCIPAL_VALIDATED
    if _LOCAL_PRINCIPAL_VALIDATED:
        return
    if _LOCAL_IDENTITY_COMMAND_PATH is None or _LOCAL_EXPECTED_ACCOUNT_ID is None or _LOCAL_EXPECTED_PRINCIPAL_ARN is None:
        fail("local publisher identity configuration is incomplete")
    command = [_LOCAL_IDENTITY_COMMAND_PATH]
    if _LOCAL_CREDENTIAL_PROFILE is not None:
        command += ["--profile", _LOCAL_CREDENTIAL_PROFILE]
    command += ["sts", "GetCallerIdentity"]
    process = subprocess.run(command, check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if process.returncode != 0:
        fail("local publisher identity preflight command failed")
    try:
        payload = json.loads(process.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"local publisher identity preflight returned invalid JSON: {error}")
    if not isinstance(payload, dict) or payload.get("AccountId") != _LOCAL_EXPECTED_ACCOUNT_ID or payload.get("Arn") != _LOCAL_EXPECTED_PRINCIPAL_ARN:
        fail("local publisher identity does not match the configured operator principal")
    _LOCAL_PRINCIPAL_VALIDATED = True


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
    if key.startswith(BLOB_KEY_PREFIX):
        digest = key[len(BLOB_KEY_PREFIX):]
        if not SHA256_PATTERN.fullmatch(digest):
            fail("Blob object key is not SHA-256 addressed")
        return key
    if (not key.startswith(KEY_PREFIX) and not key.startswith(BLOB_RELEASE_KEY_PREFIX)) or "\\" in key:
        fail("Object key is outside the immutable runtime release namespace")
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


def validate_blob_release_prefix(prefix: str) -> str:
    if any(ord(char) < 0x20 or ord(char) == 0x7F for char in prefix):
        fail("Blob release prefix contains a control character")
    if not prefix.startswith(BLOB_RELEASE_KEY_PREFIX) or not prefix.endswith("/"):
        fail("Blob release prefix is outside the immutable runtime blob release prefix")
    parts = prefix.split("/")
    if any(not part or part in {".", ".."} for part in parts[:-1]):
        fail("Blob release prefix contains an unsafe path component")
    return prefix


def validate_release_prefix(prefix: str) -> str:
    if prefix.startswith(KEY_PREFIX):
        return validate_prefix(prefix)
    return validate_blob_release_prefix(prefix)


def validate_list_prefix(prefix: str) -> str:
    if prefix == BLOB_KEY_PREFIX:
        return prefix
    if prefix.startswith(BLOB_KEY_PREFIX):
        return validate_key(prefix)
    return validate_release_prefix(prefix)


def destination(bucket: str, key: str) -> str:
    return f"oss://{validate_bucket(bucket)}/{validate_key(key)}"


def ossutil_command(version: str = "v2") -> str:
    global _V2_WRITER_VALIDATED
    if _CREDENTIAL_MODE == "local":
        if _LOCAL_OSSUTIL_PATH is None or _LOCAL_OSSUTIL_SHA256 is None:
            fail("local publisher ossutil configuration is incomplete")
        if sha256_file(_LOCAL_OSSUTIL_PATH, "local ossutil") != _LOCAL_OSSUTIL_SHA256:
            fail("local ossutil SHA-256 changed after preflight")
        return _LOCAL_OSSUTIL_PATH
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
        fail("ECS RAM role metadata does not match the restricted release operator role")
    _CURRENT_ROLE_NAME = role_names[0]
    return _CURRENT_ROLE_NAME


def ossutil_argv(version: str, arguments: List[str]) -> List[str]:
    if _CREDENTIAL_MODE == "local":
        current_local_principal()
        return [ossutil_command(version)] + arguments + ["--endpoint", LOCAL_OSS_ENDPOINT, "--region", OSS_REGION]
    role = current_ecs_role_name()
    if version == "v1":
        auth = ["--mode", "EcsRamRole", "--ecs-role-name", role, "--endpoint", ECS_OSS_ENDPOINT]
    else:
        auth = ["--mode", "EcsRamRole", "--endpoint", ECS_OSS_ENDPOINT, "--region", OSS_REGION]
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


def parse_blob_manifest_source(source: Any, label: str, allow_legacy: bool = True) -> Dict[str, str]:
    if not isinstance(source, dict):
        fail(f"{label} is invalid")
    keys = set(source)
    if keys == {"gitObjectId"}:
        object_id = source.get("gitObjectId")
        if not isinstance(object_id, str):
            fail(f"{label}.gitObjectId is invalid")
        normalized = object_id.lower()
        if not SOURCE_OBJECT_ID_PATTERN.fullmatch(normalized):
            fail(f"{label}.gitObjectId is invalid")
        return {"gitObjectId": normalized}
    if keys == {"externalInputId", "externalInputManifestObjectId", "bundleSemanticSha256", "bundleWireSha256"}:
        input_id = source.get("externalInputId")
        manifest_object_id = source.get("externalInputManifestObjectId")
        semantic_digest = source.get("bundleSemanticSha256")
        wire_digest = source.get("bundleWireSha256")
        if (
            not isinstance(input_id, str)
            or not EXTERNAL_INPUT_ID_PATTERN.fullmatch(input_id)
            or not isinstance(manifest_object_id, str)
            or not isinstance(semantic_digest, str)
            or not isinstance(wire_digest, str)
            or not SOURCE_OBJECT_ID_PATTERN.fullmatch(manifest_object_id.lower())
            or not SHA256_PATTERN.fullmatch(semantic_digest)
            or not SHA256_PATTERN.fullmatch(wire_digest)
        ):
            fail(f"{label} is invalid")
        return {
            "externalInputId": input_id,
            "externalInputManifestObjectId": manifest_object_id.lower(),
            "bundleSemanticSha256": semantic_digest,
            "bundleWireSha256": wire_digest,
        }
    if allow_legacy and keys == {"externalInputId", "externalInputManifestObjectId"}:
        input_id = source.get("externalInputId")
        manifest_object_id = source.get("externalInputManifestObjectId")
        if (
            not isinstance(input_id, str)
            or not EXTERNAL_INPUT_ID_PATTERN.fullmatch(input_id)
            or not isinstance(manifest_object_id, str)
        ):
            fail(f"{label} is invalid")
        normalized_manifest_object_id = manifest_object_id.lower()
        if not SOURCE_OBJECT_ID_PATTERN.fullmatch(normalized_manifest_object_id):
            fail(f"{label}.externalInputManifestObjectId is invalid")
        return {
            "externalInputId": input_id,
            "externalInputManifestObjectId": normalized_manifest_object_id,
        }
    fail(f"{label} is invalid")


def remote_digest(bucket: str, key: str, if_match: Optional[str] = None) -> Dict[str, Any]:
    arguments = ["api", "get-object", "--bucket", bucket, "--key", validate_key(key)]
    if if_match is not None:
        if not ETAG_PATTERN.fullmatch(if_match):
            fail(f"ETag for {key} is invalid")
        arguments += ["--if-match", if_match]
    arguments += ["-q"]
    process = subprocess.Popen(
        ossutil_argv("v2", arguments),
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


def metadata_field_present(payload: Dict[str, Any], names: List[str]) -> bool:
    normalized_names = {re.sub(r"[^a-z0-9]", "", name.lower()) for name in names}
    sources = [payload]
    for metadata_name in ("Header", "Metadata", "metadata", "Headers", "headers"):
        metadata_map = payload.get(metadata_name)
        if isinstance(metadata_map, dict):
            sources.append(metadata_map)
    return any(
        isinstance(key, str) and re.sub(r"[^a-z0-9]", "", key.lower()) in normalized_names
        for source in sources
        for key in source
    )


def validate_etag(value: Any, key: str) -> str:
    if not isinstance(value, str) or not ETAG_PATTERN.fullmatch(value):
        fail(f"runtime blob ETag is missing or invalid for {key}")
    return value


def metadata_field(payload: Dict[str, Any], names: List[str], label: str) -> Any:
    normalized_names = {re.sub(r"[^a-z0-9]", "", name.lower()) for name in names}
    candidates: List[Any] = []
    sources = [payload]
    for metadata_name in ("Header", "Metadata", "metadata", "Headers", "headers"):
        metadata_map = payload.get(metadata_name)
        if isinstance(metadata_map, dict):
            sources.append(metadata_map)
    for source in sources:
        for key, value in source.items():
            if isinstance(key, str) and re.sub(r"[^a-z0-9]", "", key.lower()) in normalized_names:
                if isinstance(value, list):
                    if len(value) != 1:
                        fail(f"ossutil v2 head-object returned ambiguous {label} metadata")
                    candidates.append(value[0])
                else:
                    candidates.append(value)
    if not candidates:
        return None
    rendered = {json.dumps(value, ensure_ascii=False, sort_keys=True) for value in candidates}
    if len(rendered) != 1:
        fail(f"ossutil v2 head-object returned conflicting {label} metadata")
    return candidates[0]


def remote_blob_metadata(bucket: str, key: str) -> Optional[Dict[str, Any]]:
    key = validate_key(key)
    if not key.startswith(BLOB_KEY_PREFIX):
        fail(f"runtime blob metadata lookup requires a SHA-256 blob key: {key}")
    process = subprocess.run(
        ossutil_argv("v2", ["api", "head-object", "--bucket", bucket, "--key", key, "--output-format", "json", "-q"]),
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if process.returncode != 0:
        detail = process.stderr.decode("utf-8", errors="replace")
        if "NoSuchKey" in detail or "404" in detail:
            return None
        fail(f"ossutil v2 head-object failed for {key}: {detail.strip()}")
    if process.stderr.strip():
        fail(f"ossutil v2 head-object emitted unexpected stderr for {key}: {process.stderr.decode('utf-8', errors='replace').strip()}")
    try:
        payload = json.loads(process.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"ossutil v2 head-object returned invalid JSON for {key}: {error}")
    if not isinstance(payload, dict):
        fail(f"ossutil v2 head-object returned an invalid response for {key}")
    size = metadata_field(payload, ["ContentLength", "Content-Length"], "Content-Length")
    schema = metadata_field(payload, ["x-oss-meta-schema", "x-oss-meta-x-oss-meta-schema", "schema"], "schema")
    digest = metadata_field(payload, ["x-oss-meta-sha256", "x-oss-meta-x-oss-meta-sha256", "sha256"], "SHA-256")
    declared_size = metadata_field(payload, ["x-oss-meta-size", "x-oss-meta-x-oss-meta-size", "size"], "declared size")
    metadata_fields = [
        metadata_field_present(payload, ["x-oss-meta-schema", "x-oss-meta-x-oss-meta-schema", "schema"]),
        metadata_field_present(payload, ["x-oss-meta-sha256", "x-oss-meta-x-oss-meta-sha256", "sha256"]),
        metadata_field_present(payload, ["x-oss-meta-size", "x-oss-meta-x-oss-meta-size", "size"]),
    ]
    etag = metadata_field(payload, ["ETag", "etag"], "ETag")
    if not any(metadata_fields):
        return {
            "sizeBytes": parse_decimal(size, f"Content-Length for {key}"),
            "legacy": True,
            "etag": validate_etag(etag, key),
        }
    if not all(metadata_fields):
        fail(f"ossutil v2 head-object has partial runtime blob metadata for {key}")
    if not isinstance(schema, str) or schema != "act-runtime-blob.v1":
        fail(f"ossutil v2 head-object has an invalid runtime blob schema metadata value for {key}")
    if not isinstance(digest, str) or not SHA256_PATTERN.fullmatch(digest):
        fail(f"ossutil v2 head-object has an invalid runtime blob SHA-256 metadata value for {key}")
    if not isinstance(declared_size, (int, str)):
        fail(f"ossutil v2 head-object has an invalid runtime blob declared size for {key}")
    return {
        "sizeBytes": parse_decimal(size, f"Content-Length for {key}"),
        "sha256": digest,
        "declaredSizeBytes": parse_decimal(declared_size, f"runtime blob declared size for {key}"),
        "etag": validate_etag(etag, key) if etag is not None else "",
        "legacy": False,
    }


def assert_remote_blob_metadata(bucket: str, key: str, expected_size: int, expected_sha: str) -> Dict[str, Any]:
    metadata = remote_blob_metadata(bucket, key)
    if metadata is None:
        fail(f"remote runtime blob is missing after publication: {key}")
    if metadata.get("legacy"):
        fail(f"remote runtime blob is metadata-less where complete metadata is required after publication: {key}")
    if (
        metadata.get("sizeBytes") != expected_size
        or metadata.get("sha256") != expected_sha
        or metadata.get("declaredSizeBytes") != expected_size
    ):
        fail(f"remote runtime blob metadata differs from the immutable manifest: {key}")
    return metadata


def verify_existing_blob(
    bucket: str,
    key: str,
    metadata: Dict[str, Any],
    expected_size: int,
    expected_sha: str,
) -> Tuple[Dict[str, Any], bool]:
    if key != f"{BLOB_KEY_PREFIX}{expected_sha}":
        fail(f"runtime blob key is not bound to the expected SHA-256: {key}")
    if metadata.get("legacy"):
        if metadata.get("sizeBytes") != expected_size:
            fail(f"metadata-less legacy blob size differs from the manifest: {key}")
        etag = metadata.get("etag")
        if not isinstance(etag, str):
            fail(f"metadata-less legacy blob ETag is missing for {key}")
        remote = remote_digest(bucket, key, if_match=etag)
        if remote != {"sizeBytes": expected_size, "sha256": expected_sha}:
            fail(f"metadata-less legacy blob readback differs from the manifest: {key}")
        return metadata, True
    if (
        metadata.get("sizeBytes") != expected_size
        or metadata.get("sha256") != expected_sha
        or metadata.get("declaredSizeBytes") != expected_size
    ):
        fail(f"pre-existing blob differs from manifest for {key}")
    return metadata, False


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
    validate_list_prefix(prefix)
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
        ossutil_argv("v1", ["ls", f"oss://{validate_bucket(bucket)}/{validate_release_prefix(prefix)}", "-s"]),
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
    if _CREDENTIAL_MODE == "local":
        return
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
    lock_dir = _LOCAL_LOCK_DIR if _CREDENTIAL_MODE == "local" else os.environ.get("ACT_RUNTIME_RELEASE_LOCK_DIR", DEFAULT_LOCK_DIR)
    if not lock_dir.startswith("/") or any(ord(char) < 0x20 or ord(char) == 0x7F for char in lock_dir):
        fail("runtime release lock directory must be an absolute path")
    os.makedirs(lock_dir, mode=0o700, exist_ok=True)
    token = hashlib.sha256(prefix.encode("utf-8")).hexdigest()
    return os.path.join(lock_dir, f"act-runtime-release-{token}.lock")


def spool_root() -> str:
    if _CREDENTIAL_MODE == "local":
        if _LOCAL_SPOOL_DIR is None:
            fail("local publisher spool directory is not configured")
        return _LOCAL_SPOOL_DIR
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
    expected_owner = os.geteuid() if _CREDENTIAL_MODE == "local" else 0
    if not test_mode() and details.st_uid != expected_owner:
        fail(f"{label} has an unexpected owner")


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
    expected_owner = os.geteuid() if _CREDENTIAL_MODE == "local" else 0
    if stat.S_IMODE(details.st_mode) != 0o600 or (not test_mode() and details.st_uid != expected_owner):
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


def expected_blob_manifest_files(manifest: Dict[str, Any], strict_sources: bool = False) -> List[Dict[str, Any]]:
    files = manifest.get("files")
    if not isinstance(files, list) or not files:
        fail("blob manifest.files is invalid")
    if manifest_integer(manifest.get("fileCount"), "blob manifest.fileCount") != len(files):
        fail("blob manifest.fileCount does not match blob manifest.files")
    expected: List[Dict[str, Any]] = []
    seen_paths = set()
    blob_bindings: Dict[str, Tuple[int, str]] = {}
    total = 0
    previous_path: Optional[str] = None
    for item in files:
        if not isinstance(item, dict) or set(item) not in ({"path", "objectKey", "sizeBytes", "sha256"}, {"path", "objectKey", "sizeBytes", "sha256", "source"}):
            fail("blob manifest file entry is invalid")
        relative_path = item.get("path")
        key = item.get("objectKey")
        size = item.get("sizeBytes")
        digest = item.get("sha256")
        if (
            not isinstance(relative_path, str)
            or not relative_path
            or relative_path.startswith("/")
            or re.match(r"^[A-Za-z]:/", relative_path)
            or "\\" in relative_path
            or any(ord(char) < 0x20 or ord(char) == 0x7F for char in relative_path)
            or any(part in {"", ".", ".."} for part in relative_path.split("/"))
        ):
            fail("blob manifest file path is invalid")
        if not isinstance(digest, str) or not SHA256_PATTERN.fullmatch(digest):
            fail("blob manifest file digest is invalid")
        if not isinstance(key, str) or key != f"{BLOB_KEY_PREFIX}{digest}":
            fail("blob manifest object key is not SHA-256 addressed")
        source = item.get("source")
        if source is not None:
            source = parse_blob_manifest_source(source, f"blob manifest file source for {relative_path}", allow_legacy=not strict_sources)
        elif strict_sources:
            fail("strict bundle manifest files must carry a source identity")
        size = manifest_integer(size, f"blob manifest file size for {relative_path}")
        if size > MAX_FRAME_BYTES:
            fail("blob manifest file exceeds the maximum runtime frame size")
        if previous_path is not None and previous_path >= relative_path:
            fail("blob manifest.files must be strictly code-point sorted")
        previous_path = relative_path
        if relative_path in seen_paths:
            fail("blob manifest contains duplicate paths")
        seen_paths.add(relative_path)
        existing_binding = blob_bindings.get(key)
        if existing_binding is not None and existing_binding != (size, digest):
            fail("blob manifest contains inconsistent blob bindings")
        blob_bindings[key] = (size, digest)
        total += size
        if total > MAX_SAFE_INTEGER:
            fail("blob manifest totalBytes exceeds the maximum safe integer")
        entry = {"path": relative_path, "key": key, "sizeBytes": size, "sha256": digest}
        if source is not None:
            entry["source"] = source
        expected.append(entry)
    if manifest_integer(manifest.get("totalBytes"), "blob manifest.totalBytes") != total:
        fail("blob manifest.totalBytes does not match blob manifest.files")
    return expected


def expected_blob_receipt_files(files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_key: Dict[str, Dict[str, Any]] = {}
    for entry in files:
        existing = by_key.get(entry["key"])
        if existing is not None and (existing["sizeBytes"] != entry["sizeBytes"] or existing["sha256"] != entry["sha256"]):
            fail("blob manifest contains inconsistent blob bindings")
        by_key[entry["key"]] = {
            "objectKey": entry["key"],
            "sizeBytes": entry["sizeBytes"],
            "sha256": entry["sha256"],
        }
    return [by_key[key] for key in sorted(by_key)]


def verified_blob_audit(entries: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], str]:
    normalized = [
        {
            "key": entry["key"],
            "expectedSize": entry["expectedSize"],
            "verifiedSha256": entry["verifiedSha256"],
            "etag": entry["etag"],
        }
        for entry in entries
    ]
    normalized.sort(key=lambda entry: (
        entry["key"], entry["expectedSize"], entry["verifiedSha256"], entry["etag"],
    ))
    return normalized, hashlib.sha256(canonical_json(normalized)).hexdigest()


def validate_blob_receipt(
    receipt: Dict[str, Any],
    release_id: str,
    manifest: Dict[str, Any],
    manifest_wire: bytes,
    files: List[Dict[str, Any]],
    require_proof: bool = True,
) -> None:
    required_fields = {
        "schemaVersion", "releaseId", "manifestVersion", "manifestObjectKey",
        "manifestSha256", "manifestWireSha256", "manifestWireSizeBytes",
        "treeSha256", "fileCount", "totalBytes", "blobs", "receiptSha256",
    }
    if require_proof:
        required_fields.add("sourceProvenanceProofSha256")
    allowed_fields = required_fields | {"sourceProvenanceProofSha256", "formalResourceEnvelopeHash"}
    if not isinstance(receipt, dict) or not required_fields.issubset(set(receipt)) or not set(receipt).issubset(allowed_fields):
        fail("blob receipt has unsupported or missing fields")
    proof_digest = receipt.get("sourceProvenanceProofSha256")
    if "sourceProvenanceProofSha256" in receipt and (
        not isinstance(receipt.get("sourceProvenanceProofSha256"), str)
        or not SHA256_PATTERN.fullmatch(receipt["sourceProvenanceProofSha256"])
    ):
        fail("blob receipt source-provenance proof digest is invalid")
    if require_proof and (
        not isinstance(proof_digest, str)
        or not SHA256_PATTERN.fullmatch(proof_digest)
    ):
        fail("blob receipt source-provenance proof digest is required")
    if "formalResourceEnvelopeHash" in receipt and (
        not isinstance(receipt.get("formalResourceEnvelopeHash"), str)
        or not SHA256_PATTERN.fullmatch(receipt["formalResourceEnvelopeHash"])
    ):
        fail("blob receipt formal-resource envelope digest is invalid")
    manifest_key = f"{BLOB_RELEASE_KEY_PREFIX}{release_id}/{BLOB_MANIFEST_NAME}"
    if (
        receipt.get("schemaVersion") != BLOB_RECEIPT_SCHEMA_VERSION
        or receipt.get("releaseId") != release_id
        or receipt.get("manifestVersion") != BLOB_MANIFEST_SCHEMA_VERSION
        or receipt.get("manifestObjectKey") != manifest_key
        or receipt.get("manifestSha256") != manifest.get("manifestSha256")
        or receipt.get("manifestWireSha256") != hashlib.sha256(manifest_wire).hexdigest()
        or receipt.get("treeSha256") != manifest.get("treeSha256")
        or receipt.get("fileCount") != manifest.get("fileCount")
        or receipt.get("totalBytes") != manifest.get("totalBytes")
    ):
        fail("blob receipt does not match the manifest identity")
    if manifest_integer(receipt.get("manifestWireSizeBytes"), "blob receipt manifestWireSizeBytes") != len(manifest_wire):
        fail("blob receipt manifest wire size does not match the serialized manifest")
    raw_blobs = receipt.get("blobs")
    if not isinstance(raw_blobs, list) or not raw_blobs:
        fail("blob receipt blobs is invalid")
    expected_blobs = expected_blob_receipt_files(files)
    actual_blobs: List[Dict[str, Any]] = []
    previous_key: Optional[str] = None
    for entry in raw_blobs:
        if not isinstance(entry, dict) or set(entry) != {"objectKey", "sizeBytes", "sha256"}:
            fail("blob receipt blob entry is invalid")
        key = entry.get("objectKey")
        digest = entry.get("sha256")
        if not isinstance(key, str) or not isinstance(digest, str) or not SHA256_PATTERN.fullmatch(digest) or key != f"{BLOB_KEY_PREFIX}{digest}":
            fail("blob receipt blob entry is not SHA-256 addressed")
        size = manifest_integer(entry.get("sizeBytes"), "blob receipt blob size")
        if previous_key is not None and previous_key >= key:
            fail("blob receipt blobs must be strictly code-point sorted")
        previous_key = key
        actual_blobs.append({"objectKey": key, "sizeBytes": size, "sha256": digest})
    if actual_blobs != expected_blobs:
        fail("blob receipt reachable blobs do not match the manifest")
    receipt_sha = receipt.get("receiptSha256")
    if not isinstance(receipt_sha, str) or not SHA256_PATTERN.fullmatch(receipt_sha):
        fail("blob receipt digest is invalid")
    without_digest = dict(receipt)
    del without_digest["receiptSha256"]
    if hashlib.sha256(canonical_json(without_digest)).hexdigest() != receipt_sha:
        fail("blob receipt digest does not match canonical content")


def validate_blob_publish_header(
    header: Dict[str, Any],
    require_proof: bool = True,
) -> Tuple[str, Dict[str, Any], bytes, str, bytes, str, List[Dict[str, Any]]]:
    if header.get("protocol") != "act-runtime-blob-release-stream.v2":
        fail("unsupported blob publish protocol")
    release_id = header.get("releaseId")
    prefix = header.get("prefix")
    encoded = header.get("manifestWireBase64")
    wire_sha = header.get("wireSha256")
    semantic_sha = header.get("manifestSha256")
    receipt_encoded = header.get("receiptWireBase64")
    receipt_wire_sha = header.get("receiptWireSha256")
    source_identity_mode = header.get("sourceIdentityMode")
    if source_identity_mode not in (None, "strict-bundle"):
        fail("blob publish source identity mode is invalid")
    if not isinstance(release_id, str) or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", release_id):
        fail("blob release id is invalid")
    if prefix != f"{BLOB_RELEASE_KEY_PREFIX}{release_id}/":
        fail("blob publish prefix does not match release id")
    validate_blob_release_prefix(prefix)
    if (
        not isinstance(encoded, str)
        or not isinstance(wire_sha, str)
        or not SHA256_PATTERN.fullmatch(wire_sha)
        or not isinstance(semantic_sha, str)
        or not SHA256_PATTERN.fullmatch(semantic_sha)
        or not isinstance(receipt_encoded, str)
        or not isinstance(receipt_wire_sha, str)
        or not SHA256_PATTERN.fullmatch(receipt_wire_sha)
    ):
        fail("blob manifest digest fields are invalid")
    try:
        wire = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        manifest = json.loads(wire.decode("utf-8"))
        receipt_wire = base64.urlsafe_b64decode(receipt_encoded + "=" * (-len(receipt_encoded) % 4))
        receipt = json.loads(receipt_wire.decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"blob manifest wire bytes are invalid: {error}")
    if hashlib.sha256(wire).hexdigest() != wire_sha:
        fail("blob manifest wire digest does not match the serialized bytes")
    if hashlib.sha256(receipt_wire).hexdigest() != receipt_wire_sha:
        fail("blob receipt wire digest does not match the serialized bytes")
    required_fields = {"schemaVersion", "releaseId", "sourceRevision", "fileCount", "totalBytes", "treeSha256", "manifestSha256", "files"}
    if not isinstance(manifest, dict) or set(manifest) != required_fields or manifest.get("schemaVersion") != BLOB_MANIFEST_SCHEMA_VERSION or manifest.get("releaseId") != release_id or manifest.get("manifestSha256") != semantic_sha:
        fail("blob manifest identity does not match publish header")
    source_revision = manifest.get("sourceRevision")
    tree_sha = manifest.get("treeSha256")
    if not isinstance(source_revision, str) or not re.fullmatch(r"[0-9a-f]{40}", source_revision) or not isinstance(tree_sha, str) or not SHA256_PATTERN.fullmatch(tree_sha):
        fail("blob manifest source identity is invalid")
    expected = expected_blob_manifest_files(manifest, strict_sources=source_identity_mode == "strict-bundle")
    calculated_tree_sha = hashlib.sha256(canonical_json([{"path": entry["path"], "sizeBytes": entry["sizeBytes"], "sha256": entry["sha256"]} for entry in expected])).hexdigest()
    if tree_sha != calculated_tree_sha:
        fail("blob manifest tree digest does not match its files")
    expected_release_id = "runtime-" + hashlib.sha256(canonical_json({"sourceRevision": source_revision, "treeSha256": tree_sha})).hexdigest()[:55]
    if release_id != expected_release_id:
        fail("blob release id is not content-addressed")
    if canonical_json(manifest) + b"\n" != wire:
        fail("blob manifest wire bytes are not canonical")
    without_digest = {
        "schemaVersion": BLOB_MANIFEST_SCHEMA_VERSION,
        "releaseId": release_id,
        "sourceRevision": source_revision,
        "fileCount": manifest["fileCount"],
        "totalBytes": manifest["totalBytes"],
        "treeSha256": tree_sha,
        "files": [dict({"path": entry["path"], "objectKey": entry["key"], "sizeBytes": entry["sizeBytes"], "sha256": entry["sha256"]}, **({"source": entry["source"]} if "source" in entry else {})) for entry in expected],
    }
    if hashlib.sha256(canonical_json(without_digest)).hexdigest() != semantic_sha:
        fail("blob manifest semantic digest does not match canonical content")
    if not isinstance(receipt, dict) or canonical_json(receipt) + b"\n" != receipt_wire:
        fail("blob receipt wire bytes are not canonical")
    validate_blob_receipt(receipt, release_id, manifest, wire, expected, require_proof=require_proof)
    proof_digest = header.get("sourceProvenanceProofSha256")
    receipt_proof_digest = receipt.get("sourceProvenanceProofSha256")
    if require_proof and (
        not isinstance(proof_digest, str)
        or not SHA256_PATTERN.fullmatch(proof_digest)
        or receipt_proof_digest != proof_digest
    ):
        fail("blob source-provenance proof digest is required and must match the planning receipt")
    if not require_proof and proof_digest is not None and (
        not isinstance(proof_digest, str)
        or not SHA256_PATTERN.fullmatch(proof_digest)
        or receipt_proof_digest != proof_digest
    ):
        fail("blob source-provenance proof digest does not match the planning receipt")
    return prefix, manifest, wire, wire_sha, receipt_wire, receipt_wire_sha, expected


def validate_blob_parent_reference(header: Dict[str, Any]) -> Optional[Dict[str, str]]:
    required_fields = {
        "protocol", "releaseId", "prefix", "manifestSha256", "wireSha256", "manifestWireBase64",
        "receiptWireSha256", "receiptWireBase64", "sourceProvenanceProofSha256",
    }
    allowed_fields = required_fields | {"parentRelease", "sourceIdentityMode"}
    if not required_fields.issubset(set(header)) or not set(header).issubset(allowed_fields):
        fail("blob publish header has unsupported or missing fields")
    parent = header.get("parentRelease")
    if parent is None:
        return None
    if not isinstance(parent, dict) or set(parent) != {"releaseId", "manifestSha256"}:
        fail("blob publish parent release is invalid")
    release_id = parent.get("releaseId")
    manifest_sha = parent.get("manifestSha256")
    if (
        not isinstance(release_id, str)
        or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", release_id)
        or not isinstance(manifest_sha, str)
        or not SHA256_PATTERN.fullmatch(manifest_sha)
    ):
        fail("blob publish parent release identity is invalid")
    return {"releaseId": release_id, "manifestSha256": manifest_sha}


def parent_blob_bindings(bucket: str, candidate_release_id: str, parent: Optional[Dict[str, str]]) -> Dict[str, Dict[str, Any]]:
    if parent is None:
        return {}
    if parent["releaseId"] == candidate_release_id:
        fail("blob publish parent release must differ from the candidate release")
    parent_prefix = f"{BLOB_RELEASE_KEY_PREFIX}{parent['releaseId']}/"
    manifest, _, _, _, _, files = read_validated_blob_release(bucket, parent_prefix)
    if manifest["manifestSha256"] != parent["manifestSha256"]:
        fail("blob publish parent release differs from the locally planned immutable identity")
    return {entry["objectKey"]: entry for entry in expected_blob_receipt_files(files)}


def find_exact_object(bucket: str, key: str) -> Optional[Dict[str, Any]]:
    objects = list_objects_v2(bucket, validate_key(key))
    if not objects:
        return None
    if len(objects) != 1 or objects[0]["key"] != key:
        fail("blob object lookup returned an unexpected object set")
    return objects[0]


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


def read_validated_blob_release(bucket: str, prefix: str) -> Tuple[Dict[str, Any], bytes, str, bytes, str, List[Dict[str, Any]]]:
    prefix = validate_blob_release_prefix(prefix)
    release_id = prefix.rstrip("/").split("/")[-1]
    manifest_wire = read_manifest_wire(bucket, f"{prefix}{BLOB_MANIFEST_NAME}")
    receipt_wire = read_manifest_wire(bucket, f"{prefix}{BLOB_RECEIPT_NAME}")
    try:
        manifest = json.loads(manifest_wire.decode("utf-8"))
        receipt = json.loads(receipt_wire.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"remote runtime blob release document is invalid: {error}")
    if not isinstance(manifest, dict) or not isinstance(receipt, dict):
        fail("remote runtime blob release document must be an object")
    proof_digest = receipt.get("sourceProvenanceProofSha256")
    header = {
        "protocol": "act-runtime-blob-release-stream.v2",
        "releaseId": release_id,
        "prefix": prefix,
        "manifestSha256": manifest.get("manifestSha256"),
        "wireSha256": hashlib.sha256(manifest_wire).hexdigest(),
        "manifestWireBase64": base64.urlsafe_b64encode(manifest_wire).decode("ascii").rstrip("="),
        "receiptWireSha256": hashlib.sha256(receipt_wire).hexdigest(),
        "receiptWireBase64": base64.urlsafe_b64encode(receipt_wire).decode("ascii").rstrip("="),
    }
    if proof_digest is not None:
        header["sourceProvenanceProofSha256"] = proof_digest
    verified_prefix, parsed_manifest, _, manifest_wire_sha, _, receipt_wire_sha, files = validate_blob_publish_header(
        header,
        require_proof=proof_digest is not None,
    )
    if verified_prefix != prefix:
        fail("remote runtime blob release manifest prefix is invalid")
    return parsed_manifest, manifest_wire, manifest_wire_sha, receipt_wire, receipt_wire_sha, files


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


def put_blob_spooled_file(
    bucket: str,
    key: str,
    path: str,
    expected_size: int,
    expected_sha: str,
) -> Tuple[Dict[str, Any], bool]:
    key = validate_key(key)
    arguments = [
        "api", "put-object", "--bucket", bucket, "--key", key,
        "--body", f"file://{path}", "--forbid-overwrite", "true",
        "--metadata", "x-oss-meta-schema=act-runtime-blob.v1",
        "--metadata", f"x-oss-meta-sha256={expected_sha}",
        "--metadata", f"x-oss-meta-size={expected_size}",
        "-q",
    ]
    process = subprocess.run(
        ossutil_argv("v2", arguments),
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    if process.returncode != 0:
        try:
            metadata = remote_blob_metadata(bucket, key)
            if metadata is None:
                fail(f"remote runtime blob is missing after a failed conditional put: {key}")
            verified, _legacy = verify_existing_blob(bucket, key, metadata, expected_size, expected_sha)
            return verified, False
        except RuntimeError:
            detail = process.stderr.decode("utf-8", errors="replace").strip()
            fail(f"ossutil v2 conditional blob put failed for {key}: {detail}")
    return assert_remote_blob_metadata(bucket, key, expected_size, expected_sha), True


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


def compatible_existing_blob_receipt(
    bucket: str,
    receipt_key: str,
    release_id: str,
    manifest: Dict[str, Any],
    manifest_wire: bytes,
    files: List[Dict[str, Any]],
    submitted_receipt_wire: bytes,
    submitted_receipt_wire_sha: str,
) -> Tuple[bytes, str]:
    existing_wire = read_manifest_wire(bucket, receipt_key)
    existing_wire_sha = hashlib.sha256(existing_wire).hexdigest()
    if (
        len(existing_wire) == len(submitted_receipt_wire)
        and existing_wire_sha == submitted_receipt_wire_sha
    ):
        return submitted_receipt_wire, submitted_receipt_wire_sha
    try:
        existing_receipt = json.loads(existing_wire.decode("utf-8"))
        submitted_receipt = json.loads(submitted_receipt_wire.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"existing blob receipt is invalid: {error}")
    if not isinstance(existing_receipt, dict) or canonical_json(existing_receipt) + b"\n" != existing_wire:
        fail("existing blob receipt wire bytes are not canonical")
    if not isinstance(submitted_receipt, dict):
        fail("submitted blob receipt is invalid")
    if "sourceProvenanceProofSha256" in existing_receipt:
        fail("existing blob receipt differs from the submitted immutable identity")
    validate_blob_receipt(
        existing_receipt,
        release_id,
        manifest,
        manifest_wire,
        files,
        require_proof=False,
    )
    expected_legacy_body = dict(submitted_receipt)
    expected_legacy_body.pop("sourceProvenanceProofSha256", None)
    expected_legacy_body.pop("receiptSha256", None)
    expected_legacy_receipt = dict(expected_legacy_body)
    expected_legacy_receipt["receiptSha256"] = hashlib.sha256(canonical_json(expected_legacy_body)).hexdigest()
    if existing_receipt != expected_legacy_receipt:
        fail("existing blob receipt differs from the submitted immutable identity")
    return existing_wire, existing_wire_sha


def publish_blob_release(
    bucket: str,
    requested_prefix: str,
    header: Dict[str, Any],
) -> None:
    prefix, manifest, manifest_wire, manifest_wire_sha, receipt_wire, receipt_wire_sha, files = validate_blob_publish_header(header)
    parent_reference = validate_blob_parent_reference(header)
    if prefix != requested_prefix:
        fail("blob publish stream prefix does not match the SSH argument")
    manifest_key = f"{prefix}{BLOB_MANIFEST_NAME}"
    receipt_key = f"{prefix}{BLOB_RECEIPT_NAME}"
    expected_blobs = expected_blob_receipt_files(files)
    lock_file = open(lock_path(prefix), "a+b")
    spool_directory: Optional[str] = None
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        spool_directory = release_spool_directory(prefix)
        release_objects = list_objects(bucket, prefix)
        existing_release = {str(entry["key"]): int(entry["sizeBytes"]) for entry in release_objects}
        effective_receipt_wire = receipt_wire
        effective_receipt_wire_sha = receipt_wire_sha
        if receipt_key in existing_release:
            effective_receipt_wire, effective_receipt_wire_sha = compatible_existing_blob_receipt(
                bucket,
                receipt_key,
                manifest["releaseId"],
                manifest,
                manifest_wire,
                files,
                receipt_wire,
                receipt_wire_sha,
            )
        expected_release_sizes = {
            manifest_key: len(manifest_wire),
            receipt_key: len(effective_receipt_wire),
        }
        if manifest_key in existing_release:
            assert_object_set(release_objects, expected_release_sizes, allow_manifest=True)
            cross_check_v1_keys(bucket, prefix, release_objects)
            if remote_digest(bucket, manifest_key) != {"sizeBytes": len(manifest_wire), "sha256": manifest_wire_sha}:
                fail("existing blob completion manifest differs from the submitted immutable identity")
            if remote_digest(bucket, receipt_key) != {"sizeBytes": len(effective_receipt_wire), "sha256": effective_receipt_wire_sha}:
                fail("existing blob receipt differs from the submitted immutable identity")
            verified_blob_entries, verified_blob_set_sha256 = verified_blob_audit([])
            write_json({
                "status": "complete",
                "releaseId": manifest["releaseId"],
                "manifestSha256": manifest["manifestSha256"],
                "wireSha256": manifest_wire_sha,
                "receiptWireSha256": effective_receipt_wire_sha,
                "treeSha256": manifest["treeSha256"],
                "fileCount": manifest["fileCount"],
                "totalBytes": manifest["totalBytes"],
                "putCount": 0,
                "inheritedBlobCount": len(expected_blobs),
                "metadataCheckCount": 0,
                "metadataReuseCount": 0,
                "newUploadCount": 0,
                "legacyReadbackCount": 0,
                "legacyReadbackBytes": 0,
                "verifiedBlobSetAlgorithm": "sha256",
                "verifiedBlobSetSha256": verified_blob_set_sha256,
                "verifiedBlobEntries": verified_blob_entries,
            })
            return
        partial_expected = {receipt_key: len(effective_receipt_wire)}
        assert_object_set(release_objects, partial_expected, allow_manifest=False)
        if receipt_key in existing_release and remote_digest(bucket, receipt_key) != {"sizeBytes": len(effective_receipt_wire), "sha256": effective_receipt_wire_sha}:
            fail("partial blob receipt differs from the submitted immutable identity")
        parent_blobs = parent_blob_bindings(bucket, manifest["releaseId"], parent_reference)
        missing: List[Dict[str, Any]] = []
        inherited_blob_count = 0
        metadata_check_count = 0
        metadata_reuse_count = 0
        new_upload_count = 0
        legacy_readback_count = 0
        legacy_readback_bytes = 0
        verified_blob_entries: List[Dict[str, Any]] = []
        for entry in expected_blobs:
            parent_entry = parent_blobs.get(entry["objectKey"])
            if parent_entry is not None:
                if parent_entry["sizeBytes"] != entry["sizeBytes"] or parent_entry["sha256"] != entry["sha256"]:
                    fail(f"parent release blob differs from candidate manifest for {entry['objectKey']}")
                inherited_blob_count += 1
                continue
            metadata_check_count += 1
            remote = remote_blob_metadata(bucket, entry["objectKey"])
            if remote is None:
                missing.append(entry)
                continue
            verified, legacy = verify_existing_blob(
                bucket, entry["objectKey"], remote, entry["sizeBytes"], entry["sha256"],
            )
            if legacy:
                legacy_readback_count += 1
                legacy_readback_bytes += entry["sizeBytes"]
            else:
                metadata_reuse_count += 1
            verified_blob_entries.append({
                "key": entry["objectKey"],
                "expectedSize": entry["sizeBytes"],
                "verifiedSha256": entry["sha256"],
                "etag": verified.get("etag", ""),
            })
        sys.stderr.write("runtime-release-bridge: streaming %d missing blobs after %d inherited and %d metadata checks\n" % (
            len(missing), inherited_blob_count, metadata_check_count,
        ))
        sys.stderr.flush()
        write_json({"status": "stream", "missingKeys": [entry["objectKey"] for entry in missing]})
        put_count = 0
        for entry in missing:
            raw_frame_header = sys.stdin.buffer.readline()
            if not raw_frame_header:
                fail("publisher stream ended before a missing blob frame")
            try:
                frame = json.loads(raw_frame_header.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                fail(f"blob frame header is invalid: {error}")
            if (
                not isinstance(frame, dict)
                or frame.get("key") != entry["objectKey"]
                or frame.get("sizeBytes") != entry["sizeBytes"]
                or frame.get("sha256") != entry["sha256"]
            ):
                fail(f"blob frame does not match the manifest for {entry['objectKey']}")
            temp_path = receive_frame(spool_directory, entry["sizeBytes"], entry["sha256"])
            try:
                verified, uploaded = put_blob_spooled_file(
                    bucket, entry["objectKey"], temp_path, entry["sizeBytes"], entry["sha256"],
                )
            finally:
                remove_temp(temp_path)
            put_count += 1
            if verified.get("legacy"):
                legacy_readback_count += 1
                legacy_readback_bytes += entry["sizeBytes"]
            elif uploaded:
                new_upload_count += 1
            else:
                metadata_reuse_count += 1
            verified_blob_entries.append({
                "key": entry["objectKey"],
                "expectedSize": entry["sizeBytes"],
                "verifiedSha256": entry["sha256"],
                "etag": verified.get("etag", ""),
            })
        if sys.stdin.buffer.readline().strip() != b"DONE":
            fail("publisher stream did not terminate its blob frames with DONE")
        if receipt_key not in existing_release:
            put_payload(bucket, receipt_key, receipt_wire, receipt_wire_sha, spool_directory)
            put_count += 1
        put_payload(bucket, manifest_key, manifest_wire, manifest_wire_sha, spool_directory)
        put_count += 1
        final_objects = list_objects(bucket, prefix)
        assert_object_set(final_objects, expected_release_sizes, allow_manifest=True)
        cross_check_v1_keys(bucket, prefix, final_objects)
        if remote_digest(bucket, receipt_key) != {"sizeBytes": len(effective_receipt_wire), "sha256": effective_receipt_wire_sha}:
            fail("remote blob receipt failed final verification")
        if remote_digest(bucket, manifest_key) != {"sizeBytes": len(manifest_wire), "sha256": manifest_wire_sha}:
            fail("remote blob completion manifest failed final verification")
        verified_blob_entries, verified_blob_set_sha256 = verified_blob_audit(verified_blob_entries)
        write_json({
            "status": "complete",
            "releaseId": manifest["releaseId"],
            "manifestSha256": manifest["manifestSha256"],
            "wireSha256": manifest_wire_sha,
            "receiptWireSha256": effective_receipt_wire_sha,
            "treeSha256": manifest["treeSha256"],
            "fileCount": manifest["fileCount"],
            "totalBytes": manifest["totalBytes"],
            "putCount": put_count,
            "inheritedBlobCount": inherited_blob_count,
            "metadataCheckCount": metadata_check_count,
            "metadataReuseCount": metadata_reuse_count,
            "newUploadCount": new_upload_count,
            "legacyReadbackCount": legacy_readback_count,
            "legacyReadbackBytes": legacy_readback_bytes,
            "verifiedBlobSetAlgorithm": "sha256",
            "verifiedBlobSetSha256": verified_blob_set_sha256,
            "verifiedBlobEntries": verified_blob_entries,
        })
    finally:
        if spool_directory is not None:
            try:
                os.rmdir(spool_directory)
            except OSError:
                pass
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
        lock_file.close()


def validate_blob_import_header(header: Dict[str, Any]) -> Tuple[str, Dict[str, Any], bytes, str, bytes, str, List[Dict[str, Any]], str, str, str]:
    required_fields = {
        "protocol", "releaseId", "prefix", "manifestSha256", "wireSha256", "manifestWireBase64",
        "receiptWireSha256", "receiptWireBase64", "sourceReleaseId", "sourcePrefix",
        "sourceManifestSha256", "sourceManifestWireSha256",
    }
    if not isinstance(header, dict) or set(header) != required_fields or header.get("protocol") != "act-runtime-blob-release-import.v1":
        fail("unsupported blob import protocol")
    source_release_id = header.get("sourceReleaseId")
    source_prefix = header.get("sourcePrefix")
    source_manifest_sha = header.get("sourceManifestSha256")
    source_manifest_wire_sha = header.get("sourceManifestWireSha256")
    if (
        not isinstance(source_release_id, str)
        or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", source_release_id)
        or source_prefix != f"{KEY_PREFIX}{source_release_id}/"
        or not isinstance(source_manifest_sha, str)
        or not SHA256_PATTERN.fullmatch(source_manifest_sha)
        or not isinstance(source_manifest_wire_sha, str)
        or not SHA256_PATTERN.fullmatch(source_manifest_wire_sha)
    ):
        fail("blob import source identity is invalid")
    target_header = dict(header)
    target_header["protocol"] = "act-runtime-blob-release-stream.v2"
    del target_header["sourceReleaseId"]
    del target_header["sourcePrefix"]
    del target_header["sourceManifestSha256"]
    del target_header["sourceManifestWireSha256"]
    prefix, manifest, manifest_wire, manifest_wire_sha, receipt_wire, receipt_wire_sha, files = validate_blob_publish_header(target_header, require_proof=False)
    return (
        prefix, manifest, manifest_wire, manifest_wire_sha, receipt_wire, receipt_wire_sha, files,
        source_prefix, source_manifest_sha, source_manifest_wire_sha,
    )


def read_import_source(
    bucket: str,
    source_prefix: str,
    source_manifest_sha: str,
    source_manifest_wire_sha: str,
    target_manifest: Dict[str, Any],
    target_files: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    source_manifest, source_wire, source_wire_sha, source_files = read_validated_manifest(bucket, source_prefix)
    if source_manifest["manifestSha256"] != source_manifest_sha or source_wire_sha != source_manifest_wire_sha:
        fail("v1 import source manifest differs from the pinned immutable identity")
    if source_manifest["sourceRevision"] != target_manifest["sourceRevision"]:
        fail("v1 import target source revision differs from the pinned v1 release")
    source_tuples = [(entry["path"], entry["sizeBytes"], entry["sha256"]) for entry in source_files]
    target_tuples = [(entry["path"], entry["sizeBytes"], entry["sha256"]) for entry in target_files]
    if source_tuples != target_tuples:
        fail("v1 import target logical file set differs from the pinned v1 release")
    if hashlib.sha256(source_wire).hexdigest() != source_manifest_wire_sha:
        fail("v1 import source manifest wire digest changed while validating")
    return source_files


def copy_source_object_to_spool(
    bucket: str,
    source_key: str,
    directory: str,
    expected_size: int,
    expected_sha: str,
) -> str:
    fd, temp_path = new_spool_file(directory, expected_size)
    digest = hashlib.sha256()
    size = 0
    process: Optional[subprocess.Popen] = None
    try:
        process = subprocess.Popen(
            ossutil_argv("v2", ["api", "get-object", "--bucket", bucket, "--key", validate_key(source_key), "-q"]),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if process.stdout is None or process.stderr is None:
            fail("ossutil v2 source download did not provide complete streams")
        with os.fdopen(fd, "wb") as output:
            while True:
                chunk = process.stdout.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > expected_size:
                    fail(f"v1 import source exceeds manifest size for {source_key}")
                digest.update(chunk)
                output.write(chunk)
            output.flush()
            os.fsync(output.fileno())
        stderr = process.stderr.read().decode("utf-8", errors="replace").strip()
        if process.wait() != 0:
            fail(f"ossutil v2 source download failed for {source_key}: {stderr}")
        if size != expected_size or digest.hexdigest() != expected_sha:
            fail(f"v1 import source object differs from the pinned v1 manifest: {source_key}")
        return temp_path
    except Exception:
        remove_temp(temp_path)
        raise


def verify_import_source_objects(bucket: str, source_files: List[Dict[str, Any]], directory: str) -> None:
    for source_entry in source_files:
        temp_path = copy_source_object_to_spool(
            bucket, source_entry["key"], directory, source_entry["sizeBytes"], source_entry["sha256"],
        )
        remove_temp(temp_path)


def import_v1_blob_release(bucket: str, requested_prefix: str) -> None:
    raw_header = sys.stdin.buffer.readline()
    if not raw_header:
        fail("v1 import ended before its header")
    try:
        header = json.loads(raw_header.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"v1 import header is invalid: {error}")
    if not isinstance(header, dict):
        fail("v1 import header must be an object")
    (
        prefix, manifest, manifest_wire, manifest_wire_sha, receipt_wire, receipt_wire_sha, files,
        source_prefix, source_manifest_sha, source_manifest_wire_sha,
    ) = validate_blob_import_header(header)
    if prefix != requested_prefix:
        fail("v1 import target prefix does not match the SSH argument")
    manifest_key = f"{prefix}{BLOB_MANIFEST_NAME}"
    receipt_key = f"{prefix}{BLOB_RECEIPT_NAME}"
    expected_release_sizes = {manifest_key: len(manifest_wire), receipt_key: len(receipt_wire)}
    expected_blobs = expected_blob_receipt_files(files)
    lock_file = open(lock_path(prefix), "a+b")
    spool_directory: Optional[str] = None
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        spool_directory = release_spool_directory(prefix)
        source_files = read_import_source(
            bucket, source_prefix, source_manifest_sha, source_manifest_wire_sha, manifest, files,
        )
        release_objects = list_objects(bucket, prefix)
        existing_release = {str(entry["key"]): int(entry["sizeBytes"]) for entry in release_objects}
        if manifest_key in existing_release:
            assert_object_set(release_objects, expected_release_sizes, allow_manifest=True)
            cross_check_v1_keys(bucket, prefix, release_objects)
            if remote_digest(bucket, manifest_key) != {"sizeBytes": len(manifest_wire), "sha256": manifest_wire_sha}:
                fail("existing imported blob manifest differs from the submitted immutable identity")
            if remote_digest(bucket, receipt_key) != {"sizeBytes": len(receipt_wire), "sha256": receipt_wire_sha}:
                fail("existing imported blob receipt differs from the submitted immutable identity")
            for entry in expected_blobs:
                if remote_digest(bucket, entry["objectKey"]) != {"sizeBytes": entry["sizeBytes"], "sha256": entry["sha256"]}:
                    fail(f"existing imported blob differs from manifest for {entry['objectKey']}")
            verify_import_source_objects(bucket, source_files, spool_directory)
            read_import_source(bucket, source_prefix, source_manifest_sha, source_manifest_wire_sha, manifest, files)
            write_json({
                "status": "complete", "releaseId": manifest["releaseId"], "manifestSha256": manifest["manifestSha256"],
                "wireSha256": manifest_wire_sha, "receiptWireSha256": receipt_wire_sha, "treeSha256": manifest["treeSha256"],
                "fileCount": manifest["fileCount"], "totalBytes": manifest["totalBytes"], "putCount": 0,
                "sourceReleaseId": source_prefix.rstrip("/").split("/")[-1], "sourceManifestSha256": source_manifest_sha,
            })
            return
        partial_expected = {receipt_key: len(receipt_wire)}
        assert_object_set(release_objects, partial_expected, allow_manifest=False)
        if receipt_key in existing_release and remote_digest(bucket, receipt_key) != {"sizeBytes": len(receipt_wire), "sha256": receipt_wire_sha}:
            fail("partial imported blob receipt differs from the submitted immutable identity")
        available_blobs = {str(entry["key"]): entry for entry in list_objects_v2(bucket, BLOB_KEY_PREFIX)}
        missing = set()
        for entry in expected_blobs:
            remote = available_blobs.get(entry["objectKey"])
            if remote is None:
                missing.add(entry["objectKey"])
            elif remote["sizeBytes"] != entry["sizeBytes"] or remote_digest(bucket, entry["objectKey"]) != {"sizeBytes": entry["sizeBytes"], "sha256": entry["sha256"]}:
                fail(f"pre-existing blob differs from imported manifest for {entry['objectKey']}")
        target_by_path = {entry["path"]: entry for entry in files}
        put_count = 0
        imported = set()
        for source_entry in source_files:
            target = target_by_path[source_entry["path"]]
            temp_path = copy_source_object_to_spool(
                bucket, source_entry["key"], spool_directory, source_entry["sizeBytes"], source_entry["sha256"],
            )
            try:
                if target["key"] in missing and target["key"] not in imported:
                    put_spooled_file(bucket, target["key"], temp_path, target["sizeBytes"], target["sha256"])
                    imported.add(target["key"])
                    put_count += 1
            finally:
                remove_temp(temp_path)
        if imported != missing:
            fail("v1 import did not materialize every missing target blob")
        for entry in expected_blobs:
            if remote_digest(bucket, entry["objectKey"]) != {"sizeBytes": entry["sizeBytes"], "sha256": entry["sha256"]}:
                fail(f"imported blob failed final verification for {entry['objectKey']}")
        if receipt_key not in existing_release:
            put_payload(bucket, receipt_key, receipt_wire, receipt_wire_sha, spool_directory)
            put_count += 1
        put_payload(bucket, manifest_key, manifest_wire, manifest_wire_sha, spool_directory)
        put_count += 1
        final_objects = list_objects(bucket, prefix)
        assert_object_set(final_objects, expected_release_sizes, allow_manifest=True)
        cross_check_v1_keys(bucket, prefix, final_objects)
        if remote_digest(bucket, receipt_key) != {"sizeBytes": len(receipt_wire), "sha256": receipt_wire_sha}:
            fail("imported blob receipt failed final verification")
        if remote_digest(bucket, manifest_key) != {"sizeBytes": len(manifest_wire), "sha256": manifest_wire_sha}:
            fail("imported blob completion manifest failed final verification")
        read_import_source(bucket, source_prefix, source_manifest_sha, source_manifest_wire_sha, manifest, files)
        write_json({
            "status": "complete", "releaseId": manifest["releaseId"], "manifestSha256": manifest["manifestSha256"],
            "wireSha256": manifest_wire_sha, "receiptWireSha256": receipt_wire_sha, "treeSha256": manifest["treeSha256"],
            "fileCount": manifest["fileCount"], "totalBytes": manifest["totalBytes"], "putCount": put_count,
            "sourceReleaseId": source_prefix.rstrip("/").split("/")[-1], "sourceManifestSha256": source_manifest_sha,
        })
    finally:
        if spool_directory is not None:
            try:
                os.rmdir(spool_directory)
            except OSError:
                pass
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
        lock_file.close()


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
    if header.get("protocol") == "act-runtime-blob-release-stream.v2":
        publish_blob_release(bucket, requested_prefix, header)
        return
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
    prefix = validate_release_prefix(decode_value(prefix_b64, "prefix"))
    objects = list_objects(bucket, prefix)
    if prefix.startswith(BLOB_RELEASE_KEY_PREFIX):
        verify_blob_operation(bucket, prefix, objects)
        return
    keys = {entry["key"] for entry in objects}
    if f"{prefix}{MANIFEST_NAME}" not in keys:
        fail("v1 release completion manifest is missing")
    manifest, wire, wire_sha, files = read_validated_manifest(bucket, prefix)
    manifest_key = f"{prefix}{MANIFEST_NAME}"
    expected_sizes = {entry["key"]: entry["sizeBytes"] for entry in files}
    expected_sizes[manifest_key] = len(wire)
    objects = list_objects(bucket, prefix)
    assert_object_set(objects, expected_sizes, allow_manifest=True)
    cross_check_v1_keys(bucket, prefix, objects)
    if remote_digest(bucket, manifest_key) != {"sizeBytes": len(wire), "sha256": wire_sha}:
        fail("remote completion manifest failed read-role readiness")
    candidates = [entry for entry in files if entry["sizeBytes"] <= READINESS_SAMPLE_MAX_BYTES]
    if not candidates:
        fail("remote runtime release has no bounded representative object for read-role readiness")
    selected_indexes = sorted({0, len(candidates) // 2, len(candidates) - 1})
    for index in selected_indexes:
        entry = candidates[index]
        if remote_digest(bucket, entry["key"]) != {"sizeBytes": entry["sizeBytes"], "sha256": entry["sha256"]}:
            fail(f"remote representative object failed read-role readiness for {entry['key']}")
    write_json({
        "schemaVersion": "runtime-release-verification.v1",
        "releaseId": manifest["releaseId"],
        "manifestSha256": manifest["manifestSha256"],
        "wireSha256": wire_sha,
        "treeSha256": manifest["treeSha256"],
        "fileCount": manifest["fileCount"],
        "totalBytes": manifest["totalBytes"],
    })


def verify_blob_operation(bucket: str, prefix: str, objects: Optional[List[Dict[str, Any]]] = None) -> None:
    manifest, manifest_wire, manifest_wire_sha, receipt_wire, receipt_wire_sha, files = read_validated_blob_release(bucket, prefix)
    manifest_key = f"{prefix}{BLOB_MANIFEST_NAME}"
    receipt_key = f"{prefix}{BLOB_RECEIPT_NAME}"
    expected_sizes = {
        manifest_key: len(manifest_wire),
        receipt_key: len(receipt_wire),
    }
    release_objects = objects if objects is not None else list_objects(bucket, prefix)
    assert_object_set(release_objects, expected_sizes, allow_manifest=True)
    cross_check_v1_keys(bucket, prefix, release_objects)
    if remote_digest(bucket, manifest_key) != {"sizeBytes": len(manifest_wire), "sha256": manifest_wire_sha}:
        fail("remote blob completion manifest failed read-role verification")
    if remote_digest(bucket, receipt_key) != {"sizeBytes": len(receipt_wire), "sha256": receipt_wire_sha}:
        fail("remote blob receipt failed read-role verification")
    for entry in expected_blob_receipt_files(files):
        if remote_digest(bucket, entry["objectKey"]) != {"sizeBytes": entry["sizeBytes"], "sha256": entry["sha256"]}:
            fail(f"remote blob failed read-role verification for {entry['objectKey']}")
    write_json({
        "schemaVersion": "runtime-release-verification.v2",
        "releaseId": manifest["releaseId"],
        "manifestObjectKey": manifest_key,
        "manifestSha256": manifest["manifestSha256"],
        "wireSha256": manifest_wire_sha,
        "wireSizeBytes": len(manifest_wire),
        "treeSha256": manifest["treeSha256"],
        "fileCount": manifest["fileCount"],
        "totalBytes": manifest["totalBytes"],
    })


def list_operation(bucket: str, prefix_b64: str) -> None:
    write_json(list_objects(bucket, decode_value(prefix_b64, "prefix")))


def main() -> None:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--operation", choices=("list", "get", "publish", "import-v1", "verify"), required=True)
    parser.add_argument("--prefix-b64")
    parser.add_argument("--key-b64")
    parser.add_argument("--credential-mode", choices=("ecs", "local"), default="ecs")
    parser.add_argument("--ossutil-path")
    parser.add_argument("--ossutil-sha256")
    parser.add_argument("--identity-command-path")
    parser.add_argument("--identity-command-sha256")
    parser.add_argument("--operator-account-id")
    parser.add_argument("--operator-principal-arn")
    parser.add_argument("--credential-profile")
    parser.add_argument("--lock-dir")
    parser.add_argument("--spool-dir")
    arguments = parser.parse_args()
    configure_local_publisher(arguments)
    bucket = validate_bucket(arguments.bucket)
    if arguments.operation == "list":
        if not arguments.prefix_b64:
            fail("list requires --prefix-b64")
        list_operation(bucket, arguments.prefix_b64)
        return
    if arguments.operation == "publish":
        if not arguments.prefix_b64:
            fail("publish requires --prefix-b64")
        requested_prefix = validate_release_prefix(decode_value(arguments.prefix_b64, "prefix"))
        publish(bucket, requested_prefix)
        return
    if arguments.operation == "import-v1":
        if not arguments.prefix_b64:
            fail("import-v1 requires --prefix-b64")
        requested_prefix = validate_blob_release_prefix(decode_value(arguments.prefix_b64, "prefix"))
        import_v1_blob_release(bucket, requested_prefix)
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
