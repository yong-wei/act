from __future__ import annotations

import importlib.util
import json
from pathlib import Path


def load_module():
    module_path = Path(__file__).resolve().parents[1] / 'questions' / 'scripts' / 'prepare_icourse_question_bank_repair.py'
    spec = importlib.util.spec_from_file_location('prepare_icourse_question_bank_repair', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


repair_module = load_module()


def test_prepare_repair_pack_downloads_unique_formula_images_and_writes_drafts(tmp_path):
    export_path = tmp_path / 'icourse-export.json'
    export_path.write_text(
        json.dumps(
            {
                'exportedAt': '2026-03-28T00:00:00Z',
                'source': {
                    'termId': '1467340477',
                    'bankType': '4',
                    'pageSize': 20,
                    'totalPages': 1,
                    'totalCount': 1,
                    'csrfKey': 'demo',
                },
                'questions': [
                    {
                        'seq': 1,
                        'id': 123,
                        'typeCode': 2,
                        'typeLabel': 'multiple',
                        'plainTextTitle': 'U6.设【图片】，则下列说法正确的是（ ）。',
                        'titleHtml': '<p>U6.设<img src="https://example.com/formula-a.png">，则下列说法正确的是（ ）。</p>',
                        'analyse': '',
                        'duration': 5,
                        'options': [
                            {
                                'key': 'A',
                                'contentHtml': '<p><img src="https://example.com/formula-a.png">成立</p>',
                                'answer': True,
                                'analyse': '',
                            },
                            {
                                'key': 'B',
                                'contentHtml': '<p><img src="https://example.com/formula-b.png">不成立</p>',
                                'answer': False,
                                'analyse': '',
                            },
                        ],
                    }
                ],
            },
            ensure_ascii=False,
        ),
        encoding='utf-8',
    )

    payload_by_url = {
        'https://example.com/formula-a.png': b'formula-a',
        'https://example.com/formula-b.png': b'formula-b',
    }

    def fake_download(url: str) -> bytes:
        return payload_by_url[url]

    output_root = tmp_path / 'repair-pack'
    result = repair_module.build_repair_pack(
        input_path=export_path,
        output_root=output_root,
        image_fetcher=fake_download,
    )

    manifest = result['manifest']
    assert manifest['question_count'] == 1
    assert manifest['downloaded_formula_count'] == 2
    assert manifest['questions_with_formulas'] == 1

    draft_path = output_root / 'drafts' / 'IC-B4-0001.md'
    assert draft_path.exists()
    draft = draft_path.read_text(encoding='utf-8')
    assert '[FORMULA:stem-01]' in draft
    assert '[FORMULA:option-A-01]' in draft
    assert '[FORMULA:option-B-01]' in draft
    assert '正确答案：A' in draft

    manifest_path = output_root / 'manifest.json'
    assert manifest_path.exists()

    formula_a = output_root / 'images' / 'IC-B4-0001' / 'stem-01.png'
    formula_b = output_root / 'images' / 'IC-B4-0001' / 'option-B-01.png'
    assert formula_a.read_bytes() == b'formula-a'
    assert formula_b.read_bytes() == b'formula-b'

    question_manifest = json.loads((output_root / 'question-manifests' / 'IC-B4-0001.json').read_text(encoding='utf-8'))
    assert question_manifest['choice_mode'] == 'multiple'
    assert question_manifest['correct_answers'] == ['A']
    assert question_manifest['formulas'][0]['placeholder'] == '[FORMULA:stem-01]'


def test_prepare_repair_pack_marks_non_choice_questions_without_fake_single_choice(tmp_path):
    export_path = tmp_path / 'icourse-export.json'
    export_path.write_text(
        json.dumps(
            {
                'exportedAt': '2026-03-28T00:00:00Z',
                'source': {
                    'termId': '1467340477',
                    'bankType': '4',
                    'pageSize': 20,
                    'totalPages': 1,
                    'totalCount': 1,
                    'csrfKey': 'demo',
                },
                'questions': [
                    {
                        'seq': 1,
                        'id': 456,
                        'typeCode': 10,
                        'typeLabel': 'essay',
                        'plainTextTitle': '说明某控制系统的稳定性判据。',
                        'titleHtml': '<p>说明某控制系统的稳定性判据。</p>',
                        'analyse': '',
                        'duration': 5,
                        'options': [],
                    }
                ],
            },
            ensure_ascii=False,
        ),
        encoding='utf-8',
    )

    output_root = tmp_path / 'repair-pack'
    repair_module.build_repair_pack(
        input_path=export_path,
        output_root=output_root,
        image_fetcher=lambda url: b'',
    )

    draft = (output_root / 'drafts' / 'IC-B4-0001.md').read_text(encoding='utf-8')
    assert '主观题' in draft
    assert '平台未提供结构化正确答案' in draft

    question_manifest = json.loads((output_root / 'question-manifests' / 'IC-B4-0001.json').read_text(encoding='utf-8'))
    assert question_manifest['question_kind'] == 'essay'
    assert question_manifest['choice_mode'] is None
    assert question_manifest['correct_answers'] == []
