"""Canonical public media locations, separate from immutable Runtime identity.

Shared host-side helpers must remain compatible with Python 3.6.
"""

import hashlib
import json
import os
from pathlib import Path
import re
import tempfile


CATALOG_SCHEMA = 'act-public-teaching-media/v2'
MEDIA_BUCKET = 'act-course-models'
SOURCE_BUCKET = 'act-course-assets'
MEDIA_PREFIX = 'teaching-media/sha256/'
MEDIA_HELPER = '.act-runtime-public-media'
SHA256 = re.compile(r'^[a-f0-9]{64}$')
RELEASE_ID = re.compile(r'^runtime-[a-f0-9]{20,80}$')
TYPES = {
    '.mp4': 'video/mp4', '.webm': 'video/webm',
    '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.pdf': 'application/pdf', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
}


class MediaStorageError(RuntimeError):
    code = 2


def public_path(value):
    if not isinstance(value, str) or '\\' in value or '\0' in value:
        return False
    if any(not part or part.startswith('.') for part in value.split('/')):
        return False
    ext = Path(value).suffix.lower()
    return ext in TYPES and bool(
        re.fullmatch(r'lessons/[^/]+/media/[^/]+', value)
        or (ext == '.pdf' and re.fullmatch(r'lessons/[^/]+/[^/]+', value))
        or (TYPES[ext].startswith('image/') and re.fullmatch(r'resources/textbooks/[a-z0-9][a-z0-9-]{0,95}/assets/[^/]+/[^/]+', value))
        or (ext == '.png' and re.fullmatch(r'knowledge/infographs/(?:authority/)?nodes/[^/]+', value))
    )


def media_key(digest, extension):
    if not isinstance(digest, str) or not SHA256.fullmatch(digest) or extension not in TYPES:
        raise MediaStorageError('invalid-public-media-location')
    return MEDIA_PREFIX + digest + '/asset' + extension


def parse_catalog(raw):
    if not isinstance(raw, dict) or raw.get('verified') is not True or not isinstance(raw.get('objects'), list):
        raise MediaStorageError('invalid-public-media-directory')
    canonical = raw.get('schemaVersion') == CATALOG_SCHEMA
    if not canonical and raw.get('schemaVersion') != 'act-public-teaching-media/v1':
        raise MediaStorageError('invalid-public-media-directory-version')
    if canonical and not isinstance(raw.get('legacyCopiesAvailable'), bool):
        raise MediaStorageError('invalid-legacy-copy-state')
    if not canonical:
        identity = raw.get('sourceRuntime')
        if (not isinstance(identity, dict) or not isinstance(identity.get('releaseId'), str)
                or not RELEASE_ID.fullmatch(identity['releaseId'])
                or not isinstance(identity.get('manifestSha256'), str)
                or not SHA256.fullmatch(identity['manifestSha256']) or not raw['objects']):
            raise MediaStorageError('invalid-legacy-directory-identity')
    objects = {}
    paths = set()
    for row in raw['objects']:
        if (not isinstance(row, dict) or not isinstance(row.get('sha256'), str)
                or not SHA256.fullmatch(row['sha256']) or row.get('publicEligible') is not True
                or not isinstance(row.get('sizeBytes'), int) or isinstance(row['sizeBytes'], bool)
                or row['sizeBytes'] < 0 or row['sizeBytes'] > 9007199254740991):
            raise MediaStorageError('invalid-public-media-object')
        if canonical:
            key = row.get('objectKey')
            if not isinstance(key, str):
                raise MediaStorageError('invalid-public-media-key')
        else:
            relative = row.get('path')
            if not public_path(relative) or relative in paths:
                raise MediaStorageError('invalid-legacy-public-media-path')
            paths.add(relative)
            key = media_key(row['sha256'], Path(relative).suffix.lower())
        ext = Path(key).suffix
        if key != media_key(row['sha256'], ext) or row.get('mediaType') != TYPES[ext]:
            raise MediaStorageError('invalid-public-media-type-or-key')
        item = {'sha256': row['sha256'], 'sizeBytes': row['sizeBytes'], 'mediaType': row['mediaType'],
                'objectKey': key, 'publicEligible': True}
        previous = objects.get(item['sha256'])
        if previous is not None and (previous != item or canonical):
            raise MediaStorageError('conflicting-public-media-digest')
        objects[item['sha256']] = item
    return {'schemaVersion': CATALOG_SCHEMA, 'verified': True,
            'legacyCopiesAvailable': raw['legacyCopiesAvailable'] if canonical else True,
            'objects': sorted(objects.values(), key=lambda item: item['sha256'])}, canonical


def load_catalog(filename, required=False):
    if filename is None:
        if required:
            raise MediaStorageError('public-media-directory-required')
        return None, False
    path = Path(filename)
    if path.is_symlink():
        raise MediaStorageError('unsafe-public-media-directory')
    if not path.exists():
        if required:
            raise MediaStorageError('public-media-directory-missing')
        return None, False
    try:
        return parse_catalog(json.loads(path.read_text(encoding='utf-8')))
    except (OSError, ValueError, TypeError) as error:
        raise MediaStorageError('public-media-directory-unreadable') from error


def catalog_path(state_dir, supplied=None):
    if supplied:
        return Path(supplied)
    override = os.environ.get('ACT_RUNTIME_PUBLIC_MEDIA_DIRECTORY')
    if override:
        return Path(override)
    state = Path(state_dir)
    root = state.parent if state.name == 'blob-views' else state
    return root / 'public-teaching-media' / 'current.json'


def object_map(catalog):
    return {item['sha256']: item for item in catalog['objects']} if catalog else {}


def location_for(item, locations, canonical=True):
    if not canonical:
        return None
    location = locations.get(item['sha256'])
    if location and location['sizeBytes'] != item['sizeBytes']:
        raise MediaStorageError('canonical-media-size-mismatch')
    return location


def public_blob_path(store, digest, location, media_root=None):
    if media_root is not None:
        return Path(media_root).joinpath(*location['objectKey'][len(MEDIA_PREFIX):].split('/'))
    return Path(store).joinpath(*location['objectKey'].split('/'))


def atomic_json(filename, value):
    destination = Path(filename)
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.' + destination.name + '.', dir=str(destination.parent))
    try:
        with os.fdopen(fd, 'w') as handle:
            os.fchmod(handle.fileno(), 0o644)
            json.dump(value, handle, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
            handle.write('\n')
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, str(destination))
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def catalog_digest(catalog):
    body = json.dumps(catalog, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    return hashlib.sha256(body.encode('utf-8')).hexdigest()


def verify_body_file(filename, digest, size):
    actual = hashlib.sha256()
    length = 0
    with Path(filename).open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            actual.update(block)
            length += len(block)
    if length != size or actual.hexdigest() != digest:
        raise MediaStorageError('body-content-mismatch')
