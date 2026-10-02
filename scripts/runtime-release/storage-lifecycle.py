#!/usr/bin/env python3
"""Shared host lock and bounded retention for publication and body collection."""

import argparse
import importlib.util
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
import runtime_media_storage as MEDIA

spec = importlib.util.spec_from_file_location('act_storage_materializer', str(Path(__file__).with_name('materialize-runtime.py')))
MATERIALIZE = importlib.util.module_from_spec(spec)
spec.loader.exec_module(MATERIALIZE)

LEASE_SCHEMA = 'act-runtime-storage-retention.v1'
SESSION_SQL = 'SELECT DISTINCT "runtimeReleaseId" FROM "CourseBundleRevision" WHERE "runtimeReleaseId" LIKE \'runtime-%\''
SIGNED_MEDIA_SECONDS = 300
PUBLICATION_SECONDS = 86400
# 与 developer-oss/gateway_service.py 的默认可续租心跳期一致。
DEVELOPER_GRACE_SECONDS = 7 * 24 * 60 * 60


class database_root_lock(object):
    """Pair with the transaction-scoped shared lock before classroom persistence."""
    def __init__(self, args, required):
        self.args = args
        self.required = required
        self.process = None

    def __enter__(self):
        if not self.required:
            return self
        if self.args.production and not consumer_supports_media():
            raise MEDIA.MediaStorageError('body-gc-consumer-coordination-unavailable')
        database_url = os.environ.get('DATABASE_URL')
        if database_url:
            command = ['psql', database_url]
        elif self.args.db_container:
            command = ['podman', 'exec', '-i', self.args.db_container, 'psql', '-U', os.environ.get('DB_USER', 'act_user'),
                       '-d', os.environ.get('DB_NAME', 'act_obe')]
        else:
            raise MEDIA.MediaStorageError('session-release-lock-unavailable')
        command.extend(['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'])
        self.process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE, universal_newlines=True)
        self.process.stdin.write("SET statement_timeout='30s'; SELECT pg_advisory_lock(1633907764,1);\nSELECT 'storage-lock-held';\n")
        self.process.stdin.flush()
        while True:
            line = self.process.stdout.readline()
            if not line:
                self.__exit__(None, None, None)
                raise MEDIA.MediaStorageError('session-release-lock-failed')
            if line.strip() == 'storage-lock-held':
                return self

    def __exit__(self, exc_type, exc, traceback):
        if self.process is not None:
            try:
                self.process.stdin.close()
            except BrokenPipeError:
                pass
            try:
                self.process.wait(timeout=30)
            except subprocess.TimeoutExpired:
                self.process.terminate()
                self.process.wait(timeout=10)
            self.process.stdout.close()
            self.process.stderr.close()
        return False


def valid_time(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0


def observed_time(state_dir, now=None, commit=False):
    current = time.time() if now is None else now
    if not valid_time(current):
        raise MEDIA.MediaStorageError('invalid-storage-clock')
    filename = Path(state_dir) / 'storage-retention' / 'clock.json'
    if filename.exists():
        previous = json.loads(filename.read_text())
        if not valid_time(previous.get('observedAt')) or current < previous['observedAt']:
            raise MEDIA.MediaStorageError('storage-clock-moved-backwards')
    if commit:
        MEDIA.atomic_json(filename, {'observedAt': current})
    return current


def retain(state_dir, manifest, seconds, reason, now=None):
    MATERIALIZE.validate_manifest(manifest)
    if not valid_time(seconds):
        raise MEDIA.MediaStorageError('invalid-storage-retention-duration')
    timestamp = observed_time(state_dir, now, commit=True)
    filename = Path(state_dir) / 'storage-retention' / (manifest['releaseId'] + '.json')
    expires = timestamp + seconds
    if filename.exists():
        previous = json.loads(filename.read_text())
        if previous.get('manifest') != manifest or not valid_time(previous.get('expiresAt')):
            raise MEDIA.MediaStorageError('invalid-existing-storage-retention')
        expires = max(expires, previous['expiresAt'])
    value = {'schemaVersion': LEASE_SCHEMA, 'expiresAt': expires, 'reason': reason, 'manifest': manifest}
    MEDIA.atomic_json(filename, value)
    return value


def retained_manifests(state_dir, now=None):
    timestamp = observed_time(state_dir, now)
    directory = Path(state_dir) / 'storage-retention'
    found = {}
    if not directory.is_dir():
        return found
    for filename in directory.glob('runtime-*.json'):
        if filename.is_symlink():
            raise MEDIA.MediaStorageError('unsafe-storage-retention')
        value = json.loads(filename.read_text())
        if value.get('schemaVersion') != LEASE_SCHEMA or not valid_time(value.get('expiresAt')):
            raise MEDIA.MediaStorageError('invalid-storage-retention')
        manifest = MATERIALIZE.validate_manifest(value.get('manifest'))
        if filename.stem != manifest['releaseId']:
            raise MEDIA.MediaStorageError('storage-retention-identity-mismatch')
        if value['expiresAt'] >= timestamp:
            found[manifest['releaseId']] = manifest
    return found


def session_releases(database_url=None, db_container=None):
    if database_url:
        command = ['psql', database_url, '-v', 'ON_ERROR_STOP=1', '-Atc', SESSION_SQL]
    elif db_container:
        command = ['podman', 'exec', db_container, 'psql', '-U', os.environ.get('DB_USER', 'act_user'),
                   '-d', os.environ.get('DB_NAME', 'act_obe'), '-v', 'ON_ERROR_STOP=1', '-Atc', SESSION_SQL]
    else:
        raise MEDIA.MediaStorageError('session-release-discovery-unavailable')
    try:
        process = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
    except OSError:
        raise MEDIA.MediaStorageError('session-release-discovery-unavailable')
    if process.returncode:
        raise MEDIA.MediaStorageError('session-release-discovery-failed')
    return set(line.strip() for line in process.stdout.splitlines() if line.strip())


def developer_releases(filename, now=None, required=False):
    if not filename or not Path(filename).exists():
        if required:
            raise MEDIA.MediaStorageError('developer-lease-discovery-unavailable')
        return {}
    timestamp = time.time() if now is None else now
    if Path(filename).is_symlink():
        raise MEDIA.MediaStorageError('unsafe-developer-lease-store')
    value = json.loads(Path(filename).read_text())
    if value.get('schemaVersion') != 'act-runtime-dev-gateway-leases.v1' or not isinstance(value.get('leases'), list):
        raise MEDIA.MediaStorageError('invalid-developer-lease-store')
    found = {}
    for item in value['leases']:
        if not isinstance(item, dict) or not isinstance(item.get('live'), bool):
            raise MEDIA.MediaStorageError('invalid-developer-lease')
        if not item['live']:
            continue
        heartbeat = item.get('heartbeatAt')
        identity = item.get('identity')
        if (not valid_time(heartbeat) or not isinstance(identity, dict)
                or identity.get('schemaVersion') != 'act-runtime-release.v2'
                or not MATERIALIZE.RELEASE_ID_PATTERN.fullmatch(identity.get('releaseId', ''))
                or not MEDIA.SHA256.fullmatch(identity.get('manifestSha256', ''))
                or not MEDIA.SHA256.fullmatch(identity.get('treeSha256', ''))):
            raise MEDIA.MediaStorageError('invalid-developer-lease-identity')
        if timestamp < heartbeat or timestamp - heartbeat <= DEVELOPER_GRACE_SECONDS:
            existing = found.get(identity['releaseId'])
            if existing is not None and existing != identity:
                raise MEDIA.MediaStorageError('conflicting-developer-lease-identity')
            found[identity['releaseId']] = identity
    return found


def load_release(store, state_dir, release_id):
    view = MATERIALIZE.existing_view(Path(state_dir), release_id)
    filename = view / MATERIALIZE.MATERIALIZED_MANIFEST if view else MATERIALIZE.manifest_path(Path(store), release_id)
    manifest = MATERIALIZE.load_manifest(filename)
    if manifest['releaseId'] != release_id:
        raise MEDIA.MediaStorageError('protected-release-identity-mismatch')
    return manifest


def protected_manifests(store, state_dir, sessions=(), pins=(), developer_store=None, require_developer=False, now=None):
    pointers = MATERIALIZE.read_host_pointers(Path(state_dir))
    retained = retained_manifests(state_dir, now)
    leases = developer_releases(developer_store, now, require_developer)
    refs = set(sessions) | set(pins) | set(leases)
    refs.update(item for item in pointers.values() if item)
    for release_id in refs:
        if not isinstance(release_id, str) or not MATERIALIZE.RELEASE_ID_PATTERN.fullmatch(release_id):
            raise MEDIA.MediaStorageError('invalid-protected-release-id')
        manifest = load_release(store, state_dir, release_id)
        if release_id in leases and any(leases[release_id].get(key) != manifest.get(key) for key in ['manifestSha256', 'treeSha256']):
            raise MEDIA.MediaStorageError('developer-lease-manifest-mismatch')
        if release_id in retained and retained[release_id]['manifestSha256'] != manifest['manifestSha256']:
            raise MEDIA.MediaStorageError('protected-retention-manifest-mismatch')
        retained[release_id] = manifest
    return retained


def consumer_supports_media():
    for name in ('act-obe-app', 'act-obe-worker'):
        process = subprocess.run(['podman', 'inspect', name], stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, universal_newlines=True)
        if process.returncode:
            return False
        container = json.loads(process.stdout)[0]
        image = subprocess.run(['podman', 'image', 'inspect', container['Image']], stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, universal_newlines=True)
        if image.returncode:
            return False
        raw = json.loads(image.stdout)[0]
        if (raw.get('Labels') or raw.get('Config', {}).get('Labels', {})).get('io.act.runtime-media-storage.version') != '1':
            return False
    return True


def maintenance_snapshot(args):
    if args.production and args.no_session_refs:
        raise MEDIA.MediaStorageError('production-session-discovery-required')
    sessions = set(args.session_release)
    if not args.no_session_refs:
        sessions.update(session_releases(os.environ.get('DATABASE_URL'), args.db_container))
    manifests = protected_manifests(args.store_dir, args.state_dir, sessions, args.pin,
                                    args.developer_lease_store, args.production or args.require_developer_leases)
    catalog, canonical = MEDIA.load_catalog(MEDIA.catalog_path(args.state_dir))
    return {'protected': manifests, 'catalog': catalog, 'canonical': canonical,
            'catalogSha256': MEDIA.catalog_digest(catalog), 'pointers': MATERIALIZE.read_host_pointers(Path(args.state_dir))}


def write_maintenance_catalog(args, before, result):
    if result.get('expectedCatalogSha256') != before['catalogSha256']:
        raise MEDIA.MediaStorageError('maintenance-directory-fence-mismatch')
    catalog, canonical = MEDIA.parse_catalog(result.get('catalog'))
    if not canonical:
        raise MEDIA.MediaStorageError('canonical-maintenance-directory-required')
    protected = {item['sha256'] for manifest in before['protected'].values() for item in manifest['files']}
    old = MEDIA.object_map(before['catalog'])
    next_objects = MEDIA.object_map(catalog)
    if any(digest in protected and next_objects.get(digest) != row for digest, row in old.items()):
        raise MEDIA.MediaStorageError('maintenance-cannot-drop-protected-media')
    MEDIA.atomic_json(MEDIA.catalog_path(args.state_dir), catalog)


def prepare_media_views(args, before, result):
    catalog, canonical = MEDIA.parse_catalog(result.get('catalog'))
    if not canonical or catalog != before['catalog'] or result.get('expectedCatalogSha256') != before['catalogSha256']:
        raise MEDIA.MediaStorageError('migration-directory-fence-mismatch')
    state_dir = Path(args.state_dir)
    media_root = Path(args.media_root) if args.media_root else (state_dir.parent / 'ossfs' / 'public-media' if args.production else None)
    blob_root = args.blob_root or (str(state_dir.parent / 'ossfs' / 'blobs') if args.production else None)
    locations = MEDIA.object_map(catalog)
    views = []
    if args.production and not consumer_supports_media():
        raise MEDIA.MediaStorageError('canonical-media-consumer-unavailable')
    # Verify every target before changing either the directory or any media leaf.
    for row in catalog['objects']:
        body = MEDIA.public_blob_path(args.store_dir, row['sha256'], row, media_root)
        if body.is_symlink():
            raise MEDIA.MediaStorageError('unsafe-canonical-media-target')
        MEDIA.verify_body_file(body, row['sha256'], row['sizeBytes'])
        source = MATERIALIZE.blob_path(Path(args.store_dir), row['sha256'], blob_root=blob_root)
        if source.is_file() or catalog['legacyCopiesAvailable']:
            MEDIA.verify_body_file(source, row['sha256'], row['sizeBytes'])
    for release, manifest in before['protected'].items():
        view = MATERIALIZE.existing_view(state_dir, release)
        if view is None:
            continue
        if args.production and not os.path.ismount(str(view / MEDIA.MEDIA_HELPER)):
            raise MEDIA.MediaStorageError('canonical-media-helper-not-mounted')
        views.append((view, manifest))
    if args.production and catalog['objects']:
        row = catalog['objects'][0]
        relative = row['objectKey'][len(MEDIA.MEDIA_PREFIX):]
        check = ('const fs=require("node:fs"),crypto=require("node:crypto");'
                 'const b=fs.readFileSync(process.argv[1]);'
                 'if(b.length!==Number(process.argv[3])||crypto.createHash("sha256").update(b).digest("hex")!==process.argv[2])process.exit(1)')
        for name in ('act-obe-app', 'act-obe-worker'):
            checked = subprocess.run(['podman', 'exec', name, 'node', '-e', check,
                                      '/app/course-content/runtime/' + MEDIA.MEDIA_HELPER + '/' + relative,
                                      row['sha256'], str(row['sizeBytes'])], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if checked.returncode:
                raise MEDIA.MediaStorageError('canonical-media-helper-not-visible-in-consumer')
    # The compatible application can read old private leaves while legacy copies
    # exist, so this order permits atomic leaf replacement without a graph switch.
    write_maintenance_catalog(args, before, result)
    for view, manifest in views:
        for item in manifest['files']:
            if item['sha256'] not in locations:
                continue
            MATERIALIZE.place_logical_file(Path(args.store_dir), view, item, blob_root=blob_root,
                                            use_helper_leaves=args.production, media_locations=locations, media_root=media_root)
            MEDIA.verify_body_file(view / item['path'], item['sha256'], item['sizeBytes'])
    MEDIA.atomic_json(MEDIA.catalog_path(state_dir).with_name('storage-state.json'),
                      {'schemaVersion': 'act-runtime-media-storage-state.v1', 'ready': True,
                       'catalogSha256': MEDIA.catalog_digest(catalog)})


def hold_maintenance(args):
    request = json.loads(sys.stdin.readline())
    with MATERIALIZE.selection_lock(Path(args.state_dir)), database_root_lock(args, args.production and request.get('protectDatabaseWrites') is True):
        before = maintenance_snapshot(args)
        print(json.dumps(dict(before, held=True)), flush=True)
        while True:
            line = sys.stdin.readline()
            if not line:
                return
            result = json.loads(line)
            action = result.get('action')
            if action == 'prepare-migration':
                prepare_media_views(args, before, result)
            elif action in ('retire-copies', 'restore-copies'):
                catalog, canonical = MEDIA.parse_catalog(result.get('catalog'))
                if not canonical or catalog['objects'] != before['catalog']['objects']:
                    raise MEDIA.MediaStorageError('copy-state-directory-mismatch')
                if catalog['legacyCopiesAvailable'] != (action == 'restore-copies'):
                    raise MEDIA.MediaStorageError('invalid-copy-state-transition')
                if action == 'retire-copies' and not before['canonical']:
                    raise MEDIA.MediaStorageError('canonical-directory-required-before-retirement')
                if action == 'restore-copies':
                    blob_root = args.blob_root or (str(Path(args.state_dir).parent / 'ossfs' / 'blobs') if args.production else None)
                    for row in catalog['objects']:
                        MEDIA.verify_body_file(MATERIALIZE.blob_path(Path(args.store_dir), row['sha256'], blob_root=blob_root),
                                                row['sha256'], row['sizeBytes'])
                write_maintenance_catalog(args, before, result)
            else:
                break
            before = maintenance_snapshot(args)
            print(json.dumps(dict(before, prepared=True)), flush=True)
        if result.get('complete') is not True:
            raise MEDIA.MediaStorageError('storage-maintenance-incomplete')
        if result.get('catalog') is not None:
            write_maintenance_catalog(args, before, result)
        observed_time(args.state_dir, commit=True)
        print(json.dumps({'completed': True}), flush=True)


def hold(args):
    message = json.loads(sys.stdin.readline())
    manifest = MATERIALIZE.validate_manifest(message.get('manifest'))
    with MATERIALIZE.selection_lock(Path(args.state_dir)):
        refs = set() if args.no_session_refs else session_releases(os.environ.get('DATABASE_URL'), args.db_container)
        protected = protected_manifests(args.store_dir, args.state_dir, refs, args.pin,
                                        args.developer_lease_store, args.require_developer_leases)
        base = message.get('baseReleaseId')
        if base and base not in protected and not message.get('bootstrap'):
            raise MEDIA.MediaStorageError('cached-publication-retired; run with --bootstrap to restore')
        catalog, canonical = MEDIA.load_catalog(MEDIA.catalog_path(args.state_dir))
        needs_media = bool(message.get('hasPublicMedia') or (catalog and catalog['objects']))
        if args.production and needs_media and not consumer_supports_media():
            raise MEDIA.MediaStorageError('canonical-media-consumer-unavailable')
        if args.production and needs_media:
            state_path = MEDIA.catalog_path(args.state_dir).with_name('storage-state.json')
            state = json.loads(state_path.read_text()) if state_path.is_file() else {}
            if state.get('schemaVersion') != 'act-runtime-media-storage-state.v1' or state.get('ready') is not True:
                raise MEDIA.MediaStorageError('canonical-media-storage-not-prepared')
        retain(args.state_dir, manifest, args.retain_seconds, 'publication')
        print(json.dumps({'held': True, 'catalog': catalog, 'canonical': canonical}), flush=True)
        preparation = sys.stdin.readline()
        if not preparation:
            return
        result = json.loads(preparation)
        if result.get('prepared') is not True:
            raise MEDIA.MediaStorageError('publication-bodies-not-prepared')
        next_catalog, is_canonical = MEDIA.parse_catalog(result.get('catalog'))
        if not is_canonical:
            raise MEDIA.MediaStorageError('canonical-publication-directory-required')
        old_objects = MEDIA.object_map(catalog)
        next_objects = MEDIA.object_map(next_catalog)
        if any(next_objects.get(digest) != item for digest, item in old_objects.items()):
            raise MEDIA.MediaStorageError('publication-cannot-drop-existing-media')
        MEDIA.atomic_json(MEDIA.catalog_path(args.state_dir), next_catalog)
        print(json.dumps({'prepared': True}), flush=True)
        terminal = sys.stdin.readline()
        if not terminal:
            return
        if json.loads(terminal).get('complete') is not True:
            raise MEDIA.MediaStorageError('publication-did-not-complete')
        MEDIA.atomic_json(MATERIALIZE.manifest_path(Path(args.store_dir), manifest['releaseId']), manifest)
        print(json.dumps({'completed': True}), flush=True)


def parser():
    value = argparse.ArgumentParser(description=__doc__)
    value.add_argument('command', choices=['hold', 'hold-maintenance'])
    value.add_argument('--state-dir', required=True)
    value.add_argument('--store-dir', required=True)
    value.add_argument('--db-container')
    value.add_argument('--no-session-refs', action='store_true')
    value.add_argument('--pin', action='append', default=[])
    value.add_argument('--session-release', action='append', default=[])
    value.add_argument('--developer-lease-store')
    value.add_argument('--require-developer-leases', action='store_true')
    value.add_argument('--retain-seconds', type=int, default=PUBLICATION_SECONDS)
    value.add_argument('--production', action='store_true')
    value.add_argument('--media-root')
    value.add_argument('--blob-root')
    return value


def main():
    try:
        args = parser().parse_args()
        args.production = args.production or Path(args.state_dir).name == 'blob-views'
        if args.retain_seconds < SIGNED_MEDIA_SECONDS:
            raise MEDIA.MediaStorageError('publication-retention-too-short')
        if args.command == 'hold-maintenance':
            hold_maintenance(args)
        else:
            hold(args)
    except (MEDIA.MediaStorageError, MATERIALIZE.MaterializeError, OSError, ValueError, TypeError) as error:
        sys.stderr.write('storage lifecycle failed: %s\n' % str(error))
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
