from __future__ import annotations

import importlib.util
from pathlib import Path


def load_review_module():
    module_path = Path(__file__).resolve().parents[1] / 'scripts' / 'review_lesson_content.py'
    spec = importlib.util.spec_from_file_location('review_lesson_content', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


review_lesson_content = load_review_module()


def test_extract_expected_code_media_reads_storage_lines():
    multimedia_path = (
        Path(__file__).resolve().parents[1]
        / 'authoring'
        / 'lessons'
        / '2-2'
        / 'design'
        / 'multimedia.md'
    )

    expected_media = review_lesson_content.extract_expected_code_media(multimedia_path)

    assert [item['output'] for item in expected_media] == [
        '2-2-td-01-time-domain-input-response-overview.svg',
        '2-2-td-02-first-order-step-time-constant.svg',
        '2-2-td-03-second-order-response-families.svg',
        '2-2-td-04-time-domain-indices-annotated.svg',
        '2-2-td-05-example-response-with-indices.svg',
        '2-2-td-06-time-spec-to-pole-region.svg',
    ]
