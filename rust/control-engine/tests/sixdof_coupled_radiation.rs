use control_engine::sixdof::coupled_radiation::{PassiveRadiationModel, RadiationOscillator};
use control_engine::sixdof::integrator::rk4_step;
use num_complex::Complex64;

fn model() -> PassiveRadiationModel {
    PassiveRadiationModel {
        frequency_band_rad_s: [0.025, 2.5],
        added_mass_factors: vec![[2.0, -1.0, 3.0, 0.5, 1.0, -2.0], [0.0, 1.0, 0.0, 2.0, 0.0, 3.0]],
        oscillators: vec![
            RadiationOscillator { natural_frequency_rad_s: 2.0, damping_ratio: 0.12,
                coupling: [3.0, -2.0, 1.0, 0.5, -4.0, 2.0] },
            RadiationOscillator { natural_frequency_rad_s: 1.3, damping_ratio: 0.25,
                coupling: [-2.0, 1.0, 2.0, -3.0, 2.0, 4.0] },
        ],
    }
}

#[test]
fn coupled_port_power_matches_stored_energy_rate_and_positive_dissipation() {
    let model = model();
    model.validate().unwrap();
    let state = [0.7, -0.3, -0.2, 0.5];
    let velocity = [1.5, -0.3, 0.1, 0.2, -0.4, 0.7];
    let mut derivatives = [0.0; 4];
    let loads = model.derivatives_into(&state, velocity, &mut derivatives).unwrap();
    let port: f64 = loads.iter().zip(velocity).map(|(a, b)| a*b).sum();
    let mut energy_rate = 0.0;
    let mut dissipation = 0.0;
    for (index, mode) in model.oscillators.iter().enumerate() {
        energy_rate += state[2*index+1]*derivatives[2*index+1]
            +mode.natural_frequency_rad_s.powi(2)*state[2*index]*derivatives[2*index];
        dissipation += 2.0*mode.damping_ratio*mode.natural_frequency_rad_s*state[2*index+1].powi(2);
    }
    assert!(dissipation > 0.0);
    assert!((port-energy_rate-dissipation).abs() < 1e-13);
    assert!(model.stored_energy(&state).unwrap() > 0.0);
    assert!(loads.iter().all(|value| value.abs() > 0.0));
}

#[test]
fn added_mass_factors_and_complex_impedance_preserve_full_coupling_and_passivity() {
    let model = model();
    let mass = model.added_mass();
    assert_eq!(mass[0][4], 2.0);
    assert_eq!(mass[1][5], 5.0);
    for omega in [0.0, 0.025, 0.2, 1.3, 2.0, 2.5, 8.0] {
        let response = model.impedance(omega).unwrap();
        let mut expected = Complex64::new(0.0, 0.0);
        for mode in &model.oscillators {
            expected += mode.coupling[0]*mode.coupling[4]*Complex64::new(0.0, omega)
                /Complex64::new(mode.natural_frequency_rad_s.powi(2)-omega*omega,
                    2.0*mode.damping_ratio*mode.natural_frequency_rad_s*omega);
        }
        assert!((response[0][4]-expected).norm() < 1e-14);
        for row in 0..6 {
            for column in 0..6 {
                assert_eq!(response[row][column], response[column][row]);
            }
        }
        for vector in [[1.0; 6], [1.0, -2.0, 0.0, 3.0, -1.0, 4.0]] {
            let mut power = 0.0;
            let mut kinetic = 0.0;
            for row in 0..6 {
                for column in 0..6 {
                    power += vector[row]*response[row][column].re*vector[column];
                    kinetic += vector[row]*mass[row][column]*vector[column];
                }
            }
            assert!(power >= -1e-12);
            assert!(kinetic >= -1e-12);
        }
    }
}

#[test]
fn constant_relative_velocity_has_preloaded_zero_memory_load() {
    let model = model();
    let velocity = [4.0, -0.3, 0.2, 0.01, -0.04, 0.03];
    let steady = model.steady_state(velocity);
    let mut derivatives = vec![0.0; model.state_len()];
    let loads = model.derivatives_into(&steady, velocity, &mut derivatives).unwrap();
    assert!(loads.iter().all(|value| *value == 0.0));
    assert!(derivatives.iter().all(|value| value.abs() < 1e-14));
    assert!(model.impedance(0.0).unwrap().iter().flatten().all(|value| value.norm() == 0.0));
}

#[test]
fn fixed_step_free_decay_matches_closed_solution_and_keeps_nonincreasing_energy() {
    let mut model = model();
    model.oscillators.truncate(1);
    let mode = &model.oscillators[0];
    let mut values = [0.7, -0.2];
    let mut previous_energy = model.stored_energy(&values).unwrap();
    let dt = 1.0/120.0;
    for step in 0..600 {
        rk4_step(step as f64*dt, &mut values, dt, |_, values, derivatives| {
            model.derivatives_into(values, [0.0; 6], derivatives).unwrap();
        }).unwrap();
        let energy = model.stored_energy(&values).unwrap();
        assert!(energy <= previous_energy*(1.0+1e-12));
        previous_energy = energy;
    }
    let decay = mode.damping_ratio*mode.natural_frequency_rad_s;
    let damped = mode.natural_frequency_rad_s*(1.0-mode.damping_ratio.powi(2)).sqrt();
    let time = 5.0;
    let sine = (damped*time).sin();
    let cosine = (damped*time).cos();
    let coefficient = (-0.2+decay*0.7)/damped;
    let position = (-decay*time).exp()*(0.7*cosine+coefficient*sine);
    let rate = (-decay*time).exp()*(-decay*(0.7*cosine+coefficient*sine)
        -0.7*damped*sine+coefficient*damped*cosine);
    assert!((values[0]-position).abs() < 2e-8);
    assert!((values[1]-rate).abs() < 2e-8);
}

#[test]
fn invalid_fitted_modes_states_and_unstable_fixed_step_poles_are_rejected() {
    let mut invalid = model();
    invalid.oscillators[0].damping_ratio = 0.0;
    assert!(invalid.validate().is_err());
    invalid = model();
    invalid.oscillators[0].natural_frequency_rad_s = 1000.0;
    assert!(invalid.validate().unwrap_err().contains("稳定域"));
    invalid = model();
    invalid.added_mass_factors[0][2] = f64::NAN;
    assert!(invalid.validate().is_err());
    let model = model();
    assert!(model.validate_state(&[0.0]).is_err());
    let mut derivatives = [123.0; 4];
    assert!(model.derivatives_into(&[0.0; 4], [f64::NAN; 6], &mut derivatives).is_err());
    assert_eq!(derivatives, [123.0; 4]);
    assert!(model.impedance(f64::NAN).is_err());
    assert!(model.impedance(-1.0).is_err());
}

#[test]
fn uniform_current_projection_and_rotating_derivative_match_independent_finite_differences() {
    use control_engine::sixdof::environment_state::EnvironmentState;
    use control_engine::sixdof::state::{normalize_quaternion, quaternion_rate};
    let mut environment = EnvironmentState::calm(20261106);
    environment.switches.current_enabled = true;
    environment.current_ned = [0.3, -0.4];
    let quaternion = normalize_quaternion([0.97, 0.1, -0.12, 0.17]);
    let velocity = [2.0, -0.1, 0.2, 0.03, -0.02, 0.04];
    let derivative = quaternion_rate(quaternion, [velocity[3], velocity[4], velocity[5]]);
    let epsilon = 1e-6;
    let forward = normalize_quaternion(std::array::from_fn(|axis| quaternion[axis]+epsilon*derivative[axis]));
    let backward = normalize_quaternion(std::array::from_fn(|axis| quaternion[axis]-epsilon*derivative[axis]));
    let field = environment.current_field(quaternion, velocity);
    let next = environment.current_field(forward, velocity);
    let previous = environment.current_field(backward, velocity);
    assert!((field.nu_current_body[..3].iter().map(|value| value*value).sum::<f64>()-0.25).abs() < 1e-14);
    for axis in 0..6 {
        let finite_difference = (next.nu_current_body[axis]-previous.nu_current_body[axis])/(2.0*epsilon);
        assert!((field.nu_current_body_dot[axis]-finite_difference).abs() < 1e-10);
    }
    assert!(field.nu_current_body[2].abs() > 1e-3);
    environment.switches.current_enabled = false;
    let disabled = environment.current_field(quaternion, velocity);
    assert_eq!(disabled.nu_current_body, [0.0; 6]);
    assert_eq!(disabled.nu_current_body_dot, [0.0; 6]);
}

#[test]
fn actual_plant_uses_one_fitted_matrix_for_added_inertia_coriolis_and_relative_memory() {
    use control_engine::sixdof::actuator_system::{ActuatorCommands, ShaftCommand};
    use control_engine::sixdof::dynamics::{AddedMassParams, coriolis_added_mass, mass_matrix, RigidBodyParams};
    use control_engine::sixdof::environment_state::EnvironmentState;
    use control_engine::sixdof::model_pack::embedded_vessel_pack;
    use control_engine::sixdof::state::normalize_quaternion;
    use control_engine::sixdof::{DestroyerSixDofPlant, WindHullGeometry};
    let pack = embedded_vessel_pack("semisub-981", "research-nominal-v2").unwrap();
    let radiation = pack.geometry.passive_radiation.as_ref().unwrap();
    assert_eq!(radiation.oscillators.len(), 52);
    let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
    let mut state = plant.state().clone();
    state.quaternion = normalize_quaternion([0.999, 0.01, -0.02, 0.015]);
    state.body_velocity = [0.4, -0.2, 0.03, 0.001, -0.002, 0.003];
    plant.restore_state(state);
    let mut environment = EnvironmentState::calm(20261106);
    environment.switches.current_enabled = true;
    environment.current_ned = [0.3, 0.1];
    plant.set_environment_state(environment.clone(), WindHullGeometry {
        frontal_area_m2: 0.0, lateral_area_m2: 0.0, length_m: pack.geometry.lpp_m,
        pressure_center_body: [0.0; 3],
    });
    let commands = ActuatorCommands { shafts: vec![ShaftCommand::default(); 8], surfaces: vec![] };
    plant.step_with_actuators(1.0/120.0, &commands).unwrap();
    let state = plant.state();
    let current = environment.current_field(state.quaternion, state.body_velocity);
    let relative = std::array::from_fn(|axis| state.body_velocity[axis]-current.nu_current_body[axis]);
    let added = AddedMassParams { a_inf: radiation.added_mass() };
    let expected_coriolis = coriolis_added_mass(&added, relative);
    let mut rates = vec![0.0; radiation.state_len()];
    let expected_memory = radiation.derivatives_into(&state.radiation_states, relative, &mut rates).unwrap();
    let output = plant.last_dynamics().unwrap();
    let geometry = &pack.geometry;
    let rigid = RigidBodyParams { mass_kg: geometry.displacement_mass_kg,
        inertia_about_cg: [[geometry.inertia_about_cg_kg_m2.ixx, 0.0, 0.0],
            [0.0, geometry.inertia_about_cg_kg_m2.iyy, 0.0], [0.0, 0.0, geometry.inertia_about_cg_kg_m2.izz]] };
    let mass = mass_matrix(&rigid, &added);
    for row in 0..6 {
        assert!((output.breakdown.coriolis_added_mass[row]-expected_coriolis[row]).abs() < 1e-7);
        assert!((output.breakdown.radiation[row]-expected_memory[row]).abs() < 1e-7);
        let current_inertia: f64 = (0..6).map(|column| added.a_inf[row][column]*current.nu_current_body_dot[column]).sum();
        assert!((output.breakdown.current_inertia[row]-current_inertia).abs() < 1e-7);
        let left: f64 = (0..6).map(|column| mass[row][column]*output.nu_dot[column]).sum();
        let right = output.breakdown.external[row]-output.breakdown.coriolis_rb[row]
            -expected_coriolis[row]-expected_memory[row]-output.breakdown.restoring[row]+current_inertia;
        assert!((left-right).abs() < 1e-7*right.abs().max(1.0));
    }
    assert!(output.breakdown.radiation.iter().any(|value| value.abs() > 1e-3));
    assert!(output.breakdown.current_inertia.iter().any(|value| value.abs() > 1e-3));
}

#[test]
fn fitted_semisub_session_restores_all_radiation_states_and_future_in_current() {
    use control_engine::sixdof::sensor::NoiseLevel;
    use control_engine::sixdof::session::{EnvironmentPreset, FleetSimulation, SessionConfiguration};
    let mut session = FleetSimulation::new(SessionConfiguration {
        vessel: "semisub-981".into(), parameter_version: "research-nominal-v2".into(),
        environment: EnvironmentPreset::C1, noise_level: NoiseLevel::N0, ..Default::default()
    }).unwrap();
    let mut input = session.input().clone();
    input.actuators.shafts[0].speed_reference_rad_s = 3.0;
    session.advance(0.1, Some(input)).unwrap();
    let mut restored = FleetSimulation::from_snapshot_json(&session.snapshot_json().unwrap()).unwrap();
    session.advance(0.1, None).unwrap();
    restored.advance(0.1, None).unwrap();
    assert_eq!(session.snapshot_json().unwrap(), restored.snapshot_json().unwrap());
    let frame: serde_json::Value = serde_json::from_str(&session.frame_json().unwrap()).unwrap();
    assert_eq!(frame["truth"]["radiation_states"].as_array().unwrap().len(), 104);
    assert!(frame["truth"]["radiation_states"].as_array().unwrap().iter()
        .any(|value| value.as_f64().unwrap().abs() > 1e-3));
}

#[test]
fn fitted_heave_decay_keeps_energy_nonincreasing_and_converges_when_time_step_is_halved() {
    use control_engine::sixdof::actuator_system::{ActuatorCommands, ShaftCommand};
    use control_engine::sixdof::dynamics::{AddedMassParams, mass_matrix, RigidBodyParams};
    use control_engine::sixdof::model_pack::embedded_vessel_pack;
    use control_engine::sixdof::{DestroyerSixDofPlant, TruthState};
    let pack = embedded_vessel_pack("semisub-981", "research-nominal-v2").unwrap();
    let geometry = &pack.geometry;
    let radiation = geometry.passive_radiation.as_ref().unwrap();
    let rigid = RigidBodyParams { mass_kg: geometry.displacement_mass_kg,
        inertia_about_cg: [[geometry.inertia_about_cg_kg_m2.ixx, 0.0, 0.0],
            [0.0, geometry.inertia_about_cg_kg_m2.iyy, 0.0], [0.0, 0.0, geometry.inertia_about_cg_kg_m2.izz]] };
    let mass = mass_matrix(&rigid, &AddedMassParams { a_inf: radiation.added_mass() });
    let hull = geometry.nonlinear_hydrostatics.as_ref().unwrap();
    let reference = hull.evaluate(&TruthState::default(), rigid.mass_kg, 1025.0).potential_energy_j;
    let energy = |state: &TruthState| {
        let mut kinetic = 0.0;
        for row in 0..6 {
            for column in 0..6 {
                kinetic += 0.5*state.body_velocity[row]*mass[row][column]*state.body_velocity[column];
            }
        }
        kinetic+radiation.stored_energy(&state.radiation_states).unwrap()
            +hull.evaluate(state, rigid.mass_kg, 1025.0).potential_energy_j-reference
    };
    let run = |dt: f64| {
        let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
        let mut initial = plant.state().clone();
        initial.position_ned[2] = 0.1;
        plant.restore_state(initial);
        let initial_energy = energy(plant.state());
        let mut maximum = initial_energy;
        let commands = ActuatorCommands { shafts: vec![ShaftCommand {
            motor_torque_override_nm: Some(0.0), ..Default::default()
        }; 8], surfaces: vec![] };
        for _ in 0..(5.0/dt).round() as usize {
            plant.step_with_actuators(dt, &commands).unwrap();
            maximum = maximum.max(energy(plant.state()));
        }
        let final_energy = energy(plant.state());
        assert!(initial_energy > 0.0 && final_energy > 0.0);
        assert!(maximum/initial_energy <= 1.001);
        assert!(final_energy < initial_energy);
        (plant.state().clone(), maximum/initial_energy, final_energy/initial_energy)
    };
    let (coarse, coarse_maximum, coarse_final) = run(1.0/120.0);
    let (fine, fine_maximum, fine_final) = run(1.0/240.0);
    let position_difference = (coarse.position_ned[2]-fine.position_ned[2]).abs()/0.1;
    let velocity_difference = (coarse.body_velocity[2]-fine.body_velocity[2]).abs()/0.1;
    assert!(position_difference < 0.01 && velocity_difference < 0.01);
    eprintln!("fitted heave energy max {coarse_maximum:.12e}/{fine_maximum:.12e}, final {coarse_final:.12e}/{fine_final:.12e}, normalized dt differences {position_difference:.12e}/{velocity_difference:.12e}");
}
