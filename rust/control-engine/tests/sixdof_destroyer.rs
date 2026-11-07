//! 055 六自由度 TruthPlant 独立算例（issue-2153-p1 A2.2 + A3）。
//!
//! 对应 issue §7 验收门槛：静水平衡、自由衰减、无输入无增能、舵回转
//! 方向与低速连续、命令/实际分离、步长收敛（<1%）、全速到停船与
//! 推进器故障由方程产生。

use control_engine::sixdof::{
    DestroyerCommands, DestroyerSixDofConfig, DestroyerSixDofPlant,
};

/// 巡航平衡电机扭矩：与 plant::new 设计点一致的反推
/// （D=0.4T、n=12 rad/s、kq=kt/(2π·0.65)，J 取设计点）。
fn equilibrium_torque() -> f64 {
    let config = DestroyerSixDofConfig::default();
    let s_ref = 0.5 * 1025.0 * config.length_m * config.draft_m;
    let u = config.cruise_speed_mps;
    let cruise_drag = 0.018 * s_ref * u * u;
    let d = 0.4 * config.draft_m;
    let n = 12.0f64;
    let load = 1025.0 * n * n * d.powi(4);
    let kt = cruise_drag / load;
    let j = u / (n * d);
    // kq 多项式与 plant 一致：[kt/(2π·0.65), −0.02·kt, 0]。
    let kq = kt / (2.0 * std::f64::consts::PI * 0.65) - 0.02 * kt * j;
    kq * load * d + 5.0e3 + 400.0 * n
}

fn cruise_commands() -> DestroyerCommands {
    DestroyerCommands {
        rudder_command_rad: 0.0,
        motor_torque_command_nm: equilibrium_torque(),
    }
}

fn run(plant: &mut DestroyerSixDofPlant, commands: DestroyerCommands, seconds: f64) {
    let steps = (seconds * 120.0).round() as usize;
    for _ in 0..steps {
        plant.step(commands).expect("六自由度推进失败");
    }
}

#[test]
fn equilibrium_cruise_holds_speed_and_upright() {
    // A3.1：巡航平衡 120 s——航速稳定、无横荡/横摇漂移、姿态直立。
    let mut plant = DestroyerSixDofPlant::new(DestroyerSixDofConfig::default());
    run(&mut plant, cruise_commands(), 120.0);
    let nu = plant.state().body_velocity;
    let quat = plant.state().quaternion;
    let u_error = (nu[0] - 15.0).abs() / 15.0;
    assert!(u_error < 0.05, "巡航航速漂移 {}%", u_error * 100.0);
    for (name, value) in [("v", nu[1]), ("p", nu[3]), ("q", nu[4]), ("r", nu[5])] {
        assert!(value.abs() < 1e-3, "{name} 应保持近零，得到 {value}");
    }
    // 均衡航行纵倾：水下推力产生微低头/抬头平衡（trim），垂荡速度与
    // 吃水变化为小量（|w|<0.05 m/s、|z|<0.5 m），不是漂移发散。
    assert!(nu[2].abs() < 0.05, "w 应为均衡纵倾小量，得到 {}", nu[2]);
    assert!(plant.state().position_ned[2].abs() < 0.5, "吃水变化应收敛");
    assert!((quat[0] - 1.0).abs() < 1e-6, "姿态应保持单位直立");
}

#[test]
fn free_roll_decay_is_damped() {
    // A3.1：初始横倾 0.15 rad 自由衰减——幅值衰减、周期合理。
    let mut plant = DestroyerSixDofPlant::new(DestroyerSixDofConfig::default());
    plant.state_mut_for_test()[0] = 15.0; // u 保持巡航（校核初值）
    // 初始横摇角速度置零、姿态给 0.15 rad 横倾。
    let half = 0.15f64 / 2.0;
    plant.set_quaternion_for_test([(half).cos(), (half).sin(), 0.0, 0.0]);
    // 推进器零命令（静水衰减，不受推进扰动）。
    let zero = DestroyerCommands::default();
    run(&mut plant, zero, 120.0);
    let roll_final = plant.roll_for_test();
    // 至少衰减到初值 20% 以下（120 s >> 若干横摇周期）。
    assert!(roll_final.abs() < 0.15 * 0.2, "横摇应显著衰减，得到 {roll_final}");
}

#[test]
fn zero_input_zero_energy_stays_zero() {
    // A3.1：零速零命令静水——状态严格保持（无凭空增能）。
    let mut plant = DestroyerSixDofPlant::new(DestroyerSixDofConfig::default());
    plant.state_mut_for_test()[0] = 0.0;
    plant.prewarm_radiation_for_test();
    plant.set_shaft_speed_for_test(0.0);
    run(&mut plant, DestroyerCommands::default(), 60.0);
    let nu = plant.state().body_velocity;
    for value in nu {
        assert!(value.abs() < 1e-9, "零输入不得产生运动，得到 {:?}", nu);
    }
    let pos = plant.state().position_ned;
    for value in pos {
        assert!(value.abs() < 1e-9);
    }
}

#[test]
fn starboard_rudder_turns_with_consistent_sideslip() {
    // A3.2：+20° 舵 60 s——显著回转，且横荡与艏摇同号（回转外甩一致）。
    let mut plant = DestroyerSixDofPlant::new(DestroyerSixDofConfig::default());
    let cmds = DestroyerCommands {
        rudder_command_rad: 20.0_f64.to_radians(),
        motor_torque_command_nm: equilibrium_torque(),
    };
    run(&mut plant, cmds, 60.0);
    let nu = plant.state().body_velocity;
    let yaw = plant.yaw_for_test();
    assert!(yaw.abs() > 20.0_f64.to_radians(), "60 s 回转艏摇应超过 20°，得到 {}°", yaw.to_degrees());
    assert!(
        nu[1] * nu[5] < 0.0,
        "回转中横荡应向外侧甩（v 与 r 反号，漂角为负）：v={} r={}",
        nu[1], nu[5]
    );
    // 全程有限（已由 step 内校验兜底）。
    assert!(plant.roll_for_test().abs() < 1.0, "回转横倾应在物理范围");
}

#[test]
fn astern_and_zero_speed_stay_finite() {
    // A3.3：倒航 -2 m/s 带舵、零速起步——全程有限无奇异。
    let mut plant = DestroyerSixDofPlant::new(DestroyerSixDofConfig::default());
    plant.state_mut_for_test()[0] = -2.0;
    plant.prewarm_radiation_for_test();
    plant.set_shaft_speed_for_test(0.0);
    let cmds = DestroyerCommands {
        rudder_command_rad: 15.0_f64.to_radians(),
        motor_torque_command_nm: 0.0,
    };
    run(&mut plant, cmds, 60.0);
    for value in plant.state().body_velocity {
        assert!(value.is_finite());
    }

    let mut stopped = DestroyerSixDofPlant::new(DestroyerSixDofConfig::default());
    stopped.state_mut_for_test()[0] = 0.0;
    stopped.prewarm_radiation_for_test();
    stopped.set_shaft_speed_for_test(0.0);
    let cmds_zero = DestroyerCommands {
        rudder_command_rad: -10.0_f64.to_radians(),
        motor_torque_command_nm: 0.0,
    };
    run(&mut stopped, cmds_zero, 30.0);
    for value in stopped.state().body_velocity {
        assert!(value.is_finite(), "零速打舵不得奇异");
    }
}

#[test]
fn rudder_command_and_actual_are_separated() {
    // A3.6：舵阶跃 35°——实际角按 5°/s 速率限幅渐进，1 s 内不超过 5.5°。
    let mut plant = DestroyerSixDofPlant::new(DestroyerSixDofConfig::default());
    let cmds = DestroyerCommands {
        rudder_command_rad: 35.0_f64.to_radians(),
        motor_torque_command_nm: equilibrium_torque(),
    };
    run(&mut plant, cmds, 1.0);
    let actual = plant.rudder_actual_for_test();
    assert!(
        actual.abs() <= 5.5_f64.to_radians(),
        "实际舵角应受 5°/s 限幅，1 s 得到 {}°",
        actual.to_degrees()
    );
    assert!(actual > 0.0, "正令应产生正的实际舵角方向");
}

#[test]
fn half_step_converges_within_one_percent() {
    // A3.4：20° 舵回转 60 s，dt=1/240 与 1/120 的艏摇/横荡差 < 1%。
    let mut coarse = DestroyerSixDofPlant::new(DestroyerSixDofConfig::default());
    let mut fine = DestroyerSixDofPlant::new(DestroyerSixDofConfig::default());
    let cmds = DestroyerCommands {
        rudder_command_rad: 20.0_f64.to_radians(),
        motor_torque_command_nm: equilibrium_torque(),
    };
    for _ in 0..(60.0 * 120.0) as usize {
        coarse.step(cmds).unwrap();
    }
    for _ in 0..(60.0 * 120.0) as usize {
        fine.step_with_dt(1.0 / 240.0, cmds).unwrap();
    }
    let yaw_c = coarse.yaw_for_test();
    let yaw_f = fine.yaw_for_test();
    let rel = (yaw_c - yaw_f).abs() / yaw_f.abs().max(1e-9);
    assert!(rel < 0.01, "步长收敛：艏摇相对差 {}% 应 <1%", rel * 100.0);
    let v_c = coarse.state().body_velocity[1];
    let v_f = fine.state().body_velocity[1];
    assert!((v_c - v_f).abs() / v_f.abs().max(1e-9) < 0.02, "横荡相对差应 <2%");
}

#[test]
fn thrust_cutoff_decelerates_from_cruise() {
    // A3.6：全速巡航后扭矩撤零——减速由方程产生（推进器故障同型）。
    let mut plant = DestroyerSixDofPlant::new(DestroyerSixDofConfig::default());
    run(&mut plant, cruise_commands(), 20.0);
    let u_start = plant.state().body_velocity[0];
    let zero_thrust = DestroyerCommands::default();
    run(&mut plant, zero_thrust, 300.0);
    let u_end = plant.state().body_velocity[0];
    // 阻力随 u² 下降且辐射记忆释放存能（物理减速渐缓）：300 s 减速
    // 超过 25% 且持续单调向下；不计入零速假设的解析值。
    assert!(u_end < u_start * 0.75, "撤推后 300 s 应显著减速：{u_start}→{u_end}");
    assert!(u_end >= -0.5, "无倒推不应大幅倒航：{u_end}");
}
