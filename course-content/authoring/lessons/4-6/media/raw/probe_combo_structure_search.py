from __future__ import annotations

import importlib.util
import json
import logging
import os
import subprocess
import tempfile
import warnings
from pathlib import Path
from typing import Any

import matplotlib
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / 'generated-data'
MAIN_DATA_PATH = DATA_DIR / '4-6-structure-search-data.json'
PROBE_JSON_PATH = DATA_DIR / '4-6-combo-structure-probe.json'
EVALUATOR_PATH = ROOT / 'probe_combo_structure_search.m'
PROCESSED_DIR = ROOT.parent / 'processed'
PROBE_PLOT_PATH = PROCESSED_DIR / '4-6-ship-heading-combo-probe.png'
CONTROL_EFFECT_PLOT_PATH = PROCESSED_DIR / '4-6-ship-heading-combo-control-effects.png'

REPO_ROOT = ROOT.parents[4]
os.environ.setdefault('MPLCONFIGDIR', str(REPO_ROOT / '.cache' / 'matplotlib'))

matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import ticker


matplotlib.rcParams['font.family'] = 'Hiragino Sans GB'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'Arial Unicode MS', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'
warnings.filterwarnings('ignore', message=r"Font 'default' does not have a glyph for .*")
logging.getLogger('matplotlib').setLevel(logging.ERROR)

GA_SEEDS = [11, 19, 37]
PSO_SEEDS = [7, 23, 41]
GA_POPULATION = 16
PSO_PARTICLES = 16
ITERATIONS = 20
DIMENSION = 13
MODULE_SEGMENT_SYMBOLS = {'S_fb': 'feedback', 'S_ff': 'feedforward', 'S_rate': 'rate_feedback'}
MODULE_CODEBOOK_KEYS = ('feedforward_codebook', 'rate_feedback_codebook')

FEEDFORWARD_CODEBOOK = [
    {
        'module_id': 1,
        'module_name': 'none',
        'description': '不启用参考前馈支路',
        'active_slots': ['z_ff0'],
        'ignored_slots': ['z_ff1', 'z_ff2', 'z_ff3'],
        'parameter_ranges': {},
        'expression': r'F_r(s)=0',
    },
    {
        'module_id': 2,
        'module_name': 'lead_ff',
        'description': '参考前馈超前环节',
        'active_slots': ['z_ff0', 'z_ff1', 'z_ff2', 'z_ff3'],
        'ignored_slots': [],
        'parameter_ranges': {'K_ff': [0.0, 1.20], 'T_p': [0.10, 2.50], 'rho': [1.20, 8.00]},
        'expression': r'F_r(s)=K_{ff}\frac{T_z s+1}{T_p s+1},\ T_z=\rho T_p',
    },
    {
        'module_id': 3,
        'module_name': 'filtered_diff_ff',
        'description': '带滤波微分型参考前馈',
        'active_slots': ['z_ff0', 'z_ff1', 'z_ff2', 'z_ff3'],
        'ignored_slots': [],
        'parameter_ranges': {'K_ff': [0.0, 1.20], 'T_d': [0.10, 4.00], 'T_f': [0.03, 0.30]},
        'expression': r'F_r(s)=K_{ff}\frac{T_d s}{T_f s+1}',
    },
]

RATE_FEEDBACK_CODEBOOK = [
    {
        'module_id': 1,
        'module_name': 'none',
        'description': '不启用测速反馈支路',
        'active_slots': ['z_rate0'],
        'ignored_slots': ['z_rate1', 'z_rate2'],
        'parameter_ranges': {},
        'expression': r'u_{rate}(s)=0',
    },
    {
        'module_id': 2,
        'module_name': 'filtered_rate',
        'description': '真实可测航向角速度支路',
        'active_slots': ['z_rate0', 'z_rate1', 'z_rate2'],
        'ignored_slots': [],
        'parameter_ranges': {'K_r': [0.0, 1.80], 'T_r': [0.02, 0.40]},
        'expression': r'u_{rate}(s)=-\frac{K_r}{T_r s+1}\dot{\psi}(s)',
    },
]


def _load_main_module():
    spec = importlib.util.spec_from_file_location('gssd', ROOT / 'generate_structure_search_data.py')
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


gssd = _load_main_module()


def _plain(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {key: _plain(value) for key, value in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_plain(value) for value in obj]
    if isinstance(obj, np.ndarray):
        return [_plain(value) for value in obj.tolist()]
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj


def _run_octave(payload: dict[str, Any]) -> dict[str, Any]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        input_path = tmp_path / 'input.json'
        output_path = tmp_path / 'output.json'
        input_path.write_text(json.dumps(_plain(payload), ensure_ascii=False), encoding='utf-8')
        subprocess.run(
            ['octave-cli', '-qf', str(EVALUATOR_PATH), str(input_path), str(output_path)],
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(output_path.read_text(encoding='utf-8'))


def _load_baseline() -> dict[str, Any]:
    data = json.loads(MAIN_DATA_PATH.read_text(encoding='utf-8'))
    baseline = data['destroyer_experiments']['destroyer_cost_variable_structure']
    return {
        'experiment_key': 'destroyer_cost_variable_structure',
        'scenario_id': 'destroyer_fast_heading_maneuver',
        'cost_mode': 'destroyer',
        'feedback_z': list(baseline['z_best']),
        'baseline_vector': list(baseline['z_best']) + [0.0] * 7,
        'structure_name': baseline['structure_name'],
        'parameters': baseline['parameters'],
        'controller_tex': baseline['controller_tex'],
    }


def _solution_label(snapshot: dict[str, Any]) -> str:
    modules = snapshot['modules']
    return (
        f"{modules['feedback']['module_name']} + "
        f"{modules['feedforward']['module_name']} + {modules['rate_feedback']['module_name']}"
    )


def _flatten_to_white(path: Path) -> None:
    image = Image.open(path).convert('RGBA')
    background = Image.new('RGBA', image.size, (255, 255, 255, 255))
    Image.alpha_composite(background, image).convert('RGB').save(path)


def _style_axis(ax: plt.Axes) -> None:
    ax.grid(True, color='#dddddd', linewidth=0.7)
    ax.set_facecolor('white')
    ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, pos: f'{x:g}'))


def _render_probe_figure(baseline: dict[str, Any], selected: dict[str, Any]) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(13.6, 5.5), dpi=220)
    ax_track, ax_traj = axes
    for ax in axes:
        _style_axis(ax)

    ref = baseline['time_response']['reference']
    t = np.asarray(ref['t'], dtype=float)
    r = np.asarray(ref['y'], dtype=float)
    y0 = np.asarray(baseline['time_response']['response']['y'], dtype=float)
    y1 = np.asarray(selected['time_response']['response']['y'], dtype=float)
    ax_track.step(t, r, where='post', color='#666666', linestyle='--', linewidth=1.2, label='方波参考')
    ax_track.plot(t, y0, color='#30638e', linewidth=2.0, label='当前反馈代表解')
    ax_track.plot(t, y1, color='#d1495b', linewidth=2.0, label='最优可行组合')
    ax_track.set_title('方波跟踪：基线 vs 组合结构专项最优解')
    ax_track.set_xlabel('时间 / s')
    ax_track.set_ylabel('航向 / rad')
    ax_track.legend(frameon=False, fontsize=9, loc='upper right')

    expected = baseline['trajectory']['expected']
    xe = np.asarray(expected['x'], dtype=float)
    ye = np.asarray(expected['y'], dtype=float)
    xb = np.asarray(baseline['trajectory']['actual']['x'], dtype=float)
    yb = np.asarray(baseline['trajectory']['actual']['y'], dtype=float)
    xc = np.asarray(selected['trajectory']['actual']['x'], dtype=float)
    yc = np.asarray(selected['trajectory']['actual']['y'], dtype=float)
    ax_traj.plot(xe, ye, color='#666666', linestyle='--', linewidth=1.2, label='期望航迹')
    ax_traj.plot(xb, yb, color='#30638e', linewidth=2.0, label='当前反馈代表解')
    ax_traj.plot(xc, yc, color='#d1495b', linewidth=2.0, label='最优可行组合')
    ax_traj.set_title('航迹比较：基线 vs 组合结构专项最优解')
    ax_traj.set_xlabel('x / m')
    ax_traj.set_ylabel('y / m')
    ax_traj.set_aspect('equal', adjustable='box')
    ax_traj.legend(frameon=False, fontsize=9, loc='upper right')

    comparison = selected['comparison_to_baseline']
    fig.suptitle('驱逐舰专用代价函数下的组合结构专项验证', fontsize=15, y=0.995)
    fig.text(
        0.5,
        0.02,
        (
            f"最优可行组合={_solution_label(selected)}；"
            f"总代价变化={comparison['total_cost_delta']:.3f}，"
            f"切换段误差比={comparison['transition_error_ratio']:.3f}，"
            f"航迹误差比={comparison['trajectory_error_ratio']:.3f}"
        ),
        ha='center',
        fontsize=9.2,
    )
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    fig.savefig(PROBE_PLOT_PATH, dpi=220, facecolor='white', bbox_inches='tight')
    plt.close(fig)
    _flatten_to_white(PROBE_PLOT_PATH)


def _render_control_effect_figure(baseline: dict[str, Any], selected: dict[str, Any]) -> None:
    fig, axes = plt.subplots(3, 1, figsize=(12.8, 10.5), dpi=220, sharex=True)
    ax_total, ax_branch, ax_rate = axes
    for ax in axes:
        _style_axis(ax)

    baseline_control = baseline['time_response']['control']
    selected_time = selected['time_response']
    t = np.asarray(baseline_control['t'], dtype=float)
    u0 = np.asarray(baseline_control['y'], dtype=float)
    u1 = np.asarray(selected_time['control']['y'], dtype=float)

    ax_total.plot(t, u0, color='#30638e', linewidth=2.0, label='当前反馈代表解总控制量')
    ax_total.plot(t, u1, color='#d1495b', linewidth=2.0, label='组合结构候选总控制量')
    ax_total.set_title('总控制量时程：基线 vs 组合结构候选')
    ax_total.set_ylabel('u(t)')
    ax_total.legend(frameon=False, fontsize=9, loc='upper right')

    u_fb = np.asarray(selected_time['feedback_branch']['y'], dtype=float)
    u_ff = np.asarray(selected_time['feedforward_branch']['y'], dtype=float)
    u_rate = np.asarray(selected_time['rate_branch']['y'], dtype=float)
    ax_branch.plot(t, u_fb, color='#2a9d8f', linewidth=1.8, label='反馈主通道')
    ax_branch.plot(t, u_ff, color='#e9c46a', linewidth=1.8, label='参考前馈模块')
    ax_branch.plot(t, u_rate, color='#7b2cbf', linewidth=1.8, label='测速反馈模块')
    ax_branch.plot(t, u1, color='#222222', linewidth=1.2, linestyle='--', label='组合后总控制量')
    ax_branch.set_title('组合结构候选的支路分工')
    ax_branch.set_ylabel('branch u(t)')
    ax_branch.legend(frameon=False, fontsize=9, ncol=4, loc='upper right')

    heading_rate = np.asarray(selected_time['heading_rate']['y'], dtype=float)
    ax_rate.plot(t, heading_rate, color='#264653', linewidth=2.0, label='组合结构候选航向角速度')
    ax_rate.set_title('航向角速度响应')
    ax_rate.set_xlabel('时间 / s')
    ax_rate.set_ylabel(r'$\dot{\psi}(t)$')
    ax_rate.legend(frameon=False, fontsize=9, loc='upper right')

    metrics = selected['comparison_to_baseline']
    fig.suptitle('组合结构专项验证的控制效果曲线', fontsize=15, y=0.995)
    fig.text(
        0.5,
        0.015,
        (
            f"总代价比={metrics['total_cost_ratio']:.3f}，"
            f"切换段误差比={metrics['transition_error_ratio']:.3f}，"
            f"航迹误差比={metrics['trajectory_error_ratio']:.3f}。"
        ),
        ha='center',
        fontsize=9.5,
    )
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    fig.savefig(CONTROL_EFFECT_PLOT_PATH, dpi=220, facecolor='white', bbox_inches='tight')
    plt.close(fig)
    _flatten_to_white(CONTROL_EFFECT_PLOT_PATH)


def main() -> None:
    baseline = _load_baseline()
    search_config = {
        'candidate_dim': DIMENSION,
        'module_segment_symbols': MODULE_SEGMENT_SYMBOLS,
        'encoding_segments': {'feedback': 6, 'feedforward': 4, 'rate_feedback': 3},
        'ga': {'population': GA_POPULATION, 'generations': ITERATIONS, 'seeds': GA_SEEDS},
        'pso': {'particles': PSO_PARTICLES, 'iters': ITERATIONS, 'seeds': PSO_SEEDS},
        'baseline_injected': True,
    }
    raw_result = _run_octave(
        {
            'scenario_configs': gssd.SCENARIO_CONFIGS,
            'scenario_id': 'destroyer_fast_heading_maneuver',
            'cost_mode': 'destroyer',
            'baseline_vector': baseline['baseline_vector'],
            'search_config': search_config,
        }
    )
    payload = {
        'baseline_source': baseline,
        'scenario_id': 'destroyer_fast_heading_maneuver',
        'cost_mode': 'destroyer',
        'module_codebooks': {
            'feedback': gssd.STRUCTURE_CODEBOOK,
            'feedforward': FEEDFORWARD_CODEBOOK,
            'rate_feedback': RATE_FEEDBACK_CODEBOOK,
        },
        'search_config': search_config,
        'ga_runs': raw_result['ga_runs'],
        'pso_runs': raw_result['pso_runs'],
        'selected_solution': raw_result['selected_solution'],
        'best_transition_candidate': raw_result['best_transition_candidate'],
        'promotion_decision': raw_result['promotion_decision'],
        'comparison_to_baseline': raw_result['comparison_to_baseline'],
    }
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PROBE_JSON_PATH.write_text(json.dumps(_plain(payload), ensure_ascii=False, indent=2), encoding='utf-8')
    _render_probe_figure(raw_result['baseline_evaluation'], raw_result['selected_solution'])
    _render_control_effect_figure(raw_result['baseline_evaluation'], raw_result['selected_solution'])


if __name__ == '__main__':
    main()
