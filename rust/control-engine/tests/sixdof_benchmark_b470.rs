//! Wageningen B4-70 四象限基准算例（issue-2157 阶段B 路径 4）。
//!
//! 交叉验证锚点：Smogeli (2006) 表 A.1（van Lammeren 1969 参数化）的
//! 名义/倒车系数与系桩工况。

use control_engine::sixdof::benchmark_b470::*;

const RHO: f64 = 1025.0;

#[test]
fn nominal_bollard_coefficients_match_table_a1() {
    // 系桩（Ja=0 → β=0）：KT0=0.445、KQ0=0.0666（表 A.1）。
    let (ct0, cq0) = four_quadrant_coefficients(0.0);
    let (kt0, kq0) = kt_kq_from_ct_cq(ct0, cq0, 0.0);
    assert!(
        (kt0 - KT0_NOMINAL).abs() / KT0_NOMINAL < 0.005,
        "KT0：{kt0} vs {KT0_NOMINAL}"
    );
    assert!(
        (kq0 - KQ0_NOMINAL).abs() / KQ0_NOMINAL < 0.005,
        "KQ0：{kq0} vs {KQ0_NOMINAL}"
    );
}

#[test]
fn reverse_bollard_coefficients_match_table_a1() {
    // 倒车系桩：n<0、Va=0 → β=atan2(0,负)=π；|KT0r|=0.347、|KQ0r|=0.0628。
    let beta = advance_angle_beta(0.0, -2.0, DIAMETER_M);
    assert!((beta - std::f64::consts::PI).abs() < 1e-12, "β 应为 π：{beta}");
    let (ct_pi, cq_pi) = four_quadrant_coefficients(std::f64::consts::PI);
    let (ktr, kqr) = kt_kq_from_ct_cq(ct_pi, cq_pi, 0.0);
    assert!(
        (ktr.abs() - KT0_REVERSE).abs() / KT0_REVERSE < 0.01,
        "|KT0r|：{} vs {KT0_REVERSE}",
        ktr.abs()
    );
    assert!(
        (kqr.abs() - KQ0_REVERSE).abs() / KQ0_REVERSE < 0.01,
        "|KQ0r|：{} vs {KQ0_REVERSE}",
        kqr.abs()
    );
    // 倒车系桩推力为负（向后）。
    assert!(ktr < 0.0, "倒车推力应为负：{ktr}");
}

#[test]
fn bollard_pull_cross_validates_table_a1() {
    // 系桩工况：n=2.05 rps、Va=0 → T≈490 kN、Q≈295 kNm（表 A.1）。
    let (t, q) = propeller_loads_b470(DIAMETER_M, 0.0, BOLLARD_SHAFT_RPS, RHO);
    assert!(
        (t - BOLLARD_PULL_N).abs() / BOLLARD_PULL_N < 0.02,
        "系桩推力：{t} vs {BOLLARD_PULL_N}"
    );
    assert!(
        (q - BOLLARD_TORQUE_NM).abs() / BOLLARD_TORQUE_NM < 0.02,
        "系桩扭矩：{q} vs {BOLLARD_TORQUE_NM}"
    );
    // 系桩功率 ≈ 2πnQ ≈ 3800 kW（表 A.1 交叉）。
    let power_w = 2.0 * std::f64::consts::PI * BOLLARD_SHAFT_RPS * q;
    assert!(
        (power_w - 3800.0e3).abs() / 3800.0e3 < 0.03,
        "系桩功率：{power_w} vs 3.8e6"
    );
}

#[test]
fn kt_conversion_is_dimensionally_consistent() {
    // 由量纲载荷反推的 KT 与式 2.37 转换一致（前进象限）。
    let (va, n) = (4.0f64, 2.0f64);
    let (t, _q) = propeller_loads_b470(DIAMETER_M, va, n, RHO);
    let kt_from_loads = t / (RHO * n * n * DIAMETER_M.powi(4));
    let beta = advance_angle_beta(va, n, DIAMETER_M);
    let (ct, _) = four_quadrant_coefficients(beta);
    let ja = va / (n * DIAMETER_M);
    let (kt_formula, _) = kt_kq_from_ct_cq(ct, 0.0, ja);
    assert!(
        (kt_from_loads - kt_formula).abs() < 1e-12,
        "KT 双口径：{kt_from_loads} vs {kt_formula}"
    );
}

#[test]
fn continuous_at_zero_shaft_speed_and_zero_inflow() {
    // n→0（固定 Va）：载荷连续（无跳变）；n=0、Va=0 → 严格零。
    let va = 3.0f64;
    let (t_pos, q_pos) = propeller_loads_b470(DIAMETER_M, va, 1e-9, RHO);
    let (t_neg, q_neg) = propeller_loads_b470(DIAMETER_M, va, -1e-9, RHO);
    // 单侧极限在 n→0 收敛（相对差 ~1e-9；δβ~1e-9 rad 经 Fourier 导数放大）。
    assert!(
        (t_pos - t_neg).abs() / t_pos.abs().max(1.0) < 1e-6,
        "n→0⁺/⁻ 极限一致：{t_pos} vs {t_neg}"
    );
    let (t0, q0) = propeller_loads_b470(DIAMETER_M, 0.0, 0.0, RHO);
    assert_eq!((t0, q0), (0.0, 0.0), "零速零流入严格零");
    // n=0、Va≠0：纯阻力象限载荷有限（β=π/2）。
    let (t_windmill, _) = propeller_loads_b470(DIAMETER_M, va, 0.0, RHO);
    assert!(t_windmill.is_finite() && t_windmill < 0.0, "风车状态推力为负（吸收）：{t_windmill}");
}

#[test]
fn four_quadrant_sign_coherence() {
    // 前进象限（n>0, Va=0）正推力；倒车（n<0）推力反号；
    // 完全倒航（n>0, Va<0）进入第四象限（β<0），推力可变号但载荷有限。
    let (t_ahead, _) = propeller_loads_b470(DIAMETER_M, 0.0, 2.0, RHO);
    let (t_astern, _) = propeller_loads_b470(DIAMETER_M, 0.0, -2.0, RHO);
    assert!(t_ahead > 0.0, "正车系桩正推力：{t_ahead}");
    assert!(t_astern < 0.0, "倒车系桩负推力：{t_astern}");
    for va in [-8.0f64, -4.0, -1.0] {
        let (t, q) = propeller_loads_b470(DIAMETER_M, va, 2.0, RHO);
        assert!(t.is_finite() && q.is_finite(), "倒航 Va={va} 载荷有限");
    }
}

#[test]
fn coefficients_are_finite_and_series_bounded() {
    // 系数表完整性（与表 A.3 一致的量级带）；CT/CQ 在 β 全周期有界。
    for array in [AT, BT, AQ, BQ] {
        assert!(array.iter().all(|v| v.is_finite() && v.abs() < 1.0));
    }
    let mut max_ct = 0.0f64;
    let mut max_cq = 0.0f64;
    for i in 0..720 {
        let beta = i as f64 * std::f64::consts::PI / 360.0;
        let (ct, cq) = four_quadrant_coefficients(beta);
        max_ct = max_ct.max(ct.abs());
        max_cq = max_cq.max(cq.abs());
    }
    // 图 2.2 量级：CT ∈ [−0.4, 1.0]、10CQ 峰 ~1.5（即 CQ ~0.15）。
    assert!(max_ct < 1.5 && max_cq < 0.16, "级数有界：CT={max_ct}, CQ={max_cq}");
    assert!(max_ct > 0.4, "CT 峰值应达正车量级：{max_ct}");
}
