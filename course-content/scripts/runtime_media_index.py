from __future__ import annotations

import re
from pathlib import Path


STANDARD_MEDIA_SUFFIXES = (
    'intro-video.mp4',
    'audio.m4a',
    'slides.pdf',
    'course.mp4',
)


def build_standard_media_filenames(lesson_id: str) -> list[str]:
    return [f'{lesson_id}-{suffix}' for suffix in STANDARD_MEDIA_SUFFIXES]


def parse_runtime_media_index(markdown: str) -> dict[str, str]:
    entries: dict[str, str] = {}
    current_filename: str | None = None

    for raw_line in markdown.splitlines():
        line = raw_line.strip()
        if line.startswith('# '):
            current_filename = line[2:].strip()
            entries.setdefault(current_filename, '')
            continue
        if current_filename and line and not line.startswith('#') and re.match(r'^(?:https?:)?//', line):
            entries[current_filename] = line
            current_filename = None

    return entries


def build_runtime_media_index_content(lesson_id: str, existing_markdown: str | None = None) -> str:
    existing_entries = parse_runtime_media_index(existing_markdown or '')
    lines: list[str] = []

    for filename in build_standard_media_filenames(lesson_id):
        lines.append(f'# {filename}')
        lines.append('')
        url = existing_entries.get(filename, '')
        if url:
            lines.append(url)
            lines.append('')
        else:
            lines.append('')

    return '\n'.join(lines)


def ensure_runtime_media_index(
    media_index_path: Path,
    lesson_id: str,
    existing_markdown: str | None = None,
) -> None:
    if existing_markdown is None and media_index_path.exists():
        existing_markdown = media_index_path.read_text(encoding='utf-8')

    media_index_path.parent.mkdir(parents=True, exist_ok=True)
    media_index_path.write_text(
        build_runtime_media_index_content(lesson_id, existing_markdown),
        encoding='utf-8',
    )
