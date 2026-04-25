use control_engine::destroyer_hifi::{
    DestroyerExperimentConfig, fit_nomoto_like_transfer_function, run_destroyer_hifi_experiment,
    run_open_loop_probe,
};

#[test]
fn mmg_destroyer_probe_has_finite_maneuvering_response() {
    let config = DestroyerExperimentConfig::default();
    let probe = run_open_loop_probe(&config, 10.0_f64.to_radians(), 120.0);

    assert!(probe.samples.len() > 100);
    assert!(
        probe
            .samples
            .iter()
            .all(|sample| sample.heading_rad.is_finite()
                && sample.yaw_rate_rad.is_finite()
                && sample.position_x_m.is_finite()
                && sample.position_y_m.is_finite())
    );
    assert!(probe.final_heading_deg.abs() > 5.0);
    assert!(probe.max_rudder_deg <= config.max_rudder_deg + 1e-6);
    assert!(probe.max_rudder_rate_deg_s <= config.max_rudder_rate_deg_s + 1e-6);
}

#[test]
fn identification_returns_stable_third_order_course_model() {
    let config = DestroyerExperimentConfig::default();
    let fit = fit_nomoto_like_transfer_function(&config);

    assert!(fit.k > 0.0);
    assert!(fit.slow_pole > 0.0);
    assert!(fit.fast_pole > fit.slow_pole);
    assert!(fit.heading_rmse_deg < 8.0);
    assert!(fit.yaw_rate_rmse_deg_s < 0.8);
}

#[test]
fn experiment_keeps_pi_lead_as_hifi_winner_with_disturbance_case() {
    let report = run_destroyer_hifi_experiment();

    assert_eq!(report.selected_controller_id, "pi_lead");
    assert_eq!(report.validation_scenarios.len(), 2);
    assert!(
        report
            .validation_scenarios
            .iter()
            .any(|scenario| scenario.scenario_id == "zigzag45" && scenario.duration_s == 1200.0)
    );
    assert!(
        report
            .validation_scenarios
            .iter()
            .any(|scenario| scenario.scenario_id == "turning_ramp" && scenario.duration_s == 780.0)
    );
    assert!(
        report
            .validation_scenarios
            .iter()
            .all(|scenario| scenario.heading_rmse_deg < 18.0)
    );
    assert!(
        report
            .controller_comparison
            .iter()
            .any(|row| row.disturbance_enabled)
    );
    assert_eq!(report.controller_comparison.len(), 48);
    assert_eq!(report.search_metadata.population_size, 48);
    assert_eq!(report.search_metadata.generations, 40);
    assert_eq!(report.search_metadata.random_seed, 4707);
    assert_eq!(report.sensor_noise_settings.measured_signal, "heading");
    assert_eq!(report.nominal_comparison.len(), 2);
    assert_eq!(report.disturbance_comparison.len(), 2);
    assert_eq!(report.noise_comparison.len(), 2);
    assert_eq!(report.disturbance_interface.active_level_id, "moderate");
    assert_eq!(report.disturbance_interface.engineering_levels.len(), 3);
    assert!(report.controller_encoding.iter().any(|item| {
        item.controller_id == "disturbance_optimized" && item.controller_name.contains("扰动")
    }));
    assert!(report.disturbance_comparison.iter().all(|group| {
        group
            .cases
            .iter()
            .any(|case| case.controller_id == "disturbance_optimized")
    }));
    let calm_disturbed_score = report
        .controller_comparison
        .iter()
        .filter(|row| {
            row.controller_id == "lag_lead" && row.model_kind == "hifi" && row.disturbance_enabled
        })
        .map(|row| row.score)
        .sum::<f64>()
        / 2.0;
    let disturbance_optimized_score = report
        .controller_comparison
        .iter()
        .filter(|row| {
            row.controller_id == "disturbance_optimized"
                && row.model_kind == "hifi"
                && row.disturbance_enabled
        })
        .map(|row| row.score)
        .sum::<f64>()
        / 2.0;
    assert!(disturbance_optimized_score < calm_disturbed_score);
    assert!(
        report
            .controller_comparison
            .iter()
            .filter(|row| row.model_kind == "hifi")
            .all(|row| row.max_rudder_deg <= report.model_boundary.max_rudder_deg + 1e-6)
    );
    assert!(
        report
            .segmented_identification
            .rudder_actuator
            .time_constant_s
            > 0.0
    );
    assert!(report.segmented_identification.hull_yaw.time_constant_s > 0.0);
    assert!(
        report
            .segmented_identification
            .hull_yaw
            .gain_yaw_rate_per_rudder_rad
            > 0.0
    );
    assert!(
        report
            .segmented_identification
            .disturbance_path
            .equivalent_rudder_gain_rad
            > 0.0
    );
    assert!(report.controller_comparison.iter().all(|row| {
        row.trace
            .iter()
            .all(|sample| sample.target_heading_deg.is_finite())
    }));
}
