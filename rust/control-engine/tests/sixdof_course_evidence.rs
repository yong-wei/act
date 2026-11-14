use control_engine::sixdof::session::{FleetSimulation, SessionConfiguration};
use control_engine::sixdof::course_evidence::{CourseEvidenceConfiguration, CourseEvidenceState};
use control_engine::sixdof::model_pack::{PackActuators, embedded_vessel_pack};

#[test]
fn fine_step_peak_and_duration_preserve_a_spike_between_twenty_hertz_samples() {
    let simulation = FleetSimulation::new(SessionConfiguration::default()).unwrap();
    let initial: serde_json::Value = serde_json::from_str(&simulation.frame_json().unwrap()).unwrap();
    let mut state = serde_json::from_value(initial["truth"].clone()).unwrap();
    let mut evidence = CourseEvidenceState::new(&state);
    let pack = embedded_vessel_pack("destroyer-055", "research-nominal-v3").unwrap();
    let PackActuators::Physical {system,..} = &pack.actuators else { panic!("需要物理执行器包") };
    let commands = simulation.input().actuators.clone();
    for tick in 1..=6 {
        let roll: f64 = if tick == 3 { 10.0 } else { 0.0 };
        state.quaternion = [(roll.to_radians()/2.0).cos(), (roll.to_radians()/2.0).sin(),0.0,0.0];
        evidence.observe(tick, &state, system, &commands, 8.0);
    }
    assert!((evidence.metrics.maximum_roll_deg-10.0).abs() < 1e-10);
    assert!((evidence.metrics.roll_warning_duration_s-1.0/120.0).abs() < 1e-12);
    assert_eq!(evidence.metrics.physics_samples,6);
    assert_eq!(evidence.emitted_samples,6);
}

#[test]
fn event_windows_retain_pre_history_and_resume_without_duplicate_samples() {
    let configuration = SessionConfiguration {course_evidence:Some(CourseEvidenceConfiguration {roll_warning_deg:8.0}),
        ..Default::default()};
    let mut simulation = FleetSimulation::new(configuration).unwrap();
    for _ in 0..4 { simulation.advance(1.0,None).unwrap(); }
    let mut input = simulation.input().clone();
    input.target_heading_deg = 10.0;
    simulation.advance(0.5,Some(input)).unwrap();
    let frame:serde_json::Value = serde_json::from_str(&simulation.frame_json().unwrap()).unwrap();
    let window = frame["fineStepSamples"].as_array().unwrap();
    assert_eq!(window.len(),181);
    assert!((window[0]["timeS"].as_f64().unwrap()-3.0).abs() < 1e-12);
    assert!((window.last().unwrap()["timeS"].as_f64().unwrap()-4.5).abs() < 1e-12);
    simulation.set_paused(true);
    let paused = simulation.snapshot_json().unwrap();
    simulation.advance(1.0,None).unwrap();
    assert_eq!(simulation.snapshot_json().unwrap(),paused);
    let mut restored = FleetSimulation::from_snapshot_json(&paused).unwrap();
    simulation.set_paused(false);
    restored.set_paused(false);
    simulation.advance(0.5,None).unwrap();
    restored.advance(0.5,None).unwrap();
    assert_eq!(simulation.snapshot_json().unwrap(),restored.snapshot_json().unwrap());
    assert_eq!(simulation.frame_json().unwrap(),restored.frame_json().unwrap());
    let final_frame:serde_json::Value = serde_json::from_str(&restored.frame_json().unwrap()).unwrap();
    assert_eq!(final_frame["fineStepWindowSampleCount"],361);
    assert_eq!(final_frame["fineStepMetrics"]["values"]["physicsSamples"],600);
}
