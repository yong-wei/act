from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


def load_prepare_module():
    script_dir = Path(__file__).resolve().parents[2] / '.agents' / 'skills' / 'infograph' / 'scripts'
    sys.path.insert(0, str(script_dir))
    module_path = script_dir / 'prepare_infograph_source.py'
    spec = importlib.util.spec_from_file_location('prepare_infograph_source', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


prepare_infograph_source = load_prepare_module()


def test_relation_summary_keeps_ids_and_readable_names_separate():
    relation = {
        'source_id': '反馈_1_1',
        'source': '反馈',
        'target_id': '闭环控制_1_1',
        'target': '闭环控制',
        'relation_type': 'enables',
    }

    summary = prepare_infograph_source.relation_summary(relation, '反馈_1_1')

    assert summary['source_id'] == '反馈_1_1'
    assert summary['source'] == '反馈'
    assert summary['target_id'] == '闭环控制_1_1'
    assert summary['target'] == '闭环控制'
    assert summary['direction_for_node'] == 'outgoing'


def test_build_prompt_uses_lesson_id_from_source():
    source = {
        'lesson': {'lesson_id': '3-6', 'title': '测试课次'},
        'node': {
            'id': '测试节点_3_6',
            'name': '测试节点',
            'definition': '测试定义',
            'formulas': [],
            'keywords': ['测试'],
        },
        'groups': ['测试分组'],
        'relations': [],
        'core_intuition': '测试直觉',
    }

    prompt = prepare_infograph_source.build_prompt(source)

    assert '自动控制原理 3-6' in prompt
    assert '自动控制原理 1-1' not in prompt


def test_non_1_1_feedback_prompt_does_not_use_1_1_visual_context():
    source = {
        'lesson': {'lesson_id': '3-6', 'title': '测试课次'},
        'node': {
            'id': '反馈_3_6',
            'name': '反馈',
            'definition': '测试定义',
            'formulas': [],
            'keywords': ['反馈'],
        },
        'groups': ['测试分组'],
        'relations': [],
        'core_intuition': '测试直觉',
    }

    prompt = prepare_infograph_source.build_prompt(source)

    assert '船舶航向' not in prompt
    assert '反馈思想到控制全景' not in prompt


def test_prompt_keeps_non_readable_relation_ids_without_1_1_suffix_rewrite():
    source = {
        'lesson': {'lesson_id': '3-6', 'title': '测试课次'},
        'node': {
            'id': '反馈_3_6',
            'name': '反馈',
            'definition': '测试定义',
            'formulas': [],
            'keywords': ['反馈'],
        },
        'groups': ['测试分组'],
        'relations': [
            {
                'source_id': '反馈_1_1',
                'target_id': '闭环控制_1_1',
                'relation': 'enables',
            }
        ],
        'core_intuition': '测试直觉',
    }

    prompt = prepare_infograph_source.build_prompt(source)

    assert '反馈_1_1 --支持--> 闭环控制_1_1' in prompt
