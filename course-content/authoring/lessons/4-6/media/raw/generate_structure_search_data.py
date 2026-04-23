from __future__ import annotations

import json
import statistics
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import numpy as np


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / 'generated-data'
OUTPUT_PATH = DATA_DIR / '4-6-structure-search-data.json'
EVALUATOR_PATH = ROOT / 'generate_structure_search_data.m'

GA_SEEDS = [11]
PSO_SEEDS = [7]
GA_POPULATION = 8
PSO_PARTICLES = 8
ITERATIONS = 20

SCENARIO_CONFIGS = {
    'passenger_ship_heading_hold': {
        'id': 'passenger_ship_heading_hold',
        'label': '客船航向保持',
        'derived_from': None,
        'plant': {'gain': 0.01715, 'slow_pole': 0.10, 'fast_pole': 2.14375},
        'actuator': {'u_peak_limit': 7.00, 'control_energy_limit': 235.0},
        'time': {'start': 0.0, 'stop': 120.0, 'step': 0.1},
        'mission_profile': [{'time': 0.0, 'value': 1.0}],
        'initial_step': {'target': 1.0, 'segment_end': 120.0},
        'trajectory_speed': 1.0,
        'screening': {
            'M_r_max': 1.30,
            'tail_segment_error_max': 0.10,
            'trajectory_error_max': 30.0,
            'transition_error_max': 4.0,
        },
    },
    'destroyer_fast_heading_maneuver': {
        'id': 'destroyer_fast_heading_maneuver',
        'label': '驱逐舰快速机动航向控制',
        'derived_from': 'passenger_ship_heading_hold',
        'plant': {'gain': 0.0216, 'slow_pole': 0.16, 'fast_pole': 2.85},
        'actuator': {'u_peak_limit': 7.10, 'control_energy_limit': 950.0},
        'time': {'start': 0.0, 'stop': 120.0, 'step': 0.1},
        'mission_profile': [
            {'time': 0.0, 'value': 1.0},
            {'time': 20.0, 'value': 0.0},
            {'time': 40.0, 'value': 1.0},
            {'time': 60.0, 'value': 0.0},
            {'time': 80.0, 'value': 1.0},
            {'time': 100.0, 'value': 0.0},
        ],
        'initial_step': {'target': 1.0, 'segment_end': 20.0},
        'trajectory_speed': 1.0,
        'screening': {
            'M_r_max': 1.25,
            'tail_segment_error_max': 0.24,
            'trajectory_error_max': 500.0,
            'transition_error_max': 18.0,
        },
    },
}

COST_MODES = {
    'passenger_A': {'family': 'passenger', 'variant': 'A', 'label': '客船代价函数 A'},
    'passenger_B': {'family': 'passenger', 'variant': 'B', 'label': '客船代价函数 B'},
    'passenger_C': {'family': 'passenger', 'variant': 'C', 'label': '客船代价函数 C'},
    'destroyer': {'family': 'destroyer', 'variant': 'D', 'label': '驱逐舰专用代价函数'},
}

STRUCTURE_CODEBOOK = [
    {
        'id': 1,
        'name': 'PI',
        'description': '补低频增益与稳态误差消除',
        'active_slots': ['z_1', 'z_2'],
        'ignored_slots': ['z_3', 'z_4', 'z_5'],
        'parameter_ranges': {'K': [0.90, 2.20], 'T_i': [8.00, 28.00]},
        'slot_mapping': {
            'z_1': 'K = 0.90 + 1.30 z_1',
            'z_2': 'T_i = 8.00 + 20.00 z_2',
        },
        'controller_expression': r'C(s)=K\frac{T_i s+1}{T_i s}',
    },
    {
        'id': 2,
        'name': '超前',
        'description': '提升速度与相位裕度',
        'active_slots': ['z_1', 'z_2', 'z_3'],
        'ignored_slots': ['z_4', 'z_5'],
        'parameter_ranges': {'K': [1.00, 2.73], 'T_z': [8.00, 17.585], 'T_p': [4.00, 7.33]},
        'slot_mapping': {
            'z_1': 'K = 1.00 + 1.73 z_1',
            'z_2': 'T_z = 8.00 + 9.585 z_2',
            'z_3': 'T_p = 4.00 + 3.33 z_3',
        },
        'controller_expression': r'C(s)=K\frac{T_z s+1}{T_p s+1}',
    },
    {
        'id': 3,
        'name': 'PI + 超前',
        'description': '同时重分配低频跟踪与中频动态',
        'active_slots': ['z_1', 'z_2', 'z_3', 'z_4'],
        'ignored_slots': ['z_5'],
        'parameter_ranges': {'K': [1.00, 2.20], 'T_i': [6.00, 48.00], 'T_z': [5.00, 22.00], 'T_p': [1.80, 6.00]},
        'slot_mapping': {
            'z_1': 'K = 1.00 + 1.20 z_1',
            'z_2': 'T_i = 6.00 + 42.00 z_2',
            'z_3': 'T_z = 5.00 + 17.00 z_3',
            'z_4': 'T_p = 1.80 + 4.20 z_4',
        },
        'controller_expression': r'C(s)=K\frac{T_i s+1}{T_i s}\frac{T_z s+1}{T_p s+1}',
    },
    {
        'id': 4,
        'name': '滞后 + 超前',
        'description': '重新分配低频整形、机动速度与动作边界',
        'active_slots': ['z_1', 'z_2', 'z_3', 'z_4', 'z_5'],
        'ignored_slots': [],
        'parameter_ranges': {
            'K': [0.90, 2.10],
            'T_lag': [6.00, 18.00],
            'beta': [0.65, 0.96],
            'T_lead': [6.00, 18.00],
            'T_p': [2.50, 6.20],
        },
        'slot_mapping': {
            'z_1': 'K = 0.90 + 1.20 z_1',
            'z_2': 'T_lag = 6.00 + 12.00 z_2',
            'z_3': 'beta = 0.65 + 0.31 z_3',
            'z_4': 'T_lead = 6.00 + 12.00 z_4',
            'z_5': 'T_p = 2.50 + 3.70 z_5',
        },
        'controller_expression': r'C(s)=K\frac{\beta T_{lag}s+1}{T_{lag}s+1}\frac{T_{lead}s+1}{T_p s+1}',
    },
    {
        'id': 5,
        'name': '带微分滤波的 PID',
        'description': '用积分、比例和滤波微分共同塑造过程',
        'active_slots': ['z_1', 'z_2', 'z_3', 'z_4'],
        'ignored_slots': ['z_5'],
        'parameter_ranges': {'K_p': [0.90, 2.50], 'T_i': [8.00, 22.00], 'T_d': [0.50, 3.80], 'T_f': [0.04, 0.20]},
        'slot_mapping': {
            'z_1': 'K_p = 0.90 + 1.60 z_1',
            'z_2': 'T_i = 8.00 + 14.00 z_2',
            'z_3': 'T_d = 0.50 + 3.30 z_3',
            'z_4': 'T_f = 0.04 + 0.16 z_4',
        },
        'controller_expression': r'C(s)=K_p\left(1+\frac{1}{T_i s}+\frac{T_d s}{T_f s+1}\right)',
    },
]

DECODE_EXAMPLE_VECTORS = [
    {'label': '示例 A', 'z': [0.50, 0.28, 0.93, 0.78, 0.16, 0.62]},
    {'label': '示例 B', 'z': [0.33, 0.44, 0.82, 0.18, 0.91, 0.73]},
]

EXPERIMENT_METADATA = {
    'passenger_cost_fixed_structure': {
        'label': '驱逐舰采用客船代价函数但是固定结构',
        'search_mode': 'fixed_structure',
        'cost_mode': 'passenger_B',
        'notes': ['代表实验沿用客船平衡权重 B，并把结构固定为超前结构。'],
    },
    'passenger_cost_variable_structure': {
        'label': '驱逐舰采用客船代价函数但是变结构搜索',
        'search_mode': 'variable_structure',
        'cost_mode': 'passenger_B',
        'notes': ['结构可变，但总代价仍沿用客船平衡权重 B。'],
    },
    'destroyer_cost_fixed_structure': {
        'label': '驱逐舰采用专用代价函数但是固定结构',
        'search_mode': 'fixed_structure',
        'cost_mode': 'destroyer',
        'notes': ['代价函数已切到驱逐舰任务，但结构仍固定为超前结构。'],
    },
    'destroyer_cost_variable_structure': {
        'label': '驱逐舰采用专用代价函数和变结构搜索',
        'search_mode': 'variable_structure',
        'cost_mode': 'destroyer',
        'notes': ['结构与参数同时搜索，是本课最终采用的代表方案。'],
    },
}


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
            ['octave', '-qf', str(EVALUATOR_PATH), str(input_path), str(output_path)],
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(output_path.read_text(encoding='utf-8'))


class OctaveBatchEvaluator:
    def __init__(self, scenario_id: str, cost_mode: str) -> None:
        self.scenario_id = scenario_id
        self.cost_mode = cost_mode

    def evaluate(self, candidates: np.ndarray, include_traces: bool = False) -> list[dict[str, Any]]:
        candidate_array = np.asarray(candidates, dtype=float)
        if candidate_array.ndim == 1:
            candidate_array = candidate_array.reshape(1, -1)
        payload = {
            'candidates': candidate_array.tolist(),
            'scenario_configs': SCENARIO_CONFIGS,
            'scenario_id': self.scenario_id,
            'cost_mode': self.cost_mode,
            'include_traces': include_traces,
        }
        result = _run_octave(payload)
        evaluations = result.get('evaluations', [])
        if isinstance(evaluations, dict):
            return [evaluations]
        return evaluations


def _mean_history(runs: list[dict[str, Any]]) -> list[float]:
    max_len = max(len(run['best_per_iteration']) for run in runs)
    padded: list[list[float]] = []
    for run in runs:
        series = list(run['best_per_iteration'])
        if len(series) < max_len:
            series.extend([series[-1]] * (max_len - len(series)))
        padded.append(series)
    return [float(statistics.fmean(values)) for values in zip(*padded)]


def _random_population(rng: np.random.Generator, size: int, fixed_structure: bool = False) -> np.ndarray:
    population = rng.random((size, 6))
    if fixed_structure:
        population[:, 0] = rng.uniform(0.21, 0.39, size=size)
    return population


def _jitter_population(
    rng: np.random.Generator,
    centers: np.ndarray,
    size: int,
    fixed_structure: bool = False,
    scale: float = 0.10,
) -> np.ndarray:
    choices = centers[rng.integers(0, len(centers), size=size)]
    population = np.clip(choices + rng.normal(0.0, scale, size=choices.shape), 0.0, 1.0)
    if fixed_structure:
        population[:, 0] = rng.uniform(0.21, 0.39, size=size)
    return population


def _search_fixed_structure(cost_mode: str, seed: int) -> dict[str, Any]:
    rng = np.random.default_rng(seed)
    evaluator = OctaveBatchEvaluator('destroyer_fast_heading_maneuver', cost_mode)

    first = _random_population(rng, 48, fixed_structure=True)
    first_eval = evaluator.evaluate(first, include_traces=False)
    ranked_first = sorted(zip(first, first_eval), key=lambda item: item[1]['cost_breakdown']['total'])
    best_vectors = np.asarray([item[0] for item in ranked_first[:8]], dtype=float)

    second = np.vstack([best_vectors, _jitter_population(rng, best_vectors[:4], 28, fixed_structure=True, scale=0.08)])
    second_eval = evaluator.evaluate(second, include_traces=False)
    ranked_second = sorted(zip(second, second_eval), key=lambda item: item[1]['cost_breakdown']['total'])
    final_vectors = np.asarray([item[0] for item in ranked_second[:10]], dtype=float)

    third = np.vstack([final_vectors, _jitter_population(rng, final_vectors[:4], 20, fixed_structure=True, scale=0.05)])
    third_eval = evaluator.evaluate(third, include_traces=False)
    ranked_third = sorted(zip(third, third_eval), key=lambda item: item[1]['cost_breakdown']['total'])
    best_z, best_eval = ranked_third[0]
    trace_eval = evaluator.evaluate(np.asarray(best_z, dtype=float), include_traces=True)[0]

    return {
        'algorithm': 'fixed_structure_rescan',
        'seed': seed,
        'experiment_key': 'fixed_structure',
        'cost_mode': cost_mode,
        'best_per_iteration': [
            float(ranked_first[0][1]['cost_breakdown']['total']),
            float(ranked_second[0][1]['cost_breakdown']['total']),
            float(ranked_third[0][1]['cost_breakdown']['total']),
        ],
        'best_cost': float(best_eval['cost_breakdown']['total']),
        'z_best': _plain(best_z),
        'evaluation': trace_eval,
    }


def _make_variable_run_record(
    algorithm: str,
    experiment_key: str,
    seed: int,
    cost_mode: str,
    evaluation: dict[str, Any],
    history: list[float],
) -> dict[str, Any]:
    return {
        'algorithm': algorithm,
        'experiment_key': experiment_key,
        'seed': seed,
        'cost_mode': cost_mode,
        'cost_family': COST_MODES[cost_mode]['family'],
        'cost_variant': COST_MODES[cost_mode]['variant'],
        'best_cost': float(evaluation['cost_breakdown']['total']),
        'best_per_iteration': [float(value) for value in history],
        'z_best': evaluation['z'],
        'structure_id': evaluation['structure_id'],
        'structure_name': evaluation['structure_name'],
        'active_slots': evaluation['active_slots'],
        'ignored_slots': evaluation['ignored_slots'],
        'parameters': evaluation['parameters'],
        'controller_tex': evaluation['controller_tex'],
        'metrics': evaluation['metrics'],
        'screening': evaluation['screening'],
        'cost_breakdown': evaluation['cost_breakdown'],
        'sanity_passed': bool(evaluation['screening']['passed']),
        'evaluation': evaluation,
    }


def _run_ga(experiment_key: str, cost_mode: str, seed: int) -> dict[str, Any]:
    rng = np.random.default_rng(seed)
    evaluator = OctaveBatchEvaluator('destroyer_fast_heading_maneuver', cost_mode)

    population = _random_population(rng, GA_POPULATION, fixed_structure=False)
    history: list[float] = []
    best_z = population[0]
    best_eval: dict[str, Any] | None = None
    mutation_scale = 0.10

    for _ in range(ITERATIONS):
        evaluations = evaluator.evaluate(population, include_traces=False)
        ranked = sorted(zip(population, evaluations), key=lambda item: item[1]['cost_breakdown']['total'])
        history.append(float(ranked[0][1]['cost_breakdown']['total']))
        best_z = ranked[0][0]
        best_eval = ranked[0][1]

        elites = np.asarray([item[0] for item in ranked[:4]], dtype=float)
        next_population = [elite.copy() for elite in elites]
        while len(next_population) < GA_POPULATION:
            parent_a = elites[rng.integers(0, len(elites))]
            parent_b = elites[rng.integers(0, len(elites))]
            mask = rng.random(6) < 0.5
            child = np.where(mask, parent_a, parent_b)
            mutation_mask = rng.random(6) < 0.20
            if mutation_mask.any():
                child = child.copy()
                child[mutation_mask] = np.clip(
                    child[mutation_mask] + rng.normal(0.0, mutation_scale, mutation_mask.sum()),
                    0.0,
                    1.0,
                )
            next_population.append(child)
        population = np.asarray(next_population, dtype=float)

    if best_eval is None:
        raise RuntimeError('GA search did not produce any evaluation.')

    trace_eval = evaluator.evaluate(np.asarray(best_z, dtype=float), include_traces=True)[0]
    return _make_variable_run_record('GA', experiment_key, seed, cost_mode, trace_eval, history)


def _run_pso(experiment_key: str, cost_mode: str, seed: int) -> dict[str, Any]:
    rng = np.random.default_rng(seed)
    evaluator = OctaveBatchEvaluator('destroyer_fast_heading_maneuver', cost_mode)

    positions = _random_population(rng, PSO_PARTICLES, fixed_structure=False)
    velocities = rng.normal(0.0, 0.04, size=(PSO_PARTICLES, 6))
    personal_best_positions = positions.copy()
    personal_best_costs = np.full(PSO_PARTICLES, np.inf, dtype=float)
    global_best_position = positions[0].copy()
    global_best_cost = float('inf')
    history: list[float] = []

    for _ in range(ITERATIONS):
        evaluations = evaluator.evaluate(positions, include_traces=False)
        costs = np.asarray([item['cost_breakdown']['total'] for item in evaluations], dtype=float)

        improved = costs < personal_best_costs
        personal_best_positions[improved] = positions[improved]
        personal_best_costs[improved] = costs[improved]

        best_index = int(np.argmin(costs))
        if costs[best_index] < global_best_cost:
            global_best_cost = float(costs[best_index])
            global_best_position = positions[best_index].copy()

        history.append(global_best_cost)

        r1 = rng.random((PSO_PARTICLES, 6))
        r2 = rng.random((PSO_PARTICLES, 6))
        velocities = (
            0.58 * velocities
            + 1.45 * r1 * (personal_best_positions - positions)
            + 1.85 * r2 * (global_best_position - positions)
        )
        positions = np.clip(positions + velocities, 0.0, 1.0)

    trace_eval = evaluator.evaluate(np.asarray(global_best_position, dtype=float), include_traces=True)[0]
    return _make_variable_run_record('PSO', experiment_key, seed, cost_mode, trace_eval, history)


def _build_experiment_record(
    key: str,
    selection: dict[str, Any],
    family_results: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    evaluation = selection['evaluation']
    metadata = EXPERIMENT_METADATA[key]
    cost_mode = metadata['cost_mode']

    record = {
        'key': key,
        'label': metadata['label'],
        'scenario': 'destroyer_fast_heading_maneuver',
        'cost_mode': cost_mode,
        'cost_family': COST_MODES[cost_mode]['family'],
        'cost_variant': COST_MODES[cost_mode]['variant'],
        'search_mode': metadata['search_mode'],
        'selection_algorithm': selection['algorithm'],
        'seed': selection['seed'],
        'best_cost': selection['best_cost'],
        'best_per_iteration': selection['best_per_iteration'],
        'z_best': selection['z_best'],
        'structure_id': evaluation['structure_id'],
        'structure_name': evaluation['structure_name'],
        'active_slots': evaluation['active_slots'],
        'ignored_slots': evaluation['ignored_slots'],
        'parameters': evaluation['parameters'],
        'controller_tex': evaluation['controller_tex'],
        'metrics': evaluation['metrics'],
        'screening': evaluation['screening'],
        'cost_breakdown': evaluation['cost_breakdown'],
        'time_response': evaluation['time_response'],
        'trajectory': evaluation['trajectory'],
        'frequency_response': evaluation['frequency_response'],
        'notes': metadata['notes'],
    }
    if family_results is not None:
        record['family_results'] = family_results
    return record


def _build_family_result(cost_mode: str, selection: dict[str, Any]) -> dict[str, Any]:
    evaluation = selection['evaluation']
    return {
        'cost_mode': cost_mode,
        'cost_family': COST_MODES[cost_mode]['family'],
        'cost_variant': COST_MODES[cost_mode]['variant'],
        'label': COST_MODES[cost_mode]['label'],
        'best_cost': selection['best_cost'],
        'structure_name': evaluation['structure_name'],
        'parameters': evaluation['parameters'],
        'controller_tex': evaluation['controller_tex'],
        'metrics': evaluation['metrics'],
        'screening': evaluation['screening'],
    }


def _trace_summary(experiment: dict[str, Any]) -> dict[str, Any]:
    return {
        'label': experiment['label'],
        'reference': experiment['time_response']['reference'],
        'response': experiment['time_response']['response'],
        'control': experiment['time_response']['control'],
        'metrics': experiment['metrics'],
    }


def _build_decode_examples() -> list[dict[str, Any]]:
    evaluator = OctaveBatchEvaluator('destroyer_fast_heading_maneuver', 'destroyer')
    vectors = np.asarray([item['z'] for item in DECODE_EXAMPLE_VECTORS], dtype=float)
    evaluations = evaluator.evaluate(vectors, include_traces=False)
    examples: list[dict[str, Any]] = []
    for source, evaluation in zip(DECODE_EXAMPLE_VECTORS, evaluations):
        examples.append(
            {
                'label': source['label'],
                'z': source['z'],
                'structure_id': evaluation['structure_id'],
                'structure_name': evaluation['structure_name'],
                'active_slots': evaluation['active_slots'],
                'ignored_slots': evaluation['ignored_slots'],
                'parameters': evaluation['parameters'],
                'controller_tex': evaluation['controller_tex'],
            }
        )
    return examples


def main() -> None:
    passenger_family_modes = ['passenger_A', 'passenger_B', 'passenger_C']
    passenger_fixed_family_results: list[dict[str, Any]] = []
    passenger_fixed_selection: dict[str, Any] | None = None

    for offset, cost_mode in enumerate(passenger_family_modes):
        selection = _search_fixed_structure(cost_mode, seed=101 + offset)
        passenger_fixed_family_results.append(_build_family_result(cost_mode, selection))
        if cost_mode == 'passenger_B':
            passenger_fixed_selection = selection

    if passenger_fixed_selection is None:
        raise RuntimeError('Missing passenger_B fixed-structure selection.')

    passenger_fixed = _build_experiment_record(
        'passenger_cost_fixed_structure',
        passenger_fixed_selection,
        family_results=passenger_fixed_family_results,
    )

    destroyer_fixed_selection = _search_fixed_structure('destroyer', seed=211)
    destroyer_fixed = _build_experiment_record('destroyer_cost_fixed_structure', destroyer_fixed_selection)

    ga_runs = []
    pso_runs = []
    variable_experiments: dict[str, dict[str, Any]] = {}

    for key in ('passenger_cost_variable_structure', 'destroyer_cost_variable_structure'):
        cost_mode = EXPERIMENT_METADATA[key]['cost_mode']
        ga_subset = [_run_ga(key, cost_mode, seed) for seed in GA_SEEDS]
        pso_subset = [_run_pso(key, cost_mode, seed) for seed in PSO_SEEDS]
        ga_runs.extend(ga_subset)
        pso_runs.extend(pso_subset)

        all_runs = ga_subset + pso_subset
        passing = [run for run in all_runs if run['sanity_passed']]
        chosen = min(passing or all_runs, key=lambda item: item['best_cost'])
        variable_experiments[key] = _build_experiment_record(key, chosen)

    destroyer_experiments = {
        'passenger_cost_fixed_structure': passenger_fixed,
        'passenger_cost_variable_structure': variable_experiments['passenger_cost_variable_structure'],
        'destroyer_cost_fixed_structure': destroyer_fixed,
        'destroyer_cost_variable_structure': variable_experiments['destroyer_cost_variable_structure'],
    }

    selected_solution = {
        'scenario': 'destroyer_fast_heading_maneuver',
        'experiment_key': 'destroyer_cost_variable_structure',
        'label': destroyer_experiments['destroyer_cost_variable_structure']['label'],
        'algorithm': destroyer_experiments['destroyer_cost_variable_structure']['selection_algorithm'],
        'seed': destroyer_experiments['destroyer_cost_variable_structure']['seed'],
        'cost_family': 'destroyer',
        'search_mode': 'variable_structure',
        'structure_id': destroyer_experiments['destroyer_cost_variable_structure']['structure_id'],
        'structure_name': destroyer_experiments['destroyer_cost_variable_structure']['structure_name'],
        'z_best': destroyer_experiments['destroyer_cost_variable_structure']['z_best'],
        'parameters': destroyer_experiments['destroyer_cost_variable_structure']['parameters'],
        'controller_tex': destroyer_experiments['destroyer_cost_variable_structure']['controller_tex'],
        'metrics': destroyer_experiments['destroyer_cost_variable_structure']['metrics'],
        'screening': destroyer_experiments['destroyer_cost_variable_structure']['screening'],
        'cost_breakdown': destroyer_experiments['destroyer_cost_variable_structure']['cost_breakdown'],
    }

    convergence_history = {
        'steps': list(range(1, ITERATIONS + 1)),
        'passenger_cost_variable_structure': {
            'label': destroyer_experiments['passenger_cost_variable_structure']['label'],
            'ga': {'mean_best': _mean_history([run for run in ga_runs if run['experiment_key'] == 'passenger_cost_variable_structure'])},
            'pso': {'mean_best': _mean_history([run for run in pso_runs if run['experiment_key'] == 'passenger_cost_variable_structure'])},
        },
        'destroyer_cost_variable_structure': {
            'label': destroyer_experiments['destroyer_cost_variable_structure']['label'],
            'ga': {'mean_best': _mean_history([run for run in ga_runs if run['experiment_key'] == 'destroyer_cost_variable_structure'])},
            'pso': {'mean_best': _mean_history([run for run in pso_runs if run['experiment_key'] == 'destroyer_cost_variable_structure'])},
        },
    }

    payload = {
        'scenario_configs': SCENARIO_CONFIGS,
        'structure_codebook': STRUCTURE_CODEBOOK,
        'decode_examples': _build_decode_examples(),
        'destroyer_experiments': destroyer_experiments,
        'migration_fixed_structure': destroyer_experiments['destroyer_cost_fixed_structure'],
        'cross_structure_search': destroyer_experiments['destroyer_cost_variable_structure'],
        'ga_runs': ga_runs,
        'pso_runs': pso_runs,
        'selected_solution': selected_solution,
        'time_response': {key: _trace_summary(value) for key, value in destroyer_experiments.items()},
        'frequency_response': {key: value['frequency_response'] for key, value in destroyer_experiments.items()},
        'convergence_history': convergence_history,
        'search_config': {
            'ga': {
                'population_size': GA_POPULATION,
                'num_generations': ITERATIONS,
                'seeds': GA_SEEDS,
                'algorithm': 'custom_ga',
            },
            'pso': {
                'n_particles': PSO_PARTICLES,
                'iters': ITERATIONS,
                'seeds': PSO_SEEDS,
                'algorithm': 'custom_pso',
            },
            'fixed_structure_search': {
                'algorithm': 'multi_round_random_rescan',
                'rounds': [48, 36, 30],
                'structure_name': '超前',
            },
        },
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(_plain(payload), ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
