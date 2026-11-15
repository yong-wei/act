use control_engine::sixdof::coupled_sloshing::{CoupledSloshing, LiquidTank};
use control_engine::sixdof::dynamics::{
    dynamics_step, mass_matrix, AddedMassParams, CurrentFieldBody, ExternalForces, RestoringParams,
    RigidBodyParams,
};
use control_engine::sixdof::state::{normalize_quaternion, quaternion_rate, TruthState};

fn small_tank(damping: f64) -> LiquidTank {
    LiquidTank {
        center_bottom_body_m: [2.0, 0.5, 1.0],
        length_m: 4.0,
        width_m: 3.0,
        height_m: 4.0,
        fill_ratio: 0.5,
        density_kg_m3: 450.0,
        damping_ratio: damping,
    }
}

fn rigid() -> RigidBodyParams {
    RigidBodyParams {
        mass_kg: 1e6,
        inertia_about_cg: [[2e7, 0.0, 0.0], [0.0, 3e7, 0.0], [0.0, 0.0, 3.5e7]],
    }
}

fn mass() -> [[f64; 6]; 6] {
    mass_matrix(
        &rigid(),
        &AddedMassParams {
            a_inf: [[0.0; 6]; 6],
        },
    )
}

fn total_energy(system: &CoupledSloshing, state: &TruthState, values: &[f64]) -> f64 {
    let mass = mass();
    let kinetic: f64 = (0..6)
        .map(|row| {
            (0..6)
                .map(|column| {
                    0.5 * state.body_velocity[row] * mass[row][column] * state.body_velocity[column]
                })
                .sum::<f64>()
        })
        .sum();
    kinetic + system.modal_energy_j(state, values).unwrap()
}

#[test]
fn lng_couplings_match_independent_potential_gradient_volume_integrals() {
    let reference: serde_json::Value = serde_json::from_str(include_str!(
        "../../../docs/research/fleet-hydrodynamics/sloshing-coupling-integral-validation.json"
    ))
    .unwrap();
    let kg = reference["reference_kg_keel_up_m"].as_f64().unwrap();
    let mass_kg = reference["baseline_static_stability"]["mass_kg"]
        .as_f64()
        .unwrap();
    let rigid = RigidBodyParams {
        mass_kg,
        inertia_about_cg: [
            [mass_kg * (0.35_f64 * 46.4).powi(2), 0.0, 0.0],
            [0.0, mass_kg * (0.25_f64 * 286.0).powi(2), 0.0],
            [0.0, 0.0, mass_kg * (0.25_f64 * 286.0).powi(2)],
        ],
    };
    let tanks: Vec<_> = [-66.0, -22.0, 22.0, 66.0]
        .into_iter()
        .map(|x| LiquidTank {
            center_bottom_body_m: [x, 0.0, kg - 1.5],
            length_m: 44.0,
            width_m: 38.0,
            height_m: 26.0,
            fill_ratio: 0.85,
            density_kg_m3: 450.0,
            damping_ratio: 0.03,
        })
        .collect();
    let system = CoupledSloshing::new(
        &tanks,
        &rigid,
        mass_matrix(
            &rigid,
            &AddedMassParams {
                a_inf: [[0.0; 6]; 6],
            },
        ),
    )
    .unwrap();
    assert_eq!(system.state_len(), 16);
    assert!((system.partition.fixed_mass_kg - 50e6).abs() < 1e-6);
    for installed in &system.modes {
        let axis = if installed.direction_body[0] == 1.0 {
            0
        } else {
            1
        };
        let expected = reference["modes"]
            .as_array()
            .unwrap()
            .iter()
            .find(|mode| {
                mode["fill_ratio"] == 0.85 && mode["width_m"] == if axis == 0 { 44.0 } else { 38.0 }
            })
            .unwrap();
        assert!(
            (installed.mode.modal_mass
                / expected["independent_integrals"]["modal_mass_kg"]
                    .as_f64()
                    .unwrap()
                - 1.0)
                .abs()
                < 1e-12
        );
        assert!(
            (installed.coupling[axis]
                / expected["independent_integrals"]["translation_kg"]
                    .as_f64()
                    .unwrap()
                - 1.0)
                .abs()
                < 1e-12
        );
        let rotation = if axis == 0 {
            installed.coupling[4]
        } else {
            -installed.coupling[3]
        };
        assert!(
            (rotation
                / expected["independent_integrals"]["rotation_kg_m"]
                    .as_f64()
                    .unwrap()
                - 1.0)
                .abs()
                < 1e-12
        );
    }
}

#[test]
fn schur_acceleration_and_actual_six_axis_reaction_close_the_original_mass_balance() {
    let system = CoupledSloshing::new(&[small_tank(0.03)], &rigid(), mass()).unwrap();
    let state = TruthState {
        quaternion: normalize_quaternion([1.0, 0.02, -0.01, 0.03]),
        body_velocity: [0.4, -0.2, 0.1, 0.03, -0.02, 0.01],
        ..Default::default()
    };
    let base = [0.03, -0.01, 0.02, 0.001, 0.002, -0.003];
    let evaluated = system
        .evaluate(&state, &[0.01, 0.02, -0.02, -0.01], base)
        .unwrap();
    for row in 0..6 {
        let actual: f64 = (0..6)
            .map(|column| {
                mass()[row][column] * (evaluated.body_acceleration[column] - base[column])
            })
            .sum();
        assert!(
            (actual - evaluated.reaction_body[row]).abs() < 1e-7,
            "动量分量{row} {actual} {}",
            evaluated.reaction_body[row]
        );
    }
}

#[test]
fn constant_turning_excites_modes_through_actual_installed_point_acceleration() {
    use control_engine::sixdof::state::moment_from_force;
    let system = CoupledSloshing::new(&[small_tank(0.03)], &rigid(), mass()).unwrap();
    let state = TruthState {
        quaternion: [1.0, 0.0, 0.0, 0.0],
        body_velocity: [0.5, 0.0, 0.0, 0.0, 0.0, 0.1],
        ..Default::default()
    };
    let evaluated = system.evaluate(&state, &[0.0; 4], [0.0; 6]).unwrap();
    let omega = [0.0, 0.0, 0.1];
    let center_acceleration = moment_from_force(omega, [0.5, 0.0, 0.0]);
    let alpha = evaluated.body_acceleration[3..].try_into().unwrap();
    for (index, installed) in system.modes.iter().enumerate() {
        let angular = moment_from_force(alpha, installed.reference_point_body_m);
        let centrifugal = moment_from_force(
            omega,
            moment_from_force(omega, installed.reference_point_body_m),
        );
        let local: [f64; 3] = std::array::from_fn(|axis| {
            evaluated.body_acceleration[axis]
                + center_acceleration[axis]
                + angular[axis]
                + centrifugal[axis]
        });
        let forcing: f64 = local
            .iter()
            .zip(installed.direction_body)
            .map(|(a, b)| a * b)
            .sum();
        let expected = -installed.mode.forcing_gamma * forcing;
        assert!((evaluated.modal_derivatives[2 * index + 1] - expected).abs() < 1e-11);
    }
    assert!(evaluated.modal_derivatives[3].abs() > 1e-3);
}

#[test]
fn coupled_power_equals_modal_dissipation_in_all_six_body_channels() {
    for damping in [0.0, 0.03, 0.08] {
        let system = CoupledSloshing::new(&[small_tank(damping)], &rigid(), mass()).unwrap();
        let state = TruthState {
            quaternion: normalize_quaternion([1.0, 0.05, -0.02, 0.1]),
            body_velocity: [0.2, -0.1, 0.03, 0.01, 0.02, -0.005],
            ..Default::default()
        };
        let values = [0.01, 0.02, -0.02, 0.01];
        let base = dynamics_step(
            &state,
            &rigid(),
            &AddedMassParams {
                a_inf: [[0.0; 6]; 6],
            },
            &RestoringParams {
                k_linear: [[0.0; 6]; 6],
            },
            &CurrentFieldBody::default(),
            [0.0; 6],
            [0.0; 6],
            &ExternalForces::default(),
        );
        let evaluated = system.evaluate(&state, &values, base.nu_dot).unwrap();
        let q_dot = quaternion_rate(
            state.quaternion,
            [
                state.body_velocity[3],
                state.body_velocity[4],
                state.body_velocity[5],
            ],
        );
        let epsilon = 1e-5;
        let mut energies = Vec::new();
        for sign in [-1.0, 1.0] {
            let mut perturbed = state.clone();
            for axis in 0..6 {
                perturbed.body_velocity[axis] += sign * epsilon * evaluated.body_acceleration[axis];
            }
            perturbed.quaternion = normalize_quaternion(std::array::from_fn(|axis| {
                state.quaternion[axis] + sign * epsilon * q_dot[axis]
            }));
            let modal: Vec<_> = values
                .iter()
                .zip(&evaluated.modal_derivatives)
                .map(|(value, rate)| value + sign * epsilon * rate)
                .collect();
            energies.push(total_energy(&system, &perturbed, &modal));
        }
        let observed = (energies[1] - energies[0]) / (2.0 * epsilon);
        let dissipation: f64 = system
            .modes
            .iter()
            .enumerate()
            .map(|(index, installed)| {
                2.0 * installed.mode.damping_ratio
                    * installed.mode.modal_mass
                    * installed.mode.omega_n
                    * values[2 * index + 1].powi(2)
            })
            .sum();
        assert!(
            (observed + dissipation).abs() < 1e-4,
            "功收支 {observed} 期望{}",
            -dissipation
        );
    }
}

#[test]
fn mass_partition_invalid_states_and_small_amplitude_domain_are_explicit() {
    let mut impossible = small_tank(0.03);
    impossible.density_kg_m3 = 1e8;
    assert!(CoupledSloshing::new(&[impossible], &rigid(), mass()).is_err());
    let system = CoupledSloshing::new(&[small_tank(0.03)], &rigid(), mass()).unwrap();
    assert!(system
        .evaluate(&TruthState::default(), &[0.0], [0.0; 6])
        .is_err());
    let values = [3.0, 0.0, 0.0, 0.0];
    let evaluated = system
        .evaluate(
            &TruthState {
                quaternion: [1.0, 0.0, 0.0, 0.0],
                ..Default::default()
            },
            &values,
            [0.0; 6],
        )
        .unwrap();
    assert!(!evaluated.within_small_amplitude);
    assert!(evaluated.modal_derivatives[1].abs() > 1.0);
    assert_eq!(values[0], 3.0);
    let near_full = LiquidTank {
        fill_ratio: 0.98,
        ..small_tank(0.03)
    };
    let near_full = CoupledSloshing::new(&[near_full], &rigid(), mass()).unwrap();
    let corner = near_full
        .diagnostics(
            &TruthState {
                quaternion: [1.0, 0.0, 0.0, 0.0],
                ..Default::default()
            },
            &[0.05, 0.0, 0.05, 0.0],
        )
        .unwrap();
    assert!(!corner.within_small_amplitude, "两方向的合成液面到达顶盖");
    assert_eq!(corner.wall_heights_m, vec![0.05, 0.05]);
}

#[test]
fn actual_plant_integrates_modal_reaction_and_restores_its_complete_future() {
    use control_engine::sixdof::model_pack::embedded_destroyer_055_v4;
    use control_engine::sixdof::{DestroyerCommands, DestroyerSixDofPlant};
    let pack = embedded_destroyer_055_v4().unwrap();
    let mut coupled = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
    let mut baseline = coupled.clone();
    coupled.configure_liquid_tanks(&[small_tank(0.03)]).unwrap();
    let mut state = coupled.state().clone();
    state.specialist_states[2] = 0.03;
    coupled.restore_state(state);
    for _ in 0..12 {
        coupled.step(DestroyerCommands::default()).unwrap();
        baseline.step(DestroyerCommands::default()).unwrap();
    }
    assert_ne!(
        coupled.state().body_velocity,
        baseline.state().body_velocity
    );
    assert!(
        coupled
            .liquid_diagnostics()
            .unwrap()
            .unwrap()
            .within_small_amplitude
    );
    assert!(coupled
        .state()
        .specialist_states
        .iter()
        .any(|value| value.abs() > 1e-8));
    let checkpoint = serde_json::to_string(&coupled.checkpoint()).unwrap();
    let mut restored = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
    restored
        .configure_liquid_tanks(&[small_tank(0.03)])
        .unwrap();
    restored
        .restore_checkpoint(serde_json::from_str(&checkpoint).unwrap())
        .unwrap();
    for _ in 0..12 {
        coupled.step(DestroyerCommands::default()).unwrap();
        restored.step(DestroyerCommands::default()).unwrap();
    }
    assert_eq!(coupled.state(), restored.state());
    let mut malformed: serde_json::Value = serde_json::from_str(&checkpoint).unwrap();
    malformed["state"]["specialist_states"] = serde_json::json!([0.0]);
    assert!(restored
        .restore_checkpoint(serde_json::from_value(malformed).unwrap())
        .is_err());
    assert_eq!(coupled.state(), restored.state());
}

#[test]
fn conservative_coupled_rk_motion_preserves_total_mechanical_energy() {
    use control_engine::sixdof::integrator::{rk4_step, NOMINAL_DT};
    let system = CoupledSloshing::new(&[small_tank(0.0)], &rigid(), mass()).unwrap();
    let mut values = vec![0.0; 13 + system.state_len()];
    values[3] = 1.0;
    values[13] = 0.03;
    let decode = |values: &[f64]| TruthState {
        position_ned: values[..3].try_into().unwrap(),
        quaternion: normalize_quaternion(values[3..7].try_into().unwrap()),
        body_velocity: values[7..13].try_into().unwrap(),
        ..Default::default()
    };
    let initial_energy = total_energy(&system, &decode(&values), &values[13..]);
    let mut maximum_error = 0.0_f64;
    for tick in 0..480 {
        rk4_step(
            tick as f64 * NOMINAL_DT,
            &mut values,
            NOMINAL_DT,
            |_, values, rates| {
                let state = decode(values);
                let base = dynamics_step(
                    &state,
                    &rigid(),
                    &AddedMassParams {
                        a_inf: [[0.0; 6]; 6],
                    },
                    &RestoringParams {
                        k_linear: [[0.0; 6]; 6],
                    },
                    &CurrentFieldBody::default(),
                    [0.0; 6],
                    [0.0; 6],
                    &ExternalForces::default(),
                );
                let evaluated = system.evaluate(&state, &values[13..], base.nu_dot).unwrap();
                rates[..3].copy_from_slice(&base.position_dot_ned);
                rates[3..7].copy_from_slice(&base.quaternion_dot);
                rates[7..13].copy_from_slice(&evaluated.body_acceleration);
                rates[13..].copy_from_slice(&evaluated.modal_derivatives);
            },
        )
        .unwrap();
        let energy = total_energy(&system, &decode(&values), &values[13..]);
        maximum_error = maximum_error.max((energy / initial_energy - 1.0).abs());
        let state = decode(&values);
        let omega = state.body_velocity[3..].try_into().unwrap();
        let mut first_moment = [0.0; 3];
        let mut relative_momentum = [0.0; 3];
        for (index, installed) in system.modes.iter().enumerate() {
            for axis in 0..3 {
                first_moment[axis] += installed.mode.reaction_coupling
                    * values[13 + 2 * index]
                    * installed.direction_body[axis];
                relative_momentum[axis] += installed.mode.reaction_coupling
                    * values[14 + 2 * index]
                    * installed.direction_body[axis];
            }
        }
        let transport = control_engine::sixdof::state::moment_from_force(omega, first_moment);
        let momentum: f64 = (0..3)
            .map(|axis| {
                (rigid().mass_kg * state.body_velocity[axis]
                    + transport[axis]
                    + relative_momentum[axis])
                    .powi(2)
            })
            .sum();
        assert!(momentum.sqrt() < 1e-5, "系统初始零平移动量保持闭合");
    }
    assert!(maximum_error < 1e-7, "双向耦合RK能量误差 {maximum_error}");
}
