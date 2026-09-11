#!/usr/bin/env python3
"""Daily CAS publisher for course-content/runtime.

Scans file metadata, hashes only changed files, conditionally PUTs new blobs,
and writes the current act-runtime-release.v2 manifest. Parent, HEAD, and
full readback are not part of this path. Default stdout is the final JSON
object; --progress writes at most one heartbeat per minute to stderr, plus
immediate phase events. OSS uploads reuse one HTTP(S) connection when
credentials are present. --bootstrap creates or repairs an index without
wiping a valid one; --rebuild-index is the explicit full rebuild.
"""

from __future__ import annotations

import argparse
import base64
import errno
import hashlib
import hmac
import http.client
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from email.utils import formatdate
from pathlib import Path
from typing import Iterable, Literal, Protocol
from urllib.parse import urlencode


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ROOT = REPO_ROOT / "course-content" / "runtime"
DEFAULT_INDEX = REPO_ROOT / "var" / "cache" / "runtime-release" / "index.sqlite"
INDEX_UNAVAILABLE = "local publish index unavailable\nrun with --bootstrap to rebuild"
SCHEMA_VERSION = "act-runtime-release.v2"
RECEIPT_SCHEMA_VERSION = "act-runtime-release-receipt.v2"
INDEX_SCHEMA = "runtime-publish-index.v1"
PROGRESS_EVERY_SECONDS = 60.0
HASH_FLUSH_EVERY = 50
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
RELEASE_ID_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
IGNORED_NAMES = {".DS_Store", ".act-runtime-release.v1.json", ".act-runtime-release.v2.json"}
OSS_CONFLICT_CODES = {"filealreadyexists", "preconditionfailed"}
OSS_CONFLICT_STATUS = {409, 412}
OSS_SIGNED_QUERY = {
    "acl",
    "append",
    "callback",
    "callback-var",
    "cname",
    "compaction",
    "continuation-token",
    "cors",
    "delete",
    "encryption",
    "lifecycle",
    "live",
    "location",
    "logging",
    "partNumber",
    "policy",
    "position",
    "qos",
    "referer",
    "replication",
    "restore",
    "security-token",
    "symlink",
    "tagging",
    "uploadId",
    "uploads",
    "versionId",
    "versioning",
    "versions",
    "website",
    "worm",
}
OSS_XML_CODE = re.compile(r"<Code>\s*([^<]+)\s*</Code>", re.IGNORECASE)
OSS_LABELED_ERROR_CODE = re.compile(
    r"(?im)^\s*Error Code:\s*([A-Za-z0-9]+)\s*\.?\s*$",
)
OSS_LABELED_STATUS = re.compile(
    r"(?im)^\s*Http Status Code:\s*(\d+)\s*\.?\s*$",
)


class PublishError(RuntimeError):
    def __init__(self, message: str, *, code: int = 2) -> None:
        super().__init__(message)
        self.code = code


class ProgressReporter:
    def __init__(self, enabled: bool, stream=None) -> None:
        self.enabled = enabled
        self.stream = stream or sys.stderr
        self._last_t: float | None = None
        self._last_n = 0
        self._last_phase: object = None
        self._cas_hit_emitted = False

    def write(self, **fields: object) -> None:
        if not self.enabled:
            return
        parts = []
        for key, value in fields.items():
            text = "" if value is None else str(value).replace("\n", " ").replace("\r", " ")
            parts.append(f"{key}={text}")
        self.stream.write("progress " + " ".join(parts) + "\n")
        self.stream.flush()

    def event(self, name: str, **fields: object) -> None:
        self.write(event=name, **fields)

    def maybe_event(self, name: str, **fields: object) -> None:
        if not self.enabled:
            return
        now = time.monotonic()
        if self._last_t is not None and now - self._last_t < PROGRESS_EVERY_SECONDS:
            return
        self._last_t = now
        self.write(event=name, **fields)

    def maybe(self, n: int, **fields: object) -> None:
        if not self.enabled:
            return
        now = time.monotonic()
        phase = fields.get("phase")
        if phase != self._last_phase:
            self._last_phase = phase
            self._last_n = 0
            self._last_t = None
        if self._last_t is not None and now - self._last_t < PROGRESS_EVERY_SECONDS:
            return
        self._last_n = n
        self._last_t = now
        self.write(**fields)

    def cas_hit(self, key: str) -> None:
        if self._cas_hit_emitted:
            return
        self._cas_hit_emitted = True
        self.event("cas-hit", key=key)


def stable_stringify(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    if isinstance(value, list):
        return "[" + ",".join(stable_stringify(item) for item in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value.keys())
        return "{" + ",".join(f"{json.dumps(key, ensure_ascii=False)}:{stable_stringify(value[key])}" for key in keys) + "}"
    raise PublishError(f"cannot canonicalize {type(value).__name__}")


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


BLOB_KEY_PREFIX = "runtime/blobs/sha256/"


def blob_key(digest: str) -> str:
    if not SHA256_PATTERN.fullmatch(digest):
        raise PublishError("blob key requires a SHA-256 digest")
    return f"{BLOB_KEY_PREFIX}{digest}"


def digest_from_blob_key(key: str) -> str | None:
    if not key.startswith(BLOB_KEY_PREFIX):
        return None
    digest = key[len(BLOB_KEY_PREFIX) :]
    if not SHA256_PATTERN.fullmatch(digest):
        return None
    return digest


def _truthy(value: object) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"true", "1", "yes"}


def contents_entries(value: object) -> list[dict]:
    if value is None:
        return []
    if isinstance(value, dict):
        if "Key" in value or "key" in value:
            return [value]
        return []
    if isinstance(value, list):
        entries: list[dict] = []
        for item in value:
            entries.extend(contents_entries(item))
        return entries
    return []


def parse_list_objects_page(text: str) -> tuple[list[str], str | None]:
    payloads = [item for item in _json_objects(text) if isinstance(item, dict)]
    if not payloads and text.strip():
        try:
            loaded = json.loads(text)
        except json.JSONDecodeError as error:
            raise PublishError("unable to parse list-objects-v2 response") from error
        if isinstance(loaded, dict):
            payloads = [loaded]
    if not payloads:
        raise PublishError("unable to parse list-objects-v2 response")
    digests: list[str] = []
    next_token = None
    for payload in payloads:
        for item in contents_entries(payload.get("Contents") or payload.get("contents")):
            key = item.get("Key") or item.get("key")
            digest = digest_from_blob_key(str(key)) if key is not None else None
            if digest:
                digests.append(digest)
        token = payload.get("NextContinuationToken") or payload.get("nextContinuationToken")
        truncated = payload.get("IsTruncated") if "IsTruncated" in payload else payload.get("isTruncated")
        if token and (truncated is None or _truthy(truncated)):
            next_token = str(token)
    return digests, next_token


def manifest_key(release_id: str) -> str:
    return f"runtime/blob-releases/{release_id}/manifest.json"


def receipt_key(release_id: str) -> str:
    return f"runtime/blob-releases/{release_id}/receipt.json"


def normalized_relative_path(value: str) -> str:
    if "\\" in value or value.startswith("/") or not value:
        raise PublishError(f"invalid runtime path: {value}")
    parts = value.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise PublishError(f"invalid runtime path: {value}")
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise PublishError(f"invalid runtime path: {value}")
    return value


@dataclass(frozen=True)
class FileRecord:
    path: str
    size: int
    mtime_ns: int
    sha256: str | None = None


class ObjectStore(Protocol):
    def put(self, key: str, data: bytes) -> Literal["created", "hit"]:
        ...

    def put_file(self, key: str, source: Path) -> Literal["created", "hit"]:
        ...


def oss_http_settings(endpoint: str | None = None) -> tuple[str, str, str] | None:
    key_id = (os.environ.get("OSS_ACCESS_KEY_ID") or os.environ.get("ALIBABA_CLOUD_ACCESS_KEY_ID") or "").strip()
    secret = (os.environ.get("OSS_ACCESS_KEY_SECRET") or os.environ.get("ALIBABA_CLOUD_ACCESS_KEY_SECRET") or "").strip()
    host = (endpoint or os.environ.get("OSS_ENDPOINT") or os.environ.get("ACT_RUNTIME_OSS_ENDPOINT") or "").strip()
    host = host.removeprefix("https://").removeprefix("http://").rstrip("/")
    if key_id and secret and host:
        return key_id, secret, host
    return None


def _xml_local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse_list_objects_xml(text: str) -> tuple[list[str], str | None]:
    try:
        root = ET.fromstring(text)
    except ET.ParseError as error:
        raise PublishError("unable to parse list-objects-v2 response") from error
    digests: list[str] = []
    next_token = None
    truncated = False
    for node in root.iter():
        name = _xml_local(node.tag)
        if name == "Key" and node.text:
            digest = digest_from_blob_key(node.text.strip())
            if digest:
                digests.append(digest)
        elif name == "NextContinuationToken" and node.text:
            next_token = node.text
        elif name == "IsTruncated" and node.text:
            truncated = _truthy(node.text)
    if next_token and not truncated:
        next_token = None
    return digests, next_token


class OssHttpObjectStore:
    def __init__(
        self,
        bucket: str,
        access_key_id: str,
        access_key_secret: str,
        endpoint: str,
        *,
        progress: ProgressReporter | None = None,
        scheme: str = "https",
        path_style: bool | None = None,
    ) -> None:
        self.bucket = bucket
        self.access_key_id = access_key_id
        self.access_key_secret = access_key_secret
        self.endpoint = endpoint
        self.progress = progress
        self.scheme = scheme
        host = endpoint.split(":")[0]
        self.path_style = host in {"localhost", "127.0.0.1"} if path_style is None else path_style
        self._client: http.client.HTTPConnection | None = None

    def close(self) -> None:
        if self._client is not None:
            try:
                self._client.close()
            except OSError:
                pass
            self._client = None

    def put(self, key: str, data: bytes) -> Literal["created", "hit"]:
        return self._put(key, data, len(data))

    def put_file(self, key: str, source: Path) -> Literal["created", "hit"]:
        size = source.stat().st_size
        with source.open("rb") as handle:
            return self._put(key, handle, size)

    def list_blob_page(self, continuation: str | None = None) -> tuple[list[str], str | None]:
        query = {"list-type": "2", "max-keys": "1000", "prefix": BLOB_KEY_PREFIX}
        if continuation:
            query["continuation-token"] = continuation
        status, body = self._request("GET", "", query=query)
        if status != 200:
            raise PublishError(f"list-objects-v2 failed: {status} {body.decode('utf-8', errors='replace').strip()}")
        return parse_list_objects_xml(body.decode("utf-8", errors="replace"))

    def _put(self, key: str, body: bytes | object, size: int) -> Literal["created", "hit"]:
        headers = {"Content-Type": "application/octet-stream", "x-oss-forbid-overwrite": "true"}
        status, payload = self._request("PUT", key, body=body, size=size, headers=headers)
        if status in {200, 201}:
            return "created"
        if status in OSS_CONFLICT_STATUS:
            return "hit"
        raise PublishError(f"conditional PUT failed for {key}: {status} {payload.decode('utf-8', errors='replace').strip()}")

    def _connect_host(self) -> tuple[str, int]:
        default_port = 443 if self.scheme == "https" else 80
        target = self.endpoint if self.path_style else f"{self.bucket}.{self.endpoint}"
        if target.count(":") == 1 and not target.startswith("["):
            name, port = target.rsplit(":", 1)
            if port.isdigit():
                return name, int(port)
        return target, default_port

    def _ensure_client(self) -> http.client.HTTPConnection:
        if self._client is not None:
            return self._client
        host, port = self._connect_host()
        if self.scheme == "https":
            self._client = http.client.HTTPSConnection(host, port, timeout=60)
        else:
            self._client = http.client.HTTPConnection(host, port, timeout=60)
        return self._client

    def _request(
        self,
        method: str,
        key: str,
        *,
        body: bytes | object | None = None,
        size: int = 0,
        headers: dict[str, str] | None = None,
        query: dict[str, str] | None = None,
    ) -> tuple[int, bytes]:
        last_error: Exception | None = None
        for attempt in range(8):
            try:
                return self._request_once(method, key, body=body, size=size, headers=headers, query=query)
            except (OSError, http.client.HTTPException, TimeoutError) as error:
                last_error = error
                self.close()
                seek = getattr(body, "seek", None)
                if callable(seek):
                    seek(0)
                elif body is not None and not isinstance(body, bytes):
                    raise PublishError(f"OSS {method} {key} failed: {error}") from error
                if self.progress:
                    self.progress.maybe_event("http-retry", key=key or BLOB_KEY_PREFIX, attempt=attempt + 1, error=error)
                time.sleep(min(2.0, 0.05 * (2 ** attempt)))
        raise PublishError(f"OSS {method} {key} failed: {last_error}")

    def _request_once(
        self,
        method: str,
        key: str,
        *,
        body: bytes | object | None = None,
        size: int = 0,
        headers: dict[str, str] | None = None,
        query: dict[str, str] | None = None,
    ) -> tuple[int, bytes]:
        date = formatdate(usegmt=True)
        extra = dict(headers or {})
        extra["Date"] = date
        extra["Host"] = self.endpoint if self.path_style else f"{self.bucket}.{self.endpoint.split(':')[0]}"
        if method == "PUT":
            extra["Content-Length"] = str(size)
        extra["Authorization"] = self._authorization(method, key, extra, query)
        path = f"/{self.bucket}/{key}" if self.path_style else f"/{key}"
        if query:
            path = f"{path}?{urlencode(query)}"
        connection = self._ensure_client()
        connection.request(method, path, body=body, headers=extra)
        response = connection.getresponse()
        payload = response.read()
        if response.status >= 500:
            raise http.client.RemoteDisconnected(f"HTTP {response.status}")
        return response.status, payload

    def _authorization(self, method: str, key: str, headers: dict[str, str], query: dict[str, str] | None) -> str:
        content_md5 = headers.get("Content-MD5", "")
        content_type = headers.get("Content-Type", "")
        date = headers.get("Date", "")
        canonical_headers = "".join(
            f"{name.lower()}:{headers[name].strip()}\n" for name in sorted(headers) if name.lower().startswith("x-oss-")
        )
        resource = f"/{self.bucket}/{key}"
        signed_query = {name: query[name] for name in query or {} if name in OSS_SIGNED_QUERY}
        if signed_query:
            resource += "?" + "&".join(f"{name}={signed_query[name]}" for name in sorted(signed_query))
        canonical = f"{method}\n{content_md5}\n{content_type}\n{date}\n{canonical_headers}{resource}"
        signature = base64.b64encode(hmac.new(self.access_key_secret.encode("utf-8"), canonical.encode("utf-8"), hashlib.sha1).digest()).decode("ascii")
        return f"OSS {self.access_key_id}:{signature}"


def _retryable_spawn(error: Exception) -> bool:
    if isinstance(error, BlockingIOError):
        return True
    return isinstance(error, OSError) and error.errno in {errno.EAGAIN, errno.ENOMEM}


def _retryable_child_exit(code: int | None) -> bool:
    if code is None:
        return False
    return code < 0 or code in {137, 143}


class LocalObjectStore:
    def __init__(self, root: Path) -> None:
        self.root = root

    def put(self, key: str, data: bytes) -> Literal["created", "hit"]:
        destination = self._prepare_destination(key)
        if destination is None:
            return "hit"
        try:
            written = 0
            view = memoryview(data)
            while written < len(data):
                written += os.write(destination, view[written:])
        finally:
            os.close(destination)
        return "created"

    def put_file(self, key: str, source: Path) -> Literal["created", "hit"]:
        destination = self._prepare_destination(key)
        if destination is None:
            return "hit"
        try:
            with source.open("rb") as handle, os.fdopen(destination, "wb") as output:
                shutil.copyfileobj(handle, output, 1024 * 1024)
        except Exception:
            try:
                os.close(destination)
            except OSError:
                pass
            raise
        return "created"

    def _prepare_destination(self, key: str) -> int | None:
        destination = self.root.joinpath(*key.split("/"))
        destination.parent.mkdir(parents=True, exist_ok=True)
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        try:
            return os.open(destination, flags, 0o644)
        except FileExistsError:
            return None


class OssutilObjectStore:
    def __init__(
        self,
        bucket: str,
        ossutil: str,
        extra_args: Iterable[str] = (),
        progress: ProgressReporter | None = None,
    ) -> None:
        self.bucket = bucket
        self.ossutil = ossutil
        self.extra_args = list(extra_args)
        self.progress = progress

    def put(self, key: str, data: bytes) -> Literal["created", "hit"]:
        from tempfile import NamedTemporaryFile

        with NamedTemporaryFile(prefix="act-runtime-put-", delete=False) as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
            temp_path = handle.name
        try:
            return self.put_file(key, Path(temp_path))
        finally:
            os.unlink(temp_path)

    def put_file(self, key: str, source: Path) -> Literal["created", "hit"]:
        arguments = [
            self.ossutil,
            *self.extra_args,
            "api",
            "put-object",
            "--bucket",
            self.bucket,
            "--key",
            key,
            "--body",
            f"file://{source}",
            "--forbid-overwrite",
            "true",
            "-q",
        ]
        process = None
        last_error: Exception | None = None
        for attempt in range(8):
            try:
                process = subprocess.run(arguments, check=False, capture_output=True)
            except OSError as error:
                if not _retryable_spawn(error):
                    if self.progress:
                        self.progress.event("spawn-failed", key=key, error=error)
                    raise
                last_error = error
                if self.progress:
                    self.progress.maybe_event("spawn-retry", key=key, attempt=attempt + 1, error=error)
                time.sleep(min(2.0, 0.05 * (2 ** attempt)))
                continue
            if process.returncode == 0:
                return "created"
            if is_structured_cas_hit(process.stdout, process.stderr):
                return "hit"
            if _retryable_child_exit(process.returncode) and attempt < 7:
                last_error = PublishError(f"ossutil exited {process.returncode}")
                if self.progress:
                    self.progress.maybe_event("spawn-retry", key=key, attempt=attempt + 1, error=last_error)
                time.sleep(min(2.0, 0.05 * (2 ** attempt)))
                continue
            detail = b" ".join((process.stdout, process.stderr)).decode("utf-8", errors="replace")
            raise PublishError(f"conditional PUT failed for {key}: {detail.strip() or process.returncode}")
        if self.progress:
            self.progress.event("spawn-failed", key=key, error=last_error)
        raise PublishError(f"conditional PUT failed for {key}: {last_error}")

    def list_blob_page(self, continuation: str | None = None) -> tuple[list[str], str | None]:
        arguments = [
            self.ossutil,
            *self.extra_args,
            "api",
            "list-objects-v2",
            "--bucket",
            self.bucket,
            "--prefix",
            BLOB_KEY_PREFIX,
            "--max-keys",
            "1000",
            "--output-format",
            "json",
        ]
        if continuation:
            arguments.extend(["--continuation-token", continuation])
        process = None
        last_error: Exception | None = None
        for attempt in range(8):
            try:
                process = subprocess.run(arguments, check=False, capture_output=True)
            except OSError as error:
                if not _retryable_spawn(error):
                    if self.progress:
                        self.progress.event("spawn-failed", key=BLOB_KEY_PREFIX, error=error)
                    raise
                last_error = error
                if self.progress:
                    self.progress.maybe_event("spawn-retry", key=BLOB_KEY_PREFIX, attempt=attempt + 1, error=error)
                time.sleep(min(2.0, 0.05 * (2 ** attempt)))
                continue
            if process.returncode == 0:
                text = process.stdout.decode("utf-8", errors="replace")
                return parse_list_objects_page(text)
            if _retryable_child_exit(process.returncode) and attempt < 7:
                last_error = PublishError(f"ossutil exited {process.returncode}")
                if self.progress:
                    self.progress.maybe_event("spawn-retry", key=BLOB_KEY_PREFIX, attempt=attempt + 1, error=last_error)
                time.sleep(min(2.0, 0.05 * (2 ** attempt)))
                continue
            detail = b" ".join((process.stdout, process.stderr)).decode("utf-8", errors="replace")
            raise PublishError(f"list-objects-v2 failed: {detail.strip() or process.returncode}")
        if self.progress:
            self.progress.event("spawn-failed", key=BLOB_KEY_PREFIX, error=last_error)
        raise PublishError(f"list-objects-v2 failed: {last_error}")


def _json_objects(text: str) -> list[object]:
    objects: list[object] = []
    decoder = json.JSONDecoder()
    index = 0
    while index < len(text):
        start = text.find("{", index)
        if start < 0:
            break
        try:
            value, end = decoder.raw_decode(text, start)
        except json.JSONDecodeError:
            index = start + 1
            continue
        objects.append(value)
        index = end
    return objects


def _conflict_status(value: object) -> int | None:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _payload_is_conflict(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    error = value["error"] if isinstance(value.get("error"), dict) else value
    status = _conflict_status(
        error.get("statusCode") or error.get("StatusCode") or error.get("status") or error.get("httpStatus")
    )
    raw_code = error.get("errorCode") or error.get("Code") or error.get("code")
    code = str(raw_code).lower() if raw_code is not None else ""
    return status in OSS_CONFLICT_STATUS or code in OSS_CONFLICT_CODES


def _labeled_ossutil_conflict(text: str) -> bool:
    codes = {match.group(1).lower() for match in OSS_LABELED_ERROR_CODE.finditer(text)}
    if not codes.intersection(OSS_CONFLICT_CODES):
        return False
    statuses = {_conflict_status(match.group(1)) for match in OSS_LABELED_STATUS.finditer(text)}
    return bool(statuses.intersection(OSS_CONFLICT_STATUS))


def is_structured_cas_hit(stdout: bytes, stderr: bytes) -> bool:
    text = b"\n".join((stdout, stderr)).decode("utf-8", errors="replace")
    if any(_payload_is_conflict(value) for value in _json_objects(text)):
        return True
    match = OSS_XML_CODE.search(text)
    if match and match.group(1).strip().lower() in OSS_CONFLICT_CODES:
        return True
    return _labeled_ossutil_conflict(text)


def _create_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        DROP TABLE IF EXISTS files;
        DROP TABLE IF EXISTS hashed;
        DROP TABLE IF EXISTS blobs;
        DROP TABLE IF EXISTS meta;
        CREATE TABLE files (
          path TEXT PRIMARY KEY,
          size INTEGER NOT NULL,
          mtime_ns INTEGER NOT NULL,
          sha256 TEXT NOT NULL,
          last_seen_release TEXT
        );
        CREATE TABLE hashed (
          path TEXT PRIMARY KEY,
          size INTEGER NOT NULL,
          mtime_ns INTEGER NOT NULL,
          sha256 TEXT NOT NULL
        );
        CREATE TABLE blobs (
          sha256 TEXT PRIMARY KEY,
          result TEXT NOT NULL
        );
        CREATE TABLE meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        """
    )
    connection.execute("INSERT INTO meta(key, value) VALUES (?, ?)", ("schema", INDEX_SCHEMA))
    connection.commit()


def _ensure_resume_tables(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS hashed (
          path TEXT PRIMARY KEY,
          size INTEGER NOT NULL,
          mtime_ns INTEGER NOT NULL,
          sha256 TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS blobs (
          sha256 TEXT PRIMARY KEY,
          result TEXT NOT NULL
        );
        """
    )
    connection.commit()


def _index_is_valid(connection: sqlite3.Connection) -> bool:
    try:
        schema = connection.execute("SELECT value FROM meta WHERE key = ?", ("schema",)).fetchone()
        columns = {row[1] for row in connection.execute("PRAGMA table_info(files)")}
    except sqlite3.Error:
        return False
    required = {"path", "size", "mtime_ns", "sha256", "last_seen_release"}
    return schema is not None and schema["value"] == INDEX_SCHEMA and required.issubset(columns)


def open_index(path: Path, *, bootstrap: bool, rebuild: bool = False) -> sqlite3.Connection:
    if not path.is_file() and not bootstrap and not rebuild:
        raise PublishError(INDEX_UNAVAILABLE)
    path.parent.mkdir(parents=True, exist_ok=True)

    def connect() -> sqlite3.Connection:
        connection = sqlite3.connect(path)
        connection.row_factory = sqlite3.Row
        return connection

    try:
        connection = connect()
    except sqlite3.Error as error:
        if not (bootstrap or rebuild):
            raise PublishError(INDEX_UNAVAILABLE) from error
        path.unlink(missing_ok=True)
        connection = connect()
        _create_schema(connection)
        return connection

    try:
        valid = _index_is_valid(connection)
        if rebuild or (bootstrap and not valid):
            try:
                _create_schema(connection)
            except sqlite3.Error:
                connection.close()
                path.unlink(missing_ok=True)
                connection = connect()
                _create_schema(connection)
            return connection
        if not valid:
            connection.close()
            raise PublishError(INDEX_UNAVAILABLE)
        _ensure_resume_tables(connection)
        return connection
    except PublishError:
        raise
    except sqlite3.Error as error:
        try:
            connection.close()
        except sqlite3.Error:
            pass
        if bootstrap or rebuild:
            path.unlink(missing_ok=True)
            connection = connect()
            _create_schema(connection)
            return connection
        raise PublishError(INDEX_UNAVAILABLE) from error


def scan_runtime(root: Path, progress: ProgressReporter | None = None) -> list[FileRecord]:
    if not root.is_dir() or root.is_symlink():
        raise PublishError("runtime source root must be a real directory")
    records: list[FileRecord] = []
    scanned = 0
    for current, dirnames, filenames in os.walk(root, followlinks=False):
        current_path = Path(current)
        if current_path.is_symlink():
            raise PublishError(f"runtime source contains symlink: {current_path.relative_to(root).as_posix()}")
        for name in dirnames:
            child = current_path / name
            if child.is_symlink():
                raise PublishError(f"runtime source contains symlink: {child.relative_to(root).as_posix()}")
        for name in filenames:
            child = current_path / name
            relative = normalized_relative_path(child.relative_to(root).as_posix())
            if child.is_symlink():
                raise PublishError(f"runtime source contains symlink: {relative}")
            if not child.is_file():
                raise PublishError(f"runtime source contains unsupported entry: {relative}")
            if Path(relative).name in IGNORED_NAMES:
                continue
            stat_result = child.stat()
            records.append(FileRecord(path=relative, size=stat_result.st_size, mtime_ns=stat_result.st_mtime_ns))
            scanned += 1
            if progress:
                progress.maybe(scanned, phase="scan", scanned=scanned, path=relative)
    if not records:
        raise PublishError("runtime release must contain at least one file")
    records.sort(key=lambda item: item.path)
    paths = [item.path for item in records]
    if len(set(paths)) != len(paths):
        raise PublishError("runtime source normalizes to duplicate paths")
    if progress:
        progress.event("scan-complete", scanned=len(records))
    return records


def hash_file(root: Path, record: FileRecord) -> FileRecord:
    absolute = root / record.path
    before = absolute.stat()
    digest = hashlib.sha256()
    with absolute.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    after = absolute.stat()
    if before.st_size != after.st_size or before.st_mtime_ns != after.st_mtime_ns:
        raise PublishError(f"runtime source changed while hashing: {record.path}")
    return FileRecord(path=record.path, size=before.st_size, mtime_ns=before.st_mtime_ns, sha256=digest.hexdigest())


def load_index_rows(connection: sqlite3.Connection, table: str = "files") -> dict[str, FileRecord]:
    if table not in {"files", "hashed"}:
        raise PublishError(f"unknown publish index table: {table}")
    rows = {}
    for row in connection.execute(f"SELECT path, size, mtime_ns, sha256 FROM {table}"):
        rows[row["path"]] = FileRecord(path=row["path"], size=row["size"], mtime_ns=row["mtime_ns"], sha256=row["sha256"])
    return rows


def load_published_digests(connection: sqlite3.Connection) -> set[str]:
    published = {row[0] for row in connection.execute("SELECT sha256 FROM blobs")}
    published.update(row[0] for row in connection.execute("SELECT DISTINCT sha256 FROM files"))
    return published


def persist_hashed(connection: sqlite3.Connection, records: list[FileRecord]) -> None:
    if not records:
        return
    connection.executemany(
        "INSERT OR REPLACE INTO hashed(path, size, mtime_ns, sha256) VALUES (?, ?, ?, ?)",
        [(item.path, item.size, item.mtime_ns, item.sha256) for item in records],
    )
    connection.commit()


def persist_listed_blobs(connection: sqlite3.Connection, digests: list[str]) -> None:
    if not digests:
        return
    connection.executemany(
        "INSERT OR IGNORE INTO blobs(sha256, result) VALUES (?, ?)",
        [(digest, "listed") for digest in digests],
    )
    connection.commit()


def retire_missing_blobs(connection: sqlite3.Connection, present: set[str]) -> int:
    existing = {row[0] for row in connection.execute("SELECT sha256 FROM blobs")}
    missing = existing - present
    if not missing:
        return 0
    connection.executemany("DELETE FROM blobs WHERE sha256 = ?", [(digest,) for digest in missing])
    connection.executemany("DELETE FROM files WHERE sha256 = ?", [(digest,) for digest in missing])
    connection.commit()
    return len(missing)


def sync_remote_blobs(store: ObjectStore, connection: sqlite3.Connection, progress: ProgressReporter) -> tuple[int, int]:
    lister = getattr(store, "list_blob_page", None)
    if not callable(lister):
        return 0, 0
    progress.event("list-start", prefix=BLOB_KEY_PREFIX)
    seen: set[str] = set()
    token: str | None = None
    listed = 0
    while True:
        digests, token = lister(token)
        persist_listed_blobs(connection, digests)
        seen.update(digests)
        listed += len(digests)
        progress.maybe(listed, phase="list", listed=listed)
        if not token:
            break
    local_count = connection.execute("SELECT COUNT(*) FROM blobs").fetchone()[0]
    retired = retire_missing_blobs(connection, seen) if listed else 0
    progress.event("list-complete", listed=listed, retired=retired, local=local_count)
    return listed, retired


def persist_published_blob(
    connection: sqlite3.Connection,
    digest: str,
    result: str,
    files: list[FileRecord],
    release_id: str,
) -> None:
    connection.execute("INSERT OR REPLACE INTO blobs(sha256, result) VALUES (?, ?)", (digest, result))
    if files:
        connection.executemany(
            "INSERT OR REPLACE INTO files(path, size, mtime_ns, sha256, last_seen_release) VALUES (?, ?, ?, ?, ?)",
            [(item.path, item.size, item.mtime_ns, item.sha256, release_id) for item in files],
        )
    connection.commit()


def metadata_matches(record: FileRecord, candidate: FileRecord | None) -> bool:
    return (
        candidate is not None
        and candidate.size == record.size
        and candidate.mtime_ns == record.mtime_ns
        and candidate.sha256 is not None
    )


def resolve_files(
    root: Path,
    scanned: list[FileRecord],
    indexed: dict[str, FileRecord],
    hashed_rows: dict[str, FileRecord],
    connection: sqlite3.Connection,
    *,
    rebuild: bool,
    progress: ProgressReporter | None = None,
) -> tuple[list[FileRecord], int]:
    resolved: list[FileRecord] = []
    hashed = 0
    pending: list[FileRecord] = []
    total = len(scanned)
    for index, record in enumerate(scanned, start=1):
        reused: FileRecord | None = None
        if not rebuild:
            if metadata_matches(record, indexed.get(record.path)):
                reused = indexed[record.path]
            elif metadata_matches(record, hashed_rows.get(record.path)):
                reused = hashed_rows[record.path]
        if reused is not None:
            resolved.append(FileRecord(path=record.path, size=record.size, mtime_ns=record.mtime_ns, sha256=reused.sha256))
            if progress:
                progress.maybe(index, phase="hash", hashed=f"{hashed}/{total}", path=record.path)
            continue
        hashed_record = hash_file(root, record)
        hashed += 1
        if hashed_record.sha256 is None:
            raise PublishError(f"missing SHA-256 for {record.path}")
        pending.append(hashed_record)
        if len(pending) >= HASH_FLUSH_EVERY:
            persist_hashed(connection, pending)
            pending.clear()
        resolved.append(hashed_record)
        if progress:
            progress.maybe(index, phase="hash", hashed=f"{hashed}/{total}", path=record.path)
    persist_hashed(connection, pending)
    if progress:
        progress.write(phase="hash", hashed=f"{hashed}/{total}", status="complete")
    return resolved, hashed


def build_manifest(source_revision: str, files: list[FileRecord]) -> dict[str, object]:
    if not __import__("re").fullmatch(r"[0-9a-f]{40}", source_revision):
        raise PublishError("sourceRevision must be a 40-character Git SHA")
    entries = []
    for record in files:
        if record.sha256 is None or not SHA256_PATTERN.fullmatch(record.sha256):
            raise PublishError(f"missing SHA-256 for {record.path}")
        entries.append(
            {
                "path": record.path,
                "objectKey": blob_key(record.sha256),
                "sizeBytes": record.size,
                "sha256": record.sha256,
            }
        )
    tree_sha256 = sha256_text(stable_stringify([{"path": item["path"], "sizeBytes": item["sizeBytes"], "sha256": item["sha256"]} for item in entries]))
    release_id = f"runtime-{sha256_text(stable_stringify({'sourceRevision': source_revision, 'treeSha256': tree_sha256}))[:55]}"
    if not RELEASE_ID_PATTERN.fullmatch(release_id):
        raise PublishError("derived release id is invalid")
    without_digest = {
        "schemaVersion": SCHEMA_VERSION,
        "releaseId": release_id,
        "sourceRevision": source_revision,
        "fileCount": len(entries),
        "totalBytes": sum(item["sizeBytes"] for item in entries),
        "treeSha256": tree_sha256,
        "files": entries,
    }
    return {**without_digest, "manifestSha256": sha256_text(stable_stringify(without_digest))}


def build_receipt(manifest: dict[str, object]) -> dict[str, object]:
    blobs: dict[str, dict[str, object]] = {}
    for item in manifest["files"]:
        blobs[item["objectKey"]] = {
            "objectKey": item["objectKey"],
            "sizeBytes": item["sizeBytes"],
            "sha256": item["sha256"],
        }
    blob_list = sorted(blobs.values(), key=lambda item: item["objectKey"])
    wire = stable_stringify(manifest) + "\n"
    without_digest = {
        "schemaVersion": RECEIPT_SCHEMA_VERSION,
        "releaseId": manifest["releaseId"],
        "manifestVersion": SCHEMA_VERSION,
        "manifestObjectKey": manifest_key(str(manifest["releaseId"])),
        "manifestSha256": manifest["manifestSha256"],
        "manifestWireSha256": sha256_bytes(wire.encode("utf-8")),
        "manifestWireSizeBytes": len(wire.encode("utf-8")),
        "treeSha256": manifest["treeSha256"],
        "fileCount": manifest["fileCount"],
        "totalBytes": manifest["totalBytes"],
        "blobs": blob_list,
    }
    return {**without_digest, "receiptSha256": sha256_text(stable_stringify(without_digest))}


def put_payload(store: ObjectStore, key: str, payload: bytes) -> Literal["created", "hit"]:
    return store.put(key, payload)


def persist_index(connection: sqlite3.Connection, files: list[FileRecord], release_id: str) -> None:
    connection.execute("DELETE FROM files")
    connection.executemany(
        "INSERT INTO files(path, size, mtime_ns, sha256, last_seen_release) VALUES (?, ?, ?, ?, ?)",
        [(item.path, item.size, item.mtime_ns, item.sha256, release_id) for item in files],
    )
    connection.executemany(
        "INSERT OR IGNORE INTO blobs(sha256, result) VALUES (?, ?)",
        [(item.sha256, "published") for item in files],
    )
    connection.execute("DELETE FROM hashed")
    connection.commit()


def assert_source_unchanged(root: Path, record: FileRecord) -> Path:
    source = root / record.path
    current = source.stat()
    if current.st_size != record.size or current.st_mtime_ns != record.mtime_ns:
        raise PublishError(f"file bytes drifted after hash: {record.path}")
    return source


def git_head(repo: Path) -> str:
    process = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"],
        check=False,
        capture_output=True,
        text=True,
    )
    if process.returncode != 0:
        raise PublishError("unable to resolve sourceRevision from git HEAD")
    revision = process.stdout.strip().lower()
    if not __import__("re").fullmatch(r"[0-9a-f]{40}", revision):
        raise PublishError("git HEAD is not a 40-character SHA")
    return revision


def publish(args: argparse.Namespace) -> dict[str, object]:
    root = Path(args.root).resolve()
    index_path = Path(args.index)
    source_revision = (args.source_revision or git_head(REPO_ROOT)).lower()
    progress = ProgressReporter(bool(getattr(args, "progress", False)))
    rebuild = bool(getattr(args, "rebuild_index", False))
    if args.store_dir:
        store: ObjectStore = LocalObjectStore(Path(args.store_dir))
    elif args.oss_bucket:
        settings = oss_http_settings(getattr(args, "oss_endpoint", None))
        if settings:
            store = OssHttpObjectStore(args.oss_bucket, *settings, progress=progress)
            progress.event("transport", kind="https")
        else:
            store = OssutilObjectStore(args.oss_bucket, args.ossutil, progress=progress)
            progress.event("transport", kind="ossutil")
    else:
        raise PublishError("store required: --store-dir or --oss-bucket")

    connection = open_index(index_path, bootstrap=args.bootstrap, rebuild=rebuild)
    try:
        scanned = scan_runtime(root, progress)
        indexed = load_index_rows(connection, "files")
        hashed_rows = load_index_rows(connection, "hashed")
        resolved, hashed = resolve_files(
            root,
            scanned,
            indexed,
            hashed_rows,
            connection,
            rebuild=rebuild,
            progress=progress,
        )
        manifest = build_manifest(source_revision, resolved)
        receipt = build_receipt(manifest)
        uploaded = 0
        uploaded_blobs = 0
        cas_hits = 0
        sync_remote_blobs(store, connection, progress)
        published_digests = load_published_digests(connection)
        unique_blobs: dict[str, FileRecord] = {}
        files_by_digest: dict[str, list[FileRecord]] = {}
        for record in resolved:
            if record.sha256 is None:
                raise PublishError(f"missing SHA-256 for {record.path}")
            files_by_digest.setdefault(record.sha256, []).append(record)
            if record.sha256 not in published_digests:
                unique_blobs[blob_key(record.sha256)] = record
        progress.event("put-start", unique=len(unique_blobs))
        for index, (key, record) in enumerate(unique_blobs.items(), start=1):
            try:
                source = assert_source_unchanged(root, record)
                result = store.put_file(key, source)
            except PublishError as error:
                progress.event("error", key=key, path=record.path, error=error)
                raise
            if result == "created":
                uploaded += 1
                uploaded_blobs += 1
            else:
                cas_hits += 1
                progress.cas_hit(key)
            persist_published_blob(
                connection,
                record.sha256,
                result,
                files_by_digest[record.sha256],
                str(manifest["releaseId"]),
            )
            published_digests.add(record.sha256)
            progress.maybe(
                index,
                phase="put",
                done=f"{index}/{len(unique_blobs)}",
                uploaded=uploaded_blobs,
                hits=cas_hits,
                key=key,
            )
        receipt_bytes = (stable_stringify(receipt) + "\n").encode("utf-8")
        manifest_bytes = (stable_stringify(manifest) + "\n").encode("utf-8")
        for key, payload in ((receipt_key(str(manifest["releaseId"])), receipt_bytes), (manifest_key(str(manifest["releaseId"])), manifest_bytes)):
            try:
                result = put_payload(store, key, payload)
            except PublishError as error:
                progress.event("error", key=key, error=error)
                raise
            if result == "created":
                uploaded += 1
            else:
                cas_hits += 1
                progress.cas_hit(key)
        persist_index(connection, resolved, str(manifest["releaseId"]))
    finally:
        connection.close()
        closer = getattr(store, "close", None)
        if callable(closer):
            closer()

    return {
        "releaseId": manifest["releaseId"],
        "sourceRevision": source_revision,
        "treeSha256": manifest["treeSha256"],
        "fileCount": manifest["fileCount"],
        "scanned": len(scanned),
        "hashed": hashed,
        "uploaded": uploaded,
        "uploadedBlobs": uploaded_blobs,
        "casHits": cas_hits,
        "bootstrap": args.bootstrap,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Publish a content-addressed runtime release from local file metadata.")
    parser.add_argument("--root", default=str(DEFAULT_ROOT))
    parser.add_argument("--index", default=str(DEFAULT_INDEX))
    parser.add_argument("--store-dir")
    parser.add_argument("--oss-bucket")
    parser.add_argument("--oss-endpoint")
    parser.add_argument("--ossutil", default="ossutil")
    parser.add_argument("--source-revision")
    parser.add_argument("--bootstrap", action="store_true")
    parser.add_argument("--rebuild-index", action="store_true")
    parser.add_argument("--progress", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        result = publish(args)
    except PublishError as error:
        sys.stderr.write(f"{error}\n")
        return error.code
    sys.stdout.write(json.dumps(result, indent=2, sort_keys=True) + "\n")
    sys.stderr.write(f"hashed={result['hashed']}\nuploaded={result['uploaded']}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
