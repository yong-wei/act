//! KVLCC2 MMG 标准模型基准（issue-2157 阶段B 路径 1）。
//!
//! 来源：Yasukawa & Yoshimura (2015)《Introduction of MMG standard method
//! for ship maneuvering predictions》J Mar Sci Technol 20:37-52，
//! DOI 10.1007/s00773-014-0293-y（开放获取；正文与表 1-7 提取件见
//! docs/research/kvlcc2/）。
//!
//! 合同（issue #2157 §2.1）：完整转录同一版本的主尺度、附加质量、船体
//! 导数、桨/舵互作用及试验条件；复现其回转与 Z 形操纵；不把 KVLCC2
//! 直接命名为 LNG 或 055。
//!
//! 模型（论文字号对应）：船体系原点取**船中**（式 1: v = vm + xG·r），
//! 耦合方程（式 4）、船体力（式 6/7）、推力与伴流（式 8-11、16）、
//! 舵力（式 18-25，uR 推导见附录式 39-46）。状态
//! x = [u, vm, r, x0, y0, psi, delta]（m/s、rad/s、m、rad）。

/// 表 1（实尺度 KVLCC2）。
pub const LPP: f64 = 320.0;
pub const B: f64 = 58.0;
pub const DRAFT: f64 = 20.8;
pub const VOLUME: f64 = 312_600.0;
pub const XG: f64 = 11.2; // m（船中前为正）
pub const CB: f64 = 0.810;
pub const DP: f64 = 9.86;
pub const HR: f64 = 15.80;
pub const AR: f64 = 112.5; // 可动部分侧影面积
pub const RHO: f64 = 1025.0;

/// 表 3 船体导数与互作用系数（L7/实尺度共用）。
pub const R0: f64 = 0.022; // 直航阻力系数（表 2；论文对 L7/实尺度另按 Schoenherr 外推，见模块文档）
pub const XVV: f64 = -0.040;
pub const XVR: f64 = 0.002;
pub const XRR: f64 = 0.011;
pub const XVVVV: f64 = 0.771;
pub const YV: f64 = -0.315;
pub const YR: f64 = 0.083;
pub const YVVV: f64 = -1.607;
pub const YVVR: f64 = 0.379;
pub const YVRR: f64 = -0.391;
pub const YRRR: f64 = 0.008;
pub const NV: f64 = -0.137;
pub const NR: f64 = -0.049;
pub const NVVV: f64 = -0.030;
pub const NVVR: f64 = -0.294;
pub const NVRR: f64 = 0.055;
pub const NRRR: f64 = -0.013;
pub const MX: f64 = 0.022;
pub const MY: f64 = 0.223;
pub const JZ: f64 = 0.011;
pub const TP: f64 = 0.220;
pub const TR: f64 = 0.387;
pub const AH: f64 = 0.312;
pub const XH: f64 = -0.464; // ×Lpp
pub const C1: f64 = 2.0;
pub const C2_BETA_POS: f64 = 1.6;
pub const C2_BETA_NEG: f64 = 1.1;
pub const GAMMA_R_BETA_NEG: f64 = 0.395;
pub const GAMMA_R_BETA_POS: f64 = 0.640;
pub const LR: f64 = -0.710; // ×Lpp
pub const EPSILON_R: f64 = 1.09;
pub const KAPPA_R: f64 = 0.50;
pub const F_ALPHA: f64 = 2.747; // = 6.13Λ/(Λ+2.25)（式 38）

/// §5.1 模拟条件（实尺度）。
pub const KT_POLY: [f64; 3] = [0.2931, -0.2753, -0.1385]; // k0,k1,k2
pub const WP0: f64 = 0.35; // 实尺度直航伴流
pub const U0: f64 = 15.5 * 0.5144; // 15.5 kn
pub const RUDDER_RATE_DEG_S: f64 = 1.76;
pub const YAW_GYRATION_RATIO: f64 = 0.25; // 回转半径 = 0.25·Lpp
pub const XP: f64 = -0.5; // 桨纵向位置（标准 MMG 取 −0.5·Lpp；论文未单列，文档声明）
pub const XR_POS: f64 = -0.5; // 舵纵向位置 −0.5·Lpp（§2.5）

/// 螺旋桨推力系数 KT(JP)（式 10）。
pub fn kt_of_jp(jp: f64) -> f64 {
    KT_POLY[0] + KT_POLY[1] * jp + KT_POLY[2] * jp * jp
}

/// 自航点转速：T(n) = R(U0)（直航平衡；二分求解）。
/// R = ½ρLdU0²·R0'（R0' 转录自表 2——论文对实尺度按 Schoenherr 外推，
/// 此处以表 2 值近似并显式声明，是本基准与论文 Cal 值的主要偏差源）。
pub fn self_propulsion_rps() -> f64 {
    let resistance = 0.5 * RHO * LPP * DRAFT * U0 * U0 * R0;
    let thrust_at = |n: f64| -> f64 {
        let jp = U0 * (1.0 - WP0) / (n * DP);
        RHO * n * n * DP.powi(4) * kt_of_jp(jp)
    };
    let (mut lo, mut hi) = (0.5f64, 5.0f64);
    for _ in 0..80 {
        let mid = 0.5 * (lo + hi);
        if thrust_at(mid) < resistance {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    0.5 * (lo + hi)
}

/// 状态导数：x = [u, vm, r, x0, y0, psi, delta]；输入 delta_target(rad)
/// 与 n_p(rps，恒转)。实现式 1-25。
pub fn derivative(x: &[f64; 7], delta_target: f64, n_p: f64) -> [f64; 7] {
    derivative_with(x, delta_target, n_p, WP0, R0)
}

/// 参数化导数（wp0/r0 可注入）：供敏感性对账与自航点再求解。
pub fn derivative_with(x: &[f64; 7], delta_target: f64, n_p: f64, wp0: f64, r0: f64) -> [f64; 7] {
    let (u, vm, r) = (x[0], x[1], x[2]);
    let psi = x[5];
    let delta = x[6];
    let speed = (u * u + vm * vm).sqrt().max(1e-3);

    // 舵机速率限（式 5.1 条件：1.76°/s 实尺度）。
    let rate = RUDDER_RATE_DEG_S * std::f64::consts::PI / 180.0;
    let mut delta_dot = delta_target - delta;
    if delta_dot.abs() > rate {
        delta_dot = delta_dot.signum() * rate;
    }

    // 无量纲量（式 6 记法）。
    let vm_p = vm / speed;
    let r_p = r * LPP / speed;
    let beta = (-vm / u).atan();
    let beta_p = beta - XP * r_p;
    let beta_r = beta - LR * r_p;

    // 伴流（式 16）与推力（式 8-11）。
    let c2 = if beta_p >= 0.0 { C2_BETA_POS } else { C2_BETA_NEG };
    let one_minus_wp = (1.0 - wp0) * (1.0 + (1.0 - (-C1 * beta_p.abs()).exp()) * (c2 - 1.0));
    let jp = u * one_minus_wp / (n_p * DP);
    let kt = kt_of_jp(jp);
    let thrust = RHO * n_p * n_p * DP.powi(4) * kt;
    let x_p = (1.0 - TP) * thrust;

    // 舵来流（式 19-25）与法向力。
    let gamma_r = if beta_r < 0.0 { GAMMA_R_BETA_NEG } else { GAMMA_R_BETA_POS };
    let eta = DP / HR;
    let u_r = EPSILON_R * u * one_minus_wp
        * (eta * (1.0 + KAPPA_R
            * ((1.0 + 8.0 * kt / (std::f64::consts::PI * jp * jp)).sqrt() - 1.0))
            .powi(2)
            + (1.0 - eta))
        .sqrt();
    let v_r = speed * gamma_r * beta_r;
    let u_r_safe = u_r.max(1e-3);
    // 论文式 21 采用线性化 αR ≈ δ − vR/uR（「≃」记号）；此处按源式实现。
    let alpha_r = delta - v_r / u_r_safe;
    let f_n = 0.5 * RHO * AR * (u_r * u_r + v_r * v_r) * F_ALPHA * alpha_r.sin();

    // 舵力（式 18）。
    let x_r_force = -(1.0 - TR) * f_n * delta.sin();
    let y_r_force = -(1.0 + AH) * f_n * delta.cos();
    let n_r_force = -(XR_POS + AH * XH) * LPP * f_n * delta.cos();

    // 船体力（式 6/7）。
    let q = 0.5 * RHO * LPP * DRAFT * speed * speed;
    let x_h = q * (-r0 + XVV * vm_p * vm_p + XVR * vm_p * r_p + XRR * r_p * r_p
        + XVVVV * vm_p.powi(4));
    let y_h = q * (YV * vm_p + YR * r_p + YVVV * vm_p.powi(3) + YVVR * vm_p * vm_p * r_p
        + YVRR * vm_p * r_p * r_p + YRRR * r_p.powi(3));
    let n_h = q * LPP * (NV * vm_p + NR * r_p + NVVV * vm_p.powi(3) + NVVR * vm_p * vm_p * r_p
        + NVRR * vm_p * r_p * r_p + NRRR * r_p.powi(3));

    let (fx, fy, nm) = (x_h + x_r_force + x_p, y_h + y_r_force, n_h + n_r_force);

    // 质量/惯量（实尺度；式 4 系数）。
    let m = RHO * VOLUME;
    let izg = m * (YAW_GYRATION_RATIO * LPP).powi(2);
    let a11 = m + MX * 0.5 * RHO * LPP * LPP * DRAFT; // m + mx（量纲化）
    let nd = 0.5 * RHO * LPP * LPP * DRAFT;
    let a22 = m + MY * nd;
    let a23 = XG * m;
    let a33 = izg + JZ * 0.5 * RHO * LPP.powi(4) * DRAFT + XG * XG * m;

    // 式 4 线性系统：
    // a11·u̇ − (m+my_d)·vm·r − xG·m·r² = X
    // a22·v̇m + (m+mx_d)·u·r + xG·m·ṙ = Y
    // a33·ṙ + xG·m·v̇m + xG·m·u·r = Nm
    let m_plus_my = a22;
    let m_plus_mx = a11;
    let b1 = fx + m_plus_my * vm * r + XG * m * r * r;
    let b2 = fy - m_plus_mx * u * r;
    let b3 = nm - XG * m * u * r;
    // 未知量 [u̇, v̇m, ṙ]：
    // a11·u̇ + 0·v̇ + 0·ṙ = b1
    // 0·u̇ + a22·v̇ + xG·m·ṙ = b2
    // 0·u̇ + xG·m·v̇ + a33·ṙ = b3
    let det = a22 * a33 - (XG * m) * (XG * m);
    let u_dot = b1 / a11;
    let vm_dot = (a33 * b2 - XG * m * b3) / det;
    let r_dot = (a22 * b3 - XG * m * b2) / det;

    [
        u_dot,
        vm_dot,
        r_dot,
        psi.cos() * u - psi.sin() * vm,
        psi.sin() * u + psi.cos() * vm,
        r,
        delta_dot,
    ]
}

/// RK4 单步。
pub fn rk4_step(x: &[f64; 7], h: f64, delta_target: f64, n_p: f64) -> [f64; 7] {
    let f = |s: &[f64; 7]| derivative(s, delta_target, n_p);

    let k1 = f(x);
    let mut s = *x;
    for i in 0..7 {
        s[i] += 0.5 * h * k1[i];
    }
    let k2 = f(&s);
    let mut s = *x;
    for i in 0..7 {
        s[i] += 0.5 * h * k2[i];
    }
    let k3 = f(&s);
    let mut s = *x;
    for i in 0..7 {
        s[i] += h * k3[i];
    }
    let k4 = f(&s);
    let mut out = *x;
    for i in 0..7 {
        out[i] += h / 6.0 * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]);
    }
    out
}
