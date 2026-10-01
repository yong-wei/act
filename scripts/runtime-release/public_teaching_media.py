#!/usr/bin/env python3
"""Capture and publish an allowlisted public copy of the active Runtime media."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

BUCKET = 'act-course-models'
SOURCE_BUCKET = 'act-course-assets'
PREFIX = 'teaching-media/sha256'
ENDPOINT = 'https://oss-cn-hangzhou.aliyuncs.com'
SHA256 = re.compile(r'^[a-f0-9]{64}$')
TYPES = {
    '.mp4': 'video/mp4', '.webm': 'video/webm',
    '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.pdf': 'application/pdf', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
}

CAPTURE_SCRIPT = r'''
const fs = require('fs');
const crypto = require('crypto');
const root = '/app/course-content/runtime/';
const name = root + '.act-runtime-release.v2.json';
const before = fs.readFileSync(name);
const manifest = JSON.parse(before.toString('utf8'));
const receipt = JSON.parse(fs.readFileSync(process.env.ACT_RUNTIME_ACTIVE_RECEIPT_PATH, 'utf8'));
if (receipt.selection.releaseId !== manifest.releaseId || receipt.selection.manifestSha256 !== manifest.manifestSha256) throw new Error('active-source-mismatch');
const read = (relative) => JSON.parse(fs.readFileSync(root + relative, 'utf8'));
const source = {
  sourceRuntime: { releaseId: manifest.releaseId, manifestSha256: manifest.manifestSha256 },
  sourceFileCount: manifest.files.length,
  files: manifest.files.filter((f) => /^(?:lessons\/|knowledge\/infographs\/|resources\/textbooks\/)/.test(f.path) && /\.(?:mp4|webm|m4a|mp3|wav|pdf|png|jpe?g|webp|gif|svg)$/i.test(f.path)),
  learning: read('knowledge/authority-learning-content-manifest.json'),
  legacy: read('knowledge/infographs/manifest.json')
};
if (!before.equals(fs.readFileSync(name))) throw new Error('source-changed-during-capture');
source.captureWireSha256 = crypto.createHash('sha256').update(before).digest('hex');
console.log(JSON.stringify(source));
'''


def public_path(value):
    if not isinstance(value, str) or '\\' in value or '\0' in value:
        return False
    if any(not part or part.startswith('.') for part in value.split('/')):
        return False
    ext = Path(value).suffix.lower()
    if ext not in TYPES:
        return False
    return bool(
        re.fullmatch(r'lessons/[^/]+/media/[^/]+', value)
        or (ext == '.pdf' and re.fullmatch(r'lessons/[^/]+/[^/]+', value))
        or (TYPES[ext].startswith('image/') and re.fullmatch(r'resources/textbooks/[a-z0-9][a-z0-9-]{0,95}/assets/[^/]+/[^/]+', value))
        or (ext == '.png' and re.fullmatch(r'knowledge/infographs/(?:authority/)?nodes/[^/]+', value))
    )


def destination_key(item):
    return '{}/{}/asset{}'.format(PREFIX, item['sha256'], Path(item['path']).suffix.lower())


def build_inventory(source):
    identity = source['sourceRuntime']
    if not re.fullmatch(r'runtime-[a-f0-9]{20,80}', identity['releaseId']) or not SHA256.fullmatch(identity['manifestSha256']):
        raise ValueError('invalid-runtime-identity')
    learning = source['learning']
    if learning.get('contract') != 'act-authority-learning-content-manifest/v2':
        raise ValueError('invalid-learning-content-contract')
    if not learning.get('teachingProjectionId') or not SHA256.fullmatch(learning.get('teachingProjectionHash', '')):
        raise ValueError('unsealed-learning-content')
    accepted = {}
    for row in learning['nodes']:
        image = row['infograph']
        if image.get('state') != 'available':
            continue
        token = row['safeId']
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,199}', token) or not SHA256.fullmatch(image.get('sha256', '')):
            raise ValueError('invalid-accepted-infograph')
        p = 'knowledge/infographs/authority/nodes/{}.png'.format(token)
        if p in accepted:
            raise ValueError('duplicate-accepted-infograph')
        accepted[p] = image['sha256']
    legacy_paths = set()
    for row in source['legacy'].get('items', []):
        p = row.get('path', '')
        if p.startswith('course-content/runtime/'):
            p = p[len('course-content/runtime/'):]
        if re.fullmatch(r'knowledge/infographs/nodes/[^/]+\.png', p):
            legacy_paths.add(p)
    objects = []
    seen = set()
    rejected = 0
    for item in source['files']:
        p = item['path']
        if p in seen:
            raise ValueError('duplicate-runtime-path')
        seen.add(p)
        if not public_path(p):
            rejected += 1
            continue
        if p.startswith('knowledge/infographs/authority/nodes/'):
            if p not in accepted:
                rejected += 1
                continue
            if accepted[p] != item['sha256']:
                raise ValueError('accepted-infograph-digest-mismatch')
        elif p.startswith('knowledge/infographs/nodes/') and p not in legacy_paths:
            rejected += 1
            continue
        digest = item['sha256']
        size = item['sizeBytes']
        if not SHA256.fullmatch(digest) or not isinstance(size, int) or isinstance(size, bool) or size < 0:
            raise ValueError('invalid-runtime-object')
        if item.get('objectKey') != 'runtime/blobs/sha256/' + digest:
            raise ValueError('unexpected-runtime-source-key')
        objects.append({
            'path': p, 'sha256': digest, 'sizeBytes': size,
            'mediaType': TYPES[Path(p).suffix.lower()], 'publicEligible': True,
        })
    if not set(accepted).issubset(seen):
        raise ValueError('accepted-infograph-missing-from-runtime')
    if not objects:
        raise ValueError('empty-public-inventory')
    return {
        'schemaVersion': 'act-public-teaching-media/v1', 'verified': False,
        'sourceRuntime': identity, 'objects': sorted(objects, key=lambda row: row['path']),
        'inventory': {'sourceFileCount': source['sourceFileCount'], 'candidateCount': len(source['files']), 'includedCount': len(objects), 'excludedCount': rejected},
    }


def write_index(filename, index):
    target = Path(filename)
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        with target.open(encoding='utf-8') as handle:
            if json.load(handle) == index:
                return
        raise ValueError('existing-index-conflict')
    temporary = target.with_name(target.name + '.tmp')
    with temporary.open('w', encoding='utf-8') as handle:
        os.chmod(str(temporary), 0o600)
        header = {key: value for key, value in index.items() if key != 'objects'}
        prefix = json.dumps(header, ensure_ascii=False, indent=2).rstrip()[:-1]
        handle.write(prefix + ',\n  "objects": [\n')
        for number, item in enumerate(index['objects']):
            handle.write('    ' + json.dumps(item, ensure_ascii=False) + (',' if number + 1 < len(index['objects']) else '') + '\n')
        handle.write('  ]\n}\n')
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(str(temporary), str(target))


def capture(args):
    result = subprocess.run(
        ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', args.host,
         'podman', 'exec', '-i', 'act-obe-app', 'node', '-'],
        input=CAPTURE_SCRIPT, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        universal_newlines=True, check=True,
    )
    source = json.loads(result.stdout)
    index = build_inventory(source)
    write_index(args.output, index)
    print(json.dumps({'sourceRuntime': index['sourceRuntime'], 'inventory': index['inventory'], 'uniqueObjectCount': len(set(destination_key(row) for row in index['objects'])), 'logicalBytes': sum(row['sizeBytes'] for row in index['objects'])}, ensure_ascii=False))


IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'


def optional_head(bucket, key):
    try:
        return bucket.head_object(key)
    except Exception as error:
        if getattr(error, 'status', None) == 404:
            return None
        raise


def verify_target(result, item):
    if result is None or result.content_length != item['sizeBytes']:
        raise ValueError('destination-size-mismatch')
    if result.headers.get('x-oss-meta-sha256') != item['sha256']:
        raise ValueError('destination-digest-metadata-mismatch')
    if result.headers.get('Content-Type') != item['mediaType']:
        raise ValueError('destination-media-type-mismatch')
    if result.headers.get('Cache-Control') != IMMUTABLE_CACHE:
        raise ValueError('destination-cache-metadata-mismatch')


def copy_one(source, destination, item):
    key = destination_key(item)
    existing = optional_head(destination, key)
    if existing is not None:
        verify_target(existing, item)
        return 'reused'
    source_key = 'runtime/blobs/sha256/' + item['sha256']
    before = source.head_object(source_key)
    if before.content_length != item['sizeBytes']:
        raise ValueError('source-size-mismatch')
    headers = {
        'x-oss-metadata-directive': 'REPLACE',
        'x-oss-copy-source-if-match': '"{}"'.format(before.etag.strip('"')),
        'x-oss-forbid-overwrite': 'true',
        'x-oss-object-acl': 'private',
        'x-oss-meta-sha256': item['sha256'],
        'Content-Type': item['mediaType'],
        'Cache-Control': IMMUTABLE_CACHE,
    }
    try:
        destination.copy_object(SOURCE_BUCKET, source_key, key, headers=headers)
    except Exception as error:
        if getattr(error, 'code', '') != 'FileAlreadyExists':
            raise
    after = destination.head_object(key)
    verify_target(after, item)
    source_crc = before.headers.get('x-oss-hash-crc64ecma')
    if source_crc and source_crc != after.headers.get('x-oss-hash-crc64ecma'):
        raise ValueError('copied-byte-crc-mismatch')
    return 'created'


def validate_inventory(index):
    if index.get('schemaVersion') != 'act-public-teaching-media/v1' or not index.get('objects'):
        raise ValueError('invalid-public-inventory')
    identity = index.get('sourceRuntime', {})
    if not re.fullmatch(r'runtime-[a-f0-9]{20,80}', identity.get('releaseId', '')) or not SHA256.fullmatch(identity.get('manifestSha256', '')):
        raise ValueError('invalid-runtime-identity')
    seen = set()
    for item in index['objects']:
        p = item.get('path', '')
        if not public_path(p) or p in seen or item.get('publicEligible') is not True:
            raise ValueError('invalid-public-object-qualification')
        seen.add(p)
        if not SHA256.fullmatch(item.get('sha256', '')) or item.get('mediaType') != TYPES[Path(p).suffix.lower()]:
            raise ValueError('invalid-public-object-identity')
        if not isinstance(item.get('sizeBytes'), int) or isinstance(item['sizeBytes'], bool) or item['sizeBytes'] < 0:
            raise ValueError('invalid-public-object-size')


def publish(args):
    import oss2
    with open(args.inventory, encoding='utf-8') as handle:
        index = json.load(handle)
    validate_inventory(index)
    key_id = os.environ.get('ALIBABA_CLOUD_ACCESS_KEY_ID') or os.environ.get('ACCESS_KEY_ID')
    key_secret = os.environ.get('ALIBABA_CLOUD_ACCESS_KEY_SECRET') or os.environ.get('ACCESS_KEY_SECRET')
    if not key_id or not key_secret:
        raise ValueError('missing-managed-publisher-identity')
    token = os.environ.get('ALIBABA_CLOUD_SECURITY_TOKEN') or os.environ.get('SECURITY_TOKEN')
    auth = oss2.StsAuth(key_id, key_secret, token) if token else oss2.Auth(key_id, key_secret)
    source = oss2.Bucket(auth, ENDPOINT, SOURCE_BUCKET)
    destination = oss2.Bucket(auth, ENDPOINT, BUCKET)
    unique = {}
    for item in index['objects']:
        key = destination_key(item)
        if key in unique and unique[key]['sizeBytes'] != item['sizeBytes']:
            raise ValueError('conflicting-duplicate-digest')
        unique[key] = item
    counts = {'created': 0, 'reused': 0}
    failures = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = {pool.submit(copy_one, source, destination, item): item for item in unique.values()}
        for future in as_completed(jobs):
            item = jobs[future]
            try:
                counts[future.result()] += 1
            except Exception as error:
                # Object identity is useful; credential/provider error text is not.
                failures.append({'sha256': item['sha256'], 'code': getattr(error, 'code', type(error).__name__)})
            completed = sum(counts.values()) + len(failures)
            if completed % 100 == 0 or completed == len(jobs):
                print(json.dumps({'completed': completed, 'total': len(jobs), 'counts': counts, 'failed': len(failures)}), flush=True)
    if failures:
        print(json.dumps({'status': 'failed', 'failureCount': len(failures), 'firstFailures': failures[:5]}), flush=True)
        raise ValueError('incomplete-publication')
    index['verified'] = True
    index['publication'] = {'bucket': BUCKET, 'objectCount': len(unique), 'counts': counts}
    write_index(args.output, index)
    print(json.dumps({'status': 'complete', 'objects': len(unique), 'logicalFiles': len(index['objects']), 'indexFile': str(args.output)}), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command')
    command = sub.add_parser('capture')
    command.add_argument('--host', default='root@121.40.124.135')
    command.add_argument('--output', required=True)
    command = sub.add_parser('publish')
    command.add_argument('--inventory', required=True)
    command.add_argument('--output', required=True)
    command.add_argument('--workers', type=int, default=8)
    args = parser.parse_args()
    if args.command == 'capture':
        capture(args)
    elif args.command == 'publish':
        if not 1 <= args.workers <= 16:
            parser.error('workers must be between 1 and 16')
        publish(args)
    else:
        parser.error('a command is required')


if __name__ == '__main__':
    main()
