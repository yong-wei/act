use control_engine::sixdof::control_law::{
    DEFAULT_DERIVATIVE_FILTER_TAU_S, HeadingControlMode, HeadingFeedbackController,
    HeadingPidGains,
};
use control_engine::sixdof::session::{FeedbackSource, FleetSimulation, SessionConfiguration};
use control_engine::sixdof::NoiseLevel;

fn advance(
    state: &mut HeadingFeedbackController,
    gains: HeadingPidGains,
    target: f64,
    heading: Option<f64>,
    time: f64,
) -> f64 {
    state.step(HeadingControlMode::Pid, &gains, target, heading, time, 0.05,
        DEFAULT_DERIVATIVE_FILTER_TAU_S).unwrap()
}

#[test]
fn target_step_has_no_derivative_kick_and_measurement_rate_is_filtered() {
    let mut state = HeadingFeedbackController::default();
    let gains = HeadingPidGains { kp: 0.0, ki: 0.0, kd: 3.0 };
    assert_eq!(advance(&mut state, gains, 20.0, Some(20.0), 0.0), 0.0);
    assert_eq!(advance(&mut state, gains, 90.0, Some(20.0), 0.05), 0.0);
    let command = advance(&mut state, gains, 90.0, Some(21.0), 0.1);
    let expected_rate = 20.0 * (1.0 - (-0.25_f64).exp());
    assert!((state.derivative_deg_s - expected_rate).abs() < 1e-12);
    assert!((command + 3.0 * expected_rate).abs() < 1e-12);
}

#[test]
fn measured_heading_wrap_uses_the_shortest_rotation() {
    let mut state = HeadingFeedbackController::default();
    let gains = HeadingPidGains { kp: 0.0, ki: 0.0, kd: 1.0 };
    advance(&mut state, gains, 179.0, Some(179.0), 0.0);
    let command = advance(&mut state, gains, -179.0, Some(-179.0), 0.05);
    assert_eq!(state.error_deg, 0.0);
    let expected_rate = 40.0 * (1.0 - (-0.25_f64).exp());
    assert!((command + expected_rate).abs() < 1e-12);
}

#[test]
fn integral_back_calculation_matches_the_discrete_tracking_equation() {
    let mut state = HeadingFeedbackController::default();
    let gains = HeadingPidGains { kp: 2.0, ki: 0.2, kd: 0.0 };
    for tick in 0..400 {
        let command = advance(&mut state, gains, 100.0, Some(0.0), tick as f64 * 0.05);
        assert_eq!(command, 35.0);
        assert!(!state.integral_frozen);
    }
    // I[k+1]=.95 I[k]+.05*(20+35-200)，Tt=1s。
    let expected = -145.0 * (1.0 - 0.95_f64.powi(400));
    assert!((state.integral_output_deg - expected).abs() < 1e-10);
    assert!(state.integral_rate_deg_s.abs() < 1e-6);
    assert_eq!(state.previous_measurement_time_s, Some(399.0 * 0.05));
}

#[test]
fn zero_integral_gain_and_non_integrating_modes_keep_finite_zero_integral() {
    let mut state = HeadingFeedbackController::default();
    let mut gains = HeadingPidGains { kp: 1.0, ki: 1.0, kd: 0.0 };
    advance(&mut state, gains, 10.0, Some(0.0), 0.0);
    assert!(state.integral_output_deg > 0.0);
    gains.ki = 0.0;
    advance(&mut state, gains, 10.0, Some(0.0), 0.05);
    assert_eq!(state.integral_output_deg, 0.0);
    assert!(state.integral_frozen);
    for (index, mode) in [HeadingControlMode::P, HeadingControlMode::Pd, HeadingControlMode::Manual].into_iter().enumerate() {
        state.step(mode, &gains, 10.0, Some(0.0), 0.1 + index as f64 * 0.05,
            0.05, 0.2).unwrap();
        assert_eq!(state.integral_output_deg, 0.0);
        assert!(state.integral_frozen);
    }
    assert_eq!(state, HeadingFeedbackController::default());
}

#[test]
fn missing_measurement_freezes_feedback_state_and_preserves_the_command() {
    let mut state = HeadingFeedbackController::default();
    let gains = HeadingPidGains { kp: 1.0, ki: 0.1, kd: 1.0 };
    advance(&mut state, gains, 10.0, Some(0.0), 0.0);
    advance(&mut state, gains, 10.0, Some(1.0), 0.05);
    let previous = state.clone();
    let held = advance(&mut state, gains, 90.0, None, 0.5);
    assert_eq!(held, previous.command_deg);
    assert_eq!(state.integral_output_deg, previous.integral_output_deg);
    assert_eq!(state.derivative_deg_s, previous.derivative_deg_s);
    assert_eq!(state.previous_measurement_time_s, previous.previous_measurement_time_s);
    assert!(state.integral_frozen);
    assert!(!state.feedback_available);
    advance(&mut state, gains, 10.0, Some(3.0), 0.55);
    let decay = (-0.25_f64).exp();
    assert!((state.derivative_deg_s - (decay * previous.derivative_deg_s + (1.0 - decay) * 4.0)).abs() < 1e-12);
}

#[test]
fn invalid_or_overflowing_control_calculation_does_not_commit_partial_state() {
    let mut state = HeadingFeedbackController::default();
    let gains = HeadingPidGains { kp: 1.0, ki: 0.1, kd: 1.0 };
    advance(&mut state, gains, 10.0, Some(0.0), 0.0);
    let previous = state.clone();
    assert!(state.step(HeadingControlMode::Pid, &gains, 10.0, Some(0.0), 0.05, 0.05, 0.0).is_err());
    assert_eq!(state, previous);
    let huge = HeadingPidGains { kp: f64::MAX, ki: 0.1, kd: 1.0 };
    assert!(state.step(HeadingControlMode::Pid, &huge, 180.0, Some(0.0), 0.05, 0.05, 0.2).is_err());
    assert_eq!(state, previous);
}

#[test]
fn actual_session_uses_measurement_derivative_and_exposes_controller_state() {
    let mut session = FleetSimulation::new(SessionConfiguration { noise_level: NoiseLevel::N0,
        ..Default::default() }).unwrap();
    let mut input = session.input().clone();
    input.feedback = FeedbackSource::Measurement;
    input.control_mode = HeadingControlMode::Pid;
    input.pid = HeadingPidGains { kp: 0.0, ki: 0.0, kd: 10.0 };
    session.advance(0.05, Some(input.clone())).unwrap();
    input.target_heading_deg = 90.0;
    session.advance(0.05, Some(input)).unwrap();
    let frame: serde_json::Value = serde_json::from_str(&session.frame_json().unwrap()).unwrap();
    assert_eq!(frame["modelVersion"], "sixdof-session-v2");
    assert!(frame["headingController"]["derivativeDegS"].as_f64().unwrap().abs() < 1e-10);
    assert!(frame["headingController"]["commandDeg"].as_f64().unwrap().abs() < 1e-9);
    assert_eq!(frame["input"]["derivativeFilterTauS"], 0.2);
}

#[test]
fn delayed_heading_holds_steering_but_applies_other_actuator_commands() {
    let mut session = FleetSimulation::new(SessionConfiguration { noise_level: NoiseLevel::N2,
        ..Default::default() }).unwrap();
    let mut input = session.input().clone();
    for command in &mut input.actuators.surfaces {
        command.angle_rad = 10.0_f64.to_radians();
    }
    session.advance(0.05, Some(input.clone())).unwrap();
    input.control_mode = HeadingControlMode::Pid;
    input.feedback = FeedbackSource::Measurement;
    input.pid = HeadingPidGains { kp: 1.0, ki: 0.1, kd: 1.0 };
    input.target_heading_deg = 20.0;
    input.actuators.shafts[0].speed_reference_rad_s = 0.0;
    for command in &mut input.actuators.surfaces {
        command.angle_rad = -15.0_f64.to_radians();
    }
    session.advance(1.0 / 120.0, Some(input)).unwrap();
    let frame: serde_json::Value = serde_json::from_str(&session.frame_json().unwrap()).unwrap();
    assert_eq!(frame["heldCommands"]["shafts"][0]["speed_reference_rad_s"], 0.0);
    assert_eq!(frame["heldCommands"]["surfaces"][0]["angle_rad"], 10.0_f64.to_radians());
    assert_eq!(frame["headingController"]["integralFrozen"], true);
    assert_eq!(frame["headingController"]["feedbackAvailable"], false);
}

#[test]
fn new_controller_snapshots_validate_and_control_failure_rolls_back_the_whole_frame() {
    let mut session = FleetSimulation::new(Default::default()).unwrap();
    let mut input = session.input().clone();
    input.control_mode = HeadingControlMode::Pid;
    input.pid = HeadingPidGains { kp: 1.0, ki: 0.1, kd: 1.0 };
    input.target_heading_deg = 10.0;
    session.advance(0.5, Some(input.clone())).unwrap();
    let previous = session.snapshot_json().unwrap();
    input.pid.kp = f64::MAX;
    input.target_heading_deg = 180.0;
    assert!(session.advance(0.5, Some(input)).is_err());
    assert_eq!(session.snapshot_json().unwrap(), previous);
    let mut saved: serde_json::Value = serde_json::from_str(&previous).unwrap();
    saved["heading_controller"]["previousMeasurementTimeS"] = serde_json::json!(10.0);
    assert!(FleetSimulation::from_snapshot_json(&saved.to_string()).is_err());
    saved = serde_json::from_str(&previous).unwrap();
    saved["input"]["derivativeFilterTauS"] = serde_json::json!(0.0);
    assert!(FleetSimulation::from_snapshot_json(&saved.to_string()).is_err());
    saved = serde_json::from_str(&previous).unwrap();
    saved.as_object_mut().unwrap().remove("heading_controller");
    assert!(FleetSimulation::from_snapshot_json(&saved.to_string()).is_err());
}
