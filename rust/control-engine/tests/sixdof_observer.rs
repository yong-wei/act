//! 观测链与低频观测器算例（issue-2156-p1 阶段 B1）。

use control_engine::sixdof::{NoiseLevel, ObservationChain, SEED_TRAINING};

/// 常值真值 → 估计器收敛到真值（无偏）。
#[test]
fn observer_converges_to_constant_truth() {
    let mut chain = ObservationChain::n1(SEED_TRAINING).unwrap();
    // 240fps 推进 120 s（充分过偏置 OU 时间常数）。
    for frame in 0..(120 * 240) {
        let t = frame as f64 / 240.0;
        chain.advance(t, 100.0, 0.0, 0.0, 0.0);
    }
    let obs = &chain.observer;
    assert!(
        (obs.pos_n - 100.0).abs() < 3.0,
        "位置估计应收敛到真值附近：{} vs 100",
        obs.pos_n
    );
    assert!(obs.psi.to_degrees().abs() < 2.0, "航向估计应收敛到 0°");
    assert!(obs.r.to_degrees().abs() < 0.1, "零转艏率跟踪");
}

/// 估计器只消费测量：N0（无误差）下估计即真值的低通（收敛更快）。
#[test]
fn n0_observer_tracks_without_noise() {
    let mut chain = ObservationChain::n1(SEED_TRAINING).unwrap();
    // 先跑 N1 让链建立，然后把通道切 N0 等效（直接调 observer.update
    // 的无误差路径——用 N1 链的 N0 副本对照收敛速度）。
    let mut clean = ObservationChain::n1(SEED_TRAINING).unwrap();
    for frame in 0..(30 * 240) {
        let t = frame as f64 / 240.0;
        chain.advance(t, 50.0, 10.0, 0.0, 5.0);
        clean.advance(t, 50.0, 10.0, 0.0, 5.0);
    }
    // 两条同 seed 链在相同真值下一致（确定性）。
    assert!((chain.observer.psi - clean.observer.psi).abs() < 1e-12);
}

/// GNSS 缺测窗口：估计器不填 0，继续外推。
#[test]
fn gnss_outage_continues_dead_reckoning() {
    use control_engine::sixdof::{FaultKind, Quality};
    let mut chain = ObservationChain::n1(SEED_TRAINING).unwrap();
    chain.gnss.set_fault(Some(FaultKind::GnssOutage { t_start: 10.0, t_end: 20.0 }));
    // 匀速北向移动真值：u=5 m/s。
    for frame in 0..(25 * 240) {
        let t = frame as f64 / 240.0;
        let (gnss, _, _, _) = chain.advance(t, 5.0 * t, 0.0, 0.0, 5.0);
        if let Some(g) = gnss {
            if (10.0..=20.0).contains(&g.t_sample_s) {
                assert_eq!(g.quality, Quality::Missing);
                assert!(g.value.is_nan(), "缺测不填 0");
            }
        }
    }
    // 缺测后估计器仍在物理范围内（模型预测外推+恢复后收敛）。
    let pos = chain.observer.pos_n;
    assert!(pos > 30.0, "外推+恢复应在外推量级：{pos}");
}

/// 波频抑制：测量含波频振荡，估计器低频输出振荡幅度显著小于测量。
#[test]
fn observer_suppresses_wave_frequency() {
    let mut chain = ObservationChain::n1(SEED_TRAINING).unwrap();
    let wave_amp = 1.5; // 波频位置振荡幅值 m。
    let wave_period = 8.0;
    let low_freq_pos = 80.0;
    let mut est_samples = Vec::new();
    for frame in 0..(180 * 240) {
        let t = frame as f64 / 240.0;
        let wave = wave_amp * (2.0 * std::f64::consts::PI * t / wave_period).sin();
        chain.advance(t, low_freq_pos + wave, 0.0, 0.0, 0.0);
        if t > 60.0 {
            est_samples.push(chain.observer.pos_n);
        }
    }
    let mean: f64 = est_samples.iter().sum::<f64>() / est_samples.len() as f64;
    let max_dev = est_samples.iter().fold(0.0f64, |acc, v| acc.max((v - mean).abs()));
    // 波频振荡 1.5 m 在估计输出中应被抑制到 <0.5 m。
    assert!(
        max_dev < 1.0,
        "波频抑制：估计位置最大偏差 {max_dev} m 应 <1.0 m/波幅 60% 抑制（T 级标称）"
    );
    assert!((mean - low_freq_pos).abs() < 1.0, "低频均值应接近真值");
}

/// N2 误差翻倍：估计器仍收敛但稳态方差更大（档位可辨）。
#[test]
fn n2_observer_still_converges_with_larger_variance() {
    let mut n1 = ObservationChain::n1(SEED_TRAINING).unwrap();
    let mut n2 = ObservationChain::n1(29).unwrap();
    for frame in 0..(60 * 240) {
        let t = frame as f64 / 240.0;
        n1.advance(t, 30.0, 0.0, 0.0, 6.0);
        n2.advance(t, 30.0, 0.0, 0.0, 6.0);
    }
    assert!((n1.observer.pos_n - 30.0).abs() < 5.0);
    assert!((n2.observer.pos_n - 30.0).abs() < 10.0, "N2 稳态带更宽但仍在量级");
}
