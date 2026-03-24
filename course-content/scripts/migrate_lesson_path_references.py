#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]

TEXT_SUFFIXES = {
    '.md',
    '.mdx',
    '.txt',
    '.json',
    '.jsonl',
    '.py',
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.yml',
    '.yaml',
}

SKIP_FILES = {
    REPO_ROOT / 'course-content' / 'authoring' / 'shared' / 'lesson-id-map.json',
    REPO_ROOT / 'course-content' / 'scripts' / 'lesson_id_map.py',
    REPO_ROOT / 'course-content' / 'scripts' / 'migrate_lesson_path_references.py',
}

REPLACEMENTS = [
    ('course-content/authoring/lessons/1-3', 'course-content/authoring/lessons/2-2'),
    ('course-content/runtime/lessons/1-3', 'course-content/runtime/lessons/2-2'),
    ('course-content/authoring/knowledge/cards/lessons/1-3', 'course-content/authoring/knowledge/cards/lessons/2-2'),
    ('course-content/authoring/knowledge/overlays/1-3', 'course-content/authoring/knowledge/overlays/2-2'),
    ('authoring/lessons/1-3', 'authoring/lessons/2-2'),
    ('runtime/lessons/1-3', 'runtime/lessons/2-2'),
    ('knowledge/cards/lessons/1-3', 'knowledge/cards/lessons/2-2'),
    ('knowledge/overlays/1-3', 'knowledge/overlays/2-2'),
    ('course-content/authoring/lessons/1-1', 'course-content/authoring/lessons/legacy/1-1'),
    ('course-content/runtime/lessons/1-1', 'course-content/runtime/lessons/legacy/1-1'),
    ('course-content/authoring/knowledge/cards/lessons/1-1', 'course-content/authoring/knowledge/cards/lessons/legacy/1-1'),
    ('course-content/authoring/knowledge/overlays/1-1', 'course-content/authoring/knowledge/overlays/legacy/1-1'),
    ('authoring/lessons/1-1', 'authoring/lessons/legacy/1-1'),
    ('runtime/lessons/1-1', 'runtime/lessons/legacy/1-1'),
    ('knowledge/cards/lessons/1-1', 'knowledge/cards/lessons/legacy/1-1'),
    ('knowledge/overlays/1-1', 'knowledge/overlays/legacy/1-1'),
    ('course-content/authoring/lessons/1-2', 'course-content/authoring/lessons/legacy/1-2'),
    ('course-content/runtime/lessons/1-2', 'course-content/runtime/lessons/legacy/1-2'),
    ('course-content/authoring/knowledge/cards/lessons/1-2', 'course-content/authoring/knowledge/cards/lessons/legacy/1-2'),
    ('course-content/authoring/knowledge/overlays/1-2', 'course-content/authoring/knowledge/overlays/legacy/1-2'),
    ('authoring/lessons/1-2', 'authoring/lessons/legacy/1-2'),
    ('runtime/lessons/1-2', 'runtime/lessons/legacy/1-2'),
    ('knowledge/cards/lessons/1-2', 'knowledge/cards/lessons/legacy/1-2'),
    ('knowledge/overlays/1-2', 'knowledge/overlays/legacy/1-2'),
    ('course-content/authoring/lessons/L-2a', 'course-content/authoring/lessons/legacy/L-2a'),
    ('course-content/runtime/lessons/L-2a', 'course-content/runtime/lessons/legacy/L-2a'),
    ('course-content/authoring/knowledge/cards/lessons/L-2a', 'course-content/authoring/knowledge/cards/lessons/legacy/L-2a'),
    ('course-content/authoring/knowledge/overlays/L-2a', 'course-content/authoring/knowledge/overlays/legacy/L-2a'),
    ('authoring/lessons/L-2a', 'authoring/lessons/legacy/L-2a'),
    ('runtime/lessons/L-2a', 'runtime/lessons/legacy/L-2a'),
    ('knowledge/cards/lessons/L-2a', 'knowledge/cards/lessons/legacy/L-2a'),
    ('knowledge/overlays/L-2a', 'knowledge/overlays/legacy/L-2a'),
    ('course-content/authoring/lessons/L-2b', 'course-content/authoring/lessons/legacy/L-2b'),
    ('course-content/runtime/lessons/L-2b', 'course-content/runtime/lessons/legacy/L-2b'),
    ('course-content/authoring/knowledge/cards/lessons/L-2b', 'course-content/authoring/knowledge/cards/lessons/legacy/L-2b'),
    ('course-content/authoring/knowledge/overlays/L-2b', 'course-content/authoring/knowledge/overlays/legacy/L-2b'),
    ('authoring/lessons/L-2b', 'authoring/lessons/legacy/L-2b'),
    ('runtime/lessons/L-2b', 'runtime/lessons/legacy/L-2b'),
    ('knowledge/cards/lessons/L-2b', 'knowledge/cards/lessons/legacy/L-2b'),
    ('knowledge/overlays/L-2b', 'knowledge/overlays/legacy/L-2b'),
    ('course-content/authoring/lessons/L-2c', 'course-content/authoring/lessons/legacy/L-2c'),
    ('course-content/runtime/lessons/L-2c', 'course-content/runtime/lessons/legacy/L-2c'),
    ('course-content/authoring/knowledge/cards/lessons/L-2c', 'course-content/authoring/knowledge/cards/lessons/legacy/L-2c'),
    ('course-content/authoring/knowledge/overlays/L-2c', 'course-content/authoring/knowledge/overlays/legacy/L-2c'),
    ('authoring/lessons/L-2c', 'authoring/lessons/legacy/L-2c'),
    ('runtime/lessons/L-2c', 'runtime/lessons/legacy/L-2c'),
    ('knowledge/cards/lessons/L-2c', 'knowledge/cards/lessons/legacy/L-2c'),
    ('knowledge/overlays/L-2c', 'knowledge/overlays/legacy/L-2c'),
    ('course-content/authoring/lessons/L-2d', 'course-content/authoring/lessons/legacy/L-2d'),
    ('course-content/runtime/lessons/L-2d', 'course-content/runtime/lessons/legacy/L-2d'),
    ('course-content/authoring/knowledge/cards/lessons/L-2d', 'course-content/authoring/knowledge/cards/lessons/legacy/L-2d'),
    ('course-content/authoring/knowledge/overlays/L-2d', 'course-content/authoring/knowledge/overlays/legacy/L-2d'),
    ('authoring/lessons/L-2d', 'authoring/lessons/legacy/L-2d'),
    ('runtime/lessons/L-2d', 'runtime/lessons/legacy/L-2d'),
    ('knowledge/cards/lessons/L-2d', 'knowledge/cards/lessons/legacy/L-2d'),
    ('knowledge/overlays/L-2d', 'knowledge/overlays/legacy/L-2d'),
    ('course-content/authoring/lessons/L-sum', 'course-content/authoring/lessons/legacy/L-sum'),
    ('course-content/runtime/lessons/L-sum', 'course-content/runtime/lessons/legacy/L-sum'),
    ('course-content/authoring/knowledge/cards/lessons/L-sum', 'course-content/authoring/knowledge/cards/lessons/legacy/L-sum'),
    ('course-content/authoring/knowledge/overlays/L-sum', 'course-content/authoring/knowledge/overlays/legacy/L-sum'),
    ('authoring/lessons/L-sum', 'authoring/lessons/legacy/L-sum'),
    ('runtime/lessons/L-sum', 'runtime/lessons/legacy/L-sum'),
    ('knowledge/cards/lessons/L-sum', 'knowledge/cards/lessons/legacy/L-sum'),
    ('knowledge/overlays/L-sum', 'knowledge/overlays/legacy/L-sum'),
]


def main() -> None:
    changed = 0
    for path in REPO_ROOT.rglob('*'):
        if not path.is_file() or path in SKIP_FILES or path.suffix not in TEXT_SUFFIXES:
            continue
        try:
            text = path.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            continue

        original = text
        for old, new in REPLACEMENTS:
            text = text.replace(old, new)
        if text != original:
            path.write_text(text, encoding='utf-8')
            changed += 1

    print(changed)


if __name__ == '__main__':
    main()
