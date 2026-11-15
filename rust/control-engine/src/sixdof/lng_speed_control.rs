//! LNG局部航速模型的IMC PI与给定Smith结构，输出单位为rpm。

use super::student_model::{predict, ModelStructure};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

pub const CONTROL_DT_S: f64 = 0.05;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeedOperatingModel {
    /// FOPDT的k使用(m/s)/rpm，t_s和delay_s使用秒。
    pub structure: ModelStructure,
    pub speed_mps: f64,
    pub shaft_reference_rpm: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeedPiInput {
    pub local_model: SpeedOperatingModel,
    pub reference_mps: f64,
    pub kp_multiplier: f64,
    pub ti_multiplier: f64,
    pub anti_windup: bool,
    pub smith_enabled: bool,
    pub filter_tau_s: f64,
    pub additional_command_delay_s: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImcPiGains {
    pub kp_rpm_per_mps: f64,
    pub ti_s: f64,
    pub lambda_s: f64,
    pub tracking_time_s: f64,
}

fn fopdt(model: &ModelStructure) -> Result<(f64, f64, f64), String> {
    match *model {
        ModelStructure::Fopdt { k, t_s, delay_s }
            if [k, t_s, delay_s].iter().all(|x| x.is_finite())
                && k != 0.0
                && t_s > 0.0
                && delay_s >= 0.0 =>
        {
            Ok((k, t_s, delay_s))
        }
        _ => Err("航速控制需要有效的局部一阶时延模型，增益单位为每rpm的米每秒".into()),
    }
}

pub(crate) fn imc_pi_gains(model: &ModelStructure, kp_multiplier: f64, ti_multiplier: f64) -> Result<ImcPiGains, String> {
    let (gain, time_constant, delay) = fopdt(model)?;
    let lambda = (time_constant / 3.0).max(3.0 * delay).max(5.0);
    let ti = time_constant * ti_multiplier;
    let gains = ImcPiGains {
        kp_rpm_per_mps: time_constant / (gain * (lambda + delay)) * kp_multiplier,
        ti_s: ti,
        lambda_s: lambda,
        tracking_time_s: ti / 5.0,
    };
    if [
        gains.kp_rpm_per_mps,
        gains.ti_s,
        gains.lambda_s,
        gains.tracking_time_s,
    ]
    .iter()
    .any(|x| !x.is_finite())
        || gains.ti_s <= 0.0
        || gains.tracking_time_s <= 0.0
    {
        return Err("IMC航速控制参数超出有限数值范围".into());
    }
    Ok(gains)
}

impl SpeedPiInput {
    pub fn gains(&self) -> Result<ImcPiGains, String> {
        imc_pi_gains(&self.local_model.structure, self.kp_multiplier, self.ti_multiplier)
    }

    pub fn validate(&self, maximum_rpm: f64) -> Result<(), String> {
        if [
            self.reference_mps,
            self.local_model.speed_mps,
            self.local_model.shaft_reference_rpm,
            self.kp_multiplier,
            self.ti_multiplier,
            self.filter_tau_s,
            self.additional_command_delay_s,
            maximum_rpm,
        ]
        .iter()
        .any(|x| !x.is_finite())
            || maximum_rpm <= 0.0
            || self.local_model.shaft_reference_rpm.abs() > maximum_rpm
            || !(0.0..=4.0).contains(&self.reference_mps)
            || !(0.0..=4.0).contains(&self.local_model.speed_mps)
            || !(0.2..=3.0).contains(&self.kp_multiplier)
            || !(0.3..=3.0).contains(&self.ti_multiplier)
            || self.filter_tau_s <= 0.0
            || ![0.0, 5.0].contains(&self.additional_command_delay_s)
        {
            return Err("航速参考、PI范围、滤波或0/5秒命令时延无效".into());
        }
        self.gains()?;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeedControlDiagnostics {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference_mps: Option<f64>,
    pub ticks: u64,
    pub gains: ImcPiGains,
    pub filtered_measurement_mps: Option<f64>,
    pub feedback_mps: Option<f64>,
    pub model_without_delay_delta_mps: f64,
    pub model_with_delay_delta_mps: f64,
    pub error_mps: f64,
    pub integral_rpm: f64,
    pub integral_rate_rpm_per_s: f64,
    pub unsaturated_rpm: f64,
    pub requested_rpm: f64,
    pub applied_rpm: f64,
    pub feedback_available: bool,
    pub integral_frozen: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LngSpeedController {
    local_model: SpeedOperatingModel,
    additional_command_delay_s: f64,
    requested_history_delta_rpm: VecDeque<f64>,
    command_delay_queue_rpm: VecDeque<f64>,
    diagnostics: SpeedControlDiagnostics,
}

impl LngSpeedController {
    pub fn new(
        input: &SpeedPiInput,
        initial_reference_rpm: f64,
        maximum_rpm: f64,
    ) -> Result<Self, String> {
        input.validate(maximum_rpm)?;
        if !initial_reference_rpm.is_finite() || initial_reference_rpm.abs() > maximum_rpm {
            return Err("航速控制初始轴速参考无效".into());
        }
        Ok(Self {
            local_model: input.local_model.clone(),
            additional_command_delay_s: input.additional_command_delay_s,
            requested_history_delta_rpm: VecDeque::new(),
            command_delay_queue_rpm: VecDeque::new(),
            diagnostics: SpeedControlDiagnostics {
                reference_mps: Some(input.reference_mps),
                ticks: 0,
                gains: input.gains()?,
                filtered_measurement_mps: None,
                feedback_mps: None,
                model_without_delay_delta_mps: 0.0,
                model_with_delay_delta_mps: 0.0,
                error_mps: 0.0,
                integral_rpm: 0.0,
                integral_rate_rpm_per_s: 0.0,
                unsaturated_rpm: initial_reference_rpm,
                requested_rpm: initial_reference_rpm,
                applied_rpm: initial_reference_rpm,
                feedback_available: false,
                integral_frozen: true,
            },
        })
    }

    pub fn diagnostics(&self) -> &SpeedControlDiagnostics {
        &self.diagnostics
    }

    pub fn validate_input(&self, input: &SpeedPiInput, maximum_rpm: f64) -> Result<(), String> {
        input.validate(maximum_rpm)?;
        if input.local_model != self.local_model
            || input.additional_command_delay_s != self.additional_command_delay_s
        {
            return Err("本次运行的局部模型、工作点或命令时延已冻结，修改后需要开始新运行".into());
        }
        Ok(())
    }

    fn model_delay_steps(&self) -> usize {
        let (_, _, delay) = fopdt(&self.local_model.structure).expect("已校验局部模型");
        // 与StudentModel::predict的固定采样时延约定一致。
        ((delay + self.additional_command_delay_s) / CONTROL_DT_S).round() as usize
    }

    fn advance_models(&mut self) {
        if self.diagnostics.ticks == 0 {
            return;
        }
        let (gain, time_constant, _) = fopdt(&self.local_model.structure).expect("已校验局部模型");
        let model = ModelStructure::Fopdt {
            k: gain,
            t_s: time_constant,
            delay_s: 0.0,
        };
        let latest = self
            .requested_history_delta_rpm
            .back()
            .copied()
            .unwrap_or(0.0);
        let delayed = self
            .requested_history_delta_rpm
            .len()
            .checked_sub(self.model_delay_steps().saturating_add(1))
            .and_then(|index| self.requested_history_delta_rpm.get(index))
            .copied()
            .unwrap_or(0.0);
        self.diagnostics.model_without_delay_delta_mps = predict(
            &model,
            &[latest],
            self.diagnostics.model_without_delay_delta_mps,
            CONTROL_DT_S,
        )[1];
        self.diagnostics.model_with_delay_delta_mps = predict(
            &model,
            &[delayed],
            self.diagnostics.model_with_delay_delta_mps,
            CONTROL_DT_S,
        )[1];
    }

    pub fn step(
        &mut self,
        input: &SpeedPiInput,
        measurement_mps: Option<f64>,
        maximum_rpm: f64,
    ) -> Result<f64, String> {
        self.validate_input(input, maximum_rpm)?;
        if measurement_mps.is_some_and(|x| !x.is_finite()) {
            return Err("航速测量无效".into());
        }
        let mut next = self.clone();
        next.diagnostics.reference_mps = Some(input.reference_mps);
        next.advance_models();
        let gains = input.gains()?;
        if let Some(measurement) = measurement_mps {
            let decay = (-CONTROL_DT_S / input.filter_tau_s).exp();
            let filtered = next
                .diagnostics
                .filtered_measurement_mps
                .map_or(measurement, |previous| {
                    decay * previous + (1.0 - decay) * measurement
                });
            let feedback = filtered
                + if input.smith_enabled {
                    next.diagnostics.model_without_delay_delta_mps
                        - next.diagnostics.model_with_delay_delta_mps
                } else {
                    0.0
                };
            if next.diagnostics.ticks > 0
                && gains.kp_rpm_per_mps != next.diagnostics.gains.kp_rpm_per_mps
            {
                next.diagnostics.integral_rpm += (next.diagnostics.gains.kp_rpm_per_mps
                    - gains.kp_rpm_per_mps)
                    * next.diagnostics.error_mps;
            }
            let error = input.reference_mps - feedback;
            let unsaturated = self.local_model.shaft_reference_rpm
                + gains.kp_rpm_per_mps * error
                + next.diagnostics.integral_rpm;
            let requested = unsaturated.clamp(-maximum_rpm, maximum_rpm);
            let tracking = if input.anti_windup {
                (requested - unsaturated) / gains.tracking_time_s
            } else {
                0.0
            };
            let integral_rate = gains.kp_rpm_per_mps / gains.ti_s * error + tracking;
            next.diagnostics.filtered_measurement_mps = Some(filtered);
            next.diagnostics.feedback_mps = Some(feedback);
            next.diagnostics.error_mps = error;
            next.diagnostics.unsaturated_rpm = unsaturated;
            next.diagnostics.requested_rpm = requested;
            next.diagnostics.integral_rate_rpm_per_s = integral_rate;
            next.diagnostics.integral_rpm += CONTROL_DT_S * integral_rate;
            next.diagnostics.feedback_available = true;
            next.diagnostics.integral_frozen = false;
            next.diagnostics.gains = gains;
        } else {
            next.diagnostics.feedback_mps = None;
            next.diagnostics.feedback_available = false;
            next.diagnostics.integral_frozen = true;
            next.diagnostics.integral_rate_rpm_per_s = 0.0;
        }
        next.command_delay_queue_rpm
            .push_back(next.diagnostics.requested_rpm);
        let command_steps = (self.additional_command_delay_s / CONTROL_DT_S).round() as usize;
        if next.command_delay_queue_rpm.len() > command_steps {
            next.diagnostics.applied_rpm = next
                .command_delay_queue_rpm
                .pop_front()
                .expect("命令队列已有到达项");
        }
        next.requested_history_delta_rpm
            .push_back(next.diagnostics.requested_rpm - self.local_model.shaft_reference_rpm);
        if next.requested_history_delta_rpm.len() > next.model_delay_steps().saturating_add(1) {
            next.requested_history_delta_rpm.pop_front();
        }
        next.diagnostics.ticks = next
            .diagnostics
            .ticks
            .checked_add(1)
            .ok_or("航速控制时钟溢出")?;
        next.validate_checkpoint(maximum_rpm, next.diagnostics.ticks)?;
        let applied = next.diagnostics.applied_rpm;
        *self = next;
        Ok(applied)
    }

    pub fn validate_checkpoint(&self, maximum_rpm: f64, maximum_ticks: u64) -> Result<(), String> {
        let d = &self.diagnostics;
        let values = [
            d.model_without_delay_delta_mps,
            d.model_with_delay_delta_mps,
            d.error_mps,
            d.integral_rpm,
            d.integral_rate_rpm_per_s,
            d.unsaturated_rpm,
            d.requested_rpm,
            d.applied_rpm,
            d.gains.kp_rpm_per_mps,
            d.gains.ti_s,
            d.gains.lambda_s,
            d.gains.tracking_time_s,
        ];
        let (gain, time_constant, delay) = fopdt(&self.local_model.structure)?;
        let expected_lambda = (time_constant / 3.0).max(3.0 * delay).max(5.0);
        let kp_multiplier =
            d.gains.kp_rpm_per_mps * gain * (expected_lambda + delay) / time_constant;
        let ti_multiplier = d.gains.ti_s / time_constant;
        let ticks = usize::try_from(d.ticks).unwrap_or(usize::MAX);
        let history_length = ticks.min(self.model_delay_steps().saturating_add(1));
        let queue_length =
            ticks.min((self.additional_command_delay_s / CONTROL_DT_S).round() as usize);
        if values.iter().any(|x| !x.is_finite())
            || !maximum_rpm.is_finite()
            || maximum_rpm <= 0.0
            || d.filtered_measurement_mps.is_some_and(|x| !x.is_finite())
            || d.feedback_mps.is_some_and(|x| !x.is_finite())
            || self
                .requested_history_delta_rpm
                .iter()
                .chain(&self.command_delay_queue_rpm)
                .any(|x| !x.is_finite())
            || self
                .requested_history_delta_rpm
                .iter()
                .any(|x| (x + self.local_model.shaft_reference_rpm).abs() > maximum_rpm + 1e-10)
            || self
                .command_delay_queue_rpm
                .iter()
                .any(|x| x.abs() > maximum_rpm)
            || ![0.0, 5.0].contains(&self.additional_command_delay_s)
            || d.requested_rpm.abs() > maximum_rpm
            || d.applied_rpm.abs() > maximum_rpm
            || d.ticks > maximum_ticks
            || self.requested_history_delta_rpm.len() != history_length
            || self.command_delay_queue_rpm.len() != queue_length
            || d.gains.ti_s <= 0.0
            || d.gains.tracking_time_s <= 0.0
            || (d.gains.lambda_s - expected_lambda).abs() > 1e-10 * expected_lambda
            || (d.gains.tracking_time_s - d.gains.ti_s / 5.0).abs() > 1e-10 * d.gains.ti_s
            || !(0.2 - 1e-10..=3.0 + 1e-10).contains(&kp_multiplier)
            || !(0.3 - 1e-10..=3.0 + 1e-10).contains(&ti_multiplier)
            || !self.local_model.speed_mps.is_finite()
            || !(0.0..=4.0).contains(&self.local_model.speed_mps)
            || !self.local_model.shaft_reference_rpm.is_finite()
            || self.local_model.shaft_reference_rpm.abs() > maximum_rpm
            || d.feedback_available != d.feedback_mps.is_some()
            || d.integral_frozen == d.feedback_available
        {
            return Err("航速控制恢复点的数值、命令或时钟不一致".into());
        }
        Ok(())
    }
}
