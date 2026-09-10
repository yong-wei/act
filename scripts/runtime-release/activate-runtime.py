#!/usr/bin/env python3
"""Activate or roll back a published runtime release with current/previous pointers."""

import argparse
import fcntl
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_SENTINELS = (
    "lessons/1-1/lesson.json",
    "lessons/1-1/interactive-manifest.json",
    "knowledge/authority-domain-shards/current.json",
    "knowledge/cards/authority/status.json",
    "knowledge/cards/authority/inventory.json",
)


def load_materializer():
    spec = importlib.util.spec_from_file_location("materialize_runtime", str(SCRIPT_DIR / "materialize-runtime.py"))
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


MATERIALIZE = load_materializer()


class ActivateError(RuntimeError):
    def __init__(self, message, code=2):
        super(ActivateError, self).__init__(message)
        self.code = code


def pointers_path(state_dir):
    return state_dir / "pointers.json"


def read_pointers(state_dir):
    return MATERIALIZE.read_host_pointers(state_dir)


def write_pointers_atomic(state_dir, pointers):
    state_dir.mkdir(parents=True, exist_ok=True)
    payload = {"current": pointers["current"], "previous": pointers["previous"]}
    temporary = pointers_path(state_dir).with_name("pointers.json.tmp")
    temporary.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(str(temporary), str(pointers_path(state_dir)))


def is_production_view_root(state_dir):
    resolved = state_dir.as_posix().rstrip("/")
    return state_dir.name == "blob-views" or resolved.endswith("/data/runtime/blob-views")


def selection_lock_path(state_dir):
    override = os.environ.get("ACT_RUNTIME_SELECTION_LOCK")
    if override:
        return Path(override)
    if state_dir.name == "blob-views":
        return state_dir.parent / ".act-runtime-selection.lock"
    return state_dir / ".act-runtime-selection.lock"


class selection_lock(object):
    def __init__(self, state_dir):
        self.path = selection_lock_path(state_dir)
        self.handle = None

    def __enter__(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.handle = open(str(self.path), "a+")
        fcntl.flock(self.handle.fileno(), fcntl.LOCK_EX)
        return self

    def __exit__(self, exc_type, exc, tb):
        if self.handle is not None:
            fcntl.flock(self.handle.fileno(), fcntl.LOCK_UN)
            self.handle.close()
            self.handle = None
        return False


def optional_command(*values):
    for value in values:
        if value:
            return value
    return None


def retarget_pointer(state_dir, name, view):
    link = state_dir / name
    if view is None:
        if link.exists() or link.is_symlink():
            link.unlink()
        return
    temporary = state_dir / ("%s.tmp" % name)
    if temporary.exists() or temporary.is_symlink():
        temporary.unlink()
    os.symlink(os.path.relpath(str(view), str(state_dir)), str(temporary))
    os.replace(str(temporary), str(link))


def retarget_selection(state_dir, current_view, previous_release_id):
    retarget_pointer(state_dir, "current", current_view)
    retarget_pointer(state_dir, "live", current_view)
    retarget_pointer(state_dir, "previous", MATERIALIZE.existing_view(state_dir, previous_release_id))


def commit_selection(state_dir, pointers, current_view):
    write_pointers_atomic(state_dir, pointers)
    if current_view is None:
        retarget_pointer(state_dir, "current", None)
        retarget_pointer(state_dir, "live", None)
        retarget_pointer(state_dir, "previous", None)
        return
    retarget_selection(state_dir, current_view, pointers.get("previous"))


def restore_selection(state_dir, pointers):
    current_id = pointers.get("current")
    if not current_id:
        commit_selection(state_dir, {"current": None, "previous": None}, None)
        return
    current_view = MATERIALIZE.existing_view(state_dir, current_id)
    if current_view is None:
        raise ActivateError("unable to restore previous current view after consumer reload failure")
    commit_selection(state_dir, pointers, current_view)


def open_sentinels(view, manifest, requested):
    bindings = MATERIALIZE.file_bindings(manifest)
    names = requested or [path for path in DEFAULT_SENTINELS if path in bindings]
    if not names:
        raise ActivateError("no sentinels declared for this release")
    opened = []
    for relative in names:
        if relative not in bindings:
            raise ActivateError("sentinel is not in the candidate manifest: %s" % relative)
        path = view / relative
        try:
            with path.open("rb") as handle:
                if handle.read(1) == b"" and bindings[relative]["sizeBytes"] > 0:
                    raise ActivateError("sentinel is empty: %s" % relative)
        except OSError:
            raise ActivateError("sentinel is not readable: %s" % relative)
        opened.append(relative)
    return opened


def run_shell(command, env, error):
    process = subprocess.run(command, shell=True, check=False, env=env, universal_newlines=True)
    if process.returncode != 0:
        raise ActivateError(error)


def run_smoke(command, view, required):
    if not command:
        if required:
            raise ActivateError("runtime smoke is required before selecting current")
        return
    env = os.environ.copy()
    candidate = str(view.resolve())
    env["RUNTIME_CONTENT_DIR"] = candidate
    env["ACT_RUNTIME_CANDIDATE_VIEW"] = candidate
    run_shell(command, env, "application runtime smoke failed")


def smoke_required(args, state_dir):
    return bool(args.require_smoke) or os.environ.get("ACT_RUNTIME_REQUIRE_SMOKE") == "1" or is_production_view_root(state_dir)


def resolve_blob_root(args):
    return optional_command(args.blob_root, os.environ.get("ACT_RUNTIME_BLOB_ROOT"))


def default_bind_helper_command(state_dir, blob_root):
    if not (is_production_view_root(state_dir) and blob_root):
        return None
    return "bash %s" % (SCRIPT_DIR / "bind-runtime-blob-view-helper.sh")


def resolve_bind_helper(args, state_dir, blob_root):
    return optional_command(args.bind_helper, os.environ.get("ACT_RUNTIME_BIND_HELPER"), default_bind_helper_command(state_dir, blob_root))


def run_bind_helper(command, view, blob_root):
    if not command:
        return
    env = os.environ.copy()
    candidate = str(view.resolve())
    env["ACT_RUNTIME_CANDIDATE_VIEW"] = candidate
    env["ACT_RUNTIME_BLOB_VIEW"] = candidate
    if blob_root:
        env["ACT_RUNTIME_BLOB_ROOT"] = blob_root
    run_shell(command, env, "candidate helper bind failed")


def load_release_manifest(store, state_dir, release_id, manifest_override):
    if manifest_override:
        return MATERIALIZE.load_manifest(Path(manifest_override))
    view = MATERIALIZE.existing_view(state_dir, release_id)
    if view is not None:
        marker = view / MATERIALIZE.MATERIALIZED_MANIFEST
        if marker.is_file():
            return MATERIALIZE.load_manifest(marker)
    return MATERIALIZE.load_manifest(MATERIALIZE.manifest_path(store, release_id))


def activate(args):
    store = Path(args.store_dir)
    state_dir = Path(args.state_dir)
    blob_root = resolve_blob_root(args)
    pointers = read_pointers(state_dir)
    candidate = load_release_manifest(store, state_dir, args.release_id, args.manifest)
    if candidate["releaseId"] != args.release_id:
        raise ActivateError("candidate manifest releaseId does not match --release-id")
    current_manifest = None
    if pointers["current"]:
        current_manifest = load_release_manifest(store, state_dir, pointers["current"], None)
    delta = MATERIALIZE.changed_paths(current_manifest, candidate)
    MATERIALIZE.assert_blobs_visible(store, candidate, delta, blob_root=blob_root)
    view = MATERIALIZE.materialize_view(store, candidate, state_dir / "views" / candidate["releaseId"], blob_root=blob_root)
    run_bind_helper(resolve_bind_helper(args, state_dir, blob_root), view, blob_root)
    opened = open_sentinels(view, candidate, args.sentinel)
    smoke = optional_command(args.smoke, os.environ.get("ACT_RUNTIME_SMOKE"))
    run_smoke(smoke, view, smoke_required(args, state_dir))
    next_pointers = {"current": candidate["releaseId"], "previous": pointers["current"]}
    commit_selection(state_dir, next_pointers, view)
    reload = optional_command(args.reload_consumers, os.environ.get("ACT_RUNTIME_RELOAD_CONSUMERS"))
    if reload:
        try:
            run_shell(reload, None, "consumer reload failed after current pointer commit")
        except ActivateError:
            restore_selection(state_dir, pointers)
            raise
    return {
        "action": "activate",
        "current": next_pointers["current"],
        "previous": next_pointers["previous"],
        "deltaCount": len(delta),
        "sentinels": opened,
        "viewPath": str(view.resolve()),
    }


def rollback(args):
    state_dir = Path(args.state_dir)
    pointers = read_pointers(state_dir)
    if not pointers["previous"]:
        raise ActivateError("no previous release to restore")
    previous_view = MATERIALIZE.existing_view(state_dir, pointers["previous"])
    if previous_view is None:
        raise ActivateError("previous view is not materialized; rollback will not rebuild it")
    next_pointers = {"current": pointers["previous"], "previous": pointers["current"]}
    commit_selection(state_dir, next_pointers, previous_view)
    reload = optional_command(args.reload_consumers, os.environ.get("ACT_RUNTIME_RELOAD_CONSUMERS"))
    if reload:
        try:
            run_shell(reload, None, "consumer reload failed after current pointer commit")
        except ActivateError:
            current_view = MATERIALIZE.existing_view(state_dir, pointers["current"])
            if current_view is None:
                raise
            commit_selection(state_dir, pointers, current_view)
            raise
    return {
        "action": "rollback",
        "current": next_pointers["current"],
        "previous": next_pointers["previous"],
        "deltaCount": 0,
        "sentinels": [],
        "viewPath": str(previous_view.resolve()),
    }


def build_parser():
    parser = argparse.ArgumentParser(description="Switch current/previous runtime pointers.")
    parser.add_argument("--store-dir", required=True)
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--release-id")
    parser.add_argument("--manifest")
    parser.add_argument("--blob-root")
    parser.add_argument("--rollback", action="store_true")
    parser.add_argument("--sentinel", action="append", default=[])
    parser.add_argument("--smoke")
    parser.add_argument("--require-smoke", action="store_true")
    parser.add_argument("--reload-consumers")
    parser.add_argument("--bind-helper")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        with selection_lock(Path(args.state_dir)):
            if args.rollback:
                if args.release_id:
                    raise ActivateError("--rollback cannot be combined with --release-id")
                result = rollback(args)
            else:
                if not args.release_id:
                    raise ActivateError("--release-id is required unless --rollback is set")
                result = activate(args)
    except (ActivateError, MATERIALIZE.MaterializeError) as error:
        sys.stderr.write("%s\n" % error)
        return getattr(error, "code", 2)
    sys.stdout.write(json.dumps(result, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
