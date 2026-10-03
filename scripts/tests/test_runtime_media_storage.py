from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / 'scripts/runtime-release'
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(SCRIPTS / 'developer-oss'))
import runtime_media_storage as MEDIA
from runtime_storage_io import BodyStore, PRIVATE_PREFIX
from gateway_host import DiskHost
from gateway_service import GatewayService


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / filename)
    result = importlib.util.module_from_spec(spec)
    sys.modules[name] = result
    spec.loader.exec_module(result)
    return result


STORAGE = module('test_storage_lifecycle', 'storage-lifecycle.py')
PUBLISH = module('test_media_publisher', 'publish-runtime.py')
MATERIALIZE = STORAGE.MATERIALIZE


def execute(filename, *arguments, ok=True):
    environment = os.environ.copy()
    environment.pop('DATABASE_URL', None)
    result = subprocess.run(['python3', str(SCRIPTS / filename), *map(str, arguments)],
                            capture_output=True, text=True, env=environment)
    if ok and result.returncode:
        raise AssertionError(result.stderr)
    if not ok:
        if not result.returncode:
            raise AssertionError('expected command to fail')
        return result
    return json.loads(result.stdout) if result.stdout.strip() else None


class Fixture:
    def __init__(self, root):
        self.root = Path(root)
        self.runtime = self.root / 'runtime'
        self.store = self.root / 'store'
        self.state = self.root / 'state'
        self.index = self.root / 'index.sqlite'
        self.write('lessons/1-1/lesson.json', b'{"id":"1-1"}')
        self.write('lessons/1-1/media/video.mp4', b'approved-video-one')

    def write(self, relative, body):
        path = self.runtime / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)

    def publish(self, bootstrap=False, revision='a' * 40, ok=True):
        arguments = ['--root', self.runtime, '--store-dir', self.store, '--state-dir', self.state,
                     '--index', self.index, '--source-revision', revision]
        if bootstrap:
            arguments.append('--bootstrap')
        return execute('publish-runtime.py', *arguments, ok=ok)

    def manifest(self, release):
        return MATERIALIZE.load_manifest(self.store / 'runtime/blob-releases' / release / 'manifest.json')

    def activate(self, release, **options):
        arguments = ['--store-dir', self.store, '--state-dir', self.state, '--release-id', release,
                     '--sentinel', 'lessons/1-1/lesson.json']
        for key, value in options.items():
            arguments.extend(['--' + key.replace('_', '-'), value])
        return execute('activate-runtime.py', *arguments)

    def catalog(self):
        return MEDIA.load_catalog(MEDIA.catalog_path(self.state))[0]

    def expire_publications(self, keep=()):
        for filename in (self.state / 'storage-retention').glob('runtime-*.json'):
            if filename.stem in keep:
                continue
            lease = json.loads(filename.read_text())
            lease['expiresAt'] = time.time() - 10
            filename.write_text(json.dumps(lease))

    def gc(self, execute_gc=False, *extra, ok=True):
        arguments = ['--store-dir', self.store, '--state-dir', self.state, '--no-session-refs', '--reclaim-blobs',
                     '--receipt', self.root / 'gc-receipt.json', *extra]
        if execute_gc:
            arguments.append('--execute')
        return execute('runtime-gc.py', *arguments, ok=ok)

    def migration(self, action, ok=True):
        return execute('migrate-public-media.py', action, '--store-dir', self.store, '--state-dir', self.state,
                       '--no-session-refs', '--plan', self.root / 'migration.json',
                       '--receipt', self.root / 'migration-receipt.json', ok=ok)

    def make_legacy_copies(self, release):
        catalog = self.catalog()
        manifest = self.manifest(release)
        paths = {item['sha256']: item['path'] for item in manifest['files'] if MEDIA.public_path(item['path'])}
        objects = []
        for row in catalog['objects']:
            body = self.store / row['objectKey']
            original = self.store / (PRIVATE_PREFIX + row['sha256'])
            original.parent.mkdir(parents=True, exist_ok=True)
            original.write_bytes(body.read_bytes())
            objects.append({key: value for key, value in dict(row, path=paths[row['sha256']]).items() if key != 'objectKey'})
        legacy = {'schemaVersion': 'act-public-teaching-media/v1', 'verified': True,
                  'sourceRuntime': {key: manifest[key] for key in ('releaseId', 'manifestSha256')}, 'objects': objects}
        MEDIA.atomic_json(MEDIA.catalog_path(self.state), legacy)


class RuntimeMediaStorageTests(unittest.TestCase):
    def test_publication_is_direct_incremental_and_independent_of_runtime_revision(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Fixture(directory)
            first = fixture.publish(bootstrap=True)
            item = fixture.catalog()['objects'][0]
            self.assertTrue((fixture.store / item['objectKey']).is_file())
            self.assertFalse((fixture.store / (PRIVATE_PREFIX + item['sha256'])).exists())
            same = fixture.publish()
            self.assertEqual((same['hashed'], same['uploadedBlobs'], same['uploaded']), (0, 0, 0))
            revision_only = fixture.publish(revision='b' * 40)
            self.assertNotEqual(revision_only['releaseId'], first['releaseId'])
            self.assertEqual((revision_only['hashed'], revision_only['uploadedBlobs']), (0, 0))
            fixture.write('lessons/1-1/media/video.mp4', b'approved-video-two-longer')
            changed = fixture.publish()
            self.assertEqual((changed['hashed'], changed['uploadedBlobs']), (1, 1))
            self.assertEqual(len(fixture.catalog()['objects']), 2)

    def test_unapproved_new_infograph_is_private_and_bad_qualification_fails_before_upload(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Fixture(directory)
            image = b'new-unapproved-image'
            fixture.write('knowledge/infographs/authority/nodes/node.png', image)
            learning = {'contract': 'act-authority-learning-content-manifest/v2', 'teachingProjectionId': 'p',
                        'teachingProjectionHash': 'b' * 64, 'nodes': [{'safeId': 'node', 'infograph': {'state': 'unavailable'}}]}
            fixture.write('knowledge/authority-learning-content-manifest.json', json.dumps(learning).encode())
            first = fixture.publish(bootstrap=True)
            digest = hashlib.sha256(image).hexdigest()
            self.assertTrue((fixture.store / (PRIVATE_PREFIX + digest)).exists())
            self.assertNotIn(digest, MEDIA.object_map(fixture.catalog()))
            before = fixture.catalog()
            learning['nodes'][0]['infograph'] = {'state': 'available', 'sha256': '0' * 64}
            fixture.write('knowledge/authority-learning-content-manifest.json', json.dumps(learning).encode())
            failed = fixture.publish(ok=False)
            self.assertIn('digest-mismatch', failed.stderr)
            self.assertEqual(fixture.catalog(), before)
            self.assertTrue(fixture.manifest(first['releaseId']))

    def test_failed_public_upload_does_not_commit_directory_manifest_or_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Fixture(directory)
            arguments = PUBLISH.build_parser().parse_args(['--root', str(fixture.runtime), '--store-dir', str(fixture.store),
                         '--state-dir', str(fixture.state), '--index', str(fixture.index), '--source-revision', 'a' * 40, '--bootstrap'])
            original = PUBLISH.LocalObjectStore.put
            def failed(store, key, data):
                if key.startswith(MEDIA.MEDIA_PREFIX):
                    raise PUBLISH.PublishError('fixture-upload-failed')
                return original(store, key, data)
            with patch.object(PUBLISH.LocalObjectStore, 'put', failed), self.assertRaisesRegex(PUBLISH.PublishError, 'fixture-upload-failed'):
                PUBLISH.publish(arguments)
            self.assertFalse(MEDIA.catalog_path(fixture.state).exists())
            self.assertFalse((fixture.store / 'runtime/blob-releases').exists())
            self.assertTrue(fixture.publish(bootstrap=True)['uploadedBlobs'])

    def test_retired_cache_requires_explicit_bootstrap_after_body_gc(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Fixture(directory)
            fixture.publish(bootstrap=True)
            fixture.expire_publications()
            collected = fixture.gc(True)
            self.assertGreater(collected['blobsDeleted'], 0)
            self.assertIn('cached-publication-retired', fixture.publish(ok=False).stderr)
            restored = fixture.publish(bootstrap=True)
            self.assertEqual(restored['uploadedBlobs'], 2)

    def test_body_gc_closes_all_roots_and_preserves_out_of_scope_objects(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Fixture(directory)
            published = []
            for number in range(8):
                fixture.write('lessons/1-1/media/video.mp4', ('video-%s' % number).encode())
                published.append(fixture.publish(bootstrap=not published)['releaseId'])
            fixture.activate(published[0])
            fixture.activate(published[1])
            fixture.expire_publications(keep=[published[6]])
            STORAGE.retain(fixture.state, fixture.manifest(published[5]), 300, 'signed-media')
            dev = fixture.root / 'leases.json'
            identity = {key: fixture.manifest(published[4])[key] for key in ('schemaVersion', 'releaseId', 'manifestSha256', 'treeSha256')}
            dev.write_text(json.dumps({'schemaVersion': 'act-runtime-dev-gateway-leases.v1',
                                      'leases': [{'live': True, 'heartbeatAt': time.time(), 'identity': identity}]}))
            outside = fixture.store / 'model-releases/something/model.glb'
            outside.parent.mkdir(parents=True)
            outside.write_bytes(b'model-protected-by-scope')
            options = ['--session-release', published[2], '--pin', published[3], '--developer-lease-store', dev]
            dry = fixture.gc(False, *options)
            self.assertEqual(set(dry['retained']), set(published[:7]))
            expected = fixture.manifest(published[7])['files'][-1]['sha256']
            self.assertTrue(any(expected in row['key'] for row in dry['bodyCandidates']))
            done = fixture.gc(True, *options)
            self.assertTrue(done['complete'])
            self.assertEqual(outside.read_bytes(), b'model-protected-by-scope')
            self.assertNotIn(expected, MEDIA.object_map(fixture.catalog()))
            for release in published[:7]:
                for item in fixture.manifest(release)['files']:
                    location = MEDIA.object_map(fixture.catalog()).get(item['sha256'])
                    self.assertTrue((fixture.store / (location['objectKey'] if location else item['objectKey'])).exists())

    def test_bad_manifest_or_lease_discovery_cannot_delete_any_body(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Fixture(directory)
            release = fixture.publish(bootstrap=True)['releaseId']
            fixture.activate(release)
            before = BodyStore(MEDIA.SOURCE_BUCKET, fixture.store).list()
            lease = fixture.root / 'leases.json'
            lease.write_text('{"schemaVersion":"unknown","leases":[]}')
            self.assertIn('invalid-developer-lease-store', fixture.gc(True, '--developer-lease-store', lease, ok=False).stderr)
            marker = fixture.state / 'views' / release / MATERIALIZE.MATERIALIZED_MANIFEST
            manifest = json.loads(marker.read_text())
            manifest['files'][0]['sizeBytes'] += 1
            marker.write_text(json.dumps(manifest))
            self.assertNotEqual(fixture.gc(True, ok=False).returncode, 0)
            self.assertEqual(BodyStore(MEDIA.SOURCE_BUCKET, fixture.store).list(), before)

    def test_publication_lock_and_interruption_preserve_in_flight_bodies(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Fixture(directory)
            release = fixture.publish(bootstrap=True)['releaseId']
            fixture.expire_publications()
            manifest = fixture.manifest(release)
            hold = subprocess.Popen(['python3', str(SCRIPTS / 'storage-lifecycle.py'), 'hold', '--state-dir', str(fixture.state),
                                     '--store-dir', str(fixture.store), '--no-session-refs'], stdin=subprocess.PIPE,
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            hold.stdin.write(json.dumps({'manifest': manifest, 'bootstrap': True}) + '\n')
            hold.stdin.flush()
            self.assertTrue(json.loads(hold.stdout.readline())['held'])
            gc = subprocess.Popen(['python3', str(SCRIPTS / 'runtime-gc.py'), '--store-dir', str(fixture.store), '--state-dir', str(fixture.state),
                                   '--no-session-refs', '--reclaim-blobs', '--execute', '--receipt', str(fixture.root / 'gc.json')],
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            try:
                with self.assertRaises(subprocess.TimeoutExpired):
                    gc.communicate(timeout=0.15)
            finally:
                hold.stdin.close()
                hold.wait(timeout=5)
                hold.stdout.close()
                hold.stderr.close()
            output, error = gc.communicate(timeout=5)
            self.assertEqual(gc.returncode, 0, error)
            self.assertEqual(json.loads(output)['blobsDeleted'], 0)

    def test_signature_grace_only_extends_and_clock_rollback_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Fixture(directory)
            release = fixture.publish(bootstrap=True)['releaseId']
            manifest = fixture.manifest(release)
            state = fixture.root / 'clock-state'
            first = STORAGE.retain(state, manifest, 300, 'signed-media', now=1000)
            later = STORAGE.retain(state, manifest, 10, 'signed-media', now=1001)
            self.assertEqual(later['expiresAt'], first['expiresAt'])
            with self.assertRaisesRegex(MEDIA.MediaStorageError, 'backwards'):
                STORAGE.retained_manifests(state, now=999)
            self.assertIn(release, STORAGE.retained_manifests(state, now=1299))
            self.assertNotIn(release, STORAGE.retained_manifests(state, now=1301))

    def test_retirement_keeps_identity_doctor_gateway_range_and_restorable_copies(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Fixture(directory)
            release = fixture.publish(bootstrap=True)['releaseId']
            fixture.activate(release)
            fixture.make_legacy_copies(release)
            pointers = (fixture.state / 'pointers.json').read_bytes()
            marker = fixture.state / 'views' / release / MATERIALIZE.MATERIALIZED_MANIFEST
            identity_bytes = marker.read_bytes()
            prepared = fixture.migration('prepare')
            self.assertEqual(prepared['copies'], 1)
            retired = fixture.migration('retire')
            self.assertTrue(retired['complete'])
            self.assertEqual(retired['releasedBytes'], len(b'approved-video-one'))
            catalog = fixture.catalog()
            row = catalog['objects'][0]
            self.assertFalse(catalog['legacyCopiesAvailable'])
            self.assertFalse((fixture.store / (PRIVATE_PREFIX + row['sha256'])).exists())
            execute('runtime-doctor.py', '--store-dir', fixture.store, '--state-dir', fixture.state, '--full')
            disk = DiskHost(fixture.state, fixture.store / PRIVATE_PREFIX, fixture.store / MEDIA.MEDIA_PREFIX,
                            MEDIA.catalog_path(fixture.state))
            service = GatewayService('g' * 40, disk)
            identity = {key: fixture.manifest(release)[key] for key in ('schemaVersion', 'releaseId', 'manifestSha256', 'treeSha256')}
            lease = service.issue_lease(identity, 'fixture-checkout')
            body, status, headers = service.get_blob(lease['leaseId'], lease['transport']['token'], row['sha256'], 'bytes=2-7')
            self.assertEqual((body, status), (b'proved', 206))
            self.assertIn('Content-Range', headers)
            self.assertNotEqual(execute('check-media-storage-image.py', '--directory', MEDIA.catalog_path(fixture.state), ok=False).returncode, 0)
            execute('check-media-storage-image.py', '--directory', MEDIA.catalog_path(fixture.state), '--capability', '1')
            self.assertTrue(fixture.migration('restore')['complete'])
            execute('check-media-storage-image.py', '--directory', MEDIA.catalog_path(fixture.state))
            saved = MEDIA.catalog_path(fixture.state).read_bytes()
            MEDIA.catalog_path(fixture.state).unlink()
            failed = execute('check-media-storage-image.py', '--directory', MEDIA.catalog_path(fixture.state), '--capability', '1', ok=False)
            self.assertIn('directory-missing', failed.stderr)
            MEDIA.catalog_path(fixture.state).write_bytes(saved)
            self.assertEqual((fixture.state / 'pointers.json').read_bytes(), pointers)
            self.assertEqual(marker.read_bytes(), identity_bytes)

    def test_corrupt_target_blocks_migration_before_directory_or_leaf_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Fixture(directory)
            release = fixture.publish(bootstrap=True)['releaseId']
            fixture.activate(release)
            fixture.make_legacy_copies(release)
            before = MEDIA.catalog_path(fixture.state).read_bytes()
            row = fixture.catalog()['objects'][0]
            (fixture.store / row['objectKey']).write_bytes(b'x' * row['sizeBytes'])
            failed = fixture.migration('prepare', ok=False)
            self.assertIn('body-content-mismatch', failed.stderr)
            self.assertEqual(MEDIA.catalog_path(fixture.state).read_bytes(), before)
            self.assertTrue((fixture.store / (PRIVATE_PREFIX + row['sha256'])).exists())

    def test_directory_and_paginated_object_inventory_fail_closed(self):
        digest = hashlib.sha256(b'public').hexdigest()
        row = {'sha256': digest, 'sizeBytes': 6, 'mediaType': 'video/mp4', 'publicEligible': True,
               'objectKey': MEDIA.media_key(digest, '.mp4')}
        catalog = {'schemaVersion': MEDIA.CATALOG_SCHEMA, 'verified': True, 'legacyCopiesAvailable': False, 'objects': [row]}
        for change in [{'sizeBytes': True}, {'mediaType': 'text/html'}, {'objectKey': 'model-releases/foreign.glb'}]:
            bad = copy.deepcopy(catalog)
            bad['objects'][0].update(change)
            with self.assertRaises(MEDIA.MediaStorageError):
                MEDIA.parse_catalog(bad)
        with self.assertRaises(MEDIA.MediaStorageError):
            MEDIA.parse_catalog(dict(catalog, objects=[row, row]))
        store = BodyStore(MEDIA.MEDIA_BUCKET)
        page = {'Contents': [{'Key': row['objectKey'], 'Size': 6, 'ETag': 'etag'}], 'IsTruncated': True}
        with patch.object(store, 'json', side_effect=[{}, page]), self.assertRaisesRegex(MEDIA.MediaStorageError, 'continuation'):
            store.list()
        with self.assertRaises(MEDIA.MediaStorageError):
            store.delete({'bucket': MEDIA.MEDIA_BUCKET, 'key': 'model-releases/v1/model.glb'})

    def test_partial_bulk_delete_records_only_explicitly_confirmed_exact_keys(self):
        rows = [{'bucket': MEDIA.SOURCE_BUCKET, 'key': PRIVATE_PREFIX + char * 64, 'sizeBytes': 3, 'etag': char} for char in ('a', 'b')]
        store = BodyStore(MEDIA.SOURCE_BUCKET)
        recorded = []
        with patch.object(store, 'json', return_value={'Deleted': [{'Key': rows[0]['key']}], 'Error': [{'Key': rows[1]['key']}]}), \
                self.assertRaisesRegex(MEDIA.MediaStorageError, 'incomplete'):
            store.delete_many(rows, recorded.append)
        self.assertEqual(recorded, rows[:1])
        with patch.object(store, 'json', return_value={'Deleted': [{'Key': 'model-releases/foreign'}]}), \
                self.assertRaisesRegex(MEDIA.MediaStorageError, 'invalid-body-delete-result'):
            store.delete_many(rows, recorded.append)
        self.assertEqual(recorded, rows[:1])

    def test_real_ossutil_singleton_and_string_scalar_response_contract(self):
        store = BodyStore(MEDIA.SOURCE_BUCKET)
        key = PRIVATE_PREFIX + 'a' * 64
        # Captured field shapes from installed ossutil 2.3.0, without identities.
        one = {'Contents': {'Key': key, 'Size': '3', 'ETag': 'etag'},
               'IsTruncated': 'true', 'NextContinuationToken': 'next'}
        empty = {'IsTruncated': 'false', 'KeyCount': '0'}
        with patch.object(store, 'json', side_effect=[{'+@xmlns': 'oss'}, one, empty]):
            rows = store.list()
        self.assertEqual(rows, [{'bucket': MEDIA.SOURCE_BUCKET, 'key': key, 'sizeBytes': 3, 'etag': 'etag'}])
        confirmed = []
        with patch.object(store, 'json', return_value={'Deleted': {'Key': key}}):
            store.delete_many(rows, confirmed.append)
        self.assertEqual(confirmed, rows)


if __name__ == '__main__':
    unittest.main()
