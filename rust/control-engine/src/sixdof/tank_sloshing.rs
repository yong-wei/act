//! 液舱晃荡模态内核（issue-2154 液货耦合）。
//!
//! 合同（issue #2154 §2 液货）：每舱保留纵/横第一对流模态 q 及 q̇，
//! ωn²=g·k·tanh(k·h)，横向 k=π/38、纵向 k=π/44（等效矩形舱 44×38×26m
//! 的第一反对称模态）；模态质量与等效作用高度按 NASA SP-106 矩形
//! 容器公式计算；阻尼比 T 级 0.03（校核域 0.02–0.08）；运动激励来自
//! 液舱位置的真实 6DOF 加速度；反力/力矩回到船体；**静态自由液面
//! 稳性修正与模态恢复统一推导，不能双减 GM**——本内核的一阶模态
//! 在静倾斜极限下精确承载 96/π⁴≈98.55% 的平面倾斜自由液面矩
//! （推导见下），其余 1.45% 属高阶模态，调用方不得再叠加全量
//! ΔGM 修正。超出线性小幅适用域时由调用方标记「冲击未建模/超出域」。
//!
//! 势流精确推导（矩形容器，宽 b、实长 L⊥、充液深 h、密度 ρ）：
//! - 波形 η(x,t)=q·sin(kx)，k=π/b（壁面 |η| 最大、中剖面零）
//! - φ=(q̇/k)·cosh(k(z+h))/sinh(kh)·sin(kx)
//! - 模态质量 m*=ρ·L⊥·b·coth(kh)/(2k)；ω²=g·k·tanh(kh) ✓（与 issue 公式一致）
//! - 舱横加速度 a_t 投影强迫：q̈+ω²q=−Γ·a_t，Γ=4·tanh(kh)/(k·b)
//! - 互易性（拉格朗日一致性）：Γ = c/m*，模态反力系数 c=2ρL⊥/k²
//! - 等效作用高度（自由液面下）：z_p=tanh(kh/2)/k（壁压合力矩推导）
//! - 静倾斜极限：q_ss=−4a_t/(gk²b) = 平面倾斜 η=−(a_t/g)x 的一阶
//!   投影；反力矩/精确自由液面矩 = 96/π⁴

/// 单舱单方向第一晃荡模态（横向或纵向切片）。
#[derive(Debug, Clone, Copy)]
pub struct SloshingMode {
    /// 波数 k=π/b（rad/m）。
    pub k: f64,
    /// 充液深度 h（m）。
    pub fill_depth_m: f64,
    /// 液体密度（kg/m³）。
    pub density: f64,
    /// 垂直于激励方向的舱长 L⊥（m）。
    pub span_m: f64,
    /// 固有频率（rad/s）。
    pub omega_n: f64,
    /// 阻尼比（T 级 0.03）。
    pub damping_ratio: f64,
    /// 强迫系数 Γ（无量纲，=c/m*）。
    pub forcing_gamma: f64,
    /// 模态反力系数 c=2ρL⊥/k²（kg）。
    pub reaction_coupling: f64,
    /// 等效作用高度（自由液面下，m）。
    pub action_height_m: f64,
    /// 模态质量 m*（kg，供能量校核）。
    pub modal_mass: f64,
}

impl SloshingMode {
    /// 按容器几何与充液构造（NASA SP-106 矩形容器第一反对称模态）。
    /// `excite_width_m` 为**激励方向**的舱宽 b（横向 38 / 纵向 44），
    /// `span_m` 为垂直方向舱长。
    pub fn new(
        excite_width_m: f64,
        span_m: f64,
        fill_depth_m: f64,
        density: f64,
        damping_ratio: f64,
    ) -> Result<Self, String> {
        if !(excite_width_m > 0.0 && span_m > 0.0 && fill_depth_m > 0.0 && density > 0.0) {
            return Err("舱几何/充液/密度须为正".into());
        }
        if !(0.0..=0.2).contains(&damping_ratio) {
            return Err(format!("阻尼比 {damping_ratio} 超出物理域 (0,0.2]"));
        }
        let k = std::f64::consts::PI / excite_width_m;
        let g = 9.81;
        let th = (k * fill_depth_m).tanh();
        let omega_n = (g * k * th).sqrt();
        let forcing_gamma = 4.0 * th / (k * excite_width_m);
        let reaction_coupling = 2.0 * density * span_m / (k * k);
        let action_height_m = (0.5 * k * fill_depth_m).tanh() / k;
        let coth_kh = 1.0 / (k * fill_depth_m).tanh();
        let modal_mass = density * span_m * excite_width_m * coth_kh / (2.0 * k);
        Ok(Self {
            k,
            fill_depth_m,
            density,
            span_m,
            omega_n,
            damping_ratio,
            forcing_gamma,
            reaction_coupling,
            action_height_m,
            modal_mass,
        })
    }

    /// 模态状态导数：激励为舱体横加速度 a_t（m/s²，沿激励方向）。
    /// 返回 (q̇, q̈)。
    pub fn step_derivatives(&self, q: f64, q_dot: f64, a_t: f64) -> (f64, f64) {
        let q_ddot = -self.forcing_gamma * a_t
            - 2.0 * self.damping_ratio * self.omega_n * q_dot
            - self.omega_n * self.omega_n * q;
        (q_dot, q_ddot)
    }

    /// 模态反力（N，作用于船体的**附加**力，不含已计入刚体质量的
    /// 冻结液质量惯性 −m_F·a_t）：F = −c·q̈。
    pub fn reaction_force_n(&self, q_ddot: f64) -> f64 {
        -self.reaction_coupling * q_ddot
    }

    /// 模态对自由液面高度轴的附加力矩（N·m，正号约定与反力同向）：
    /// M = −c·z_p·q̈（等效作用高度 z_p 于液面下方）。
    pub fn reaction_moment_about_surface_nm(&self, q_ddot: f64) -> f64 {
        -self.reaction_coupling * self.action_height_m * q_ddot
    }
}

/// LNG 四等效矩形液舱参数（issue #2154 §2：44×38×26m、ρ=450、
/// 填充率基准 .85 / 变体 .30/.70/.95）。
pub const LNG_TANK_L_M: f64 = 44.0;
pub const LNG_TANK_B_M: f64 = 38.0;
pub const LNG_TANK_H_M: f64 = 26.0;
pub const LNG_CARGO_DENSITY: f64 = 450.0;
pub const LNG_FILL_BASE: f64 = 0.85;
pub const LNG_FILL_VARIANTS: [f64; 3] = [0.30, 0.70, 0.95];
pub const SLOSHING_DAMPING_T: f64 = 0.03;

/// 一舱双方向模态（横/纵）+ 6DOF 反力合成。
///
/// 输入为舱体坐标系线加速度（ax 沿舱横向、ay 沿舱纵向——应用时由
/// 船体系 6DOF 加速度经舱位力臂转换）与两模态状态；输出附加力与
/// 对舱自由液面中点的力矩（船体系合成由调用方叠加舱位几何）。
#[derive(Debug, Clone, Copy)]
pub struct TankSloshing {
    /// 横向模态（激励沿舱宽 38m 方向）。
    pub transverse: SloshingMode,
    /// 纵向模态（激励沿舱长 44m 方向）。
    pub longitudinal: SloshingMode,
}

impl TankSloshing {
    /// LNG 标准舱（44×38×26m、ρ=450、ζ=0.03）按填充率构造。
    pub fn lng(fill_ratio: f64) -> Result<Self, String> {
        if !(0.05..=0.98).contains(&fill_ratio) {
            return Err(format!("填充率 {fill_ratio} 超出适用域 [0.05,0.98]"));
        }
        let fill = fill_ratio * LNG_TANK_H_M;
        Ok(Self {
            transverse: SloshingMode::new(
                LNG_TANK_B_M, LNG_TANK_L_M, fill, LNG_CARGO_DENSITY, SLOSHING_DAMPING_T,
            )?,
            longitudinal: SloshingMode::new(
                LNG_TANK_L_M, LNG_TANK_B_M, fill, LNG_CARGO_DENSITY, SLOSHING_DAMPING_T,
            )?,
        })
    }

    /// 双模态状态导数：a_trans/a_long 为舱体沿两方向的线加速度。
    pub fn step_derivatives(
        &self,
        q_t: f64,
        qd_t: f64,
        a_trans: f64,
        q_l: f64,
        qd_l: f64,
        a_long: f64,
    ) -> (f64, f64, f64, f64) {
        let (d1, a1) = self.transverse.step_derivatives(q_t, qd_t, a_trans);
        let (d2, a2) = self.longitudinal.step_derivatives(q_l, qd_l, a_long);
        (d1, a1, d2, a2)
    }

    /// 附加力/力矩（横、纵两方向反力 + 各自对液面中点力矩）：
    /// 返回 [F_trans, F_long, M_trans, M_long]。
    pub fn reactions(&self, qddot_t: f64, qddot_l: f64) -> [f64; 4] {
        [
            self.transverse.reaction_force_n(qddot_t),
            self.longitudinal.reaction_force_n(qddot_l),
            self.transverse.reaction_moment_about_surface_nm(qddot_t),
            self.longitudinal.reaction_moment_about_surface_nm(qddot_l),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lng_mode_frequencies_are_physical() {
        // 基准 .85 填充：横/纵一阶周期 6-9s 量级（教学量级核）。
        let tank = TankSloshing::lng(LNG_FILL_BASE).unwrap();
        let t_t = 2.0 * std::f64::consts::PI / tank.transverse.omega_n;
        let t_l = 2.0 * std::f64::consts::PI / tank.longitudinal.omega_n;
        assert!(t_t > 5.0 && t_t < 9.0, "横向周期：{t_t}s");
        assert!(t_l > 5.0 && t_l < 10.0, "纵向周期：{t_l}s");
        // 浅充液频率更低（tanh 减小）。
        let shallow = TankSloshing::lng(0.30).unwrap();
        assert!(shallow.transverse.omega_n < tank.transverse.omega_n);
        // 深充液趋于 √(gk)。
        let deep = SloshingMode::new(38.0, 44.0, 260.0, 450.0, 0.03).unwrap();
        let k = std::f64::consts::PI / 38.0;
        assert!((deep.omega_n - (9.81 * k).sqrt()).abs() < 1e-6);
    }

    #[test]
    fn reciprocity_gamma_equals_coupling_over_modal_mass() {
        let m = SloshingMode::new(38.0, 44.0, 22.1, 450.0, 0.03).unwrap();
        assert!(
            (m.forcing_gamma - m.reaction_coupling / m.modal_mass).abs() < 1e-9,
            "互易性 Γ=c/m*：{} vs {}",
            m.forcing_gamma,
            m.reaction_coupling / m.modal_mass
        );
    }

    #[test]
    fn energy_conserved_in_free_decay() {
        // ζ=0 自由衰减：E=½m*q̇²+½m*ω²q² 守恒（RK4 细步）。
        let mut m = SloshingMode::new(38.0, 44.0, 22.1, 450.0, 0.0).unwrap();
        m.damping_ratio = 0.0;
        let (mut q, mut qd) = (0.5f64, 0.0f64);
        let e0 = 0.5 * m.modal_mass * qd * qd
            + 0.5 * m.modal_mass * m.omega_n * m.omega_n * q * q;
        let h = 0.001;
        for _ in 0..20_000 {
            let (_, a1) = m.step_derivatives(q, qd, 0.0);
            let (_, a2) = m.step_derivatives(q + 0.5 * h * qd, qd + 0.5 * h * a1, 0.0);
            let (_, a3) = m.step_derivatives(q + 0.5 * h * (qd + 0.5 * h * a1), qd + 0.5 * h * a2, 0.0);
            let (_, a4) = m.step_derivatives(q + h * (qd + 0.5 * h * a2), qd + h * a3, 0.0);
            q += h / 6.0 * (qd + 2.0 * (qd + 0.5 * h * a1) + 2.0 * (qd + 0.5 * h * a2) + (qd + h * a3));
            qd += h / 6.0 * (a1 + 2.0 * a2 + 2.0 * a3 + a4);
        }
        let e1 = 0.5 * m.modal_mass * qd * qd
            + 0.5 * m.modal_mass * m.omega_n * m.omega_n * q * q;
        assert!((e1 - e0).abs() / e0 < 1e-6, "能量守恒：{e0} → {e1}");
    }

    #[test]
    fn static_tilt_covers_96_over_pi4_of_free_surface_moment() {
        // 恒定横加速度 a_t：稳态 q_ss=−Γa/ω²；反力矩（静倾部分经
        // 恢复项折算）与精确平面倾斜自由液面矩之比 = 96/π⁴。
        // 静稳态力矩：M_static = c·Γ·a_t/ω²·g·(投影系数)... 直接推导：
        // 稳态下壁面分布的等效恢复力矩 = c·z_p·0（q̈=0），静倾斜力矩
        // 由恢复项承载：M = m*·ω²·q_ss·z_p_eff。以液面中点矩推导值
        // M_1 = 8ρL⊥a_t/k⁴b⁴·b³... 用一阶投影精确比：
        let m = SloshingMode::new(38.0, 44.0, 22.1, 450.0, 0.03).unwrap();
        let a_t = 0.5f64;
        // 一阶模态静力矩（关于液面中点，由平面倾斜一阶投影）：
        let q_ss = -m.forcing_gamma * a_t / (m.omega_n * m.omega_n);
        // 平面倾斜一阶投影矩 M_1 = ρgL⊥·q_ss·∫sin(kx)·x dx = ρgL⊥q_ss·2/k²。
        let m1 = m.density * m.span_m * 9.81 * q_ss * 2.0 / (m.k * m.k);
        // 精确自由液面矩 M_exact = ρ·a_t·b³L⊥/12。
        let b = std::f64::consts::PI / m.k;
        let m_exact = m.density * a_t * b.powi(3) * m.span_m / 12.0;
        // 幅值比较（符号：恢复力矩方向与 a_t 相反——稳性恢复语义）。
        let ratio = m1.abs() / m_exact;
        assert!(
            (ratio - 96.0 / std::f64::consts::PI.powi(4)).abs() < 1e-9,
            "一阶承载比：{ratio} vs 96/π⁴"
        );
        assert!(m1 * a_t < 0.0, "静倾力矩应抵抗横加速度（恢复方向）");
    }

    #[test]
    fn resonance_amplitude_bounded_by_damping() {
        // 谐波激励于 ω_n：稳态幅值 = Γ·a/(2ζω²)（品质因数校核）。
        let m = SloshingMode::new(38.0, 44.0, 22.1, 450.0, 0.03).unwrap();
        let a0 = 0.2f64;
        let expected = m.forcing_gamma * a0 / (2.0 * m.damping_ratio * m.omega_n * m.omega_n);
        let (mut q, mut qd) = (0.0f64, 0.0f64);
        let mut peak_amp = 0.0f64;
        let h = 0.002;
        for i in 0..80_000 {
            let t = i as f64 * h;
            let acc = |tt: f64| a0 * (m.omega_n * tt).sin();
            let (_, a1) = m.step_derivatives(q, qd, acc(t));
            let (_, a2) = m.step_derivatives(q + 0.5 * h * qd, qd + 0.5 * h * a1, acc(t + 0.5 * h));
            let (_, a3) = m.step_derivatives(q + 0.5 * h * (qd + 0.5 * h * a1), qd + 0.5 * h * a2, acc(t + 0.5 * h));
            let (_, a4) = m.step_derivatives(q + h * (qd + 0.5 * h * a2), qd + h * a3, acc(t + h));
            q += h / 6.0 * (qd + 2.0 * (qd + 0.5 * h * a1) + 2.0 * (qd + 0.5 * h * a2) + (qd + h * a3));
            qd += h / 6.0 * (a1 + 2.0 * a2 + 2.0 * a3 + a4);
            if i > 70_000 {
                peak_amp = peak_amp.max(q.abs());
            }
        }
        // 稳态峰值幅值（末端相位任意，取最后数周最大值）在期望 ±25% 内。
        let _ = q;
        let peak = peak_amp;
        assert!(
            peak > 0.75 * expected && peak < 1.25 * expected,
            "共振峰值幅值：{peak} vs 期望 {expected}"
        );
    }

    #[test]
    fn invalid_geometry_rejected() {
        assert!(SloshingMode::new(-38.0, 44.0, 20.0, 450.0, 0.03).is_err());
        assert!(SloshingMode::new(38.0, 44.0, 0.0, 450.0, 0.03).is_err());
        assert!(SloshingMode::new(38.0, 44.0, 20.0, 450.0, 0.5).is_err());
        assert!(TankSloshing::lng(0.99).is_err(), "填充率超出适用域");
    }
}
