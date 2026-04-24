from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / 'authoring' / 'lessons' / '4-7' / 'reports'
REPORT_PATH = REPORT_DIR / '4-7-destroyer-hifi-identification-report.md'
DATA_PATH = REPORT_DIR / 'data' / '4-7-destroyer-hifi-experiment.json'
FIGURE_DIR = REPORT_DIR / 'figures'

EXPECTED_SUMMARY_FIGURES = (
    '4-7-hifi-vs-identified-response.png',
    '4-7-controller-comparison.png',
    '4-7-disturbance-response.png',
    '4-7-rudder-actuator-step-identification.png',
    '4-7-hull-yaw-step-identification.png',
    '4-7-disturbance-step-identification.png',
)

CONTROLLER_IDS = (
    'direct_transfer',
    'fixed_lead',
    'pi_lead',
    'lag_lead',
    'filtered_pid',
)

SCENARIO_IDS = (
    'turn90',
    'obstacle',
    'circle',
    'switching20s',
)


def read_text(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def test_destroyer_hifi_report_bundle_exists():
    assert REPORT_PATH.exists()
    assert DATA_PATH.exists()
    for filename in EXPECTED_SUMMARY_FIGURES:
        assert (FIGURE_DIR / filename).exists()
    controller_figures = sorted(FIGURE_DIR.glob('4-7-controller-*.png'))
    controller_figures = [
        path for path in controller_figures
        if path.name != '4-7-controller-comparison.png'
    ]
    assert len(controller_figures) == 40


def test_destroyer_hifi_json_contract_and_identification_quality():
    payload = json.loads(read_text(DATA_PATH))

    assert set(payload) >= {
        'modelBoundary',
        'identifiedTransferFunction',
        'segmentedIdentification',
        'validationScenarios',
        'controllerComparison',
        'selectedControllerId',
        'disturbanceInterface',
    }
    assert payload['modelBoundary']['modelFamily'] == 'MMG3DOF'
    assert payload['modelBoundary']['sourcePolicy'] == 'MMG_REBUILT_FROM_EXISTING_SIMULATION_PROFILE'

    identified = payload['identifiedTransferFunction']
    assert identified['k'] > 0
    assert identified['slowPole'] > 0
    assert identified['fastPole'] > identified['slowPole']
    assert identified['headingRmseDeg'] < 8
    assert identified['yawRateRmseDegS'] < 0.8

    segmented = payload['segmentedIdentification']
    assert set(segmented) >= {'rudderActuator', 'hullYaw', 'disturbancePath'}
    assert segmented['rudderActuator']['timeConstantS'] > 0
    assert segmented['hullYaw']['timeConstantS'] > 0
    assert segmented['hullYaw']['gainYawRatePerRudderRad'] > 0
    assert segmented['disturbancePath']['timeConstantS'] > 0
    assert segmented['disturbancePath']['equivalentRudderGainRad'] > 0
    assert all(
        item['stepResponse']
        for item in segmented.values()
    )

    scenarios = {item['scenarioId']: item for item in payload['validationScenarios']}
    assert {'turn90', 'obstacle', 'circle', 'switching20s'} <= set(scenarios)
    assert all(item['headingRmseDeg'] < 18 for item in scenarios.values())

    comparison = payload['controllerComparison']
    assert payload['selectedControllerId'] == 'pi_lead'
    assert set(CONTROLLER_IDS) <= {row['controllerId'] for row in comparison}
    assert len(comparison) == len(CONTROLLER_IDS) * len(SCENARIO_IDS) * 2 * 2
    assert {
        (row['controllerId'], row['scenarioId'], row['disturbanceEnabled'], row['modelKind'])
        for row in comparison
    } == {
        (controller_id, scenario_id, disturbance, model_kind)
        for controller_id in CONTROLLER_IDS
        for scenario_id in SCENARIO_IDS
        for disturbance in (False, True)
        for model_kind in ('hifi', 'identified')
    }
    assert all(row['maxRudderDeg'] <= payload['modelBoundary']['maxRudderDeg'] + 1e-6 for row in comparison)


def test_destroyer_hifi_json_uses_physical_units_for_public_traces():
    payload = json.loads(read_text(DATA_PATH))
    text = json.dumps(payload, ensure_ascii=False)

    assert 'headingRad' not in text
    assert 'yawRateRad' not in text
    assert 'headingDeg' in text
    assert 'yawRateDegS' in text
    assert 'speedMps' in text
    assert 'positionXM' in text
    assert 'positionYM' in text
    assert 'targetHeadingDeg' in text

    sample = payload['controllerComparison'][0]['trace'][0]
    assert set(sample) >= {
        'timeS',
        'targetHeadingDeg',
        'headingDeg',
        'yawRateDegS',
        'speedMps',
        'positionXM',
        'positionYM',
    }


def test_destroyer_hifi_report_matches_handout_rewrite_scope():
    report = read_text(REPORT_PATH)

    for phrase in (
        '055 型驱逐舰',
        'MMG 三自由度',
        '高保真模型',
        '辨识模型',
        '典型航迹测试',
        '外部扰动接口',
        '分段辨识',
        '舵机惯性',
        '船体惯性',
        '扰动等效惯性',
        '阶跃输入',
        '期望航迹',
        '讲义精选',
    ):
        assert phrase in report

    assert '暂不回写讲义' not in report
