//! S175 Capytaine 频域水动力数据库验证（issue-2157 Capytaine 路径）。
//!
//! 数据库：MSS HYDRO/vessels_capytaine/S175/s175.mat（上游修订
//! e8ab42a105cd），`hydrodynamic_source = "Capytaine"`——上游即以
//! Capytaine 计算的一阶系数（6×6×38 频率的附加质量/阻尼/恢复 + 36
//! 航向 RAO）。本测试验证导出 fixture（tests/fixtures/s175_hydrodb.json）
//! 的物理一致性（D 级数据机器校验）。
//!
//! 装载差异声明：数据库为 T=9.5m 满载（∇=23973m³、GM_T=0.98m），
//! 与 container.m 时域基准（T=8.5m、GM≈0.3m）为同一 S175 船的不同
//! 装载工况——不跨装载直接对比数值，仅验证各自身份与量级。

use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
struct HydroDb {
    source: HydroSource,
    main: HydroMain,
    freqs: Vec<f64>,
    mrb: Vec<Vec<f64>>,
    added_mass: Vec<Vec<Vec<f64>>>,
    damping: Vec<Vec<Vec<f64>>>,
    stiffness: Vec<Vec<Vec<f64>>>,
}

#[derive(Debug, Deserialize)]
struct HydroSource {
    tool: String,
    reference: String,
}

#[derive(Debug, Deserialize)]
struct HydroMain {
    lpp: f64,
    beam: f64,
    draft: f64,
    mass_kg: f64,
    volume_m3: f64,
    k44: f64,
    gm_t: f64,
    gm_l: f64,
}

const DB: &str = include_str!("fixtures/s175_hydrodb.json");
const RHO: f64 = 1025.0;
const G: f64 = 9.81;

fn db() -> HydroDb {
    serde_json::from_str(DB).expect("数据库 JSON 解析")
}

fn nonzero_freqs(db: &HydroDb) -> Vec<usize> {
    db.freqs
        .iter()
        .enumerate()
        .filter(|(_, w)| **w > 0.05)
        .map(|(i, _)| i)
        .collect()
}

#[test]
fn provenance_is_capytaine_and_ship_is_s175() {
    let db = db();
    assert_eq!(db.source.tool, "Capytaine", "上游求解器");
    assert_eq!(db.source.reference, "CG", "参考点");
    assert_eq!(db.main.lpp, 175.0, "Lpp 与 container.m 基准同船");
    assert_eq!(db.freqs.len(), 38);
    assert!(db.main.volume_m3 > 20_000.0 && db.main.volume_m3 < 26_000.0);
}

#[test]
fn roll_stiffness_identity_rho_g_nabla_gm() {
    // C44 = ρ·g·∇·GM_T（横摇恢复静水力恒等式，<0.1%）。
    let db = db();
    let c44 = db.stiffness[3][3][0];
    let expect = RHO * G * db.main.volume_m3 * db.main.gm_t;
    assert!(
        (c44 - expect).abs() / expect < 1e-3,
        "C44={c44} vs ρg∇GM_T={expect}"
    );
}

#[test]
fn heave_stiffness_gives_plausible_waterplane() {
    // C33 = ρ·g·A_wl → 水线面积应在 L·B·Cw（Cw∈[0.5,0.95]）带内。
    let db = db();
    let c33 = db.stiffness[2][2][0];
    let a_wl = c33 / (RHO * G);
    let cw = a_wl / (db.main.lpp * db.main.beam);
    assert!(
        cw > 0.5 && cw < 0.95,
        "水线面积系数 Cw={cw}（A_wl={a_wl} m²）"
    );
}

#[test]
fn roll_natural_period_is_in_ship_band() {
    // T_roll = 2π√((m·k44²+A44(ω低))/(C44))：集装箱船 15-25s 带。
    let db = db();
    let i44 = db.main.mass_kg * db.main.k44 * db.main.k44;
    let idx = nonzero_freqs(&db).first().copied().unwrap();
    let a44 = db.added_mass[3][3][idx];
    let c44 = db.stiffness[3][3][0];
    let t_roll = 2.0 * std::f64::consts::PI * ((i44 + a44) / c44).sqrt();
    assert!(
        t_roll > 15.0 && t_roll < 25.0,
        "横摇固有周期 {t_roll}s"
    );
}

#[test]
fn heave_added_mass_ratio_is_physical() {
    // 低频垂荡附加质量：瘦长船（S175 Cb=0.568）文献带约 (1.5-3.0)×m，
    // 且随频率上升下降（本库实测 ω=0.1 处 2.56 → ω=0.37 处 1.92）。
    let db = db();
    let idxs = nonzero_freqs(&db);
    let lo = idxs.first().copied().unwrap();
    let ratio_lo = db.added_mass[2][2][lo] / db.main.mass_kg;
    assert!(
        ratio_lo > 1.5 && ratio_lo < 3.0,
        "A33/m(ω低) = {ratio_lo}（瘦长船带）"
    );
    // 随频率单调下降趋势（至少前 1/3 频段）。
    let hi = idxs[idxs.len() / 3];
    let ratio_hi = db.added_mass[2][2][hi] / db.main.mass_kg;
    assert!(
        ratio_hi < ratio_lo,
        "A33/m 应随 ω 下降：{ratio_lo} → {ratio_hi}"
    );
}

#[test]
fn mass_matrix_and_diagonals_are_physical() {
    let db = db();
    // MRB 对角：m、I44=m·k44² 量级一致（<25%）。
    assert!(
        (db.mrb[0][0] - db.main.mass_kg).abs() / db.main.mass_kg < 0.05,
        "MRB(0,0)={}",
        db.mrb[0][0]
    );
    let i44 = db.main.mass_kg * db.main.k44 * db.main.k44;
    assert!(
        (db.mrb[3][3] - i44).abs() / i44 < 0.25,
        "MRB(3,3)={} vs m·k44²={i44}",
        db.mrb[3][3]
    );
    // 全频段对角 A/B 有限且 A 对角为正。
    for idx in nonzero_freqs(&db) {
        for d in 0..6 {
            assert!(db.added_mass[d][d][idx].is_finite());
            assert!(db.damping[d][d][idx].is_finite());
            assert!(
                db.added_mass[d][d][idx] > 0.0,
                "A({d},{d}) 应为正：ω={}",
                db.freqs[idx]
            );
        }
    }
    // 横摇阻尼存在峰值（粘性外辐射阻尼非零）。
    let b44_max = nonzero_freqs(&db)
        .iter()
        .map(|&i| db.damping[3][3][i])
        .fold(0.0f64, f64::max);
    assert!(b44_max > 1.0e6, "B44 峰值量级：{b44_max}");
}
