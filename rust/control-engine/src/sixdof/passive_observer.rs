//! Fossen–Strand低频/波频/慢变偏置观测器。
//!
//! 独立实现Torsetnes/Jouffroy/Fossen(2004)式(29)–(34)、(51)–(53)，
//! 偏置加入1000s衰减。输入为合法位置/航向测量及已知控制载荷。
//! 参数与独立矩阵指数对照见docs/research/passive-observer。

use super::integrator::{IntegrationError, NOMINAL_DT, rk4_step};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PassiveObserverParameters {
    pub mass_diagonal: [f64; 3],
    pub damping_diagonal: [f64; 3],
    pub wave_frequency_rad_s: f64,
}

impl PassiveObserverParameters {
    pub fn validate(&self) -> Result<(), String> {
        if self
            .mass_diagonal
            .iter()
            .any(|value| !value.is_finite() || *value <= 0.0)
            || self
                .damping_diagonal
                .iter()
                .any(|value| !value.is_finite() || *value < 0.0)
            || !self.wave_frequency_rad_s.is_finite()
            || self.wave_frequency_rad_s <= 0.05
        {
            return Err("观测器质量、阻尼或波频配置无效".into());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PassiveObserver {
    pub parameters: PassiveObserverParameters,
    pub position_heading: [f64; 3],
    pub body_velocity: [f64; 3],
    pub wave_integral: [f64; 3],
    pub wave_motion: [f64; 3],
    pub bias_earth: [f64; 3],
}

impl PassiveObserver {
    pub fn new(parameters: PassiveObserverParameters) -> Result<Self, String> {
        parameters.validate()?;
        Ok(Self {
            parameters,
            position_heading: [0.0; 3],
            body_velocity: [0.0; 3],
            wave_integral: [0.0; 3],
            wave_motion: [0.0; 3],
            bias_earth: [0.0; 3],
        })
    }

    /// 固定物理步推进。缺失轴的新息为零，预测与其余合法测量继续运行。
    pub fn step(
        &mut self,
        dt: f64,
        measurement: [Option<f64>; 3],
        commanded_load_body: [f64; 3],
    ) -> Result<(), IntegrationError> {
        if !dt.is_finite() || dt <= 0.0 || dt > NOMINAL_DT + 1e-12 {
            return Err(IntegrationError::InvalidTimeStep { dt_s: dt });
        }
        self.parameters
            .validate()
            .map_err(IntegrationError::InvalidActuatorCommand)?;
        if measurement
            .iter()
            .flatten()
            .chain(commanded_load_body.iter())
            .any(|value| !value.is_finite())
        {
            return Err(IntegrationError::InvalidActuatorCommand(
                "观测器输入含非有限值".into(),
            ));
        }
        let mut state = [0.0; 15];
        for (target, source) in state.chunks_exact_mut(3).zip([
            self.wave_integral,
            self.wave_motion,
            self.position_heading,
            self.bias_earth,
            self.body_velocity,
        ]) {
            target.copy_from_slice(&source);
        }
        let p = &self.parameters;
        let omega = p.wave_frequency_rad_s;
        let damping = 0.1;
        let desired_damping = 1.0;
        let cutoff_ratio = 1.1;
        let k11 = -2.0 * (desired_damping - damping) * cutoff_ratio;
        let k12 = 2.0 * (desired_damping - damping) * omega;
        let k2 = cutoff_ratio * omega;
        // 世界水平面两增益相等，满足与偏航旋转矩阵可交换的条件。
        let horizontal_mass = (p.mass_diagonal[0] + p.mass_diagonal[1]) / 2.0;
        let gain_mass = [horizontal_mass, horizontal_mass, p.mass_diagonal[2]];
        rk4_step(0.0, &mut state, dt, |_, state, rates| {
            let (sin_psi, cos_psi) = state[8].sin_cos();
            let rotate_to_world = |value: [f64; 3]| {
                [
                    cos_psi * value[0] - sin_psi * value[1],
                    sin_psi * value[0] + cos_psi * value[1],
                    value[2],
                ]
            };
            let rotate_to_body = |value: [f64; 3]| {
                [
                    cos_psi * value[0] + sin_psi * value[1],
                    -sin_psi * value[0] + cos_psi * value[1],
                    value[2],
                ]
            };
            let mut innovation = [0.0; 3];
            for axis in 0..3 {
                if let Some(value) = measurement[axis] {
                    let error = value - state[6 + axis] - state[3 + axis];
                    innovation[axis] = if axis == 2 { wrap_pi(error) } else { error };
                }
            }
            let motion = rotate_to_world([state[12], state[13], state[14]]);
            let body_bias = rotate_to_body([state[9], state[10], state[11]]);
            let body_correction = rotate_to_body(std::array::from_fn(|axis| {
                0.04 * gain_mass[axis] * innovation[axis]
            }));
            for axis in 0..3 {
                rates[axis] = state[3 + axis] + k11 * innovation[axis];
                rates[3 + axis] = -omega.powi(2) * state[axis]
                    - 2.0 * damping * omega * state[3 + axis]
                    + k12 * innovation[axis];
                rates[6 + axis] = motion[axis] + k2 * innovation[axis];
                rates[9 + axis] =
                    -state[9 + axis] / 1000.0 + 0.002 * gain_mass[axis] * innovation[axis];
                rates[12 + axis] = (-p.damping_diagonal[axis] * state[12 + axis]
                    + commanded_load_body[axis]
                    + body_bias[axis]
                    + body_correction[axis])
                    / p.mass_diagonal[axis];
            }
        })?;
        self.wave_integral.copy_from_slice(&state[..3]);
        self.wave_motion.copy_from_slice(&state[3..6]);
        self.position_heading.copy_from_slice(&state[6..9]);
        self.position_heading[2] = wrap_pi(self.position_heading[2]);
        self.bias_earth.copy_from_slice(&state[9..12]);
        self.body_velocity.copy_from_slice(&state[12..15]);
        Ok(())
    }
}

pub fn wrap_pi(angle: f64) -> f64 {
    (angle + std::f64::consts::PI).rem_euclid(2.0 * std::f64::consts::PI) - std::f64::consts::PI
}
