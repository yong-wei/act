//! 封闭多面体在平均水面下的排水与非线性重力/浮力恢复。

use super::state::{moment_from_force, rotation_matrix, TruthState};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HydrostaticHull {
    /// 船体固定FRD坐标，原点为当前加载的重心。
    pub vertices_body_m: Vec<[f64; 3]>,
    pub triangles: Vec<[usize; 3]>,
    pub cg_waterline_height_m: f64,
}

#[derive(Debug, Clone, Copy)]
pub struct HydrostaticEvaluation {
    pub restoring_body: [f64; 6],
    pub displaced_volume_m3: f64,
    pub center_of_buoyancy_waterline_ned_m: [f64; 3],
    pub potential_energy_j: f64,
}

impl HydrostaticHull {
    pub fn validate(&self) -> Result<(), String> {
        if self.vertices_body_m.len() < 4
            || self.triangles.len() < 4
            || !self.cg_waterline_height_m.is_finite()
            || self
                .vertices_body_m
                .iter()
                .flatten()
                .any(|value| !value.is_finite())
        {
            return Err("静水船体顶点或水线基准无效".into());
        }
        let mut edges: HashMap<(usize, usize), (usize, i32)> = HashMap::new();
        let mut volume = 0.0;
        for face in &self.triangles {
            if face
                .iter()
                .any(|index| *index >= self.vertices_body_m.len())
                || face[0] == face[1]
                || face[1] == face[2]
                || face[2] == face[0]
            {
                return Err("静水船体三角形索引无效".into());
            }
            let points = face.map(|index| self.vertices_body_m[index]);
            let first = std::array::from_fn(|axis| points[1][axis] - points[0][axis]);
            let second = std::array::from_fn(|axis| points[2][axis] - points[0][axis]);
            let normal = moment_from_force(first, second);
            let area_squared: f64 = normal.iter().map(|value| value * value).sum();
            if !area_squared.is_finite() || area_squared <= 1e-24 {
                return Err("静水船体包含退化或非有限三角形".into());
            }
            let cross = moment_from_force(points[1], points[2]);
            volume += (0..3)
                .map(|axis| points[0][axis] * cross[axis])
                .sum::<f64>()
                / 6.0;
            for (first, last) in [(face[0], face[1]), (face[1], face[2]), (face[2], face[0])] {
                let key = (first.min(last), first.max(last));
                let value = edges.entry(key).or_default();
                value.0 += 1;
                value.1 += if first < last { 1 } else { -1 };
            }
        }
        if edges
            .values()
            .any(|(count, orientation)| *count != 2 || *orientation != 0)
        {
            return Err("静水船体存在开口、非流形边或法向冲突".into());
        }
        if !volume.is_finite() || volume <= 0.0 {
            return Err("静水船体的封闭有向体积无效".into());
        }
        Ok(())
    }

    pub fn evaluate(
        &self,
        state: &TruthState,
        mass_kg: f64,
        density_kg_m3: f64,
    ) -> HydrostaticEvaluation {
        let rotation = rotation_matrix(state.quaternion);
        let cg_depth = state.position_ned[2] - self.cg_waterline_height_m;
        // 水平原点随船平移，避免长航程下多面体积分的消减误差。
        let vertices: Vec<[f64; 3]> = self
            .vertices_body_m
            .iter()
            .map(|point| {
                let mut world = std::array::from_fn(|row| {
                    (0..3)
                        .map(|axis| rotation[row][axis] * point[axis])
                        .sum::<f64>()
                });
                world[2] += cg_depth;
                world
            })
            .collect();
        let mut volume = 0.0;
        let mut first_moment = [0.0; 3];
        for face in &self.triangles {
            let original = [vertices[face[0]], vertices[face[1]], vertices[face[2]]];
            let mut polygon = [[0.0; 3]; 4];
            let mut length = 0usize;
            let mut previous = original[2];
            for current in original {
                if (previous[2] >= 0.0) != (current[2] >= 0.0) {
                    let ratio = previous[2] / (previous[2] - current[2]);
                    polygon[length] = std::array::from_fn(|axis| {
                        previous[axis] + ratio * (current[axis] - previous[axis])
                    });
                    polygon[length][2] = 0.0;
                    length += 1;
                }
                if current[2] >= 0.0 {
                    polygon[length] = current;
                    length += 1;
                }
                previous = current;
            }
            for index in 1..length.saturating_sub(1) {
                let triangle = [polygon[0], polygon[index], polygon[index + 1]];
                let cross = moment_from_force(triangle[1], triangle[2]);
                let signed_volume = (0..3)
                    .map(|axis| triangle[0][axis] * cross[axis])
                    .sum::<f64>()
                    / 6.0;
                volume += signed_volume;
                for axis in 0..3 {
                    first_moment[axis] += signed_volume
                        * (triangle[0][axis] + triangle[1][axis] + triangle[2][axis])
                        / 4.0;
                }
            }
        }
        // 水线封盖位于z=0，其四面体有向体积和一阶矩贡献均为零。
        let center = if volume > 1e-12 {
            first_moment.map(|value| value / volume)
        } else {
            [0.0; 3]
        };
        let buoyancy = 9.81 * density_kg_m3 * volume;
        let gravity = 9.81 * mass_kg;
        let force_world = [0.0, 0.0, buoyancy - gravity];
        let moment_world = [buoyancy * center[1], -buoyancy * center[0], 0.0];
        let mut restoring = [0.0; 6];
        for axis in 0..3 {
            restoring[axis] = (0..3)
                .map(|row| rotation[row][axis] * force_world[row])
                .sum();
            restoring[axis + 3] = (0..3)
                .map(|row| rotation[row][axis] * moment_world[row])
                .sum();
        }
        HydrostaticEvaluation {
            restoring_body: restoring,
            displaced_volume_m3: volume,
            center_of_buoyancy_waterline_ned_m: center,
            potential_energy_j: buoyancy * center[2] - gravity * state.position_ned[2],
        }
    }
}
