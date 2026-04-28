#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[4]
COURSE_ROOT = REPO_ROOT / 'course-content'
AUTHORING_ROOT = COURSE_ROOT / 'authoring'
RUNTIME_ROOT = COURSE_ROOT / 'runtime'
INFOGRAPH_AUTHORING_ROOT = AUTHORING_ROOT / 'knowledge' / 'infographs' / 'lessons'
INFOGRAPH_RUNTIME_ROOT = RUNTIME_ROOT / 'knowledge' / 'infographs'


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    records: list[dict[str, Any]] = []
    for line in path.read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        records.append(json.loads(line))
    return records


def repo_path(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT)).replace('\\', '/')
    except ValueError:
        return path.as_posix()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def lesson_sequence_path(lesson_id: str) -> Path:
    return AUTHORING_ROOT / 'knowledge' / 'cards' / 'lessons' / lesson_id / 'sequence.json'


def lesson_manifest_path(lesson_id: str) -> Path:
    return AUTHORING_ROOT / 'lessons' / lesson_id / 'manifest.json'


def lesson_graph_nodes_path(lesson_id: str) -> Path:
    return AUTHORING_ROOT / 'lessons' / lesson_id / 'graph' / 'nodes.jsonl'


def lesson_graph_relations_path(lesson_id: str) -> Path:
    return AUTHORING_ROOT / 'lessons' / lesson_id / 'graph' / 'relations.jsonl'


def node_card_path(node_id: str) -> Path:
    return AUTHORING_ROOT / 'knowledge' / 'cards' / 'nodes' / f'{node_id}.md'


def node_infograph_dir(lesson_id: str, node_id: str) -> Path:
    return INFOGRAPH_AUTHORING_ROOT / lesson_id / 'nodes' / node_id


def node_infograph_path(lesson_id: str, node_id: str) -> Path:
    return node_infograph_dir(lesson_id, node_id) / 'infograph.png'


def parse_frontmatter(markdown: str) -> dict[str, Any]:
    if not markdown.startswith('---\n'):
        return {}
    end = markdown.find('\n---\n', 4)
    if end < 0:
        return {}
    frontmatter = markdown[4:end]
    data: dict[str, Any] = {}
    current_key: str | None = None
    for raw_line in frontmatter.splitlines():
        line = raw_line.rstrip()
        if not line:
            continue
        list_match = re.match(r'^\s*-\s+(.+?)\s*$', line)
        if list_match and current_key:
            data.setdefault(current_key, []).append(list_match.group(1).strip())
            continue
        key_match = re.match(r'^([A-Za-z0-9_\-]+):\s*(.*?)\s*$', line)
        if key_match:
            key, value = key_match.groups()
            if value:
                data[key] = value.strip()
                current_key = None
            else:
                data[key] = []
                current_key = key
    return data


def strip_frontmatter(markdown: str) -> str:
    return re.sub(r'^---\n[\s\S]*?\n---\n', '', markdown).strip()


def extract_section(markdown: str, heading: str) -> str:
    stripped = strip_frontmatter(markdown)
    escaped = re.escape(heading)
    match = re.search(rf'^##\s+{escaped}\s*$([\s\S]*?)(?=^##\s+|\Z)', stripped, re.MULTILINE)
    return match.group(1).strip() if match else ''


def load_sequence(lesson_id: str) -> dict[str, Any]:
    path = lesson_sequence_path(lesson_id)
    if not path.exists():
        raise SystemExit(f'Missing sequence: {repo_path(path)}')
    return read_json(path)


def node_group_map(sequence: dict[str, Any]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for group in sequence.get('groups', []):
        name = str(group.get('group_name') or '')
        for node_id in group.get('node_ids', []):
            groups.setdefault(str(node_id), []).append(name)
    return groups


def load_all_authoring_nodes(lesson_id: str) -> dict[str, dict[str, Any]]:
    nodes: dict[str, dict[str, Any]] = {}
    base_graph_path = AUTHORING_ROOT / 'knowledge' / 'base' / 'knowledge_graph.json'
    if base_graph_path.exists():
        payload = read_json(base_graph_path)
        for node_id, node in dict(payload.get('nodes', {})).items():
            nodes[str(node_id)] = dict(node)
    for node in read_jsonl(lesson_graph_nodes_path(lesson_id)):
        nodes[str(node['id'])] = dict(node)
    return nodes


def load_authoring_relations(lesson_id: str) -> list[dict[str, Any]]:
    return (
        read_jsonl(AUTHORING_ROOT / 'knowledge' / 'base' / 'relations.jsonl')
        + read_jsonl(lesson_graph_relations_path(lesson_id))
    )


def copy_image(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def latest_codex_image() -> Path | None:
    root = Path.home() / '.codex' / 'generated_images'
    if not root.exists():
        return None
    candidates = [
        path
        for path in root.rglob('*')
        if path.is_file() and path.suffix.lower() in {'.png', '.jpg', '.jpeg', '.webp'}
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda item: item.stat().st_mtime)

