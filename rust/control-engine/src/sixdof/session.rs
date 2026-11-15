//! 常驻物理状态、采样队列、观测器和20Hz控制时钟。

use super::actuator_system::{ActuatorCommands, ActuatorSystem, LocalWater, ShaftCommand, SurfaceCommand};
use super::control_law::{
    DEFAULT_DERIVATIVE_FILTER_TAU_S, HeadingControlMode, HeadingFeedbackController,
    HeadingPidGains, command_rudder_deg,
};
use super::destroyer_plant::{DestroyerSixDofPlant, PlantCheckpoint};
use super::container_speed_control::{ContainerSpeedController, ContainerSpeedInput, SpeedFeedback};
use super::container_voyage::{ContainerVoyageConfiguration, ContainerVoyageProgress};
use super::environment_state::{EnvironmentState, EnvironmentSwitches};
use super::instrumentation::{
    ObservationTruth, ObservedSample, SensorInstallations, SensorSignal, SensorSuite,
};
use super::integrator::NOMINAL_DT;
use super::lng_speed_control::{LngSpeedController, SpeedPiInput};
use super::model_pack::embedded_vessel_pack_with_water_depth;
use super::passive_observer::{PassiveObserver, PassiveObserverParameters, wrap_pi};
use super::sensor::NoiseLevel;
use super::state::ActuatorStates;
use super::wave::WaveCondition;
use super::vessel_wave::{WaveModelAssets, WaveModelBinding};
use super::wind::WindHullGeometry;
use serde::{Deserialize, Serialize};

const SESSION_SCHEMA: &str = "act.vessel-session.v1";
const CHECKPOINT_SCHEMA_V2: &str = "act.vessel-session.v2";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BerthConfiguration {
    pub stop_line_north_m: f64,
    pub initial_bow_distance_m: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum BerthTerminationReason { StopLineCrossed, TimeLimit }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BerthTermination {
    reason: BerthTerminationReason,
    time_s: f64,
    bow_clearance_m: f64,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub enum EnvironmentPreset {
    #[default]
    P0,
    W1,
    W2,
    C1,
    C2,
    V1,
    V2,
    V3,
    E1,
    E2,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentOverrides {
    pub wind_speed_mps: Option<f64>,
    pub wind_from_deg: Option<f64>,
    pub gust_sigma_mps: Option<f64>,
    pub current_speed_mps: Option<f64>,
    pub current_to_deg: Option<f64>,
    pub wave: Option<WaveCondition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SessionConfiguration {
    pub vessel: String,
    pub parameter_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loading_ratio: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub berth: Option<BerthConfiguration>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub container_voyage: Option<ContainerVoyageConfiguration>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cruise: Option<super::cruise_comfort::CruiseConfiguration>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub regular_wave_height_m: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wave_frequency_bins: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub course_evidence: Option<super::course_evidence::CourseEvidenceConfiguration>,
    pub seed: u64,
    pub noise_level: NoiseLevel,
    pub environment: EnvironmentPreset,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment_overrides: Option<EnvironmentOverrides>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment_switches: Option<EnvironmentSwitches>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub second_order_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mean_wave_resistance_model: Option<super::mean_wave_resistance::MeanWaveResistanceModel>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub propulsion_power_budget_w: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub water_depth_m: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub initial_water_speed_mps: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub initial_roll_deg: Option<f64>,
    pub initial_heading_deg: f64,
    pub initial_position_ned: [f64; 3],
    pub heading_bias_fault: bool,
    pub gnss_outage_fault: bool,
    pub drive_cut_fault: bool,
    pub azimuth_jam_fault: bool,
    pub sensor_installations: Option<SensorInstallations>,
}

impl Default for SessionConfiguration {
    fn default() -> Self {
        Self {
            vessel: "destroyer-055".into(),
            parameter_version: "research-nominal-v3".into(),
            loading_ratio: None,
            berth: None,
            container_voyage: None,
            cruise: None,
            regular_wave_height_m: None,
            wave_frequency_bins: None,
            course_evidence: None,
            seed: 20261106,
            noise_level: NoiseLevel::N1,
            environment: EnvironmentPreset::P0,
            environment_overrides: None,
            environment_switches: None,
            second_order_enabled: None,
            mean_wave_resistance_model: None,
            propulsion_power_budget_w: None,
            water_depth_m: None,
            initial_water_speed_mps: None,
            initial_roll_deg: None,
            initial_heading_deg: 0.0,
            initial_position_ned: [0.0; 3],
            heading_bias_fault: false,
            gnss_outage_fault: false,
            drive_cut_fault: false,
            azimuth_jam_fault: false,
            sensor_installations: None,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FeedbackSource {
    Measurement,
    #[default]
    Estimate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInput {
    pub control_mode: HeadingControlMode,
    pub pid: HeadingPidGains,
    pub target_heading_deg: f64,
    pub feedback: FeedbackSource,
    pub actuators: ActuatorCommands,
    #[serde(default = "default_derivative_filter_tau_s")]
    pub derivative_filter_tau_s: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub heading_integral_tracking: Option<super::control_law::HeadingIntegralTracking>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub longitudinal: Option<SpeedPiInput>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub berth_plan: Option<super::lng_berth_plan::BerthSpeedPlan>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub container_speed: Option<ContainerSpeedInput>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cruise_fins: Option<super::cruise_control::CruiseFinInput>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub semisub_dp: Option<super::semisub_dp::SemisubDpInput>,
}

fn default_derivative_filter_tau_s() -> f64 {
    DEFAULT_DERIVATIVE_FILTER_TAU_S
}

impl SessionInput {
    fn validate(&self, vessel: &str, system: &ActuatorSystem) -> Result<(), String> {
        if [
            self.pid.kp,
            self.pid.ki,
            self.pid.kd,
            self.target_heading_deg,
            self.derivative_filter_tau_s,
        ].iter().any(|value| !value.is_finite())
            || self.derivative_filter_tau_s < 0.0
        {
            return Err("控制输入或微分滤波时间常数无效".into());
        }
        if self.heading_integral_tracking.is_some_and(|tracking| !tracking.time_s.is_finite() || tracking.time_s <= 0.0) {
            return Err("航向积分回算时间常数应为正数".into());
        }
        if vessel == "semisub-981" && self.control_mode != HeadingControlMode::Manual && self.semisub_dp.is_none() {
            return Err("平台定位控制模板正在接线，当前可用手动推进器命令".into());
        }
        if let Some(input) = &self.semisub_dp {
            if vessel != "semisub-981" || self.control_mode != HeadingControlMode::Pid
                || system.propulsors.len()!=8 || self.actuators.shafts.iter().any(|shaft|shaft.motor_torque_override_nm.is_some())
            {return Err("定位控制需要981八推进器和独立位置PID输入".into());}
            input.validate()?;
        }
        if let Some(input) = &self.longitudinal {
            if vessel != "lng-changheng" || self.actuators.shafts.iter().any(|shaft| shaft.motor_torque_override_nm.is_some()) {
                return Err("纵向PI仅用于LNG轴速控制，启用时需使用轴速命令".into());
            }
            input.validate(maximum_shaft_rpm(system)?)?;
        }
        if let Some(plan) = &self.berth_plan {
            if vessel != "lng-changheng" || self.longitudinal.is_none() {
                return Err("靠泊速度计划需要LNG纵向PI".into());
            }
            plan.validate()?;
        }
        if let Some(input) = &self.container_speed {
            if vessel != "container-msc" || self.longitudinal.is_some()
                || self.actuators.shafts.iter().any(|shaft| shaft.motor_torque_override_nm.is_some())
            { return Err("集装箱调度PI需要独立轴速控制输入".into()); }
            input.validate(maximum_shaft_rpm(system)?)?;
        }
        if let Some(input) = &self.cruise_fins {
            if vessel != "cruise-adora" {return Err("减摇鳍反馈只适用于邮轮".into());}
            input.validate()?;
        }
        Ok(())
    }
}

#[derive(Clone, Serialize, Deserialize)]
struct SessionCheckpoint {
    schema: String,
    configuration: SessionConfiguration,
    parameter_hash: String,
    plant: PlantCheckpoint,
    sensors: SensorSuite,
    observer: PassiveObserver,
    initialized_axes: [bool; 3],
    speed_initialized: bool,
    previous_truth: ObservationTruth,
    input: SessionInput,
    held_commands: ActuatorCommands,
    integral_deg_s: f64,
    previous_error_deg: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    heading_controller: Option<HeadingFeedbackController>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    longitudinal_controller: Option<LngSpeedController>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    container_controller: Option<ContainerSpeedController>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    cruise_controller: Option<super::cruise_control::CruiseFinController>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    dp_controller: Option<super::semisub_dp::SemisubDpController>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    cruise_comfort: Option<super::cruise_comfort::CruiseComfortState>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    voyage_progress: Option<ContainerVoyageProgress>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    berth_termination: Option<BerthTermination>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    course_evidence: Option<super::course_evidence::CourseEvidenceState>,
    physics_ticks: u64,
    controller_ticks: u64,
    accumulator_s: f64,
    paused: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ControlSample {
    time_s: f64,
    truth: super::state::TruthState,
    observer: PassiveObserver,
    attitude_deg: serde_json::Value,
    water_velocity_body: [f64; 6],
    target_heading_deg: f64,
    held_commands: ActuatorCommands,
    samples: Vec<ObservedSample>,
    dynamics: Option<super::dynamics::DynamicsOutput>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bow_clearance_m: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    liquid: Option<super::coupled_sloshing::LiquidObservation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    longitudinal: Option<super::lng_speed_control::SpeedControlDiagnostics>,
    #[serde(skip_serializing_if = "Option::is_none")]
    container: Option<super::container_speed_control::ContainerSpeedDiagnostics>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cruise: Option<super::cruise_control::CruiseFinController>,
    #[serde(skip_serializing_if = "Option::is_none")]
    dp: Option<super::semisub_dp::SemisubDpController>,
    #[serde(skip_serializing_if = "Option::is_none")]
    estimated_control_load_body: Option<[f64;3]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    propulsor_thrust_n: Option<Vec<f64>>,
}

#[derive(Clone)]
pub struct FleetSimulation {
    configuration: SessionConfiguration,
    parameter_hash: String,
    plant: DestroyerSixDofPlant,
    wave_assets: Option<std::sync::Arc<WaveModelAssets>>,
    wave_binding: Option<WaveModelBinding>,
    hydrodynamic_depth_m: Option<f64>,
    parameter_summary: serde_json::Value,
    sensors: SensorSuite,
    observer: PassiveObserver,
    initialized_axes: [bool; 3],
    speed_initialized: bool,
    previous_truth: ObservationTruth,
    input: SessionInput,
    held_commands: ActuatorCommands,
    integral_deg_s: f64,
    previous_error_deg: f64,
    heading_controller: Option<HeadingFeedbackController>,
    longitudinal_controller: Option<LngSpeedController>,
    container_controller: Option<ContainerSpeedController>,
    cruise_controller: Option<super::cruise_control::CruiseFinController>,
    dp_controller: Option<super::semisub_dp::SemisubDpController>,
    cruise_comfort: Option<super::cruise_comfort::CruiseComfortState>,
    voyage_progress: Option<ContainerVoyageProgress>,
    berth_termination: Option<BerthTermination>,
    course_evidence: Option<super::course_evidence::CourseEvidenceState>,
    physics_ticks: u64,
    controller_ticks: u64,
    accumulator_s: f64,
    paused: bool,
    last_samples: Vec<ObservedSample>,
    last_control_samples: Vec<ControlSample>,
}

impl FleetSimulation {
    pub fn new(configuration: SessionConfiguration) -> Result<Self, String> {
        Self::new_with_wave_assets(configuration, None)
    }

    pub fn with_wave_assets(configuration: SessionConfiguration, assets: WaveModelAssets) -> Result<Self, String> {
        Self::new_with_wave_assets(configuration, Some(std::sync::Arc::new(assets)))
    }

    fn new_with_wave_assets(configuration: SessionConfiguration, assets: Option<std::sync::Arc<WaveModelAssets>>) -> Result<Self, String> {
        if !configuration.initial_heading_deg.is_finite()
            || configuration
                .initial_position_ned
                .iter()
                .any(|value| !value.is_finite())
        {
            return Err("初始位置或航向无效".into());
        }
        if configuration.water_depth_m.is_some_and(|depth| !depth.is_finite() || depth <= 0.0) {
            return Err("水深须为有限正值".into());
        }
        if configuration.course_evidence.as_ref().is_some_and(|evidence|
            !evidence.roll_warning_deg.is_finite() || evidence.roll_warning_deg <= 0.0) {
            return Err("横摇教学警戒值应为有限正数".into());
        }
        if let Some(berth) = &configuration.berth {
            if configuration.vessel != "lng-changheng" || !berth.stop_line_north_m.is_finite()
                || !berth.initial_bow_distance_m.is_finite() || berth.initial_bow_distance_m <= 0.0
            {
                return Err("LNG靠泊的停止线或初始船艏距离无效".into());
            }
        }
        if let Some(voyage) = &configuration.container_voyage {
            voyage.validate()?;
            if configuration.vessel != "container-msc" || configuration.berth.is_some()
                || configuration.initial_position_ned != [0.0; 3]
                || wrap_pi(configuration.initial_heading_deg.to_radians()).abs() > 1e-12
                || configuration.initial_water_speed_mps.is_some_and(|speed| speed != 8.0)
            { return Err("集装箱航次需要从原点沿零度航向开始".into()); }
        }
        if let Some(cruise) = &configuration.cruise {
            cruise.validate()?;
            if configuration.vessel != "cruise-adora" {return Err("客点统计需要邮轮配置".into());}
        }
        let depth = if configuration.vessel == "lng-changheng"
            && matches!(configuration.parameter_version.as_str(), "research-nominal-v2" | "research-nominal-v3")
            && configuration.berth.is_some() {
            if configuration.water_depth_m.is_some_and(|depth| (depth-40.0).abs() > 1e-8) {
                return Err("LNG靠泊任务需要40米水深模型".into());
            }
            Some(40.0)
        } else { configuration.water_depth_m };
        let mut pack = embedded_vessel_pack_with_water_depth(&configuration.vessel,
            &configuration.parameter_version, configuration.loading_ratio, depth)
            .map_err(|error| format!("参数包无效 {error:?}"))?;
        let assets = match assets {
            Some(assets) => Some(assets),
            None => super::vessel_wave::embedded_teaching_assets(&configuration.vessel,
                &configuration.parameter_version, pack.geometry.wave_model.as_ref())?,
        };
        if configuration.container_voyage.is_some() {
            let super::model_pack::PackActuators::Physical { system, .. } = &pack.actuators else {
                return Err("航次任务需要实际轴系和教学燃油模型".into());
            };
            if system.fuel_model.is_none() || pack.geometry.cruise_speed_mps != Some(8.0) {
                return Err("航次任务需要8米每秒初态和教学燃油模型".into());
            }
        }
        if let Some(budget) = configuration.propulsion_power_budget_w {
            let super::model_pack::PackActuators::Physical { system, .. } = &mut pack.actuators else {
                return Err("当前设备没有可配置的推进功率预算".into());
            };
            let maximum = system.max_positive_motor_power_w.ok_or("当前设备没有可配置的推进功率预算")?;
            if !budget.is_finite() || budget <= 0.0 || budget > maximum {
                return Err("推进功率预算超出冻结设备能力".into());
            }
            if budget != maximum {
                system.max_positive_motor_power_w = Some(budget);
                let mut identity = pack.content_hash.as_bytes().to_vec();
                identity.extend(budget.to_le_bytes());
                pack.content_hash = format!("fnv1a-{:016x}", super::model_pack::fnv1a(&identity));
            }
        }
        let cg_height = pack.geometry.center_of_mass_waterline_z_up_m
            .ok_or("参数包缺少重心高度")?[2];
        let installations =
            configuration
                .sensor_installations
                .clone()
                .unwrap_or(SensorInstallations {
                    gnss_body_m: [0.0, 0.0, -5.0],
                    imu_body_m: [0.0; 3],
                    speed_log_body_m: [0.0, 0.0, cg_height + 1.0],
                    wind_body_m: [0.0, 0.0, -10.0],
                    cg_waterline_height_m: cg_height,
                });
        let mut environment = configured_environment(&configuration, pack.geometry.wave_model.as_ref(),
            pack.geometry.hydrodynamic_depth_m)?;
        let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
        if configuration.mean_wave_resistance_model.is_some() {
            if configuration.vessel != "container-msc" || configuration.second_order_enabled.unwrap_or(false) {
                return Err("教学平均附加阻力仅用于集装箱船，且不能与完整二阶数据重复叠加".into());
            }
            let model = super::mean_wave_resistance::ContainerMeanWaveResistance::from_wave(
                &environment.wave, cg_height, pack.geometry.lpp_m)?;
            plant.configure_mean_wave_resistance(model);
            let mut identity = pack.content_hash.as_bytes().to_vec();
            identity.extend(super::mean_wave_resistance::DEFINITION_JSON.as_bytes());
            pack.content_hash = format!("fnv1a-{:016x}", super::model_pack::fnv1a(&identity));
        }
        let yaw = wrap_pi(configuration.initial_heading_deg.to_radians());
        let mut state = plant.state().clone();
        state.position_ned = configuration.initial_position_ned;
        let half_pitch = pack.geometry.equilibrium_pitch_rad / 2.0;
        state.quaternion = [(yaw / 2.0).cos() * half_pitch.cos(),
            -(yaw / 2.0).sin() * half_pitch.sin(),
            (yaw / 2.0).cos() * half_pitch.sin(),
            (yaw / 2.0).sin() * half_pitch.cos()];
        if let Some(roll_deg) = configuration.initial_roll_deg {
            if !roll_deg.is_finite() || roll_deg.abs() > 10.0 {
                return Err("初始横摇角必须在正负10度内".into());
            }
            let (sr, cr) = (roll_deg.to_radians()/2.0).sin_cos();
            let (sp, cp) = half_pitch.sin_cos();
            let (sy, cy) = (yaw/2.0).sin_cos();
            state.quaternion = [cr*cp*cy+sr*sp*sy, sr*cp*cy-cr*sp*sy,
                cr*sp*cy+sr*cp*sy, cr*cp*sy-sr*sp*cy];
        }
        if let Some(speed) = configuration.initial_water_speed_mps {
            if !speed.is_finite() || !(0.0..=15.0).contains(&speed) {
                return Err("初始对水纵向速度必须在0至15米每秒内".into());
            }
            let baseline = state.body_velocity[0];
            if baseline <= 0.0 && speed != 0.0 {
                return Err("该作业船型仅提供零速初态".into());
            }
            let current = environment.current_field(state.quaternion, state.body_velocity);
            state.body_velocity = std::array::from_fn(|axis| current.nu_current_body[axis]);
            state.body_velocity[0] += speed;
            state.radiation_states.clear();
            let ratio = if baseline > 0.0 { speed/baseline } else { 0.0 };
            let system = plant.actuator_system().ok_or("初态缺少轴系参数")?;
            for (index, propulsor) in system.propulsors.iter().enumerate() {
                let omega = (state.actuator_states.propeller_shaft_speed_rad_s[index]*ratio)
                    .clamp(-propulsor.rated_speed_rad_s, propulsor.rated_speed_rad_s);
                let torque = propulsor.limited_motor_torque_nm(
                    state.actuator_states.motor_torques_nm[index]*ratio.powi(2), omega);
                state.actuator_states.propeller_shaft_speed_rad_s[index] = omega;
                state.actuator_states.shaft_reference_speed_rad_s[index] = omega;
                state.actuator_states.motor_torques_nm[index] = torque;
                if !state.actuator_states.motor_torque_demand_nm.is_empty() {
                    state.actuator_states.motor_torque_demand_nm[index] = torque;
                }
            }
        }
        plant.restore_state(state);
        if let Some(berth) = &configuration.berth {
            let clearance = plant.bow_clearance_m(berth.stop_line_north_m).ok_or("靠泊任务缺少完整船体几何")?;
            let mut state = plant.state().clone();
            state.position_ned[0] += clearance-berth.initial_bow_distance_m;
            plant.restore_state(state);
        }
        let system = plant.actuator_system().ok_or("缺少物理执行器组")?;
        let actuators = ActuatorCommands {
            shafts: plant
                .state()
                .actuator_states
                .shaft_reference_speed_rad_s
                .iter()
                .map(|reference| ShaftCommand {
                    speed_reference_rad_s: *reference,
                    ..Default::default()
                })
                .collect(),
            surfaces: vec![
                SurfaceCommand {
                    enabled: true,
                    ..Default::default()
                };
                system.surfaces.len()
            ],
        };
        let mut sensors = SensorSuite::new(
            configuration.seed,
            configuration.noise_level,
            installations,
            system.propulsors.len(),
            system.surfaces.len(),
        )?;
        sensors.set_faults(
            configuration.heading_bias_fault,
            configuration.gnss_outage_fault,
        );
        let mass = plant.physical_mass_matrix();
        let diagonal = [mass[0][0], mass[1][1], mass[5][5]];
        let observer = PassiveObserver::new(PassiveObserverParameters {
            mass_diagonal: diagonal,
            damping_diagonal: diagonal.map(|value| value / 60.0),
            wave_frequency_rad_s: 2.0 * std::f64::consts::PI / 8.0,
        })?;
        if configuration.vessel != "destroyer-055" && pack.geometry.wind_model.is_none()
            && environment.switches.wind_force_enabled
        { return Err("该船型的风载投影仍在核验，当前工况未就绪".into()); }
        environment.sensor_enabled = false;
        environment.observation = None;
        // 跨版本恢复旧实验时，按恢复点所选参数包重新选择数据能力。
        let wave_assets = pack.geometry.wave_model.as_ref().and(assets);
        if environment.switches.wave_enabled || wave_assets.is_some() {
            let binding = pack.geometry.wave_model.as_ref().ok_or("当前参数包的波浪数据未登记")?;
            let assets = wave_assets.as_ref().ok_or("波浪数据尚未加载，请完成数据加载后重试")?;
            let model = assets.compile(&configuration.vessel, binding, &pack.geometry, &environment.wave,
                yaw, configuration.second_order_enabled.unwrap_or(false))?;
            plant.configure_wave_model(model);
        }
        plant.set_environment_state(
            environment,
            WindHullGeometry {
                frontal_area_m2: 380.0,
                lateral_area_m2: 1200.0,
                length_m: pack.geometry.lpp_m,
                pressure_center_body: [4.0, 0.0, -6.0],
            },
        );
        let initial_truth = ObservationTruth {
            time_s: 0.0,
            state: plant.state().clone(),
            acceleration_body: [0.0; 6],
        };
        let last_samples = sensors.advance(
            &initial_truth,
            &initial_truth,
            plant.environment().ok_or("缺少环境场")?,
        );
        let geometric_gm = pack.geometry.hydrostatic_stiffness_si
            .map(|stiffness| stiffness[3][3]/(pack.geometry.displacement_mass_kg*9.81));
        let liquid_gm_correction: f64 = plant.sloshing().map(|liquid| liquid.modes.iter()
            .map(|mode| mode.direction_body[1].powi(2)*mode.mode.reaction_coupling.powi(2)*9.81
                /(mode.mode.modal_mass*mode.mode.omega_n.powi(2)*pack.geometry.displacement_mass_kg))
            .sum()).unwrap_or(0.0);
        let hardware = plant.actuator_system().ok_or("缺少执行器组")?;
        let mut parameter_summary = serde_json::json!({
            "massKg": pack.geometry.displacement_mass_kg,
            "draftM": pack.geometry.draft_m, "lengthM": pack.geometry.loa_m,
            "beamM": pack.geometry.beam_m, "cgAboveWaterlineM": cg_height,
            "geometricGmTransverseM": geometric_gm,
            "effectiveGmTransverseM": geometric_gm.map(|value| value-liquid_gm_correction),
            "effectiveInertia": [mass[0][0], mass[1][1], mass[5][5]],
            "shaftConfigurations": hardware.propulsors.iter().map(|propulsor| serde_json::json!({
                "ratedRpm": propulsor.rated_speed_rad_s*30.0/std::f64::consts::PI,
                "maximumPowerW": propulsor.max_power_w, "diameterM": propulsor.diameter_m,
                "positionBodyM": propulsor.installation.position_body_m,
                "azimuthAvailable": propulsor.azimuth.is_some(),
            })).collect::<Vec<_>>(),
            "surfaceConfigurations": hardware.surfaces.iter().map(|surface| serde_json::json!({
                "normalBody": surface.normal_body, "maximumAngleDeg": surface.servo.max_angle_rad.to_degrees(),
                "maximumRateDegS": surface.servo.max_rate_rad_s.to_degrees(), "areaM2": surface.area_m2,
            })).collect::<Vec<_>>(),
        });
        if configuration.cruise.is_some() {
            parameter_summary["rollInertiaKgM2"] = serde_json::json!(mass[3][3]);
        }
        if configuration.course_evidence.is_some() {
            if let Some(super::vessel_wind::VesselWindModel::Fujiwara(geometry)) = &pack.geometry.wind_model {
                parameter_summary["windAreasM2"] = serde_json::json!({
                    "frontal":geometry.frontal_area_m2,"lateral":geometry.lateral_area_m2 });
            }
            if let Some(liquid) = plant.sloshing() {
                let observation = liquid.observation(&plant.state().specialist_states);
                parameter_summary["liquidModalFrequenciesHz"] = serde_json::json!(observation.modal_frequencies_hz);
                parameter_summary["liquidDepthM"] = serde_json::json!(observation.liquid_depth_m);
            }
        }
        let voyage_progress = configuration.container_voyage.as_ref().map(|_| ContainerVoyageProgress::default());
        let cruise_comfort = configuration.cruise.as_ref().map(|_| super::cruise_comfort::CruiseComfortState::new(pack.geometry.lpp_m));
        let course_evidence = configuration.course_evidence.as_ref().map(|_| {
            let mut evidence = super::course_evidence::CourseEvidenceState::new(plant.state());
            if plant.sloshing().is_some() { evidence.enable_lng(); }
            evidence.event(0, "run_start");
            evidence
        });
        let mut simulation = Self {
            configuration,
            parameter_hash: pack.content_hash,
            plant,
            wave_assets,
            wave_binding: pack.geometry.wave_model.clone(),
            hydrodynamic_depth_m: pack.geometry.hydrodynamic_depth_m,
            parameter_summary,
            sensors,
            observer,
            initialized_axes: [false; 3],
            speed_initialized: false,
            previous_truth: initial_truth,
            input: SessionInput {
                control_mode: HeadingControlMode::Manual,
                pid: Default::default(),
                target_heading_deg: yaw.to_degrees(),
                feedback: FeedbackSource::Estimate,
                actuators: actuators.clone(),
                derivative_filter_tau_s: DEFAULT_DERIVATIVE_FILTER_TAU_S,
                heading_integral_tracking: None,
                longitudinal: None,
                berth_plan: None,
                container_speed: None,
                cruise_fins: None,
                semisub_dp: None,
            },
            held_commands: actuators,
            integral_deg_s: 0.0,
            previous_error_deg: 0.0,
            heading_controller: Some(HeadingFeedbackController::default()),
            longitudinal_controller: None,
            container_controller: None,
            cruise_controller: None,
            dp_controller: None,
            cruise_comfort,
            voyage_progress,
            berth_termination: None,
            course_evidence,
            physics_ticks: 0,
            controller_ticks: 0,
            accumulator_s: 0.0,
            paused: false,
            last_samples,
            last_control_samples: Vec::new(),
        };
        simulation.initialize_from_measurements();
        Ok(simulation)
    }

    fn initialize_from_measurements(&mut self) {
        for (axis, signal) in [
            SensorSignal::North,
            SensorSignal::East,
            SensorSignal::Heading,
        ]
        .into_iter()
        .enumerate()
        {
            if !self.initialized_axes[axis] {
                if let Some(value) = self.sensors.valid_value(signal, self.time_s()) {
                    self.observer.position_heading[axis] =
                        if axis == 2 { value.to_radians() } else { value };
                    self.initialized_axes[axis] = true;
                }
            }
        }
        if !self.speed_initialized {
            if let Some(value) = self
                .sensors
                .valid_value(SensorSignal::SpeedLog, self.time_s())
            {
                self.observer.body_velocity[0] = value;
                self.speed_initialized = true;
            }
        }
    }

    fn update_controller(&mut self) -> Result<(), String> {
        self.controller_ticks += 1;
        let previous_commands = self.held_commands.clone();
        if self.input.semisub_dp.is_some() {
            let rates=[SensorSignal::RollRate,SensorSignal::PitchRate,SensorSignal::YawRate]
                .map(|signal|self.sensors.valid_value(signal,self.time_s()).map(f64::to_radians));
            let forces=[SensorSignal::SpecificForceX,SensorSignal::SpecificForceY,SensorSignal::SpecificForceZ]
                .map(|signal|self.sensors.valid_value(signal,self.time_s()));
            self.dp_controller.get_or_insert_with(Default::default).observe_attitude(
                match rates {[Some(p),Some(q),Some(r)]=>Some([p,q,r]),_=>None},
                match forces {[Some(x),Some(y),Some(z)]=>Some([x,y,z]),_=>None});
            if self.controller_ticks%2==1 {self.update_dp_controller(previous_commands)?;}
            return Ok(());
        }
        self.held_commands = self.input.actuators.clone();
        self.update_heading_controller(&previous_commands)?;
        self.update_longitudinal_controller(&previous_commands)?;
        self.update_container_controller(&previous_commands)?;
        self.update_cruise_controller()
    }

    fn update_dp_controller(&mut self, commands: ActuatorCommands) -> Result<(),String> {
        use super::semisub_dp::DpMeasurements;
        let time = self.time_s();
        let input = self.input.semisub_dp.as_ref().ok_or("缺少定位输入")?;
        let position_heading=self.navigation_measurement();
        let wind = match (self.sensors.valid_value(SensorSignal::WindSpeed,time),
            self.sensors.valid_value(SensorSignal::WindDirection,time),self.plant.wind_model()) {
            (Some(speed),Some(direction),Some(model)) => {
                let direction=direction.to_radians();
                // 风仪给出局部相对风，仅以公开投影模型估算前馈。
                let load=model.loads([-speed*direction.cos(),-speed*direction.sin()],[1.0,0.0,0.0,0.0],[0.0;6]);
                Some([load[0],load[1],load[5]])
            }
            _=>None,
        };
        let position_sample_time_s=self.sensors.latest_samples().iter()
            .find(|sample|sample.signal==SensorSignal::North && sample.measurement.quality==super::sensor::Quality::Good)
            .map(|sample|sample.measurement.t_sample_s);
        let measurement=DpMeasurements {position_heading,position_sample_time_s,
            low_frequency_position_heading:self.observer.position_heading,
            low_frequency_body_velocity:self.observer.body_velocity,
            yaw_rate_rad_s:self.sensors.valid_value(SensorSignal::YawRate,time).map(f64::to_radians),
            azimuth_rad:std::array::from_fn(|index|self.sensors.valid_value(SensorSignal::AzimuthEncoder(index),time).map(f64::to_radians)),
            shaft_speed_rad_s:std::array::from_fn(|index|self.sensors.valid_value(SensorSignal::ShaftSpeed(index),time)
                .map(|rpm|rpm*std::f64::consts::PI/30.0)),
            estimated_control_load_body:self.estimated_control_load(),measured_wind_load_body:wind};
        let mass=self.plant.physical_mass_matrix();
        let system=self.plant.actuator_system().ok_or("缺少推进器组")?;
        let failed=(self.configuration.drive_cut_fault && time>=180.0).then_some(1);
        let controller=self.dp_controller.get_or_insert_with(Default::default);
        // 冻结构件阻力在零速处的一阶导数为零。
        self.held_commands=controller.step(input,measurement,[mass[0][0],mass[1][1],mass[5][5]],
            [0.0;3],system,failed,commands)?;
        Ok(())
    }

    fn navigation_measurement(&self) -> [Option<f64>;3] {
        let mut values=[SensorSignal::North,SensorSignal::East,SensorSignal::Heading]
            .map(|signal|self.sensors.valid_value(signal,self.time_s()).map(|value|
                if signal==SensorSignal::Heading {value.to_radians()} else {value}));
        if let (Some(controller),Some(yaw))=(&self.dp_controller,values[2]) {
            let offset=controller.navigation_offset_ne(self.sensors.installations.gnss_body_m,yaw);
            for axis in 0..2 {values[axis]=values[axis].map(|value|value-offset[axis]);}
        }
        values
    }

    fn update_cruise_controller(&mut self) -> Result<(), String> {
        if self.configuration.cruise.is_none() {self.cruise_controller = None;return Ok(());}
        let time_s = self.time_s();
        let angular = [SensorSignal::RollRate,SensorSignal::PitchRate,SensorSignal::YawRate]
            .map(|signal| self.sensors.valid_value(signal,time_s).map(f64::to_radians));
        let forces = [SensorSignal::SpecificForceX,SensorSignal::SpecificForceY,SensorSignal::SpecificForceZ]
            .map(|signal| self.sensors.valid_value(signal,time_s));
        let measurements = super::cruise_control::FinMeasurements {
            angular_rate_rad_s: match angular {[Some(p),Some(q),Some(r)] => Some([p,q,r]), _ => None},
            specific_force_mps2: match forces {[Some(x),Some(y),Some(z)] => Some([x,y,z]), _ => None},
            water_speed_mps: self.sensors.valid_value(SensorSignal::SpeedLog,time_s),
        };
        let failed_fin = self.configuration.cruise.as_ref().and_then(|configuration| configuration.failed_fin(time_s));
        let controller = self.cruise_controller.get_or_insert_with(Default::default);
        let Some(input) = &self.input.cruise_fins else {
            controller.observe(measurements, 0.3, None)?;
            controller.requested_moment_nm = 0.0;
            controller.allocated_moment_nm = 0.0;
            controller.available_moment_nm = 0.0;
            controller.angles_rad = std::array::from_fn(|index| self.held_commands.surfaces[index].angle_rad);
            return Ok(());
        };
        let angles = controller.step(input,measurements,self.plant.actuator_system().ok_or("缺少执行器组")?,failed_fin)?;
        for (surface,angle) in self.held_commands.surfaces.iter_mut().zip(angles) {
            surface.angle_rad = angle;
            surface.enabled = input.enabled;
        }
        Ok(())
    }

    fn update_container_controller(&mut self, previous_commands: &ActuatorCommands) -> Result<(), String> {
        let Some(input) = &self.input.container_speed else {
            self.container_controller = None;
            if self.configuration.container_voyage.is_some() { return Err("航次任务需要先设置航速控制模型".into()); }
            return Ok(());
        };
        let maximum = maximum_shaft_rpm(self.plant.actuator_system().ok_or("缺少执行器组")?)?;
        if self.container_controller.is_none() {
            let initial_rpm = previous_commands.shafts[0].speed_reference_rad_s*30.0/std::f64::consts::PI;
            self.container_controller = Some(ContainerSpeedController::new(input,
                self.configuration.loading_ratio.unwrap_or(0.6), initial_rpm, maximum)?);
        }
        let target = self.configuration.container_voyage.as_ref()
            .map(|voyage| voyage.reference_at(self.plant.state().position_ned[0])).unwrap_or(input.reference_mps);
        let water_speed = self.sensors.valid_value(SensorSignal::SpeedLog, self.time_s());
        let ground_speed = (self.initialized_axes.iter().all(|value| *value)
            && self.sensors.valid_value(SensorSignal::North, self.time_s()).is_some()
            && self.sensors.valid_value(SensorSignal::East, self.time_s()).is_some())
            .then_some(self.observer.body_velocity[0]);
        let rpm = self.container_controller.as_mut().expect("调度控制已初始化")
            .step(input, target, water_speed, ground_speed, maximum)?;
        self.held_commands.shafts[0].speed_reference_rad_s = rpm*std::f64::consts::PI/30.0;
        Ok(())
    }

    fn update_longitudinal_controller(&mut self, previous_commands: &ActuatorCommands) -> Result<(), String> {
        let Some(input) = &self.input.longitudinal else {
            self.longitudinal_controller = None;
            return Ok(());
        };
        let system = self.plant.actuator_system().ok_or("缺少执行器组")?;
        let maximum_rpm = maximum_shaft_rpm(system)?;
        if self.longitudinal_controller.is_none() {
            let initial_rpm = previous_commands.shafts.iter().map(|shaft| shaft.speed_reference_rad_s)
                .sum::<f64>()/previous_commands.shafts.len() as f64*30.0/std::f64::consts::PI;
            self.longitudinal_controller = Some(LngSpeedController::new(input,
                initial_rpm.clamp(-maximum_rpm, maximum_rpm), maximum_rpm)?);
        }
        let mut measurement = self.sensors.valid_value(SensorSignal::SpeedLog, self.time_s());
        let mut planned_input = input.clone();
        if let Some(plan) = &self.input.berth_plan {
            let berth = self.configuration.berth.as_ref().ok_or("靠泊速度计划需要靠泊初态")?;
            let navigation_good = self.initialized_axes.iter().all(|value| *value)
                && self.sensors.valid_value(SensorSignal::North,self.time_s()).is_some()
                && self.sensors.valid_value(SensorSignal::East,self.time_s()).is_some()
                && self.sensors.valid_value(SensorSignal::Heading,self.time_s()).is_some();
            if navigation_good {
                let clearance = self.plant.navigation_bow_clearance_m(berth.stop_line_north_m,
                    self.observer.position_heading[0],self.observer.position_heading[2])
                    .ok_or("靠泊导航缺少同源船形")?;
                planned_input.reference_mps = plan.reference_mps(clearance)?;
            } else {
                measurement = None;
            }
        }
        let applied_rpm = self.longitudinal_controller.as_mut().expect("纵向控制已初始化")
            .step(&planned_input, measurement, maximum_rpm)?;
        for shaft in &mut self.held_commands.shafts {
            shaft.speed_reference_rad_s = applied_rpm*std::f64::consts::PI/30.0;
        }
        Ok(())
    }

    fn heading_reference_deg(&self) -> f64 {
        self.input.container_speed.as_ref()
            .filter(|_| self.configuration.container_voyage.is_some())
            .and_then(|input| input.los_lookahead_m)
            .map(|lookahead| (-self.observer.position_heading[1]).atan2(lookahead).to_degrees())
            .or_else(|| self.input.berth_plan.as_ref().and_then(|plan| plan.heading_reference_deg(self.time_s())))
            .unwrap_or(self.input.target_heading_deg)
    }

    fn update_heading_controller(&mut self, previous_commands: &ActuatorCommands) -> Result<(), String> {
        let target_heading = self.heading_reference_deg();
        if let Some(progress) = &mut self.voyage_progress {
            progress.heading_reference_deg = wrap_pi(target_heading.to_radians()).to_degrees();
        }
        let heading = match self.input.feedback {
            FeedbackSource::Measurement => self
                .sensors
                .valid_value(SensorSignal::Heading, self.time_s()),
            FeedbackSource::Estimate => {
                self.initialized_axes[2].then_some(self.observer.position_heading[2].to_degrees())
            }
        };
        if self.input.control_mode == HeadingControlMode::Manual {
            if let Some(controller) = &mut self.heading_controller {
                *controller = HeadingFeedbackController::default();
            }
            return Ok(());
        }
        let rudder_deg = if let Some(controller) = &mut self.heading_controller {
            let command = controller.step_with_tracking(
                self.input.control_mode,
                &self.input.pid,
                target_heading,
                heading,
                self.physics_ticks as f64 * NOMINAL_DT,
                0.05,
                self.input.derivative_filter_tau_s,
                self.input.heading_integral_tracking.unwrap_or_default(),
            )?;
            if heading.is_none() {
                let system = self.plant.actuator_system().expect("会话已装配执行器组");
                for ((new, old), propeller) in self.held_commands.shafts.iter_mut()
                    .zip(&previous_commands.shafts).zip(&system.propulsors)
                {
                    if propeller.azimuth.is_some() {
                        new.azimuth_rad = old.azimuth_rad;
                    }
                }
                for ((new, old), surface) in self.held_commands.surfaces.iter_mut()
                    .zip(&previous_commands.surfaces).zip(&system.surfaces)
                {
                    if surface.normal_body == [0.0, 1.0, 0.0] {
                        new.angle_rad = old.angle_rad;
                    }
                }
                return Ok(());
            }
            command
        } else {
            let Some(heading) = heading else {
                return Ok(());
            };
            let control = command_rudder_deg(
                self.input.control_mode,
                &self.input.pid,
                wrap_pi(target_heading.to_radians()).to_degrees(),
                heading,
                0.0,
                0.05,
                self.integral_deg_s,
                self.previous_error_deg,
                35.0,
            );
            self.integral_deg_s = control.integral_deg_s;
            self.previous_error_deg = control.error_deg;
            control.rudder_deg
        };
        let system = self.plant.actuator_system().expect("会话已装配执行器组");
        if system.propulsors.len() == 2 && system.propulsors.iter().all(|propeller| propeller.azimuth.is_some()) {
            // 双艉吊舱采用对称同角初级分配，实际转向与纵向推力损失由轴系计算。
            for command in &mut self.held_commands.shafts {
                command.azimuth_rad = -rudder_deg.to_radians();
            }
        }
        for (command, surface) in self.held_commands.surfaces.iter_mut().zip(&system.surfaces) {
            if surface.normal_body == [0.0, 1.0, 0.0] {
                command.angle_rad = rudder_deg.to_radians();
            }
        }
        Ok(())
    }

    fn estimated_control_load(&self) -> [f64; 3] {
        let system = self.plant.actuator_system().expect("会话已装配执行器组");
        let measured = |signal| {
            self.sensors
                .valid_value(signal, self.time_s())
                .unwrap_or(0.0)
                .to_radians()
        };
        let actuator_state = ActuatorStates {
            propeller_shaft_speed_rad_s: (0..system.propulsors.len())
                .map(|index| {
                    self.sensors
                        .valid_value(SensorSignal::ShaftSpeed(index), self.time_s())
                        .unwrap_or(0.0)
                        * std::f64::consts::PI
                        / 30.0
                })
                .collect(),
            control_surface_angles_rad: (0..system.surfaces.len())
                .map(|index| measured(SensorSignal::SurfaceEncoder(index)))
                .collect(),
            azimuth_angles_rad: (0..system.propulsors.len())
                .map(|index| measured(SensorSignal::AzimuthEncoder(index)))
                .collect(),
            ..Default::default()
        };
        let values = system.encode_state(&actuator_state);
        let yaw = self.observer.position_heading[2];
        let water = LocalWater {
            time_s: self.time_s(),
            position_ned: [
                self.observer.position_heading[0],
                self.observer.position_heading[1],
                0.0,
            ],
            quaternion: [(yaw / 2.0).cos(), 0.0, 0.0, (yaw / 2.0).sin()],
            relative_velocity: [
                self.observer.body_velocity[0],
                self.observer.body_velocity[1],
                0.0,
                0.0,
                0.0,
                self.observer.body_velocity[2],
            ],
            environment: None,
        };
        let evaluation = system.derivatives(
            &values,
            &mut vec![0.0; values.len()],
            &self.held_commands,
            &vec![0.0; system.propulsors.len()],
            &water,
        );
        [
            evaluation.loads[0],
            evaluation.loads[1],
            evaluation.loads[5],
        ]
    }

    fn tick(&mut self) -> Result<(), String> {
        if self.physics_ticks % 6 == 0 {
            self.update_controller()?;
            let state = self.plant.state();
            let attitude = super::state::euler_from_quaternion(state.quaternion);
            self.last_control_samples.push(ControlSample {
                time_s: self.time_s(), truth: state.clone(), observer: self.observer.clone(),
                attitude_deg: serde_json::json!({ "roll": attitude.roll_rad.to_degrees(),
                    "pitch": attitude.pitch_rad.to_degrees(), "heading": attitude.yaw_rad.to_degrees() }),
                water_velocity_body: self.plant.relative_body_velocity()?,
                target_heading_deg: self.heading_reference_deg(),
                held_commands: self.held_commands.clone(), samples: self.sensors.latest_samples(),
                dynamics: self.plant.last_dynamics().copied(),
                bow_clearance_m: self.configuration.berth.as_ref()
                    .and_then(|berth| self.plant.bow_clearance_m(berth.stop_line_north_m)),
                liquid: self.course_evidence.as_ref().and_then(|_| self.plant.sloshing())
                    .map(|liquid| liquid.observation(&state.specialist_states)),
                longitudinal: self.course_evidence.as_ref().and_then(|_| self.longitudinal_controller.as_ref())
                    .map(|controller| controller.diagnostics().clone()),
                container: self.course_evidence.as_ref().and_then(|_| self.container_controller.as_ref())
                    .map(|controller| controller.diagnostics().clone()),
                cruise: self.course_evidence.as_ref().and_then(|_| self.cruise_controller.clone()),
                dp: self.course_evidence.as_ref().and_then(|_|self.dp_controller.clone()),
                estimated_control_load_body: (self.configuration.vessel=="semisub-981"
                    && self.course_evidence.is_some()).then(||self.estimated_control_load()),
                propulsor_thrust_n: if self.configuration.vessel=="semisub-981" && self.course_evidence.is_some() {
                    Some(self.plant.propulsor_thrust_n(&self.held_commands)?)
                } else {None},
            });
        }
        let mut commands = self.held_commands.clone();
        if let Some(cruise) = &self.configuration.cruise {
            if let Some(index) = cruise.failed_fin(self.time_s()) {
                if self.time_s()-NOMINAL_DT < cruise.fin_failure_time_s.expect("故障时间已绑定")-1e-9 {
                    self.plant.jam_surface_at_zero(index)?;
                    if let Some(evidence) = &mut self.course_evidence {evidence.event(self.physics_ticks,"fin_zero_failure");}
                }
                commands.surfaces[index].angle_rad = 0.0;
                commands.surfaces[index].jammed = true;
                commands.surfaces[index].enabled = false;
            }
        }
        if self.physics_ticks == 21600 && (self.configuration.drive_cut_fault || self.configuration.azimuth_jam_fault
            || self.configuration.heading_bias_fault || self.configuration.gnss_outage_fault) {
            if let Some(evidence) = &mut self.course_evidence { evidence.event(self.physics_ticks, "fault_activation"); }
        }
        if self.time_s() >= 180.0 {
            let failed_index=if self.input.semisub_dp.is_some() {1} else {0};
            if let Some(shaft) = commands.shafts.get_mut(failed_index) {
                shaft.drive_cut |= self.configuration.drive_cut_fault;
                shaft.azimuth_jammed |= self.configuration.azimuth_jam_fault;
            }
        }
        self.plant.restore_time_for_runtime(self.time_s());
        self.plant
            .step_with_actuators(NOMINAL_DT, &commands)
            .map_err(|error| format!("物理步失败 {error:?}"))?;
        self.physics_ticks += 1;
        self.plant.restore_time_for_runtime(self.time_s());
        if let (Some(evidence), Some(configuration)) = (&mut self.course_evidence, &self.configuration.course_evidence) {
            evidence.observe(self.physics_ticks, self.plant.state(), self.plant.actuator_system().ok_or("缺少执行器组")?,
                &commands, configuration.roll_warning_deg);
            if let Some(liquid) = self.plant.sloshing() {
                evidence.observe_lng(self.physics_ticks, self.plant.state(),
                    &liquid.observation(&self.plant.state().specialist_states),
                    self.configuration.berth.as_ref().and_then(|berth| self.plant.bow_clearance_m(berth.stop_line_north_m)));
            }
        }
        self.plant.advance_environment_to_current_time();
        let current = ObservationTruth {
            time_s: self.time_s(),
            state: self.plant.state().clone(),
            acceleration_body: self
                .plant
                .last_dynamics()
                .map(|output| output.nu_dot)
                .unwrap_or([0.0; 6]),
        };
        if let (Some(comfort),Some(configuration)) = (&mut self.cruise_comfort,&self.configuration.cruise) {
            comfort.observe(current.time_s,&current.state,current.acceleration_body,configuration);
        }
        self.last_samples.extend(self.sensors.advance(
            &self.previous_truth,
            &current,
            self.plant.environment().ok_or("缺少会话环境")?,
        ));
        self.previous_truth = current;
        self.initialize_from_measurements();
        let values = self.navigation_measurement();
        let tuning=self.input.semisub_dp.as_ref().map(|input|(input.low_frequency_cutoff_hz,
            2.0*std::f64::consts::PI/self.plant.environment().expect("会话环境已配置").wave.condition().tp_s));
        self.observer
            .step_with_bandwidth(NOMINAL_DT, values, self.estimated_control_load(),tuning)
            .map_err(|error| format!("观测步失败 {error:?}"))?;
        if let Some(berth) = &self.configuration.berth {
            let clearance = self.plant.bow_clearance_m(berth.stop_line_north_m).ok_or("靠泊任务缺少船体几何")?;
            let reason = if clearance <= 0.0 { Some(BerthTerminationReason::StopLineCrossed) }
                else if self.time_s() >= 1200.0 { Some(BerthTerminationReason::TimeLimit) } else { None };
            if let Some(reason) = reason {
                self.berth_termination = Some(BerthTermination { reason, time_s: self.time_s(), bow_clearance_m: clearance });
                self.paused = true;
            }
        }
        if self.voyage_progress.is_some() {
            let state = self.plant.state();
            let euler = super::state::euler_from_quaternion(state.quaternion);
            let water_speed = self.plant.relative_body_velocity()?[0];
            let heading_reference = self.voyage_progress.as_ref().expect("航次已初始化").heading_reference_deg.to_radians();
            let stopped = self.voyage_progress.as_mut().expect("航次已初始化").update(
                self.physics_ticks as f64*NOMINAL_DT, state.position_ned, water_speed, euler.yaw_rad-heading_reference, euler.roll_rad)?;
            self.paused |= stopped;
        }
        Ok(())
    }

    pub fn time_s(&self) -> f64 {
        self.physics_ticks as f64 * NOMINAL_DT
    }

    pub fn input(&self) -> &SessionInput {
        &self.input
    }

    pub fn set_paused(&mut self, paused: bool) {
        self.paused = paused || self.berth_termination.is_some()
            || self.voyage_progress.as_ref().is_some_and(|progress| progress.termination.is_some());
    }

    pub fn advance(&mut self, seconds: f64, input: Option<SessionInput>) -> Result<(), String> {
        if !seconds.is_finite() || !(0.0..=1.0).contains(&seconds) {
            return Err("帧推进量必须为0至1秒".into());
        }
        if let Some(input) = &input {
            let system = self.plant.actuator_system().ok_or("缺少执行器组")?;
            input.validate(&self.configuration.vessel, system)?;
            if self.physics_ticks>0 && input.semisub_dp.is_some()!=self.input.semisub_dp.is_some() {
                return Err("定位控制的启用状态在本次运行中已冻结".into());
            }
            if input.berth_plan.is_some() && self.configuration.berth.is_none() {
                return Err("靠泊速度计划需要绑定靠泊初态".into());
            }
            if self.physics_ticks > 0 && input.berth_plan != self.input.berth_plan {
                return Err("本次运行的靠泊速度计划已冻结，修改后需要开始新运行".into());
            }
            if input.cruise_fins.is_some() && self.configuration.cruise.is_none() {
                return Err("减摇反馈需要绑定客点统计和故障配置".into());
            }
            system.validate_commands(&input.actuators)?;
            if let Some(longitudinal) = &input.longitudinal {
                if self.heading_controller.is_none() {
                    return Err("纵向PI需要当前版本的会话".into());
                }
                if let Some(controller) = &self.longitudinal_controller {
                    controller.validate_input(longitudinal, maximum_shaft_rpm(system)?)?;
                }
            }
            if let Some(container) = &input.container_speed {
                if self.heading_controller.is_none() { return Err("集装箱调度需要当前版本的会话".into()); }
                if let Some(controller) = &self.container_controller {
                    controller.validate_input(container, maximum_shaft_rpm(system)?)?;
                }
            }
        }
        let checkpoint = self.clone();
        if let Some(evidence) = &mut self.course_evidence { evidence.pending_window_samples.clear(); }
        if let Some(input) = input {
            if self.course_evidence.is_some() && serde_json::to_value(&input).map_err(|error| error.to_string())?
                != serde_json::to_value(&self.input).map_err(|error| error.to_string())? {
                self.course_evidence.as_mut().expect("细步证据已初始化").event(self.physics_ticks, "control_revision");
            }
            self.input = input;
        }
        self.last_samples.clear();
        self.last_control_samples.clear();
        if self.paused {
            return Ok(());
        }
        self.accumulator_s += seconds;
        while self.accumulator_s + 1e-12 >= NOMINAL_DT {
            if let Err(error) = self.tick() {
                *self = checkpoint;
                return Err(error);
            }
            self.accumulator_s = (self.accumulator_s - NOMINAL_DT).max(0.0);
            if self.paused {
                self.accumulator_s = 0.0;
                break;
            }
        }
        Ok(())
    }

    pub fn frame_json(&self) -> Result<String, String> {
        let attitude = super::state::euler_from_quaternion(self.plant.state().quaternion);
        let mut frame = serde_json::json!({
            "schema": SESSION_SCHEMA, "modelVersion": if self.heading_controller.is_some() { "sixdof-session-v2" } else { "sixdof-session-v1" }, "parameterHash": self.parameter_hash,
            "timeS": self.time_s(), "physicsTicks": self.physics_ticks, "controllerTicks": self.controller_ticks,
            "paused": self.paused, "truth": self.plant.state(), "observer": self.observer,
            "input": self.input, "heldCommands": self.held_commands, "samples": self.last_samples,
            "liquidCargo": self.plant.liquid_diagnostics()?,
            "headingController": self.heading_controller,
            "parameters": self.parameter_summary,
            "attitudeDeg": { "roll": attitude.roll_rad.to_degrees(),
                "pitch": attitude.pitch_rad.to_degrees(), "heading": attitude.yaw_rad.to_degrees() },
            "waterVelocityBody": self.plant.relative_body_velocity()?,
            "controlSamples": self.last_control_samples,
        });
        if self.heading_controller.is_some() {
            frame["dynamics"] = serde_json::to_value(self.plant.last_dynamics())
                .map_err(|error| error.to_string())?;
        }
        if self.input.berth_plan.as_ref().is_some_and(|plan| plan.heading_nodes.is_some()) {
            frame["headingReferenceDeg"] = serde_json::json!(self.heading_reference_deg());
        }
        if self.course_evidence.is_some() {
            if let Some(liquid) = self.plant.sloshing() {
                frame["liquidObservation"] = serde_json::json!(liquid.observation(&self.plant.state().specialist_states));
            }
        }
        if let Some(evidence) = &self.course_evidence {
            frame["fineStepMetrics"] = serde_json::json!({ "sampleCadenceS": NOMINAL_DT,
                "algorithm": "post_physics_step_v1", "rollWarningDeg": self.configuration.course_evidence.as_ref().expect("配置已绑定").roll_warning_deg,
                "eventWindowBeforeS": 1.0, "eventWindowAfterS": 1.0, "values": evidence.metrics });
            frame["fineStepSamples"] = serde_json::to_value(&evidence.pending_window_samples).map_err(|error| error.to_string())?;
            frame["fineStepWindowSampleCount"] = serde_json::json!(evidence.emitted_samples);
        }
        if let Some(controller) = &self.longitudinal_controller {
            frame["longitudinalController"] = serde_json::to_value(controller.diagnostics())
                .map_err(|error| error.to_string())?;
        }
        if let Some(controller) = &self.container_controller {
            frame["containerController"] = serde_json::to_value(controller.diagnostics()).map_err(|error| error.to_string())?;
            frame["containerSpeedFeedback"] = serde_json::json!(self.input.container_speed.as_ref().map(|input| match input.feedback {
                SpeedFeedback::Water => "water_speed_log", SpeedFeedback::Ground => "gnss_low_frequency_estimate",
            }));
        }
        if let Some(controller) = &self.cruise_controller {
            frame["cruiseController"] = serde_json::to_value(controller).map_err(|error| error.to_string())?;
        }
        if let Some(controller) = &self.dp_controller {
            frame["dpController"] = serde_json::to_value(controller).map_err(|error|error.to_string())?;
        }
        if self.configuration.vessel=="semisub-981" && self.course_evidence.is_some() {
            frame["propulsorThrustN"]=serde_json::json!(self.plant.propulsor_thrust_n(&self.held_commands)?);
        }
        if let Some(comfort) = &self.cruise_comfort {
            frame["cruiseComfort"] = comfort.diagnostics();
            let configuration = self.configuration.cruise.as_ref().expect("客点统计已绑定配置");
            frame["cruiseComfort"]["statisticsWindowS"] = serde_json::json!([configuration.statistics_start_s,configuration.statistics_end_s]);
        }
        if let Some(progress) = &self.voyage_progress {
            frame["containerVoyage"] = serde_json::json!({ "progress": progress,
                "segmentIndex": ((progress.north_m.max(0.0)/1500.0).floor() as usize).min(3),
                "meanFinalHeadingErrorDeg": progress.mean_final_heading_error_deg(),
                "rollWarning": progress.maximum_roll_deg > 8.0,
                "eligibleForFuelComparison": progress.eligible_for_fuel_comparison() });
        }
        if let Some(berth) = &self.configuration.berth {
            let rotation = super::state::rotation_matrix(self.plant.state().quaternion);
            let north_speed = (0..3).map(|axis| rotation[0][axis]*self.plant.state().body_velocity[axis]).sum::<f64>();
            frame["berth"] = serde_json::json!({
                "bowClearanceM": self.plant.bow_clearance_m(berth.stop_line_north_m),
                "northGroundSpeedMps": north_speed, "termination": self.berth_termination,
            });
        }
        if let Some(binding) = &self.wave_binding {
            let wave_enabled = self.plant.environment().is_some_and(|environment| environment.switches.wave_enabled);
            let second_loaded = self.wave_assets.as_ref().is_some_and(|assets| assets.full_difference.is_some());
            frame["waveModel"] = serde_json::json!({
                "firstOrderLoaded": self.wave_assets.is_some(),
                "firstOrderEnabled": wave_enabled && self.wave_assets.is_some(),
                "secondOrderLoaded": second_loaded,
                "secondOrderEnabled": wave_enabled && second_loaded && self.configuration.second_order_enabled.unwrap_or(false),
                "waterDepthM": binding.water_depth_m,
                "meanForwardSpeedMps": binding.mean_forward_speed_mps,
                "firstOrderMetadataHash": binding.first_order_metadata_fnv1a64,
                "fullDifferenceMetadataHash": binding.full_difference_metadata_fnv1a64,
            });
        }
        if let Some(diagnostics) = self.plant.mean_wave_resistance_diagnostics()? {
            frame["meanWaveResistance"] = diagnostics;
        }
        if let Some(depth) = self.hydrodynamic_depth_m {
            frame["hydrodynamicDepthM"] = serde_json::json!(depth);
        }
        if let Some(fuel) = self.plant.state().actuator_states.fuel {
            let state = &self.plant.state().actuator_states;
            frame["teachingFuel"] = serde_json::json!({
                "state": fuel, "rates": self.plant.fuel_rates(&self.held_commands)?,
                "model": self.plant.actuator_system().and_then(|system| system.fuel_model.as_ref()),
                "positiveMotorWorkJ": state.positive_motor_work_j.iter().sum::<f64>(),
                "motorBrakingWorkJ": state.positive_motor_work_j.iter().zip(&state.motor_work_j)
                    .map(|(positive, net)| positive-net).sum::<f64>().max(0.0),
            });
        }
        if let Some(budget) = self.plant.actuator_system().and_then(|system| system.max_positive_motor_power_w) {
            let state = &self.plant.state().actuator_states;
            let power: Vec<_> = state.motor_torques_nm.iter().zip(&state.propeller_shaft_speed_rad_s)
                .map(|(torque, omega)| torque * omega).collect();
            frame["propulsionPower"] = serde_json::json!({
                "budgetW": budget, "shaftMechanicalPowerW": power,
                "positiveMechanicalPowerW": power.iter().map(|value| value.max(0.0)).sum::<f64>(),
                "positiveMechanicalWorkJ": state.positive_motor_work_j.iter().sum::<f64>(),
            });
        }
        serde_json::to_string(&frame).map_err(|error| error.to_string())
    }

    pub fn snapshot_json(&self) -> Result<String, String> {
        let checkpoint = SessionCheckpoint {
            schema: if self.heading_controller.is_some() { CHECKPOINT_SCHEMA_V2 } else { SESSION_SCHEMA }.into(),
            configuration: self.configuration.clone(),
            parameter_hash: self.parameter_hash.clone(),
            plant: self.plant.checkpoint(),
            sensors: self.sensors.clone(),
            observer: self.observer.clone(),
            initialized_axes: self.initialized_axes,
            speed_initialized: self.speed_initialized,
            previous_truth: self.previous_truth.clone(),
            input: self.input.clone(),
            held_commands: self.held_commands.clone(),
            integral_deg_s: self.integral_deg_s,
            previous_error_deg: self.previous_error_deg,
            heading_controller: self.heading_controller.clone(),
            longitudinal_controller: self.longitudinal_controller.clone(),
            container_controller: self.container_controller.clone(),
            cruise_controller: self.cruise_controller.clone(),
            dp_controller: self.dp_controller.clone(),
            cruise_comfort: self.cruise_comfort.clone(),
            voyage_progress: self.voyage_progress.clone(),
            berth_termination: self.berth_termination.clone(),
            course_evidence: self.course_evidence.clone(),
            physics_ticks: self.physics_ticks,
            controller_ticks: self.controller_ticks,
            accumulator_s: self.accumulator_s,
            paused: self.paused,
        };
        serde_json::to_string(&checkpoint).map_err(|error| error.to_string())
    }

    pub fn from_snapshot_json(raw: &str) -> Result<Self, String> {
        Self::from_snapshot_with_wave_assets(raw, None)
    }

    pub fn restore_snapshot(&mut self, raw: &str) -> Result<(), String> {
        *self = Self::from_snapshot_with_wave_assets(raw, self.wave_assets.clone())?;
        Ok(())
    }

    fn from_snapshot_with_wave_assets(raw: &str, assets: Option<std::sync::Arc<WaveModelAssets>>) -> Result<Self, String> {
        let mut saved: SessionCheckpoint =
            serde_json::from_str(raw).map_err(|error| format!("会话恢复点无效 {error}"))?;
        // 装载和水深由恢复点重新选择，当前会话的内嵌数组不能跨条件复用。
        let assets = if matches!(saved.configuration.vessel.as_str(), "lng-changheng" | "container-msc")
            && saved.configuration.parameter_version == "research-nominal-v3" {
            None
        } else { assets };
        let mut simulation = Self::new_with_wave_assets(saved.configuration.clone(), assets)?;
        let supported_checkpoint = matches!(
            (saved.schema.as_str(), saved.heading_controller.is_some()),
            (SESSION_SCHEMA, false) | (CHECKPOINT_SCHEMA_V2, true)
        );
        if !supported_checkpoint || saved.parameter_hash != simulation.parameter_hash {
            return Err("恢复点与当前模型版本不一致".into());
        }
        let time_s = saved.physics_ticks as f64 * NOMINAL_DT;
        if !(0.0..NOMINAL_DT).contains(&saved.accumulator_s)
            || saved.controller_ticks != saved.physics_ticks.div_ceil(6)
            || (saved.previous_truth.time_s - time_s).abs() > 1e-8
            || !saved.integral_deg_s.is_finite()
            || !saved.previous_error_deg.is_finite()
        {
            return Err("恢复点的物理、控制或帧累计时钟不一致".into());
        }
        let system = simulation.plant.actuator_system().ok_or("缺少执行器组")?;
        saved.input.validate(&saved.configuration.vessel, system)?;
        if saved.input.berth_plan.is_some() && saved.configuration.berth.is_none() {
            return Err("靠泊速度计划恢复点缺少靠泊初态".into());
        }
        if saved.heading_controller.is_none() && (saved.input.longitudinal.is_some() || saved.configuration.berth.is_some()
            || saved.input.container_speed.is_some() || saved.configuration.container_voyage.is_some()) {
            return Err("纵向控制或靠泊恢复点需要当前版本的会话".into());
        }
        if let Some(controller) = &saved.heading_controller {
            controller.validate_checkpoint(time_s)?;
        }
        if let Some(controller) = &saved.longitudinal_controller {
            if saved.configuration.vessel != "lng-changheng" || saved.heading_controller.is_none() {
                return Err("纵向控制恢复点的船型或会话版本不一致".into());
            }
            controller.validate_checkpoint(maximum_shaft_rpm(system)?, saved.controller_ticks)?;
            if let Some(input) = &saved.input.longitudinal {
                controller.validate_input(input, maximum_shaft_rpm(system)?)?;
            }
        }
        if let Some(controller) = &saved.container_controller {
            if saved.configuration.vessel != "container-msc" || saved.heading_controller.is_none() {
                return Err("集装箱调度恢复点的船型或版本不一致".into());
            }
            if controller.loading_ratio() != saved.configuration.loading_ratio.unwrap_or(0.6) {
                return Err("集装箱调度恢复点的载荷与冻结模型不一致".into());
            }
            controller.validate_checkpoint(maximum_shaft_rpm(system)?, saved.controller_ticks)?;
            if let Some(input) = &saved.input.container_speed { controller.validate_input(input, maximum_shaft_rpm(system)?)?; }
        }
        if saved.cruise_comfort.is_some() != saved.configuration.cruise.is_some()
            || (saved.cruise_controller.is_some() && (saved.configuration.cruise.is_none() || saved.heading_controller.is_none())) {
            return Err("减摇恢复点与邮轮配置不一致".into());
        }
        if let Some(controller) = &saved.cruise_controller {controller.validate_checkpoint(saved.controller_ticks)?;}
        if saved.dp_controller.is_some() != (saved.input.semisub_dp.is_some() && saved.physics_ticks>0) {
            return Err("定位恢复点缺少10Hz控制状态或冻结输入".into());
        }
        if let Some(controller)=&saved.dp_controller {controller.validate_checkpoint(saved.controller_ticks)?;}
        if let Some(comfort) = &saved.cruise_comfort {
            comfort.validate(time_s,saved.configuration.cruise.as_ref().expect("客点统计已绑定配置"))?;
            let expected = simulation.cruise_comfort.as_ref().expect("邮轮统计已初始化");
            if comfort.passengers.iter().zip(&expected.passengers).any(|(point,expected)| point.position_body_m != expected.position_body_m) {
                return Err("客点位置与冻结船体不一致".into());
            }
        }
        system.validate_commands(&saved.input.actuators)?;
        system.validate_commands(&saved.held_commands)?;
        saved
            .sensors
            .validate_checkpoint(&simulation.sensors, time_s)?;
        saved.observer.parameters.validate()?;
        if saved.observer.parameters != simulation.observer.parameters {
            return Err("恢复点的观测器配置与冻结模型不一致".into());
        }
        simulation.plant.restore_checkpoint(saved.plant)?;
        // 零时刻旧初态可补齐空统计，已运行的旧恢复点继续保留其缺测状态。
        if saved.physics_ticks == 0 && simulation.plant.sloshing().is_some() {
            if let Some(evidence) = &mut saved.course_evidence {
                if evidence.metrics.lng.is_none() { evidence.enable_lng(); }
            }
        }
        if saved.course_evidence.is_some() != saved.configuration.course_evidence.is_some() {
            return Err("物理细步证据缺少冻结配置或恢复状态".into());
        }
        if let Some(evidence) = &saved.course_evidence {
            evidence.validate(saved.physics_ticks, simulation.plant.state())?;
            if let Some(metrics) = &evidence.metrics.lng {
                let liquid = simulation.plant.sloshing().ok_or("液货证据缺少冻结液舱")?
                    .observation(&simulation.plant.state().specialist_states);
                let clearance = saved.configuration.berth.as_ref()
                    .and_then(|berth| simulation.plant.bow_clearance_m(berth.stop_line_north_m));
                if saved.physics_ticks > 0 && (metrics.final_bow_clearance_m != clearance
                    || metrics.liquid_depth_m != liquid.liquid_depth_m
                    || liquid.corner_heights_m.iter().any(|height| *height > metrics.maximum_corner_height_m + 1e-10)) {
                    return Err("液货或靠泊统计与当前物理状态不一致".into());
                }
            }
        }
        if saved.voyage_progress.is_some() != saved.configuration.container_voyage.is_some() {
            return Err("航次恢复点与冻结计划不一致".into());
        }
        if let Some(progress) = &saved.voyage_progress {
            progress.validate_checkpoint(time_s, simulation.plant.state().position_ned, saved.paused)?;
            if let Some(end) = &progress.termination {
                let actual_speed = simulation.plant.relative_body_velocity()?[0];
                if (end.final_water_speed_mps-actual_speed).abs() > 1e-8 {
                    return Err("航次终速与实际物理状态不一致".into());
                }
            }
        }
        match (&saved.configuration.berth, &saved.berth_termination) {
            (Some(berth), termination) => {
                let clearance = simulation.plant.bow_clearance_m(berth.stop_line_north_m).ok_or("靠泊恢复点缺少船体几何")?;
                let expected_reason = if clearance <= 0.0 { Some(BerthTerminationReason::StopLineCrossed) }
                    else if time_s >= 1200.0 { Some(BerthTerminationReason::TimeLimit) } else { None };
                if termination.as_ref().map(|value| value.reason) != expected_reason
                    || termination.as_ref().is_some_and(|value| !value.time_s.is_finite() || !value.bow_clearance_m.is_finite()
                        || (value.time_s-time_s).abs() > 1e-8 || (value.bow_clearance_m-clearance).abs() > 1e-8
                        || !saved.paused)
                { return Err("靠泊恢复点的停止条件、船艏距离或时钟不一致".into()); }
            }
            (None, Some(_)) => return Err("靠泊终止记录缺少冻结任务".into()),
            (None, None) => {}
        }
        if (simulation.plant.sim_time_s() - time_s).abs() > 1e-8
            || &saved.previous_truth.state != simulation.plant.state()
        {
            return Err("恢复点的传感器真值缓存与物理状态不一致".into());
        }
        simulation
            .plant
            .environment()
            .ok_or("恢复点缺少环境场")?
            .validate_checkpoint(&configured_environment(&saved.configuration, simulation.wave_binding.as_ref(),
                simulation.hydrodynamic_depth_m)?, time_s)?;
        simulation.sensors = saved.sensors;
        simulation.observer = saved.observer;
        simulation.initialized_axes = saved.initialized_axes;
        simulation.speed_initialized = saved.speed_initialized;
        simulation.previous_truth = saved.previous_truth;
        simulation.input = saved.input;
        simulation.held_commands = saved.held_commands;
        simulation.integral_deg_s = saved.integral_deg_s;
        simulation.previous_error_deg = saved.previous_error_deg;
        simulation.heading_controller = saved.heading_controller;
        simulation.longitudinal_controller = saved.longitudinal_controller;
        simulation.container_controller = saved.container_controller;
        simulation.cruise_controller = saved.cruise_controller;
        simulation.dp_controller = saved.dp_controller;
        simulation.cruise_comfort = saved.cruise_comfort;
        simulation.voyage_progress = saved.voyage_progress;
        simulation.berth_termination = saved.berth_termination;
        simulation.course_evidence = saved.course_evidence;
        simulation.physics_ticks = saved.physics_ticks;
        simulation.controller_ticks = saved.controller_ticks;
        simulation.accumulator_s = saved.accumulator_s;
        simulation.paused = saved.paused;
        simulation.last_samples.clear();
        simulation.last_control_samples.clear();
        Ok(simulation)
    }

    pub fn reset(&mut self) -> Result<(), String> {
        *self = Self::new_with_wave_assets(self.configuration.clone(), self.wave_assets.clone())?;
        Ok(())
    }
}

fn maximum_shaft_rpm(system: &ActuatorSystem) -> Result<f64, String> {
    let maximum = system.propulsors.iter().map(|shaft| shaft.rated_speed_rad_s)
        .reduce(f64::min).ok_or("航速控制缺少主轴")?*30.0/std::f64::consts::PI;
    if !maximum.is_finite() || maximum <= 0.0 { return Err("主轴额定转速无效".into()); }
    Ok(maximum)
}

fn configured_environment(
    configuration: &SessionConfiguration,
    wave_binding: Option<&WaveModelBinding>,
    hydrodynamic_depth_m: Option<f64>,
) -> Result<EnvironmentState, String> {
    let (mut switches, mut wind, mut gust, mut current) = match configuration.environment {
        EnvironmentPreset::P0 => (EnvironmentSwitches::all_off(), 0.0, 0.0, 0.0),
        EnvironmentPreset::W1 => (
            EnvironmentSwitches {
                wind_force_enabled: true,
                ..Default::default()
            },
            8.0,
            1.0,
            0.0,
        ),
        EnvironmentPreset::W2 => (
            EnvironmentSwitches {
                wind_force_enabled: true,
                ..Default::default()
            },
            12.0,
            2.0,
            0.0,
        ),
        EnvironmentPreset::C1 => (
            EnvironmentSwitches {
                current_enabled: true,
                ..Default::default()
            },
            0.0,
            0.0,
            0.3,
        ),
        EnvironmentPreset::C2 => (
            EnvironmentSwitches {
                current_enabled: true,
                ..Default::default()
            },
            0.0,
            0.0,
            0.5,
        ),
        EnvironmentPreset::V1 | EnvironmentPreset::V2 | EnvironmentPreset::V3 => (
            EnvironmentSwitches { wave_enabled: true, ..Default::default() }, 0.0, 0.0, 0.0),
        EnvironmentPreset::E1 => (EnvironmentSwitches::all_on(), 8.0, 1.0, 0.3),
        EnvironmentPreset::E2 => (EnvironmentSwitches::all_on(), 12.0, 2.0, 0.5),
    };
    let mut wave_condition = match configuration.environment {
        EnvironmentPreset::V2 | EnvironmentPreset::E2 => WaveCondition::v2(),
        EnvironmentPreset::V3 => WaveCondition::v3(),
        _ => WaveCondition::v1(),
    };
    let mut wind_from = 60.0;
    let mut current_to = 90.0;
    if let Some(overrides) = &configuration.environment_overrides {
        for (value, maximum) in [(overrides.wind_speed_mps, 50.0), (overrides.gust_sigma_mps, 10.0),
            (overrides.current_speed_mps, 3.0)] {
            if value.is_some_and(|value| !value.is_finite() || !(0.0..=maximum).contains(&value)) {
                return Err("教学风流条件超出允许范围".into());
            }
        }
        if overrides.wind_from_deg.into_iter().chain(overrides.current_to_deg)
            .any(|value| !value.is_finite()) { return Err("教学风流方向无效".into()); }
        if let Some(value) = overrides.wind_speed_mps { wind = value; switches.wind_force_enabled = true; }
        if let Some(value) = overrides.gust_sigma_mps { gust = value; }
        if let Some(value) = overrides.current_speed_mps { current = value; switches.current_enabled = true; }
        wind_from = overrides.wind_from_deg.unwrap_or(wind_from);
        current_to = overrides.current_to_deg.unwrap_or(current_to);
        if let Some(wave) = overrides.wave {
            if !wave.hs_m.is_finite() || !(0.0..=5.0).contains(&wave.hs_m)
                || !wave.tp_s.is_finite() || !(2.6..=30.0).contains(&wave.tp_s)
                || !wave.direction_to_deg.is_finite() || !wave.water_depth_m.is_finite() || wave.water_depth_m <= 0.0 {
                return Err("教学波浪条件无效".into());
            }
            wave_condition = wave;
            switches.wave_enabled = true;
        }
    }
    let switches = configuration.environment_switches.unwrap_or(switches);
    if switches.wave_enabled && wave_binding.is_none() {
        return Err("此参数包的入射波浪系数仍在验证，当前工况未就绪".into());
    }
    if let Some(depth) = wave_binding.map(|binding| binding.water_depth_m).or(hydrodynamic_depth_m) {
        wave_condition.water_depth_m = depth;
    }
    let mut environment = EnvironmentState::new(
        configuration.seed,
        switches,
        wave_condition,
        wind,
        wind_from,
        gust,
        current,
        current_to,
    );
    if let Some(height) = configuration.regular_wave_height_m {
        if !switches.wave_enabled { return Err("规则波任务需要开启实际波浪场".into()); }
        environment.wave = super::wave::WaveField::regular(configuration.seed, wave_condition, height)?;
    }
    if let Some(bins)=configuration.wave_frequency_bins {
        if configuration.regular_wave_height_m.is_some() {return Err("规则波与代表谱频段配置不能同时使用".into());}
        environment.wave=super::wave::WaveField::representative(configuration.seed,wave_condition,bins)?;
    }
    environment.wave.set_second_order_available(wave_binding
        .is_some_and(|binding| binding.full_difference_metadata_fnv1a64.is_some()));
    environment.sensor_enabled = false;
    environment.observation = None;
    Ok(environment)
}
