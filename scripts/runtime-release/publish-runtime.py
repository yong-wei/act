#!/usr/bin/env python3
"""Daily CAS publisher for course-content/runtime.

Scans file metadata, hashes only changed files, conditionally PUTs new blobs,
and writes the current act-runtime-release.v2 manifest. Parent, HEAD, and
full readback are not part of this path.
"""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import re
import shlex
import sqlite3
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Literal, Protocol

sys.path.insert(0, str(Path(__file__).resolve().parent))
import runtime_media_storage as MEDIA_STORAGE
import public_teaching_media as PUBLIC_MEDIA


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ROOT = REPO_ROOT / "course-content" / "runtime"
DEFAULT_INDEX = REPO_ROOT / "var" / "cache" / "runtime-release" / "index.sqlite"
INDEX_UNAVAILABLE = "local publish index unavailable\nrun with --bootstrap to rebuild"
SCHEMA_VERSION = "act-runtime-release.v2"
RECEIPT_SCHEMA_VERSION = "act-runtime-release-receipt.v2"
INDEX_SCHEMA = "runtime-publish-index.v1"
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
RELEASE_ID_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
IGNORED_NAMES = {".DS_Store", ".act-runtime-release.v1.json", ".act-runtime-release.v2.json"}
OSS_CONFLICT_CODES = {"filealreadyexists", "preconditionfailed"}
OSS_CONFLICT_STATUS = {409, 412}
OSS_XML_CODE = re.compile(r"<Code>\s*([^<]+)\s*</Code>", re.IGNORECASE)
OSS_TEXT_CODE = re.compile(r"Error Code:\s*([A-Za-z]+)", re.IGNORECASE)
OSS_TEXT_STATUS = re.compile(r"Http Status Code:\s*(\d+)", re.IGNORECASE)


class PublishError(RuntimeError):
    def __init__(self, message: str, *, code: int = 2) -> None:
        super().__init__(message)
        self.code = code


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


def blob_key(digest: str) -> str:
    if not SHA256_PATTERN.fullmatch(digest):
        raise PublishError("blob key requires a SHA-256 digest")
    return f"runtime/blobs/sha256/{digest}"


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
    storage_key: str | None = None


class ObjectStore(Protocol):
    def put(self, key: str, data: bytes) -> Literal["created", "hit"]:
        ...


class LocalObjectStore:
    def __init__(self, root: Path) -> None:
        self.root = root

    def put(self, key: str, data: bytes) -> Literal["created", "hit"]:
        destination = self.root.joinpath(*key.split("/"))
        destination.parent.mkdir(parents=True, exist_ok=True)
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        try:
            fd = os.open(destination, flags, 0o644)
        except FileExistsError:
            return "hit"
        try:
            written = 0
            view = memoryview(data)
            while written < len(data):
                written += os.write(fd, view[written:])
        finally:
            os.close(fd)
        return "created"


class OssutilObjectStore:
    def __init__(self, bucket: str, ossutil: str, extra_args: Iterable[str] = ()) -> None:
        self.bucket = bucket
        self.ossutil = ossutil
        self.extra_args = list(extra_args)

    def put(self, key: str, data: bytes) -> Literal["created", "hit"]:
        from tempfile import NamedTemporaryFile

        with NamedTemporaryFile(prefix="act-runtime-put-", delete=False) as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
            temp_path = handle.name
        try:
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
                f"file://{temp_path}",
                "--forbid-overwrite",
                "true",
                "-q",
            ]
            if key.startswith(MEDIA_STORAGE.MEDIA_PREFIX):
                extension = Path(key).suffix
                if extension not in MEDIA_STORAGE.TYPES:
                    raise PublishError('invalid-public-media-type')
                digest = key[len(MEDIA_STORAGE.MEDIA_PREFIX):].split('/')[0]
                arguments.extend(['--content-type', MEDIA_STORAGE.TYPES[extension],
                                  '--cache-control', 'public, max-age=31536000, immutable',
                                  '--object-acl', 'private', '--metadata', 'sha256=' + digest])
            process = subprocess.run(arguments, check=False, capture_output=True)
        finally:
            os.unlink(temp_path)
        if process.returncode == 0:
            return "created"
        if is_structured_cas_hit(process.stdout, process.stderr):
            return "hit"
        detail = b" ".join((process.stdout, process.stderr)).decode("utf-8", errors="replace")
        raise PublishError(f"conditional PUT failed for {key}: {detail.strip() or process.returncode}")


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


def is_structured_cas_hit(stdout: bytes, stderr: bytes) -> bool:
    text = b"\n".join((stdout, stderr)).decode("utf-8", errors="replace")
    if any(_payload_is_conflict(value) for value in _json_objects(text)):
        return True
    match = OSS_XML_CODE.search(text)
    if match and match.group(1).strip().lower() in OSS_CONFLICT_CODES:
        return True
    status_match = OSS_TEXT_STATUS.search(text)
    code_match = OSS_TEXT_CODE.search(text)
    status = _conflict_status(status_match.group(1)) if status_match else None
    code = code_match.group(1).strip().lower() if code_match else ""
    return status in OSS_CONFLICT_STATUS or code in OSS_CONFLICT_CODES


def open_index(path: Path, *, bootstrap: bool) -> sqlite3.Connection:
    if not bootstrap and not path.is_file():
        raise PublishError(INDEX_UNAVAILABLE)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        connection = sqlite3.connect(path)
        connection.row_factory = sqlite3.Row
        if bootstrap:
            connection.executescript(
                """
                DROP TABLE IF EXISTS files;
                DROP TABLE IF EXISTS meta;
                CREATE TABLE files (
                  path TEXT PRIMARY KEY,
                  size INTEGER NOT NULL,
                  mtime_ns INTEGER NOT NULL,
                  sha256 TEXT NOT NULL,
                  last_seen_release TEXT,
                  storage_key TEXT
                );
                CREATE TABLE meta (
                  key TEXT PRIMARY KEY,
                  value TEXT NOT NULL
                );
                """
            )
            connection.execute("INSERT INTO meta(key, value) VALUES (?, ?)", ("schema", INDEX_SCHEMA))
            connection.commit()
            return connection
        schema = connection.execute("SELECT value FROM meta WHERE key = ?", ("schema",)).fetchone()
        columns = {row[1] for row in connection.execute("PRAGMA table_info(files)")}
        required = {"path", "size", "mtime_ns", "sha256", "last_seen_release"}
        if schema is None or schema["value"] != INDEX_SCHEMA or not required.issubset(columns):
            connection.close()
            raise PublishError(INDEX_UNAVAILABLE)
        if 'storage_key' not in columns:
            connection.execute('ALTER TABLE files ADD COLUMN storage_key TEXT')
            connection.commit()
        return connection
    except PublishError:
        raise
    except sqlite3.Error as error:
        raise PublishError(INDEX_UNAVAILABLE) from error


def scan_runtime(root: Path) -> list[FileRecord]:
    if not root.is_dir() or root.is_symlink():
        raise PublishError("runtime source root must be a real directory")
    records: list[FileRecord] = []
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
    if not records:
        raise PublishError("runtime release must contain at least one file")
    records.sort(key=lambda item: item.path)
    paths = [item.path for item in records]
    if len(set(paths)) != len(paths):
        raise PublishError("runtime source normalizes to duplicate paths")
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


def load_index_rows(connection: sqlite3.Connection) -> dict[str, FileRecord]:
    rows = {}
    for row in connection.execute("SELECT path, size, mtime_ns, sha256, storage_key FROM files"):
        rows[row["path"]] = FileRecord(path=row["path"], size=row["size"], mtime_ns=row["mtime_ns"], sha256=row["sha256"], storage_key=row['storage_key'])
    return rows


def resolve_files(
    root: Path,
    scanned: list[FileRecord],
    indexed: dict[str, FileRecord],
    *,
    bootstrap: bool,
) -> tuple[list[FileRecord], int, set[str]]:
    resolved: list[FileRecord] = []
    hashed = 0
    changed_blob_keys: set[str] = set()
    for record in scanned:
        previous = indexed.get(record.path)
        reuse = (
            not bootstrap
            and previous is not None
            and previous.size == record.size
            and previous.mtime_ns == record.mtime_ns
            and previous.sha256 is not None
        )
        if reuse:
            resolved.append(FileRecord(path=record.path, size=record.size, mtime_ns=record.mtime_ns, sha256=previous.sha256, storage_key=previous.storage_key))
            continue
        hashed_record = hash_file(root, record)
        hashed += 1
        if hashed_record.sha256 is None:
            raise PublishError(f"missing SHA-256 for {record.path}")
        changed_blob_keys.add(blob_key(hashed_record.sha256))
        resolved.append(hashed_record)
    return resolved, hashed, changed_blob_keys


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
        "INSERT INTO files(path, size, mtime_ns, sha256, last_seen_release, storage_key) VALUES (?, ?, ?, ?, ?, ?)",
        [(item.path, item.size, item.mtime_ns, item.sha256, release_id, item.storage_key or blob_key(item.sha256)) for item in files],
    )
    connection.commit()


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


def qualification_metadata(connection, root, records, relative):
    record = records.get(relative)
    if record is None:
        return None
    key = 'media-metadata:' + relative
    cached = connection.execute('SELECT value FROM meta WHERE key=?', (key,)).fetchone()
    if cached:
        try:
            value = json.loads(cached['value'])
            text = value['text']
            if value['sha256'] == record.sha256:
                if not isinstance(text, str) or sha256_bytes(text.encode('utf-8')) != record.sha256:
                    raise PublishError(INDEX_UNAVAILABLE)
                return json.loads(text)
        except (ValueError, KeyError, TypeError):
            raise PublishError(INDEX_UNAVAILABLE)
    payload = (root / relative).read_bytes()
    if len(payload) != record.size or sha256_bytes(payload) != record.sha256:
        raise PublishError('qualification source changed after scan')
    text = payload.decode('utf-8')
    parsed = json.loads(text)
    connection.execute('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)',
                       (key, json.dumps({'sha256': record.sha256, 'text': text}, ensure_ascii=False)))
    return parsed


def qualify_media(connection, root, resolved, manifest):
    records = {item.path: item for item in resolved}
    learning = qualification_metadata(connection, root, records, 'knowledge/authority-learning-content-manifest.json')
    legacy = qualification_metadata(connection, root, records, 'knowledge/infographs/manifest.json')
    source = {'sourceRuntime': {'releaseId': manifest['releaseId'], 'manifestSha256': manifest['manifestSha256']},
              'sourceFileCount': manifest['fileCount'], 'files': manifest['files'], 'learning': learning, 'legacy': legacy}
    try:
        return PUBLIC_MEDIA.build_inventory(source, allow_empty=True)['objects']
    except (ValueError, KeyError, TypeError) as error:
        raise PublishError('public media qualification failed: ' + str(error))


class PublicationGuard:
    def __init__(self, args, manifest, base):
        self.args = args
        self.manifest = manifest
        self.base = base
        self.process = None
        self.catalog = None
        self.canonical = False

    def __enter__(self):
        args = self.args
        if args.oss_bucket:
            if not args.lifecycle_host or args.lifecycle_host.startswith('-'):
                raise PublishError('--lifecycle-host is required for coordinated OSS publication')
            command = ['python3', args.lifecycle_script, 'hold', '--state-dir', args.state_dir,
                       '--store-dir', args.lifecycle_store_dir, '--production', '--db-container', args.db_container,
                       '--developer-lease-store', args.developer_lease_store, '--require-developer-leases',
                       '--retain-seconds', str(args.publication_retention_seconds)]
            command = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', args.lifecycle_host,
                       ' '.join(shlex.quote(item) for item in command)]
        else:
            command = ['python3', str(Path(__file__).with_name('storage-lifecycle.py')), 'hold',
                       '--state-dir', args.state_dir, '--store-dir', args.store_dir, '--no-session-refs',
                       '--retain-seconds', str(args.publication_retention_seconds)]
        self.process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE, text=True)
        try:
            self.send({'manifest': self.manifest, 'baseReleaseId': self.base, 'bootstrap': args.bootstrap,
                       'hasPublicMedia': bool(self.args.qualified_media)})
            value = self.receive('held')
        except Exception:
            self.close()
            raise
        self.catalog = value.get('catalog')
        self.canonical = value.get('canonical') is True
        return self

    def send(self, value):
        self.process.stdin.write(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')
        self.process.stdin.flush()

    def receive(self, field):
        line = self.process.stdout.readline()
        if not line:
            detail = self.process.stderr.read().strip()
            self.process.wait(timeout=30)
            raise PublishError('storage coordination failed: ' + detail)
        value = json.loads(line)
        if value.get(field) is not True:
            raise PublishError('invalid storage coordination response')
        return value

    def prepare(self, catalog):
        self.send({'prepared': True, 'catalog': catalog})
        self.receive('prepared')

    def complete(self):
        self.send({'complete': True})
        self.receive('completed')

    def close(self):
        if self.process is not None:
            if not self.process.stdin.closed:
                self.process.stdin.close()
            try:
                self.process.wait(timeout=30)
            except subprocess.TimeoutExpired:
                self.process.terminate()
                self.process.wait(timeout=10)
            self.process.stdout.close()
            self.process.stderr.close()

    def __exit__(self, exc_type, exc, traceback):
        self.close()
        return False


def publish(args: argparse.Namespace) -> dict[str, object]:
    root = Path(args.root).resolve()
    index_path = Path(args.index)
    source_revision = (args.source_revision or git_head(REPO_ROOT)).lower()
    if args.store_dir:
        store: ObjectStore = LocalObjectStore(Path(args.store_dir))
    elif args.oss_bucket:
        store = OssutilObjectStore(args.oss_bucket, args.ossutil)
    else:
        raise PublishError("store required: --store-dir or --oss-bucket")

    if not args.state_dir:
        args.state_dir = '/home/projects/act/data/runtime/blob-views' if args.oss_bucket else str(Path(args.store_dir) / '.storage-state')
    media_store: ObjectStore = (OssutilObjectStore(MEDIA_STORAGE.MEDIA_BUCKET, args.ossutil, args.media_ossutil_arg)
                               if args.oss_bucket else LocalObjectStore(Path(args.media_store_dir or args.store_dir)))

    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_lock = open(str(index_path) + '.lock', 'a+')
    fcntl.flock(index_lock.fileno(), fcntl.LOCK_EX)
    try:
        connection = open_index(index_path, bootstrap=args.bootstrap)
    except Exception:
        index_lock.close()
        raise
    try:
        scanned = scan_runtime(root)
        indexed = {} if args.bootstrap else load_index_rows(connection)
        resolved, hashed, changed_blob_keys = resolve_files(root, scanned, indexed, bootstrap=args.bootstrap)
        manifest = build_manifest(source_revision, resolved)
        receipt = build_receipt(manifest)
        args.qualified_media = qualify_media(connection, root, resolved, manifest)
        previous_releases = {row[0] for row in connection.execute('SELECT DISTINCT last_seen_release FROM files') if row[0]}
        if len(previous_releases) > 1:
            raise PublishError(INDEX_UNAVAILABLE)
        base = next(iter(previous_releases), None)
        uploaded = 0
        uploaded_blobs = 0
        cas_hits = 0
        with PublicationGuard(args, manifest, base) as guard:
            published_media = MEDIA_STORAGE.object_map(guard.catalog)
            next_media = dict(published_media)
            for row in args.qualified_media:
                item = {key: row[key] for key in ['sha256', 'sizeBytes', 'mediaType', 'publicEligible']}
                item['objectKey'] = MEDIA_STORAGE.media_key(row['sha256'], Path(row['path']).suffix.lower())
                previous = next_media.get(item['sha256'])
                if previous is not None and previous != item:
                    raise PublishError('conflicting public media digest')
                next_media[item['sha256']] = item
            unique_blobs = {}
            placed = []
            for record in resolved:
                if record.sha256 is None:
                    raise PublishError(f"missing SHA-256 for {record.path}")
                logical_key = blob_key(record.sha256)
                media = next_media.get(record.sha256)
                if media and media['sizeBytes'] != record.size:
                    raise PublishError('canonical media size mismatch')
                physical_key = media['objectKey'] if media else logical_key
                placed.append(FileRecord(record.path, record.size, record.mtime_ns, record.sha256, physical_key))
                known_media = published_media.get(record.sha256)
                unchanged_placement = (record.storage_key or logical_key) == physical_key
                if (logical_key in changed_blob_keys or not unchanged_placement) and not (known_media and not args.bootstrap):
                    unique_blobs[physical_key] = (record, bool(media))
            for key, (record, public) in unique_blobs.items():
                payload = (root / record.path).read_bytes()
                if len(payload) != record.size or sha256_bytes(payload) != record.sha256:
                    raise PublishError(f"file bytes drifted after hash: {record.path}")
                result = put_payload(media_store if public else store, key, payload)
                if result == "created":
                    uploaded += 1
                    uploaded_blobs += 1
                else:
                    cas_hits += 1
            legacy_available = guard.catalog.get('legacyCopiesAvailable', True) if guard.catalog else True
            if set(next_media) - set(published_media):
                legacy_available = False
            catalog = {'schemaVersion': MEDIA_STORAGE.CATALOG_SCHEMA, 'verified': True,
                       'legacyCopiesAvailable': legacy_available,
                       'objects': sorted(next_media.values(), key=lambda item: item['sha256'])}
            guard.prepare(catalog)
            receipt_bytes = (stable_stringify(receipt) + "\n").encode("utf-8")
            manifest_bytes = (stable_stringify(manifest) + "\n").encode("utf-8")
            for key, payload in ((receipt_key(str(manifest["releaseId"])), receipt_bytes), (manifest_key(str(manifest["releaseId"])), manifest_bytes)):
                result = put_payload(store, key, payload)
                if result == "created":
                    uploaded += 1
                else:
                    cas_hits += 1
            guard.complete()
        resolved = placed
        persist_index(connection, resolved, str(manifest["releaseId"]))
    finally:
        connection.close()
        fcntl.flock(index_lock.fileno(), fcntl.LOCK_UN)
        index_lock.close()

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
        'publicMediaObjects': len(args.qualified_media),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Publish a content-addressed runtime release from local file metadata.")
    parser.add_argument("--root", default=str(DEFAULT_ROOT))
    parser.add_argument("--index", default=str(DEFAULT_INDEX))
    parser.add_argument("--store-dir")
    parser.add_argument("--oss-bucket")
    parser.add_argument("--ossutil", default="ossutil")
    parser.add_argument("--source-revision")
    parser.add_argument("--bootstrap", action="store_true")
    parser.add_argument('--state-dir')
    parser.add_argument('--media-store-dir')
    parser.add_argument('--media-ossutil-arg', action='append', default=[])
    parser.add_argument('--lifecycle-host', default=os.environ.get('ACT_RUNTIME_STORAGE_HOST'))
    parser.add_argument('--lifecycle-script', default='/home/projects/act/scripts/runtime-release/storage-lifecycle.py')
    parser.add_argument('--lifecycle-store-dir', default='/home/projects/act/data/runtime/cas-store')
    parser.add_argument('--db-container', default='act-obe-postgres')
    parser.add_argument('--developer-lease-store', default='/var/lib/act-runtime-developer-gateway/leases.json')
    parser.add_argument('--publication-retention-seconds', type=int, default=86400)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        result = publish(args)
    except (PublishError, MEDIA_STORAGE.MediaStorageError) as error:
        sys.stderr.write(f"{error}\n")
        return error.code
    sys.stdout.write(json.dumps(result, indent=2, sort_keys=True) + "\n")
    sys.stderr.write(f"hashed={result['hashed']}\nuploaded={result['uploaded']}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
