#!/usr/bin/env python3
"""Shared textbook resource set loader for release generation scripts."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


DEFAULT_RESOURCE_SET_PATH = (
    Path(__file__).resolve().parents[1] / 'config' / 'textbook-resource-set.json'
)
_BOOK_ID_PATTERN = re.compile(r'^[a-z0-9][a-z0-9-]*$')
_SAFE_REPO_PATH_PATTERN = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9_./-]*$')


def load_textbook_resource_set(path: Path | str | None = None) -> dict[str, Any]:
    resolved = Path(path) if path is not None else DEFAULT_RESOURCE_SET_PATH
    raw = json.loads(resolved.read_text(encoding='utf-8'))
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


def textbook_book_ids(path: Path | str | None = None) -> list[str]:
    return load_textbook_resource_set(path)['books']


def textbook_book_count(path: Path | str | None = None) -> int:
    return len(textbook_book_ids(path))
