#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from canonical_nodes import load_canonical_index
from knowledge_card_coverage import materialize_missing_knowledge_cards


REPO_ROOT = Path(__file__).resolve().parents[2]
AUTHORING_KNOWLEDGE = REPO_ROOT / 'course-content' / 'authoring' / 'knowledge'
BASE_GRAPH = AUTHORING_KNOWLEDGE / 'base' / 'knowledge_graph.json'
AUTHORING_CARDS = AUTHORING_KNOWLEDGE / 'cards' / 'nodes'
EXCLUSIONS = AUTHORING_KNOWLEDGE / 'card-exclusions.json'


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Materialize missing authoring cards from the base knowledge graph.',
    )
    parser.add_argument(
        '--write',
        action='store_true',
        help='Write missing cards. Without this flag the command only reports the count.',
    )
    return parser.parse_args()


def load_canonical_base_nodes() -> dict[str, dict[str, Any]]:
    graph = json.loads(BASE_GRAPH.read_text(encoding='utf-8'))
    canonical_index = load_canonical_index()
    nodes_by_id: dict[str, dict[str, Any]] = {}

    for source_node_id, value in graph.get('nodes', {}).items():
        if not isinstance(value, dict):
            continue
        canonical_id = canonical_index.canonicalize(str(source_node_id))
        node = dict(value)
        node['id'] = canonical_id
        existing = nodes_by_id.get(canonical_id)
        selected_id = canonical_index.selected_card_node_id(canonical_id)
        if existing is None or source_node_id in (canonical_id, selected_id):
            nodes_by_id[canonical_id] = node
    return nodes_by_id


def main() -> int:
    args = parse_args()
    nodes_by_id = load_canonical_base_nodes()
    canonical_index = load_canonical_index()
    missing = [
        node_id
        for node_id in sorted(nodes_by_id)
        if not (AUTHORING_CARDS / f'{canonical_index.selected_card_node_id(node_id)}.md').exists()
        and not (AUTHORING_CARDS / f'{node_id}.md').exists()
    ]
    if not args.write:
        print(json.dumps({'missing_base_cards': len(missing)}, ensure_ascii=False))
        return 1 if missing else 0

    created = materialize_missing_knowledge_cards(
        nodes_by_id,
        authoring_cards=AUTHORING_CARDS,
        exclusions_path=EXCLUSIONS,
        canonical_index=canonical_index,
        source_path='course-content/authoring/knowledge/base/knowledge_graph.json',
    )
    print(json.dumps({'created_base_cards': len(created)}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
