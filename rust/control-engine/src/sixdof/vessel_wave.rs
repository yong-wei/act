//! 波浪数据与冻结参数包绑定，编译为同源的一阶和完整差频载荷。

use super::first_order_wave::{FirstOrderExcitation, PreparedFirstOrderLoads, rotate_wave_loads};
use super::full_qtf::{FullDifferenceQtf, PreparedDifferenceLoads, QtfMeanCondition};
use super::model_pack::{PackGeometry, SEA_WATER_DENSITY};
use super::wave::{WaveField, WaveRigidCondition};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct WaveModelBinding {
    pub first_order_metadata_fnv1a64: String,
    pub full_difference_metadata_fnv1a64: Option<String>,
    pub water_depth_m: f64,
    pub mean_forward_speed_mps: f64,
}

impl WaveModelBinding {
    pub fn validate(&self) -> Result<(), String> {
        let valid_hash = |value: &str| {
            value.strip_prefix("fnv1a-").is_some_and(|digits| {
                digits.len() == 16 && digits.bytes().all(|byte| byte.is_ascii_hexdigit())
            })
        };
        if !valid_hash(&self.first_order_metadata_fnv1a64)
            || self
                .full_difference_metadata_fnv1a64
                .as_ref()
                .is_some_and(|value| !valid_hash(value))
            || !self.water_depth_m.is_finite()
            || self.water_depth_m <= 0.0
            || !self.mean_forward_speed_mps.is_finite()
            || self.mean_forward_speed_mps < 0.0
        {
            return Err("波浪数据绑定的身份或平均工况无效".into());
        }
        Ok(())
    }
}

#[derive(Clone)]
pub struct WaveModelAssets {
    pub first_order: FirstOrderExcitation,
    pub full_difference: Option<FullDifferenceQtf>,
}

pub fn embedded_teaching_assets(vessel: &str, version: &str)
    -> Result<Option<std::sync::Arc<WaveModelAssets>>, String> {
    let first_order = match (vessel, version) {
        ("destroyer-055", "research-nominal-v6") => FirstOrderExcitation::from_json_and_bytes(
            include_str!("../../model-data/destroyer-055/v6/first-order-wave.json"),
            include_bytes!("../../model-data/destroyer-055/v6/excitation-f32le.bin"))?,
        _ => return Ok(None),
    };
    Ok(Some(std::sync::Arc::new(WaveModelAssets { first_order, full_difference: None })))
}

fn validate_rigid(
    condition: Option<&WaveRigidCondition>,
    geometry: &PackGeometry,
) -> Result<(), String> {
    let condition = condition.ok_or("波浪表缺少冻结质量、重心和惯量条件")?;
    let expected = [
        geometry.displacement_mass_kg,
        geometry.inertia_about_cg_kg_m2.ixx,
        geometry.inertia_about_cg_kg_m2.iyy,
        geometry.inertia_about_cg_kg_m2.izz,
    ];
    let actual = [
        condition.mass_kg,
        condition.inertia_about_cg_kg_m2[0],
        condition.inertia_about_cg_kg_m2[1],
        condition.inertia_about_cg_kg_m2[2],
    ];
    let cg = geometry
        .center_of_mass_waterline_z_up_m
        .ok_or("参数包缺少重心条件")?;
    if actual.iter().zip(expected).any(|(value, expected)| {
        !value.is_finite() || (value - expected).abs() > 1e-12 * expected.abs()
    }) || condition
        .center_of_mass_waterline_z_up_m
        .iter()
        .zip(cg)
        .any(|(value, expected)| !value.is_finite() || (value - expected).abs() > 1e-9)
    {
        return Err("波浪表的质量、重心或惯量与当前加载状态不一致".into());
    }
    Ok(())
}

impl WaveModelAssets {
    pub fn compile(
        &self,
        vessel: &str,
        binding: &WaveModelBinding,
        geometry: &PackGeometry,
        field: &WaveField,
        mean_heading_rad: f64,
        second_order_enabled: bool,
    ) -> Result<CompiledVesselWaves, String> {
        binding.validate()?;
        let first = self.first_order.metadata();
        if self.first_order.metadata_bytes_hash() != binding.first_order_metadata_fnv1a64
            || first.vessel != vessel
            || (first.water_depth_m - binding.water_depth_m).abs() > 1e-8
            || first.water_density_kg_m3 != SEA_WATER_DENSITY
            || (first.draft_m - geometry.draft_m).abs() > 1e-8
            || (first.equilibrium_pitch_rad - geometry.equilibrium_pitch_rad).abs() > 1e-10
        {
            return Err("一阶波浪表与冻结船型、参数包或加载条件不一致".into());
        }
        validate_rigid(first.rigid_condition.as_ref(), geometry)?;
        let prepared_first =
            self.first_order
                .prepare(field, mean_heading_rad, binding.mean_forward_speed_mps)?;
        if let Some(table) = &self.full_difference {
            let expected = binding
                .full_difference_metadata_fnv1a64
                .as_ref()
                .ok_or("此参数包的完整差频数据未就绪")?;
            let metadata = table.metadata();
            if table.metadata_bytes_hash() != expected
                || metadata.vessel != vessel
                || metadata.sample_only
                || metadata.water_density_kg_m3 != SEA_WATER_DENSITY
                || metadata.gravity_m_s2 != super::wave::GRAVITY
                || (metadata.equilibrium_pitch_rad - geometry.equilibrium_pitch_rad).abs() > 1e-10
            {
                return Err("完整差频表与冻结参数包的身份或参考坐标不一致".into());
            }
            validate_rigid(metadata.rigid_condition.as_ref(), geometry)?;
        }
        let prepared_second = if second_order_enabled {
            let table = self
                .full_difference
                .as_ref()
                .ok_or("完整差频数据尚未加载")?;
            Some(table.prepare(
                field,
                mean_heading_rad,
                QtfMeanCondition {
                    forward_speed_mps: binding.mean_forward_speed_mps,
                    draft_m: geometry.draft_m,
                    mesh_sha256: &table.metadata().mesh_sha256,
                },
            )?)
        } else {
            None
        };
        Ok(CompiledVesselWaves {
            first_order: prepared_first,
            full_difference: prepared_second,
            mean_heading_rad,
            equilibrium_pitch_rad: geometry.equilibrium_pitch_rad,
        })
    }
}

#[derive(Clone)]
pub struct CompiledVesselWaves {
    first_order: PreparedFirstOrderLoads,
    full_difference: Option<PreparedDifferenceLoads>,
    mean_heading_rad: f64,
    equilibrium_pitch_rad: f64,
}

impl CompiledVesselWaves {
    pub fn loads(
        &self,
        time_s: f64,
        position: [f64; 3],
        quaternion: [f64; 4],
    ) -> Result<([f64; 6], [f64; 6]), String> {
        let first = self
            .first_order
            .evaluate_body(time_s, position, quaternion)?;
        let second = self
            .full_difference
            .as_ref()
            .map(|prepared| {
                prepared
                    .evaluate(time_s, position[0], position[1])
                    .map(|loads| {
                        rotate_wave_loads(
                            loads,
                            self.mean_heading_rad,
                            self.equilibrium_pitch_rad,
                            quaternion,
                        )
                    })
            })
            .transpose()?
            .unwrap_or([0.0; 6]);
        Ok((first, second))
    }
}
