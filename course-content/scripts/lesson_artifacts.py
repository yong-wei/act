from __future__ import annotations

import re
from pathlib import Path


def with_lesson_prefix(lesson_id: str, filename: str) -> str:
    prefix = f'{lesson_id}-'
    if filename.startswith(prefix):
        return filename
    return f'{prefix}{filename}'


def strip_lesson_prefix(lesson_id: str, filename: str) -> str:
    prefix = f'{lesson_id}-'
    if filename.startswith(prefix):
        return filename[len(prefix):]
    return filename


def resolve_lesson_artifact_path(
    directory: Path,
    lesson_id: str,
    filename: str,
    *,
    fallback_to_legacy: bool = True,
) -> Path:
    prefixed = directory / with_lesson_prefix(lesson_id, filename)
    if prefixed.exists() or not fallback_to_legacy:
        return prefixed

    legacy = directory / filename
    if legacy.exists():
        return legacy
    return prefixed


def handout_markdown_filename(lesson_id: str) -> str:
    return with_lesson_prefix(lesson_id, 'handout.md')


def handout_pdf_filename(lesson_id: str) -> str:
    return with_lesson_prefix(lesson_id, 'handout.pdf')


def is_handout_markdown_filename(filename: str) -> bool:
    return filename == 'handout.md' or (
        not filename.endswith('teacher-handout.md')
        and bool(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]*-handout\.md', filename))
    )
