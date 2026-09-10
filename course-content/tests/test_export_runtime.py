from __future__ import annotations

import argparse
import importlib.util
import json
from itertools import permutations
from pathlib import Path

import pytest


def load_export_module():
    module_path = Path(__file__).resolve().parents[1] / 'scripts' / 'export_runtime.py'
    spec = importlib.util.spec_from_file_location('export_runtime', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


export_runtime = load_export_module()


def test_preserve_existing_overlay_positions_by_node_id_only_assigns_new_nodes():
    previous = {
        'nodes': [
            {'id': 'node-a', 'positionX': 10.0, 'positionY': 20.0, 'positionZ': 1},
            {'id': 'node-b', 'positionX': -5.0, 'positionY': 7.5, 'positionZ': 2},
        ],
    }
    regenerated = {
        'nodes': [
            {'id': 'node-b', 'positionX': 99.0, 'positionY': 98.0, 'positionZ': 9},
            {'id': 'node-a', 'positionX': 97.0, 'positionY': 96.0, 'positionZ': 8},
            {'id': 'node-c', 'positionX': 30.0, 'positionY': 40.0, 'positionZ': 3},
        ],
    }

    export_runtime.preserve_existing_overlay_positions(regenerated, previous)

    nodes = {node['id']: node for node in regenerated['nodes']}
    assert (nodes['node-a']['positionX'], nodes['node-a']['positionY'], nodes['node-a']['positionZ']) == (10.0, 20.0, 1)
    assert (nodes['node-b']['positionX'], nodes['node-b']['positionY'], nodes['node-b']['positionZ']) == (-5.0, 7.5, 2)
    assert (nodes['node-c']['positionX'], nodes['node-c']['positionY'], nodes['node-c']['positionZ']) == (30.0, 40.0, 3)


def test_normalize_authoring_node_accepts_legacy_label_and_summary_fields():
    node = {
        'id': 'legacy-node',
        'label': '旧版节点名称',
        'summary': '旧版节点定义',
        'chapter': '1',
    }

    normalized = export_runtime.normalize_authoring_node(node)

    assert normalized['name'] == '旧版节点名称'
    assert normalized['definition'] == '旧版节点定义'
    assert normalized['chapter'] == 1


def test_build_interactive_runtime_manifest_returns_the_runtime_projection(monkeypatch):
    monkeypatch.setattr(export_runtime, 'load_interactive_contract', lambda _lesson_id: {
        'contract_version': 'v1',
        'lesson_id': '1-1',
        'steps': {},
    })

    manifest = export_runtime.build_interactive_runtime_manifest('1-1')

    assert manifest is not None
    assert manifest['lesson_id'] == '1-1'
    assert manifest['steps'] == {}


def test_content_modules_keep_a_content_block_binding(monkeypatch):
    monkeypatch.setattr(export_runtime, 'load_interactive_contract', lambda _lesson_id: {
        'contract_version': 'v1',
        'lesson_id': '5-2',
        'steps': {
            'step-13': {
                'content_blocks': {'problem': '题面', 'reveal_steps': [{'body': '步骤'}]},
                'modules': [
                    {'id': 'relay-problem', 'region': 'problem', 'kind': 'content.rich', 'payload': {'legacyKind': 'problem-statement'}},
                    {'id': 'relay-reveal', 'region': 'reveal', 'kind': 'content.reveal', 'payload': {'legacyKind': 'step-reveal-chain'}},
                ],
            },
        },
    })

    manifest = export_runtime.build_interactive_runtime_manifest('5-2')

    modules = manifest['steps']['step-13']['modules']
    assert modules[0]['payload']['block_key'] == 'problem'
    assert modules[1]['payload']['block_key'] == 'reveal_steps'


def test_synthesized_text_activity_uses_registered_response_kind(monkeypatch):
    monkeypatch.setattr(export_runtime, 'load_interactive_contract', lambda _lesson_id: {
        'contract_version': 'v1',
        'lesson_id': '5-2',
        'steps': {
            'step-13': {
                'content_blocks': {},
                'modules': [{'id': 'relay-reveal', 'kind': 'content.reveal'}],
                'interaction_spec': {
                    'interaction_kind': 'teacher_reveal_only',
                    'student_task': '随教师显影阅读求解链。',
                },
            },
        },
    })

    manifest = export_runtime.build_interactive_runtime_manifest('5-2')

    cards = manifest['steps']['step-13']['interaction_spec']['activity_cards']
    assert cards[0]['response_kind'] == 'text.short'


def test_owned_media_does_not_guess_a_content_block(monkeypatch):
    monkeypatch.setattr(export_runtime, 'load_interactive_contract', lambda _lesson_id: {
        'contract_version': 'v1',
        'lesson_id': '5-2',
        'steps': {
            'step-18': {
                'content_blocks': {'entries': ['正文']},
                'modules': [{
                    'id': 'info', 'kind': 'content.figure',
                    'payload': {'src': '/media/info.png', 'caption': '信息图'},
                }],
            },
        },
    })

    manifest = export_runtime.build_interactive_runtime_manifest('5-2')

    assert 'block_key' not in manifest['steps']['step-18']['modules'][0]['payload']


def test_export_writes_current_interactive_manifest_before_review(monkeypatch, tmp_path):
    events = []
    written_payloads = {}
    authoring = tmp_path / 'authoring'
    cards = authoring / 'cards'
    runtime = tmp_path / 'lessons' / 'x'
    cards.mkdir(parents=True)
    runtime.mkdir(parents=True)
    (authoring / 'manifest.json').write_text('{"card_order":["a"],"graph_order_policy":"manifest-reviewed-no-sequence"}')
    monkeypatch.setattr(export_runtime, 'get_authoring_lesson_dir', lambda _id: authoring)
    monkeypatch.setattr(export_runtime, 'get_authoring_cards_dir', lambda _id: cards)
    monkeypatch.setattr(export_runtime, 'get_runtime_lesson_dir', lambda _id: runtime)
    monkeypatch.setattr(export_runtime, 'RUNTIME_ROOT', tmp_path)
    monkeypatch.setattr(export_runtime, 'load_manifest', lambda _id: {'lesson_id': 'x', 'card_order': ['a']})
    monkeypatch.setattr(export_runtime, 'load_sequence', lambda _id: {})
    monkeypatch.setattr(export_runtime, 'get_mapped_target_id', lambda _id: 'x')
    monkeypatch.setattr(export_runtime, 'generate_runtime_media', lambda _id: None)
    monkeypatch.setattr(export_runtime, 'build_interactive_runtime_manifest', lambda _id: {'lesson_id': 'x', 'steps': {}})
    monkeypatch.setattr(export_runtime, 'build_graph_overlay', lambda *args: {'lesson_id': 'x', 'card_order': ['a'], 'links': []})
    def capture_write(path, payload):
        events.append(('write', path.name))
        written_payloads[path.name] = payload
    monkeypatch.setattr(export_runtime, 'write_json', capture_write)
    monkeypatch.setattr(export_runtime, 'export_review_bundle', lambda _id: events.append(('review', 'bundle')) or {})

    (authoring / 'design').mkdir()
    (authoring / 'design' / 'x-handout.md').write_text('# handout', encoding='utf-8')
    (runtime / 'x-handout.pdf').write_bytes(b'stale-pdf-without-authoring-source')

    export_runtime.export_lesson_runtime('x', [], [])

    assert events.index(('write', 'interactive-manifest.json')) < events.index(('review', 'bundle'))
    assert not (runtime / 'x-handout.pdf').exists()
    assert 'handout_pdf_path' not in written_payloads['lesson.json']
    assert 'handout_pdf_source_path' not in written_payloads['lesson.json']


def test_copy_media_assets_includes_m4a_audio(tmp_path):
    source_dir = tmp_path / 'source'
    destination_dir = tmp_path / 'dest'
    source_dir.mkdir()
    destination_dir.mkdir()

    (source_dir / 'lesson-audio.m4a').write_bytes(b'audio')
    (source_dir / 'lesson-slides.pdf').write_bytes(b'pdf')

    copied = export_runtime.copy_media_assets(source_dir, destination_dir)

    assert 'lesson-audio.m4a' in copied
    assert (destination_dir / 'lesson-audio.m4a').exists()
    assert (destination_dir / 'lesson-slides.pdf').exists()


def test_build_runtime_relations_normalizes_legacy_relation_schema():
    nodes_by_id = {
        '典型环节对象库_2_21002': {'id': '典型环节对象库_2_21002', 'name': '典型环节对象库', 'chapter': 2},
        '积分环节_2_11005': {'id': '积分环节_2_11005', 'name': '积分环节', 'chapter': 2},
    }
    legacy_record = {
        'source_id': '典型环节对象库_2_21002',
        'source_name': '典型环节对象库',
        'target_id': '积分环节_2_11005',
        'target_name': '积分环节',
        'relation': 'contains',
        'strength': 0.95,
        'run_id': '2-1',
    }

    relations = export_runtime.build_runtime_relations(nodes_by_id, [legacy_record])

    assert len(relations) == 1
    relation = relations[0]
    assert relation['relation_type'] == 'contains'
    assert relation['relation_id'].startswith('rel-')
    assert relation['relation_id'] != 'rt-0'

    repeated = export_runtime.build_runtime_relations(nodes_by_id, [legacy_record])[0]
    assert repeated['relation_id'] == relation['relation_id']


@pytest.mark.parametrize(
    ('raw_strength', 'expected_strength'),
    [
        (None, None),
        (True, None),
        (float('nan'), None),
        (float('inf'), None),
        (-0.5, -0.5),
        (0, 0.0),
        (1.0, 1.0),
    ],
)
def test_runtime_relation_strength_flows_through_overlay_revision(raw_strength, expected_strength):
    nodes_by_id = {
        'A_1': {'id': 'A_1', 'name': 'A', 'chapter': 1},
        'B_1': {'id': 'B_1', 'name': 'B', 'chapter': 1},
    }
    record = {
        'relation_id': 'strength-contract',
        'source_id': 'A_1',
        'target_id': 'B_1',
        'relation_type': 'related',
    }
    if raw_strength is not None:
        record['strength'] = raw_strength

    runtime_relations = export_runtime.build_runtime_relations(nodes_by_id, [record])
    overlay = export_runtime.build_lesson_overlay_payload(
        graph_lesson_id='strength-contract-lesson',
        manifest={'focus_node_ids': ['A_1', 'B_1']},
        sequence={},
        runtime_nodes=list(nodes_by_id.values()),
        runtime_relations=runtime_relations,
        reviewed_card_order=['A_1', 'B_1'],
    )
    revision = export_runtime.build_lesson_overlay_revision(overlay)

    assert runtime_relations[0]['strength'] == expected_strength
    assert overlay['links'][0]['strength'] == expected_strength
    assert json.loads(revision['canonicalUtf8'])['links'][0]['strength'] == expected_strength


def relation_validation_golden() -> dict:
    fixture_path = Path(__file__).parent / 'fixtures' / 'relation-validation-golden.json'
    return json.loads(fixture_path.read_text(encoding='utf-8'))


@pytest.mark.parametrize('case', relation_validation_golden()['invalidSingleRecords'], ids=lambda case: case['name'])
def test_build_runtime_relations_blocks_invalid_relation_field_contract(case):
    nodes_by_id = {
        'A_1': {'id': 'A_1', 'name': 'A', 'chapter': 1},
        'B_1': {'id': 'B_1', 'name': 'B', 'chapter': 1},
        'C_1': {'id': 'C_1', 'name': 'C', 'chapter': 1},
    }

    with pytest.raises(ValueError, match=case['pythonMessage']):
        export_runtime.build_runtime_relations(nodes_by_id, [case['record']])


def test_build_runtime_relations_blocks_duplicate_ids():
    nodes_by_id = {
        'A_1': {'id': 'A_1', 'name': 'A', 'chapter': 1},
        'B_1': {'id': 'B_1', 'name': 'B', 'chapter': 1},
        'C_1': {'id': 'C_1', 'name': 'C', 'chapter': 1},
    }

    with pytest.raises(ValueError, match='duplicate relation id: golden-duplicate'):
        export_runtime.build_runtime_relations(
            nodes_by_id,
            relation_validation_golden()['duplicateIdRecords'],
        )


@pytest.mark.parametrize('records', permutations([
    {
        'relation_id': 'dup',
        'source': 'A',
        'target': 'B',
        'relation_type': 'related',
    },
    {
        'relation_id': 'keep',
        'source_id': 'A_1',
        'target_id': 'B_1',
        'relation_type': 'related',
    },
    {
        'relation_id': 'dup',
        'source_id': 'A_1',
        'target_id': 'C_1',
        'relation_type': 'related',
    },
]))
def test_build_runtime_relations_blocks_same_id_for_explicit_and_inferred_relations(records):
    nodes_by_id = {
        'A_1': {'id': 'A_1', 'name': 'A', 'chapter': 1},
        'B_1': {'id': 'B_1', 'name': 'B', 'chapter': 1},
        'C_1': {'id': 'C_1', 'name': 'C', 'chapter': 1},
    }

    with pytest.raises(ValueError, match='duplicate relation id: dup'):
        export_runtime.build_runtime_relations(nodes_by_id, list(records))


@pytest.mark.parametrize('records', permutations([
    {
        'relation_id': 'same',
        'source_id': 'A_1',
        'target_id': 'B_1',
        'relation_type': 'related',
        'strength': 0.8,
    },
    {
        'relation_id': 'same',
        'source': 'A',
        'target': 'B',
        'relation_type': 'related',
        'strength': 0.8,
    },
    {
        'relation_id': 'first',
        'source_id': 'A_1',
        'target_id': 'C_1',
        'relation_type': 'related',
    },
]))
def test_build_runtime_relations_coalesces_same_key_duplicates_deterministically(records):
    nodes_by_id = {
        'A_1': {'id': 'A_1', 'name': 'A', 'chapter': 1},
        'B_1': {'id': 'B_1', 'name': 'B', 'chapter': 1},
        'C_1': {'id': 'C_1', 'name': 'C', 'chapter': 1},
    }

    relations = export_runtime.build_runtime_relations(nodes_by_id, list(records))

    assert [
        (relation['relation_id'], relation['source_id'], relation['target_id'])
        for relation in relations
    ] == [
        ('first', 'A_1', 'C_1'),
        ('same', 'A_1', 'B_1'),
    ]


def test_combined_authoring_graph_has_no_same_id_different_key_conflicts():
    nodes_by_id, relation_records = export_runtime.load_combined_authoring_graph()

    relations = export_runtime.build_runtime_relations(nodes_by_id, relation_records)

    assert len(relations) == len({relation['relation_id'] for relation in relations})


def test_resolve_lessons_export_all_skips_mainline_draft(monkeypatch, tmp_path):
    available_authoring = {
        '1-1': tmp_path / 'authoring' / '1-1',
        '1-2': tmp_path / 'authoring' / '1-2',
        'legacy/L-2b': tmp_path / 'authoring' / 'legacy' / 'L-2b',
    }
    for path in available_authoring.values():
        path.mkdir(parents=True)

    monkeypatch.setattr(
        export_runtime,
        'load_lesson_id_map',
        lambda: {
            'entries': [
                {'status': 'mainline', 'request_ids': ['1-1']},
                {'status': 'mainline_draft', 'request_ids': ['1-2']},
                {'status': 'legacy_source', 'request_ids': ['legacy/L-2b']},
                {'status': 'mainline', 'request_ids': ['missing']},
            ],
        },
    )
    monkeypatch.setattr(
        export_runtime,
        'get_authoring_lesson_dir',
        lambda lesson_id: available_authoring.get(lesson_id, tmp_path / 'missing' / lesson_id),
    )

    lessons = export_runtime.resolve_lessons(argparse.Namespace(export_all=True, lesson=None))

    assert lessons == ['1-1']


def test_write_if_changed_keeps_mtime_for_identical_bytes(tmp_path):
    unrelated = tmp_path / 'lessons' / '1-2' / 'lesson.json'
    changed = tmp_path / 'lessons' / '1-1' / 'lesson.json'
    export_runtime.write_json(unrelated, {'lesson_id': '1-2', 'title': 'stable'})
    export_runtime.write_json(changed, {'lesson_id': '1-1', 'title': 'before'})
    unrelated_mtime = unrelated.stat().st_mtime_ns
    changed_mtime = changed.stat().st_mtime_ns

    export_runtime.write_json(unrelated, {'lesson_id': '1-2', 'title': 'stable'})
    export_runtime.write_json(changed, {'lesson_id': '1-1', 'title': 'after'})

    assert unrelated.stat().st_mtime_ns == unrelated_mtime
    assert json.loads(changed.read_text(encoding='utf-8'))['title'] == 'after'
