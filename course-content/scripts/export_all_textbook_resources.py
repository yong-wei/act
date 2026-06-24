#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from export_textbook_resources import (
    COURSE_ROOT,
    DEFAULT_RUNTIME_ROOT,
    export_book,
)


DEFAULT_TEXTBOOK_AUTHORING_ROOT = COURSE_ROOT / 'authoring' / 'resources' / 'textbooks'
DEFAULT_REFERENCE_AUTHORING_ROOT = COURSE_ROOT / 'authoring' / 'resources' / 'references'


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Export all authoring textbook and reference resources into runtime search artifacts.',
    )
    parser.add_argument(
        '--kind',
        choices=['all', 'textbooks', 'references'],
        default='all',
        help='Resource collection to export.',
    )
    parser.add_argument('--check', action='store_true', help='Parse and print audit summaries without writing runtime files.')
    parser.add_argument('--textbook-authoring-root', type=Path, default=DEFAULT_TEXTBOOK_AUTHORING_ROOT)
    parser.add_argument('--reference-authoring-root', type=Path, default=DEFAULT_REFERENCE_AUTHORING_ROOT)
    parser.add_argument('--runtime-root', type=Path, default=DEFAULT_RUNTIME_ROOT)
    parser.add_argument('--max-chunk-chars', type=int, default=2800)
    return parser.parse_args()


def discover_resource_ids(root: Path) -> list[str]:
    if not root.exists():
        return []
    return sorted(
        path.name
        for path in root.iterdir()
        if path.is_dir() and (path / 'manifest.json').exists()
    )


def export_collection(
    *,
    label: str,
    authoring_root: Path,
    runtime_root: Path,
    max_chunk_chars: int,
    write: bool,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for resource_id in discover_resource_ids(authoring_root):
        counts = export_book(
            book_id=resource_id,
            authoring_root=authoring_root,
            runtime_root=runtime_root,
            max_chunk_chars=max_chunk_chars,
            write=write,
        )
        results.append({
            'kind': label,
            'resourceId': resource_id,
            'counts': counts,
        })
    return results


def main() -> int:
    args = parse_args()
    write = not args.check
    results: list[dict[str, Any]] = []
    if args.kind in {'all', 'textbooks'}:
        results.extend(export_collection(
            label='textbook',
            authoring_root=args.textbook_authoring_root,
            runtime_root=args.runtime_root,
            max_chunk_chars=args.max_chunk_chars,
            write=write,
        ))
    if args.kind in {'all', 'references'}:
        results.extend(export_collection(
            label='reference',
            authoring_root=args.reference_authoring_root,
            runtime_root=args.runtime_root,
            max_chunk_chars=args.max_chunk_chars,
            write=write,
        ))

    summary = {
        'mode': 'check' if args.check else 'write',
        'resources': len(results),
        'results': results,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
