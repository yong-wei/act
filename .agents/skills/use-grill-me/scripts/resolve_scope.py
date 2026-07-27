#!/usr/bin/env python3
"""Resolve an isolated Grill-with-Docs scope without mutating the repository."""

from __future__ import annotations

import argparse
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from typing import Iterable


MAX_SCOPE_LENGTH = 63
HASH_LENGTH = 12


def _git_value(repo_root: Path, *args: str) -> str | None:
    result = subprocess.run(
        ['git', '-C', str(repo_root), *args],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def sanitize_scope(raw_scope: str) -> str:
    value = raw_scope.strip()
    if not value or not value.isascii():
        digest = hashlib.sha256(value.encode('utf-8')).hexdigest()[:HASH_LENGTH]
        return f'scope-{digest}'

    slug = re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')
    if not slug:
        digest = hashlib.sha256(value.encode('utf-8')).hexdigest()[:HASH_LENGTH]
        return f'scope-{digest}'
    if raw_scope == slug and len(slug) <= MAX_SCOPE_LENGTH:
        return slug

    digest = hashlib.sha256(raw_scope.encode('utf-8')).hexdigest()[:HASH_LENGTH]
    prefix_length = MAX_SCOPE_LENGTH - HASH_LENGTH - 1
    return f"{slug[:prefix_length].rstrip('-')}-{digest}"


def default_session_scope(now: datetime | None = None) -> str:
    current = now or datetime.now().astimezone()
    period = 'am' if current.hour < 12 else 'pm'
    return f'{current:%Y%m%d}-{period}'


def resolve_raw_scope(
    repo_root: Path,
    explicit_scope: str | None,
    now: datetime | None = None,
) -> str:
    if explicit_scope is not None:
        return explicit_scope
    if 'GRILL_SCOPE_ID' in os.environ:
        return os.environ['GRILL_SCOPE_ID']

    configured_scope = _git_value(repo_root, 'config', '--get', 'grill.scopeId')
    if configured_scope is not None:
        return configured_scope

    return default_session_scope(now)


def _relative_existing_files(repo_root: Path, patterns: Iterable[str]) -> list[str]:
    paths: set[str] = set()
    for pattern in patterns:
        for path in repo_root.glob(pattern):
            if path.is_file() and path.name.lower() != 'readme.md':
                paths.add(path.relative_to(repo_root).as_posix())
    return sorted(paths)


def resolve(
    repo_root: Path,
    explicit_scope: str | None = None,
    now: datetime | None = None,
) -> dict[str, object]:
    root = repo_root.resolve()
    scope_id = sanitize_scope(resolve_raw_scope(root, explicit_scope, now))
    output_root = Path('docs') / 'grill' / scope_id

    return {
        'scopeId': scope_id,
        'outputRoot': output_root.as_posix(),
        'contextPath': (output_root / 'CONTEXT.md').as_posix(),
        'adrDir': (output_root / 'adr').as_posix(),
        'manifestPath': (output_root / 'manifest.json').as_posix(),
        'globalContextFiles': _relative_existing_files(
            root,
            ('CONTEXT.md', 'docs/contexts/**/CONTEXT.md', 'docs/grill/*/CONTEXT.md'),
        ),
        'globalAdrFiles': _relative_existing_files(
            root,
            ('docs/adr/**/*.md', 'docs/grill/*/adr/*.md'),
        ),
        'globalManifestFiles': _relative_existing_files(
            root,
            ('docs/grill/*/manifest.json',),
        ),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Resolve the isolated documentation scope for use-grill-me.',
    )
    parser.add_argument('--repo-root', type=Path, default=Path.cwd())
    parser.add_argument('--scope', help='Explicit scope identifier.')
    parser.add_argument('--json', action='store_true')
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = resolve(args.repo_root, args.scope)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(result['scopeId'])
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
