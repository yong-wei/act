//! Smogeli 型通气/出水损失算例（issue-2156 阶段 B2.2）。

use control_engine::sixdof::actuators::{
    PropellerInstallation, PropellerModel, propeller_loads, propeller_loads_with_ventilation,
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
fn fixed_installation_follows_heave_pitch_and_roll() {
    let installation = PropellerInstallation {
        position_body_m: [-50.0, 4.0, 3.0],
        reference_immersion_m: 5.0,
    };
    let identity = [1.0, 0.0, 0.0, 0.0];
    assert_eq!(installation.immersion_depth([20.0, 30.0, 1.0], identity, 0.5), 6.5);
    let angle = 0.2_f64;
    let pitch = [(angle / 2.0).cos(), 0.0, (angle / 2.0).sin(), 0.0];
    let expected_pitch = 5.0 + 50.0 * angle.sin() + 3.0 * (angle.cos() - 1.0);
    assert!((installation.immersion_depth([0.0; 3], pitch, 0.0) - expected_pitch).abs() < 1e-12);
    let roll = [(angle / 2.0).cos(), (angle / 2.0).sin(), 0.0, 0.0];
    let expected_roll = 5.0 + 4.0 * angle.sin() + 3.0 * (angle.cos() - 1.0);
    assert!((installation.immersion_depth([0.0; 3], roll, 0.0) - expected_roll).abs() < 1e-12);
}

fn plant_with_depth(depth: f64) -> control_engine::sixdof::DestroyerSixDofPlant {
    use control_engine::sixdof::{DestroyerSixDofConfig, DestroyerSixDofPlant};
    let mut plant = DestroyerSixDofPlant::new(DestroyerSixDofConfig::default());
    plant.set_propeller_installation(PropellerInstallation {
        position_body_m: [-80.0, 0.0, 3.0],
        reference_immersion_m: depth,
    }).unwrap();
    plant
}

#[test]
fn online_plant_reduces_both_thrust_and_shaft_loading() {
    use control_engine::sixdof::DestroyerCommands;
    let mut wet = plant_with_depth(10.0);
    let mut emerged = plant_with_depth(-10.0);
    let command = DestroyerCommands::default();
    wet.step_with_dt(0.05, command).unwrap();
    emerged.step_with_dt(0.05, command).unwrap();
    assert!(wet.state().body_velocity[0] > emerged.state().body_velocity[0]);
    let wet_omega = wet.state().actuator_states.propeller_shaft_speed_rad_s[0];
    let emerged_omega = emerged.state().actuator_states.propeller_shaft_speed_rad_s[0];
    assert!(emerged_omega > wet_omega, "失去水动力负载后轴系应按惯量减速更慢");
    assert!(emerged_omega < 12.0, "电机切断后摩擦仍消耗轴能");
    let expected_friction_only = (12.0 + 5000.0 / 400.0)
        * (-400.0_f64 * 0.05 / 24000.0).exp() - 5000.0 / 400.0;
    assert!((emerged_omega - expected_friction_only).abs() < 1e-9);
}

#[test]
fn propeller_installation_rejects_nonfinite_geometry() {
    for value in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        let mut installation = PropellerInstallation {
            position_body_m: [0.0, 0.0, 3.0], reference_immersion_m: value,
        };
        assert!(installation.validate().is_err());
        installation.reference_immersion_m = 5.0;
        installation.position_body_m[1] = value;
        assert!(installation.validate().is_err());
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

#[test]
fn factor_is_continuous_across_zero_immersion() {
    // Review 修复回归：浸没跨越零点（出水/再入水）因子连续趋零，
    // 无 ~30% 湿态推力瞬切；小步进内变化有界。
    let m = model();
    let mut prev: Option<[f64; 2]> = None;
    let mut i = -20i32;
    while i <= 40 {
        let h = i as f64 * 0.02; // −0.4 .. 0.8 m 步进 2cm。
        let f = ventilation_loss_factors(&m, h, 0.4);
        if let Some(p) = prev {
            assert!(
                (f[0] - p[0]).abs() < 0.05 && (f[1] - p[1]).abs() < 0.05,
                "h={h} 跨零步进应平滑：{p:?} → {f:?}"
            );
        }
        prev = Some(f);
        i += 1;
    }
    // 逼近零时因子趋零。
    let f = ventilation_loss_factors(&m, 1e-6, 0.4);
    assert!(f[0] < 0.02, "h→0⁺ 因子应趋零：{f:?}");
}
