from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HANDOUT_PATH = ROOT / 'authoring' / 'lessons' / '4-7' / 'design' / 'handout.md'
DATA_JSON_PATH = ROOT / 'authoring' / 'lessons' / '4-7' / 'media' / 'raw' / 'generated-data' / '4-7-design-closure-data.json'
OCTAVE_SCRIPT_PATH = ROOT / 'authoring' / 'lessons' / '4-7' / 'media' / 'raw' / 'generate_design_closure_data.m'
RENDER_SCRIPT_PATH = ROOT / 'authoring' / 'lessons' / '4-7' / 'media' / 'raw' / 'render_design_closure_figures.py'
PROCESSED_DIR = ROOT / 'authoring' / 'lessons' / '4-7' / 'media' / 'processed'

EXPECTED_FIGURES = (
    '4-7-dual-scenario-task-contract.png',
    '4-7-ship-heading-design-closure-convergence.png',
    '4-7-ship-heading-final-evidence-compare.png',
    '4-7-ship-heading-final-controller-decode.png',
)

EXPECTED_JSON_KEYS = {
    'scenario_configs',
    'candidate_structures',
    'objective_contracts',
    'constraint_contracts',
    'search_runs',
    'refinement_runs',
    'decoded_controllers',
    'comparison_metrics',
    'time_response',
    'frequency_response',
    'convergence_history',
    'selected_designs',
}


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def extract_between(text: str, start: str, end: str) -> str:
    return text.split(start, 1)[1].split(end, 1)[0]


def test_handout_exists_and_uses_nine_part_closure_skeleton():
    assert HANDOUT_PATH.exists()
    handout = read(HANDOUT_PATH)

    for heading in (
        '## 一、为什么 `4-6` 的结构边界识别还不是最终设计结论',
        '## 二、课程目标',
        '## 三、双场景统一任务书：客船基线、驱逐舰机动与共用比较维度',
        '## 四、设计变量、目标函数与约束边界',
        '## 五、客船基线复核到双场景搜索：完整求解链',
        '## 六、把入选方案翻译回经典控制器职责',
        '## 七、双场景证据比较与排序变化解释',
        '## 八、最终设计结论与有限换结构边界',
        '## 九、小结与分层练习',
    ):
        assert heading in handout


def test_handout_keeps_new_boundary_and_filters_old_mouthfeel():
    handout = read(HANDOUT_PATH)

    for phrase in (
        '结构确定或编码',
        '目标构造',
        '约束建立',
        '优化求解',
        '解码解释',
        '验证比较',
        '客船航向保持',
        '驱逐舰快速机动航向控制',
        'PI',
        '超前',
        'PI + 超前',
        '滞后 + 超前',
        '带微分滤波的 `PID`',
    ):
        assert phrase in handout

    for banned in (
        '双场景比较原则课',
        '排行榜',
        '算法排行榜',
        '粒子群算法排行榜',
        '船载稳定平台',
        '横摇减摇鳍',
        '本讲',
        '下一步',
        '移交',
        '产出',
    ):
        assert banned not in handout


def test_handout_references_exact_media_outputs():
    handout = read(HANDOUT_PATH)

    for filename in EXPECTED_FIGURES:
        assert filename in handout

    section_three = extract_between(handout, '## 三、双场景统一任务书：客船基线、驱逐舰机动与共用比较维度', '## 四、设计变量、目标函数与约束边界')
    section_six = extract_between(handout, '## 六、把入选方案翻译回经典控制器职责', '## 七、双场景证据比较与排序变化解释')
    section_seven = extract_between(handout, '## 七、双场景证据比较与排序变化解释', '## 八、最终设计结论与有限换结构边界')

    assert '4-7-dual-scenario-task-contract.png' in section_three
    assert '4-7-ship-heading-final-controller-decode.png' in section_six
    assert '4-7-ship-heading-design-closure-convergence.png' in section_seven
    assert '4-7-ship-heading-final-evidence-compare.png' in section_seven


def test_data_chain_files_exist_and_match_contract():
    assert OCTAVE_SCRIPT_PATH.exists()
    assert RENDER_SCRIPT_PATH.exists()
    assert DATA_JSON_PATH.exists()

    payload = json.loads(read(DATA_JSON_PATH))
    render_script = read(RENDER_SCRIPT_PATH)
    octave_script = read(OCTAVE_SCRIPT_PATH)

    assert set(payload.keys()) == EXPECTED_JSON_KEYS
    assert 'scenario_configs' in octave_script
    assert 'selected_designs' in octave_script
    for filename in EXPECTED_FIGURES:
        assert filename in render_script


def test_json_contract_covers_dual_scenario_design_closure():
    payload = json.loads(read(DATA_JSON_PATH))

    scenario_configs = payload['scenario_configs']
    assert set(scenario_configs.keys()) == {'passenger_ship_heading_hold', 'destroyer_fast_heading_maneuver'}
    assert payload['candidate_structures'] == [
        'PI',
        '超前',
        'PI + 超前',
        '滞后 + 超前',
        '带微分滤波的 PID',
    ]

    objective_contracts = payload['objective_contracts']
    assert 'passenger_baseline_review' in objective_contracts
    assert 'destroyer_fixed_structure' in objective_contracts
    assert 'destroyer_variable_structure' in objective_contracts

    constraint_contracts = payload['constraint_contracts']
    assert 'common_hard_constraints' in constraint_contracts
    assert 'destroyer_screening' in constraint_contracts

    search_runs = payload['search_runs']
    assert 'coarse_global_search' in search_runs
    assert 'structure_shortlist_search' in search_runs

    refinement_runs = payload['refinement_runs']
    assert 'passenger_baseline_refine' in refinement_runs
    assert 'destroyer_shortlist_refine' in refinement_runs

    selected_designs = payload['selected_designs']
    assert 'passenger_baseline' in selected_designs
    assert 'destroyer_final' in selected_designs
    assert selected_designs['destroyer_final']['structure_name'] in payload['candidate_structures']


def test_generated_figures_exist_with_expected_filenames():
    for filename in EXPECTED_FIGURES:
        assert (PROCESSED_DIR / filename).exists()
