from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HANDOUT_PATH = ROOT / 'authoring' / 'lessons' / '4-6' / 'design' / 'handout.md'
DATA_SCRIPT_PATH = ROOT / 'authoring' / 'lessons' / '4-6' / 'media' / 'raw' / 'generate_structure_search_data.m'
RENDER_SCRIPT_PATH = ROOT / 'authoring' / 'lessons' / '4-6' / 'media' / 'raw' / 'render_structure_search_figures.py'


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def extract_between(text: str, start: str, end: str) -> str:
    return text.split(start, 1)[1].split(end, 1)[0]


def test_handout_rewrites_section_six_and_seven_for_hybrid_encoding():
    handout = read(HANDOUT_PATH)

    assert '第 27 个粒子更优' not in handout
    assert '第 15 代染色体最好' not in handout
    assert '必须坚持一个硬要求' not in handout
    assert '遗传算法' in handout
    assert 'Genetic Algorithm' in handout

    section_63 = extract_between(handout, '### 6.3', '## 七、')
    assert '粒子速度' not in section_63
    assert '个体最优' not in section_63
    assert '全局最优' not in section_63
    assert '[z_0, z_1, ..., z_5]' in section_63
    assert 'max(1, ceil(5 z_0))' in section_63
    assert 'PI + 超前' in section_63
    assert '带微分滤波的 `PID`' in section_63
    assert '0.5 -> ceil(0.5×5)=3' in handout
    assert '示例 A：' in handout
    assert '示例 B：' in handout

    assert '## 七、完整算例：航向对象上的结构-参数联合搜索' in handout
    assert '五结构编号表' in handout
    assert '多次独立随机种子' in handout
    assert 'GA 与 PSO' in handout
    assert '../media/processed/4-6-ship-heading-hybrid-search-comparison.png' in handout
    assert '../media/processed/4-6-ship-heading-hybrid-search-convergence.png' in handout


def test_handout_moves_pso_theory_to_appendix_and_keeps_reordered_tail():
    handout = read(HANDOUT_PATH)

    assert '## 八、小结' in handout
    assert '## 九、分层练习' in handout
    assert '## 附录 A：遗传算法简述' in handout
    assert '## 附录 B：粒子群优化简述' in handout
    appendix_b = handout.split('## 附录 B：粒子群优化简述', 1)[1]
    assert '粒子速度' in appendix_b
    assert '个体最优' in appendix_b
    assert '全局最优' in appendix_b


def test_4_6_media_scripts_define_required_payload_and_outputs():
    data_script = read(DATA_SCRIPT_PATH)
    render_script = read(RENDER_SCRIPT_PATH)

    for key in (
        'structure_codebook',
        'decode_examples',
        'ga_runs',
        'pso_runs',
        'selected_solution',
        'time_response',
        'frequency_response',
        'convergence_history',
    ):
        assert key in data_script

    assert '4-6-ship-heading-hybrid-search-comparison.png' in render_script
    assert '4-6-ship-heading-hybrid-search-convergence.png' in render_script
