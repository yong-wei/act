#!/usr/bin/env python3
"""Workstation HTTP client for the ECS developer runtime gateway."""

from __future__ import annotations

import json
import os
import subprocess
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import urljoin, urlparse

from common import fail
from gateway_service import GatewayError, DENIED_BODY, NOT_FOUND_BODY, UNAVAILABLE_BODY

LEASE_HEADER = "X-Act-Runtime-Lease"
TRANSPORT_HEADER = "X-Act-Runtime-Transport"


def _status_body(error: urllib.error.HTTPError) -> tuple[int, bytes]:
    try:
        body = error.read()
    except OSError:
        body = b""
    return error.code, body


def _raise_http(status: int, body: bytes) -> None:
    if status in (401, 403):
        raise GatewayError(status, "denied", DENIED_BODY)
    if status == 404:
        raise GatewayError(status, "not_found", NOT_FOUND_BODY)
    if status == 409:
        raise GatewayError(status, "denied", DENIED_BODY)
    if status >= 500:
        raise GatewayError(status, "unavailable", UNAVAILABLE_BODY)
    raise GatewayError(status, "denied", body or DENIED_BODY)


class GatewayClient:
    def __init__(self, gateway_url: str, token: str) -> None:
        parsed = urlparse(gateway_url)
        if parsed.scheme != "https" and os.environ.get("ACT_RUNTIME_DEV_ALLOW_HTTP") != "1":
            fail("gateway URL must be HTTPS")
        host = (parsed.hostname or "").lower()
        if "oss-cn-hangzhou.aliyuncs.com" in host or "oss-cn-hangzhou-internal.aliyuncs.com" in host:
            fail("gateway URL must not be an OSS endpoint")
        if not token or len(token) < 32:
            fail("gateway token is invalid")
        self.base = gateway_url.rstrip("/") + "/"
        self.token = token
        self.body_transfers = 0

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {"Authorization": "Bearer %s" % self.token, "Cache-Control": "no-store"}
        if extra:
            headers.update(extra)
        return headers

    def _request(self, method: str, path: str, data: bytes | None = None, headers: dict[str, str] | None = None) -> tuple[int, bytes, dict[str, str]]:
        helper = os.environ.get("ACT_RUNTIME_DEV_GATEWAY_HTTP")
        url = urljoin(self.base, path)
        if helper:
            payload = json.dumps({
                "method": method,
                "url": url,
                "headers": self._headers(headers),
                "body": None if data is None else data.decode("latin1"),
            }).encode("utf-8")
            raw = subprocess.check_output([helper], input=payload)
            parsed = json.loads(raw.decode("utf-8"))
            return int(parsed["status"]), parsed["body"].encode("latin1"), parsed.get("headers") or {}
        request = urllib.request.Request(url, data=data, method=method, headers=self._headers(headers))
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = response.read()
                return response.status, body, dict(response.headers.items())
        except urllib.error.HTTPError as error:
            status, body = _status_body(error)
            _raise_http(status, body)
            return status, body, {}
        except urllib.error.URLError as error:
            fail("developer runtime gateway is unavailable")
            raise error

    def issue_lease(self, identity: dict[str, str], checkout_id: str) -> dict[str, Any]:
        payload = json.dumps({"identity": identity, "checkoutId": checkout_id}, sort_keys=True).encode("utf-8")
        status, body, _ = self._request("POST", "v1/leases", payload, {"Content-Type": "application/json"})
        if status not in (200, 201):
            _raise_http(status, body)
        return json.loads(body.decode("utf-8"))

    def renew_transport(self, lease_id: str) -> dict[str, Any]:
        status, body, _ = self._request("POST", "v1/leases/%s/transport" % lease_id)
        if status != 200:
            _raise_http(status, body)
        return json.loads(body.decode("utf-8"))

    def stop_lease(self, lease_id: str) -> None:
        self._request("DELETE", "v1/leases/%s" % lease_id)

    def get_bytes(self, path: str, lease_id: str, transport: str, range_header: str | None = None) -> bytes:
        extra = {LEASE_HEADER: lease_id, TRANSPORT_HEADER: transport}
        if range_header:
            extra["Range"] = range_header
        status, body, _ = self._request("GET", path, headers=extra)
        if status not in (200, 206):
            _raise_http(status, body)
        self.body_transfers += 1
        return body

    def get_manifest(self, lease_id: str, transport: str) -> bytes:
        return self.get_bytes("v1/leases/%s/manifest" % lease_id, lease_id, transport)

    def get_receipt(self, lease_id: str, transport: str) -> bytes:
        return self.get_bytes("v1/leases/%s/receipt" % lease_id, lease_id, transport)

    def get_blob(self, lease_id: str, transport: str, digest: str, range_header: str | None = None) -> bytes:
        return self.get_bytes("v1/blobs/sha256/%s" % digest, lease_id, transport, range_header)
