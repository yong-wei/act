//! 天鲸教学桥架与绞刀的6+2自由度惯性耦合。
//! 200t等效组件已包含在冻结船舶质量中，以q=0的组件惯量作扣除基准。
//! 湿段以等体积圆柱的横向附加质量描述，保持相对流速动能一致。

use super::dynamics::solve_linear_6;
use super::state::{
    moment_from_force, normalize_quaternion, rotation_matrix, symmetric_positive_definite_6,
    TruthState,
};

pub const LENGTH_M: f64 = 35.0;
pub const DRY_MASS_KG: f64 = 200_000.0;
pub const ROTOR_INERTIA_KG_M2: f64 = 20_000.0;
pub const HINGE_BODY_M: [f64; 3] = [49.5, 0.0, 0.7075145831466294];
pub const CG_HEIGHT_M: f64 = 2.7075145831466294;
pub const CYLINDER_AREA_M2: f64 = DRY_MASS_KG / 7850.0 / LENGTH_M;
const RHO: f64 = 1025.0;
const GRAVITY: f64 = 9.81;
// 三点Gauss精确积分均匀杆的零至二阶矩。
const QUADRATURE: [(f64, f64); 3] = [
    (0.1127016653792583, 5.0 / 18.0),
    (0.5, 4.0 / 9.0),
    (0.8872983346207417, 5.0 / 18.0),
];

pub type Matrix8 = [[f64; 8]; 8];

#[derive(Clone)]
pub struct CoupledLadder {
    physical_mass: [[f64; 6]; 6],
}

pub struct LadderAcceleration {
    pub body: [f64; 6],
    pub ladder_rad_s2: f64,
    pub rotor_rad_s2: f64,
    pub reaction_body: [f64; 6],
    pub modal_mass: [[f64; 2]; 2],
}

struct Kinetic {
    mass: Matrix8,
    momentum: [f64; 8],
    energy: f64,
}

pub fn direction(q: f64) -> [f64; 3] {
    [q.cos(), 0.0, q.sin()]
}
pub fn point_body(q: f64, along_m: f64) -> [f64; 3] {
    let axis = direction(q);
    std::array::from_fn(|i| HINGE_BODY_M[i] + along_m * axis[i])
}
pub fn point_ladder_derivative(q: f64, along_m: f64) -> [f64; 3] {
    [-along_m * q.sin(), 0.0, along_m * q.cos()]
}
pub fn world_point(state: &TruthState, body: [f64; 3]) -> [f64; 3] {
    let rotation = rotation_matrix(state.quaternion);
    std::array::from_fn(|row| {
        state.position_ned[row] - if row == 2 { CG_HEIGHT_M } else { 0.0 }
            + (0..3)
                .map(|column| rotation[row][column] * body[column])
                .sum::<f64>()
    })
}
pub fn point_jacobian(point: [f64; 3], q_derivative: [f64; 3]) -> [[f64; 8]; 3] {
    std::array::from_fn(|row| {
        std::array::from_fn(|column| {
            if column < 3 {
                f64::from(row == column)
            } else if column < 6 {
                let axis = std::array::from_fn(|i| f64::from(i == column - 3));
                moment_from_force(axis, point)[row]
            } else if column == 6 {
                q_derivative[row]
            } else {
                0.0
            }
        })
    })
}

/// 实际中心线与静水面的交点，保留船体垂荡、横纵摇和桥架角影响。
pub fn wet_segment(state: &TruthState, q: f64) -> (f64, f64) {
    let first = world_point(state, point_body(q, 0.0))[2];
    let last = world_point(state, point_body(q, LENGTH_M))[2];
    if first >= 0.0 && last >= 0.0 {
        return (0.0, LENGTH_M);
    }
    if first <= 0.0 && last <= 0.0 {
        return (0.0, 0.0);
    }
    let crossing = (-first / (last - first) * LENGTH_M).clamp(0.0, LENGTH_M);
    if last > first {
        (crossing, LENGTH_M)
    } else {
        (0.0, crossing)
    }
}

fn add_particle(
    kinetic: &mut Kinetic,
    jacobian: [[f64; 8]; 3],
    metric: [[f64; 3]; 3],
    velocity: [f64; 8],
    current: [f64; 3],
) {
    let local: [f64; 3] = std::array::from_fn(|row| {
        (0..8)
            .map(|column| jacobian[row][column] * velocity[column])
            .sum::<f64>()
            - current[row]
    });
    let momentum: [f64; 3] = std::array::from_fn(|row| {
        (0..3)
            .map(|column| metric[row][column] * local[column])
            .sum()
    });
    kinetic.energy += 0.5 * (0..3).map(|i| local[i] * momentum[i]).sum::<f64>();
    for row in 0..8 {
        kinetic.momentum[row] += (0..3)
            .map(|axis| jacobian[axis][row] * momentum[axis])
            .sum::<f64>();
        for column in 0..8 {
            kinetic.mass[row][column] += (0..3)
                .map(|a| {
                    (0..3)
                        .map(|b| jacobian[a][row] * metric[a][b] * jacobian[b][column])
                        .sum::<f64>()
                })
                .sum::<f64>();
        }
    }
}

fn kinetic_extra(state: &TruthState, q: f64, velocity: [f64; 8], current_ned: [f64; 3]) -> Kinetic {
    let mut kinetic = Kinetic {
        mass: [[0.0; 8]; 8],
        momentum: [0.0; 8],
        energy: 0.0,
    };
    for (fraction, weight) in QUADRATURE {
        let mass = DRY_MASS_KG * weight;
        let metric = std::array::from_fn(|row| {
            std::array::from_fn(|column| if row == column { mass } else { 0.0 })
        });
        let along = fraction * LENGTH_M;
        add_particle(
            &mut kinetic,
            point_jacobian(point_body(q, along), point_ladder_derivative(q, along)),
            metric,
            velocity,
            [0.0; 3],
        );
        add_particle(
            &mut kinetic,
            point_jacobian(point_body(0.0, along), [0.0; 3]),
            metric.map(|row| row.map(|value| -value)),
            velocity,
            [0.0; 3],
        );
    }
    let axis = direction(q);
    let angular_jacobian: [[f64; 8]; 3] = std::array::from_fn(|row| {
        std::array::from_fn(|column| {
            if (3..6).contains(&column) {
                f64::from(row == column - 3)
            } else if column == 6 && row == 1 {
                -1.0
            } else if column == 7 {
                axis[row]
            } else {
                0.0
            }
        })
    });
    let inertia: [[f64; 3]; 3] = std::array::from_fn(|row| {
        std::array::from_fn(|column| {
            ROTOR_INERTIA_KG_M2 * 0.5 * (f64::from(row == column) + axis[row] * axis[column])
        })
    });
    add_particle(&mut kinetic, angular_jacobian, inertia, velocity, [0.0; 3]);
    let reference_jacobian =
        std::array::from_fn(|row| std::array::from_fn(|column| f64::from(column == row + 3)));
    let reference_inertia = [
        [-ROTOR_INERTIA_KG_M2, 0.0, 0.0],
        [0.0, -ROTOR_INERTIA_KG_M2 / 2.0, 0.0],
        [0.0, 0.0, -ROTOR_INERTIA_KG_M2 / 2.0],
    ];
    add_particle(
        &mut kinetic,
        reference_jacobian,
        reference_inertia,
        velocity,
        [0.0; 3],
    );

    let (begin, end) = wet_segment(state, q);
    let rotation = rotation_matrix(state.quaternion);
    let current = std::array::from_fn(|row| {
        (0..3)
            .map(|column| rotation[column][row] * current_ned[column])
            .sum()
    });
    for (fraction, weight) in QUADRATURE {
        let along = begin + fraction * (end - begin);
        let mass = RHO * CYLINDER_AREA_M2 * (end - begin) * weight;
        let metric = std::array::from_fn(|row| {
            std::array::from_fn(|column| {
                mass * (f64::from(row == column) - axis[row] * axis[column])
            })
        });
        add_particle(
            &mut kinetic,
            point_jacobian(point_body(q, along), point_ladder_derivative(q, along)),
            metric,
            velocity,
            current,
        );
    }
    kinetic
}

fn displaced(mut state: TruthState, q: f64, axis: usize, amount: f64) -> (TruthState, f64) {
    if axis == 6 {
        return (state, q + amount);
    }
    if axis < 3 {
        let rotation = rotation_matrix(state.quaternion);
        for i in 0..3 {
            state.position_ned[i] += rotation[i][axis] * amount;
        }
    } else {
        let [w, x, y, z] = state.quaternion;
        let mut turn = [0.0; 3];
        turn[axis - 3] = (amount / 2.0).sin();
        let scalar = (amount / 2.0).cos();
        state.quaternion = normalize_quaternion([
            w * scalar - x * turn[0] - y * turn[1] - z * turn[2],
            x * scalar + w * turn[0] + y * turn[2] - z * turn[1],
            y * scalar + w * turn[1] + z * turn[0] - x * turn[2],
            z * scalar + w * turn[2] + x * turn[1] - y * turn[0],
        ]);
    }
    (state, q)
}

impl CoupledLadder {
    pub fn new(physical_mass: [[f64; 6]; 6]) -> Result<Self, String> {
        if !symmetric_positive_definite_6(&physical_mass) {
            return Err("桥架需要正定船体质量矩阵".into());
        }
        Ok(Self { physical_mass })
    }

    pub fn kinetic_energy_j(
        &self,
        state: &TruthState,
        q: f64,
        rates: [f64; 2],
        current: [f64; 3],
    ) -> f64 {
        let velocity = std::array::from_fn(|i| {
            if i < 6 {
                state.body_velocity[i]
            } else {
                rates[i - 6]
            }
        });
        0.5 * (0..6)
            .map(|i| {
                (0..6)
                    .map(|j| {
                        state.body_velocity[i] * self.physical_mass[i][j] * state.body_velocity[j]
                    })
                    .sum::<f64>()
            })
            .sum::<f64>()
            + kinetic_extra(state, q, velocity, current).energy
    }

    /// 广义外力含实际作用点的桥架/绞刀反力。内部液压和电机只施加到对应广义坐标。
    pub fn acceleration(
        &self,
        state: &TruthState,
        q: f64,
        rates: [f64; 2],
        current: [f64; 3],
        base_acceleration: [f64; 6],
        force: [f64; 8],
    ) -> Result<LadderAcceleration, String> {
        let velocity: [f64; 8] = std::array::from_fn(|i| {
            if i < 6 {
                state.body_velocity[i]
            } else {
                rates[i - 6]
            }
        });
        if velocity
            .iter()
            .chain(&force)
            .chain(&current)
            .any(|v| !v.is_finite())
            || !q.is_finite()
        {
            return Err("桥架广义状态或载荷非有限".into());
        }
        let extra = kinetic_extra(state, q, velocity, current);
        let mut momentum_rate = [0.0; 8];
        let mut gradient = [0.0; 8];
        // 局部动能微分只涉及7个配置方向，没有在线场网格或频域求解。
        for axis in 0..7 {
            let epsilon = 1e-5;
            let (plus_state, plus_q) = displaced(state.clone(), q, axis, epsilon);
            let (minus_state, minus_q) = displaced(state.clone(), q, axis, -epsilon);
            let plus = kinetic_extra(&plus_state, plus_q, velocity, current);
            let minus = kinetic_extra(&minus_state, minus_q, velocity, current);
            gradient[axis] = (plus.energy - minus.energy) / (2.0 * epsilon);
            for i in 0..8 {
                momentum_rate[i] +=
                    (plus.momentum[i] - minus.momentum[i]) / (2.0 * epsilon) * velocity[axis];
            }
        }
        let omega = [velocity[3], velocity[4], velocity[5]];
        let linear_momentum = [extra.momentum[0], extra.momentum[1], extra.momentum[2]];
        let rotation_bias = moment_from_force(omega, linear_momentum);
        let angular_bias = moment_from_force(
            omega,
            [extra.momentum[3], extra.momentum[4], extra.momentum[5]],
        );
        let linear_bias =
            moment_from_force([velocity[0], velocity[1], velocity[2]], linear_momentum);
        let mut rhs = std::array::from_fn(|i| force[i] - momentum_rate[i] + gradient[i]);
        for i in 0..6 {
            rhs[i] += (0..6)
                .map(|j| self.physical_mass[i][j] * base_acceleration[j])
                .sum::<f64>()
                - if i < 3 {
                    rotation_bias[i]
                } else {
                    angular_bias[i - 3] + linear_bias[i - 3]
                };
        }
        let mut matrix = extra.mass;
        for i in 0..6 {
            for j in 0..6 {
                matrix[i][j] += self.physical_mass[i][j];
            }
        }
        let (solution, modal_mass) = solve_coupled(matrix, rhs)?;
        let body: [f64; 6] = std::array::from_fn(|i| solution[i]);
        Ok(LadderAcceleration {
            body,
            ladder_rad_s2: solution[6],
            rotor_rad_s2: solution[7],
            modal_mass,
            reaction_body: std::array::from_fn(|i| {
                (0..6)
                    .map(|j| self.physical_mass[i][j] * (body[j] - base_acceleration[j]))
                    .sum()
            }),
        })
    }
}

fn solve_coupled(matrix: Matrix8, rhs: [f64; 8]) -> Result<([f64; 8], [[f64; 2]; 2]), String> {
    let body_mass: [[f64; 6]; 6] = std::array::from_fn(|i| std::array::from_fn(|j| matrix[i][j]));
    if !symmetric_positive_definite_6(&body_mass) {
        return Err("桥架耦合质量矩阵非正定".into());
    }
    let inverse_rhs = solve_linear_6(&mut body_mass.clone(), std::array::from_fn(|i| rhs[i]));
    let columns: [[f64; 6]; 2] = std::array::from_fn(|k| {
        solve_linear_6(
            &mut body_mass.clone(),
            std::array::from_fn(|i| matrix[i][6 + k]),
        )
    });
    let schur: [[f64; 2]; 2] = std::array::from_fn(|i| {
        std::array::from_fn(|j| {
            matrix[6 + i][6 + j]
                - (0..6)
                    .map(|k| matrix[6 + i][k] * columns[j][k])
                    .sum::<f64>()
        })
    });
    let modal_rhs: [f64; 2] = std::array::from_fn(|i| {
        rhs[6 + i]
            - (0..6)
                .map(|k| matrix[6 + i][k] * inverse_rhs[k])
                .sum::<f64>()
    });
    let determinant = schur[0][0] * schur[1][1] - schur[0][1] * schur[1][0];
    if schur[0][0] <= 0.0 || !determinant.is_finite() || determinant <= 0.0 {
        return Err("桥架与绞刀的广义惯量非正定".into());
    }
    let modal = [
        (modal_rhs[0] * schur[1][1] - modal_rhs[1] * schur[0][1]) / determinant,
        (modal_rhs[1] * schur[0][0] - modal_rhs[0] * schur[1][0]) / determinant,
    ];
    let result = std::array::from_fn(|i| {
        if i < 6 {
            inverse_rhs[i] - columns[0][i] * modal[0] - columns[1][i] * modal[1]
        } else {
            modal[i - 6]
        }
    });
    if result.iter().any(|v| !v.is_finite()) {
        return Err("桥架耦合求解非有限".into());
    }
    Ok((result, schur))
}

/// 原船质量已计入组件重量，只补移动重心产生的力矩与广义重力。
pub fn gravity_and_buoyancy(state: &TruthState, q: f64) -> [f64; 8] {
    let mut force = [0.0; 8];
    let rotation = rotation_matrix(state.quaternion);
    let gravity = rotation[2].map(|value| value * DRY_MASS_KG * GRAVITY);
    let center = point_body(q, LENGTH_M / 2.0);
    let reference = point_body(0.0, LENGTH_M / 2.0);
    let shift = std::array::from_fn(|i| center[i] - reference[i]);
    let moment = moment_from_force(shift, gravity);
    force[3..6].copy_from_slice(&moment);
    force[6] = (0..3)
        .map(|i| gravity[i] * point_ladder_derivative(q, LENGTH_M / 2.0)[i])
        .sum();
    let (begin, end) = wet_segment(state, q);
    let buoyancy =
        rotation[2].map(|value| -value * RHO * GRAVITY * CYLINDER_AREA_M2 * (end - begin));
    let point = point_body(q, (begin + end) / 2.0);
    let jacobian = point_jacobian(point, point_ladder_derivative(q, (begin + end) / 2.0));
    for i in 0..8 {
        force[i] += (0..3)
            .map(|axis| jacobian[axis][i] * buoyancy[axis])
            .sum::<f64>();
    }
    force
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sixdof::integrator::rk4_step;
    use crate::sixdof::state::quaternion_rate;

    fn mass() -> [[f64; 6]; 6] {
        let diagonal = [12e6, 12e6, 12e6, 1e9, 10e9, 10e9];
        std::array::from_fn(|i| std::array::from_fn(|j| if i == j { diagonal[i] } else { 0.0 }))
    }

    #[test]
    fn dredge_ladder_reference_partition_and_real_wet_geometry() {
        let state = TruthState {
            quaternion: [1.0, 0.0, 0.0, 0.0],
            ..Default::default()
        };
        let kinetic = kinetic_extra(&state, 0.0, [0.0; 8], [0.0; 3]);
        for i in 0..6 {
            for j in 0..6 {
                assert!(kinetic.mass[i][j].abs() < 1e-6);
            }
        }
        assert!(
            (kinetic.mass[6][6] - DRY_MASS_KG * LENGTH_M.powi(2) / 3.0 - ROTOR_INERTIA_KG_M2 / 2.0)
                .abs()
                < 1e-6
        );
        assert_eq!(wet_segment(&state, 0.0), (0.0, 0.0));
        let q = 40f64.to_radians();
        let (begin, end) = wet_segment(&state, q);
        assert!((begin - 2.0 / q.sin()).abs() < 1e-10 && end == LENGTH_M);
        let loads = gravity_and_buoyancy(&state, q);
        assert!(loads[2] < 0.0 && loads[4] != 0.0 && loads[6] > 0.0);
        let lower = TruthState {
            position_ned: [0.0, 0.0, 1.0],
            ..state
        };
        assert!(wet_segment(&lower, q).0 < begin);
    }

    #[test]
    fn dredge_ladder_internal_rotor_torque_reacts_on_body() {
        let model = CoupledLadder::new(mass()).unwrap();
        let state = TruthState {
            quaternion: [1.0, 0.0, 0.0, 0.0],
            position_ned: [0.0, 0.0, -100.0],
            ..Default::default()
        };
        let mut torque = [0.0; 8];
        torque[7] = 100_000.0;
        let acceleration = model
            .acceleration(&state, 0.0, [0.0; 2], [0.0; 3], [0.0; 6], torque)
            .unwrap();
        assert!(acceleration.rotor_rad_s2 > 0.0 && acceleration.body[3] < 0.0);
        assert!(
            (1e9 * acceleration.body[3] + ROTOR_INERTIA_KG_M2 * acceleration.rotor_rad_s2).abs()
                < 1e-7
        );
    }

    #[test]
    fn dredge_ladder_unforced_body_ladder_rotor_conserve_energy() {
        let model = CoupledLadder::new(mass()).unwrap();
        let mut y = vec![0.0; 17];
        y[2] = -100.0;
        y[3] = 1.0;
        y[7..13].copy_from_slice(&[0.2, -0.1, 0.05, 0.01, -0.005, 0.008]);
        y[13..17].copy_from_slice(&[0.3, 0.01, 0.0, 2.0]);
        let unpack = |values: &[f64]| TruthState {
            position_ned: [values[0], values[1], values[2]],
            quaternion: normalize_quaternion([values[3], values[4], values[5], values[6]]),
            body_velocity: std::array::from_fn(|i| values[7 + i]),
            ..Default::default()
        };
        let energy = |values: &[f64]| {
            model.kinetic_energy_j(
                &unpack(values),
                values[13],
                [values[14], values[16]],
                [0.0; 3],
            )
        };
        let initial = energy(&y);
        for index in 0..240 {
            rk4_step(
                index as f64 / 120.0,
                &mut y,
                1.0 / 120.0,
                |_, values, derivative| {
                    let state = unpack(values);
                    let v = state.body_velocity;
                    let p: [f64; 6] =
                        std::array::from_fn(|i| (0..6).map(|j| mass()[i][j] * v[j]).sum());
                    let omega = [v[3], v[4], v[5]];
                    let linear = moment_from_force(omega, [p[0], p[1], p[2]]);
                    let angular = moment_from_force(omega, [p[3], p[4], p[5]]);
                    let other = moment_from_force([v[0], v[1], v[2]], [p[0], p[1], p[2]]);
                    let base = std::array::from_fn(|i| {
                        if i < 3 {
                            -linear[i] / mass()[i][i]
                        } else {
                            -(angular[i - 3] + other[i - 3]) / mass()[i][i]
                        }
                    });
                    let out = model
                        .acceleration(
                            &state,
                            values[13],
                            [values[14], values[16]],
                            [0.0; 3],
                            base,
                            [0.0; 8],
                        )
                        .unwrap();
                    let rotation = rotation_matrix(state.quaternion);
                    for i in 0..3 {
                        derivative[i] = (0..3).map(|j| rotation[i][j] * v[j]).sum();
                    }
                    derivative[3..7].copy_from_slice(&quaternion_rate(state.quaternion, omega));
                    derivative[7..13].copy_from_slice(&out.body);
                    derivative[13] = values[14];
                    derivative[14] = out.ladder_rad_s2;
                    derivative[15] = values[16];
                    derivative[16] = out.rotor_rad_s2;
                },
            )
            .unwrap();
        }
        assert!(
            (energy(&y) / initial - 1.0).abs() < 1e-7,
            "energy error {}",
            energy(&y) / initial - 1.0
        );
    }
}
