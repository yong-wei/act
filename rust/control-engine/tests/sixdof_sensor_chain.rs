use control_engine::sixdof::instrumentation::{
    ObservationTruth, SensorInstallations, SensorSignal, ideal_measurement,
};
use control_engine::sixdof::{EnvironmentState, TruthState};
use control_engine::sixdof::{FaultKind, NoiseLevel, Quality, SensorChannel};

#[test]
fn noise_levels_keep_sampling_and_apply_declared_delay() {
    for (level, delay) in [
        (NoiseLevel::N0, 0.0),
        (NoiseLevel::N1, 0.1),
        (NoiseLevel::N2, 0.2),
    ] {
        let mut channel = SensorChannel::new("heading_gyro", 17, level).unwrap();
        assert_eq!(channel.rate_hz(), 10.0);
        let samples = channel.advance_all(1.0, |time| (12.345678 + time, 0.0));
        assert_eq!(samples.len(), 11 - (delay * 10.0_f64).round() as usize);
        for sample in samples {
            assert!((sample.t_arrive_s - sample.t_sample_s - delay).abs() < 1e-12);
            if level == NoiseLevel::N0 {
                assert!((sample.value - 12.345678 - sample.t_sample_s).abs() < 1e-12);
            }
        }
    }
}

#[test]
fn serialized_queues_keep_rng_bias_missing_quality_and_all_pending_samples() {
    let mut original = SensorChannel::new("gnss_ne", 43, NoiseLevel::N2).unwrap();
    let empty = serde_json::to_string(&original).unwrap();
    original = serde_json::from_str(&empty).unwrap();
    original.set_fault(Some(FaultKind::GnssOutage {
        t_start: 1.0,
        t_end: 2.0,
    }));
    original.advance_all(1.1, |time| (time, 0.0));
    let snapshot = serde_json::to_string(&original).unwrap();
    assert!(snapshot.contains("\"value\":null"));
    let mut restored: SensorChannel = serde_json::from_str(&snapshot).unwrap();
    let first = original.advance_all(3.0, |time| (time, 0.0));
    let second = restored.advance_all(3.0, |time| (time, 0.0));
    assert_eq!(first.len(), second.len());
    for (left, right) in first.iter().zip(second) {
        assert_eq!(left.t_sample_s, right.t_sample_s);
        assert_eq!(left.t_arrive_s, right.t_arrive_s);
        assert_eq!(left.quality, right.quality);
        if left.quality == Quality::Missing {
            assert!(left.value.is_nan() && right.value.is_nan());
        } else {
            assert_eq!(left.value, right.value);
        }
    }
}

#[test]
fn wind_speed_remains_defined_when_direction_is_unavailable() {
    let mut speed = SensorChannel::new("wind_speed", 17, NoiseLevel::N0).unwrap();
    let mut direction = SensorChannel::new("wind_direction", 29, NoiseLevel::N0).unwrap();
    assert_eq!(
        speed.advance(0.0, |_| (0.2, 0.2)).unwrap().quality,
        Quality::Good
    );
    let undefined = direction.advance(0.0, |_| (60.0, 0.2)).unwrap();
    assert_eq!(undefined.quality, Quality::Undefined);
    assert!(undefined.value.is_nan());
    assert!(serde_json::to_value(undefined).unwrap()["value"].is_null());
    let valid = direction.advance(0.5, |_| (60.0, 8.0)).unwrap();
    assert_eq!(valid.quality, Quality::Good);
    assert_eq!(valid.value, 60.0);
}

#[test]
fn delayed_undefined_wind_direction_restores_the_complete_queue() {
    for level in [NoiseLevel::N1, NoiseLevel::N2] {
        let expected = SensorChannel::new("wind_direction", 29, level).unwrap();
        let mut original = expected.clone();
        assert!(original.advance_all(0.0, |_| (0.0, 0.0)).is_empty());
        let snapshot = serde_json::to_string(&original).unwrap();
        let mut restored: SensorChannel = serde_json::from_str(&snapshot).unwrap();
        restored.validate_checkpoint(&expected, 0.0).unwrap();
        let first = original.advance_all(0.5, |_| (60.0, 8.0));
        let second = restored.advance_all(0.5, |_| (60.0, 8.0));
        assert_eq!(serde_json::to_string(&first).unwrap(), serde_json::to_string(&second).unwrap());
    }
}

#[test]
fn batched_delivery_preserves_every_sample_at_low_render_rate() {
    let mut channel = SensorChannel::new("imu_pq", 17, NoiseLevel::N1).unwrap();
    let samples = channel.advance_all(1.0, |time| (time, 0.0));
    assert_eq!(samples.len(), 50);
    for pair in samples.windows(2) {
        assert!((pair[1].t_sample_s - pair[0].t_sample_s - 0.02).abs() < 1e-12);
    }
}

fn installations() -> SensorInstallations {
    SensorInstallations {
        gnss_body_m: [2.0, 3.0, -5.0],
        imu_body_m: [2.0, 3.0, 0.0],
        speed_log_body_m: [2.0, 3.0, 0.0],
        wind_body_m: [2.0, 3.0, -5.0],
        cg_waterline_height_m: -1.0,
    }
}

#[test]
fn gnss_axes_and_installed_speed_log_use_full_rigid_body_kinematics() {
    let yaw = std::f64::consts::PI / 2.0;
    let truth = ObservationTruth {
        time_s: 0.0,
        acceleration_body: [0.0; 6],
        state: TruthState {
            position_ned: [10.0, 20.0, 0.0],
            quaternion: [(yaw / 2.0).cos(), 0.0, 0.0, (yaw / 2.0).sin()],
            body_velocity: [8.0, 0.0, 0.0, 0.0, 0.0, 0.1],
            ..Default::default()
        },
    };
    let environment = EnvironmentState::calm(17);
    let north = ideal_measurement(SensorSignal::North, &installations(), &truth, &environment).0;
    let east = ideal_measurement(SensorSignal::East, &installations(), &truth, &environment).0;
    assert!((north - 7.0).abs() < 1e-12);
    assert!((east - 22.0).abs() < 1e-12);
    let speed = ideal_measurement(
        SensorSignal::SpeedLog,
        &installations(),
        &truth,
        &environment,
    )
    .0;
    assert!((speed - 7.7).abs() < 1e-12);
}

#[test]
fn imu_specific_force_removes_gravity_and_includes_installed_acceleration() {
    let mut truth = ObservationTruth {
        time_s: 0.0,
        acceleration_body: [0.0; 6],
        state: TruthState {
            quaternion: [1.0, 0.0, 0.0, 0.0],
            ..Default::default()
        },
    };
    let environment = EnvironmentState::calm(17);
    assert_eq!(
        ideal_measurement(
            SensorSignal::SpecificForceZ,
            &installations(),
            &truth,
            &environment
        )
        .0,
        -9.81
    );
    truth.state.body_velocity[5] = 2.0;
    truth.acceleration_body[5] = 0.5;
    assert!(
        (ideal_measurement(
            SensorSignal::SpecificForceX,
            &installations(),
            &truth,
            &environment
        )
        .0 + 9.5)
            .abs()
            < 1e-12
    );
    assert!(
        (ideal_measurement(
            SensorSignal::SpecificForceY,
            &installations(),
            &truth,
            &environment
        )
        .0 + 11.0)
            .abs()
            < 1e-12
    );
    let roll = std::f64::consts::PI / 2.0;
    truth.state.body_velocity.fill(0.0);
    truth.acceleration_body.fill(0.0);
    truth.state.quaternion = [(roll / 2.0).cos(), (roll / 2.0).sin(), 0.0, 0.0];
    assert!(
        (ideal_measurement(
            SensorSignal::SpecificForceY,
            &installations(),
            &truth,
            &environment
        )
        .0 + 9.81)
            .abs()
            < 1e-12
    );
    assert!(
        ideal_measurement(
            SensorSignal::SpecificForceZ,
            &installations(),
            &truth,
            &environment
        )
        .0
        .abs()
            < 1e-12
    );
}
