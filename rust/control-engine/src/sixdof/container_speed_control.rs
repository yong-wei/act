//! 三个冻结辨识工作点的线性增益调度、斜率受限速度计划和无扰PI。

use super::lng_speed_control::{imc_pi_gains, ImcPiGains, SpeedOperatingModel, CONTROL_DT_S};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledSpeedModel {
    pub loading_ratio: f64,
    pub operating_model: SpeedOperatingModel,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SpeedFeedback {
    Water,
    Ground,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContainerSpeedInput {
    pub models: [ScheduledSpeedModel; 3],
    pub reference_mps: f64,
    pub fixed_model_index: usize,
    pub scheduling_enabled: bool,
    pub bumpless: bool,
    pub kp_multiplier: f64,
    pub ti_multiplier: f64,
    pub anti_windup: bool,
    pub filter_tau_s: f64,
    pub feedback: SpeedFeedback,
    pub los_lookahead_m: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContainerSpeedDiagnostics {
    pub ticks: u64,
    pub requested_reference_mps: f64,
    pub slewed_reference_mps: f64,
    pub filtered_water_speed_mps: Option<f64>,
    pub filtered_feedback_mps: Option<f64>,
    pub error_mps: f64,
    pub model_weights: [f64; 3],
    pub outside_identified_domain: bool,
    pub gains: ImcPiGains,
    pub operating_reference_rpm: f64,
    pub integral_rpm: f64,
    pub integral_rate_rpm_per_s: f64,
    pub unsaturated_rpm: f64,
    pub command_rpm: f64,
    pub integral_frozen: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContainerSpeedController {
    models: [ScheduledSpeedModel; 3],
    loading_ratio: f64,
    previous_feedback: SpeedFeedback,
    diagnostics: ContainerSpeedDiagnostics,
}

fn coordinate(loading_ratio: f64, speed_mps: f64) -> [f64; 2] {
    [(loading_ratio - 0.2) / 0.7, (speed_mps - 6.0) / 6.0]
}

/// 三角形内采用重心线性插值，边界外投影到最近边，并保留超域诊断。
/// 同航速的三个载荷点退化为相邻两点分段线性插值。
pub fn schedule_weights(
    models: &[ScheduledSpeedModel; 3],
    loading_ratio: f64,
    speed_mps: f64,
) -> ([f64; 3], bool) {
    let points = models
        .each_ref()
        .map(|model| coordinate(model.loading_ratio, model.operating_model.speed_mps));
    let target = coordinate(loading_ratio, speed_mps);
    let cross = |a: [f64; 2], b: [f64; 2]| a[0] * b[1] - a[1] * b[0];
    let subtract = |a: [f64; 2], b: [f64; 2]| [a[0] - b[0], a[1] - b[1]];
    let first = subtract(points[1], points[0]);
    let second = subtract(points[2], points[0]);
    let offset = subtract(target, points[0]);
    let area = cross(first, second);
    if area.abs() > 1e-12 {
        let weights = [
            1.0 - (cross(offset, second) + cross(first, offset)) / area,
            cross(offset, second) / area,
            cross(first, offset) / area,
        ];
        if weights.iter().all(|weight| *weight >= -1e-12) {
            let weights = weights.map(|weight| weight.max(0.0));
            let total: f64 = weights.iter().sum();
            return (weights.map(|weight| weight / total), false);
        }
    }
    let mut best = (f64::INFINITY, f64::INFINITY, [0.0; 3]);
    for (a, b) in [(0, 1), (1, 2), (0, 2)] {
        let edge = subtract(points[b], points[a]);
        let offset = subtract(target, points[a]);
        let length = edge[0] * edge[0] + edge[1] * edge[1];
        let fraction = ((offset[0] * edge[0] + offset[1] * edge[1]) / length).clamp(0.0, 1.0);
        let residual = [
            offset[0] - fraction * edge[0],
            offset[1] - fraction * edge[1],
        ];
        let distance = residual[0] * residual[0] + residual[1] * residual[1];
        if distance < best.0 - 1e-14 || ((distance - best.0).abs() <= 1e-14 && length < best.1) {
            let mut weights = [0.0; 3];
            weights[a] = 1.0 - fraction;
            weights[b] = fraction;
            best = (distance, length, weights);
        }
    }
    (best.2, best.0 > 1e-12)
}

impl ContainerSpeedInput {
    pub fn validate(&self, maximum_rpm: f64) -> Result<(), String> {
        if !maximum_rpm.is_finite()
            || maximum_rpm <= 0.0
            || self.fixed_model_index >= 3
            || !self.reference_mps.is_finite()
            || !(6.0..=12.0).contains(&self.reference_mps)
            || !self.kp_multiplier.is_finite()
            || !(0.2..=3.0).contains(&self.kp_multiplier)
            || !self.ti_multiplier.is_finite()
            || !(0.3..=3.0).contains(&self.ti_multiplier)
            || ![0.2, 1.0, 3.0].contains(&self.filter_tau_s)
            || self
                .los_lookahead_m
                .is_some_and(|value| !value.is_finite() || !(200.0..=800.0).contains(&value))
        {
            return Err("集装箱航速参考、调度、PI范围、滤波或LOS前视距离无效".into());
        }
        for (index, model) in self.models.iter().enumerate() {
            let operating = &model.operating_model;
            if !model.loading_ratio.is_finite()
                || !(0.2..=0.9).contains(&model.loading_ratio)
                || !operating.speed_mps.is_finite()
                || !(6.0..=12.0).contains(&operating.speed_mps)
                || !operating.shaft_reference_rpm.is_finite()
                || operating.shaft_reference_rpm.abs() > maximum_rpm
                || self.models[..index].iter().any(|other| {
                    other.loading_ratio == model.loading_ratio
                        && other.operating_model.speed_mps == operating.speed_mps
                })
            {
                return Err("三个辨识工作点的载荷、航速或轴速无效或重复".into());
            }
            imc_pi_gains(&operating.structure, self.kp_multiplier, self.ti_multiplier)?;
        }
        Ok(())
    }

    fn gains_at(&self, weights: [f64; 3]) -> Result<(ImcPiGains, f64), String> {
        let mut gains = ImcPiGains {
            kp_rpm_per_mps: 0.0,
            ti_s: 0.0,
            lambda_s: 0.0,
            tracking_time_s: 0.0,
        };
        let mut reference_rpm = 0.0;
        for (model, weight) in self.models.iter().zip(weights) {
            let local = imc_pi_gains(
                &model.operating_model.structure,
                self.kp_multiplier,
                self.ti_multiplier,
            )?;
            gains.kp_rpm_per_mps += weight * local.kp_rpm_per_mps;
            gains.ti_s += weight * local.ti_s;
            gains.lambda_s += weight * local.lambda_s;
            reference_rpm += weight * model.operating_model.shaft_reference_rpm;
        }
        gains.tracking_time_s = gains.ti_s / 5.0;
        Ok((gains, reference_rpm))
    }
}

impl ContainerSpeedController {
    pub fn new(
        input: &ContainerSpeedInput,
        loading_ratio: f64,
        initial_rpm: f64,
        maximum_rpm: f64,
    ) -> Result<Self, String> {
        input.validate(maximum_rpm)?;
        if !loading_ratio.is_finite()
            || !(0.2..=0.9).contains(&loading_ratio)
            || !initial_rpm.is_finite()
            || initial_rpm.abs() > maximum_rpm
        {
            return Err("集装箱航速控制初态无效".into());
        }
        let mut weights = [0.0; 3];
        weights[input.fixed_model_index] = 1.0;
        let (gains, operating_reference_rpm) = input.gains_at(weights)?;
        Ok(Self {
            models: input.models.clone(),
            loading_ratio,
            previous_feedback: input.feedback,
            diagnostics: ContainerSpeedDiagnostics {
                ticks: 0,
                requested_reference_mps: input.reference_mps,
                slewed_reference_mps: 8.0,
                filtered_water_speed_mps: None,
                filtered_feedback_mps: None,
                error_mps: 0.0,
                model_weights: weights,
                outside_identified_domain: false,
                gains,
                operating_reference_rpm,
                integral_rpm: initial_rpm - operating_reference_rpm,
                integral_rate_rpm_per_s: 0.0,
                unsaturated_rpm: initial_rpm,
                command_rpm: initial_rpm,
                integral_frozen: true,
            },
        })
    }

    pub fn diagnostics(&self) -> &ContainerSpeedDiagnostics {
        &self.diagnostics
    }

    pub fn validate_input(
        &self,
        input: &ContainerSpeedInput,
        maximum_rpm: f64,
    ) -> Result<(), String> {
        input.validate(maximum_rpm)?;
        if self.models != input.models {
            return Err("本次运行的三个辨识模型和工作点已冻结".into());
        }
        Ok(())
    }

    pub fn step(
        &mut self,
        input: &ContainerSpeedInput,
        target_mps: f64,
        water_speed: Option<f64>,
        ground_speed: Option<f64>,
        maximum_rpm: f64,
    ) -> Result<f64, String> {
        self.validate_input(input, maximum_rpm)?;
        if !target_mps.is_finite()
            || !(6.0..=12.0).contains(&target_mps)
            || water_speed
                .into_iter()
                .chain(ground_speed)
                .any(|value| !value.is_finite())
        {
            return Err("集装箱速度给定或测量无效".into());
        }
        let mut next = self.clone();
        let d = &mut next.diagnostics;
        d.requested_reference_mps = target_mps;
        d.slewed_reference_mps +=
            (target_mps - d.slewed_reference_mps).clamp(-0.05 * CONTROL_DT_S, 0.05 * CONTROL_DT_S);
        let filter = |previous: Option<f64>, value: f64| {
            value + (previous.unwrap_or(value) - value) * (-CONTROL_DT_S / input.filter_tau_s).exp()
        };
        if let Some(value) = water_speed {
            d.filtered_water_speed_mps = Some(filter(d.filtered_water_speed_mps, value));
        }
        if next.previous_feedback != input.feedback {
            d.filtered_feedback_mps = None;
        }
        let measurement = match input.feedback {
            SpeedFeedback::Water => water_speed,
            SpeedFeedback::Ground => ground_speed,
        };
        if let Some(measurement) = measurement.filter(|_| water_speed.is_some()) {
            let feedback = filter(d.filtered_feedback_mps, measurement);
            let (weights, outside) = if input.scheduling_enabled {
                schedule_weights(
                    &next.models,
                    next.loading_ratio,
                    d.filtered_water_speed_mps.unwrap_or(8.0),
                )
            } else {
                let mut weights = [0.0; 3];
                weights[input.fixed_model_index] = 1.0;
                (weights, false)
            };
            let (gains, reference_rpm) = input.gains_at(weights)?;
            let error = d.slewed_reference_mps - feedback;
            if input.bumpless {
                d.integral_rpm += d.operating_reference_rpm - reference_rpm
                    + (d.gains.kp_rpm_per_mps - gains.kp_rpm_per_mps) * error;
                if d.ticks == 0 {
                    d.integral_rpm = d.command_rpm - reference_rpm - gains.kp_rpm_per_mps * error;
                }
            }
            d.unsaturated_rpm = reference_rpm + gains.kp_rpm_per_mps * error + d.integral_rpm;
            d.command_rpm = d.unsaturated_rpm.clamp(-maximum_rpm, maximum_rpm);
            d.integral_rate_rpm_per_s = gains.kp_rpm_per_mps / gains.ti_s * error
                + if input.anti_windup {
                    (d.command_rpm - d.unsaturated_rpm) / gains.tracking_time_s
                } else {
                    0.0
                };
            d.integral_rpm += CONTROL_DT_S * d.integral_rate_rpm_per_s;
            d.filtered_feedback_mps = Some(feedback);
            d.error_mps = error;
            d.model_weights = weights;
            d.outside_identified_domain = outside;
            d.gains = gains;
            d.operating_reference_rpm = reference_rpm;
            d.integral_frozen = false;
        } else {
            d.integral_frozen = true;
            d.integral_rate_rpm_per_s = 0.0;
        }
        next.previous_feedback = input.feedback;
        next.diagnostics.ticks = next
            .diagnostics
            .ticks
            .checked_add(1)
            .ok_or("集装箱控制时钟溢出")?;
        next.validate_checkpoint(maximum_rpm, next.diagnostics.ticks)?;
        let command = next.diagnostics.command_rpm;
        *self = next;
        Ok(command)
    }

    pub fn validate_checkpoint(&self, maximum_rpm: f64, maximum_ticks: u64) -> Result<(), String> {
        for (index, model) in self.models.iter().enumerate() {
            let point = &model.operating_model;
            if !model.loading_ratio.is_finite()
                || !(0.2..=0.9).contains(&model.loading_ratio)
                || !point.speed_mps.is_finite()
                || !(6.0..=12.0).contains(&point.speed_mps)
                || !point.shaft_reference_rpm.is_finite()
                || point.shaft_reference_rpm.abs() > maximum_rpm
                || self.models[..index].iter().any(|other| {
                    other.loading_ratio == model.loading_ratio
                        && other.operating_model.speed_mps == point.speed_mps
                })
            {
                return Err("冻结调度模型恢复点无效".into());
            }
            imc_pi_gains(&point.structure, 1.0, 1.0)?;
        }
        let d = &self.diagnostics;
        let values = [
            self.loading_ratio,
            d.requested_reference_mps,
            d.slewed_reference_mps,
            d.error_mps,
            d.integral_rpm,
            d.integral_rate_rpm_per_s,
            d.unsaturated_rpm,
            d.command_rpm,
            d.gains.kp_rpm_per_mps,
            d.gains.ti_s,
            d.gains.lambda_s,
            d.gains.tracking_time_s,
            d.operating_reference_rpm,
        ];
        if values
            .iter()
            .chain(d.model_weights.iter())
            .any(|value| !value.is_finite())
            || [d.filtered_water_speed_mps, d.filtered_feedback_mps]
                .into_iter()
                .flatten()
                .any(|value| !value.is_finite())
            || !(0.2..=0.9).contains(&self.loading_ratio)
            || !(6.0..=12.0).contains(&d.slewed_reference_mps)
            || !(6.0..=12.0).contains(&d.requested_reference_mps)
            || d.command_rpm.abs() > maximum_rpm
            || d.ticks > maximum_ticks
            || d.gains.ti_s <= 0.0
            || d.gains.lambda_s <= 0.0
            || (d.gains.tracking_time_s - d.gains.ti_s / 5.0).abs() > 1e-10
            || d.model_weights
                .iter()
                .any(|weight| *weight < 0.0 || *weight > 1.0)
            || (d.model_weights.iter().sum::<f64>() - 1.0).abs() > 1e-10
        {
            return Err("集装箱调度控制恢复点无效".into());
        }
        Ok(())
    }

    pub fn loading_ratio(&self) -> f64 {
        self.loading_ratio
    }
}
