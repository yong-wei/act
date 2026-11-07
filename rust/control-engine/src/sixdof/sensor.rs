//! 真值→传感器→控制器观测链（issue-2156-p1 A3）。
//!
//! 合同（issue §3）：安装点量测→离散采样→白噪→偏置 OU（按采样 dt 精确
//! 离散）→量化→时延队列→`(t_sample, t_arrive, quality)`。N1 九通道按表；
//! N0 保留 API 仅关误差；N2 误差×2。故障：F1 航向偏置斜坡、F2 GNSS 缺失
//! （不填 0）、F3 推进扭矩归零（轴系续走由 plant 物理承担）、F4 吊舱角度
//! 冻结。低风速方向无定义→quality 未定义。表值 T 级课程标称。

use std::collections::VecDeque;

use super::wave::{seed_to_unit, split_mix64};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Quality {
    Good,
    /// 缺测（不产生 0 值样本）。
    Missing,
    /// 方向无定义（低风速风传感器）。
    Undefined,
}

#[derive(Debug, Clone, Copy)]
pub struct Measurement {
    pub t_sample_s: f64,
    pub t_arrive_s: f64,
    pub value: f64,
    pub quality: Quality,
}

/// 噪声档位：N0 无误差保 API / N1 表值 / N2 ×2。
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum NoiseLevel {
    N0,
    N1,
    N2,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FaultKind {
    /// F1：t0 起 1 s 内航向偏置线性升至 2°。
    HeadingBiasRamp { t_start: f64 },
    /// F2：窗口内缺测（不填 0、不自动回读真值）。
    GnssOutage { t_start: f64, t_end: f64 },
}

#[derive(Debug, Clone, Copy)]
struct ChannelSpec {
    rate_hz: f64,
    white_sigma: f64,
    bias_sigma: f64,
    bias_tau_s: f64,
    delay_s: f64,
    quant: f64,
}

/// N1 表（issue §3；sigma=离散样本标准差）。
const SPECS: &[(&str, ChannelSpec)] = &[
    ("heading_gyro", ChannelSpec { rate_hz: 10.0, white_sigma: 0.10, bias_sigma: 0.05, bias_tau_s: 300.0, delay_s: 0.10, quant: 0.01 }),
    ("yaw_rate", ChannelSpec { rate_hz: 20.0, white_sigma: 0.02, bias_sigma: 0.005, bias_tau_s: 300.0, delay_s: 0.05, quant: 0.001 }),
    ("gnss_ne", ChannelSpec { rate_hz: 5.0, white_sigma: 0.5, bias_sigma: 0.2, bias_tau_s: 300.0, delay_s: 0.20, quant: 0.01 }),
    ("speed_log", ChannelSpec { rate_hz: 5.0, white_sigma: 0.03, bias_sigma: 0.01, bias_tau_s: 300.0, delay_s: 0.20, quant: 0.001 }),
    ("imu_pq", ChannelSpec { rate_hz: 50.0, white_sigma: 0.02, bias_sigma: 0.005, bias_tau_s: 300.0, delay_s: 0.02, quant: 0.001 }),
    ("imu_specific_force", ChannelSpec { rate_hz: 50.0, white_sigma: 0.01, bias_sigma: 0.005, bias_tau_s: 300.0, delay_s: 0.02, quant: 0.001 }),
    ("encoder", ChannelSpec { rate_hz: 50.0, white_sigma: 0.05, bias_sigma: 0.0, bias_tau_s: 300.0, delay_s: 0.02, quant: 0.01 }),
    ("wind", ChannelSpec { rate_hz: 2.0, white_sigma: 0.3, bias_sigma: 0.1, bias_tau_s: 300.0, delay_s: 0.5, quant: 0.1 }),
    ("shaft_speed", ChannelSpec { rate_hz: 20.0, white_sigma: 0.2, bias_sigma: 0.0, bias_tau_s: 300.0, delay_s: 0.05, quant: 0.1 }),
];

/// 单传感器通道：采样、误差链与时延队列。
pub struct SensorChannel {
    spec: ChannelSpec,
    level: NoiseLevel,
    rng_state: u64,
    bias: f64,
    last_sample_t: f64,
    queue: VecDeque<Measurement>,
    fault: Option<FaultKind>,
    /// 风传感器辅助：低于该风速方向无定义（m/s）。
    wind_undefined_below_mps: f64,
    /// 通道值单位为角度系（deg）时参与 F1。
    heading_channel: bool,
    gnss_channel: bool,
}

impl SensorChannel {
    /// `name` 取 SPECS 键；`stream_seed` 为该通道独立子流种子。
    pub fn new(name: &str, stream_seed: u64, level: NoiseLevel) -> Option<Self> {
        let spec = SPECS.iter().find(|(key, _)| *key == name).map(|(_, spec)| *spec)?;
        let scale = match level {
            NoiseLevel::N0 => 0.0,
            NoiseLevel::N1 => 1.0,
            NoiseLevel::N2 => 2.0,
        };
        Some(Self {
            spec: ChannelSpec {
                white_sigma: spec.white_sigma * scale,
                bias_sigma: spec.bias_sigma * scale,
                ..spec
            },
            level,
            rng_state: stream_seed
                .wrapping_mul(0x5851F42D4C957F2D)
                .wrapping_add(0x2545F4914F6CDD1D),
            bias: 0.0,
            last_sample_t: f64::NEG_INFINITY,
            queue: VecDeque::new(),
            fault: None,
            wind_undefined_below_mps: 1.0,
            heading_channel: name == "heading_gyro",
            gnss_channel: name == "gnss_ne",
        })
    }

    pub fn set_fault(&mut self, fault: Option<FaultKind>) {
        self.fault = fault;
    }

    fn unit_normal(&mut self) -> f64 {
        loop {
            let u1 = seed_to_unit(&mut self.rng_state);
            let u2 = seed_to_unit(&mut self.rng_state);
            if u1 > 1e-12 {
                return (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos();
            }
        }
    }

    /// 推进到 t：按通道频率采样真值 `truth(t)`，经误差链与时延队列。
    /// 返回本次到达（t_arrive ≤ t）的测量；无到达返回 None。
    pub fn advance<F: Fn(f64) -> (f64, f64)>(&mut self, t: f64, truth: F) -> Option<Measurement> {
        let dt = 1.0 / self.spec.rate_hz;
        let next_t = if self.last_sample_t.is_finite() {
            self.last_sample_t + dt
        } else {
            0.0
        };
        if t + 1e-9 < next_t {
            return self.deliver(t);
        }
        let mut t_sample = next_t.max(0.0);
        while t_sample <= t + 1e-9 {
            // 偏置 OU（按采样 dt 精确离散）。
            let decay = (-dt / self.spec.bias_tau_s).exp();
            let drive = self.spec.bias_sigma * (1.0 - decay * decay).sqrt();
            self.bias = decay * self.bias + drive * self.unit_normal();
            let (raw, aux_wind_speed) = truth(t_sample);
            // 故障注入。
            let mut quality = Quality::Good;
            let mut value = raw;
            if let Some(fault) = self.fault {
                match fault {
                    FaultKind::HeadingBiasRamp { t_start } if self.heading_channel => {
                        let ramp = ((t_sample - t_start) / 1.0).clamp(0.0, 1.0);
                        value += 2.0 * ramp;
                    }
                    FaultKind::GnssOutage { t_start, t_end }
                        if self.gnss_channel && t_sample >= t_start && t_sample <= t_end =>
                    {
                        // 缺测：不产生样本值（不填 0）。
                        self.queue.push_back(Measurement {
                            t_sample_s: t_sample,
                            t_arrive_s: t_sample + self.spec.delay_s,
                            value: f64::NAN,
                            quality: Quality::Missing,
                        });
                        self.last_sample_t = t_sample;
                        t_sample += dt;
                        continue;
                    }
                    _ => {}
                }
            }
            // 风方向低风速未定义。
            if self.wind_undefined_below_mps > 0.0 && aux_wind_speed < self.wind_undefined_below_mps {
                quality = Quality::Undefined;
            }
            let noisy = value + self.bias + self.spec.white_sigma * self.unit_normal();
            let quantized = if self.spec.quant > 0.0 {
                (noisy / self.spec.quant).round() * self.spec.quant
            } else {
                noisy
            };
            self.queue.push_back(Measurement {
                t_sample_s: t_sample,
                t_arrive_s: t_sample + self.spec.delay_s,
                value: quantized,
                quality,
            });
            self.last_sample_t = t_sample;
            t_sample += dt;
        }
        self.deliver(t)
    }

    fn deliver(&mut self, t: f64) -> Option<Measurement> {
        let front = *self.queue.front()?;
        if front.t_arrive_s <= t + 1e-9 {
            self.queue.pop_front();
            Some(front)
        } else {
            None
        }
    }

    pub fn level(&self) -> NoiseLevel {
        self.level
    }

    pub fn rate_hz(&self) -> f64 {
        self.spec.rate_hz
    }
}

/// 训练/验证种子（issue §2）。
pub const SEED_TRAINING: u64 = 20261106;
pub const SEEDS_VALIDATION: [u64; 3] = [17, 29, 43];

/// 子流派生：base → channel 专属流（稳定；关噪声不消费子流即不影响其他流）。
pub fn channel_seed(base: u64, channel_index: usize) -> u64 {
    let mut state = base
        .wrapping_mul(0x9E3779B97F4A7C15)
        .wrapping_add((channel_index as u64).wrapping_mul(0x100000001B3));
    split_mix64(&mut state)
}
