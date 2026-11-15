//! 含冻结液货总惯性与纵/横自由液面模态的双向拉格朗日耦合。

use super::dynamics::{solve_linear_6, RigidBodyParams};
use super::state::{
    moment_from_force, rotation_matrix, symmetric_positive_definite_3,
    symmetric_positive_definite_6, TruthState,
};
use super::tank_sloshing::SloshingMode;

const GRAVITY: f64 = 9.81;

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct LiquidTank {
    pub center_bottom_body_m: [f64; 3],
    pub length_m: f64,
    pub width_m: f64,
    pub height_m: f64,
    pub fill_ratio: f64,
    pub density_kg_m3: f64,
    pub damping_ratio: f64,
}

#[derive(Debug, Clone)]
pub struct InstalledSloshingMode {
    pub mode: SloshingMode,
    pub direction_body: [f64; 3],
    pub coupling: [f64; 6],
    pub freeboard_m: f64,
    pub reference_point_body_m: [f64; 3],
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct LiquidMassPartition {
    pub liquid_mass_kg: f64,
    pub fixed_mass_kg: f64,
    pub fixed_center_body_m: [f64; 3],
    pub fixed_inertia_about_own_cg_kg_m2: [[f64; 3]; 3],
}

#[derive(Debug, Clone)]
pub struct CoupledSloshing {
    pub modes: Vec<InstalledSloshingMode>,
    pub partition: LiquidMassPartition,
    physical_mass: [[f64; 6]; 6],
    reduced_mass: [[f64; 6]; 6],
}

pub struct SloshingEvaluation {
    pub body_acceleration: [f64; 6],
    pub modal_derivatives: Vec<f64>,
    pub reaction_body: [f64; 6],
    pub within_small_amplitude: bool,
}

#[derive(serde::Serialize)]
pub struct SloshingDiagnostics {
    pub within_small_amplitude: bool,
    pub wall_heights_m: Vec<f64>,
    pub wall_height_rates_mps: Vec<f64>,
    pub coupled_additional_energy_j: f64,
    pub mass_partition: LiquidMassPartition,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiquidObservation {
    pub mode_heights_m: Vec<f64>,
    pub corner_heights_m: Vec<f64>,
    pub modal_frequencies_hz: Vec<f64>,
    pub liquid_depth_m: f64,
    pub within_small_amplitude: bool,
}

fn add_parallel_axis(inertia: &mut [[f64; 3]; 3], mass: f64, point: [f64; 3]) {
    let squared: f64 = point.iter().map(|value| value * value).sum();
    for row in 0..3 {
        for column in 0..3 {
            inertia[row][column] +=
                mass * ((if row == column { squared } else { 0.0 }) - point[row] * point[column]);
        }
    }
}

impl InstalledSloshingMode {
    /// 等效对流质量位移引起的空间惯性差值及其对q的导数。
    /// q=0时差值为零，冻结总质量与基准惯量保持原值。
    fn moving_spatial_inertia(&self, q: f64) -> ([[f64; 6]; 6], [[f64; 6]; 6]) {
        let direction = self.direction_body;
        let reference = self.reference_point_body_m;
        let gamma = self.mode.forcing_gamma;
        let coupling = self.mode.reaction_coupling;
        let equivalent_mass = coupling * gamma;
        let position: [f64; 3] =
            std::array::from_fn(|axis| reference[axis] + q / gamma * direction[axis]);
        let first_moment = direction.map(|value| coupling * q * value);
        let derivative_moment = direction.map(|value| coupling * value);
        let skew = |point: [f64; 3]| {
            [
                [0.0, -point[2], point[1]],
                [point[2], 0.0, -point[0]],
                [-point[1], point[0], 0.0],
            ]
        };
        let cross = skew(first_moment);
        let derivative_cross = skew(derivative_moment);
        let position_squared: f64 = position.iter().map(|value| value * value).sum();
        let reference_squared: f64 = reference.iter().map(|value| value * value).sum();
        let projection: f64 = position.iter().zip(direction).map(|(a, b)| a * b).sum();
        let mut difference = [[0.0; 6]; 6];
        let mut derivative = [[0.0; 6]; 6];
        for row in 0..3 {
            for column in 0..3 {
                difference[row][column + 3] = -cross[row][column];
                difference[row + 3][column] = cross[row][column];
                derivative[row][column + 3] = -derivative_cross[row][column];
                derivative[row + 3][column] = derivative_cross[row][column];
                difference[row + 3][column + 3] = equivalent_mass
                    * ((if row == column {
                        position_squared - reference_squared
                    } else {
                        0.0
                    }) - position[row] * position[column]
                        + reference[row] * reference[column]);
                derivative[row + 3][column + 3] = coupling
                    * ((if row == column { 2.0 * projection } else { 0.0 })
                        - direction[row] * position[column]
                        - position[row] * direction[column]);
            }
        }
        (difference, derivative)
    }
}

impl CoupledSloshing {
    pub fn new(
        tanks: &[LiquidTank],
        rigid: &RigidBodyParams,
        physical_mass: [[f64; 6]; 6],
    ) -> Result<Self, String> {
        if tanks.is_empty() || !symmetric_positive_definite_6(&physical_mass) {
            return Err("液舱布局为空或船体质量矩阵无效".into());
        }
        let mut modes = Vec::with_capacity(2 * tanks.len());
        let mut liquid_mass = 0.0;
        let mut first_moment = [0.0; 3];
        let mut liquid_inertia = [[0.0; 3]; 3];
        for tank in tanks {
            if [
                tank.length_m,
                tank.width_m,
                tank.height_m,
                tank.density_kg_m3,
            ]
            .iter()
            .any(|value| !value.is_finite() || *value <= 0.0)
                || tank
                    .center_bottom_body_m
                    .iter()
                    .any(|value| !value.is_finite())
                || !(0.05..=0.98).contains(&tank.fill_ratio)
            {
                return Err("液舱尺寸、位置、密度或填充率无效".into());
            }
            let depth = tank.height_m * tank.fill_ratio;
            let mass = tank.density_kg_m3 * tank.length_m * tank.width_m * depth;
            let mut center = tank.center_bottom_body_m;
            center[2] -= depth / 2.0;
            liquid_mass += mass;
            for axis in 0..3 {
                first_moment[axis] += mass * center[axis];
            }
            let dimensions = [tank.length_m, tank.width_m, depth];
            for axis in 0..3 {
                liquid_inertia[axis][axis] += mass / 12.0
                    * (dimensions[(axis + 1) % 3].powi(2) + dimensions[(axis + 2) % 3].powi(2));
            }
            add_parallel_axis(&mut liquid_inertia, mass, center);
            for (axis, width, span) in [
                (0, tank.length_m, tank.width_m),
                (1, tank.width_m, tank.length_m),
            ] {
                let mode =
                    SloshingMode::new(width, span, depth, tank.density_kg_m3, tank.damping_ratio)?;
                let mut direction = [0.0; 3];
                direction[axis] = 1.0;
                let mut point = tank.center_bottom_body_m;
                // 完整势梯度体积分包含壁面和垂向流速，作用深度为2*z_p。
                point[2] += -depth + 2.0 * mode.action_height_m;
                let moment = moment_from_force(point, direction);
                let coupling = std::array::from_fn(|index| {
                    mode.reaction_coupling
                        * if index < 3 {
                            direction[index]
                        } else {
                            moment[index - 3]
                        }
                });
                modes.push(InstalledSloshingMode {
                    mode,
                    direction_body: direction,
                    coupling,
                    freeboard_m: tank.height_m - depth,
                    reference_point_body_m: point,
                });
            }
        }
        let fixed_mass = rigid.mass_kg - liquid_mass;
        if !fixed_mass.is_finite() || fixed_mass <= 0.0 {
            return Err("冻结总质量不足以容纳声明液货".into());
        }
        let fixed_center = first_moment.map(|value| -value / fixed_mass);
        let mut fixed_inertia = rigid.inertia_about_cg;
        for row in 0..3 {
            for column in 0..3 {
                fixed_inertia[row][column] -= liquid_inertia[row][column];
            }
        }
        add_parallel_axis(&mut fixed_inertia, -fixed_mass, fixed_center);
        if !symmetric_positive_definite_3(&fixed_inertia) {
            return Err("扣除液货后的固定部分惯量无效".into());
        }
        let mut reduced_mass = physical_mass;
        for installed in &modes {
            for row in 0..6 {
                for column in 0..6 {
                    reduced_mass[row][column] -= installed.coupling[row]
                        * installed.coupling[column]
                        / installed.mode.modal_mass;
                }
            }
        }
        if !symmetric_positive_definite_6(&reduced_mass) {
            return Err("液舱与船体的耦合质量矩阵非正定".into());
        }
        Ok(Self {
            modes,
            physical_mass,
            reduced_mass,
            partition: LiquidMassPartition {
                liquid_mass_kg: liquid_mass,
                fixed_mass_kg: fixed_mass,
                fixed_center_body_m: fixed_center,
                fixed_inertia_about_own_cg_kg_m2: fixed_inertia,
            },
        })
    }

    pub fn state_len(&self) -> usize {
        2 * self.modes.len()
    }

    pub fn validate_state(&self, values: &[f64]) -> Result<(), String> {
        if values.len() != self.state_len() || values.iter().any(|value| !value.is_finite()) {
            return Err("液舱模态状态维度或数值无效".into());
        }
        Ok(())
    }

    pub fn evaluate(
        &self,
        state: &TruthState,
        values: &[f64],
        base_acceleration: [f64; 6],
    ) -> Result<SloshingEvaluation, String> {
        self.validate_state(values)?;
        let rotation = rotation_matrix(state.quaternion);
        let gravity_direction = rotation[2];
        let mut modal_rhs = Vec::with_capacity(self.modes.len());
        let mut momentum = [0.0; 6];
        let mut mass_rate_momentum = [0.0; 6];
        let mut mass_difference = [[0.0; 6]; 6];
        let mut restoring_moment = [0.0; 3];
        let velocity = state.body_velocity;
        for (index, installed) in self.modes.iter().enumerate() {
            let mode = installed.mode;
            let q = values[2 * index];
            let q_dot = values[2 * index + 1];
            let (difference, derivative) = installed.moving_spatial_inertia(q);
            let derivative_velocity: [f64; 6] = std::array::from_fn(|row| {
                (0..6)
                    .map(|column| derivative[row][column] * velocity[column])
                    .sum()
            });
            let centrifugal_force: f64 = 0.5
                * velocity
                    .iter()
                    .zip(derivative_velocity)
                    .map(|(a, b)| a * b)
                    .sum::<f64>();
            let projection: f64 = installed
                .direction_body
                .iter()
                .zip(gravity_direction)
                .map(|(a, b)| a * b)
                .sum();
            modal_rhs.push(
                centrifugal_force + mode.reaction_coupling * GRAVITY * projection
                    - mode.modal_mass
                        * (2.0 * mode.damping_ratio * mode.omega_n * q_dot
                            + mode.omega_n.powi(2) * q),
            );
            let moment = moment_from_force(installed.direction_body, gravity_direction);
            for axis in 0..3 {
                restoring_moment[axis] -= mode.reaction_coupling * GRAVITY * q * moment[axis];
            }
            for axis in 0..6 {
                momentum[axis] += installed.coupling[axis] * q_dot
                    + (0..6)
                        .map(|column| difference[axis][column] * velocity[column])
                        .sum::<f64>();
                mass_rate_momentum[axis] += derivative_velocity[axis] * q_dot;
                for column in 0..6 {
                    mass_difference[axis][column] += difference[axis][column];
                }
            }
        }
        let omega = [velocity[3], velocity[4], velocity[5]];
        let force_coriolis = moment_from_force(omega, [momentum[0], momentum[1], momentum[2]]);
        let mut moment_coriolis = moment_from_force(omega, [momentum[3], momentum[4], momentum[5]]);
        let translation_cross = moment_from_force(
            [velocity[0], velocity[1], velocity[2]],
            [momentum[0], momentum[1], momentum[2]],
        );
        for axis in 0..3 {
            moment_coriolis[axis] += translation_cross[axis];
        }
        let bias: [f64; 6] = std::array::from_fn(|axis| {
            mass_rate_momentum[axis]
                + if axis < 3 {
                    force_coriolis[axis]
                } else {
                    moment_coriolis[axis - 3] + restoring_moment[axis - 3]
                }
        });
        let mut rhs = std::array::from_fn(|row| {
            (0..6)
                .map(|column| self.physical_mass[row][column] * base_acceleration[column])
                .sum::<f64>()
                - bias[row]
        });
        for (installed, modal_force) in self.modes.iter().zip(&modal_rhs) {
            for axis in 0..6 {
                rhs[axis] -= installed.coupling[axis] * modal_force / installed.mode.modal_mass;
            }
        }
        let mut reduced_mass = self.reduced_mass;
        for row in 0..6 {
            for column in 0..6 {
                reduced_mass[row][column] += mass_difference[row][column];
            }
        }
        if !symmetric_positive_definite_6(&reduced_mass) {
            return Err("当前液面位移的耦合质量矩阵非正定".into());
        }
        let body_acceleration = solve_linear_6(&mut reduced_mass, rhs);
        let mut reaction: [f64; 6] = std::array::from_fn(|row| {
            -bias[row]
                - (0..6)
                    .map(|column| mass_difference[row][column] * body_acceleration[column])
                    .sum::<f64>()
        });
        let mut modal_derivatives = Vec::with_capacity(values.len());
        for (index, (installed, modal_force)) in self.modes.iter().zip(modal_rhs).enumerate() {
            let acceleration = (modal_force
                - installed
                    .coupling
                    .iter()
                    .zip(body_acceleration)
                    .map(|(a, b)| a * b)
                    .sum::<f64>())
                / installed.mode.modal_mass;
            modal_derivatives.extend([values[2 * index + 1], acceleration]);
            for axis in 0..6 {
                reaction[axis] -= installed.coupling[axis] * acceleration;
            }
        }
        Ok(SloshingEvaluation {
            body_acceleration,
            modal_derivatives,
            reaction_body: reaction,
            within_small_amplitude: self.within_linear_domain(values),
        })
    }

    pub fn observation(&self, values: &[f64]) -> LiquidObservation {
        LiquidObservation {
            mode_heights_m: values.chunks_exact(2).map(|pair| pair[0]).collect(),
            corner_heights_m: values.chunks_exact(4).map(|tank| tank[0].abs() + tank[2].abs()).collect(),
            modal_frequencies_hz: self.modes.iter().map(|installed| installed.mode.omega_n / (2.0 * std::f64::consts::PI)).collect(),
            liquid_depth_m: self.modes[0].mode.fill_depth_m,
            within_small_amplitude: self.within_linear_domain(values),
        }
    }

    fn within_linear_domain(&self, values: &[f64]) -> bool {
        self.modes.chunks_exact(2).enumerate().all(|(tank, pair)| {
            let longitudinal = values[4 * tank];
            let transverse = values[4 * tank + 2];
            let height = longitudinal.abs() + transverse.abs();
            let slope = (pair[0].mode.k * longitudinal).hypot(pair[1].mode.k * transverse);
            slope <= 0.1
                && height <= 0.1 * pair[0].mode.fill_depth_m
                && height < pair[0].freeboard_m
        })
    }

    pub fn diagnostics(
        &self,
        state: &TruthState,
        values: &[f64],
    ) -> Result<SloshingDiagnostics, String> {
        self.validate_state(values)?;
        Ok(SloshingDiagnostics {
            within_small_amplitude: self.within_linear_domain(values),
            wall_heights_m: values.chunks_exact(2).map(|pair| pair[0]).collect(),
            wall_height_rates_mps: values.chunks_exact(2).map(|pair| pair[1]).collect(),
            coupled_additional_energy_j: self.modal_energy_j(state, values)?,
            mass_partition: self.partition.clone(),
        })
    }

    pub fn modal_energy_j(&self, state: &TruthState, values: &[f64]) -> Result<f64, String> {
        self.validate_state(values)?;
        let gravity_direction = rotation_matrix(state.quaternion)[2];
        let mut energy = 0.0;
        for (index, installed) in self.modes.iter().enumerate() {
            let q = values[2 * index];
            let q_dot = values[2 * index + 1];
            let (difference, _) = installed.moving_spatial_inertia(q);
            let inertia_energy: f64 = (0..6)
                .map(|row| {
                    (0..6)
                        .map(|column| {
                            0.5 * state.body_velocity[row]
                                * difference[row][column]
                                * state.body_velocity[column]
                        })
                        .sum::<f64>()
                })
                .sum();
            let projection: f64 = installed
                .direction_body
                .iter()
                .zip(gravity_direction)
                .map(|(a, b)| a * b)
                .sum();
            let velocity_coupling: f64 = installed
                .coupling
                .iter()
                .zip(state.body_velocity)
                .map(|(a, b)| a * b)
                .sum();
            energy += inertia_energy
                + velocity_coupling * q_dot
                + 0.5
                    * installed.mode.modal_mass
                    * (q_dot * q_dot + installed.mode.omega_n.powi(2) * q * q)
                - installed.mode.reaction_coupling * GRAVITY * q * projection;
        }
        Ok(energy)
    }
}
