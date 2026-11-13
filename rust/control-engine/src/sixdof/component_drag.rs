//! 矩形浮筒/立柱的低频构件阻力，按同一作用点速度形成六维耗散载荷。

use super::state::moment_from_force;

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ComponentDragDefinition {
    pub water_density_kg_m3: f64,
    pub drag_coefficient: f64,
    pub stations_per_axis: usize,
    /// FRD重心坐标中每个矩形构件的[x/y/z]上下界，代表冻结平均湿面。
    pub boxes_body_m: Vec<[[f64; 2]; 3]>,
}

#[derive(Debug, Clone, Copy)]
struct DragSample {
    point_body_m: [f64; 3],
    normal_axis: usize,
    resistance_factor: f64,
}

#[derive(Debug, Clone)]
pub struct ComponentDrag {
    samples: Vec<DragSample>,
}

impl ComponentDragDefinition {
    pub fn compile(&self) -> Result<ComponentDrag, String> {
        if !self.water_density_kg_m3.is_finite() || self.water_density_kg_m3 <= 0.0
            || !self.drag_coefficient.is_finite() || self.drag_coefficient < 0.0
            || !(1..=128).contains(&self.stations_per_axis) || self.boxes_body_m.is_empty()
        {
            return Err("构件阻力密度、系数或积分站点无效".into());
        }
        let mut samples = Vec::new();
        for bounds in &self.boxes_body_m {
            if bounds.iter().any(|pair| pair.iter().any(|value| !value.is_finite())
                || pair[0] >= pair[1] || !(pair[1] - pair[0]).is_finite())
            {
                return Err("构件湿面边界无效".into());
            }
            let center = bounds.map(|pair| pair[0] / 2.0 + pair[1] / 2.0);
            let intervals = bounds.map(|pair| (pair[1] - pair[0]) / self.stations_per_axis as f64);
            for axis in 0..3 {
                let first = (axis + 1) % 3;
                let second = (axis + 2) % 3;
                let factor = 0.5 * self.water_density_kg_m3 * self.drag_coefficient * intervals[first] * intervals[second];
                if !factor.is_finite() {
                    return Err("构件阻力投影面积超出有限数值范围".into());
                }
                for i in 0..self.stations_per_axis {
                    for j in 0..self.stations_per_axis {
                        let mut point = center;
                        point[first] = bounds[first][0] + (i as f64 + 0.5) * intervals[first];
                        point[second] = bounds[second][0] + (j as f64 + 0.5) * intervals[second];
                        samples.push(DragSample { point_body_m: point, normal_axis: axis, resistance_factor: factor });
                    }
                }
            }
        }
        Ok(ComponentDrag { samples })
    }
}

impl ComponentDrag {
    pub fn loads(&self, relative_velocity_body: &[f64; 6]) -> [f64; 6] {
        let angular = [relative_velocity_body[3], relative_velocity_body[4], relative_velocity_body[5]];
        let mut output = [0.0; 6];
        for sample in &self.samples {
            let rotational = moment_from_force(angular, sample.point_body_m);
            let axis = sample.normal_axis;
            let velocity = relative_velocity_body[axis] + rotational[axis];
            let mut force = [0.0; 3];
            force[axis] = -sample.resistance_factor * velocity.abs() * velocity;
            let moment = moment_from_force(sample.point_body_m, force);
            output[axis] += force[axis];
            for coordinate in 0..3 {
                output[coordinate + 3] += moment[coordinate];
            }
        }
        output
    }
}
