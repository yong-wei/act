//! 集装箱短波反射平均阻力。方向扩展与装载复用为已冻结的T级教学假设。

use super::wave::{WaveField, wave_number};
use serde::{Deserialize, Serialize};

pub const DEFINITION_JSON: &str = include_str!("../../model-data/container-mean-wave-resistance-v1.json");

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MeanWaveResistanceModel {
    ContainerReflectionTeachingV1,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Definition {
    beam_m: f64,
    bow_length_m: f64,
    water_density_kg_m3: f64,
    gravity_mps2: f64,
    zero_speed_transition_mps: f64,
    speed_range_mps: [f64; 2],
    maximum_significant_wave_height_m: f64,
    maximum_peak_wavelength_lpp_ratio: f64,
}

#[derive(Clone)]
pub struct ContainerMeanWaveResistance {
    energy_moments: [f64; 5],
    coefficient_n_per_m2: f64,
    cg_height_m: f64,
    speed_transition_mps: f64,
    speed_range_mps: [f64; 2],
    sea_in_reference_domain: bool,
}

impl ContainerMeanWaveResistance {
    pub fn from_wave(wave: &WaveField, cg_height_m: f64, lpp_m: f64) -> Result<Self, String> {
        if !cg_height_m.is_finite() || !lpp_m.is_finite() || lpp_m <= 0.0 {
            return Err("教学平均附加阻力需要有效的水线重心和船长".into());
        }
        let definition: Definition = serde_json::from_str(DEFINITION_JSON).map_err(|error| error.to_string())?;
        let mut energy_moments = [0.0; 5];
        for component in wave.components() {
            let energy = component.amplitude.powi(2);
            energy_moments[0] += energy;
            energy_moments[1] += energy * component.direction.cos();
            energy_moments[2] += energy * component.direction.sin();
            energy_moments[3] += energy * (2.0 * component.direction).cos();
            energy_moments[4] += energy * (2.0 * component.direction).sin();
        }
        let condition = wave.condition();
        let omega = 2.0 * std::f64::consts::PI / condition.tp_s;
        let wavelength_m = 2.0 * std::f64::consts::PI / wave_number(omega, condition.water_depth_m);
        Ok(Self {
            energy_moments,
            coefficient_n_per_m2: 0.5 * definition.water_density_kg_m3 * definition.gravity_mps2
                * definition.beam_m * (definition.beam_m / definition.bow_length_m).sqrt(),
            cg_height_m,
            speed_transition_mps: definition.zero_speed_transition_mps,
            speed_range_mps: definition.speed_range_mps,
            sea_in_reference_domain: condition.hs_m <= definition.maximum_significant_wave_height_m
                && wavelength_m <= lpp_m * definition.maximum_peak_wavelength_lpp_ratio,
        })
    }

    pub fn resistance_n(&self, yaw_rad: f64) -> f64 {
        let [energy, cosine, sine, cosine2, sine2] = self.energy_moments;
        // 来波方向与传播方向相反。五个角矩是逐分量幅值平方求和的精确展开。
        let weighted_energy = (1.5 * energy
            - 2.0 * (cosine * yaw_rad.cos() + sine * yaw_rad.sin())
            + 0.5 * (cosine2 * (2.0 * yaw_rad).cos() + sine2 * (2.0 * yaw_rad).sin())) / 4.0;
        self.coefficient_n_per_m2 * weighted_energy.max(0.0)
    }

    pub fn loads(&self, yaw_rad: f64, relative_body_velocity: [f64; 6]) -> [f64; 6] {
        let local_speed = relative_body_velocity[0] + self.cg_height_m * relative_body_velocity[4];
        let force_n = -self.resistance_n(yaw_rad) * (local_speed / self.speed_transition_mps).tanh();
        [force_n, 0.0, 0.0, 0.0, self.cg_height_m * force_n, 0.0]
    }

    pub fn diagnostics(&self, yaw_rad: f64, relative_body_velocity: [f64; 6], enabled: bool) -> serde_json::Value {
        let speed = relative_body_velocity[0].abs();
        serde_json::json!({
            "model": "container_reflection_teaching_v1", "grade": "T", "enabled": enabled,
            "inReferenceDomain": self.sea_in_reference_domain
                && speed >= self.speed_range_mps[0] && speed <= self.speed_range_mps[1],
            "resistanceN": if enabled { self.resistance_n(yaw_rad) } else { 0.0 },
            "loadBody": if enabled { self.loads(yaw_rad, relative_body_velocity) } else { [0.0; 6] },
            "definition": serde_json::from_str::<serde_json::Value>(DEFINITION_JSON).expect("冻结教学定义有效"),
        })
    }
}
