from __future__ import annotations

import re
from pathlib import Path


STANDARD_MEDIA_SUFFIXES = (
    'intro-video.mp4',
    'audio.m4a',
    'slides.pdf',
    'course.mp4',
)
HANDOUT_SECTION_NAME = 'handout.md'


def build_standard_media_filenames(lesson_id: str) -> list[str]:
    return [f'{lesson_id}-{suffix}' for suffix in STANDARD_MEDIA_SUFFIXES]


def build_required_media_filenames(lesson_id: str) -> list[str]:
    return [*build_standard_media_filenames(lesson_id), HANDOUT_SECTION_NAME]


def parse_runtime_media_sections(markdown: str) -> dict[str, list[str]]:
    entries: dict[str, list[str]] = {}
    current_filename: str | None = None

    for raw_line in markdown.splitlines():
        stripped_line = raw_line.strip()
        if stripped_line.startswith('# '):
            current_filename = stripped_line[2:].strip()
            entries.setdefault(current_filename, [])
            continue
        if current_filename is None:
            continue
        entries[current_filename].append(raw_line)

    return entries


def parse_runtime_media_index(markdown: str) -> dict[str, str]:
    entries: dict[str, str] = {}

    for filename, section_lines in parse_runtime_media_sections(markdown).items():
        entries.setdefault(filename, '')
        for raw_line in section_lines:
            line = raw_line.strip()
            if line and not line.startswith('#') and re.match(r'^(?:https?:)?//', line):
                entries[filename] = line
                break

    return entries


def extract_first_runtime_title(section_lines: list[str]) -> str | None:
    for raw_line in section_lines:
        line = raw_line.strip()
        if line.startswith('- '):
            return line[2:].strip()
    return None


def infer_authoring_lesson_dir(media_index_path: Path, lesson_id: str) -> Path | None:
    normalized_path = media_index_path.as_posix()
    match = re.search(
        rf'^(?P<prefix>.*?)/?runtime/lessons/{re.escape(lesson_id)}/media/[^/]+$',
        normalized_path,
    )
    if not match:
        return None

    prefix = match.group('prefix').rstrip('/')
    if not prefix:
        return Path('authoring') / 'lessons' / lesson_id

    return Path(prefix) / 'authoring' / 'lessons' / lesson_id


def find_intro_video_prompt_path(authoring_lesson_dir: Path | None, lesson_id: str) -> Path | None:
    if authoring_lesson_dir is None:
        return None
    raw_dir = authoring_lesson_dir / 'media' / 'raw'
    if not raw_dir.exists():
        return None

    matches = sorted(raw_dir.glob(f'{lesson_id}-intro-video-prompt*.md'))
    return matches[0] if matches else None


def extract_first_agent_prompt(markdown: str) -> str | None:
    capture = False
    lines: list[str] = []

    for raw_line in markdown.splitlines():
        stripped_line = raw_line.strip()
        if re.match(r'^#{2,3}\s*Agent 模式视频生成提示词\s*$', stripped_line):
            capture = True
            lines = []
            continue
        if capture and stripped_line.startswith('#'):
            break
        if capture:
            lines.append(raw_line.rstrip())

    text = '\n'.join(line for line in lines).strip()
    return text or None


def summarize_intro_video_theme_from_agent_prompt(agent_prompt: str) -> str | None:
    normalized_prompt = re.sub(r'\s+', ' ', agent_prompt).strip()
    if not normalized_prompt:
        return None

    for pattern in (
        r'本课主题[:：]\s*([^。！？]+)',
        r'结尾点题[:：]\s*[“"]?([^”"。！？]+)',
        r'点题[:：]\s*[“"]?([^”"。！？]+)',
    ):
        match = re.search(pattern, normalized_prompt)
        if not match:
            continue
        clause = match.group(1).strip().strip('“”"')
        if not clause:
            continue
        if '为什么' in clause:
            return f'用导入情境引出“{clause}”这一问题。'
        return f'用导入情境引出“{clause}”这一主题。'

    quoted_match = re.search(r'[“"]([^”"]{6,60})[”"]', normalized_prompt)
    if quoted_match:
        clause = quoted_match.group(1).strip()
        if '为什么' in clause:
            return f'用导入情境引出“{clause}”这一问题。'
        return f'用导入情境引出“{clause}”这一主题。'

    first_sentence_match = re.search(r'([^。！？]{8,80})[。！？]', normalized_prompt)
    if not first_sentence_match:
        return None
    clause = first_sentence_match.group(1).strip()
    return f'用导入情境聚焦“{clause}”。'


def load_intro_video_theme_summary(
    lesson_id: str,
    media_index_path: Path,
) -> str | None:
    authoring_lesson_dir = infer_authoring_lesson_dir(media_index_path, lesson_id)
    prompt_path = find_intro_video_prompt_path(authoring_lesson_dir, lesson_id)
    if prompt_path is None or not prompt_path.exists():
        return None

    agent_prompt = extract_first_agent_prompt(prompt_path.read_text(encoding='utf-8'))
    if agent_prompt is None:
        return None

    return summarize_intro_video_theme_from_agent_prompt(agent_prompt)


def sync_runtime_media_index_to_authoring_processed(
    media_index_path: Path,
    lesson_id: str,
    content: str,
) -> None:
    authoring_lesson_dir = infer_authoring_lesson_dir(media_index_path, lesson_id)
    if authoring_lesson_dir is None:
        return

    processed_media_index_path = authoring_lesson_dir / 'media' / 'processed' / f'{lesson_id}-media.md'
    processed_media_index_path.parent.mkdir(parents=True, exist_ok=True)
    processed_media_index_path.write_text(content, encoding='utf-8')


def trim_blank_lines(lines: list[str]) -> list[str]:
    start = 0
    end = len(lines)
    while start < end and not lines[start].strip():
        start += 1
    while end > start and not lines[end - 1].strip():
        end -= 1
    return [line.rstrip() for line in lines[start:end]]


def is_url_line(line: str) -> bool:
    return bool(re.match(r'^(?:https?:)?//', line.strip()))


def rebuild_generic_media_section(existing_section_lines: list[str]) -> list[str]:
    trimmed_lines = trim_blank_lines(existing_section_lines)
    if not trimmed_lines:
        return []

    titles: list[str] = []
    urls: list[str] = []
    prose: list[str] = []
    for line in trimmed_lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith('- '):
            titles.append(stripped)
        elif is_url_line(stripped):
            urls.append(stripped)
        else:
            prose.append(stripped)

    lines: list[str] = []
    if titles:
        lines.extend(titles)
    if prose:
        if lines:
            lines.append('')
        lines.extend(prose)
    if urls:
        if lines:
            lines.append('')
        lines.extend(urls)
    return lines


def rebuild_handout_section(existing_section_lines: list[str]) -> list[str]:
    return trim_blank_lines(existing_section_lines)


def rebuild_intro_video_section(
    existing_section_lines: list[str],
    intro_video_summary: str | None,
) -> list[str]:
    trimmed_lines = trim_blank_lines(existing_section_lines)
    if not trimmed_lines and not intro_video_summary:
        return []

    titles: list[str] = []
    urls: list[str] = []
    prose: list[str] = []
    for line in trimmed_lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith('- '):
            titles.append(stripped)
        elif is_url_line(stripped):
            urls.append(stripped)
        else:
            prose.append(stripped)

    if intro_video_summary:
        theme_line = f'- {intro_video_summary}'
        if theme_line not in titles:
            titles.append(theme_line)

    lines: list[str] = []
    if titles:
        lines.extend(titles)
    if prose:
        if lines:
            lines.append('')
        lines.extend(prose)
    if urls:
        if lines:
            lines.append('')
        lines.extend(urls)
    return lines


def compose_runtime_media_index_content(
    lesson_id: str,
    existing_markdown: str | None,
    intro_video_summary: str | None,
) -> str:
    existing_sections = parse_runtime_media_sections(existing_markdown or '')
    lines: list[str] = []
    intro_video_filename = f'{lesson_id}-intro-video.mp4'

    for filename in build_required_media_filenames(lesson_id):
        lines.append(f'# {filename}')
        lines.append('')
        existing_section_lines = existing_sections.get(filename, [])

        if filename == intro_video_filename:
            section_lines = rebuild_intro_video_section(existing_section_lines, intro_video_summary)
        elif filename == HANDOUT_SECTION_NAME:
            section_lines = rebuild_handout_section(existing_section_lines)
        else:
            section_lines = rebuild_generic_media_section(existing_section_lines)

        if section_lines:
            lines.extend(section_lines)
        lines.append('')

    return '\n'.join(lines)


def build_runtime_media_index_content(lesson_id: str, existing_markdown: str | None = None) -> str:
    return compose_runtime_media_index_content(lesson_id, existing_markdown, intro_video_summary=None)


def ensure_runtime_media_index(
    media_index_path: Path,
    lesson_id: str,
    existing_markdown: str | None = None,
) -> None:
    if existing_markdown is None and media_index_path.exists():
        existing_markdown = media_index_path.read_text(encoding='utf-8')

    intro_video_summary = load_intro_video_theme_summary(lesson_id, media_index_path)
    media_index_path.parent.mkdir(parents=True, exist_ok=True)
    content = compose_runtime_media_index_content(lesson_id, existing_markdown, intro_video_summary)
    media_index_path.write_text(content, encoding='utf-8')
    sync_runtime_media_index_to_authoring_processed(media_index_path, lesson_id, content)
