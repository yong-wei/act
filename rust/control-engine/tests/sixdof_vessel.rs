//! 通用六船 WASM 入口算例（issue-2147 vessel-drives 收敛）。

use control_engine::sixdof::vessel_runtime::compute_vessel_sixdof_step_json;

fn step_request(vessel_json: &str, state_json: &str) -> String {
    format!(
        r#"{{
      "modelId": "sixdof_vessel",
      "dtS": 0.5,
      "targetHeadingDeg": 0.0,
      "controlMode": "manual",
      "manualRudderDeg": 0.0,
      "disturbanceEnabled": false,
      "vessel": {},
      "state": {}
    }}"#,
        vessel_json, state_json
    )
}

fn default_vessel() -> String {
    r#"{}"#.to_string()
}

#[test]
fn vessel_step_completes_with_default_params() {
    let state = r#"{"timeS": 0.0, "headingDeg": 0.0, "speedMps": 15.0}"#;
    let out = compute_vessel_sixdof_step_json(&step_request(&default_vessel(), state)).unwrap();
    let v: serde_json::Value = serde_json::from_str(&out).unwrap();
    assert_eq!(v["modelVersion"], "sixdof-vessel-v1");
    assert_eq!(v["timeS"], 0.5);
    assert!(v["speedMps"].as_f64().unwrap() > 10.0, "巡航量级");
    assert!(v["sixdofState"]["bodyVelocity"].as_array().unwrap().len() == 6);
}

#[test]
fn vessel_step_with_custom_params() {
    let vessel = r#"{"lengthM": 300.0, "beamM": 40.0, "draftM": 14.0, "displacementT": 150000.0, "cruiseSpeedMps": 12.0}"#;
    let state = r#"{"timeS": 0.0, "headingDeg": 0.0, "speedMps": 12.0}"#;
    let out = compute_vessel_sixdof_step_json(&step_request(vessel, state)).unwrap();
    let v: serde_json::Value = serde_json::from_str(&out).unwrap();
    assert_eq!(v["modelVersion"], "sixdof-vessel-v1");
    assert!(v["speedMps"].as_f64().unwrap() > 5.0, "LNG 大船量级");
}

#[test]
fn vessel_state_round_trip() {
    let first = compute_vessel_sixdof_step_json(&step_request(
        &default_vessel(),
        r#"{"timeS": 0.0, "headingDeg": 0.0, "speedMps": 15.0}"#,
    ))
    .unwrap();
    let v1: serde_json::Value = serde_json::from_str(&first).unwrap();
    let state1 = format!(
        r#"{{"timeS": {}, "headingDeg": {}, "speedMps": {}, "sixdofState": {}}}"#,
        v1["timeS"], v1["headingDeg"], v1["speedMps"], v1["sixdofState"],
    );
    let second = compute_vessel_sixdof_step_json(&step_request(&default_vessel(), &state1)).unwrap();
    let v2: serde_json::Value = serde_json::from_str(&second).unwrap();
    assert_eq!(v2["timeS"], 1.0);
    assert!(v2["headingDeg"].as_f64().unwrap().abs() < 1e-6, "零舵令直航");
}

#[test]
fn vessel_rejects_invalid_dt() {
    for dt in [0.0, -1.0, 5.0] {
        let request = format!(
            r#"{{"dtS": {}, "controlMode": "manual", "vessel": {{}}, "state": {{}}}}"#,
            dt
        );
        assert!(compute_vessel_sixdof_step_json(&request).is_err());
    }
}
