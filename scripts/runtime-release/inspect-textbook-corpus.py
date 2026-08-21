#!/usr/bin/env python3
"""Credential-safe textbook corpus inspection bound to a lifecycle identity."""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict

ROOT = Path(__file__).resolve().parents[2]
LIFECYCLE_PATH = Path(__file__).with_name("runtime-blob-release-lifecycle.py")
PROVENANCE_HELPER = ROOT / "scripts/release/textbook-runtime-v2-provenance.mjs"
LOCAL_MANIFEST = ".act-runtime-release.v2.json"
FORBIDDEN = re.compile(
    r"(objectKey|/home/|/Users/|AccessKey|AKIA[0-9A-Z]{16}|X-Amz-|oss-|signed|blob-releases/|mount)",
    re.IGNORECASE,
)

SPEC = importlib.util.spec_from_file_location("runtime_blob_lifecycle_inspect", str(LIFECYCLE_PATH))
LIFECYCLE = importlib.util.module_from_spec(SPEC)
if SPEC.loader is None:
    raise SystemExit("runtime lifecycle module is unavailable")
SPEC.loader.exec_module(LIFECYCLE)


def fail(message: str) -> None:
    raise ValueError(message)


def pick_identity(lifecycle: Dict[str, Any], role: str, release_id: str | None) -> Dict[str, Any]:
    if role == "active":
        identity = lifecycle["active"]
    elif role == "rollback":
        identity = lifecycle.get("rollback")
        if identity is None:
            fail("rollback identity is absent")
    elif role == "candidate":
        identity = lifecycle.get("desired")
        if identity is None:
            fail("candidate identity is absent")
    else:
        fail("inspection role is unsupported")
    if release_id and identity["releaseId"] != release_id:
        fail("requested release does not match the lifecycle %s identity" % role)
    return identity


def read_view_identity(view_root: Path) -> Dict[str, Any]:
    manifest_path = view_root / LOCAL_MANIFEST
    if not manifest_path.is_file() or manifest_path.is_symlink():
        fail("materialized view manifest is missing")
    raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    for field in ("releaseId", "manifestSha256", "treeSha256"):
        if not isinstance(raw.get(field), str) or not raw[field]:
            fail("materialized view identity field is missing: %s" % field)
    input_ids = []
    for item in raw.get("files") or []:
        if not isinstance(item, dict):
            continue
        source = item.get("source")
        if isinstance(source, dict) and isinstance(source.get("externalInputId"), str):
            input_ids.append(source["externalInputId"])
    unique_ids = sorted(set(input_ids))
    return {
        "releaseId": raw["releaseId"],
        "manifestSha256": raw["manifestSha256"],
        "treeSha256": raw["treeSha256"],
        "externalInputId": unique_ids[0] if len(unique_ids) == 1 else None,
    }


def run_node_inspect(view_root: Path) -> Dict[str, Any]:
    result = subprocess.run(
        ["node", str(PROVENANCE_HELPER), "inspect-corpus", "--view-root", str(view_root)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        fail(result.stderr.strip() or "textbook corpus inspect failed")
    payload = json.loads(result.stdout)
    if not isinstance(payload, dict):
        fail("textbook corpus inspect returned a non-object")
    return payload


def safe_report(payload: Dict[str, Any]) -> Dict[str, Any]:
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    if FORBIDDEN.search(encoded):
        fail("textbook corpus report contained a forbidden credential or path field")
    return payload


def inspect(args: argparse.Namespace) -> Dict[str, Any]:
    state_dir = Path(args.state_dir)
    view_root = Path(args.view_root)
    lock = LIFECYCLE.locked(state_dir)
    try:
        before = LIFECYCLE.read_v2(state_dir)
        before_digest = LIFECYCLE.digest(before)
        identity = pick_identity(before, args.role, args.release_id)
        view_identity = read_view_identity(view_root)
        if (
            view_identity["releaseId"] != identity["releaseId"]
            or view_identity["manifestSha256"] != identity["manifestSha256"]
            or view_identity["treeSha256"] != identity["treeSha256"]
        ):
            fail("materialized view identity does not match the lifecycle %s identity" % args.role)
        corpus = run_node_inspect(view_root)
        after = LIFECYCLE.read_v2(state_dir)
        if after["generation"] != before["generation"] or LIFECYCLE.digest(after) != before_digest:
            fail("lifecycle drifted during textbook corpus inspection")
        report = {
            "status": "ready" if corpus.get("runtimeIndexConsistent") else "inconsistent",
            "lifecycleState": args.role,
            "releaseId": identity["releaseId"],
            "manifestSha256": identity["manifestSha256"],
            "treeSha256": identity["treeSha256"],
            "externalInputId": view_identity.get("externalInputId"),
            "generation": before["generation"],
            "provenanceGeneration": corpus.get("provenanceGeneration"),
            "resourceSetId": corpus.get("resourceSetId"),
            "bookIds": corpus.get("bookIds"),
            "authoringSourceRevision": corpus.get("authoringSourceRevision"),
            "inputDigest": corpus.get("inputDigest"),
            "inputFileCount": corpus.get("inputFileCount"),
            "runtimeIndexConsistent": corpus.get("runtimeIndexConsistent"),
        }
        return safe_report(report)
    finally:
        lock.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect a lifecycle-bound textbook corpus")
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--view-root", required=True)
    parser.add_argument("--role", required=True, choices=("active", "rollback", "candidate"))
    parser.add_argument("--release-id")
    args = parser.parse_args()
    try:
        print(json.dumps(inspect(args), ensure_ascii=False, separators=(",", ":"), sort_keys=True))
    except Exception as error:
        sys.stderr.write("%s\n" % error)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
