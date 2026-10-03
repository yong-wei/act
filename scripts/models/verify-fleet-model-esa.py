#!/usr/bin/env python3
"""Verify the current fleet consumption closure through its public ESA URLs."""

from __future__ import annotations

import hashlib
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / "public/assets/model-releases"
ORIGIN = "https://act.adapt-learn.online"
ESA = "https://static.adapt-learn.online/"
CONTENT_TYPES = {".glb": "model/gltf-binary", ".json": "application/json", ".png": "image/png"}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(path: Path) -> dict[str, object]:
    key = "model-releases/" + path.relative_to(MODELS).as_posix()
    expected_hash = digest(path)
    request = urllib.request.Request(ESA + key, headers={"Origin": ORIGIN})
    with urllib.request.urlopen(request, timeout=60) as response:
        if response.status != 200:
            raise RuntimeError(f"esa-status:{key}:{response.status}")
        actual_hash = hashlib.sha256()
        size = 0
        while chunk := response.read(1024 * 1024):
            actual_hash.update(chunk)
            size += len(chunk)
        headers = response.headers
        mime = headers.get("Content-Type", "").split(";")[0].lower()
        if mime != CONTENT_TYPES[path.suffix]:
            raise RuntimeError(f"esa-mime:{key}:{mime}")
        if headers.get("Access-Control-Allow-Origin") != ORIGIN:
            raise RuntimeError(f"esa-cors:{key}")
        if "origin" not in ",".join(headers.get_all("Vary", [])).lower():
            raise RuntimeError(f"esa-vary:{key}")
        if "max-age=31536000" not in headers.get("Cache-Control", ""):
            raise RuntimeError(f"esa-cache-ttl:{key}")
        if actual_hash.hexdigest() != expected_hash or size != path.stat().st_size:
            raise RuntimeError(f"esa-byte-drift:{key}")
        return {"key": key, "sha256": expected_hash, "bytes": size, "status": "verified",
                "contentType": mime, "corsOrigin": ORIGIN, "cacheControl": headers.get("Cache-Control"),
                "via": headers.get("Via"), "eagleId": headers.get("EagleId")}


def origin_variants(path: Path) -> dict[str, object]:
    key = "model-releases/" + path.relative_to(MODELS).as_posix()
    result = []
    for origin in [None, ORIGIN, None, ORIGIN]:
        with urllib.request.urlopen(urllib.request.Request(ESA + key, method="HEAD",
                headers={} if origin is None else {"Origin": origin}), timeout=30) as response:
            allow = response.headers.get("Access-Control-Allow-Origin")
            if response.status != 200 or allow != origin:
                raise RuntimeError(f"esa-origin-variant:{key}")
            result.append({"origin": origin, "allowedOrigin": allow, "status": response.status,
                           "via": response.headers.get("Via"), "eagleId": response.headers.get("EagleId")})
    with urllib.request.urlopen(urllib.request.Request(ESA + key,
            headers={"Origin": ORIGIN, "Range": "bytes=0-31"}), timeout=30) as response:
        data = response.read()
        if response.status != 206 or data != path.read_bytes()[:32]:
            raise RuntimeError(f"esa-range:{key}")
        range_result = {"status": response.status, "contentRange": response.headers.get("Content-Range")}
    with urllib.request.urlopen("http://static.adapt-learn.online/" + key, timeout=30) as response:
        if response.geturl() != ESA + key:
            raise RuntimeError(f"esa-https-redirect:{key}")
    return {"key": key, "originVariants": result, "range": range_result, "httpRedirect": "https"}


def main() -> None:
    files = []
    packages = []
    for manifest_path in sorted(MODELS.glob("*/*/manifest.json")):
        manifest = json.loads(manifest_path.read_text())
        folder = manifest_path.parent
        expected = {"manifest.json": (digest(manifest_path), manifest_path.stat().st_size)}
        for item in [*manifest["artifacts"].values(), *manifest["textures"]]:
            expected[item["file"]] = (item["sha256"], item["bytes"])
        actual = {path.relative_to(folder).as_posix() for path in folder.rglob("*") if path.is_file()}
        if actual != set(expected):
            raise RuntimeError(f"local-closure:{manifest['packageId']}")
        for relative, (sha, size) in expected.items():
            path = folder / relative
            if digest(path) != sha or path.stat().st_size != size:
                raise RuntimeError(f"local-drift:{manifest['packageId']}:{relative}")
            files.append(path)
        packages.append({"packageId": manifest["packageId"], "modelVersion": manifest["modelVersion"],
                         "manifestSha256": digest(manifest_path), "objectCount": len(expected)})
    if len(packages) != 7:
        raise RuntimeError("expected-seven-current-packages")
    with ThreadPoolExecutor(max_workers=4) as pool:
        objects = list(pool.map(verify, sorted(files)))
    proxy = next(path for path in files if path.name.endswith("ship-proxy.glb"))
    receipt = {"schema": "act-fleet-model-esa-verification/1", "capturedAt": datetime.now(timezone.utc).isoformat(),
               "bucket": "act-course-models", "esaHostname": "static.adapt-learn.online",
               "packages": packages, "objectCount": len(objects), "bytes": sum(item["bytes"] for item in objects),
               "transportSmoke": origin_variants(proxy), "objects": objects}
    output = ROOT / "artifacts/model-releases/esa-verification.json"
    # 紧凑数据回执；不生成千行的大型文档。
    encoded = json.dumps(receipt, ensure_ascii=False, separators=(",", ":"))
    output.write_text(encoded + "\n", encoding="utf8")
    print(json.dumps({"packages": len(packages), "verifiedObjects": len(objects),
                      "bytes": receipt["bytes"], "receipt": str(output.relative_to(ROOT))}))


if __name__ == "__main__":
    main()
