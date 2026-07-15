from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path


def load_export_module():
    module_path = Path(__file__).resolve().parents[1] / 'scripts' / 'export_runtime.py'
    spec = importlib.util.spec_from_file_location('export_runtime', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


export_runtime = load_export_module()


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
    monkeypatch.setattr(export_runtime, 'export_handout', lambda _id: None)
    monkeypatch.setattr(export_runtime, 'generate_runtime_media', lambda _id: None)
    monkeypatch.setattr(export_runtime, 'build_interactive_runtime_manifest', lambda _id: {'lesson_id': 'x', 'steps': {}})
    monkeypatch.setattr(export_runtime, 'build_graph_overlay', lambda *args: {'lesson_id': 'x', 'card_order': ['a'], 'links': []})
    monkeypatch.setattr(export_runtime, 'write_json', lambda path, payload: events.append(('write', path.name)))
    monkeypatch.setattr(export_runtime, 'export_review_bundle', lambda _id: events.append(('review', 'bundle')) or {})

    export_runtime.export_lesson_runtime('x', [], [])

    assert events.index(('write', 'interactive-manifest.json')) < events.index(('review', 'bundle'))


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


def test_build_runtime_relations_rewrites_duplicate_ids_for_different_relations():
    nodes_by_id = {
        'A_1': {'id': 'A_1', 'name': 'A', 'chapter': 1},
        'B_1': {'id': 'B_1', 'name': 'B', 'chapter': 1},
        'C_1': {'id': 'C_1', 'name': 'C', 'chapter': 1},
    }
    conflicting_records = [
        {
            'relation_id': 'rt-1',
            'source_id': 'A_1',
            'target_id': 'B_1',
            'relation_type': 'related',
            'strength': 0.9,
        },
        {
            'relation_id': 'rt-1',
            'source_id': 'A_1',
            'target_id': 'C_1',
            'relation_type': 'related',
            'strength': 0.9,
        },
    ]

    relations = export_runtime.build_runtime_relations(nodes_by_id, conflicting_records)

    assert len(relations) == 2
    relation_ids = {relation['relation_id'] for relation in relations}
    assert 'rt-1' in relation_ids
    assert len(relation_ids) == 2


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
