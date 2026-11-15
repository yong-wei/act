//! 种子化 JONSWAP 多向波场（issue-2156-p1 A1）。
//!
//! 合同（issue §2 波浪）：JONSWAP γ=3.3（峰前 σ=0.07/峰后 σ=0.09）、
//! ω∈[0.2, 2.5] rad/s、128 等能频率段、7 方向（主向 ±30°、10° 间隔、
//! cos² 权重归一）；离散后重新归一化至 `Σa_i²/2 = Hs²/16`。波面、轨道
//! 速度与一阶激励共用同一波场（同相位）；水深进入色散/相位/轨道速度。
//! 二阶表的可用域由参数包登记，原始独立波场默认尚无二阶数据。
//!
//! 确定性：分量相位由 (seed, 频段, 方向) 经 SplitMix64 派生，与帧率/
//! 倍速/暂停无关（无墙钟依赖）；同 seed 同工况逐点同一序列。

/// 线性同余派生（SplitMix64 finale）——种子子流的基础。
pub fn split_mix64(state: &mut u64) -> u64 {
    *state = state.wrapping_add(0x9E3779B97F4A7C15);
    let mut z = *state;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
    z ^ (z >> 31)
}

pub fn seed_to_unit(state: &mut u64) -> f64 {
    (split_mix64(state) >> 11) as f64 / (1u64 << 53) as f64
}

pub const JONSWAP_GAMMA: f64 = 3.3;
pub const SIGMA_FRONT: f64 = 0.07;
pub const SIGMA_BACK: f64 = 0.09;
pub const OMEGA_MIN: f64 = 0.2;
pub const OMEGA_MAX: f64 = 2.5;
pub const FREQUENCY_BINS: usize = 128;
pub const DIRECTIONS: usize = 7;
pub const GRAVITY: f64 = 9.81;

#[derive(Debug, Clone, serde::Deserialize)]
pub struct WaveRigidCondition {
    pub mass_kg: f64,
    pub center_of_mass_waterline_z_up_m: [f64; 3],
    pub inertia_about_cg_kg_m2: [f64; 3],
}

pub(crate) fn bracket_wave_grid(grid: &[f64], value: f64, periodic: bool) -> Option<([usize; 2], f64)> {
    if !value.is_finite() || grid.is_empty() { return None; }
    if grid.len() == 1 { return (value == grid[0]).then_some(([0, 0], 0.0)); }
    let last = grid.len()-1;
    if periodic && (value < grid[0] || value > grid[last]) {
        let two_pi = 2.0*std::f64::consts::PI;
        let position = if value < grid[0] { value+two_pi } else { value };
        return Some(([last, 0], (position-grid[last])/(grid[0]+two_pi-grid[last])));
    }
    if value < grid[0] || value > grid[last] { return None; }
    let right = grid.partition_point(|point| *point <= value).min(last).max(1);
    let left = right-1;
    Some(([left, right], (value-grid[left])/(grid[right]-grid[left])))
}

/// 工况定义（issue §2 表；T 级课程标称）。
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct WaveCondition {
    pub hs_m: f64,
    pub tp_s: f64,
    /// 波向 TO（传播方向，真北顺时针）。
    pub direction_to_deg: f64,
    pub water_depth_m: f64,
}

impl WaveCondition {
    pub const fn v1() -> Self {
        Self { hs_m: 0.75, tp_s: 7.0, direction_to_deg: 90.0, water_depth_m: 200.0 }
    }
    pub const fn v2() -> Self {
        Self { hs_m: 1.5, tp_s: 8.0, direction_to_deg: 90.0, water_depth_m: 200.0 }
    }
    pub const fn v3() -> Self {
        Self { hs_m: 2.5, tp_s: 10.0, direction_to_deg: 135.0, water_depth_m: 200.0 }
    }
    pub fn lng_berth() -> Self {
        Self { hs_m: 0.75, tp_s: 7.0, direction_to_deg: 90.0, water_depth_m: 40.0 }
    }
    pub fn dredger_site() -> Self {
        Self { hs_m: 0.75, tp_s: 7.0, direction_to_deg: 90.0, water_depth_m: 20.0 }
    }
}

/// JONSWAP 谱值 S(ω)（未含方向；比例形式，幅值最终再归一）。
fn jonswap_spectrum(omega: f64, tp_s: f64) -> f64 {
    let omega_p = 2.0 * std::f64::consts::PI / tp_s;
    let sigma = if omega <= omega_p { SIGMA_FRONT } else { SIGMA_BACK };
    let alpha = (-(omega - omega_p).powi(2) / (2.0 * sigma * sigma * omega_p * omega_p)).exp();
    let peak = JONSWAP_GAMMA.powf(alpha);
    // PM 壳层 × 峰升因子（T 级形状，幅值由外层再归一）。
    omega.powi(-5) * (-1.25 * (omega_p / omega).powi(4)).exp() * peak
}

/// 有限水深色散：ω² = g·k·tanh(kh)（牛顿迭代）。
pub(crate) fn wave_number(omega: f64, depth: f64) -> f64 {
    let k_deep = omega * omega / GRAVITY;
    if depth > 1.0e4 {
        return k_deep;
    }
    let mut k = k_deep.max(1e-6);
    for _ in 0..24 {
        let th = (k * depth).tanh();
        let f = GRAVITY * k * th - omega * omega;
        let df = GRAVITY * (th + k * depth * (1.0 - th * th));
        let step = f / df;
        k -= step;
        if step.abs() < 1e-10 * k.abs().max(1e-10) {
            break;
        }
    }
    k.max(1e-9)
}

/// 离散分量（波数、幅值、方向、相位）。
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub(crate) struct WaveComponent {
    pub(crate) omega: f64,
    pub(crate) k: f64,
    pub(crate) amplitude: f64,
    /// 传播方向（NED 弧度，x=北）。
    pub(crate) direction: f64,
    pub(crate) phase: f64,
}

/// 带种子波场。
#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct WaveField {
    components: Vec<WaveComponent>,
    condition: WaveCondition,
    second_order_available: bool,
    #[serde(skip)]
    evaluation_kernels: std::sync::OnceLock<std::sync::Arc<Vec<WaveEvaluationKernel>>>,
}

struct WaveEvaluationKernel {
    direction_cos: f64,
    direction_sin: f64,
    bottom_sinh: f64,
}

impl WaveField {
    pub fn regular(seed: u64, mut condition: WaveCondition, height_m: f64) -> Result<Self, String> {
        if !height_m.is_finite() || !(0.0..=3.5).contains(&height_m)
            || !condition.tp_s.is_finite() || !(2.6..=30.0).contains(&condition.tp_s) {
            return Err("规则波波高或周期超出教学范围".into());
        }
        condition.hs_m = std::f64::consts::SQRT_2 * height_m;
        let omega = 2.0 * std::f64::consts::PI / condition.tp_s;
        let mut phase_seed = seed;
        Ok(Self {components:vec![WaveComponent {omega,k:wave_number(omega, condition.water_depth_m),
            amplitude:height_m / 2.0,direction:condition.direction_to_deg.to_radians(),
            phase:2.0 * std::f64::consts::PI * seed_to_unit(&mut phase_seed)}],
            condition,second_order_available:false,evaluation_kernels:Default::default()})
    }

    pub fn new(seed: u64, condition: WaveCondition) -> Self {
        Self::with_frequency_bins(seed, condition, FREQUENCY_BINS)
    }

    /// 教学代表谱保留方向、能量和同源相位。频率分辨率随运行配置冻结。
    pub fn representative(seed: u64, condition: WaveCondition, bins: usize) -> Result<Self, String> {
        if ![16,32,FREQUENCY_BINS].contains(&bins) {
            return Err("教学波谱仅支持16、32或128个频段".into());
        }
        Ok(Self::with_frequency_bins(seed, condition, bins))
    }

    fn with_frequency_bins(seed: u64, condition: WaveCondition, bins: usize) -> Self {
        let mut rng = seed
            .wrapping_mul(0x9E3779B97F4A7C15)
            .wrapping_add(0x1234567890ABCDEF);
        // 1) 等能频率段：谱 CDF 反演。
        let mut cdf = vec![0.0f64; bins + 1];
        let mut total = 0.0;
        for i in 0..bins {
            let w_mid = OMEGA_MIN + (OMEGA_MAX - OMEGA_MIN) * (i as f64 + 0.5) / bins as f64;
            total += jonswap_spectrum(w_mid, condition.tp_s);
            cdf[i + 1] = total;
        }
        // 2) 方向权重 cos²（主向 ±30°）。
        let main_dir = condition.direction_to_deg.to_radians();
        let mut dir_weight = [0.0f64; DIRECTIONS];
        let mut dir_total = 0.0;
        for (j, weight) in dir_weight.iter_mut().enumerate() {
            let offset = (j as f64 - 3.0) * 10.0_f64.to_radians();
            let w = offset.cos().powi(2).max(0.0);
            *weight = w;
            dir_total += w;
        }
        // 3) 分量幅值（比例）与确定性相位。
        let mut components = Vec::with_capacity(bins * DIRECTIONS);
        for i in 0..bins {
            let band_energy = (cdf[i + 1] - cdf[i]) / total;
            let w_mid = OMEGA_MIN + (OMEGA_MAX - OMEGA_MIN) * (i as f64 + 0.5) / bins as f64;
            let k = wave_number(w_mid, condition.water_depth_m);
            for (j, &weight) in dir_weight.iter().enumerate() {
                let share = band_energy * (weight / dir_total);
                if share <= 0.0 {
                    continue;
                }
                let a_prop = (2.0 * share).sqrt();
                let direction = main_dir + (j as f64 - 3.0) * 10.0_f64.to_radians();
                let phase = 2.0 * std::f64::consts::PI * seed_to_unit(&mut rng);
                components.push(WaveComponent { omega: w_mid, k, amplitude: a_prop, direction, phase });
            }
        }
        // 4) 再归一：Σa²/2 = Hs²/16。
        let sum_sq: f64 = components.iter().map(|c| c.amplitude * c.amplitude).sum();
        let target = condition.hs_m * condition.hs_m / 16.0;
        let scale = (target / (sum_sq / 2.0).max(1e-12)).sqrt();
        for c in components.iter_mut() {
            c.amplitude *= scale;
        }
        Self { components, condition, second_order_available: false, evaluation_kernels: Default::default() }
    }

    fn evaluation_kernels(&self) -> &[WaveEvaluationKernel] {
        self.evaluation_kernels.get_or_init(|| std::sync::Arc::new(self.components.iter().map(|component| WaveEvaluationKernel {
            direction_cos: component.direction.cos(), direction_sin: component.direction.sin(),
            bottom_sinh: (component.k*self.condition.water_depth_m).sinh().max(1e-12),
        }).collect())).as_slice()
    }

    /// 波面高程（NED 位置，m）。
    pub fn elevation(&self, t: f64, x_n: f64, y_e: f64) -> f64 {
        let mut eta = 0.0;
        for (c,kernel) in self.components.iter().zip(self.evaluation_kernels()) {
            let arg = c.omega * t - c.k * (x_n * kernel.direction_cos + y_e * kernel.direction_sin) + c.phase;
            eta += c.amplitude * arg.cos();
        }
        eta
    }

    /// 轨道速度（线性 Airy，有限水深；NED 水平分量 + 垂向分量）。
    pub fn orbital_velocity(&self, t: f64, x_n: f64, y_e: f64, z_up_from_surface: f64) -> [f64; 3] {
        let depth = self.condition.water_depth_m;
        let mut vel = [0.0f64; 3];
        for (c,kernel) in self.components.iter().zip(self.evaluation_kernels()) {
            let arg = c.omega * t - c.k * (x_n * kernel.direction_cos + y_e * kernel.direction_sin) + c.phase;
            let (sin_arg, cos_arg) = arg.sin_cos();
            // Airy 有限水深：u = aω·cosh(k(h+z))/sinh(kh)、
            // w = aω·sinh(k(h+z))/sinh(kh)；海床 z=-h 处垂向为零。
            let sh_bottom = kernel.bottom_sinh;
            let ch_z = (c.k * (depth + z_up_from_surface)).cosh();
            let sh_z = (c.k * (depth + z_up_from_surface)).sinh();
            let horizontal = c.amplitude * c.omega * (ch_z / sh_bottom);
            vel[0] += horizontal * kernel.direction_cos * cos_arg;
            vel[1] += horizontal * kernel.direction_sin * cos_arg;
            vel[2] += c.amplitude * c.omega * (sh_z / sh_bottom) * sin_arg;
        }
        vel
    }

    /// 一阶激励载荷（同相位共用波场；系数由船参数包提供，缺省单位）。
    /// 返回 [Fx, Fy, Fz, K, M, N]（N / N·m）。
    /// 带符号线性合成（Fx↔u_x、Fy↔u_y、Fz↔η）：不取范数，保持正负
    /// 相位（不整流、不产生伪造的平均漂移分量）。
    pub fn first_order_loads(&self, t: f64, coefficients: [f64; 6]) -> [f64; 6] {
        let eta = self.elevation(t, 0.0, 0.0);
        let vel = self.orbital_velocity(t, 0.0, 0.0, 0.0);
        [coefficients[0] * vel[0], coefficients[1] * vel[1], coefficients[2] * eta,
         coefficients[3] * eta, coefficients[4] * vel[0], coefficients[5] * vel[1]]
    }

    /// QTF 二阶是否就绪（阶段 B2.1：Newman 近似机制 + 系数表接入后，
    /// 由 EnvironmentState 持表并开关；波场本身不持表——关闭二阶不改
    /// 波面序列的合同由调用侧开关语义保证）。
    pub fn second_order_available(&self) -> bool {
        self.second_order_available
    }

    pub(crate) fn set_second_order_available(&mut self, available: bool) {
        self.second_order_available = available;
    }

    pub fn condition(&self) -> WaveCondition {
        self.condition
    }

    pub fn component_count(&self) -> usize {
        self.components.len()
    }

    /// 分量只读访问（crate 内 QTF 内核复用同一相位/幅值源）。
    pub(crate) fn components(&self) -> &[WaveComponent] {
        &self.components
    }

    /// 分量能量和 Σaᵢ²/2（谱归一化对账；应精确 = Hs²/16）。
    pub fn energy_sum(&self) -> f64 {
        self.components.iter().map(|c| c.amplitude * c.amplitude / 2.0).sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cached_wave_kernels_match_original_scalar_operations_bitwise_and_stay_out_of_snapshots() {
        for depth in [40.0,200.0] {
            let field = WaveField::new(20261106,WaveCondition {hs_m:1.5,tp_s:9.0,direction_to_deg:45.0,water_depth_m:depth});
            let before = serde_json::to_string(&field).unwrap();
            for (time,north,east,z) in [(0.0,0.0,0.0,-4.0),(37.25,1234.5,-35.0,-8.5),(600.0,-1800.0,230.0,-depth)] {
                let mut elevation = 0.0;
                let mut velocity = [0.0_f64;3];
                for component in &field.components {
                    let argument = component.omega*time-component.k*(north*component.direction.cos()+east*component.direction.sin())+component.phase;
                    elevation += component.amplitude*argument.cos();
                    let (sin_argument,cos_argument) = argument.sin_cos();
                    let bottom = (component.k*depth).sinh().max(1e-12);
                    let horizontal = component.amplitude*component.omega*((component.k*(depth+z)).cosh()/bottom);
                    velocity[0] += horizontal*component.direction.cos()*cos_argument;
                    velocity[1] += horizontal*component.direction.sin()*cos_argument;
                    velocity[2] += component.amplitude*component.omega*((component.k*(depth+z)).sinh()/bottom)*sin_argument;
                }
                assert_eq!(field.elevation(time,north,east).to_bits(),elevation.to_bits());
                assert_eq!(field.orbital_velocity(time,north,east,z).map(f64::to_bits),velocity.map(f64::to_bits));
            }
            assert_eq!(serde_json::to_string(&field).unwrap(),before);
            let restored:WaveField = serde_json::from_str(&before).unwrap();
            assert!(restored.evaluation_kernels.get().is_none());
            assert_eq!(restored.orbital_velocity(71.0,170.0,25.0,-3.0),field.orbital_velocity(71.0,170.0,25.0,-3.0));
        }
    }
}
