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

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::coupled_sloshing::LiquidObservation;

    #[test]
    fn lng_window_expires_old_peaks_and_preserves_between_control_tick_liquid_extrema() {
        let mut state = TruthState::default();
        let mut evidence = CourseEvidenceState::new(&state);
        evidence.enable_lng();
        let mut liquid = LiquidObservation { mode_heights_m: vec![0.0; 8], corner_heights_m: vec![0.0; 4],
            modal_frequencies_hz: vec![0.1; 8], liquid_depth_m: 20.0, within_small_amplitude: true };
        for tick in 1..=7440 {
            state.position_ned[1] = if tick == 1 { 40.0 } else { 2.0 };
            liquid.corner_heights_m[0] = if tick == 7 { 2.5 } else { 0.5 };
            liquid.within_small_amplitude = tick != 7;
            evidence.observe_lng(tick, &state, &liquid, Some(30.0));
        }
        let metrics = evidence.metrics.lng.as_ref().unwrap();
        assert_eq!(metrics.physics_samples, 7440);
        assert_eq!(metrics.maximum_corner_height_m, 2.5);
        assert_eq!(metrics.outside_liquid_domain_duration_s, DT);
        assert_eq!(metrics.final60s_lateral_maximum_m, 2.0);
        assert_eq!(metrics.lateral_window_duration_s, 60.0);
        let mut restored: CourseEvidenceState = serde_json::from_str(&serde_json::to_string(&evidence).unwrap()).unwrap();
        for tick in 7441..=7446 {
            evidence.observe_lng(tick, &state, &liquid, Some(30.0));
            restored.observe_lng(tick, &state, &liquid, Some(30.0));
        }
        assert_eq!(serde_json::to_value(&evidence).unwrap(), serde_json::to_value(&restored).unwrap());
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FineStepMetrics {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lng: Option<LngCourseMetrics>,
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

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LngCourseMetrics {
    pub physics_samples: u64,
    pub maximum_corner_height_m: f64,
    pub corner_height_squared_integral_m2_s: f64,
    pub outside_liquid_domain_duration_s: f64,
    pub liquid_depth_m: f64,
    pub final_heading_deg: f64,
    pub final_north_ground_speed_mps: f64,
    pub final_bow_clearance_m: Option<f64>,
    pub final60s_lateral_maximum_m: f64,
    pub lateral_window_duration_s: f64,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    lng_lateral_window: Option<VecDeque<[f64; 2]>>,
}

impl CourseEvidenceState {
    pub fn new(state: &TruthState) -> Self {
        Self { metrics: FineStepMetrics::default(), events: Vec::new(), pending_window_samples: Vec::new(), emitted_samples: 0,
            recent_samples: VecDeque::new(), active_until_tick: WINDOW_TICKS, last_emitted_tick: None,
            previous_surface_rad: state.actuator_states.control_surface_angles_rad.clone(),
            previous_roll_warning: false, previous_violation: false, previous_saturation: false,
            lng_lateral_window: None }
    }

    pub fn enable_lng(&mut self) {
        self.metrics.lng = Some(LngCourseMetrics::default());
        self.lng_lateral_window = Some(VecDeque::new());
    }

    pub fn observe_lng(&mut self, tick: u64, state: &TruthState,
        liquid: &super::coupled_sloshing::LiquidObservation, bow_clearance_m: Option<f64>) {
        let (Some(metrics), Some(window)) = (&mut self.metrics.lng, &mut self.lng_lateral_window) else { return; };
        let time_s = tick as f64 * DT;
        let height = liquid.corner_heights_m.iter().copied().fold(0.0_f64, f64::max);
        metrics.physics_samples += 1;
        metrics.maximum_corner_height_m = metrics.maximum_corner_height_m.max(height);
        metrics.corner_height_squared_integral_m2_s += height * height * DT;
        metrics.outside_liquid_domain_duration_s += if liquid.within_small_amplitude { 0.0 } else { DT };
        metrics.liquid_depth_m = liquid.liquid_depth_m;
        metrics.final_heading_deg = euler_from_quaternion(state.quaternion).yaw_rad.to_degrees();
        let rotation = super::state::rotation_matrix(state.quaternion);
        metrics.final_north_ground_speed_mps = (0..3).map(|axis| rotation[0][axis] * state.body_velocity[axis]).sum();
        metrics.final_bow_clearance_m = bow_clearance_m;
        let lateral = state.position_ned[1].abs();
        while window.back().is_some_and(|point| point[1] <= lateral) { window.pop_back(); }
        window.push_back([time_s, lateral]);
        while window.front().is_some_and(|point| point[0] < time_s - 60.0 - 1e-9) { window.pop_front(); }
        metrics.final60s_lateral_maximum_m = window.front().map(|point| point[1]).unwrap_or(0.0);
        metrics.lateral_window_duration_s = time_s.min(60.0);
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
        if self.metrics.lng.is_some() != self.lng_lateral_window.is_some() {
            return Err("液货证据与横偏窗口不一致".into());
        }
        if let (Some(metrics), Some(window)) = (&self.metrics.lng, &self.lng_lateral_window) {
            let rotation = super::state::rotation_matrix(state.quaternion);
            let north_speed: f64 = (0..3).map(|axis| rotation[0][axis] * state.body_velocity[axis]).sum();
            let values = [metrics.maximum_corner_height_m, metrics.corner_height_squared_integral_m2_s,
                metrics.outside_liquid_domain_duration_s, metrics.liquid_depth_m, metrics.final60s_lateral_maximum_m,
                metrics.lateral_window_duration_s];
            if metrics.physics_samples != tick || values.iter().any(|value| !value.is_finite() || *value < 0.0)
                || metrics.outside_liquid_domain_duration_s > time_s + 1e-7
                || metrics.lateral_window_duration_s != time_s.min(60.0)
                || !metrics.final_heading_deg.is_finite() || !metrics.final_north_ground_speed_mps.is_finite()
                || metrics.final_bow_clearance_m.is_some_and(|value| !value.is_finite())
                || window.len() > 7201 || (tick > 0 && window.is_empty())
                || window.iter().any(|point| !point[0].is_finite() || !point[1].is_finite() || point[1] < 0.0
                    || point[0] < (time_s - 60.0).max(0.0) - 1e-8 || point[0] > time_s)
                || window.iter().zip(window.iter().skip(1)).any(|(first, second)| first[0] >= second[0] || first[1] <= second[1])
                || window.front().is_some_and(|point| point[1] != metrics.final60s_lateral_maximum_m)
                || (tick > 0 && ((metrics.final_heading_deg - euler_from_quaternion(state.quaternion).yaw_rad.to_degrees()).abs() > 1e-10
                    || (metrics.final_north_ground_speed_mps - north_speed).abs() > 1e-10
                    || window.back().is_none_or(|point| point[0] != time_s || point[1] != state.position_ned[1].abs())))
            { return Err("液货物理细步统计或末60秒横偏窗口无效".into()); }
        }
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
