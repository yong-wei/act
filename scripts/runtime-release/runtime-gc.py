#!/usr/bin/env python3
"""Independent runtime GC. Default dry-run retains every blob."""

import argparse
import importlib.util
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import runtime_media_storage as MEDIA
from runtime_storage_io import BodyStore, body_digest
from runtime_storage_lock import HostStorageLock, add_host_arguments


SCRIPT_DIR = Path(__file__).resolve().parent


def load_materializer():
    spec = importlib.util.spec_from_file_location("materialize_runtime", str(SCRIPT_DIR / "materialize-runtime.py"))
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


MATERIALIZE = load_materializer()
spec = importlib.util.spec_from_file_location('gc_storage_lifecycle', str(SCRIPT_DIR / 'storage-lifecycle.py'))
STORAGE = importlib.util.module_from_spec(spec)
spec.loader.exec_module(STORAGE)


SESSION_SQL = STORAGE.SESSION_SQL
SESSION_DISCOVERY_UNAVAILABLE = (
    "session release discovery unavailable\n"
    "set DATABASE_URL or pass --session-release / --no-session-refs"
)


class GcError(RuntimeError):
    def __init__(self, message, code=2):
        super(GcError, self).__init__(message)
        self.code = code


def read_pointers(state_dir):
    try:
        return MATERIALIZE.read_host_pointers(state_dir)
    except MATERIALIZE.MaterializeError as error:
        raise GcError(str(error))


def list_release_ids(store, state_dir):
    found = set()
    releases = store / "runtime" / "blob-releases"
    if releases.is_dir():
        found.update(path.name for path in releases.iterdir() if path.is_dir() and not path.is_symlink() and MEDIA.RELEASE_ID.fullmatch(path.name))
    views = state_dir / "views"
    if views.is_dir():
        found.update(path.name for path in views.iterdir() if path.is_dir() and not path.is_symlink() and MEDIA.RELEASE_ID.fullmatch(path.name))
    if state_dir.is_dir():
        found.update(
            path.name
            for path in state_dir.iterdir()
            if path.is_dir()
            and not path.is_symlink()
            and path.name not in MATERIALIZE.POINTER_NAMES
            and MEDIA.RELEASE_ID.fullmatch(path.name)
        )
    return sorted(found)


def query_session_releases(database_url):
    process = subprocess.run(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-Atc", SESSION_SQL],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
    )
    if process.returncode != 0:
        raise GcError("session release discovery failed")
    return set(line.strip() for line in process.stdout.splitlines() if line.strip())


def resolve_session_releases(args):
    explicit = set(item for item in args.session_release if item)
    if args.no_session_refs:
        return explicit
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return explicit | query_session_releases(database_url)
    if args.execute:
        raise GcError(SESSION_DISCOVERY_UNAVAILABLE)
    return explicit


def plan(args):
    store = Path(args.store_dir)
    state_dir = Path(args.state_dir)
    pointers = read_pointers(state_dir)
    session_releases = resolve_session_releases(args)
    retained = set(item for item in (pointers["current"], pointers["previous"]) + tuple(args.pin) + tuple(session_releases) if item)
    retained.update(STORAGE.protected_manifests(store, state_dir, session_releases, args.pin,
                                               getattr(args, 'developer_lease_store', None)))
    releases = list_release_ids(store, state_dir)
    removable = [release_id for release_id in releases if release_id not in retained]
    return {
        "action": "gc",
        "dryRun": not args.execute,
        "current": pointers["current"],
        "previous": pointers["previous"],
        "sessionReleases": sorted(session_releases),
        "retained": sorted(retained),
        "removableReleases": removable,
        "blobsDeleted": 0,
    }


def unmount_helper(view):
    for name in (MATERIALIZE.HELPER_NAME, MEDIA.MEDIA_HELPER):
        helper = view / name
        if not os.path.ismount(str(helper)):
            continue
        process = subprocess.run(["umount", str(helper)], check=False, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, universal_newlines=True)
        if process.returncode != 0 or os.path.ismount(str(helper)):
            raise GcError("unable to unmount helper before deleting view: %s" % helper)


def execute(store, state_dir, removable, retained):
    protected = set(item for item in retained if item)
    for release_id in removable:
        if release_id in protected:
            raise GcError("refusing to delete a retained release: %s" % release_id)
        view = state_dir / "views" / release_id
        if view.exists():
            unmount_helper(view)
            shutil.rmtree(str(view))
        sibling = state_dir / release_id
        if sibling.is_dir() and not sibling.is_symlink() and sibling.name not in MATERIALIZE.POINTER_NAMES:
            unmount_helper(sibling)
            shutil.rmtree(str(sibling))
        release_dir = store / "runtime" / "blob-releases" / release_id
        if release_dir.exists():
            shutil.rmtree(str(release_dir))


def build_parser():
    parser = argparse.ArgumentParser(description="Report or remove unreferenced Runtime views; body GC requires --reclaim-blobs.")
    parser.add_argument("--store-dir", required=True)
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--pin", action="append", default=[])
    parser.add_argument("--session-release", action="append", default=[])
    parser.add_argument("--no-session-refs", action="store_true")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument('--reclaim-blobs', action='store_true')
    parser.add_argument('--media-store-dir')
    parser.add_argument('--oss-bucket', choices=[MEDIA.SOURCE_BUCKET])
    parser.add_argument('--ossutil', default='ossutil')
    parser.add_argument('--ossutil-arg', action='append', default=[])
    parser.add_argument('--media-ossutil-arg', action='append', default=[])
    parser.add_argument('--receipt')
    add_host_arguments(parser)
    return parser


def reclaim(args):
    if args.execute and not args.receipt:
        raise GcError('--receipt is required for body collection')
    if args.oss_bucket and not args.lifecycle_host:
        raise GcError('--lifecycle-host is required for coordinated OSS body collection')
    private = BodyStore(MEDIA.SOURCE_BUCKET, None if args.oss_bucket else args.store_dir, args.ossutil, args.ossutil_arg)
    public = BodyStore(MEDIA.MEDIA_BUCKET, None if args.oss_bucket else args.media_store_dir or args.store_dir,
                       args.ossutil, args.media_ossutil_arg)
    stores = {private.bucket: private, public.bucket: public}
    with HostStorageLock(args) as lock:
        snapshot = lock.snapshot
        retained = snapshot['protected']
        digests = set(item['sha256'] for manifest in retained.values() for item in manifest['files'])
        listings = {bucket: store.list() for bucket, store in stores.items()}
        candidates = [row for rows in listings.values() for row in rows if body_digest(row['bucket'], row['key']) not in digests]
        result = {'schemaVersion': 'act-runtime-body-gc.v1', 'action': 'gc', 'dryRun': not args.execute,
                  'current': snapshot['pointers']['current'], 'previous': snapshot['pointers']['previous'],
                  'retained': sorted(retained), 'protectedManifests': {key: value['manifestSha256'] for key, value in retained.items()},
                  'catalogSha256': snapshot['catalogSha256'], 'bodyCandidates': candidates,
                  'candidateBytes': sum(row['sizeBytes'] for row in candidates), 'blobsDeleted': 0, 'releasedBytes': 0,
                  'deleted': [], 'complete': False}
        if args.receipt:
            MEDIA.atomic_json(args.receipt, result)
        if args.execute:
            # Revalidate the complete object snapshot while retaining the host lock.
            if any(stores[bucket].list() != rows for bucket, rows in listings.items()):
                raise GcError('body-object-list-changed-before-delete')
            def confirmed(row):
                result['deleted'].append(row)
                result['blobsDeleted'] += 1
                result['releasedBytes'] += row['sizeBytes']
            for bucket, store in stores.items():
                store.delete_many([row for row in candidates if row['bucket'] == bucket], confirmed,
                                  lambda: MEDIA.atomic_json(args.receipt, result))
            catalog = snapshot['catalog']
            if catalog:
                catalog = dict(catalog, objects=[row for row in catalog['objects'] if row['sha256'] in digests])
            lock.complete(catalog)
        result['complete'] = True
        if args.receipt:
            MEDIA.atomic_json(args.receipt, result)
        return result


def main(argv=None):
    args = build_parser().parse_args(argv)
    if args.dry_run and args.execute:
        sys.stderr.write("--dry-run cannot be combined with --execute\n")
        return 2
    try:
        if args.reclaim_blobs:
            result = reclaim(args)
        elif args.execute:
            with MATERIALIZE.selection_lock(Path(args.state_dir)):
                result = plan(args)
                execute(Path(args.store_dir), Path(args.state_dir), result["removableReleases"], result["retained"])
                result["dryRun"] = False
        else:
            result = plan(args)
    except (GcError, MEDIA.MediaStorageError, MATERIALIZE.MaterializeError, OSError, ValueError) as error:
        sys.stderr.write("%s\n" % error)
        return getattr(error, 'code', 2)
    sys.stdout.write(json.dumps(result, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
