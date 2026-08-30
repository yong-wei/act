#!/usr/bin/env python3
"""Loopback HTTP surface for the ECS developer runtime gateway."""

from __future__ import annotations

import argparse
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from gateway_host import DiskHost
from gateway_service import DENIED_BODY, GatewayError, GatewayService
from gateway_token import read_token_file

LEASE_HEADER = "X-Act-Runtime-Lease"
TRANSPORT_HEADER = "X-Act-Runtime-Transport"
MAX_BODY = 64 * 1024


class RateLimiter:
    """Match nginx `rate=30r/s` for the developer gateway loopback surface."""

    def __init__(self, limit: int = 30, window_seconds: float = 1.0) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = {}

    def check(self, key: str, now: float) -> None:
        window = [stamp for stamp in self._hits.get(key, []) if now - stamp < self.window_seconds]
        if len(window) >= self.limit:
            raise GatewayError(429, "denied", DENIED_BODY)
        window.append(now)
        self._hits[key] = window


def _query_map(parsed) -> dict[str, str]:
    raw = parse_qs(parsed.query, keep_blank_values=True)
    return {key: values[-1] if values else "" for key, values in raw.items()}


def make_handler(service: GatewayService, limiter: RateLimiter):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
            message = format % args
            if "authorization" in message.lower() or "bearer" in message.lower() or "token" in message.lower():
                return
            sys.stderr.write("%s - %s\n" % (self.address_string(), message))

        def _send(self, status: int, body: bytes, headers: dict[str, str] | None = None) -> None:
            self.send_response(status)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            for key, value in (headers or {"Content-Type": "application/json"}).items():
                if key.lower() in {"authorization", "x-act-runtime-transport"}:
                    continue
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(body)

        def _handle(self) -> None:
            try:
                parsed = urlparse(self.path)
                query = _query_map(parsed)
                service.authenticate(self.headers.get("Authorization"), query)
                service.reject_foreign_credentials({
                    key: self.headers[key] for key in self.headers.keys()
                    if key.lower() not in {"authorization", "host", "content-type", "content-length", "range", "connection"}
                })
                limiter.check("shared", service._time())
                path = parsed.path.rstrip("/") or "/"
                if self.command == "POST" and path == "/v1/leases":
                    payload = json.loads(self._read_body().decode("utf-8"))
                    result = service.issue_lease(payload.get("identity"), str(payload.get("checkoutId") or ""))
                    self._send(201, json.dumps(result, sort_keys=True).encode("utf-8"))
                    return
                lease_id = self.headers.get(LEASE_HEADER) or ""
                transport = self.headers.get(TRANSPORT_HEADER)
                parts = path.strip("/").split("/")
                if self.command == "POST" and len(parts) == 4 and parts[0] == "v1" and parts[1] == "leases" and parts[3] == "transport":
                    result = service.renew_transport(parts[2])
                    self._send(200, json.dumps(result, sort_keys=True).encode("utf-8"))
                    return
                if self.command == "POST" and len(parts) == 4 and parts[0] == "v1" and parts[1] == "leases" and parts[3] == "heartbeat":
                    service.heartbeat(parts[2])
                    self._send(204, b"")
                    return
                if self.command == "DELETE" and len(parts) == 3 and parts[0] == "v1" and parts[1] == "leases":
                    service.stop_checkout(parts[2])
                    self._send(204, b"")
                    return
                if self.command == "GET" and len(parts) == 4 and parts[0] == "v1" and parts[1] == "leases" and parts[3] == "manifest":
                    body = service.get_manifest(parts[2], transport)
                    self._send(200, body, {"Content-Type": "application/json"})
                    return
                if self.command == "GET" and len(parts) == 4 and parts[0] == "v1" and parts[1] == "leases" and parts[3] == "receipt":
                    body = service.get_receipt(parts[2], transport)
                    self._send(200, body, {"Content-Type": "application/json"})
                    return
                if self.command == "GET" and len(parts) == 4 and parts[0] == "v1" and parts[1] == "blobs" and parts[2] == "sha256":
                    body, status, headers = service.get_blob(lease_id or "", transport, parts[3], self.headers.get("Range"))
                    headers["Content-Type"] = "application/octet-stream"
                    self._send(status, body, headers)
                    return
                raise GatewayError(404, "not_found", b'{"error":"not found"}')
            except GatewayError as error:
                self._send(error.status, error.body)
            except (UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError, ValueError):
                self._send(400, DENIED_BODY)

        def _read_body(self) -> bytes:
            length = int(self.headers.get("Content-Length") or "0")
            if length < 0 or length > MAX_BODY:
                raise GatewayError(400, "denied", DENIED_BODY)
            return self.rfile.read(length) if length else b"{}"

        def do_GET(self) -> None:  # noqa: N802
            self._handle()

        def do_POST(self) -> None:  # noqa: N802
            self._handle()

        def do_DELETE(self) -> None:  # noqa: N802
            self._handle()

        def do_PUT(self) -> None:  # noqa: N802
            self._send(405, DENIED_BODY)

    return Handler


def serve(host: str, port: int, service: GatewayService) -> ThreadingHTTPServer:
    handler = make_handler(service, RateLimiter())
    return ThreadingHTTPServer((host, port), handler)


def main() -> int:
    parser = argparse.ArgumentParser(prog="act-developer-runtime-gateway")
    parser.add_argument("--listen", default="127.0.0.1:8787")
    parser.add_argument("--token-file", required=True)
    parser.add_argument("--lease-store")
    parser.add_argument("--active-receipt", required=True)
    parser.add_argument("--view-root", required=True)
    parser.add_argument("--blob-root", required=True)
    args = parser.parse_args()
    host, port_text = args.listen.rsplit(":", 1)
    token_path = Path(args.token_file)
    disk = DiskHost(Path(args.active_receipt), Path(args.view_root), Path(args.blob_root))
    lease_store = Path(args.lease_store) if args.lease_store else None
    service = GatewayService(
        read_token_file(token_path),
        disk,
        token_fn=lambda: read_token_file(token_path),
        lease_store=lease_store,
    )
    httpd = serve(host, int(port_text), service)
    sys.stderr.write("developer runtime gateway listening on %s\n" % args.listen)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
