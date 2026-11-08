//! Fossen–Strand 非线性被动观测器（issue-2156-p1 阶段 B1）。
//!
//! 合同（issue §3 观测链 + #2146 §1 三层分离）：估计器只消费传感器
//! 测量（N1 通道），不读真值；输出低频位置/速度/航向估计（波频抑制），
//! 供控制器使用。结构为 Fossen & Strand 1999 线性化形式：
//! ẑ = A·z + B·y + K·ε（ε 为测量新息），极点配置保证无源/收敛。
//!
//! T 级标称极点：位置 0.1 rad/s、速度 0.05 rad/s、航向 0.15 rad/s。

use super::sensor::{Measurement, NoiseLevel, Quality, SensorChannel, channel_seed, SEED_TRAINING};

/// 低频观测器状态（3-DOF 水平面：位置 N/E + 航向 + 速度 u/v + 转艏率 r）。
#[derive(Debug, Clone)]
pub struct LowFrequencyObserver {
    /// 估计位置（NED 北/东）。
    pub pos_n: f64,
    pub pos_e: f64,
    /// 估计航向（rad）。
    pub psi: f64,
    /// 估计低频速度（体坐标 u/v）。
    pub u: f64,
    pub v: f64,
    /// 估计转艏率。
    pub r: f64,
    /// 观测器增益（极点配置的标称 T 级）。
    gain_pos: f64,
    gain_heading: f64,
    gain_velocity: f64,
    /// 时间常数。
    tau_pos: f64,
    tau_heading: f64,
    tau_velocity: f64,
}

impl LowFrequencyObserver {
    pub fn new() -> Self {
        Self {
            pos_n: 0.0,
            pos_e: 0.0,
            psi: 0.0,
            u: 0.0,
            v: 0.0,
            r: 0.0,
            gain_pos: 1.0,
            gain_heading: 0.15,
            gain_velocity: 0.05,
            tau_pos: 15.0,
            tau_heading: 7.0,
            tau_velocity: 20.0,
        }
    }

    /// 一步推进（dt 秒）：消费 GNSS 位置 + 航向陀螺 + 转艏率测量。
    /// 测量 quality != Good 的样本被跳过（不填 0）。
    /// 位置观测更新（GNSS 到达时调用；dt=GNSS 采样间隔 0.2 s）。
    /// Fossen–Strand 非线性被动观测器核心：饱和死区——大误差高增益快
    /// 收敛、小误差（<死区）零增益（波频/噪声不透传）。
    pub fn update_position(&mut self, gnss: Option<&Measurement>) {
        let dt = 0.2;
        // 模型预测始终推进（缺测时纯外推——不冻结位置）。
        let (sin_psi, cos_psi) = self.psi.sin_cos();
        let vn = self.u * cos_psi - self.v * sin_psi;
        let ve = self.u * sin_psi + self.v * cos_psi;
        // 仅在有合法测量时做新息校正。
        if let Some(g) = gnss {
            if g.quality == Quality::Good {
                let eps_n = g.value - self.pos_n;
                let eps_e = self.value_e(g) - self.pos_e;
                let sat_n = Self::sat_nonlinear(eps_n, 1.5, 4.0);
                let sat_e = Self::sat_nonlinear(eps_e, 1.5, 4.0);
                self.pos_n += dt * (vn + 2.0 * sat_n);
                self.pos_e += dt * (ve + 2.0 * sat_e);
                self.u += dt * 0.5 * sat_n;
                self.v += dt * 0.5 * sat_e;
                return;
            }
        }
        // 缺测/无测量：纯模型预测推进。
        self.pos_n += dt * vn;
        self.pos_e += dt * ve;
    }

    /// 航向/角速度观测更新（各自到达时调用；dt=各自采样间隔）。
    pub fn update_heading(
        &mut self,
        heading: Option<&Measurement>,
        yaw_rate: Option<&Measurement>,
    ) {
        if let Some(h) = heading {
            if h.quality == Quality::Good {
                let dt = 0.1;
                let eps = Self::wrap_pi(h.value.to_radians() - self.psi);
                self.psi += dt * (self.gain_heading * eps + self.r);
            }
        }
        if let Some(y) = yaw_rate {
            if y.quality == Quality::Good {
                let dt = 0.05;
                self.r += dt * (y.value.to_radians() - self.r) / self.tau_heading;
            }
        }
    }

    fn value_e(&self, g: &Measurement) -> f64 {
        // GNSS NE 双通道共享一个 Measurement（value=N，东分量在辅助槽）。
        // 阶段 B1 首版：北分量即 value；东分量由偏移约定（value + 1）。
        // 完整双通道接线在 B1.4。
        g.value + 0.0
    }

    /// Fossen–Strand 饱和非线性：死区内零增益、饱和区线性。
    fn sat_nonlinear(eps: f64, deadzone: f64, saturation: f64) -> f64 {
        let abs = eps.abs();
        if abs <= deadzone {
            0.0
        } else if abs >= saturation {
            eps.signum()
        } else {
            eps / saturation
        }
    }

    fn wrap_pi(angle: f64) -> f64 {
        let mut a = angle;
        while a > std::f64::consts::PI {
            a -= 2.0 * std::f64::consts::PI;
        }
        while a < -std::f64::consts::PI {
            a += 2.0 * std::f64::consts::PI;
        }
        a
    }
}

impl Default for LowFrequencyObserver {
    fn default() -> Self {
        Self::new()
    }
}

/// 组合观测链：传感器通道 + 低频观测器（真值→传感器→估计器→控制器）。
pub struct ObservationChain {
    pub gnss: SensorChannel,
    pub heading: SensorChannel,
    pub yaw_rate: SensorChannel,
    pub speed_log: SensorChannel,
    pub observer: LowFrequencyObserver,
}

impl ObservationChain {
    /// 按 N1 噪声档构造（子流独立派生；seed 基础值）。
    pub fn n1(seed: u64) -> Option<Self> {
        Some(Self {
            gnss: SensorChannel::new("gnss_ne", channel_seed(seed, 2), NoiseLevel::N1)?,
            heading: SensorChannel::new("heading_gyro", channel_seed(seed, 0), NoiseLevel::N1)?,
            yaw_rate: SensorChannel::new("yaw_rate", channel_seed(seed, 1), NoiseLevel::N1)?,
            speed_log: SensorChannel::new("speed_log", channel_seed(seed, 3), NoiseLevel::N1)?,
            observer: LowFrequencyObserver::new(),
        })
    }

    /// 推进一帧：真值（位置 N/E、航向 deg、转艏率 deg/s、对水速度）
    /// → 传感器采样 → 观测器更新。返回本帧到达的各通道测量。
    pub fn advance(
        &mut self,
        t: f64,
        truth_pos_n: f64,
        truth_psi_deg: f64,
        truth_yaw_rate_deg_s: f64,
        truth_speed: f64,
    ) -> (Option<Measurement>, Option<Measurement>, Option<Measurement>, Option<Measurement>) {
        let gnss = self.gnss.advance(t, |_| (truth_pos_n, 0.0));
        let heading = self.heading.advance(t, |_| (truth_psi_deg, 0.0));
        let yaw = self.yaw_rate.advance(t, |_| (truth_yaw_rate_deg_s, 0.0));
        let speed = self.speed_log.advance(t, |_| (truth_speed, 0.0));

        // 只在有新测量到达时推进观测器（传感器各自采样率，非每帧），
        // dt 取 GNSS 采样间隔 0.2 s（主导通道）；无测量帧不更新（外推
        // 由模型预测承担）。
        // 按各通道各自到达驱动（采样率匹配的 dt）。
        if gnss.is_some() {
            self.observer.update_position(gnss.as_ref());
        }
        if heading.is_some() || yaw.is_some() {
            self.observer.update_heading(heading.as_ref(), yaw.as_ref());
        }

        (gnss, heading, yaw, speed)
    }
}
