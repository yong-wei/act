//! 天鲸低频钢桩、两锚缆、桥架和绞刀的原生作业机构。

use super::dredge_cable::{solve_catenary, Catenary};
use super::dredge_cutter::{evaluate_cutter, CutterEvaluation, DredgeBed, RADIUS_M};
use super::dredge_ladder::{
    self as ladder, CoupledLadder, LadderAcceleration, CG_HEIGHT_M, CYLINDER_AREA_M2, LENGTH_M,
};
use super::dredge_soil::{DredgeSoil, SoilCuttingLaw};
use super::state::{moment_from_force, rotation_matrix, TruthState};
use serde::{Deserialize, Serialize};

pub const DEFINITION: &str = "tianjing-mechanism-v1;propX=-.43L;rudderX=-.48L;spud=2e6,3e5,10,.5;winch=150e3,.5,.1,.5;ladder=35,200e3,1e6,.5,.5deg,reference=.3deg;rotorI=2e4,power=4.2e6,maxRpm=40;bed=.5";
pub const DEFINITION_JSON: &str =
    include_str!("../../model-data/dredger-tianjing/dredging-teaching-v1.json");
pub const Q: usize = 0;
pub const Q_RATE: usize = 1;
pub const PHASE: usize = 2;
pub const OMEGA: usize = 3;
pub const HYDRAULIC_FORCE: usize = 4;
pub const MOTOR_TORQUE: usize = 5;
pub const MOTOR_INTEGRAL: usize = 6;
pub const LENGTH_PORT: usize = 7;
pub const WINCH_PORT: usize = 9;
pub const SPUD_FRACTION: usize = 11;
pub const CARRIAGE: usize = 12;
pub const WINCH_WORK_PORT: usize = 13;
pub const POSITIVE_WINCH_WORK_PORT: usize = 15;
pub const MOTOR_WORK: usize = 17;
pub const POSITIVE_MOTOR_WORK: usize = 18;
pub const HYDRAULIC_WORK: usize = 19;
pub const POSITIVE_HYDRAULIC_WORK: usize = 20;
pub const Q_REFERENCE: usize = 21;
pub const STATE_LEN: usize = 22;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DredgerConfiguration {
    pub soil: DredgeSoil,
    pub initial_depth_m: Option<f64>,
    pub initial_spud_down: bool,
    pub initial_cables_attached: bool,
    pub cable_break_time_s: Option<f64>,
    pub broken_cable_index: usize,
}
impl Default for DredgerConfiguration {
    fn default() -> Self {
        Self {
            soil: DredgeSoil::Sand,
            initial_depth_m: None,
            initial_spud_down: false,
            initial_cables_attached: false,
            cable_break_time_s: None,
            broken_cable_index: 1,
        }
    }
}
impl DredgerConfiguration {
    pub fn validate(&self) -> Result<(), String> {
        if self
            .initial_depth_m
            .is_some_and(|v| !v.is_finite() || !(0.0..=25.0).contains(&v))
            || self
                .cable_break_time_s
                .is_some_and(|v| !v.is_finite() || v < 0.0)
            || self.broken_cable_index > 1
        {
            return Err("天鲸机构初态或断缆工况无效".into());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DredgerCommands {
    pub spud_down: bool,
    pub cables_attached: bool,
    pub winch_speed_mps: [f64; 2],
    pub depth_reference_m: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ladder_angle_reference_deg: Option<f64>,
    pub cutter_rpm: f64,
    pub carriage_speed_mps: f64,
}
impl Default for DredgerCommands {
    fn default() -> Self {
        Self {
            spud_down: false,
            cables_attached: false,
            winch_speed_mps: [0.0; 2],
            depth_reference_m: -0.5,
            cutter_rpm: 0.0,
            carriage_speed_mps: 0.0,
            ladder_angle_reference_deg: None,
        }
    }
}
impl DredgerCommands {
    pub fn validate(&self) -> Result<(), String> {
        if self
            .winch_speed_mps
            .iter()
            .any(|v| !v.is_finite() || v.abs() > 0.5)
            || !self.depth_reference_m.is_finite()
            || !(-2.0..=30.0).contains(&self.depth_reference_m)
            || !self.cutter_rpm.is_finite()
            || !(0.0..=40.0).contains(&self.cutter_rpm)
            || !self.carriage_speed_mps.is_finite()
            || self.carriage_speed_mps.abs() > 0.05
        {
            return Err("绞车、桥架、绞刀或台车命令超出设备范围".into());
        }
        if self
            .ladder_angle_reference_deg
            .is_some_and(|value| !value.is_finite() || !(0.0..=65.0).contains(&value))
        {
            return Err("桥架角参考超出0至65度".into());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DredgerEvent {
    pub time_s: f64,
    pub kind: String,
    pub component: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DredgerState {
    pub bed: DredgeBed,
    pub held_commands: DredgerCommands,
    pub spud_anchor_ned: Option<[f64; 3]>,
    pub cable_broken: [bool; 2],
    pub cable_solutions: [Option<Catenary>; 2],
    pub events: Vec<DredgerEvent>,
    pub last_observation: DredgerObservation,
    pub fine_metrics: DredgerFineMetrics,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DredgerFineMetrics {
    pub samples: u64,
    pub duration_s: f64,
    pub hard_violation_duration_s: f64,
    pub soil_domain_violation_duration_s: f64,
    pub maximum_ladder_rate_deg_s: f64,
    pub maximum_cutter_rpm: f64,
    pub maximum_cutter_power_w: f64,
    pub maximum_winch_power_w: f64,
    pub maximum_cable_tension_n: f64,
    pub maximum_spud_reaction_n: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DredgerObservation {
    pub depth_m: f64,
    pub depth_rate_mps: f64,
    pub cutter_east_m: f64,
    pub cutter_sway_speed_mps: f64,
    pub ladder_angle_deg: f64,
    pub ladder_rate_deg_s: f64,
    pub cutter_rpm: f64,
    pub cutter_torque_nm: f64,
    pub cutter_power_w: f64,
    pub cutting_power_w: f64,
    pub cable_tension_n: [f64; 2],
    pub cable_length_m: [f64; 2],
    pub winch_speed_mps: [f64; 2],
    pub winch_power_w: [f64; 2],
    pub spud_contact_fraction: f64,
    pub spud_reaction_n: f64,
    pub spud_vertical_travel_m: f64,
    pub carriage_m: f64,
    pub hydraulic_force_n: f64,
    pub production_m3: f64,
    pub production_rate_m3_s: f64,
    pub cutting_work_j: f64,
    pub positive_winch_work_j: f64,
    pub positive_cutter_work_j: f64,
    pub soil_domain_exceeded: bool,
}

#[derive(Clone)]
pub struct DredgerMechanism {
    pub configuration: DredgerConfiguration,
    pub state: DredgerState,
    spud_fraction_rate: f64,
    coupled: CoupledLadder,
    soil_law: SoilCuttingLaw,
}

pub struct MechanismEvaluation {
    pub acceleration: LadderAcceleration,
    pub derivatives: Vec<f64>,
    pub observation: DredgerObservation,
    pub cutting: CutterEvaluation,
    pub cable_solutions: [Option<Catenary>; 2],
}

fn add_point_force(force: &mut [f64; 8], point: [f64; 3], applied: [f64; 3]) {
    let moment = moment_from_force(point, applied);
    for i in 0..3 {
        force[i] += applied[i];
        force[i + 3] += moment[i];
    }
}
fn body_velocity_at(state: &TruthState, point: [f64; 3]) -> [f64; 3] {
    let angular = moment_from_force(
        [
            state.body_velocity[3],
            state.body_velocity[4],
            state.body_velocity[5],
        ],
        point,
    );
    std::array::from_fn(|i| state.body_velocity[i] + angular[i])
}
fn to_world(state: &TruthState, vector: [f64; 3]) -> [f64; 3] {
    let rotation = rotation_matrix(state.quaternion);
    std::array::from_fn(|i| (0..3).map(|j| rotation[i][j] * vector[j]).sum())
}
fn to_body(state: &TruthState, vector: [f64; 3]) -> [f64; 3] {
    let rotation = rotation_matrix(state.quaternion);
    std::array::from_fn(|i| (0..3).map(|j| rotation[j][i] * vector[j]).sum())
}
fn spud_point(values: &[f64]) -> [f64; 3] {
    [-49.5 + values[CARRIAGE], 0.0, CG_HEIGHT_M + 20.0]
}
fn fairlead(index: usize) -> [f64; 3] {
    [
        38.5,
        if index == 0 { -9.66 } else { 9.66 },
        0.7075145831466294,
    ]
}
fn anchor(index: usize) -> [f64; 3] {
    [80.0, if index == 0 { -100.0 } else { 100.0 }, 20.0]
}

pub fn envelope_depth(state: &TruthState, q: f64) -> f64 {
    let rotation = rotation_matrix(state.quaternion);
    let axis = ladder::direction(q);
    let radial = ladder::point_ladder_derivative(q, 1.0);
    let axis_down = (0..3).map(|i| rotation[2][i] * axis[i]).sum::<f64>();
    let radial_down = (0..3).map(|i| rotation[2][i] * radial[i]).sum::<f64>();
    ladder::world_point(state, ladder::point_body(q, LENGTH_M))[2]
        + axis_down.abs()
        + RADIUS_M * radial_down.hypot(rotation[2][1])
}
fn angle_for_depth(state: &TruthState, depth_m: f64) -> f64 {
    let mut low = 0.0;
    let mut high = 65f64.to_radians();
    for _ in 0..36 {
        let middle = (low + high) / 2.0;
        if envelope_depth(state, middle) < depth_m {
            low = middle;
        } else {
            high = middle;
        }
    }
    (low + high) / 2.0
}

impl DredgerMechanism {
    pub fn new(
        configuration: DredgerConfiguration,
        state: &TruthState,
        physical_mass: [[f64; 6]; 6],
    ) -> Result<(Self, Vec<f64>), String> {
        configuration.validate()?;
        let mut values = vec![0.0; STATE_LEN];
        let q = configuration
            .initial_depth_m
            .map_or(0.0, |depth| angle_for_depth(state, depth));
        values[Q] = q;
        values[Q_REFERENCE] = q;
        values[SPUD_FRACTION] = f64::from(configuration.initial_spud_down);
        let weight_force = ladder::gravity_and_buoyancy(state, q)[6];
        let lever = LENGTH_M
            * (rotation_matrix(state.quaternion)[2][2] * q.cos()
                - rotation_matrix(state.quaternion)[2][0] * q.sin());
        values[HYDRAULIC_FORCE] = (weight_force / lever).clamp(-1e6, 1e6);
        for index in 0..2 {
            let position = ladder::world_point(state, fairlead(index));
            let delta: [f64; 3] = std::array::from_fn(|i| anchor(index)[i] - position[i]);
            values[LENGTH_PORT + index] = delta.iter().map(|v| v * v).sum::<f64>().sqrt() * 1.001;
        }
        let spud_anchor_ned = configuration
            .initial_spud_down
            .then(|| ladder::world_point(state, spud_point(&values)));
        let commands = DredgerCommands {
            spud_down: configuration.initial_spud_down,
            cables_attached: configuration.initial_cables_attached,
            depth_reference_m: configuration.initial_depth_m.unwrap_or(-0.5),
            ..Default::default()
        };
        Ok((
            Self {
                configuration,
                state: DredgerState {
                    bed: Default::default(),
                    held_commands: commands,
                    spud_anchor_ned,
                    cable_broken: [false; 2],
                    cable_solutions: [None; 2],
                    events: vec![],
                    last_observation: Default::default(),
                    fine_metrics: Default::default(),
                },
                spud_fraction_rate: 0.0,
                coupled: CoupledLadder::new(physical_mass)?,
                soil_law: SoilCuttingLaw::default(),
            },
            values,
        ))
    }

    pub fn validate_values(values: &[f64]) -> Result<(), String> {
        if values.len() != STATE_LEN
            || values.iter().any(|v| !v.is_finite())
            || values[Q] < -0.1
            || values[Q] > 70f64.to_radians()
            || values[SPUD_FRACTION] < -1e-8
            || values[SPUD_FRACTION] > 1.0 + 1e-8
            || values[CARRIAGE] < -1e-8
            || values[CARRIAGE] > 2.0 + 1e-8
            || values[LENGTH_PORT..LENGTH_PORT + 2]
                .iter()
                .any(|v| *v < 1.0 || *v > 1000.0)
        {
            return Err("天鲸机构恢复点的状态或维度无效".into());
        }
        Ok(())
    }

    pub fn restore(&mut self, state: DredgerState, values: &[f64]) -> Result<(), String> {
        Self::validate_values(values)?;
        state.bed.validate()?;
        state.held_commands.validate()?;
        if state
            .spud_anchor_ned
            .is_some_and(|point| point.iter().any(|v| !v.is_finite()))
            || state.events.len() > 100_000
        {
            return Err("钢桩或作业事件恢复点无效".into());
        }
        self.state = state;
        Ok(())
    }

    pub fn prepare_substep(&mut self, time_s: f64, state: &TruthState, values: &[f64], dt_s: f64) {
        self.spud_fraction_rate =
            ((f64::from(self.state.held_commands.spud_down) - values[SPUD_FRACTION]) / dt_s)
                .clamp(-0.1, 0.1);
        if self.state.held_commands.spud_down && self.state.spud_anchor_ned.is_none() {
            self.state.spud_anchor_ned = Some(ladder::world_point(state, spud_point(values)));
        }
        if !self.state.held_commands.spud_down && values[SPUD_FRACTION] < 1e-8 {
            self.state.spud_anchor_ned = None;
        }
        for index in 0..2 {
            let forced = self
                .configuration
                .cable_break_time_s
                .is_some_and(|time| time_s >= time)
                && self.configuration.broken_cable_index == index;
            if !self.state.cable_broken[index]
                && (forced || self.state.last_observation.cable_tension_n[index] >= 1e6)
            {
                self.state.cable_broken[index] = true;
                self.state.events.push(DredgerEvent {
                    time_s,
                    kind: "cable_break".into(),
                    component: index,
                });
            }
        }
    }

    pub fn commit_substep(&mut self, evaluation: MechanismEvaluation, dt_s: f64) {
        let observed = &evaluation.observation;
        let metrics = &mut self.state.fine_metrics;
        metrics.samples += 1;
        metrics.duration_s += dt_s;
        metrics.maximum_ladder_rate_deg_s = metrics
            .maximum_ladder_rate_deg_s
            .max(observed.ladder_rate_deg_s.abs());
        metrics.maximum_cutter_rpm = metrics.maximum_cutter_rpm.max(observed.cutter_rpm.abs());
        metrics.maximum_cutter_power_w = metrics
            .maximum_cutter_power_w
            .max(observed.cutter_power_w.abs());
        metrics.maximum_winch_power_w = metrics.maximum_winch_power_w.max(
            observed
                .winch_power_w
                .iter()
                .map(|p| p.abs())
                .fold(0.0, f64::max),
        );
        metrics.maximum_cable_tension_n = metrics
            .maximum_cable_tension_n
            .max(observed.cable_tension_n.iter().copied().fold(0.0, f64::max));
        metrics.maximum_spud_reaction_n = metrics
            .maximum_spud_reaction_n
            .max(observed.spud_reaction_n);
        let hard = observed.ladder_angle_deg < -0.001
            || observed.ladder_angle_deg > 65.001
            || observed.ladder_rate_deg_s.abs() > 0.501
            || observed.cutter_rpm.abs() > 40.001
            || observed.cutter_power_w.abs() > 4.2e6 + 1.0
            || observed
                .winch_power_w
                .iter()
                .any(|p| p.abs() > 150_000.0 + 1.0)
            || observed.winch_speed_mps.iter().any(|v| v.abs() > 0.500001)
            || evaluation.derivatives[WINCH_PORT..WINCH_PORT + 2]
                .iter()
                .any(|v| v.abs() > 0.100001);
        if hard {
            metrics.hard_violation_duration_s += dt_s;
        }
        if observed.soil_domain_exceeded {
            metrics.soil_domain_violation_duration_s += dt_s;
        }
        self.state.bed.commit(&evaluation.cutting, dt_s);
        self.state.cable_solutions = evaluation.cable_solutions;
        self.state.last_observation = evaluation.observation;
        self.state.last_observation.production_m3 = self.state.bed.removed_volume_m3;
        self.state.last_observation.cutting_work_j = self.state.bed.cutting_work_j;
    }
}

impl DredgerMechanism {
    pub fn evaluate(
        &self,
        state: &TruthState,
        values: &[f64],
        current_ned: [f64; 3],
        base_acceleration: [f64; 6],
        dt_s: f64,
    ) -> Result<MechanismEvaluation, String> {
        Self::validate_values(values)?;
        self.state.held_commands.validate()?;
        let q = values[Q];
        let q_rate = values[Q_RATE];
        let rotor_rate = values[OMEGA];
        let mut force = ladder::gravity_and_buoyancy(state, q);
        let mut derivatives = vec![0.0; STATE_LEN];
        derivatives[Q] = q_rate;
        derivatives[PHASE] = rotor_rate;
        let cutting = evaluate_cutter(
            state,
            q,
            q_rate,
            values[PHASE],
            rotor_rate,
            self.configuration.soil,
            &self.state.bed,
            &self.soil_law,
            dt_s,
        )?;
        for i in 0..8 {
            force[i] += cutting.generalized_force[i];
        }
        self.add_ladder_drag(state, q, q_rate, current_ned, &mut force);
        let depth = envelope_depth(state, q);
        let target_angle = self
            .state
            .held_commands
            .ladder_angle_reference_deg
            .map(f64::to_radians)
            .unwrap_or_else(|| angle_for_depth(state, self.state.held_commands.depth_reference_m));
        let max_rate = 0.3f64.to_radians();
        let reference_rate =
            ((target_angle - values[Q_REFERENCE]) / 2.0).clamp(-max_rate, max_rate);
        derivatives[Q_REFERENCE] = reference_rate;
        let rotation = rotation_matrix(state.quaternion);
        let end_vertical_arm = LENGTH_M * (-rotation[2][0] * q.sin() + rotation[2][2] * q.cos());
        let equilibrium_force = ladder::gravity_and_buoyancy(state, q)[6] / end_vertical_arm;
        let hydraulic_target = (equilibrium_force
            + 2e6 * (q - values[Q_REFERENCE])
            + 20e6 * (q_rate - reference_rate))
            .clamp(-1e6, 1e6);
        derivatives[HYDRAULIC_FORCE] = (hydraulic_target - values[HYDRAULIC_FORCE]) / 0.5;
        let mut hydraulic_force = values[HYDRAULIC_FORCE].clamp(-1e6, 1e6);
        let mut hydraulic_torque = -hydraulic_force * end_vertical_arm;
        force[6] += hydraulic_torque;
        let hydraulic_power = hydraulic_torque * q_rate;
        derivatives[HYDRAULIC_WORK] = hydraulic_power;
        derivatives[POSITIVE_HYDRAULIC_WORK] = hydraulic_power.max(0.0);

        let speed_error =
            self.state.held_commands.cutter_rpm * std::f64::consts::PI / 30.0 - rotor_rate;
        let maximum_torque = (4.2e6 / std::f64::consts::PI).min(4.2e6 / rotor_rate.abs().max(0.1));
        let raw_torque = 150_000.0 * speed_error + values[MOTOR_INTEGRAL];
        let torque_target = raw_torque.clamp(-maximum_torque, maximum_torque);
        derivatives[MOTOR_TORQUE] = (torque_target - values[MOTOR_TORQUE]) / 0.5;
        derivatives[MOTOR_INTEGRAL] = 50_000.0 * speed_error + (torque_target - raw_torque) / 0.5;
        let requested_motor_torque = values[MOTOR_TORQUE].clamp(-maximum_torque, maximum_torque);
        let mut motor_torque = requested_motor_torque;
        force[7] += motor_torque - 2000.0 * rotor_rate;
        derivatives[MOTOR_WORK] = motor_torque * rotor_rate;
        derivatives[POSITIVE_MOTOR_WORK] = derivatives[MOTOR_WORK].max(0.0);

        let fraction = values[SPUD_FRACTION].clamp(0.0, 1.0);
        // 在一个已知子步内恰好结束10s接触斜坡，RK阶段保持同一线性速率。
        derivatives[SPUD_FRACTION] = self.spud_fraction_rate;
        let mut spud_force = [0.0; 3];
        let mut spud_travel = 0.0;
        let carriage_target =
            (values[CARRIAGE] + self.state.held_commands.carriage_speed_mps * dt_s).clamp(0.0, 2.0);
        derivatives[CARRIAGE] = (carriage_target - values[CARRIAGE]) / dt_s;
        if let Some(anchor) = self.state.spud_anchor_ned {
            let point = spud_point(values);
            let world = ladder::world_point(state, point);
            let mut point_velocity = body_velocity_at(state, point);
            point_velocity[0] += derivatives[CARRIAGE];
            let velocity = to_world(state, point_velocity);
            for i in 0..2 {
                spud_force[i] = -fraction * (2e6 * (world[i] - anchor[i]) + 3e5 * velocity[i]);
            }
            spud_travel = world[2] - anchor[2];
            if spud_travel.abs() > 0.5 {
                spud_force[2] = -fraction
                    * (2e6 * (spud_travel - spud_travel.signum() * 0.5) + 3e5 * velocity[2]);
            }
            add_point_force(&mut force, point, to_body(state, spud_force));
        }

        let mut tensions = [0.0; 2];
        let mut winch_power = [0.0; 2];
        let mut cable_solutions = [None; 2];
        for index in 0..2 {
            let speed = values[WINCH_PORT + index];
            let active =
                self.state.held_commands.cables_attached && !self.state.cable_broken[index];
            if active {
                let point = fairlead(index);
                let world = ladder::world_point(state, point);
                let delta: [f64; 3] = std::array::from_fn(|i| anchor(index)[i] - world[i]);
                let horizontal = delta[0].hypot(delta[1]);
                let height = delta[2];
                if height < 0.0 {
                    return Err("导缆点位于声明海床以下".into());
                }
                let solution = solve_catenary(
                    horizontal,
                    height,
                    values[LENGTH_PORT + index],
                    self.state.cable_solutions[index].as_ref(),
                )?;
                let raw_force = [
                    solution.horizontal_tension_n * delta[0] / horizontal,
                    solution.horizontal_tension_n * delta[1] / horizontal,
                    solution.fairlead_vertical_tension_n,
                ];
                let raw_tension = solution
                    .horizontal_tension_n
                    .hypot(solution.fairlead_vertical_tension_n);
                let direction = raw_force.map(|v| {
                    if raw_tension > 0.0 {
                        v / raw_tension
                    } else {
                        0.0
                    }
                });
                let velocity = to_world(state, body_velocity_at(state, point));
                let extension_rate =
                    -(0..3).map(|i| direction[i] * velocity[i]).sum::<f64>() - speed;
                let damping = if solution.fully_slack {
                    0.0
                } else {
                    (1e5 * extension_rate).max(-raw_tension)
                };
                tensions[index] = raw_tension + damping;
                add_point_force(
                    &mut force,
                    point,
                    to_body(state, direction.map(|v| v * tensions[index])),
                );
                winch_power[index] = -tensions[index] * speed;
                cable_solutions[index] = Some(solution);
            }
            let requested_speed = if active {
                self.state.held_commands.winch_speed_mps[index]
            } else {
                0.0
            };
            let maximum_speed = 0.5f64.min(150_000.0 / tensions[index].max(1.0));
            let target = requested_speed.clamp(-maximum_speed, maximum_speed);
            derivatives[WINCH_PORT + index] = ((target - speed) / 0.5).clamp(-0.1, 0.1);
            derivatives[LENGTH_PORT + index] = speed;
            derivatives[WINCH_WORK_PORT + index] = winch_power[index];
            derivatives[POSITIVE_WINCH_WORK_PORT + index] = winch_power[index].max(0.0);
        }
        let mut acceleration = self.coupled.acceleration(
            state,
            q,
            [q_rate, rotor_rate],
            current_ned,
            base_acceleration,
            force,
        )?;
        // 液压与轴速保护共同使用耦合后的广义惯量和有限执行器力。
        // 船体、桥架角和轴速继续积分，实际机械功采用保护后交付的力矩。
        let maximum_rate = 40.0 * std::f64::consts::PI / 30.0;
        let ladder_rate_limit = 0.5f64.to_radians();
        let allowed_ladder_acceleration = acceleration.ladder_rad_s2.clamp(
            0.9 * (-ladder_rate_limit - q_rate) / dt_s,
            0.9 * (ladder_rate_limit - q_rate) / dt_s,
        );
        let allowed_rotor_acceleration = acceleration.rotor_rad_s2.clamp(
            0.9 * (-maximum_rate - rotor_rate) / dt_s,
            0.9 * (maximum_rate - rotor_rate) / dt_s,
        );
        if allowed_ladder_acceleration != acceleration.ladder_rad_s2
            || allowed_rotor_acceleration != acceleration.rotor_rad_s2
        {
            let delta = [
                allowed_ladder_acceleration - acceleration.ladder_rad_s2,
                allowed_rotor_acceleration - acceleration.rotor_rad_s2,
            ];
            let delta_torque: [f64; 2] = std::array::from_fn(|i| {
                acceleration.modal_mass[i][0] * delta[0] + acceleration.modal_mass[i][1] * delta[1]
            });
            let limited_hydraulic_force =
                (hydraulic_force - delta_torque[0] / end_vertical_arm).clamp(-1e6, 1e6);
            let limited_hydraulic_torque = -limited_hydraulic_force * end_vertical_arm;
            let limited_motor_torque =
                (motor_torque + delta_torque[1]).clamp(-maximum_torque, maximum_torque);
            force[6] += limited_hydraulic_torque - hydraulic_torque;
            force[7] += limited_motor_torque - motor_torque;
            hydraulic_force = limited_hydraulic_force;
            hydraulic_torque = limited_hydraulic_torque;
            motor_torque = limited_motor_torque;
            acceleration = self.coupled.acceleration(
                state,
                q,
                [q_rate, rotor_rate],
                current_ned,
                base_acceleration,
                force,
            )?;
        }
        derivatives[HYDRAULIC_WORK] = hydraulic_torque * q_rate;
        derivatives[POSITIVE_HYDRAULIC_WORK] = derivatives[HYDRAULIC_WORK].max(0.0);
        derivatives[MOTOR_WORK] = motor_torque * rotor_rate;
        derivatives[POSITIVE_MOTOR_WORK] = derivatives[MOTOR_WORK].max(0.0);
        derivatives[MOTOR_INTEGRAL] = 50_000.0 * speed_error
            + (torque_target - raw_torque) / 0.5
            + (motor_torque - requested_motor_torque) / 0.5;
        derivatives[Q_RATE] = acceleration.ladder_rad_s2;
        derivatives[OMEGA] = acceleration.rotor_rad_s2;
        let center = ladder::point_body(q, LENGTH_M);
        let center_q = ladder::point_ladder_derivative(q, LENGTH_M);
        let center_velocity = to_world(
            state,
            std::array::from_fn(|i| body_velocity_at(state, center)[i] + center_q[i] * q_rate),
        );
        let epsilon = 1e-5;
        let point_rate = (envelope_depth(state, q + epsilon) - envelope_depth(state, q - epsilon))
            / (2.0 * epsilon)
            * q_rate;
        let observation = DredgerObservation {
            depth_m: depth,
            depth_rate_mps: center_velocity[2] - to_world(state, center_q.map(|v| v * q_rate))[2]
                + point_rate,
            cutter_east_m: ladder::world_point(state, center)[1],
            cutter_sway_speed_mps: center_velocity[1],
            ladder_angle_deg: q.to_degrees(),
            ladder_rate_deg_s: q_rate.to_degrees(),
            cutter_rpm: rotor_rate * 30.0 / std::f64::consts::PI,
            cutter_torque_nm: motor_torque,
            cutter_power_w: derivatives[MOTOR_WORK],
            cutting_power_w: cutting.cutting_power_w,
            cable_tension_n: tensions,
            cable_length_m: [values[LENGTH_PORT], values[LENGTH_PORT + 1]],
            winch_speed_mps: [values[WINCH_PORT], values[WINCH_PORT + 1]],
            winch_power_w: winch_power,
            spud_contact_fraction: fraction,
            spud_reaction_n: spud_force.iter().map(|v| v * v).sum::<f64>().sqrt(),
            spud_vertical_travel_m: spud_travel,
            carriage_m: values[CARRIAGE],
            hydraulic_force_n: hydraulic_force,
            production_m3: self.state.bed.removed_volume_m3,
            production_rate_m3_s: cutting.volume_rate_m3_s,
            cutting_work_j: self.state.bed.cutting_work_j,
            positive_winch_work_j: values[POSITIVE_WINCH_WORK_PORT]
                + values[POSITIVE_WINCH_WORK_PORT + 1],
            positive_cutter_work_j: values[POSITIVE_MOTOR_WORK],
            soil_domain_exceeded: cutting.soil_domain_exceeded,
        };
        Ok(MechanismEvaluation {
            acceleration,
            derivatives,
            observation,
            cutting,
            cable_solutions,
        })
    }

    fn add_ladder_drag(
        &self,
        state: &TruthState,
        q: f64,
        q_rate: f64,
        current_ned: [f64; 3],
        force: &mut [f64; 8],
    ) {
        let (begin, end) = ladder::wet_segment(state, q);
        let current = to_body(state, current_ned);
        let axis = ladder::direction(q);
        let diameter = 2.0 * (CYLINDER_AREA_M2 / std::f64::consts::PI).sqrt();
        for fraction in [0.1127016653792583, 0.5, 0.8872983346207417] {
            let along = begin + fraction * (end - begin);
            let point = ladder::point_body(q, along);
            let point_q = ladder::point_ladder_derivative(q, along);
            let velocity: [f64; 3] = std::array::from_fn(|i| {
                body_velocity_at(state, point)[i] + point_q[i] * q_rate - current[i]
            });
            let axial = (0..3).map(|i| axis[i] * velocity[i]).sum::<f64>();
            let transverse: [f64; 3] = std::array::from_fn(|i| velocity[i] - axial * axis[i]);
            let speed = transverse.iter().map(|v| v * v).sum::<f64>().sqrt();
            let weight = if fraction == 0.5 {
                4.0 / 9.0
            } else {
                5.0 / 18.0
            };
            let drag = transverse
                .map(|v| -0.5 * 1025.0 * 1.2 * diameter * (end - begin) * weight * speed * v);
            let jacobian = ladder::point_jacobian(point, point_q);
            for i in 0..8 {
                force[i] += (0..3).map(|j| jacobian[j][i] * drag[j]).sum::<f64>();
            }
        }
    }
}
