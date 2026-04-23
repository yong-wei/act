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

import numpy as np

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / 'generated-data'
MAIN_DATA_PATH = DATA_DIR / '4-6-structure-search-data.json'
PROBE_JSON_PATH = DATA_DIR / '4-6-feedforward-probe.json'
EVALUATOR_PATH = ROOT / 'probe_feedforward_structure_search.m'

REPO_ROOT = ROOT.parents[4]
os.environ.setdefault('MPLCONFIGDIR', str(REPO_ROOT / '.cache' / 'matplotlib'))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import ticker
from PIL import Image

matplotlib.rcParams['font.family'] = 'Hiragino Sans GB'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'Arial Unicode MS', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'
warnings.filterwarnings('ignore', message=r"Font 'default' does not have a glyph for .*")
logging.getLogger('matplotlib').setLevel(logging.ERROR)

PROCESSED_DIR = ROOT.parent / 'processed'
PROBE_PLOT_PATH = PROCESSED_DIR / '4-6-ship-heading-feedforward-probe.png'


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
    return obj


def _run_octave(payload: dict[str, Any]) -> dict[str, Any]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        input_path = tmp_path / 'input.json'
        output_path = tmp_path / 'output.json'
        input_path.write_text(json.dumps(_plain(payload), ensure_ascii=False), encoding='utf-8')
        subprocess.run(
            ['octave', '-qf', str(EVALUATOR_PATH), str(input_path), str(output_path)],
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(output_path.read_text(encoding='utf-8'))


def _evaluate_feedforward_candidates(feedback_z: list[float], ff_candidates: np.ndarray, include_traces: bool = False) -> list[dict[str, Any]]:
    payload = {
        'feedback_z': feedback_z,
        'ff_candidates': np.asarray(ff_candidates, dtype=float).tolist(),
        'scenario_configs': gssd.SCENARIO_CONFIGS,
        'include_traces': include_traces,
    }
    result = _run_octave(payload)
    evaluations = result.get('evaluations', [])
    if isinstance(evaluations, dict):
        return [evaluations]
    return evaluations


def _random_candidates(rng: np.random.Generator, size: int) -> np.ndarray:
    return rng.random((size, 3))


def _jitter_candidates(rng: np.random.Generator, centers: np.ndarray, size: int, scale: float) -> np.ndarray:
    choices = centers[rng.integers(0, len(centers), size=size)]
    return np.clip(choices + rng.normal(0.0, scale, size=choices.shape), 0.0, 1.0)


def _load_baseline() -> dict[str, Any]:
    data = json.loads(MAIN_DATA_PATH.read_text(encoding='utf-8'))
    return data['destroyer_experiments']['destroyer_cost_variable_structure']


def _search_feedforward(feedback_z: list[float], seed: int = 2026) -> dict[str, Any]:
    rng = np.random.default_rng(seed)

    first = np.vstack([np.zeros((1, 3)), _random_candidates(rng, 72)])
    first_eval = _evaluate_feedforward_candidates(feedback_z, first, include_traces=False)
    ranked_first = sorted(zip(first, first_eval), key=lambda item: item[1]['cost_breakdown']['total'])
    best_vectors = np.asarray([item[0] for item in ranked_first[:8]], dtype=float)

    second = np.vstack([best_vectors, _jitter_candidates(rng, best_vectors[:4], 48, 0.12)])
    second_eval = _evaluate_feedforward_candidates(feedback_z, second, include_traces=False)
    ranked_second = sorted(zip(second, second_eval), key=lambda item: item[1]['cost_breakdown']['total'])
    best_vectors = np.asarray([item[0] for item in ranked_second[:8]], dtype=float)

    third = np.vstack([best_vectors, _jitter_candidates(rng, best_vectors[:4], 32, 0.06)])
    third_eval = _evaluate_feedforward_candidates(feedback_z, third, include_traces=False)
    ranked_third = sorted(zip(third, third_eval), key=lambda item: item[1]['cost_breakdown']['total'])

    best_ff, _ = ranked_third[0]
    exploration = np.vstack([
        np.zeros((1, 3), dtype=float),
        _random_candidates(rng, 240),
        _jitter_candidates(rng, best_vectors[:4], 60, 0.15),
    ])
    exploration_eval = _evaluate_feedforward_candidates(feedback_z, exploration, include_traces=False)
    ranked_transition = sorted(zip(exploration, exploration_eval), key=lambda item: item[1]['metrics']['transition_error'])
    aggressive_ff, _ = ranked_transition[0]
    baseline_ff = np.zeros((1, 3), dtype=float)
    baseline_eval = _evaluate_feedforward_candidates(feedback_z, baseline_ff, include_traces=True)[0]
    best_eval = _evaluate_feedforward_candidates(feedback_z, np.asarray(best_ff, dtype=float), include_traces=True)[0]
    aggressive_eval = _evaluate_feedforward_candidates(feedback_z, np.asarray(aggressive_ff, dtype=float), include_traces=True)[0]

    return {
        'seed': seed,
        'best_ff_z': _plain(best_ff),
        'baseline': baseline_eval,
        'feedforward_candidate': best_eval,
        'aggressive_transition_candidate': aggressive_eval,
        'search_progress': {
            'round_1_best_cost': float(ranked_first[0][1]['cost_breakdown']['total']),
            'round_2_best_cost': float(ranked_second[0][1]['cost_breakdown']['total']),
            'round_3_best_cost': float(ranked_third[0][1]['cost_breakdown']['total']),
            'best_transition_error_seen': float(ranked_transition[0][1]['metrics']['transition_error']),
        },
    }


def _improvement_summary(baseline: dict[str, Any], candidate: dict[str, Any]) -> dict[str, float]:
    metrics0 = baseline['metrics']
    metrics1 = candidate['metrics']
    return {
        'transition_error_delta': float(metrics0['transition_error'] - metrics1['transition_error']),
        'tracking_error_delta': float(metrics0['tracking_error'] - metrics1['tracking_error']),
        'trajectory_error_delta': float(metrics0['trajectory_error'] - metrics1['trajectory_error']),
        'u_peak_delta': float(metrics0['u_max'] - metrics1['u_max']),
        'control_energy_delta': float(metrics0['control_energy'] - metrics1['control_energy']),
        'cost_delta': float(baseline['cost_breakdown']['total'] - candidate['cost_breakdown']['total']),
    }


def _flatten_to_white(path: Path) -> None:
    image = Image.open(path).convert('RGBA')
    background = Image.new('RGBA', image.size, (255, 255, 255, 255))
    Image.alpha_composite(background, image).convert('RGB').save(path)


def _style_axis(ax: plt.Axes) -> None:
    ax.grid(True, color='#dddddd', linewidth=0.7)
    ax.set_facecolor('white')
    ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, pos: f'{x:g}'))


def _render_probe_figure(result: dict[str, Any]) -> None:
    baseline = result['baseline']
    candidate = result['aggressive_transition_candidate']

    fig, axes = plt.subplots(1, 2, figsize=(13.6, 5.5), dpi=220)
    ax_track, ax_traj = axes
    for ax in axes:
        _style_axis(ax)

    ref = baseline['time_response']['reference']
    t = np.asarray(ref['t'], dtype=float)
    r = np.asarray(ref['y'], dtype=float)
    y0 = np.asarray(baseline['time_response']['response']['y'], dtype=float)
    y1 = np.asarray(candidate['time_response']['response']['y'], dtype=float)

    ax_track.step(t, r, where='post', color='#666666', linestyle='--', linewidth=1.2, label='方波参考')
    ax_track.plot(t, y0, color='#30638e', linewidth=2.0, label='无前馈')
    ax_track.plot(t, y1, color='#d1495b', linewidth=2.0, label='激进前馈探针')
    ax_track.set_title('专用代价函数 + 变结构代表反馈解：方波跟踪对比')
    ax_track.set_xlabel('时间 / s')
    ax_track.set_ylabel('航向 / rad')
    ax_track.legend(frameon=False, fontsize=9, loc='upper right')

    expected = baseline['trajectory']['expected']
    xb = np.asarray(baseline['trajectory']['actual']['x'], dtype=float)
    yb = np.asarray(baseline['trajectory']['actual']['y'], dtype=float)
    xf = np.asarray(candidate['trajectory']['actual']['x'], dtype=float)
    yf = np.asarray(candidate['trajectory']['actual']['y'], dtype=float)
    xe = np.asarray(expected['x'], dtype=float)
    ye = np.asarray(expected['y'], dtype=float)

    ax_traj.plot(xe, ye, color='#666666', linestyle='--', linewidth=1.2, label='期望航迹')
    ax_traj.plot(xb, yb, color='#30638e', linewidth=2.0, label='无前馈')
    ax_traj.plot(xf, yf, color='#d1495b', linewidth=2.0, label='激进前馈探针')
    ax_traj.set_title('专用代价函数 + 变结构代表反馈解：航迹对比')
    ax_traj.set_xlabel('x / m')
    ax_traj.set_ylabel('y / m')
    ax_traj.set_aspect('equal', adjustable='box')
    ax_traj.legend(frameon=False, fontsize=9, loc='upper right')

    imp = result['improvement']
    fig.suptitle('加入前馈后的专用代价函数变结构方案专项验证', fontsize=15, y=0.995)
    fig.text(
        0.5,
        0.02,
        (
            f"切换段误差变化={imp['transition_error_delta']:.2f}，"
            f"航迹偏离变化={imp['trajectory_error_delta']:.2f}，"
            f"控制能量变化={imp['control_energy_delta']:.2f}。"
        ),
        ha='center',
        fontsize=9.5,
    )

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    fig.savefig(PROBE_PLOT_PATH, dpi=220, facecolor='white', bbox_inches='tight')
    plt.close(fig)
    _flatten_to_white(PROBE_PLOT_PATH)


def main() -> None:
    baseline = _load_baseline()
    result = _search_feedforward(baseline['z_best'])
    result['baseline_source'] = {
        'experiment_key': 'destroyer_cost_variable_structure',
        'structure_name': baseline['structure_name'],
        'parameters': baseline['parameters'],
        'controller_tex': baseline['controller_tex'],
    }
    result['improvement'] = _improvement_summary(result['baseline'], result['feedforward_candidate'])
    result['aggressive_improvement'] = _improvement_summary(result['baseline'], result['aggressive_transition_candidate'])
    result['notes'] = [
        'This probe keeps the current destroyer_cost_variable_structure feedback solution fixed and only searches input feedforward parameters.',
        'Improvement is judged by the same destroyer specialized cost terms, with emphasis on transition_error and trajectory_error reduction.',
        'An additional aggressive candidate is reported to show whether feedforward can improve early maneuver even when it hurts actuator limits.',
    ]

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PROBE_JSON_PATH.write_text(json.dumps(_plain(result), ensure_ascii=False, indent=2), encoding='utf-8')
    _render_probe_figure(result)

    print(json.dumps(
        {
            'baseline_cost': result['baseline']['cost_breakdown']['total'],
            'feedforward_cost': result['feedforward_candidate']['cost_breakdown']['total'],
            'improvement': result['improvement'],
            'feedforward_tex': result['feedforward_candidate']['feedforward']['feedforward_tex'],
            'aggressive_feedforward_tex': result['aggressive_transition_candidate']['feedforward']['feedforward_tex'],
            'aggressive_improvement': result['aggressive_improvement'],
            'aggressive_failed_rules': result['aggressive_transition_candidate']['screening']['failed_rules'],
        },
        ensure_ascii=False,
    ))


if __name__ == '__main__':
    main()
