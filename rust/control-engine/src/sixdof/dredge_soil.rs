//! Miedema二维局部刀刃的饱和砂/黏土低阶切削。
//! 2019第3版§6.11式6-71至6-76、§7.4式7-43至7-55，
//! https://doi.org/10.5074/t.2019.001 。在线旋转刀齿采用局部平面条带近似。

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

pub const DEFINITION: &str = "miedema-local-strip-v1;alpha=45;phi=30;delta=15;rhoSat=1900;ki=kmax=1e-4;ni=0.40;nmax=0.45;p1m=0.15;p2m=0.32;clayCu=50e3;adhesion=25e3;rate=0.1428,0.03";
const WATER_DENSITY: f64 = 1025.0;
const GRAVITY: f64 = 9.81;
const BLADE_ANGLE: f64 = PI / 4.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DredgeSoil {
    Sand,
    Clay,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CuttingForce {
    pub tangential_n: f64,
    pub normal_n: f64,
    pub specific_energy_pa: f64,
    pub shear_angle_rad: f64,
    pub cavitating: bool,
}

#[derive(Debug, Clone)]
pub struct SoilCuttingLaw {
    sand_non_cavitating: (f64, [f64; 2]),
    sand_cavitating: (f64, [f64; 2]),
    clay_shear_angle: f64,
}

fn minimum_angle(upper: f64, force: impl Fn(f64) -> f64) -> f64 {
    let mut lower = PI / 180.0;
    let mut upper = upper - PI / 180.0;
    let ratio = (5.0f64.sqrt() - 1.0) / 2.0;
    let mut first = upper - ratio * (upper - lower);
    let mut second = lower + ratio * (upper - lower);
    let mut first_value = force(first);
    let mut second_value = force(second);
    for _ in 0..64 {
        if first_value < second_value {
            upper = second;
            second = first;
            second_value = first_value;
            first = upper - ratio * (upper - lower);
            first_value = force(first);
        } else {
            lower = first;
            first = second;
            first_value = second_value;
            second = lower + ratio * (upper - lower);
            second_value = force(second);
        }
    }
    (lower + upper) / 2.0
}

/// hb/hi=1的局部条带。平均孔压系数采用Miedema 1995简化模型的.15/0.32。
/// ki=kmax使加权渗透率保持同一声明值，孔隙率为T级代表值。
fn sand_coefficients(beta: f64, cavitating: bool) -> [f64; 2] {
    let phi = PI / 6.0;
    let delta = PI / 12.0;
    let [first_pressure, second_pressure] = if cavitating { [1.0, 1.0] } else { [0.15, 0.32] };
    let pressure = first_pressure * phi.sin() / beta.sin()
        + second_pressure * (BLADE_ANGLE + beta + phi).sin() / BLADE_ANGLE.sin();
    let normal = pressure / (BLADE_ANGLE + beta + delta + phi).sin();
    [
        normal * (BLADE_ANGLE + delta).sin() - second_pressure,
        normal * (BLADE_ANGLE + delta).cos()
            - second_pressure * BLADE_ANGLE.cos() / BLADE_ANGLE.sin(),
    ]
}

fn clay_coefficients(alpha: f64, beta: f64, adhesion_ratio: f64) -> [f64; 2] {
    let denominator = (alpha + beta).sin() * beta.sin() * alpha.sin();
    [
        (alpha.sin().powi(2) + adhesion_ratio * beta.sin().powi(2)) / denominator,
        (alpha.sin() * alpha.cos() - adhesion_ratio * beta.sin() * beta.cos()) / denominator,
    ]
}

impl Default for SoilCuttingLaw {
    fn default() -> Self {
        let sand_angle =
            |cavitating| minimum_angle(PI / 2.0, |beta| sand_coefficients(beta, cavitating)[0]);
        let non_cavitating = sand_angle(false);
        let cavitating = sand_angle(true);
        Self {
            sand_non_cavitating: (non_cavitating, sand_coefficients(non_cavitating, false)),
            sand_cavitating: (cavitating, sand_coefficients(cavitating, true)),
            clay_shear_angle: minimum_angle(PI - BLADE_ANGLE, |beta| {
                clay_coefficients(BLADE_ANGLE, beta, 0.5)[0]
            }),
        }
    }
}

impl SoilCuttingLaw {
    /// 输入为实际未切削层厚、刃口切削速度和条带宽度。输出力作用于实际刀齿位置。
    /// 空床、零速或零宽均返回零切削力，床面移除由调用方按实际扫掠体积提交。
    pub fn force(
        &self,
        soil: DredgeSoil,
        thickness_m: f64,
        speed_mps: f64,
        width_m: f64,
        water_depth_m: f64,
    ) -> Result<CuttingForce, String> {
        if [thickness_m, speed_mps, width_m, water_depth_m]
            .iter()
            .any(|value| !value.is_finite() || *value < 0.0)
            || thickness_m > 1.0
            || speed_mps > 30.0
            || width_m > 3.0
            || water_depth_m > 30.0
        {
            return Err("刀齿切厚、速度、宽度或水深超出教学切削模型适用域".into());
        }
        if thickness_m <= 1e-10 || speed_mps <= 1e-10 || width_m <= 1e-10 {
            return Ok(CuttingForce {
                tangential_n: 0.0,
                normal_n: 0.0,
                specific_energy_pa: 0.0,
                shear_angle_rad: 0.0,
                cavitating: false,
            });
        }
        let (shear, forces, cavitating) = match soil {
            DredgeSoil::Sand => {
                let volume_strain = (0.45 - 0.40) / (1.0 - 0.45);
                let non_cavitating_pressure =
                    WATER_DENSITY * GRAVITY * speed_mps * thickness_m * volume_strain / 1e-4;
                let cavitating_pressure = WATER_DENSITY * GRAVITY * (water_depth_m + 10.0);
                let (beta_n, coefficients_n) = self.sand_non_cavitating;
                let (beta_c, coefficients_c) = self.sand_cavitating;
                if coefficients_n[0] * non_cavitating_pressure
                    <= coefficients_c[0] * cavitating_pressure
                {
                    (
                        beta_n,
                        coefficients_n.map(|coefficient| coefficient * non_cavitating_pressure),
                        false,
                    )
                } else {
                    (
                        beta_c,
                        coefficients_c.map(|coefficient| coefficient * cavitating_pressure),
                        true,
                    )
                }
            }
            DredgeSoil::Clay => {
                let beta = self.clay_shear_angle;
                let strain_rate =
                    1.4 * speed_mps / thickness_m * BLADE_ANGLE.sin() / (BLADE_ANGLE + beta).sin();
                let strengthening = 1.0 + 0.1428 * (1.0 + strain_rate / 0.03).ln();
                (
                    beta,
                    clay_coefficients(BLADE_ANGLE, beta, 0.5)
                        .map(|coefficient| coefficient * strengthening * 50_000.0),
                    false,
                )
            }
        };
        let area = thickness_m * width_m;
        Ok(CuttingForce {
            tangential_n: forces[0] * area,
            normal_n: forces[1] * area,
            specific_energy_pa: forces[0],
            shear_angle_rad: shear,
            cavitating,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dredge_clay_book_normalization_and_zero_adhesion_solution() {
        // §7.4图7-21/7-23的c=1kPa、hi=0.1m、w=1m、λs=1归一条件。
        // r=1、α=45°时式7-51/7-52给出β=45°、Fh=200N、Fv=0。
        let beta = minimum_angle(PI - BLADE_ANGLE, |angle| {
            clay_coefficients(BLADE_ANGLE, angle, 1.0)[0]
        });
        assert!((beta - BLADE_ANGLE).abs() < 1e-7);
        let force =
            clay_coefficients(BLADE_ANGLE, beta, 1.0).map(|coefficient| coefficient * 1000.0 * 0.1);
        assert!((force[0] - 200.0).abs() < 1e-8);
        assert!(force[1].abs() < 1e-5);
        let no_adhesion = minimum_angle(PI - BLADE_ANGLE, |angle| {
            clay_coefficients(BLADE_ANGLE, angle, 0.0)[0]
        });
        assert!((no_adhesion - (PI - BLADE_ANGLE) / 2.0).abs() < 1e-7);
    }

    #[test]
    fn dredge_sand_pressure_branches_and_local_power_keep_units() {
        let law = SoilCuttingLaw::default();
        let slow = law.force(DredgeSoil::Sand, 0.02, 0.1, 1.0, 20.0).unwrap();
        let fast = law.force(DredgeSoil::Sand, 0.3, 5.0, 1.0, 20.0).unwrap();
        assert!(!slow.cavitating && fast.cavitating);
        assert!(fast.tangential_n > slow.tangential_n);
        assert!((fast.specific_energy_pa * 0.3 - fast.tangential_n).abs() < 1e-8);
        let deeper = law.force(DredgeSoil::Sand, 0.3, 5.0, 1.0, 25.0).unwrap();
        assert!((deeper.tangential_n / fast.tangential_n - 35.0 / 30.0).abs() < 1e-12);
        let clay = law.force(DredgeSoil::Clay, 0.3, 5.0, 1.0, 20.0).unwrap();
        assert!(clay.tangential_n > 0.0 && clay.tangential_n != fast.tangential_n);
        assert_eq!(
            law.force(DredgeSoil::Clay, 0.0, 5.0, 1.0, 20.0)
                .unwrap()
                .tangential_n,
            0.0
        );
        assert_eq!(
            law.force(DredgeSoil::Sand, 0.3, 0.0, 1.0, 20.0)
                .unwrap()
                .tangential_n,
            0.0
        );
        assert!(law
            .force(DredgeSoil::Sand, f64::NAN, 1.0, 1.0, 20.0)
            .is_err());
    }
}
