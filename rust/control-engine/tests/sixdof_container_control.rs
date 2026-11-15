use control_engine::sixdof::container_speed_control::{
    schedule_weights, ContainerSpeedController, ContainerSpeedInput, ScheduledSpeedModel,
    SpeedFeedback,
};
use control_engine::sixdof::container_voyage::{
    ContainerVoyageConfiguration, ContainerVoyageProgress, VoyageTerminationReason,
};
use control_engine::sixdof::lng_speed_control::SpeedOperatingModel;
use control_engine::sixdof::session::{FleetSimulation, SessionConfiguration};
use control_engine::sixdof::student_model::ModelStructure;
use control_engine::sixdof::NoiseLevel;

fn input() -> ContainerSpeedInput {
    // 控制接口测试夹具，课程辨识参数由实际运行工件提供。
    let models = [
        (0.2, 0.04, 120.0, 40.0),
        (0.6, 0.05, 160.0, 55.0),
        (0.9, 0.06, 200.0, 65.0),
    ]
    .map(
        |(loading_ratio, k, t_s, shaft_reference_rpm)| ScheduledSpeedModel {
            loading_ratio,
            operating_model: SpeedOperatingModel {
                structure: ModelStructure::Fopdt {
                    k,
                    t_s,
                    delay_s: 2.0,
                },
                speed_mps: 8.0,
                shaft_reference_rpm,
            },
        },
    );
    ContainerSpeedInput {
        models,
        reference_mps: 8.0,
        fixed_model_index: 1,
        scheduling_enabled: false,
        bumpless: true,
        kp_multiplier: 1.0,
        ti_multiplier: 1.0,
        anti_windup: true,
        filter_tau_s: 0.2,
        feedback: SpeedFeedback::Water,
        los_lookahead_m: Some(400.0),
    }
}

#[test]
fn collinear_loading_schedule_uses_adjacent_models_and_honors_the_middle_node() {
    let input = input();
    let (weights, outside) = schedule_weights(&input.models, 0.35, 8.0);
    assert!(!outside);
    for (actual, expected) in weights.into_iter().zip([0.625, 0.375, 0.0]) {
        assert!((actual - expected).abs() < 1e-12);
    }
    let (weights, outside) = schedule_weights(&input.models, 0.6, 8.0);
    assert!(!outside);
    assert_eq!(weights, [0.0, 1.0, 0.0]);
    let (weights, outside) = schedule_weights(&input.models, 0.8, 8.0);
    assert!(!outside);
    assert!(weights[0].abs() < 1e-12);
    assert!((weights[1] - 1.0 / 3.0).abs() < 1e-12);
    assert!((weights[2] - 2.0 / 3.0).abs() < 1e-12);
}

#[test]
fn two_dimensional_schedule_interpolates_inside_and_reports_boundary_projection() {
    let mut input = input();
    for (model, (loading, speed)) in
        input
            .models
            .iter_mut()
            .zip([(0.2, 6.0), (0.9, 6.0), (0.2, 12.0)])
    {
        model.loading_ratio = loading;
        model.operating_model.speed_mps = speed;
    }
    let (weights, outside) = schedule_weights(&input.models, 0.375, 7.5);
    assert!(!outside);
    for (actual, expected) in weights.into_iter().zip([0.5, 0.25, 0.25]) {
        assert!((actual - expected).abs() < 1e-12);
    }
    let (weights, outside) = schedule_weights(&input.models, 0.9, 12.0);
    assert!(outside);
    for (actual, expected) in weights.into_iter().zip([0.0, 0.5, 0.5]) {
        assert!((actual - expected).abs() < 1e-12);
    }
}

#[test]
fn speed_reference_slew_bumpless_gains_and_direct_switch_have_distinct_outputs() {
    let mut input = input();
    let mut controller = ContainerSpeedController::new(&input, 0.35, 55.0, 90.0).unwrap();
    input.reference_mps = 10.0;
    for tick in 1..=20 {
        controller
            .step(&input, 10.0, Some(8.0), Some(9.0), 90.0)
            .unwrap();
        assert!(
            (controller.diagnostics().slewed_reference_mps - (8.0 + 0.0025 * tick as f64)).abs()
                < 1e-12
        );
    }
    let mut unchanged = controller.clone();
    let mut direct = controller.clone();
    let expected = unchanged
        .step(&input, 10.0, Some(8.0), Some(9.0), 90.0)
        .unwrap();
    input.scheduling_enabled = true;
    input.kp_multiplier = 2.0;
    let tracked = controller
        .step(&input, 10.0, Some(8.0), Some(9.0), 90.0)
        .unwrap();
    assert!((tracked - expected).abs() < 1e-10);
    input.bumpless = false;
    let switched = direct
        .step(&input, 10.0, Some(8.0), Some(9.0), 90.0)
        .unwrap();
    assert!((switched - tracked).abs() > 0.1);
}

#[test]
fn water_and_ground_feedback_differ_and_missing_measurements_freeze_integral() {
    let mut water_input = input();
    water_input.bumpless = false;
    let mut ground_input = water_input.clone();
    ground_input.feedback = SpeedFeedback::Ground;
    let mut water = ContainerSpeedController::new(&water_input, 0.6, 55.0, 90.0).unwrap();
    let mut ground = ContainerSpeedController::new(&ground_input, 0.6, 55.0, 90.0).unwrap();
    water
        .step(&water_input, 8.0, Some(8.0), Some(9.0), 90.0)
        .unwrap();
    ground
        .step(&ground_input, 8.0, Some(8.0), Some(9.0), 90.0)
        .unwrap();
    assert_eq!(water.diagnostics().error_mps, 0.0);
    assert_eq!(ground.diagnostics().error_mps, -1.0);
    assert!(water.diagnostics().command_rpm > ground.diagnostics().command_rpm);
    let integral = ground.diagnostics().integral_rpm;
    let command = ground.diagnostics().command_rpm;
    ground
        .step(&ground_input, 8.0, Some(8.0), None, 90.0)
        .unwrap();
    assert_eq!(ground.diagnostics().integral_rpm, integral);
    assert_eq!(ground.diagnostics().command_rpm, command);
    assert!(ground.diagnostics().integral_frozen);
}

#[test]
fn frozen_model_bank_and_invalid_schedule_inputs_are_rejected_without_mutation() {
    let input = input();
    let mut controller = ContainerSpeedController::new(&input, 0.6, 55.0, 90.0).unwrap();
    let saved = serde_json::to_string(&controller).unwrap();
    let mut changed = input.clone();
    changed.models[0].operating_model.shaft_reference_rpm += 1.0;
    assert!(controller
        .step(&changed, 8.0, Some(8.0), None, 90.0)
        .is_err());
    assert_eq!(serde_json::to_string(&controller).unwrap(), saved);
    let mut invalid = input.clone();
    invalid.models[2] = invalid.models[0].clone();
    assert!(invalid.validate(90.0).is_err());
    invalid = input.clone();
    invalid.filter_tau_s = 0.0;
    assert!(invalid.validate(90.0).is_err());
    invalid = input;
    invalid.los_lookahead_m = Some(1000.0);
    assert!(invalid.validate(90.0).is_err());
}

#[test]
fn voyage_uses_actual_segment_position_and_rejects_unfair_or_incomplete_fuel_comparisons() {
    let plan = ContainerVoyageConfiguration {
        segment_speeds_mps: [8.0, 9.0, 10.0, 8.0],
    };
    plan.validate().unwrap();
    for (distance, expected) in [
        (0.0, 8.0),
        (1499.9, 8.0),
        (1500.0, 9.0),
        (3000.0, 10.0),
        (4500.0, 8.0),
        (6000.0, 8.0),
    ] {
        assert_eq!(plan.reference_at(distance), expected);
    }
    let mut voyage = ContainerVoyageProgress::default();
    assert!(!voyage
        .update(700.0, [5600.0, 0.0, 0.0], 8.0, 0.0, 0.0)
        .unwrap());
    assert!(!voyage.eligible_for_fuel_comparison());
    assert!(voyage
        .update(750.0, [6000.0, 0.0, 0.0], 8.0, 0.0, 0.0)
        .unwrap());
    assert!(voyage.eligible_for_fuel_comparison());
    voyage
        .validate_checkpoint(750.0, [6000.0, 0.0, 0.0], true)
        .unwrap();
    for (time, distance, speed, cross_track, heading) in [
        (901.0, 6000.0, 8.0, 0.0, 0.0),
        (750.0, 6000.0, 9.0, 0.0, 0.0),
        (750.0, 6000.0, 8.0, 51.0, 0.0),
        (750.0, 6000.0, 8.0, 0.0, 3.0_f64.to_radians()),
        (1200.0, 5900.0, 8.0, 0.0, 0.0),
    ] {
        let mut failed = ContainerVoyageProgress::default();
        assert!(failed
            .update(time, [distance, cross_track, 0.0], speed, heading, 0.0)
            .unwrap());
        assert!(!failed.eligible_for_fuel_comparison());
        assert_eq!(
            failed.termination.unwrap().reason,
            if distance >= 6000.0 {
                VoyageTerminationReason::Arrived
            } else {
                VoyageTerminationReason::TimeLimit
            }
        );
    }
}

#[test]
fn native_container_session_restores_schedule_and_actual_voyage_progress() {
    let configuration = SessionConfiguration {
        vessel: "container-msc".into(),
        parameter_version: "research-nominal-v2".into(),
        loading_ratio: Some(0.35),
        noise_level: NoiseLevel::N0,
        container_voyage: Some(ContainerVoyageConfiguration {
            segment_speeds_mps: [8.0; 4],
        }),
        ..Default::default()
    };
    let mut simulation = FleetSimulation::new(configuration).unwrap();
    let initial = simulation.snapshot_json().unwrap();
    assert!(simulation.advance(0.1, None).is_err());
    assert_eq!(simulation.snapshot_json().unwrap(), initial);
    let mut command = simulation.input().clone();
    command.container_speed = Some(input());
    simulation.advance(1.0, Some(command)).unwrap();
    let snapshot = simulation.snapshot_json().unwrap();
    let mut restored = FleetSimulation::from_snapshot_json(&snapshot).unwrap();
    simulation.advance(0.2, None).unwrap();
    restored.advance(0.2, None).unwrap();
    assert_eq!(
        simulation.snapshot_json().unwrap(),
        restored.snapshot_json().unwrap()
    );
    let frame: serde_json::Value = serde_json::from_str(&simulation.frame_json().unwrap()).unwrap();
    assert_eq!(frame["containerController"]["ticks"], 24);
    assert_eq!(frame["containerSpeedFeedback"], "water_speed_log");
    assert!(
        frame["containerVoyage"]["progress"]["northM"]
            .as_f64()
            .unwrap()
            > 8.0
    );
    assert!(frame["teachingFuel"]["state"]["fuel_kg"].as_f64().unwrap() > 0.0);
    let mut invalid: serde_json::Value = serde_json::from_str(&snapshot).unwrap();
    invalid["voyage_progress"]["lastTimeS"] = serde_json::json!(0.0);
    assert!(FleetSimulation::from_snapshot_json(&invalid.to_string()).is_err());
    simulation.set_paused(true);
    let paused = simulation.snapshot_json().unwrap();
    simulation.advance(1.0, None).unwrap();
    assert_eq!(simulation.snapshot_json().unwrap(), paused);
    simulation.reset().unwrap();
    assert_eq!(simulation.snapshot_json().unwrap(), initial);
}
