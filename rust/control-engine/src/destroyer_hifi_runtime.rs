use serde::{Deserialize, Serialize};

use crate::destroyer_hifi::{
    disturbance_at, params, step_mmg, wrap_pi, DestroyerExperimentConfig, DisturbanceVector,
    MmgState, DEG,
};

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum DestroyerControlMode {
    Manual,
    P,
    Pd,
    Pid,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DestroyerPidGains {
    kp: f64,
    ki: f64,
    kd: f64,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DestroyerRuntimeState {
    time_s: f64,
    heading_deg: f64,
    yaw_rate_deg_s: f64,
    position_x_m: f64,
    position_y_m: f64,
    rudder_deg: f64,
    speed_mps: f64,
    #[serde(default)]
    surge_mps: Option<f64>,
    #[serde(default)]
    sway_mps: Option<f64>,
    #[serde(default)]
    integral_deg_s: f64,
    #[serde(default)]
    prev_error_deg: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DestroyerRuntimeRequest {
    model_id: String,
    dt_s: f64,
    target_heading_deg: f64,
    control_mode: DestroyerControlMode,
    pid: DestroyerPidGains,
    manual_rudder_deg: f64,
    disturbance_enabled: bool,
    state: DestroyerRuntimeState,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DestroyerRuntimeResult {
    time_s: f64,
    target_heading_deg: f64,
    heading_deg: f64,
    yaw_rate_deg_s: f64,
    position_x_m: f64,
    position_y_m: f64,
    rudder_deg: f64,
    speed_mps: f64,
    surge_mps: f64,
    sway_mps: f64,
    integral_deg_s: f64,
    prev_error_deg: f64,
}

fn finite_or(value: f64, fallback: f64) -> f64 {
    if value.is_finite() {
        value
    } else {
        fallback
    }
}

fn command_rudder_deg(request: &DestroyerRuntimeRequest, dt_s: f64) -> (f64, f64, f64) {
    match request.control_mode {
        DestroyerControlMode::Manual => (request.manual_rudder_deg, 0.0, 0.0),
        DestroyerControlMode::P | DestroyerControlMode::Pd | DestroyerControlMode::Pid => {
            let current = request.state.heading_deg * DEG;
            let target = request.target_heading_deg * DEG;
            let error_deg = wrap_pi(target - current) / DEG;
            let integral_deg_s = if matches!(request.control_mode, DestroyerControlMode::Pid) {
                (request.state.integral_deg_s + error_deg * dt_s).clamp(-80.0, 80.0)
            } else {
                0.0
            };
            let derivative_deg_s = if dt_s > 1e-9 {
                (error_deg - request.state.prev_error_deg) / dt_s
            } else {
                0.0
            };
            let ki = if matches!(request.control_mode, DestroyerControlMode::Pid) {
                request.pid.ki
            } else {
                0.0
            };
            let kd = if matches!(
                request.control_mode,
                DestroyerControlMode::Pd | DestroyerControlMode::Pid
            ) {
                request.pid.kd
            } else {
                0.0
            };
            let rudder = request.pid.kp * error_deg + ki * integral_deg_s + kd * derivative_deg_s;
            (rudder, integral_deg_s, error_deg)
        }
    }
}

fn to_mmg_state(state: DestroyerRuntimeState) -> MmgState {
    let heading = state.heading_deg * DEG;
    let speed = finite_or(state.speed_mps, 15.0).max(0.1);
    MmgState {
        x: finite_or(state.position_x_m, 0.0),
        y: finite_or(state.position_y_m, 0.0),
        psi: heading,
        u: finite_or(state.surge_mps.unwrap_or(speed), speed),
        v: finite_or(state.sway_mps.unwrap_or(0.0), 0.0),
        r: finite_or(state.yaw_rate_deg_s, 0.0) * DEG,
        rudder: finite_or(state.rudder_deg, 0.0) * DEG,
    }
}

fn from_mmg_state(
    request: &DestroyerRuntimeRequest,
    state: MmgState,
    integral_deg_s: f64,
    prev_error_deg: f64,
) -> DestroyerRuntimeResult {
    DestroyerRuntimeResult {
        time_s: request.state.time_s + request.dt_s,
        target_heading_deg: request.target_heading_deg,
        heading_deg: state.psi / DEG,
        yaw_rate_deg_s: state.r / DEG,
        position_x_m: state.x,
        position_y_m: state.y,
        rudder_deg: state.rudder / DEG,
        speed_mps: (state.u * state.u + state.v * state.v).sqrt(),
        surge_mps: state.u,
        sway_mps: state.v,
        integral_deg_s,
        prev_error_deg,
    }
}

pub fn compute_virtual_simulation_step_json(request_json: &str) -> Result<String, String> {
    let request: DestroyerRuntimeRequest =
        serde_json::from_str(request_json).map_err(|error| error.to_string())?;
    if request.model_id != "destroyer_hifi" {
        return Err(format!("不支持的虚拟仿真模型: {}", request.model_id));
    }
    if !request.dt_s.is_finite() || request.dt_s <= 0.0 || request.dt_s > 1.0 {
        return Err("dtS 必须位于 (0, 1] 秒。".to_string());
    }

    let mut config = DestroyerExperimentConfig::default();
    config.dt_s = request.dt_s;
    let p = params(&config);
    let ship = to_mmg_state(request.state);
    let (command_deg, integral_deg_s, prev_error_deg) = command_rudder_deg(&request, request.dt_s);
    let disturbance = if request.disturbance_enabled {
        disturbance_at(request.state.time_s, true, &config)
    } else {
        DisturbanceVector::zero()
    };
    let next = step_mmg(ship, command_deg * DEG, &config, p, disturbance);
    let result = from_mmg_state(&request, next, integral_deg_s, prev_error_deg);
    serde_json::to_string(&result).map_err(|error| error.to_string())
}
