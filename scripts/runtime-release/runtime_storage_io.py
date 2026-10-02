"""Exact object operations for explicit Runtime body maintenance (Python 3.6)."""

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

import runtime_media_storage as MEDIA

PRIVATE_PREFIX = 'runtime/blobs/sha256/'


def body_digest(bucket, key):
    if bucket == MEDIA.SOURCE_BUCKET:
        return key[len(PRIVATE_PREFIX):] if key.startswith(PRIVATE_PREFIX) and MEDIA.SHA256.fullmatch(key[len(PRIVATE_PREFIX):]) else None
    if bucket == MEDIA.MEDIA_BUCKET:
        match = re.fullmatch(r'teaching-media/sha256/([a-f0-9]{64})/asset(\.[a-z0-9]+)', key)
        return match.group(1) if match and match.group(2) in MEDIA.TYPES else None
    return None


class BodyStore:
    def __init__(self, bucket, root=None, ossutil='ossutil', extra_args=()):
        if bucket not in (MEDIA.SOURCE_BUCKET, MEDIA.MEDIA_BUCKET):
            raise MEDIA.MediaStorageError('unsupported-body-bucket')
        self.bucket = bucket
        self.root = Path(root) if root is not None else None
        self.ossutil = ossutil
        self.extra_args = list(extra_args)
        self.prefix = PRIVATE_PREFIX if bucket == MEDIA.SOURCE_BUCKET else MEDIA.MEDIA_PREFIX

    def run(self, arguments):
        process = subprocess.run([self.ossutil] + self.extra_args + arguments, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, universal_newlines=True)
        if process.returncode:
            # Never echo credential-bearing CLI diagnostics or signed URLs.
            raise MEDIA.MediaStorageError('body-store-operation-failed: ' + self.bucket + '/' + arguments[1])
        return process.stdout

    def json(self, operation, arguments=()):
        output = self.run(['api', operation, '--bucket', self.bucket] + list(arguments) + ['--output-format', 'json'])
        # ossutil may append an elapsed-time line after its JSON value.
        start = output.find('{')
        if start < 0:
            raise MEDIA.MediaStorageError('body-store-invalid-response')
        value, _ = json.JSONDecoder().raw_decode(output[start:])
        if not isinstance(value, dict):
            raise MEDIA.MediaStorageError('body-store-invalid-response')
        return value.get('body', value.get('Body', value))

    def path(self, key):
        if not body_digest(self.bucket, key) or self.root is None:
            raise MEDIA.MediaStorageError('unsafe-body-key')
        candidate = self.root.joinpath(*key.split('/'))
        cursor = candidate
        while cursor != self.root:
            if cursor.is_symlink():
                raise MEDIA.MediaStorageError('unsafe-body-store-symlink')
            cursor = cursor.parent
        if self.root.is_symlink():
            raise MEDIA.MediaStorageError('unsafe-body-store-root')
        return candidate

    def list(self):
        found = []
        if self.root is not None:
            prefix = self.root.joinpath(*self.prefix.rstrip('/').split('/'))
            if not prefix.exists():
                return found
            for path in prefix.rglob('*'):
                if not path.is_file():
                    continue
                key = path.relative_to(self.root).as_posix()
                if not body_digest(self.bucket, key):
                    continue
                info = self.path(key).stat()
                found.append({'bucket': self.bucket, 'key': key, 'sizeBytes': info.st_size,
                              'etag': str(info.st_mtime_ns)})
            return sorted(found, key=lambda item: item['key'])
        versioning = self.json('get-bucket-versioning')
        if versioning.get('Status') not in (None, '', 'Disabled'):
            raise MEDIA.MediaStorageError('versioned-body-bucket-requires-separate-plan')
        token = None
        seen_tokens = set()
        seen_keys = set()
        while True:
            arguments = ['--prefix', self.prefix, '--max-keys', '1000']
            if token:
                arguments.extend(['--continuation-token', token])
            page = self.json('list-objects-v2', arguments)
            contents = page.get('Contents', [])
            if contents is None:
                contents = []
            if not isinstance(contents, list):
                raise MEDIA.MediaStorageError('invalid-body-object-list')
            for row in contents:
                key = row.get('Key') if isinstance(row, dict) else None
                size = row.get('Size') if isinstance(row, dict) else None
                if not isinstance(key, str) or key in seen_keys or not isinstance(size, int) or size < 0:
                    raise MEDIA.MediaStorageError('invalid-body-object-list')
                seen_keys.add(key)
                if not body_digest(self.bucket, key):
                    continue
                if not isinstance(row.get('ETag'), str) or not row['ETag']:
                    raise MEDIA.MediaStorageError('body-object-fence-missing')
                found.append({'bucket': self.bucket, 'key': key, 'sizeBytes': size, 'etag': row['ETag']})
            truncated = page.get('IsTruncated')
            if truncated in (False, 'false', None):
                break
            if truncated not in (True, 'true'):
                raise MEDIA.MediaStorageError('invalid-body-list-truncation')
            token = page.get('NextContinuationToken')
            if not isinstance(token, str) or not token or token in seen_tokens:
                raise MEDIA.MediaStorageError('invalid-body-list-continuation')
            seen_tokens.add(token)
        return sorted(found, key=lambda item: item['key'])

    def delete(self, row):
        if row.get('bucket') != self.bucket or not body_digest(self.bucket, row.get('key', '')):
            raise MEDIA.MediaStorageError('unsafe-body-delete')
        key = row['key']
        if self.root is not None:
            path = self.path(key)
            info = path.stat()
            if info.st_size != row['sizeBytes'] or str(info.st_mtime_ns) != row['etag']:
                raise MEDIA.MediaStorageError('body-delete-fence-changed')
            path.unlink()
        else:
            # Managed CAS writes are non-overwriting and use the same host lock.
            # OSS DeleteObject has no ETag condition; the enclosing lock is required.
            self.run(['api', 'delete-object', '--bucket', self.bucket, '--key', key, '-q'])

    def delete_many(self, rows, confirmed, checkpoint=None):
        for row in rows:
            if row.get('bucket') != self.bucket or not body_digest(self.bucket, row.get('key', '')):
                raise MEDIA.MediaStorageError('unsafe-body-delete')
        if len({row['key'] for row in rows}) != len(rows):
            raise MEDIA.MediaStorageError('duplicate-body-delete-key')
        if self.root is not None:
            for row in rows:
                self.delete(row)
                confirmed(row)
                if checkpoint:
                    checkpoint()
            return
        for offset in range(0, len(rows), 1000):
            batch = rows[offset:offset + 1000]
            requested = {row['key']: row for row in batch}
            with tempfile.NamedTemporaryFile(mode='w', prefix='act-runtime-delete-') as handle:
                json.dump({'Quiet': 'false', 'Object': [{'Key': key} for key in requested]}, handle)
                handle.flush()
                result = self.json('delete-multiple-objects', ['--delete', 'file://' + handle.name])
            deleted = result.get('Deleted', [])
            if not isinstance(deleted, list):
                raise MEDIA.MediaStorageError('invalid-body-delete-result')
            keys = [row.get('Key') for row in deleted if isinstance(row, dict)]
            if len(keys) != len(deleted) or len(set(keys)) != len(keys) or any(key not in requested for key in keys):
                raise MEDIA.MediaStorageError('invalid-body-delete-result')
            for key in keys:
                confirmed(requested[key])
            if checkpoint:
                checkpoint()
            if set(keys) != set(requested) or result.get('Error') or result.get('Errors'):
                raise MEDIA.MediaStorageError('body-batch-delete-incomplete')

    def read(self, key):
        if not body_digest(self.bucket, key):
            raise MEDIA.MediaStorageError('unsafe-body-read')
        if self.root is not None:
            return self.path(key).read_bytes()
        with tempfile.TemporaryDirectory(prefix='act-runtime-body-') as directory:
            target = Path(directory) / 'body'
            self.run(['cp', 'oss://' + self.bucket + '/' + key, str(target), '-q'])
            return target.read_bytes()

    def verify(self, key, digest, size):
        payload = self.read(key)
        if len(payload) != size or hashlib.sha256(payload).hexdigest() != digest:
            raise MEDIA.MediaStorageError('body-content-mismatch: ' + key)
        return payload

    def restore(self, key, payload):
        if not body_digest(self.bucket, key):
            raise MEDIA.MediaStorageError('unsafe-body-restore')
        if self.root is not None:
            target = self.path(key)
            target.parent.mkdir(parents=True, exist_ok=True)
            try:
                with target.open('xb') as handle:
                    handle.write(payload)
            except FileExistsError:
                if target.read_bytes() != payload:
                    raise MEDIA.MediaStorageError('conflicting-restored-body')
            return
        with tempfile.NamedTemporaryFile(prefix='act-runtime-restore-') as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
            self.run(['api', 'put-object', '--bucket', self.bucket, '--key', key,
                      '--body', 'file://' + handle.name, '--forbid-overwrite', 'true', '--object-acl', 'private', '-q'])
