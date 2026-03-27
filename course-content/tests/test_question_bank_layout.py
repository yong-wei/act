from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
QUESTION_ROOT = ROOT / 'course-content' / 'questions'


def test_question_bank_directories_and_schema_exist() -> None:
    required_dirs = [
        QUESTION_ROOT / 'source',
        QUESTION_ROOT / 'questions',
        QUESTION_ROOT / 'assets',
        QUESTION_ROOT / 'indexes',
        QUESTION_ROOT / 'reports',
        QUESTION_ROOT / 'schemas',
        QUESTION_ROOT / 'scripts',
    ]

    for path in required_dirs:
        assert path.exists(), f'missing directory: {path}'

    question_schema = QUESTION_ROOT / 'schemas' / 'question.schema.json'
    index_schema = QUESTION_ROOT / 'schemas' / 'index-entry.schema.json'
    assert question_schema.exists(), 'missing question schema'
    assert index_schema.exists(), 'missing index entry schema'

    payload = json.loads(question_schema.read_text(encoding='utf-8'))
    properties = payload.get('properties', {})
    for key in [
        'question_id',
        'source_ref',
        'chapter',
        'stem_md',
        'solution_md',
        'inline_score_points',
        'rubric',
        'figure_references',
        'figure_status',
        'formula_status',
        'usage_status',
    ]:
        assert key in properties, f'missing schema property: {key}'
