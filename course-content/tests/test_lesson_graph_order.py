from __future__ import annotations

import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

from lesson_graph_order import (  # noqa: E402
    RELATION_CONTRACTS,
    build_lesson_overlay_payload,
    build_lesson_overlay_revision,
    build_overlay_revision,
    normalize_overlay_links,
    resolve_authoring_card_order,
)


@pytest.mark.parametrize('relation_type', [
    'causes', 'demonstrates', 'equivalent_to', 'exemplifies', 'extends', 'has_stage',
    'precedes', 'produces', 'provides_context', 'refined_by', 'refines',
])
def test_zero_instance_relation_contracts_are_associations(relation_type: str):
    assert RELATION_CONTRACTS[relation_type]['family'] == 'association'
    assert RELATION_CONTRACTS[relation_type]['direction'] == 'unordered'
    assert RELATION_CONTRACTS[relation_type]['label']
    assert RELATION_CONTRACTS[relation_type]['source_sentence']
    assert RELATION_CONTRACTS[relation_type]['target_sentence']


def test_equivalent_to_contract_limits_equivalence_to_declared_conditions():
    contract = RELATION_CONTRACTS['equivalent_to']
    assert '已声明模型与条件下' in contract['source_sentence']
    assert '已声明模型与条件下' in contract['target_sentence']


def test_sequence_is_authoritative_and_manifest_must_match_exactly(tmp_path: Path):
    sequence_path = tmp_path / 'sequence.json'
    manifest_path = tmp_path / 'manifest.json'
    sequence_path.write_text(json.dumps({'card_order': ['a', 'b']}), encoding='utf-8')
    manifest_path.write_text(json.dumps({'card_order': ['a', 'b']}), encoding='utf-8')

    assert resolve_authoring_card_order(sequence_path, manifest_path) == ['a', 'b']

    manifest_path.write_text(json.dumps({'card_order': ['b', 'a']}), encoding='utf-8')
    with pytest.raises(ValueError, match='must exactly match'):
        resolve_authoring_card_order(sequence_path, manifest_path)


def test_sequence_forbids_policy_and_manifest_only_requires_exact_policy(tmp_path: Path):
    sequence_path = tmp_path / 'sequence.json'
    manifest_path = tmp_path / 'manifest.json'
    sequence_path.write_text(json.dumps({'card_order': ['a']}), encoding='utf-8')
    manifest_path.write_text(json.dumps({
        'card_order': ['a'],
        'graph_order_policy': 'manifest-reviewed-no-sequence',
    }), encoding='utf-8')
    with pytest.raises(ValueError, match='forbidden'):
        resolve_authoring_card_order(sequence_path, manifest_path)

    sequence_path.unlink()
    assert resolve_authoring_card_order(sequence_path, manifest_path) == ['a']
    manifest_path.write_text(json.dumps({'card_order': ['a']}), encoding='utf-8')
    with pytest.raises(ValueError, match='graph_order_policy'):
        resolve_authoring_card_order(sequence_path, manifest_path)


def test_python_overlay_revision_matches_shared_golden_vectors():
    root = Path(__file__).resolve().parents[2]
    fixture = json.loads(
        (root / 'course-content/contracts/knowledge-lesson-overlay-golden.json').read_text(encoding='utf-8')
    )

    for vector in fixture['vectors']:
        revision = build_overlay_revision(vector['input'])
        assert revision['canonicalUtf8'] == vector['canonicalUtf8']
        assert revision['sha256'] == vector['sha256']

    for vector in fixture['invalidVectors']:
        with pytest.raises(ValueError, match='relationId'):
            normalize_overlay_links(vector['links'])


def test_shared_lesson_overlay_payload_filters_relations_by_reviewed_lesson_nodes():
    payload = build_lesson_overlay_payload(
        graph_lesson_id='4-2',
        manifest={'title': 'test', 'focus_node_ids': ['a'], 'card_order': ['a', 'b']},
        sequence={'groups': []},
        runtime_nodes=[{'id': 'a'}, {'id': 'b'}, {'id': 'outside'}],
        runtime_relations=[
            {'relation_id': 'inside', 'source_id': 'a', 'target_id': 'b', 'relation_type': 'leads_to', 'strength': 0.2},
            {'relation_id': 'outside', 'source_id': 'a', 'target_id': 'outside', 'relation_type': 'leads_to', 'strength': 0.9},
        ],
        reviewed_card_order=['a', 'b'],
    )

    assert [link['id'] for link in payload['links']] == ['inside']
    assert build_lesson_overlay_revision(payload)['sha256'] == build_overlay_revision({
        'lessonId': '4-2', 'cardOrder': payload['card_order'], 'links': payload['links'],
    })['sha256']


def test_current_reconciled_lessons_use_exact_sequence_order():
    root = Path(__file__).resolve().parents[2]
    for lesson_id in ('1-1', '4-2', '5-2'):
        resolved = resolve_authoring_card_order(
            root / f'course-content/authoring/knowledge/cards/lessons/{lesson_id}/sequence.json',
            root / f'course-content/authoring/lessons/{lesson_id}/manifest.json',
        )
        runtime_overlay = json.loads(
            (root / f'course-content/runtime/lessons/{lesson_id}/graph-overlay.json').read_text(encoding='utf-8')
        )
        assert runtime_overlay['card_order'] == resolved
