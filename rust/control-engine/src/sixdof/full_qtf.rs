//! 有符号六通道完整差频表，采用NEMOH的exp(-iωt)及双重和1/2约定。
//! 来源见Kurnia与Ducrozet 2022式(10)、(12)及NEMOH输入输出说明。

use std::sync::Arc;

use num_complex::{Complex32, Complex64};
use serde::Deserialize;

use super::model_pack::{fnv1a, normalized_hash};
use super::wave::{WaveComponent, WaveField, bracket_wave_grid as bracket};

const TWO_PI: f64 = 2.0 * std::f64::consts::PI;
const FRD_SIGNS: [f64; 6] = [1.0, -1.0, -1.0, 1.0, -1.0, -1.0];
const HALF_TURN_SIGNS: [f64; 6] = [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0];

#[derive(Debug, Clone, Deserialize)]
pub struct FullQtfMetadata {
    pub schema: String,
    pub vessel: String,
    pub model_fidelity: String,
    pub frequencies_rad_s: Vec<f64>,
    pub headings_rad_to: Vec<f64>,
    pub water_density_kg_m3: f64,
    pub gravity_m_s2: f64,
    pub water_depth_m: f64,
    pub mean_forward_speed_mps: f64,
    pub draft_m: f64,
    pub mesh_sha256: String,
    #[serde(default)]
    pub equilibrium_pitch_rad: f64,
    #[serde(default)]
    pub rigid_condition: Option<super::wave::WaveRigidCondition>,
    pub periodic_headings: bool,
    pub half_turn_symmetry: bool,
    pub half_turn_relative_l2: [f64; 6],
    pub storage: String,
    pub normalization: String,
    pub time_convention: String,
    pub source_axes: String,
    pub full_double_sum_factor: f64,
    pub contributions: String,
    pub sample_only: bool,
    pub data_sha256: String,
    pub data_fnv1a64: String,
    pub data_bytes: usize,
}

#[derive(Debug, Clone)]
pub struct FullDifferenceQtf {
    metadata: FullQtfMetadata,
    normalized_coefficients: Arc<Vec<Complex32>>,
    content_hash: String,
    metadata_bytes_hash: String,
}

/// 线性势流计算的平均状态。实际振荡速度由物理会话另行推进。
pub struct QtfMeanCondition<'a> {
    pub forward_speed_mps: f64,
    pub draft_m: f64,
    pub mesh_sha256: &'a str,
}

impl FullDifferenceQtf {
    pub fn from_json_and_bytes(raw_metadata: &str, bytes: &[u8]) -> Result<Self, String> {
        let value: serde_json::Value = serde_json::from_str(raw_metadata).map_err(|error| error.to_string())?;
        let metadata: FullQtfMetadata = serde_json::from_value(value.clone()).map_err(|error| error.to_string())?;
        let frequencies = &metadata.frequencies_rad_s;
        let headings = &metadata.headings_rad_to;
        let valid_grid = |grid: &[f64]| grid.len() >= 2
            && grid.iter().all(|value| value.is_finite())
            && grid.windows(2).all(|pair| pair[0] < pair[1]);
        if metadata.schema != "act.full-difference-qtf.v1"
            || metadata.storage != "complex-f32-little-endian-heading1-heading2-dof-triangular-frequency"
            || metadata.normalization != "qtf-divided-by-rho-g"
            || metadata.time_convention != "real-part-of-exp-minus-i-omega-t"
            || metadata.source_axes != "x-forward-y-port-z-up"
            || metadata.full_double_sum_factor != 0.5
            || !valid_grid(frequencies) || frequencies[0] <= 0.0
            || !valid_grid(headings) || headings[0] < 0.0 || *headings.last().unwrap() >= TWO_PI
            || [metadata.water_density_kg_m3, metadata.gravity_m_s2, metadata.water_depth_m, metadata.draft_m]
                .iter().any(|value| !value.is_finite() || *value <= 0.0)
            || !metadata.mean_forward_speed_mps.is_finite()
            || !metadata.equilibrium_pitch_rad.is_finite()
            || metadata.half_turn_relative_l2.iter().any(|value| !value.is_finite() || *value < 0.0)
        {
            return Err("完整差频表的网格、单位或约定无效".into());
        }
        let nf = frequencies.len();
        let expected = nf.checked_add(1).and_then(|count| nf.checked_mul(count))
            .map(|count| count / 2)
            .and_then(|count| count.checked_mul(headings.len()))
            .and_then(|count| count.checked_mul(headings.len()))
            .and_then(|count| count.checked_mul(6 * 8))
            .ok_or("完整差频表维度溢出")?;
        if bytes.len() != expected || metadata.data_bytes != expected
            || format!("fnv1a-{:016x}", fnv1a(bytes)) != metadata.data_fnv1a64
        {
            return Err("完整差频表长度或内容身份不符".into());
        }
        let mut coefficients = Vec::with_capacity(bytes.len() / 8);
        for pair in bytes.chunks_exact(8) {
            let real = f32::from_le_bytes(pair[..4].try_into().unwrap());
            let imaginary = f32::from_le_bytes(pair[4..].try_into().unwrap());
            if !real.is_finite() || !imaginary.is_finite() {
                return Err("完整差频表包含非有限系数".into());
            }
            coefficients.push(Complex32::new(real, imaginary));
        }
        Ok(Self { metadata, normalized_coefficients: Arc::new(coefficients), content_hash: normalized_hash(&value),
            metadata_bytes_hash: format!("fnv1a-{:016x}", fnv1a(raw_metadata.as_bytes())) })
    }

    pub fn metadata(&self) -> &FullQtfMetadata {
        &self.metadata
    }

    pub fn content_hash(&self) -> &str {
        &self.content_hash
    }

    pub fn metadata_bytes_hash(&self) -> &str { &self.metadata_bytes_hash }

    fn direction_pair(&self, first: f64, second: f64) -> Result<([usize; 2], [usize; 2], f64, f64, bool), String> {
        for half_turn in [false, true] {
            if half_turn && !self.metadata.half_turn_symmetry {
                break;
            }
            let rotation = if half_turn { std::f64::consts::PI } else { 0.0 };
            let first = (first + rotation).rem_euclid(TWO_PI);
            let second = (second + rotation).rem_euclid(TWO_PI);
            let a = bracket(&self.metadata.headings_rad_to, first, self.metadata.periodic_headings);
            let b = bracket(&self.metadata.headings_rad_to, second, self.metadata.periodic_headings);
            if let (Some((ia, ta)), Some((ib, tb))) = (a, b) {
                return Ok((ia, ib, ta, tb, half_turn));
            }
        }
        Err("差频方向对超出实际数据域".into())
    }

    fn node(&self, first_frequency: usize, second_frequency: usize, first_heading: usize,
        second_heading: usize, channel: usize) -> Complex64
    {
        let (high, low, h1, h2, conjugate) = if first_frequency >= second_frequency {
            (first_frequency, second_frequency, first_heading, second_heading, false)
        } else {
            (second_frequency, first_frequency, second_heading, first_heading, true)
        };
        let nf = self.metadata.frequencies_rad_s.len();
        let triangles = nf * (nf + 1) / 2;
        let nd = self.metadata.headings_rad_to.len();
        let index = ((h1 * nd + h2) * 6 + channel) * triangles + high * (high + 1) / 2 + low;
        let value = self.normalized_coefficients[index];
        let value = Complex64::new(f64::from(value.re), f64::from(value.im));
        if conjugate { value.conj() } else { value }
    }

    /// 输入为两个波分量相对艏向的NED顺时针传播角，输出采用FRD和SI单位。
    pub fn lookup_frd(&self, first_frequency: f64, second_frequency: f64,
        first_direction: f64, second_direction: f64) -> Result<[Complex64; 6], String>
    {
        if [first_frequency, second_frequency, first_direction, second_direction].iter().any(|value| !value.is_finite()) {
            return Err("差频查表输入含非有限值".into());
        }
        let (fi, tf) = bracket(&self.metadata.frequencies_rad_s, first_frequency, false).ok_or("第一频率超出差频数据域")?;
        let (fj, tj) = bracket(&self.metadata.frequencies_rad_s, second_frequency, false).ok_or("第二频率超出差频数据域")?;
        // BEM横轴向左，波向角与FRD顺时针角相反，两个波向只允许共同旋转。
        let (hi, hj, ti, th, half_turn) = self.direction_pair(-first_direction, -second_direction)?;
        let mut output = [Complex64::new(0.0, 0.0); 6];
        for (a, wa) in [(0, 1.0 - tf), (1, tf)] {
            for (b, wb) in [(0, 1.0 - tj), (1, tj)] {
                for (c, wc) in [(0, 1.0 - ti), (1, ti)] {
                    for (d, wd) in [(0, 1.0 - th), (1, th)] {
                        let weight = wa * wb * wc * wd;
                        for (channel, result) in output.iter_mut().enumerate() {
                            *result += weight * self.node(fi[a], fj[b], hi[c], hj[d], channel);
                        }
                    }
                }
            }
        }
        for (channel, result) in output.iter_mut().enumerate() {
            let rotation = if half_turn { HALF_TURN_SIGNS[channel] } else { 1.0 };
            *result *= FRD_SIGNS[channel] * rotation * self.metadata.water_density_kg_m3 * self.metadata.gravity_m_s2;
        }
        if self.metadata.equilibrium_pitch_rad != 0.0 {
            let (sine, cosine) = self.metadata.equilibrium_pitch_rad.sin_cos();
            for offset in [0, 3] {
                let x = output[offset];
                let z = output[offset+2];
                output[offset] = cosine*x-sine*z;
                output[offset+2] = sine*x+cosine*z;
            }
        }
        if output.iter().any(|value| !value.re.is_finite() || !value.im.is_finite()) {
            return Err("差频系数单位转换超出有限数值范围".into());
        }
        Ok(output)
    }

    /// 固定平均艏向下预组合精确实数二次型，原始复数表及残差保持独立。
    pub fn prepare(&self, field: &WaveField, mean_heading_rad: f64, condition: QtfMeanCondition<'_>) -> Result<PreparedDifferenceLoads, String> {
        if !mean_heading_rad.is_finite() || !condition.forward_speed_mps.is_finite() || !condition.draft_m.is_finite()
            || (field.condition().water_depth_m - self.metadata.water_depth_m).abs() > 1e-8
            || (condition.forward_speed_mps - self.metadata.mean_forward_speed_mps).abs() > 1e-8
            || (condition.draft_m - self.metadata.draft_m).abs() > 1e-8
            || condition.mesh_sha256 != self.metadata.mesh_sha256
        {
            return Err("波场平均航速、吃水、水深或湿面与差频数据不符".into());
        }
        let components = field.components();
        let pair_count = components.len().checked_add(1).and_then(|count| count.checked_mul(components.len()))
            .map(|count| count / 2).ok_or("波分量对数量溢出")?;
        let mut pairs = Vec::with_capacity(pair_count);
        for (i, first) in components.iter().enumerate() {
            for (j, second) in components[..=i].iter().enumerate() {
                let a = self.lookup_frd(first.omega, second.omega, first.direction - mean_heading_rad, second.direction - mean_heading_rad)?;
                let pair = if i == j {
                    a.map(|value| value * 0.5)
                } else {
                    let b = self.lookup_frd(second.omega, first.omega, second.direction - mean_heading_rad, first.direction - mean_heading_rad)?;
                    std::array::from_fn(|channel| (a[channel] + b[channel].conj()) * 0.5)
                };
                pairs.push(pair);
            }
        }
        Ok(PreparedDifferenceLoads { components: Arc::new(components.to_vec()), pairs: Arc::new(pairs),
            mean_heading_rad, content_hash: self.content_hash.clone() })
    }
}

#[derive(Clone)]
pub struct PreparedDifferenceLoads {
    components: Arc<Vec<WaveComponent>>,
    pairs: Arc<Vec<[Complex64; 6]>>,
    mean_heading_rad: f64,
    content_hash: String,
}

impl PreparedDifferenceLoads {
    pub fn mean_heading_rad(&self) -> f64 {
        self.mean_heading_rad
    }

    pub fn content_hash(&self) -> &str {
        &self.content_hash
    }

    /// 在冻结平均坐标系返回六通道载荷，使用波面同源相位及实际采样位置。
    pub fn evaluate(&self, time_s: f64, north_m: f64, east_m: f64) -> Result<[f64; 6], String> {
        if [time_s, north_m, east_m].iter().any(|value| !value.is_finite()) {
            return Err("差频合成时间或位置无效".into());
        }
        let phasors: Vec<_> = self.components.iter().map(|component| {
            let phase = component.omega * time_s - component.k * (north_m * component.direction.cos()
                + east_m * component.direction.sin()) + component.phase;
            Complex64::from_polar(component.amplitude, -phase)
        }).collect();
        let mut output = [0.0; 6];
        let mut pairs = self.pairs.iter();
        for (i, first) in phasors.iter().enumerate() {
            for second in &phasors[..=i] {
                let phase = first * second.conj();
                let coefficients = pairs.next().expect("预组合三角形维度一致");
                for (channel, load) in output.iter_mut().enumerate() {
                    *load += (coefficients[channel] * phase).re;
                }
            }
        }
        if output.iter().any(|value| !value.is_finite()) {
            return Err("差频载荷合成超出有限数值范围".into());
        }
        Ok(output)
    }
}
