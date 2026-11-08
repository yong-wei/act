//! StudentModel 辨识/评价内核算例（issue-2148-p1 阶段 A）。

use control_engine::sixdof::student_model::*;

/// 用已知 Nomoto 一阶系统生成数据 → 辨识 → 验证精度。
/// 采样约定与 identify 一致：output[k] 为施加 input[k] 之前的状态采样。
#[test]
fn nomoto1_identification_recovers_known_system() {
    let dt = 0.1f64;
    let k_true = 0.08f64;
    let t_true = 25.0f64;
    // 生成：阶跃激励 + ZOH 一阶推进（先记录 y[k]，再施加 u[k]）。
    let n = 500;
    let input: Vec<f64> = (0..n).map(|i| if i < 50 { 0.0 } else { 10.0 }).collect();
    let a = (-dt / t_true).exp();
    let b = k_true * (1.0 - a);
    let mut output = Vec::with_capacity(n);
    let mut y = 0.0;
    for &u in &input {
        output.push(y);
        y = a * y + b * u;
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
    // 生成 FOPDT 响应（先记录 y[k]，再施加延迟输入）。
    let a = (-dt / t_true).exp();
    let b = k_true * (1.0 - a);
    let delay_steps = (delay_true / dt) as usize;
    let mut output = Vec::with_capacity(n);
    let mut y = 0.0;
    for (i, _) in input.iter().enumerate() {
        output.push(y);
        let u = if i >= delay_steps { input[i - delay_steps] } else { 0.0 };
        y = a * y + b * u;
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
        train_out.push(y);
        y = a * y + b * u;
    }
    let result = identify_nomoto1(&train_in, &train_out, dt);
    assert!(result.identified_ok);
    if let Some(ModelStructure::Nomoto1 { k: ik, t_s: it }) = result.structure {
        // 冻结模型，新激励（正弦）。
        let test_in: Vec<f64> = (0..200).map(|i| 5.0 * (i as f64 * 0.05).sin()).collect();
        let predicted = predict(&ModelStructure::Nomoto1 { k: ik, t_s: it }, &test_in, train_out[299], dt);
        // predict 时序：predicted[0]=y0，predicted[k+1] 为 input[k] 作用后的响应。
        // 真值同约定生成（先记录 y[k] 再施加 u[k]）→ 逐点对齐。
        let mut truth = Vec::new();
        let mut y2 = train_out[299];
        let a2 = (-dt / t).exp();
        let b2 = k * (1.0 - a2);
        for &u in &test_in {
            truth.push(y2);
            y2 = a2 * y2 + b2 * u;
        }
        assert_eq!(predicted.len(), truth.len() + 1, "predict 应返回 y0+响应");
        assert!((predicted[0] - truth[0]).abs() < 1e-12, "首元素=初始值");
        let metrics = evaluate(&predicted[..truth.len()], &truth).unwrap();
        assert!(metrics.rmse < 0.01, "冻结模型预测残差应小：{metrics:?}");
    }
}

/// 快系统 + 变号激励：采样约定差一拍会破坏回归（review 场景）。
/// 约定正确时即使 T=0.5s、dt=0.1s、交替激励也应精确恢复参数。
#[test]
fn fast_alternating_excitation_recovers_parameters() {
    let dt = 0.1f64;
    let k_true = 0.8f64;
    let t_true = 0.5f64;
    let n = 400;
    // 变号激励：±1 交替 + 阶跃段，避免慢系统近似掩盖时序错位。
    let input: Vec<f64> = (0..n)
        .map(|i| match i / 50 {
            0 | 2 | 4 => 1.0,
            1 | 3 => -1.0,
            _ => 0.6,
        })
        .collect();
    let a = (-dt / t_true).exp();
    let b = k_true * (1.0 - a);
    let mut output = Vec::with_capacity(n);
    let mut y = 0.0;
    for &u in &input {
        output.push(y);
        y = a * y + b * u;
    }

    let result = identify_nomoto1(&input, &output, dt);
    assert!(result.identified_ok, "快系统变号激励应辨识成功：{:?}", result.failure_reason);
    if let Some(ModelStructure::Nomoto1 { k, t_s }) = result.structure {
        assert!((k - k_true).abs() / k_true < 0.02, "K 精度：{k} vs {k_true}");
        assert!((t_s - t_true).abs() / t_true < 0.02, "T 精度：{t_s} vs {t_true}");
    } else {
        panic!("结构应为 Nomoto1");
    }
}

// ---------- 阶段 B1：Nomoto 二阶 + 横摇振子 ----------

/// RK4 推进二阶系统 ÿ = (K·u − y − (T1+T2)·ẏ)/(T1·T2)，细子步保证生成精度。
fn simulate_second_order(
    k: f64,
    t1: f64,
    t2: f64,
    input: &[f64],
    y0: f64,
    dt: f64,
) -> Vec<f64> {
    let mut out = Vec::with_capacity(input.len());
    let (mut y, mut yd) = (y0, 0.0);
    out.push(y);
    for &u in input {
        let accel = |yy: f64, yyd: f64| (k * u - yy - (t1 + t2) * yyd) / (t1 * t2);
        let (h, steps) = (dt / 10.0, 10);
        for _ in 0..steps {
            let k1y = yd;
            let k1v = accel(y, yd);
            let k2y = yd + 0.5 * h * k1v;
            let k2v = accel(y + 0.5 * h * k1y, yd + 0.5 * h * k1v);
            let k3y = yd + 0.5 * h * k2v;
            let k3v = accel(y + 0.5 * h * k2y, yd + 0.5 * h * k2v);
            let k4y = yd + h * k3v;
            let k4v = accel(y + h * k3y, yd + h * k3v);
            y += h / 6.0 * (k1y + 2.0 * k2y + 2.0 * k3y + k4y);
            yd += h / 6.0 * (k1v + 2.0 * k2v + 2.0 * k3v + k4v);
        }
        out.push(y);
    }
    out
}


/// RK4 推进横摇振子 φ̈ = −ωn²·φ − 2ζωn·φ̇ + G·u（细子步）。
fn simulate_oscillator(
    wn: f64,
    z: f64,
    g: f64,
    input: &[f64],
    phi0: f64,
    dt: f64,
) -> Vec<f64> {
    let mut out = Vec::with_capacity(input.len());
    let (mut phi, mut phi_d) = (phi0, 0.0);
    out.push(phi);
    for &u in input {
        let accel = |p: f64, pd: f64| -wn * wn * p - 2.0 * z * wn * pd + g * u;
        let (h, steps) = (dt / 10.0, 10);
        for _ in 0..steps {
            let k1y = phi_d;
            let k1v = accel(phi, phi_d);
            let k2y = phi_d + 0.5 * h * k1v;
            let k2v = accel(phi + 0.5 * h * k1y, phi_d + 0.5 * h * k1v);
            let k3y = phi_d + 0.5 * h * k2v;
            let k3v = accel(phi + 0.5 * h * k2y, phi_d + 0.5 * h * k2v);
            let k4y = phi_d + h * k3v;
            let k4v = accel(phi + h * k3y, phi_d + h * k3v);
            phi += h / 6.0 * (k1y + 2.0 * k2y + 2.0 * k3y + k4y);
            phi_d += h / 6.0 * (k1v + 2.0 * k2v + 2.0 * k3v + k4v);
        }
        out.push(phi);
    }
    out
}

#[test]
fn nomoto2_identification_recovers_known_system() {
    let dt = 0.1f64;
    let k_true = 0.05f64;
    let t1_true = 8.0f64;
    let t2_true = 1.5f64;
    // 多段阶跃激励保证二阶参数可辨识。
    let n = 800;
    let input: Vec<f64> = (0..n)
        .map(|i| match i / 100 {
            0 | 2 => 5.0,
            1 | 3 => 0.0,
            _ => 10.0,
        })
        .collect();
    let output = simulate_second_order(k_true, t1_true, t2_true, &input, 0.0, dt);
    // 生成器含 y0，比 input 多一个元素——对齐到回归约定。
    let output = &output[..n];

    let result = identify_nomoto2(&input, output, dt);
    assert!(result.identified_ok, "辨识应成功：{:?}", result.failure_reason);
    if let Some(ModelStructure::Nomoto2 { k, t1_s, t2_s }) = result.structure {
        assert!((k - k_true).abs() / k_true < 0.05, "K：{k} vs {k_true}");
        assert!((t1_s - t1_true).abs() / t1_true < 0.08, "T1：{t1_s} vs {t1_true}");
        assert!((t2_s - t2_true).abs() / t2_true < 0.08, "T2：{t2_s} vs {t2_true}");
    } else {
        panic!("结构应为 Nomoto2");
    }
}

#[test]
fn nomoto2_predict_matches_identified() {
    let dt = 0.1f64;
    let (k_true, t1_true, t2_true) = (0.05f64, 8.0f64, 1.5f64);
    let train_in: Vec<f64> = (0..600)
        .map(|i| match i / 120 {
            0 => 8.0,
            1 => 0.0,
            2 => 12.0,
            _ => 4.0,
        })
        .collect();
    let train_out_full = simulate_second_order(k_true, t1_true, t2_true, &train_in, 0.0, dt);
    let train_out = &train_out_full[..train_in.len()];
    let result = identify_nomoto2(&train_in, train_out, dt);
    assert!(result.identified_ok);

    // 新激励预测（正弦 + 阶跃）。
    let test_in: Vec<f64> = (0..300)
        .map(|i| 6.0 + 4.0 * (i as f64 * 0.03).sin())
        .collect();
    let y0 = train_out_full[train_in.len()];
    let predicted = predict(
        &ModelStructure::Nomoto2 {
            k: match result.structure {
                Some(ModelStructure::Nomoto2 { k, .. }) => k,
                _ => unreachable!(),
            },
            t1_s: match result.structure {
                Some(ModelStructure::Nomoto2 { t1_s, .. }) => t1_s,
                _ => unreachable!(),
            },
            t2_s: match result.structure {
                Some(ModelStructure::Nomoto2 { t2_s, .. }) => t2_s,
                _ => unreachable!(),
            },
        },
        &test_in,
        y0,
        dt,
    );
    let truth_full = simulate_second_order(k_true, t1_true, t2_true, &test_in, y0, dt);
    let truth = &truth_full[..test_in.len()];
    let metrics = evaluate(&predicted[..truth.len()], truth).unwrap();
    assert!(metrics.rmse < 0.05, "冻结模型预测残差应小：{metrics:?}");
}

#[test]
fn roll_oscillator_identification_recovers_frequency_and_damping() {
    let dt = 0.1f64;
    let wn_true = 0.6f64; // ≈10.5 s 周期。
    let z_true = 0.12f64;
    let g_true = 0.02f64;
    // 自由衰减：φ0=8°、零输入。
    let n = 1200; // 120 s ≈ 11 个周期。
    let zero_in = vec![0.0; n];
    let free_full = simulate_oscillator(wn_true, z_true, 0.0, &zero_in, 8.0, dt);
    let free = &free_full[..n];
    // 小激励段：正弦鳍激励 u=5·sin(0.5t)。
    let n2 = 600;
    let e_in: Vec<f64> = (0..n2).map(|i| 5.0 * (i as f64 * dt * 0.5).sin()).collect();
    let e_out_full = simulate_oscillator(wn_true, z_true, g_true, &e_in, 0.0, dt);
    let e_out = &e_out_full[..n2];

    let result = identify_roll_oscillator(free, dt, Some((&e_in, e_out)));
    assert!(result.identified_ok, "辨识应成功：{:?}", result.failure_reason);
    if let Some(ModelStructure::RollOscillator { natural_freq_rad_s: wn, damping: z, control_gain: g }) =
        result.structure
    {
        assert!((wn - wn_true).abs() / wn_true < 0.05, "ωn：{wn} vs {wn_true}");
        assert!((z - z_true).abs() / z_true < 0.15, "ζ：{z} vs {z_true}");
        assert!((g - g_true).abs() / g_true < 0.10, "G：{g} vs {g_true}");
    } else {
        panic!("结构应为 RollOscillator");
    }
}

#[test]
fn roll_oscillator_predict_matches_free_decay() {
    let dt = 0.1f64;
    let (wn_true, z_true, g_true) = (0.6f64, 0.12f64, 0.02f64);
    // 用真值结构预测正弦激励响应，与真值生成对比。
    let n = 400;
    let input: Vec<f64> = (0..n).map(|i| 5.0 * (i as f64 * dt * 0.45).sin()).collect();
    let predicted = predict(
        &ModelStructure::RollOscillator {
            natural_freq_rad_s: wn_true,
            damping: z_true,
            control_gain: g_true,
        },
        &input,
        0.0,
        dt,
    );
    let truth_full = simulate_oscillator(wn_true, z_true, g_true, &input, 0.0, dt);
    let truth = &truth_full[..n];
    assert_eq!(predicted.len(), truth.len() + 1);
    let metrics = evaluate(&predicted[..truth.len()], truth).unwrap();
    assert!(metrics.rmse < 0.15, "振子预测残差应小：{metrics:?}");
}

#[test]
fn roll_identification_fails_on_flat_data() {
    let flat = vec![3.0; 200];
    let result = identify_roll_oscillator(&flat, 0.1, None);
    assert!(!result.identified_ok, "平直数据无振荡结构");
    assert!(result.failure_reason.is_some());
}

#[test]
fn nomoto2_fails_on_no_excitation() {
    let input = vec![5.0; 100];
    let output = vec![1.0; 100];
    let result = identify_nomoto2(&input, &output, 0.1);
    assert!(!result.identified_ok);
    assert!(result.failure_reason.is_some());
}

#[test]
fn roll_gain_fit_survives_alternating_input() {
    // Review 场景：逐点交替 0/5 激励下中心差分差一拍会低估 G≈50%；
    // 叠加拟合按 ZOH 时序应精确恢复。
    let dt = 0.1f64;
    let (wn_true, z_true, g_true) = (0.6f64, 0.12f64, 0.02f64);
    let n2 = 600;
    let e_in: Vec<f64> = (0..n2).map(|i| if i % 2 == 0 { 5.0 } else { 0.0 }).collect();
    let e_out_full = simulate_oscillator(wn_true, z_true, g_true, &e_in, 0.0, dt);
    let e_out = &e_out_full[..n2];
    // 自由衰减段。
    let zero_in = vec![0.0; 1200];
    let free_full = simulate_oscillator(wn_true, z_true, 0.0, &zero_in, 8.0, dt);
    let free = &free_full[..1200];

    let result = identify_roll_oscillator(free, dt, Some((&e_in, e_out)));
    assert!(result.identified_ok, "交替激励应辨识成功：{:?}", result.failure_reason);
    if let Some(ModelStructure::RollOscillator { control_gain: g, .. }) = result.structure {
        assert!(
            (g - g_true).abs() / g_true < 0.05,
            "交替输入下 G 应精确恢复：{g} vs {g_true}"
        );
    }
}

#[test]
fn roll_identification_rejects_unusable_excited_segment() {
    let dt = 0.1f64;
    let (wn_true, z_true) = (0.6f64, 0.12f64);
    let zero_in = vec![0.0; 1200];
    let free_full = simulate_oscillator(wn_true, z_true, 0.0, &zero_in, 8.0, dt);
    let free = &free_full[..1200];

    // 全零激励输入。
    let flat_in = vec![3.0; 200];
    let flat_out = vec![0.0; 200];
    let r = identify_roll_oscillator(free, dt, Some((&flat_in, &flat_out)));
    assert!(!r.identified_ok, "恒定激励输入应显式失败");
    assert!(r.failure_reason.is_some());

    // 含 NaN 激励段。
    let mut nan_in = vec![0.0; 200];
    nan_in[10] = f64::NAN;
    let nan_out = vec![0.0; 200];
    let r = identify_roll_oscillator(free, dt, Some((&nan_in, &nan_out)));
    assert!(!r.identified_ok, "NaN 激励段应显式失败");

    // 长度不匹配。
    let short_in = vec![1.0; 50];
    let long_out = vec![0.0; 60];
    let r = identify_roll_oscillator(free, dt, Some((&short_in, &long_out)));
    assert!(!r.identified_ok, "长度不匹配应显式失败");

    // None（有意省略）仍成功，G=0。
    let r = identify_roll_oscillator(free, dt, None);
    assert!(r.identified_ok, "省略激励段应保留自由衰减结构");
    if let Some(ModelStructure::RollOscillator { control_gain: g, .. }) = r.structure {
        assert_eq!(g, 0.0);
    }
}

// ---------- 阶段 B2：DP 低频 3×3 + 挖泥横移通道 ----------

#[test]
fn dp_low_freq_recovers_known_3x3() {
    // 已知稳定离散系统 x[k+1]=A·x[k]+B·u[k]（含横向交叉项 a12/a21）。
    let a_true: [f64; 9] = [
        0.98, 0.02, 0.00,
        0.05, 0.96, 0.01,
        0.00, 0.03, 0.97,
    ];
    let b_true: [f64; 9] = [
        0.010, 0.000, 0.000,
        0.001, 0.008, 0.000,
        0.000, 0.002, 0.006,
    ];
    let n = 600;
    let dt = 0.1f64;
    let _ = dt;
    // 三通道独立伪随机激励（可复现 LCG）。
    let mut seed = 12345u64;
    let mut rnd = || {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        ((seed >> 33) as f64 / (u32::MAX as f64)) - 0.5
    };
    let (mut ix, mut iy, mut in_n) = (Vec::new(), Vec::new(), Vec::new());
    for k in 0..n {
        let hold = if k % 40 == 0 { rnd() } else { 0.0 };
        ix.push(2000.0 * hold + 100.0 * rnd());
        let hold2 = if k % 30 == 0 { rnd() } else { 0.0 };
        iy.push(1500.0 * hold2 + 80.0 * rnd());
        let hold3 = if k % 50 == 0 { rnd() } else { 0.0 };
        in_n.push(500.0 * hold3 + 40.0 * rnd());
    }
    // 生成状态序列（先记录 x[k] 再施加 u[k]）。
    let (mut px, mut py, mut ph) = (Vec::new(), Vec::new(), Vec::new());
    let mut x = [10.0, -5.0, 0.02];
    for k in 0..n {
        px.push(x[0]);
        py.push(x[1]);
        ph.push(x[2]);
        let u = [ix[k], iy[k], in_n[k]];
        // 先整体计算新状态再写回（就地更新会让后续行混用新旧行分量）。
        let mut x_next = [0.0f64; 3];
        for i in 0..3 {
            x_next[i] = a_true[i * 3] * x[0] + a_true[i * 3 + 1] * x[1] + a_true[i * 3 + 2] * x[2]
                + b_true[i * 3] * u[0] + b_true[i * 3 + 1] * u[1] + b_true[i * 3 + 2] * u[2];
        }
        x = x_next;
    }

    let result = identify_dp_low_freq(&ix, &iy, &in_n, &px, &py, &ph, 0.1);
    assert!(result.identified_ok, "辨识应成功：{:?}", result.failure_reason);
    if let Some(ModelStructure::DpLowFreq3 { a, b }) = result.structure {
        for (idx, (got, want)) in a.iter().zip(a_true.iter()).enumerate() {
            assert!(
                (got - want).abs() < 1e-6,
                "A[{idx}]：{got} vs {want}"
            );
        }
        for (idx, (got, want)) in b.iter().zip(b_true.iter()).enumerate() {
            assert!(
                (got - want).abs() < 1e-6,
                "B[{idx}]：{got} vs {want}"
            );
        }
    } else {
        panic!("结构应为 DpLowFreq3");
    }
    assert!(result.residual_rms < 1e-9, "无噪数据残差应≈0：{}", result.residual_rms);
}

#[test]
fn dp_low_freq_predict_round_trip() {
    let a: [f64; 9] = [0.98, 0.02, 0.0, 0.05, 0.96, 0.01, 0.0, 0.03, 0.97];
    let b: [f64; 9] = [0.01, 0.0, 0.0, 0.001, 0.008, 0.0, 0.0, 0.002, 0.006];
    let structure = ModelStructure::DpLowFreq3 { a: a.to_vec(), b: b.to_vec() };
    let n = 200;
    let ix: Vec<f64> = (0..n).map(|k| if k % 20 == 0 { 1500.0 } else { 50.0 }).collect();
    let iy: Vec<f64> = (0..n).map(|k| if k % 25 == 0 { -800.0 } else { 30.0 }).collect();
    let in_n: Vec<f64> = (0..n).map(|k| if k % 30 == 0 { 400.0 } else { 10.0 }).collect();
    let states = predict_dp(&structure, &ix, &iy, &in_n, [0.0; 3]).unwrap();
    assert_eq!(states.len(), n);
    // 手工对照前 3 步。
    let mut x = [0.0f64; 3];
    for k in 0..3 {
        assert_eq!(states[k], x, "states[k]=施加输入前的状态");
        let mut x_next = [0.0f64; 3];
        for i in 0..3 {
            x_next[i] = a[i * 3] * x[0] + a[i * 3 + 1] * x[1] + a[i * 3 + 2] * x[2]
                + b[i * 3] * ix[k] + b[i * 3 + 1] * iy[k] + b[i * 3 + 2] * in_n[k];
        }
        x = x_next;
    }
    // 单通道 predict 对多通道结构 → 恒 y0（显式契约）。
    let flat = predict(&structure, &ix, 7.0, 0.1);
    assert!(flat.iter().all(|&v| v == 7.0));
}

#[test]
fn dp_low_freq_fails_on_unexcited_channel() {
    let n = 100;
    let ix = vec![1000.0 + (n as f64) * 0.0; 100];
    let ix: Vec<f64> = (0..n).map(|k| 100.0 * ((k % 17) as f64).sin()).collect();
    let iy = vec![0.0; n]; // 零激励通道。
    let in_n: Vec<f64> = (0..n).map(|k| 30.0 * ((k % 23) as f64).cos()).collect();
    let px: Vec<f64> = (0..n).map(|i| i as f64 * 0.1).collect();
    let py: Vec<f64> = (0..n).map(|i| (i as f64 * 0.05).sin()).collect();
    let ph: Vec<f64> = (0..n).map(|i| 0.01 * (i as f64 * 0.02).sin()).collect();
    let result = identify_dp_low_freq(&ix, &iy, &in_n, &px, &py, &ph, 0.1);
    assert!(!result.identified_ok, "y 通道零激励应失败");
    assert!(result.failure_reason.is_some());
}

#[test]
fn dredge_channel_picks_lower_residual_structure() {
    let dt = 0.1f64;
    // 二阶真值数据：二阶候选残差更低 → 应选 Nomoto2。
    let (k_true, t1_true, t2_true) = (0.05f64, 8.0f64, 1.5f64);
    let n = 800;
    let input: Vec<f64> = (0..n)
        .map(|i| match i / 100 {
            0 | 2 => 5.0,
            1 | 3 => 0.0,
            _ => 10.0,
        })
        .collect();
    let output_full = simulate_second_order(k_true, t1_true, t2_true, &input, 0.0, dt);
    let output = &output_full[..n];
    let result = identify_dredge_channel(&input, output, dt);
    assert!(result.identified_ok, "应成功：{:?}", result.failure_reason);
    assert!(
        matches!(result.structure, Some(ModelStructure::Nomoto2 { .. })),
        "二阶数据应选 Nomoto2"
    );

    // 一阶真值数据：应选 Nomoto1 且恢复参数。
    let (k1, t1) = (0.08f64, 20.0f64);
    let input2: Vec<f64> = (0..400).map(|i| if i < 40 { 0.0 } else { 10.0 }).collect();
    let a = (-dt / t1).exp();
    let b = k1 * (1.0 - a);
    let mut output2 = Vec::new();
    let mut y = 0.0;
    for &u in &input2 {
        output2.push(y);
        y = a * y + b * u;
    }
    let result2 = identify_dredge_channel(&input2, &output2, dt);
    assert!(result2.identified_ok);
    if let Some(ModelStructure::Nomoto1 { k, t_s }) = result2.structure {
        assert!((k - k1).abs() / k1 < 0.05);
        assert!((t_s - t1).abs() / t1 < 0.05);
    } else {
        panic!("一阶数据应选 Nomoto1");
    }

    // 两侧都失败（恒定输入）→ 合并失败原因。
    let flat_in = vec![5.0; 100];
    let flat_out = vec![1.0; 100];
    let result3 = identify_dredge_channel(&flat_in, &flat_out, dt);
    assert!(!result3.identified_ok);
    assert!(result3.failure_reason.is_some());
}
