use control_engine::sixdof::integrator::NOMINAL_DT;
use control_engine::sixdof::passive_observer::{PassiveObserver, PassiveObserverParameters};

fn observer() -> PassiveObserver {
    PassiveObserver::new(PassiveObserverParameters {
        mass_diagonal: [1.0; 3],
        damping_diagonal: [0.05; 3],
        wave_frequency_rad_s: 2.0 * std::f64::consts::PI / 8.0,
    })
    .unwrap()
}

#[test]
fn complete_observer_matches_independent_matrix_exponential() {
    let reference: serde_json::Value = serde_json::from_str(include_str!(
        "../../../docs/research/passive-observer/reference.json"
    ))
    .unwrap();
    let mut observer = observer();
    let mut ticks = 0;
    for (time, expected) in reference["times_s"]
        .as_array()
        .unwrap()
        .iter()
        .zip(reference["states"].as_array().unwrap())
    {
        let target_ticks = (time.as_f64().unwrap() / NOMINAL_DT).round() as usize;
        while ticks < target_ticks {
            observer
                .step(NOMINAL_DT, [Some(1.0), Some(0.0), Some(0.0)], [0.0; 3])
                .unwrap();
            ticks += 1;
        }
        let actual = [
            observer.wave_integral[0],
            observer.wave_motion[0],
            observer.position_heading[0],
            observer.bias_earth[0],
            observer.body_velocity[0],
        ];
        for (value, target) in actual.iter().zip(expected.as_array().unwrap()) {
            assert!(
                (value - target.as_f64().unwrap()).abs() < 1e-9,
                "独立矩阵指数对照 t={time}, {actual:?}"
            );
        }
    }
}

#[test]
fn north_east_measurements_remain_independent_and_missing_axes_predict() {
    let mut observer = observer();
    for _ in 0..180 * 120 {
        observer
            .step(NOMINAL_DT, [Some(5.0), Some(-11.0), Some(0.0)], [0.0; 3])
            .unwrap();
    }
    assert!((observer.position_heading[0] - 5.0).abs() < 0.001);
    assert!((observer.position_heading[1] + 11.0).abs() < 0.001);
    observer.parameters.damping_diagonal.fill(0.0);
    observer.bias_earth.fill(0.0);
    observer.body_velocity = [2.0, -0.5, 0.0];
    let previous = observer.position_heading;
    for _ in 0..120 {
        observer.step(NOMINAL_DT, [None; 3], [0.0; 3]).unwrap();
    }
    assert!((observer.position_heading[0] - previous[0] - 2.0).abs() < 1e-9);
    assert!((observer.position_heading[1] - previous[1] + 0.5).abs() < 1e-9);
}

#[test]
fn oscillator_suppresses_wave_motion_and_preserves_low_frequency_position() {
    let mut observer = observer();
    let mut values = Vec::new();
    for tick in 0..180 * 120 {
        let time = tick as f64 * NOMINAL_DT;
        let measurement = 1.0 + 1.5 * (observer.parameters.wave_frequency_rad_s * time).sin();
        observer
            .step(
                NOMINAL_DT,
                [Some(measurement), Some(0.0), Some(0.0)],
                [0.0; 3],
            )
            .unwrap();
        if time > 120.0 {
            values.push(observer.position_heading[0]);
        }
    }
    let mean = values.iter().sum::<f64>() / values.len() as f64;
    let rms = (values
        .iter()
        .map(|value| (value - mean).powi(2))
        .sum::<f64>()
        / values.len() as f64)
        .sqrt();
    assert!((mean - 1.0).abs() < 0.05, "低频均值 {mean}");
    assert!(rms < 0.3, "波频剩余RMS {rms}");
}

#[test]
fn shortest_heading_innovation_crosses_the_signed_pi_boundary() {
    let mut observer = observer();
    observer.position_heading[2] = 179.0_f64.to_radians();
    observer
        .step(
            NOMINAL_DT,
            [None, None, Some(-179.0_f64.to_radians())],
            [0.0; 3],
        )
        .unwrap();
    assert!(observer.position_heading[2] > 179.0_f64.to_radians());
    assert!(observer.position_heading[2] < 179.1_f64.to_radians());
}

#[test]
fn invalid_input_preserves_all_observer_state() {
    let mut observer = observer();
    let previous = serde_json::to_string(&observer).unwrap();
    assert!(
        observer
            .step(NOMINAL_DT, [Some(f64::NAN), None, None], [0.0; 3])
            .is_err()
    );
    assert_eq!(serde_json::to_string(&observer).unwrap(), previous);
    assert!(observer.step(0.05, [None; 3], [0.0; 3]).is_err());
}
