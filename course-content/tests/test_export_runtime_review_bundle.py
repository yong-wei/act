from __future__ import annotations

import importlib.util
from pathlib import Path


def load_export_runtime_module():
    module_path = Path(__file__).resolve().parents[1] / 'scripts' / 'export_runtime.py'
    spec = importlib.util.spec_from_file_location('export_runtime', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


export_runtime = load_export_runtime_module()


def test_export_review_bundle_exposes_interactive_page_check_path(tmp_path):
    lesson_id = 'demo-1'
    authoring_lesson_dir = tmp_path / 'authoring' / 'lessons' / lesson_id
    runtime_lesson_dir = tmp_path / 'runtime' / 'lessons' / lesson_id
    review_dir = runtime_lesson_dir / 'review'

    (authoring_lesson_dir / 'design').mkdir(parents=True)
    review_dir.mkdir(parents=True)

    (authoring_lesson_dir / 'design' / 'boppps.md').write_text('# demo', encoding='utf-8')
    (review_dir / 'review-report.md').write_text('# report', encoding='utf-8')
    (review_dir / 'knowledge-card-check.json').write_text('{}', encoding='utf-8')
    (review_dir / 'multimedia-check.json').write_text('{}', encoding='utf-8')
    (review_dir / 'source-manifest.json').write_text('{}', encoding='utf-8')
    (review_dir / 'interactive-page-check.json').write_text('{}', encoding='utf-8')

    export_runtime.get_authoring_lesson_dir = lambda _: authoring_lesson_dir
    export_runtime.get_runtime_lesson_dir = lambda _: runtime_lesson_dir
    export_runtime.RUNTIME_ROOT = tmp_path / 'runtime'

    review_paths = export_runtime.export_review_bundle(lesson_id)

    assert review_paths['interactive_page_check_path'] == '/course-runtime/lessons/demo-1/review/interactive-page-check.json'
