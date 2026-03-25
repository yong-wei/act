from __future__ import annotations

import argparse
import sys
from pathlib import Path


REQUIRED_HEADER_FIELDS = (
    '状态:',
    '最后更新:',
    '摘要:',
    '上游:',
    '下游:',
    '相关:',
)

ROOT_REQUIRED_FILES = (
    'README.md',
    '00-index.md',
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='校验 .codex/memory 目录的最小结构与 Markdown 文件头部字段。',
    )
    parser.add_argument(
        'memory_root',
        nargs='?',
        default='.codex/memory',
        help='待校验的 memory 根目录，默认是 .codex/memory',
    )
    return parser.parse_args()


def find_missing_header_fields(path: Path) -> list[str]:
    content = path.read_text(encoding='utf-8')
    return [field for field in REQUIRED_HEADER_FIELDS if field not in content]


def validate_root_files(memory_root: Path) -> list[str]:
    errors: list[str] = []
    for filename in ROOT_REQUIRED_FILES:
        if not (memory_root / filename).is_file():
            errors.append(f'root missing required file: {filename}')
    return errors


def validate_directory_indexes(memory_root: Path) -> list[str]:
    errors: list[str] = []
    for child in sorted(path for path in memory_root.iterdir() if path.is_dir()):
        expected = 'README.md' if child.name == '90-archive' else '00-index.md'
        if not (child / expected).is_file():
            errors.append(f'directory missing {expected}: {child.name}')
    return errors


def validate_markdown_headers(memory_root: Path) -> list[str]:
    errors: list[str] = []
    for path in sorted(memory_root.rglob('*.md')):
        missing_fields = find_missing_header_fields(path)
        if not missing_fields:
            continue
        rel_path = path.relative_to(memory_root)
        errors.append(
            f'markdown missing header fields: {rel_path} -> {", ".join(missing_fields)}'
        )
    return errors


def validate_memory(memory_root: Path) -> list[str]:
    if not memory_root.exists():
        return [f'memory root does not exist: {memory_root}']

    if not memory_root.is_dir():
        return [f'memory root is not a directory: {memory_root}']

    errors: list[str] = []
    errors.extend(validate_root_files(memory_root))
    errors.extend(validate_directory_indexes(memory_root))
    errors.extend(validate_markdown_headers(memory_root))
    return errors


def main() -> int:
    args = parse_args()
    memory_root = Path(args.memory_root).resolve()
    errors = validate_memory(memory_root)

    if errors:
        print('memory validation failed:')
        for error in errors:
            print(f'- {error}')
        return 1

    markdown_count = len(list(memory_root.rglob('*.md')))
    print(f'memory validation passed: {markdown_count} markdown files checked in {memory_root}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
