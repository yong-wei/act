//! 低频横移锚缆的弹性悬链线。坐标从海床锚点指向导缆点。
//! 自重含浮力，触底段保持单边接触。求解结果保留原张力供断缆判定。

use serde::{Deserialize, Serialize};

pub const DIAMETER_M: f64 = 0.04;
pub const AREA_M2: f64 = std::f64::consts::PI * DIAMETER_M * DIAMETER_M / 4.0;
pub const AXIAL_STIFFNESS_N: f64 = 200e9 * AREA_M2;
pub const WET_WEIGHT_N_PER_M: f64 = (7850.0 - 1025.0) * 9.81 * AREA_M2;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Catenary {
    pub horizontal_tension_n: f64,
    pub anchor_vertical_tension_n: f64,
    pub fairlead_vertical_tension_n: f64,
    pub suspended_length_m: f64,
    pub rest_length_m: f64,
    pub touches_bed: bool,
    pub fully_slack: bool,
    pub residual_m: f64,
}

#[derive(Clone, Copy)]
struct Geometry {
    x: f64,
    z: f64,
    // d(X,Z)/d(H,V0)或d(X,Z)/d(H,Ls)。
    jacobian: [[f64; 2]; 2],
}

fn free_geometry(horizontal: f64, vertical: f64, length: f64) -> Geometry {
    let weight = WET_WEIGHT_N_PER_M;
    let end_vertical = vertical + weight * length;
    let first_norm = horizontal.hypot(vertical);
    let second_norm = horizontal.hypot(end_vertical);
    let hyperbolic = (end_vertical / horizontal).asinh() - (vertical / horizontal).asinh();
    let cross_derivative = horizontal / weight * (1.0 / second_norm - 1.0 / first_norm);
    Geometry {
        x: horizontal / weight * hyperbolic + horizontal * length / AXIAL_STIFFNESS_N,
        z: (second_norm - first_norm) / weight
            + (vertical * length + 0.5 * weight * length * length) / AXIAL_STIFFNESS_N,
        jacobian: [
            [
                (hyperbolic - end_vertical / second_norm + vertical / first_norm) / weight
                    + length / AXIAL_STIFFNESS_N,
                cross_derivative,
            ],
            [
                cross_derivative,
                (end_vertical / second_norm - vertical / first_norm) / weight
                    + length / AXIAL_STIFFNESS_N,
            ],
        ],
    }
}

fn grounded_geometry(horizontal: f64, suspended: f64, length: f64) -> Geometry {
    let weight = WET_WEIGHT_N_PER_M;
    let vertical = weight * suspended;
    let norm = horizontal.hypot(vertical);
    let hyperbolic = (vertical / horizontal).asinh();
    Geometry {
        x: length - suspended
            + horizontal * length / AXIAL_STIFFNESS_N
            + horizontal / weight * hyperbolic,
        z: (norm - horizontal) / weight
            + weight * suspended * suspended / (2.0 * AXIAL_STIFFNESS_N),
        jacobian: [
            [
                length / AXIAL_STIFFNESS_N + (hyperbolic - vertical / norm) / weight,
                -1.0 + horizontal / norm,
            ],
            [
                (horizontal / norm - 1.0) / weight,
                vertical / norm + weight * suspended / AXIAL_STIFFNESS_N,
            ],
        ],
    }
}

/// 两未知量牛顿法，线搜索只约束可行区和几何残差，不限制物理张力。
fn solve_geometry(
    mut values: [f64; 2],
    target: [f64; 2],
    evaluate: impl Fn([f64; 2]) -> Geometry,
    feasible: impl Fn([f64; 2]) -> bool,
) -> Option<([f64; 2], f64)> {
    for _ in 0..50 {
        let geometry = evaluate(values);
        let residual = [geometry.x - target[0], geometry.z - target[1]];
        let error = residual[0].hypot(residual[1]);
        if error < 1e-7 {
            return Some((values, error));
        }
        let [[a, b], [c, d]] = geometry.jacobian;
        let determinant = a * d - b * c;
        if !determinant.is_finite() || determinant.abs() < 1e-24 {
            return None;
        }
        let delta = [
            (d * residual[0] - b * residual[1]) / determinant,
            (a * residual[1] - c * residual[0]) / determinant,
        ];
        let mut factor = 1.0;
        let mut accepted = false;
        for _ in 0..30 {
            let candidate = [values[0] - factor * delta[0], values[1] - factor * delta[1]];
            if feasible(candidate) {
                let next = evaluate(candidate);
                if (next.x - target[0]).hypot(next.z - target[1]) < error {
                    values = candidate;
                    accepted = true;
                    break;
                }
            }
            factor *= 0.5;
        }
        if !accepted {
            return None;
        }
    }
    None
}

pub fn solve_catenary(
    horizontal_m: f64,
    height_m: f64,
    rest_length_m: f64,
    previous: Option<&Catenary>,
) -> Result<Catenary, String> {
    if [horizontal_m, height_m, rest_length_m]
        .iter()
        .any(|value| !value.is_finite())
        || horizontal_m < 0.01
        || height_m < 0.0
        || rest_length_m <= 0.0
    {
        return Err("锚缆几何或无应力长度无效".into());
    }
    let weight = WET_WEIGHT_N_PER_M;
    let hanging =
        2.0 * height_m / ((1.0 + 2.0 * weight * height_m / AXIAL_STIFFNESS_N).sqrt() + 1.0);
    if rest_length_m >= horizontal_m + hanging {
        return Ok(Catenary {
            rest_length_m,
            suspended_length_m: hanging,
            fairlead_vertical_tension_n: weight * hanging,
            touches_bed: true,
            fully_slack: true,
            ..Catenary::default()
        });
    }
    let distance = horizontal_m.hypot(height_m);
    let estimated = (AXIAL_STIFFNESS_N * (distance / rest_length_m - 1.0)).max(5000.0);
    let initial = previous.filter(|cable| !cable.fully_slack).map_or(
        [
            estimated * horizontal_m / distance,
            estimated * height_m / distance - 0.5 * weight * rest_length_m,
        ],
        |cable| {
            [
                cable.horizontal_tension_n.max(1.0),
                cable.anchor_vertical_tension_n,
            ]
        },
    );
    if let Some(([horizontal, vertical], residual)) = solve_geometry(
        initial,
        [horizontal_m, height_m],
        |v| free_geometry(v[0], v[1], rest_length_m),
        |v| v[0] > 1e-6 && v.iter().all(|value| value.is_finite()),
    ) {
        if vertical >= 0.0 {
            return Ok(Catenary {
                horizontal_tension_n: horizontal,
                anchor_vertical_tension_n: vertical,
                fairlead_vertical_tension_n: vertical + weight * rest_length_m,
                suspended_length_m: rest_length_m,
                rest_length_m,
                residual_m: residual,
                touches_bed: false,
                fully_slack: false,
            });
        }
    }
    let suspended = previous
        .filter(|cable| cable.touches_bed && !cable.fully_slack)
        .map_or((2.0 * height_m * estimated / weight).sqrt(), |cable| {
            cable.suspended_length_m
        })
        .clamp(hanging.max(0.01), rest_length_m);
    let grounded = solve_geometry(
        [estimated, suspended],
        [horizontal_m, height_m],
        |v| grounded_geometry(v[0], v[1], rest_length_m),
        |v| {
            v[0] > 1e-8
                && v[1] > 0.0
                && v[1] <= rest_length_m
                && v.iter().all(|value| value.is_finite())
        },
    );
    let Some(([horizontal, suspended], residual)) = grounded else {
        return Err("弹性悬链线在声明的低频几何范围内未收敛".into());
    };
    Ok(Catenary {
        horizontal_tension_n: horizontal,
        anchor_vertical_tension_n: 0.0,
        fairlead_vertical_tension_n: weight * suspended,
        suspended_length_m: suspended,
        rest_length_m,
        touches_bed: true,
        fully_slack: false,
        residual_m: residual,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dredge_catenary_recovers_free_and_grounded_geometry() {
        for (horizontal, vertical, length) in
            [(60_000.0, 8000.0, 100.0), (900_000.0, 10_000.0, 100.0)]
        {
            let target = free_geometry(horizontal, vertical, length);
            let cable = solve_catenary(target.x, target.z, length, None).unwrap();
            assert!(!cable.touches_bed);
            assert!((cable.horizontal_tension_n / horizontal - 1.0).abs() < 1e-6);
            assert!((cable.anchor_vertical_tension_n - vertical).abs() < 0.1);
            let restored = solve_catenary(target.x, target.z, length, Some(&cable)).unwrap();
            assert!((restored.horizontal_tension_n - cable.horizontal_tension_n).abs() < 0.01);
        }
        let target = grounded_geometry(15_000.0, 80.0, 120.0);
        let cable = solve_catenary(target.x, target.z, 120.0, None).unwrap();
        assert!(cable.touches_bed && !cable.fully_slack);
        assert!((cable.horizontal_tension_n / 15_000.0 - 1.0).abs() < 1e-6);
        assert!((cable.suspended_length_m - 80.0).abs() < 1e-5);
    }

    #[test]
    fn dredge_cable_is_unilateral_and_keeps_breaking_tension() {
        let slack = solve_catenary(100.0, 20.0, 125.0, None).unwrap();
        assert!(slack.fully_slack && slack.horizontal_tension_n == 0.0);
        let short = solve_catenary(100.0, 20.0, 100.0, None).unwrap();
        assert!(
            short
                .horizontal_tension_n
                .hypot(short.fairlead_vertical_tension_n)
                > 1e6
        );
        assert!(solve_catenary(100.0, 20.0, f64::NAN, None).is_err());
    }
}
