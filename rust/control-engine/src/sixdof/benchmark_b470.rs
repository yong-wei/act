//! Wageningen B4-70 四象限推进基准（issue-2157 阶段B 路径 4）。
//!
//! 来源：Smogeli (2006)《Control of Marine Propellers》§2.1.2 与附录 A
//! 表 A.3（Fourier 系数取自 van Lammeren et al. 1969），论文见
//! docs/research/smogeli-b470/（NTNU PhD 2006:187，ISBN 82-471-8147-9）。
//!
//! 合同（issue #2157 §2.4）：β = atan2(Va, 0.7πnD)（atan2 保证倒车
//! 进入正确的 Fourier 象限）；CT/CQ 为 20 阶 Fourier 级数（k=0…20，
//! 零基索引）；轴向相对流速与转速符号贯通；n→0/Va→0 连续；不把
//! 前进象限 KT(J) 二次式外推至倒航，不将 FPP 系列不同 P/D 误当单
//! CPP 变螺距（本表仅对应附录 A 的单一定义）。
//!
//! 模型（Smogeli 2006 式 2.31-2.38）：
//! - V0.7² = Va² + (0.7πnD)²（0.7R 处叶片相对流速）
//! - CT(β) = Σₖ AT(k)cos kβ + BT(k)sin kβ；CQ(β) 同理
//! - Ta = ½ρ(π/4)D²·V0.7²·CT；Qa = ½ρ(π/4)D³·V0.7²·CQ
//! - KT = CT·(π/8)(Ja² + 0.49π²)；KQ = CQ·(π/8)(Ja² + 0.49π²)

/// Fourier 系数 AT(k)，k=0…20（表 A.3 逐值转录）。
pub const AT: [f64; 21] = [
    2.5350e-02, 1.7820e-01, 1.4674e-02, 2.8054e-02, -1.6328e-02,
    -5.3041e-02, 6.0605e-04, 3.6823e-02, -2.5429e-03, -1.7680e-02,
    2.7331e-03, 2.1436e-02, -2.4782e-03, 1.2317e-03, 5.0980e-03,
    7.8076e-03, -3.7816e-03, 3.5353e-03, 5.3014e-03, 2.1940e-03,
    -2.8306e-03,
];

/// Fourier 系数 BT(k)。
pub const BT: [f64; 21] = [
    0.0000e-00, -7.4777e-01, -1.3822e-02, 1.0077e-01, -1.1318e-02,
    4.7186e-02, 1.0666e-02, -9.0239e-03, -7.8452e-03, 2.3941e-02,
    8.0787e-03, -1.4942e-04, -3.1925e-03, 9.2620e-03, 1.5527e-03,
    -6.5683e-03, -6.1655e-04, 5.1033e-03, -6.0263e-04, -8.2244e-03,
    -6.3789e-04,
];

/// Fourier 系数 AQ(k)。
pub const AQ: [f64; 21] = [
    2.4645e-03, 2.6718e-02, 1.6056e-03, 6.5822e-03, -2.2497e-03,
    -7.8062e-03, 2.4126e-04, 6.1475e-03, -1.6065e-03, -3.3291e-03,
    1.2311e-03, 3.1123e-03, -1.2559e-03, 1.3948e-03, 8.8397e-04,
    5.0358e-05, -7.9990e-04, 1.3345e-03, 1.1928e-03, -1.3556e-04,
    -7.0825e-04,
];

/// Fourier 系数 BQ(k)。
pub const BQ: [f64; 21] = [
    0.0000e-00, -1.1081e-01, 1.5909e-04, 1.6455e-02, -2.0601e-03,
    8.5343e-03, 8.7856e-04, -3.1327e-03, -9.6650e-04, 4.3190e-03,
    1.2453e-03, 9.5986e-05, -7.9986e-04, 1.5073e-03, 2.4595e-04,
    -1.6918e-03, 5.1603e-04, 1.1504e-03, -4.7976e-04, -1.4566e-03,
    2.3280e-04,
];

/// 表 A.1 主参数（4MW 示例推进单元；交叉验证用）。
pub const DIAMETER_M: f64 = 4.0;
pub const KT0_NOMINAL: f64 = 0.445;
pub const KQ0_NOMINAL: f64 = 0.0666;
pub const KT0_REVERSE: f64 = 0.347;
pub const KQ0_REVERSE: f64 = 0.0628;
pub const BOLLARD_PULL_N: f64 = 490.0e3;
pub const BOLLARD_TORQUE_NM: f64 = 295.0e3;
pub const BOLLARD_SHAFT_RPS: f64 = 2.05;

/// 进角 β = atan2(Va, 0.7πnD)（atan2：n<0 时进入正确的倒车象限；
/// n=0 → ±π/2 或 0，连续极限）。
pub fn advance_angle_beta(va_mps: f64, n_rps: f64, diameter_m: f64) -> f64 {
    va_mps.atan2(0.7 * std::f64::consts::PI * n_rps * diameter_m)
}

/// 20 阶 Fourier 级数系数 CT(β)、CQ(β)（式 2.34/2.35）。
pub fn four_quadrant_coefficients(beta_rad: f64) -> (f64, f64) {
    let mut ct = 0.0;
    let mut cq = 0.0;
    for k in 0..=20 {
        let (sin_kb, cos_kb) = (k as f64 * beta_rad).sin_cos();
        ct += AT[k] * cos_kb + BT[k] * sin_kb;
        cq += AQ[k] * cos_kb + BQ[k] * sin_kb;
    }
    (ct, cq)
}

/// 四象限桨载荷（推力 N、扭矩 N·m）。n=0、Va=0 连续归零；
/// 转速符号贯通（n<0 → 倒车象限）。
pub fn propeller_loads_b470(
    diameter_m: f64,
    va_mps: f64,
    n_rps: f64,
    water_density: f64,
) -> (f64, f64) {
    let v07_sq = va_mps * va_mps
        + (0.7 * std::f64::consts::PI * n_rps * diameter_m).powi(2);
    let beta = advance_angle_beta(va_mps, n_rps, diameter_m);
    let (ct, cq) = four_quadrant_coefficients(beta);
    let scale = 0.5 * water_density * (std::f64::consts::PI / 4.0) * v07_sq;
    (scale * diameter_m * diameter_m * ct, scale * diameter_m.powi(3) * cq)
}

/// 无量纲转换（式 2.37/2.38）：KT/KQ ↔ CT/CQ（Ja = Va/(nD)）。
pub fn kt_kq_from_ct_cq(ct: f64, cq: f64, ja: f64) -> (f64, f64) {
    let factor = (std::f64::consts::PI / 8.0)
        * (ja * ja + 0.49 * std::f64::consts::PI * std::f64::consts::PI);
    (ct * factor, cq * factor)
}
