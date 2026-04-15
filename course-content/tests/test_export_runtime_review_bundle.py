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


def test_export_handout_copies_markdown_and_static_pdf(tmp_path):
    lesson_id = 'demo-2'
    authoring_lesson_dir = tmp_path / 'authoring' / 'lessons' / lesson_id
    runtime_lesson_dir = tmp_path / 'runtime' / 'lessons' / lesson_id
    design_dir = authoring_lesson_dir / 'design'

    design_dir.mkdir(parents=True)
    design_dir.joinpath('handout.md').write_text('# demo handout', encoding='utf-8')
    design_dir.joinpath('handout.pdf').write_bytes(b'%PDF-demo')

    export_runtime.get_authoring_lesson_dir = lambda _: authoring_lesson_dir
    export_runtime.get_runtime_lesson_dir = lambda _: runtime_lesson_dir
    export_runtime.RUNTIME_ROOT = tmp_path / 'runtime'

    export_runtime.export_handout(lesson_id)

    assert runtime_lesson_dir.joinpath('handout.md').read_text(encoding='utf-8') == '# demo handout'
    assert runtime_lesson_dir.joinpath('handout.pdf').read_bytes() == b'%PDF-demo'


def test_generate_runtime_media_preserves_existing_media_index(tmp_path):
    lesson_id = 'demo-3'
    authoring_lesson_dir = tmp_path / 'authoring' / 'lessons' / lesson_id
    processed_dir = authoring_lesson_dir / 'media' / 'processed'
    runtime_media_dir = tmp_path / 'runtime' / 'lessons' / lesson_id / 'media'

    processed_dir.mkdir(parents=True)
    runtime_media_dir.mkdir(parents=True)

    processed_dir.joinpath('demo-3-info.png').write_bytes(b'png')
    runtime_media_dir.joinpath('demo-3-media.md').write_text(
        '# demo-3-course.mp4\n\nhttps://example.com/course\n',
        encoding='utf-8',
    )

    export_runtime.get_authoring_lesson_dir = lambda _: authoring_lesson_dir
    export_runtime.get_runtime_lesson_dir = lambda _: tmp_path / 'runtime' / 'lessons' / lesson_id

    export_runtime.generate_runtime_media(lesson_id)

    assert runtime_media_dir.joinpath('demo-3-info.png').read_bytes() == b'png'
    assert runtime_media_dir.joinpath('demo-3-media.md').read_text(encoding='utf-8') == (
        '# demo-3-course.mp4\n\nhttps://example.com/course\n'
        '\n# demo-3-intro-video.mp4\n\n'
        '# demo-3-slides.pdf\n\n'
        '# demo-3-audio.m4a\n\n'
        '# handout.md\n'
    )
    assert processed_dir.joinpath('demo-3-media.md').read_text(encoding='utf-8') == (
        '# demo-3-course.mp4\n\nhttps://example.com/course\n'
        '\n# demo-3-intro-video.mp4\n\n'
        '# demo-3-slides.pdf\n\n'
        '# demo-3-audio.m4a\n\n'
        '# handout.md\n'
    )
