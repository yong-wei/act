//! 物理细步评价及事件前后一秒的原始窗口，独立于20Hz主记录。
use std::collections::VecDeque;
use serde::{Deserialize, Serialize};
use super::actuator_system::{ActuatorCommands, ActuatorSystem};
use super::state::{TruthState, euler_from_quaternion};

const DT: f64 = 1.0 / 120.0;
const WINDOW_TICKS: u64 = 120;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseEvidenceConfiguration {
    pub roll_warning_deg: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FineStepMetrics {
    pub physics_samples: u64,
    pub maximum_roll_deg: f64,
    pub maximum_pitch_deg: f64,
    pub maximum_yaw_rate_deg_s: f64,
    pub maximum_surface_angle_deg: f64,
    pub maximum_surface_rate_deg_s: f64,
    pub maximum_shaft_power_w: f64,
    pub maximum_positive_system_power_w: f64,
    pub roll_warning_duration_s: f64,
    pub surface_angle_violation_s: f64,
    pub surface_rate_violation_s: f64,
    pub shaft_power_violation_s: f64,
    pub system_power_violation_s: f64,
    pub shaft_speed_violation_s: f64,
    pub surface_saturation_duration_s: f64,
    pub positive_motor_work_j: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FineStepPoint {
    time_s: f64,
    position_ned_m: [f64; 3],
    attitude_deg: [f64; 3],
    body_velocity_si: [f64; 6],
    surface_deg: Vec<f64>,
    shaft_rpm: Vec<f64>,
    azimuth_deg: Vec<f64>,
    motor_power_w: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FineStepEvent {
    time_s: f64,
    kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseEvidenceState {
    pub metrics: FineStepMetrics,
    events: Vec<FineStepEvent>,
    #[serde(skip)]
    pub pending_window_samples: Vec<FineStepPoint>,
    pub emitted_samples: u64,
    recent_samples: VecDeque<FineStepPoint>,
    active_until_tick: u64,
    last_emitted_tick: Option<u64>,
    previous_surface_rad: Vec<f64>,
    previous_roll_warning: bool,
    previous_violation: bool,
    #[serde(default)]
    previous_saturation: bool,
}

impl CourseEvidenceState {
    pub fn new(state: &TruthState) -> Self {
        Self { metrics: FineStepMetrics::default(), events: Vec::new(), pending_window_samples: Vec::new(), emitted_samples: 0,
            recent_samples: VecDeque::new(), active_until_tick: WINDOW_TICKS, last_emitted_tick: None,
            previous_surface_rad: state.actuator_states.control_surface_angles_rad.clone(),
            previous_roll_warning: false, previous_violation: false, previous_saturation: false }
    }

    pub fn event(&mut self, tick: u64, kind: &str) {
        if self.events.last().is_some_and(|event| event.time_s == tick as f64 * DT && event.kind == kind) { return; }
        self.events.push(FineStepEvent { time_s: tick as f64 * DT, kind: kind.into() });
        self.active_until_tick = tick + WINDOW_TICKS;
        for point in self.recent_samples.clone() { self.emit(point); }
    }

    fn emit(&mut self, point: FineStepPoint) {
        let tick = (point.time_s / DT).round() as u64;
        if self.last_emitted_tick.is_none_or(|previous| tick > previous) {
            self.pending_window_samples.push(point);
            self.emitted_samples += 1;
            self.last_emitted_tick = Some(tick);
        }
    }

    pub fn observe(&mut self, tick: u64, state: &TruthState, system: &ActuatorSystem,
        commands: &ActuatorCommands, roll_warning_deg: f64) {
        let euler = euler_from_quaternion(state.quaternion);
        let angles = [euler.roll_rad.to_degrees(), euler.pitch_rad.to_degrees(), euler.yaw_rad.to_degrees()];
        let actual = &state.actuator_states;
        let powers: Vec<f64> = actual.motor_torques_nm.iter().zip(&actual.propeller_shaft_speed_rad_s)
            .map(|(torque, omega)| torque * omega).collect();
        let positive_power: f64 = powers.iter().map(|power| power.max(0.0)).sum();
        let mut angle_violation = false;
        let mut rate_violation = false;
        let mut saturated = false;
        for (index, surface) in system.surfaces.iter().enumerate() {
            let angle = actual.control_surface_angles_rad[index];
            let rate = (angle - self.previous_surface_rad[index]).abs() / DT;
            self.metrics.maximum_surface_angle_deg = self.metrics.maximum_surface_angle_deg.max(angle.abs().to_degrees());
            self.metrics.maximum_surface_rate_deg_s = self.metrics.maximum_surface_rate_deg_s.max(rate.to_degrees());
            angle_violation |= angle.abs() > surface.servo.max_angle_rad + 1e-8;
            rate_violation |= rate > surface.servo.max_rate_rad_s + 1e-8;
            saturated |= commands.surfaces[index].angle_rad.abs() >= surface.servo.max_angle_rad - 1e-8;
            saturated |= rate >= surface.servo.max_rate_rad_s - 1e-8;
        }
        let power_violation = powers.iter().zip(&system.propulsors).any(|(power, shaft)| *power > shaft.max_power_w * (1.0 + 1e-8));
        let speed_violation = actual.propeller_shaft_speed_rad_s.iter().zip(&system.propulsors)
            .any(|(omega, shaft)| omega.abs() > shaft.rated_speed_rad_s + 1e-8);
        let system_violation = system.max_positive_motor_power_w.is_some_and(|budget| positive_power > budget * (1.0 + 1e-8));
        let power_saturated = powers.iter().zip(&system.propulsors).any(|(power,shaft)| *power >= shaft.max_power_w * (1.0-1e-8))
            || system.max_positive_motor_power_w.is_some_and(|budget| positive_power >= budget * (1.0-1e-8));
        let roll_warning = angles[0].abs() > roll_warning_deg;
        let violation = angle_violation || rate_violation || power_violation || speed_violation || system_violation;
        if roll_warning != self.previous_roll_warning { self.event(tick, "roll_warning_transition"); }
        if violation != self.previous_violation { self.event(tick, "actuator_constraint_transition"); }
        if (saturated || power_saturated) != self.previous_saturation { self.event(tick, "actuator_saturation_transition"); }
        self.previous_roll_warning = roll_warning;
        self.previous_violation = violation;
        self.previous_saturation = saturated || power_saturated;
        let metrics = &mut self.metrics;
        metrics.physics_samples += 1;
        metrics.maximum_roll_deg = metrics.maximum_roll_deg.max(angles[0].abs());
        metrics.maximum_pitch_deg = metrics.maximum_pitch_deg.max(angles[1].abs());
        metrics.maximum_yaw_rate_deg_s = metrics.maximum_yaw_rate_deg_s.max(state.body_velocity[5].abs().to_degrees());
        metrics.maximum_shaft_power_w = powers.iter().fold(metrics.maximum_shaft_power_w, |maximum, power| maximum.max(power.abs()));
        metrics.maximum_positive_system_power_w = metrics.maximum_positive_system_power_w.max(positive_power);
        metrics.roll_warning_duration_s += if roll_warning { DT } else { 0.0 };
        metrics.surface_angle_violation_s += if angle_violation { DT } else { 0.0 };
        metrics.surface_rate_violation_s += if rate_violation { DT } else { 0.0 };
        metrics.shaft_power_violation_s += if power_violation { DT } else { 0.0 };
        metrics.system_power_violation_s += if system_violation { DT } else { 0.0 };
        metrics.shaft_speed_violation_s += if speed_violation { DT } else { 0.0 };
        metrics.surface_saturation_duration_s += if saturated { DT } else { 0.0 };
        metrics.positive_motor_work_j = actual.positive_motor_work_j.iter().sum();
        self.previous_surface_rad.clone_from(&actual.control_surface_angles_rad);
        let point = FineStepPoint { time_s: tick as f64 * DT, position_ned_m: state.position_ned,
            attitude_deg: angles, body_velocity_si: state.body_velocity,
            surface_deg: actual.control_surface_angles_rad.iter().map(|angle| angle.to_degrees()).collect(),
            shaft_rpm: actual.propeller_shaft_speed_rad_s.iter().map(|omega| omega * 30.0 / std::f64::consts::PI).collect(),
            azimuth_deg: actual.azimuth_angles_rad.iter().map(|angle| angle.to_degrees()).collect(), motor_power_w: powers };
        self.recent_samples.push_back(point.clone());
        while self.recent_samples.len() > WINDOW_TICKS as usize + 1 { self.recent_samples.pop_front(); }
        if tick <= self.active_until_tick { self.emit(point); }
    }

    pub fn validate(&self, tick: u64, state: &TruthState) -> Result<(), String> {
        let time_s = tick as f64 * DT;
        if self.metrics.physics_samples != tick || self.previous_surface_rad != state.actuator_states.control_surface_angles_rad
            || self.recent_samples.len() > WINDOW_TICKS as usize + 1
            || self.events.iter().any(|event| !event.time_s.is_finite() || event.time_s < 0.0 || event.time_s > time_s + 1e-8)
            || self.pending_window_samples.windows(2).any(|pair| pair[0].time_s >= pair[1].time_s)
            || self.pending_window_samples.iter().chain(&self.recent_samples).any(|point| !point.time_s.is_finite() || point.time_s > time_s + 1e-8)
            || self.emitted_samples > tick || self.last_emitted_tick.is_some_and(|last| last > tick)
        { return Err("物理细步证据与恢复时钟或执行器状态不一致".into()); }
        Ok(())
    }
}
