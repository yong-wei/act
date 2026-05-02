from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HANDOUT_PATH = ROOT / 'authoring' / 'lessons' / '4-5' / 'design' / '4-5-handout.md'
DATA_SCRIPT_PATH = ROOT / 'authoring' / 'lessons' / '4-5' / 'media' / 'raw' / 'generate_constraint_data.m'
RENDER_SCRIPT_PATH = ROOT / 'authoring' / 'lessons' / '4-5' / 'media' / 'raw' / 'render_constraint_figures.py'


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def test_handout_adds_stepwise_fmincon_walkthrough_and_full_appendix_code():
    handout = read(HANDOUT_PATH)

    assert '### 6.2 `fmincon` 求解流程拆解' in handout
    assert 'x0 = [2.796; 10.0; 0.406];' in handout
    assert 'lb = [1; 4; 0.15];' in handout
    assert 'ub = [6; 15; 0.85];' in handout
    assert 'nonlcon' in handout
    assert '[x_star, fval] = fmincon' in handout
    assert '## 附录 A：客船航向保持的 `fmincon` 完整代码' in handout
    appendix = handout.split('## 附录 A：客船航向保持的 `fmincon` 完整代码', 1)[1]
    assert '```matlab' in appendix


def test_handout_adds_same_weight_comparison_and_platform_structure_case():
    handout = read(HANDOUT_PATH)

    assert '平衡权重 $B=[0.30,0.30,0.20,0.20]$' in handout
    assert '同一权重下，无约束与有约束为什么会分出两组不同解' in handout
    assert '../media/processed/4-5-ship-heading-same-weight-constraint-compare.png' in handout
    assert '| 控制器 |' not in handout
    assert '对照的三条控制器分别是' in handout
    assert '尽管在给定结构下已经找到一版最合适的参数解，但起初指定的结构就一定最合适吗？' in handout
    assert '客船航向保持' in handout
    assert '船载稳定平台' not in handout
    assert 'PID' in handout
    assert '超前结构' in handout
    assert '同一性能指标函数' in handout
    assert 'C_{PID}^\\star(s)' in handout
    assert 'C_{LL}^\\star(s)' in handout
    assert '../media/processed/4-5-ship-heading-pid-vs-leadlag-compare.png' in handout
    assert '### 6.6 一版带约束可用解' not in handout


def test_4_5_media_scripts_cover_same_weight_weight_sweep_and_platform_structure_outputs():
    data_script = read(DATA_SCRIPT_PATH)
    render_script = read(RENDER_SCRIPT_PATH)

    assert 'same_weight' in data_script
    assert 'weight_sweep' in data_script
    assert 'structure_case' in data_script
    assert '4-5-ship-heading-same-weight-constraint-compare.png' in render_script
    assert '4-5-weight-sweep-constrained-summary.png' in render_script
    assert '4-5-ship-heading-pid-vs-leadlag-compare.png' in render_script
