from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / '.codex/skills/homework-problem-authoring/scripts/extract_homework_question.py'
FRAMEWORK = ROOT / 'course-content/syllabus-refactor/homework-framework.md'


def main() -> None:
    result = subprocess.run(
        [sys.executable, str(SCRIPT), '--framework', str(FRAMEWORK), '--question-id', 'T3-2'],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    payload = json.loads(result.stdout)
    assert payload['question_id'] == 'T3-2'
    assert payload['question_type'] == 'X'
    assert payload['assignment'] == 'HW3'
    assert payload['title'] == '根轨迹读图与增益迁移'
    assert payload['ability'] == '从给定根轨迹图中读取稳定边界、增益变化与动态趋势'
    assert '模块3' in payload['module_units']
    assert '根轨迹机制' in payload['question_positioning']
    assert '稳定性计算' not in payload['ability']
    assert isinstance(payload['prerequisites'], list) and payload['prerequisites']
    assert isinstance(payload['forbidden_knowledge'], list) and payload['forbidden_knowledge']
    assert isinstance(payload['stem_contract'], list) and payload['stem_contract']
    assert isinstance(payload['allowed_methods'], list) and payload['allowed_methods']
    assert isinstance(payload['scoring_anchors'], list) and payload['scoring_anchors']
    assert isinstance(payload['common_pitfalls'], list) and payload['common_pitfalls']
    assert '根轨迹图' in payload['synopsis']

    print('extract homework question test passed')


if __name__ == '__main__':
    main()
