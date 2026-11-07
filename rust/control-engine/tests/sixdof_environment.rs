//! 环境与观测链算例（issue-2156-p1 阶段 A 验收）。

use control_engine::sixdof::{
    FaultKind, GustProcess, NoiseLevel, Quality, SensorChannel, TrueWind, WaveCondition,
    WaveField, WindEnvironment, WindHullGeometry, channel_seed, fujiwara_loads,
    relative_wind_body, SEED_TRAINING,
};

fn stats(values: &[f64]) -> (f64, f64) {
    let n = values.len() as f64;
    let mean = values.iter().sum::<f64>() / n;
    let var = values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / (n - 1.0);
    (mean, var.sqrt())
}

// ---------- A1 波场 ----------

#[test]
fn wave_field_energy_matches_hs_definition() {
    // m0 = var(η) ≈ Hs²/16（统计容差内）。
    for condition in [WaveCondition::v1(), WaveCondition::v2(), WaveCondition::v3()] {
        let field = WaveField::new(SEED_TRAINING, condition);
        // 谱归一化精确对账：Σaᵢ²/2 = Hs²/16（验收核心）。
        let target = condition.hs_m * condition.hs_m / 16.0;
        assert!(
            (field.energy_sum() - target).abs() < 1e-9 * target.max(1e-9),
            "Hs={}: Σa²/2={} vs Hs²/16={}",
            condition.hs_m, field.energy_sum(), target
        );
        // 序列各态历经方差：多向分量拍频周期可达数 ks，有限窗内允许带宽。
        let values: Vec<f64> = (0..400_000).map(|i| field.elevation(i as f64 * 0.05, 0.0, 0.0)).collect();
        let (_, sigma) = stats(&values);
        let m0 = sigma * sigma;
        assert!(
            m0 / target > 0.70 && m0 / target < 1.08,
            "Hs={}: 序列 m0={} 应在各态历经带宽内（目标 {}）", condition.hs_m, m0, target
        );
        assert!(field.component_count() > 300, "128×7 向量场应有足量分量");
    }
}

#[test]
fn wave_field_is_deterministic_and_shallow_depth_changes_dispersion() {
    let a = WaveField::new(SEED_TRAINING, WaveCondition::v1());
    let b = WaveField::new(SEED_TRAINING, WaveCondition::v1());
    for t in [0.0, 1.3, 27.7] {
        assert_eq!(a.elevation(t, 5.0, -3.0), b.elevation(t, 5.0, -3.0), "同 seed 必须逐点一致");
    }
    // 浅水（40m）轨道速度/色散不同：波面序列在深浅水间不同。
    let shallow = WaveField::new(SEED_TRAINING, WaveCondition::lng_berth());
    // k 只进空间相位：在非零位置比较（原点波面与 k 无关是 Airy 线性波的
    // 正确性质，深浅水差异显现在空间结构与轨道速度）。
    let differs = (0..1000).any(|i| {
        let t = i as f64 * 0.1;
        (shallow.elevation(t, 50.0, 30.0) - a.elevation(t, 50.0, 30.0)).abs() > 1e-9
    }) || (0..200).any(|i| {
        let t = i as f64 * 0.25;
        shallow.orbital_velocity(t, 0.0, 0.0, -5.0) != a.orbital_velocity(t, 0.0, 0.0, -5.0)
    });
    assert!(differs, "水深必须进入色散（深浅水空间结构/轨道速度不同）");
    // 二阶 QTF 未就绪：显式 false（不伪造慢漂）。
    assert!(!a.second_order_available());
}

#[test]
fn wave_first_order_loads_share_phase_with_surface() {
    // 同一波场：一阶激励与波面同源（时刻联动，无独立相位）。
    let field = WaveField::new(SEED_TRAINING, WaveCondition::v1());
    let coeffs = [1.0e5, 5.0e4, 2.0e5, 1.0e6, 2.0e6, 5.0e5];
    let t1 = 3.0;
    let loads = field.first_order_loads(t1, coeffs);
    // eta=0 时刻激励不为负向峰值（同相正弦族；此断言校验共用同一 arg）。
    // 同源线性：Fz = c·η 逐点同号（相关=+1，无整流直流偏置）。
    let mut same_sign = 0usize;
    let mut samples = 0usize;
    let mut min_load = f64::INFINITY;
    let mut max_load = f64::NEG_INFINITY;
    for i in 0..20000 {
        let t = i as f64 * 0.01;
        let eta = field.elevation(t, 0.0, 0.0);
        let l = field.first_order_loads(t, coeffs);
        samples += 1;
        if eta * l[2] >= 0.0 {
            same_sign += 1;
        }
        min_load = min_load.min(l[2]);
        max_load = max_load.max(l[2]);
    }
    assert!(same_sign == samples, "Fz 与 η 必须逐点同号（线性同相）");
    assert!(min_load < 0.0 && max_load > 0.0, "带符号载荷必须换向（无整流直流）");
    assert!((max_load + min_load).abs() / (max_load - min_load) < 0.2, "均值漂移应近零");
}

// ---------- A2 风 ----------

#[test]
fn gust_process_is_deterministic_and_bounded() {
    let mut a = GustProcess::new(SEED_TRAINING, 1.0, 10.0);
    let mut b = GustProcess::new(SEED_TRAINING, 1.0, 10.0);
    a.advance_to(60.0);
    b.advance_to(60.0);
    assert_eq!(a.components(), b.components(), "阵风子流确定性");
    // 长程标准差接近 sigma（平稳 OU）。
    let mut g = GustProcess::new(43, 2.0, 10.0);
    let mut samples = Vec::new();
    for step in 1..=8000 {
        g.advance_to(step as f64 * 0.5);
        samples.push(g.components()[0]);
    }
    let (_, sigma) = stats(&samples[1000..]);
    assert!((sigma - 2.0).abs() / 2.0 < 0.25, "平稳标准差≈σ：{sigma}");
}

#[test]
fn wind_from_semantics_and_relative_flow() {
    // FROM 60°：风矢量指向 240°（NED = -cos60, -sin60 方向）。
    let wind = TrueWind { speed_mps: 8.0, from_deg: 60.0, gust_ned: [0.0, 0.0] };
    let v = wind.velocity_ned();
    assert!(v[0] < 0.0 && v[1] < 0.0, "FROM 60° 风吹向西南：{:?}", v);
    assert!((v[0].hypot(v[1]) - 8.0).abs() < 1e-9);
    // 相对风：静止船 ψ=0，船速 u=10 → rel_x = -10（迎风）。
    let rel = relative_wind_body([0.0, 0.0], 0.0, [10.0, 0.0, 0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0]);
    assert!((rel[0] + 10.0).abs() < 1e-9 && rel[1].abs() < 1e-9);
    // 安装点角速度补偿：ω_z=0.1、r=[0,20,0] → 点速度 x=ω_z·(-r_y)=-2 → rel_x=+2。
    let rel2 = relative_wind_body([0.0, 0.0], 0.0, [0.0, 0.0, 0.0, 0.0, 0.0, 0.1], [0.0, 20.0, 0.0]);
    assert!((rel2[0] - 2.0).abs() < 1e-9, "ω×r 必须从相对风中扣除（x 分量）");
}

#[test]
fn wind_ablation_switch_semantics() {
    let geo = WindHullGeometry {
        frontal_area_m2: 380.0,
        lateral_area_m2: 1200.0,
        length_m: 180.0,
        pressure_center_body: [4.0, 0.0, -6.0],
    };
    let wind = TrueWind { speed_mps: 0.0, from_deg: 0.0, gust_ned: [0.0, 0.0] };
    let nu = [15.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    // enabled + 零真风：航行相对气流 → 负向 x 阻力。
    let enabled = WindEnvironment { true_wind: wind, wind_force_enabled: true };
    let loads = enabled.loads(0.0, nu, &geo);
    assert!(loads[0] < 0.0, "航行相对气流必须产生迎风阻力：{}", loads[0]);
    // disabled：气动严格零（水动力不在本模块，合同上不受影响）。
    let disabled = WindEnvironment { true_wind: wind, wind_force_enabled: false };
    let loads_off = disabled.loads(0.0, nu, &geo);
    assert_eq!(loads_off, [0.0; 6], "消融关闭=气动力严格归零");
    // 8 m/s W1 工况：横风产生显著横向力与 r×F 力矩。
    let w1 = WindEnvironment {
        true_wind: TrueWind { speed_mps: 8.0, from_deg: 60.0, gust_ned: [0.0, 0.0] },
        wind_force_enabled: true,
    };
    let loads_w1 = w1.loads(0.0, [0.0; 6], &geo);
    assert!(loads_w1[1].abs() > 1.0e4, "W1 横向风力应显著：{}", loads_w1[1]);
    assert!(loads_w1[3].abs() > 0.0, "压力中心 r×F 产生横摇力矩");
}

// ---------- A3 传感器链 ----------

#[test]
fn sensor_channel_variance_bias_and_delay() {
    // 转艏率通道 N1：白噪 sigma=0.02、时延 0.05 s。
    let mut ch = SensorChannel::new("yaw_rate", channel_seed(SEED_TRAINING, 1), NoiseLevel::N1).unwrap();
    assert_eq!(ch.rate_hz(), 20.0);
    let mut arrived = Vec::new();
    for frame in 0..(600 * 240) {
        let t = frame as f64 / 240.0;
        if let Some(m) = ch.advance(t, |ts| (0.5 * ts.cos(), 0.0)) {
            arrived.push(m);
        }
    }
    assert!(arrived.len() > 10_000, "20Hz 通道 600s 应有上万样本：{}", arrived.len());
    // 时延队列：到达时间 - 采样时间 = 0.05。
    for m in arrived.iter().take(50) {
        assert!((m.t_arrive_s - m.t_sample_s - 0.05).abs() < 1e-9, "时延必须入队");
    }
    // 误差（相对真值）样本标准差：白噪+量化量级（容差带宽）。
    let errors: Vec<f64> = arrived[200..]
        .iter()
        .map(|m| m.value - 0.5 * m.t_sample_s.cos())
        .collect();
    let (_, sigma) = stats(&errors);
    assert!(sigma > 0.005 && sigma < 0.1, "误差量级在白噪+偏置带内：{sigma}");
    // N0：无误差、API 保留 → 误差≈0。
    let mut ch0 = SensorChannel::new("yaw_rate", channel_seed(SEED_TRAINING, 1), NoiseLevel::N0).unwrap();
    let mut errors0 = Vec::new();
    for frame in 0..2400 {
        let t = frame as f64 / 240.0;
        if let Some(m) = ch0.advance(t, |ts| (0.5 * ts.cos(), 0.0)) {
            errors0.push(m.value - 0.5 * m.t_sample_s.cos());
        }
    }
    let max_err = errors0.iter().fold(0.0f64, |acc, e| acc.max(e.abs()));
    assert!(max_err < 1.5e-3, "N0 仅量化残差：{max_err}");
}

#[test]
fn sensor_faults_have_physical_continuity() {
    // F1：航向偏置 1 s 斜坡升至 2°。
    let mut ch = SensorChannel::new("heading_gyro", channel_seed(SEED_TRAINING, 0), NoiseLevel::N0).unwrap();
    ch.set_fault(Some(FaultKind::HeadingBiasRamp { t_start: 180.0 }));
    let read = |ch: &mut SensorChannel, t: f64| -> f64 {
        ch.advance(t, |_| (10.0, 0.0)).map(|m| m.value).unwrap_or(f64::NAN)
    };
    // 连续帧驱动到 180.7：时延队列排空后读最新到达（t≈180.6）。
    let mut latest = 0.0;
    for frame in 0..(1807 * 24) {
        let t = frame as f64 / 240.0;
        if let Some(m) = ch.advance(t, |_| (10.0, 0.0)) {
            latest = m.value;
        }
    }
    assert!((latest - 11.0).abs() < 0.16, "斜坡段内（时延 0.1 s，t≈180.5）+1.0°：{latest}");
    let ch2 = &mut SensorChannel::new("heading_gyro", channel_seed(SEED_TRAINING, 0), NoiseLevel::N0).unwrap();
    ch2.set_fault(Some(FaultKind::HeadingBiasRamp { t_start: 180.0 }));
    let mut final_v = 0.0;
    for frame in 0..(200 * 240) {
        let t = frame as f64 / 240.0;
        if let Some(m) = ch2.advance(t, |_| (10.0, 0.0)) {
            final_v = m.value;
        }
    }
    assert!((final_v - 12.0).abs() < 1e-6, "斜坡完成 +2°：{final_v}");

    // F2：GNSS 缺失窗口 → quality=Missing、值非 0（NaN 语义）、不回读真值。
    let mut gnss = SensorChannel::new("gnss_ne", channel_seed(SEED_TRAINING, 2), NoiseLevel::N0).unwrap();
    gnss.set_fault(Some(FaultKind::GnssOutage { t_start: 180.0, t_end: 200.0 }));
    let mut saw_missing = 0;
    let mut saw_zero_fill = false;
    for frame in 0..(220 * 240) {
        let t = frame as f64 / 240.0;
        if let Some(m) = gnss.advance(t, |_| (123.4, 0.0)) {
            if m.quality == Quality::Missing {
                saw_missing += 1;
                if m.value == 0.0 {
                    saw_zero_fill = true;
                }
                assert!(m.value.is_nan(), "缺测不得以 0 冒充");
            }
        }
    }
    assert!(saw_missing >= 90, "缺测窗口样本：{saw_missing}");
    assert!(!saw_zero_fill);
}

#[test]
fn sensor_streams_are_independent_and_noise_level_scales() {
    // N0↔N1 切换不消费对方子流；N2 误差≈2×N1（同真值序列下白噪带宽翻倍）。
    let run_sigma = |level: NoiseLevel| -> f64 {
        let mut ch = SensorChannel::new("gnss_ne", channel_seed(29, 2), level).unwrap();
        let mut errs = Vec::new();
        for frame in 0..(120 * 240) {
            let t = frame as f64 / 240.0;
            if let Some(m) = ch.advance(t, |_| (0.0, 0.0)) {
                errs.push(m.value);
            }
        }
        stats(&errs[100..]).1
    };
    let s1 = run_sigma(NoiseLevel::N1);
    let s2 = run_sigma(NoiseLevel::N2);
    assert!(
        s2 > s1 * 1.5 && s2 < s1 * 2.8,
        "N2 误差带宽应约 2×N1：N1={s1} N2={s2}"
    );
}


// ---------- PR #2171 review 修复回归 ----------

#[test]
fn crosswind_sign_reverses_lateral_load_and_moments_use_rx_f() {
    let geo = WindHullGeometry {
        frontal_area_m2: 380.0, lateral_area_m2: 1200.0, length_m: 180.0,
        pressure_center_body: [4.0, 0.0, -6.0],
    };
    // 左右舷横风：横向力必须反号（保留舷侧信息）。
    let loads_r = fujiwara_loads([0.0, -8.0], &geo);
    let (fx_r, fy_r, k_r, n_r) = (loads_r[0], loads_r[1], loads_r[2], loads_r[3]);
    let loads_l = fujiwara_loads([0.0, 8.0], &geo);
    let (fx_l, fy_l, _k_l, _n_l) = (loads_l[0], loads_l[1], loads_l[2], loads_l[3]);
    assert!(fy_r > 0.0 && fy_l < 0.0, "右舷/左舷来风横向力反号：{fy_r} vs {fy_l}");
    // r×F 叉乘顺序：K = −r_z·Fy、N = r_x·Fy − r_y·Fx（Fz=0）。
    let r = geo.pressure_center_body;
    let expected_k = -r[2] * fy_r;
    let expected_n = r[0] * fy_r - r[1] * fx_r;
    assert!((k_r - expected_k).abs() < 1e-6, "K 应为 r×F 的 x 分量：{k_r} vs {expected_k}");
    assert!((n_r - expected_n).abs() < 1e-6, "N 应为 r×F 的 z 分量：{n_r} vs {expected_n}");
    // 顺风（rel_x>0，风从艉来）→ 推力性（cx 正端）；迎风 → 阻力。
    let fx_tail = fujiwara_loads([8.0, 0.0], &geo)[0];
    let fx_head = fujiwara_loads([-8.0, 0.0], &geo)[0];
    assert!(fx_head < fx_tail, "迎风阻力应大于顺风：head={fx_head} tail={fx_tail}");
}

#[test]
fn gust_advance_is_incremental_and_reproducible() {
    let mut direct = GustProcess::new(SEED_TRAINING, 1.0, 10.0);
    direct.advance_to(1.0);
    let mut split = GustProcess::new(SEED_TRAINING, 1.0, 10.0);
    split.advance_to(0.5);
    split.advance_to(1.0);
    assert_eq!(direct.components(), split.components(), "分帧推进必须与直进一致");
    let frozen = direct.components();
    direct.advance_to(1.0);
    assert_eq!(direct.components(), frozen, "重复同 t 不得消耗随机流");
}

#[test]
fn shallow_water_orbital_velocity_respects_seabed() {
    let field = WaveField::new(SEED_TRAINING, WaveCondition::dredger_site());
    let t = 3.0;
    // 海床 z=-h：垂向分量=0（不穿透）、水平分量非零。
    let bed = field.orbital_velocity(t, 0.0, 0.0, -20.0);
    assert!(bed[2].abs() < 1e-9, "海床处垂向轨道速度为零：{}", bed[2]);
    assert!(bed[0].abs() > 0.0 || bed[1].abs() > 0.0, "海床处水平分量最大");
    // 表面 z=0：垂向分量非零（波面运动）。
    let surface = field.orbital_velocity(t, 0.0, 0.0, 0.0);
    assert!(surface[2].abs() > 0.0);
}

#[test]
fn wind_direction_quality_only_applies_to_wind_channel() {
    // 非风通道（航向陀螺 N0）辅助值 0 不触发 Undefined。
    let mut ch = SensorChannel::new("heading_gyro", channel_seed(SEED_TRAINING, 0), NoiseLevel::N0).unwrap();
    let mut good = 0usize;
    for frame in 0..(50 * 240) {
        let t = frame as f64 / 240.0;
        if let Some(m) = ch.advance(t, |_| (10.0, 0.0)) {
            assert_eq!(m.quality, Quality::Good);
            good += 1;
        }
    }
    assert!(good > 400, "航向通道应正常出数：{good}");
    // 风通道低风速 → Undefined。
    let mut wind_ch = SensorChannel::new("wind", channel_seed(SEED_TRAINING, 7), NoiseLevel::N0).unwrap();
    let mut undefined_seen = false;
    for frame in 0..(50 * 240) {
        let t = frame as f64 / 240.0;
        if let Some(m) = wind_ch.advance(t, |_| (5.0, 0.3)) {
            if m.quality == Quality::Undefined {
                undefined_seen = true;
            }
        }
    }
    assert!(undefined_seen, "风速 0.3 < 1.0 时风向应 Undefined");
}
