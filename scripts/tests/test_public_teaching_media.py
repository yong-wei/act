import copy
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

SPEC = importlib.util.spec_from_file_location('public_teaching_media', Path(__file__).resolve().parents[1] / 'runtime-release/public_teaching_media.py')
media = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(media)
DIGEST = 'a' * 64


def item(path='lessons/1-1/media/video.mp4', digest=DIGEST):
    return {'path': path, 'sha256': digest, 'sizeBytes': 12, 'objectKey': 'runtime/blobs/sha256/' + digest}


def source():
    return {
        'sourceRuntime': {'releaseId': 'runtime-' + 'c' * 56, 'manifestSha256': 'b' * 64},
        'sourceFileCount': 5,
        'files': [item(), item('knowledge/infographs/authority/nodes/ctc_good.png'),
                  item('knowledge/infographs/authority/nodes/ctc_blocked.png'),
                  item('resource-governance/private.png')],
        'learning': {'contract': 'act-authority-learning-content-manifest/v2',
                     'teachingProjectionId': 'projection-1', 'teachingProjectionHash': 'd' * 64,
                     'nodes': [{'safeId': 'ctc_good', 'infograph': {'state': 'available', 'sha256': DIGEST}}]},
        'legacy': {'items': []},
    }


class Missing(Exception):
    status = 404


class FakeBucket:
    def __init__(self, result=None):
        self.result = result
        self.copies = []

    def head_object(self, key):
        if self.result is None:
            raise Missing()
        return self.result

    def copy_object(self, bucket, source_key, key, headers):
        self.copies.append((bucket, source_key, key, headers))
        self.result = SimpleNamespace(content_length=12, etag='source-etag', headers={
            'Content-Type': headers['Content-Type'], 'Cache-Control': headers['Cache-Control'],
            'x-oss-meta-sha256': headers['x-oss-meta-sha256'], 'x-oss-hash-crc64ecma': '123',
        })


class PublicMediaTest(unittest.TestCase):
    def test_inventory_excludes_private_and_unaccepted_sources(self):
        inventory = media.build_inventory(source())
        self.assertEqual(len(inventory['objects']), 2)
        self.assertEqual(inventory['inventory']['excludedCount'], 2)
        self.assertFalse(inventory['verified'])

    def test_unsealed_or_drifted_infograph_fails(self):
        invalid = source()
        del invalid['learning']['teachingProjectionHash']
        with self.assertRaisesRegex(ValueError, 'unsealed'):
            media.build_inventory(invalid)
        invalid = source()
        invalid['learning']['nodes'][0]['infograph']['sha256'] = 'e' * 64
        with self.assertRaisesRegex(ValueError, 'digest-mismatch'):
            media.build_inventory(invalid)

    def test_duplicate_and_missing_accepted_paths_fail(self):
        invalid = source()
        invalid['files'].append(copy.deepcopy(invalid['files'][0]))
        with self.assertRaisesRegex(ValueError, 'duplicate-runtime-path'):
            media.build_inventory(invalid)
        invalid = source()
        invalid['files'].pop(1)
        with self.assertRaisesRegex(ValueError, 'missing-from-runtime'):
            media.build_inventory(invalid)

    def test_arbitrary_source_keys_and_public_flags_fail(self):
        invalid = source()
        invalid['files'][0]['objectKey'] = 'assessment/private-answer'
        with self.assertRaisesRegex(ValueError, 'source-key'):
            media.build_inventory(invalid)
        inventory = media.build_inventory(source())
        inventory['objects'][0]['publicEligible'] = False
        with self.assertRaisesRegex(ValueError, 'qualification'):
            media.validate_inventory(inventory)

    def test_incremental_json_output_is_valid_and_preserves_existing_evidence(self):
        inventory = media.build_inventory(source())
        with tempfile.TemporaryDirectory() as root:
            target = Path(root) / 'inventory.json'
            media.write_index(target, inventory)
            self.assertEqual(json.loads(target.read_text()), inventory)
            media.write_index(target, inventory)
            changed = copy.deepcopy(inventory)
            changed['verified'] = True
            with self.assertRaisesRegex(ValueError, 'existing-index-conflict'):
                media.write_index(target, changed)

    def test_copy_is_source_fenced_private_and_non_overwriting(self):
        inventory = media.build_inventory(source())
        before = SimpleNamespace(content_length=12, etag='source-etag', headers={'x-oss-hash-crc64ecma': '123'})
        origin = FakeBucket(before)
        target = FakeBucket()
        self.assertEqual(media.copy_one(origin, target, inventory['objects'][0]), 'created')
        headers = target.copies[0][3]
        self.assertEqual(headers['x-oss-forbid-overwrite'], 'true')
        self.assertEqual(headers['x-oss-copy-source-if-match'], '"source-etag"')
        self.assertEqual(headers['x-oss-object-acl'], 'private')
        self.assertEqual(media.copy_one(origin, target, inventory['objects'][0]), 'reused')
        self.assertEqual(len(target.copies), 1)

    def test_conflicting_existing_copy_is_never_overwritten(self):
        inventory = media.build_inventory(source())
        target = FakeBucket(SimpleNamespace(content_length=13, headers={}))
        with self.assertRaisesRegex(ValueError, 'size-mismatch'):
            media.copy_one(FakeBucket(), target, inventory['objects'][0])
        self.assertEqual(target.copies, [])


if __name__ == '__main__':
    unittest.main()
