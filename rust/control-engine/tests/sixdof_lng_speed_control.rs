use control_engine::sixdof::lng_speed_control::{
    LngSpeedController, SpeedOperatingModel, SpeedPiInput, CONTROL_DT_S,
};
use control_engine::sixdof::student_model::{predict, ModelStructure};

fn input() -> SpeedPiInput {
    SpeedPiInput {
        local_model: SpeedOperatingModel {
            structure: ModelStructure::Fopdt {
                k: 0.05,
                t_s: 100.0,
                delay_s: 2.0,
            },
            speed_mps: 4.0,
            shaft_reference_rpm: 60.0,
        },
        reference_mps: 3.0,
        kp_multiplier: 1.0,
        ti_multiplier: 1.0,
        anti_windup: true,
        smith_enabled: false,
        filter_tau_s: 1.0,
        additional_command_delay_s: 0.0,
    }
}

#[test]
fn imc_rule_uses_the_frozen_model_and_keeps_the_added_delay_trial_gains_equal() {
    let mut input = input();
    let gains = input.gains().unwrap();
    assert_eq!(gains.lambda_s, 100.0 / 3.0);
    assert_eq!(gains.ti_s, 100.0);
    assert_eq!(gains.tracking_time_s, 20.0);
    assert!((gains.kp_rpm_per_mps - 100.0 / (0.05 * (100.0 / 3.0 + 2.0))).abs() < 1e-14);
    input.additional_command_delay_s = 5.0;
    assert_eq!(gains.kp_rpm_per_mps, input.gains().unwrap().kp_rpm_per_mps);
}

#[test]
fn zero_and_five_second_transport_preserve_the_exact_twenty_hz_arrival_tick() {
    for delay in [0.0, 5.0] {
        let mut input = input();
        input.additional_command_delay_s = delay;
        let mut controller = LngSpeedController::new(&input, 60.0, 110.0).unwrap();
        let first = controller.step(&input, Some(4.0), 110.0).unwrap();
        let requested = controller.diagnostics().requested_rpm;
        if delay == 0.0 {
            assert_eq!(first, requested);
        } else {
            assert_eq!(first, 60.0);
            for _ in 1..100 {
                assert_eq!(controller.step(&input, Some(4.0), 110.0).unwrap(), 60.0);
            }
            assert_eq!(
                controller.step(&input, Some(4.0), 110.0).unwrap(),
                requested
            );
        }
    }
}

#[test]
fn missing_measurement_freezes_integral_and_request_while_the_physical_queue_keeps_arriving() {
    let mut input = input();
    input.additional_command_delay_s = 5.0;
    let mut controller = LngSpeedController::new(&input, 60.0, 110.0).unwrap();
    controller.step(&input, Some(4.0), 110.0).unwrap();
    let initial = controller.diagnostics().clone();
    for _ in 1..=100 {
        controller.step(&input, None, 110.0).unwrap();
    }
    let final_state = controller.diagnostics();
    assert_eq!(initial.integral_rpm, final_state.integral_rpm);
    assert_eq!(initial.requested_rpm, final_state.requested_rpm);
    assert_eq!(final_state.applied_rpm, initial.requested_rpm);
    assert!(!final_state.feedback_available && final_state.integral_frozen);
    assert!(final_state.model_without_delay_delta_mps.abs() > 1e-4);
}

#[test]
fn smith_shadow_models_match_the_existing_independent_frozen_prediction_entry() {
    let mut input = input();
    input.local_model.structure = ModelStructure::Fopdt {
        k: 0.05,
        t_s: 20.0,
        delay_s: 0.13,
    };
    input.additional_command_delay_s = 5.0;
    input.smith_enabled = true;
    let mut controller = LngSpeedController::new(&input, 60.0, 110.0).unwrap();
    let mut history = Vec::new();
    for _ in 0..180 {
        let undelayed = predict(
            &ModelStructure::Fopdt {
                k: 0.05,
                t_s: 20.0,
                delay_s: 0.0,
            },
            &history,
            0.0,
            CONTROL_DT_S,
        );
        let delayed = predict(
            &ModelStructure::Fopdt {
                k: 0.05,
                t_s: 20.0,
                delay_s: 5.13,
            },
            &history,
            0.0,
            CONTROL_DT_S,
        );
        controller.step(&input, Some(4.0), 110.0).unwrap();
        let d = controller.diagnostics();
        assert!((d.model_without_delay_delta_mps - undelayed.last().unwrap()).abs() < 1e-12);
        assert!((d.model_with_delay_delta_mps - delayed.last().unwrap()).abs() < 1e-12);
        assert!(
            (d.feedback_mps.unwrap()
                - (4.0 + d.model_without_delay_delta_mps - d.model_with_delay_delta_mps))
                .abs()
                < 1e-12
        );
        history.push(d.requested_rpm - 60.0);
    }
}

#[test]
fn anti_windup_matches_the_declared_tracking_equation() {
    let mut input = input();
    input.local_model.structure = ModelStructure::Fopdt {
        k: 0.0001,
        t_s: 100.0,
        delay_s: 2.0,
    };
    input.reference_mps = 4.0;
    input.local_model.speed_mps = 3.0;
    let gains = input.gains().unwrap();
    let mut controller = LngSpeedController::new(&input, 60.0, 110.0).unwrap();
    assert_eq!(controller.step(&input, Some(3.0), 110.0).unwrap(), 110.0);
    let expected = CONTROL_DT_S
        * (gains.kp_rpm_per_mps / gains.ti_s
            + (110.0 - 60.0 - gains.kp_rpm_per_mps) / gains.tracking_time_s);
    assert!((controller.diagnostics().integral_rpm - expected).abs() < 1e-12);
    input.anti_windup = false;
    let mut plain = LngSpeedController::new(&input, 60.0, 110.0).unwrap();
    plain.step(&input, Some(3.0), 110.0).unwrap();
    assert!(plain.diagnostics().integral_rpm > 0.0 && controller.diagnostics().integral_rpm < 0.0);
}

#[test]
fn gain_changes_preserve_the_integral_output_including_changes_during_missing_data() {
    let mut input = input();
    input.reference_mps = 3.8;
    input.anti_windup = false;
    let mut controller = LngSpeedController::new(&input, 60.0, 110.0).unwrap();
    let previous = controller.step(&input, Some(4.0), 110.0).unwrap();
    let previous_rate = controller.diagnostics().integral_rate_rpm_per_s;
    input.kp_multiplier = 2.0;
    controller.step(&input, None, 110.0).unwrap();
    let changed = controller.step(&input, Some(4.0), 110.0).unwrap();
    assert!((changed - previous - CONTROL_DT_S * previous_rate).abs() < 1e-12);
}

#[test]
fn complete_shadow_and_delayed_command_state_roundtrips_without_changing_the_future() {
    let mut input = input();
    input.smith_enabled = true;
    input.additional_command_delay_s = 5.0;
    let mut first = LngSpeedController::new(&input, 60.0, 110.0).unwrap();
    for _ in 0..40 {
        first.step(&input, Some(4.0), 110.0).unwrap();
    }
    let saved = serde_json::to_string(&first).unwrap();
    let mut restored: LngSpeedController = serde_json::from_str(&saved).unwrap();
    restored.validate_checkpoint(110.0, 40).unwrap();
    for index in 0..180 {
        let measurement = Some(4.0 - 0.002 * index as f64);
        assert_eq!(
            first.step(&input, measurement, 110.0).unwrap(),
            restored.step(&input, measurement, 110.0).unwrap()
        );
    }
    assert_eq!(
        serde_json::to_string(&first).unwrap(),
        serde_json::to_string(&restored).unwrap()
    );
}

#[test]
fn invalid_values_or_changed_frozen_models_leave_the_controller_state_intact() {
    let input = input();
    let mut controller = LngSpeedController::new(&input, 60.0, 110.0).unwrap();
    controller.step(&input, Some(4.0), 110.0).unwrap();
    let before = serde_json::to_string(&controller).unwrap();
    let mut invalid = input.clone();
    invalid.additional_command_delay_s = 25.0;
    assert!(controller.step(&invalid, Some(4.0), 110.0).is_err());
    invalid = input.clone();
    invalid.local_model.speed_mps = 3.9;
    assert!(controller.step(&invalid, Some(4.0), 110.0).is_err());
    assert!(controller.step(&input, Some(f64::NAN), 110.0).is_err());
    assert_eq!(before, serde_json::to_string(&controller).unwrap());
    let mut forged: serde_json::Value = serde_json::from_str(&before).unwrap();
    forged["commandDelayQueueRpm"] = serde_json::json!([200.0]);
    let restored: LngSpeedController = serde_json::from_value(forged).unwrap();
    assert!(restored.validate_checkpoint(110.0, 1).is_err());
    let mut forged: serde_json::Value = serde_json::from_str(&before).unwrap();
    forged["diagnostics"]["gains"]["lambdaS"] = serde_json::json!(0.0);
    let restored: LngSpeedController = serde_json::from_value(forged).unwrap();
    assert!(restored.validate_checkpoint(110.0, 1).is_err());
    assert!(controller.validate_checkpoint(f64::INFINITY, 1).is_err());
}
