//! Smogeli 型通气/出水损失算例（issue-2156 阶段 B2.2）。

use control_engine::sixdof::actuators::{
    PropellerModel, propeller_loads, propeller_loads_with_ventilation,
    ventilation_loss_factors,
};

fn model() -> PropellerModel {
    PropellerModel {
        diameter_m: 7.0,
        water_density: 1025.0,
        kt_coefficients: [0.45, -0.30, -0.05],
        kq_coefficients: [0.05, -0.02, -0.005],
    }
}

#[test]
fn deep_immersion_matches_wetted_loads() {
    let m = model();
    let base = propeller_loads(&m, 5.0, 8.0);
    // h/R = 3.5（适用域上界外钳位为全湿）。
    let with = propeller_loads_with_ventilation(&m, 5.0, 8.0, Some(12.25));
    assert_eq!(base, with, "深浸没不受通气影响");
    // None（不评估浸没）也保持湿态。
    let none_case = propeller_loads_with_ventilation(&m, 5.0, 8.0, None);
    assert_eq!(base, none_case);
}

#[test]
fn out_of_water_is_strictly_zero() {
    let m = model();
    let (t, q) = propeller_loads_with_ventilation(&m, 5.0, 8.0, Some(-0.3));
    assert_eq!((t, q), (0.0, 0.0), "轴心露出自由面：无水动力载荷");
    let (t0, q0) = propeller_loads_with_ventilation(&m, 5.0, 8.0, Some(0.0));
    assert_eq!((t0, q0), (0.0, 0.0));
}

#[test]
fn factor_monotone_in_immersion_and_loading() {
    let m = model();
    // 固定负载：浸没越浅损失越重（因子单调上升于 h/R）。
    let mut prev = -1.0;
    for i in 0..=30 {
        let h = i as f64 * 0.15; // 0..4.5 m（R=3.5）
        let f = ventilation_loss_factors(&m, h, 0.4)[0];
        if h > 0.0 {
            assert!(f >= prev - 1e-12, "h={h} 因子应随浸没单调不减：{f} < {prev}");
        }
        prev = f;
    }
    // 固定浸没（临界区 h/R≈1.3）：负载越重损失越重（因子单调下降于 |kT|）。
    let mut prev = 2.0;
    for i in 0..=10 {
        let kt = i as f64 * 0.1;
        let f = ventilation_loss_factors(&m, 4.55, kt)[0];
        assert!(f <= prev + 1e-12, "kt={kt} 重载应更早通气：{f} > {prev}");
        prev = f;
    }
}

#[test]
fn transition_is_continuous_around_critical() {
    let m = model();
    // 临界浸没附近无跳变（光滑 logistic）。
    let mut prev: Option<[f64; 2]> = None;
    for i in 0..=60 {
        let h = 2.0 + i as f64 * 0.02; // 覆盖 h_c∈[1,1.6]×R 邻域（R=3.5 → h≈3.5-5.6）
        let f = ventilation_loss_factors(&m, h, 0.5);
        if let Some(p) = prev {
            assert!(
                (f[0] - p[0]).abs() < 0.05 && (f[1] - p[1]).abs() < 0.05,
                "步进 0.02m 内变化应平滑：{p:?} → {f:?}"
            );
        }
        prev = Some(f);
    }
    // 扭矩因子 ≥ 推力因子（通气对转矩衰减较弱）。
    let f = ventilation_loss_factors(&m, 4.0, 0.5);
    assert!(f[1] >= f[0], "扭矩损失应弱于推力损失：{f:?}");
}

#[test]
fn ventilation_reduces_but_keeps_sign_and_scale() {
    let m = model();
    let (t_wet, _) = propeller_loads(&m, 5.0, 8.0);
    let (t_vent, q_vent) = propeller_loads_with_ventilation(&m, 5.0, 8.0, Some(3.0));
    // h/R≈0.86（临界以下）：显著损失但仍为正、量级不超湿态。
    assert!(t_vent > 0.0 && t_vent < t_wet, "部分通气：0 < T < 湿态（{t_vent} vs {t_wet}）");
    assert!(q_vent > 0.0);
    // 倒车象限符号保持（符号由转速承载，损失因子只乘模）。
    let (t_rev, _) = propeller_loads_with_ventilation(&m, -5.0, -8.0, Some(3.0));
    assert!(t_rev < 0.0, "倒车符号保持");
}
