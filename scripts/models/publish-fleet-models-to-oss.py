#!/usr/bin/env python3
"""Upload public/assets/model-releases/* to act-course-models with matching keys."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

BUCKET = "act-course-models"
PREFIX = "model-releases"
LOCAL_ROOT = Path("public/assets/model-releases")
RECEIPT = Path("artifacts/model-releases/oss-publication.json")
WORKERS = 4

CONTENT_TYPES = {
    ".glb": "model/gltf-binary",
    ".png": "image/png",
    ".json": "application/json",
    ".webp": "image/webp",
}


def require_env() -> tuple[str, str, str]:
    ossutil = os.environ.get("ACT_RUNTIME_LOCAL_OSSUTIL")
    endpoint = os.environ.get("ACT_RUNTIME_OSS_ENDPOINT") or os.environ.get("OSS_ENDPOINT")
    region = os.environ.get("ACT_RUNTIME_OSS_REGION") or os.environ.get("OSS_REGION")
    if not ossutil or not Path(ossutil).is_file():
        raise SystemExit("missing ACT_RUNTIME_LOCAL_OSSUTIL")
    if not endpoint or not region:
        raise SystemExit("missing OSS endpoint/region")
    if not endpoint.startswith("http"):
        endpoint = f"https://{endpoint}"
    return ossutil, endpoint, region


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ossutil_cmd(ossutil: str, endpoint: str, region: str, args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [ossutil, "api", *args, "--endpoint", endpoint, "--region", region, "--output-format", "json", "-q"],
        check=False,
        capture_output=True,
        text=True,
    )


def head_size(ossutil: str, endpoint: str, region: str, key: str) -> int | None:
    result = ossutil_cmd(ossutil, endpoint, region, ["head-object", "--bucket", BUCKET, "--key", key])
    if result.returncode != 0:
        combined = f"{result.stdout}\n{result.stderr}"
        if "NoSuchKey" in combined or "404" in combined:
            return None
        raise RuntimeError(f"head-failed:{key}:{combined[-400:]}")
    payload = json.loads(result.stdout) if result.stdout.strip().startswith("{") else {}
    header = payload.get("Header") if isinstance(payload.get("Header"), dict) else payload
    raw = header.get("Content-Length") or header.get("ContentLength")
    if isinstance(raw, list):
        raw = raw[0] if raw else None
    if raw is None:
        raise RuntimeError(f"head-missing-length:{key}")
    return int(raw)


def put_object(ossutil: str, endpoint: str, region: str, key: str, path: Path, digest: str) -> None:
    content_type = CONTENT_TYPES.get(path.suffix.lower(), "application/octet-stream")
    result = ossutil_cmd(ossutil, endpoint, region, [
        "put-object",
        "--bucket", BUCKET,
        "--key", key,
        "--body", f"file://{path.resolve()}",
        "--content-type", content_type,
        "--cache-control", "public, max-age=31536000, immutable",
        "--object-acl", "private",
        "--forbid-overwrite",
        "--metadata", f"sha256={digest}",
    ])
    if result.returncode != 0:
        combined = f"{result.stdout}\n{result.stderr}"
        if "FileAlreadyExists" in combined or "ForbidOverwrite" in combined or "already exists" in combined.lower():
            return
        raise RuntimeError(f"put-failed:{key}:{combined[-500:]}")


def sync_one(ossutil: str, endpoint: str, region: str, path: Path) -> dict[str, object]:
    key = f"{PREFIX}/{path.relative_to(LOCAL_ROOT).as_posix()}"
    digest = sha256_file(path)
    size = path.stat().st_size
    existing = head_size(ossutil, endpoint, region, key)
    if existing == size:
        return {"key": key, "sha256": digest, "bytes": size, "status": "reused"}
    if existing is not None and existing != size:
        raise RuntimeError(f"size-mismatch:{key}:{existing}!={size}")
    put_object(ossutil, endpoint, region, key, path, digest)
    return {"key": key, "sha256": digest, "bytes": size, "status": "created"}


def main() -> None:
    repo = Path(__file__).resolve().parents[2]
    os.chdir(repo)
    ossutil, endpoint, region = require_env()
    if not LOCAL_ROOT.is_dir():
        raise SystemExit(f"missing {LOCAL_ROOT}")
    files = sorted(path for path in LOCAL_ROOT.rglob("*") if path.is_file())
    if not files:
        raise SystemExit("no-local-model-release-files")
    objects: list[dict[str, object]] = []
    errors: list[str] = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(sync_one, ossutil, endpoint, region, path): path for path in files}
        for future in as_completed(futures):
            path = futures[future]
            try:
                objects.append(future.result())
                print(f"{objects[-1]['status']} {objects[-1]['key']}", flush=True)
            except Exception as error:  # noqa: BLE001
                errors.append(f"{path}: {error}")
                print(f"failed {path}: {error}", file=sys.stderr, flush=True)
    objects.sort(key=lambda item: str(item["key"]))
    receipt = {
        "schema": "act-fleet-model-oss-publication/1",
        "bucket": BUCKET,
        "prefix": f"{PREFIX}/",
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "objectCount": len(objects),
        "createdCount": sum(1 for item in objects if item["status"] == "created"),
        "reusedCount": sum(1 for item in objects if item["status"] == "reused"),
        "bytes": sum(int(item["bytes"]) for item in objects),
        "objects": objects,
        "errors": errors,
    }
    RECEIPT.parent.mkdir(parents=True, exist_ok=True)
    RECEIPT.write_text(f"{json.dumps(receipt, indent=2)}\n", encoding="utf-8")
    print(json.dumps({
        "bucket": BUCKET,
        "objectCount": receipt["objectCount"],
        "createdCount": receipt["createdCount"],
        "reusedCount": receipt["reusedCount"],
        "bytes": receipt["bytes"],
        "errorCount": len(errors),
        "receipt": str(RECEIPT),
    }))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
