use control_engine::sixdof::NoiseLevel;
use control_engine::sixdof::control_law::{HeadingControlMode, HeadingPidGains};
use control_engine::sixdof::session::{EnvironmentPreset, FleetSimulation, SessionConfiguration};

fn configuration() -> SessionConfiguration {
    SessionConfiguration {
        noise_level: NoiseLevel::N1,
        environment: EnvironmentPreset::W1,
        ..Default::default()
    }
}

fn run(frame_seconds: f64, frames: usize) -> FleetSimulation {
    let mut simulation = FleetSimulation::new(configuration()).unwrap();
    let mut input = simulation.input().clone();
    input.control_mode = HeadingControlMode::Pid;
    input.target_heading_deg = 10.0;
    input.pid = HeadingPidGains {
        kp: 1.0,
        ki: 0.01,
        kd: 2.0,
    };
    simulation.advance(0.0, Some(input)).unwrap();
    for _ in 0..frames {
        simulation.advance(frame_seconds, None).unwrap();
    }
    simulation
}

fn frame(simulation: &FleetSimulation) -> serde_json::Value {
    serde_json::from_str(&simulation.frame_json().unwrap()).unwrap()
}

#[test]
fn complete_control_packets_have_exact_twenty_hertz_time_and_render_independent_values() {
    let packets = |dt: f64, count: usize| {
        let mut simulation = FleetSimulation::new(configuration()).unwrap();
        let mut collected = Vec::new();
        for _ in 0..count {
            simulation.advance(dt, None).unwrap();
            collected.extend(frame(&simulation)["controlSamples"].as_array().unwrap().clone());
        }
        assert_eq!(collected.len(), 20);
        for (index, sample) in collected.iter().enumerate() {
            assert!((sample["timeS"].as_f64().unwrap()-index as f64*0.05).abs() < 1e-12);
            assert!(sample["truth"]["actuator_states"].is_object());
            let samples = sample["samples"].as_array().unwrap();
            if index >= 10 { assert!(samples.len() >= 12); }
            for reading in samples {
                assert!(reading["measurement"]["t_arrive_s"].as_f64().unwrap()
                    <= sample["timeS"].as_f64().unwrap()+1e-12);
            }
        }
        simulation.set_paused(true);
        simulation.advance(1.0, None).unwrap();
        assert!(frame(&simulation)["controlSamples"].as_array().unwrap().is_empty());
        let restored = FleetSimulation::from_snapshot_json(&simulation.snapshot_json().unwrap()).unwrap();
        assert!(frame(&restored)["controlSamples"].as_array().unwrap().is_empty());
        collected
    };
    assert_eq!(packets(1.0, 1), packets(1.0/60.0, 60));
}

#[test]
fn teaching_initial_speed_is_relative_to_current_and_roll_rotates_about_cg() {
    let config = SessionConfiguration { parameter_version: "research-nominal-v5".into(),
        initial_water_speed_mps: Some(4.0), initial_roll_deg: Some(2.0),
        environment: EnvironmentPreset::C1, ..Default::default() };
    let mut simulation = FleetSimulation::new(config).unwrap();
    let initial = frame(&simulation);
    assert!((initial["waterVelocityBody"][0].as_f64().unwrap()-4.0).abs() < 1e-12);
    assert!((initial["attitudeDeg"]["roll"].as_f64().unwrap()-2.0).abs() < 1e-12);
    assert!((initial["truth"]["body_velocity"][1].as_f64().unwrap()).abs() > 0.1);
    let snapshot = simulation.snapshot_json().unwrap();
    let mut restored = FleetSimulation::from_snapshot_json(&snapshot).unwrap();
    simulation.advance(0.5, None).unwrap();
    restored.advance(0.5, None).unwrap();
    assert_eq!(simulation.snapshot_json().unwrap(), restored.snapshot_json().unwrap());
    simulation.reset().unwrap();
    assert_eq!(snapshot, simulation.snapshot_json().unwrap());
}

#[test]
fn teaching_wave_pack_and_composed_wind_keep_their_declared_components_and_future() {
    use control_engine::sixdof::session::EnvironmentOverrides;
    let configuration = SessionConfiguration { parameter_version: "research-nominal-v6".into(),
        environment: EnvironmentPreset::E1,
        environment_overrides: Some(EnvironmentOverrides { wind_speed_mps: Some(12.0), gust_sigma_mps: Some(2.0),
            ..Default::default() }), ..Default::default() };
    let mut session = FleetSimulation::new(configuration).unwrap();
    let initial = session.snapshot_json().unwrap();
    session.advance(0.5, None).unwrap();
    let observed = frame(&session);
    assert_eq!(observed["waveModel"]["firstOrderEnabled"], true);
    assert_eq!(observed["waveModel"]["secondOrderEnabled"], false);
    assert_eq!(observed["waveModel"]["meanForwardSpeedMps"], 0.0);
    let components = &observed["dynamics"]["external_components"];
    for name in ["tau_wave_1", "tau_wind"] {
        assert!(components[name].as_array().unwrap().iter().any(|value| value.as_f64().unwrap().abs() > 1.0));
    }
    let checkpoint = session.snapshot_json().unwrap();
    let stored: serde_json::Value = serde_json::from_str(&checkpoint).unwrap();
    assert_eq!(stored["plant"]["environment"]["wave"]["condition"]["hs_m"], 0.75);
    assert_eq!(stored["plant"]["environment"]["current_ned"][1], 0.3);
    let mut restored = FleetSimulation::from_snapshot_json(&checkpoint).unwrap();
    session.advance(0.5, None).unwrap();
    restored.advance(0.5, None).unwrap();
    assert_eq!(session.snapshot_json().unwrap(), restored.snapshot_json().unwrap());
    session.reset().unwrap();
    assert_eq!(initial, session.snapshot_json().unwrap());
}

#[test]
fn physical_sensor_observer_and_twenty_hertz_clocks_ignore_render_partition() {
    let thirty = run(1.0 / 30.0, 120);
    let sixty = run(1.0 / 60.0, 240);
    let fast = run(8.0 / 60.0, 30);
    let reference = frame(&thirty);
    assert_eq!(reference["physicsTicks"], 480);
    assert_eq!(reference["controllerTicks"], 80);
    for other in [&sixty, &fast] {
        let actual = frame(other);
        for name in [
            "truth",
            "observer",
            "heldCommands",
            "physicsTicks",
            "controllerTicks",
        ] {
            assert_eq!(actual[name], reference[name], "固定时钟字段 {name}");
        }
    }
}

#[test]
fn opaque_snapshot_restores_random_queues_controller_and_physical_future() {
    let mut original = run(1.0 / 60.0, 247);
    let mut restored =
        FleetSimulation::from_snapshot_json(&original.snapshot_json().unwrap()).unwrap();
    for _ in 0..300 {
        original.advance(1.0 / 60.0, None).unwrap();
        restored.advance(1.0 / 60.0, None).unwrap();
    }
    assert_eq!(
        restored.snapshot_json().unwrap(),
        original.snapshot_json().unwrap()
    );
}

#[test]
fn pause_keeps_random_and_physical_clocks_and_reset_recreates_seed() {
    let mut simulation = run(1.0 / 60.0, 120);
    simulation.set_paused(true);
    let paused = simulation.snapshot_json().unwrap();
    for _ in 0..8 {
        simulation.advance(1.0, None).unwrap();
    }
    assert_eq!(simulation.snapshot_json().unwrap(), paused);
    simulation.reset().unwrap();
    let initial = FleetSimulation::new(configuration()).unwrap();
    assert_eq!(
        simulation.snapshot_json().unwrap(),
        initial.snapshot_json().unwrap()
    );
}

#[test]
fn feedback_noise_changes_real_commands_and_physical_trajectory() {
    let mut clean = FleetSimulation::new(SessionConfiguration {
        noise_level: NoiseLevel::N0,
        ..Default::default()
    })
    .unwrap();
    let mut noisy = FleetSimulation::new(SessionConfiguration {
        noise_level: NoiseLevel::N2,
        ..Default::default()
    })
    .unwrap();
    for simulation in [&mut clean, &mut noisy] {
        let mut input = simulation.input().clone();
        input.control_mode = HeadingControlMode::Pid;
        input.pid = HeadingPidGains {
            kp: 2.0,
            ki: 0.02,
            kd: 3.0,
        };
        input.target_heading_deg = 5.0;
        simulation.advance(0.0, Some(input)).unwrap();
        for _ in 0..600 {
            simulation.advance(1.0 / 60.0, None).unwrap();
        }
    }
    let first = frame(&clean);
    let second = frame(&noisy);
    let left = first["heldCommands"]["surfaces"][0]["angle_rad"]
        .as_f64()
        .unwrap();
    let right = second["heldCommands"]["surfaces"][0]["angle_rad"]
        .as_f64()
        .unwrap();
    assert!((left - right).abs() > 1e-5);
    assert_ne!(first["truth"]["quaternion"], second["truth"]["quaternion"]);
}

#[test]
fn malformed_command_or_restore_is_rejected_without_mutating_a_session() {
    let mut simulation = run(0.1, 4);
    let previous = simulation.snapshot_json().unwrap();
    let mut input = simulation.input().clone();
    input.actuators.shafts.pop();
    assert!(simulation.advance(0.1, Some(input)).is_err());
    assert_eq!(simulation.snapshot_json().unwrap(), previous);
    let mut saved: serde_json::Value = serde_json::from_str(&previous).unwrap();
    saved["parameter_hash"] = serde_json::json!("outdated");
    assert!(FleetSimulation::from_snapshot_json(&saved.to_string()).is_err());
    saved = serde_json::from_str(&previous).unwrap();
    saved["sensors"]["channels"][0]["channel"]["spec"]["rate_hz"] = serde_json::json!(0.0);
    assert!(FleetSimulation::from_snapshot_json(&saved.to_string()).is_err());
}

#[test]
fn unready_wave_coefficients_are_reported_at_the_normal_session_entry() {
    assert!(
        FleetSimulation::new(SessionConfiguration {
            environment: EnvironmentPreset::V1,
            ..Default::default()
        })
        .is_err()
    );
}

#[test]
fn failed_physical_frame_rolls_back_random_sensor_and_control_state() {
    let simulation = run(0.1, 4);
    let mut saved: serde_json::Value =
        serde_json::from_str(&simulation.snapshot_json().unwrap()).unwrap();
    saved["plant"]["state"]["body_velocity"][0] = serde_json::json!(300.0);
    saved["previous_truth"]["state"]["body_velocity"][0] = serde_json::json!(300.0);
    let mut extreme = FleetSimulation::from_snapshot_json(&saved.to_string()).unwrap();
    let previous = extreme.snapshot_json().unwrap();
    assert!(extreme.advance(0.5, None).is_err());
    assert_eq!(extreme.snapshot_json().unwrap(), previous);
}

#[test]
fn scheduled_faults_change_sensor_and_motor_states_at_physical_time() {
    let mut simulation = FleetSimulation::new(SessionConfiguration {
        noise_level: NoiseLevel::N0,
        heading_bias_fault: true,
        gnss_outage_fault: true,
        drive_cut_fault: true,
        ..Default::default()
    })
    .unwrap();
    for _ in 0..180 {
        simulation.advance(1.0, None).unwrap();
    }
    simulation.advance(0.5, None).unwrap();
    let result = frame(&simulation);
    let samples = result["samples"].as_array().unwrap();
    let heading = samples
        .iter()
        .rev()
        .find(|sample| sample["signal"] == "Heading")
        .unwrap();
    assert!((heading["measurement"]["value"].as_f64().unwrap() - 1.0).abs() < 0.02);
    for signal in ["North", "East"] {
        let sample = samples
            .iter()
            .rev()
            .find(|sample| sample["signal"] == signal)
            .unwrap();
        assert_eq!(sample["measurement"]["quality"], "Missing");
        assert!(sample["measurement"]["value"].is_null());
    }
    let actual = &result["truth"]["actuator_states"];
    assert!(actual["propeller_shaft_speed_rad_s"][0].as_f64().unwrap() > 0.0);
    assert!(
        actual["motor_torque_demand_nm"][0].as_f64().unwrap()
            < 0.5 * actual["motor_torque_demand_nm"][1].as_f64().unwrap()
    );
    let mut restored =
        FleetSimulation::from_snapshot_json(&simulation.snapshot_json().unwrap()).unwrap();
    for _ in 0..21 {
        restored.advance(1.0, None).unwrap();
    }
    let recovered = frame(&restored);
    for signal in ["North", "East"] {
        let sample = recovered["samples"]
            .as_array()
            .unwrap()
            .iter()
            .rev()
            .find(|sample| sample["signal"] == signal)
            .unwrap();
        assert_eq!(sample["measurement"]["quality"], "Good");
        assert!(sample["measurement"]["value"].is_number());
    }
}
