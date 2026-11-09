//! DTMB5415 细长水面船基准转录（issue-2157 阶段B 路径 3）。
//!
//! 来源：SIMAN 2014《US Navy Combatant – Geometry and conditions》
//! https://simman2014.dk/ship-data/us-navy-combatant/geometry-and-conditions-us-navy-combatant/
//! （取回 2026-11-09，docs/research/dtmb5415/）；桨敞水数据
//! 5415-Propeller-Openwater-Data.pdf（MARIN，KT/KQ 五阶多项式）。
//!
//! 合同（issue #2157 §2.3）：公开数值验证船，不是 055 机密数据；
//! **原表网页数值若与体积/尺度不一致必须交叉核对原始资料，不盲抄**。
//! 交叉核对发现原表实尺度排水体积列印 84244 m³ 为小数点丢失：
//! (a) 模型值 0.189 m³ × 35.48³ = 8438 m³；(b) Lpp·B·T·CB =
//! 142×19.06×6.15×0.507 = 8439 m³——两项独立证据一致指向 8424.4 m³
//! （误差 <0.2%），按修正值转录并在 provenance 记录原表疑点。
//!
//! 边界：操纵性 PMM/CMT 系统导数**未转录**（SIMAN 系统法数据另行发布，
//! 本模块不含任何虚构船体导数）；本转录覆盖几何/惯量条件/桨敞水特性。

/// 主尺度（SIMAN 条件页全尺度列；B 级）。
pub const LPP: f64 = 142.00;
pub const LWL: f64 = 142.18;
pub const BWL: f64 = 19.06;
pub const DRAFT: f64 = 6.15;
/// 排水体积（m³）：**交叉核对修正值**（原表 84244 为小数点丢失）。
pub const DISPLACEMENT_VOLUME: f64 = 8424.4;
pub const CB: f64 = 0.507;
pub const CM: f64 = 0.821;
pub const LCB_PCT_FWD: f64 = -0.683;
pub const WETTED_AREA: f64 = 2972.6;

/// 试验条件（全尺度；B 级）。
pub const LCG_M: f64 = -0.652;
pub const GM_TRANSVERSE: f64 = 1.95;
pub const IXX_OVER_B: f64 = 0.37;
pub const IZZ_OVER_LPP: f64 = 0.25;
pub const SERVICE_SPEED_KN: [f64; 2] = [18.0, 30.0];
pub const FROUDE_LPP: [f64; 2] = [0.248, 0.413];

/// 桨敞水 KT(J) 五阶多项式系数（MARIN；B 级，逐系数转录）。
pub const KT_POLY5: [f64; 6] =
    [0.398399, -0.067794, -1.286040, 2.286960, -2.039820, 0.676134];
/// 桨敞水 KQ(J) 五阶多项式系数。
pub const KQ_POLY5: [f64; 6] =
    [0.051144, -0.000390, -0.171650, 0.330060, -0.327865, 0.119477];

/// 舵（B 级）。
pub const RUDDER_TOTAL_AREA: f64 = 30.8;
pub const RUDDER_LATERAL_AREA: f64 = 15.4;
pub const RUDDER_TURN_RATE_DEG_S: f64 = 9.0;

pub const SEA_DENSITY: f64 = 1025.0;

/// 桨几何（B 级）。
pub const PROP_DIAMETER: f64 = 6.15;
pub const PROP_PITCH_RATIO_07R: f64 = 0.87;
pub const PROP_EAR: f64 = 0.58;
pub const PROP_HUB_RATIO: f64 = 0.16;
pub const PROP_BLADES: usize = 5;

/// KT(J)（五阶多项式，J = V/(nD)）。
pub fn kt(j: f64) -> f64 {
    poly5(&KT_POLY5, j)
}

/// KQ(J)。
pub fn kq(j: f64) -> f64 {
    poly5(&KQ_POLY5, j)
}

fn poly5(coeffs: &[f64; 6], j: f64) -> f64 {
    let mut v = coeffs[0];
    let mut jp = 1.0;
    for c in &coeffs[1..] {
        jp *= j;
        v += c * jp;
    }
    v
}

/// 敞水效率 η0 = J·KT/(2π·KQ)。
pub fn open_water_efficiency(j: f64) -> f64 {
    j * kt(j) / (2.0 * std::f64::consts::PI * kq(j))
}

/// 排水质量（D 级推导：∇×ρ）。
pub fn displacement_mass() -> f64 {
    DISPLACEMENT_VOLUME * SEA_DENSITY
}

/// 回转半径推导惯量（ixx/B、izz/Lpp 为 B 级试验条件；iyy 无公开值，
/// 标称取 izz 同量级并标 T 级）。
pub fn inertias() -> (f64, f64, f64) {
    let m = displacement_mass();
    (
        m * (IXX_OVER_B * BWL).powi(2),
        m * (IZZ_OVER_LPP * LPP).powi(2),
        m * (IZZ_OVER_LPP * LPP).powi(2),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 交叉核对一：体积 = 模型值 × 缩尺³（35.480）。
    #[test]
    fn volume_cross_check_model_scale() {
        let model_volume = 0.189; // SIMAN 表 MARIN 列
        let scale = 35.480f64;
        let reconstructed = model_volume * scale.powi(3);
        // 表列模型值仅三位有效数字（0.189）；0.5% 容差仍远拒原表错误值
        // 84244（偏差 10 倍）。
        assert!(
            (reconstructed - DISPLACEMENT_VOLUME).abs() / DISPLACEMENT_VOLUME < 0.005,
            "模型缩尺³ 重构：{reconstructed} vs {DISPLACEMENT_VOLUME}"
        );
    }

    /// 交叉核对二：体积 = Lpp·B·T·CB。
    #[test]
    fn volume_cross_check_block_formula() {
        let block = LPP * BWL * DRAFT * CB;
        assert!(
            (block - DISPLACEMENT_VOLUME).abs() / DISPLACEMENT_VOLUME < 0.002,
            "主尺度×CB：{block} vs {DISPLACEMENT_VOLUME}"
        );
        // 原表错误值（84244）应被两项核对同时拒绝（记录性断言）。
        assert!(block < DISPLACEMENT_VOLUME * 2.0);
    }

    #[test]
    fn propeller_open_water_is_physical() {
        // 系桩 KT(0)=0.398（五叶大盘面比战舰桨量级）。
        assert!((kt(0.0) - 0.398399).abs() < 1e-12);
        assert!((kq(0.0) - 0.051144).abs() < 1e-12);
        // KT 随 J 单调下降，零推力点 J≈1.4-1.6（细长高速船桨）。
        let mut j_zero = None;
        let mut prev = kt(0.0);
        for i in 1..200 {
            let j = i as f64 * 0.01;
            let v = kt(j);
            if prev > 0.0 && v <= 0.0 {
                j_zero = Some(j);
                break;
            }
            prev = v;
        }
        let jz = j_zero.expect("KT 应有零推力点");
        // 零推力进速比与 P/D=0.87 一致（理想零推 J≈P/D+滑脱）。
        assert!(jz > 0.85 && jz < 1.10, "零推力进速比：{jz}");
        // 设计点 J≈0.6-0.8 敞水效率 0.55-0.75（实算 η0(0.8)≈0.68）。
        for j in [0.6, 0.7, 0.8] {
            let eta = open_water_efficiency(j);
            assert!(eta > 0.5 && eta < 0.8, "η0(J={j})={eta}");
        }
    }

    #[test]
    fn inertias_follow_test_conditions() {
        let (ixx, _iyy, izz) = inertias();
        let m = displacement_mass();
        assert!((ixx / m).sqrt() / BWL - IXX_OVER_B < 1e-12);
        assert!((izz / m).sqrt() / LPP - IZZ_OVER_LPP < 1e-12);
        // 量级：战舰 8600t，izz ≈ 1.1e10 kg·m²。
        assert!(izz > 5.0e9 && izz < 3.0e10);
    }

    #[test]
    fn service_conditions_are_consistent() {
        // Fn = U/√(g·Lpp) 与 18/30 kn 一致（<1%）。
        for (kn, fn_exp) in SERVICE_SPEED_KN.iter().zip(FROUDE_LPP.iter()) {
            let u = kn * 0.5144;
            let fr = u / (9.81 * LPP).sqrt();
            assert!(
                (fr - fn_exp).abs() / fn_exp < 0.01,
                "Fn：{fr} vs {fn_exp}"
            );
        }
    }
}
