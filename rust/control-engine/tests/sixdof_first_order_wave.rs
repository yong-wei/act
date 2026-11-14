use control_engine::sixdof::first_order_wave::FirstOrderExcitation;
use control_engine::sixdof::wave::WaveField;
use num_complex::Complex64;

const METADATA: &str = include_str!("../../../docs/research/fleet-hydrodynamics/semisub-first-order-runtime-validation/metadata.json");
const DATA: &[u8] = include_bytes!("../../../docs/research/fleet-hydrodynamics/semisub-first-order-runtime-validation/excitation-f32le.bin");
const REFERENCE: &str = include_str!("../../../docs/research/fleet-hydrodynamics/semisub-first-order-runtime-validation/reference.json");

fn hash(bytes: &[u8]) -> String {
    let mut value = 0xcbf29ce484222325_u64;
    for byte in bytes {
        value = (value ^ u64::from(*byte)).wrapping_mul(0x100000001b3);
    }
    format!("fnv1a-{value:016x}")
}

fn synthetic(pitch: f64) -> (serde_json::Value, Vec<u8>) {
    let mut metadata: serde_json::Value = serde_json::from_str(METADATA).unwrap();
    metadata["frequencies_rad_s"] = serde_json::json!([0.5, 1.0]);
    metadata["headings_rad_to"] = serde_json::json!([0.0, std::f64::consts::PI]);
    metadata["forward_speeds_mps"] = serde_json::json!([0.0, 2.0]);
    metadata["equilibrium_pitch_rad"] = serde_json::json!(pitch);
    let mut data = Vec::new();
    for speed in [0.0, 2.0] {
        for frequency in [0.5, 1.0] {
            for heading in [0.0, std::f64::consts::PI] {
                for channel in 0..6 {
                    let real =
                        (10.0 * channel as f64 + 2.0 * speed + 3.0 * frequency + 5.0 * heading)
                            as f32;
                    let imaginary =
                        (-4.0 * channel as f64 + speed - frequency + 2.0 * heading) as f32;
                    data.extend(real.to_le_bytes());
                    data.extend(imaginary.to_le_bytes());
                }
            }
        }
    }
    metadata["data_bytes"] = serde_json::json!(data.len());
    metadata["data_fnv1a64"] = serde_json::json!(hash(&data));
    (metadata, data)
}

#[test]
fn source_bem_complex_coefficients_match_independent_scipy_with_periodic_headings() {
    let table = FirstOrderExcitation::from_json_and_bytes(METADATA, DATA).unwrap();
    let reference: serde_json::Value = serde_json::from_str(REFERENCE).unwrap();
    for case in reference["lookup_cases"].as_array().unwrap() {
        let input = case["input"].as_array().unwrap();
        let actual = table
            .lookup_body(
                input[0].as_f64().unwrap(),
                input[1].as_f64().unwrap(),
                input[2].as_f64().unwrap(),
            )
            .unwrap();
        for channel in 0..6 {
            let expected = &case["expected_real_imag"][channel];
            for (got, key) in [(actual[channel].re, 0), (actual[channel].im, 1)] {
                let value = expected[key].as_f64().unwrap();
                assert!((got - value).abs() < 1e-11 * (1.0 + value.abs()));
            }
        }
    }
    assert_eq!(table.metadata_bytes_hash(), hash(METADATA.as_bytes()));
}

#[test]
fn full_complex_phase_and_actual_pose_match_independent_space_and_quaternion_references() {
    let table = FirstOrderExcitation::from_json_and_bytes(METADATA, DATA).unwrap();
    let reference: serde_json::Value = serde_json::from_str(REFERENCE).unwrap();
    let field: WaveField = serde_json::from_value(reference["field"].clone()).unwrap();
    let prepared = table
        .prepare(&field, reference["mean_heading_rad"].as_f64().unwrap(), 0.0)
        .unwrap();
    for case in reference["force_cases"].as_array().unwrap() {
        let time = case["time_s"].as_f64().unwrap();
        let north = case["north_m"].as_f64().unwrap();
        let east = case["east_m"].as_f64().unwrap();
        let loads = prepared.evaluate(time, north, east).unwrap();
        let quaternion: [f64; 4] = serde_json::from_value(case["quaternion_wxyz"].clone()).unwrap();
        let body = prepared
            .evaluate_body(time, [north, east, 0.0], quaternion)
            .unwrap();
        for channel in 0..6 {
            let expected = case["expected_reference_frd_si"][channel].as_f64().unwrap();
            let expected_body = case["expected_body_frd_si"][channel].as_f64().unwrap();
            assert!((loads[channel] - expected).abs() < 1e-11 * (1.0 + expected.abs()));
            assert!((body[channel] - expected_body).abs() < 1e-11 * (1.0 + expected_body.abs()));
        }
    }
}

#[test]
fn multi_speed_interpolation_preserves_complex_signs_and_frozen_frequency_coordinates() {
    let (metadata, data) = synthetic(0.0);
    let table = FirstOrderExcitation::from_json_and_bytes(&metadata.to_string(), &data).unwrap();
    let heading = std::f64::consts::FRAC_PI_2;
    for direction in [heading, -heading] {
        let actual = table.lookup_body(0.75, direction, 1.0).unwrap();
        for channel in 0..6 {
            let expected = Complex64::new(
                10.0 * channel as f64 + 2.0 + 3.0 * 0.75 + 5.0 * heading,
                -4.0 * channel as f64 + 1.0 - 0.75 + 2.0 * heading,
            );
            let sign = [1.0, -1.0, -1.0, 1.0, -1.0, -1.0][channel];
            assert!((actual[channel] - sign * expected).norm() < 2e-6);
        }
    }
}

#[test]
fn equilibrium_pitch_rotates_both_force_and_moment_from_the_same_source_axes() {
    let (metadata, data) = synthetic(0.4);
    let table = FirstOrderExcitation::from_json_and_bytes(&metadata.to_string(), &data).unwrap();
    let (metadata, _) = synthetic(0.0);
    let unpitched =
        FirstOrderExcitation::from_json_and_bytes(&metadata.to_string(), &data).unwrap();
    let source = unpitched.lookup_body(0.75, -0.2, 1.0).unwrap();
    let pitched = table.lookup_body(0.75, -0.2, 1.0).unwrap();
    for offset in [0, 3] {
        let expected_x = 0.4_f64.cos() * source[offset] - 0.4_f64.sin() * source[offset + 2];
        let expected_z = 0.4_f64.sin() * source[offset] + 0.4_f64.cos() * source[offset + 2];
        assert!((pitched[offset] - expected_x).norm() < 1e-12);
        assert_eq!(pitched[offset + 1], source[offset + 1]);
        assert!((pitched[offset + 2] - expected_z).norm() < 1e-12);
    }
}

#[test]
fn incomplete_speed_depth_frequency_or_direction_domains_return_explicit_errors() {
    let table = FirstOrderExcitation::from_json_and_bytes(METADATA, DATA).unwrap();
    assert!(table.lookup_body(0.9, 0.0, 0.001).is_err());
    assert!(table.lookup_body(0.01, 0.0, 0.0).is_err());
    assert!(table.lookup_body(4.01, 0.0, 0.0).is_err());
    assert!(table.lookup_body(0.9, f64::NAN, 0.0).is_err());
    let field = WaveField::new(
        20261106,
        control_engine::sixdof::wave::WaveCondition::lng_berth(),
    );
    assert!(table.prepare(&field, 0.0, 0.0).is_err());
    let (mut metadata, data) = synthetic(0.0);
    metadata["periodic_headings"] = serde_json::json!(false);
    let partial = FirstOrderExcitation::from_json_and_bytes(&metadata.to_string(), &data).unwrap();
    assert!(partial.lookup_body(0.75, 0.1, 1.0).is_err());
}

#[test]
fn corrupted_or_nonfinite_data_and_invalid_runtime_poses_are_rejected() {
    let mut wrong_units: serde_json::Value = serde_json::from_str(METADATA).unwrap();
    wrong_units["gravity_m_s2"] = serde_json::json!(10.0);
    assert!(FirstOrderExcitation::from_json_and_bytes(&wrong_units.to_string(), DATA).is_err());
    let mut data = DATA.to_vec();
    data[0] ^= 1;
    assert!(FirstOrderExcitation::from_json_and_bytes(METADATA, &data).is_err());
    let (mut metadata, mut data) = synthetic(0.0);
    data[..4].copy_from_slice(&f32::NAN.to_le_bytes());
    metadata["data_fnv1a64"] = serde_json::json!(hash(&data));
    assert!(FirstOrderExcitation::from_json_and_bytes(&metadata.to_string(), &data).is_err());
    let table = FirstOrderExcitation::from_json_and_bytes(METADATA, DATA).unwrap();
    let field = WaveField::new(17, control_engine::sixdof::wave::WaveCondition::v1());
    let prepared = table.prepare(&field, 0.3, 0.0).unwrap();
    assert!(prepared.evaluate(f64::INFINITY, 0.0, 0.0).is_err());
    assert!(prepared
        .evaluate_body(0.0, [0.0, 0.0, f64::NAN], [1.0, 0.0, 0.0, 0.0])
        .is_err());
    assert!(prepared.evaluate_body(0.0, [0.0; 3], [0.0; 4]).is_err());
}
