use control_engine::sixdof::cruise_comfort::CruiseConfiguration;
use control_engine::sixdof::cruise_control::{CruiseFinInput, RollStudentModel};
use control_engine::sixdof::sensor::NoiseLevel;
use control_engine::sixdof::session::{FleetSimulation, SessionConfiguration};
use serde_json::Value;

fn session(failure: bool) -> FleetSimulation {
    FleetSimulation::new(SessionConfiguration {
        vessel: "cruise-adora".into(),
        parameter_version: "research-nominal-v2".into(),
        initial_water_speed_mps: Some(8.0),
        initial_roll_deg: Some(2.0),
        noise_level: NoiseLevel::N0,
        cruise: Some(CruiseConfiguration {
            statistics_start_s: 0.0,
            statistics_end_s: 20.0,
            fin_failure_time_s: failure.then_some(1.5),
            failed_fin_index: failure.then_some(0),
        }),
        ..Default::default()
    })
    .unwrap()
}

fn frame(session: &FleetSimulation) -> Value {
    serde_json::from_str(&session.frame_json().unwrap()).unwrap()
}

fn assert_same_checkpoint(left: &FleetSimulation, right: &FleetSimulation) {
    let left = left.snapshot_json().unwrap();
    let right = right.snapshot_json().unwrap();
    let offset = left
        .bytes()
        .zip(right.bytes())
        .position(|(left, right)| left != right)
        .unwrap_or(left.len().min(right.len()));
    let start = offset.saturating_sub(80);
    assert!(
        left == right,
        "checkpoint differs at byte {offset}: {:?} versus {:?}",
        &left[start..(offset + 100).min(left.len())],
        &right[start..(offset + 100).min(right.len())]
    );
}

fn advance(session: &mut FleetSimulation, duration_s: f64, dt: f64) {
    for _ in 0..(duration_s / dt).round() as usize {
        session.advance(dt, None).unwrap();
    }
}

#[test]
fn cruise_measurement_feedback_statistics_and_restore_use_one_physical_session() {
    let mut session = session(false);
    let mut input = session.input().clone();
    input.cruise_fins = Some(CruiseFinInput {
        enabled: true,
        model: RollStudentModel {
            inertia_kg_m2: 12e9,
            damping_nm_s_rad: 1e8,
            stiffness_nm_rad: 1e9,
        },
        damping_ratio: 0.5,
        stiffness_fraction: 0.2,
        low_pass_cutoff_hz: 0.3,
        notch: None,
    });
    session.advance(0.0, Some(input)).unwrap();
    advance(&mut session, 3.0, 1.0 / 60.0);
    let observed = frame(&session);
    assert_eq!(observed["cruiseController"]["measurementGood"], true);
    assert_eq!(observed["cruiseController"]["samples"], 60);
    assert_eq!(observed["cruiseComfort"]["physicsSamples"], 360);
    assert_eq!(
        observed["cruiseComfort"]["comfortInterpretation"],
        "teaching_proxy_unweighted"
    );
    assert!(
        observed["cruiseComfort"]["finServoElectricWorkJ"]
            .as_f64()
            .unwrap()
            > 12000.0
    );
    let checkpoint = session.snapshot_json().unwrap();
    let mut restored = FleetSimulation::from_snapshot_json(&checkpoint).unwrap();
    let mut schedule_variant = FleetSimulation::from_snapshot_json(&checkpoint).unwrap();
    advance(&mut session, 2.0, 1.0 / 30.0);
    advance(&mut restored, 2.0, 1.0 / 30.0);
    assert_same_checkpoint(&session, &restored);
    advance(&mut schedule_variant, 2.0, 1.0 / 60.0);
    for key in [
        "truth",
        "cruiseController",
        "cruiseComfort",
        "physicsTicks",
        "controllerTicks",
    ] {
        assert_eq!(frame(&session)[key], frame(&schedule_variant)[key], "{key}");
    }
    restored.set_paused(true);
    let paused = restored.snapshot_json().unwrap();
    restored.advance(1.0, None).unwrap();
    assert_eq!(paused, restored.snapshot_json().unwrap());
}

#[test]
fn a_single_fin_zero_fault_changes_actual_angle_and_preserves_other_fin() {
    let mut session = session(true);
    let mut input = session.input().clone();
    for surface in &mut input.actuators.surfaces {
        surface.angle_rad = 5.0_f64.to_radians();
        surface.enabled = true;
    }
    session.advance(0.0, Some(input)).unwrap();
    advance(&mut session, 1.4, 0.05);
    assert!(
        frame(&session)["truth"]["actuator_states"]["control_surface_angles_rad"][0]
            .as_f64()
            .unwrap()
            > 0.01
    );
    advance(&mut session, 0.2, 0.05);
    let observed = frame(&session);
    assert_eq!(
        observed["truth"]["actuator_states"]["control_surface_angles_rad"][0],
        0.0
    );
    assert!(
        observed["truth"]["actuator_states"]["control_surface_angles_rad"][1]
            .as_f64()
            .unwrap()
            > 0.01
    );
    let mut restored =
        FleetSimulation::from_snapshot_json(&session.snapshot_json().unwrap()).unwrap();
    advance(&mut session, 0.4, 0.05);
    advance(&mut restored, 0.4, 0.05);
    assert_same_checkpoint(&session, &restored);
}

#[test]
fn misplaced_cruise_configuration_and_invalid_windows_are_rejected() {
    let wrong_ship = SessionConfiguration {
        cruise: Some(CruiseConfiguration {
            statistics_start_s: 0.0,
            statistics_end_s: 10.0,
            fin_failure_time_s: None,
            failed_fin_index: None,
        }),
        ..Default::default()
    };
    assert!(FleetSimulation::new(wrong_ship).is_err());
    assert!(
        CruiseConfiguration {
            statistics_start_s: 120.0,
            statistics_end_s: 60.0,
            fin_failure_time_s: None,
            failed_fin_index: None
        }
        .validate()
        .is_err()
    );
}

#[test]
fn passive_imu_roll_estimation_supports_own_decay_and_fin_gain_identification() {
    use control_engine::sixdof::control_law::HeadingControlMode;
    use control_engine::sixdof::session::FeedbackSource;
    use control_engine::sixdof::student_model::{identify_roll_oscillator,ModelStructure};
    let configuration=SessionConfiguration {vessel:"cruise-adora".into(),parameter_version:"research-nominal-v3".into(),
        initial_water_speed_mps:Some(8.0),initial_roll_deg:Some(2.0),noise_level:NoiseLevel::N0,
        course_evidence:Some(control_engine::sixdof::course_evidence::CourseEvidenceConfiguration {roll_warning_deg:6.0}),
        cruise:Some(CruiseConfiguration {statistics_start_s:0.0,statistics_end_s:300.0,
            fin_failure_time_s:None,failed_fin_index:None}),..Default::default()};
    let mut decay=FleetSimulation::new(configuration.clone()).unwrap();
    let mut input=decay.input().clone();
    input.control_mode=HeadingControlMode::Pd;input.feedback=FeedbackSource::Measurement;
    input.pid.kp=1.5;input.pid.ki=0.0;input.pid.kd=20.0;
    let mut free=Vec::new();
    for _ in 0..120 {
        decay.advance(1.0,Some(input.clone())).unwrap();
        for sample in frame(&decay)["controlSamples"].as_array().unwrap() {
            if sample["cruise"]["measurementGood"] == true {
                free.push(sample["cruise"]["estimatedRollRad"].as_f64().unwrap().to_degrees());
            }
        }
    }
    let initial_model=identify_roll_oscillator(&free,0.05,None);
    assert!(initial_model.identified_ok,"{:?}",initial_model.failure_reason);
    let mut excited=FleetSimulation::new(SessionConfiguration {initial_roll_deg:Some(0.0),..configuration}).unwrap();
    let mut alpha=Vec::new();let mut output=Vec::new();
    for second in 0..300 {
        let mut active=input.clone();
        let pulse=if (20..30).contains(&second) {2.0_f64} else if (60..70).contains(&second) {-2.0_f64} else {0.0_f64};
        active.actuators.surfaces[0].angle_rad=pulse.to_radians();active.actuators.surfaces[1].angle_rad=-pulse.to_radians();
        excited.advance(1.0,Some(active)).unwrap();
        for sample in frame(&excited)["controlSamples"].as_array().unwrap() {
            if sample["cruise"]["measurementGood"] == true {
                output.push(sample["cruise"]["estimatedRollRad"].as_f64().unwrap().to_degrees());
                let angles=sample["truth"]["actuator_states"]["control_surface_angles_rad"].as_array().unwrap();
                alpha.push((angles[0].as_f64().unwrap()-angles[1].as_f64().unwrap()).to_degrees()/2.0);
            }
        }
    }
    let model=identify_roll_oscillator(&free,0.05,Some((&alpha,&output)));
    assert!(model.identified_ok,"{:?}",model.failure_reason);
    assert!(matches!(model.structure,Some(ModelStructure::RollOscillator {control_gain,..}) if control_gain > 0.0));
    let snapshot=excited.snapshot_json().unwrap();
    let restored=FleetSimulation::from_snapshot_json(&snapshot).unwrap();
    assert_same_checkpoint(&excited,&restored);
}

#[test]
fn regular_wave_has_one_frequency_correct_height_and_reproducible_phase() {
    use control_engine::sixdof::wave::{WaveCondition,WaveField};
    let condition=WaveCondition {tp_s:20.0,..WaveCondition::v1()};
    let wave=WaveField::regular(17,condition,0.5).unwrap();
    let same=WaveField::regular(17,condition,0.5).unwrap();
    assert_eq!(wave.component_count(),1);
    assert!((wave.condition().hs_m-0.5*std::f64::consts::SQRT_2).abs() < 1e-12);
    let heights:Vec<f64>=(0..2000).map(|index| wave.elevation(index as f64*0.01,0.0,0.0)).collect();
    let maximum=heights.iter().copied().fold(f64::NEG_INFINITY,f64::max);
    let minimum=heights.iter().copied().fold(f64::INFINITY,f64::min);
    assert!((maximum-minimum-0.5).abs() < 1e-5);
    assert_eq!(wave.elevation(3.0,2.0,1.0),same.elevation(3.0,2.0,1.0));
}
