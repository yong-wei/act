use control_engine::virtual_simulation_runtime::compute_virtual_simulation_step_json;
use serde_json::{json, Value};

fn parse(request: Value) -> Value {
    serde_json::from_str(&compute_virtual_simulation_step_json(&request.to_string()).unwrap()).unwrap()
}

fn assert_close(actual: f64, expected: f64, label: &str) {
    let abs = (actual - expected).abs();
    let rel = abs / expected.abs().max(1.0);
    assert!(
        abs <= 1e-6 || rel <= 1e-3,
        "{label}: actual={actual} expected={expected} abs={abs} rel={rel}"
    );
}

#[test]
fn practice_pid_control_turns_right_for_positive_heading_error() {
    let result = parse(json!({
        "modelId": "practice_pid_control",
        "dt": 1.0 / 60.0,
        "targetHeading": 20.0,
        "currentHeading": 0.0,
        "controlMode": "pid",
        "gains": { "kp": 0.8, "ki": 0.05, "kd": 2.0 },
        "maxRudderDeg": 35.0,
        "state": { "integral": 0.0, "prevError": 0.0, "prevDerivative": 0.0 }
    }));
    assert!(result["output"]["rudderDeg"].as_f64().unwrap() > 0.0);
    assert!(result["output"]["rudderDeg"].as_f64().unwrap().is_finite());
}

#[test]
fn practice_pid_control_frozen_numeric_baseline() {
    let result = parse(json!({
        "modelId": "practice_pid_control",
        "dt": 1.0 / 60.0,
        "targetHeading": 1.0,
        "currentHeading": 0.0,
        "controlMode": "pid",
        "gains": { "kp": 0.8, "ki": 0.05, "kd": 2.0 },
        "maxRudderDeg": 35.0,
        "derivativeFilter": 0.1,
        "state": { "integral": 0.0, "prevError": 0.0, "prevDerivative": 0.0 }
    }));
    assert_close(result["output"]["rudderDeg"].as_f64().unwrap(), 12.800833333333337, "rudderDeg");
    assert_close(result["output"]["error"].as_f64().unwrap(), 1.0, "error");
    assert_close(result["output"]["derivative"].as_f64().unwrap(), 6.0, "derivative");
    assert_close(result["newState"]["integral"].as_f64().unwrap(), 0.0002908882086657216, "integral");
}

#[test]
fn practice_sloshing_step_stays_finite() {
    let result = parse(json!({
        "modelId": "practice_sloshing_step",
        "dt": 1.0 / 60.0,
        "shipYawRateRad": 0.05,
        "state": { "angle": 0.0, "rate": 0.0, "tankPressure": 100.0 },
        "params": {
            "naturalFreq": 0.5,
            "damping": 0.1,
            "coupling": 5e8,
            "inertia": 1e10,
            "basePressure": 100.0,
            "pressureSensitivity": 50.0
        }
    }));
    assert!(result["state"]["angle"].as_f64().unwrap().is_finite());
    assert!(result["moment"].as_f64().unwrap().is_finite());
}

#[test]
fn practice_allocate_thrust_rejects_non_positive_dt() {
    let error = compute_virtual_simulation_step_json(
        &json!({ "modelId": "practice_allocate_thrust", "dt": 0.0 }).to_string(),
    )
    .unwrap_err();
    assert!(error.contains("dt must be in (0, 1]"));
}

#[test]
fn practice_dp_decoupled_control_returns_finite_tau() {
    let result = parse(json!({
        "modelId": "practice_dp_decoupled_control",
        "dt": 1.0 / 60.0,
        "platform": {
            "x": 1.0, "y": -0.5, "psi": 0.0,
            "targetX": 0.0, "targetY": 0.0, "targetPsi": 0.0
        },
        "controllerState": {
            "surge": { "integral": 0.0, "prevError": 0.0 },
            "sway": { "integral": 0.0, "prevError": 0.0 },
            "yaw": { "integral": 0.0, "prevError": 0.0 }
        },
        "config": { "decouplingEnabled": true }
    }));
    assert!(result["output"]["decoupledTauX"].as_f64().unwrap().is_finite());
    assert!(result["output"]["errorX"].as_f64().unwrap().abs() > 0.0);
}

#[test]
fn practice_cruise_comfort_realtime_stays_in_range() {
    let result = parse(json!({
        "modelId": "practice_cruise_comfort_realtime",
        "dt": 1.0 / 60.0,
        "currentRollDeg": 3.0,
        "rollPeriodSec": 18.0,
        "shipBeam": 37.0,
        "alpha": 0.02,
        "lateralAccelG": 0.02,
        "yawRateDegPerSec": 0.4,
        "prevMetrics": {
            "msi": 0.0,
            "rollRms": 0.0,
            "rollPeak": 0.0,
            "comfortRating": "excellent",
            "vdv": 0.0,
            "frequencyWeightedAccel": 0.0
        }
    }));
    let msi = result["msi"].as_f64().unwrap();
    assert!(msi.is_finite());
    assert!(msi >= 0.0 && msi <= 100.0);
}

#[test]
fn practice_drilling_environment_seeded_replay_is_deterministic() {
    let request = json!({
        "modelId": "practice_drilling_environment",
        "dt": 1.0 / 60.0,
        "evolve": true,
        "current": {
            "speed": 0.5,
            "direction": 30.0,
            "meanSpeed": 0.5,
            "meanDirection": 30.0,
            "variability": 0.25
        },
        "wind": {
            "speed": 8.0,
            "direction": 40.0,
            "meanSpeed": 8.0,
            "gustSpeed": 0.0,
            "gustDuration": 0.0
        },
        "meanWindSpeed": 8.0,
        "waveHeight": 1.2,
        "waveDirection": 45.0,
        "psi": 0.1,
        "rngSamples": [0.12, 0.88, 0.41, 0.07, 0.63]
    });
    let first = parse(request.clone());
    let second = parse(request);
    assert_eq!(first, second);
    assert!(first["current"]["speed"].as_f64().unwrap().is_finite());
    assert!(first["wind"]["speed"].as_f64().unwrap().is_finite());
}
