use control_engine::sixdof::full_qtf::{FullDifferenceQtf, QtfMeanCondition};
use control_engine::sixdof::wave::WaveField;

const METADATA: &str = include_str!("fixtures/semisub-qtf-runtime/metadata.json");
const COEFFICIENTS: &[u8] = include_bytes!("fixtures/semisub-qtf-runtime/qtf-f32le.bin");
const REFERENCE: &str = include_str!("fixtures/semisub-qtf-runtime/reference.json");

fn table() -> FullDifferenceQtf {
    FullDifferenceQtf::from_json_and_bytes(METADATA, COEFFICIENTS).unwrap()
}

#[test]
fn declared_equilibrium_pitch_rotates_each_complex_force_and_moment_pair() {
    let original = table();
    let mut metadata: serde_json::Value = serde_json::from_str(METADATA).unwrap();
    metadata["equilibrium_pitch_rad"] = serde_json::json!(0.4);
    let pitched = FullDifferenceQtf::from_json_and_bytes(&metadata.to_string(), COEFFICIENTS).unwrap();
    let frequencies = &original.metadata().frequencies_rad_s;
    let base = original.lookup_frd(frequencies[0], frequencies[1], 0.0, 0.0).unwrap();
    let actual = pitched.lookup_frd(frequencies[0], frequencies[1], 0.0, 0.0).unwrap();
    for offset in [0,3] {
        let expected_x = 0.4_f64.cos()*base[offset]-0.4_f64.sin()*base[offset+2];
        let expected_z = 0.4_f64.sin()*base[offset]+0.4_f64.cos()*base[offset+2];
        assert!((actual[offset]-expected_x).norm() < 1e-12*(1.0+expected_x.norm()));
        assert_eq!(actual[offset+1], base[offset+1]);
        assert!((actual[offset+2]-expected_z).norm() < 1e-12*(1.0+expected_z.norm()));
    }
}

fn condition(table: &FullDifferenceQtf) -> QtfMeanCondition<'_> {
    QtfMeanCondition { forward_speed_mps: 0.0, draft_m: 19.0, mesh_sha256: &table.metadata().mesh_sha256 }
}

fn content_hash(bytes: &[u8]) -> String {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash = (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3);
    }
    format!("fnv1a-{hash:016x}")
}

fn synthetic_table() -> FullDifferenceQtf {
    let mut metadata: serde_json::Value = serde_json::from_str(METADATA).unwrap();
    metadata["frequencies_rad_s"] = serde_json::json!([0.5, 1.0]);
    metadata["headings_rad_to"] = serde_json::json!([0.0, std::f64::consts::FRAC_PI_2]);
    metadata["periodic_headings"] = serde_json::json!(true);
    metadata["half_turn_symmetry"] = serde_json::json!(false);
    metadata["water_density_kg_m3"] = serde_json::json!(1.0);
    metadata["gravity_m_s2"] = serde_json::json!(1.0);
    let mut bytes = Vec::new();
    for _ in 0..(2 * 2 * 6) {
        for pair in 0..3 {
            let (real, imaginary) = if pair == 1 { (2.0_f32, 3.0_f32) } else { (4.0_f32, 0.0_f32) };
            bytes.extend(real.to_le_bytes());
            bytes.extend(imaginary.to_le_bytes());
        }
    }
    metadata["data_bytes"] = serde_json::json!(bytes.len());
    metadata["data_fnv1a64"] = serde_json::json!(content_hash(&bytes));
    FullDifferenceQtf::from_json_and_bytes(&metadata.to_string(), &bytes).unwrap()
}

fn synthetic_field() -> WaveField {
    serde_json::from_value(serde_json::json!({
        "components": [
            {"omega": 0.5, "k": 0.025, "amplitude": 0.3, "direction": 0.0, "phase": 0.1},
            {"omega": 1.0, "k": 0.1, "amplitude": 0.4, "direction": 0.0, "phase": 0.7}
        ],
        "condition": {"hs_m": 0.75, "tp_s": 7.0, "direction_to_deg": 0.0, "water_depth_m": 200.0},
        "second_order_available": true
    })).unwrap()
}

#[test]
fn actual_complex_table_matches_independent_four_dimensional_scipy_interpolation() {
    let table = table();
    let reference: serde_json::Value = serde_json::from_str(REFERENCE).unwrap();
    for case in reference["lookup_cases"].as_array().unwrap() {
        let input: Vec<_> = case["input"].as_array().unwrap().iter().map(|value| value.as_f64().unwrap()).collect();
        let actual = table.lookup_frd(input[0], input[1], input[2], input[3]).unwrap();
        for channel in 0..6 {
            let expected = &case["expected_si_real_imag"][channel];
            let expected_real = expected[0].as_f64().unwrap();
            let expected_imaginary = expected[1].as_f64().unwrap();
            assert!((actual[channel].re - expected_real).abs() < 1e-10 * (1.0 + expected_real.abs()));
            assert!((actual[channel].im - expected_imaginary).abs() < 1e-10 * (1.0 + expected_imaginary.abs()));
        }
    }
}

#[test]
fn prepared_real_form_matches_the_full_ordered_complex_double_sum() {
    let table = table();
    let reference: serde_json::Value = serde_json::from_str(REFERENCE).unwrap();
    let field: WaveField = serde_json::from_value(reference["field"].clone()).unwrap();
    let heading = reference["mean_heading_rad"].as_f64().unwrap();
    let prepared = table.prepare(&field, heading, condition(&table)).unwrap();
    assert_eq!(prepared.content_hash(), table.content_hash());
    assert_eq!(prepared.mean_heading_rad(), heading);
    for case in reference["force_cases"].as_array().unwrap() {
        let actual = prepared.evaluate(case["time_s"].as_f64().unwrap(),
            case["north_m"].as_f64().unwrap(), case["east_m"].as_f64().unwrap()).unwrap();
        for channel in 0..6 {
            let expected = case["expected_frd_si"][channel].as_f64().unwrap();
            assert!((actual[channel] - expected).abs() < 1e-10 * (1.0 + expected.abs()));
        }
    }
}

#[test]
fn bichromatic_phase_and_single_wave_mean_use_the_nemoh_normalization() {
    let table = synthetic_table();
    let field = synthetic_field();
    let prepared = table.prepare(&field, 0.0, condition(&table)).unwrap();
    let actual = prepared.evaluate(0.0, 0.0, 0.0).unwrap();
    let expected = 0.5 * 4.0 * (0.3 * 0.3 + 0.4 * 0.4)
        + 0.3 * 0.4 * (2.0 * 0.6_f64.cos() + 3.0 * 0.6_f64.sin());
    for channel in 0..6 {
        let sign = [1.0, -1.0, -1.0, 1.0, -1.0, -1.0][channel];
        assert!((actual[channel] - sign * expected).abs() < 1e-14);
    }
    let mut single = serde_json::to_value(field).unwrap();
    single["components"].as_array_mut().unwrap().truncate(1);
    let single: WaveField = serde_json::from_value(single).unwrap();
    let prepared = table.prepare(&single, 0.0, condition(&table)).unwrap();
    for time in [0.0, 1.3, 100.0] {
        // 单一速度势的Bernoulli均值ρ|V|²/4，对应Qdiag=ρ|V|²/2。
        assert!((prepared.evaluate(time, 0.0, 0.0).unwrap()[0] - 0.18).abs() < 1e-14);
    }
}

#[test]
fn frequency_reversal_conjugates_and_common_half_turn_rotates_all_six_channels() {
    let table = table();
    let a = table.lookup_frd(0.8, 0.6, -30.0_f64.to_radians(), -60.0_f64.to_radians()).unwrap();
    let reversed = table.lookup_frd(0.6, 0.8, -60.0_f64.to_radians(), -30.0_f64.to_radians()).unwrap();
    let rotated = table.lookup_frd(0.8, 0.6, 150.0_f64.to_radians(), 120.0_f64.to_radians()).unwrap();
    for channel in 0..6 {
        assert!((a[channel] - reversed[channel].conj()).norm() < 1e-12 * (1.0 + a[channel].norm()));
        let sign = [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0][channel];
        // 直接读两个实际计算的方向对，保留离线求解的对称性残差。
        assert!((rotated[channel] - sign * a[channel]).norm() < 2e-4 * (1.0 + a[channel].norm()));
    }
}

#[test]
fn missing_angular_pairs_and_outside_frequencies_return_explicit_errors() {
    let table = table();
    assert!(table.lookup_frd(0.8, 0.6, std::f64::consts::FRAC_PI_2, 3.0 * std::f64::consts::FRAC_PI_2).is_err());
    assert!(table.lookup_frd(0.19, 0.6, 0.0, 0.0).is_err());
    assert!(table.lookup_frd(0.8, 2.51, 0.0, 0.0).is_err());
    assert!(table.lookup_frd(f64::NAN, 0.6, 0.0, 0.0).is_err());
}

#[test]
fn mean_speed_depth_draft_and_mesh_are_bound_to_the_actual_source_case() {
    let table = table();
    let field = synthetic_field();
    assert!(table.prepare(&field, 0.0, QtfMeanCondition { forward_speed_mps: 0.5, ..condition(&table) }).is_err());
    assert!(table.prepare(&field, 0.0, QtfMeanCondition { draft_m: 18.0, ..condition(&table) }).is_err());
    assert!(table.prepare(&field, 0.0, QtfMeanCondition { mesh_sha256: "different", ..condition(&table) }).is_err());
    let mut changed = serde_json::to_value(field).unwrap();
    changed["condition"]["water_depth_m"] = serde_json::json!(40.0);
    let changed: WaveField = serde_json::from_value(changed).unwrap();
    assert!(table.prepare(&changed, 0.0, condition(&table)).is_err());
}

#[test]
fn binary_integrity_finite_values_and_metadata_identity_are_checked() {
    let mut bytes = COEFFICIENTS.to_vec();
    bytes[0] ^= 1;
    assert!(FullDifferenceQtf::from_json_and_bytes(METADATA, &bytes).is_err());
    let mut metadata: serde_json::Value = serde_json::from_str(METADATA).unwrap();
    bytes[..4].copy_from_slice(&f32::NAN.to_le_bytes());
    metadata["data_fnv1a64"] = serde_json::json!(content_hash(&bytes));
    assert!(FullDifferenceQtf::from_json_and_bytes(&metadata.to_string(), &bytes).is_err());
    metadata = serde_json::from_str(METADATA).unwrap();
    metadata["frequencies_rad_s"][0] = serde_json::json!(0.21);
    let changed = FullDifferenceQtf::from_json_and_bytes(&metadata.to_string(), COEFFICIENTS).unwrap();
    assert_ne!(changed.content_hash(), table().content_hash());
}
