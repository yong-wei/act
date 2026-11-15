//! 航向控制律（destroyer_hifi 与 sixdof_vessel 共用，#2147 统一控制路径）。
//!
//! 合同：P/PD/PID 舵令按最短圆周角误差计算，跨 ±180° 边界的误差不得放大成
//! 360°。常驻会话采用测量微分、低通滤波和积分回算，保留可检查状态。
//! 旧式误差微分入口继续承载既有调用与旧恢复点。

use serde::Deserialize;

/// PID 增益（deg 口径：误差 deg、积分 deg·s、微分 deg/s → 舵令 deg）。
#[derive(Clone, Copy, Debug, Default, Deserialize, serde::Serialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct HeadingPidGains {
    pub kp: f64,
    #[serde(default)]
    pub ki: f64,
    #[serde(default)]
    pub kd: f64,
}

#[derive(Clone, Copy, Debug, Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IceHeadingSchedule {
    pub ice_gains: HeadingPidGains,
    pub declared_thickness_m: f64,
}

impl IceHeadingSchedule {
    /// 仅按已声明冰厚在两份局部模型间插值，物理闭环与独立预测共用。
    pub fn gains(&self, open_water: HeadingPidGains) -> HeadingPidGains {
        let weight = (self.declared_thickness_m / 0.6).clamp(0.0, 1.0);
        HeadingPidGains {
            kp: open_water.kp + (self.ice_gains.kp - open_water.kp) * weight,
            ki: open_water.ki + (self.ice_gains.ki - open_water.ki) * weight,
            kd: open_water.kd + (self.ice_gains.kd - open_water.kd) * weight,
        }
    }
}

/// 控制模式。serde 小写：manual / p / pd / pid。
#[derive(Clone, Copy, Debug, Deserialize, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HeadingControlMode {
    Manual,
    P,
    Pd,
    Pid,
}

/// 控制律输出：舵令 + 需要往返的控制状态。
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct HeadingControlOutput {
    /// 舵令（deg，已限幅）。
    pub rudder_deg: f64,
    /// 积分累积（deg·s；manual/PD/P 恒 0）。
    pub integral_deg_s: f64,
    /// 本帧误差（deg，wrap 后），供下帧微分。
    pub error_deg: f64,
}

/// 最短圆周角归一化（跨 ±180° 边界的小误差不得放大成 360°）。
pub fn wrap_180(deg: f64) -> f64 {
    let mut value = deg;
    while value > 180.0 {
        value -= 360.0;
    }
    while value < -180.0 {
        value += 360.0;
    }
    value
}

/// 舵令限幅默认（055 舵限 35°；调用方可传 per-vessel 限幅）。
pub const DEFAULT_RUDDER_LIMIT_DEG: f64 = 35.0;

pub const DEFAULT_DERIVATIVE_FILTER_TAU_S: f64 = 0.2;
pub const INTEGRAL_TRACKING_TIME_S: f64 = 1.0;

#[derive(Clone, Copy, Debug, serde::Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeadingIntegralTracking {
    pub enabled: bool,
    pub time_s: f64,
}

impl Default for HeadingIntegralTracking {
    fn default() -> Self { Self { enabled: true, time_s: INTEGRAL_TRACKING_TIME_S } }
}

/// 常驻20Hz反馈状态，积分以实际舵令贡献保存，允许Ki为零。
#[derive(Clone, Debug, PartialEq, serde::Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeadingFeedbackController {
    pub integral_output_deg: f64,
    pub derivative_deg_s: f64,
    pub previous_measurement_deg: Option<f64>,
    pub previous_measurement_time_s: Option<f64>,
    pub error_deg: f64,
    pub unsaturated_deg: f64,
    pub command_deg: f64,
    pub integral_rate_deg_s: f64,
    pub integral_frozen: bool,
    pub feedback_available: bool,
}

impl Default for HeadingFeedbackController {
    fn default() -> Self {
        Self {
            integral_output_deg: 0.0,
            derivative_deg_s: 0.0,
            previous_measurement_deg: None,
            previous_measurement_time_s: None,
            error_deg: 0.0,
            unsaturated_deg: 0.0,
            command_deg: 0.0,
            integral_rate_deg_s: 0.0,
            integral_frozen: true,
            feedback_available: false,
        }
    }
}

impl HeadingFeedbackController {
    pub fn validate_checkpoint(&self, time_s: f64) -> Result<(), String> {
        let numbers = [
            self.integral_output_deg,
            self.derivative_deg_s,
            self.error_deg,
            self.unsaturated_deg,
            self.command_deg,
            self.integral_rate_deg_s,
        ];
        if numbers.iter().any(|value| !value.is_finite())
            || self.previous_measurement_deg.is_some() != self.previous_measurement_time_s.is_some()
            || self.previous_measurement_deg.is_some_and(|value| !value.is_finite())
            || self.previous_measurement_time_s.is_some_and(|value| !value.is_finite() || value < 0.0 || value > time_s)
            || self.command_deg.abs() > DEFAULT_RUDDER_LIMIT_DEG
        {
            return Err("航向反馈状态或采样时间无效".into());
        }
        Ok(())
    }

    pub fn step(
        &mut self,
        mode: HeadingControlMode,
        gains: &HeadingPidGains,
        target_deg: f64,
        measurement_deg: Option<f64>,
        time_s: f64,
        dt_s: f64,
        derivative_filter_tau_s: f64,
    ) -> Result<f64, String> {
        self.step_with_tracking(mode, gains, target_deg, measurement_deg, time_s, dt_s,
            derivative_filter_tau_s, HeadingIntegralTracking::default())
    }

    pub fn step_with_tracking(
        &mut self,
        mode: HeadingControlMode,
        gains: &HeadingPidGains,
        target_deg: f64,
        measurement_deg: Option<f64>,
        time_s: f64,
        dt_s: f64,
        derivative_filter_tau_s: f64,
        tracking: HeadingIntegralTracking,
    ) -> Result<f64, String> {
        if [
            gains.kp, gains.ki, gains.kd, target_deg, time_s, dt_s, derivative_filter_tau_s, tracking.time_s,
        ].iter().any(|value| !value.is_finite())
            || time_s < 0.0 || dt_s <= 0.0 || derivative_filter_tau_s < 0.0 || tracking.time_s <= 0.0
        {
            return Err("航向控制参数或时钟无效".into());
        }
        if mode == HeadingControlMode::Manual {
            *self = Self::default();
            return Ok(0.0);
        }
        let Some(measurement_deg) = measurement_deg else {
            self.integral_frozen = true;
            self.feedback_available = false;
            self.integral_rate_deg_s = 0.0;
            return Ok(self.command_deg);
        };
        if !measurement_deg.is_finite() {
            return Err("航向测量无效".into());
        }
        let mut next = self.clone();
        next.error_deg = wrap_180(target_deg % 360.0 - measurement_deg % 360.0);
        let derivative_enabled = matches!(mode, HeadingControlMode::Pd | HeadingControlMode::Pid);
        next.derivative_deg_s = if derivative_enabled {
            match (self.previous_measurement_deg, self.previous_measurement_time_s) {
                (Some(previous), Some(previous_time)) if time_s > previous_time => {
                    let rate = wrap_180(measurement_deg % 360.0 - previous % 360.0) / (time_s - previous_time);
                    let decay = if derivative_filter_tau_s == 0.0 { 0.0 }
                        else { (-dt_s / derivative_filter_tau_s).exp() };
                    decay * self.derivative_deg_s + (1.0 - decay) * rate
                }
                (None, None) => 0.0,
                _ => return Err("航向反馈时间没有前进".into()),
            }
        } else {
            0.0
        };
        next.integral_frozen = mode != HeadingControlMode::Pid || gains.ki == 0.0;
        let integral = if next.integral_frozen { 0.0 } else { self.integral_output_deg };
        let derivative = if derivative_enabled { gains.kd * next.derivative_deg_s } else { 0.0 };
        next.unsaturated_deg = gains.kp * next.error_deg + integral - derivative;
        next.command_deg = next.unsaturated_deg.clamp(-DEFAULT_RUDDER_LIMIT_DEG, DEFAULT_RUDDER_LIMIT_DEG);
        next.integral_rate_deg_s = if next.integral_frozen {
            0.0
        } else {
            let correction = if tracking.enabled { (next.command_deg - next.unsaturated_deg) / tracking.time_s } else { 0.0 };
            gains.ki * next.error_deg + correction
        };
        next.integral_output_deg = integral + dt_s * next.integral_rate_deg_s;
        next.previous_measurement_deg = Some(measurement_deg);
        next.previous_measurement_time_s = Some(time_s);
        next.feedback_available = true;
        next.validate_checkpoint(time_s)?;
        *self = next;
        Ok(self.command_deg)
    }
}

/// 积分限幅（deg·s）。
const INTEGRAL_LIMIT_DEG_S: f64 = 80.0;

/// PID/PD/P 舵令（deg，含积分/微分状态推进）。
///
/// `integral_in`/`prev_error_in` 为上一帧输出（往返）；`rudder_limit_deg`
/// 为执行器舵限（正数）。
pub fn command_rudder_deg(
    mode: HeadingControlMode,
    gains: &HeadingPidGains,
    target_heading_deg: f64,
    heading_deg: f64,
    manual_rudder_deg: f64,
    dt_s: f64,
    integral_in: f64,
    prev_error_in: f64,
    rudder_limit_deg: f64,
) -> HeadingControlOutput {
    if mode == HeadingControlMode::Manual {
        // 直通不限幅：执行器物理层按舵限/速率限自限（与 hifi 行为一致）。
        return HeadingControlOutput {
            rudder_deg: manual_rudder_deg,
            integral_deg_s: 0.0,
            error_deg: 0.0,
        };
    }
    let error_deg = wrap_180(target_heading_deg - heading_deg);
    let integral = if mode == HeadingControlMode::Pid {
        (integral_in + error_deg * dt_s).clamp(-INTEGRAL_LIMIT_DEG_S, INTEGRAL_LIMIT_DEG_S)
    } else {
        0.0
    };
    let derivative = if dt_s > 1e-9 {
        (error_deg - prev_error_in) / dt_s
    } else {
        0.0
    };
    let ki = if mode == HeadingControlMode::Pid { gains.ki } else { 0.0 };
    let kd = if matches!(mode, HeadingControlMode::Pd | HeadingControlMode::Pid) {
        gains.kd
    } else {
        0.0
    };
    let rudder = (gains.kp * error_deg + ki * integral + kd * derivative)
        .clamp(-rudder_limit_deg, rudder_limit_deg);
    HeadingControlOutput {
        rudder_deg: rudder,
        integral_deg_s: integral,
        error_deg,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wrap_180_crosses_boundary_shortest_arc() {
        assert!((wrap_180(170.0 - (-170.0)) - (-20.0)).abs() < 1e-12);
        assert!((wrap_180(350.0) - (-10.0)).abs() < 1e-12);
        assert!((wrap_180(-190.0) - 170.0).abs() < 1e-12);
    }

    #[test]
    fn p_mode_scales_wrapped_error() {
        // target 170 / heading -170 → 误差 -20（非 340）。
        let out = command_rudder_deg(
            HeadingControlMode::P,
            &HeadingPidGains { kp: 2.0, ki: 0.0, kd: 0.0 },
            170.0,
            -170.0,
            0.0,
            0.1,
            0.0,
            0.0,
            DEFAULT_RUDDER_LIMIT_DEG,
        );
        // kp=2 × (−20°) = −40°，超出 ±35 舵限 → 钳到 −35°。
        assert!((out.rudder_deg - (-35.0)).abs() < 1e-12);
        assert_eq!(out.integral_deg_s, 0.0);
    }

    #[test]
    fn pid_integral_accumulates_and_clamps() {
        let gains = HeadingPidGains { kp: 1.0, ki: 0.5, kd: 0.0 };
        let a = command_rudder_deg(
            HeadingControlMode::Pid, &gains, 10.0, 0.0, 0.0, 1.0, 0.0, 0.0, 35.0,
        );
        assert!((a.integral_deg_s - 10.0).abs() < 1e-12);
        let b = command_rudder_deg(
            HeadingControlMode::Pid, &gains, 10.0, 0.0, 0.0, 1.0, a.integral_deg_s, a.error_deg, 35.0,
        );
        assert!((b.integral_deg_s - 20.0).abs() < 1e-12);
        // 误差恒 100 → 积分最终钳在 ±80。
        let mut integral = 0.0;
        let mut prev = 0.0;
        for _ in 0..100 {
            let out = command_rudder_deg(
                HeadingControlMode::Pid, &gains, 100.0, 0.0, 0.0, 1.0, integral, prev, 35.0,
            );
            integral = out.integral_deg_s;
            prev = out.error_deg;
        }
        assert!((integral - 80.0).abs() < 1e-12);
    }

    #[test]
    fn manual_passthrough_unclamped() {
        let out = command_rudder_deg(
            HeadingControlMode::Manual, &HeadingPidGains::default(), 0.0, 0.0, 50.0, 0.1, 99.0, 99.0, 35.0,
        );
        assert_eq!(out.rudder_deg, 50.0, "直通值由执行器物理层限幅");
        assert_eq!(out.integral_deg_s, 0.0);
    }

    #[test]
    fn pd_derivative_term_applies() {
        let gains = HeadingPidGains { kp: 0.0, ki: 0.0, kd: 1.0 };
        let out = command_rudder_deg(
            HeadingControlMode::Pd, &gains, 10.0, 0.0, 0.0, 0.5, 0.0, 4.0, 35.0,
        );
        // 误差 10，前值 4 → 微分 (10-4)/0.5 = 12。
        assert!((out.rudder_deg - 12.0).abs() < 1e-12);
    }
}
