#!/usr/bin/env python3
"""Activate or roll back a published runtime release with current/previous pointers."""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_SENTINELS = (
    "lessons/1-1/lesson.json",
    "lessons/1-1/interactive-manifest.json",
    "knowledge/authority-domain-shards/current.json",
    "knowledge/cards/authority/status.json",
    "knowledge/cards/authority/inventory.json",
)


def load_materializer():
    spec = importlib.util.spec_from_file_location("materialize_runtime", SCRIPT_DIR / "materialize-runtime.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


MATERIALIZE = load_materializer()


class ActivateError(RuntimeError):
    def __init__(self, message: str, *, code: int = 2) -> None:
        super().__init__(message)
        self.code = code


def pointers_path(state_dir: Path) -> Path:
    return state_dir / "pointers.json"


def read_pointers(state_dir: Path) -> dict[str, str | None]:
    path = pointers_path(state_dir)
    if not path.is_file():
        return {"current": None, "previous": None}
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {"current": raw.get("current"), "previous": raw.get("previous")}


def write_pointers_atomic(state_dir: Path, pointers: dict[str, str | None]) -> None:
    state_dir.mkdir(parents=True, exist_ok=True)
    payload = {"current": pointers["current"], "previous": pointers["previous"]}
    temporary = pointers_path(state_dir).with_name("pointers.json.tmp")
    temporary.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(temporary, pointers_path(state_dir))


def retarget_live(state_dir: Path, view: Path) -> None:
    live = state_dir / "live"
    temporary = state_dir / "live.tmp"
    if temporary.exists() or temporary.is_symlink():
        temporary.unlink()
    os.symlink(view, temporary)
    os.replace(temporary, live)


def open_sentinels(view: Path, manifest: dict[str, Any], requested: list[str]) -> list[str]:
    bindings = MATERIALIZE.file_bindings(manifest)
    names = requested or [path for path in DEFAULT_SENTINELS if path in bindings]
    if not names:
        raise ActivateError("no sentinels declared for this release")
    opened = []
    for relative in names:
        if relative not in bindings:
            raise ActivateError(f"sentinel is not in the candidate manifest: {relative}")
        path = view / relative
        try:
            with path.open("rb") as handle:
                if handle.read(1) == b"" and bindings[relative]["sizeBytes"] > 0:
                    raise ActivateError(f"sentinel is empty: {relative}")
        except OSError as error:
            raise ActivateError(f"sentinel is not readable: {relative}") from error
        opened.append(relative)
    return opened


def run_smoke(command: str | None) -> None:
    if not command:
        return
    process = subprocess.run(command, shell=True, check=False)
    if process.returncode != 0:
        raise ActivateError("application runtime smoke failed")


def activate(args: argparse.Namespace) -> dict[str, Any]:
    store = Path(args.store_dir)
    state_dir = Path(args.state_dir)
    pointers = read_pointers(state_dir)
    candidate = MATERIALIZE.load_manifest(MATERIALIZE.manifest_path(store, args.release_id))
    if candidate["releaseId"] != args.release_id:
        raise ActivateError("candidate manifest releaseId does not match --release-id")
    current_manifest = None
    if pointers["current"]:
        current_manifest = MATERIALIZE.load_manifest(MATERIALIZE.manifest_path(store, pointers["current"]))
    delta = MATERIALIZE.changed_paths(current_manifest, candidate)
    MATERIALIZE.assert_blobs_visible(store, candidate, delta)
    view = MATERIALIZE.materialize_view(store, candidate, state_dir / "views" / candidate["releaseId"])
    opened = open_sentinels(view, candidate, args.sentinel)
    try:
        run_smoke(args.smoke)
    except ActivateError:
        raise
    next_pointers = {"current": candidate["releaseId"], "previous": pointers["current"]}
    write_pointers_atomic(state_dir, next_pointers)
    retarget_live(state_dir, view)
    return {
        "action": "activate",
        "current": next_pointers["current"],
        "previous": next_pointers["previous"],
        "deltaCount": len(delta),
        "sentinels": opened,
    }


def rollback(args: argparse.Namespace) -> dict[str, Any]:
    state_dir = Path(args.state_dir)
    pointers = read_pointers(state_dir)
    if not pointers["previous"]:
        raise ActivateError("no previous release to restore")
    previous_view = state_dir / "views" / pointers["previous"]
    if not previous_view.is_dir():
        raise ActivateError("previous view is not materialized; rollback will not rebuild it")
    next_pointers = {"current": pointers["previous"], "previous": pointers["current"]}
    write_pointers_atomic(state_dir, next_pointers)
    retarget_live(state_dir, previous_view)
    return {
        "action": "rollback",
        "current": next_pointers["current"],
        "previous": next_pointers["previous"],
        "deltaCount": 0,
        "sentinels": [],
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Switch current/previous runtime pointers.")
    parser.add_argument("--store-dir", required=True)
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--release-id")
    parser.add_argument("--rollback", action="store_true")
    parser.add_argument("--sentinel", action="append", default=[])
    parser.add_argument("--smoke")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.rollback:
            if args.release_id:
                raise ActivateError("--rollback cannot be combined with --release-id")
            result = rollback(args)
        else:
            if not args.release_id:
                raise ActivateError("--release-id is required unless --rollback is set")
            result = activate(args)
    except (ActivateError, MATERIALIZE.MaterializeError) as error:
        sys.stderr.write(f"{error}\n")
        return getattr(error, "code", 2)
    sys.stdout.write(json.dumps(result, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
