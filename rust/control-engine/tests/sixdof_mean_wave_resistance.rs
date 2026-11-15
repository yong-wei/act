use control_engine::sixdof::mean_wave_resistance::{ContainerMeanWaveResistance, MeanWaveResistanceModel};
use control_engine::sixdof::session::{EnvironmentPreset, FleetSimulation, SessionConfiguration};
use control_engine::sixdof::{WaveCondition, WaveField};

fn regular(height_m: f64, direction_deg: f64) -> ContainerMeanWaveResistance {
    let wave = WaveField::regular(17, WaveCondition {
        hs_m: 0.0, tp_s: 7.0, direction_to_deg: direction_deg, water_depth_m: 200.0,
    }, height_m).unwrap();
    ContainerMeanWaveResistance::from_wave(&wave, 17.037810003601365, 383.0).unwrap()
}

fn configuration(enabled: bool) -> SessionConfiguration {
    SessionConfiguration {
        vessel: "container-msc".into(), parameter_version: "research-nominal-v3".into(),
        loading_ratio: Some(0.6), environment: EnvironmentPreset::V2,
        mean_wave_resistance_model: enabled.then_some(MeanWaveResistanceModel::ContainerReflectionTeachingV1),
        ..Default::default()
    }
}

fn frame(simulation: &FleetSimulation) -> serde_json::Value {
    serde_json::from_str(&simulation.frame_json().unwrap()).unwrap()
}

#[test]
fn regular_wave_matches_reference_scale_square_height_and_directional_anchors() {
    let head = regular(1.0, 180.0).resistance_n(0.0);
    let expected = 1025.0 * 9.81 * 2.0 * 61.5 * (61.5_f64 / 96.18590600484558).sqrt() / 16.0;
    assert!((head / expected - 1.0).abs() < 1e-12);
    assert!((regular(2.0, 180.0).resistance_n(0.0) / head - 4.0).abs() < 1e-12);
    assert!((regular(1.0, 90.0).resistance_n(0.0) / head - 0.25).abs() < 1e-12);
    assert!(regular(1.0, 0.0).resistance_n(0.0) < 1e-10);
    assert!((regular(1.0, 90.0).resistance_n(-std::f64::consts::FRAC_PI_2) / head - 1.0).abs() < 1e-12);
}

#[test]
fn angular_moments_match_directional_spectrum_and_preserve_seeded_wave_field() {
    let condition = WaveCondition::v2();
    let wave = WaveField::new(17, condition);
    let before = serde_json::to_value(&wave).unwrap();
    let model = ContainerMeanWaveResistance::from_wave(&wave, 17.0, 383.0).unwrap();
    assert_eq!(before, serde_json::to_value(&wave).unwrap());
    let coefficient = 0.5 * 1025.0 * 9.81 * 61.5 * (61.5_f64 / 96.18590600484558).sqrt();
    for yaw in [-2.0_f64, 0.0, 1.2] {
        let expected: f64 = before["components"].as_array().unwrap().iter().map(|component| {
            let amplitude = component["amplitude"].as_f64().unwrap();
            let direction = component["direction"].as_f64().unwrap();
            amplitude.powi(2) * ((1.0 - (direction - yaw).cos()) / 2.0).powi(2) * coefficient
        }).sum();
        assert!((model.resistance_n(yaw) - expected).abs() < 1e-8);
    }
}

#[test]
fn waterline_force_and_pitch_moment_are_passive_in_forward_reverse_and_pitch_motion() {
    let model = regular(1.0, 180.0);
    for velocity in [[8.0, 0.0, 0.0, 0.0, 0.0, 0.0], [-8.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        [0.1, 0.0, 0.0, 0.0, -0.2, 0.0], [0.0; 6]] {
        let load = model.loads(0.0, velocity);
        assert!((load[4] - 17.037810003601365 * load[0]).abs() < 1e-8);
        let power: f64 = load.iter().zip(velocity).map(|(force, speed)| force * speed).sum();
        assert!(power <= 0.0);
    }
}

#[test]
fn opt_in_changes_actual_load_identity_and_fuel_and_restores_exact_future() {
    let mut baseline = FleetSimulation::new(configuration(false)).unwrap();
    let mut active = FleetSimulation::new(configuration(true)).unwrap();
    let mut off_frame = frame(&baseline);
    let mut on_frame = frame(&active);
    assert_ne!(off_frame["parameterHash"], on_frame["parameterHash"]);
    assert_eq!(off_frame["truth"], on_frame["truth"]);
    assert_eq!(on_frame["waveModel"]["secondOrderEnabled"], false);
    assert_eq!(on_frame["meanWaveResistance"]["grade"], "T");
    for _ in 0..5 { baseline.advance(1.0, None).unwrap(); active.advance(1.0, None).unwrap(); }
    off_frame = frame(&baseline); on_frame = frame(&active);
    assert!(on_frame["meanWaveResistance"]["loadBody"][0].as_f64().unwrap() < 0.0);
    assert_ne!(off_frame["truth"]["body_velocity"], on_frame["truth"]["body_velocity"]);
    assert_ne!(off_frame["teachingFuel"]["state"]["fuel_kg"], on_frame["teachingFuel"]["state"]["fuel_kg"]);
    let saved = active.snapshot_json().unwrap();
    let mut restored = FleetSimulation::from_snapshot_json(&saved).unwrap();
    assert_eq!(active.snapshot_json().unwrap(), restored.snapshot_json().unwrap());
    active.advance(1.0, None).unwrap(); restored.advance(1.0, None).unwrap();
    assert_eq!(active.snapshot_json().unwrap(), restored.snapshot_json().unwrap());
    assert_eq!(frame(&active), frame(&restored));
}

#[test]
fn wave_switch_controls_mean_load_and_invalid_combinations_are_rejected() {
    let mut config = configuration(true);
    config.environment = EnvironmentPreset::P0;
    let mut simulation = FleetSimulation::new(config.clone()).unwrap();
    simulation.advance(1.0, None).unwrap();
    let result = frame(&simulation);
    assert_eq!(result["meanWaveResistance"]["enabled"], false);
    assert_eq!(result["meanWaveResistance"]["loadBody"], serde_json::json!([0.0, 0.0, 0.0, 0.0, 0.0, 0.0]));
    config.second_order_enabled = Some(true);
    assert!(FleetSimulation::new(config).is_err());
    let mut config = SessionConfiguration::default();
    config.mean_wave_resistance_model = Some(MeanWaveResistanceModel::ContainerReflectionTeachingV1);
    assert!(FleetSimulation::new(config).is_err());
}
