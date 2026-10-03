#!/usr/bin/env python3
"""Prepare, retire exact legacy copies, or restore them from canonical media."""

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import runtime_media_storage as MEDIA
from runtime_storage_io import BodyStore, PRIVATE_PREFIX
from runtime_storage_lock import HostStorageLock, add_host_arguments


def protected_identities(snapshot):
    return {release: manifest['manifestSha256'] for release, manifest in snapshot['protected'].items()}


def validate_plan(plan, snapshot):
    if (plan.get('schemaVersion') != 'act-public-media-migration.v1'
            or plan.get('pointers') != snapshot['pointers']
            or plan.get('protectedManifests') != protected_identities(snapshot)
            or plan.get('objects') != snapshot['catalog']['objects']):
        raise MEDIA.MediaStorageError('migration-plan-drift; prepare a new plan')
    rows = plan.get('sourceCopies')
    if not isinstance(rows, list):
        raise MEDIA.MediaStorageError('invalid-migration-source-plan')
    objects = MEDIA.object_map(snapshot['catalog'])
    seen = set()
    for row in rows:
        digest = row.get('key', '')[len(PRIVATE_PREFIX):]
        if (row.get('bucket') != MEDIA.SOURCE_BUCKET or row.get('key') != PRIVATE_PREFIX + digest
                or digest not in objects or digest in seen or row.get('sizeBytes') != objects[digest]['sizeBytes']
                or not isinstance(row.get('etag'), str) or not row['etag']):
            raise MEDIA.MediaStorageError('invalid-migration-source-plan')
        seen.add(digest)


def run(args):
    if args.oss_bucket and not args.lifecycle_host:
        raise MEDIA.MediaStorageError('--lifecycle-host is required for coordinated OSS migration')
    private = BodyStore(MEDIA.SOURCE_BUCKET, None if args.oss_bucket else args.store_dir, args.ossutil, args.ossutil_arg)
    public = BodyStore(MEDIA.MEDIA_BUCKET, None if args.oss_bucket else args.media_store_dir or args.store_dir,
                       args.ossutil, args.media_ossutil_arg)
    with HostStorageLock(args) as lock:
        snapshot = lock.snapshot
        catalog = snapshot['catalog']
        if not catalog or not catalog['objects']:
            raise MEDIA.MediaStorageError('verified-public-media-directory-required')
        targets = {row['key']: row for row in public.list()}
        for item in catalog['objects']:
            target = targets.get(item['objectKey'])
            if not target or target['sizeBytes'] != item['sizeBytes']:
                raise MEDIA.MediaStorageError('canonical-target-missing-or-size-mismatch')
        if args.command == 'prepare':
            objects = MEDIA.object_map(catalog)
            source = {row['key']: row for row in private.list()}
            copies = [source[PRIVATE_PREFIX + row['sha256']] for row in catalog['objects'] if PRIVATE_PREFIX + row['sha256'] in source]
            if any(row['sizeBytes'] != objects[row['key'][len(PRIVATE_PREFIX):]]['sizeBytes'] for row in copies):
                raise MEDIA.MediaStorageError('legacy-source-size-mismatch')
            lock.prepare_migration(catalog)
            plan = {'schemaVersion': 'act-public-media-migration.v1', 'pointers': snapshot['pointers'],
                    'protectedManifests': protected_identities(snapshot), 'objects': catalog['objects'],
                    'targetObjects': [targets[row['objectKey']] for row in catalog['objects']], 'sourceCopies': copies,
                    'duplicateBytes': sum(row['sizeBytes'] for row in copies), 'verified': True}
            MEDIA.atomic_json(args.plan, plan)
            lock.complete()
            return {'action': 'prepare', 'objects': len(catalog['objects']), 'copies': len(copies), 'duplicateBytes': plan['duplicateBytes']}
        plan = json.loads(Path(args.plan).read_text())
        validate_plan(plan, snapshot)
        planned_targets = plan.get('targetObjects')
        if not isinstance(planned_targets, list) or len(planned_targets) != len(catalog['objects']):
            raise MEDIA.MediaStorageError('invalid-migration-target-plan')
        if any(targets.get(row.get('key')) != row for row in planned_targets):
            raise MEDIA.MediaStorageError('canonical-target-fence-changed')
        result = {'schemaVersion': 'act-public-media-migration-receipt.v1', 'action': args.command,
                  'protectedManifests': protected_identities(snapshot), 'completed': [], 'releasedBytes': 0, 'complete': False}
        MEDIA.atomic_json(args.receipt, result)
        if args.command == 'retire':
            # Verify target bodies and every protected view again under the same lock.
            lock.prepare_migration(catalog)
            existing = {row['key']: row for row in private.list()}
            if any(existing.get(row['key']) not in (None, row) for row in plan['sourceCopies']):
                raise MEDIA.MediaStorageError('legacy-source-fence-changed')
            lock.prepare_migration(dict(catalog, legacyCopiesAvailable=False), action='retire-copies')
            def confirmed(row):
                result['completed'].append(row)
                result['releasedBytes'] += row['sizeBytes']
            private.delete_many([row for row in plan['sourceCopies'] if row['key'] in existing], confirmed,
                                lambda: MEDIA.atomic_json(args.receipt, result))
        else:
            existing = {row['key']: row for row in private.list()}
            for item in catalog['objects']:
                digest = item['sha256']
                payload = public.verify(item['objectKey'], digest, item['sizeBytes'])
                key = PRIVATE_PREFIX + digest
                if key in existing:
                    private.verify(key, digest, item['sizeBytes'])
                else:
                    private.restore(key, payload)
                    private.verify(key, digest, item['sizeBytes'])
                result['completed'].append({'bucket': MEDIA.SOURCE_BUCKET, 'key': key, 'sizeBytes': item['sizeBytes']})
                MEDIA.atomic_json(args.receipt, result)
            lock.prepare_migration(dict(catalog, legacyCopiesAvailable=True), action='restore-copies')
        lock.complete()
        result['complete'] = True
        MEDIA.atomic_json(args.receipt, result)
        return result


def parser():
    value = argparse.ArgumentParser(description=__doc__)
    value.add_argument('command', choices=['prepare', 'retire', 'restore'])
    value.add_argument('--store-dir', required=True)
    value.add_argument('--state-dir', required=True)
    value.add_argument('--media-store-dir')
    value.add_argument('--media-root')
    value.add_argument('--blob-root')
    value.add_argument('--plan', required=True)
    value.add_argument('--receipt')
    value.add_argument('--oss-bucket', choices=[MEDIA.SOURCE_BUCKET])
    value.add_argument('--ossutil', default='ossutil')
    value.add_argument('--ossutil-arg', action='append', default=[])
    value.add_argument('--media-ossutil-arg', action='append', default=[])
    value.add_argument('--pin', action='append', default=[])
    value.add_argument('--session-release', action='append', default=[])
    value.add_argument('--no-session-refs', action='store_true')
    add_host_arguments(value)
    return value


def main():
    try:
        args = parser().parse_args()
        if args.command != 'prepare' and not args.receipt:
            raise MEDIA.MediaStorageError('--receipt is required for copy retirement or restoration')
        print(json.dumps(run(args), sort_keys=True))
    except (MEDIA.MediaStorageError, OSError, ValueError, TypeError) as error:
        sys.stderr.write('media migration failed: %s\n' % str(error))
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
