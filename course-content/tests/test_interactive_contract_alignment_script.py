from __future__ import annotations

import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_ROOT / '.codex' / 'skills' / 'interactive-lesson-implementation' / 'scripts' / 'check_contract_alignment.py'


def test_skill_contract_alignment_script_passes_for_2_1() -> None:
    subprocess.run(
        [
            'python3',
            str(SCRIPT_PATH),
            '--lesson',
            '2-1',
        ],
        cwd=str(REPO_ROOT),
        check=True,
    )
