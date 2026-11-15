//! 981的10Hz位置/航向控制。位置误差与载荷在同一船体坐标中计算。

use super::actuator_system::{ActuatorCommands, ActuatorSystem};
use super::passive_observer::wrap_pi;
use super::semisub_allocator::{self, AllocationMode, AllocationResult, DP_DT_S};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DpFeedback {
    Raw,
    LowFrequency,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NavigationLossStrategy {
    Predict,
    FreezeIntegral,
    SafeExit,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DpStudentModel {
    pub a: [f64; 9],
    pub b: [f64; 9],
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemisubDpInput {
    pub target_position_m: [f64; 2],
    pub target_heading_deg: f64,
    pub bandwidth_rad_s: f64,
    pub integral_enabled: bool,
    pub integral_time_s: f64,
    pub feedback: DpFeedback,
    pub low_frequency_cutoff_hz: f64,
    pub decoupling: bool,
    pub student_model: Option<DpStudentModel>,
    pub wind_feedforward: bool,
    pub allocation: AllocationMode,
    pub axis_weights: [f64; 3],
    pub energy_weight: f64,
    pub reallocate: bool,
    pub navigation_loss_strategy: NavigationLossStrategy,
}

impl SemisubDpInput {
    pub fn validate(&self) -> Result<(), String> {
        if self
            .target_position_m
            .iter()
            .chain(std::iter::once(&self.target_heading_deg))
            .any(|v| !v.is_finite())
            || self.target_position_m.iter().any(|v| v.abs() > 1000.0)
            || ![0.015, 0.025, 0.04].contains(&self.bandwidth_rad_s)
            || ![100.0, 200.0, 400.0].contains(&self.integral_time_s)
            || ![0.02, 0.04, 0.08].contains(&self.low_frequency_cutoff_hz)
            || self
                .axis_weights
                .iter()
                .any(|v| !v.is_finite() || !(0.5..=2.0).contains(v))
            || !self.energy_weight.is_finite()
            || !(0.5..=2.0).contains(&self.energy_weight)
        {
            return Err("定位目标、带宽、积分时间或分配权重无效".into());
        }
        if let Some(model) = &self.student_model {
            if model.a.iter().chain(&model.b).any(|v| !v.is_finite())
                || semisub_allocator::inverse3(model.b).is_none()
                || [model.b[0], model.b[4], model.b[8]]
                    .iter()
                    .any(|v| v.abs() < 1e-20)
            {
                return Err("本人低频三通道模型无效或输入矩阵不可逆".into());
            }
        }
        if self.decoupling && self.student_model.is_none() {
            return Err("解耦补偿需要本人冻结的三通道模型".into());
        }
        Ok(())
    }
}

pub struct DpMeasurements {
    pub position_heading: [Option<f64>; 3],
    pub position_sample_time_s: Option<f64>,
    pub low_frequency_position_heading: [f64; 3],
    pub low_frequency_body_velocity: [f64; 3],
    pub yaw_rate_rad_s: Option<f64>,
    pub azimuth_rad: [Option<f64>; 8],
    pub shaft_speed_rad_s: [Option<f64>; 8],
    pub estimated_control_load_body: [f64; 3],
    pub measured_wind_load_body: Option<[f64; 3]>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemisubDpController {
    pub ticks: u64,
    pub integral_earth: [f64; 3],
    pub requested_body: [f64; 3],
    pub actual_estimated_body: [f64; 3],
    pub position_error_body: [f64; 3],
    pub feedback_position_heading: [f64; 3],
    pub feedback_body_velocity: [f64; 3],
    pub target_position_m: [f64; 2],
    pub target_heading_deg: f64,
    pub measured_wind_feedforward_body: [f64; 3],
    pub kp: [f64; 3],
    pub kd: [f64; 3],
    pub ki: [f64; 3],
    pub navigation_good: bool,
    pub missing_navigation_s: f64,
    pub integral_frozen: bool,
    pub safe_exit: bool,
    pub allocation: Option<AllocationResult>,
    pub estimated_roll_rad: f64,
    pub estimated_pitch_rad: f64,
    attitude_initialized: bool,
    previous_raw_position_heading: Option<[f64; 3]>,
    previous_raw_sample_time_s: Option<f64>,
    raw_velocity_earth: [f64; 3],
    previous_force_n: [[f64; 2]; 8],
}

fn earth_to_body(value: [f64; 3], yaw: f64) -> [f64; 3] {
    let (sine, cosine) = yaw.sin_cos();
    [
        cosine * value[0] + sine * value[1],
        -sine * value[0] + cosine * value[1],
        value[2],
    ]
}

fn body_to_earth(value: [f64; 3], yaw: f64) -> [f64; 3] {
    earth_to_body(value, -yaw)
}

impl SemisubDpController {
    pub fn observe_attitude(&mut self, rates: Option<[f64; 3]>, specific_force: Option<[f64; 3]>) {
        let (Some(rates), Some(force)) = (rates, specific_force) else {
            return;
        };
        let tilt_roll = (-force[1]).atan2(-force[2]);
        let tilt_pitch = force[0].atan2(force[1].hypot(force[2]));
        if !self.attitude_initialized {
            self.estimated_roll_rad = tilt_roll;
            self.estimated_pitch_rad = tilt_pitch;
            self.attitude_initialized = true;
        }
        let weight = 1.0 - (-2.0 * std::f64::consts::PI * 0.03 * 0.05).exp();
        let pitch = self.estimated_pitch_rad.clamp(-1.2, 1.2);
        let roll = self.estimated_roll_rad;
        let roll_rate =
            rates[0] + roll.sin() * pitch.tan() * rates[1] + roll.cos() * pitch.tan() * rates[2];
        self.estimated_roll_rad += 0.05 * roll_rate;
        self.estimated_roll_rad += weight * wrap_pi(tilt_roll - self.estimated_roll_rad);
        self.estimated_pitch_rad += weight * (tilt_pitch - self.estimated_pitch_rad);
    }

    pub fn navigation_offset_ne(&self, lever: [f64; 3], yaw: f64) -> [f64; 2] {
        let (sr, cr) = self.estimated_roll_rad.sin_cos();
        let (sp, cp) = self.estimated_pitch_rad.sin_cos();
        let (sy, cy) = yaw.sin_cos();
        [
            cy * cp * lever[0]
                + (cy * sp * sr - sy * cr) * lever[1]
                + (cy * sp * cr + sy * sr) * lever[2],
            sy * cp * lever[0]
                + (sy * sp * sr + cy * cr) * lever[1]
                + (sy * sp * cr - cy * sr) * lever[2],
        ]
    }

    #[allow(clippy::too_many_arguments)]
    pub fn step(
        &mut self,
        input: &SemisubDpInput,
        measurement: DpMeasurements,
        mass_diagonal: [f64; 3],
        linear_damping: [f64; 3],
        system: &ActuatorSystem,
        failed: Option<usize>,
        mut commands: ActuatorCommands,
    ) -> Result<ActuatorCommands, String> {
        input.validate()?;
        self.target_position_m = input.target_position_m;
        self.target_heading_deg = input.target_heading_deg;
        self.ticks += 1;
        self.navigation_good = measurement.position_heading.iter().all(Option::is_some);
        self.missing_navigation_s = if self.navigation_good {
            0.0
        } else {
            self.missing_navigation_s + DP_DT_S
        };
        self.safe_exit |= !self.navigation_good
            && input.navigation_loss_strategy == NavigationLossStrategy::SafeExit;
        self.integral_frozen = !input.integral_enabled
            || self.safe_exit
            || (!self.navigation_good
                && input.navigation_loss_strategy == NavigationLossStrategy::FreezeIntegral);
        let raw = match measurement.position_heading {
            [Some(x), Some(y), Some(heading)] => Some([x, y, heading]),
            _ => None,
        };
        let low_frequency = input.feedback == DpFeedback::LowFrequency || raw.is_none();
        let position = if low_frequency {
            measurement.low_frequency_position_heading
        } else {
            raw.expect("已检查完整测量")
        };
        let mut velocity = measurement.low_frequency_body_velocity;
        if !low_frequency {
            if let (Some(previous), Some(previous_time), Some(sample_time)) = (
                self.previous_raw_position_heading,
                self.previous_raw_sample_time_s,
                measurement.position_sample_time_s,
            ) {
                let elapsed = sample_time - previous_time;
                if elapsed > 1e-8 {
                    self.raw_velocity_earth = [
                        (position[0] - previous[0]) / elapsed,
                        (position[1] - previous[1]) / elapsed,
                        wrap_pi(position[2] - previous[2]) / elapsed,
                    ];
                }
            }
            velocity = earth_to_body(self.raw_velocity_earth, position[2]);
            if let Some(yaw_rate) = measurement.yaw_rate_rad_s {
                velocity[2] = yaw_rate;
            }
        }
        if let (Some(raw), Some(sample_time)) = (raw, measurement.position_sample_time_s) {
            if self.previous_raw_sample_time_s != Some(sample_time) {
                self.previous_raw_position_heading = Some(raw);
                self.previous_raw_sample_time_s = Some(sample_time);
            }
        }
        self.feedback_position_heading = position;
        self.feedback_body_velocity = velocity;
        let error_earth = [
            input.target_position_m[0] - position[0],
            input.target_position_m[1] - position[1],
            wrap_pi(input.target_heading_deg.to_radians() - position[2]),
        ];
        let error = earth_to_body(error_earth, position[2]);
        self.position_error_body = error;
        self.kp = mass_diagonal.map(|mass| mass * input.bandwidth_rad_s.powi(2));
        self.kd = std::array::from_fn(|axis| {
            (2.0 * 0.9 * mass_diagonal[axis] * input.bandwidth_rad_s - linear_damping[axis])
                .max(0.0)
        });
        self.ki = self.kp.map(|kp| kp / input.integral_time_s);
        let integral_body = earth_to_body(self.integral_earth, position[2]);
        let mut requested: [f64; 3] = std::array::from_fn(|axis| {
            self.kp[axis] * error[axis] - self.kd[axis] * velocity[axis]
                + if input.integral_enabled {
                    integral_body[axis]
                } else {
                    0.0
                }
        });
        if input.decoupling {
            let model = input.student_model.as_ref().expect("本人模型已验证");
            // 已有工件为离散位置模型。B的对角响应定义原通道尺度，只补偿交叉通道。
            let inverse = semisub_allocator::inverse3(model.b).ok_or("本人模型不可逆")?;
            let target: [f64; 3] =
                std::array::from_fn(|axis| model.b[axis * 3 + axis] * requested[axis]);
            requested = std::array::from_fn(|axis| {
                (0..3)
                    .map(|col| inverse[axis * 3 + col] * target[col])
                    .sum()
            });
        }
        self.measured_wind_feedforward_body = if input.wind_feedforward {
            measurement
                .measured_wind_load_body
                .map(|load| load.map(|value| -value))
                .unwrap_or([0.0; 3])
        } else {
            [0.0; 3]
        };
        for axis in 0..3 {
            requested[axis] += self.measured_wind_feedforward_body[axis];
        }
        if self.safe_exit {
            requested = [0.0; 3];
            self.integral_earth = [0.0; 3];
        }
        self.requested_body = requested;
        self.actual_estimated_body = measurement.estimated_control_load_body;
        let instruments_good = measurement
            .azimuth_rad
            .iter()
            .chain(&measurement.shaft_speed_rad_s)
            .all(Option::is_some);
        if !instruments_good || self.safe_exit {
            for shaft in &mut commands.shafts {
                shaft.speed_reference_rad_s = 0.0;
            }
            self.allocation = None;
            return Ok(commands);
        }
        let allocation = semisub_allocator::allocate(
            system,
            requested,
            input.allocation,
            input.axis_weights,
            input.energy_weight,
            measurement
                .azimuth_rad
                .map(|v| v.expect("编码器测量已检查")),
            measurement
                .shaft_speed_rad_s
                .map(|v| v.expect("轴速测量已检查")),
            velocity,
            self.previous_force_n,
            failed,
            input.reallocate,
            commands,
        );
        if !self.integral_frozen {
            let applied = if input.allocation == AllocationMode::SequentialConvex {
                allocation.allocated_body
            } else {
                measurement.estimated_control_load_body
            };
            let rate = std::array::from_fn(|axis| {
                self.ki[axis] * error[axis] + (applied[axis] - requested[axis]) / 20.0
            });
            let earth_rate = body_to_earth(rate, position[2]);
            for axis in 0..3 {
                let limit = if axis == 2 {
                    8.0 * 800_000.0 * 60.0
                } else {
                    8.0 * 800_000.0
                };
                self.integral_earth[axis] =
                    (self.integral_earth[axis] + earth_rate[axis] * DP_DT_S).clamp(-limit, limit);
            }
        }
        self.previous_force_n = allocation.forces_body_n;
        commands = allocation.commands.clone();
        self.allocation = Some(allocation);
        Ok(commands)
    }

    pub fn validate_checkpoint(&self, control_ticks: u64) -> Result<(), String> {
        let finite = self
            .integral_earth
            .iter()
            .chain(&self.requested_body)
            .chain(&self.actual_estimated_body)
            .chain(&self.position_error_body)
            .chain(&self.feedback_position_heading)
            .chain(&self.feedback_body_velocity)
            .chain(&self.measured_wind_feedforward_body)
            .chain(&self.kp)
            .chain(&self.kd)
            .chain(&self.ki)
            .chain(&self.raw_velocity_earth)
            .chain(&self.target_position_m)
            .chain(std::iter::once(&self.target_heading_deg))
            .chain([&self.estimated_roll_rad, &self.estimated_pitch_rad])
            .chain(self.previous_force_n.iter().flatten())
            .all(|v| v.is_finite());
        if !finite
            || !self.missing_navigation_s.is_finite()
            || self.missing_navigation_s < 0.0
            || self.ticks != control_ticks.div_ceil(2)
            || self
                .previous_raw_position_heading
                .is_some_and(|v| v.iter().any(|v| !v.is_finite()))
            || self
                .previous_raw_sample_time_s
                .is_some_and(|v| !v.is_finite() || v < 0.0)
        {
            return Err("定位控制恢复点的数值或10Hz时钟不一致".into());
        }
        Ok(())
    }
}
