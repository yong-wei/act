use control_engine::destroyer_hifi_runtime::compute_virtual_simulation_step_json;
use serde_json::{Value, json};

fn base_state() -> Value {
    json!({
        "timeS": 0.0,
        "headingDeg": 0.0,
        "yawRateDegS": 0.0,
        "positionXM": -6000.0,
        "positionYM": 0.0,
        "rudderDeg": 0.0,
        "speedMps": 15.0,
        "integralRadS": 0.0,
        "prevErrorRad": 0.0
    })
}

fn request(target_heading_deg: f64, state: Value) -> String {
    json!({
        "modelId": "destroyer_hifi",
        "dtS": 0.25,
        "targetHeadingDeg": target_heading_deg,
        "controlMode": "pid",
        "pid": { "kp": 2.0, "ki": 0.0, "kd": 8.0 },
        "manualRudderDeg": 0.0,
        "disturbanceEnabled": false,
        "state": state
    })
    .to_string()
}

fn step(target_heading_deg: f64, state: Value) -> Value {
    serde_json::from_str(
        &compute_virtual_simulation_step_json(&request(target_heading_deg, state)).unwrap(),
    )
    .unwrap()
}

#[test]
fn realtime_destroyer_step_outputs_finite_engineering_units() {
    let result = step(45.0, base_state());

    for field in [
        "timeS",
        "targetHeadingDeg",
        "headingDeg",
        "yawRateDegS",
        "positionXM",
        "positionYM",
        "rudderDeg",
        "speedMps",
    ] {
        assert!(result[field].as_f64().unwrap().is_finite(), "{field}");
    }
    assert!(result.get("headingRad").is_none());
    assert!(result.get("yawRateRad").is_none());
    assert_eq!(result["targetHeadingDeg"].as_f64().unwrap(), 45.0);
}

#[test]
fn realtime_destroyer_step_limits_rudder_angle_and_rate() {
    let mut state = base_state();
    let mut previous_rudder = 0.0;

    for _ in 0..20 {
        let result = step(120.0, state);
        let rudder = result["rudderDeg"].as_f64().unwrap();
        assert!(rudder.abs() <= 35.0 + 1e-6);
        assert!((rudder - previous_rudder).abs() <= 5.0 * 0.25 + 1e-6);
        previous_rudder = rudder;
        state = result;
    }
}

#[test]
fn realtime_destroyer_step_responds_to_heading_target_change() {
    let mut state = base_state();
    for _ in 0..260 {
        state = step(0.0, state);
    }
    let baseline_heading = state["headingDeg"].as_f64().unwrap();

    for _ in 0..420 {
        state = step(90.0, state);
    }
    let turned_heading = state["headingDeg"].as_f64().unwrap();

    assert!((turned_heading - baseline_heading).abs() > 8.0);
    assert!(turned_heading > baseline_heading);
}
