from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HANDOUT_PATH = ROOT / 'authoring' / 'lessons' / '4-6' / 'design' / 'handout.md'
RENDER_SCRIPT_PATH = ROOT / 'authoring' / 'lessons' / '4-6' / 'media' / 'raw' / 'render_structure_search_figures.py'
DATA_JSON_PATH = ROOT / 'authoring' / 'lessons' / '4-6' / 'media' / 'raw' / 'generated-data' / '4-6-structure-search-data.json'
FEEDFORWARD_PROBE_SCRIPT_PATH = ROOT / 'authoring' / 'lessons' / '4-6' / 'media' / 'raw' / 'probe_feedforward_structure_search.py'


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def extract_between(text: str, start: str, end: str) -> str:
    return text.split(start, 1)[1].split(end, 1)[0]


def test_handout_uses_new_heading_contract_and_section_skeleton():
    handout = read(HANDOUT_PATH)

    for heading in (
        '## 一、迁移场景中的任务重排',
        '## 二、课程目标',
        '## 三、客船与驱逐舰航向任务的固定结构比较',
        '### 3.1 客船航向保持的固定结构可用解',
        '### 3.2 驱逐舰快速机动任务的对象与约束',
        '### 3.3 固定结构迁移后的失配信号',
        '### 3.4 目标重排与固定结构可用域收缩',
        '## 四、结构编码与混合编码搜索',
        '### 4.1 结构搜索的引入条件',
        '### 4.2 五类控制结构的统一编码',
        '### 4.3 混合编码问题的求解入口',
        '## 五、驱逐舰上的四类方案比较',
        '## 六、小结',
        '## 七、分层练习',
    ):
        assert heading in handout

    for old_heading in (
        '## 一、问题引入：为什么场景一变，原来那版“可用解”还要重新审视',
        '## 三、场景 A 回收：`4-5` 的固定结构可用解到底解决了什么',
        '## 四、场景 B 的任务为什么不是“把原参数再调一轮”',
        '## 五、固定结构优化何时开始失效',
        '## 六、结构编码与混合编码求解',
        '### 6.2 结构编码到底回答什么',
        '### 6.3 如何求解混合编码问题',
        '## 五、双对象验证：固定结构迁移与跨结构搜索',
        '为什么场景一变',
        '到底解决了什么',
        '何时开始失效',
    ):
        assert old_heading not in handout


def test_handout_adds_destroyer_square_wave_experiment_and_four_way_comparison():
    handout = read(HANDOUT_PATH)
    section_33 = extract_between(handout, '### 3.3 固定结构迁移后的失配信号', '### 3.4 目标重排与固定结构可用域收缩')
    section_34 = extract_between(handout, '### 3.4 目标重排与固定结构可用域收缩', '## 四、结构编码与混合编码搜索')
    section_five = extract_between(handout, '## 五、驱逐舰上的四类方案比较', '## 六、小结')

    assert '客船代价函数' in section_33
    assert '固定超前结构' in section_33
    assert '重新搜索参数' in section_33
    assert '20s' in section_33
    assert '方波' in section_33
    assert '期望航迹' in section_33
    assert '实际航迹' in section_33
    assert '航速保持固定' in section_33
    assert 'A=[0.40,0.30,0.20,0.10]' not in section_33
    assert 'C=[0.20,0.25,0.25,0.30]' not in section_33
    assert '客船所有的代价函数不可行' not in section_33

    assert '客船所有的代价函数不可行' in section_34
    assert '控制器结构是不是也应该进行质疑' in section_34
    assert '驱逐舰专用代价函数' in section_34
    for phrase in (
        '切换段误差',
        '全程跟踪误差',
        '航迹偏离',
        '峰值动作',
        '控制能量',
        'E_{\\mathrm{trans}}',
        'E_{\\psi}',
        'E_{\\mathrm{traj}}',
    ):
        assert phrase in section_34

    assert '驱逐舰采用客船代价函数但是固定结构' in section_five
    assert '驱逐舰采用客船代价函数但是变结构搜索' in section_five
    assert '驱逐舰采用专用代价函数但是固定结构' in section_five
    assert '驱逐舰采用专用代价函数和变结构搜索' in section_five
    assert '4-6-ship-heading-hybrid-search-comparison.png' in section_five
    assert '4-6-ship-heading-hybrid-search-convergence.png' in section_five
    assert '组合结构专项验证' in section_five
    assert '反馈主通道' in section_five
    assert '参考前馈模块' in section_five
    assert '测速反馈模块' in section_five
    assert '不能直接升级为第五章四类主方案比较中的正式主证据' in section_five
    assert 'PI + 超前 + lead_ff + filtered_rate' in section_five
    assert '总代价压到当前基线的 `0.991` 倍' in section_five
    assert '优化器并不理解“哪些边界是教师或工程师主观指定的筛选线”' in section_five
    assert '软约束缝隙继续下降' in section_five
    assert '越线但综合收益明显更高' in section_five
    assert '4-6-ship-heading-combo-control-effects.png' in section_five
    assert 'u(s)=C_{fb}(s)(r(s)-\\psi(s))+F_r(s)r(s)-H_r(s)\\dot{\\psi}(s)' in section_five
    assert 'F_r(s)=0' in section_five
    assert 'H_r(s)=\\frac{0}{0.02s+1}=0' in section_five
    assert '实际落地后仍等价于“只有反馈主通道在工作”的 `PI + 超前` 控制器' in section_five
    assert '前馈支路和测速反馈支路几乎贴着零线' in section_five
    assert '航向角速度曲线' in section_five
    assert '客船基线' not in section_five
    assert '驱逐舰固定结构迁移' not in section_five


def test_4_6_generated_json_exposes_destroyer_four_experiment_contract():
    data_json = json.loads(read(DATA_JSON_PATH))
    render_script = read(RENDER_SCRIPT_PATH)

    for key in (
        'scenario_configs',
        'destroyer_experiments',
        'structure_codebook',
        'ga_runs',
        'pso_runs',
        'selected_solution',
        'time_response',
        'frequency_response',
        'convergence_history',
    ):
        assert key in data_json

    scenario_configs = data_json['scenario_configs']
    assert 'passenger_ship_heading_hold' in scenario_configs
    assert 'destroyer_fast_heading_maneuver' in scenario_configs
    destroyer_config = scenario_configs['destroyer_fast_heading_maneuver']
    assert destroyer_config['time']['stop'] == 120.0
    assert destroyer_config['mission_profile'] == [
        {'time': 0.0, 'value': 1.0},
        {'time': 20.0, 'value': 0.0},
        {'time': 40.0, 'value': 1.0},
        {'time': 60.0, 'value': 0.0},
        {'time': 80.0, 'value': 1.0},
        {'time': 100.0, 'value': 0.0},
    ]

    experiments = data_json['destroyer_experiments']
    for key in (
        'passenger_cost_fixed_structure',
        'passenger_cost_variable_structure',
        'destroyer_cost_fixed_structure',
        'destroyer_cost_variable_structure',
    ):
        assert key in experiments
        assert experiments[key]['search_mode']
        assert experiments[key]['trajectory']['expected']
        assert experiments[key]['trajectory']['actual']

    assert experiments['passenger_cost_fixed_structure']['cost_family'] == 'passenger'
    assert experiments['passenger_cost_fixed_structure']['search_mode'] == 'fixed_structure'
    assert experiments['passenger_cost_variable_structure']['search_mode'] == 'variable_structure'
    assert experiments['destroyer_cost_fixed_structure']['cost_family'] == 'destroyer'
    assert experiments['destroyer_cost_variable_structure']['search_mode'] == 'variable_structure'

    assert data_json['search_config']['ga']['num_generations'] == 20
    assert data_json['search_config']['pso']['iters'] == 20
    assert data_json['selected_solution']['scenario'] == 'destroyer_fast_heading_maneuver'

    assert '4-6-ship-heading-hybrid-search-comparison.png' in render_script
    assert '4-6-ship-heading-hybrid-search-convergence.png' in render_script
    assert '方波' in render_script or 'trajectory' in render_script


def test_handout_decoding_section_makes_parameter_ranges_and_mapping_explicit():
    handout = read(HANDOUT_PATH)
    section_42 = extract_between(handout, '### 4.2 五类控制结构的统一编码', '### 4.3 混合编码问题的求解入口')

    assert '参数允许范围' in section_42
    assert '归一化编码如何映射到这些范围内' in section_42
    assert '有效参数槽位' in section_42
    assert '忽略槽位' in section_42
    assert '逐槽映射' in section_42
    assert '控制器表达式' in section_42
    assert 'PI' in section_42
    assert '滞后 + 超前' in section_42
    assert '| 结构编号 | 结构名称 | 有效参数槽位 | 忽略槽位 | 参数允许范围 | 逐槽映射 | 控制器表达式 |' not in section_42
    assert '结构 1：`PI`' in section_42
    assert '结构 5：带微分滤波的 `PID`' in section_42


def test_destroyer_comparison_chapter_no_longer_uses_passenger_baseline_as_main_axis():
    handout = read(HANDOUT_PATH)
    section_five = extract_between(handout, '## 五、驱逐舰上的四类方案比较', '## 六、小结')

    assert '客船基线' not in section_five
    assert '驱逐舰采用客船代价函数但是固定结构' in section_five
    assert '驱逐舰采用客船代价函数但是变结构搜索' in section_five
    assert '驱逐舰采用专用代价函数但是固定结构' in section_five
    assert '驱逐舰采用专用代价函数和变结构搜索' in section_five
    assert '四类方案' in section_five
    assert '驱逐舰对象上的结构-参数搜索' not in section_five


def test_feedforward_probe_script_exists_for_destroyer_specialized_variable_structure():
    assert FEEDFORWARD_PROBE_SCRIPT_PATH.exists()
    script = read(FEEDFORWARD_PROBE_SCRIPT_PATH)

    assert '前馈' in script or 'feedforward' in script
    assert 'destroyer_cost_variable_structure' in script or '专用代价函数' in script
    assert 'improvement' in script or '提升' in script
