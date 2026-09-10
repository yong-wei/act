#!/usr/bin/env python3
"""Independent runtime GC. Default dry-run retains every blob."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import Any


class GcError(RuntimeError):
    def __init__(self, message: str, *, code: int = 2) -> None:
        super().__init__(message)
        self.code = code


def read_pointers(state_dir: Path) -> dict[str, str | None]:
    path = state_dir / "pointers.json"
    if not path.is_file():
        return {"current": None, "previous": None}
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {"current": raw.get("current"), "previous": raw.get("previous")}


def list_release_ids(store: Path, state_dir: Path) -> list[str]:
    found: set[str] = set()
    releases = store / "runtime" / "blob-releases"
    if releases.is_dir():
        found.update(path.name for path in releases.iterdir() if path.is_dir())
    views = state_dir / "views"
    if views.is_dir():
        found.update(path.name for path in views.iterdir() if path.is_dir())
    return sorted(found)


def plan(args: argparse.Namespace) -> dict[str, Any]:
    store = Path(args.store_dir)
    state_dir = Path(args.state_dir)
    pointers = read_pointers(state_dir)
    retained = {item for item in (pointers["current"], pointers["previous"], *args.pin, *args.session_release) if item}
    releases = list_release_ids(store, state_dir)
    removable = [release_id for release_id in releases if release_id not in retained]
    return {
        "action": "gc",
        "dryRun": not args.execute,
        "current": pointers["current"],
        "previous": pointers["previous"],
        "retained": sorted(retained),
        "removableReleases": removable,
        "blobsDeleted": 0,
    }


def execute(store: Path, state_dir: Path, removable: list[str]) -> None:
    for release_id in removable:
        view = state_dir / "views" / release_id
        if view.exists():
            shutil.rmtree(view)
        release_dir = store / "runtime" / "blob-releases" / release_id
        if release_dir.exists():
            shutil.rmtree(release_dir)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Report or remove unreferenced runtime releases. Never deletes blobs.")
    parser.add_argument("--store-dir", required=True)
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--pin", action="append", default=[])
    parser.add_argument("--session-release", action="append", default=[])
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.dry_run and args.execute:
        sys.stderr.write("--dry-run cannot be combined with --execute\n")
        return 2
    try:
        result = plan(args)
        if args.execute:
            execute(Path(args.store_dir), Path(args.state_dir), result["removableReleases"])
            result["dryRun"] = False
    except GcError as error:
        sys.stderr.write(f"{error}\n")
        return error.code
    sys.stdout.write(json.dumps(result, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
