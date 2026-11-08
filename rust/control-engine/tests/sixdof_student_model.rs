//! StudentModel 辨识/评价内核算例（issue-2148-p1 阶段 A）。

use control_engine::sixdof::student_model::*;

/// 用已知 Nomoto 一阶系统生成数据 → 辨识 → 验证精度。
#[test]
fn nomoto1_identification_recovers_known_system() {
    let dt = 0.1f64;
    let k_true = 0.08f64;
    let t_true = 25.0f64;
    // 生成：阶跃激励 + ZOH 一阶推进。
    let n = 500;
    let input: Vec<f64> = (0..n).map(|i| if i < 50 { 0.0 } else { 10.0 }).collect();
    let a = (-dt / t_true).exp();
    let b = k_true * (1.0 - a);
    let mut output = Vec::with_capacity(n);
    let mut y = 0.0;
    for &u in &input {
        y = a * y + b * u;
        output.push(y);
    }

    let result = identify_nomoto1(&input, &output, dt);
    assert!(result.identified_ok, "辨识应成功");
    if let Some(ModelStructure::Nomoto1 { k, t_s }) = result.structure {
        assert!((k - k_true).abs() / k_true < 0.05, "K 精度：{k} vs {k_true}");
        assert!((t_s - t_true).abs() / t_true < 0.05, "T 精度：{t_s} vs {t_true}");
    } else {
        panic!("结构应为 Nomoto1");
    }
}

#[test]
fn identification_fails_on_no_excitation() {
    let input = vec![5.0; 100]; // 恒定输入
    let output = vec![1.0; 100];
    let result = identify_nomoto1(&input, &output, 0.1);
    assert!(!result.identified_ok, "恒定输入应失败");
    assert!(result.failure_reason.is_some());
}

#[test]
fn identification_fails_on_insufficient_data() {
    let input = vec![1.0; 5];
    let output = vec![0.0; 5];
    let result = identify_nomoto1(&input, &output, 0.1);
    assert!(!result.identified_ok);
}

#[test]
fn fopdt_identification_recovers_delay() {
    let dt = 0.5f64;
    let k_true = 0.5f64;
    let t_true = 10.0f64;
    let delay_true = 3.0f64; // 6 步
    let n = 300;
    let input: Vec<f64> = (0..n).map(|i| if i < 20 { 0.0 } else { 1.0 }).collect();
    // 生成 FOPDT 响应。
    let a = (-dt / t_true).exp();
    let b = k_true * (1.0 - a);
    let delay_steps = (delay_true / dt) as usize;
    let mut output = Vec::with_capacity(n);
    let mut y = 0.0;
    for (i, _) in input.iter().enumerate() {
        let u = if i >= delay_steps { input[i - delay_steps] } else { 0.0 };
        y = a * y + b * u;
        output.push(y);
    }

    let result = identify_fopdt(&input, &output, dt);
    assert!(result.identified_ok, "FOPDT 辨识应成功");
    if let Some(ModelStructure::Fopdt { k, t_s, delay_s }) = result.structure {
        assert!((k - k_true).abs() / k_true < 0.15, "K：{k} vs {k_true}");
        assert!((delay_s - delay_true).abs() < 1.0, "L：{delay_s} vs {delay_true}");
        let _ = t_s;
    }
}

#[test]
fn evaluation_metrics_fit_and_rmse() {
    let measured = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let predicted = vec![1.1, 2.1, 2.9, 4.1, 4.9];
    let m = evaluate(&predicted, &measured).unwrap();
    assert!(m.rmse > 0.0 && m.rmse < 0.2, "RMSE 量级：{m:?}");
    let fit = m.fit_percent.unwrap();
    assert!(fit > 90.0, "FIT 应高：{fit}");
}

#[test]
fn evaluation_fit_negative_for_bad_prediction() {
    let measured = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let predicted = vec![5.0, 4.0, 3.0, 2.0, 1.0]; // 完全反相
    let m = evaluate(&predicted, &measured).unwrap();
    let fit = m.fit_percent.unwrap();
    assert!(fit < 0.0, "FIT 应为负：{fit}");
}

#[test]
fn evaluation_not_applicable_when_flat() {
    let measured = vec![5.0, 5.0, 5.0, 5.0];
    let predicted = vec![5.1, 4.9, 5.1, 4.9];
    let m = evaluate(&predicted, &measured).unwrap();
    assert!(m.fit_percent.is_none(), "平值 → FIT 不适用");
}

#[test]
fn overshoot_correct_for_negative_step() {
    // 负阶跃：ref=0, y0=10, peak=-0.5 → Δy=−10, 超调=0.5/10=5%
    let o = overshoot_percent(0.0, 10.0, -0.5);
    assert_eq!(o, Some(5.0));
    // 零幅值参考 → None。
    assert!(overshoot_percent(5.0, 5.0, 6.0).is_none());
}

#[test]
fn settling_time_requires_min_hold() {
    // 进入带内但只保持 2 步（不足最短窗 5 步）→ 未收敛。
    let times: Vec<f64> = (0..10).map(|i| i as f64).collect();
    let y = vec![0.0, 1.0, 0.1, 0.05, 0.02, 0.01, 0.5, 0.1, 0.01, 0.01];
    let t_settle = settling_time(&times, &y, 0.0, 0.1, 5.0);
    assert!(t_settle.is_none(), "保持不足 → 未收敛");
    // 最后 5 个点在带内且保持 ≥5 步 → 收敛。
    let y2 = vec![1.0, 0.5, 0.2, 0.15, 0.05, 0.01, 0.01, 0.01, 0.01, 0.01];
    let t2_settle = settling_time(&times, &y2, 0.0, 0.1, 5.0);
    assert!(t2_settle.is_some(), "充分保持 → 收敛");
}

#[test]
fn angle_error_handles_wrapping() {
    // 179° vs −179° → |error| = 2°（不是 358°）。
    let e1 = angle_error(179.0_f64.to_radians(), -179.0_f64.to_radians()).to_degrees();
    assert!(e1.abs() < 2.01 && e1.abs() > 1.99, "179 vs -179: |e|={e1}");
    // −179° vs 179° → |error| = 2°。
    let e2 = angle_error(-179.0_f64.to_radians(), 179.0_f64.to_radians()).to_degrees();
    assert!(e2.abs() < 2.01 && e2.abs() > 1.99, "-179 vs 179: |e|={e2}");
    // 同值 → 0。
    assert!(angle_error(0.5, 0.5).abs() < 1e-12);
}

#[test]
fn predict_nomoto1_matches_identified() {
    // 辨识 → 冻结 → 新激励预测 → 评价残差应小。
    let dt = 0.1f64;
    let k = 0.05f64;
    let t = 20.0f64;
    let train_in: Vec<f64> = (0..300).map(|i| if i < 30 { 0.0 } else { 10.0 }).collect();
    let a = (-dt / t).exp();
    let b = k * (1.0 - a);
    let mut train_out = Vec::new();
    let mut y = 0.0;
    for &u in &train_in {
        y = a * y + b * u;
        train_out.push(y);
    }
    let result = identify_nomoto1(&train_in, &train_out, dt);
    assert!(result.identified_ok);
    if let Some(ModelStructure::Nomoto1 { k: ik, t_s: it }) = result.structure {
        // 冻结模型，新激励（正弦）。
        let test_in: Vec<f64> = (0..200).map(|i| 5.0 * (i as f64 * 0.05).sin()).collect();
        let predicted = predict(&ModelStructure::Nomoto1 { k: ik, t_s: it }, &test_in, train_out[299], dt);
        // predict 时序：predicted[0]=y0，predicted[k+1] 为 input[k] 作用后的响应。
        // 真值同约定生成 → 对齐 predicted[1..] 与 truth。
        let mut truth = Vec::new();
        let mut y2 = train_out[299];
        let a2 = (-dt / t).exp();
        let b2 = k * (1.0 - a2);
        for &u in &test_in {
            y2 = a2 * y2 + b2 * u;
            truth.push(y2);
        }
        assert_eq!(predicted.len(), truth.len() + 1, "predict 应返回 y0+响应");
        assert!((predicted[0] - train_out[299]).abs() < 1e-12, "首元素=初始值");
        let metrics = evaluate(&predicted[1..], &truth).unwrap();
        assert!(metrics.rmse < 0.01, "冻结模型预测残差应小：{metrics:?}");
    }
}
