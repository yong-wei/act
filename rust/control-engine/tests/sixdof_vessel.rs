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

// ---------- 控制律统一（#2147：与 destroyer_hifi 共享 control_law） ----------

#[test]
fn vessel_p_mode_wraps_heading_error_across_180() {
    // target 170 / heading −170 → 误差 −20°（非 340°）；prevErrorDeg 直接暴露。
    let request = r#"{
      "dtS": 0.5,
      "targetHeadingDeg": 170.0,
      "controlMode": "p",
      "pid": {"kp": 2.0, "ki": 0.0, "kd": 0.0},
      "vessel": {},
      "state": {"timeS": 0.0, "headingDeg": -170.0, "speedMps": 15.0}
    }"#;
    let out = compute_vessel_sixdof_step_json(request).unwrap();
    let v: serde_json::Value = serde_json::from_str(&out).unwrap();
    let prev_error = v["prevErrorDeg"].as_f64().unwrap();
    assert!((prev_error - (-20.0)).abs() < 1e-9, "wrap 后误差：{prev_error}");
    assert_eq!(v["integralDegS"].as_f64().unwrap(), 0.0, "P 模式无积分");
    // kp=2 × (−20°) = −40° 舵令（限幅内）→ 实际舵向负向打。
    assert!(v["rudderDeg"].as_f64().unwrap() < 0.0, "舵令应为负");
}

#[test]
fn vessel_pid_integral_round_trips() {
    let frame1 = r#"{
      "dtS": 0.5,
      "targetHeadingDeg": 10.0,
      "controlMode": "pid",
      "pid": {"kp": 1.0, "ki": 0.5, "kd": 0.0},
      "vessel": {},
      "state": {"timeS": 0.0, "headingDeg": 0.0, "speedMps": 15.0,
                "integralDegS": 0.0, "prevErrorDeg": 0.0}
    }"#;
    let out1 = compute_vessel_sixdof_step_json(frame1).unwrap();
    let v1: serde_json::Value = serde_json::from_str(&out1).unwrap();
    assert!((v1["integralDegS"].as_f64().unwrap() - 5.0).abs() < 1e-9, "积分=误差×dt");

    // 第二帧带回积分/前值误差 → 积分继续累积。
    let frame2 = format!(
        r#"{{
      "dtS": 0.5,
      "targetHeadingDeg": 10.0,
      "controlMode": "pid",
      "pid": {{"kp": 1.0, "ki": 0.5, "kd": 0.0}},
      "vessel": {{}},
      "state": {{"timeS": {}, "headingDeg": {}, "speedMps": {},
                 "integralDegS": {}, "prevErrorDeg": {}, "sixdofState": {}}}
    }}"#,
        v1["timeS"], v1["headingDeg"], v1["speedMps"],
        v1["integralDegS"], v1["prevErrorDeg"], v1["sixdofState"],
    );
    let out2 = compute_vessel_sixdof_step_json(&frame2).unwrap();
    let v2: serde_json::Value = serde_json::from_str(&out2).unwrap();
    // 误差仍≈10°（半秒内转艏有限）→ 积分≈5+误差2×0.5。
    let integral2 = v2["integralDegS"].as_f64().unwrap();
    assert!(
      integral2 > 9.0 && integral2 < 11.0,
      "积分应继续累积：{integral2}"
    );
}

#[test]
fn vessel_pd_mode_uses_derivative_state() {
    // prevErrorDeg=4、误差=10 → 微分 (10−4)/0.5=12；kd=1 → 舵令含 +12 分量。
    let request = r#"{
      "dtS": 0.5,
      "targetHeadingDeg": 10.0,
      "controlMode": "pd",
      "pid": {"kp": 0.0, "ki": 0.0, "kd": 1.0},
      "vessel": {},
      "state": {"timeS": 0.0, "headingDeg": 0.0, "speedMps": 15.0,
                "prevErrorDeg": 4.0}
    }"#;
    let out = compute_vessel_sixdof_step_json(request).unwrap();
    let v: serde_json::Value = serde_json::from_str(&out).unwrap();
    assert!((v["prevErrorDeg"].as_f64().unwrap() - 10.0).abs() < 1e-9);
    // 正舵令（微分项驱动），积分恒 0。
    assert!(v["rudderDeg"].as_f64().unwrap() > 0.0, "微分项应打正舵");
    assert_eq!(v["integralDegS"].as_f64().unwrap(), 0.0);
}

#[test]
fn vessel_rejects_unknown_control_mode() {
    let request = r#"{
      "dtS": 0.5,
      "controlMode": "bangbang",
      "vessel": {},
      "state": {}
    }"#;
    assert!(
      compute_vessel_sixdof_step_json(request).is_err(),
      "未知控制模式应 fail-closed"
    );
}
