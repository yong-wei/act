#!/usr/bin/env python3
"""Credential-safe textbook corpus inspection bound to current/previous pointers."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict


ROOT = Path(__file__).resolve().parents[2]
PROVENANCE_HELPER = ROOT / "scripts/release/textbook-runtime-v2-provenance.mjs"
LOCAL_MANIFEST = ".act-runtime-release.v2.json"
FORBIDDEN = re.compile(
    r"(objectKey|/home/|/Users/|AccessKey|AKIA[0-9A-Z]{16}|X-Amz-|oss-|signed|blob-releases/|mount)",
    re.IGNORECASE,
)
ROLE_ALIASES = {
    "current": "current",
    "previous": "previous",
    "active": "current",
    "rollback": "previous",
}


def fail(message: str) -> None:
    raise ValueError(message)


def read_pointers(state_dir: Path) -> dict[str, str | None]:
    path = state_dir / "pointers.json"
    if not path.is_file():
        fail("runtime pointers are missing")
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {"current": raw.get("current"), "previous": raw.get("previous")}


def pick_release_id(pointers: dict[str, str | None], role: str, release_id: str | None) -> str:
    pointer_role = ROLE_ALIASES.get(role)
    if pointer_role is None:
        fail("inspection role is unsupported")
    selected = pointers.get(pointer_role)
    if not selected:
        fail("%s pointer is absent" % pointer_role)
    if release_id and selected != release_id:
        fail("requested release does not match the %s pointer" % pointer_role)
    return selected


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
    before = read_pointers(state_dir)
    release_id = pick_release_id(before, args.role, args.release_id)
    view_identity = read_view_identity(view_root)
    if view_identity["releaseId"] != release_id:
        fail("materialized view identity does not match the %s pointer" % ROLE_ALIASES[args.role])
    corpus = run_node_inspect(view_root)
    after = read_pointers(state_dir)
    if after != before:
        fail("runtime pointers drifted during textbook corpus inspection")
    report = {
        "status": "ready" if corpus.get("runtimeIndexConsistent") else "inconsistent",
        "lifecycleState": args.role,
        "releaseId": release_id,
        "manifestSha256": view_identity["manifestSha256"],
        "treeSha256": view_identity["treeSha256"],
        "externalInputId": view_identity.get("externalInputId"),
        "provenanceGeneration": corpus.get("provenanceGeneration"),
        "resourceSetId": corpus.get("resourceSetId"),
        "bookIds": corpus.get("bookIds"),
        "authoringSourceRevision": corpus.get("authoringSourceRevision"),
        "inputDigest": corpus.get("inputDigest"),
        "inputFileCount": corpus.get("inputFileCount"),
        "runtimeIndexConsistent": corpus.get("runtimeIndexConsistent"),
    }
    return safe_report(report)


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect a pointer-bound textbook corpus")
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--view-root", required=True)
    parser.add_argument("--role", required=True, choices=("current", "previous", "active", "rollback"))
    parser.add_argument("--release-id")
    args = parser.parse_args()
    try:
        print(json.dumps(inspect(args), ensure_ascii=False, separators=(",", ":"), sort_keys=True))
    except Exception as error:
        sys.stderr.write("%s\n" % error)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
