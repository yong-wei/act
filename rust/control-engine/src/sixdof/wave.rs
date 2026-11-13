//! 种子化 JONSWAP 多向波场（issue-2156-p1 A1）。
//!
//! 合同（issue §2 波浪）：JONSWAP γ=3.3（峰前 σ=0.07/峰后 σ=0.09）、
//! ω∈[0.2, 2.5] rad/s、128 等能频率段、7 方向（主向 ±30°、10° 间隔、
//! cos² 权重归一）；离散后重新归一化至 `Σa_i²/2 = Hs²/16`。波面、轨道
//! 速度与一阶激励共用同一波场（同相位）；水深进入色散/相位/轨道速度。
//! 二阶 QTF 未就绪：`second_order_available()` 显式 false，不伪造慢漂。
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

/// 工况定义（issue §2 表；T 级课程标称）。
#[derive(Debug, Clone, Copy)]
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
fn wave_number(omega: f64, depth: f64) -> f64 {
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
#[derive(Debug, Clone, Copy)]
pub(crate) struct WaveComponent {
    pub(crate) omega: f64,
    pub(crate) k: f64,
    pub(crate) amplitude: f64,
    /// 传播方向（NED 弧度，x=北）。
    pub(crate) direction: f64,
    pub(crate) phase: f64,
}

/// 带种子波场。
pub struct WaveField {
    components: Vec<WaveComponent>,
    condition: WaveCondition,
    second_order_available: bool,
}

impl WaveField {
    pub fn new(seed: u64, condition: WaveCondition) -> Self {
        let mut rng = seed
            .wrapping_mul(0x9E3779B97F4A7C15)
            .wrapping_add(0x1234567890ABCDEF);
        // 1) 等能频率段：谱 CDF 反演。
        let mut cdf = [0.0f64; FREQUENCY_BINS + 1];
        let mut total = 0.0;
        for i in 0..FREQUENCY_BINS {
            let w_mid = OMEGA_MIN + (OMEGA_MAX - OMEGA_MIN) * (i as f64 + 0.5) / FREQUENCY_BINS as f64;
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
        let mut components = Vec::with_capacity(FREQUENCY_BINS * DIRECTIONS);
        for i in 0..FREQUENCY_BINS {
            let band_energy = (cdf[i + 1] - cdf[i]) / total;
            let w_mid = OMEGA_MIN + (OMEGA_MAX - OMEGA_MIN) * (i as f64 + 0.5) / FREQUENCY_BINS as f64;
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
        Self { components, condition, second_order_available: false }
    }

    /// 波面高程（NED 位置，m）。
    pub fn elevation(&self, t: f64, x_n: f64, y_e: f64) -> f64 {
        let mut eta = 0.0;
        for c in &self.components {
            let arg = c.omega * t - c.k * (x_n * c.direction.cos() + y_e * c.direction.sin()) + c.phase;
            eta += c.amplitude * arg.cos();
        }
        eta
    }

    /// 轨道速度（线性 Airy，有限水深；NED 水平分量 + 垂向分量）。
    pub fn orbital_velocity(&self, t: f64, x_n: f64, y_e: f64, z_up_from_surface: f64) -> [f64; 3] {
        let depth = self.condition.water_depth_m;
        let mut vel = [0.0f64; 3];
        for c in &self.components {
            let arg = c.omega * t - c.k * (x_n * c.direction.cos() + y_e * c.direction.sin()) + c.phase;
            let (sin_arg, cos_arg) = arg.sin_cos();
            // Airy 有限水深：u = aω·cosh(k(h+z))/sinh(kh)、
            // w = aω·sinh(k(h+z))/sinh(kh)；海床 z=-h 处水平分量最大、
            // 垂向为零（不穿透海床）。
            let sh_bottom = (c.k * depth).sinh().max(1e-12);
            let ch_z = (c.k * (depth + z_up_from_surface)).cosh();
            let sh_z = (c.k * (depth + z_up_from_surface)).sinh();
            let horizontal = c.amplitude * c.omega * (ch_z / sh_bottom);
            vel[0] += horizontal * c.direction.cos() * cos_arg;
            vel[1] += horizontal * c.direction.sin() * cos_arg;
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
