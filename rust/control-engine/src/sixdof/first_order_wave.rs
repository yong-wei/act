//! 版本化复数一阶激励，保留BEM频率、方向、平均航速与波面相位约定。

use super::model_pack::fnv1a;
use super::state::rotation_matrix;
use super::wave::{bracket_wave_grid, WaveComponent, WaveField};
use num_complex::{Complex32, Complex64};
use serde::Deserialize;
use std::sync::Arc;

const TWO_PI: f64 = 2.0 * std::f64::consts::PI;

#[derive(Debug, Clone, Deserialize)]
pub struct FirstOrderMetadata {
    pub schema: String,
    pub vessel: String,
    pub model_fidelity: String,
    pub frequencies_rad_s: Vec<f64>,
    pub headings_rad_to: Vec<f64>,
    pub forward_speeds_mps: Vec<f64>,
    pub water_depth_m: f64,
    pub water_density_kg_m3: f64,
    pub gravity_m_s2: f64,
    pub draft_m: f64,
    pub equilibrium_pitch_rad: f64,
    pub geometry_sha256: String,
    pub periodic_headings: bool,
    pub storage: String,
    pub normalization: String,
    pub time_convention: String,
    pub source_axes: String,
    pub data_fnv1a64: String,
    pub data_bytes: usize,
}

#[derive(Debug, Clone)]
pub struct FirstOrderExcitation {
    metadata: FirstOrderMetadata,
    coefficients: Arc<Vec<Complex32>>,
    metadata_bytes_hash: String,
}

impl FirstOrderExcitation {
    pub fn from_json_and_bytes(raw_metadata: &str, bytes: &[u8]) -> Result<Self, String> {
        let metadata: FirstOrderMetadata =
            serde_json::from_str(raw_metadata).map_err(|error| error.to_string())?;
        let valid_grid = |grid: &[f64], minimum: usize| {
            grid.len() >= minimum
                && grid.iter().all(|value| value.is_finite())
                && grid.windows(2).all(|pair| pair[0] < pair[1])
        };
        if metadata.schema != "act.first-order-excitation.v1"
            || metadata.storage != "complex-f32-little-endian-speed-frequency-heading-dof"
            || metadata.normalization != "force-per-unit-wave-amplitude-si"
            || metadata.time_convention != "real-part-of-exp-minus-i-omega-t"
            || metadata.source_axes != "x-forward-y-port-z-up"
            || !valid_grid(&metadata.frequencies_rad_s, 2)
            || metadata.frequencies_rad_s[0] <= 0.0
            || !valid_grid(&metadata.headings_rad_to, 2)
            || metadata.headings_rad_to[0] < 0.0
            || *metadata.headings_rad_to.last().unwrap() >= TWO_PI
            || !valid_grid(&metadata.forward_speeds_mps, 1)
            || metadata.forward_speeds_mps[0] < 0.0
            || !metadata.water_depth_m.is_finite()
            || metadata.water_depth_m <= 0.0
            || !metadata.water_density_kg_m3.is_finite()
            || metadata.water_density_kg_m3 <= 0.0
            || metadata.gravity_m_s2 != super::wave::GRAVITY
            || !metadata.draft_m.is_finite()
            || metadata.draft_m <= 0.0
            || !metadata.equilibrium_pitch_rad.is_finite()
            || metadata.geometry_sha256.len() != 64
            || !metadata
                .geometry_sha256
                .bytes()
                .all(|byte| byte.is_ascii_hexdigit())
        {
            return Err("一阶激励的网格、物理条件或约定无效".into());
        }
        let expected = metadata
            .forward_speeds_mps
            .len()
            .checked_mul(metadata.frequencies_rad_s.len())
            .and_then(|count| count.checked_mul(metadata.headings_rad_to.len()))
            .and_then(|count| count.checked_mul(6 * 8))
            .ok_or("一阶激励维度溢出")?;
        if bytes.len() != expected
            || metadata.data_bytes != expected
            || metadata.data_fnv1a64 != format!("fnv1a-{:016x}", fnv1a(bytes))
        {
            return Err("一阶激励长度或内容身份不符".into());
        }
        let mut coefficients = Vec::with_capacity(bytes.len() / 8);
        for pair in bytes.chunks_exact(8) {
            let real = f32::from_le_bytes(pair[..4].try_into().unwrap());
            let imaginary = f32::from_le_bytes(pair[4..].try_into().unwrap());
            if !real.is_finite() || !imaginary.is_finite() {
                return Err("一阶激励含非有限系数".into());
            }
            coefficients.push(Complex32::new(real, imaginary));
        }
        Ok(Self {
            metadata,
            coefficients: Arc::new(coefficients),
            metadata_bytes_hash: format!("fnv1a-{:016x}", fnv1a(raw_metadata.as_bytes())),
        })
    }

    pub fn metadata(&self) -> &FirstOrderMetadata {
        &self.metadata
    }
    pub fn metadata_bytes_hash(&self) -> &str {
        &self.metadata_bytes_hash
    }

    /// 方向是相对艏向的NED顺时针传播角，结果是平衡纵倾处的FRD载荷系数。
    pub fn lookup_body(
        &self,
        frequency: f64,
        direction: f64,
        mean_speed: f64,
    ) -> Result<[Complex64; 6], String> {
        if [frequency, direction, mean_speed]
            .iter()
            .any(|value| !value.is_finite())
        {
            return Err("一阶激励查表输入无效".into());
        }
        let (fi, tf) = bracket_wave_grid(&self.metadata.frequencies_rad_s, frequency, false)
            .ok_or("频率超出一阶激励数据域")?;
        let (hi, th) = bracket_wave_grid(
            &self.metadata.headings_rad_to,
            (-direction).rem_euclid(TWO_PI),
            self.metadata.periodic_headings,
        )
        .ok_or("波向超出一阶激励数据域")?;
        let (ui, tu) = bracket_wave_grid(&self.metadata.forward_speeds_mps, mean_speed, false)
            .ok_or("平均航速超出一阶激励数据域")?;
        let mut source = [Complex64::new(0.0, 0.0); 6];
        let nf = self.metadata.frequencies_rad_s.len();
        let nh = self.metadata.headings_rad_to.len();
        for (u, wu) in [(ui[0], 1.0 - tu), (ui[1], tu)] {
            for (f, wf) in [(fi[0], 1.0 - tf), (fi[1], tf)] {
                for (h, wh) in [(hi[0], 1.0 - th), (hi[1], th)] {
                    let offset = ((u * nf + f) * nh + h) * 6;
                    for (channel, value) in source.iter_mut().enumerate() {
                        let coefficient = self.coefficients[offset + channel];
                        *value += wu
                            * wf
                            * wh
                            * Complex64::new(f64::from(coefficient.re), f64::from(coefficient.im));
                    }
                }
            }
        }
        let (sine, cosine) = self.metadata.equilibrium_pitch_rad.sin_cos();
        let transform = [[cosine, 0.0, sine], [0.0, -1.0, 0.0], [sine, 0.0, -cosine]];
        Ok(std::array::from_fn(|channel| {
            let offset = (channel / 3) * 3;
            (0..3)
                .map(|axis| transform[channel % 3][axis] * source[offset + axis])
                .sum()
        }))
    }

    /// 平均状态在本次线性化内冻结，空间相位按实际船位连续计算。
    pub fn prepare(
        &self,
        field: &WaveField,
        mean_heading_rad: f64,
        mean_speed_mps: f64,
    ) -> Result<PreparedFirstOrderLoads, String> {
        if !mean_heading_rad.is_finite()
            || (field.condition().water_depth_m - self.metadata.water_depth_m).abs() > 1e-8
        {
            return Err("一阶激励与波场的平均艏向或水深不一致".into());
        }
        let coefficients = field
            .components()
            .iter()
            .map(|component| {
                self.lookup_body(
                    component.omega,
                    component.direction - mean_heading_rad,
                    mean_speed_mps,
                )
            })
            .collect::<Result<Vec<_>, _>>()?;
        Ok(PreparedFirstOrderLoads {
            components: Arc::new(field.components().to_vec()),
            coefficients: Arc::new(coefficients),
            mean_heading_rad,
            equilibrium_pitch_rad: self.metadata.equilibrium_pitch_rad,
        })
    }
}

#[derive(Clone)]
pub struct PreparedFirstOrderLoads {
    components: Arc<Vec<WaveComponent>>,
    coefficients: Arc<Vec<[Complex64; 6]>>,
    mean_heading_rad: f64,
    equilibrium_pitch_rad: f64,
}

impl PreparedFirstOrderLoads {
    /// 返回冻结平衡FRD坐标的载荷，使用与海面相同的全部分量。
    pub fn evaluate(&self, time_s: f64, north_m: f64, east_m: f64) -> Result<[f64; 6], String> {
        if [time_s, north_m, east_m]
            .iter()
            .any(|value| !value.is_finite())
        {
            return Err("一阶激励合成时间或位置无效".into());
        }
        let mut output = [0.0; 6];
        for (component, coefficients) in self.components.iter().zip(self.coefficients.iter()) {
            let phase = component.omega * time_s
                - component.k
                    * (north_m * component.direction.cos() + east_m * component.direction.sin())
                + component.phase;
            let phasor = Complex64::from_polar(component.amplitude, -phase);
            for (channel, value) in output.iter_mut().enumerate() {
                *value += (coefficients[channel] * phasor).re;
            }
        }
        if output.iter().any(|value| !value.is_finite()) {
            return Err("一阶激励合成超出有限数值范围".into());
        }
        Ok(output)
    }

    pub fn evaluate_body(
        &self,
        time_s: f64,
        position: [f64; 3],
        quaternion: [f64; 4],
    ) -> Result<[f64; 6], String> {
        let norm: f64 = quaternion.iter().map(|value| value * value).sum();
        if position
            .iter()
            .chain(&quaternion)
            .any(|value| !value.is_finite())
            || !norm.is_finite()
            || norm <= 0.0
        {
            return Err("一阶激励作用位置或姿态无效".into());
        }
        let loads = self.evaluate(time_s, position[0], position[1])?;
        Ok(rotate_wave_loads(
            loads,
            self.mean_heading_rad,
            self.equilibrium_pitch_rad,
            quaternion,
        ))
    }
}

/// 同一重心处，从冻结平衡FRD坐标旋转到当前FRD坐标。
pub(crate) fn rotate_wave_loads(
    loads: [f64; 6],
    mean_yaw: f64,
    mean_pitch: f64,
    quaternion: [f64; 4],
) -> [f64; 6] {
    let (sy, cy) = mean_yaw.sin_cos();
    let (sp, cp) = mean_pitch.sin_cos();
    let reference = [
        [cy * cp, -sy, cy * sp],
        [sy * cp, cy, sy * sp],
        [-sp, 0.0, cp],
    ];
    let actual = rotation_matrix(quaternion);
    let relative: [[f64; 3]; 3] = std::array::from_fn(|row| {
        std::array::from_fn(|column| {
            (0..3)
                .map(|axis| actual[axis][row] * reference[axis][column])
                .sum()
        })
    });
    std::array::from_fn(|channel| {
        let offset = (channel / 3) * 3;
        (0..3)
            .map(|axis| relative[channel % 3][axis] * loads[offset + axis])
            .sum()
    })
}
