//! 055 六自由度 TruthPlant 的 WASM 运行时入口（issue-2153-p1 A2.1/A2.4）。
//!
//! 取代 `destroyer_hifi_runtime` 成为 `model_id = "destroyer_hifi"` 的
//! 分发目标（前端 JSON 契约保持兼容，行为升级为六自由度真值后台）：
//! - 请求 `dt_s` 为帧时长（可变），内核按合同以固定 1/120 子步推进；
//! - 状态优先使用可选 `sixdofState`（完整 TruthState），缺失时从旧标量
//!   字段重建（向后兼容旧客户端）；
//! - run 冻结合同（A2.4）：首次调用生成 manifest（模型/参数包/环境/
//!   传感器/课程/步骤/控制器工件/初始状态/因素掩码/种子），随状态往返
//!   携带；控制器或因素掩码变化 → 新 manifest（`manifestReset = true`），
//!   不得改写旧证据。
//!
//! 环境场（风浪流）首版为零（factorMask 留位，#2156 接入）。

use serde::{Deserialize, Serialize};

use crate::sixdof::destroyer_plant::{
    DestroyerCommands, DestroyerSixDofConfig, DestroyerSixDofPlant,
};
use crate::sixdof::state::TruthState;

const DEG: f64 = std::f64::consts::PI / 180.0;
pub const SIX_DOF_MODEL_VERSION: &str = "sixdof-destroyer-v1";
pub const SIX_DOF_ENVIRONMENT_VERSION: &str = "calm-v0";
pub const SIX_DOF_SENSOR_VERSION: &str = "truth-v0";

#[derive(Clone, Copy, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimePidGains {
    #[serde(default)]
    kp: f64,
    #[serde(default)]
    ki: f64,
    #[serde(default)]
    kd: f64,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum RuntimeControlMode {
    Manual,
    P,
    Pd,
    Pid,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeSixDofState {
    position_ned: Vec<f64>,
    quaternion: Vec<f64>,
    body_velocity: Vec<f64>,
    radiation_states: Vec<f64>,
    rudder_actual_rad: f64,
    shaft_speed_rad_s: f64,
    /// 实际电机扭矩（限幅状态机连续性，P1：逐帧重建必须恢复）。
    #[serde(default)]
    motor_torque_actual_nm: f64,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeRunManifest {
    manifest_id: String,
    model_version: String,
    parameter_bundle_hash: String,
    environment_version: String,
    sensor_version: String,
    course_version: String,
    step_id: String,
    controller_artifact: String,
    factor_mask: Vec<String>,
    /// 冻结初态摘要（P2：不同初态必须不同 run 身份）。
    initial_state: String,
    seed: u64,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeState {
    #[serde(default)]
    time_s: f64,
    #[serde(default)]
    heading_deg: f64,
    #[serde(default)]
    yaw_rate_deg_s: f64,
    #[serde(default)]
    position_x_m: f64,
    #[serde(default)]
    position_y_m: f64,
    #[serde(default)]
    rudder_deg: f64,
    #[serde(default)]
    speed_mps: f64,
    #[serde(default)]
    surge_mps: f64,
    #[serde(default)]
    sway_mps: f64,
    #[serde(default)]
    integral_deg_s: f64,
    #[serde(default)]
    prev_error_deg: f64,
    #[serde(default)]
    sixdof_state: Option<RuntimeSixDofState>,
    #[serde(default)]
    run_manifest: Option<RuntimeRunManifest>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeRequest {
    #[serde(default)]
    dt_s: f64,
    #[serde(default)]
    target_heading_deg: f64,
    control_mode: RuntimeControlMode,
    #[serde(default)]
    pid: RuntimePidGains,
    #[serde(default)]
    manual_rudder_deg: f64,
    #[serde(default)]
    disturbance_enabled: bool,
    #[serde(default)]
    course_version: String,
    #[serde(default)]
    step_id: String,
    #[serde(default)]
    state: RuntimeState,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeResult {
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
    sixdof_state: RuntimeSixDofState,
    run_manifest: RuntimeRunManifest,
    manifest_reset: bool,
}

/// 最短圆周角归一化（P2：跨 ±180° 边界的小误差不得放大成 360°）。
fn wrap_180(deg: f64) -> f64 {
    let mut value = deg;
    while value > 180.0 {
        value -= 360.0;
    }
    while value < -180.0 {
        value += 360.0;
    }
    value
}

fn fnv_u64(bytes: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in bytes {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

fn parameter_bundle_hash(_config: &DestroyerSixDofConfig) -> String {
    // issue-2157：哈希源切换为结构化参数包（含模型版本）；改包即换 run。
    match crate::sixdof::embedded_destroyer_055() {
        Ok(pack) => format!("{}@{}", pack.manifest.model_version, pack.content_hash),
        // 包损坏属部署缺陷：退回配置哈希并显式标记未验证来源。
        Err(_) => format!("unverified-fallback:{:016x}", 0),
    }
}

fn controller_artifact(mode: &RuntimeControlMode, pid: &RuntimePidGains, manual: f64) -> String {
    let raw = format!(
        "{:?}|{:.6}|{:.6}|{:.6}|{:.4}",
        mode, pid.kp, pid.ki, pid.kd, manual
    );
    format!("fnv1a-{:016x}", fnv_u64(raw.as_bytes()))
}

fn factor_mask(disturbance_enabled: bool) -> Vec<String> {
    if disturbance_enabled {
        vec!["disturbance".to_string()]
    } else {
        Vec::new()
    }
}

fn initial_state_digest(state: &RuntimeState) -> String {
    let raw = if let Some(six) = &state.sixdof_state {
        format!(
            "six|{:.4}|{:.4}|{:.4}",
            six.quaternion.first().copied().unwrap_or(1.0),
            six.quaternion.get(3).copied().unwrap_or(0.0),
            six.body_velocity.first().copied().unwrap_or(0.0),
        )
    } else {
        format!(
            "legacy|{:.4}|{:.4}",
            state.heading_deg, state.speed_mps,
        )
    };
    format!("fnv1a-{:016x}", fnv_u64(raw.as_bytes()))
}

fn build_manifest(request: &RuntimeRequest) -> RuntimeRunManifest {
    let controller = controller_artifact(
        &request.control_mode,
        &request.pid,
        request.manual_rudder_deg,
    );
    let mask = factor_mask(request.disturbance_enabled);
    let initial_state = initial_state_digest(&request.state);
    let seed = 20261106u64; // 训练种子（验证 run 由参数覆盖）
    let identity = format!(
        "{}|{}|{}|{}|{}|{}|{:?}|{}|{}|{}",
        SIX_DOF_MODEL_VERSION,
        parameter_bundle_hash(&DestroyerSixDofConfig::default()),
        SIX_DOF_ENVIRONMENT_VERSION,
        SIX_DOF_SENSOR_VERSION,
        request.course_version,
        request.step_id,
        controller,
        initial_state,
        mask.join(","),
        seed,
    );
    RuntimeRunManifest {
        manifest_id: format!("fnv1a-{:016x}", fnv_u64(identity.as_bytes())),
        model_version: SIX_DOF_MODEL_VERSION.to_string(),
        parameter_bundle_hash: parameter_bundle_hash(&DestroyerSixDofConfig::default()),
        environment_version: SIX_DOF_ENVIRONMENT_VERSION.to_string(),
        sensor_version: SIX_DOF_SENSOR_VERSION.to_string(),
        course_version: request.course_version.clone(),
        step_id: request.step_id.clone(),
        controller_artifact: controller,
        factor_mask: mask,
        initial_state,
        seed,
    }
}

fn manifest_matches(existing: &RuntimeRunManifest, request: &RuntimeRequest) -> bool {
    let fresh = build_manifest(request);
    existing.controller_artifact == fresh.controller_artifact
        && existing.factor_mask == fresh.factor_mask
        && existing.course_version == fresh.course_version
        && existing.step_id == fresh.step_id
        && existing.model_version == fresh.model_version
        // issue-2157：参数包哈希变化（升级/换包）必须使旧 run 失效。
        && existing.parameter_bundle_hash == fresh.parameter_bundle_hash
}

fn rebuild_plant(state: &RuntimeState) -> DestroyerSixDofPlant {
    // issue-2157 A3：物理参数单一真源——从已校验参数包构造。
    let pack = crate::sixdof::embedded_destroyer_055()
        .expect("内嵌参数包必须通过门禁（部署期资产损坏属构建失败）");
    let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, DestroyerSixDofConfig::default());
    if let Some(six) = &state.sixdof_state {
        if six.quaternion.len() == 4 && six.body_velocity.len() == 6 {
            let mut full = TruthState::default();
            full.position_ned = [
                six.position_ned.first().copied().unwrap_or(0.0),
                six.position_ned.get(1).copied().unwrap_or(0.0),
                six.position_ned.get(2).copied().unwrap_or(0.0),
            ];
            full.quaternion = [
                six.quaternion[0], six.quaternion[1], six.quaternion[2], six.quaternion[3],
            ];
            let mut nu = [0.0f64; 6];
            for (slot, value) in nu.iter_mut().zip(six.body_velocity.iter()) {
                *slot = *value;
            }
            full.body_velocity = nu;
            full.radiation_states = six.radiation_states.clone();
            full.actuator_states.propeller_shaft_speed_rad_s = vec![six.shaft_speed_rad_s];
            full.actuator_states.control_surface_angles_rad = vec![six.rudder_actual_rad];
            plant.restore_state(full);
            plant.restore_motor_torque_for_runtime(six.motor_torque_actual_nm);
        }
        plant
    } else {
        // 向后兼容：旧标量状态重建（航向→四元数、航速→纵向速度）。
        let yaw = state.heading_deg * DEG;
        let (sin_half, cos_half) = (yaw / 2.0).sin_cos();
        let u = if state.surge_mps.abs() > 1e-9 {
            state.surge_mps
        } else {
            state.speed_mps
        };
        let v = state.sway_mps;
        plant.restore_state(TruthState {
            position_ned: [state.position_x_m, state.position_y_m, 0.0],
            quaternion: [cos_half, 0.0, 0.0, sin_half],
            body_velocity: [u, v, 0.0, 0.0, 0.0, state.yaw_rate_deg_s * DEG],
            radiation_states: Vec::new(),
            actuator_states: Default::default(),
            specialist_states: Vec::new(),
        });
        plant.set_rudder_actual_for_runtime(state.rudder_deg * DEG);
        plant.prewarm_radiation_for_test();
        plant
    }
}

/// PID/PD/P 舵令（deg，含积分/微分状态推进），复刻 hifi 控制律语义。
fn command_rudder_deg(
    request: &RuntimeRequest,
    dt_s: f64,
    integral_in: f64,
    prev_error_in: f64,
) -> (f64, f64, f64) {
    match request.control_mode {
        RuntimeControlMode::Manual => (request.manual_rudder_deg, 0.0, 0.0),
        RuntimeControlMode::P | RuntimeControlMode::Pd | RuntimeControlMode::Pid => {
            let error_deg = wrap_180(request.target_heading_deg - request.state.heading_deg);
            let integral = if matches!(request.control_mode, RuntimeControlMode::Pid) {
                (integral_in + error_deg * dt_s).clamp(-80.0, 80.0)
            } else {
                0.0
            };
            let derivative = if dt_s > 1e-9 {
                (error_deg - prev_error_in) / dt_s
            } else {
                0.0
            };
            let ki = if matches!(request.control_mode, RuntimeControlMode::Pid) {
                request.pid.ki
            } else {
                0.0
            };
            let kd = if matches!(
                request.control_mode,
                RuntimeControlMode::Pd | RuntimeControlMode::Pid
            ) {
                request.pid.kd
            } else {
                0.0
            };
            let rudder = (request.pid.kp * error_deg + ki * integral + kd * derivative)
                .clamp(-35.0, 35.0);
            (rudder, integral, error_deg)
        }
    }
}

pub fn compute_destroyer_sixdof_step_json(request_json: &str) -> Result<String, String> {
    let request: RuntimeRequest =
        serde_json::from_str(request_json).map_err(|e| format!("sixdof 请求解析失败: {e}"))?;
    if !(request.dt_s.is_finite()) || request.dt_s <= 0.0 || request.dt_s > 1.0 {
        return Err(format!("sixdof 拒绝非法帧时长 dt_s={}", request.dt_s));
    }

    let (manifest, manifest_reset) = match &request.state.run_manifest {
        Some(existing) if manifest_matches(existing, &request) => (existing.clone(), false),
        _ => (build_manifest(&request), true),
    };

    let mut plant = rebuild_plant(&request.state);
    let (rudder_command_deg, integral, prev_error) = command_rudder_deg(
        &request,
        request.dt_s,
        request.state.integral_deg_s,
        request.state.prev_error_deg,
    );
    let commands = DestroyerCommands {
        rudder_command_rad: rudder_command_deg * DEG,
        // 首版巡航平衡扭矩（参数包化后由 manifest 携带）。
        motor_torque_command_nm: 1.543e6,
    };

    // 固定 1/120 子步推进帧时长（合同：内核步长恒定）。
    // issue-2147 运行接线：在线 disturbance→E1 真实环境场（种子 JONSWAP
    // 波浪 + Fujiwara 风载 + 恒定均匀流），替换旧 T 级等效开关。
    // 风载几何（T 级 055 水上投影；参数包化后随 manifest 携带）。
    let wind_geo = crate::sixdof::WindHullGeometry {
        frontal_area_m2: 380.0,
        lateral_area_m2: 1200.0,
        length_m: 180.0,
        pressure_center_body: [4.0, 0.0, -6.0],
    };
    // P1：种子从 manifest 冻结值统一读取（首帧=20261106 训练种子，
    // 后续帧与 manifest 一致——不同分帧/不同帧长下环境演化一致）。
    let frozen_seed = request
        .state
        .run_manifest
        .as_ref()
        .map(|m| m.seed)
        .unwrap_or(20261106);
    let environment = if request.disturbance_enabled {
        crate::sixdof::EnvironmentState::e1(frozen_seed)
    } else {
        crate::sixdof::EnvironmentState::calm(frozen_seed)
    };
    plant.set_environment_state(environment, wind_geo);
    plant.restore_time_for_runtime(request.state.time_s);
    plant
        .step_with_dt(request.dt_s, commands)
        .map_err(|e| format!("sixdof 推进失败: {e:?}"))?;

    let state = plant.state();
    let euler = crate::sixdof::state::euler_from_quaternion(state.quaternion);
    let u = state.body_velocity[0];
    let v = state.body_velocity[1];
    let result = RuntimeResult {
        time_s: request.state.time_s + request.dt_s,
        target_heading_deg: request.target_heading_deg,
        heading_deg: euler.yaw_rad / DEG,
        yaw_rate_deg_s: state.body_velocity[5] / DEG,
        position_x_m: state.position_ned[0],
        position_y_m: state.position_ned[1],
        rudder_deg: state.actuator_states.control_surface_angles_rad[0] / DEG,
        speed_mps: (u * u + v * v).sqrt(),
        surge_mps: u,
        sway_mps: v,
        integral_deg_s: integral,
        prev_error_deg: prev_error,
        sixdof_state: RuntimeSixDofState {
            position_ned: state.position_ned.to_vec(),
            quaternion: state.quaternion.to_vec(),
            body_velocity: state.body_velocity.to_vec(),
            radiation_states: state.radiation_states.clone(),
            rudder_actual_rad: state.actuator_states.control_surface_angles_rad[0],
            shaft_speed_rad_s: state.actuator_states.propeller_shaft_speed_rad_s[0],
            motor_torque_actual_nm: plant.motor_torque_actual_for_runtime(),
        },
        run_manifest: manifest,
        manifest_reset,
    };
    serde_json::to_string(&result).map_err(|e| format!("sixdof 结果序列化失败: {e}"))
}
