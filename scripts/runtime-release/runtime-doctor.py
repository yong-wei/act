#!/usr/bin/env python3
"""Independent runtime auditor. Publish and activate never call this tool."""

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent


def load_materializer():
    spec = importlib.util.spec_from_file_location("materialize_runtime", str(SCRIPT_DIR / "materialize-runtime.py"))
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


MATERIALIZE = load_materializer()


class DoctorError(RuntimeError):
    def __init__(self, message, code=2):
        super(DoctorError, self).__init__(message)
        self.code = code


def read_pointers(state_dir):
    try:
        return MATERIALIZE.read_host_pointers(state_dir)
    except MATERIALIZE.MaterializeError as error:
        raise DoctorError(str(error))


def hash_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def audit(args):
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
        except OSError:
            raise DoctorError("blob is not visible: %s" % item["objectKey"])
        if size != item["sizeBytes"]:
            raise DoctorError("blob size mismatch: %s" % item["objectKey"])
        checked += 1
        if args.full:
            digest = hash_file(blob)
            hashed += 1
            if digest != item["sha256"]:
                raise DoctorError("blob hash mismatch: %s" % item["objectKey"])
    return {
        "action": "doctor",
        "releaseId": release_id,
        "full": bool(args.full),
        "checked": checked,
        "hashed": hashed,
        "current": pointers.get("current"),
        "previous": pointers.get("previous"),
    }


def build_parser():
    parser = argparse.ArgumentParser(description="Audit a published runtime release without changing pointers.")
    parser.add_argument("--store-dir", required=True)
    parser.add_argument("--state-dir")
    parser.add_argument("--release-id")
    parser.add_argument("--full", action="store_true")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    before = read_pointers(Path(args.state_dir)) if args.state_dir else None
    try:
        result = audit(args)
        if before is not None:
            after = read_pointers(Path(args.state_dir))
            if after != before:
                raise DoctorError("doctor must not change pointers")
    except (DoctorError, MATERIALIZE.MaterializeError) as error:
        sys.stderr.write("%s\n" % error)
        return getattr(error, "code", 2)
    sys.stdout.write(json.dumps(result, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
