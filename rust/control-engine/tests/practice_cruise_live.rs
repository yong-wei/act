use control_engine::virtual_simulation_runtime::compute_virtual_simulation_step_json;
use serde_json::{json, Value};

fn assert_close(actual: f64, expected: f64, label: &str) {
    let abs = (actual - expected).abs();
    let rel = abs / expected.abs().max(1.0);
    assert!(
        abs <= 1e-6 || rel <= 1e-3,
        "{label}: actual={actual} expected={expected} abs={abs} rel={rel}"
    );
}

#[test]
fn practice_cruise_live_step_advances_finite_heading_and_roll() {
    let request = json!({
        "modelId": "practice_cruise_live_step",
        "dt": 1.0 / 60.0,
        "time": 1.0 / 60.0,
        "targetHeading": 20.0,
        "controlMode": "pid",
        "manualRudder": 0.0,
        "manualSpeed": 9.3,
        "maxRudderDeg": 35.0,
        "kp": 0.6,
        "ki": 0.008,
        "kd": 1.5,
        "seaState": 3.0,
        "waveDirection": 90.0,
        "prevRudder": 0.0,
        "finStabilizerEnabled": true,
        "notchFilterEnabled": true,
        "state": {
            "headingRad": 0.0,
            "yawRateRad": 0.0,
            "yawAccelRad": 0.0,
            "rollRad": 0.05,
            "rollRateRad": 0.0,
            "positionX": -3000.0,
            "positionZ": 0.0,
            "speedMps": 9.3,
            "rudderDeg": 0.0,
            "finAngleDeg": 0.0
        },
        "pidState": { "integral": 0.0, "prevError": 0.0 },
        "finState": {
            "portFinAngleDeg": 0.0,
            "starboardFinAngleDeg": 0.0,
            "portLiftForce": 0.0,
            "starboardLiftForce": 0.0,
            "antiRollMoment": 0.0,
            "powerConsumption": 0.0,
            "enabled": true
        },
        "notchState": {
            "inputHistory": [0.0, 0.0],
            "outputHistory": [0.0, 0.0],
            "enabled": true,
            "currentGainDb": 0.0
        },
        "rollCoupledParams": {
            "K": 0.05,
            "T1": 90.0,
            "T2": 25.0,
            "K_phi": 0.15,
            "T_phi1": 8.0,
            "T_phi2": 2.0,
            "maxRudderDeg": 35.0,
            "speedMps": 9.3
        }
    });
    let result: Value = serde_json::from_str(
        &compute_virtual_simulation_step_json(&request.to_string()).unwrap(),
    )
    .unwrap();
    assert!(result["state"]["headingRad"].as_f64().unwrap().is_finite());
    assert!(result["state"]["rollRad"].as_f64().unwrap().is_finite());
    assert!(result["rudderDeg"].as_f64().unwrap().abs() > 0.0);
    assert_eq!(result["modelId"].as_str().unwrap(), "practice_cruise_live_step");
}

#[test]
fn practice_cruise_live_step_frozen_numeric_baseline() {
    let request = json!({
        "modelId": "practice_cruise_live_step",
        "dt": 1.0 / 60.0,
        "time": 1.0 / 60.0,
        "targetHeading": 20.0,
        "controlMode": "pid",
        "manualRudder": 0.0,
        "manualSpeed": 9.3,
        "maxRudderDeg": 35.0,
        "kp": 0.6,
        "ki": 0.008,
        "kd": 1.5,
        "seaState": 3.0,
        "waveDirection": 90.0,
        "prevRudder": 0.0,
        "finStabilizerEnabled": true,
        "notchFilterEnabled": true,
        "state": {
            "headingRad": 0.0,
            "yawRateRad": 0.0,
            "yawAccelRad": 0.0,
            "rollRad": 0.05,
            "rollRateRad": 0.0,
            "positionX": -3000.0,
            "positionZ": 0.0,
            "speedMps": 9.3,
            "rudderDeg": 0.0,
            "finAngleDeg": 0.0
        },
        "pidState": { "integral": 0.0, "prevError": 0.0 },
        "finState": {
            "portFinAngleDeg": 0.0,
            "starboardFinAngleDeg": 0.0,
            "portLiftForce": 0.0,
            "starboardLiftForce": 0.0,
            "antiRollMoment": 0.0,
            "powerConsumption": 0.0,
            "enabled": true
        },
        "notchState": {
            "inputHistory": [0.0, 0.0],
            "outputHistory": [0.0, 0.0],
            "enabled": true,
            "currentGainDb": 0.0
        },
        "rollCoupledParams": {
            "K": 0.05,
            "T1": 90.0,
            "T2": 25.0,
            "K_phi": 0.15,
            "T_phi1": 8.0,
            "T_phi2": 2.0,
            "maxRudderDeg": 35.0,
            "speedMps": 9.3
        }
    });
    let result: Value = serde_json::from_str(
        &compute_virtual_simulation_step_json(&request.to_string()).unwrap(),
    )
    .unwrap();
    assert_close(
        result["state"]["headingRad"].as_f64().unwrap(),
        3.141418792651956e-11,
        "headingRad",
    );
    assert_close(
        result["state"]["yawRateRad"].as_f64().unwrap(),
        1.884851275591173e-9,
        "yawRateRad",
    );
    assert_close(
        result["state"]["rollRad"].as_f64().unwrap(),
        0.04999977248296945,
        "rollRad",
    );
    assert_close(result["rudderDeg"].as_f64().unwrap(), 35.0, "rudderDeg");
    assert_close(
        result["pidState"]["integral"].as_f64().unwrap(),
        0.3333333333333333,
        "integral",
    );
    assert_close(result["pidState"]["prevError"].as_f64().unwrap(), 20.0, "prevError");
}

#[test]
fn practice_cruise_live_step_rejects_non_positive_dt() {
    let request = json!({
        "modelId": "practice_cruise_live_step",
        "dt": 0.0
    });
    let error = compute_virtual_simulation_step_json(&request.to_string()).unwrap_err();
    assert!(error.contains("dt must be in (0, 1]"));
}
