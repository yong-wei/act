#!/usr/bin/env python3
"""Export only media assets referenced by the structured textbook runtime."""

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from textbook_resource_set import load_textbook_resource_set


COURSE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_AUTHORING_ROOT = COURSE_ROOT / 'authoring' / 'resources'


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding='utf-8'))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def source_root(authoring_root: Path, book_id: str, source_kind: str) -> Path:
    collection = 'references' if source_kind == 'reference-collection' else 'textbooks'
    return authoring_root / collection / book_id


def export_book_assets(
    *,
    authoring_root: Path,
    config_path: Path,
    output_root: Path,
) -> int:
    config = read_json(config_path)
    book_id = config['resourceId']
    book_root = source_root(authoring_root, book_id, config['sourceKind'])
    book_manifest = read_json(book_root / 'manifest.json')
    units = book_manifest.get('sections') or book_manifest.get('chapters') or []
    copied = 0
    for unit in units:
        manifest_relative = Path(unit['manifestPath'])
        unit_root = book_root / manifest_relative.parent
        unit_manifest = read_json(book_root / manifest_relative)
        chapter_id = str(unit['id'])
        for image in unit_manifest.get('images', []):
            export_path = image.get('exportPath')
            if not isinstance(export_path, str):
                continue
            source = unit_root / export_path
            if not source.is_file():
                raise FileNotFoundError(
                    f'textbook-runtime-asset-missing:{book_id}:{chapter_id}:{export_path}',
                )
            expected_hash = image.get('sha256')
            actual_hash = sha256(source)
            if isinstance(expected_hash, str) and actual_hash != expected_hash:
                raise ValueError(
                    f'textbook-runtime-asset-hash-mismatch:{book_id}:{chapter_id}:{export_path}',
                )
            destination = output_root / book_id / 'assets' / chapter_id / source.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
            copied += 1
    return copied


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--authoring-root', type=Path)
    parser.add_argument('--config-root', type=Path)
    parser.add_argument('--resource-set', type=Path)
    parser.add_argument('--output-root', type=Path, required=True)
    args = parser.parse_args()

    if args.resource_set is not None:
        resource_set = load_textbook_resource_set(args.resource_set)
        config_root = Path.cwd() / resource_set['configRoot']
        authoring_root = (
            args.authoring_root
            if args.authoring_root is not None
            else Path.cwd() / resource_set['sourceRoot']
        )
        config_paths = [
            config_root / f'{book_id}.json'
            for book_id in resource_set['books']
        ]
        missing = [str(path) for path in config_paths if not path.is_file()]
        if missing:
            raise ValueError(
                f'textbook-runtime-assets-config-missing:{";".join(missing)}',
            )
    elif args.config_root is not None:
        config_root = args.config_root
        authoring_root = args.authoring_root or DEFAULT_AUTHORING_ROOT
        config_paths = sorted(config_root.glob('*.json'))
    else:
        parser.error('--resource-set or --config-root is required')
    if args.output_root.exists():
        shutil.rmtree(args.output_root)
    counts = {
        read_json(config_path)['resourceId']: export_book_assets(
            authoring_root=authoring_root,
            config_path=config_path,
            output_root=args.output_root,
        )
        for config_path in config_paths
    }
    print(json.dumps({'books': counts, 'assets': sum(counts.values())}, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
