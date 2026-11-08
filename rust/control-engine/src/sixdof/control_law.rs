//! 航向控制律（destroyer_hifi 与 sixdof_vessel 共用，#2147 统一控制路径）。
//!
//! 合同：P/PD/PID 舵令按最短圆周角误差计算，跨 ±180° 边界的误差不得放大成
//! 360°；积分项仅在 PID 模式累积并限幅；微分默认对误差差分；舵令限幅只作用
//! 于执行器命令。控制状态（积分/前值误差）由调用方逐帧往返。

use serde::Deserialize;

/// PID 增益（deg 口径：误差 deg、积分 deg·s、微分 deg/s → 舵令 deg）。
#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct HeadingPidGains {
    pub kp: f64,
    #[serde(default)]
    pub ki: f64,
    #[serde(default)]
    pub kd: f64,
}

/// 控制模式。serde 小写：manual / p / pd / pid。
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
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
