//! 局部刀齿轨迹、单元床面移除及切削功。所有接触来自实际6+2自由度状态。

use super::dredge_ladder::{
    direction, point_body, point_jacobian, point_ladder_derivative, world_point, LENGTH_M,
};
use super::dredge_soil::{DredgeSoil, SoilCuttingLaw};
use super::state::{rotation_matrix, TruthState};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const RADIUS_M: f64 = 1.5;
pub const CELL_SIZE_M: f64 = 0.5;
pub const BED_DEPTH_M: f64 = 20.0;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DredgeBed {
    /// 键为有符号北/东单元坐标的无损打包，值为该单元已挖深度。
    pub cells: BTreeMap<i64, f64>,
    pub removed_volume_m3: f64,
    pub cutting_work_j: f64,
}

pub struct CutterEvaluation {
    pub generalized_force: [f64; 8],
    pub volume_rate_m3_s: f64,
    pub cutting_power_w: f64,
    pub tangential_force_n: f64,
    pub deepest_tooth_m: f64,
    pub maximum_chip_m: f64,
    pub specific_energy_pa: f64,
    pub soil_domain_exceeded: bool,
    increments: BTreeMap<i64, f64>,
}

fn cell_key(north_m: f64, east_m: f64) -> i64 {
    let north = (north_m / CELL_SIZE_M).floor() as i32;
    let east = (east_m / CELL_SIZE_M).floor() as i32;
    ((north as i64) << 32) | east as u32 as i64
}

impl DredgeBed {
    pub fn validate(&self) -> Result<(), String> {
        if !self.removed_volume_m3.is_finite()
            || self.removed_volume_m3 < 0.0
            || !self.cutting_work_j.is_finite()
            || self.cutting_work_j < 0.0
            || self.cells.len() > 200_000
            || self
                .cells
                .values()
                .any(|v| !v.is_finite() || *v < BED_DEPTH_M || *v > 30.0)
        {
            return Err("床面恢复点或切削累计量无效".into());
        }
        let from_cells: f64 = self
            .cells
            .values()
            .map(|depth| (depth - BED_DEPTH_M) * CELL_SIZE_M.powi(2))
            .sum();
        if (from_cells - self.removed_volume_m3).abs() > 1e-6 * (1.0 + from_cells) {
            return Err("床面已移除体积与累计产量不一致".into());
        }
        Ok(())
    }

    pub fn commit(&mut self, evaluation: &CutterEvaluation, dt_s: f64) {
        for (key, volume) in &evaluation.increments {
            let depth = self.cells.entry(*key).or_insert(BED_DEPTH_M);
            *depth += volume / CELL_SIZE_M.powi(2);
            self.removed_volume_m3 += volume;
        }
        self.cutting_work_j += evaluation.cutting_power_w * dt_s;
    }
}

pub fn evaluate_cutter(
    state: &TruthState,
    q: f64,
    q_rate: f64,
    phase: f64,
    rotor_rate: f64,
    soil: DredgeSoil,
    bed: &DredgeBed,
    law: &SoilCuttingLaw,
    dt_s: f64,
) -> Result<CutterEvaluation, String> {
    if !dt_s.is_finite() || dt_s <= 0.0 {
        return Err("切削积分步长无效".into());
    }
    let rotation = rotation_matrix(state.quaternion);
    let shaft_axis = direction(q);
    let down_axis = point_ladder_derivative(q, 1.0);
    let center = point_body(q, LENGTH_M);
    let mut evaluation = CutterEvaluation {
        generalized_force: [0.0; 8],
        volume_rate_m3_s: 0.0,
        cutting_power_w: 0.0,
        tangential_force_n: 0.0,
        deepest_tooth_m: 0.0,
        maximum_chip_m: 0.0,
        specific_energy_pa: 0.0,
        soil_domain_exceeded: false,
        increments: BTreeMap::new(),
    };
    for arm in 0..6 {
        let angle = phase + arm as f64 * std::f64::consts::TAU / 6.0;
        let (sine, cosine) = angle.sin_cos();
        for along in [-1.0, 0.0, 1.0] {
            let point = std::array::from_fn(|i| {
                center[i]
                    + along * shaft_axis[i]
                    + RADIUS_M * cosine * down_axis[i]
                    + if i == 1 { RADIUS_M * sine } else { 0.0 }
            });
            let point_q = std::array::from_fn(|i| {
                (LENGTH_M + along) * down_axis[i] - RADIUS_M * cosine * shaft_axis[i]
            });
            let point_phase: [f64; 3] = std::array::from_fn(|i| {
                -RADIUS_M * sine * down_axis[i] + if i == 1 { RADIUS_M * cosine } else { 0.0 }
            });
            let world = world_point(state, point);
            evaluation.deepest_tooth_m = evaluation.deepest_tooth_m.max(world[2]);
            let key = cell_key(world[0], world[1]);
            let cell_depth = bed.cells.get(&key).copied().unwrap_or(BED_DEPTH_M)
                + evaluation.increments.get(&key).copied().unwrap_or(0.0) / CELL_SIZE_M.powi(2);
            let chip = (world[2] - cell_depth).max(0.0);
            evaluation.maximum_chip_m = evaluation.maximum_chip_m.max(chip);
            if chip > 1.0 || world[2] > 30.0 {
                evaluation.soil_domain_exceeded = true;
                continue;
            }
            if chip <= 1e-9 {
                continue;
            }
            let mut jacobian = point_jacobian(point, point_q);
            for i in 0..3 {
                jacobian[i][7] = point_phase[i];
            }
            let velocity: [f64; 3] = std::array::from_fn(|i| {
                (0..6)
                    .map(|j| jacobian[i][j] * state.body_velocity[j])
                    .sum::<f64>()
                    + point_q[i] * q_rate
                    + point_phase[i] * rotor_rate
            });
            let world_velocity: [f64; 3] =
                std::array::from_fn(|i| (0..3).map(|j| rotation[i][j] * velocity[j]).sum());
            let speed = world_velocity.iter().map(|v| v * v).sum::<f64>().sqrt();
            if speed <= 1e-9 {
                continue;
            }
            let tangential = world_velocity.map(|value| value / speed);
            // 局部Fv在刀齿运动的法平面内，虚功严格为零。
            let normal_raw: [f64; 3] = std::array::from_fn(
                |i| if i == 2 { -1.0 } else { 0.0 } + tangential[2] * tangential[i],
            );
            let normal_norm = normal_raw.iter().map(|v| v * v).sum::<f64>().sqrt();
            let normal = normal_raw.map(|v| {
                if normal_norm > 1e-9 {
                    v / normal_norm
                } else {
                    0.0
                }
            });
            let law_force = law.force(soil, chip, speed, 1.0, BED_DEPTH_M)?;
            let swept = chip * speed * dt_s;
            let available = chip * CELL_SIZE_M.powi(2);
            let volume = swept.min(available);
            let fraction = volume / swept;
            let world_force: [f64; 3] = std::array::from_fn(|i| {
                fraction
                    * (-law_force.tangential_n * tangential[i] + law_force.normal_n * normal[i])
            });
            let body_force: [f64; 3] =
                std::array::from_fn(|i| (0..3).map(|j| rotation[j][i] * world_force[j]).sum());
            for i in 0..8 {
                evaluation.generalized_force[i] +=
                    (0..3).map(|j| jacobian[j][i] * body_force[j]).sum::<f64>();
            }
            evaluation.cutting_power_w += law_force.specific_energy_pa * volume / dt_s;
            evaluation.tangential_force_n += law_force.tangential_n * fraction;
            evaluation.volume_rate_m3_s += volume / dt_s;
            *evaluation.increments.entry(key).or_insert(0.0) += volume;
        }
    }
    if evaluation.volume_rate_m3_s > 0.0 {
        evaluation.specific_energy_pa = evaluation.cutting_power_w / evaluation.volume_rate_m3_s;
    }
    Ok(evaluation)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dredge_cutting_uses_real_motion_and_conserves_removed_volume_and_work() {
        let state = TruthState {
            quaternion: [1.0, 0.0, 0.0, 0.0],
            ..Default::default()
        };
        let q = 0.63;
        let law = SoilCuttingLaw::default();
        let mut bed = DredgeBed::default();
        let initial = evaluate_cutter(
            &state,
            q,
            0.0,
            0.0,
            3.0,
            DredgeSoil::Sand,
            &bed,
            &law,
            1.0 / 120.0,
        )
        .unwrap();
        assert!(initial.cutting_power_w > 0.0 && initial.volume_rate_m3_s > 0.0);
        assert!((initial.generalized_force[7] * 3.0 + initial.cutting_power_w).abs() < 1e-7);
        let initial_force = initial.tangential_force_n;
        bed.commit(&initial, 1.0 / 120.0);
        bed.validate().unwrap();
        let restored: DredgeBed =
            serde_json::from_str(&serde_json::to_string(&bed).unwrap()).unwrap();
        assert_eq!(restored, bed);
        for _ in 0..400 {
            let evaluation = evaluate_cutter(
                &state,
                q,
                0.0,
                0.0,
                3.0,
                DredgeSoil::Sand,
                &bed,
                &law,
                1.0 / 120.0,
            )
            .unwrap();
            bed.commit(&evaluation, 1.0 / 120.0);
        }
        let cleared = evaluate_cutter(
            &state,
            q,
            0.0,
            0.0,
            3.0,
            DredgeSoil::Sand,
            &bed,
            &law,
            1.0 / 120.0,
        )
        .unwrap();
        assert!(cleared.tangential_force_n < initial_force * 1e-6);
        assert!(bed.removed_volume_m3 < 1.0);
        bed.validate().unwrap();
        let stopped = evaluate_cutter(
            &state,
            q,
            0.0,
            0.0,
            0.0,
            DredgeSoil::Sand,
            &DredgeBed::default(),
            &law,
            1.0 / 120.0,
        )
        .unwrap();
        assert_eq!(stopped.volume_rate_m3_s, 0.0);
        let lifted = evaluate_cutter(
            &state,
            0.3,
            0.0,
            0.0,
            3.0,
            DredgeSoil::Clay,
            &bed,
            &law,
            1.0 / 120.0,
        )
        .unwrap();
        assert_eq!(lifted.volume_rate_m3_s, 0.0);
    }
}
