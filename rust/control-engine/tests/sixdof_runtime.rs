//! sixdof_runtime 契约算例（issue-2153-p1 A2.1/A2.4）：
//! JSON 兼容、六自由度状态往返、run 冻结与改参重置。

use control_engine::sixdof_runtime::compute_destroyer_sixdof_step_json;

fn base_request(state_json: &str) -> String {
    format!(r#"{{
      "modelId": "destroyer_hifi",
      "dtS": 0.5,
      "targetHeadingDeg": 0.0,
      "controlMode": "manual",
      "manualRudderDeg": 0.0,
      "disturbanceEnabled": false,
      "state": {state_json}
    }}"#)
}

fn legacy_state() -> String {
    r#"{
      "timeS": 0.0, "headingDeg": 0.0, "yawRateDegS": 0.0,
      "positionXM": 0.0, "positionYM": 0.0, "rudderDeg": 0.0,
      "speedMps": 15.0
    }"#.to_string()
}

#[test]
fn first_step_creates_manifest_and_legacy_state_rebuilds() {
    let out = compute_destroyer_sixdof_step_json(&base_request(&legacy_state())).unwrap();
    let v: serde_json::Value = serde_json::from_str(&out).unwrap();
    assert_eq!(v["runManifest"]["modelVersion"], "sixdof-destroyer-v1");
    assert_eq!(v["manifestReset"], true, "首步必须生成新 run manifest");
    assert_eq!(v["timeS"], 0.5);
    // 兼容重建：初速 15 m/s 保持（六自由体速度首分量）。
    let six = &v["sixdofState"];
    assert!((six["bodyVelocity"][0].as_f64().unwrap() - 15.0).abs() < 1.0, "一步后仍在巡航量级");
    assert_eq!(six["bodyVelocity"].as_array().unwrap().len(), 6);
}

#[test]
fn manifest_round_trips_until_controller_changes() {
    let first = compute_destroyer_sixdof_step_json(&base_request(&legacy_state())).unwrap();
    let v1: serde_json::Value = serde_json::from_str(&first).unwrap();
    let state1 = format!(
        r#"{{"timeS": {}, "headingDeg": {}, "yawRateDegS": {}, "positionXM": {}, "positionYM": {},
            "rudderDeg": {}, "speedMps": {}, "sixdofState": {}, "runManifest": {} }}"#,
        v1["timeS"], v1["headingDeg"], v1["yawRateDegS"], v1["positionXM"], v1["positionYM"],
        v1["rudderDeg"], v1["speedMps"], v1["sixdofState"], v1["runManifest"],
    );
    // 同控制器同掩码：同一 run（reset=false）。
    let second = compute_destroyer_sixdof_step_json(&base_request(&state1)).unwrap();
    let v2: serde_json::Value = serde_json::from_str(&second).unwrap();
    assert_eq!(v2["manifestReset"], false, "同控制器不得换 run");
    assert_eq!(v2["runManifest"]["manifestId"], v1["runManifest"]["manifestId"]);
    // 改控制器（P 增益出现）：换 run（reset=true、新 manifestId）。
    let changed = base_request(&state1).replace("\"controlMode\": \"manual\"", "\"controlMode\": \"pid\"");
    let third = compute_destroyer_sixdof_step_json(&changed).unwrap();
    let v3: serde_json::Value = serde_json::from_str(&third).unwrap();
    assert_eq!(v3["manifestReset"], true, "控制器变化必须生成新 run");
    assert_ne!(v3["runManifest"]["manifestId"], v1["runManifest"]["manifestId"]);
    // 因素掩码变化（disturbance 开启）同样换 run。
    let toggled = base_request(&state1).replace("\"disturbanceEnabled\": false", "\"disturbanceEnabled\": true");
    let fourth = compute_destroyer_sixdof_step_json(&toggled).unwrap();
    let v4: serde_json::Value = serde_json::from_str(&fourth).unwrap();
    assert_eq!(v4["manifestReset"], true);
    assert_eq!(v4["runManifest"]["factorMask"][0], "disturbance");
}

#[test]
fn sixdof_state_round_trip_is_continuous() {
    let first = compute_destroyer_sixdof_step_json(&base_request(&legacy_state())).unwrap();
    let v1: serde_json::Value = serde_json::from_str(&first).unwrap();
    let state1 = format!(
        r#"{{"timeS": {}, "headingDeg": {}, "yawRateDegS": {}, "positionXM": {}, "positionYM": {},
            "rudderDeg": {}, "speedMps": {}, "sixdofState": {} }}"#,
        v1["timeS"], v1["headingDeg"], v1["yawRateDegS"], v1["positionXM"], v1["positionYM"],
        v1["rudderDeg"], v1["speedMps"], v1["sixdofState"],
    );
    let second = compute_destroyer_sixdof_step_json(&base_request(&state1)).unwrap();
    let v2: serde_json::Value = serde_json::from_str(&second).unwrap();
    // 状态连续：时间精确推进、航向无跳变（零舵令直航）。
    assert_eq!(v2["timeS"].as_f64().unwrap(), 1.0);
    assert!(v2["headingDeg"].as_f64().unwrap().abs() < 1e-6);
    assert_eq!(v2["sixdofState"]["bodyVelocity"].as_array().unwrap().len(), 6);
}

#[test]
fn invalid_frame_duration_is_rejected() {
    for bad in ["{ \"dtS\": 0.0 }", "{ \"dtS\": -1.0 }", "{ \"dtS\": 2.0 }"] {
        let request = format!(
            "{{ \"dtS\": {}, \"controlMode\": \"manual\", \"state\": {{}} }}",
            serde_json::from_str::<serde_json::Value>(bad).unwrap()["dtS"]
        );
        assert!(compute_destroyer_sixdof_step_json(&request).is_err(), "dt 应被拒绝: {bad}");
    }
}
