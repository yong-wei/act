//! 通用六船 WASM 入口（issue-2147 vessel-drives 收敛）。
//!
//! 同一 sixdof 内核（TruthPlant + EnvironmentState + 观测链），按请求中
//! 的 vessel 参数包构造 per-vessel plant——六船逐船迁移到同一物理后台，
//! TS vessel-drives 收敛为纯配置/命令适配器。
//!
//! 请求 schema 与 destroyer_hifi 兼容（dtS/controlMode/pid/state 等），
//! 额外字段 `vessel` 携带几何/操纵/执行器参数（缺省为 055 T 级标称）。

use serde::Deserialize;

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
    sixdof_state: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VesselRequest {
    #[serde(default)]
    dt_s: f64,
    #[serde(default)]
    target_heading_deg: f64,
    control_mode: String,
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

    // 状态恢复。
    if request.state.sixdof_state.is_some() {
        let six = request.state.sixdof_state.as_ref().unwrap();
        if let (Some(quat), Some(vel)) = (
            six.get("quaternion").and_then(|v| v.as_array()),
            six.get("bodyVelocity").and_then(|v| v.as_array()),
        ) {
            if quat.len() == 4 && vel.len() == 6 {
                let mut state = TruthState {
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
                    ..Default::default()
                };
                // 恢复辐射稳态。
                state.radiation_states = Default::default();
                plant.restore_state(state);
                plant.prewarm_radiation_for_test();
            }
        }
    }

    // 控制律：manual 直通 / P-PD-PID 航向反馈。
    let rudder_cmd = if request.control_mode == "manual" {
        request.manual_rudder_deg
    } else {
        let error = request.target_heading_deg - request.state.heading_deg;
        (error.clamp(-10.0, 10.0)).clamp(-35.0, 35.0)
    };

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
        "quaternion": state.quaternion,
        "bodyVelocity": state.body_velocity,
        "radiationStates": state.radiation_states,
        "rudderActualRad": state.actuator_states.control_surface_angles_rad[0],
        "shaftSpeedRadS": state.actuator_states.propeller_shaft_speed_rad_s[0],
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
        model_version: VESSEL_MODEL_VERSION.to_string(),
    };

    serde_json::to_string(&result).map_err(|e| format!("vessel sixdof 序列化失败: {e}"))
}
