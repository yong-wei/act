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

// ---------- PR #2170 review 修复回归 ----------

fn state_from(v: &serde_json::Value) -> String {
    format!(
        r#"{{"timeS": {}, "headingDeg": {}, "yawRateDegS": {}, "positionXM": {}, "positionYM": {},
            "rudderDeg": {}, "speedMps": {}, "sixdofState": {}, "runManifest": {} }}"#,
        v["timeS"], v["headingDeg"], v["yawRateDegS"], v["positionXM"], v["positionYM"],
        v["rudderDeg"], v["speedMps"], v["sixdofState"], v["runManifest"],
    )
}

fn run_frames(dt_s: f64, seconds: f64, disturbance: bool) -> serde_json::Value {
    let mut state = legacy_state();
    let frames = (seconds / dt_s) as usize;
    let mut last = serde_json::Value::Null;
    for _ in 0..frames {
        let mut request = base_request(&state).replace(
            "\"disturbanceEnabled\": false",
            &format!("\"disturbanceEnabled\": {disturbance}"),
        );
        request = request.replace(&format!("\"dtS\": 0.5"), &format!("\"dtS\": {dt_s}"));
        let out = compute_destroyer_sixdof_step_json(&request).unwrap();
        last = serde_json::from_str(&out).unwrap();
        state = state_from(&last);
    }
    last
}

#[test]
fn frame_rate_independence_after_torque_roundtrip() {
    // P1-1：扭矩随状态往返——1/60 与 0.5 s 分帧的同一物理过程收敛一致。
    let fast = run_frames(1.0 / 60.0, 10.0, false);
    let slow = run_frames(0.5, 10.0, false);
    let omega_fast = fast["sixdofState"]["shaftSpeedRadS"].as_f64().unwrap();
    let omega_slow = slow["sixdofState"]["shaftSpeedRadS"].as_f64().unwrap();
    assert!(
        (omega_fast - omega_slow).abs() < 1.0,
        "分帧不应改变物理：1/60 帧 {omega_fast} vs 0.5 帧 {omega_slow}"
    );
    let u_fast = fast["sixdofState"]["bodyVelocity"][0].as_f64().unwrap();
    let u_slow = slow["sixdofState"]["bodyVelocity"][0].as_f64().unwrap();
    assert!((u_fast - u_slow).abs() < 0.5, "巡航航速分帧一致：{u_fast} vs {u_slow}");
}

#[test]
fn disturbance_produces_observable_heading_deviation() {
    // P1-2：扰动开启产生可观察的航向/横荡现象（第 9 步教学语义保留）。
    let calm = run_frames(1.0 / 60.0, 60.0, false);
    let rough = run_frames(1.0 / 60.0, 60.0, true);
    let heading_calm = calm["headingDeg"].as_f64().unwrap().abs();
    let heading_rough = rough["headingDeg"].as_f64().unwrap().abs();
    let sway_rough = rough["sixdofState"]["bodyVelocity"][1].as_f64().unwrap().abs();
    assert!(
        heading_rough > heading_calm + 0.05,
        "扰动直航必须产生航向偏离：calm={heading_calm} rough={heading_rough}"
    );
    assert!(sway_rough > 0.05, "横流应产生横荡：{sway_rough}");
}

#[test]
fn heading_error_wraps_shortest_arc() {
    // P2-3：跨 ±180° 边界误差取最短圆周角（179 vs -179 → -2 而非 358）。
    let state = r#"{
      "timeS": 0.0, "headingDeg": -179.0, "yawRateDegS": 0.0,
      "positionXM": 0.0, "positionYM": 0.0, "rudderDeg": 0.0, "speedMps": 15.0
    }"#;
    let request = base_request(state)
        .replace("\"targetHeadingDeg\": 0.0", "\"targetHeadingDeg\": 179.0")
        .replace("\"controlMode\": \"manual\"", "\"controlMode\": \"p\", \"pid\": {\"kp\": 1.0, \"ki\": 0.0, \"kd\": 0.0}");
    let out = compute_destroyer_sixdof_step_json(&request).unwrap();
    let v: serde_json::Value = serde_json::from_str(&out).unwrap();
    let prev_error = v["prevErrorDeg"].as_f64().unwrap();
    assert!((prev_error + 2.0).abs() < 0.5, "最短圆周角误差应为 -2°，得到 {prev_error}");
}

#[test]
fn short_frame_advances_exactly_its_duration() {
    // P2-4：dtS=0.01 只推进 0.01 s（位置增量 ≈ 15×0.01，而非整个标称步）。
    let out = run_frames(0.01, 0.01, false);
    let x = out["positionXM"].as_f64().unwrap();
    assert!(
        (x - 15.0 * 0.01).abs() < 0.05,
        "0.01 s 帧位置增量应约 0.15 m，得到 {x}"
    );
    assert_eq!(out["timeS"].as_f64().unwrap(), 0.01);
}

#[test]
fn factor_mask_changes_run_identity() {
    // P2-5：相同初态、不同因素掩码 → 不同 manifestId（初态摘要纳入身份）。
    let calm_first = compute_destroyer_sixdof_step_json(&base_request(&legacy_state())).unwrap();
    let v1: serde_json::Value = serde_json::from_str(&calm_first).unwrap();
    let rough_request = base_request(&legacy_state())
        .replace("\"disturbanceEnabled\": false", "\"disturbanceEnabled\": true");
    let rough_first = compute_destroyer_sixdof_step_json(&rough_request).unwrap();
    let v2: serde_json::Value = serde_json::from_str(&rough_first).unwrap();
    assert_ne!(
        v1["runManifest"]["manifestId"], v2["runManifest"]["manifestId"],
        "不同因素掩码必须生成不同 run 身份"
    );
    let calm2 = compute_destroyer_sixdof_step_json(&base_request(&state_from(&v1))).unwrap();
    let v3: serde_json::Value = serde_json::from_str(&calm2).unwrap();
    assert_eq!(v3["runManifest"]["manifestId"], v1["runManifest"]["manifestId"], "同参同态不得换身份");
    // manifest 携带冻结初态摘要。
    assert!(v1["runManifest"]["initialState"].as_str().unwrap().starts_with("fnv1a-"));
}

#[test]
fn startup_transient_is_frame_rate_independent() {
    // P1（新）：限速器按子步时长——0.1 s 单请求与 12×1/120 的启动
    // 瞬态一致（扭矩/轴速在 0.1 s 时刻相等，而非仅终值稳态比较）。
    let single = run_frames(0.1, 0.1, false);
    // 12 × 1/120 s 分帧推进同一物理时长。
    let mut st = legacy_state();
    let mut final_v = serde_json::Value::Null;
    for _ in 0..12 {
        let request = base_request(&st).replace("\"dtS\": 0.5", "\"dtS\": 0.008333333333333333");
        let out = compute_destroyer_sixdof_step_json(&request).unwrap();
        final_v = serde_json::from_str(&out).unwrap();
        st = state_from(&final_v);
    }
    let torque_single = single["sixdofState"]["motorTorqueActualNm"].as_f64().unwrap();
    let torque_multi = final_v["sixdofState"]["motorTorqueActualNm"].as_f64().unwrap();
    let omega_single = single["sixdofState"]["shaftSpeedRadS"].as_f64().unwrap();
    let omega_multi = final_v["sixdofState"]["shaftSpeedRadS"].as_f64().unwrap();
    assert!(
        (torque_single - torque_multi).abs() / torque_multi.abs().max(1.0) < 0.05,
        "启动瞬态扭矩分帧一致：single={torque_single} multi={torque_multi}"
    );
    assert!((omega_single - omega_multi).abs() < 0.5, "轴速瞬态一致：{omega_single} vs {omega_multi}");
}

#[test]
fn wave_phase_advances_with_physical_clock() {
    // P1（新）：波浪相位随仿真时钟——连续帧下扰动运行出现非零横摇
    // （8 s 周期激励累积），且相位不逐帧归零。
    let rough = run_frames(1.0 / 60.0, 40.0, true);
    let calm = run_frames(1.0 / 60.0, 40.0, false);
    let roll_rough = rough["sixdofState"]["quaternion"][1].as_f64().unwrap().abs();
    let roll_calm = calm["sixdofState"]["quaternion"][1].as_f64().unwrap().abs();
    assert!(
        roll_rough > roll_calm + 1e-4,
        "波浪激励必须随时间累积出横摇：rough={roll_rough} calm={roll_calm}"
    );
}

#[test]
fn wave_excitation_varies_and_has_energy() {
    // JONSWAP 多向波场：激励应非零且随时间变化（非恒定、非单调），
    // 且扰动 vs 平静应有可辨差异（消费真实波场）。
    let step_at = |time_s: f64, disturbance: bool| -> f64 {
        let state = format!(
            "{{\"timeS\": {time_s}, \"headingDeg\": 0.0, \"yawRateDegS\": 0.0, \"speedMps\": 15.0}}"
        );
        let mut request = base_request(&state)
            .replace("\"dtS\": 0.5", "\"dtS\": 0.05")
            .replace("\"disturbanceEnabled\": false", &format!("\"disturbanceEnabled\": {disturbance}"));
        request = request.replace("\"controlMode\": \"manual\"", "\"controlMode\": \"p\", \"pid\": {\"kp\": 0.0, \"ki\": 0.0, \"kd\": 0.0}");
        let out = compute_destroyer_sixdof_step_json(&request).unwrap();
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        v["sixdofState"]["bodyVelocity"][3].as_f64().unwrap().abs()
    };
    // 扰动工况：激励随时间变化（不同时刻值不同）。
    let v1 = step_at(1.95, true);
    let v2 = step_at(3.95, true);
    let v3 = step_at(5.95, true);
    let values = [v1, v2, v3];
    let max_v = values.iter().fold(0.0f64, |a, v| a.max(*v));
    let min_v = values.iter().fold(f64::MAX, |a, v| a.min(*v));
    assert!(max_v > 1e-9, "波激励应非零：{max_v}");
    assert!(max_v - min_v > 1e-12, "激励应随时间变化：max={max_v} min={min_v}");
    // 平静 vs 扰动：扰动激发的横摇分量显著。
    let calm_roll = step_at(1.95, false);
    assert!(
        max_v > calm_roll + 1e-10,
        "扰动激励应大于平静：disturb={max_v} calm={calm_roll}"
    );
}


#[test]
fn parameter_pack_hash_change_resets_run_identity() {
    // P1-2：旧 run 的 parameterBundleHash 与当前包不一致时必须换身份。
    let first = compute_destroyer_sixdof_step_json(&base_request(&legacy_state())).unwrap();
    let v1: serde_json::Value = serde_json::from_str(&first).unwrap();
    // 伪造「旧包哈希」的状态回传：manifest 其余字段一致、哈希不同。
    let mut stale = v1["runManifest"].clone();
    stale["parameterBundleHash"] = serde_json::json!("old-pack@fnv1a-deadbeef");
    let state_stale = format!(
        r#"{{"timeS": {}, "headingDeg": {}, "speedMps": {}, "sixdofState": {}, "runManifest": {} }}"#,
        v1["timeS"], v1["headingDeg"], v1["speedMps"], v1["sixdofState"], stale,
    );
    let second = compute_destroyer_sixdof_step_json(&base_request(&state_stale)).unwrap();
    let v2: serde_json::Value = serde_json::from_str(&second).unwrap();
    assert_eq!(v2["manifestReset"], true, "参数包哈希不匹配必须重置 run");
    assert_ne!(v2["runManifest"]["manifestId"], v1["runManifest"]["manifestId"]);
}
