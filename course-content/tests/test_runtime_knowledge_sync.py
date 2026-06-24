from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def load_sync_module():
    path = ROOT / '.agents' / 'skills' / 'lesson' / 'scripts' / 'sync_runtime_knowledge.py'
    spec = importlib.util.spec_from_file_location('lesson_sync_runtime_knowledge_test', path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {path}')
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def write_jsonl(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        ''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in rows),
        encoding='utf-8',
    )


def configure_paths(module, tmp_path: Path) -> None:
    course_root = tmp_path / 'course-content'
    module.COURSE_ROOT = course_root
    module.RUNTIME_KNOWLEDGE = course_root / 'runtime' / 'knowledge'
    module.AUTHORING_KNOWLEDGE = course_root / 'authoring' / 'knowledge'
    module.RUNTIME_NODES = module.RUNTIME_KNOWLEDGE / 'graph' / 'nodes.json'
    module.RUNTIME_RELS = module.RUNTIME_KNOWLEDGE / 'graph' / 'relations.jsonl'
    module.RUNTIME_CARDS = module.RUNTIME_KNOWLEDGE / 'cards'
    module.AUTHORING_GRAPH = module.AUTHORING_KNOWLEDGE / 'base' / 'knowledge_graph.json'
    module.AUTHORING_RELS = module.AUTHORING_KNOWLEDGE / 'base' / 'relations.jsonl'
    module.AUTHORING_CARDS = module.AUTHORING_KNOWLEDGE / 'cards'
    module.AUTHORING_CANONICAL_NODES = module.AUTHORING_KNOWLEDGE / 'canonical-nodes.json'
    module.AUTHORING_LESSONS = course_root / 'authoring' / 'lessons'
    module.AUTHORING_NODE_CARDS = module.AUTHORING_CARDS / 'nodes'
    module.AUTHORING_CONCEPT_CARDS = module.AUTHORING_CARDS / 'concepts'


def node_without_type() -> dict[str, object]:
    return {
        'id': 'n1',
        'name': '稳定性',
        'category': '概念性',
        'bloom_level': '理解',
        'chapter': 3,
        'chapter_name': '结构机理层',
        'definition': '判断系统响应是否保持有界。',
        'examples': [],
        'formulas': [],
        'prerequisites': [],
        'related_concepts': [],
        'difficulty': 3,
        'importance': 5,
        'keywords': ['稳定'],
    }


def runtime_node_with_type(value: str = 'C') -> dict[str, object]:
    node = node_without_type()
    metadata = dict(node)
    metadata['knowledge_type'] = value
    return {
        'id': 'n1',
        'name': node['name'],
        'description': node['definition'],
        'chapter': node['chapter'],
        'metadata': metadata,
    }


def test_safe_knowledge_type_backfill_is_not_a_conflict(tmp_path: Path) -> None:
    module = load_sync_module()
    configure_paths(module, tmp_path)

    write_json(module.RUNTIME_NODES, [runtime_node_with_type('C')])
    write_json(module.AUTHORING_GRAPH, {'nodes': {'n1': node_without_type()}})
    write_jsonl(module.RUNTIME_RELS, [])
    write_jsonl(module.AUTHORING_RELS, [])
    write_jsonl(
        module.AUTHORING_LESSONS / '3-1' / 'graph' / 'nodes.jsonl',
        [dict(node_without_type(), knowledge_type='C')],
    )

    report = module.SyncReport()
    graph, missing_nodes, missing_rels, backfills = module.compare_graph(report)

    assert report.node_conflicts == []
    assert report.node_field_backfills == [
        'n1.knowledge_type=C <- authoring/lessons/3-1/graph/nodes.jsonl',
    ]
    assert missing_nodes == []
    assert missing_rels == []

    module.apply_node_field_backfills(report, graph, backfills)

    updated = json.loads(module.AUTHORING_GRAPH.read_text(encoding='utf-8'))
    assert updated['nodes']['n1']['knowledge_type'] == 'C'


def test_conflicting_knowledge_type_sources_still_block_sync(tmp_path: Path) -> None:
    module = load_sync_module()
    configure_paths(module, tmp_path)

    write_json(module.RUNTIME_NODES, [runtime_node_with_type('C')])
    write_json(module.AUTHORING_GRAPH, {'nodes': {'n1': node_without_type()}})
    write_jsonl(module.RUNTIME_RELS, [])
    write_jsonl(module.AUTHORING_RELS, [])
    write_jsonl(
        module.AUTHORING_LESSONS / '3-1' / 'graph' / 'nodes.jsonl',
        [dict(node_without_type(), knowledge_type='C')],
    )
    card_path = module.AUTHORING_NODE_CARDS / 'n1.md'
    card_path.parent.mkdir(parents=True, exist_ok=True)
    card_path.write_text('---\nnode_id: n1\nknowledge_type: X\n---\n# 稳定性\n', encoding='utf-8')

    report = module.SyncReport()
    _, _, _, backfills = module.compare_graph(report)

    assert backfills == []
    assert report.node_field_backfills == []
    assert report.node_conflicts == ['n1']


def test_card_node_id_frontmatter_can_prove_safe_backfill(tmp_path: Path) -> None:
    module = load_sync_module()
    configure_paths(module, tmp_path)

    write_json(module.RUNTIME_NODES, [runtime_node_with_type('D')])
    write_json(module.AUTHORING_GRAPH, {'nodes': {'n1': node_without_type()}})
    write_jsonl(module.RUNTIME_RELS, [])
    write_jsonl(module.AUTHORING_RELS, [])
    card_path = module.AUTHORING_NODE_CARDS / 'different-file-name.md'
    card_path.parent.mkdir(parents=True, exist_ok=True)
    card_path.write_text('---\nnode_id: n1\nknowledge_type: D\n---\n# 稳定性\n', encoding='utf-8')

    report = module.SyncReport()
    _, _, _, backfills = module.compare_graph(report)

    assert [backfill.value for backfill in backfills] == ['D']
    assert report.node_conflicts == []
    assert report.node_field_backfills == [
        'n1.knowledge_type=D <- authoring/knowledge/cards/nodes/different-file-name.md',
    ]


def test_legacy_concept_mdx_cards_are_conflicts(tmp_path: Path) -> None:
    module = load_sync_module()
    configure_paths(module, tmp_path)

    runtime_card = module.RUNTIME_CARDS / 'concepts' / 'n1.mdx'
    runtime_card.parent.mkdir(parents=True, exist_ok=True)
    runtime_card.write_text('# Legacy card\n', encoding='utf-8')

    report = module.SyncReport()
    missing_cards = module.compare_cards(report)

    assert missing_cards == []
    assert report.missing_cards == []
    assert report.ignored_legacy_cards == []
    assert report.card_conflicts == [
        'deprecated runtime concept card must be migrated or deleted: concepts/n1.mdx -> authoring node card',
    ]


def test_legacy_concept_mdx_for_current_node_is_a_conflict(tmp_path: Path) -> None:
    module = load_sync_module()
    configure_paths(module, tmp_path)

    write_json(module.RUNTIME_NODES, [runtime_node_with_type('C')])
    runtime_card = module.RUNTIME_CARDS / 'concepts' / 'n1.mdx'
    runtime_card.parent.mkdir(parents=True, exist_ok=True)
    runtime_card.write_text('# Legacy current node card\n', encoding='utf-8')

    report = module.SyncReport()
    missing_cards = module.compare_cards(report)

    assert missing_cards == []
    assert report.missing_cards == []
    assert report.ignored_legacy_cards == []
    assert report.card_conflicts == [
        'deprecated runtime concept card must be migrated or deleted: concepts/n1.mdx -> nodes/n1.md',
    ]


def test_authoring_concept_mdx_for_registered_node_is_a_conflict(tmp_path: Path) -> None:
    module = load_sync_module()
    configure_paths(module, tmp_path)

    write_json(module.AUTHORING_GRAPH, {'nodes': {'n1': node_without_type()}})
    authoring_card = module.AUTHORING_CONCEPT_CARDS / 'n1.mdx'
    authoring_card.parent.mkdir(parents=True, exist_ok=True)
    authoring_card.write_text('# Legacy authoring concept card\n', encoding='utf-8')

    report = module.SyncReport()
    missing_cards = module.compare_cards(report)

    assert missing_cards == []
    assert report.missing_cards == []
    assert report.ignored_legacy_cards == []
    assert report.card_conflicts == [
        'deprecated authoring concept card must be migrated or deleted: concepts/n1.mdx -> nodes/n1.md',
    ]


def test_authoring_concept_mdx_for_canonical_alias_points_to_selected_card(tmp_path: Path) -> None:
    module = load_sync_module()
    configure_paths(module, tmp_path)

    write_json(module.AUTHORING_GRAPH, {'nodes': {}})
    write_json(
        module.AUTHORING_CANONICAL_NODES,
        {
            'nodes': [
                {
                    'canonical_node_id': 'n1',
                    'selected_card_node_id': 'n1',
                    'aliases': ['legacy-n1'],
                },
            ],
        },
    )
    authoring_card = module.AUTHORING_CONCEPT_CARDS / 'legacy-n1.mdx'
    authoring_card.parent.mkdir(parents=True, exist_ok=True)
    authoring_card.write_text('# Legacy alias card\n', encoding='utf-8')

    report = module.SyncReport()
    missing_cards = module.compare_cards(report)

    assert missing_cards == []
    assert report.missing_cards == []
    assert report.ignored_legacy_cards == []
    assert report.card_conflicts == [
        'deprecated authoring concept card must be migrated or deleted: concepts/legacy-n1.mdx -> nodes/n1.md',
    ]


def test_authoring_concept_mdx_without_registered_node_is_a_conflict(tmp_path: Path) -> None:
    module = load_sync_module()
    configure_paths(module, tmp_path)

    write_json(module.AUTHORING_GRAPH, {'nodes': {}})
    authoring_card = module.AUTHORING_CONCEPT_CARDS / 'orphan.mdx'
    authoring_card.parent.mkdir(parents=True, exist_ok=True)
    authoring_card.write_text('# Orphan legacy card\n', encoding='utf-8')

    report = module.SyncReport()
    missing_cards = module.compare_cards(report)

    assert missing_cards == []
    assert report.missing_cards == []
    assert report.ignored_legacy_cards == []
    assert report.card_conflicts == [
        'deprecated authoring concept card must be migrated or deleted: concepts/orphan.mdx -> delete unregistered concept card',
    ]
