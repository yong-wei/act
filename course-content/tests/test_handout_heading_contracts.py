from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LESSON_SKILL = ROOT / '.agents' / 'skills' / 'lesson' / 'SKILL.md'
HANDOUT_REF = ROOT / '.agents' / 'skills' / 'lesson' / 'references' / 'step3-handout.md'
REFINE_SKILL = ROOT / '.agents' / 'skills' / 'refine' / 'SKILL.md'


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def test_lesson_title_contract_is_declared_in_skill_and_handout_reference():
    lesson_skill = read(LESSON_SKILL)
    handout_ref = read(HANDOUT_REF)

    assert '标题必须直接概括对象、方法、比较关系或归纳后的知识点' in lesson_skill
    assert '标题 = 知识骨架' in lesson_skill

    assert '禁止问题式标题、口号式标题、纯课次/场景代号标题' in handout_ref
    assert '仅看各级标题，应能还原本单元的知识骨架' in handout_ref
    assert '正文可以使用问题引导，但问题不进入标题' in handout_ref


def test_refine_skill_limits_heading_edits_to_bounded_structure_repairs():
    refine_skill = read(REFINE_SKILL)

    assert '允许有限结构修正' in refine_skill
    assert '可改标题，并在同层相邻章节逻辑断裂时合并或重排' in refine_skill
    assert '不得新增单元外知识' in refine_skill
    assert '不得改公式/图表/核心数据' in refine_skill
    assert '若缺的是整块知识结构，仍回退 `lesson` 重写' in refine_skill
