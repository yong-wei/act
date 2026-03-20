from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / '.codex/skills/homework-problem-authoring/scripts/extract_homework_question.py'
FRAMEWORK = ROOT / 'course-content/authoring/shared/homework-framework.md'


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
    assert payload['question_type'] == 'C'
    assert payload['title'] == '根轨迹基本规则应用'
    assert payload['ability'] == '手绘根轨迹草图（8条规则综合应用）'
    assert '给出开环传递函数' in payload['synopsis']

    print('extract homework question test passed')


if __name__ == '__main__':
    main()
