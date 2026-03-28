from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from docx import Document


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SOURCE = ROOT / 'course-content' / 'questions' / 'source' / '船舶控制案例20240116.docx'
DEFAULT_OUTPUT = ROOT / 'course-content' / 'resource-library' / 'ship-control-cases'

IMG_TAG_RE = re.compile(r'<img\s+src="[^"]*/([^"/]+)"[^>]*/>')
EQUATION_TAG_RE = re.compile(r'\\?#\(([\d.]+)\)')
HTML_TAG_RE = re.compile(r'<[^>]+>')


def clean_text(text: str) -> str:
    return re.sub(r'\s+', ' ', text.strip())


def normalize_section_title(title: str) -> str:
    compact = clean_text(title)
    match = re.match(r'^(\d+(?:\.\d+)?)\.\s*(.+)$', compact)
    if match:
        return f'{match.group(1)} {match.group(2)}'
    return compact


def section_slug(title: str) -> str:
    compact = clean_text(title)
    match = re.match(r'^(\d+(?:\.\d+)?)\.\s*(.+)$', compact)
    if match:
        slug = f'{match.group(1)}-{match.group(2)}'
    else:
        slug = compact.replace(' ', '-')
    return slug.replace('/', '-')


def normalize_equation_tags(markdown: str) -> str:
    return EQUATION_TAG_RE.sub(r'\\tag{\1}', markdown)


def processed_suffix(raw_name: str) -> str:
    suffix = Path(raw_name).suffix.lower()
    if suffix == '.emf':
        return '.png'
    return suffix


def clean_caption(text: str) -> str:
    return clean_text(HTML_TAG_RE.sub('', text))


def rewrite_section_media(
    markdown: str,
    *,
    section_slug: str,
    image_prefix: str,
) -> tuple[str, list[dict[str, str]]]:
    lines = markdown.splitlines()
    rewritten: list[str] = []
    mappings: list[dict[str, str]] = []
    figure_index = 1
    i = 0

    while i < len(lines):
        line = lines[i]
        matches = list(IMG_TAG_RE.finditer(line))
        if not matches:
            rewritten.append(lines[i])
            i += 1
            continue

        stripped = line.strip()
        if len(matches) == 1 and matches[0].group(0) == stripped:
            raw_name = matches[0].group(1)
            suffix = processed_suffix(raw_name)
            processed_name = f'{section_slug}-figure-{figure_index:02d}{suffix}'

            caption_index = i + 1
            while caption_index < len(lines) and not lines[caption_index].strip():
                caption_index += 1

            caption = f'插图 {figure_index}'
            end_index = i + 1
            if caption_index < len(lines) and lines[caption_index].strip().startswith('图'):
                caption = clean_caption(lines[caption_index].strip())
                end_index = caption_index + 1

            rewritten.append(f'![{caption}]({image_prefix}/{processed_name})')
            mappings.append(
                {
                    'raw_name': raw_name,
                    'processed_name': processed_name,
                    'caption': caption,
                }
            )
            figure_index += 1
            i = end_index
            continue

        rebuilt: list[str] = []
        cursor = 0
        for match in matches:
            raw_name = match.group(1)
            suffix = processed_suffix(raw_name)
            processed_name = f'{section_slug}-figure-{figure_index:02d}{suffix}'
            caption = f'插图 {figure_index}'
            rebuilt.append(line[cursor:match.start()])
            rebuilt.append(f'![{caption}]({image_prefix}/{processed_name})')
            mappings.append(
                {
                    'raw_name': raw_name,
                    'processed_name': processed_name,
                    'caption': caption,
                }
            )
            cursor = match.end()
            figure_index += 1
        rebuilt.append(line[cursor:])
        rewritten.append(''.join(rebuilt))
        i += 1

    return '\n'.join(rewritten).strip() + '\n', mappings


def run_pandoc(source: Path, temp_dir: Path) -> tuple[str, Path]:
    markdown_path = temp_dir / 'preview.md'
    media_root = temp_dir / 'media'
    subprocess.run(
        [
            'pandoc',
            str(source),
            '-t',
            'gfm',
            '--wrap=none',
            f'--extract-media={media_root}',
            '-o',
            str(markdown_path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return markdown_path.read_text(encoding='utf-8'), media_root


def parse_sections(markdown: str) -> list[dict[str, str]]:
    current_group = ''
    current_section: dict[str, str] | None = None
    current_lines: list[str] = []
    sections: list[dict[str, str]] = []

    for raw_line in markdown.splitlines():
        line = raw_line.rstrip()
        if line.startswith('## '):
            heading = clean_text(line[3:])
            if heading:
                current_group = heading
            continue
        if line.startswith('### '):
            if current_section is not None:
                current_section['content'] = '\n'.join(current_lines).strip() + '\n'
                sections.append(current_section)
            title = clean_text(line[4:])
            current_section = {
                'group': current_group,
                'title': title,
                'display_title': normalize_section_title(title),
                'slug': section_slug(title),
            }
            current_lines = []
            continue
        if current_section is not None:
            current_lines.append(line)

    if current_section is not None:
        current_section['content'] = '\n'.join(current_lines).strip() + '\n'
        sections.append(current_section)

    return sections


def build_raw_paragraph_index(source: Path) -> str:
    doc = Document(str(source))
    lines = ['# 原始段落顺序清单', '', f'来源：`{source.relative_to(ROOT)}`', '']
    for index, para in enumerate(doc.paragraphs, start=1):
        style = para.style.name if para.style else 'Unknown'
        text = para.text.replace('\n', ' ').strip() or '[空段落]'
        lines.append(f'{index:03d}: [{style}] {text}')
    lines.append('')
    return '\n'.join(lines)


def convert_emf_batch(source_paths: list[Path], temp_root: Path) -> dict[str, Path]:
    convert_dir = temp_root / 'emf-convert'
    profile_dir = temp_root / 'lo-profile'
    convert_dir.mkdir(parents=True, exist_ok=True)
    profile_dir.mkdir(parents=True, exist_ok=True)
    if not source_paths:
        return {}
    subprocess.run(
        [
            'soffice',
            f'-env:UserInstallation=file://{profile_dir}',
            '--headless',
            '--convert-to',
            'png',
            '--outdir',
            str(convert_dir),
            *[str(path) for path in source_paths],
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return {path.name: convert_dir / f'{path.stem}.png' for path in source_paths}


def copy_media(
    raw_lookup: dict[str, Path],
    mappings: list[dict[str, str]],
    raw_dir: Path,
    processed_dir: Path,
    temp_root: Path,
) -> None:
    emf_sources: dict[str, Path] = {}
    for mapping in mappings:
        raw_name = mapping['raw_name']
        source_path = raw_lookup[raw_name]
        raw_target = raw_dir / raw_name
        if not raw_target.exists():
            shutil.copy2(source_path, raw_target)

        if source_path.suffix.lower() == '.emf':
            emf_sources.setdefault(raw_name, source_path)

    converted_lookup = convert_emf_batch(list(emf_sources.values()), temp_root)

    for mapping in mappings:
        raw_name = mapping['raw_name']
        source_path = raw_lookup[raw_name]
        processed_target = processed_dir / mapping['processed_name']
        if source_path.suffix.lower() == '.emf':
            shutil.copy2(converted_lookup[raw_name], processed_target)
        else:
            shutil.copy2(source_path, processed_target)


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')


def generate_readme(source: Path, sections: list[dict[str, str]], image_count: int) -> str:
    lines = [
        '# 船舶控制案例资源包',
        '',
        f'- 来源文档：`{source.relative_to(ROOT)}`',
        '- 文档标题：`船舶教学案例汇编`',
        f'- 提取章节数：{len(sections)}',
        f'- 提取图片数：{image_count}',
        '- 适用场景：船舶控制专题讲义、案例阅读、课程素材检索与建模/分析示例引用。',
        '',
        '## 目录说明',
        '',
        '- [extracted.md](extracted.md)：整包总览与章节入口',
        '- [sections/](sections/)：按三级标题拆分后的独立 Markdown',
        '- [indexes/raw-paragraphs.md](indexes/raw-paragraphs.md)：原始段落顺序清单',
        '- [indexes/media-map.md](indexes/media-map.md)：图片文件与章节映射',
        '- [indexes/section-map.md](indexes/section-map.md)：专题与章节映射',
        '- `assets/raw/`：Pandoc 从 `docx` 导出的原始媒体',
        '- `assets/processed/`：按章节重命名后的图片副本',
        '',
        '## 章节入口',
        '',
    ]
    for section in sections:
        lines.append(f"- [{section['display_title']}](sections/{section['slug']}.md)")
    lines.append('')
    return '\n'.join(lines)


def generate_extracted(source: Path, sections: list[dict[str, str]]) -> str:
    lines = [
        '# 船舶教学案例汇编提取总览',
        '',
        f'该资源包把原始 `{source.name}` 中的正文、图片和公式拆成可检索的 Markdown 资源，便于后续在讲义、案例分析、互动课和建模示例中引用。',
        '',
        '## 章节目录',
        '',
    ]
    current_group = None
    for section in sections:
        if section['group'] and section['group'] != current_group:
            current_group = section['group']
            lines.extend([f'### {current_group}', ''])
        lines.append(f"- [{section['display_title']}](sections/{section['slug']}.md)")
        lines.append(f"  - 图片数：{len(section['media'])}")
    lines.append('')
    lines.append('## 辅助索引')
    lines.append('')
    lines.append('- 原始段落顺序清单见 [indexes/raw-paragraphs.md](indexes/raw-paragraphs.md)')
    lines.append('- 图片映射见 [indexes/media-map.md](indexes/media-map.md)')
    lines.append('- 专题与章节映射见 [indexes/section-map.md](indexes/section-map.md)')
    lines.append('')
    return '\n'.join(lines)


def generate_media_map(sections: list[dict[str, str]]) -> str:
    lines = ['# 媒体映射', '', '| 原始文件 | 处理后文件 | 所属章节 | 图题 |', '| --- | --- | --- | --- |']
    for section in sections:
        for mapping in section['media']:
            lines.append(
                f"| `{mapping['raw_name']}` | `assets/processed/{mapping['processed_name']}` | "
                f"[{section['display_title']}](../sections/{section['slug']}.md) | {mapping['caption']} |"
            )
    lines.append('')
    return '\n'.join(lines)


def generate_section_map(sections: list[dict[str, str]]) -> str:
    lines = ['# 专题与章节映射', '', '| 专题 | 章节 | 文件 | 图片数 |', '| --- | --- | --- | --- |']
    for section in sections:
        lines.append(
            f"| {section['group'] or '未分类'} | {section['display_title']} | "
            f"[sections/{section['slug']}.md](../sections/{section['slug']}.md) | {len(section['media'])} |"
        )
    lines.append('')
    return '\n'.join(lines)


def generate_package(source: Path, output_dir: Path) -> None:
    with tempfile.TemporaryDirectory(prefix='ship-control-case-') as temp_root_str:
        temp_root = Path(temp_root_str)
        markdown, extracted_media_root = run_pandoc(source, temp_root)
        normalized_markdown = normalize_equation_tags(markdown)
        sections = parse_sections(normalized_markdown)

        if output_dir.exists():
            shutil.rmtree(output_dir)

        raw_dir = output_dir / 'assets' / 'raw'
        processed_dir = output_dir / 'assets' / 'processed'
        sections_dir = output_dir / 'sections'
        indexes_dir = output_dir / 'indexes'
        raw_dir.mkdir(parents=True, exist_ok=True)
        processed_dir.mkdir(parents=True, exist_ok=True)
        sections_dir.mkdir(parents=True, exist_ok=True)
        indexes_dir.mkdir(parents=True, exist_ok=True)

        raw_lookup = {
            path.name: path
            for path in extracted_media_root.rglob('*')
            if path.is_file()
        }

        for section in sections:
            rewritten, mappings = rewrite_section_media(
                section['content'],
                section_slug=section['slug'],
                image_prefix='../assets/processed',
            )
            section['content'] = rewritten
            section['media'] = mappings

            body = '\n'.join(
                [
                    f"# {section['display_title']}",
                    '',
                    f"- 所属专题：{section['group'] or '未分类'}",
                    f"- 来源文档：`{source.relative_to(ROOT)}`",
                    '',
                    '## 正文',
                    '',
                    section['content'].rstrip(),
                    '',
                ]
            )
            write_text(sections_dir / f"{section['slug']}.md", body)

        all_mappings = [mapping for section in sections for mapping in section['media']]
        copy_media(raw_lookup, all_mappings, raw_dir, processed_dir, temp_root)

        total_images = sum(len(section['media']) for section in sections)
        write_text(output_dir / 'README.md', generate_readme(source, sections, total_images))
        write_text(output_dir / 'extracted.md', generate_extracted(source, sections))
        write_text(indexes_dir / 'raw-paragraphs.md', build_raw_paragraph_index(source))
        write_text(indexes_dir / 'media-map.md', generate_media_map(sections))
        write_text(indexes_dir / 'section-map.md', generate_section_map(sections))


def main() -> None:
    parser = argparse.ArgumentParser(description='Extract ship control case DOCX into a Markdown resource package.')
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--output-dir', type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    generate_package(args.source.resolve(), args.output_dir.resolve())
    print(f'generated ship control case package at {args.output_dir}')


if __name__ == '__main__':
    main()
