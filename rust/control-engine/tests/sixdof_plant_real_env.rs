//! plant 真实环境场在线接线算例（issue-2156-p1 B1.4 后半段 / #2147）。

use control_engine::sixdof::{
    DestroyerCommands, DestroyerSixDofConfig, DestroyerSixDofPlant, EnvironmentState,
    WindHullGeometry, SEED_TRAINING,
};

fn geo() -> WindHullGeometry {
    WindHullGeometry {
        frontal_area_m2: 380.0,
        lateral_area_m2: 1200.0,
        length_m: 180.0,
        pressure_center_body: [4.0, 0.0, -6.0],
    }
}

fn calm_commands() -> DestroyerCommands {
    DestroyerCommands { rudder_command_rad: 0.0, motor_torque_command_nm: 1.543e6 }
}

#[test]
fn real_env_produces_distinct_wave_signal() {
    // 有真实波场（V1）与平静环境在 plant 输出产生不同横摇——
    // 证明 derivs 消费的是 EnvironmentState（非零等效场）。
    let mut with_env = DestroyerSixDofPlant::new(DestroyerSixDofConfig::default());
    with_env.set_environment_state(EnvironmentState::e1(SEED_TRAINING), geo());
    for _ in 0..(20 * 120) {
        with_env.step(calm_commands()).unwrap();
    }
    let roll_env = with_env.state().body_velocity[3];

    let mut calm = DestroyerSixDofPlant::new(DestroyerSixDofConfig::default());
    calm.set_environment_state(EnvironmentState::calm(SEED_TRAINING), geo());
    for _ in 0..(20 * 120) {
        calm.step(calm_commands()).unwrap();
    }
    let roll_calm = calm.state().body_velocity[3];

    // E1 波浪 + 风应产生更大的横摇分量。
    assert!(
        roll_env.abs() > roll_calm.abs(),
        "E1 环境应产生更大横摇：env={roll_env} calm={roll_calm}"
    );
}

#[test]
fn real_env_deterministic_same_seed() {
    let mut a = DestroyerSixDofPlant::new(DestroyerSixDofConfig::default());
    let mut b = DestroyerSixDofPlant::new(DestroyerSixDofConfig::default());
    let env_a = EnvironmentState::e1(SEED_TRAINING);
    let env_b = EnvironmentState::e1(SEED_TRAINING);
    a.set_environment_state(env_a, geo());
    b.set_environment_state(env_b, geo());
    for _ in 0..(10 * 120) {
        a.step(calm_commands()).unwrap();
        b.step(calm_commands()).unwrap();
    }
    // 同 seed 波场/阵风 → 同结果。
    for i in 0..6 {
        assert!(
            (a.state().body_velocity[i] - b.state().body_velocity[i]).abs() < 1e-12,
            "通道 {i} 不确定"
        );
    }
}

#[test]
fn plant_runs_finite_with_real_env() {
    // E1 组合工况巡航 120 s 全程有限（无发散）。
    let mut plant = DestroyerSixDofPlant::new(DestroyerSixDofConfig::default());
    plant.set_environment_state(EnvironmentState::e1(SEED_TRAINING), geo());
    for _ in 0..(120 * 120) {
        plant.step(calm_commands()).unwrap();
    }
    for value in plant.state().body_velocity.iter() {
        assert!(value.is_finite(), "E1 工况速度必须有限");
    }
    // 巡航仍在量级（E1 环境力不致失控）。
    let u = plant.state().body_velocity[0];
    assert!(u > 5.0 && u < 25.0, "E1 巡航航速 {u} 应在 5-25 m/s");
}
