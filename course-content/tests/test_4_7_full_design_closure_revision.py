from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HANDOUT_PATH = ROOT / 'authoring' / 'lessons' / '4-7' / 'design' / 'handout.md'
DATA_JSON_PATH = ROOT / 'authoring' / 'lessons' / '4-7' / 'media' / 'raw' / 'generated-data' / '4-7-design-closure-data.json'
OCTAVE_SCRIPT_PATH = ROOT / 'authoring' / 'lessons' / '4-7' / 'media' / 'raw' / 'generate_design_closure_data.m'
RENDER_SCRIPT_PATH = ROOT / 'authoring' / 'lessons' / '4-7' / 'media' / 'raw' / 'render_design_closure_figures.py'
PROCESSED_DIR = ROOT / 'authoring' / 'lessons' / '4-7' / 'media' / 'processed'

EXPECTED_GENERATED_FIGURES = (
    '4-7-real-heading-control-task.png',
    '4-7-switching-error-definition.png',
    '4-7-design-decision-ladder.png',
    '4-7-passenger-baseline-response.png',
    '4-7-passenger-baseline-bode.png',
    '4-7-direct-transfer-to-destroyer.png',
    '4-7-fixed-lead-optimization-convergence.png',
    '4-7-mixed-structure-search-shortlist.png',
    '4-7-final-controller-role-decode.png',
    '4-7-final-nominal-switching-response.png',
    '4-7-robustness-response-family.png',
    '4-7-noise-discrete-rudder-response.png',
    '4-7-anti-windup-comparison.png',
    '4-7-real-scenario-interpretation.png',
)

EXPECTED_HANDOUT_FIGURES = (
    '4-7-segmented-identification-block.png',
    '4-7-real-heading-control-task.png',
    '4-7-final-controller-role-decode.png',
    '4-7-real-scenario-interpretation.png',
)

EXPECTED_HIFI_REPORT_FIGURES = (
    '4-7-rudder-actuator-step-identification.png',
    '4-7-hull-yaw-step-identification.png',
    '4-7-disturbance-step-identification.png',
    '4-7-controller-pi_lead-switching20s-calm.png',
    '4-7-controller-pi_lead-circle-calm.png',
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
    'robustness_family',
    'implementation_stress',
    'convergence_history',
    'selected_designs',
}


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def extract_between(text: str, start: str, end: str) -> str:
    return text.split(start, 1)[1].split(end, 1)[0]


def test_handout_exists_and_uses_preserved_seven_chapter_structure():
    assert HANDOUT_PATH.exists()
    handout = read(HANDOUT_PATH)

    for heading in (
        '## 一、真实航迹任务与分段辨识模型结构',
        '## 二、分段辨识与参数确定',
        '## 三、实际指标到代价函数',
        '## 四、控制器设计与优化对比',
        '## 五、扰动影响、适用边界与模块 5 展望',
        '## 六、练习',
    ):
        assert heading in handout


def test_handout_keeps_new_boundary_and_filters_old_mouthfeel():
    handout = read(HANDOUT_PATH)

    for phrase in (
        'zig-zag 航线',
        '方波期望航向',
        '回转运动',
        '斜坡期望航向',
        '舵机惯性',
        '船体惯性',
        '扰动等效惯性',
        '$T_r$',
        '$T_h$',
        '$K_h$',
        '$T_d$',
        '$K_d$',
        '阶跃输入',
        '高保真模型',
        '辨识模型',
        '实际指标',
        '代价函数',
        '硬约束',
        '主目标',
        '次目标',
        '诊断指标',
        '舵角越界',
        '舵速越界',
        '饱和时间',
        '航迹偏离',
        '稳定裕度不足',
        '传统设计在辨识模型',
        '传统设计放到高保真模型',
        '基于辨识模型的优化设计在辨识模型',
        '基于辨识模型的优化设计放到高保真模型',
        '基于高保真模型的优化设计放到高保真模型',
        '横荡',
        '局部流速',
        '舵效',
        '模块 5',
        '更强模型表达',
        'PI',
        '超前',
        'PI + 超前',
        '滞后 + 超前',
        '带微分滤波的 $PID$',
    ):
        assert phrase in handout

    for banned in (
        'placeholder-4-7',
        '待填',
        '待仿真',
        '待判定',
        '占位说明',
        '补充生成',
        '旧稿',
        '本轮',
        '正文揭晓',
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
        '暂不回写讲义',
    ):
        assert banned not in handout


def test_handout_references_exact_media_outputs_and_report_figures():
    handout = read(HANDOUT_PATH)

    for filename in EXPECTED_HANDOUT_FIGURES:
        assert filename in handout
    for filename in EXPECTED_HIFI_REPORT_FIGURES:
        assert filename in handout

    assert '../media/processed/4-7-cover-comic.png' in handout
    assert '../media/processed/4-7-info.png' in handout

    section_one = extract_between(handout, '## 一、真实航迹任务与分段辨识模型结构', '## 二、分段辨识与参数确定')
    section_two = extract_between(handout, '## 二、分段辨识与参数确定', '## 三、实际指标到代价函数')
    section_four = extract_between(handout, '## 四、控制器设计与优化对比', '## 五、扰动影响、适用边界与模块 5 展望')

    assert '4-7-segmented-identification-block.png' in section_one
    assert '4-7-real-heading-control-task.png' in section_one
    assert '4-7-rudder-actuator-step-identification.png' in section_two
    assert '4-7-hull-yaw-step-identification.png' in section_two
    assert '4-7-disturbance-step-identification.png' in section_two
    assert '4-7-controller-pi_lead-switching20s-calm.png' in section_four
    assert '4-7-controller-pi_lead-circle-calm.png' in section_four
    assert '4-7-final-controller-role-decode.png' in section_four


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
    assert 'robustness_family' in octave_script
    assert 'implementation_stress' in octave_script
    for filename in EXPECTED_GENERATED_FIGURES:
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

    comparison_metrics = payload['comparison_metrics']
    assert 'destroyer_direct_transfer' in comparison_metrics
    assert comparison_metrics['destroyer_fixed_structure']['screening']['passed'] is False
    assert comparison_metrics['destroyer_final']['screening']['passed'] is True

    assert payload['robustness_family']['samples']
    assert 'noise_discrete' in payload['implementation_stress']
    assert 'anti_windup' in payload['implementation_stress']


def test_generated_figures_exist_with_expected_filenames():
    assert (PROCESSED_DIR / '4-7-segmented-identification-block.png').exists()
    for filename in EXPECTED_GENERATED_FIGURES:
        assert (PROCESSED_DIR / filename).exists()
