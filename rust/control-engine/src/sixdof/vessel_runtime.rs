//! 通用六船 WASM 入口（issue-2147 vessel-drives 收敛）。
//!
//! 同一 sixdof 内核（TruthPlant + EnvironmentState + 观测链），按请求中
//! 的 vessel 参数包构造 per-vessel plant——六船逐船迁移到同一物理后台，
//! TS vessel-drives 收敛为纯配置/命令适配器。
//!
//! 请求 schema 与 destroyer_hifi 兼容（dtS/controlMode/pid/state 等），
//! 额外字段 `vessel` 携带几何/操纵/执行器参数（缺省为 055 T 级标称）。

use serde::Deserialize;

use crate::sixdof::control_law::{
    HeadingControlMode, HeadingPidGains, command_rudder_deg,
};
use crate::sixdof::destroyer_plant::{
    DestroyerCommands, DestroyerSixDofConfig, DestroyerSixDofPlant,
};
use crate::sixdof::state::TruthState;
use crate::sixdof::{EnvironmentState, WindHullGeometry};

pub const VESSEL_MODEL_VERSION: &str = "sixdof-vessel-v1";

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct VesselParams {
    length_m: f64,
    beam_m: f64,
    draft_m: f64,
    displacement_t: f64,
    cruise_speed_mps: f64,
    max_rudder_deg: f64,
    max_rudder_rate_deg_s: f64,
    gm_transverse_m: f64,
    gm_longitudinal_m: f64,
}

impl VesselParams {
    fn to_config(&self) -> DestroyerSixDofConfig {
        DestroyerSixDofConfig {
            length_m: if self.length_m > 0.0 { self.length_m } else { 180.0 },
            beam_m: if self.beam_m > 0.0 { self.beam_m } else { 20.0 },
            draft_m: if self.draft_m > 0.0 { self.draft_m } else { 6.6 },
            displacement_t: if self.displacement_t > 0.0 { self.displacement_t } else { 13000.0 },
            cruise_speed_mps: if self.cruise_speed_mps > 0.0 { self.cruise_speed_mps } else { 15.0 },
            max_rudder_deg: if self.max_rudder_deg > 0.0 { self.max_rudder_deg } else { 35.0 },
            max_rudder_rate_deg_s: if self.max_rudder_rate_deg_s > 0.0 { self.max_rudder_rate_deg_s } else { 5.0 },
            gm_transverse_m: if self.gm_transverse_m > 0.0 { self.gm_transverse_m } else { 1.2 },
            gm_longitudinal_m: if self.gm_longitudinal_m > 0.0 { self.gm_longitudinal_m } else { 150.0 },
            waterline_area_coefficient: 0.82,
        }
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct VesselState {
    time_s: f64,
    heading_deg: f64,
    speed_mps: f64,
    /// 控制律往返状态（PID 积分 / 前值误差）。
    integral_deg_s: f64,
    prev_error_deg: f64,
    sixdof_state: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VesselRequest {
    #[serde(default)]
    dt_s: f64,
    #[serde(default)]
    target_heading_deg: f64,
    /// 控制模式（serde 小写：manual/p/pd/pid；与 destroyer_hifi 同一合同）。
    control_mode: HeadingControlMode,
    #[serde(default)]
    pid: HeadingPidGains,
    #[serde(default)]
    manual_rudder_deg: f64,
    #[serde(default)]
    disturbance_enabled: bool,
    #[serde(default)]
    vessel: VesselParams,
    #[serde(default)]
    state: VesselState,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VesselResult {
    time_s: f64,
    heading_deg: f64,
    yaw_rate_deg_s: f64,
    position_x_m: f64,
    position_y_m: f64,
    rudder_deg: f64,
    speed_mps: f64,
    surge_mps: f64,
    sway_mps: f64,
    /// 控制律状态往返（下帧作为 state.integralDegS/prevErrorDeg 传入）。
    integral_deg_s: f64,
    prev_error_deg: f64,
    sixdof_state: serde_json::Value,
    model_version: String,
}

use serde::Serialize;

pub fn compute_vessel_sixdof_step_json(request_json: &str) -> Result<String, String> {
    let request: VesselRequest = serde_json::from_str(request_json)
        .map_err(|e| format!("vessel sixdof 请求解析失败: {e}"))?;
    if !(request.dt_s.is_finite()) || request.dt_s <= 0.0 || request.dt_s > 1.0 {
        return Err(format!("vessel sixdof 拒绝非法帧时长 dt_s={}", request.dt_s));
    }

    let config = request.vessel.to_config();
    let mut plant = DestroyerSixDofPlant::new(config);

    // 环境场（disturbance → E1 组合工况；种子固定训练值）。
    let seed = 20261106u64;
    let wind_geo = WindHullGeometry {
        frontal_area_m2: 380.0,
        lateral_area_m2: 1200.0,
        length_m: config.length_m,
        pressure_center_body: [4.0, 0.0, -6.0],
    };
    let environment = if request.disturbance_enabled {
        EnvironmentState::e1(seed)
    } else {
        EnvironmentState::calm(seed)
    };
    plant.set_environment_state(environment, wind_geo);
    plant.restore_time_for_runtime(request.state.time_s);

    // 状态恢复：完整 sixdofState 往返（P1）或标量字段重建（P2）。
    let mut motor_torque_restore: Option<f64> = None;
    if let Some(six) = request.state.sixdof_state.as_ref() {
        // P1：完整 sixdofState——恢复位置/四元数/速度/辐射/执行器。
        let pos = six.get("positionNed").and_then(|v| v.as_array());
        let quat = six.get("quaternion").and_then(|v| v.as_array());
        let vel = six.get("bodyVelocity").and_then(|v| v.as_array());
        let rad = six.get("radiationStates").and_then(|v| v.as_array());
        if let (Some(quat), Some(vel)) = (quat, vel) {
            if quat.len() == 4 && vel.len() == 6 {
                let mut state = TruthState {
                    position_ned: [
                        pos.and_then(|p| p.first()).and_then(|v| v.as_f64()).unwrap_or(0.0),
                        pos.and_then(|p| p.get(1)).and_then(|v| v.as_f64()).unwrap_or(0.0),
                        pos.and_then(|p| p.get(2)).and_then(|v| v.as_f64()).unwrap_or(0.0),
                    ],
                    quaternion: [
                        quat[0].as_f64().unwrap_or(1.0),
                        quat[1].as_f64().unwrap_or(0.0),
                        quat[2].as_f64().unwrap_or(0.0),
                        quat[3].as_f64().unwrap_or(0.0),
                    ],
                    body_velocity: [
                        vel[0].as_f64().unwrap_or(config.cruise_speed_mps),
                        vel[1].as_f64().unwrap_or(0.0),
                        vel[2].as_f64().unwrap_or(0.0),
                        vel[3].as_f64().unwrap_or(0.0),
                        vel[4].as_f64().unwrap_or(0.0),
                        vel[5].as_f64().unwrap_or(0.0),
                    ],
                    radiation_states: rad
                        .map(|r| r.iter().filter_map(|v| v.as_f64()).collect())
                        .unwrap_or_default(),
                    actuator_states: Default::default(),
                    specialist_states: vec![],
                };
                // 执行器实际值恢复。
                let rudder = six.get("rudderActualRad").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let omega = six.get("shaftSpeedRadS").and_then(|v| v.as_f64()).unwrap_or(12.0);
                state.actuator_states.control_surface_angles_rad = vec![rudder];
                state.actuator_states.propeller_shaft_speed_rad_s = vec![omega];
                motor_torque_restore = six.get("motorTorqueActualNm").and_then(|v| v.as_f64());
                plant.restore_state(state);
            }
        }
    } else {
        // P2：标量字段重建（destroyer_hifi 兼容）——航向→四元数、航速→u。
        let yaw = request.state.heading_deg.to_radians();
        let (sin_h, cos_h) = (yaw / 2.0).sin_cos();
        let u = if request.state.speed_mps > 0.0 {
            request.state.speed_mps
        } else {
            config.cruise_speed_mps
        };
        let state = TruthState {
            quaternion: [cos_h, 0.0, 0.0, sin_h],
            body_velocity: [u, 0.0, 0.0, 0.0, 0.0, 0.0],
            ..Default::default()
        };
        plant.restore_state(state);
        plant.prewarm_radiation_for_test();
    }
    if let Some(torque) = motor_torque_restore {
        plant.restore_motor_torque_for_runtime(torque);
    }

    // 控制律：与 destroyer_hifi 共享（control_law）——P/PD/PID 完整增益、
    // wrap_180 最短圆周角、积分限幅与状态往返；舵限取 per-vessel 参数。
    let control = command_rudder_deg(
        request.control_mode,
        &request.pid,
        request.target_heading_deg,
        request.state.heading_deg,
        request.manual_rudder_deg,
        request.dt_s,
        request.state.integral_deg_s,
        request.state.prev_error_deg,
        config.max_rudder_deg,
    );
    let rudder_cmd = control.rudder_deg;

    let commands = DestroyerCommands {
        rudder_command_rad: rudder_cmd.to_radians(),
        motor_torque_command_nm: 1.543e6,
    };

    let steps = ((request.dt_s / (1.0 / 120.0)).ceil() as usize).max(1);
    let substep_dt = request.dt_s / steps as f64;
    for _ in 0..steps {
        plant
            .step_with_dt(substep_dt, commands)
            .map_err(|e| format!("vessel sixdof 推进失败: {e:?}"))?;
    }

    let state = plant.state();
    let euler = crate::sixdof::state::euler_from_quaternion(state.quaternion);
    let u = state.body_velocity[0];
    let v = state.body_velocity[1];
    let sixdof_state = serde_json::json!({
        "positionNed": state.position_ned,
        "quaternion": state.quaternion,
        "bodyVelocity": state.body_velocity,
        "radiationStates": state.radiation_states,
        "rudderActualRad": state.actuator_states.control_surface_angles_rad[0],
        "shaftSpeedRadS": state.actuator_states.propeller_shaft_speed_rad_s[0],
        "motorTorqueActualNm": plant.motor_torque_actual_for_runtime(),
    });

    let result = VesselResult {
        time_s: request.state.time_s + request.dt_s,
        heading_deg: euler.yaw_rad.to_degrees(),
        yaw_rate_deg_s: state.body_velocity[5].to_degrees(),
        position_x_m: state.position_ned[0],
        position_y_m: state.position_ned[1],
        rudder_deg: state.actuator_states.control_surface_angles_rad[0].to_degrees(),
        speed_mps: (u * u + v * v).sqrt(),
        surge_mps: u,
        sway_mps: v,
        sixdof_state,
        integral_deg_s: control.integral_deg_s,
        prev_error_deg: control.error_deg,
        model_version: VESSEL_MODEL_VERSION.to_string(),
    };

    serde_json::to_string(&result).map_err(|e| format!("vessel sixdof 序列化失败: {e}"))
}
