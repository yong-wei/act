use control_engine::sixdof::NoiseLevel;
use control_engine::sixdof::actuator_system::{ActuatorCommands, ActuatorSystem, ShaftCommand};
use control_engine::sixdof::control_law::HeadingControlMode;
use control_engine::sixdof::model_pack::{PackActuators, embedded_vessel_pack};
use control_engine::sixdof::semisub_allocator::{AllocationMode, allocate, jet_is_allowed};
use control_engine::sixdof::semisub_dp::{DpFeedback, NavigationLossStrategy, SemisubDpInput};
use control_engine::sixdof::session::{EnvironmentPreset, FleetSimulation, SessionConfiguration};

fn hardware() -> ActuatorSystem {
    let pack = embedded_vessel_pack("semisub-981", "research-nominal-v5").unwrap();
    let PackActuators::Physical { system, .. } = pack.actuators else {
        panic!("实际推进器参数");
    };
    system
}

fn input() -> SemisubDpInput {
    SemisubDpInput {
        target_position_m: [5.0, 3.0],
        target_heading_deg: 5.0,
        bandwidth_rad_s: 0.025,
        integral_enabled: true,
        integral_time_s: 200.0,
        feedback: DpFeedback::LowFrequency,
        low_frequency_cutoff_hz: 0.04,
        decoupling: false,
        student_model: None,
        wind_feedforward: false,
        allocation: AllocationMode::SequentialConvex,
        axis_weights: [1.0; 3],
        energy_weight: 1.0,
        reallocate: true,
        navigation_loss_strategy: NavigationLossStrategy::FreezeIntegral,
    }
}

fn simulation(
    environment: EnvironmentPreset,
    drive_cut: bool,
    gnss_outage: bool,
) -> FleetSimulation {
    let mut simulation = FleetSimulation::new(SessionConfiguration {
        vessel: "semisub-981".into(),
        parameter_version: "research-nominal-v5".into(),
        noise_level: NoiseLevel::N0,
        environment,
        drive_cut_fault: drive_cut,
        gnss_outage_fault: gnss_outage,
        course_evidence: Some(
            control_engine::sixdof::course_evidence::CourseEvidenceConfiguration {
                roll_warning_deg: 6.0,
            },
        ),
        ..Default::default()
    })
    .unwrap();
    let mut command = simulation.input().clone();
    command.control_mode = HeadingControlMode::Pid;
    command.semisub_dp = Some(input());
    simulation.advance(0.0, Some(command)).unwrap();
    simulation
}

fn advance(simulation: &mut FleetSimulation, seconds: usize) {
    for _ in 0..seconds * 10 {
        simulation.advance(0.1, None).unwrap();
    }
}

fn frame(simulation: &FleetSimulation) -> serde_json::Value {
    serde_json::from_str(&simulation.frame_json().unwrap()).unwrap()
}

#[test]
fn allocation_keeps_real_reach_jet_power_and_failed_thruster_constraints() {
    let mut system = hardware();
    system.max_positive_motor_power_w = Some(8e6);
    let commands = ActuatorCommands {
        shafts: vec![ShaftCommand::default(); 8],
        surfaces: vec![],
    };
    for target in [[1e6, 2e6, 30e6], [-2e6, -1e6, -80e6], [40e6, 40e6, 2e9]] {
        let result = allocate(
            &system,
            target,
            AllocationMode::SequentialConvex,
            [1.0; 3],
            1.0,
            [0.0; 8],
            [0.0; 8],
            [0.0; 3],
            [[0.0; 2]; 8],
            Some(1),
            true,
            commands.clone(),
        );
        assert!(result.feasible && result.iterations <= 5);
        assert!(result.predicted_power_w <= 8e6 + 1.0);
        assert_eq!(result.forces_body_n[1], [0.0; 2]);
        assert!(result.normalized_residual.is_finite());
        for (index, force) in result.forces_body_n.iter().enumerate() {
            assert!(force[0].hypot(force[1]) <= 800_000.0 + 1e-5);
            if force[0].hypot(force[1]) > 1e-6 {
                assert!(jet_is_allowed(&system, index, force[1].atan2(force[0])));
            }
            assert!(
                result.commands.shafts[index].speed_reference_rad_s.abs()
                    <= system.propulsors[index].rated_speed_rad_s
            );
        }
    }
}

#[test]
fn allocation_small_load_has_a_nonzero_feasible_solution() {
    let system = hardware();
    let commands = ActuatorCommands {
        shafts: vec![ShaftCommand::default(); 8],
        surfaces: vec![],
    };
    for thrust in [-10_000.0, 10_000.0] {
        let (speed, power, actual) = control_engine::sixdof::semisub_allocator::shaft_reference(
            &system,
            0,
            thrust,
            0.9,
            [0.001, 0.001, 0.0],
        );
        assert!(speed.signum() == thrust.signum() && power > 0.0);
        assert!((thrust - actual).abs() < 1.0);
    }
    let result = allocate(
        &system,
        [14_130.0, 12_241.0, 509_909.0],
        AllocationMode::SequentialConvex,
        [1.0; 3],
        1.0,
        [
            0.97355, 0.33629, 0.97355, 0.33629, 0.33629, 0.97355, 0.97355, 0.97355,
        ],
        [0.0; 8],
        [0.001, 0.001, 0.0],
        [[0.0; 2]; 8],
        None,
        true,
        commands,
    );
    assert!(result.predicted_power_w > 1.0);
}

#[test]
fn ten_hz_control_and_observer_restore_the_identical_future() {
    let mut simulation = simulation(EnvironmentPreset::P0, false, false);
    advance(&mut simulation, 4);
    let current = frame(&simulation);
    assert_eq!(current["controllerTicks"], 80);
    assert_eq!(current["dpController"]["ticks"], 40);
    assert!(current["dpController"]["kp"][0].as_f64().unwrap() > 0.0);
    let saved = simulation.snapshot_json().unwrap();
    let mut restored = FleetSimulation::from_snapshot_json(&saved).unwrap();
    advance(&mut simulation, 3);
    advance(&mut restored, 3);
    assert_eq!(
        simulation.snapshot_json().unwrap(),
        restored.snapshot_json().unwrap()
    );
    let mut bad: serde_json::Value = serde_json::from_str(&saved).unwrap();
    bad["dp_controller"]["ticks"] = serde_json::json!(39);
    assert!(FleetSimulation::from_snapshot_json(&bad.to_string()).is_err());
}

#[test]
fn position_reference_moves_the_coupled_six_dof_body_and_settles() {
    for feedback in [DpFeedback::Raw, DpFeedback::LowFrequency] {
        let mut simulation = simulation(EnvironmentPreset::P0, false, false);
        let mut command = simulation.input().clone();
        command.semisub_dp.as_mut().unwrap().feedback = feedback;
        simulation.advance(0.0, Some(command)).unwrap();
        advance(&mut simulation, 420);
        let mut position_squared = 0.0;
        let mut heading_squared = 0.0;
        for _ in 0..180 {
            advance(&mut simulation, 1);
            let current = frame(&simulation);
            let position = &current["truth"]["position_ned"];
            let heading = current["attitudeDeg"]["heading"].as_f64().unwrap();
            position_squared += (position[0].as_f64().unwrap() - 5.0).powi(2)
                + (position[1].as_f64().unwrap() - 3.0).powi(2);
            heading_squared += (heading - 5.0).powi(2);
        }
        let position_rms = (position_squared / 180.0).sqrt();
        let heading_rms = (heading_squared / 180.0).sqrt();
        println!("P0 {feedback:?} final180 positionRms={position_rms} headingRms={heading_rms}");
        assert!(position_rms < 1.5);
        assert!(heading_rms < 2.0);
        let current = frame(&simulation);
        assert_eq!(current["dpController"]["ticks"], 6000);
        assert!(
            current["truth"]["radiation_states"]
                .as_array()
                .unwrap()
                .len()
                > 6
        );
    }
}

#[test]
fn gnss_loss_freezes_integral_and_t2_fault_cuts_the_actual_second_drive() {
    let mut simulation = simulation(EnvironmentPreset::C1, true, true);
    advance(&mut simulation, 190);
    let current = frame(&simulation);
    assert_eq!(current["dpController"]["navigationGood"], false);
    assert_eq!(current["dpController"]["integralFrozen"], true);
    assert_eq!(
        current["dpController"]["allocation"]["forcesBodyN"][1],
        serde_json::json!([0.0, 0.0])
    );
    let torque = current["truth"]["actuator_states"]["motor_torques_nm"][1]
        .as_f64()
        .unwrap();
    assert!(torque.abs() < 1.0, "T2实际电机扭矩应衰减至零 {torque}");
    advance(&mut simulation, 15);
    let recovered = frame(&simulation);
    assert_eq!(recovered["dpController"]["navigationGood"], true);
    assert_eq!(recovered["dpController"]["integralFrozen"], false);
}

#[test]
fn independent_identification_runs_exclude_nonphysical_reset_transitions() {
    let a = [0.97, 0.01, 0.0, 0.0, 0.95, 0.02, 0.01, 0.0, 0.98];
    let b = [0.1, 0.02, 0.0, 0.01, 0.2, 0.02, 0.0, 0.03, 0.15];
    let mut inputs = Vec::new();
    let mut outputs = Vec::new();
    let mut starts = Vec::new();
    for run in 0..3 {
        starts.push(inputs.len());
        let mut state = [100.0 * run as f64, -50.0 * run as f64, 10.0 * run as f64];
        for tick in 0..300 {
            let time = (tick + run * 31) as f64;
            let input = [
                (time * 0.17).sin(),
                (time * 0.31).cos(),
                (time * 0.23).sin(),
            ];
            inputs.push(input);
            outputs.push(state);
            state = std::array::from_fn(|row| {
                (0..3)
                    .map(|column| {
                        a[row * 3 + column] * state[column] + b[row * 3 + column] * input[column]
                    })
                    .sum()
            });
        }
    }
    let channel =
        |values: &Vec<[f64; 3]>, axis| values.iter().map(|value| value[axis]).collect::<Vec<_>>();
    let result = control_engine::sixdof::student_model::identify_dp_low_freq_segments(
        &channel(&inputs, 0),
        &channel(&inputs, 1),
        &channel(&inputs, 2),
        &channel(&outputs, 0),
        &channel(&outputs, 1),
        &channel(&outputs, 2),
        0.1,
        &starts,
    );
    let Some(control_engine::sixdof::ModelStructure::DpLowFreq3 {
        a: actual_a,
        b: actual_b,
    }) = result.structure
    else {
        panic!("{result:?}");
    };
    for (actual, expected) in actual_a.iter().chain(&actual_b).zip(a.iter().chain(&b)) {
        assert!((actual - expected).abs() < 1e-7);
    }
}
