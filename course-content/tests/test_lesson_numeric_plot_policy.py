from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LESSON_SKILL = ROOT / '.codex' / 'skills' / 'lesson' / 'SKILL.md'
HANDOUT_REF = ROOT / '.codex' / 'skills' / 'lesson' / 'references' / 'step3-handout.md'
MULTIMEDIA_REF = ROOT / '.codex' / 'skills' / 'lesson' / 'references' / 'step7-multimedia.md'
CODEGEN_REF = ROOT / '.codex' / 'skills' / 'lesson' / 'references' / 'step7-multimedia-codegen.md'
OCTAVE_TEMPLATE = ROOT / '.codex' / 'skills' / 'lesson' / 'templates' / 'octave-design-data-template.m.tpl'
PYTHON_TEMPLATE = ROOT / '.codex' / 'skills' / 'lesson' / 'templates' / 'matplotlib-render-template.py.tpl'


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def test_lesson_skill_declares_octave_data_python_render_policy():
    skill = read(LESSON_SKILL)

    assert 'Octave 负责数值计算与导出数据' in skill
    assert 'Python/matplotlib 负责最终排版出图' in skill
    assert '3-6 单元的数值图风格为统一基线' in skill


def test_handout_reference_redirects_numeric_figures_to_multimedia_codegen_rules():
    handout = read(HANDOUT_REF)

    assert '数值类图像的最终排版必须回到 `references/step7-multimedia-codegen.md`' in handout
    assert '不得在讲义阶段另起一套与多媒体规范不一致的出图样式' in handout


def test_multimedia_references_define_shared_numeric_plot_constraints_and_templates():
    multimedia = read(MULTIMEDIA_REF)
    codegen = read(CODEGEN_REF)

    assert '数值图像统一采用“Octave 导出数据 + Python/matplotlib 最终排版”两段式流程' in multimedia
    assert '默认字体、线型、网格、颜色、留白和摘要框风格必须与 3-6 单元保持同一套基线' in codegen
    assert 'templates/octave-design-data-template.m.tpl' in codegen
    assert 'templates/matplotlib-render-template.py.tpl' in codegen
    assert OCTAVE_TEMPLATE.exists()
    assert PYTHON_TEMPLATE.exists()
