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
    clamp_motor_torque, clamp_shaft_speed, propeller_loads,
    propeller_loads_with_ventilation, shaft_friction,
    PropellerInstallation, PropellerModel, PropellerShaft, ServoModel,
};
use super::actuator_system::{ActuatorCommands, ActuatorSystem, LocalWater, ShaftCommand, SurfaceCommand};
use super::dynamics::{
    dynamics_step_with_restoring, restoring_force, AddedMassParams, CurrentFieldBody, DynamicsOutput, ExternalForces,
    RigidBodyParams, RestoringParams,
};
use super::hull_mmg::{blended_hull_loads, HullMmgParams, LowSpeedParams, MappedMmgHull};
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

#[derive(Clone, Copy)]
struct RudderHydrodynamics {
    normal_factor: f64,
    lateral_factor: f64,
    longitudinal_position_m: f64,
}

/// 组装后的 055 TruthPlant。
#[derive(Clone)]
pub struct DestroyerSixDofPlant {
    config: DestroyerSixDofConfig,
    rb: RigidBodyParams,
    am: AddedMassParams,
    rp: RestoringParams,
    hydrostatic_hull: Option<std::sync::Arc<super::hydrostatics::HydrostaticHull>>,
    sloshing: Option<std::sync::Arc<super::coupled_sloshing::CoupledSloshing>>,
    mmg: HullMmgParams,
    low: LowSpeedParams,
    mapped_hull: Option<MappedMmgHull>,
    component_drag: Option<std::sync::Arc<super::component_drag::ComponentDrag>>,
    prop: PropellerModel,
    propeller_installation: Option<PropellerInstallation>,
    actuator_system: Option<ActuatorSystem>,
    shaft: PropellerShaft,
    servo: ServoModel,
    rudder_hydrodynamics: RudderHydrodynamics,
    radiation: RadiationModel,
    state: TruthState,
    /// 上一拍电机扭矩命令（限幅后实际值）。
    motor_torque_actual_nm: f64,
    last_output: Option<DynamicsOutput>,
    sim_time_s: f64,
    environment_enabled: bool,
    /// 真实环境场（B1.4 后半段：Some 时 derivs 消费真实波/风/流）。
    environment_state: Option<crate::sixdof::environment_state::EnvironmentState>,
    wind_geometry: Option<crate::sixdof::wind::WindHullGeometry>,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct PlantCheckpoint {
    state: TruthState,
    time_s: f64,
    environment: Option<crate::sixdof::environment_state::EnvironmentState>,
    last_output: Option<DynamicsOutput>,
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
        // 停船初始化仍需要有限的旧式系数换算尺度。
        let u_ref = config.cruise_speed_mps.max(1.0);
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
                ..Default::default()
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
            hydrostatic_hull: None,
            sloshing: None,
            mmg,
            low,
            mapped_hull: None,
            component_drag: None,
            prop,
            propeller_installation: None,
            actuator_system: None,
            shaft,
            servo,
            rudder_hydrodynamics: RudderHydrodynamics {
                normal_factor: 1.24,
                lateral_factor: 0.66,
                longitudinal_position_m: -0.5 * config.length_m,
            },
            radiation,
            state,
            motor_torque_actual_nm: 0.0,
            last_output: None,
            sim_time_s: 0.0,
            environment_enabled: false,
            environment_state: None,
            wind_geometry: None,
        }
    }

    /// 从已校验参数包构造 TruthPlant（issue-2157 A3：参数单一真源——
    /// 几何/惯量/操纵/执行器全部取自包；巡航速度与稳性高保留 config
    /// 并经包哈希联动，改包即换物理）。
    pub fn from_model_pack(
        pack: &crate::sixdof::model_pack::PackModel,
        config: DestroyerSixDofConfig,
    ) -> Self {
        let g = &pack.geometry;
        let m = g.displacement_mass_kg;
        let (max_rudder_deg, max_rudder_rate_deg_s) = match &pack.actuators {
            super::model_pack::PackActuators::Legacy { rudder, .. } =>
                (rudder.max_angle_deg, rudder.max_rate_deg_s),
            super::model_pack::PackActuators::Physical { system, .. } =>
                system.surfaces.iter().find(|surface| surface.normal_body == [0.0, 1.0, 0.0])
                    .map(|surface| (surface.servo.max_angle_rad.to_degrees(), surface.servo.max_rate_rad_s.to_degrees()))
                    .unwrap_or((35.0, 5.0)),
        };
        let config = DestroyerSixDofConfig {
            length_m: g.lpp_m,
            beam_m: g.beam_m,
            draft_m: g.draft_m,
            displacement_t: m / 1000.0,
            cruise_speed_mps: g.cruise_speed_mps.unwrap_or(config.cruise_speed_mps),
            max_rudder_deg,
            max_rudder_rate_deg_s,
            ..config
        };
        // 先应用包几何，再组装依赖质量/尺度的附加质量和静水恢复矩阵。
        let mut plant = Self::new(config);
        plant.rb.inertia_about_cg = [
            [g.inertia_about_cg_kg_m2.ixx, 0.0, 0.0],
            [0.0, g.inertia_about_cg_kg_m2.iyy, 0.0],
            [0.0, 0.0, g.inertia_about_cg_kg_m2.izz],
        ];
        // 旋转附加惯量采用包内惯量，保持当前T级附加惯量比例。
        plant.am.a_inf[3][3] = 0.20 * g.inertia_about_cg_kg_m2.ixx;
        plant.am.a_inf[4][4] = 0.90 * g.inertia_about_cg_kg_m2.iyy;
        plant.am.a_inf[5][5] = 0.12 * g.inertia_about_cg_kg_m2.izz;
        if g.waterline_area_m2 > 0.0 {
            plant.rp.k_linear[2][2] = SEA_WATER_DENSITY * GRAVITY * g.waterline_area_m2;
        }
        if let Some(stiffness) = g.hydrostatic_stiffness_si {
            plant.rp.k_linear = stiffness;
        }
        plant.hydrostatic_hull = g.nonlinear_hydrostatics.clone().map(std::sync::Arc::new);
        let half_pitch = g.equilibrium_pitch_rad / 2.0;
        plant.state.quaternion = [half_pitch.cos(), 0.0, half_pitch.sin(), 0.0];
        if !g.liquid_tanks.is_empty() {
            plant.configure_liquid_tanks(&g.liquid_tanks).expect("液舱参数已通过加载门禁");
        }
        // 操纵系数直接来自包。
        if let super::model_pack::PackManeuvering::Mapped { mapped_mmg } = &pack.maneuvering {
            plant.mapped_hull = Some(mapped_mmg.clone());
        }
        if let super::model_pack::PackManeuvering::Components { component_drag } = &pack.maneuvering {
            plant.component_drag = Some(std::sync::Arc::new(component_drag.compile().expect("构件阻力包已通过加载校验")));
        }
        if let super::model_pack::PackManeuvering::Legacy { hull, low_speed } = &pack.maneuvering {
            plant.mmg = HullMmgParams {
                x_uu: hull.x_uu, x_u: hull.x_u,
                y_v: hull.y_v, y_vv: hull.y_vv, y_vr: hull.y_vr,
                y_r: hull.y_r, y_rr: hull.y_rr,
                n_v: hull.n_v, n_vv: hull.n_vv, n_vr: hull.n_vr,
                n_r: hull.n_r, n_rr: hull.n_rr,
                z_h: hull.z_h_m,
            };
            plant.low = LowSpeedParams {
                crossflow_y: low_speed.crossflow_y,
                surge_drag: low_speed.surge_drag,
                yaw_arm: low_speed.yaw_arm_m,
                z_h: hull.z_h_m,
            };
        }
        // 执行器来自包。
        let (prop, shaft, rud) = match &pack.actuators {
            super::model_pack::PackActuators::Physical { system, initial_state } => {
                plant.configure_actuators(system.clone(), initial_state.clone())
                    .expect("参数包执行器已通过加载门禁");
                return plant;
            },
            super::model_pack::PackActuators::Legacy { propeller, shaft, rudder } =>
                (propeller, shaft, rudder),
        };
        plant.prop = PropellerModel {
            diameter_m: prop.diameter_m,
            water_density: SEA_WATER_DENSITY,
            kt_coefficients: prop.kt_coefficients,
            kq_coefficients: prop.kq_coefficients,
        };
        plant.shaft = PropellerShaft {
            shaft_inertia: shaft.inertia_kg_m2,
            max_motor_torque_nm: shaft.max_motor_torque_nm,
            max_shaft_speed_rad_s: shaft.max_shaft_speed_rad_s,
            max_torque_rate_nm_s: shaft.max_torque_rate_nm_s,
            coulomb_friction_nm: shaft.coulomb_friction_nm,
            viscous_friction_nm_s_per_rad: shaft.viscous_friction_nm_s_per_rad,
        };
        plant.servo = ServoModel {
            max_angle_rad: rud.max_angle_deg.to_radians(),
            max_rate_rad_s: rud.max_rate_deg_s.to_radians(),
            time_constant_s: 0.0,
        };
        plant.rudder_hydrodynamics = RudderHydrodynamics {
            normal_factor: rud.normal_factor,
            lateral_factor: rud.lateral_factor,
            longitudinal_position_m: rud.longitudinal_position_m,
        };
        plant
    }

    pub fn state(&self) -> &TruthState {
        &self.state
    }

    pub fn actuator_system(&self) -> Option<&ActuatorSystem> {
        self.actuator_system.as_ref()
    }

    pub fn physical_mass_matrix(&self) -> [[f64; 6]; 6] {
        super::dynamics::mass_matrix(&self.rb, &self.am)
    }

    pub fn configure_liquid_tanks(&mut self, tanks: &[super::coupled_sloshing::LiquidTank]) -> Result<(), String> {
        let model = super::coupled_sloshing::CoupledSloshing::new(tanks, &self.rb, self.physical_mass_matrix())?;
        self.state.specialist_states = vec![0.0; model.state_len()];
        self.sloshing = Some(std::sync::Arc::new(model));
        Ok(())
    }

    pub fn sloshing(&self) -> Option<&super::coupled_sloshing::CoupledSloshing> {
        self.sloshing.as_deref()
    }

    pub fn liquid_diagnostics(&self) -> Result<Option<super::coupled_sloshing::SloshingDiagnostics>, String> {
        self.sloshing.as_ref().map(|model| model.diagnostics(&self.state, &self.state.specialist_states)).transpose()
    }

    pub fn environment(&self) -> Option<&crate::sixdof::environment_state::EnvironmentState> {
        self.environment_state.as_ref()
    }

    pub fn advance_environment_to_current_time(&mut self) {
        if let Some(environment) = self.environment_state.as_mut() {
            environment.advance_to(self.sim_time_s);
        }
    }

    pub fn checkpoint(&self) -> PlantCheckpoint {
        PlantCheckpoint { state: self.state.clone(), time_s: self.sim_time_s,
            environment: self.environment_state.clone(), last_output: self.last_output }
    }

    pub fn restore_checkpoint(&mut self, checkpoint: PlantCheckpoint) -> Result<(), String> {
        let state = &checkpoint.state;
        let norm: f64 = state.quaternion.iter().map(|value| value * value).sum();
        if !checkpoint.time_s.is_finite() || checkpoint.time_s < 0.0 || (norm - 1.0).abs() > 1e-8
            || state.position_ned.iter().chain(&state.quaternion).chain(&state.body_velocity)
                .chain(&state.radiation_states).chain(&state.specialist_states).any(|value| !value.is_finite())
            || state.radiation_states.len() != self.radiation.state_len()
        {
            return Err("物理恢复点的时间、状态或辐射维度无效".into());
        }
        self.actuator_system.as_ref().ok_or("恢复点需要物理执行器组")?
            .validate_state(&state.actuator_states)?;
        if let Some(model) = &self.sloshing { model.validate_state(&state.specialist_states)?; }
        self.state = checkpoint.state;
        self.sim_time_s = checkpoint.time_s;
        self.environment_state = checkpoint.environment;
        self.last_output = checkpoint.last_output;
        self.motor_torque_actual_nm = self.state.actuator_states.motor_torques_nm.first().copied().unwrap_or(0.0);
        Ok(())
    }

    pub fn set_propeller_installation(
        &mut self,
        installation: PropellerInstallation,
    ) -> Result<(), String> {
        if self.actuator_system.is_some() {
            return Err("物理执行器组的安装几何由参数包确定".into());
        }
        installation.validate()?;
        self.propeller_installation = Some(installation);
        Ok(())
    }

    pub fn configure_actuators(
        &mut self,
        system: ActuatorSystem,
        initial: super::state::ActuatorStates,
    ) -> Result<(), String> {
        system.validate()?;
        system.validate_state(&initial)?;
        self.state.actuator_states = system.decode_state(&system.encode_state(&initial));
        self.actuator_system = Some(system);
        Ok(())
    }

    /// 环境场（T 级等效扰动，#2156 接真实风浪流前的教学等效）：
    /// 恒定横流经相对来流进入船体/舵载荷；一阶波浪力矩为正弦慢漂。
    pub fn set_environment_enabled(&mut self, enabled: bool) {
        self.environment_enabled = enabled;
    }

    /// 接入真实环境场（B1.4 后半段）。设置后 derivs 消费真实波/风/流
    /// （种子 JONSWAP + Fujiwara 分量 + 恒定均匀流），替换 T 级等效。
    pub fn set_environment_state(
        &mut self,
        env: crate::sixdof::environment_state::EnvironmentState,
        wind_geometry: crate::sixdof::WindHullGeometry,
    ) {
        self.environment_state = Some(env);
        self.wind_geometry = Some(wind_geometry);
    }

    pub fn environment_enabled(&self) -> bool {
        self.environment_enabled
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
        let physical_commands = self.actuator_system.as_ref().map(|system| ActuatorCommands {
            shafts: system.propulsors.iter().map(|_| ShaftCommand {
                motor_torque_override_nm: Some(commands.motor_torque_command_nm),
                ..Default::default()
            }).collect(),
            surfaces: system.surfaces.iter().map(|_| SurfaceCommand {
                angle_rad: commands.rudder_command_rad, enabled: true, ..Default::default()
            }).collect(),
        });
        self.advance(dt, commands, physical_commands.as_ref())
    }

    pub fn step_with_actuators(
        &mut self,
        dt: f64,
        commands: &ActuatorCommands,
    ) -> Result<(), IntegrationError> {
        let system = self.actuator_system.as_ref().ok_or_else(|| {
            IntegrationError::InvalidActuatorCommand("该模型尚未配置执行器组".into())
        })?;
        system.validate_commands(commands).map_err(IntegrationError::InvalidActuatorCommand)?;
        self.advance(dt, Default::default(), Some(commands))
    }

    fn advance(
        &mut self,
        dt: f64,
        commands: DestroyerCommands,
        physical_commands: Option<&ActuatorCommands>,
    ) -> Result<(), IntegrationError> {
        if !dt.is_finite() || dt <= 0.0 {
            return Err(IntegrationError::InvalidTimeStep { dt_s: dt });
        }
        if let Some(model) = &self.sloshing {
            model.validate_state(&self.state.specialist_states).map_err(IntegrationError::InvalidSpecialistState)?;
        }
        let radiation_len = self.radiation.state_len();
        let mut y = Vec::with_capacity(13 + radiation_len + 2);
        y.extend_from_slice(&self.state.position_ned);
        y.extend_from_slice(&self.state.quaternion);
        y.extend_from_slice(&self.state.body_velocity);
        y.extend_from_slice(&self.state.radiation_states);
        if let Some(system) = &self.actuator_system {
            y.extend(system.encode_state(&self.state.actuator_states));
        } else {
            y.push(self.state.actuator_states.control_surface_angles_rad[0]);
            y.push(self.state.actuator_states.propeller_shaft_speed_rad_s[0]);
        }
        let specialist_offset = y.len();
        y.extend_from_slice(&self.state.specialist_states);

        // 环境过程与积分状态在本次推进成功后一起写入。
        let mut env_state = self.environment_state.clone();
        let mut motor_torque_actual_nm = self.motor_torque_actual_nm;
        // 推进语义：本调用推进 dt 时长；内部按 ≤NOMINAL_DT 细分子步
        let substeps = ((dt / NOMINAL_DT).ceil() as usize).max(1);
        let substep_dt = dt / substeps as f64;
        let mut time = self.sim_time_s;
        for _ in 0..substeps {
            // 电机扭矩限幅按实际子步时长推进（P1：整帧 dt 会把变化率
            // 上限放大 substeps 倍，破坏分帧一致性）。
            motor_torque_actual_nm = clamp_motor_torque(
                &self.shaft,
                commands.motor_torque_command_nm,
                motor_torque_actual_nm,
                substep_dt,
            );
            let rb = self.rb;
            let am = self.am;
            let rp = self.rp;
            let hydrostatic_hull = self.hydrostatic_hull.as_deref();
            let sloshing = self.sloshing.as_deref();
            let mmg = self.mmg;
            let low = self.low;
            let mapped_hull = self.mapped_hull.as_ref();
            let component_drag = self.component_drag.as_deref();
            let prop = self.prop;
            let propeller_installation = self.propeller_installation;
            let config = self.config;
            let servo = self.servo;
            let rudder_hydrodynamics = self.rudder_hydrodynamics;
            let shaft = self.shaft;
            let radiation_model = &self.radiation;
            let rudder_command_frozen = commands.rudder_command_rad;
            let motor_torque_frozen = motor_torque_actual_nm;
            let actuator_system = self.actuator_system.as_ref();
            let reference_rates = actuator_system.zip(physical_commands).map(|(system, command)| {
                system.reference_rates(&y[13 + radiation_len..specialist_offset], command, substep_dt)
            });
            // 真实环境场物理时钟推进（P2-2：按子步时间；先释放可变借用）。
            if let Some(env) = env_state.as_mut() {
                env.advance_to(time);
            }
            // 真实环境场优先（B1.4 后半段；env_state 在循环外）。
            let environment = if self.environment_enabled {
                EnvironmentField::disturbance_equivalent()
            } else {
                EnvironmentField::default()
            };
            let real_env = env_state.as_ref();
            let wind_geo = self.wind_geometry.as_ref();

            let derivs = |t_sub: f64, y_slice: &[f64], dy: &mut [f64]| {
                let position = [y_slice[0], y_slice[1], y_slice[2]];
                let quat = normalize_quaternion([y_slice[3], y_slice[4], y_slice[5], y_slice[6]]);
                let nu = [
                    y_slice[7], y_slice[8], y_slice[9], y_slice[10], y_slice[11], y_slice[12],
                ];
                let x_rad: Vec<f64> = y_slice[13..13 + radiation_len].to_vec();
                let (hull_nu, current_field_local, tau_wave_1, tau_wind) =
                    resolve_env_loads(t_sub, &nu, &quat, &environment, real_env, wind_geo);
                let (rudder_state, thrust, physical_loads) = if let (Some(system), Some(command)) =
                    (actuator_system, physical_commands)
                {
                    let evaluation = system.derivatives(
                        &y_slice[13 + radiation_len..specialist_offset], &mut dy[13 + radiation_len..specialist_offset], command,
                        reference_rates.as_ref().expect("执行器组参考速率已初始化"),
                        &LocalWater { time_s: t_sub, position_ned: position, quaternion: quat,
                            relative_velocity: hull_nu, environment: real_env },
                    );
                    (0.0, 0.0, Some(evaluation.loads))
                } else {
                    let rudder_state = y_slice[13 + radiation_len];
                    let omega_state = y_slice[14 + radiation_len];
                    let rudder_target = rudder_command_frozen.clamp(-servo.max_angle_rad, servo.max_angle_rad);
                    dy[13 + radiation_len] = ((rudder_target - rudder_state) / DT_SCALAR)
                        .clamp(-servo.max_rate_rad_s, servo.max_rate_rad_s);
                    let (thrust, propeller_torque) = propeller_loads_at(
                        &prop, propeller_installation.as_ref(), real_env,
                        t_sub, position, quat, hull_nu, omega_state,
                    );
                    dy[14 + radiation_len] = (motor_torque_frozen - propeller_torque
                        - shaft_friction(&shaft, omega_state)) / shaft.shaft_inertia;
                    (rudder_state, thrust, None)
                };
                let (mut external, tau_radiation, delta_eta) = assemble_forces(
                    &mmg, &low, radiation_model, &config, &rudder_hydrodynamics,
                    propeller_installation.as_ref(),
                    &nu, &hull_nu, &x_rad, rudder_state, thrust, &quat, &position, physical_loads, mapped_hull, component_drag,
                );
                external.tau_wave_1 = tau_wave_1;
                external.tau_wind = tau_wind;

                let state = TruthState {
                    position_ned: position,
                    quaternion: quat,
                    body_velocity: nu,
                    radiation_states: Vec::new(),
                    actuator_states: Default::default(),
                    specialist_states: Vec::new(),
                };
                let restoring = hydrostatic_hull.map_or_else(
                    || restoring_force(&rp, delta_eta),
                    |hull| hull.evaluate(&state, rb.mass_kg, SEA_WATER_DENSITY).restoring_body,
                );
                let mut out = dynamics_step_with_restoring(
                    &state, &rb, &am,
                    &current_field_local,
                    tau_radiation, restoring, &external,
                );
                if let Some(model) = sloshing {
                    let coupled = match model.evaluate(&state, &y_slice[specialist_offset..], out.nu_dot) {
                        Ok(evaluation) => evaluation,
                        Err(_) => { dy.fill(f64::NAN); return; },
                    };
                    dy[specialist_offset..].copy_from_slice(&coupled.modal_derivatives);
                    for axis in 0..6 { external.tau_special[axis] += coupled.reaction_body[axis]; }
                    out = dynamics_step_with_restoring(&state, &rb, &am, &current_field_local,
                        tau_radiation, restoring, &external);
                }
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
            };

            super::integrator::rk4_step(time, &mut y, substep_dt, derivs)?;
            if let Some(system) = &self.actuator_system {
                system.enforce_motor_limits(&mut y[13 + radiation_len..specialist_offset])?;
            }
            time += substep_dt;
        }
        let final_time_s = self.sim_time_s + dt;
        let mut final_state = self.state.clone();
        final_state.position_ned = [y[0], y[1], y[2]];
        final_state.quaternion = normalize_quaternion([y[3], y[4], y[5], y[6]]);
        final_state.body_velocity.copy_from_slice(&y[7..13]);
        final_state.radiation_states.copy_from_slice(&y[13..13 + radiation_len]);
        final_state.specialist_states.copy_from_slice(&y[specialist_offset..]);
        if let Some(system) = &self.actuator_system {
            final_state.actuator_states = system.decode_state(&y[13 + radiation_len..specialist_offset]);
            motor_torque_actual_nm = final_state.actuator_states.motor_torques_nm.first().copied().unwrap_or(0.0);
        } else {
            final_state.actuator_states.control_surface_angles_rad[0] = y[13 + radiation_len];
            final_state.actuator_states.propeller_shaft_speed_rad_s[0] =
                clamp_shaft_speed(&self.shaft, y[14 + radiation_len]);
        }

        let environment = if self.environment_enabled {
            EnvironmentField::disturbance_equivalent()
        } else {
            EnvironmentField::default()
        };
        let (final_hull_nu, current_field, tau_wave_1, tau_wind) = resolve_env_loads(
            final_time_s,
            &final_state.body_velocity,
            &final_state.quaternion,
            &environment,
            env_state.as_ref(),
            self.wind_geometry.as_ref(),
        );
        let (thrust, _) = propeller_loads_at(
            &self.prop, self.propeller_installation.as_ref(), env_state.as_ref(),
            final_time_s, final_state.position_ned, final_state.quaternion, final_hull_nu,
            final_state.actuator_states.propeller_shaft_speed_rad_s.first().copied().unwrap_or(0.0),
        );
        let physical_evaluation = self.actuator_system.as_ref().zip(physical_commands).map(|(system, command)| {
            let values = system.encode_state(&final_state.actuator_states);
            let mut rates = vec![0.0; values.len()];
            system.derivatives(&values, &mut rates, command, &vec![0.0; system.propulsors.len()],
                &LocalWater { time_s: final_time_s, position_ned: final_state.position_ned,
                    quaternion: final_state.quaternion, relative_velocity: final_hull_nu,
                    environment: env_state.as_ref() })
        });
        let physical_loads = physical_evaluation.as_ref().map(|evaluation| evaluation.loads);
        if let Some(evaluation) = physical_evaluation {
            final_state.actuator_states.motor_torques_nm = evaluation.motor_torques_nm;
            motor_torque_actual_nm = final_state.actuator_states.motor_torques_nm.first().copied().unwrap_or(0.0);
        }
        let (mut external, tau_rad, delta_eta) = assemble_forces(
            &self.mmg, &self.low, &self.radiation, &self.config, &self.rudder_hydrodynamics,
            self.propeller_installation.as_ref(),
            &final_state.body_velocity, &final_hull_nu, &final_state.radiation_states,
            final_state.actuator_states.control_surface_angles_rad.first().copied().unwrap_or(0.0),
            thrust,
            &final_state.quaternion, &final_state.position_ned, physical_loads, self.mapped_hull.as_ref(), self.component_drag.as_deref(),
        );
        external.tau_wave_1 = tau_wave_1;
        external.tau_wind = tau_wind;
        let restoring = self.hydrostatic_hull.as_deref().map_or_else(
            || restoring_force(&self.rp, delta_eta),
            |hull| hull.evaluate(&final_state, self.rb.mass_kg, SEA_WATER_DENSITY).restoring_body,
        );
        let mut final_output = dynamics_step_with_restoring(
            &final_state, &self.rb, &self.am,
            &current_field, tau_rad, restoring, &external,
        );
        if let Some(model) = &self.sloshing {
            let coupled = model.evaluate(&final_state, &final_state.specialist_states, final_output.nu_dot)
                .map_err(IntegrationError::InvalidSpecialistState)?;
            for axis in 0..6 { external.tau_special[axis] += coupled.reaction_body[axis]; }
            final_output = dynamics_step_with_restoring(&final_state, &self.rb, &self.am,
                &current_field, tau_rad, restoring, &external);
        }
        if let Some(index) = final_output.nu_dot.iter().position(|value| !value.is_finite()) {
            return Err(IntegrationError::NonFiniteState { stage: "final-dynamics", index });
        }
        self.sim_time_s = final_time_s;
        self.environment_state = env_state;
        self.motor_torque_actual_nm = motor_torque_actual_nm;
        self.state = final_state;
        self.last_output = Some(final_output);
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
        if let Some(model) = &self.sloshing {
            if state.specialist_states.len() != model.state_len() {
                state.specialist_states = vec![0.0; model.state_len()];
            }
        }
        if state.actuator_states.control_surface_angles_rad.is_empty() {
            state.actuator_states.control_surface_angles_rad =
                self.state.actuator_states.control_surface_angles_rad.clone();
        }
        if state.actuator_states.propeller_shaft_speed_rad_s.is_empty() {
            state.actuator_states.propeller_shaft_speed_rad_s =
                self.state.actuator_states.propeller_shaft_speed_rad_s.clone();
        }
        if let Some(system) = &self.actuator_system {
            if state.actuator_states.motor_torques_nm.is_empty() {
                state.actuator_states.motor_torques_nm = self.state.actuator_states.motor_torques_nm.clone();
            }
            if state.actuator_states.shaft_reference_speed_rad_s.is_empty() {
                state.actuator_states.shaft_reference_speed_rad_s =
                    self.state.actuator_states.shaft_reference_speed_rad_s.clone();
            }
            if state.actuator_states.azimuth_angles_rad.is_empty() {
                state.actuator_states.azimuth_angles_rad = self.state.actuator_states.azimuth_angles_rad.clone();
            }
            state.actuator_states = system.decode_state(&system.encode_state(&state.actuator_states));
        }
        self.state = state;
    }

    /// 运行时入口：恢复物理时间（逐帧重建时从请求 timeS 继续，
    /// 波浪等时变环境据此推进相位）。
    pub fn restore_time_for_runtime(&mut self, time_s: f64) {
        self.sim_time_s = time_s;
    }

    /// 运行时入口：恢复实际电机扭矩（限幅状态机连续性，逐帧重建场景）。
    pub fn restore_motor_torque_for_runtime(&mut self, torque_nm: f64) {
        self.motor_torque_actual_nm = torque_nm;
        for torque in &mut self.state.actuator_states.motor_torques_nm {
            *torque = torque_nm;
        }
        for demand in &mut self.state.actuator_states.motor_torque_demand_nm {
            *demand = torque_nm;
        }
    }

    pub fn motor_torque_actual_for_runtime(&self) -> f64 {
        self.state.actuator_states.motor_torques_nm.first().copied()
            .unwrap_or(self.motor_torque_actual_nm)
    }

    /// 运行时兼容入口：直接写实际舵角（旧标量状态重建时用）。
    pub fn set_rudder_actual_for_runtime(&mut self, rudder_rad: f64) {
        if let Some(system) = &self.actuator_system {
            for (index, surface) in system.surfaces.iter().enumerate() {
                if surface.normal_body == [0.0, 1.0, 0.0] {
                    self.state.actuator_states.control_surface_angles_rad[index] = rudder_rad;
                }
            }
            return;
        }
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

/// 解析环境场相对流速与风浪激励（子步与末拍分项共用，避免重复实现）。
fn resolve_env_loads(
    t_s: f64,
    nu: &[f64; 6],
    quat: &[f64; 4],
    environment: &EnvironmentField,
    real_env: Option<&crate::sixdof::environment_state::EnvironmentState>,
    wind_geo: Option<&crate::sixdof::wind::WindHullGeometry>,
) -> ([f64; 6], CurrentFieldBody, [f64; 6], [f64; 6]) {
    let mut current_field_local = CurrentFieldBody::default();
    let mut hull_nu = *nu;
    let mut tau_wave_1 = [0.0; 6];
    let mut tau_wind = [0.0; 6];
    let yaw_k = super::state::euler_from_quaternion(*quat).yaw_rad;
    if let (Some(env), Some(geo)) = (real_env, wind_geo) {
        let cur = env.current_body(yaw_k);
        let wave_coeffs = [5.0e3, 2.0e3, 1.0e4, 5.0e7, 1.0e8, 2.0e7];
        tau_wave_1 = env.wave_loads(t_s, wave_coeffs);
        tau_wind = env.wind_loads(yaw_k, *nu, geo);
        current_field_local = CurrentFieldBody {
            nu_current_body: [cur[0], cur[1], 0.0, 0.0, 0.0, 0.0],
            nu_current_body_dot: [0.0; 6],
        };
        hull_nu = [nu[0] - cur[0], nu[1] - cur[1], nu[2], nu[3], nu[4], nu[5]];
    } else if environment.enabled {
        let wave = environment.wave_moment_amplitude_nm
            * (2.0 * std::f64::consts::PI * t_s / environment.wave_period_s).sin();
        tau_wave_1 = [0.0, 0.0, 0.0, 0.15 * wave, 0.0, wave];
        current_field_local = CurrentFieldBody {
            nu_current_body: environment.current_body,
            nu_current_body_dot: [0.0; 6],
        };
        hull_nu = [
            nu[0] - environment.current_body[0],
            nu[1] - environment.current_body[1],
            nu[2],
            nu[3],
            nu[4],
            nu[5] - environment.current_body[5],
        ];
    }
    (hull_nu, current_field_local, tau_wave_1, tau_wind)
}

#[allow(clippy::too_many_arguments)]
fn propeller_loads_at(
    prop: &PropellerModel,
    installation: Option<&PropellerInstallation>,
    environment: Option<&crate::sixdof::EnvironmentState>,
    time_s: f64,
    position: [f64; 3],
    quaternion: [f64; 4],
    relative_velocity: [f64; 6],
    shaft_speed_rad_s: f64,
) -> (f64, f64) {
    let Some(installation) = installation else {
        return propeller_loads(prop, relative_velocity[0], shaft_speed_rad_s);
    };
    let rotation = super::state::rotation_matrix(quaternion);
    let mut point = position;
    for axis in 0..3 {
        point[axis] += rotation[axis].iter().zip(installation.position_body_m)
            .map(|(component, lever)| component * lever).sum::<f64>();
    }
    let active_wave = environment.filter(|env| env.switches.wave_enabled);
    let elevation = active_wave
        .map(|env| env.wave.elevation(time_s, point[0], point[1]))
        .unwrap_or(0.0);
    let immersion = installation.immersion_depth(position, quaternion, elevation);
    let lever = installation.position_body_m;
    let mut axial_velocity = relative_velocity[0]
        + relative_velocity[4] * lever[2] - relative_velocity[5] * lever[1];
    if let Some(env) = active_wave {
        let orbital = env.wave.orbital_velocity(
            time_s, point[0], point[1], -(immersion - elevation).max(0.0),
        );
        axial_velocity -= rotation[0][0] * orbital[0]
            + rotation[1][0] * orbital[1] + rotation[2][0] * orbital[2];
    }
    propeller_loads_with_ventilation(prop, axial_velocity, shaft_speed_rad_s, Some(immersion))
}

/// 子阶段力组装：船体、桨、舵（真实局部流速，无下限截断）、
/// 辐射记忆（连续形式 τ=C·(B·u+A·x)）与恢复偏差。
#[allow(clippy::too_many_arguments)]
fn assemble_forces(
    mmg: &HullMmgParams,
    low: &LowSpeedParams,
    radiation_model: &RadiationModel,
    config: &DestroyerSixDofConfig,
    rudder: &RudderHydrodynamics,
    propeller_installation: Option<&PropellerInstallation>,
    nu: &[f64; 6],
    nu_rel: &[f64; 6],
    x_rad: &[f64],
    rudder_state: f64,
    thrust_k: f64,
    quat: &[f64; 4],
    position: &[f64; 3],
    physical_loads: Option<[f64; 6]>,
    mapped_hull: Option<&MappedMmgHull>,
    component_drag: Option<&super::component_drag::ComponentDrag>,
) -> (ExternalForces, [f64; 6], [f64; 6]) {
    let loads = component_drag.map(|model| model.loads(nu_rel)).unwrap_or_else(|| {
        mapped_hull.map(|hull| hull.loads(nu_rel))
            .unwrap_or_else(|| blended_hull_loads(mmg, low, nu_rel[0], nu_rel[1], nu_rel[5]))
    });
    let arm = rudder.longitudinal_position_m;
    let v_rudder = nu_rel[1] + arm * nu_rel[5];
    // 真实局部流速：零速+零推进时舵动压为零（合同：禁止速度下限截断）。
    let flow_k = (nu_rel[0] * nu_rel[0] + v_rudder * v_rudder).sqrt();
    // 船艉向左摆（v_rudder < 0）时来流冲击直舵左舷产生右推恢复力矩（normal_k < 0），故与 rudder_state 同号相加。
    let alpha_k = rudder_state + v_rudder.atan2(nu_rel[0]);
    let area_r = 0.015 * config.length_m * config.draft_m;
    let lift_k = 0.5 * SEA_WATER_DENSITY * area_r * flow_k * flow_k
        * (2.0 * std::f64::consts::PI * alpha_k.sin());
    let normal_k = rudder.normal_factor * lift_k;
    let fx_r = -normal_k * rudder_state.sin();
    let fy_r = -rudder.lateral_factor * normal_k * rudder_state.cos();
    let mz_r = -((arm + 0.06 * config.length_m) * normal_k * rudder_state.cos());
    let k_roll_r = super::state::moment_from_force(
        [0.0, 0.0, -0.5 * config.draft_m],
        [fx_r, fy_r, 0.0],
    )[0];
    let propeller_lever = propeller_installation
        .map(|installation| installation.position_body_m)
        .unwrap_or([0.0, 0.0, -0.5 * config.draft_m]);
    let propeller_moment = super::state::moment_from_force(
        propeller_lever, [thrust_k, 0.0, 0.0],
    );

    let mut tau_radiation = [0.0f64; 6];
    for (i, mode) in radiation_model.modes.iter().enumerate() {
        let x_i = x_rad.get(i).copied().unwrap_or(0.0);
        tau_radiation[mode.channel] +=
            mode.output_gain * (mode.input_gain * nu[mode.channel] + mode.a * x_i);
    }

    let external = ExternalForces {
        tau_hull_viscous: loads,
        tau_actuator: physical_loads.unwrap_or([
            thrust_k + fx_r,
            fy_r,
            0.0,
            k_roll_r + propeller_moment[0],
            propeller_moment[1],
            mz_r + propeller_moment[2],
        ]),
        ..ExternalForces::default()
    };
    let euler = super::state::euler_from_quaternion(*quat);
    let delta_eta = [0.0, 0.0, position[2], euler.roll_rad, euler.pitch_rad, euler.yaw_rad];
    (external, tau_radiation, delta_eta)
}

/// 环境场（T 级等效扰动；真实风浪流随 #2156 接入）。
#[derive(Debug, Clone, Copy)]
pub struct EnvironmentField {
    pub enabled: bool,
    /// 体坐标恒定流（经相对来流进入船体/舵，唯一流路径）。
    pub current_body: [f64; 6],
    /// 一阶波浪力矩幅值（N·m，正弦慢漂等效）。
    pub wave_moment_amplitude_nm: f64,
    pub wave_period_s: f64,
}

impl Default for EnvironmentField {
    fn default() -> Self {
        Self { enabled: false, current_body: [0.0; 6], wave_moment_amplitude_nm: 0.0, wave_period_s: 8.0 }
    }
}

impl EnvironmentField {
    /// 教学等效扰动：恒定横流 1.2 m/s + 波浪力矩幅值 3e6 N·m / 8 s
    /// （量级对齐 destroyer_hifi 扰动直航教学场景）。
    ///
    /// issue-2156-p1 阶段 A 边界：真实 JONSWAP 波场（wave.rs）、分量风载
    /// 与阵风（wind.rs）、传感器链（sensor.rs）已作为独立模块交付并通过
    /// 算例；本字段在 plant 内的直接替换与 #2147 全船接线同批落地，此间
    /// 在线扰动通道维持等效场以保持行为连续。
    pub fn disturbance_equivalent() -> Self {
        Self {
            enabled: true,
            current_body: [0.0, 1.2, 0.0, 0.0, 0.0, 0.0],
            wave_moment_amplitude_nm: 3.0e6,
            wave_period_s: 8.0,
        }
    }
}
