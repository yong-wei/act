#!/usr/bin/env python3
"""Shared textbook resource set loader for release generation scripts."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any


DEFAULT_RESOURCE_SET_PATH = (
    Path(__file__).resolve().parents[1] / 'config' / 'textbook-resource-set.json'
)
_BOOK_ID_PATTERN = re.compile(r'^[a-z0-9][a-z0-9-]*$')
_SAFE_REPO_PATH_PATTERN = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9_./-]*$')


def sanitize_textbook_resource_set(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError('textbook-resource-set-invalid:expected-object')
    resource_set_id = raw.get('resourceSetId')
    source_root = raw.get('sourceRoot')
    config_root = raw.get('configRoot')
    books = raw.get('books')
    if not isinstance(resource_set_id, str) or not resource_set_id:
        raise ValueError('textbook-resource-set-resourceSetId-invalid')
    for field_name, value in (('sourceRoot', source_root), ('configRoot', config_root)):
        if (
            not isinstance(value, str)
            or not _SAFE_REPO_PATH_PATTERN.fullmatch(value)
            or value.startswith('/')
            or '\\' in value
            or '..' in value.split('/')
        ):
            raise ValueError(f'textbook-resource-set-{field_name}-invalid')
    if (
        not isinstance(books, list)
        or not books
        or any(
            not isinstance(book_id, str) or not _BOOK_ID_PATTERN.fullmatch(book_id)
            for book_id in books
        )
        or len(set(books)) != len(books)
    ):
        raise ValueError('textbook-resource-set-books-invalid')
    return {
        'resourceSetId': resource_set_id,
        'sourceRoot': source_root,
        'configRoot': config_root,
        'books': list(books),
    }


def load_textbook_resource_set(path: Path | str | None = None) -> dict[str, Any]:
    resolved = Path(path) if path is not None else DEFAULT_RESOURCE_SET_PATH
    return sanitize_textbook_resource_set(json.loads(resolved.read_text(encoding='utf-8')))


def textbook_book_ids(path: Path | str | None = None) -> list[str]:
    return load_textbook_resource_set(path)['books']


def textbook_book_count(path: Path | str | None = None) -> int:
    return len(textbook_book_ids(path))


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True)


def textbook_resource_set_identity(resource_set: dict[str, Any]) -> dict[str, Any]:
    sanitized = sanitize_textbook_resource_set(resource_set)
    return {
        'resourceSetId': sanitized['resourceSetId'],
        'bookIds': list(sanitized['books']),
    }


def textbook_resource_set_digest(resource_set: dict[str, Any] | None = None) -> str:
    identity = textbook_resource_set_identity(
        resource_set if resource_set is not None else load_textbook_resource_set(),
    )
    return hashlib.sha256(canonical_json(identity).encode('utf-8')).hexdigest()


def main() -> None:
    command = sys.argv[1] if len(sys.argv) > 1 else ''
    resource_set = load_textbook_resource_set()
    if command == 'ids':
        sys.stdout.write('%s\n' % ' '.join(resource_set['books']))
        return
    if command == 'count':
        sys.stdout.write('%s\n' % len(resource_set['books']))
        return
    if command == 'digest':
        sys.stdout.write('%s\n' % textbook_resource_set_digest(resource_set))
        return
    if command == 'identity':
        sys.stdout.write('%s\n' % canonical_json(textbook_resource_set_identity(resource_set)))
        return
    raise SystemExit('unknown command: %s' % command)


if __name__ == '__main__':
    main()
