//! 参数包门禁与哈希算例（issue-2157-p1 阶段 A）。

use control_engine::sixdof::{PackError, embedded_destroyer_055, load_model_pack};

const MANIFEST: &str = r#"{ "schema": "act.model-pack.manifest.v1", "vessel": "test", "model_version": "v1", "model_fidelity": "research-nominal", "basis": "x" }"#;
const MANEUVERING: &str = r#"{ "hull": {} }"#;
const ACTUATORS: &str = r#"{ "propeller": {} }"#;
const PROVENANCE: &str = r#"{ "entries": [] }"#;

fn geometry_json(mass_kg: f64, ixx: f64, iyy: f64, izz: f64) -> String {
    format!(r#"{{
      "loa_m": 180.0, "lpp_m": 172.0, "beam_m": 20.0, "draft_m": 6.6,
      "displacement_volume_m3": 12683.0, "displacement_mass_kg": {mass_kg},
      "mass_basis": "displacement_volume", "waterline_area_m2": 2810.0,
      "inertia_about_cg_kg_m2": {{ "ixx": {ixx}, "iyy": {iyy}, "izz": {izz} }}
    }}"#)
}

fn load_with(mass: f64, ixx: f64, iyy: f64, izz: f64) -> Result<control_engine::sixdof::PackModel, PackError> {
    load_model_pack(MANIFEST, &geometry_json(mass, ixx, iyy, izz), MANEUVERING, ACTUATORS, PROVENANCE)
}

#[test]
fn embedded_pack_passes_all_gates() {
    let pack = embedded_destroyer_055().expect("内嵌 055 包必须全门禁通过");
    assert_eq!(pack.manifest.model_fidelity, "research-nominal", "055 首版必须诚实标注研究标称");
    assert!(pack.content_hash.starts_with("fnv1a-"));
    assert!(!pack.content_hash.is_empty());
}

#[test]
fn hash_is_deterministic_across_loads() {
    let a = embedded_destroyer_055().unwrap();
    let b = embedded_destroyer_055().unwrap();
    assert_eq!(a.content_hash, b.content_hash, "同字节包哈希稳定（跨平台同 JSON 字节）");
}

#[test]
fn gyration_radius_typo_is_rejected() {
    // ".25L 回转半径"错写成 ".25·m·Lpp² 惯量"：k≈0.5·Lpp → 拒绝。
    let m = 13_000_000.0;
    let bogus_izz = 0.25 * m * 172.0_f64 * 172.0;
    let result = load_with(m, 1.3e9, 2.85e10, bogus_izz);
    assert!(matches!(result, Err(PackError::GyrationRadiusOutOfBounds { axis: 'z', .. })), "实际 {result:?}");
}

#[test]
fn mass_volume_mismatch_is_rejected() {
    // 质量 16000 t 但体积只闭合 13000 t → 拒绝。
    let result = load_with(16_000_000.0, 1.3e9, 2.85e10, 2.63e10);
    assert!(matches!(result, Err(PackError::MassVolumeMismatch { .. })));
}

#[test]
fn lpp_exceeding_loa_is_rejected() {
    let bad = r#"{ "loa_m": 180.0, "lpp_m": 185.0, "beam_m": 20.0, "draft_m": 6.6,
      "displacement_volume_m3": 12683.0, "displacement_mass_kg": 13000000.0,
      "mass_basis": "displacement_volume",
      "inertia_about_cg_kg_m2": { "ixx": 1.3e9, "iyy": 2.85e10, "izz": 2.63e10 } }"#;
    let result = load_model_pack(MANIFEST, bad, MANEUVERING, ACTUATORS, PROVENANCE);
    assert!(matches!(result, Err(PackError::LppExceedsLoa { .. })));
}

#[test]
fn gt_as_mass_basis_is_unrepresentable() {
    // schema 枚举只有 displacement_volume / stated_loading：GT 值无法通过解析。
    let gt_pack = r#"{ "loa_m": 180.0, "lpp_m": 172.0, "beam_m": 20.0, "draft_m": 6.6,
      "displacement_volume_m3": 12683.0, "displacement_mass_kg": 13500.0,
      "mass_basis": "gt_volume",
      "inertia_about_cg_kg_m2": { "ixx": 1.3e9, "iyy": 2.85e10, "izz": 2.63e10 } }"#;
    let result = load_model_pack(MANIFEST, gt_pack, MANEUVERING, ACTUATORS, PROVENANCE);
    assert!(matches!(result, Err(PackError::SchemaMismatch { .. })), "GT 枚举必须解析失败");
}

#[test]
fn any_data_change_changes_hash() {
    // 同结构、改一个数值 → 哈希必须变（run 身份联动）。
    let base = load_with(13_000_000.0, 1.3e9, 2.85e10, 2.63e10).unwrap();
    let changed = load_with(13_000_000.0, 1.31e9, 2.85e10, 2.63e10).unwrap();
    assert_ne!(base.content_hash, changed.content_hash);
    // key 顺序不同但内容相同 → 同哈希（规范化排序）。
    let reordered_geom = r#"{ "inertia_about_cg_kg_m2": { "izz": 2.63e10, "iyy": 2.85e10, "ixx": 1.3e9 },
      "waterline_area_m2": 2810.0, "mass_basis": "displacement_volume",
      "displacement_mass_kg": 13000000.0, "displacement_volume_m3": 12683.0,
      "draft_m": 6.6, "beam_m": 20.0, "lpp_m": 172.0, "loa_m": 180.0 }"#;
    let c = load_model_pack(MANIFEST, reordered_geom, MANEUVERING, ACTUATORS, PROVENANCE).unwrap();
    assert_eq!(base.content_hash, c.content_hash, "键序无关（规范化排序后同哈希）");
}


#[test]
fn embedded_pack_matches_plant_defaults() {
    // 单一真源防漂移：参数包几何值与 plant Default 一致。
    let pack = embedded_destroyer_055().unwrap();
    let g = &pack.geometry;
    assert_eq!(g.loa_m, 180.0);
    assert_eq!(g.beam_m, 20.0);
    assert_eq!(g.draft_m, 6.6);
    assert_eq!(g.displacement_mass_kg, 13_000_000.0);
    // 回转半径与 plant 惯性定义一致：k_x=0.5B、k_y=0.26L、k_z=0.25L。
    let m = g.displacement_mass_kg;
    let kx = (g.inertia_about_cg_kg_m2.ixx / m).sqrt();
    let kz = (g.inertia_about_cg_kg_m2.izz / m).sqrt();
    assert!((kx - 0.5 * g.beam_m).abs() < 1e-9);
    assert!((kz - 0.25 * g.loa_m).abs() < 1e-9, "A2.1 修正（k_z=0.25L）入包固化");
}
