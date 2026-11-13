//! S175 集装箱船转向—横摇耦合基准模型（issue-2157 阶段B 路径 2）。
//!
//! 来源：MSS `CRAFT/SHIP/models/container.m`（Son & Nomoto 1982，
//! J.S.N.A. Japan Vol.150 1981 / NA&OE 20:73-83），上游修订
//! `e8ab42a105cd`（2026-11-08 master）；逐行对应移植，含源文件的历史
//! 修订语义（my=0.007049 为 2001-07-20 修订值）。
//!
//! 合同（issue #2157 §2.2）：对照源实现全部参数、初值及输入，逐通道
//! 复现（tests/fixtures/s175_golden.csv 为 Octave 同源黄金轨迹）。
//! L=175m/B=25.4m/d=8.5m 等只属于基准；源程序的前进航速/转速限制不能
//! 原样冒充靠泊或倒航能力。状态
//! x = [u v r x y psi p phi delta n]（m/s、rad、m、rad、rad/s、rad、rad、rpm），
//! 输入 ui = [delta_c(rad) n_c(rpm)]。

/// 主尺度与常量（container.m L40-L73；g=9.81、ρ=1025 来自 mssConstants）。
pub const L: f64 = 175.0;
pub const B: f64 = 25.40;
pub const DF: f64 = 8.00;
pub const DA: f64 = 9.00;
pub const D_DRAFT: f64 = 8.50;
pub const NABLA: f64 = 21222.0;
pub const KM: f64 = 10.39;
pub const KB: f64 = 4.6154;
pub const AR: f64 = 33.0376;
pub const DELTA_TUNNEL: f64 = 1.8219;
pub const D_PROP: f64 = 6.533;
pub const GM: f64 = 0.3 / L;
pub const RHO: f64 = 1025.0;
pub const G: f64 = 9.81;
pub const T_THRUST: f64 = 0.175;
pub const TAU: f64 = 0.0005;
pub const DELTA_MAX_DEG: f64 = 10.0;
pub const DDELTA_MAX_DEG_S: f64 = 5.0;
pub const N_MAX_RPM: f64 = 160.0;

/// 无量纲质量/惯量（container.m L61-64）。
pub const M: f64 = 0.00792;
pub const MX: f64 = 0.000238;
pub const MY: f64 = 0.007049;
pub const IX: f64 = 0.0000176;
pub const ALPHAY: f64 = 0.05;
pub const LX: f64 = 0.0313;
pub const LY: f64 = 0.0313;
pub const IZ: f64 = 0.000456;
pub const JX: f64 = 0.0000034;
pub const JZ: f64 = 0.000419;
pub const X_G: f64 = 0.0;

/// 船体水动力导数（container.m L75-91）。
pub const XUU: f64 = -0.0004226;
pub const XVR: f64 = -0.00311;
pub const XRR: f64 = 0.00020;
pub const XPHIPHI: f64 = -0.00020;
pub const XVV: f64 = -0.00386;

pub const KV: f64 = 0.0003026;
pub const KR: f64 = -0.000063;
pub const KP: f64 = -0.0000075;
pub const KPHI: f64 = -0.000021;
pub const KVVV: f64 = 0.002843;
pub const KRRR: f64 = -0.0000462;
pub const KVVR: f64 = -0.000588;
pub const KVRR: f64 = 0.0010565;
pub const KVVPHI: f64 = -0.0012012;
pub const KVPHIPHI: f64 = -0.0000793;
pub const KRRPHI: f64 = -0.000243;
pub const KRPHIPHI: f64 = 0.00003569;

pub const YV: f64 = -0.0116;
pub const YR: f64 = 0.00242;
pub const YP: f64 = 0.0;
pub const YPHI: f64 = -0.000063;
pub const YVVV: f64 = -0.109;
pub const YRRR: f64 = 0.00177;
pub const YVVR: f64 = 0.0214;
pub const YVRR: f64 = -0.0405;
pub const YVVPHI: f64 = 0.04605;
pub const YVPHIPHI: f64 = 0.00304;
pub const YRRPHI: f64 = 0.009325;
pub const YRPHIPHI: f64 = -0.001368;

pub const NV: f64 = -0.0038545;
pub const NR: f64 = -0.00222;
pub const NP: f64 = 0.000213;
pub const NPHI: f64 = -0.0001424;
pub const NVVV: f64 = 0.001492;
pub const NRRR: f64 = -0.00229;
pub const NVVR: f64 = -0.0424;
pub const NVRR: f64 = 0.00156;
pub const NVVPHI: f64 = -0.019058;
pub const NVPHIPHI: f64 = -0.0053766;
pub const NRRPHI: f64 = -0.0038592;
pub const NRPHIPHI: f64 = 0.0024195;

/// 桨/舵互作用与整流系数（container.m L93-98）。
pub const KK: f64 = 0.631;
pub const EPSILON: f64 = 0.921;
pub const X_R: f64 = -0.5;
pub const WP: f64 = 0.184;
pub const TAU_PROPELLER: f64 = 1.09;
pub const XP: f64 = -0.526;
pub const CPV: f64 = 0.0;
pub const CPR: f64 = 0.0;
pub const GA: f64 = 0.088;
pub const C_RR: f64 = -0.156;
pub const C_RRRR: f64 = -0.275;
pub const C_RRV: f64 = 1.96;
pub const C_RX: f64 = 0.71;
pub const A_H: f64 = 0.237;
pub const Z_R: f64 = 0.033;
pub const X_H: f64 = -0.48;

/// 最短圆周角归一（与 LIBRARY/kinematics/ssa.m 同语义）。
pub fn ssa(angle: f64) -> f64 {
    angle - 2.0 * std::f64::consts::PI * ((angle + std::f64::consts::PI)
        / (2.0 * std::f64::consts::PI))
    .floor()
}

/// container.m 状态导数（10 维；ui=[delta_c rad, n_c rpm]，量纲同源）。
/// 逐行对应：L41 U、L109-131 饱和与轴动态、L134-141 桨舵流动、
/// L144-157 广义力、L160-171 耦合质量矩阵解与运动学。
pub fn derivative(x: &[f64; 10], ui: [f64; 2]) -> [f64; 10] {
    let speed = (x[0] * x[0] + x[1] * x[1]).sqrt();
    assert!(speed > 0.0, "源模型要求航速>0（container.m L44）");
    assert!(x[9] > 0.0, "源模型要求转速>0（container.m L45）");

    // 无量纲化（L53-58）。
    let mut delta_c = ui[0];
    let mut n_c = ui[1] / 60.0 * L / speed;
    let u = x[0] / speed;
    let v = x[1] / speed;
    let p = x[6] * L / speed;
    let r = x[2] * L / speed;
    let phi = x[7];
    let psi = x[5];
    let delta = x[8];
    let mut n = x[9] / 60.0 * L / speed;

    // 恢复量纲 W（L73）。
    let w = RHO * G * NABLA / (RHO * L * L * speed * speed / 2.0);

    // 舵饱和与速率限（L109-116）。
    if delta_c.abs() >= DELTA_MAX_DEG * std::f64::consts::PI / 180.0 {
        delta_c = delta_c.signum() * DELTA_MAX_DEG * std::f64::consts::PI / 180.0;
    }
    let mut delta_dot = delta_c - delta;
    if delta_dot.abs() >= DDELTA_MAX_DEG_S * std::f64::consts::PI / 180.0 {
        delta_dot = delta_dot.signum() * DDELTA_MAX_DEG_S * std::f64::consts::PI / 180.0;
    }

    // 轴速饱和与一阶动态（L118-131；回到 rps 后限幅与 Tm 分段）。
    n_c = n_c * speed / L;
    n = n * speed / L;
    if n_c.abs() >= N_MAX_RPM / 60.0 {
        n_c = n_c.signum() * N_MAX_RPM / 60.0;
    }
    let t_m = if n > 0.3 { 5.65 / n } else { 18.83 };
    let n_dot = 1.0 / t_m * (n_c - n) * 60.0;

    // 桨舵局部流动（L134-141）。
    let v_r = GA * v + C_RR * r + C_RRRR * r * r * r + C_RRV * r * r * v;
    let u_p = u * ((1.0 - WP) + TAU_PROPELLER * ((v + XP * r) * (v + XP * r) + CPV * v + CPR * r));
    let j = u_p * speed / (n * D_PROP);
    let kt = 0.527 - 0.455 * j;
    let u_r = u_p * EPSILON * (1.0 + 8.0 * KK * KT_PI_DIV * kt / (std::f64::consts::PI * j * j)).sqrt();
    let alpha_r = delta + (v_r / u_r).atan();
    let f_n = -((6.13 * DELTA_TUNNEL) / (DELTA_TUNNEL + 2.25)) * (AR / (L * L)) * (u_r * u_r + v_r * v_r) * alpha_r.sin();
    let thrust = 2.0 * D_PROP.powi(4) / (speed * speed * L * L) * kt * n * n.abs();

    // 广义力（L144-157；忠实保留源表达式含 (m+my)·v·r 项）。
    let x_force = XUU * u * u + (1.0 - T_THRUST) * thrust + XVR * v * r + XVV * v * v
        + XRR * r * r + XPHIPHI * phi * phi
        + C_RX * f_n * delta.sin() + (M + MY) * v * r;
    let y_force = YV * v + YR * r + YP * p + YPHI * phi + YVVV * v.powi(3) + YRRR * r.powi(3)
        + YVVR * v * v * r + YVRR * v * r * r + YVVPHI * v * v * phi + YVPHIPHI * v * phi * phi
        + YRRPHI * r * r * phi + YRPHIPHI * r * phi * phi
        + (1.0 + A_H) * f_n * delta.cos() - (M + MX) * u * r;
    let k_force = KV * v + KR * r + KP * p + KPHI * phi + KVVV * v.powi(3) + KRRR * r.powi(3)
        + KVVR * v * v * r + KVRR * v * r * r + KVVPHI * v * v * phi + KVPHIPHI * v * phi * phi
        + KRRPHI * r * r * phi + KRPHIPHI * r * phi * phi
        - (1.0 + A_H) * Z_R * f_n * delta.cos() + MX * LX * u * r - w * GM * phi;
    let n_force = NV * v + NR * r + NP * p + NPHI * phi + NVVV * v.powi(3) + NRRR * r.powi(3)
        + NVVR * v * v * r + NVRR * v * r * r + NVVPHI * v * v * phi + NVPHIPHI * v * phi * phi
        + NRRPHI * r * r * phi + NRPHIPHI * r * phi * phi
        + (X_R + A_H * X_H) * f_n * delta.cos();

    // 耦合质量矩阵（L100-106、L160）与状态导数（L162-171）。
    let m11 = M + MX;
    let m22 = M + MY;
    let m32 = -MY * LY;
    let m42 = MY * ALPHAY;
    let m33 = IX + JX;
    let m44 = IZ + JZ;
    let det_m = m22 * m33 * m44 - m32 * m32 * m44 - m42 * m42 * m33;

    [
        x_force * (speed * speed / L) / m11,
        -((-m33 * m44 * y_force + m32 * m44 * k_force + m42 * m33 * n_force) / det_m)
            * (speed * speed / L),
        ((-m42 * m33 * y_force + m32 * m42 * k_force + n_force * m22 * m33 - n_force * m32 * m32)
            / det_m)
            * (speed * speed / (L * L)),
        (psi.cos() * u - psi.sin() * phi.cos() * v) * speed,
        (psi.sin() * u + psi.cos() * phi.cos() * v) * speed,
        phi.cos() * r * (speed / L),
        ((-m32 * m44 * y_force + k_force * m22 * m44 - k_force * m42 * m42 + m32 * m42 * n_force)
            / det_m)
            * (speed * speed / (L * L)),
        p * (speed / L),
        delta_dot,
        n_dot,
    ]
}

/// uR 公式中的 KT 比例（保持与源一致的运算次序：8·kk·KT）。
const KT_PI_DIV: f64 = 1.0;

/// RK4 单步（与 LIBRARY/numericalMethods/rk4.m 相同权重）。
pub fn rk4_step(x: &[f64; 10], h: f64, ui: [f64; 2]) -> [f64; 10] {
    let f = |s: &[f64; 10]| derivative(s, ui);
    let k1 = f(x);
    let mut s2 = *x;
    for i in 0..10 {
        s2[i] += h / 2.0 * k1[i];
    }
    let k2 = f(&s2);
    let mut s3 = *x;
    for i in 0..10 {
        s3[i] += h / 2.0 * k2[i];
    }
    let k3 = f(&s3);
    let mut s4 = *x;
    for i in 0..10 {
        s4[i] += h * k3[i];
    }
    let k4 = f(&s4);
    let mut out = *x;
    for i in 0..10 {
        out[i] += h / 6.0 * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]);
    }
    out
}
