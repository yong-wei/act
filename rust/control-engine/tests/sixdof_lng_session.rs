use control_engine::sixdof::lng_speed_control::{SpeedOperatingModel, SpeedPiInput};
use control_engine::sixdof::model_pack::embedded_vessel_pack;
use control_engine::sixdof::session::{BerthConfiguration, FleetSimulation, SessionConfiguration};
use control_engine::sixdof::student_model::ModelStructure;
use control_engine::sixdof::NoiseLevel;

fn configuration() -> SessionConfiguration {
    SessionConfiguration {
        vessel: "lng-changheng".into(),
        parameter_version: "research-nominal-v1".into(),
        noise_level: NoiseLevel::N0,
        ..Default::default()
    }
}

fn speed_input(
    simulation: &FleetSimulation,
    delay: f64,
) -> control_engine::sixdof::session::SessionInput {
    let mut input = simulation.input().clone();
    let rpm = input.actuators.shafts[0].speed_reference_rad_s * 30.0 / std::f64::consts::PI;
    input.longitudinal = Some(SpeedPiInput {
        local_model: SpeedOperatingModel {
            structure: ModelStructure::Fopdt {
                k: 0.05,
                t_s: 100.0,
                delay_s: 2.0,
            },
            speed_mps: 4.0,
            shaft_reference_rpm: rpm,
        },
        reference_mps: 3.0,
        kp_multiplier: 1.0,
        ti_multiplier: 1.0,
        anti_windup: true,
        smith_enabled: true,
        filter_tau_s: 1.0,
        additional_command_delay_s: delay,
    });
    input
}

fn frame(simulation: &FleetSimulation) -> serde_json::Value {
    serde_json::from_str(&simulation.frame_json().unwrap()).unwrap()
}

#[test]
fn real_speed_log_closes_the_manual_heading_loop_without_replacing_shaft_or_body_states() {
    let mut simulation = FleetSimulation::new(configuration()).unwrap();
    let initial = frame(&simulation);
    let input = speed_input(&simulation, 0.0);
    simulation.advance(0.0, Some(input)).unwrap();
    for _ in 0..60 {
        simulation.advance(0.05, None).unwrap();
    }
    let actual = frame(&simulation);
    let control = &actual["longitudinalController"];
    assert_eq!(control["ticks"], 60);
    assert_eq!(actual["controllerTicks"], 60);
    assert!(control["feedbackAvailable"].as_bool().unwrap());
    let feedback = control["filteredMeasurementMps"].as_f64().unwrap();
    assert!((feedback - 4.0).abs() < 0.2);
    let command = actual["heldCommands"]["shafts"][0]["speed_reference_rad_s"]
        .as_f64()
        .unwrap();
    assert!(
        (command - control["appliedRpm"].as_f64().unwrap() * std::f64::consts::PI / 30.0).abs()
            < 1e-12
    );
    assert_eq!(
        actual["heldCommands"]["shafts"][0]["speed_reference_rad_s"],
        actual["heldCommands"]["shafts"][1]["speed_reference_rad_s"]
    );
    let shaft = actual["truth"]["actuator_states"]["propeller_shaft_speed_rad_s"][0]
        .as_f64()
        .unwrap();
    assert!((shaft - command).abs() > 0.01);
    let speed = actual["truth"]["body_velocity"][0].as_f64().unwrap();
    assert!(speed > 3.9 && speed != 3.0);
    assert_ne!(
        actual["truth"]["actuator_states"]["motor_torques_nm"],
        initial["truth"]["actuator_states"]["motor_torques_nm"]
    );
}

#[test]
fn noise_and_arrival_quality_change_the_pi_command_through_the_speed_log() {
    let mut clean = FleetSimulation::new(configuration()).unwrap();
    let mut noisy = FleetSimulation::new(SessionConfiguration {
        noise_level: NoiseLevel::N2,
        ..configuration()
    })
    .unwrap();
    for simulation in [&mut clean, &mut noisy] {
        let input = speed_input(simulation, 0.0);
        simulation.advance(0.05, Some(input)).unwrap();
    }
    assert_eq!(
        frame(&noisy)["longitudinalController"]["integralFrozen"],
        true
    );
    for _ in 0..80 {
        clean.advance(0.05, None).unwrap();
        noisy.advance(0.05, None).unwrap();
    }
    assert_ne!(
        frame(&clean)["heldCommands"]["shafts"],
        frame(&noisy)["heldCommands"]["shafts"]
    );
    assert_ne!(
        frame(&clean)["longitudinalController"]["filteredMeasurementMps"],
        frame(&noisy)["longitudinalController"]["filteredMeasurementMps"]
    );
}

#[test]
fn five_second_delay_preserves_the_physical_reference_until_the_delayed_request_arrives() {
    let mut simulation = FleetSimulation::new(configuration()).unwrap();
    let input = speed_input(&simulation, 5.0);
    let initial_rpm = input
        .longitudinal
        .as_ref()
        .unwrap()
        .local_model
        .shaft_reference_rpm;
    simulation.advance(0.0, Some(input)).unwrap();
    let mut first_changed_request_tick = None;
    let mut first_changed_applied_tick = None;
    for tick in 0..125 {
        simulation.advance(0.05, None).unwrap();
        let actual = frame(&simulation);
        let control = &actual["longitudinalController"];
        if (control["requestedRpm"].as_f64().unwrap() - initial_rpm).abs() > 0.1
            && first_changed_request_tick.is_none()
        {
            first_changed_request_tick = Some(tick);
        }
        if (control["appliedRpm"].as_f64().unwrap() - initial_rpm).abs() > 0.1
            && first_changed_applied_tick.is_none()
        {
            first_changed_applied_tick = Some(tick);
        }
    }
    assert_eq!(
        first_changed_applied_tick.unwrap() - first_changed_request_tick.unwrap(),
        100
    );
}

#[test]
fn delayed_control_snapshot_and_render_partition_preserve_the_complete_future() {
    let mut simulation = FleetSimulation::new(configuration()).unwrap();
    let input = speed_input(&simulation, 5.0);
    simulation.advance(0.6, Some(input)).unwrap();
    let saved = simulation.snapshot_json().unwrap();
    let mut restored = FleetSimulation::from_snapshot_json(&saved).unwrap();
    for _ in 0..40 {
        simulation.advance(0.1, None).unwrap();
        restored.advance(0.04, None).unwrap();
        restored.advance(0.06, None).unwrap();
    }
    let mut expected: serde_json::Value =
        serde_json::from_str(&simulation.snapshot_json().unwrap()).unwrap();
    let mut actual: serde_json::Value =
        serde_json::from_str(&restored.snapshot_json().unwrap()).unwrap();
    // 不同浮点加法分帧只允许帧余量的舍入不同。
    expected["accumulator_s"] = serde_json::json!(0.0);
    actual["accumulator_s"] = serde_json::json!(0.0);
    assert_eq!(actual, expected);
    let before = simulation.snapshot_json().unwrap();
    let mut invalid = simulation.input().clone();
    invalid.longitudinal.as_mut().unwrap().local_model.speed_mps = 3.9;
    assert!(simulation.advance(0.0, Some(invalid)).is_err());
    assert_eq!(before, simulation.snapshot_json().unwrap());
    let mut forged: serde_json::Value = serde_json::from_str(&saved).unwrap();
    forged["longitudinal_controller"]["commandDelayQueueRpm"][0] = serde_json::json!(1000.0);
    assert!(FleetSimulation::from_snapshot_json(&forged.to_string()).is_err());
}

#[test]
fn berth_origin_uses_the_rotated_source_hull_and_signed_bow_distance() {
    let config = SessionConfiguration {
        initial_heading_deg: 27.0,
        initial_position_ned: [900.0, 12.0, 0.0],
        berth: Some(BerthConfiguration {
            stop_line_north_m: 800.0,
            initial_bow_distance_m: 1500.0,
        }),
        ..configuration()
    };
    let mut simulation = FleetSimulation::new(config).unwrap();
    let actual = frame(&simulation);
    let pack = embedded_vessel_pack("lng-changheng", "research-nominal-v1").unwrap();
    let hull = pack.geometry.nonlinear_hydrostatics.unwrap();
    let yaw = 27.0_f64.to_radians();
    let pitch = pack.geometry.equilibrium_pitch_rad;
    let bow_offset = hull
        .vertices_body_m
        .iter()
        .map(|r| yaw.cos() * pitch.cos() * r[0] - yaw.sin() * r[1] + yaw.cos() * pitch.sin() * r[2])
        .reduce(f64::max)
        .unwrap();
    let north = actual["truth"]["position_ned"][0].as_f64().unwrap();
    assert!((north - (800.0 - 1500.0 - bow_offset)).abs() < 1e-10);
    assert!((actual["berth"]["bowClearanceM"].as_f64().unwrap() - 1500.0).abs() < 1e-10);
    assert_eq!(actual["truth"]["position_ned"][1], 12.0);
    simulation.advance(0.05, None).unwrap();
    let sampled = frame(&simulation);
    assert!((sampled["controlSamples"][0]["bowClearanceM"].as_f64().unwrap() - 1500.0).abs() < 1e-10);
}

#[test]
fn crossing_stops_on_the_physics_tick_and_remains_signed_across_pause_and_restore() {
    let mut simulation = FleetSimulation::new(SessionConfiguration {
        berth: Some(BerthConfiguration {
            stop_line_north_m: 0.0,
            initial_bow_distance_m: 0.05,
        }),
        ..configuration()
    })
    .unwrap();
    simulation.advance(1.0, None).unwrap();
    let actual = frame(&simulation);
    assert_eq!(actual["physicsTicks"], 2);
    assert_eq!(actual["paused"], true);
    assert_eq!(
        actual["berth"]["termination"]["reason"],
        "stop_line_crossed"
    );
    assert!(actual["berth"]["bowClearanceM"].as_f64().unwrap() < 0.0);
    let saved = simulation.snapshot_json().unwrap();
    simulation.set_paused(false);
    simulation.advance(1.0, None).unwrap();
    assert_eq!(saved, simulation.snapshot_json().unwrap());
    let mut restored = FleetSimulation::from_snapshot_json(&saved).unwrap();
    restored.advance(1.0, None).unwrap();
    assert_eq!(saved, restored.snapshot_json().unwrap());
    let mut forged: serde_json::Value = serde_json::from_str(&saved).unwrap();
    forged["berth_termination"]["bowClearanceM"] = serde_json::json!(0.0);
    assert!(FleetSimulation::from_snapshot_json(&forged.to_string()).is_err());
    simulation.reset().unwrap();
    assert_eq!(frame(&simulation)["paused"], false);
    assert!(frame(&simulation)["berth"]["termination"].is_null());
}

#[test]
fn berth_plan_changes_the_real_pi_reference_and_preserves_frozen_future() {
    use control_engine::sixdof::lng_berth_plan::{BerthSpeedPlan,SpeedPlanNode};
    let configuration = SessionConfiguration {
        berth: Some(BerthConfiguration {stop_line_north_m:0.0,initial_bow_distance_m:600.0}),
        ..configuration()
    };
    let mut early = FleetSimulation::new(configuration.clone()).unwrap();
    let mut late = FleetSimulation::new(configuration).unwrap();
    for (simulation,braking_distance_m) in [(&mut early,1500.0),(&mut late,300.0)] {
        let mut input = speed_input(simulation,0.0);
        input.longitudinal.as_mut().unwrap().reference_mps = 4.0;
        input.longitudinal.as_mut().unwrap().smith_enabled = false;
        input.berth_plan = Some(BerthSpeedPlan {braking_distance_m,heading_nodes:None,
            nodes:vec![SpeedPlanNode {distance_m:30.0,speed_mps:0.0}]});
        simulation.advance(0.0,Some(input)).unwrap();
        for _ in 0..60 {simulation.advance(0.05,None).unwrap();}
    }
    assert!(frame(&early)["longitudinalController"]["appliedRpm"].as_f64().unwrap()
        < frame(&late)["longitudinalController"]["appliedRpm"].as_f64().unwrap());
    assert_ne!(frame(&early)["truth"]["actuator_states"],frame(&late)["truth"]["actuator_states"]);
    let saved = early.snapshot_json().unwrap();
    let mut restored = FleetSimulation::from_snapshot_json(&saved).unwrap();
    for _ in 0..20 {
        early.advance(0.05,None).unwrap();
        restored.advance(0.05,None).unwrap();
    }
    assert_eq!(early.snapshot_json().unwrap(),restored.snapshot_json().unwrap());
    let before = early.snapshot_json().unwrap();
    let mut revision = early.input().clone();
    revision.berth_plan.as_mut().unwrap().braking_distance_m = 1400.0;
    assert!(early.advance(0.0,Some(revision)).is_err());
    assert_eq!(before,early.snapshot_json().unwrap());
    let mut detached:serde_json::Value = serde_json::from_str(&saved).unwrap();
    detached["configuration"].as_object_mut().unwrap().remove("berth");
    assert!(FleetSimulation::from_snapshot_json(&detached.to_string()).is_err());
}

#[test]
fn berth_plan_requires_a_berth_and_valid_ordered_nodes_before_any_mutation() {
    use control_engine::sixdof::lng_berth_plan::{BerthSpeedPlan,SpeedPlanNode};
    let mut simulation = FleetSimulation::new(configuration()).unwrap();
    let before = simulation.snapshot_json().unwrap();
    let mut input = speed_input(&simulation,0.0);
    input.berth_plan = Some(BerthSpeedPlan {braking_distance_m:1200.0,heading_nodes:None,
        nodes:vec![SpeedPlanNode {distance_m:30.0,speed_mps:0.0}]});
    assert!(simulation.advance(0.0,Some(input)).is_err());
    assert_eq!(before,simulation.snapshot_json().unwrap());
}

#[test]
fn timed_heading_liquid_peaks_and_navigation_window_follow_physics_and_restore() {
    use control_engine::sixdof::lng_berth_plan::{BerthSpeedPlan, HeadingPlanNode, SpeedPlanNode};
    let mut simulation = FleetSimulation::new(SessionConfiguration {
        berth: Some(BerthConfiguration { stop_line_north_m: 0.0, initial_bow_distance_m: 1500.0 }),
        course_evidence: Some(control_engine::sixdof::course_evidence::CourseEvidenceConfiguration { roll_warning_deg: 8.0 }),
        ..configuration()
    }).unwrap();
    let mut input = speed_input(&simulation, 0.0);
    input.control_mode = control_engine::sixdof::control_law::HeadingControlMode::Pd;
    input.berth_plan = Some(BerthSpeedPlan {
        braking_distance_m: 1200.0,
        nodes: vec![SpeedPlanNode { distance_m: 30.0, speed_mps: 0.0 }],
        heading_nodes: Some(vec![HeadingPlanNode { time_s: 0.0, heading_deg: -1.0 },
            HeadingPlanNode { time_s: 0.2, heading_deg: -1.0 },
            HeadingPlanNode { time_s: 0.4, heading_deg: 0.0 }]),
    });
    simulation.advance(0.3, Some(input)).unwrap();
    let observed = frame(&simulation);
    assert!((observed["headingReferenceDeg"].as_f64().unwrap() + 0.5).abs() < 1e-12);
    assert_eq!(observed["controlSamples"][0]["targetHeadingDeg"], -1.0);
    let metrics = &observed["fineStepMetrics"]["values"]["lng"];
    assert_eq!(metrics["physicsSamples"], 36);
    assert_eq!(metrics["lateralWindowDurationS"], 0.3);
    assert!(metrics["maximumCornerHeightM"].as_f64().unwrap() > 0.0);
    assert_eq!(observed["controlSamples"][0]["liquid"]["modeHeightsM"].as_array().unwrap().len(), 8);
    assert!(observed["controlSamples"][0]["longitudinal"]["referenceMps"].is_number());
    let liquid = &observed["liquidObservation"];
    let modes = liquid["modeHeightsM"].as_array().unwrap();
    for tank in 0..4 {
        let corner = modes[2 * tank].as_f64().unwrap().abs() + modes[2 * tank + 1].as_f64().unwrap().abs();
        assert_eq!(corner, liquid["cornerHeightsM"][tank].as_f64().unwrap());
        assert!(metrics["maximumCornerHeightM"].as_f64().unwrap() >= corner);
    }
    let saved = simulation.snapshot_json().unwrap();
    let mut restored = FleetSimulation::from_snapshot_json(&saved).unwrap();
    simulation.advance(0.3, None).unwrap();
    restored.advance(0.3, None).unwrap();
    assert_eq!(simulation.snapshot_json().unwrap(), restored.snapshot_json().unwrap());
    assert_eq!(frame(&simulation)["headingReferenceDeg"], 0.0);
    let before = simulation.snapshot_json().unwrap();
    let mut changed = simulation.input().clone();
    changed.berth_plan.as_mut().unwrap().heading_nodes.as_mut().unwrap()[0].heading_deg = 1.0;
    assert!(simulation.advance(0.0, Some(changed)).is_err());
    assert_eq!(before, simulation.snapshot_json().unwrap());
    let mut forged: serde_json::Value = serde_json::from_str(&saved).unwrap();
    forged["course_evidence"]["metrics"]["lng"]["physicsSamples"] = serde_json::json!(35);
    assert!(FleetSimulation::from_snapshot_json(&forged.to_string()).is_err());
    let mut forged: serde_json::Value = serde_json::from_str(&saved).unwrap();
    forged["course_evidence"]["metrics"]["lng"]["finalBowClearanceM"] = serde_json::json!(20.0);
    assert!(FleetSimulation::from_snapshot_json(&forged.to_string()).is_err());
}

#[test]
fn earlier_lng_initial_checkpoints_gain_empty_statistics_and_running_ones_keep_missing_history() {
    let mut simulation = FleetSimulation::new(SessionConfiguration {
        course_evidence: Some(control_engine::sixdof::course_evidence::CourseEvidenceConfiguration { roll_warning_deg: 8.0 }),
        ..configuration()
    }).unwrap();
    let initial = simulation.snapshot_json().unwrap();
    let without_lng = |snapshot: &str| {
        let mut saved: serde_json::Value = serde_json::from_str(snapshot).unwrap();
        saved["course_evidence"]["metrics"].as_object_mut().unwrap().remove("lng");
        saved["course_evidence"].as_object_mut().unwrap().remove("lngLateralWindow");
        saved.to_string()
    };
    let restored = FleetSimulation::from_snapshot_json(&without_lng(&initial)).unwrap();
    assert_eq!(restored.snapshot_json().unwrap(), initial);
    simulation.advance(0.3, None).unwrap();
    let old_running = without_lng(&simulation.snapshot_json().unwrap());
    let mut restored = FleetSimulation::from_snapshot_json(&old_running).unwrap();
    restored.advance(0.3, None).unwrap();
    assert!(frame(&restored)["fineStepMetrics"]["values"]["lng"].is_null());
    assert_eq!(frame(&restored)["physicsTicks"],72);
}
