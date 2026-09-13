#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import gzip
import http.client
import json
import os
import sys
import tempfile
import threading
import types
import unittest
from concurrent.futures import ThreadPoolExecutor
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
DEV = ROOT / "scripts/runtime-release/developer-oss"
sys.path.insert(0, str(DEV))

from gateway_host import DiskHost, MemoryHost  # noqa: E402
from gateway_http import RateLimiter, make_handler  # noqa: E402
from gateway_service import GatewayError, GatewayService  # noqa: E402
from gateway_token import install_token_file, read_token_file  # noqa: E402

TOKEN = "a" * 32
OTHER = "b" * 32


def checkout_session(lease_id, transport, blob_sizes=None, gateway_url="http://127.0.0.1:1"):
    payload = {
        "schemaVersion": "act-runtime-dev-gateway-session.v1",
        "gatewayUrl": gateway_url,
        "token": TOKEN,
        "leaseId": lease_id,
        "transport": transport,
    }
    if blob_sizes is not None:
        payload["blobSizes"] = blob_sizes
    return payload


def canonical(value):
    return json.dumps(value, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def blob(payload: bytes) -> tuple[str, bytes]:
    return hashlib.sha256(payload).hexdigest(), payload


def make_release(label: str, bodies: list[bytes]):
    files = []
    blobs = {}
    for index, body in enumerate(bodies):
        sha, data = blob(body)
        blobs[sha] = data
        files.append({
            "path": "lessons/%s/%s.json" % (label, index),
            "objectKey": "runtime/blobs/sha256/" + sha,
            "sizeBytes": len(data),
            "sha256": sha,
        })
    tree = digest([{"path": item["path"], "sizeBytes": item["sizeBytes"], "sha256": item["sha256"]} for item in files])
    source_revision = hashlib.sha1(label.encode("utf-8")).hexdigest()
    release_id = "runtime-" + digest({"sourceRevision": source_revision, "treeSha256": tree})[:55]
    manifest = {
        "schemaVersion": "act-runtime-release.v2",
        "releaseId": release_id,
        "sourceRevision": source_revision,
        "fileCount": len(files),
        "totalBytes": sum(item["sizeBytes"] for item in files),
        "treeSha256": tree,
        "files": files,
    }
    manifest["manifestSha256"] = digest(manifest)
    wire = canonical(manifest) + b"\n"
    receipt = {
        "schemaVersion": "act-runtime-release-receipt.v2",
        "releaseId": release_id,
        "manifestVersion": "act-runtime-release.v2",
        "manifestObjectKey": "runtime/blob-releases/%s/manifest.json" % release_id,
        "manifestSha256": manifest["manifestSha256"],
        "manifestWireSha256": hashlib.sha256(wire).hexdigest(),
        "manifestWireSizeBytes": len(wire),
        "treeSha256": tree,
        "fileCount": len(files),
        "totalBytes": manifest["totalBytes"],
        "blobs": [{"objectKey": item["objectKey"], "sizeBytes": item["sizeBytes"], "sha256": item["sha256"]} for item in files],
    }
    receipt["receiptSha256"] = digest(receipt)
    identity = {
        "schemaVersion": "act-runtime-release.v2",
        "releaseId": release_id,
        "manifestSha256": manifest["manifestSha256"],
        "treeSha256": tree,
    }
    return identity, wire, canonical(receipt) + b"\n", blobs, manifest


def bind_host(shared: bytes, a_only: bytes, b_only: bytes, extra: bytes):
    identity_a, manifest_a, receipt_a, blobs_a, parsed_a = make_release("a", [shared, a_only])
    identity_b, manifest_b, receipt_b, blobs_b, _parsed_b = make_release("b", [shared, b_only])
    extra_sha, extra_data = blob(extra)
    host = MemoryHost()
    host.set_active(identity_a)
    host.put_manifest(identity_a, manifest_a)
    host.put_receipt(identity_a, receipt_a)
    host.put_manifest(identity_b, manifest_b)
    host.put_receipt(identity_b, receipt_b)
    for digest_hex, payload in {**blobs_a, **blobs_b, extra_sha: extra_data}.items():
        host.put_blob(digest_hex, payload)
    return (
        host,
        identity_a,
        identity_b,
        parsed_a,
        hashlib.sha256(a_only).hexdigest(),
        hashlib.sha256(b_only).hexdigest(),
        hashlib.sha256(shared).hexdigest(),
        extra_sha,
    )


class Clock:
    def __init__(self) -> None:
        self.now = 1_000.0

    def __call__(self) -> float:
        return self.now


class DeveloperRuntimeGatewayTests(unittest.TestCase):
    def test_manifest_gzip_preserves_bytes_and_uncompressed_clients(self):
        host, identity, _, _, _, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host)
        lease = service.issue_lease(identity, "manifest-compression")
        server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(service, RateLimiter()))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            for encoding in ("gzip", "identity", "gzip;q=0"):
                client = http.client.HTTPConnection(*server.server_address)
                try:
                    client.request("GET", "/v1/leases/%s/manifest" % lease["leaseId"], headers={
                        "Authorization": "Bearer " + TOKEN,
                        "X-Act-Runtime-Transport": lease["transport"]["token"],
                        "Accept-Encoding": encoding,
                    })
                    response = client.getresponse()
                    wire = response.read()
                    self.assertEqual(response.status, 200)
                    self.assertEqual(int(response.getheader("Content-Length")), len(wire))
                    if encoding == "gzip":
                        self.assertEqual(response.getheader("Content-Encoding"), "gzip")
                        self.assertEqual(gzip.decompress(wire), host.manifest_bytes(identity))
                    else:
                        self.assertIsNone(response.getheader("Content-Encoding"))
                        self.assertEqual(wire, host.manifest_bytes(identity))
                finally:
                    client.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_fuse_attributes_are_stable_across_time_without_fetching_blobs(self):
        import gateway_fuse

        fuse = types.ModuleType("fuse")
        fuse.FUSE = mock.Mock()
        fuse.FuseOSError = OSError
        fuse.Operations = object
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            argv = ["gateway_fuse", "--mount", str(root / "mount"),
                    "--session", str(root / "session"), "--cache-dir", str(root / "cache")]
            with mock.patch.dict(sys.modules, {"fuse": fuse}), mock.patch.object(sys, "argv", argv):
                self.assertEqual(gateway_fuse.main(), 0)
            adapter = fuse.FUSE.call_args.args[0]
            with mock.patch.object(gateway_fuse, "declared_blob_size", return_value=128), \
                    mock.patch.object(gateway_fuse, "ensure_cached_blob") as fetch:
                for path in ("/", "/" + "a" * 64):
                    with mock.patch.object(gateway_fuse.time, "time", return_value=1000):
                        before = adapter.getattr(path)
                    with mock.patch.object(gateway_fuse.time, "time", return_value=1089):
                        after = adapter.getattr(path)
                    self.assertEqual(before, after)
                self.assertEqual(after["st_size"], 128)
                fetch.assert_not_called()
            with mock.patch.object(gateway_fuse, "declared_blob_size", return_value=None):
                with self.assertRaises(OSError):
                    adapter.getattr("/" + "b" * 64)

    def test_matching_active_identity_issues_lease_and_reads_allowlisted_blob(self):
        host, identity_a, _, _, a_only, _, shared, extra = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host)
        service.authenticate("Bearer " + TOKEN)
        issued = service.issue_lease(identity_a, "checkout-a")
        body, status, _ = service.get_blob(issued["leaseId"], issued["transport"]["token"], a_only)
        self.assertEqual(status, 200)
        self.assertEqual(body, b"a-only")
        ranged, partial, headers = service.get_blob(
            issued["leaseId"], issued["transport"]["token"], shared, "bytes=0-3",
        )
        self.assertEqual(partial, 206)
        self.assertEqual(ranged, b"shar")
        self.assertIn("bytes 0-3/", headers["Content-Range"])
        before = list(host.blob_reads)
        with self.assertRaises(GatewayError) as denied:
            service.get_blob(issued["leaseId"], issued["transport"]["token"], extra)
        self.assertEqual(denied.exception.status, 404)
        self.assertEqual(denied.exception.body, b'{"error":"not found"}')
        self.assertEqual(host.blob_reads, before)

    def test_missing_query_and_non_active_identities_fail_closed(self):
        host, identity_a, identity_b, _, a_only, _, _, extra = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host)
        with self.assertRaises(GatewayError) as missing:
            service.authenticate(None)
        self.assertEqual(missing.exception.status, 401)
        with self.assertRaises(GatewayError):
            service.authenticate("Bearer " + TOKEN, {"token": TOKEN})
        with self.assertRaises(GatewayError):
            service.authenticate("Bearer " + OTHER)
        with self.assertRaises(GatewayError) as query:
            service.authenticate("Bearer " + TOKEN, {"access_token": "x"})
        self.assertEqual(query.exception.status, 401)
        with self.assertRaises(GatewayError):
            service.issue_lease(identity_b, "checkout-b")
        issued = service.issue_lease(identity_a, "checkout-a")
        drifted = dict(identity_a)
        drifted["treeSha256"] = "f" * 64
        host.set_active(drifted)
        with self.assertRaises(GatewayError) as drifted_issue:
            service.issue_lease(drifted, "checkout-drift")
        self.assertEqual(drifted_issue.exception.status, 409)
        with self.assertRaises(GatewayError):
            service.get_blob(issued["leaseId"], None, a_only)

    def test_on_demand_blob_cache_records_one_gateway_body_then_hit(self):
        os.environ["ACT_RUNTIME_DEV_ALLOW_HTTP"] = "1"
        host, identity_a, _, _, a_only, _, _, extra = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host)
        issued = service.issue_lease(identity_a, "fuse-a")
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(service, RateLimiter(limit=1000)))
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            from common import DeveloperRuntimeError
            from gateway_fuse import ensure_cached_blob
            port = httpd.server_address[1]
            with tempfile.TemporaryDirectory() as raw:
                session_path = Path(raw) / "gateway-session.json"
                cache_dir = Path(raw) / "cache"
                session_path.write_text(json.dumps(checkout_session(
                    issued["leaseId"],
                    issued["transport"]["token"],
                    gateway_url="http://127.0.0.1:%d" % port,
                )), encoding="utf-8")
                first = ensure_cached_blob(session_path, cache_dir, a_only)
                second = ensure_cached_blob(session_path, cache_dir, a_only)
                self.assertEqual(first.read_bytes(), b"a-only")
                self.assertEqual(second, first)
                self.assertEqual(host.blob_reads.count(a_only), 1)
                operations = [
                    json.loads(line)
                    for line in (Path(raw) / "operations.jsonl").read_text(encoding="utf-8").splitlines()
                    if line.strip()
                ]
                self.assertEqual([row["opClass"] for row in operations], ["gateway-body-transfer", "cache-hit"])
                dumped = json.dumps(operations)
                self.assertNotIn(TOKEN, dumped)
                before = list(host.blob_reads)
                with self.assertRaises(DeveloperRuntimeError):
                    ensure_cached_blob(session_path, cache_dir, extra)
                self.assertEqual(host.blob_reads, before)
        finally:
            httpd.shutdown()
            httpd.server_close()
            os.environ.pop("ACT_RUNTIME_DEV_ALLOW_HTTP", None)

    def test_concurrent_cache_writes_reuse_one_blob_fetch(self):
        os.environ["ACT_RUNTIME_DEV_ALLOW_HTTP"] = "1"
        host, identity_a, _, _, a_only, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host)
        issued = service.issue_lease(identity_a, "fuse-concurrent")
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(service, RateLimiter(limit=1000)))
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            from gateway_fuse import ensure_cached_blob
            port = httpd.server_address[1]
            with tempfile.TemporaryDirectory() as raw:
                session_path = Path(raw) / "gateway-session.json"
                cache_dir = Path(raw) / "cache"
                session_path.write_text(json.dumps(checkout_session(
                    issued["leaseId"],
                    issued["transport"]["token"],
                    gateway_url="http://127.0.0.1:%d" % port,
                )), encoding="utf-8")
                with ThreadPoolExecutor(max_workers=8) as pool:
                    paths = list(pool.map(lambda _: ensure_cached_blob(session_path, cache_dir, a_only), range(8)))
                self.assertEqual({path.read_bytes() for path in paths}, {b"a-only"})
                self.assertEqual(host.blob_reads.count(a_only), 1)
        finally:
            httpd.shutdown()
            httpd.server_close()
            os.environ.pop("ACT_RUNTIME_DEV_ALLOW_HTTP", None)

    def test_cache_quota_evicts_oldest_unrelated_blob(self):
        from gateway_fuse import cached_blob_path, enforce_object_cache_quota, write_cached_bytes
        with tempfile.TemporaryDirectory() as raw:
            cache_dir = Path(raw) / "cache"
            first = hashlib.sha256(b"old-blob").hexdigest()
            incoming = hashlib.sha256(b"new-blob").hexdigest()
            write_cached_bytes(cached_blob_path(cache_dir, first), b"old-blob")
            os.utime(cached_blob_path(cache_dir, first), (1, 1))
            enforce_object_cache_quota(cache_dir, len(b"new-blob"), {incoming}, limit_bytes=10)
            self.assertFalse(cached_blob_path(cache_dir, first).exists())

    def test_getattr_uses_declared_size_without_blob_fetch(self):
        host, identity_a, _, _, a_only, _, _, extra = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host)
        issued = service.issue_lease(identity_a, "stat-a")
        from gateway_fuse import declared_blob_size
        with tempfile.TemporaryDirectory() as raw:
            session_path = Path(raw) / "gateway-session.json"
            session_path.write_text(json.dumps(checkout_session(
                issued["leaseId"],
                issued["transport"]["token"],
                blob_sizes=issued["blobSizes"],
            )), encoding="utf-8")
            self.assertEqual(declared_blob_size(session_path, a_only), 6)
            self.assertIsNone(declared_blob_size(session_path, extra))
            self.assertEqual(host.blob_reads, [])

    def test_corrupt_cache_is_quarantined_and_refetched(self):
        os.environ["ACT_RUNTIME_DEV_ALLOW_HTTP"] = "1"
        host, identity_a, _, _, a_only, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host)
        issued = service.issue_lease(identity_a, "corrupt-a")
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(service, RateLimiter(limit=1000)))
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            from gateway_fuse import cached_blob_path, ensure_cached_blob
            port = httpd.server_address[1]
            with tempfile.TemporaryDirectory() as raw:
                session_path = Path(raw) / "gateway-session.json"
                cache_dir = Path(raw) / "cache"
                session_path.write_text(json.dumps(checkout_session(
                    issued["leaseId"],
                    issued["transport"]["token"],
                    blob_sizes=issued["blobSizes"],
                    gateway_url="http://127.0.0.1:%d" % port,
                )), encoding="utf-8")
                cached = cached_blob_path(cache_dir, a_only)
                cached.parent.mkdir(parents=True)
                cached.write_bytes(b"bad-bytes")
                restored = ensure_cached_blob(session_path, cache_dir, a_only)
                self.assertEqual(restored.read_bytes(), b"a-only")
                self.assertEqual(host.blob_reads.count(a_only), 1)
                self.assertTrue(cached.with_name("%s.quarantine" % cached.name).exists())
                cached.write_bytes(b"tampered-after-verify")
                restored_again = ensure_cached_blob(session_path, cache_dir, a_only)
                self.assertEqual(restored_again.read_bytes(), b"a-only")
                self.assertEqual(host.blob_reads.count(a_only), 2)
        finally:
            httpd.shutdown()
            httpd.server_close()
            os.environ.pop("ACT_RUNTIME_DEV_ALLOW_HTTP", None)

    def test_fuse_client_renews_expired_transport_and_persists_token(self):
        os.environ["ACT_RUNTIME_DEV_ALLOW_HTTP"] = "1"
        clock = Clock()
        host, identity_a, identity_b, _, a_only, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host, time_fn=clock, transport_ttl_seconds=10)
        issued = service.issue_lease(identity_a, "renew-a")
        host.set_active(identity_b)
        clock.now += 11
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(service, RateLimiter(limit=1000)))
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            from gateway_fuse import ensure_cached_blob
            port = httpd.server_address[1]
            with tempfile.TemporaryDirectory() as raw:
                session_path = Path(raw) / "gateway-session.json"
                cache_dir = Path(raw) / "cache"
                original = issued["transport"]["token"]
                session_path.write_text(json.dumps(checkout_session(
                    issued["leaseId"],
                    original,
                    blob_sizes=issued["blobSizes"],
                    gateway_url="http://127.0.0.1:%d" % port,
                )), encoding="utf-8")
                cached = ensure_cached_blob(session_path, cache_dir, a_only)
                self.assertEqual(cached.read_bytes(), b"a-only")
                session = json.loads(session_path.read_text(encoding="utf-8"))
                self.assertNotEqual(session["transport"], original)
                self.assertEqual(host.blob_reads.count(a_only), 1)
        finally:
            httpd.shutdown()
            httpd.server_close()
            os.environ.pop("ACT_RUNTIME_DEV_ALLOW_HTTP", None)

    def test_tampered_manifest_files_are_not_leased(self):
        host, identity_a, _, parsed_a, _, _, _, extra = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        tampered = dict(parsed_a)
        tampered["files"] = list(parsed_a["files"]) + [{
            "path": "lessons/a/injected.json",
            "objectKey": "runtime/blobs/sha256/" + extra,
            "sizeBytes": 5,
            "sha256": extra,
        }]
        host.put_manifest(identity_a, canonical(tampered) + b"\n")
        service = GatewayService(TOKEN, host)
        with self.assertRaises(GatewayError) as denied:
            service.issue_lease(identity_a, "tamper-a")
        self.assertEqual(denied.exception.status, 409)

    def test_issue_lease_refuses_if_active_switches_during_validation(self):
        host, identity_a, identity_b, _, _, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")

        class FlipHost:
            def __init__(self) -> None:
                self.n = 0

            def active_identity(self):
                self.n += 1
                return identity_a if self.n == 1 else identity_b

            def manifest_bytes(self, identity):
                return host.manifest_bytes(identity)

            def receipt_bytes(self, identity):
                return host.receipt_bytes(identity)

            def blob_bytes(self, digest):
                return host.blob_bytes(digest)

        service = GatewayService(TOKEN, FlipHost())
        with self.assertRaises(GatewayError) as denied:
            service.issue_lease(identity_a, "race-active")
        self.assertEqual(denied.exception.status, 409)

    def test_ssh_or_oss_headers_are_not_credentials(self):
        host, identity_a, _, _, a_only, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host)
        service.authenticate("Bearer " + TOKEN)
        with self.assertRaises(GatewayError):
            service.reject_foreign_credentials({"X-SSH-Key": "ssh-ed25519 AAAA", "X-AccessKeyId": "LTAIexample"})
        issued = service.issue_lease(identity_a, "checkout-a")
        body, _, _ = service.get_blob(issued["leaseId"], issued["transport"]["token"], a_only)
        self.assertEqual(body, b"a-only")

    def test_after_activation_existing_lease_reads_a_only_blob(self):
        host, identity_a, identity_b, _, a_only, b_only, _, extra = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host)
        issued = service.issue_lease(identity_a, "checkout-a")
        host.set_active(identity_b)
        with self.assertRaises(GatewayError):
            service.issue_lease(identity_a, "checkout-new-a")
        body, _, _ = service.get_blob(issued["leaseId"], issued["transport"]["token"], a_only)
        self.assertEqual(body, b"a-only")
        before = list(host.blob_reads)
        with self.assertRaises(GatewayError) as refused_b:
            service.get_blob(issued["leaseId"], issued["transport"]["token"], b_only)
        self.assertEqual(refused_b.exception.status, 404)
        self.assertEqual(host.blob_reads, before)
        with self.assertRaises(GatewayError):
            service.get_blob(issued["leaseId"], issued["transport"]["token"], extra)

    def test_transport_renews_after_switch_until_stop_or_rotation(self):
        clock = Clock()
        host, identity_a, identity_b, _, a_only, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host, time_fn=clock, transport_ttl_seconds=10)
        issued = service.issue_lease(identity_a, "checkout-a")
        host.set_active(identity_b)
        clock.now += 11
        with self.assertRaises(GatewayError):
            service.get_blob(issued["leaseId"], issued["transport"]["token"], a_only)
        renewed = service.renew_transport(issued["leaseId"])
        self.assertEqual(renewed["releaseId"], identity_a["releaseId"])
        self.assertEqual(renewed["allowlistSha256"], issued["allowlistSha256"])
        body, _, _ = service.get_blob(renewed["leaseId"], renewed["transport"]["token"], a_only)
        self.assertEqual(body, b"a-only")
        service.stop_checkout(issued["leaseId"])
        with self.assertRaises(GatewayError):
            service.renew_transport(issued["leaseId"])
        with self.assertRaises(GatewayError):
            service.get_blob(issued["leaseId"], renewed["transport"]["token"], a_only)

        host.set_active(identity_a)
        second = service.issue_lease(identity_a, "checkout-rotate")
        host.set_active(identity_b)
        service.rotate_token(OTHER)
        with self.assertRaises(GatewayError):
            service.authenticate("Bearer " + TOKEN)
        service.authenticate("Bearer " + OTHER)
        with self.assertRaises(GatewayError):
            service.renew_transport(second["leaseId"])
        with self.assertRaises(GatewayError):
            service.get_blob(second["leaseId"], second["transport"]["token"], a_only)

    def test_token_file_install_is_0600_and_rotation_rejects_previous(self):
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "gateway" / "token"
            install_token_file(path, TOKEN)
            self.assertEqual(oct(path.stat().st_mode & 0o777), "0o600")
            self.assertEqual(oct(path.parent.stat().st_mode & 0o777), "0o700")
            self.assertEqual(read_token_file(path), TOKEN)
            install_token_file(path, OTHER)
            self.assertEqual(read_token_file(path), OTHER)
            host, _, _, _, _, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
            service = GatewayService(TOKEN, host, token_fn=lambda: read_token_file(path))
            with self.assertRaises(GatewayError):
                service.authenticate("Bearer " + TOKEN)
            service.authenticate("Bearer " + OTHER)
            with self.assertRaises(ValueError):
                install_token_file(path, "LTAIexamplekeyid01notagatewaytoken")

    def test_gateway_unit_and_proxy_do_not_touch_production_ossfs(self):
        unit = (DEV / "act-developer-runtime-gateway.service").read_text(encoding="utf-8")
        nginx = (DEV / "nginx-developer-gateway.conf").read_text(encoding="utf-8")
        self.assertNotIn("ExecStop", unit)
        self.assertNotRegex(unit, r"(?i)\\bumount\\b")
        self.assertNotIn("ossfs2", unit)
        self.assertNotIn("act-runtime-blob-ossfs.service", unit)
        self.assertNotIn("BindsTo=", unit)
        self.assertNotIn("Requires=", unit)
        self.assertNotIn("activate-runtime", unit)
        self.assertNotIn("act-runtime-selection.json", unit)
        self.assertIn("127.0.0.1:8787", unit)
        self.assertIn("StateDirectory=act-runtime-developer-gateway", unit)
        self.assertIn("--lease-store", unit)
        self.assertIn("127.0.0.1:8787", nginx)
        self.assertIn("limit_req", nginx)
        self.assertIn("developer_gateway_anon", nginx)
        self.assertNotIn("$http_authorization", nginx.split("log_format", 1)[1].split(";", 1)[0])
        host, identity_a, _, _, a_only, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host)
        issued = service.issue_lease(identity_a, "checkout-a")
        self.assertFalse(hasattr(service, "unmount"))
        self.assertFalse(hasattr(host, "unmount"))
        body, _, _ = service.get_blob(issued["leaseId"], issued["transport"]["token"], a_only)
        self.assertEqual(body, b"a-only")

    def test_http_rejects_query_token_and_serves_range(self):
        host, identity_a, _, _, a_only, _, _, extra = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host)
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(service, RateLimiter(limit=1000)))
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            import urllib.error
            import urllib.request
            port = httpd.server_address[1]
            base = "http://127.0.0.1:%d" % port
            with self.assertRaises(urllib.error.HTTPError) as query:
                urllib.request.urlopen(base + "/v1/leases?token=" + TOKEN)
            self.assertEqual(query.exception.code, 401)
            request = urllib.request.Request(
                base + "/v1/leases",
                data=json.dumps({"identity": identity_a, "checkoutId": "http-a"}).encode("utf-8"),
                method="POST",
                headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"},
            )
            with urllib.request.urlopen(request) as response:
                issued = json.loads(response.read().decode("utf-8"))
            blob_req = urllib.request.Request(
                base + "/v1/blobs/sha256/" + a_only,
                headers={
                    "Authorization": "Bearer " + TOKEN,
                    "X-Act-Runtime-Lease": issued["leaseId"],
                    "X-Act-Runtime-Transport": issued["transport"]["token"],
                    "Range": "bytes=0-3",
                },
            )
            with urllib.request.urlopen(blob_req) as response:
                self.assertEqual(response.status, 206)
                self.assertEqual(response.read(), b"a-on")
            extra_req = urllib.request.Request(
                base + "/v1/blobs/sha256/" + extra,
                headers={
                    "Authorization": "Bearer " + TOKEN,
                    "X-Act-Runtime-Lease": issued["leaseId"],
                    "X-Act-Runtime-Transport": issued["transport"]["token"],
                },
            )
            with self.assertRaises(urllib.error.HTTPError) as missing:
                urllib.request.urlopen(extra_req)
            self.assertEqual(missing.exception.code, 404)
            self.assertEqual(missing.exception.read(), b'{"error":"not found"}')
        finally:
            httpd.shutdown()
            httpd.server_close()

    def test_disk_host_serves_view_bytes_without_listing_extra_blobs(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            host_mem, identity_a, _, _, a_only, _, _, extra = bind_host(b"shared", b"a-only", b"b-only", b"extra")
            view = root / "views" / identity_a["releaseId"]
            view.mkdir(parents=True)
            (view / ".act-runtime-release.v2.json").write_bytes(host_mem.manifest_bytes(identity_a) or b"")
            (view / ".act-runtime-release-receipt.v2.json").write_bytes(host_mem.receipt_bytes(identity_a) or b"")
            blobs = root / "blobs"
            blobs.mkdir()
            for digest_hex, payload in host_mem._blobs.items():
                (blobs / digest_hex).write_bytes(payload)
            receipt_path = root / "act-runtime-active-receipt.json"
            receipt_path.write_text("stale audit receipt", encoding="utf-8")
            (root / "current").symlink_to(view, target_is_directory=True)
            disk = DiskHost(root, blobs)
            service = GatewayService(TOKEN, disk)
            issued = service.issue_lease(identity_a, "disk-a")
            served = service.get_manifest(issued["leaseId"], issued["transport"]["token"])
            self.assertEqual(served, host_mem.manifest_bytes(identity_a))
            body, _, _ = service.get_blob(issued["leaseId"], issued["transport"]["token"], a_only)
            self.assertEqual(body, b"a-only")
            with self.assertRaises(GatewayError) as denied:
                service.get_blob(issued["leaseId"], issued["transport"]["token"], extra)
            self.assertEqual(denied.exception.status, 404)


    def test_disk_host_issues_from_current_without_release_receipt(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            host_mem, identity_a, _, _, _, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
            view = root / "views" / identity_a["releaseId"]
            view.mkdir(parents=True)
            (view / ".act-runtime-release.v2.json").write_bytes(host_mem.manifest_bytes(identity_a) or b"")
            (view / ".act-runtime-release-materialization.v1.json").write_text(
                json.dumps({"schemaVersion": "runtime-blob-materialization.v1", "releaseId": identity_a["releaseId"]}),
                encoding="utf-8",
            )
            blobs = root / "blobs"
            blobs.mkdir()
            receipt_path = root / "act-runtime-active-receipt.json"
            receipt_path.write_text("stale audit receipt", encoding="utf-8")
            (root / "current").symlink_to(view, target_is_directory=True)
            service = GatewayService(TOKEN, DiskHost(root, blobs))
            issued = service.issue_lease(identity_a, "disk-materialization")
            self.assertEqual(issued["releaseId"], identity_a["releaseId"])

    def test_issue_lease_ignores_obsolete_receipt_bytes(self):
        host, identity_a, _, _, _, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        host.put_receipt(identity_a, canonical({
            "schemaVersion": "runtime-blob-materialization.v1",
            "releaseId": identity_a["releaseId"],
        }) + b"\n")
        service = GatewayService(TOKEN, host)
        issued = service.issue_lease(identity_a, "obsolete-receipt")
        self.assertEqual(issued["releaseId"], identity_a["releaseId"])


    def test_live_lease_survives_gateway_reload_after_activation(self):
        clock = Clock()
        host, identity_a, identity_b, _, a_only, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        with tempfile.TemporaryDirectory() as raw:
            store = Path(raw) / "leases.json"
            first = GatewayService(TOKEN, host, time_fn=clock, transport_ttl_seconds=10, lease_store=store)
            issued = first.issue_lease(identity_a, "persist-a")
            self.assertEqual(oct(store.stat().st_mode & 0o777), "0o600")
            host.set_active(identity_b)
            reloaded = GatewayService(TOKEN, host, time_fn=clock, transport_ttl_seconds=10, lease_store=store)
            body, _, _ = reloaded.get_blob(issued["leaseId"], issued["transport"]["token"], a_only)
            self.assertEqual(body, b"a-only")
            with self.assertRaises(GatewayError):
                reloaded.issue_lease(identity_a, "persist-new")
            clock.now += 11
            with self.assertRaises(GatewayError):
                reloaded.get_blob(issued["leaseId"], issued["transport"]["token"], a_only)
            renewed = reloaded.renew_transport(issued["leaseId"])
            body, _, _ = reloaded.get_blob(renewed["leaseId"], renewed["transport"]["token"], a_only)
            self.assertEqual(body, b"a-only")

    def test_concurrent_renew_returns_the_same_live_transport(self):
        clock = Clock()
        host, identity_a, _, _, _, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host, time_fn=clock, transport_ttl_seconds=10)
        issued = service.issue_lease(identity_a, "race-a")
        clock.now += 11
        results: list[dict] = []
        errors: list[BaseException] = []

        def renew() -> None:
            try:
                results.append(service.renew_transport(issued["leaseId"]))
            except BaseException as error:  # noqa: BLE001
                errors.append(error)

        workers = [threading.Thread(target=renew) for _ in range(8)]
        for worker in workers:
            worker.start()
        for worker in workers:
            worker.join()
        self.assertEqual(errors, [])
        self.assertEqual(len(results), 8)
        tokens = {row["transport"]["token"] for row in results}
        self.assertEqual(len(tokens), 1)

    def test_stale_heartbeat_expires_lease_even_after_restart(self):
        clock = Clock()
        host, identity_a, _, _, a_only, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        with tempfile.TemporaryDirectory() as raw:
            store = Path(raw) / "leases.json"
            service = GatewayService(
                TOKEN,
                host,
                time_fn=clock,
                heartbeat_grace_seconds=30,
                lease_store=store,
            )
            issued = service.issue_lease(identity_a, "checkout-a")
            body, _, _ = service.get_blob(issued["leaseId"], issued["transport"]["token"], a_only)
            self.assertEqual(body, b"a-only")
            clock.now += 31
            with self.assertRaises(GatewayError):
                service.renew_transport(issued["leaseId"])
            restarted = GatewayService(
                TOKEN,
                host,
                time_fn=clock,
                heartbeat_grace_seconds=30,
                lease_store=store,
            )
            with self.assertRaises(GatewayError):
                restarted.renew_transport(issued["leaseId"])
            with self.assertRaises(GatewayError):
                restarted.get_blob(issued["leaseId"], issued["transport"]["token"], a_only)

    def test_heartbeat_keeps_lease_live_across_grace_boundary(self):
        clock = Clock()
        host, identity_a, _, _, a_only, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host, time_fn=clock, heartbeat_grace_seconds=30)
        issued = service.issue_lease(identity_a, "checkout-a")
        clock.now += 29
        service.heartbeat(issued["leaseId"])
        clock.now += 29
        body, _, _ = service.get_blob(issued["leaseId"], issued["transport"]["token"], a_only)
        self.assertEqual(body, b"a-only")

    def test_stopped_lease_is_evicted_from_persisted_store(self):
        clock = Clock()
        host, identity_a, _, _, _, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        with tempfile.TemporaryDirectory() as raw:
            store = Path(raw) / "leases.json"
            service = GatewayService(TOKEN, host, time_fn=clock, lease_store=store)
            issued = service.issue_lease(identity_a, "checkout-evict")
            service.stop_checkout(issued["leaseId"])
            payload = json.loads(store.read_text(encoding="utf-8"))
            self.assertEqual(payload["leases"], [])
            with self.assertRaises(GatewayError):
                service.heartbeat(issued["leaseId"])

    def test_expired_lease_is_evicted_from_persisted_store(self):
        clock = Clock()
        host, identity_a, _, _, _, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        with tempfile.TemporaryDirectory() as raw:
            store = Path(raw) / "leases.json"
            service = GatewayService(TOKEN, host, time_fn=clock, heartbeat_grace_seconds=30, lease_store=store)
            expired = service.issue_lease(identity_a, "checkout-old")
            clock.now += 31
            service.issue_lease(identity_a, "checkout-new")
            payload = json.loads(store.read_text(encoding="utf-8"))
            remaining = {lease["leaseId"] for lease in payload["leases"]}
            self.assertNotIn(expired["leaseId"], remaining)
            self.assertEqual(len(payload["leases"]), 1)

    def test_heartbeat_persist_is_debounced(self):
        clock = Clock()
        host, identity_a, _, _, _, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        with tempfile.TemporaryDirectory() as raw:
            store = Path(raw) / "leases.json"
            service = GatewayService(TOKEN, host, time_fn=clock, persist_interval_seconds=30, lease_store=store)
            issued = service.issue_lease(identity_a, "checkout-debounce")
            first_mtime = store.stat().st_mtime_ns
            clock.now += 1
            service.heartbeat(issued["leaseId"])
            self.assertEqual(store.stat().st_mtime_ns, first_mtime)
            clock.now += 31
            service.heartbeat(issued["leaseId"])
            self.assertNotEqual(store.stat().st_mtime_ns, first_mtime)

    def test_issue_lease_supersedes_live_lease_for_same_checkout(self):
        clock = Clock()
        host, identity_a, _, _, _, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host, time_fn=clock)
        first = service.issue_lease(identity_a, "checkout-shared")
        other = service.issue_lease(identity_a, "checkout-other")
        second = service.issue_lease(identity_a, "checkout-shared")
        with self.assertRaises(GatewayError) as denied:
            service.renew_transport(first["leaseId"])
        self.assertEqual(denied.exception.status, 401)
        renewed = service.renew_transport(second["leaseId"])
        self.assertEqual(renewed["leaseId"], second["leaseId"])
        renewed_other = service.renew_transport(other["leaseId"])
        self.assertEqual(renewed_other["leaseId"], other["leaseId"])

    def test_checkout_fuse_heartbeats_its_own_lease(self):
        from gateway_fuse import heartbeat_session_leases
        with tempfile.TemporaryDirectory() as raw:
            session = Path(raw) / "gateway-session.json"
            session.write_text(json.dumps({
                "gatewayUrl": "https://runtime-dev.adapt-learn.online",
                "token": TOKEN,
                "leaseId": "checkout-lease",
            }), encoding="utf-8")
            with mock.patch("gateway_fuse.GatewayClient") as client_cls:
                heartbeat_session_leases(session)
            client_cls.return_value.heartbeat.assert_called_once_with("checkout-lease")
            client_cls.return_value.stop_lease.assert_not_called()

    def test_shared_fuse_does_not_heartbeat_dead_checkout_leases(self):
        from common import LEASE_SCHEMA, STATE_DIR_NAME
        from gateway_fuse import heartbeat_session_leases
        from shared_mount import write_leases
        previous = os.environ.get("ACT_RUNTIME_DEV_STATE_HOME")
        with tempfile.TemporaryDirectory() as raw:
            os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = raw
            try:
                mount_id = "mid"
                session = Path(raw) / STATE_DIR_NAME / "shared" / "mounts" / mount_id / "gateway-session.json"
                session.parent.mkdir(parents=True)
                live_runtime = Path(raw) / "live-runtime"
                live_runtime.mkdir()
                write_leases(mount_id, {
                    "schemaVersion": LEASE_SCHEMA,
                    "leases": {
                        "dead": {"pids": [99999999], "runtimeRoot": str(Path(raw) / "missing")},
                        "empty": {"pids": [], "runtimeRoot": str(Path(raw) / "missing")},
                        "live": {"pids": [os.getpid()], "runtimeRoot": str(live_runtime)},
                    },
                })
                session.write_text(json.dumps({
                    "gatewayUrl": "https://runtime-dev.adapt-learn.online",
                    "token": TOKEN,
                    "leases": {
                        "dead": {"leaseId": "dead-lease"},
                        "empty": {"leaseId": "empty-lease"},
                        "live": {"leaseId": "live-lease"},
                        "ghost": {"leaseId": "ghost-lease"},
                    },
                }), encoding="utf-8")
                with mock.patch("gateway_fuse.GatewayClient") as client_cls:
                    heartbeat_session_leases(session)
                client_cls.return_value.heartbeat.assert_called_once_with("live-lease")
                stopped = [call.args[0] for call in client_cls.return_value.stop_lease.call_args_list]
                self.assertCountEqual(stopped, ["dead-lease", "empty-lease", "ghost-lease"])
                remaining = json.loads(session.read_text(encoding="utf-8"))["leases"]
                self.assertEqual(list(remaining), ["live"])
            finally:
                if previous is None:
                    os.environ.pop("ACT_RUNTIME_DEV_STATE_HOME", None)
                else:
                    os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = previous

    def test_default_rate_limiter_matches_nginx_contract(self):
        limiter = RateLimiter()
        now = 1000.0
        for _ in range(30):
            limiter.check("client", now)
        with self.assertRaises(GatewayError) as raised:
            limiter.check("client", now)
        self.assertEqual(raised.exception.status, 429)
        limiter.check("client", now + 1.0)


class CurrentPointerIntegrationTests(unittest.TestCase):
    @mock.patch.dict(os.environ, {"ACT_RUNTIME_DEV_ALLOW_HTTP": "1"})
    def test_materialized_current_bootstraps_without_any_release_receipt(self):
        from bootstrap import fetch_release_manifest, verify_release_manifest, load_materializer
        from gateway_client import GatewayClient
        host_mem, identity_a, identity_b, _, a_only, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            for identity in (identity_a, identity_b):
                view = root / "views" / identity["releaseId"]
                view.mkdir(parents=True)
                # Use the actual CAS materializer, including its pretty-printed manifest.
                load_materializer().write_materialization_artifacts(
                    view, json.loads(host_mem.manifest_bytes(identity)))
            current = root / "current"
            current.symlink_to(root / "views" / identity_a["releaseId"])
            blobs = root / "blobs"
            blobs.mkdir()
            for digest, payload in host_mem._blobs.items():
                (blobs / digest).write_bytes(payload)
            service = GatewayService(TOKEN, DiskHost(root, blobs))
            httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(service, RateLimiter()))
            thread = threading.Thread(target=httpd.serve_forever, daemon=True)
            thread.start()
            try:
                client = GatewayClient("http://127.0.0.1:%s" % httpd.server_port, TOKEN)
                issued = client.issue_lease(identity_a, "pointer-client")
                manifest_path = fetch_release_manifest(identity_a["releaseId"], root / "download", {"client": client, "lease": issued})
                verify_release_manifest(identity_a, manifest_path)
                self.assertFalse((root / "download/receipt.json").exists())
                current.unlink()
                current.symlink_to(root / "views" / identity_b["releaseId"])
                self.assertEqual(service._host.active_identity(), identity_b)
                self.assertEqual(client.get_blob(issued["leaseId"], issued["transport"]["token"], a_only), b"a-only")
                new = client.issue_lease(identity_b, "new-checkout")
                self.assertEqual(new["releaseId"], identity_b["releaseId"])
            finally:
                httpd.shutdown()
                httpd.server_close()
                thread.join()

    def test_default_lease_survives_a_weekend_then_renews_and_stops(self):
        clock = Clock()
        host, identity, _, _, a_only, _, _, _ = bind_host(b"shared", b"a-only", b"b-only", b"extra")
        service = GatewayService(TOKEN, host, time_fn=clock)
        issued = service.issue_lease(identity, "weekend")
        clock.now += 23 * 3600
        self.assertEqual(service.get_blob(issued["leaseId"], issued["transport"]["token"], a_only)[0], b"a-only")
        clock.now += 3 * 24 * 3600
        renewed = service.renew_transport(issued["leaseId"])
        self.assertEqual(service.get_blob(issued["leaseId"], renewed["transport"]["token"], a_only)[0], b"a-only")
        service.stop_checkout(issued["leaseId"])
        with self.assertRaises(GatewayError):
            service.renew_transport(issued["leaseId"])


if __name__ == "__main__":
    unittest.main()
