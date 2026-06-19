#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
COURSE_ROOT = REPO_ROOT / 'course-content'
DEFAULT_AUTHORING_ROOT = COURSE_ROOT / 'authoring' / 'resources' / 'textbooks'
DEFAULT_RUNTIME_ROOT = COURSE_ROOT / 'runtime' / 'resources' / 'textbooks'
GENERATOR_VERSION = 'textbook-resource-export.v1'
CHUNK_MAX_CHARS = 2800
CHUNK_MIN_CHARS = 900


PATH_ELIGIBLE_SECTION_KINDS = {'numbered-section', 'example'}
NON_PATH_SECTION_TITLES = {
    'preview',
    'desired outcomes',
    'skills check',
    'exercises',
    'problems',
    'advanced problems',
    'design problems',
    'computer problems',
    'answers to skills check',
    'terms and concepts',
}


@dataclass
class ImageRef:
    line_number: int
    alt: str
    path: str
    export_path: str | None
    figure_id: str
    metadata: dict[str, Any] | None
    asset_exists: bool


@dataclass
class TextbookSection:
    id: str
    title: str
    kind: str
    chapter_id: str
    chapter_number: int
    start_line: int
    end_line: int
    markdown: str
    images: list[ImageRef] = field(default_factory=list)


@dataclass
class TextbookChunk:
    id: str
    section_id: str
    index: int
    title: str
    markdown: str
    start_line: int
    end_line: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Export authoring textbook resources into runtime search artifacts.')
    parser.add_argument('--book', required=True, help='Book id under course-content/authoring/resources/textbooks.')
    parser.add_argument('--check', action='store_true', help='Parse and print an audit summary without writing runtime files.')
    parser.add_argument('--authoring-root', type=Path, default=DEFAULT_AUTHORING_ROOT)
    parser.add_argument('--runtime-root', type=Path, default=DEFAULT_RUNTIME_ROOT)
    parser.add_argument('--max-chunk-chars', type=int, default=CHUNK_MAX_CHARS)
    return parser.parse_args()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = '\n'.join(json.dumps(record, ensure_ascii=False) for record in records)
    path.write_text((content + '\n') if content else '', encoding='utf-8')


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def slugify(value: str) -> str:
    normalized = value.lower()
    normalized = re.sub(r'[*_`$\\{}[\]()]', ' ', normalized)
    normalized = re.sub(r'[^a-z0-9\u4e00-\u9fff]+', '-', normalized).strip('-')
    return normalized[:56] or 'section'


def normalize_title(value: str) -> str:
    return re.sub(r'\s+', ' ', value.replace('**', '').strip())


def classify_heading(title: str) -> str:
    normalized = normalize_title(title)
    lower = normalized.lower()
    if re.match(r'^\d+\.\d+\s+', normalized):
        return 'numbered-section'
    if re.match(r'^example\s+\d+\.\d+', normalized, flags=re.IGNORECASE):
        return 'example'
    if re.match(r'^figure\s+\d+\.\d+', normalized, flags=re.IGNORECASE):
        return 'figure-heading'
    if re.match(r'^table\s+\d+\.\d+', normalized, flags=re.IGNORECASE):
        return 'table-heading'
    if lower in NON_PATH_SECTION_TITLES:
        return 'chapter-block'
    return 'other-heading'


def is_section_start(title: str) -> bool:
    return classify_heading(title) in {'numbered-section', 'example', 'chapter-block'}


def section_id_for(chapter_number: int, title: str, ordinal: int) -> str:
    normalized = normalize_title(title)
    if match := re.match(r'^(\d+)\.(\d+)\s+', normalized):
        return f'ch{chapter_number:02d}-sec{int(match.group(2)):02d}'
    if match := re.match(r'^example\s+(\d+)\.(\d+)', normalized, flags=re.IGNORECASE):
        return f'ch{chapter_number:02d}-example-{int(match.group(1)):02d}{int(match.group(2)):02d}'
    return f'ch{chapter_number:02d}-{slugify(normalized)}-{ordinal:03d}'


def figure_id_for(image_path: str) -> str:
    return Path(image_path).stem


def build_image_index(chapter_manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    images = chapter_manifest.get('images') if isinstance(chapter_manifest.get('images'), list) else []
    result: dict[str, dict[str, Any]] = {}
    for image in images:
        if not isinstance(image, dict):
            continue
        export_path = image.get('exportPath')
        if isinstance(export_path, str):
            result[export_path] = image
        original_path = image.get('originalRelativePath')
        if isinstance(original_path, str):
            result[original_path] = image
    return result


@dataclass(frozen=True)
class MarkdownImage:
    start: int
    end: int
    alt: str
    path: str


def scan_markdown_images(markdown: str) -> list[MarkdownImage]:
    images: list[MarkdownImage] = []
    index = 0
    while index < len(markdown):
        start = markdown.find('![', index)
        if start == -1:
            break
        cursor = start + 2
        bracket_depth = 1
        while cursor < len(markdown):
            char = markdown[cursor]
            if char == '[':
                bracket_depth += 1
            elif char == ']':
                bracket_depth -= 1
                if bracket_depth == 0:
                    break
            cursor += 1
        if cursor >= len(markdown) or cursor + 1 >= len(markdown) or markdown[cursor + 1] != '(':
            index = start + 2
            continue
        path_start = cursor + 2
        path_end = markdown.find(')', path_start)
        if path_end == -1:
            index = start + 2
            continue
        images.append(MarkdownImage(
            start=start,
            end=path_end + 1,
            alt=markdown[start + 2:cursor],
            path=markdown[path_start:path_end].strip(),
        ))
        index = path_end + 1
    return images


def find_images(lines: list[str], start_line: int, image_index: dict[str, dict[str, Any]]) -> list[ImageRef]:
    refs: list[ImageRef] = []
    for offset, line in enumerate(lines):
        for image in scan_markdown_images(line):
            image_path = image.path
            metadata = image_index.get(image_path)
            export_path = metadata.get('exportPath') if metadata else image_path
            if not isinstance(export_path, str):
                export_path = image_path
            refs.append(ImageRef(
                line_number=start_line + offset,
                alt=image.alt.strip(),
                path=image_path,
                export_path=export_path,
                figure_id=figure_id_for(export_path),
                metadata=metadata,
                asset_exists=False,
            ))
    return refs


def parse_sections(chapter_dir: Path, chapter_manifest: dict[str, Any]) -> list[TextbookSection]:
    chapter_number = int(chapter_manifest['number'])
    chapter_id = str(chapter_manifest['id'])
    markdown_path = chapter_dir / str(chapter_manifest.get('textbookPath') or 'textbook.md')
    lines = markdown_path.read_text(encoding='utf-8').splitlines()
    image_index = build_image_index(chapter_manifest)
    starts: list[tuple[int, str, str]] = []
    for index, line in enumerate(lines):
        match = re.match(r'^(#{1,6})\s+(.+?)\s*$', line)
        if not match:
            continue
        title = normalize_title(match.group(2))
        if is_section_start(title):
            starts.append((index, title, classify_heading(title)))

    if not starts:
        starts = [(0, str(chapter_manifest['title']), 'numbered-section')]

    sections: list[TextbookSection] = []
    for ordinal, (start, title, kind) in enumerate(starts, start=1):
        end = starts[ordinal][0] if ordinal < len(starts) else len(lines)
        section_lines = lines[start:end]
        markdown = '\n'.join(section_lines).strip() + '\n'
        section = TextbookSection(
            id=section_id_for(chapter_number, title, ordinal),
            title=title,
            kind=kind,
            chapter_id=chapter_id,
            chapter_number=chapter_number,
            start_line=start + 1,
            end_line=end,
            markdown=markdown,
            images=find_images(section_lines, start + 1, image_index),
        )
        validate_section_images(section, chapter_dir, image_index)
        sections.append(section)
    return dedupe_section_ids(sections)


def validate_section_images(
    section: TextbookSection,
    chapter_dir: Path,
    image_index: dict[str, dict[str, Any]],
) -> None:
    for image in section.images:
        source = chapter_dir / (image.export_path or image.path)
        image.asset_exists = source.exists()


def dedupe_section_ids(sections: list[TextbookSection]) -> list[TextbookSection]:
    seen: dict[str, int] = {}
    for section in sections:
        count = seen.get(section.id, 0)
        seen[section.id] = count + 1
        if count:
            section.id = f'{section.id}-{count + 1:02d}'
    return sections


def split_chunks(section: TextbookSection, max_chars: int) -> list[TextbookChunk]:
    paragraphs = re.split(r'\n\s*\n', section.markdown.strip())
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0
    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        paragraph_len = len(paragraph)
        if current and current_len + paragraph_len + 2 > max_chars and current_len >= CHUNK_MIN_CHARS:
            chunks.append('\n\n'.join(current))
            current = [paragraph]
            current_len = paragraph_len
            continue
        if paragraph_len > max_chars:
            if current:
                chunks.append('\n\n'.join(current))
                current = []
                current_len = 0
            chunks.extend(split_long_paragraph(paragraph, max_chars))
            continue
        current.append(paragraph)
        current_len += paragraph_len + 2
    if current:
        chunks.append('\n\n'.join(current))

    return [
        TextbookChunk(
            id=f'{section.id}__chunk-{index:03d}',
            section_id=section.id,
            index=index,
            title=section.title,
            markdown=chunk.strip() + '\n',
            start_line=section.start_line,
            end_line=section.end_line,
        )
        for index, chunk in enumerate(chunks or [section.markdown.strip()], start=1)
    ]


def split_long_paragraph(paragraph: str, max_chars: int) -> list[str]:
    lines = paragraph.splitlines()
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0
    for line in lines:
        if current and current_len + len(line) + 1 > max_chars:
            chunks.append('\n'.join(current))
            current = [line]
            current_len = len(line)
        else:
            current.append(line)
            current_len += len(line) + 1
    if current:
        chunks.append('\n'.join(current))
    return chunks


def runtime_asset_href(book_id: str, section: TextbookSection, image: ImageRef) -> str | None:
    if not image.asset_exists or not image.export_path:
        return None
    return f'/course-runtime/resources/textbooks/{book_id}/assets/{section.chapter_id}/{Path(image.export_path).name}'


def section_display_title(section: TextbookSection) -> str:
    title = section.title
    title = re.sub(r'^\d+\.\d+\s+', '', title)
    title = re.sub(r'^example\s+\d+\.\d+\s+', '', title, flags=re.IGNORECASE)
    return title.strip() or section.title


def rewrite_image_paths(markdown: str, book_id: str, section: TextbookSection) -> str:
    pieces: list[str] = []
    last = 0
    images_by_path: dict[str, ImageRef] = {image.path: image for image in section.images}
    for image in scan_markdown_images(markdown):
        pieces.append(markdown[last:image.start])
        image_ref = images_by_path.get(image.path)
        figure_id = image_ref.figure_id if image_ref else figure_id_for(image.path)
        asset_href = runtime_asset_href(book_id, section, image_ref) if image_ref else None
        if asset_href:
            pieces.append(f'<a id="{figure_id}"></a>![{image.alt}]({asset_href})')
        else:
            missing_label = image.alt or image.path
            pieces.append(f'<a id="{figure_id}"></a>\n\n> Missing textbook image: {missing_label}')
        last = image.end
    pieces.append(markdown[last:])
    return ''.join(pieces)


def section_runtime_markdown(section: TextbookSection, book_id: str) -> str:
    lines = [
        f'<!-- citation-target: {section.id} -->',
        f'<!-- source-lines: {section.start_line}-{section.end_line} -->',
        rewrite_image_paths(section.markdown, book_id, section).strip(),
    ]
    return '\n\n'.join(lines).strip() + '\n'


def chunk_runtime_markdown(chunk: TextbookChunk, section: TextbookSection, book_id: str) -> str:
    return '\n\n'.join([
        f'<!-- citation-target: {chunk.id} -->',
        f'<!-- section-id: {chunk.section_id} -->',
        rewrite_image_paths(chunk.markdown, book_id, section).strip(),
    ]).strip() + '\n'


def copy_assets(book_dir: Path, output_dir: Path, chapters: list[dict[str, Any]]) -> list[str]:
    copied: list[str] = []
    for chapter in chapters:
        chapter_dir = book_dir / str(chapter['id'])
        manifest = read_json(chapter_dir / str(chapter.get('manifestPath', 'manifest.json')).split('/')[-1])
        for image in manifest.get('images', []):
            if not isinstance(image, dict) or not isinstance(image.get('exportPath'), str):
                continue
            source = chapter_dir / image['exportPath']
            destination = output_dir / str(chapter['id']) / Path(image['exportPath']).name
            if not source.exists():
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
            copied.append(f"{chapter['id']}/{Path(image['exportPath']).name}")
    return sorted(copied)


def build_records(
    book_manifest: dict[str, Any],
    sections: list[TextbookSection],
    chunks: list[TextbookChunk],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    book_id = str(book_manifest['bookId'])
    section_records: list[dict[str, Any]] = []
    chunk_records: list[dict[str, Any]] = []
    figure_records: list[dict[str, Any]] = []
    search_documents: list[dict[str, Any]] = []
    citation_targets: dict[str, Any] = {}
    section_by_id = {section.id: section for section in sections}

    for section in sections:
        href = f'/course-runtime/resources/textbooks/{book_id}/sections/{section.id}.md'
        path_eligible = section.kind in PATH_ELIGIBLE_SECTION_KINDS
        record = {
            'id': section.id,
            'bookId': book_id,
            'title': section.title,
            'kind': 'textbook_section' if section.kind == 'numbered-section' else f'textbook_{section.kind.replace("-", "_")}',
            'chapterId': section.chapter_id,
            'chapterNumber': section.chapter_number,
            'pathPlanning': {
                'nodeType': 'textbook_section',
                'pathEligible': path_eligible,
                'estimatedTimeMinutes': estimate_minutes(section.markdown),
                'knowledgeNodeIds': [],
                'capabilityTargetRefs': [],
            },
            'sourceSpan': {'startLine': section.start_line, 'endLine': section.end_line},
            'contentHash': sha256_text(section.markdown),
            'href': href,
            'figureIds': [image.figure_id for image in section.images],
        }
        section_records.append(record)
        citation_targets[section.id] = {'kind': 'text', 'href': href, 'sourceRefId': section.id}

        for image in section.images:
            image_href = f'{href}#{image.figure_id}'
            metadata = image.metadata or {}
            figure_record = {
                'id': image.figure_id,
                'bookId': book_id,
                'sectionId': section.id,
                'chapterId': section.chapter_id,
                'path': image.path,
                'exportPath': image.export_path,
                'runtimeAssetPath': runtime_asset_href(book_id, section, image),
                'assetStatus': 'available' if image.asset_exists else 'missing-source',
                'href': image_href,
                'alt': image.alt,
                'caption': metadata.get('caption') or image.alt or None,
                'sourcePdfPage': metadata.get('sourcePdfPage'),
                'sha256': metadata.get('sha256'),
                'lineNumber': image.line_number,
            }
            figure_records.append(figure_record)
            citation_targets[image.figure_id] = {
                'kind': 'image',
                'href': image_href,
                'sourceRefId': image.figure_id,
                'locator': image.figure_id,
                'contentHash': metadata.get('sha256'),
            }
            figure_title = str(
                figure_record['caption']
                or image.alt
                or f'{section_display_title(section)} figure {image.figure_id}'
            )
            search_documents.append(build_search_document(
                doc_id=f'{image.figure_id}__figure',
                kind='figure',
                title=figure_title,
                text=figure_title,
                book_id=book_id,
                section=section,
                href=image_href,
                content_hash=str(metadata.get('sha256') or sha256_text(figure_title)),
                citation_target_ref=image.figure_id,
                metadata={'captionMissing': not bool(figure_record['caption'])},
            ))

    for chunk in chunks:
        section = section_by_id[chunk.section_id]
        href = f'/course-runtime/resources/textbooks/{book_id}/chunks/{chunk.id}.md'
        chunk_record = {
            'id': chunk.id,
            'bookId': book_id,
            'sectionId': chunk.section_id,
            'chunkIndex': chunk.index,
            'title': chunk.title,
            'href': href,
            'sourceSpan': {'startLine': chunk.start_line, 'endLine': chunk.end_line},
            'contentHash': sha256_text(chunk.markdown),
        }
        chunk_records.append(chunk_record)
        citation_targets[chunk.id] = {'kind': 'text', 'href': href, 'sourceRefId': chunk.id}
        search_documents.append(build_search_document(
            doc_id=chunk.id,
            kind='chunk',
            title=chunk.title,
            text=plain_text(chunk.markdown),
            book_id=book_id,
            section=section,
            href=href,
            content_hash=chunk_record['contentHash'],
            citation_target_ref=chunk.id,
        ))

    citation_map = {
        'version': GENERATOR_VERSION,
        'bookId': book_id,
        'targets': citation_targets,
    }
    return section_records, chunk_records, figure_records, citation_map, search_documents


def build_search_document(
    *,
    doc_id: str,
    kind: str,
    title: str,
    text: str,
    book_id: str,
    section: TextbookSection,
    href: str,
    content_hash: str,
    citation_target_ref: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    base_metadata = {
        'bookId': book_id,
        'chapterId': section.chapter_id,
        'chapterNumber': section.chapter_number,
        'sectionId': section.id,
    }
    if metadata:
        base_metadata.update(metadata)
    return {
        'id': doc_id,
        'kind': kind,
        'sourceType': 'textbook-content',
        'family': 'textbook',
        'title': title,
        'href': href,
        'text': text,
        'searchText': f'{title}\n{text}'.strip(),
        'contentHash': content_hash,
        'resourceProjection': {
            'resourceId': f'textbook:{book_id}',
            'segmentRef': section.id,
            'citationTargetRef': citation_target_ref,
            'knowledgeNodeRefs': [],
            'capabilityTargetRefs': [],
        },
        'citationAddress': {
            'kind': 'text' if kind == 'chunk' else 'image',
            'sourceRefId': citation_target_ref,
            'href': href,
            'locator': citation_target_ref,
            'contentHash': content_hash,
        },
        'metadata': base_metadata,
    }


def estimate_minutes(markdown: str) -> int:
    words = re.findall(r'[A-Za-z0-9_]+|[\u4e00-\u9fff]', plain_text(markdown))
    return max(2, round(len(words) / 180))


def plain_text(markdown: str) -> str:
    text = markdown
    for image in reversed(scan_markdown_images(markdown)):
        text = f'{text[:image.start]}{image.alt}{text[image.end:]}'
    text = re.sub(r'`([^`]+)`', r'\1', text)
    text = re.sub(r'[#>*_\[\]()]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def export_book(
    *,
    book_id: str,
    authoring_root: Path = DEFAULT_AUTHORING_ROOT,
    runtime_root: Path = DEFAULT_RUNTIME_ROOT,
    max_chunk_chars: int = CHUNK_MAX_CHARS,
    write: bool = True,
) -> dict[str, Any]:
    book_dir = authoring_root / book_id
    book_manifest_path = book_dir / 'manifest.json'
    if not book_manifest_path.exists():
        raise FileNotFoundError(f'Missing textbook manifest: {book_manifest_path}')
    book_manifest = read_json(book_manifest_path)
    chapters = [chapter for chapter in book_manifest.get('chapters', []) if isinstance(chapter, dict)]

    all_sections: list[TextbookSection] = []
    for chapter in chapters:
        chapter_dir = book_dir / str(chapter['id'])
        chapter_manifest = read_json(chapter_dir / 'manifest.json')
        all_sections.extend(parse_sections(chapter_dir, chapter_manifest))

    chunks = [chunk for section in all_sections for chunk in split_chunks(section, max_chunk_chars)]
    section_records, chunk_records, figure_records, citation_map, search_documents = build_records(
        book_manifest,
        all_sections,
        chunks,
    )
    audit = {
        'bookId': book_id,
        'chapters': len(chapters),
        'sections': len(section_records),
        'pathEligibleSections': sum(1 for section in section_records if section['pathPlanning']['pathEligible']),
        'chunks': len(chunk_records),
        'figures': len(figure_records),
        'figuresMissingCaption': sum(1 for figure in figure_records if not figure.get('caption')),
        'missingFigureAssets': sum(1 for figure in figure_records if figure.get('assetStatus') == 'missing-source'),
        'searchDocuments': len(search_documents),
    }

    if not write:
        return audit

    output_dir = runtime_root / book_id
    if output_dir.exists():
        shutil.rmtree(output_dir)
    (output_dir / 'sections').mkdir(parents=True, exist_ok=True)
    (output_dir / 'chunks').mkdir(parents=True, exist_ok=True)

    for section in all_sections:
        (output_dir / 'sections' / f'{section.id}.md').write_text(
            section_runtime_markdown(section, book_id),
            encoding='utf-8',
        )
    section_by_id = {section.id: section for section in all_sections}
    for chunk in chunks:
        (output_dir / 'chunks' / f'{chunk.id}.md').write_text(
            chunk_runtime_markdown(chunk, section_by_id[chunk.section_id], book_id),
            encoding='utf-8',
        )
    copied_assets = copy_assets(book_dir, output_dir / 'assets', chapters)

    runtime_manifest = {
        'version': GENERATOR_VERSION,
        'bookId': book_id,
        'title': book_manifest.get('title'),
        'authors': book_manifest.get('authors', []),
        'edition': book_manifest.get('edition'),
        'source': book_manifest.get('source'),
        'authoringManifestHash': sha256_file(book_manifest_path),
        'counts': {
            **audit,
            'assets': len(copied_assets),
        },
        'outputs': {
            'sections': 'sections/',
            'chunks': 'chunks/',
            'assets': 'assets/',
            'sectionIndex': 'section-index.jsonl',
            'chunkIndex': 'chunk-index.jsonl',
            'figureIndex': 'figure-index.jsonl',
            'searchDocuments': 'search-documents.jsonl',
            'citationMap': 'citation-map.json',
        },
    }
    write_json(output_dir / 'manifest.json', runtime_manifest)
    write_jsonl(output_dir / 'section-index.jsonl', section_records)
    write_jsonl(output_dir / 'chunk-index.jsonl', chunk_records)
    write_jsonl(output_dir / 'figure-index.jsonl', figure_records)
    write_jsonl(output_dir / 'search-documents.jsonl', search_documents)
    write_json(output_dir / 'citation-map.json', citation_map)
    validate_runtime_output(output_dir)
    return runtime_manifest['counts']


def validate_runtime_output(output_dir: Path) -> None:
    section_files = list((output_dir / 'sections').glob('*.md'))
    chunk_files = list((output_dir / 'chunks').glob('*.md'))
    for markdown_path in [*section_files, *chunk_files]:
        text = markdown_path.read_text(encoding='utf-8')
        if '](assets/' in text:
            raise ValueError(f'Runtime markdown still contains authoring asset path: {markdown_path}')

    figure_records = [
        json.loads(line)
        for line in (output_dir / 'figure-index.jsonl').read_text(encoding='utf-8').splitlines()
        if line.strip()
    ]
    for record in figure_records:
        runtime_asset_path = record.get('runtimeAssetPath')
        if runtime_asset_path is None and record.get('assetStatus') == 'missing-source':
            continue
        if not isinstance(runtime_asset_path, str):
            raise ValueError(f'Figure record missing runtimeAssetPath: {record.get("id")}')
        relative_asset_path = runtime_asset_path.removeprefix('/course-runtime/resources/textbooks/')
        if '/' not in relative_asset_path:
            raise ValueError(f'Invalid runtime asset path: {runtime_asset_path}')
        book_relative_path = relative_asset_path.split('/', 1)[1]
        if not (output_dir / book_relative_path).exists():
            raise FileNotFoundError(f'Runtime asset missing for figure {record.get("id")}: {runtime_asset_path}')


def main() -> int:
    args = parse_args()
    try:
        result = export_book(
            book_id=args.book,
            authoring_root=args.authoring_root,
            runtime_root=args.runtime_root,
            max_chunk_chars=args.max_chunk_chars,
            write=not args.check,
        )
    except Exception as error:
        print(f'export_textbook_resources failed: {error}', file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
