#!/usr/bin/env python3
"""Parse and digest textbook input provenance v1/v2."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

from textbook_resource_set import (
    canonical_json,
    sanitize_textbook_resource_set,
    textbook_resource_set_digest,
    textbook_resource_set_identity,
)

V1 = 'act.textbook-runtime-input-provenance.v1'
V2 = 'act.textbook-runtime-input-provenance.v2'
REVISION = re.compile(r'^[0-9a-f]{40}$')
SHA256 = re.compile(r'^[0-9a-f]{64}$')
BOOK_ID = re.compile(r'^[a-z0-9][a-z0-9-]*$')
V1_KEYS = ['inputDigest', 'inputFileCount', 'schemaVersion', 'sourceRevision']
V2_KEYS = [
    'authoringSourceRevision',
    'bookIds',
    'generator',
    'inputDigest',
    'inputFileCount',
    'resourceSetDigest',
    'resourceSetId',
    'schemaVersion',
]


def _exact(value: Any, keys: list[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or sorted(value.keys()) != keys:
        raise ValueError(f'{label}-invalid')
    return value


def _revision(value: Any, field: str) -> str:
    if not isinstance(value, str) or not REVISION.fullmatch(value):
        raise ValueError(f'textbook-v2-{field}-invalid:{value}')
    return value


def _digest(value: Any, field: str) -> str:
    if not isinstance(value, str) or not SHA256.fullmatch(value):
        raise ValueError(f'textbook-v2-{field}-invalid:{value}')
    return value


def _count(value: Any, field: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise ValueError(f'textbook-v2-{field}-invalid:{value}')
    return value


def parse_textbook_input_provenance(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError('textbook-v2-input-provenance-invalid')
    schema = value.get('schemaVersion')
    if schema == V1:
        raw = _exact(value, V1_KEYS, 'textbook-v2-input-provenance')
        return {
            'schemaVersion': V1,
            'sourceRevision': _revision(raw['sourceRevision'], 'input-provenance-source-revision'),
            'inputDigest': _digest(raw['inputDigest'], 'input-provenance-input-digest'),
            'inputFileCount': _count(raw['inputFileCount'], 'input-provenance-input-file-count'),
        }
    if schema != V2:
        raise ValueError(f'textbook-v2-input-provenance-schema-invalid:{schema}')
    raw = _exact(value, V2_KEYS, 'textbook-v2-input-provenance')
    book_ids = raw['bookIds']
    if (
        not isinstance(book_ids, list)
        or not book_ids
        or any(not isinstance(book_id, str) or not BOOK_ID.fullmatch(book_id) for book_id in book_ids)
        or len(set(book_ids)) != len(book_ids)
    ):
        raise ValueError('textbook-v2-input-provenance-book-ids-invalid')
    generator = raw['generator']
    if (
        not isinstance(generator, dict)
        or sorted(generator.keys()) != ['id', 'version']
        or not isinstance(generator['id'], str)
        or not isinstance(generator['version'], str)
        or not generator['id']
        or not generator['version']
    ):
        raise ValueError('textbook-v2-input-provenance-generator-invalid')
    if not isinstance(raw['resourceSetId'], str) or not raw['resourceSetId']:
        raise ValueError('textbook-v2-input-provenance-resource-set-invalid')
    expected = textbook_resource_set_digest(sanitize_textbook_resource_set({
        'resourceSetId': raw['resourceSetId'],
        'sourceRoot': 'course-content/authoring/resources',
        'configRoot': 'course-content/config/textbook-structure-v2',
        'books': book_ids,
    }))
    actual = _digest(raw['resourceSetDigest'], 'input-provenance-resource-set-digest')
    if actual != expected:
        raise ValueError(
            f'textbook-v2-input-provenance-resource-set-digest-mismatch:expected={expected} actual={actual}',
        )
    return {
        'schemaVersion': V2,
        'authoringSourceRevision': _revision(
            raw['authoringSourceRevision'],
            'input-provenance-authoring-source-revision',
        ),
        'resourceSetId': raw['resourceSetId'],
        'bookIds': list(book_ids),
        'resourceSetDigest': actual,
        'inputDigest': _digest(raw['inputDigest'], 'input-provenance-input-digest'),
        'inputFileCount': _count(raw['inputFileCount'], 'input-provenance-input-file-count'),
        'generator': {'id': generator['id'], 'version': generator['version']},
    }


def serialize_textbook_input_provenance(value: Any) -> str:
    return canonical_json(parse_textbook_input_provenance(value)) + '\n'


def build_textbook_input_provenance_v2(payload: dict[str, Any]) -> dict[str, Any]:
    identity = textbook_resource_set_identity(sanitize_textbook_resource_set({
        'resourceSetId': payload['resourceSetId'],
        'sourceRoot': payload.get('sourceRoot', 'course-content/authoring/resources'),
        'configRoot': payload.get('configRoot', 'course-content/config/textbook-structure-v2'),
        'books': payload['bookIds'],
    }))
    return parse_textbook_input_provenance({
        'schemaVersion': V2,
        'authoringSourceRevision': payload['authoringSourceRevision'],
        'resourceSetId': identity['resourceSetId'],
        'bookIds': list(identity['bookIds']),
        'resourceSetDigest': textbook_resource_set_digest(sanitize_textbook_resource_set({
            'resourceSetId': identity['resourceSetId'],
            'sourceRoot': payload.get('sourceRoot', 'course-content/authoring/resources'),
            'configRoot': payload.get('configRoot', 'course-content/config/textbook-structure-v2'),
            'books': list(identity['bookIds']),
        })),
        'inputDigest': payload['inputDigest'],
        'inputFileCount': payload['inputFileCount'],
        'generator': payload['generator'],
    })


if __name__ == '__main__':
    raw = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8') if len(sys.argv) > 1 else sys.stdin.read())
    sys.stdout.write(serialize_textbook_input_provenance(raw))
