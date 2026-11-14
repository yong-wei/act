//! 常驻物理状态、采样队列、观测器和20Hz控制时钟。

use super::actuator_system::{ActuatorCommands, LocalWater, ShaftCommand, SurfaceCommand};
use super::control_law::{
    DEFAULT_DERIVATIVE_FILTER_TAU_S, HeadingControlMode, HeadingFeedbackController,
    HeadingPidGains, command_rudder_deg,
};
use super::destroyer_plant::{DestroyerSixDofPlant, PlantCheckpoint};
use super::environment_state::{EnvironmentState, EnvironmentSwitches};
use super::instrumentation::{
    ObservationTruth, ObservedSample, SensorInstallations, SensorSignal, SensorSuite,
};
use super::integrator::NOMINAL_DT;
use super::model_pack::embedded_vessel_pack_with_loading;
use super::passive_observer::{PassiveObserver, PassiveObserverParameters, wrap_pi};
use super::sensor::NoiseLevel;
use super::state::ActuatorStates;
use super::wave::WaveCondition;
use super::wind::WindHullGeometry;
use serde::{Deserialize, Serialize};

const SESSION_SCHEMA: &str = "act.vessel-session.v1";
const CHECKPOINT_SCHEMA_V2: &str = "act.vessel-session.v2";

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SessionConfiguration {
    pub vessel: String,
    pub parameter_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loading_ratio: Option<f64>,
    pub seed: u64,
    pub noise_level: NoiseLevel,
    pub environment: EnvironmentPreset,
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
            seed: 20261106,
            noise_level: NoiseLevel::N1,
            environment: EnvironmentPreset::P0,
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
}

fn default_derivative_filter_tau_s() -> f64 {
    DEFAULT_DERIVATIVE_FILTER_TAU_S
}

impl SessionInput {
    fn validate(&self, vessel: &str) -> Result<(), String> {
        if [
            self.pid.kp,
            self.pid.ki,
            self.pid.kd,
            self.target_heading_deg,
            self.derivative_filter_tau_s,
        ].iter().any(|value| !value.is_finite())
            || self.derivative_filter_tau_s <= 0.0
        {
            return Err("控制输入或微分滤波时间常数无效".into());
        }
        if vessel == "semisub-981" && self.control_mode != HeadingControlMode::Manual {
            return Err("平台定位控制模板正在接线，当前可用手动推进器命令".into());
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
    physics_ticks: u64,
    controller_ticks: u64,
    accumulator_s: f64,
    paused: bool,
}

#[derive(Clone)]
pub struct FleetSimulation {
    configuration: SessionConfiguration,
    parameter_hash: String,
    plant: DestroyerSixDofPlant,
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
    physics_ticks: u64,
    controller_ticks: u64,
    accumulator_s: f64,
    paused: bool,
    last_samples: Vec<ObservedSample>,
}

impl FleetSimulation {
    pub fn new(configuration: SessionConfiguration) -> Result<Self, String> {
        if !configuration.initial_heading_deg.is_finite()
            || configuration
                .initial_position_ned
                .iter()
                .any(|value| !value.is_finite())
        {
            return Err("初始位置或航向无效".into());
        }
        let pack = embedded_vessel_pack_with_loading(&configuration.vessel,
            &configuration.parameter_version, configuration.loading_ratio)
            .map_err(|error| format!("参数包无效 {error:?}"))?;
        if configuration.vessel != "destroyer-055"
            && matches!(configuration.environment, EnvironmentPreset::W1 | EnvironmentPreset::W2)
        {
            return Err("该船型的风载投影仍在核验，当前工况未就绪".into());
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
        let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
        let yaw = wrap_pi(configuration.initial_heading_deg.to_radians());
        let mut state = plant.state().clone();
        state.position_ned = configuration.initial_position_ned;
        let half_pitch = pack.geometry.equilibrium_pitch_rad / 2.0;
        state.quaternion = [(yaw / 2.0).cos() * half_pitch.cos(),
            -(yaw / 2.0).sin() * half_pitch.sin(),
            (yaw / 2.0).cos() * half_pitch.sin(),
            (yaw / 2.0).sin() * half_pitch.cos()];
        plant.restore_state(state);
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
        let mut environment = configured_environment(&configuration)?;
        environment.sensor_enabled = false;
        environment.observation = None;
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
        let mut simulation = Self {
            configuration,
            parameter_hash: pack.content_hash,
            plant,
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
            },
            held_commands: actuators,
            integral_deg_s: 0.0,
            previous_error_deg: 0.0,
            heading_controller: Some(HeadingFeedbackController::default()),
            physics_ticks: 0,
            controller_ticks: 0,
            accumulator_s: 0.0,
            paused: false,
            last_samples,
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
        self.held_commands = self.input.actuators.clone();
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
            let command = controller.step(
                self.input.control_mode,
                &self.input.pid,
                self.input.target_heading_deg,
                heading,
                self.physics_ticks as f64 * NOMINAL_DT,
                0.05,
                self.input.derivative_filter_tau_s,
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
                wrap_pi(self.input.target_heading_deg.to_radians()).to_degrees(),
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
        }
        let mut commands = self.held_commands.clone();
        if self.time_s() >= 180.0 {
            if let Some(shaft) = commands.shafts.first_mut() {
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
        self.last_samples.extend(self.sensors.advance(
            &self.previous_truth,
            &current,
            self.plant.environment().ok_or("缺少会话环境")?,
        ));
        self.previous_truth = current;
        self.initialize_from_measurements();
        let values = [
            SensorSignal::North,
            SensorSignal::East,
            SensorSignal::Heading,
        ]
        .map(|signal| {
            self.sensors
                .valid_value(signal, self.time_s())
                .map(|value| {
                    if signal == SensorSignal::Heading {
                        value.to_radians()
                    } else {
                        value
                    }
                })
        });
        self.observer
            .step(NOMINAL_DT, values, self.estimated_control_load())
            .map_err(|error| format!("观测步失败 {error:?}"))?;
        Ok(())
    }

    pub fn time_s(&self) -> f64 {
        self.physics_ticks as f64 * NOMINAL_DT
    }

    pub fn input(&self) -> &SessionInput {
        &self.input
    }

    pub fn set_paused(&mut self, paused: bool) {
        self.paused = paused;
    }

    pub fn advance(&mut self, seconds: f64, input: Option<SessionInput>) -> Result<(), String> {
        if !seconds.is_finite() || !(0.0..=1.0).contains(&seconds) {
            return Err("帧推进量必须为0至1秒".into());
        }
        if let Some(input) = &input {
            input.validate(&self.configuration.vessel)?;
            self.plant
                .actuator_system()
                .ok_or("缺少执行器组")?
                .validate_commands(&input.actuators)?;
        }
        let checkpoint = self.clone();
        if let Some(input) = input {
            self.input = input;
        }
        self.last_samples.clear();
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
        }
        Ok(())
    }

    pub fn frame_json(&self) -> Result<String, String> {
        serde_json::to_string(&serde_json::json!({
            "schema": SESSION_SCHEMA, "modelVersion": if self.heading_controller.is_some() { "sixdof-session-v2" } else { "sixdof-session-v1" }, "parameterHash": self.parameter_hash,
            "timeS": self.time_s(), "physicsTicks": self.physics_ticks, "controllerTicks": self.controller_ticks,
            "paused": self.paused, "truth": self.plant.state(), "observer": self.observer,
            "input": self.input, "heldCommands": self.held_commands, "samples": self.last_samples,
            "liquidCargo": self.plant.liquid_diagnostics()?,
            "headingController": self.heading_controller,
        })).map_err(|error| error.to_string())
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
            physics_ticks: self.physics_ticks,
            controller_ticks: self.controller_ticks,
            accumulator_s: self.accumulator_s,
            paused: self.paused,
        };
        serde_json::to_string(&checkpoint).map_err(|error| error.to_string())
    }

    pub fn from_snapshot_json(raw: &str) -> Result<Self, String> {
        let saved: SessionCheckpoint =
            serde_json::from_str(raw).map_err(|error| format!("会话恢复点无效 {error}"))?;
        let mut simulation = Self::new(saved.configuration.clone())?;
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
        saved.input.validate(&saved.configuration.vessel)?;
        if let Some(controller) = &saved.heading_controller {
            controller.validate_checkpoint(time_s)?;
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
        if (simulation.plant.sim_time_s() - time_s).abs() > 1e-8
            || &saved.previous_truth.state != simulation.plant.state()
        {
            return Err("恢复点的传感器真值缓存与物理状态不一致".into());
        }
        simulation
            .plant
            .environment()
            .ok_or("恢复点缺少环境场")?
            .validate_checkpoint(&configured_environment(&saved.configuration)?, time_s)?;
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
        simulation.physics_ticks = saved.physics_ticks;
        simulation.controller_ticks = saved.controller_ticks;
        simulation.accumulator_s = saved.accumulator_s;
        simulation.paused = saved.paused;
        simulation.last_samples.clear();
        Ok(simulation)
    }

    pub fn reset(&mut self) -> Result<(), String> {
        *self = Self::new(self.configuration.clone())?;
        Ok(())
    }
}

fn configured_environment(
    configuration: &SessionConfiguration,
) -> Result<EnvironmentState, String> {
    let (switches, wind, gust, current) = match configuration.environment {
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
        _ => return Err("此参数包的入射波浪系数仍在验证，当前工况未就绪".into()),
    };
    let mut environment = EnvironmentState::new(
        configuration.seed,
        switches,
        WaveCondition::v1(),
        wind,
        60.0,
        gust,
        current,
        90.0,
    );
    environment.sensor_enabled = false;
    environment.observation = None;
    Ok(environment)
}
