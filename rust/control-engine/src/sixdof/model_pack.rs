//! 参数包加载与物理一致性门禁（issue-2157-p1 阶段 A）。
//!
//! 合同（issue §1/§3）：参数以结构化包交付（构建期 include_str 嵌入），
//! 每参数 P/B/D/T 分级；加载 fail-closed 校验——质量与静水排水闭合
//! （<1e-3 或显式加载说明）、惯量按 kg·m² 且回转半径 ∈ [0.15Lpp,0.35Lpp]
//! （防"0.25L 半径"错写为"0.25mL² 惯量"）、GT/DWT 禁作排水质量、
//! Lpp ≤ LOA。规范化哈希（key 排序紧凑 JSON → FNV）供 run 身份联动。

use serde::Deserialize;

pub const SEA_WATER_DENSITY: f64 = 1025.0;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MassBasis {
    /// m = ρ·V（默认；门禁闭合校验）。
    DisplacementVolume,
    /// 显式标注的真实加载状态（需在 provenance 说明；同样执行闭合校验
    /// against 声明的排水体积）。
    StatedLoading,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PackManifest {
    pub schema: String,
    pub vessel: String,
    pub model_version: String,
    pub model_fidelity: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PackGeometry {
    pub loa_m: f64,
    pub lpp_m: f64,
    pub beam_m: f64,
    pub draft_m: f64,
    pub displacement_volume_m3: f64,
    pub displacement_mass_kg: f64,
    pub mass_basis: MassBasis,
    #[serde(default)]
    pub waterline_area_m2: f64,
    #[serde(default)]
    pub inertia_about_cg_kg_m2: InertiaEntry,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct InertiaEntry {
    #[serde(default)]
    pub ixx: f64,
    #[serde(default)]
    pub iyy: f64,
    #[serde(default)]
    pub izz: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PackManeuveringHull {
    pub x_uu: f64,
    pub x_u: f64,
    pub y_v: f64,
    pub y_vv: f64,
    pub y_vr: f64,
    pub y_r: f64,
    pub y_rr: f64,
    pub n_v: f64,
    pub n_vv: f64,
    pub n_vr: f64,
    pub n_r: f64,
    pub n_rr: f64,
    pub z_h_m: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PackManeuvering {
    pub hull: PackManeuveringHull,
    pub low_speed: PackLowSpeed,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PackLowSpeed {
    pub crossflow_y: f64,
    pub surge_drag: f64,
    pub yaw_arm_m: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PackActuators {
    pub propeller: PackPropeller,
    pub shaft: PackShaft,
    pub rudder: PackRudder,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PackPropeller {
    pub diameter_m: f64,
    pub kt_coefficients: [f64; 3],
    pub kq_coefficients: [f64; 3],
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PackShaft {
    pub inertia_kg_m2: f64,
    pub max_motor_torque_nm: f64,
    pub max_shaft_speed_rad_s: f64,
    pub max_torque_rate_nm_s: f64,
    pub coulomb_friction_nm: f64,
    pub viscous_friction_nm_s_per_rad: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PackRudder {
    pub max_angle_deg: f64,
    pub max_rate_deg_s: f64,
    pub normal_factor: f64,
    pub lateral_factor: f64,
    pub longitudinal_position_m: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PackModel {
    pub manifest: PackManifest,
    pub geometry: PackGeometry,
    pub maneuvering: PackManeuvering,
    pub actuators: PackActuators,
    /// 规范化内容哈希（FNV-1a，key 排序紧凑 JSON）。
    pub content_hash: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum PackError {
    SchemaMismatch { expect: &'static str, got: String },
    LppExceedsLoa { lpp: f64, loa: f64 },
    MassVolumeMismatch { mass_kg: f64, rho_v_kg: f64 },
    GyrationRadiusOutOfBounds { axis: char, radius_m: f64, lpp: f64 },
    NonFiniteValue { field: &'static str },
}

fn fnv1a(bytes: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in bytes {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

/// 规范化 JSON（key 排序、无空白）→ 十六进制哈希。
fn normalized_hash(value: &serde_json::Value) -> String {
    let canonical = canonicalize(value);
    let compact = serde_json::to_string(&canonical).unwrap_or_default();
    format!("fnv1a-{:016x}", fnv1a(compact.as_bytes()))
}

fn canonicalize(value: &serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Object(map) => {
            let mut sorted = serde_json::Map::new();
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            for key in keys {
                sorted.insert(key.clone(), canonicalize(&map[key]));
            }
            serde_json::Value::Object(sorted)
        }
        serde_json::Value::Array(items) => {
            serde_json::Value::Array(items.iter().map(canonicalize).collect())
        }
        // 数值统一 f64：整数字面量（13000000）与浮点（13000000.0）是同一
        // 物理值，必须产生同一规范化字节（否则同值不同写法哈希漂移）。
        serde_json::Value::Number(n) => serde_json::Value::Number(
            serde_json::Number::from_f64(n.as_f64().unwrap_or(f64::NAN))
                .unwrap_or_else(|| serde_json::Number::from(0)),
        ),
        other => other.clone(),
    }
}

/// 解析并校验参数包（门禁 fail-closed）。
pub fn load_model_pack(
    manifest_json: &str,
    geometry_json: &str,
    maneuvering_json: &str,
    actuators_json: &str,
    provenance_json: &str,
) -> Result<PackModel, PackError> {
    let manifest: PackManifest = serde_json::from_str(manifest_json)
        .map_err(|_| PackError::SchemaMismatch { expect: "manifest", got: String::new() })?;
    if !manifest.schema.starts_with("act.model-pack.manifest.") {
        return Err(PackError::SchemaMismatch { expect: "act.model-pack.manifest.*", got: manifest.schema });
    }
    let geometry: PackGeometry = serde_json::from_str(geometry_json)
        .map_err(|_| PackError::SchemaMismatch { expect: "geometry", got: String::new() })?;
    let maneuvering: PackManeuvering = serde_json::from_str(maneuvering_json)
        .map_err(|_| PackError::SchemaMismatch { expect: "maneuvering", got: String::new() })?;
    let actuators: PackActuators = serde_json::from_str(actuators_json)
        .map_err(|_| PackError::SchemaMismatch { expect: "actuators", got: String::new() })?;

    // 门禁 1：Lpp ≤ LOA（分立字段禁混用）。
    if geometry.lpp_m > geometry.loa_m + 1e-9 {
        return Err(PackError::LppExceedsLoa { lpp: geometry.lpp_m, loa: geometry.loa_m });
    }
    // 门禁 2：质量-体积闭合（GT/DWT 在 schema 枚举层已无字段可冒充；
    // 两种 mass_basis 均执行闭合）。
    let rho_v = SEA_WATER_DENSITY * geometry.displacement_volume_m3;
    let relative = (geometry.displacement_mass_kg - rho_v).abs() / geometry.displacement_mass_kg;
    if relative > 1e-3 {
        return Err(PackError::MassVolumeMismatch { mass_kg: geometry.displacement_mass_kg, rho_v_kg: rho_v });
    }
    // 门禁 3：惯量回转半径分轴界（k = √(I/m)）——横摇（x）为梁尺度
    // [0.25B, 0.60B]；纵摇/艏摇（y/z）为船长尺度 [0.15Lpp, 0.40Lpp]。
    // "0.25·m·L²" 形态的艏摇惯量错写会得到 k≈0.5·Lpp 即被拒。
    let m = geometry.displacement_mass_kg;
    let b = geometry.beam_m;
    let lpp = geometry.lpp_m;
    let bounds: [(char, f64, f64, f64); 3] = [
        ('x', geometry.inertia_about_cg_kg_m2.ixx, 0.25 * b, 0.60 * b),
        ('y', geometry.inertia_about_cg_kg_m2.iyy, 0.15 * lpp, 0.40 * lpp),
        ('z', geometry.inertia_about_cg_kg_m2.izz, 0.15 * lpp, 0.40 * lpp),
    ];
    for (axis, inertia, lower, upper) in bounds {
        if !inertia.is_finite() || inertia <= 0.0 {
            return Err(PackError::NonFiniteValue { field: "inertia" });
        }
        let radius = (inertia / m).sqrt();
        if radius < lower || radius > upper {
            return Err(PackError::GyrationRadiusOutOfBounds { axis, radius_m: radius, lpp });
        }
    }
    for (field, value) in [("beam", geometry.beam_m), ("draft", geometry.draft_m), ("volume", geometry.displacement_volume_m3)] {
        if !value.is_finite() || value <= 0.0 {
            return Err(PackError::NonFiniteValue { field });
        }
    }

    // 内容哈希：四个数据文件规范化后链式 FNV（manifest 的 model_version 参与链头）。
    let mut chain_input = format!("{}\n", manifest.model_version);
    for source in [maneuvering_json, actuators_json, provenance_json, geometry_json] {
        let value: serde_json::Value = serde_json::from_str(source)
            .map_err(|_| PackError::SchemaMismatch { expect: "data-file-json", got: String::new() })?;
        chain_input.push_str(&normalized_hash(&value));
        chain_input.push('\n');
    }
    Ok(PackModel {
        manifest,
        geometry,
        maneuvering,
        actuators,
        content_hash: format!("fnv1a-{:016x}", fnv1a(chain_input.as_bytes())),
    })
}

/// 055 内嵌参数包（构建期嵌入；运行哈希与 run manifest 联动）。
pub fn embedded_destroyer_055() -> Result<PackModel, PackError> {
    load_model_pack(
        include_str!("../../model-data/destroyer-055/v1/manifest.json"),
        include_str!("../../model-data/destroyer-055/v1/geometry.json"),
        include_str!("../../model-data/destroyer-055/v1/maneuvering.json"),
        include_str!("../../model-data/destroyer-055/v1/actuators.json"),
        include_str!("../../model-data/destroyer-055/v1/provenance.json"),
    )
}
