#!/usr/bin/env python3
from __future__ import annotations

import filecmp
import json
from pathlib import Path
from typing import Any

import yaml

from canonical_nodes import CanonicalNodeIndex


def _read_exclusions(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    payload = json.loads(path.read_text(encoding='utf-8'))
    if payload.get('schema_version') != 1:
        raise ValueError(f'Unsupported knowledge-card exclusion schema: {path}')

    exclusions: dict[str, str] = {}
    for item in payload.get('exclusions', []):
        node_id = str(item.get('node_id') or '').strip()
        reason = str(item.get('reason') or '').strip()
        if not node_id or not reason:
            raise ValueError(f'Knowledge-card exclusions require node_id and reason: {path}')
        if node_id in exclusions:
            raise ValueError(f'Duplicate knowledge-card exclusion: {node_id}')
        exclusions[node_id] = reason
    return exclusions


def _frontmatter(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding='utf-8')
    if not text.startswith('---\n'):
        return {}
    end = text.find('\n---\n', 4)
    if end < 0:
        return {}
    payload = yaml.safe_load(text[4:end]) or {}
    return payload if isinstance(payload, dict) else {}


def _card_paths(
    node_id: str,
    *,
    authoring_cards: Path,
    runtime_cards: Path,
    canonical_index: CanonicalNodeIndex,
) -> tuple[Path, Path]:
    selected_id = canonical_index.selected_card_node_id(node_id)
    authoring_path = authoring_cards / f'{selected_id}.md'
    if not authoring_path.exists():
        canonical_path = authoring_cards / f'{node_id}.md'
        if canonical_path.exists():
            authoring_path = canonical_path
    return authoring_path, runtime_cards / f'{node_id}.md'


def audit_knowledge_card_coverage(
    nodes_by_id: dict[str, dict[str, Any]],
    *,
    authoring_cards: Path,
    runtime_cards: Path,
    exclusions_path: Path,
    canonical_index: CanonicalNodeIndex,
    require_runtime: bool,
) -> dict[str, Any]:
    exclusions = _read_exclusions(exclusions_path)
    unknown_exclusions = sorted(set(exclusions) - set(nodes_by_id))
    if unknown_exclusions:
        raise ValueError(f'Unknown knowledge-card exclusions: {", ".join(unknown_exclusions)}')

    items: list[dict[str, Any]] = []
    counts = {
        'linked': 0,
        'missing_authoring': 0,
        'invalid_mapping_or_runtime': 0,
        'excluded': 0,
    }

    for node_id in sorted(nodes_by_id):
        node = nodes_by_id[node_id]
        authoring_path, runtime_path = _card_paths(
            node_id,
            authoring_cards=authoring_cards,
            runtime_cards=runtime_cards,
            canonical_index=canonical_index,
        )
        reasons: list[str] = []

        if node_id in exclusions:
            if authoring_path.exists() or require_runtime and runtime_path.exists():
                reasons.append('excluded-node-still-has-card')
                disposition = 'invalid_mapping_or_runtime'
            else:
                disposition = 'excluded'
                reasons.append(exclusions[node_id])
        elif not authoring_path.exists():
            disposition = 'missing_authoring'
            reasons.append('authoring-card-missing')
        else:
            frontmatter = _frontmatter(authoring_path)
            if str(frontmatter.get('node_id') or '').strip() != node_id:
                reasons.append('frontmatter-node-id-mismatch')
            if require_runtime:
                if not runtime_path.exists():
                    reasons.append('runtime-card-missing')
                elif not filecmp.cmp(authoring_path, runtime_path, shallow=False):
                    reasons.append('runtime-card-drift')
            disposition = 'invalid_mapping_or_runtime' if reasons else 'linked'

        counts[disposition] += 1
        items.append({
            'node_id': node_id,
            'node_name': str(node.get('name') or node_id),
            'disposition': disposition,
            'authoring_path': f'cards/nodes/{authoring_path.name}',
            'runtime_path': f'cards/nodes/{runtime_path.name}',
            'reasons': reasons,
        })

    return {
        'schema_version': 1,
        'summary': {'total': len(items), **counts},
        'items': items,
    }


def assert_complete_knowledge_card_coverage(report: dict[str, Any]) -> None:
    summary = report['summary']
    missing = int(summary['missing_authoring'])
    invalid = int(summary['invalid_mapping_or_runtime'])
    if missing or invalid:
        raise ValueError(
            'Knowledge-card coverage is incomplete: '
            f'missing_authoring={missing}, invalid_mapping_or_runtime={invalid}'
        )


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _render_card(node_id: str, node: dict[str, Any], source_path: str) -> str:
    name = str(node.get('name') or '').strip()
    definition = str(node.get('definition') or '').strip()
    if not name or not definition:
        raise ValueError(f'Cannot materialize knowledge card without name and definition: {node_id}')

    formulas = _string_list(node.get('formulas'))
    examples = _string_list(node.get('examples'))
    keywords = _string_list(node.get('keywords'))
    frontmatter: dict[str, Any] = {
        'node_id': node_id,
        'name': name,
    }
    for key in ('category', 'bloom_level', 'knowledge_type', 'chapter'):
        value = node.get(key)
        if value is not None and value != '':
            frontmatter[key] = value
    if keywords:
        frontmatter['tags'] = keywords
    frontmatter['card_version'] = 1
    frontmatter['source_docs'] = [source_path]

    lines = [
        '---',
        yaml.safe_dump(frontmatter, allow_unicode=True, sort_keys=False).rstrip(),
        '---',
        '',
        '## 首页',
        '',
        f'# {name}',
        '',
        f'**一句话定义**：{definition}',
    ]
    if formulas:
        lines.extend(['', '**关键公式**：'])
        for formula in formulas:
            lines.extend(['', '$$', formula, '$$'])
    lines.extend(['', '## 详情', '', '### 完整解释', '', definition])
    if examples:
        lines.extend(['', '### 典型示例', ''])
        lines.extend(f'- {example}' for example in examples)
    if keywords:
        lines.extend(['', '### 关键词', '', '、'.join(keywords)])
    return '\n'.join(lines).rstrip() + '\n'


def materialize_missing_knowledge_cards(
    nodes_by_id: dict[str, dict[str, Any]],
    *,
    authoring_cards: Path,
    exclusions_path: Path,
    canonical_index: CanonicalNodeIndex,
    source_path: str,
) -> list[Path]:
    exclusions = _read_exclusions(exclusions_path)
    authoring_cards.mkdir(parents=True, exist_ok=True)
    created: list[Path] = []

    for node_id in sorted(nodes_by_id):
        if node_id in exclusions:
            continue
        selected_id = canonical_index.selected_card_node_id(node_id)
        selected_path = authoring_cards / f'{selected_id}.md'
        canonical_path = authoring_cards / f'{node_id}.md'
        if selected_path.exists() or canonical_path.exists():
            continue
        selected_path.write_text(
            _render_card(node_id, nodes_by_id[node_id], source_path),
            encoding='utf-8',
            newline='\n',
        )
        created.append(selected_path)
    return created
