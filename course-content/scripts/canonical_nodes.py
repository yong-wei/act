#!/usr/bin/env python3
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
AUTHORING_ROOT = REPO_ROOT / 'course-content' / 'authoring'
CANONICAL_NODES_PATH = AUTHORING_ROOT / 'knowledge' / 'canonical-nodes.json'


class CanonicalNodeIndex:
    def __init__(self, payload: dict[str, Any] | None = None) -> None:
        self.payload = payload or {'schema_version': 1, 'nodes': []}
        self.entries_by_id: dict[str, dict[str, Any]] = {}
        self.alias_to_canonical: dict[str, str] = {}

        for raw_entry in self.payload.get('nodes', []):
            if not isinstance(raw_entry, dict):
                continue
            canonical_id = str(raw_entry.get('canonical_node_id') or '').strip()
            if not canonical_id:
                continue
            entry = dict(raw_entry)
            aliases = [
                str(alias).strip()
                for alias in entry.get('aliases', [])
                if str(alias).strip()
            ]
            entry['aliases'] = list(dict.fromkeys(aliases))
            self.entries_by_id[canonical_id] = entry
            self.alias_to_canonical[canonical_id] = canonical_id
            for alias in entry['aliases']:
                self.alias_to_canonical[alias] = canonical_id

    def canonicalize(self, node_id: str) -> str:
        return self.alias_to_canonical.get(str(node_id), str(node_id))

    def canonicalize_many(self, node_ids: list[Any]) -> list[str]:
        result: list[str] = []
        seen: set[str] = set()
        for node_id in node_ids:
            canonical_id = self.canonicalize(str(node_id))
            if canonical_id in seen:
                continue
            seen.add(canonical_id)
            result.append(canonical_id)
        return result

    def entry_for(self, node_id: str) -> dict[str, Any] | None:
        return self.entries_by_id.get(self.canonicalize(node_id))

    def selected_card_node_id(self, node_id: str) -> str:
        canonical_id = self.canonicalize(node_id)
        entry = self.entries_by_id.get(canonical_id) or {}
        selected = str(entry.get('selected_card_node_id') or canonical_id).strip()
        return selected or canonical_id

    def selected_infograph(self, node_id: str) -> dict[str, str] | None:
        entry = self.entries_by_id.get(self.canonicalize(node_id)) or {}
        value = entry.get('selected_infograph')
        if not isinstance(value, dict):
            return None
        lesson_id = str(value.get('lesson_id') or '').strip()
        source_node_id = str(value.get('node_id') or '').strip()
        if not lesson_id or not source_node_id:
            return None
        return {'lesson_id': lesson_id, 'node_id': source_node_id}

    def canonicalize_sequence(self, sequence: dict[str, Any]) -> dict[str, Any]:
        result = dict(sequence)
        result['card_order'] = self.canonicalize_many(list(sequence.get('card_order', [])))
        groups = []
        for group in sequence.get('groups', []):
            if not isinstance(group, dict):
                continue
            next_group = dict(group)
            next_group['node_ids'] = self.canonicalize_many(list(group.get('node_ids', [])))
            groups.append(next_group)
        result['groups'] = groups
        return result

    def canonicalize_manifest(self, manifest: dict[str, Any]) -> dict[str, Any]:
        result = dict(manifest)
        for key in ('focus_node_ids', 'reuse_node_ids', 'entry_nodes', 'summary_nodes', 'card_order'):
            if key in result:
                result[key] = self.canonicalize_many(list(result.get(key, [])))
        return result

    def canonicalize_relation_record(self, record: dict[str, Any]) -> dict[str, Any]:
        result = dict(record)
        for key in ('source_id', 'target_id'):
            if result.get(key):
                result[key] = self.canonicalize(str(result[key]))
        return result


@lru_cache(maxsize=1)
def load_canonical_index() -> CanonicalNodeIndex:
    if not CANONICAL_NODES_PATH.exists():
        return CanonicalNodeIndex()
    return CanonicalNodeIndex(json.loads(CANONICAL_NODES_PATH.read_text(encoding='utf-8')))
