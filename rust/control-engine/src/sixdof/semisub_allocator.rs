//! 981教学分配。局部凸子问题保留实际方位可达域，外层更新功率上界。

use super::actuator_system::{ActuatorCommands, ActuatorSystem};
use super::benchmark_b470::propeller_loads_b470;
use super::passive_observer::wrap_pi;
use serde::{Deserialize, Serialize};

pub const THRUST_SCALE_N: f64 = 800_000.0;
pub const MOMENT_ARM_M: f64 = 40.0;
pub const DP_DT_S: f64 = 0.1;
const NEIGHBOURS: [usize; 8] = [2, 3, 0, 1, 6, 7, 4, 5];

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AllocationMode {
    Pseudoinverse,
    SequentialConvex,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AllocationResult {
    pub requested_body: [f64; 3],
    pub allocated_body: [f64; 3],
    pub residual_body: [f64; 3],
    pub normalized_residual: f64,
    pub forces_body_n: [[f64; 2]; 8],
    pub predicted_power_w: f64,
    pub iterations: usize,
    pub feasible: bool,
    pub turning_without_thrust: [bool; 8],
    pub commands: ActuatorCommands,
}

#[derive(Clone, Copy)]
struct Cone {
    center: f64,
    half_width: f64,
    maximum: f64,
    reverse: bool,
    turning: bool,
    target_azimuth: f64,
}

pub fn allocation_matrix(system: &ActuatorSystem) -> [[f64; 16]; 3] {
    let mut matrix = [[0.0; 16]; 3];
    for (index, shaft) in system.propulsors.iter().enumerate().take(8) {
        matrix[0][index * 2] = 1.0;
        matrix[1][index * 2 + 1] = 1.0;
        matrix[2][index * 2] = -shaft.installation.position_body_m[1] / MOMENT_ARM_M;
        matrix[2][index * 2 + 1] = shaft.installation.position_body_m[0] / MOMENT_ARM_M;
    }
    matrix
}

pub fn inverse3(matrix: [f64; 9]) -> Option<[f64; 9]> {
    let [a, b, c, d, e, f, g, h, i] = matrix;
    let cofactors = [
        e * i - f * h,
        c * h - b * i,
        b * f - c * e,
        f * g - d * i,
        a * i - c * g,
        c * d - a * f,
        d * h - e * g,
        b * g - a * h,
        a * e - b * d,
    ];
    let determinant = a * cofactors[0] + b * cofactors[3] + c * cofactors[6];
    let scale = matrix
        .iter()
        .fold(0.0_f64, |old, value| old.max(value.abs()));
    if !determinant.is_finite() || determinant.abs() <= 1e-12 * scale.powi(3) {
        return None;
    }
    Some(cofactors.map(|value| value / determinant))
}

fn multiply(matrix: &[[f64; 16]; 3], force: &[f64; 16]) -> [f64; 3] {
    std::array::from_fn(|axis| matrix[axis].iter().zip(force).map(|(a, b)| a * b).sum())
}

fn pseudoinverse(matrix: &[[f64; 16]; 3], target: [f64; 3], weights: [f64; 3]) -> [f64; 16] {
    let gram = std::array::from_fn(|index| {
        let row = index / 3;
        let column = index % 3;
        matrix[row]
            .iter()
            .zip(&matrix[column])
            .map(|(a, b)| a * b)
            .sum::<f64>()
            + if row == column {
                1e-10 / weights[row]
            } else {
                0.0
            }
    });
    let inverse = inverse3(gram).expect("八推进器的冻结平面布局满秩");
    let dual: [f64; 3] =
        std::array::from_fn(|row| (0..3).map(|col| inverse[row * 3 + col] * target[col]).sum());
    std::array::from_fn(|index| (0..3).map(|axis| matrix[axis][index] * dual[axis]).sum())
}

fn forbidden_force_angle(system: &ActuatorSystem, index: usize) -> f64 {
    let origin = system.propulsors[index].installation.position_body_m;
    let neighbour = system.propulsors[NEIGHBOURS[index]]
        .installation
        .position_body_m;
    wrap_pi((neighbour[1] - origin[1]).atan2(neighbour[0] - origin[0]) + std::f64::consts::PI)
}

pub fn jet_is_allowed(system: &ActuatorSystem, index: usize, force_angle: f64) -> bool {
    wrap_pi(force_angle - forbidden_force_angle(system, index)).abs() > 10.0_f64.to_radians() + 1e-8
}

/// 使用同一四象限桨图谱反算轴速，实际轴惯量和伺服继续由物理模型推进。
pub fn shaft_reference(
    system: &ActuatorSystem,
    index: usize,
    thrust_n: f64,
    azimuth: f64,
    velocity_body: [f64; 3],
) -> (f64, f64, f64) {
    if thrust_n.abs() < 1e-6 {
        return (0.0, 0.0, 0.0);
    }
    let shaft = &system.propulsors[index];
    let position = shaft.installation.position_body_m;
    let local = [
        velocity_body[0] - velocity_body[2] * position[1],
        velocity_body[1] + velocity_body[2] * position[0],
    ];
    let axial = local[0] * azimuth.cos() + local[1] * azimuth.sin();
    let sign = thrust_n.signum();
    let mut low = 0.0;
    let mut high = shaft.rated_speed_rad_s;
    for _ in 0..28 {
        let omega = (low + high) * 0.5;
        let (thrust, _) = propeller_loads_b470(
            shaft.diameter_m,
            axial,
            sign * omega / (2.0 * std::f64::consts::PI),
            system.water_density_kg_m3,
        );
        if sign * thrust < thrust_n.abs() {
            low = omega;
        } else {
            high = omega;
        }
    }
    let omega = sign * (low + high) * 0.5;
    let (thrust, torque) = propeller_loads_b470(
        shaft.diameter_m,
        axial,
        omega / (2.0 * std::f64::consts::PI),
        system.water_density_kg_m3,
    );
    (omega, (torque * omega).max(0.0), thrust)
}

fn cones(
    system: &ActuatorSystem,
    desired: &[f64; 16],
    measured_azimuth: [f64; 8],
    measured_speed: [f64; 8],
    failed: Option<usize>,
    reallocate: bool,
) -> [Cone; 8] {
    std::array::from_fn(|index| {
        let shaft = &system.propulsors[index];
        let servo = shaft.azimuth.as_ref().expect("981使用全回转推进器").servo;
        let mut angle = desired[2 * index + 1].atan2(desired[2 * index]);
        let exclusion_center = forbidden_force_angle(system, index);
        let exclusion_offset = wrap_pi(angle - exclusion_center);
        let cone_half = 10.0_f64.to_radians() + 1e-6;
        if exclusion_offset.abs() <= cone_half {
            angle = wrap_pi(
                exclusion_center
                    + if exclusion_offset < 0.0 {
                        -cone_half
                    } else {
                        cone_half
                    },
            );
        }
        let forward_error = wrap_pi(angle - measured_azimuth[index]);
        let reverse_error = wrap_pi(angle + std::f64::consts::PI - measured_azimuth[index]);
        let reverse = reverse_error.abs() < forward_error.abs();
        let error = if reverse {
            reverse_error
        } else {
            forward_error
        };
        let force_center =
            measured_azimuth[index] + if reverse { std::f64::consts::PI } else { 0.0 };
        let reach = servo.max_rate_rad_s * DP_DT_S;
        let forbidden = wrap_pi(forbidden_force_angle(system, index) - force_center);
        let crosses =
            forbidden.abs() <= error.abs() + cone_half && error.signum() == forbidden.signum();
        let turning = crosses || !jet_is_allowed(system, index, force_center);
        let safe_target = wrap_pi(measured_azimuth[index] + error.clamp(-reach, reach));
        let must_brake = turning && measured_speed[index].abs() > 0.05;
        let maximum = if (failed == Some(index) && reallocate) || turning {
            0.0
        } else {
            shaft
                .max_thrust_n
                .unwrap_or(THRUST_SCALE_N)
                .min(THRUST_SCALE_N)
                / THRUST_SCALE_N
        };
        Cone {
            center: force_center,
            half_width: reach.min((forbidden.abs() - cone_half).max(0.0)),
            maximum,
            reverse,
            turning,
            target_azimuth: if must_brake {
                measured_azimuth[index]
            } else {
                safe_target
            },
        }
    })
}

/// 凸锥/圆盘和总功率椭球交集的欧氏投影。每台两分量共用缩放。
fn project(
    value: [f64; 16],
    cones: &[Cone; 8],
    power_quadratic: [f64; 8],
    budget: f64,
) -> [f64; 16] {
    let directions: [[f64; 2]; 8] = std::array::from_fn(|index| {
        let angle = value[index * 2 + 1].atan2(value[index * 2]);
        let selected = cones[index].center
            + wrap_pi(angle - cones[index].center)
                .clamp(-cones[index].half_width, cones[index].half_width);
        [selected.cos(), selected.sin()]
    });
    let radius: [f64; 8] = std::array::from_fn(|index| {
        (value[index * 2] * directions[index][0] + value[index * 2 + 1] * directions[index][1])
            .max(0.0)
    });
    let radii = |lambda: f64| -> [f64; 8] {
        std::array::from_fn(|index| {
            (radius[index] / (1.0 + lambda * power_quadratic[index])).min(cones[index].maximum)
        })
    };
    let power = |r: [f64; 8]| {
        (0..8)
            .map(|index| power_quadratic[index] * r[index].powi(2))
            .sum::<f64>()
    };
    let mut selected = radii(0.0);
    if power(selected) > budget.max(0.0) {
        let mut high = 1.0;
        while power(radii(high)) > budget.max(0.0) && high < 1e12 {
            high *= 2.0;
        }
        let mut low = 0.0;
        for _ in 0..36 {
            let middle = (low + high) * 0.5;
            if power(radii(middle)) > budget.max(0.0) {
                low = middle;
            } else {
                high = middle;
            }
        }
        selected = radii(high);
    }
    std::array::from_fn(|index| selected[index / 2] * directions[index / 2][index % 2])
}

fn objective(
    matrix: &[[f64; 16]; 3],
    force: &[f64; 16],
    target: [f64; 3],
    previous: &[f64; 16],
    weights: [f64; 3],
    energy: f64,
) -> f64 {
    let actual = multiply(matrix, force);
    (0..3)
        .map(|axis| 1000.0 * weights[axis] * (actual[axis] - target[axis]).powi(2))
        .sum::<f64>()
        + (0..16)
            .map(|index| {
                energy * force[index].powi(2) + 0.01 * (force[index] - previous[index]).powi(2)
            })
            .sum::<f64>()
}

#[allow(clippy::too_many_arguments)]
pub fn allocate(
    system: &ActuatorSystem,
    desired_body: [f64; 3],
    mode: AllocationMode,
    weights: [f64; 3],
    energy_weight: f64,
    measured_azimuth: [f64; 8],
    measured_speed: [f64; 8],
    velocity_body: [f64; 3],
    previous_force_n: [[f64; 2]; 8],
    failed: Option<usize>,
    reallocate: bool,
    mut commands: ActuatorCommands,
) -> AllocationResult {
    let matrix = allocation_matrix(system);
    let target = [
        desired_body[0] / THRUST_SCALE_N,
        desired_body[1] / THRUST_SCALE_N,
        desired_body[2] / (THRUST_SCALE_N * MOMENT_ARM_M),
    ];
    let ideal = pseudoinverse(&matrix, target, weights);
    let previous =
        std::array::from_fn(|index| previous_force_n[index / 2][index % 2] / THRUST_SCALE_N);
    let mut cones = cones(
        system,
        &ideal,
        measured_azimuth,
        measured_speed,
        failed,
        reallocate,
    );
    let budget = system.max_positive_motor_power_w.unwrap_or(32e6);
    let mut reference = ideal;
    let mut best = [0.0; 16];
    let mut best_cost = objective(&matrix, &best, target, &previous, weights, energy_weight);
    let mut best_power = 0.0;
    let mut iterations = 0;
    let mut best_commands = commands.clone();
    for (index, shaft) in best_commands.shafts.iter_mut().enumerate() {
        shaft.speed_reference_rad_s = 0.0;
        shaft.azimuth_rad = measured_azimuth[index];
    }
    if mode == AllocationMode::Pseudoinverse {
        for index in 0..8 {
            let force = [
                ideal[index * 2] * THRUST_SCALE_N,
                ideal[index * 2 + 1] * THRUST_SCALE_N,
            ];
            let angle = force[1].atan2(force[0]);
            let (omega, power, _) = shaft_reference(
                system,
                index,
                force[0].hypot(force[1]),
                angle,
                velocity_body,
            );
            commands.shafts[index].speed_reference_rad_s = omega;
            commands.shafts[index].azimuth_rad = angle;
            best_power += power;
        }
        best = ideal;
        best_commands = commands;
    } else {
        for outer in 0..5 {
            iterations = outer + 1;
            let mut constant = 0.0;
            let quadratic: [f64; 8] = std::array::from_fn(|index| {
                let radius = reference[index * 2]
                    .hypot(reference[index * 2 + 1])
                    .clamp(0.005, 1.0);
                let angle = cones[index].center;
                let azimuth = wrap_pi(
                    angle
                        - if cones[index].reverse {
                            std::f64::consts::PI
                        } else {
                            0.0
                        },
                );
                let signed = if cones[index].reverse {
                    -radius
                } else {
                    radius
                };
                let (_, power, _) = shaft_reference(
                    system,
                    index,
                    signed * THRUST_SCALE_N,
                    azimuth,
                    velocity_body,
                );
                // r^1.5=(r²)^.75的切线上界，非线性桨功率在候选解后再次检查。
                let coefficient = power.max(1.0) / radius.powf(1.5);
                constant += 0.25 * coefficient * radius.powf(1.5);
                0.75 * coefficient / radius.sqrt()
            });
            let mut force = project(reference, &cones, quadratic, budget - constant);
            let mut extrapolated = force;
            let mut momentum = 1.0_f64;
            let lipschitz = 2.0
                * ((0..3)
                    .map(|axis| {
                        1000.0
                            * weights[axis]
                            * matrix[axis].iter().map(|value| value * value).sum::<f64>()
                    })
                    .sum::<f64>()
                    + energy_weight
                    + 0.01);
            for _ in 0..96 {
                let actual = multiply(&matrix, &extrapolated);
                let proposal = std::array::from_fn(|index| {
                    let gradient = 2.0
                        * ((0..3)
                            .map(|axis| {
                                1000.0
                                    * weights[axis]
                                    * matrix[axis][index]
                                    * (actual[axis] - target[axis])
                            })
                            .sum::<f64>()
                            + energy_weight * extrapolated[index]
                            + 0.01 * (extrapolated[index] - previous[index]));
                    extrapolated[index] - gradient / lipschitz
                });
                let next = project(proposal, &cones, quadratic, budget - constant);
                let next_momentum = (1.0 + (1.0 + 4.0 * momentum * momentum).sqrt()) * 0.5;
                extrapolated = std::array::from_fn(|index| {
                    next[index] + (momentum - 1.0) / next_momentum * (next[index] - force[index])
                });
                force = next;
                momentum = next_momentum;
            }
            let mut candidate_commands = commands.clone();
            let mut power_sum = 0.0;
            let mut feasible = true;
            for index in 0..8 {
                let magnitude = force[index * 2].hypot(force[index * 2 + 1]) * THRUST_SCALE_N;
                let angle = if magnitude > 1e-6 {
                    force[index * 2 + 1].atan2(force[index * 2])
                } else {
                    cones[index].center
                };
                let azimuth = wrap_pi(
                    angle
                        - if cones[index].reverse {
                            std::f64::consts::PI
                        } else {
                            0.0
                        },
                );
                let signed = if cones[index].reverse {
                    -magnitude
                } else {
                    magnitude
                };
                let (omega, power, actual) =
                    shaft_reference(system, index, signed, azimuth, velocity_body);
                let shaft = &system.propulsors[index];
                if power > shaft.max_power_w + 1.0 {
                    cones[index].maximum = cones[index].maximum.min(
                        magnitude / THRUST_SCALE_N
                            * (shaft.max_power_w / power).powf(2.0 / 3.0)
                            * 0.99,
                    );
                }
                if (actual - signed).abs() > 1.0_f64.max(magnitude * 1e-5) {
                    cones[index].maximum = cones[index]
                        .maximum
                        .min(actual.abs() / THRUST_SCALE_N * 0.99);
                }
                feasible &= magnitude <= shaft.max_thrust_n.unwrap_or(THRUST_SCALE_N) + 1e-5
                    && (actual - signed).abs() <= 1.0_f64.max(magnitude * 1e-5)
                    && power <= shaft.max_power_w + 1.0
                    && (magnitude < 1e-6 || jet_is_allowed(system, index, angle));
                power_sum += power;
                candidate_commands.shafts[index].speed_reference_rad_s = omega;
                let servo = &shaft.azimuth.as_ref().expect("全回转推进器").servo;
                let response = 1.0 - (-DP_DT_S / servo.time_constant_s).exp();
                let next_angle = if cones[index].turning {
                    cones[index].target_azimuth
                } else {
                    azimuth
                };
                candidate_commands.shafts[index].azimuth_rad = wrap_pi(
                    measured_azimuth[index]
                        + wrap_pi(next_angle - measured_azimuth[index]) / response,
                );
            }
            feasible &= power_sum <= budget + 1.0;
            let cost = objective(&matrix, &force, target, &previous, weights, energy_weight);
            if feasible && cost <= best_cost + 1e-12 {
                best = force;
                best_cost = cost;
                best_power = power_sum;
                best_commands = candidate_commands;
            }
            reference = force;
        }
        // 零推力转向也需推进实际方位，直至越过射流禁区后再给出出力。
        for index in 0..8 {
            if cones[index].turning {
                let servo = &system.propulsors[index]
                    .azimuth
                    .as_ref()
                    .expect("全回转推进器")
                    .servo;
                let response = 1.0 - (-DP_DT_S / servo.time_constant_s).exp();
                best_commands.shafts[index].speed_reference_rad_s = 0.0;
                best_commands.shafts[index].azimuth_rad = wrap_pi(
                    measured_azimuth[index]
                        + wrap_pi(cones[index].target_azimuth - measured_azimuth[index]) / response,
                );
            }
        }
    }
    let allocated = multiply(&matrix, &best);
    let allocated_body = [
        allocated[0] * THRUST_SCALE_N,
        allocated[1] * THRUST_SCALE_N,
        allocated[2] * THRUST_SCALE_N * MOMENT_ARM_M,
    ];
    let residual_body = std::array::from_fn(|axis| desired_body[axis] - allocated_body[axis]);
    AllocationResult {
        requested_body: desired_body,
        allocated_body,
        residual_body,
        normalized_residual: (0..3)
            .map(|axis| (target[axis] - allocated[axis]).powi(2))
            .sum::<f64>()
            .sqrt(),
        forces_body_n: std::array::from_fn(|index| {
            [
                best[index * 2] * THRUST_SCALE_N,
                best[index * 2 + 1] * THRUST_SCALE_N,
            ]
        }),
        predicted_power_w: best_power,
        iterations,
        feasible: mode == AllocationMode::SequentialConvex,
        turning_without_thrust: cones.map(|cone| cone.turning),
        commands: best_commands,
    }
}
