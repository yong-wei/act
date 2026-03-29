from __future__ import annotations

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


def test_build_runtime_relations_rejects_duplicate_ids_for_different_relations():
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

    try:
        export_runtime.build_runtime_relations(nodes_by_id, conflicting_records)
    except ValueError as exc:
        assert 'duplicate relation_id' in str(exc)
    else:
        raise AssertionError('expected duplicate relation_id conflict to raise ValueError')
