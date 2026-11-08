//! 真实环境场状态（issue-2156-p1 阶段 B1.4）。
//!
//! 替换 T 级等效 EnvironmentField 的在线接入层：组合 wave.rs（种子
//! JONSWAP 波场）、wind.rs（Fujiwara 分量风载 + OU 阵风）、sensor.rs
//! （N1 观测链）和恒定均匀流，由 plant 的 derivs 按物理时间消费。
//!
//! 合同（issue §1/§2）：E1 = W1 + V1 + C1（教学组合工况）；因素开关
//! 分离（wind_force_enabled / wave_enabled / current_enabled 独立）。

use super::wave::{WaveCondition, WaveField};
use super::wind::{GustProcess, TrueWind, WindEnvironment, WindHullGeometry};
use super::observer::ObservationChain;

/// 环境因素开关（独立消融；关任何因素不删其他机制）。
#[derive(Debug, Clone, Copy, Default)]
pub struct EnvironmentSwitches {
    pub wind_force_enabled: bool,
    pub wave_enabled: bool,
    pub current_enabled: bool,
}

impl EnvironmentSwitches {
    pub fn all_on() -> Self {
        Self { wind_force_enabled: true, wave_enabled: true, current_enabled: true }
    }
    pub fn all_off() -> Self {
        Self { wind_force_enabled: false, wave_enabled: false, current_enabled: false }
    }
}

/// 真实环境场（组合 wave + wind + current + 观测链）。
pub struct EnvironmentState {
    pub switches: EnvironmentSwitches,
    /// 种子化波场（JONSWAP 多向）。
    pub wave: WaveField,
    /// 真风 + 阵风过程。
    pub wind: WindEnvironment,
    pub gust: GustProcess,
    /// 恒定均匀流（NED，体坐标由 plant 转换）。
    pub current_ned: [f64; 2],
    /// 观测链（真值→传感器→估计器；供控制器读测量）。
    pub observation: Option<ObservationChain>,
    /// 传感器开关（N0/N1/N2；None=阶段 A 兼容，不接观测链）。
    pub sensor_enabled: bool,
    seed: u64,
}

impl EnvironmentState {
    /// E1 组合工况：W1（8m/s FROM 60°）+ V1（Hs .75m Tp 7s TO 90°）+ C1（.3 m/s TO 90°）。
    pub fn e1(seed: u64) -> Self {
        Self::new(
            seed,
            EnvironmentSwitches::all_on(),
            WaveCondition::v1(),
            8.0, 60.0, 1.0,  // W1: 8 m/s FROM 60°, sigma 1 m/s
            0.3, 90.0,         // C1: 0.3 m/s TO 90°
        )
    }

    /// 平静环境（P0：全部关闭；物理机制保留）。
    pub fn calm(seed: u64) -> Self {
        Self::new(
            seed,
            EnvironmentSwitches::all_off(),
            WaveCondition::v1(),
            0.0, 0.0, 0.0,
            0.0, 0.0,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn new(
        seed: u64,
        switches: EnvironmentSwitches,
        wave_condition: WaveCondition,
        wind_speed_mps: f64,
        wind_from_deg: f64,
        gust_sigma_mps: f64,
        current_speed_mps: f64,
        current_to_deg: f64,
    ) -> Self {
        let wind_from = wind_from_deg.to_radians();
        // TO 语义：流矢量 = (cos, sin)·speed（流向哪里）。
        let current_to = current_to_deg.to_radians();
        Self {
            switches,
            wave: WaveField::new(seed, wave_condition),
            wind: WindEnvironment {
                true_wind: TrueWind {
                    speed_mps: wind_speed_mps,
                    from_deg: wind_from_deg,
                    gust_ned: [0.0, 0.0],
                },
                wind_force_enabled: true, // 开关由 EnvironmentSwitches 统一控制
            },
            gust: GustProcess::new(seed, gust_sigma_mps, 10.0),
            current_ned: [
                current_speed_mps * current_to.cos(),
                current_speed_mps * current_to.sin(),
            ],
            observation: ObservationChain::n1(seed),
            sensor_enabled: true,
            seed,
        }
    }

    /// 推进到物理时间 t：更新阵风并注入真风。
    pub fn advance_to(&mut self, t: f64) {
        if self.switches.wind_force_enabled {
            self.gust.advance_to(t);
            let gust = self.gust.components();
            self.wind.true_wind.gust_ned = gust;
        }
    }

    /// 波浪一阶激励（同相位共用波场；系数由船参数包给）。
    pub fn wave_loads(&self, t: f64, coefficients: [f64; 6]) -> [f64; 6] {
        if !self.switches.wave_enabled {
            return [0.0; 6];
        }
        self.wave.first_order_loads(t, coefficients)
    }

    /// 风载：以统一 EnvironmentSwitches 为准（调用方改 switches 即时生效，
    /// 不依赖 WindEnvironment 内部副本——消融开关单一真源）。
    pub fn wind_loads(&self, yaw_rad: f64, nu_body: [f64; 6], geo: &WindHullGeometry) -> [f64; 6] {
        if !self.switches.wind_force_enabled {
            return [0.0; 6];
        }
        self.wind.loads(yaw_rad, nu_body, geo)
    }

    /// 体坐标流（从 NED 转到 FRD；恒定均匀流零导数）。
    pub fn current_body(&self, yaw_rad: f64) -> [f64; 2] {
        if !self.switches.current_enabled {
            return [0.0, 0.0];
        }
        let (sin_y, cos_y) = yaw_rad.sin_cos();
        [
            self.current_ned[0] * cos_y + self.current_ned[1] * sin_y,
            -self.current_ned[0] * sin_y + self.current_ned[1] * cos_y,
        ]
    }

    /// 观测链推进（传感器采样+观测器更新）。
    pub fn advance_observation(
        &mut self,
        t: f64,
        pos_n: f64,
        psi_deg: f64,
        yaw_rate_deg_s: f64,
        speed: f64,
    ) {
        if !self.sensor_enabled {
            return;
        }
        if let Some(chain) = self.observation.as_mut() {
            chain.advance(t, pos_n, psi_deg, yaw_rate_deg_s, speed);
        }
    }

    /// 低频估计器读数（控制器只读估计，不读真值）。
    pub fn estimated_position(&self) -> Option<(f64, f64, f64)> {
        self.observation.as_ref().map(|c| (c.observer.pos_n, c.observer.pos_e, c.observer.psi))
    }

    pub fn seed(&self) -> u64 {
        self.seed
    }
}
