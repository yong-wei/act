//! 具有半正定残量和共同附加质量的六维被动辐射振子组。
//!
//! x_dot=z，z_dot=b^T nu_r-2 zeta omega z-omega²x，tau=b z。
//! 储能E=(z²+omega²x²)/2，端口功nu_r^T tau=E_dot+2 zeta omega z²。

use num_complex::Complex64;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadiationOscillator {
    pub natural_frequency_rad_s: f64,
    pub damping_ratio: f64,
    /// 平移分量单位sqrt(kg)/s，转动分量单位sqrt(kg)*m/s。
    pub coupling: [f64; 6],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PassiveRadiationModel {
    pub frequency_band_rad_s: [f64; 2],
    /// A_inf=sum(a a^T)，a的平移单位sqrt(kg)，转动单位sqrt(kg)*m。
    pub added_mass_factors: Vec<[f64; 6]>,
    pub oscillators: Vec<RadiationOscillator>,
}

fn rk4_amplification(pole: Complex64, dt: f64) -> f64 {
    let value = pole*dt;
    (Complex64::new(1.0, 0.0)+value+value.powu(2)/2.0
        +value.powu(3)/6.0+value.powu(4)/24.0).norm()
}

impl PassiveRadiationModel {
    pub fn validate(&self) -> Result<(), String> {
        let [minimum, maximum] = self.frequency_band_rad_s;
        if !minimum.is_finite() || !maximum.is_finite() || minimum <= 0.0 || maximum <= minimum
            || self.added_mass_factors.iter().flatten().any(|value| !value.is_finite())
            || self.oscillators.is_empty()
        {
            return Err("辐射频带、附加质量因子或振子数据无效".into());
        }
        for mode in &self.oscillators {
            let frequency = mode.natural_frequency_rad_s;
            let damping = mode.damping_ratio;
            if !frequency.is_finite() || frequency <= 0.0 || !damping.is_finite() || damping <= 0.0
                || mode.coupling.iter().any(|value| !value.is_finite())
            {
                return Err("辐射振子的频率、阻尼或耦合无效".into());
            }
            let root = Complex64::new(damping*damping-1.0, 0.0).sqrt();
            for pole in [frequency*(-damping+root), frequency*(-damping-root)] {
                let amplification = rk4_amplification(pole, super::integrator::NOMINAL_DT);
                if !pole.re.is_finite() || pole.re >= 0.0 || !amplification.is_finite() || amplification > 1.0 {
                    return Err("辐射极点超出固定步长稳定域".into());
                }
            }
        }
        Ok(())
    }

    pub fn added_mass(&self) -> [[f64; 6]; 6] {
        let mut matrix = [[0.0; 6]; 6];
        for factor in &self.added_mass_factors {
            for row in 0..6 {
                for column in 0..6 {
                    matrix[row][column] += factor[row]*factor[column];
                }
            }
        }
        matrix
    }

    pub fn state_len(&self) -> usize {
        2*self.oscillators.len()
    }

    pub fn validate_state(&self, values: &[f64]) -> Result<(), String> {
        if values.len() != self.state_len() || values.iter().any(|value| !value.is_finite()) {
            return Err("辐射恢复点维度或数值无效".into());
        }
        Ok(())
    }

    pub fn steady_state(&self, relative_velocity: [f64; 6]) -> Vec<f64> {
        self.oscillators.iter().flat_map(|mode| {
            let input: f64 = mode.coupling.iter().zip(relative_velocity).map(|(a, b)| a*b).sum();
            [input/mode.natural_frequency_rad_s.powi(2), 0.0]
        }).collect()
    }

    pub fn derivatives_into(
        &self,
        values: &[f64],
        relative_velocity: [f64; 6],
        derivatives: &mut [f64],
    ) -> Result<[f64; 6], String> {
        self.validate_state(values)?;
        if derivatives.len() != self.state_len() || relative_velocity.iter().any(|value| !value.is_finite()) {
            return Err("辐射输入或导数维度无效".into());
        }
        let mut loads = [0.0; 6];
        for (index, mode) in self.oscillators.iter().enumerate() {
            let position = values[2*index];
            let rate = values[2*index+1];
            let frequency = mode.natural_frequency_rad_s;
            let input: f64 = mode.coupling.iter().zip(relative_velocity).map(|(a, b)| a*b).sum();
            derivatives[2*index] = rate;
            derivatives[2*index+1] = input-2.0*mode.damping_ratio*frequency*rate-frequency*frequency*position;
            for axis in 0..6 {
                loads[axis] += mode.coupling[axis]*rate;
            }
        }
        if derivatives.iter().chain(&loads).any(|value| !value.is_finite()) {
            return Err("辐射响应出现非有限值".into());
        }
        Ok(loads)
    }

    pub fn stored_energy(&self, values: &[f64]) -> Result<f64, String> {
        self.validate_state(values)?;
        Ok(self.oscillators.iter().enumerate().map(|(index, mode)| {
            0.5*(values[2*index+1].powi(2)+mode.natural_frequency_rad_s.powi(2)*values[2*index].powi(2))
        }).sum())
    }

    pub fn impedance(&self, frequency_rad_s: f64) -> Result<[[Complex64; 6]; 6], String> {
        if !frequency_rad_s.is_finite() || frequency_rad_s < 0.0 {
            return Err("辐射频率无效".into());
        }
        let mut response = [[Complex64::new(0.0, 0.0); 6]; 6];
        for mode in &self.oscillators {
            let natural = mode.natural_frequency_rad_s;
            let value = Complex64::new(0.0, frequency_rad_s)
                /Complex64::new(natural*natural-frequency_rad_s*frequency_rad_s,
                    2.0*mode.damping_ratio*natural*frequency_rad_s);
            for row in 0..6 {
                for column in 0..6 {
                    response[row][column] += mode.coupling[row]*mode.coupling[column]*value;
                }
            }
        }
        Ok(response)
    }
}
