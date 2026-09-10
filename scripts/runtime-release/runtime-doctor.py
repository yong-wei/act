#!/usr/bin/env python3
"""Independent runtime auditor. Publish and activate never call this tool."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent


def load_materializer():
    import importlib.util

    spec = importlib.util.spec_from_file_location("materialize_runtime", SCRIPT_DIR / "materialize-runtime.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


MATERIALIZE = load_materializer()


class DoctorError(RuntimeError):
    def __init__(self, message: str, *, code: int = 2) -> None:
        super().__init__(message)
        self.code = code


def read_pointers(state_dir: Path) -> dict[str, str | None]:
    path = state_dir / "pointers.json"
    if not path.is_file():
        return {"current": None, "previous": None}
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {"current": raw.get("current"), "previous": raw.get("previous")}


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def audit(args: argparse.Namespace) -> dict[str, Any]:
    store = Path(args.store_dir)
    release_id = args.release_id
    if not release_id:
        if not args.state_dir:
            raise DoctorError("--release-id is required unless --state-dir has a current pointer")
        pointers = read_pointers(Path(args.state_dir))
        if pointers["current"] is None:
            raise DoctorError("no current release to audit")
        release_id = pointers["current"]
    pointers = read_pointers(Path(args.state_dir)) if args.state_dir else {"current": None, "previous": None}
    manifest = MATERIALIZE.load_manifest(MATERIALIZE.manifest_path(store, release_id))
    if manifest["releaseId"] != release_id:
        raise DoctorError("manifest releaseId does not match the requested release")
    checked = 0
    hashed = 0
    for item in manifest["files"]:
        blob = MATERIALIZE.blob_path(store, item["sha256"])
        try:
            size = blob.stat().st_size
        except OSError as error:
            raise DoctorError(f"blob is not visible: {item['objectKey']}") from error
        if size != item["sizeBytes"]:
            raise DoctorError(f"blob size mismatch: {item['objectKey']}")
        checked += 1
        if args.full:
            digest = hash_file(blob)
            hashed += 1
            if digest != item["sha256"]:
                raise DoctorError(f"blob hash mismatch: {item['objectKey']}")
    return {
        "action": "doctor",
        "releaseId": release_id,
        "full": bool(args.full),
        "checked": checked,
        "hashed": hashed,
        "current": pointers.get("current"),
        "previous": pointers.get("previous"),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Audit a published runtime release without changing pointers.")
    parser.add_argument("--store-dir", required=True)
    parser.add_argument("--state-dir")
    parser.add_argument("--release-id")
    parser.add_argument("--full", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    before = read_pointers(Path(args.state_dir)) if args.state_dir else None
    try:
        result = audit(args)
        if before is not None:
            after = read_pointers(Path(args.state_dir))
            if after != before:
                raise DoctorError("doctor must not change pointers")
    except (DoctorError, MATERIALIZE.MaterializeError) as error:
        sys.stderr.write(f"{error}\n")
        return getattr(error, "code", 2)
    sys.stdout.write(json.dumps(result, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
