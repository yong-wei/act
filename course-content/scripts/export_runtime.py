#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import yaml


REPO_ROOT = Path(__file__).resolve().parents[2]
COURSE_ROOT = REPO_ROOT / 'course-content'
AUTHORING_ROOT = COURSE_ROOT / 'authoring'
RUNTIME_ROOT = COURSE_ROOT / 'runtime'

sys.path.insert(0, str(COURSE_ROOT / 'scripts'))
from lesson_id_map import (  # noqa: E402
    get_authoring_cards_dir,
    get_authoring_lesson_dir,
    get_authoring_overlays_dir,
    get_lesson_entry,
    get_mapped_target_id,
    get_runtime_lesson_dir,
    load_lesson_id_map,
)
from lesson_artifacts import (  # noqa: E402
    handout_markdown_filename,
    handout_pdf_filename,
    resolve_lesson_artifact_path,
    with_lesson_prefix,
)
from canonical_nodes import load_canonical_index  # noqa: E402
from knowledge_card_coverage import (  # noqa: E402
    assert_complete_knowledge_card_coverage,
    audit_knowledge_card_coverage,
)
from runtime_media_index import ensure_runtime_media_index  # noqa: E402
from media_transcripts import export_media_transcripts  # noqa: E402
from lesson_graph_order import (  # noqa: E402
    build_lesson_overlay_payload,
    build_lesson_overlay_revision,
    normalize_relation_type,
    resolve_authoring_card_order,
)

CHAPTER_NAME_BY_NUMBER = {
    1: '基本概念',
    2: '系统模型',
    3: '时域分析',
    4: '根轨迹分析',
    5: '频域分析',
    6: '系统校正',
    7: '离散系统',
    8: '非线性系统',
    9: '状态空间',
    10: '状态空间',
}

BLOOM_LEVEL_MAP = {
    '记忆': 'REMEMBER',
    '理解': 'UNDERSTAND',
    '应用': 'APPLY',
    '分析': 'ANALYZE',
    '评价': 'EVALUATE',
    '创造': 'CREATE',
}

KNOWLEDGE_DIM_MAP = {
    '事实性': 'FACTUAL',
    '概念性': 'CONCEPTUAL',
    '程序性': 'PROCEDURAL',
    '元认知': 'METACOGNITIVE',
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Export authoring course content to runtime.')
    parser.add_argument('lesson', nargs='?', help='Lesson id such as 2-2, 4-1 or legacy/L-2d')
    parser.add_argument('--all', action='store_true', dest='export_all', help='Export all lessons')
    return parser.parse_args()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
      return []
    records: list[dict[str, Any]] = []
    for line in path.read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        records.append(json.loads(line))
    return records


def normalize_authoring_node(node: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(node)
    if not normalized.get('name') and normalized.get('label'):
        normalized['name'] = normalized['label']
    if not normalized.get('definition') and normalized.get('summary'):
        normalized['definition'] = normalized['summary']
    chapter = normalized.get('chapter')
    if isinstance(chapter, str):
        stripped = chapter.strip()
        if stripped.isdigit():
            normalized['chapter'] = int(stripped)
    return normalized


def write_if_changed(path: Path, content: str, *, encoding: str = 'utf-8') -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = content.encode(encoding)
    try:
        if path.read_bytes() == encoded:
            return False
    except OSError:
        pass
    path.write_bytes(encoded)
    return True


def write_json(path: Path, data: Any) -> None:
    write_if_changed(path, json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    content = '\n'.join(json.dumps(record, ensure_ascii=False) for record in records)
    write_if_changed(path, (content + '\n') if content else '')


def normalize_bloom_level(value: str | None) -> str:
    if not value:
        return 'UNDERSTAND'
    return BLOOM_LEVEL_MAP.get(value, value)


def normalize_knowledge_dim(value: str | None) -> str:
    if not value:
        return 'CONCEPTUAL'
    return KNOWLEDGE_DIM_MAP.get(value, value)


def infer_node_type(node: dict[str, Any]) -> str:
    text = f"{node.get('name', '')} {node.get('category', '')}"
    if '伦理' in text:
        return 'ETHICS'
    if '场景' in text:
        return 'SCENARIO'
    return 'THEORY'


def resolve_chapter_name(chapter: int | None, chapter_name: str | None) -> str:
    if chapter_name:
        return chapter_name
    if chapter is None:
        return '未分章'
    return CHAPTER_NAME_BY_NUMBER.get(chapter, f'第{chapter}章')


def build_name_maps(nodes_by_id: dict[str, dict[str, Any]]) -> tuple[dict[str, str], dict[str, list[str]]]:
    by_name_chapter: dict[str, str] = {}
    by_name: dict[str, list[str]] = {}
    for node_id, node in nodes_by_id.items():
        name = node['name']
        chapter = node.get('chapter', -1)
        by_name_chapter[f'{name}|{chapter}'] = node_id
        by_name.setdefault(name, []).append(node_id)
    return by_name_chapter, by_name


def resolve_node_id(
    record: dict[str, Any],
    endpoint: str,
    nodes_by_id: dict[str, dict[str, Any]],
    by_name_chapter: dict[str, str],
    by_name: dict[str, list[str]],
) -> str | None:
    node_id = record.get(f'{endpoint}_id')
    if node_id and str(node_id) in nodes_by_id:
        return str(node_id)

    name = record.get(endpoint) or record.get(f'{endpoint}_name')
    if not name:
        return str(node_id) if node_id else None

    if str(name) in nodes_by_id:
        return str(name)

    chapter_value = record.get(f'{endpoint}_chapter')
    if isinstance(chapter_value, int):
        resolved = by_name_chapter.get(f'{name}|{chapter_value}')
        if resolved:
            return resolved

    candidates = by_name.get(str(name), [])
    if len(candidates) == 1:
        return candidates[0]
    return None


def build_generated_relation_id(source_id: str, target_id: str, relation_type: str) -> str:
    digest = hashlib.sha1(f'{source_id}::{target_id}::{relation_type}'.encode('utf-8')).hexdigest()[:16]
    return f'rel-{digest}'


def resolve_relation_type(record: dict[str, Any]) -> str:
    fields = ('type', 'relationType', 'relation_type', 'relation')
    present_fields = [field for field in fields if field in record]
    if len(present_fields) != 1:
        raise ValueError('relation type must use exactly one field alias')
    return normalize_relation_type(record[present_fields[0]])


def resolve_relation_id(record: dict[str, Any], source_id: str, target_id: str, relation_type: str) -> str:
    fields = ('id', 'relationId', 'relation_id')
    present_fields = [field for field in fields if field in record]
    if not present_fields:
        return build_generated_relation_id(source_id, target_id, relation_type)
    values = [record[field] for field in present_fields]
    runtime_compatibility_pair = (
        set(present_fields) == {'id', 'relation_id'}
        and len(present_fields) == 2
        and values[0] == values[1]
    )
    if len(present_fields) != 1 and not runtime_compatibility_pair:
        raise ValueError('relation id must use exactly one field alias')
    relation_id = values[0]
    if not isinstance(relation_id, str) or not relation_id or relation_id.strip() != relation_id:
        raise ValueError('relation id must be an exact non-empty string')
    return relation_id


def normalize_relation_record(
    record: dict[str, Any],
    nodes_by_id: dict[str, dict[str, Any]],
    by_name_chapter: dict[str, str],
    by_name: dict[str, list[str]],
) -> tuple[str, dict[str, Any]] | None:
    source_id = resolve_node_id(record, 'source', nodes_by_id, by_name_chapter, by_name)
    target_id = resolve_node_id(record, 'target', nodes_by_id, by_name_chapter, by_name)
    if not source_id or not target_id or source_id == target_id:
        return None

    source_node = nodes_by_id.get(source_id)
    target_node = nodes_by_id.get(target_id)
    if not source_node or not target_node:
        return None

    relation_type = resolve_relation_type(record)
    relation_id = resolve_relation_id(record, source_id, target_id, relation_type)
    raw_strength = record.get('strength')
    if raw_strength is None or isinstance(raw_strength, bool):
        strength = None
    else:
        try:
            parsed_strength = float(raw_strength)
        except (TypeError, ValueError):
            strength = None
        else:
            strength = parsed_strength if math.isfinite(parsed_strength) else None
    key = f'{source_id}::{target_id}::{relation_type}'

    relation = {
        'id': relation_id,
        'relation_id': relation_id,
        'source_id': source_id,
        'source': source_node['name'],
        'target_id': target_id,
        'target': target_node['name'],
        'source_chapter': source_node.get('chapter'),
        'target_chapter': target_node.get('chapter'),
        'relation_type': relation_type,
        'strength': strength,
        '__explicit_endpoint_ids': all(
            isinstance(record.get(f'{endpoint}_id'), str) and bool(record.get(f'{endpoint}_id'))
            for endpoint in ('source', 'target')
        ),
    }
    return key, relation


def build_runtime_relations(nodes_by_id: dict[str, dict[str, Any]], relation_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_name_chapter, by_name = build_name_maps(nodes_by_id)
    normalized_relations: list[tuple[str, dict[str, Any]]] = []
    relation_id_keys: dict[str, set[str]] = {}

    for record in relation_records:
        normalized = normalize_relation_record(record, nodes_by_id, by_name_chapter, by_name)
        if normalized is None:
            continue
        key, relation = normalized
        normalized_relations.append((key, relation))
        relation_id_keys.setdefault(relation['relation_id'], set()).add(key)

    for relation_id, keys in relation_id_keys.items():
        if len(keys) > 1:
            raise ValueError(f'duplicate relation id: {relation_id}')

    deduped: dict[str, dict[str, Any]] = {}
    for key, relation in normalized_relations:
        existing = deduped.get(key)
        relation_strength_key = (
            relation['strength'] is not None,
            relation['strength'] if relation['strength'] is not None else 0.0,
        )
        existing_strength_key = (
            existing['strength'] is not None,
            existing['strength'] if existing['strength'] is not None else 0.0,
        ) if existing is not None else None
        if (
            existing is None
            or relation_strength_key > existing_strength_key
            or (
                relation_strength_key == existing_strength_key
                and relation['__explicit_endpoint_ids']
                and not existing['__explicit_endpoint_ids']
            )
            or (
                relation_strength_key == existing_strength_key
                and relation['__explicit_endpoint_ids'] == existing['__explicit_endpoint_ids']
                and relation['relation_id'] < existing['relation_id']
            )
        ):
            deduped[key] = relation

    return [
        {key: value for key, value in relation.items() if key != '__explicit_endpoint_ids'}
        for relation in sorted(
            deduped.values(),
            key=lambda item: (
                item['relation_id'],
                item['source_id'],
                item['target_id'],
                item['relation_type'],
            ),
        )
    ]


def load_replacement_card_paths() -> dict[str, Path]:
    record_path = AUTHORING_ROOT / 'knowledge' / 'resource-bindings' / 'card-replacements.json'
    if not record_path.exists():
        return {}
    record = read_json(record_path)
    authority = read_json(AUTHORING_ROOT / 'knowledge' / 'authority' / 'current.json')
    if record.get('contract') != 'act-reviewed-card-replacements/v1' or record.get('status') != 'accepted':
        raise ValueError('Invalid card replacement record')
    if any(record.get('authority', {}).get(key) != authority.get(key)
           for key in ('releaseId', 'releaseSetId', 'snapshotId', 'snapshotHash')):
        raise ValueError('Card replacement Authority drift')
    paths: dict[str, Path] = {}
    for row in record['rows']:
        card_id = row['cardId']
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,199}', card_id):
            raise ValueError('Unsafe replacement card id')
        target = RUNTIME_ROOT / 'knowledge' / 'cards' / 'authority' / 'nodes' / f'{card_id}.md'
        if hashlib.sha256(target.read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('Replacement card hash drift')
        for resource_id in row['retiredResourceIds']:
            if not resource_id.startswith('act:card:'):
                raise ValueError('Invalid retired card resource')
            node_id = resource_id[len('act:card:'):]
            if node_id in paths:
                raise ValueError('Duplicate retired card resource')
            paths[node_id] = target
    return paths


def build_runtime_nodes(
    nodes_by_id: dict[str, dict[str, Any]],
    infograph_resource_by_node_id: dict[str, dict[str, str]],
) -> list[dict[str, Any]]:
    card_dir = RUNTIME_ROOT / 'knowledge' / 'cards' / 'nodes'
    replacement_cards = load_replacement_card_paths()
    runtime_nodes: list[dict[str, Any]] = []
    ordered_nodes = sorted(
        nodes_by_id.values(),
        key=lambda item: (
            int(item.get('chapter', 999) or 999),
            str(item.get('name', '')),
        ),
    )

    for index, node in enumerate(ordered_nodes):
        chapter = node.get('chapter') if isinstance(node.get('chapter'), int) else None
        chapter_name = resolve_chapter_name(chapter, node.get('chapter_name'))
        ring = index // 24
        angle = (index % 24) * ((2 * math.pi) / 24)
        radius = ((chapter or 1) * 14) + (ring * 6)
        node_id = str(node['id'])
        resources: list[Any] = []
        node_card_path = replacement_cards.get(node_id, card_dir / f'{node_id}.md')
        if node_card_path.exists():
            resources.append(str(node_card_path.relative_to(REPO_ROOT)).replace('\\', '/'))
        infograph_resource = infograph_resource_by_node_id.get(node_id)
        if infograph_resource:
            resources.append(infograph_resource)

        runtime_nodes.append({
            'id': node_id,
            'name': node['name'],
            'nodeType': infer_node_type(node),
            'description': node.get('definition') or f"{node['name']} 的知识节点",
            'positionX': round(math.cos(angle) * radius, 1),
            'positionY': round(math.sin(angle) * radius, 1),
            'positionZ': chapter or 0,
            'bloomLevel': normalize_bloom_level(node.get('bloom_level')),
            'knowledgeDim': normalize_knowledge_dim(node.get('category')),
            'chapter': chapter,
            'chapterName': chapter_name,
            'metadata': {
                'chapter': chapter,
                'chapterName': chapter_name,
                'category': node.get('category'),
                'knowledge_type': node.get('knowledge_type'),
                'bloom_level': node.get('bloom_level'),
                'definition': node.get('definition'),
                'examples': node.get('examples') or [],
                'formulas': node.get('formulas') or [],
                'prerequisites': node.get('prerequisites') or [],
                'relatedConcepts': node.get('related_concepts') or [],
                'difficulty': node.get('difficulty'),
                'importance': node.get('importance'),
                'keywords': node.get('keywords') or [],
                'infograph': infograph_resource,
                'createdAt': node.get('created_at'),
                'updatedAt': node.get('updated_at'),
                'source': 'course-content/runtime/knowledge/graph/nodes.json',
            },
            'content': {},
            'resources': resources,
            'tags': list(dict.fromkeys((node.get('keywords') or []) + [f'chapter-{chapter or 0}'])),
        })

    return runtime_nodes


def copy_tree_contents(source: Path, target: Path, patterns: tuple[str, ...]) -> None:
    target.mkdir(parents=True, exist_ok=True)
    for item in source.iterdir():
        if item.is_dir():
            copy_tree_contents(item, target / item.name, patterns)
            continue
        if item.name.endswith(patterns):
            destination = target / item.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            copy_text_data_file(item, destination)


def copy_text_data_file(source: Path, destination: Path) -> None:
    content = source.read_text(encoding='utf-8').replace('\r\n', '\n').replace('\r', '\n')
    if destination.exists() and destination.read_text(encoding='utf-8') == content:
        return
    destination.write_text(content, encoding='utf-8', newline='\n')


def reset_directory(target: Path) -> None:
    if target.exists():
        def handle_remove_error(function, path, exc_info):  # type: ignore[no-untyped-def]
            if issubclass(exc_info[0], FileNotFoundError):
                return
            raise exc_info[1]

        shutil.rmtree(target, onerror=handle_remove_error)
    target.mkdir(parents=True, exist_ok=True)


def rewrite_markdown_media(markdown: str, runtime_dir_fragment: str) -> str:
    def replace(match: re.Match[str]) -> str:
        label = match.group(1)
        url = match.group(2).strip()
        if '://' in url or url.startswith('/'):
            return match.group(0)
        filename = Path(url).name
        rewritten = f'/course-runtime/lessons/{runtime_dir_fragment}/media/{filename}'
        return f'![{label}]({rewritten})'

    pattern = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
    return pattern.sub(replace, markdown)


def export_handout(lesson_id: str) -> None:
    lesson_dir = get_authoring_lesson_dir(lesson_id)
    runtime_dir = get_runtime_lesson_dir(lesson_id)
    runtime_fragment = str(runtime_dir.relative_to(RUNTIME_ROOT / 'lessons')).replace('\\', '/')
    design_dir = lesson_dir / 'design'
    source = resolve_lesson_artifact_path(design_dir, lesson_id, 'handout.md')
    if not source.exists():
        practice_guide = resolve_lesson_artifact_path(design_dir, lesson_id, 'practice-guide.md')
        if practice_guide.exists():
            source = practice_guide
    destination = runtime_dir / handout_markdown_filename(lesson_id)
    content = source.read_text(encoding='utf-8')
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(rewrite_markdown_media(content, runtime_fragment), encoding='utf-8')

    legacy_destination = runtime_dir / 'handout.md'
    if legacy_destination.exists() and legacy_destination != destination:
        legacy_destination.unlink()

    pdf_source = resolve_lesson_artifact_path(design_dir, lesson_id, 'handout.pdf')
    pdf_destination = runtime_dir / handout_pdf_filename(lesson_id)
    if pdf_source.exists():
        shutil.copy2(pdf_source, pdf_destination)
    else:
        if pdf_destination.exists():
            pdf_destination.unlink()

    legacy_pdf_destination = runtime_dir / 'handout.pdf'
    if legacy_pdf_destination.exists() and legacy_pdf_destination != pdf_destination:
        legacy_pdf_destination.unlink()


def copy_media_assets(source_dir: Path, destination_dir: Path) -> list[str]:
    copied: list[str] = []
    static_suffixes = {
        '.png',
        '.jpg',
        '.jpeg',
        '.svg',
        '.webp',
        '.gif',
        '.mp4',
        '.webm',
        '.mp3',
        '.m4a',
        '.wav',
        '.pdf',
    }

    for asset in sorted(source_dir.iterdir()):
        if not asset.is_file() or asset.suffix.lower() not in static_suffixes:
            continue
        shutil.copy2(asset, destination_dir / asset.name)
        copied.append(asset.name)

    return copied


def copy_generated_media_data(lesson_dir: Path, destination_dir: Path) -> None:
    raw_data_dir = lesson_dir / 'media' / 'raw' / 'generated-data'
    target_dir = destination_dir / 'generated-data'
    if raw_data_dir.exists():
        copy_tree_contents(raw_data_dir, target_dir, ('.csv', '.json', '.txt'))

    processed_dir = lesson_dir / 'media' / 'processed'
    if not processed_dir.exists():
        return
    data_assets = [item for item in sorted(processed_dir.iterdir()) if item.is_file() and item.suffix.lower() in {'.csv', '.json', '.txt'}]
    if not data_assets:
        return
    target_dir.mkdir(parents=True, exist_ok=True)
    for asset in data_assets:
        copy_text_data_file(asset, target_dir / asset.name)


def generate_runtime_media(lesson_id: str) -> None:
    lesson_dir = get_authoring_lesson_dir(lesson_id)
    raw_dir = lesson_dir / 'media' / 'raw'
    output_dir = get_runtime_lesson_dir(lesson_id) / 'media'
    media_index_path = output_dir / f'{lesson_id}-media.md'
    existing_media_index = media_index_path.read_text(encoding='utf-8') if media_index_path.exists() else None
    reset_directory(output_dir)

    processed_dir = lesson_dir / 'media' / 'processed'
    if processed_dir.exists() and any(path.is_file() for path in processed_dir.iterdir()):
        copy_media_assets(processed_dir, output_dir)
        copy_generated_media_data(lesson_dir, output_dir)
        processed_media_index = processed_dir / f'{lesson_id}-media.md'
        media_index_seed = (
            processed_media_index.read_text(encoding='utf-8')
            if processed_media_index.exists()
            else existing_media_index
        )
        ensure_runtime_media_index(media_index_path, lesson_id, media_index_seed)
        return

    if not raw_dir.exists():
        ensure_runtime_media_index(media_index_path, lesson_id, existing_media_index)
        return

    matplotlib_env = os.environ.copy()
    matplotlib_env['MPLBACKEND'] = 'Agg'
    matplotlib_env['MPLCONFIGDIR'] = str(raw_dir / '.matplotlib')
    Path(matplotlib_env['MPLCONFIGDIR']).mkdir(parents=True, exist_ok=True)

    static_suffixes = {
        '.png',
        '.jpg',
        '.jpeg',
        '.svg',
        '.webp',
        '.gif',
        '.mp4',
        '.webm',
        '.mp3',
        '.m4a',
        '.wav',
        '.pdf',
    }

    for asset in sorted(raw_dir.iterdir()):
        if not asset.is_file() or asset.suffix.lower() not in static_suffixes:
            continue
        if (raw_dir / f'{asset.stem}.py').exists():
            continue
        shutil.copy2(asset, output_dir / asset.name)

    for script in sorted(raw_dir.glob('*.py')):
        if script.name == 'matplotlib_font.py':
            continue
        output_path = output_dir / f'{script.stem}.svg'
        subprocess.run(
            ['python3', script.name, '--output', str(output_path)],
            cwd=str(raw_dir),
            check=True,
            env=matplotlib_env,
        )

    copy_generated_media_data(lesson_dir, output_dir)
    ensure_runtime_media_index(media_index_path, lesson_id, existing_media_index)


def export_review_bundle(lesson_id: str) -> dict[str, Any]:
    review_dir = get_runtime_lesson_dir(lesson_id) / 'review'
    review_dir.mkdir(parents=True, exist_ok=True)
    design_dir = get_authoring_lesson_dir(lesson_id) / 'design'
    runtime_fragment = str(review_dir.parent.relative_to(RUNTIME_ROOT / 'lessons')).replace('\\', '/')

    review_paths: dict[str, Any] = {'status': 'pending'}
    copy_pairs = {
        'boppps.md': 'boppps_path',
        'practice-guide.md': 'practice_guide_path',
        'assessment-spec.md': 'assessment_spec_path',
    }

    for source_name, json_key in copy_pairs.items():
        source = resolve_lesson_artifact_path(design_dir, lesson_id, source_name)
        if not source.exists():
            continue
        destination_name = with_lesson_prefix(lesson_id, source_name)
        destination = review_dir / destination_name
        write_if_changed(
            destination,
            rewrite_markdown_media(source.read_text(encoding='utf-8'), runtime_fragment),
        )
        legacy_destination = review_dir / source_name
        if legacy_destination.exists() and legacy_destination != destination:
            legacy_destination.unlink()
        review_paths[json_key] = f'/course-runtime/lessons/{runtime_fragment}/review/{destination_name}'

    multimedia_check_path = review_dir / 'multimedia-check.json'
    missing_assets: list[str] = []
    if multimedia_check_path.exists():
        multimedia_check = read_json(multimedia_check_path)
        missing_assets = [
            item for item in multimedia_check.get('missing_assets', [])
            if isinstance(item, str) and item
        ]
        if missing_assets:
            review_paths['missing_assets'] = missing_assets

    report_path = review_dir / 'review-report.md'
    if report_path.exists():
        review_paths['report_path'] = f'/course-runtime/lessons/{runtime_fragment}/review/review-report.md'
        review_paths['status'] = 'incomplete' if missing_assets else 'reviewed'

    for filename, json_key in (
        ('knowledge-card-check.json', 'knowledge_card_check_path'),
        ('interactive-page-check.json', 'interactive_page_check_path'),
        ('multimedia-check.json', 'multimedia_check_path'),
        ('source-manifest.json', 'source_manifest_path'),
    ):
        if (review_dir / filename).exists():
            review_paths[json_key] = f'/course-runtime/lessons/{runtime_fragment}/review/{filename}'

    return review_paths


def load_manifest(lesson_id: str) -> dict[str, Any]:
    return read_json(get_authoring_lesson_dir(lesson_id) / 'manifest.json')


def load_sequence(lesson_id: str) -> dict[str, Any]:
    sequence_path = get_authoring_cards_dir(lesson_id) / 'sequence.json'
    return read_json(sequence_path) if sequence_path.exists() else {}


def load_interactive_contract(lesson_id: str) -> dict[str, Any] | None:
    contract_path = resolve_lesson_artifact_path(
        get_authoring_lesson_dir(lesson_id) / 'design',
        lesson_id,
        'interactive-contract.yaml',
    )
    if not contract_path.exists():
        return None
    payload = yaml.safe_load(contract_path.read_text(encoding='utf-8'))
    if not isinstance(payload, dict):
        return None
    return payload


def build_interactive_runtime_manifest(lesson_id: str) -> dict[str, Any] | None:
    contract = load_interactive_contract(lesson_id)
    if contract is None:
        return None

    steps = contract.get('steps')
    if not isinstance(steps, dict):
        return None

    def normalize_content_blocks(value: Any) -> Any:
        if not isinstance(value, list):
            return value
        normalized: dict[str, Any] = {}
        for item in value:
            if not isinstance(item, dict):
                continue
            block_id = item.get('id')
            if not isinstance(block_id, str) or not block_id:
                continue
            block = dict(item)
            block.pop('id', None)
            normalized[block_id] = block
        return normalized

    def block_to_payload(block_key: str, block: Any) -> dict[str, Any]:
        if isinstance(block, list):
            return {'block_key': block_key, 'items': block}
        if not isinstance(block, dict):
            return {'block_key': block_key, 'text': str(block)}
        payload: dict[str, Any] = {'block_key': block_key}
        title = block.get('title')
        if isinstance(title, str) and title:
            payload['title'] = title
        body = block.get('body')
        if isinstance(body, str) and body:
            payload['text'] = body
        value = block.get('formula') or block.get('latex') or block.get('math') or block.get('value')
        if isinstance(value, str) and value:
            payload['formula'] = value
        items = block.get('items')
        if isinstance(items, list) and items:
            payload['items'] = items
        columns = block.get('columns')
        rows = block.get('rows')
        if isinstance(columns, list) and isinstance(rows, list) and rows:
            payload['columns'] = columns
            payload['rows'] = rows
        return payload

    def pick_block_key(module: dict[str, Any], blocks: dict[str, Any], used: set[str]) -> str | None:
        module_id = str(module.get('id', ''))
        kind = str(module.get('kind', ''))
        region = str(module.get('region', ''))
        normalized = module_id.replace('-', '_')
        candidates = [
            region,
            module_id,
            normalized,
            module_id.removesuffix('-card'),
            module_id.removesuffix('-cards'),
            module_id.removesuffix('-table'),
            module_id.removesuffix('-figure'),
            module_id.removesuffix('-block'),
        ]
        if kind == 'stage-map':
            candidates.extend(['path', 'page_intro'])
        if 'question' in kind or 'question' in module_id:
            candidates.extend(['question', 'questions'])
        if 'boundary' in kind or 'boundary' in module_id:
            candidates.append('boundary')
        if 'goal' in kind or 'goal' in module_id:
            candidates.append('goals')
        if 'formula' in kind or 'formula' in module_id:
            candidates.extend(['formula', 'integral-formula', 'transfer-function'])
        if 'table' in kind or 'matrix' in module_id:
            candidates.extend(['matrix-rows', 'meaning', 'role-note', 'boundary'])
        if 'summary' in kind:
            candidates.extend(['core-fact', 'summary', 'takeaways'])
        if 'rule' in kind:
            candidates.append('rules')
        if 'evidence' in kind:
            candidates.extend(['evidence', 'checklist'])
        if 'template' in kind or 'task-card' in module_id:
            candidates.extend(['fields', 'checklist'])
        if 'example' in kind:
            candidates.extend(['example', 'fields'])
        if 'next' in kind:
            candidates.extend(['next-step', 'next'])
        if kind == 'content.reveal':
            candidates.extend(['reveal_steps', 'reveal'])
        if kind == 'content.cardSet':
            candidates.extend(['consequences', 'entries', 'limits'])
        if kind == 'content.formula':
            candidates.extend(['calculation', 'formula'])
        if kind == 'content.rich':
            candidates.extend(['problem', 'content'])
        candidates.extend(list(blocks.keys()))
        for candidate in dict.fromkeys(candidates):
            if candidate in blocks and candidate not in used:
                return candidate
        for candidate in dict.fromkeys(candidates):
            if candidate in blocks:
                return candidate
        return None

    def normalize_modules(value: Any, blocks: dict[str, Any]) -> list[Any]:
        if not isinstance(value, list):
            return []
        used: set[str] = set()
        normalized_modules: list[Any] = []
        for item in value:
            if not isinstance(item, dict):
                normalized_modules.append(item)
                continue
            module = dict(item)
            payload = module.get('payload') if isinstance(module.get('payload'), dict) else {}
            payload = dict(payload)
            kind = str(module.get('kind', ''))
            if not payload and kind in {'graphic', 'interactive-figure'}:
                payload = {'resolver': f'{lesson_id}:{module.get("id", "")}'}
            has_owned_media = kind == 'content.figure' and isinstance(payload.get('src'), str)
            if kind.startswith('content.') and 'block_key' not in payload and not has_owned_media:
                block_key = pick_block_key(module, blocks, used)
                if block_key:
                    used.add(block_key)
                    payload = {**block_to_payload(block_key, blocks[block_key]), **payload}
            if payload:
                module['payload'] = payload
            normalized_modules.append(module)
        return normalized_modules

    def synthesize_activity_cards(step_id: str, step: dict[str, Any]) -> list[dict[str, Any]]:
        interaction_spec = step.get('interaction_spec')
        if not isinstance(interaction_spec, dict):
            return []
        existing = interaction_spec.get('activity_cards')
        if isinstance(existing, list):
            return existing
        interaction_kind = str(interaction_spec.get('interaction_kind', 'none'))
        if interaction_kind == 'none':
            return []
        activity_modules = [
            module for module in step.get('modules', [])
            if isinstance(module, dict)
            and str(module.get('kind', '')) in {
                'single-choice-card',
                'quiz-card',
                'quiz-group',
                'binary-choice',
                'card-sort',
                'triple-match',
                'task-card-workspace',
            }
        ]
        if not activity_modules:
            activity_modules = [{'id': f'{step_id}-activity', 'kind': interaction_kind}]
        student_task = str(interaction_spec.get('student_task') or '完成本页判断并提交。')
        response_kind = 'text.short'
        if interaction_kind in {'single_choice', 'binary_choice', 'quiz_group'}:
            response_kind = 'single_choice'
        if interaction_kind in {'card_sort', 'triple_match', 'task_card_workspace'}:
            response_kind = interaction_kind
        return [
            {
                'id': str(module.get('id') or f'{step_id}-activity-{index + 1}'),
                'title': str(module.get('title') or student_task),
                'prompt': student_task,
                'reference_answer': '见课堂讨论与教师反馈。',
                'response_kind': response_kind,
                'submit_scope': 'card',
                'layout_span': 'full',
                'options': [],
            }
            for index, module in enumerate(activity_modules)
        ]

    runtime_steps: dict[str, Any] = {}
    for step_id, step in steps.items():
        if not isinstance(step, dict):
            runtime_steps[step_id] = step
            continue
        runtime_step = dict(step)
        runtime_step['content_blocks'] = normalize_content_blocks(runtime_step.get('content_blocks'))
        runtime_step['modules'] = normalize_modules(runtime_step.get('modules'), runtime_step['content_blocks'])
        if isinstance(runtime_step.get('interaction_spec'), dict):
            runtime_step['interaction_spec'] = dict(runtime_step['interaction_spec'])
            runtime_step['interaction_spec']['activity_cards'] = synthesize_activity_cards(step_id, runtime_step)
        runtime_steps[step_id] = runtime_step

    return {
        'contract_version': contract.get('contract_version'),
        'lesson_id': contract.get('lesson_id', lesson_id),
        'course_title': contract.get('course_title', ''),
        'course_route_segment': contract.get('course_route_segment', ''),
        'preview_mode': contract.get('preview_mode', {}),
        'media_policy': contract.get('media_policy', {}),
        'telemetry_strategy': contract.get('telemetry_strategy', ''),
        'teacher_insight_strategy': contract.get('teacher_insight_strategy', ''),
        'required_step_fields': contract.get('required_step_fields', []),
        'steps': runtime_steps,
    }


def build_graph_overlay(
    lesson_id: str,
    graph_lesson_id: str,
    manifest: dict[str, Any],
    sequence: dict[str, Any],
    runtime_nodes: list[dict[str, Any]],
    runtime_relations: list[dict[str, Any]],
    reviewed_card_order: list[str],
) -> dict[str, Any]:
    canonical_index = load_canonical_index()
    manifest = canonical_index.canonicalize_manifest(manifest)
    sequence = canonical_index.canonicalize_sequence(sequence)
    overlay = build_lesson_overlay_payload(
        graph_lesson_id=graph_lesson_id,
        manifest=manifest,
        sequence=sequence,
        runtime_nodes=runtime_nodes,
        runtime_relations=runtime_relations,
        reviewed_card_order=reviewed_card_order,
    )
    existing_overlay_path = get_runtime_lesson_dir(lesson_id) / 'graph-overlay.json'
    if existing_overlay_path.exists():
        preserve_existing_overlay_positions(overlay, read_json(existing_overlay_path))
    build_lesson_overlay_revision(overlay)
    return overlay


def preserve_existing_overlay_positions(
    overlay: dict[str, Any],
    previous_overlay: dict[str, Any],
) -> None:
    previous_positions = {
        str(node['id']): {
            key: node[key]
            for key in ('positionX', 'positionY', 'positionZ')
            if isinstance(node.get(key), (int, float))
        }
        for node in previous_overlay.get('nodes', [])
        if isinstance(node, dict) and isinstance(node.get('id'), str)
    }
    for node in overlay.get('nodes', []):
        if not isinstance(node, dict):
            continue
        position = previous_positions.get(str(node.get('id')))
        if position:
            node.update(position)


def export_lesson_runtime(
    lesson_id: str,
    runtime_nodes: list[dict[str, Any]],
    runtime_relations: list[dict[str, Any]],
) -> None:
    canonical_index = load_canonical_index()
    manifest_path = get_authoring_lesson_dir(lesson_id) / 'manifest.json'
    sequence_path = get_authoring_cards_dir(lesson_id) / 'sequence.json'
    reviewed_card_order = resolve_authoring_card_order(sequence_path, manifest_path)
    manifest = canonical_index.canonicalize_manifest(load_manifest(lesson_id))
    sequence = canonical_index.canonicalize_sequence({
        **load_sequence(lesson_id),
        'card_order': reviewed_card_order,
    })
    reviewed_card_order = sequence['card_order']
    runtime_dir = get_runtime_lesson_dir(lesson_id)
    runtime_fragment = str(runtime_dir.relative_to(RUNTIME_ROOT / 'lessons')).replace('\\', '/')
    graph_lesson_id = get_mapped_target_id(lesson_id) or str(manifest.get('lesson_id') or lesson_id)
    runtime_sequence = {
        **sequence,
        'lesson_id': graph_lesson_id,
    }
    export_handout(lesson_id)
    generate_runtime_media(lesson_id)
    export_media_transcripts(lesson_id)
    interactive_manifest = build_interactive_runtime_manifest(lesson_id)

    graph_overlay = build_graph_overlay(
        lesson_id,
        graph_lesson_id,
        manifest,
        runtime_sequence,
        runtime_nodes,
        runtime_relations,
        reviewed_card_order,
    )
    write_json(runtime_dir / 'graph-overlay.json', graph_overlay)
    if interactive_manifest is not None:
        write_json(runtime_dir / 'interactive-manifest.json', interactive_manifest)
    review_paths = export_review_bundle(lesson_id)

    lesson_json = {
        **manifest,
        'lesson_id': graph_lesson_id,
        'sequence': runtime_sequence,
        'handout_path': f'/course-runtime/lessons/{runtime_fragment}/{handout_markdown_filename(lesson_id)}',
        'handout_source_path': (
            f'course-content/runtime/lessons/{runtime_fragment}/{handout_markdown_filename(lesson_id)}'
        ),
        'graph_overlay_path': f'/course-runtime/lessons/{runtime_fragment}/graph-overlay.json',
        'media_base_path': f'/course-runtime/lessons/{runtime_fragment}/media',
        'media_index_path': f'/course-runtime/lessons/{runtime_fragment}/media/{lesson_id}-media.md',
        'media_index_source_path': f'course-content/runtime/lessons/{runtime_fragment}/media/{lesson_id}-media.md',
        'review': review_paths,
    }
    if (runtime_dir / handout_pdf_filename(lesson_id)).exists():
        lesson_json['handout_pdf_path'] = (
            f'/course-runtime/lessons/{runtime_fragment}/{handout_pdf_filename(lesson_id)}'
        )
        lesson_json['handout_pdf_source_path'] = (
            f'course-content/runtime/lessons/{runtime_fragment}/{handout_pdf_filename(lesson_id)}'
        )
    if interactive_manifest is not None:
        lesson_json['interactive_manifest_path'] = f'/course-runtime/lessons/{runtime_fragment}/interactive-manifest.json'
        lesson_json['interactive_manifest_source_path'] = (
            f'course-content/runtime/lessons/{runtime_fragment}/interactive-manifest.json'
        )
    write_json(runtime_dir / 'lesson.json', lesson_json)


def load_combined_authoring_graph() -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    canonical_index = load_canonical_index()

    def parse_markdown_frontmatter(markdown: str) -> dict[str, Any]:
        if not markdown.startswith('---\n'):
            return {}
        end = markdown.find('\n---\n', 4)
        if end < 0:
            return {}
        payload = yaml.safe_load(markdown[4:end]) or {}
        return payload if isinstance(payload, dict) else {}

    def strip_frontmatter(markdown: str) -> str:
        return re.sub(r'^---\n[\s\S]*?\n---\n', '', markdown).strip()

    def extract_bold_field(markdown: str, label: str) -> str | None:
        match = re.search(rf'\*\*{re.escape(label)}\*\*：\s*(.+)', markdown)
        if not match:
            return None
        return match.group(1).strip()

    def build_card_only_node(node_id: str) -> dict[str, Any] | None:
        card_path = AUTHORING_ROOT / 'knowledge' / 'cards' / 'nodes' / f'{node_id}.md'
        if not card_path.exists():
            return None
        markdown = card_path.read_text(encoding='utf-8')
        frontmatter = parse_markdown_frontmatter(markdown)
        body = strip_frontmatter(markdown)
        heading = extract_primary_heading(body)
        raw_name = frontmatter.get('name') or heading or node_id
        name = str(raw_name).split('|', 1)[0].strip() or node_id
        definition = frontmatter.get('definition') or extract_bold_field(body, '一句话定义')
        return normalize_authoring_node({
            'id': node_id,
            'name': name,
            'name_en': frontmatter.get('name_en'),
            'category': frontmatter.get('category'),
            'knowledge_type': frontmatter.get('knowledge_type'),
            'bloom_level': frontmatter.get('bloom_level'),
            'definition': definition,
            'examples': frontmatter.get('examples') or [],
            'formulas': frontmatter.get('formulas') or [],
            'keywords': frontmatter.get('tags') or [],
            'chapter': frontmatter.get('chapter'),
            'source': str(card_path.relative_to(REPO_ROOT)).replace('\\', '/'),
        })

    def store_node(nodes_by_id: dict[str, dict[str, Any]], source_node_id: str, node: dict[str, Any]) -> None:
        canonical_id = canonical_index.canonicalize(source_node_id)
        selected_card_id = canonical_index.selected_card_node_id(canonical_id)
        normalized = normalize_authoring_node(node)
        normalized['id'] = canonical_id
        normalized['__source_node_id'] = source_node_id
        existing = nodes_by_id.get(canonical_id)
        if existing is None:
            nodes_by_id[canonical_id] = normalized
            return
        existing_source_id = str(existing.get('__source_node_id') or canonical_id)
        if source_node_id == selected_card_id or existing_source_id != selected_card_id and source_node_id == canonical_id:
            nodes_by_id[canonical_id] = normalized

    base_graph = read_json(AUTHORING_ROOT / 'knowledge' / 'base' / 'knowledge_graph.json')
    nodes_by_id: dict[str, dict[str, Any]] = {}
    for node_id, node in dict(base_graph.get('nodes', {})).items():
        store_node(nodes_by_id, str(node_id), node)
    relation_records = [
        canonical_index.canonicalize_relation_record(record)
        for record in read_jsonl(AUTHORING_ROOT / 'knowledge' / 'base' / 'relations.jsonl')
    ]

    lesson_root = AUTHORING_ROOT / 'lessons'
    lesson_dirs = []
    for path in sorted(lesson_root.iterdir()):
        if not path.is_dir():
            continue
        if path.name == 'legacy':
            lesson_dirs.extend(sorted(child for child in path.iterdir() if child.is_dir()))
            continue
        lesson_dirs.append(path)

    for lesson_dir in lesson_dirs:
        for node in read_jsonl(lesson_dir / 'graph' / 'nodes.jsonl'):
            node_id = str(node['id'])
            store_node(nodes_by_id, node_id, node)
        relation_records.extend(
            canonical_index.canonicalize_relation_record(record)
            for record in read_jsonl(lesson_dir / 'graph' / 'relations.jsonl')
        )

    sequence_root = AUTHORING_ROOT / 'knowledge' / 'cards' / 'lessons'
    if sequence_root.exists():
        for sequence_path in sorted(sequence_root.glob('*/sequence.json')):
            sequence = read_json(sequence_path)
            for node_id_value in sequence.get('card_order', []):
                node_id = str(node_id_value)
                if canonical_index.canonicalize(node_id) in nodes_by_id:
                    continue
                card_only_node = build_card_only_node(node_id)
                if card_only_node:
                    store_node(nodes_by_id, node_id, card_only_node)

    for node in nodes_by_id.values():
        node.pop('__source_node_id', None)
    return nodes_by_id, relation_records


def copy_canonical_node_cards(nodes_by_id: dict[str, dict[str, Any]]) -> None:
    canonical_index = load_canonical_index()
    source_root = AUTHORING_ROOT / 'knowledge' / 'cards' / 'nodes'
    runtime_cards_nodes = RUNTIME_ROOT / 'knowledge' / 'cards' / 'nodes'

    for canonical_id in sorted(nodes_by_id):
        selected_card_id = canonical_index.selected_card_node_id(canonical_id)
        source_path = source_root / f'{selected_card_id}.md'
        if not source_path.exists():
            source_path = source_root / f'{canonical_id}.md'
        if not source_path.exists():
            continue
        shutil.copy2(source_path, runtime_cards_nodes / f'{canonical_id}.md')


def copy_reviewed_infographs() -> dict[str, dict[str, str]]:
    canonical_index = load_canonical_index()
    authoring_root = AUTHORING_ROOT / 'knowledge' / 'infographs' / 'lessons'
    runtime_root = RUNTIME_ROOT / 'knowledge' / 'infographs'
    runtime_nodes_root = runtime_root / 'nodes'
    resource_by_node_id: dict[str, dict[str, str]] = {}
    manifest_items: list[dict[str, str]] = []
    candidates_by_node_id: dict[str, list[dict[str, Any]]] = {}

    reset_directory(runtime_nodes_root)
    runtime_root.mkdir(parents=True, exist_ok=True)

    if not authoring_root.exists():
        write_json(runtime_root / 'manifest.json', {'schema_version': 1, 'items': []})
        return resource_by_node_id

    for lesson_dir in sorted(authoring_root.iterdir()):
        nodes_dir = lesson_dir / 'nodes'
        if not nodes_dir.is_dir():
            continue
        for node_dir in sorted(nodes_dir.iterdir()):
            if not node_dir.is_dir():
                continue
            node_id = node_dir.name
            review_path = node_dir / 'review.json'
            image_path = node_dir / 'infograph.png'
            if not review_path.exists() or not image_path.exists():
                continue
            try:
                review = read_json(review_path)
            except Exception:
                continue
            if str(review.get('status') or '').strip().lower() != 'accepted':
                continue

            canonical_id = canonical_index.canonicalize(node_id)
            candidates_by_node_id.setdefault(canonical_id, []).append({
                'lesson_id': lesson_dir.name,
                'node_id': node_id,
                'review': review,
                'image_path': image_path,
                'sha1': hashlib.sha1(image_path.read_bytes()).hexdigest(),
            })

    for canonical_id, candidates in sorted(candidates_by_node_id.items()):
        selected_ref = canonical_index.selected_infograph(canonical_id)
        selected: dict[str, Any] | None = None
        if selected_ref:
            selected = next(
                (
                    candidate
                    for candidate in candidates
                    if candidate['lesson_id'] == selected_ref['lesson_id']
                    and candidate['node_id'] == selected_ref['node_id']
                ),
                None,
            )
            if selected is None:
                raise SystemExit(
                    f"Canonical infograph selection is missing for {canonical_id}: "
                    f"{selected_ref['lesson_id']}/{selected_ref['node_id']}"
                )
        elif len(candidates) == 1:
            selected = candidates[0]
        elif len({candidate['sha1'] for candidate in candidates}) == 1:
            selected = sorted(candidates, key=lambda item: (item['lesson_id'], item['node_id']))[0]
        else:
            candidate_labels = ', '.join(
                f"{candidate['lesson_id']}/{candidate['node_id']}"
                for candidate in candidates
            )
            raise SystemExit(
                f'Multiple accepted infographs for canonical node {canonical_id}; '
                f'choose selected_infograph in canonical-nodes.json: {candidate_labels}'
            )

        destination = runtime_nodes_root / f'{canonical_id}.png'
        shutil.copy2(selected['image_path'], destination)
        review = selected['review']
        path_value = str(destination.relative_to(REPO_ROOT)).replace('\\', '/')
        url_value = f'/course-runtime/knowledge/infographs/nodes/{canonical_id}.png'
        resource = {
            'type': 'infograph',
            'path': path_value,
            'url': url_value,
            'title': f"{review.get('node_name') or canonical_id} 信息图",
            'lessonId': selected['lesson_id'],
            'nodeId': canonical_id,
            'sourceNodeId': selected['node_id'],
        }
        resource_by_node_id[canonical_id] = resource
        manifest_items.append(resource)

    write_json(runtime_root / 'manifest.json', {
        'schema_version': 1,
        'items': manifest_items,
    })
    return resource_by_node_id


def export_global_knowledge() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    nodes_by_id, relation_records = load_combined_authoring_graph()
    canonical_index = load_canonical_index()
    authoring_cards_nodes = AUTHORING_ROOT / 'knowledge' / 'cards' / 'nodes'
    runtime_cards_nodes = RUNTIME_ROOT / 'knowledge' / 'cards' / 'nodes'
    runtime_cards_concepts = RUNTIME_ROOT / 'knowledge' / 'cards' / 'concepts'
    exclusions_path = AUTHORING_ROOT / 'knowledge' / 'card-exclusions.json'

    authoring_coverage = audit_knowledge_card_coverage(
        nodes_by_id,
        authoring_cards=authoring_cards_nodes,
        runtime_cards=runtime_cards_nodes,
        exclusions_path=exclusions_path,
        canonical_index=canonical_index,
        require_runtime=False,
    )
    assert_complete_knowledge_card_coverage(authoring_coverage)

    reset_directory(runtime_cards_nodes)
    if runtime_cards_concepts.exists():
        shutil.rmtree(runtime_cards_concepts)
    copy_canonical_node_cards(nodes_by_id)
    infograph_resource_by_node_id = copy_reviewed_infographs()
    runtime_relations = build_runtime_relations(nodes_by_id, relation_records)
    runtime_nodes = build_runtime_nodes(nodes_by_id, infograph_resource_by_node_id)

    runtime_coverage = audit_knowledge_card_coverage(
        nodes_by_id,
        authoring_cards=authoring_cards_nodes,
        runtime_cards=runtime_cards_nodes,
        exclusions_path=exclusions_path,
        canonical_index=canonical_index,
        require_runtime=True,
    )
    assert_complete_knowledge_card_coverage(runtime_coverage)

    write_json(RUNTIME_ROOT / 'knowledge' / 'graph' / 'nodes.json', runtime_nodes)
    write_jsonl(RUNTIME_ROOT / 'knowledge' / 'graph' / 'relations.jsonl', runtime_relations)
    write_json(RUNTIME_ROOT / 'knowledge' / 'cards' / 'coverage.json', runtime_coverage)

    return runtime_nodes, runtime_relations


def resolve_lessons(args: argparse.Namespace) -> list[str]:
    if args.export_all:
        lessons: list[str] = []
        for entry in load_lesson_id_map().get('entries', []):
            if entry.get('status') != 'mainline':
                continue
            request_ids = entry.get('request_ids', [])
            if not request_ids:
                continue
            request_id = str(request_ids[0])
            if get_authoring_lesson_dir(request_id).exists():
                lessons.append(request_id)
        return lessons
    if args.lesson:
        get_lesson_entry(args.lesson)
        if not get_authoring_lesson_dir(args.lesson).exists():
            raise SystemExit(f'Unknown lesson storage: {args.lesson}')
        return [args.lesson]
    raise SystemExit('Please provide a lesson id or --all')


def main() -> None:
    args = parse_args()
    lessons = resolve_lessons(args)
    runtime_nodes, runtime_relations = export_global_knowledge()
    for lesson_id in lessons:
        export_lesson_runtime(lesson_id, runtime_nodes, runtime_relations)
        print(f'exported runtime for {lesson_id}')


if __name__ == '__main__':
    main()
