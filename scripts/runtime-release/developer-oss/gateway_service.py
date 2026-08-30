#!/usr/bin/env python3
"""Pin-time lease and Blob GET contract for the ECS developer runtime gateway."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Mapping, Protocol

SHA256 = re.compile(r"^[a-f0-9]{64}$")
RELEASE_ID = re.compile(r"^runtime-[a-z0-9]{55}$")
IDENTITY_KEYS = ("schemaVersion", "releaseId", "manifestSha256", "treeSha256")
MANIFEST_KEYS = (
    "schemaVersion",
    "releaseId",
    "sourceRevision",
    "fileCount",
    "totalBytes",
    "treeSha256",
    "manifestSha256",
    "files",
)
FILE_KEYS = ("path", "objectKey", "sizeBytes", "sha256")
BLOB_PREFIX = "runtime/blobs/sha256/"
TRANSPORT_TTL_SECONDS = 900
DENIED_BODY = b'{"error":"denied"}'
NOT_FOUND_BODY = b'{"error":"not found"}'
UNAVAILABLE_BODY = b'{"error":"unavailable"}'
QUERY_TOKEN_KEYS = frozenset({"token", "access_token", "bearer", "authorization"})
FORBIDDEN_CREDENTIAL_MARKERS = (
    "accesskey",
    "ssh-rsa",
    "ssh-ed25519",
    "begin openssh",
    "publisher",
    "assume-role",
)


class GatewayError(Exception):
    def __init__(self, status: int, code: str, body: bytes):
        super().__init__(code)
        self.status = status
        self.code = code
        self.body = body


class HostView(Protocol):
    def active_identity(self) -> dict[str, str]:
        ...

    def manifest_bytes(self, identity: Mapping[str, str]) -> bytes | None:
        ...

    def receipt_bytes(self, identity: Mapping[str, str]) -> bytes | None:
        ...

    def blob_bytes(self, digest: str) -> bytes | None:
        ...


@dataclass
class Transport:
    token: str
    expires_at: float


@dataclass
class Lease:
    lease_id: str
    checkout_id: str
    identity: dict[str, str]
    allowlist: frozenset[str]
    blob_sizes: dict[str, int]
    token_fingerprint: str
    live: bool = True
    transport: Transport | None = None
    created_at: float = 0.0
    heartbeat_at: float = 0.0
    probed_blobs: set[str] = field(default_factory=set)


def canonical(value: Any) -> bytes:
    return json.dumps(value, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")


def digest_hex(value: Any) -> str:
    return hashlib.sha256(canonical(value) if not isinstance(value, bytes) else value).hexdigest()


def token_fingerprint(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def compare_secret(left: str, right: str) -> bool:
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))


def require_identity(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        raise GatewayError(400, "denied", DENIED_BODY)
    extra = set(value) - set(IDENTITY_KEYS)
    missing = set(IDENTITY_KEYS) - set(value)
    if extra or missing:
        raise GatewayError(400, "denied", DENIED_BODY)
    schema = value["schemaVersion"]
    release_id = value["releaseId"]
    manifest_sha = value["manifestSha256"]
    tree_sha = value["treeSha256"]
    if schema != "act-runtime-release.v2":
        raise GatewayError(400, "denied", DENIED_BODY)
    if not isinstance(release_id, str) or not RELEASE_ID.fullmatch(release_id):
        raise GatewayError(400, "denied", DENIED_BODY)
    if not isinstance(manifest_sha, str) or not SHA256.fullmatch(manifest_sha):
        raise GatewayError(400, "denied", DENIED_BODY)
    if not isinstance(tree_sha, str) or not SHA256.fullmatch(tree_sha):
        raise GatewayError(400, "denied", DENIED_BODY)
    return {
        "schemaVersion": schema,
        "releaseId": release_id,
        "manifestSha256": manifest_sha,
        "treeSha256": tree_sha,
    }


def identities_match(left: Mapping[str, str], right: Mapping[str, str]) -> bool:
    return all(left.get(key) == right.get(key) for key in IDENTITY_KEYS)


def derive_release_id(source_revision: str, tree_sha256: str) -> str:
    return "runtime-" + digest_hex({"sourceRevision": source_revision, "treeSha256": tree_sha256})[:55]


def validate_v2_manifest(payload: bytes, requested: Mapping[str, str]) -> tuple[frozenset[str], dict[str, int]]:
    try:
        document = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise GatewayError(409, "denied", DENIED_BODY) from error
    if not isinstance(document, dict) or set(document) != set(MANIFEST_KEYS):
        raise GatewayError(409, "denied", DENIED_BODY)
    if document.get("schemaVersion") != "act-runtime-release.v2":
        raise GatewayError(409, "denied", DENIED_BODY)
    if document.get("releaseId") != requested["releaseId"]:
        raise GatewayError(409, "denied", DENIED_BODY)
    files = document.get("files")
    if not isinstance(files, list) or not files:
        raise GatewayError(409, "denied", DENIED_BODY)
    sizes: dict[str, int] = {}
    tree_entries: list[dict[str, Any]] = []
    previous_path = ""
    for item in files:
        if not isinstance(item, dict):
            raise GatewayError(409, "denied", DENIED_BODY)
        extra = set(item) - set(FILE_KEYS) - {"source"}
        missing = set(FILE_KEYS) - set(item)
        if extra or missing:
            raise GatewayError(409, "denied", DENIED_BODY)
        path = item.get("path")
        digest = item.get("sha256")
        size = item.get("sizeBytes")
        object_key = item.get("objectKey")
        if not isinstance(path, str) or not path or path.startswith("/") or "\\" in path:
            raise GatewayError(409, "denied", DENIED_BODY)
        if previous_path and path <= previous_path:
            raise GatewayError(409, "denied", DENIED_BODY)
        previous_path = path
        if not isinstance(digest, str) or not SHA256.fullmatch(digest):
            raise GatewayError(409, "denied", DENIED_BODY)
        if not isinstance(size, int) or size < 0:
            raise GatewayError(409, "denied", DENIED_BODY)
        if object_key != BLOB_PREFIX + digest:
            raise GatewayError(409, "denied", DENIED_BODY)
        if digest in sizes and sizes[digest] != size:
            raise GatewayError(409, "denied", DENIED_BODY)
        sizes[digest] = size
        tree_entries.append({"path": path, "sizeBytes": size, "sha256": digest})
    if document.get("fileCount") != len(files):
        raise GatewayError(409, "denied", DENIED_BODY)
    if document.get("totalBytes") != sum(item["sizeBytes"] for item in tree_entries):
        raise GatewayError(409, "denied", DENIED_BODY)
    tree = digest_hex(tree_entries)
    if tree != document.get("treeSha256") or tree != requested["treeSha256"]:
        raise GatewayError(409, "denied", DENIED_BODY)
    source_revision = document.get("sourceRevision")
    if not isinstance(source_revision, str) or derive_release_id(source_revision, tree) != requested["releaseId"]:
        raise GatewayError(409, "denied", DENIED_BODY)
    without_digest = {key: value for key, value in document.items() if key != "manifestSha256"}
    semantic = digest_hex(without_digest)
    if semantic != document.get("manifestSha256") or semantic != requested["manifestSha256"]:
        raise GatewayError(409, "denied", DENIED_BODY)
    return frozenset(sizes), sizes


def parse_range(header: str | None, size: int) -> tuple[int, int] | None:
    if not header:
        return None
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", header.strip())
    if not match:
        raise GatewayError(400, "denied", DENIED_BODY)
    start_raw, end_raw = match.group(1), match.group(2)
    if start_raw == "" and end_raw == "":
        raise GatewayError(400, "denied", DENIED_BODY)
    if start_raw == "":
        suffix = int(end_raw)
        if suffix <= 0:
            raise GatewayError(400, "denied", DENIED_BODY)
        start = max(size - suffix, 0)
        end = size - 1
    else:
        start = int(start_raw)
        end = int(end_raw) if end_raw else size - 1
    if start < 0 or end < start or start >= size:
        raise GatewayError(416, "denied", DENIED_BODY)
    return start, min(end, size - 1)


class GatewayService:
    def __init__(
        self,
        token: str,
        host: HostView,
        *,
        time_fn: Callable[[], float] | None = None,
        transport_ttl_seconds: int = TRANSPORT_TTL_SECONDS,
        token_fn: Callable[[], str] | None = None,
        lease_store: Path | None = None,
    ) -> None:
        if not isinstance(token, str) or len(token) < 32:
            raise ValueError("gateway token is invalid")
        self._token = token
        self._token_fn = token_fn
        self._host = host
        self._time = time_fn or time.time
        self._transport_ttl = transport_ttl_seconds
        self._lease_store = lease_store
        self._lock = threading.Lock()
        self._leases: dict[str, Lease] = {}
        self._load_leases()

    def current_token(self) -> str:
        if self._token_fn is not None:
            return self._token_fn()
        return self._token

    def rotate_token(self, token: str) -> None:
        if not isinstance(token, str) or len(token) < 32:
            raise ValueError("gateway token is invalid")
        with self._lock:
            self._token = token
            for lease in self._leases.values():
                lease.live = False
                lease.transport = None
            self._persist_leases()

    def authenticate(self, authorization: str | None, query: Mapping[str, str] | None = None) -> str:
        if query:
            lowered = {str(key).lower() for key in query}
            if QUERY_TOKEN_KEYS & lowered:
                raise GatewayError(401, "denied", DENIED_BODY)
            for value in query.values():
                if isinstance(value, str) and value and compare_secret(value, self.current_token()):
                    raise GatewayError(401, "denied", DENIED_BODY)
        if not authorization or not authorization.startswith("Bearer "):
            raise GatewayError(401, "denied", DENIED_BODY)
        presented = authorization[7:]
        if not presented or not compare_secret(presented, self.current_token()):
            raise GatewayError(401, "denied", DENIED_BODY)
        lowered_auth = authorization.lower()
        if any(marker in lowered_auth for marker in FORBIDDEN_CREDENTIAL_MARKERS):
            raise GatewayError(401, "denied", DENIED_BODY)
        return presented

    def reject_foreign_credentials(self, headers: Mapping[str, str] | None) -> None:
        if not headers:
            return
        blob = " ".join("%s:%s" % (key, headers[key]) for key in headers).lower()
        if any(marker in blob for marker in FORBIDDEN_CREDENTIAL_MARKERS):
            raise GatewayError(401, "denied", DENIED_BODY)

    def issue_lease(self, identity: Any, checkout_id: str) -> dict[str, Any]:
        requested = require_identity(identity)
        if not isinstance(checkout_id, str) or not checkout_id or len(checkout_id) > 128:
            raise GatewayError(400, "denied", DENIED_BODY)
        active = require_identity(self._host.active_identity())
        if not identities_match(requested, active):
            raise GatewayError(409, "denied", DENIED_BODY)
        manifest = self._host.manifest_bytes(requested)
        if manifest is None:
            raise GatewayError(409, "denied", DENIED_BODY)
        allowlist, blob_sizes = validate_v2_manifest(manifest, requested)
        now = self._time()
        with self._lock:
            still_active = require_identity(self._host.active_identity())
            if not identities_match(requested, still_active):
                raise GatewayError(409, "denied", DENIED_BODY)
            lease = Lease(
                lease_id=secrets.token_urlsafe(24),
                checkout_id=checkout_id,
                identity=dict(requested),
                allowlist=allowlist,
                blob_sizes=blob_sizes,
                token_fingerprint=token_fingerprint(self.current_token()),
                live=True,
                created_at=now,
                heartbeat_at=now,
            )
            lease.transport = self._mint_transport(now)
            self._leases[lease.lease_id] = lease
            self._persist_leases()
            return self._lease_payload(lease)

    def renew_transport(self, lease_id: str) -> dict[str, Any]:
        with self._lock:
            lease = self._live_lease(lease_id)
            now = self._time()
            if lease.transport is not None and now < lease.transport.expires_at:
                lease.heartbeat_at = now
                self._persist_leases()
                return self._lease_payload(lease)
            lease.transport = self._mint_transport(now)
            lease.heartbeat_at = now
            self._persist_leases()
            return self._lease_payload(lease)

    def heartbeat(self, lease_id: str) -> None:
        with self._lock:
            lease = self._live_lease(lease_id)
            lease.heartbeat_at = self._time()
            self._persist_leases()

    def stop_checkout(self, lease_id: str) -> None:
        with self._lock:
            lease = self._leases.get(lease_id)
            if lease is None:
                raise GatewayError(404, "not_found", NOT_FOUND_BODY)
            lease.live = False
            lease.transport = None
            self._persist_leases()

    def get_manifest(self, lease_id: str, transport_token: str | None) -> bytes:
        with self._lock:
            lease = self._authorized_lease(lease_id, transport_token)
            identity = dict(lease.identity)
        payload = self._host.manifest_bytes(identity)
        if payload is None:
            raise GatewayError(503, "unavailable", UNAVAILABLE_BODY)
        return payload

    def get_receipt(self, lease_id: str, transport_token: str | None) -> bytes:
        with self._lock:
            lease = self._authorized_lease(lease_id, transport_token)
            identity = dict(lease.identity)
        payload = self._host.receipt_bytes(identity)
        if payload is None:
            raise GatewayError(503, "unavailable", UNAVAILABLE_BODY)
        return payload

    def get_blob(
        self,
        lease_id: str,
        transport_token: str | None,
        digest: str,
        range_header: str | None = None,
    ) -> tuple[bytes, int, dict[str, str]]:
        if not isinstance(digest, str) or not SHA256.fullmatch(digest):
            raise GatewayError(404, "not_found", NOT_FOUND_BODY)
        with self._lock:
            lease = self._authorized_lease(lease_id, transport_token)
            if digest not in lease.allowlist:
                raise GatewayError(404, "not_found", NOT_FOUND_BODY)
        data = self._host.blob_bytes(digest)
        if data is None:
            raise GatewayError(503, "unavailable", UNAVAILABLE_BODY)
        if hashlib.sha256(data).hexdigest() != digest:
            raise GatewayError(503, "unavailable", UNAVAILABLE_BODY)
        with self._lock:
            stored = self._leases.get(lease_id)
            if stored is not None and stored.live:
                stored.heartbeat_at = self._time()
                stored.probed_blobs.add(digest)
                self._persist_leases()
        span = parse_range(range_header, len(data))
        if span is None:
            return data, 200, {"Content-Type": "application/octet-stream", "Accept-Ranges": "bytes"}
        start, end = span
        headers = {
            "Content-Type": "application/octet-stream",
            "Accept-Ranges": "bytes",
            "Content-Range": "bytes %d-%d/%d" % (start, end, len(data)),
        }
        return data[start:end + 1], 206, headers

    def _mint_transport(self, now: float) -> Transport:
        return Transport(token=secrets.token_urlsafe(32), expires_at=now + self._transport_ttl)

    def _lease_payload(self, lease: Lease) -> dict[str, Any]:
        assert lease.transport is not None
        return {
            "leaseId": lease.lease_id,
            "releaseId": lease.identity["releaseId"],
            "manifestSha256": lease.identity["manifestSha256"],
            "treeSha256": lease.identity["treeSha256"],
            "allowlistSha256": hashlib.sha256("\n".join(sorted(lease.allowlist)).encode("utf-8")).hexdigest(),
            "blobSizes": dict(lease.blob_sizes),
            "transport": {
                "token": lease.transport.token,
                "expiresAt": int(lease.transport.expires_at),
            },
        }

    def _live_lease(self, lease_id: str) -> Lease:
        lease = self._leases.get(lease_id)
        if lease is None or not lease.live:
            raise GatewayError(401, "denied", DENIED_BODY)
        if lease.token_fingerprint != token_fingerprint(self.current_token()):
            raise GatewayError(401, "denied", DENIED_BODY)
        return lease

    def _authorized_lease(self, lease_id: str, transport_token: str | None) -> Lease:
        lease = self._live_lease(lease_id)
        if lease.transport is None or not transport_token:
            raise GatewayError(401, "denied", DENIED_BODY)
        if not compare_secret(transport_token, lease.transport.token):
            raise GatewayError(401, "denied", DENIED_BODY)
        if self._time() >= lease.transport.expires_at:
            raise GatewayError(401, "denied", DENIED_BODY)
        return lease

    def _lease_record(self, lease: Lease) -> dict[str, Any]:
        transport = None
        if lease.transport is not None:
            transport = {"token": lease.transport.token, "expiresAt": lease.transport.expires_at}
        return {
            "leaseId": lease.lease_id,
            "checkoutId": lease.checkout_id,
            "identity": dict(lease.identity),
            "allowlist": sorted(lease.allowlist),
            "blobSizes": dict(lease.blob_sizes),
            "tokenFingerprint": lease.token_fingerprint,
            "live": lease.live,
            "transport": transport,
            "createdAt": lease.created_at,
            "heartbeatAt": lease.heartbeat_at,
        }

    def _lease_from_record(self, raw: Mapping[str, Any]) -> Lease | None:
        identity = raw.get("identity")
        allowlist = raw.get("allowlist")
        blob_sizes = raw.get("blobSizes")
        lease_id = raw.get("leaseId")
        checkout = raw.get("checkoutId")
        fingerprint = raw.get("tokenFingerprint")
        if not isinstance(identity, dict) or not isinstance(allowlist, list):
            return None
        if not isinstance(blob_sizes, dict) or not isinstance(lease_id, str) or not isinstance(checkout, str):
            return None
        if not isinstance(fingerprint, str):
            return None
        try:
            identity = require_identity(identity)
        except GatewayError:
            return None
        sizes: dict[str, int] = {}
        for digest, size in blob_sizes.items():
            if not isinstance(digest, str) or not SHA256.fullmatch(digest) or not isinstance(size, int) or size < 0:
                return None
            sizes[digest] = size
        digests = [item for item in allowlist if isinstance(item, str) and SHA256.fullmatch(item)]
        lease = Lease(
            lease_id=lease_id,
            checkout_id=checkout,
            identity=identity,
            allowlist=frozenset(digests),
            blob_sizes=sizes,
            token_fingerprint=fingerprint,
            live=bool(raw.get("live")),
            created_at=float(raw.get("createdAt") or 0),
            heartbeat_at=float(raw.get("heartbeatAt") or 0),
        )
        transport = raw.get("transport")
        if isinstance(transport, dict) and isinstance(transport.get("token"), str):
            lease.transport = Transport(token=transport["token"], expires_at=float(transport.get("expiresAt") or 0))
        return lease

    def _load_leases(self) -> None:
        if self._lease_store is None or not self._lease_store.is_file() or self._lease_store.is_symlink():
            return
        try:
            payload = json.loads(self._lease_store.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ValueError("lease store is invalid") from error
        records = payload.get("leases") if isinstance(payload, dict) else None
        if not isinstance(records, list):
            raise ValueError("lease store is invalid")
        current = token_fingerprint(self.current_token())
        restored: dict[str, Lease] = {}
        for item in records:
            if not isinstance(item, dict):
                continue
            lease = self._lease_from_record(item)
            if lease is None or not lease.live or lease.token_fingerprint != current:
                continue
            restored[lease.lease_id] = lease
        self._leases = restored

    def _persist_leases(self) -> None:
        if self._lease_store is None:
            return
        self._lease_store.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self._lease_store.parent, 0o700)
        payload = {"schemaVersion": "act-runtime-dev-gateway-leases.v1", "leases": [self._lease_record(lease) for lease in self._leases.values()]}
        encoded = (json.dumps(payload, sort_keys=True) + "\n").encode("utf-8")
        temporary = self._lease_store.with_name(".%s.%s.tmp" % (self._lease_store.name, os.getpid()))
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        try:
            os.write(descriptor, encoded)
            os.fchmod(descriptor, 0o600)
        finally:
            os.close(descriptor)
        os.replace(temporary, self._lease_store)
        os.chmod(self._lease_store, 0o600)
