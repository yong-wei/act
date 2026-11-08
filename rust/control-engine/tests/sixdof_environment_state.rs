//! 真实环境场在线接入算例（issue-2156-p1 阶段 B1.4）。

use control_engine::sixdof::{
    EnvironmentState, EnvironmentSwitches, WaveCondition, WindHullGeometry, SEED_TRAINING,
};

fn geo() -> WindHullGeometry {
    WindHullGeometry {
        frontal_area_m2: 380.0,
        lateral_area_m2: 1200.0,
        length_m: 180.0,
        pressure_center_body: [4.0, 0.0, -6.0],
    }
}

#[test]
fn e1_combines_wind_wave_current_independently() {
    let mut env = EnvironmentState::e1(SEED_TRAINING);
    env.advance_to(30.0);

    // 风：8 m/s FROM 60° → NED 矢量指向 240°（负 N、负 E）。
    let wind_ned = env.wind.true_wind.velocity_ned();
    assert!(wind_ned[0] < 0.0 && wind_ned[1] < 0.0, "FROM 60° 风矢量：{:?}", wind_ned);

    // 流：0.3 m/s TO 90° → NED = (0, 0.3)（正东）。
    assert!((env.current_ned[0]).abs() < 1e-9);
    assert!((env.current_ned[1] - 0.3).abs() < 1e-9);

    // 波浪：V1 工况的激励非零（波场就绪）。
    let wave_loads = env.wave_loads(15.0, [1.0e5; 6]);
    assert!(wave_loads.iter().any(|v| v.abs() > 0.0), "V1 波浪激励应非零");

    // 风载：静止船受 8 m/s 横风分量 → 横向力显著。
    let wind = env.wind_loads(0.0, [0.0; 6], &geo());
    assert!(wind[1].abs() > 1.0e3, "E1 风载横向力：{}", wind[1]);

    // 体坐标流：ψ=0 → NED 直接映射 FRD（N→x_body, E→y_body）。
    let body = env.current_body(0.0);
    assert!((body[0] - 0.0).abs() < 1e-9, "ψ=0 时 x_body 流=N 分量");
    assert!((body[1] - 0.3).abs() < 1e-9, "ψ=0 时 y_body 流=E 分量");

    // 体坐标流：ψ=90° → N→y_body, E→−x_body。
    let body90 = env.current_body(std::f64::consts::FRAC_PI_2);
    assert!((body90[0] - 0.3).abs() < 1e-6, "ψ=90° x_body=N·cos+E·sin=0.3");
    assert!((body90[1] - 0.0).abs() < 1e-9, "ψ=90° y_body=−N·sin+E·cos=0");
}

#[test]
fn switches_are_independent() {
    let mut env = EnvironmentState::e1(SEED_TRAINING);
    env.advance_to(10.0);

    // 关风 → 风载严格零。
    env.switches.wind_force_enabled = false;
    env.wind.wind_force_enabled = false;
    let wind_off = env.wind_loads(0.0, [0.0; 6], &geo());
    assert_eq!(wind_off, [0.0; 6], "关风=气动严格零");

    // 关浪 → 激励零。
    env.switches.wave_enabled = false;
    let wave_off = env.wave_loads(15.0, [1.0e5; 6]);
    assert_eq!(wave_off, [0.0; 6], "关浪=激励零");

    // 关流 → 体坐标流零。
    env.switches.current_enabled = false;
    let cur_off = env.current_body(0.0);
    assert_eq!(cur_off, [0.0, 0.0], "关流=相对流零");
}

#[test]
fn calm_is_zero_forces_but_same_structures() {
    let mut env = EnvironmentState::calm(SEED_TRAINING);
    env.advance_to(60.0);
    // P0：全部关闭 → 载荷严格零。
    assert_eq!(env.wind_loads(0.0, [0.0; 6], &geo()), [0.0; 6]);
    assert_eq!(env.wave_loads(30.0, [1.0e5; 6]), [0.0; 6]);
    assert_eq!(env.current_body(0.0), [0.0, 0.0]);
    // 结构不删（波场仍存在，只是开关关）。
    assert!(env.wave.component_count() > 0);
}

#[test]
fn observation_chain_produces_estimates() {
    let mut env = EnvironmentState::e1(SEED_TRAINING);
    // 模拟 60 s：真值位置/航向 → 观测链 → 估计器。
    for frame in 0..(60 * 240) {
        let t = frame as f64 / 240.0;
        let pos_n = 50.0 + 2.0 * t; // 匀速北向。
        env.advance_to(t);
        env.advance_observation(t, pos_n, 5.0, 0.0, 2.0);
    }
    // 估计位置应在真值附近（50+120=170 m）。
    if let Some((est_n, _est_e, est_psi)) = env.estimated_position() {
        assert!(
            (est_n - 170.0).abs() < 15.0,
            "估计位置应接近 170 m：{est_n}"
        );
        assert!((est_psi.to_degrees() - 5.0).abs() < 5.0, "估计航向：{}", est_psi.to_degrees());
    } else {
        panic!("观测链应产生估计");
    }
}

#[test]
fn same_seed_same_environment_sequence() {
    let mut a = EnvironmentState::e1(SEED_TRAINING);
    let mut b = EnvironmentState::e1(SEED_TRAINING);
    for t in [0.0, 5.3, 17.7, 42.1] {
        a.advance_to(t);
        b.advance_to(t);
        // 波浪序列逐点一致。
        assert_eq!(a.wave.elevation(t, 10.0, 20.0), b.wave.elevation(t, 10.0, 20.0));
        // 阵风一致。
        assert_eq!(a.gust.components(), b.gust.components());
    }
}

#[test]
fn custom_condition_construction() {
    // E2: W2（12 m/s）+ V2（Hs 1.5）+ C2（0.5 m/s）。
    let env = EnvironmentState::new(
        SEED_TRAINING,
        EnvironmentSwitches::all_on(),
        WaveCondition::v2(),
        12.0, 60.0, 2.0,
        0.5, 90.0,
    );
    assert!((env.current_ned[1] - 0.5).abs() < 1e-9);
    assert_eq!(env.wave.condition().hs_m, 1.5);
}

// ---------- PR #2177 review 修复回归 ----------

#[test]
fn unified_switch_controls_wind_without_touching_inner_copy() {
    // P2：调用方只改 switches.wind_force_enabled，风载立即归零
    // （不依赖 WindEnvironment 内部副本）。
    let mut env = EnvironmentState::e1(SEED_TRAINING);
    env.advance_to(10.0);
    let before = env.wind_loads(0.0, [0.0; 6], &geo());
    assert!(before[1].abs() > 1.0e3, "开启时风载显著：{}", before[1]);
    env.switches.wind_force_enabled = false;
    let after = env.wind_loads(0.0, [0.0; 6], &geo());
    assert_eq!(after, [0.0; 6], "统一开关关闭=严格零（不改内部副本）");
    env.switches.wind_force_enabled = true;
    let restored = env.wind_loads(0.0, [0.0; 6], &geo());
    assert!(restored[1].abs() > 1.0e3, "重开恢复");
}
