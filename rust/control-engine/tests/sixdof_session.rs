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
