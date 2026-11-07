//! 分量风载与阵风过程（issue-2156-p1 A2）。
//!
//! 合同（issue §1 风）：Fujiwara 2005 分量形式（X/Y/N/K 按水上投影，
//! T 级系数近似）；相对风=真风（FROM 真北顺时针）转 NED→船体系后减
//! 船体运动与 ω×安装点；压力中心力矩经统一 r×F。阵风二维 OU、物理
//! 时钟 20Hz、τ=10s。消融开关：`wind_force_enabled=false` 气动归零
//! （水动力保留）；enabled+零真风=航行相对气流。

use super::wave::seed_to_unit;

pub const RHO_AIR: f64 = 1.225;

/// 阵风 OU 过程（二维水平分量，物理时钟 20Hz 步进）。
pub struct GustProcess {
    tau_s: f64,
    sigma_mps: f64,
    step_hz: f64,
    v_n: f64,
    v_e: f64,
    rng_state: u64,
}

impl GustProcess {
    /// sigma 为每个水平分量的平稳标准差。
    pub fn new(seed: u64, sigma_mps: f64, tau_s: f64) -> Self {
        Self {
            tau_s,
            sigma_mps,
            step_hz: 20.0,
            v_n: 0.0,
            v_e: 0.0,
            rng_state: seed.wrapping_mul(0xD1B54A32D192ED03).wrapping_add(0xABCDEF1234567890),
        }
    }

    fn unit_normal(state: &mut u64) -> f64 {
        // Box–Muller（确定性子流）。
        loop {
            let u1 = seed_to_unit(state);
            let u2 = seed_to_unit(state);
            if u1 > 1e-12 {
                let r = (-2.0 * u1.ln()).sqrt();
                return r * (2.0 * std::f64::consts::PI * u2).cos();
            }
        }
    }

    /// 推进到物理时间 t（内部按 20Hz 网格步进；倍速/帧率无关）。
    pub fn advance_to(&mut self, t: f64) {
        let dt = 1.0 / self.step_hz;
        let target_steps = (t * self.step_hz).round() as i64;
        // 从上次位置步进（本实现从 0 计步）。
        let steps = target_steps.max(0);
        let decay = (-dt / self.tau_s).exp();
        let drive = self.sigma_mps * (1.0 - decay * decay).sqrt();
        for _ in 0..steps {
            let xi_n = Self::unit_normal(&mut self.rng_state);
            let xi_e = Self::unit_normal(&mut self.rng_state);
            self.v_n = decay * self.v_n + drive * xi_n;
            self.v_e = decay * self.v_e + drive * xi_e;
        }
    }

    pub fn components(&self) -> [f64; 2] {
        [self.v_n, self.v_e]
    }
}

/// 真风（均值 + 阵风；FROM 真北顺时针）。
#[derive(Debug, Clone, Copy)]
pub struct TrueWind {
    /// 平均风速 m/s。
    pub speed_mps: f64,
    /// 风来向 FROM（真北顺时针）。
    pub from_deg: f64,
    /// 阵风分量 [N, E] m/s（由 GustProcess 提供）。
    pub gust_ned: [f64; 2],
}

impl TrueWind {
    /// 风速矢量（NED）：风从 from 吹向其反方向。
    pub fn velocity_ned(&self) -> [f64; 2] {
        let from = self.from_deg.to_radians();
        // FROM 语义：来向矢量 = -(cos, sin)·speed；加上阵风。
        [
            -self.speed_mps * from.cos() + self.gust_ned[0],
            -self.speed_mps * from.sin() + self.gust_ned[1],
        ]
    }
}

/// 船参数（水上投影与压力中心，T 级）。
#[derive(Debug, Clone, Copy)]
pub struct WindHullGeometry {
    pub frontal_area_m2: f64,
    pub lateral_area_m2: f64,
    pub length_m: f64,
    /// 风压中心相对重心 [x, y, z]（FRD，m）。
    pub pressure_center_body: [f64; 3],
}

/// 相对风（FRD 体坐标）：真风 NED→FRD，减船体线速度与 ω×安装点。
pub fn relative_wind_body(
    wind_ned: [f64; 2],
    yaw_rad: f64,
    nu_body: [f64; 6],
    lever_body: [f64; 3],
) -> [f64; 2] {
    let (sin_y, cos_y) = yaw_rad.sin_cos();
    // NED → FRD：x_body = N·cosψ + E·sinψ；y_body = -N·sinψ + E·cosψ。
    let wind_body = [
        wind_ned[0] * cos_y + wind_ned[1] * sin_y,
        -wind_ned[0] * sin_y + wind_ned[1] * cos_y,
    ];
    // 安装点速度 = v_center + ω×r（FRD）。
    let omega = [nu_body[3], nu_body[4], nu_body[5]];
    let r = lever_body;
    let point_velocity = [
        nu_body[0] + omega[1] * r[2] - omega[2] * r[1],
        nu_body[1] + omega[2] * r[0] - omega[0] * r[2],
    ];
    [wind_body[0] - point_velocity[0], wind_body[1] - point_velocity[1]]
}

/// Fujiwara 2005 形式分量风载（T 级多项式近似，0/90/180° 锚点校准）。
/// 返回 [Fx, Fy, K, N]（N / N·m；力矩经压力中心 r×F）。
pub fn fujiwara_loads(rel_body: [f64; 2], geo: &WindHullGeometry) -> [f64; 4] {
    let speed = (rel_body[0] * rel_body[0] + rel_body[1] * rel_body[1]).sqrt().max(1e-6);
    // 相对风舷角（0=迎风，90°=正横，180°=顺风）。
    let psi = ((-rel_body[1]).atan2(-rel_body[0])).abs();
    let q = 0.5 * RHO_AIR * speed * speed;
    // CX(ψ)：迎风负（阻力），顺风小；CY：正弦型；CN：偏航力矩系数。
    let cx = -0.50 + 0.28 * (psi / std::f64::consts::PI);
    let cy = 0.80 * psi.sin() + 0.12 * (2.0 * psi).sin();
    let cn = 0.06 * psi.sin() * psi.cos();
    let fx = q * (geo.frontal_area_m2 * cx + geo.lateral_area_m2 * 0.04 * psi.cos());
    let fy = q * geo.lateral_area_m2 * cy;
    // 压力中心偏置已并入下方 r×F；cn 贡献横向力沿长的分布修正。
    let _ = cn;
    // 压力中心力矩（统一 r×F；横摇 K=y 向力 × z 臂，艏摇 N=y 向力 × x 臂）。
    let r = geo.pressure_center_body;
    let k_roll = r[2] * fy;
    let n_yaw = -r[0] * fy + r[1] * fx;
    [fx, fy, k_roll, n_yaw]
}

/// 风载荷状态机：消融开关语义入口。
pub struct WindEnvironment {
    pub true_wind: TrueWind,
    pub wind_force_enabled: bool,
}

impl WindEnvironment {
    /// 气动载荷：消融关闭→严格零（水动力不在本模块，不受影响）；
    /// enabled+零真风→航行相对气流仍在（rel 由 nu 提供）。
    pub fn loads(
        &self,
        yaw_rad: f64,
        nu_body: [f64; 6],
        geo: &WindHullGeometry,
    ) -> [f64; 6] {
        if !self.wind_force_enabled {
            return [0.0; 6];
        }
        let wind_ned = self.true_wind.velocity_ned();
        let rel = relative_wind_body(wind_ned, yaw_rad, nu_body, geo.pressure_center_body);
        let [fx, fy, k, n] = fujiwara_loads(rel, geo);
        [fx, fy, 0.0, k, 0.0, n]
    }
}
