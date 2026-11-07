//! 055 驱逐舰六自由度 TruthPlant（issue-2153-p1 A2.2）。
//!
//! 把 A1 六模块组装为 055 的六自由度真值后台，替代 destroyer_hifi 的
//! 3DOF MMG 路径（hifi 资产经 A2.1 审查后按下列修正迁移）：
//!
//! - **iz 修正**：hifi 的 `0.25·m·L²`（k_z=0.5L）改为 `I_z = m·(0.25L)²`
//!   （细长体常见回转半径 k_z≈0.25L；T 级教学标称，参数包可替换为 D 级）；
//! - **area_r 修正**：`L·0.015` 改为 `c·L·T`（c=0.015，补吃水量纲）；
//! - **常量推进力替换**：删除 `propeller_force_n` 常量路径，桨由
//!   `actuators` 模块的四象限模型与轴动力学承载（功率=Q·ω）。
//!
//! 数值结构（dt=1/120 合同）：执行器（舵伺服/桨轴）以解析一阶步进推进
//! （时间常数远大于 dt，冻结误差 O(dt²)，由 A3.4 步长收敛算例验证）；
//! 船体六自由度用通用 RK4（力项在每个 RK 子阶段重算）。
//!
//! 所有参数为 T 级教学标称（来源=destroyer_hifi 迁移 + 教科书典型值），
//! 正式参数包生产归 #2157。

use super::actuators::{
    clamp_motor_torque, clamp_shaft_speed, propeller_loads, servo_step, shaft_acceleration,
    PropellerModel, PropellerShaft, ServoModel,
};
use super::dynamics::{
    dynamics_step, AddedMassParams, CurrentFieldBody, DynamicsOutput, ExternalForces,
    RigidBodyParams, RestoringParams,
};
use super::hull_mmg::{blended_hull_loads, HullMmgParams, LowSpeedParams};
use super::integrator::{IntegrationError, NOMINAL_DT};
use super::radiation::{RadiationModel, RadiationMode};
use super::state::{normalize_quaternion, TruthState};

pub const SEA_WATER_DENSITY: f64 = 1025.0;
const GRAVITY: f64 = 9.81;

/// 055 六自由度配置（T 级教学标称；正式包见 #2157）。
#[derive(Debug, Clone, Copy)]
pub struct DestroyerSixDofConfig {
    pub length_m: f64,
    pub beam_m: f64,
    pub draft_m: f64,
    pub displacement_t: f64,
    pub cruise_speed_mps: f64,
    pub max_rudder_deg: f64,
    pub max_rudder_rate_deg_s: f64,
    /// 横摇初稳性高 GM_T（m，教学标称 1.2）。
    pub gm_transverse_m: f64,
    /// 纵稳性高 GM_L（m，教学标称 150）。
    pub gm_longitudinal_m: f64,
    /// 水线面积系数（A_wl = c·L·B，教学标称 0.82）。
    pub waterline_area_coefficient: f64,
}

impl Default for DestroyerSixDofConfig {
    fn default() -> Self {
        Self {
            length_m: 180.0,
            beam_m: 20.0,
            draft_m: 6.6,
            displacement_t: 13_000.0,
            cruise_speed_mps: 15.0,
            max_rudder_deg: 35.0,
            max_rudder_rate_deg_s: 5.0,
            gm_transverse_m: 1.2,
            gm_longitudinal_m: 150.0,
            waterline_area_coefficient: 0.82,
        }
    }
}

/// 命令通道（命令与实际分离合同的入口）。
#[derive(Debug, Clone, Copy, Default)]
pub struct DestroyerCommands {
    pub rudder_command_rad: f64,
    /// 电机扭矩命令 N·m（受幅值/变化率限幅）。
    pub motor_torque_command_nm: f64,
}

/// 组装后的 055 TruthPlant。
pub struct DestroyerSixDofPlant {
    config: DestroyerSixDofConfig,
    rb: RigidBodyParams,
    am: AddedMassParams,
    rp: RestoringParams,
    mmg: HullMmgParams,
    low: LowSpeedParams,
    prop: PropellerModel,
    shaft: PropellerShaft,
    servo: ServoModel,
    radiation: RadiationModel,
    state: TruthState,
    /// 上一拍电机扭矩命令（限幅后实际值）。
    motor_torque_actual_nm: f64,
    last_output: Option<DynamicsOutput>,
    sim_time_s: f64,
}

impl DestroyerSixDofPlant {
    pub fn new(config: DestroyerSixDofConfig) -> Self {
        let m = config.displacement_t * 1000.0;
        let l = config.length_m;
        let b = config.beam_m;

        // A2.1 修正一：回转半径 k_z≈0.25L（hifi 旧值 k_z=0.5L 偏大约 4 倍）。
        let iz = m * (0.25 * l) * (0.25 * l);
        // 惯量张量（对角，T 级）：k_x≈0.5B、k_y≈0.26L（驱逐舰 I_y≈I_z）。
        let ix = m * (0.5 * b) * (0.5 * b);
        let iy = m * (0.26 * l) * (0.26 * l);

        // 附加质量（T 级典型比例；横荡—艏摇耦合保留 hifi my/jz 结构）：
        // mx=5%、my=60%、jz=12% 经验值，其余通道取工程典型。
        let mut a_inf = [[0.0f64; 6]; 6];
        a_inf[0][0] = 0.05 * m;
        a_inf[1][1] = 0.60 * m;
        a_inf[2][2] = 0.90 * m;
        a_inf[3][3] = 0.20 * ix;
        a_inf[4][4] = 0.90 * iy;
        a_inf[5][5] = 0.12 * iz;
        // 横荡—艏摇附加质量耦合：首版取零（对角附加，与 hifi 等效结构
        // 一致）；非对角耦合随 #2157 参数包按辨识数据引入（T 级标称下
        // 对角形式的直航稳定性由独立算例验证）。

        // 静水恢复（小幅线性）：垂荡 ρgA_wl；横摇 m·g·GM_T；纵摇 m·g·GM_L。
        let mut k_linear = [[0.0f64; 6]; 6];
        k_linear[2][2] = SEA_WATER_DENSITY * GRAVITY
            * config.waterline_area_coefficient * l * b;
        k_linear[3][3] = m * GRAVITY * config.gm_transverse_m;
        k_linear[4][4] = m * GRAVITY * config.gm_longitudinal_m;

        // MMG 船体力系数（hifi 无量纲导数在设计点 cruise=15 m/s 换算为
        // 有量纲力系数；S=0.5ρLT。三次交叉项（v²r、vr²）首版并入线性+
        // 二次近似（T 级标称，精化归 #2157 参数包）。
        // 换算基准：c_lin = cd·S·speed_ref；c_quad = cq·S/speed_ref（v|v|）；
        // r 一次项 = cr·S·speed_ref·L；r|r| 项 = crr·S·L³/speed_ref。
        let s_ref = 0.5 * SEA_WATER_DENSITY * config.length_m * config.draft_m;
        let u_ref = config.cruise_speed_mps;
        let l = config.length_m;
        // 符号按 hifi 原导数（xuu=−0.018、yv=−0.285、yr=+0.065、
        // yvvv=−1.35、nv=−0.105、nr=−0.043 等）设计点换算，负号全部保留。
        let mmg = HullMmgParams {
            x_uu: -0.018 * s_ref,
            x_u: -1.2e3,
            y_v: -0.285 * s_ref * u_ref,
            y_vv: -1.35 * s_ref / u_ref,
            y_vr: 0.28 * s_ref * l / u_ref,
            y_r: 0.065 * s_ref * u_ref * l,
            y_rr: 0.006 * s_ref * l.powi(3) / u_ref,
            n_v: -0.105 * s_ref * u_ref * l,
            n_vv: -0.026 * s_ref * l.powi(2) / u_ref,
            n_vr: -0.22 * s_ref * l.powi(2) / u_ref,
            n_r: -0.043 * s_ref * u_ref * l * l,
            n_rr: -0.011 * s_ref * l.powi(4) / u_ref,
            z_h: -0.5 * config.draft_m,
        };
        let low = LowSpeedParams {
            crossflow_y: 0.8 * s_ref * l,
            surge_drag: 0.018 * s_ref,
            yaw_arm: 0.5 * l,
            z_h: -0.5 * config.draft_m,
        };

        // 桨设计点（T 级）：D=0.4T≈2.6 m、n=12 rad/s（J≈0.48、kt≈0.37，
        // 驱逐舰量级）；kt 由巡航阻力平衡反推，kq 按 η₀≈0.65 效率折算。
        let cruise_drag = 0.018 * s_ref * u_ref * u_ref;
        let d_prop = 0.4 * config.draft_m;
        let n_design = 12.0;
        let load_design = SEA_WATER_DENSITY * n_design * n_design * d_prop.powi(4);
        let kt_design = cruise_drag / load_design;
        let prop = PropellerModel {
            diameter_m: d_prop,
            water_density: SEA_WATER_DENSITY,
            kt_coefficients: [kt_design, -0.01 * kt_design, 0.0],
            // kq ≈ kt/(2π·η₀)，η₀=0.65；一次项随 J 轻微下降。
            kq_coefficients: [
                kt_design / (2.0 * std::f64::consts::PI * 0.65),
                -0.02 * kt_design,
                0.0,
            ],
        };
        let shaft = PropellerShaft {
            shaft_inertia: 2.4e4,
            max_motor_torque_nm: 2.4e6,
            max_shaft_speed_rad_s: 30.0,
            max_torque_rate_nm_s: 6.0e6,
            coulomb_friction_nm: 5.0e3,
            viscous_friction_nm_s_per_rad: 400.0,
        };
        let servo = ServoModel {
            max_angle_rad: config.max_rudder_deg.to_radians(),
            max_rate_rad_s: config.max_rudder_rate_deg_s.to_radians(),
            time_constant_s: 0.0,
        };

        // 辐射记忆（T 级）：高频等效阻尼 D = C·B（N·s/m / N·m·s），
        // 按各通道工程量级配置；恒速稳态记忆为零（Cummins 合同）。
        // 正式拟合归 #2157 参数包。
        let radiation = RadiationModel {
            modes: vec![
                RadiationMode { a: -0.35, input_gain: 1.0, output_gain: 3.0e5, channel: 0 },
                RadiationMode { a: -0.9, input_gain: 1.0, output_gain: 8.0e5, channel: 1 },
                RadiationMode { a: -0.9, input_gain: 1.0, output_gain: 2.0e8, channel: 5 },
                RadiationMode { a: -0.6, input_gain: 1.0, output_gain: 2.0e6, channel: 2 },
                RadiationMode { a: -0.5, input_gain: 1.0, output_gain: 3.0e8, channel: 3 },
            ],
        };
        debug_assert!(radiation.validate().is_ok());

        let state = TruthState {
            position_ned: [0.0, 0.0, 0.0],
            quaternion: [1.0, 0.0, 0.0, 0.0],
            body_velocity: [config.cruise_speed_mps, 0.0, 0.0, 0.0, 0.0, 0.0],
            // 记忆状态与巡航初速预载一致（避免初始瞬态虚假冲击）。
            radiation_states: radiation.steady_state([
                config.cruise_speed_mps, 0.0, 0.0, 0.0, 0.0, 0.0,
            ]),
            actuator_states: super::state::ActuatorStates {
                propeller_shaft_speed_rad_s: vec![n_design],
                control_surface_angles_rad: vec![0.0],
                azimuth_angles_rad: vec![],
            },
            specialist_states: vec![],
        };

        Self {
            config,
            rb: RigidBodyParams { mass_kg: m, inertia_about_cg: [
                [ix, 0.0, 0.0], [0.0, iy, 0.0], [0.0, 0.0, iz],
            ] },
            am: AddedMassParams { a_inf },
            rp: RestoringParams { k_linear },
            mmg,
            low,
            prop,
            shaft,
            servo,
            radiation,
            state,
            motor_torque_actual_nm: 0.0,
            last_output: None,
            sim_time_s: 0.0,
        }
    }

    pub fn state(&self) -> &TruthState {
        &self.state
    }

    pub fn sim_time_s(&self) -> f64 {
        self.sim_time_s
    }

    /// 上一拍力/力矩分项（A3 对账输出）。
    pub fn last_dynamics(&self) -> Option<&DynamicsOutput> {
        self.last_output.as_ref()
    }

    /// 推进一个标称步长（1/120 s，运行合同固定值）。
    pub fn step(&mut self, commands: DestroyerCommands) -> Result<(), IntegrationError> {
        self.step_with_dt(NOMINAL_DT, commands)
    }

    /// 变步长推进：仅供数值收敛校核（A3.4）使用；运行路径固定 1/120。
    pub fn step_with_dt(&mut self, dt: f64, commands: DestroyerCommands) -> Result<(), IntegrationError> {
        let radiation_len = self.radiation.state_len();
        let mut y = Vec::with_capacity(13 + radiation_len + 2);
        y.extend_from_slice(&self.state.position_ned);
        y.extend_from_slice(&self.state.quaternion);
        y.extend_from_slice(&self.state.body_velocity);
        y.extend_from_slice(&self.state.radiation_states);
        y.push(self.state.actuator_states.control_surface_angles_rad[0]);
        y.push(self.state.actuator_states.propeller_shaft_speed_rad_s[0]);

        let substeps = (NOMINAL_DT / dt).round().max(1.0) as usize;
        let mut time = self.sim_time_s;
        for _ in 0..substeps {
            // 电机扭矩限幅随每个实际子步推进（P2：与仿真时长一致）。
            self.motor_torque_actual_nm = clamp_motor_torque(
                &self.shaft,
                commands.motor_torque_command_nm,
                self.motor_torque_actual_nm,
                dt,
            );
            let rb = self.rb;
            let am = self.am;
            let rp = self.rp;
            let mmg = self.mmg;
            let low = self.low;
            let prop = self.prop;
            let config = self.config;
            let servo = self.servo;
            let shaft = self.shaft;
            let radiation_model = &self.radiation;
            let rudder_command_frozen = commands.rudder_command_rad;
            let motor_torque_frozen = self.motor_torque_actual_nm;

            let derivs = |_t: f64, y_slice: &[f64], dy: &mut [f64]| {
                let position = [y_slice[0], y_slice[1], y_slice[2]];
                let quat = normalize_quaternion([y_slice[3], y_slice[4], y_slice[5], y_slice[6]]);
                let nu = [
                    y_slice[7], y_slice[8], y_slice[9], y_slice[10], y_slice[11], y_slice[12],
                ];
                let x_rad: Vec<f64> = y_slice[13..13 + radiation_len].to_vec();
                let rudder_state = y_slice[13 + radiation_len];
                let omega_state = y_slice[14 + radiation_len];

                let rudder_target =
                    rudder_command_frozen.clamp(-servo.max_angle_rad, servo.max_angle_rad);
                let rudder_rate = ((rudder_target - rudder_state) / DT_SCALAR)
                    .clamp(-servo.max_rate_rad_s, servo.max_rate_rad_s);
                let omega_rate =
                    shaft_acceleration(&shaft, &prop, omega_state, nu[0], motor_torque_frozen);

                let (external, tau_radiation, delta_eta) = assemble_forces(
                    &mmg, &low, &prop, radiation_model, &config, &nu, &x_rad, rudder_state, omega_state, &quat, &position,
                );

                let state = TruthState {
                    position_ned: position,
                    quaternion: quat,
                    body_velocity: nu,
                    radiation_states: Vec::new(),
                    actuator_states: Default::default(),
                    specialist_states: Vec::new(),
                };
                let out = dynamics_step(
                    &state, &rb, &am, &rp,
                    &CurrentFieldBody::default(),
                    tau_radiation, delta_eta, &external,
                );
                dy[0] = out.position_dot_ned[0];
                dy[1] = out.position_dot_ned[1];
                dy[2] = out.position_dot_ned[2];
                dy[3] = out.quaternion_dot[0];
                dy[4] = out.quaternion_dot[1];
                dy[5] = out.quaternion_dot[2];
                dy[6] = out.quaternion_dot[3];
                dy[7..13].copy_from_slice(&out.nu_dot);
                for (i, mode) in radiation_model.modes.iter().enumerate() {
                    dy[13 + i] = mode.a * x_rad[i] + mode.input_gain * nu[mode.channel];
                }
                dy[13 + radiation_len] = rudder_rate;
                dy[14 + radiation_len] = omega_rate;
            };

            super::integrator::rk4_step(time, &mut y, dt, derivs)?;
            time += dt;
        }
        self.sim_time_s = time;

        self.state.position_ned = [y[0], y[1], y[2]];
        self.state.quaternion = normalize_quaternion([y[3], y[4], y[5], y[6]]);
        self.state.body_velocity.copy_from_slice(&y[7..13]);
        self.state.radiation_states.copy_from_slice(&y[13..13 + radiation_len]);
        self.state.actuator_states.control_surface_angles_rad[0] = y[13 + radiation_len];
        self.state.actuator_states.propeller_shaft_speed_rad_s[0] =
            clamp_shaft_speed(&self.shaft, y[14 + radiation_len]);

        let final_state = self.state.clone();
        let (external, tau_rad, delta_eta) = assemble_forces(
            &self.mmg, &self.low, &self.prop, &self.radiation, &self.config,
            &final_state.body_velocity, &final_state.radiation_states,
            final_state.actuator_states.control_surface_angles_rad[0],
            final_state.actuator_states.propeller_shaft_speed_rad_s[0],
            &final_state.quaternion, &final_state.position_ned,
        );
        self.last_output = Some(dynamics_step(
            &final_state, &self.rb, &self.am, &self.rp,
            &CurrentFieldBody::default(), tau_rad, delta_eta, &external,
        ));
        Ok(())
    }

    // ---------- 运行时状态恢复（WASM 入口用） ----------

    /// 整体恢复真值状态（sixdof_runtime 从 JSON 往返状态重建 plant）。
    /// 辐射状态长度不符时按速度场预载；执行器槽位为空时保留构造初值
    /// （旧标量兼容重建没有执行器信息）。
    pub fn restore_state(&mut self, mut state: TruthState) {
        if state.radiation_states.len() != self.radiation.state_len() {
            state.radiation_states = self.radiation.steady_state(state.body_velocity);
        }
        if state.actuator_states.control_surface_angles_rad.is_empty() {
            state.actuator_states.control_surface_angles_rad =
                self.state.actuator_states.control_surface_angles_rad.clone();
        }
        if state.actuator_states.propeller_shaft_speed_rad_s.is_empty() {
            state.actuator_states.propeller_shaft_speed_rad_s =
                self.state.actuator_states.propeller_shaft_speed_rad_s.clone();
        }
        self.state = state;
    }

    /// 运行时兼容入口：直接写实际舵角（旧标量状态重建时用）。
    pub fn set_rudder_actual_for_runtime(&mut self, rudder_rad: f64) {
        if let Some(slot) = self.state.actuator_states.control_surface_angles_rad.first_mut() {
            *slot = rudder_rad;
        }
    }

    // ---------- 校核/测试访问器（仅供独立算例与诊断，运行路径不使用） ----------

    /// 直接写入体速度（校核初值设置）。
    pub fn state_mut_for_test(&mut self) -> &mut [f64; 6] {
        &mut self.state.body_velocity
    }

    pub fn set_quaternion_for_test(&mut self, q: [f64; 4]) {
        self.state.quaternion = normalize_quaternion(q);
    }

    /// 校核用：按当前体速度重载辐射稳态（测试改初速后调用）。
    pub fn prewarm_radiation_for_test(&mut self) {
        self.state.radiation_states =
            self.radiation.steady_state(self.state.body_velocity);
    }

    pub fn set_shaft_speed_for_test(&mut self, omega: f64) {
        if let Some(slot) = self.state.actuator_states.propeller_shaft_speed_rad_s.first_mut() {
            *slot = omega;
        }
    }

    pub fn roll_for_test(&self) -> f64 {
        super::state::euler_from_quaternion(self.state.quaternion).roll_rad
    }

    pub fn yaw_for_test(&self) -> f64 {
        super::state::euler_from_quaternion(self.state.quaternion).yaw_rad
    }

    pub fn rudder_actual_for_test(&self) -> f64 {
        self.state.actuator_states.control_surface_angles_rad[0]
    }
}

const DT_SCALAR: f64 = 1.0 / 120.0;

/// 子阶段力组装：船体、桨、舵（真实局部流速，无下限截断）、
/// 辐射记忆（连续形式 τ=C·(B·u+A·x)）与恢复偏差。
#[allow(clippy::too_many_arguments)]
fn assemble_forces(
    mmg: &HullMmgParams,
    low: &LowSpeedParams,
    prop: &PropellerModel,
    radiation_model: &RadiationModel,
    config: &DestroyerSixDofConfig,
    nu: &[f64; 6],
    x_rad: &[f64],
    rudder_state: f64,
    omega_state: f64,
    quat: &[f64; 4],
    position: &[f64; 3],
) -> (ExternalForces, [f64; 6], [f64; 6]) {
    let loads = blended_hull_loads(mmg, low, nu[0], nu[1], nu[5]);
    let (thrust_k, _) = propeller_loads(prop, nu[0], omega_state);
    let arm = mmg_center_of(config);
    let v_rudder = nu[1] + arm * nu[5];
    // 真实局部流速：零速+零推进时舵动压为零（合同：禁止速度下限截断）。
    let flow_k = (nu[0] * nu[0] + v_rudder * v_rudder).sqrt();
    let alpha_k = rudder_state - v_rudder.atan2(nu[0]);
    let area_r = 0.015 * config.length_m * config.draft_m;
    let lift_k = 0.5 * SEA_WATER_DENSITY * area_r * flow_k * flow_k
        * (2.0 * std::f64::consts::PI * alpha_k.sin());
    let normal_k = 1.24 * lift_k;
    let fx_r = -normal_k * rudder_state.sin();
    let fy_r = -0.66 * normal_k * rudder_state.cos();
    let mz_r = -((arm + 0.06 * config.length_m) * normal_k * rudder_state.cos());
    let k_roll_r = super::state::moment_from_force(
        [0.0, 0.0, -0.5 * config.draft_m],
        [fx_r, fy_r, 0.0],
    )[0];

    let mut tau_radiation = [0.0f64; 6];
    for (i, mode) in radiation_model.modes.iter().enumerate() {
        let x_i = x_rad.get(i).copied().unwrap_or(0.0);
        tau_radiation[mode.channel] +=
            mode.output_gain * (mode.input_gain * nu[mode.channel] + mode.a * x_i);
    }

    let external = ExternalForces {
        tau_hull_viscous: [loads[0], loads[1], 0.0, loads[3], loads[4], loads[5]],
        tau_actuator: [
            thrust_k + fx_r,
            fy_r,
            0.0,
            k_roll_r,
            (-0.5 * config.draft_m) * thrust_k,
            mz_r,
        ],
        ..ExternalForces::default()
    };
    let euler = super::state::euler_from_quaternion(*quat);
    let delta_eta = [0.0, 0.0, position[2], euler.roll_rad, euler.pitch_rad, euler.yaw_rad];
    (external, tau_radiation, delta_eta)
}

fn mmg_center_of(config: &DestroyerSixDofConfig) -> f64 {
    // 舵/合力的纵向作用点（hifi xr=-0.5L 迁移）。
    -0.50 * config.length_m
}
