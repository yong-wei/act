from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = ROOT / 'course-content' / 'scripts' / 'lesson_artifacts.py'


def load_module():
    spec = importlib.util.spec_from_file_location('lesson_artifacts', SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def main() -> None:
    artifacts = load_module()

    assert artifacts.with_lesson_prefix('2-1', 'handout.md') == '2-1-handout.md'
    assert artifacts.with_lesson_prefix('2-1', '2-1-handout.md') == '2-1-handout.md'
    assert artifacts.with_lesson_prefix('L-2b', 'handout.md') == 'L-2b-handout.md'
    assert artifacts.handout_pdf_filename('L-sum') == 'L-sum-handout.pdf'
    assert artifacts.is_handout_markdown_filename('handout.md')
    assert artifacts.is_handout_markdown_filename('2-1-handout.md')
    assert artifacts.is_handout_markdown_filename('L-2b-handout.md')
    assert artifacts.is_handout_markdown_filename('demo-4-handout.md')
    assert not artifacts.is_handout_markdown_filename('teacher-handout.md')
    assert not artifacts.is_handout_markdown_filename('2-1-teacher-handout.md')

    print('test_lesson_artifacts passed')


if __name__ == '__main__':
    main()
