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
CONTENT_CONCEPTS_ROOT = REPO_ROOT / 'content' / 'concepts'

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
from runtime_media_index import ensure_runtime_media_index  # noqa: E402

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


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = '\n'.join(json.dumps(record, ensure_ascii=False) for record in records)
    path.write_text((content + '\n') if content else '', encoding='utf-8')


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
    by_name_chapter: dict[str, str],
    by_name: dict[str, list[str]],
) -> str | None:
    node_id = record.get(f'{endpoint}_id')
    if node_id:
        return str(node_id)

    name = record.get(endpoint) or record.get(f'{endpoint}_name')
    if not name:
        return None

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


def normalize_relation_record(
    record: dict[str, Any],
    nodes_by_id: dict[str, dict[str, Any]],
    by_name_chapter: dict[str, str],
    by_name: dict[str, list[str]],
) -> tuple[str, dict[str, Any]] | None:
    source_id = resolve_node_id(record, 'source', by_name_chapter, by_name)
    target_id = resolve_node_id(record, 'target', by_name_chapter, by_name)
    if not source_id or not target_id or source_id == target_id:
        return None

    source_node = nodes_by_id.get(source_id)
    target_node = nodes_by_id.get(target_id)
    if not source_node or not target_node:
        return None

    relation_type = str(record.get('relation_type') or record.get('relation') or 'related')
    relation_id = str(record.get('relation_id') or build_generated_relation_id(source_id, target_id, relation_type))
    strength = float(record.get('strength') or 1)
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
        'strength': max(0.0, min(1.0, strength)),
    }
    return key, relation


def build_runtime_relations(nodes_by_id: dict[str, dict[str, Any]], relation_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_name_chapter, by_name = build_name_maps(nodes_by_id)
    deduped: dict[str, dict[str, Any]] = {}
    relation_id_to_key: dict[str, str] = {}

    for record in relation_records:
        normalized = normalize_relation_record(record, nodes_by_id, by_name_chapter, by_name)
        if normalized is None:
            continue
        key, relation = normalized
        existing_key = relation_id_to_key.get(relation['relation_id'])
        if existing_key is not None and existing_key != key:
            raise ValueError(
                f"duplicate relation_id {relation['relation_id']} maps to multiple relations: "
                f'{existing_key} and {key}'
            )
        relation_id_to_key[relation['relation_id']] = key

        existing = deduped.get(key)
        if existing is None or relation['strength'] > existing['strength']:
            deduped[key] = relation

    return list(deduped.values())


def build_runtime_nodes(
    nodes_by_id: dict[str, dict[str, Any]],
    concept_resource_by_node_id: dict[str, str],
) -> list[dict[str, Any]]:
    card_dir = RUNTIME_ROOT / 'knowledge' / 'cards' / 'nodes'
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
        resources: list[str] = []
        node_card_path = card_dir / f'{node_id}.md'
        if node_card_path.exists():
            resources.append(str(node_card_path.relative_to(REPO_ROOT)).replace('\\', '/'))
        elif node_id in concept_resource_by_node_id:
            resources.append(concept_resource_by_node_id[node_id])

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
                'bloom_level': node.get('bloom_level'),
                'definition': node.get('definition'),
                'examples': node.get('examples') or [],
                'formulas': node.get('formulas') or [],
                'prerequisites': node.get('prerequisites') or [],
                'relatedConcepts': node.get('related_concepts') or [],
                'difficulty': node.get('difficulty'),
                'importance': node.get('importance'),
                'keywords': node.get('keywords') or [],
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
            shutil.copy2(item, destination)


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
    source = design_dir / 'handout.md'
    if not source.exists():
        practice_guide = design_dir / 'practice-guide.md'
        if practice_guide.exists():
            source = practice_guide
    destination = runtime_dir / 'handout.md'
    content = source.read_text(encoding='utf-8')
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(rewrite_markdown_media(content, runtime_fragment), encoding='utf-8')

    pdf_source = design_dir / 'handout.pdf'
    pdf_destination = runtime_dir / 'handout.pdf'
    if pdf_source.exists():
        shutil.copy2(pdf_source, pdf_destination)
    elif pdf_destination.exists():
        pdf_destination.unlink()


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
        ensure_runtime_media_index(media_index_path, lesson_id, existing_media_index)
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
        source = design_dir / source_name
        if not source.exists():
            continue
        destination = review_dir / source_name
        destination.write_text(
            rewrite_markdown_media(source.read_text(encoding='utf-8'), runtime_fragment),
            encoding='utf-8',
        )
        review_paths[json_key] = f'/course-runtime/lessons/{runtime_fragment}/review/{source_name}'

    report_path = review_dir / 'review-report.md'
    if report_path.exists():
        review_paths['report_path'] = f'/course-runtime/lessons/{runtime_fragment}/review/review-report.md'
        review_paths['status'] = 'reviewed'

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
    return read_json(get_authoring_cards_dir(lesson_id) / 'sequence.json')


def load_interactive_contract(lesson_id: str) -> dict[str, Any] | None:
    contract_path = get_authoring_lesson_dir(lesson_id) / 'design' / 'interactive-contract.yaml'
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
        'steps': steps,
    }


def build_graph_overlay(
    lesson_id: str,
    graph_lesson_id: str,
    manifest: dict[str, Any],
    sequence: dict[str, Any],
    runtime_nodes: list[dict[str, Any]],
    runtime_relations: list[dict[str, Any]],
) -> dict[str, Any]:
    node_ids = list(
        dict.fromkeys(
            list(manifest.get('focus_node_ids', []))
            + list(manifest.get('reuse_node_ids', []))
            + list(manifest.get('entry_nodes', []))
            + list(manifest.get('summary_nodes', []))
            + list(manifest.get('card_order', []))
        )
    )
    node_set = set(node_ids)

    return {
        'lesson_id': graph_lesson_id,
        'title': manifest.get('title'),
        'focus_node_ids': manifest.get('focus_node_ids', []),
        'reuse_node_ids': manifest.get('reuse_node_ids', []),
        'entry_nodes': manifest.get('entry_nodes', []),
        'summary_nodes': manifest.get('summary_nodes', []),
        'card_order': manifest.get('card_order', []),
        'groups': sequence.get('groups', []),
        'nodes': [node for node in runtime_nodes if node['id'] in node_set],
        'links': [
            {
                'id': relation['id'],
                'sourceId': relation['source_id'],
                'targetId': relation['target_id'],
                'relation': relation['relation_type'],
                'relationType': relation['relation_type'],
                'strength': relation['strength'],
            }
            for relation in runtime_relations
            if relation['source_id'] in node_set and relation['target_id'] in node_set
        ],
    }


def export_lesson_runtime(
    lesson_id: str,
    runtime_nodes: list[dict[str, Any]],
    runtime_relations: list[dict[str, Any]],
) -> None:
    manifest = load_manifest(lesson_id)
    sequence = load_sequence(lesson_id)
    runtime_dir = get_runtime_lesson_dir(lesson_id)
    runtime_fragment = str(runtime_dir.relative_to(RUNTIME_ROOT / 'lessons')).replace('\\', '/')
    graph_lesson_id = get_mapped_target_id(lesson_id) or str(manifest.get('lesson_id') or lesson_id)
    runtime_sequence = {
        **sequence,
        'lesson_id': graph_lesson_id,
    }
    export_handout(lesson_id)
    generate_runtime_media(lesson_id)
    review_paths = export_review_bundle(lesson_id)
    interactive_manifest = build_interactive_runtime_manifest(lesson_id)

    graph_overlay = build_graph_overlay(lesson_id, graph_lesson_id, manifest, runtime_sequence, runtime_nodes, runtime_relations)
    write_json(runtime_dir / 'graph-overlay.json', graph_overlay)
    if interactive_manifest is not None:
        write_json(runtime_dir / 'interactive-manifest.json', interactive_manifest)

    lesson_json = {
        **manifest,
        'lesson_id': graph_lesson_id,
        'sequence': runtime_sequence,
        'handout_path': f'/course-runtime/lessons/{runtime_fragment}/handout.md',
        'handout_source_path': f'course-content/runtime/lessons/{runtime_fragment}/handout.md',
        'handout_pdf_path': f'/course-runtime/lessons/{runtime_fragment}/handout.pdf',
        'handout_pdf_source_path': f'course-content/runtime/lessons/{runtime_fragment}/handout.pdf',
        'graph_overlay_path': f'/course-runtime/lessons/{runtime_fragment}/graph-overlay.json',
        'media_base_path': f'/course-runtime/lessons/{runtime_fragment}/media',
        'media_index_path': f'/course-runtime/lessons/{runtime_fragment}/media/{lesson_id}-media.md',
        'media_index_source_path': f'course-content/runtime/lessons/{runtime_fragment}/media/{lesson_id}-media.md',
        'review': review_paths,
    }
    if interactive_manifest is not None:
        lesson_json['interactive_manifest_path'] = f'/course-runtime/lessons/{runtime_fragment}/interactive-manifest.json'
        lesson_json['interactive_manifest_source_path'] = (
            f'course-content/runtime/lessons/{runtime_fragment}/interactive-manifest.json'
        )
    write_json(runtime_dir / 'lesson.json', lesson_json)


def load_combined_authoring_graph() -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    def normalize_authoring_node(node: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(node)
        chapter = normalized.get('chapter')
        if isinstance(chapter, str):
            stripped = chapter.strip()
            if stripped.isdigit():
                normalized['chapter'] = int(stripped)
        return normalized

    base_graph = read_json(AUTHORING_ROOT / 'knowledge' / 'base' / 'knowledge_graph.json')
    nodes_by_id = {
        node_id: normalize_authoring_node(node)
        for node_id, node in dict(base_graph.get('nodes', {})).items()
    }
    relation_records = read_jsonl(AUTHORING_ROOT / 'knowledge' / 'base' / 'relations.jsonl')

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
            nodes_by_id[node_id] = normalize_authoring_node(node)
        relation_records.extend(read_jsonl(lesson_dir / 'graph' / 'relations.jsonl'))

    return nodes_by_id, relation_records


def extract_primary_heading(markdown: str) -> str | None:
    match = re.search(r'^\s*#\s+(.+?)\s*$', markdown, re.MULTILINE)
    if not match:
        return None
    heading = re.sub(r'\s+', ' ', match.group(1)).strip()
    return heading or None


def copy_concepts_cards(nodes_by_id: dict[str, dict[str, Any]]) -> dict[str, str]:
    runtime_cards_concepts = RUNTIME_ROOT / 'knowledge' / 'cards' / 'concepts'
    concept_resource_by_node_id: dict[str, str] = {}
    names_to_node_ids: dict[str, list[dict[str, Any]]] = {}

    for node_id, node in nodes_by_id.items():
        names_to_node_ids.setdefault(str(node['name']), []).append({
            'id': node_id,
            'chapter': node.get('chapter'),
        })

    for concept_file in sorted(CONTENT_CONCEPTS_ROOT.glob('*.mdx')):
        content = concept_file.read_text(encoding='utf-8')
        heading = extract_primary_heading(content)
        matched_candidates = names_to_node_ids.get(heading or '', [])

        if matched_candidates:
            chosen = sorted(
                matched_candidates,
                key=lambda item: (
                    int(item['chapter']) if isinstance(item.get('chapter'), int) else 999,
                    str(item['id']),
                ),
            )[0]
            node_id = str(chosen['id'])
            destination = runtime_cards_concepts / f'{node_id}.mdx'
            destination.write_text(content, encoding='utf-8')
            concept_resource_by_node_id[node_id] = str(destination.relative_to(REPO_ROOT)).replace('\\', '/')
            continue

        destination = runtime_cards_concepts / concept_file.name
        destination.write_text(content, encoding='utf-8')

    return concept_resource_by_node_id


def export_global_knowledge() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    nodes_by_id, relation_records = load_combined_authoring_graph()
    runtime_cards_nodes = RUNTIME_ROOT / 'knowledge' / 'cards' / 'nodes'
    runtime_cards_concepts = RUNTIME_ROOT / 'knowledge' / 'cards' / 'concepts'

    reset_directory(runtime_cards_nodes)
    reset_directory(runtime_cards_concepts)
    copy_tree_contents(AUTHORING_ROOT / 'knowledge' / 'cards' / 'nodes', runtime_cards_nodes, ('.md', '.mdx'))
    concept_resource_by_node_id = copy_concepts_cards(nodes_by_id)
    runtime_relations = build_runtime_relations(nodes_by_id, relation_records)
    runtime_nodes = build_runtime_nodes(nodes_by_id, concept_resource_by_node_id)

    write_json(RUNTIME_ROOT / 'knowledge' / 'graph' / 'nodes.json', runtime_nodes)
    write_jsonl(RUNTIME_ROOT / 'knowledge' / 'graph' / 'relations.jsonl', runtime_relations)

    return runtime_nodes, runtime_relations


def resolve_lessons(args: argparse.Namespace) -> list[str]:
    if args.export_all:
        lessons: list[str] = []
        for entry in load_lesson_id_map().get('entries', []):
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
