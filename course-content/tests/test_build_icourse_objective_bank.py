from __future__ import annotations

import importlib.util
import json
from pathlib import Path


def load_module():
    module_path = Path(__file__).resolve().parents[1] / 'questions' / 'scripts' / 'build_icourse_objective_bank.py'
    spec = importlib.util.spec_from_file_location('build_icourse_objective_bank', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


objective_module = load_module()


def test_build_objective_bank_exports_only_objective_questions_and_replaces_formula_placeholders(tmp_path):
    repair_root = tmp_path / 'repair-pack'
    (repair_root / 'question-manifests').mkdir(parents=True)

    single_choice = {
        'question_id': 'IC-B4-0001',
        'source_question_id': 123,
        'seq': 1,
        'type_code': 1,
        'type_label': 'single',
        'question_kind': 'single',
        'choice_mode': 'single',
        'correct_answers': ['B'],
        'formulas': [
            {
                'placeholder': '[FORMULA:stem-01]',
                'hash': 'hash-stem',
                'relative_path': 'images/IC-B4-0001/stem-01.png',
                'scope': 'stem',
                'option_key': None,
            },
            {
                'placeholder': '[FORMULA:option-A-01]',
                'hash': 'hash-option-a',
                'relative_path': 'images/IC-B4-0001/option-A-01.png',
                'scope': 'option',
                'option_key': 'A',
            },
        ],
        'stem_text': '设系统传递函数为 [FORMULA:stem-01] ，则下列说法正确的是（ ）。',
        'options': [
            {'key': 'A', 'text': '[FORMULA:option-A-01] 为开环零点', 'is_correct': False},
            {'key': 'B', 'text': '系统稳定', 'is_correct': True},
        ],
    }
    essay = {
        'question_id': 'IC-B4-0002',
        'source_question_id': 456,
        'seq': 2,
        'type_code': 10,
        'type_label': 'essay',
        'question_kind': 'essay',
        'choice_mode': None,
        'correct_answers': [],
        'formulas': [],
        'stem_text': '说明系统稳定性的定义。',
        'options': [],
    }
    (repair_root / 'question-manifests' / 'IC-B4-0001.json').write_text(
        json.dumps(single_choice, ensure_ascii=False),
        encoding='utf-8',
    )
    (repair_root / 'question-manifests' / 'IC-B4-0002.json').write_text(
        json.dumps(essay, ensure_ascii=False),
        encoding='utf-8',
    )

    formula_map = {
        'hash-stem': {'text': 'G(s)=\\frac{1}{s(Ts+1)}'},
        'hash-option-a': {'text': 's=-1'},
    }
    formula_map_path = tmp_path / 'formula-map.json'
    formula_map_path.write_text(json.dumps(formula_map, ensure_ascii=False), encoding='utf-8')

    output_root = tmp_path / 'objective-bank'
    result = objective_module.build_objective_bank(
        repair_root=repair_root,
        formula_map_path=formula_map_path,
        output_root=output_root,
        bank_slug='icourse-bank-bankType4',
    )

    assert result['question_count'] == 1
    assert result['objective_question_count'] == 1
    assert result['excluded_question_count'] == 1

    jsonl_path = output_root / 'icourse-bank-bankType4.jsonl'
    assert jsonl_path.exists()
    rows = [json.loads(line) for line in jsonl_path.read_text(encoding='utf-8').splitlines() if line.strip()]
    assert len(rows) == 1
    row = rows[0]
    assert row['question_id'] == 'IC-B4-0001'
    assert row['stem'] == '设系统传递函数为 G(s)=\\frac{1}{s(Ts+1)} ，则下列说法正确的是（ ）。'
    assert row['options'][0]['text'] == 's=-1 为开环零点'
    assert row['correct_answers'] == ['B']
    assert row['question_kind'] == 'single'
    assert row['choice_mode'] == 'single'
    assert row['correct_answer_count'] == 1
    assert row['source_platform'] == 'icourse163'
    assert row['source_bank_type'] == 4
    assert row['source_bundle']['platform'] == 'icourse163'
    assert '传递函数' in row['knowledge_tags']
    assert row['search_text'].find('G(s)') >= 0

    overview = (output_root / 'icourse-bank-bankType4.overview.md').read_text(encoding='utf-8')
    assert 'IC-B4-0001' in overview
    assert 'IC-B4-0002' not in overview

    index_payload = json.loads((output_root / 'icourse-bank-bankType4.index.json').read_text(encoding='utf-8'))
    assert index_payload['question_count'] == 1
    assert index_payload['by_kind']['single'] == 1
    assert index_payload['by_choice_mode']['single'] == 1
    assert index_payload['top_tags'][0]['tag'] == '传递函数'

    errors_payload = json.loads((output_root / 'icourse-bank-bankType4.errors.json').read_text(encoding='utf-8'))
    assert errors_payload['excluded_questions'][0]['question_id'] == 'IC-B4-0002'


def test_build_objective_bank_derives_single_choice_from_answer_count(tmp_path):
    repair_root = tmp_path / 'repair-pack'
    (repair_root / 'question-manifests').mkdir(parents=True)
    payload = {
        'question_id': 'IC-B4-0021',
        'source_question_id': 789,
        'seq': 21,
        'type_code': 2,
        'type_label': 'multiple',
        'question_kind': 'multiple',
        'choice_mode': 'multiple',
        'correct_answers': ['A'],
        'formulas': [],
        'stem_text': 'U15. 下列关于带宽的说法正确的是（ ）。',
        'options': [
            {'key': 'A', 'text': '带宽增大通常会提升响应速度', 'is_correct': True},
            {'key': 'B', 'text': '带宽增大一定提升噪声抑制能力', 'is_correct': False},
        ],
    }
    (repair_root / 'question-manifests' / 'IC-B4-0021.json').write_text(
        json.dumps(payload, ensure_ascii=False),
        encoding='utf-8',
    )
    formula_map_path = tmp_path / 'formula-map.json'
    formula_map_path.write_text('{}', encoding='utf-8')

    output_root = tmp_path / 'objective-bank'
    objective_module.build_objective_bank(
        repair_root=repair_root,
        formula_map_path=formula_map_path,
        output_root=output_root,
        bank_slug='icourse-bank-bankType4',
    )

    row = json.loads((output_root / 'icourse-bank-bankType4.jsonl').read_text(encoding='utf-8').splitlines()[0])
    assert row['question_kind'] == 'single'
    assert row['choice_mode'] == 'single'
    assert '单选题' in row['knowledge_tags']
