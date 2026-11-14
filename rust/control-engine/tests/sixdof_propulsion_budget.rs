use control_engine::sixdof::actuator_system::{
    ActuatorCommands, ActuatorSystem, LocalWater, ShaftCommand,
};
use control_engine::sixdof::benchmark_b470::propeller_loads_b470;
use control_engine::sixdof::destroyer_plant::DestroyerSixDofPlant;
use control_engine::sixdof::model_pack::{PackActuators, embedded_vessel_pack};
use control_engine::sixdof::session::{FleetSimulation, SessionConfiguration};

fn system() -> ActuatorSystem {
    let pack = embedded_vessel_pack("semisub-981", "research-nominal-v5").unwrap();
    let PackActuators::Physical { system, .. } = pack.actuators else {
        panic!("物理设备")
    };
    system
}

fn state(system: &ActuatorSystem, omega: f64) -> Vec<f64> {
    let mut values = vec![0.0; system.state_len()];
    for (index, propulsor) in system.propulsors.iter().enumerate() {
        values[8 * index] = omega;
        values[8 * index + 1] = 2.0 * propulsor.rated_torque_nm();
        values[8 * index + 2] = omega;
    }
    values
}

fn commands(system: &ActuatorSystem, omega: f64) -> ActuatorCommands {
    ActuatorCommands {
        shafts: vec![
            ShaftCommand {
                speed_reference_rad_s: omega,
                ..Default::default()
            };
            system.propulsors.len()
        ],
        surfaces: vec![],
    }
}

fn water() -> LocalWater<'static> {
    LocalWater {
        time_s: 0.0,
        position_ned: [0.0; 3],
        quaternion: [1.0, 0.0, 0.0, 0.0],
        relative_velocity: [0.0; 6],
        environment: None,
    }
}

#[test]
fn total_positive_motor_power_is_shared_before_shaft_acceleration_and_work() {
    let system = system();
    let values = state(&system, 15.0);
    let mut rates = vec![0.0; values.len()];
    let output = system.derivatives(
        &values,
        &mut rates,
        &commands(&system, 15.0),
        &[0.0; 8],
        &water(),
    );
    let actual: f64 = output
        .motor_torques_nm
        .iter()
        .map(|torque| torque * 15.0)
        .sum();
    assert!((actual - 32e6).abs() < 1e-6);
    let decoded = system.decode_state(&values);
    assert_eq!(output.motor_torques_nm, decoded.motor_torques_nm);
    for index in 0..8 {
        let offset = 8 * index;
        let power_balance = rates[offset + 5] - rates[offset + 6] - rates[offset + 7];
        let kinetic_rate =
            system.propulsors[index].shaft_inertia_kg_m2 * values[offset] * rates[offset];
        assert!((power_balance - kinetic_rate).abs() < 1e-8);
        assert_eq!(rates[offset + 4], output.motor_torques_nm[index] * 15.0);
    }
    system.validate_state(&decoded).unwrap();
    let mut corrupted = decoded;
    corrupted.motor_torques_nm.fill(5e6);
    assert!(system.validate_state(&corrupted).is_err());
}

#[test]
fn negative_mechanical_power_does_not_expand_the_positive_power_budget() {
    let mut system = system();
    system.max_positive_motor_power_w = Some(16e6);
    let mut values = state(&system, 15.0);
    values[1] *= -1.0;
    let decoded = system.decode_state(&values);
    let positive: f64 = decoded
        .motor_torques_nm
        .iter()
        .map(|torque| (torque * 15.0).max(0.0))
        .sum();
    assert!((positive - 16e6).abs() < 1e-6);
    assert_eq!(
        decoded.motor_torques_nm[0],
        system.propulsors[0].limited_motor_torque_nm(values[1], 15.0)
    );
    assert!(decoded.motor_torques_nm[0] < 0.0);
}

#[test]
fn the_additional_thrust_limit_preserves_actual_sub_limit_and_reverse_propeller_loads() {
    let system = system();
    for omega in [-18.0, -2.0, 0.0, 2.0, 18.0] {
        let mut values = state(&system, omega);
        for index in 1..8 {
            values[index * 8] = 0.0;
        }
        let mut rates = vec![0.0; values.len()];
        let output = system.derivatives(
            &values,
            &mut rates,
            &commands(&system, omega),
            &[0.0; 8],
            &water(),
        );
        let raw = propeller_loads_b470(4.5, 0.0, omega / (2.0 * std::f64::consts::PI), 1025.0).0;
        let expected = raw.clamp(-800e3, 800e3);
        assert_eq!(output.loads[0], expected);
        assert_eq!(output.loads[1], 0.0);
        assert_eq!(output.loads[5], 30.0 * expected);
        if omega.abs() == 2.0 {
            assert_eq!(expected, raw);
        }
        if omega == 18.0 {
            assert!(raw > 800e3);
        }
        assert!(rates.iter().all(|value| value.is_finite()));
    }
}

#[test]
fn zero_shaft_speed_and_invalid_hardware_limits_have_explicit_semantics() {
    let mut system = system();
    let values = state(&system, 0.0);
    let mut rates = vec![0.0; values.len()];
    let output = system.derivatives(
        &values,
        &mut rates,
        &commands(&system, 0.0),
        &[0.0; 8],
        &water(),
    );
    assert!(
        output
            .motor_torques_nm
            .iter()
            .all(|value| value.is_finite())
    );
    assert!(rates.iter().all(|value| value.is_finite()));
    assert_eq!((0..8).map(|index| rates[index * 8 + 4]).sum::<f64>(), 0.0);
    system.max_positive_motor_power_w = Some(0.0);
    assert!(system.validate().is_err());
    system.max_positive_motor_power_w = Some(32e6);
    system.propulsors[2].max_thrust_n = Some(-1.0);
    assert!(system.validate().is_err());
}

#[test]
fn integrated_shaft_energy_uses_the_same_budget_limited_motor_work() {
    let pack = embedded_vessel_pack("semisub-981", "research-nominal-v5").unwrap();
    let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
    let system = plant.actuator_system().unwrap().clone();
    let mut initial = plant.state().clone();
    initial.actuator_states = system.decode_state(&state(&system, 15.0));
    let initial_kinetic: f64 = system
        .propulsors
        .iter()
        .zip(&initial.actuator_states.propeller_shaft_speed_rad_s)
        .map(|(propulsor, omega)| 0.5 * propulsor.shaft_inertia_kg_m2 * omega * omega)
        .sum();
    plant.restore_state(initial);
    let input = commands(&system, 18.0);
    for _ in 0..360 {
        plant.step_with_actuators(1.0 / 120.0, &input).unwrap();
        let state = &plant.state().actuator_states;
        let positive: f64 = state
            .motor_torques_nm
            .iter()
            .zip(&state.propeller_shaft_speed_rad_s)
            .map(|(torque, omega)| (torque * omega).max(0.0))
            .sum();
        assert!(positive <= 32e6 * (1.0 + 1e-10));
    }
    let final_state = &plant.state().actuator_states;
    let kinetic: f64 = system
        .propulsors
        .iter()
        .zip(&final_state.propeller_shaft_speed_rad_s)
        .map(|(propulsor, omega)| 0.5 * propulsor.shaft_inertia_kg_m2 * omega * omega)
        .sum();
    let work: f64 = (0..8)
        .map(|index| {
            final_state.motor_work_j[index]
                - final_state.propeller_work_j[index]
                - final_state.shaft_friction_work_j[index]
        })
        .sum();
    assert!((work - (kinetic - initial_kinetic)).abs() < 1e-5 * initial_kinetic);
}

#[test]
fn session_budget_selection_is_frozen_in_identity_and_restored_with_the_complete_future() {
    let mut hashes = Vec::new();
    for budget in [8e6, 16e6, 32e6] {
        let configuration = SessionConfiguration {
            vessel: "semisub-981".into(),
            parameter_version: "research-nominal-v5".into(),
            propulsion_power_budget_w: Some(budget),
            ..Default::default()
        };
        let mut simulation = FleetSimulation::new(configuration).unwrap();
        let mut input = simulation.input().clone();
        for shaft in &mut input.actuators.shafts {
            shaft.speed_reference_rad_s = 18.0;
        }
        simulation.advance(1.0, Some(input)).unwrap();
        let snapshot = simulation.snapshot_json().unwrap();
        let mut restored = FleetSimulation::from_snapshot_json(&snapshot).unwrap();
        simulation.advance(0.2, None).unwrap();
        restored.advance(0.2, None).unwrap();
        assert_eq!(
            simulation.snapshot_json().unwrap(),
            restored.snapshot_json().unwrap()
        );
        let frame: serde_json::Value =
            serde_json::from_str(&simulation.frame_json().unwrap()).unwrap();
        assert_eq!(frame["propulsionPower"]["budgetW"], budget);
        assert!(
            frame["propulsionPower"]["positiveMechanicalPowerW"]
                .as_f64()
                .unwrap()
                <= budget
        );
        hashes.push(frame["parameterHash"].as_str().unwrap().to_owned());
    }
    hashes.sort();
    hashes.dedup();
    assert_eq!(hashes.len(), 3);
    for budget in [0.0, -1.0, 32e6 + 1.0] {
        assert!(
            FleetSimulation::new(SessionConfiguration {
                vessel: "semisub-981".into(),
                parameter_version: "research-nominal-v5".into(),
                propulsion_power_budget_w: Some(budget),
                ..Default::default()
            })
            .is_err()
        );
    }
    assert!(
        FleetSimulation::new(SessionConfiguration {
            propulsion_power_budget_w: Some(8e6),
            ..Default::default()
        })
        .is_err()
    );
}
