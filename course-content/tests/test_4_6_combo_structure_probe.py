from __future__ import annotations

import json
import subprocess
from functools import lru_cache
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / 'authoring' / 'lessons' / '4-6' / 'media' / 'raw'
PROCESSED_DIR = ROOT / 'authoring' / 'lessons' / '4-6' / 'media' / 'processed'
PROBE_SCRIPT_PATH = RAW_DIR / 'probe_combo_structure_search.py'
PROBE_EVALUATOR_PATH = RAW_DIR / 'probe_combo_structure_search.m'
PROBE_JSON_PATH = RAW_DIR / 'generated-data' / '4-6-combo-structure-probe.json'
PROBE_PLOT_PATH = PROCESSED_DIR / '4-6-ship-heading-combo-probe.png'


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


@lru_cache(maxsize=1)
def generate_probe_payload() -> dict:
    if not PROBE_JSON_PATH.exists() or not PROBE_PLOT_PATH.exists():
        subprocess.run(['python3', str(PROBE_SCRIPT_PATH)], check=True, cwd=ROOT.parents[0])
    return json.loads(read(PROBE_JSON_PATH))


def test_combo_probe_scripts_define_three_layer_module_encoding():
    script = read(PROBE_SCRIPT_PATH)
    evaluator = read(PROBE_EVALUATOR_PATH)

    for text in (
        '13',
        'S_fb',
        'S_ff',
        'S_rate',
        'feedforward_codebook',
        'rate_feedback_codebook',
        'heading_rate',
    ):
        assert text in script or text in evaluator

    assert '误差微分' not in script
    assert '误差微分' not in evaluator
    assert '\\dot{\\psi}' in script or '\\dot{\\psi}' in evaluator or 'heading_rate' in evaluator


def test_combo_probe_can_generate_json_and_plot():
    payload = generate_probe_payload()

    assert PROBE_JSON_PATH.exists()
    assert PROBE_PLOT_PATH.exists()
    assert payload['scenario_id'] == 'destroyer_fast_heading_maneuver'
    assert payload['cost_mode'] == 'destroyer'


def test_combo_probe_json_exposes_branch_metrics_and_module_diagnostics():
    payload = generate_probe_payload()

    for key in (
        'baseline_source',
        'scenario_id',
        'cost_mode',
        'module_codebooks',
        'search_config',
        'ga_runs',
        'pso_runs',
        'selected_solution',
        'best_transition_candidate',
        'promotion_decision',
        'comparison_to_baseline',
    ):
        assert key in payload

    for codebook in ('feedback', 'feedforward', 'rate_feedback'):
        assert codebook in payload['module_codebooks']

    selected = payload['selected_solution']
    for module_key in ('feedback', 'feedforward', 'rate_feedback'):
        module = selected['modules'][module_key]
        for field in ('module_id', 'module_name', 'z', 'active_slots', 'ignored_slots', 'parameters', 'expression'):
            assert field in module

    assert len(selected['z']) == 13

    branch_metrics = selected['branch_metrics']
    for key in (
        'u_feedback_peak',
        'u_feedforward_peak',
        'u_rate_peak',
        'heading_rate_peak',
    ):
        assert key in branch_metrics

    comparison = payload['comparison_to_baseline']
    for key in (
        'total_cost_delta',
        'transition_error_ratio',
        'trajectory_error_ratio',
        'u_max_within_screening',
        'control_energy_within_screening',
        'M_r_within_screening',
        'tail_segment_error_within_screening',
    ):
        assert key in comparison


def test_combo_probe_search_budget_matches_plan():
    payload = generate_probe_payload()

    ga_config = payload['search_config']['ga']
    pso_config = payload['search_config']['pso']
    assert ga_config['population'] == 16
    assert ga_config['generations'] == 20
    assert ga_config['seeds'] == [11, 19, 37]
    assert pso_config['particles'] == 16
    assert pso_config['iters'] == 20
    assert pso_config['seeds'] == [7, 23, 41]
