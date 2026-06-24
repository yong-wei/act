from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SKILL = ROOT / '.agents' / 'skills' / 'homework' / 'SKILL.md'
CONTRACT = ROOT / '.agents' / 'skills' / 'homework' / 'references' / 'output-contract.md'


def main() -> None:
    skill_text = SKILL.read_text(encoding='utf-8')
    contract_text = CONTRACT.read_text(encoding='utf-8')

    assert 'inline_score_points' in skill_text
    assert 'inline_score_points' in contract_text
    assert 'rubric' in skill_text
    assert 'rubric' in contract_text
    assert 'question_score' in skill_text
    assert 'assignment_score_policy' in skill_text
    assert 'question_score' in contract_text
    assert '并存' in skill_text or '与 `rubric` 并存' in skill_text

    print('homework authoring score points test passed')


if __name__ == '__main__':
    main()
