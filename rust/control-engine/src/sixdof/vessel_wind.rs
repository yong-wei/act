//! 冻结船形的Fujiwara 2005分量回归，以及平台遮挡投影构件阻力。
//!
//! 常规船的式(7/8/12/14–22/25/26)及表3来自原始论文
//! DOI 10.2534/jjasnaoe.2.243。新参数包显式选择此版本，旧风载恢复点保留原路径。

use super::state::{moment_from_force, rotation_matrix};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "geometry", rename_all = "snake_case")]
pub enum VesselWindModel {
    Fujiwara(FujiwaraGeometry),
    Projected(ProjectedWindGeometry),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FujiwaraGeometry {
    pub frontal_area_m2: f64,
    pub lateral_area_m2: f64,
    pub superstructure_lateral_area_m2: f64,
    pub loa_m: f64,
    pub beam_m: f64,
    pub center_lateral_from_midship_m: f64,
    pub center_lateral_above_waterline_m: f64,
    pub superstructure_height_m: f64,
    pub midship_body_x_m: f64,
    pub pressure_center_body_m: [f64; 3],
    pub frontal_center_body_z_m: f64,
    pub cg_waterline_height_m: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindPanel {
    pub point_body_m: [f64; 3],
    pub normal_axis: usize,
    pub projected_area_m2: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectedWindGeometry {
    pub air_density_kg_m3: f64,
    pub drag_coefficient: f64,
    pub panels: Vec<WindPanel>,
}

impl VesselWindModel {
    pub fn validate(&self) -> Result<(), String> {
        match self {
            Self::Fujiwara(geometry) => {
                let positive = [geometry.frontal_area_m2, geometry.lateral_area_m2,
                    geometry.loa_m, geometry.beam_m, geometry.center_lateral_above_waterline_m,
                    geometry.superstructure_height_m];
                let finite = [geometry.superstructure_lateral_area_m2,
                    geometry.center_lateral_from_midship_m, geometry.midship_body_x_m,
                    geometry.frontal_center_body_z_m, geometry.cg_waterline_height_m,
                    geometry.pressure_center_body_m[0], geometry.pressure_center_body_m[1],
                    geometry.pressure_center_body_m[2]];
                if positive.iter().any(|value| !value.is_finite() || *value <= 0.0)
                    || finite.iter().any(|value| !value.is_finite())
                    || !(0.0..=geometry.lateral_area_m2).contains(&geometry.superstructure_lateral_area_m2)
                    || geometry.beam_m > geometry.loa_m
                {
                    return Err("风载船形投影、尺度或压力中心无效".into());
                }
            }
            Self::Projected(geometry) => {
                if !geometry.air_density_kg_m3.is_finite() || geometry.air_density_kg_m3 <= 0.0
                    || !geometry.drag_coefficient.is_finite() || geometry.drag_coefficient <= 0.0
                    || geometry.panels.is_empty() || geometry.panels.len() > 50_000
                    || geometry.panels.iter().any(|panel| panel.normal_axis > 1
                        || !panel.projected_area_m2.is_finite() || panel.projected_area_m2 <= 0.0
                        || panel.point_body_m.iter().any(|value| !value.is_finite()))
                {
                    return Err("平台风载构件、投影面积或阻力系数无效".into());
                }
            }
        }
        Ok(())
    }

    pub fn loads(&self, true_wind_ned: [f64; 2], quaternion: [f64; 4], nu: [f64; 6]) -> [f64; 6] {
        let rotation = rotation_matrix(quaternion);
        let air_body = std::array::from_fn(|axis| rotation[0][axis]*true_wind_ned[0]
            + rotation[1][axis]*true_wind_ned[1]);
        match self {
            Self::Fujiwara(geometry) => geometry.loads(air_body, nu),
            Self::Projected(geometry) => geometry.loads(air_body, nu),
        }
    }
}

fn local_air(air: [f64; 3], nu: [f64; 6], point: [f64; 3]) -> [f64; 3] {
    let rotational = moment_from_force([nu[3], nu[4], nu[5]], point);
    std::array::from_fn(|axis| air[axis]-nu[axis]-rotational[axis])
}

fn add_force(output: &mut [f64; 6], force: [f64; 3], point: [f64; 3]) {
    let moment = moment_from_force(point, force);
    for axis in 0..3 {
        output[axis] += force[axis];
        output[axis+3] += moment[axis];
    }
}

impl ProjectedWindGeometry {
    fn loads(&self, air: [f64; 3], nu: [f64; 6]) -> [f64; 6] {
        let mut output = [0.0; 6];
        for panel in &self.panels {
            let velocity = local_air(air, nu, panel.point_body_m)[panel.normal_axis];
            let mut force = [0.0; 3];
            force[panel.normal_axis] = 0.5*self.air_density_kg_m3*self.drag_coefficient
                *panel.projected_area_m2*velocity.abs()*velocity;
            add_force(&mut output, force, panel.point_body_m);
        }
        output
    }
}

impl FujiwaraGeometry {
    /// 回归式中使用原论文带符号系数，β为正艏风起算的绝对来向。
    fn coefficients_for_half(&self, beta: f64, aft: bool) -> [f64; 2] {
        let length = self.loa_m;
        let beam = self.beam_m;
        let front = self.frontal_area_m2;
        let side = self.lateral_area_m2;
        let deck = self.superstructure_lateral_area_m2;
        let height = self.superstructure_height_m;
        let c_cf = 0.404+0.368*front/(beam*height)+0.902*height/length;
        let (c_lf, c_xli, c_alf, c_ym) = if aft {
            (0.018-5.091*beam/length+10.367*self.center_lateral_above_waterline_m/length
                -3.011*deck/(length*length)-0.341*front/(beam*beam),
             -1.901+12.727*side/(length*height)+24.407*front/side
                -40.310*beam/length-5.481*front/(beam*height),
             -0.314-1.117*deck/side,
             0.446+2.192*deck/(length*length))
        } else {
            (-0.922+0.507*side/(length*beam)+1.162*self.center_lateral_from_midship_m/length,
             0.458+3.245*side/(length*height)-2.313*front/(beam*height),
             -0.585-0.906*deck/side+3.239*beam/length,
             0.116+3.345*front/(length*beam))
        };
        let c_yli = std::f64::consts::PI*side/(length*length)+c_ym;
        let (sine, cosine) = beta.sin_cos();
        [c_lf*cosine+c_xli*(sine-0.5*sine*cosine*cosine)*sine*cosine
            +c_alf*sine*cosine.powi(3),
         c_cf*sine*sine+c_yli*(cosine+0.5*sine*sine*cosine)*sine*cosine]
    }

    pub fn coefficients(&self, beta: f64) -> [f64; 2] {
        let fraction = ((beta.to_degrees()-80.0)/20.0).clamp(0.0, 1.0);
        let weight = fraction*fraction*(3.0-2.0*fraction);
        let front = self.coefficients_for_half(beta, false);
        let aft = self.coefficients_for_half(beta, true);
        std::array::from_fn(|axis| front[axis]*(1.0-weight)+aft[axis]*weight)
    }

    fn loads(&self, air: [f64; 3], nu: [f64; 6]) -> [f64; 6] {
        let relative = local_air(air, nu, self.pressure_center_body_m);
        let speed_squared = relative[0]*relative[0]+relative[1]*relative[1];
        if speed_squared == 0.0 {
            return [0.0; 6];
        }
        let beta = (-relative[1]).atan2(-relative[0]).abs();
        let [cx, cy] = self.coefficients(beta);
        let q = 0.5*1.225*speed_squared;
        let fx = q*self.frontal_area_m2*cx;
        let fy = q*self.lateral_area_m2*cy*relative[1].signum();
        let yaw_lever = self.midship_body_x_m+0.927*self.center_lateral_from_midship_m
            -0.149*self.loa_m*(beta-std::f64::consts::FRAC_PI_2);
        let height_ratio = self.center_lateral_above_waterline_m/self.loa_m;
        let heel_coefficient = if height_ratio <= 0.097 {
            0.0737*height_ratio.powf(-0.821)
        } else { 0.5 };
        let heel_height = self.lateral_area_m2/self.loa_m*heel_coefficient;
        let mut output = [0.0; 6];
        add_force(&mut output, [fx, 0.0, 0.0],
            [0.0, self.pressure_center_body_m[1], self.frontal_center_body_z_m]);
        add_force(&mut output, [0.0, fy, 0.0],
            [yaw_lever, 0.0, self.cg_waterline_height_m-heel_height]);
        output
    }
}
