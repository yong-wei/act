from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / 'authoring' / 'lessons' / '4-7' / 'reports'
REPORT_PATH = REPORT_DIR / '4-7-destroyer-hifi-identification-report.md'
DATA_PATH = REPORT_DIR / 'data' / '4-7-destroyer-hifi-experiment.json'
TRADITIONAL_DESIGN_DATA_PATH = REPORT_DIR / 'data' / '4-7-traditional-design-four-panel-data.json'
TRADITIONAL_DESIGN_OCTAVE_SCRIPT = REPORT_DIR / 'generate_traditional_design_four_panel_data.m'
FIGURE_DIR = REPORT_DIR / 'figures'

EXPECTED_SUMMARY_FIGURES = (
    '4-7-hifi-vs-identified-response.png',
    '4-7-controller-comparison.png',
    '4-7-disturbance-response.png',
    '4-7-rudder-actuator-step-identification.png',
    '4-7-hull-yaw-step-identification.png',
    '4-7-disturbance-step-identification.png',
    '4-7-traditional-diagnosis-four-panel.png',
    '4-7-traditional-design-four-panel.png',
    '4-7-optimization-convergence-identified.png',
    '4-7-optimization-convergence-hifi.png',
    '4-7-nominal-traditional-zigzag45.png',
    '4-7-nominal-optimized-zigzag45.png',
    '4-7-nominal-traditional-turning_ramp.png',
    '4-7-nominal-optimized-turning_ramp.png',
    '4-7-disturbance-controller-zigzag45.png',
    '4-7-disturbance-controller-turning_ramp.png',
    '4-7-noise-controller-zigzag45.png',
    '4-7-noise-controller-turning_ramp.png',
)

CONTROLLER_IDS = (
    'direct_transfer',
    'fixed_lead',
    'pi_lead',
    'lag_lead',
    'filtered_pid',
    'disturbance_optimized',
)

SCENARIO_IDS = (
    'zigzag45',
    'turning_ramp',
)


def read_text(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def test_destroyer_hifi_report_bundle_exists():
    assert REPORT_PATH.exists()
    assert DATA_PATH.exists()
    assert TRADITIONAL_DESIGN_DATA_PATH.exists()
    assert TRADITIONAL_DESIGN_OCTAVE_SCRIPT.exists()
    for filename in EXPECTED_SUMMARY_FIGURES:
        assert (FIGURE_DIR / filename).exists()
    controller_figures = sorted(FIGURE_DIR.glob('4-7-controller-*.png'))
    controller_figures = [
        path for path in controller_figures
        if path.name != '4-7-controller-comparison.png'
    ]
    assert len(controller_figures) == len(CONTROLLER_IDS) * len(SCENARIO_IDS) * 2


def test_traditional_four_panel_data_is_octave_generated_contract():
    script = read_text(TRADITIONAL_DESIGN_OCTAVE_SCRIPT)
    payload = json.loads(read_text(TRADITIONAL_DESIGN_DATA_PATH))

    assert 'pkg load control' in script
    assert 'jsonencode(payload)' in script
    assert 'step(feedback(P, 1)' in script
    assert 'freqresp(P, w)' in script
    assert 'roots(den + gains(i) * padded_num)' in script

    assert set(payload) == {'design', 'diagnosis', 'designCheck'}
    assert payload['design']['Ti'] == payload['design']['Th']
    assert abs(payload['design']['wc'] - 0.040) < 1e-9
    assert abs(payload['design']['Kc'] - 23.1105) < 0.01
    assert set(payload['diagnosis']) >= {'timeS', 'stepResponse', 'bode', 'nyquist', 'rootLocus'}
    assert set(payload['diagnosis']['bode']) >= {'plantMagDb', 'plantPhaseDeg'}
    assert set(payload['designCheck']) >= {
        'stepUncorrected',
        'stepCorrected',
        'bode',
        'uncorrectedRootLocus',
        'correctedRootLocus',
    }
    assert set(payload['designCheck']['bode']) >= {
        'plantMagDb',
        'controllerMagDb',
        'correctedMagDb',
        'plantPhaseDeg',
        'controllerPhaseDeg',
        'correctedPhaseDeg',
    }


def test_destroyer_hifi_json_contract_and_identification_quality():
    payload = json.loads(read_text(DATA_PATH))

    assert set(payload) >= {
        'modelBoundary',
        'identifiedTransferFunction',
        'segmentedIdentification',
        'validationScenarios',
        'controllerComparison',
        'controllerEncoding',
        'nominalComparison',
        'disturbanceComparison',
        'noiseComparison',
        'searchMetadata',
        'sensorNoiseSettings',
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
    assert set(scenarios) == {'zigzag45', 'turning_ramp'}
    assert all(item['headingRmseDeg'] < 18 for item in scenarios.values())
    assert scenarios['zigzag45']['durationS'] >= 1200
    assert scenarios['turning_ramp']['durationS'] >= 780

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


def test_destroyer_hifi_new_scenario_and_design_group_contract():
    payload = json.loads(read_text(DATA_PATH))

    zigzag = next(item for item in payload['validationScenarios'] if item['scenarioId'] == 'zigzag45')
    zigzag_targets = [point['targetHeadingDeg'] for point in zigzag['hifiTrace']]
    assert max(zigzag_targets) == 45.0
    assert min(zigzag_targets) == -45.0
    assert zigzag['durationS'] == 1200.0

    ramp = next(item for item in payload['validationScenarios'] if item['scenarioId'] == 'turning_ramp')
    ramp_targets = [point['targetHeadingDeg'] for point in ramp['hifiTrace']]
    assert ramp_targets[0] == 0.0
    assert ramp_targets[-1] == 360.0
    assert ramp_targets == sorted(ramp_targets)
    assert ramp['durationS'] == 780.0

    assert payload['modelBoundary']['cruiseSpeedMps'] == 15.0
    assert len(payload['controllerEncoding']) == len(CONTROLLER_IDS)
    assert any(
        item['controllerId'] == 'disturbance_optimized'
        and '扰动' in item['controllerName']
        for item in payload['controllerEncoding']
    )
    for encoded in payload['controllerEncoding']:
        assert set(encoded) >= {
            'structureCode',
            'kp',
            'ki',
            'kd',
            'leadStrength',
            'lagStrength',
            'derivativeFilter',
            'measurementFilterTimeConstantS',
        }

    search = payload['searchMetadata']
    assert search['populationSize'] == 48
    assert search['generations'] == 40
    assert search['eliteCount'] == 6
    assert search['crossoverRate'] == 0.70
    assert search['mutationRate'] == 0.18
    assert search['randomSeed'] == 4707

    assert {item['groupId'] for item in payload['nominalComparison']} == {
        'nominal_zigzag45',
        'nominal_turning_ramp',
    }
    assert {item['groupId'] for item in payload['disturbanceComparison']} == {
        'disturbance_zigzag45',
        'disturbance_turning_ramp',
    }
    assert {item['groupId'] for item in payload['noiseComparison']} == {
        'noise_zigzag45',
        'noise_turning_ramp',
    }
    assert all(len(group['cases']) == 5 for group in payload['nominalComparison'])
    assert all(len(group['cases']) == 3 for group in payload['disturbanceComparison'])
    assert all(
        any(case['controllerId'] == 'disturbance_optimized' for case in group['cases'])
        for group in payload['disturbanceComparison']
    )
    assert all(len(group['cases']) == 4 for group in payload['noiseComparison'])

    disturbance_interface = payload['disturbanceInterface']
    assert disturbance_interface['activeLevelId'] == 'moderate'
    assert len(disturbance_interface['engineeringLevels']) == 3
    assert {
        item['levelId'] for item in disturbance_interface['engineeringLevels']
    } == {'mild', 'moderate', 'strong'}

    calm_disturbed_scores = [
        row['score'] for row in payload['controllerComparison']
        if row['modelKind'] == 'hifi'
        and row['disturbanceEnabled']
        and row['controllerId'] == 'lag_lead'
    ]
    disturbance_optimized_scores = [
        row['score'] for row in payload['controllerComparison']
        if row['modelKind'] == 'hifi'
        and row['disturbanceEnabled']
        and row['controllerId'] == 'disturbance_optimized'
    ]
    assert sum(disturbance_optimized_scores) < sum(calm_disturbed_scores)

    noise = payload['sensorNoiseSettings']
    assert noise['measuredSignal'] == 'heading'
    assert '\\psi_m(t)=\\psi(t)+b_\\psi(t)+\\sigma_\\psi\\xi_k' in noise['equation']


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
