use control_engine::sixdof::destroyer_plant::DestroyerSixDofPlant;
use control_engine::sixdof::environment_state::EnvironmentState;
use control_engine::sixdof::first_order_wave::FirstOrderExcitation;
use control_engine::sixdof::full_qtf::FullDifferenceQtf;
use control_engine::sixdof::model_pack::{PackGeometry, embedded_vessel_pack};
use control_engine::sixdof::session::{FleetSimulation, SessionConfiguration};
use control_engine::sixdof::vessel_wave::{WaveModelAssets, WaveModelBinding};
use control_engine::sixdof::wave::WaveField;
use control_engine::sixdof::wind::WindHullGeometry;
use num_complex::Complex64;

const FIRST: &str = include_str!("../model-data/semisub-981/v4/first-order-wave.json");
const DATA: &[u8] = include_bytes!(
    "../../../docs/research/fleet-hydrodynamics/semisub-first-order-runtime-validation/excitation-f32le.bin"
);
const QTF_TEMPLATE: &str = include_str!("fixtures/semisub-qtf-runtime/metadata.json");

fn hash(bytes: &[u8]) -> String {
    let mut value = 0xcbf29ce484222325_u64;
    for byte in bytes {
        value = (value ^ u64::from(*byte)).wrapping_mul(0x100000001b3);
    }
    format!("fnv1a-{value:016x}")
}

fn field() -> WaveField {
    serde_json::from_value(serde_json::json!({
        "components": [
            {"omega":0.5,"k":0.03,"amplitude":0.2,"direction":0.3,"phase":0.1},
            {"omega":1.0,"k":0.1,"amplitude":0.3,"direction":1.0,"phase":0.7},
            {"omega":2.0,"k":0.4,"amplitude":0.1,"direction":2.0,"phase":1.7}],
        "condition":{"hs_m":0.75,"tp_s":7.0,"direction_to_deg":90.0,"water_depth_m":200.0},
        "second_order_available":true
    }))
    .unwrap()
}

fn constant_qtf() -> FullDifferenceQtf {
    let mut metadata: serde_json::Value = serde_json::from_str(QTF_TEMPLATE).unwrap();
    let first: serde_json::Value = serde_json::from_str(FIRST).unwrap();
    metadata["frequencies_rad_s"] = serde_json::json!([0.2, 2.5]);
    metadata["headings_rad_to"] = serde_json::json!([0.0, std::f64::consts::PI]);
    metadata["periodic_headings"] = serde_json::json!(true);
    metadata["half_turn_symmetry"] = serde_json::json!(false);
    metadata["sample_only"] = serde_json::json!(false);
    metadata["rigid_condition"] = first["rigid_condition"].clone();
    metadata["equilibrium_pitch_rad"] = serde_json::json!(0.0);
    metadata["contributions"] = serde_json::json!("analytic constant complete-grid fixture");
    let mut bytes = Vec::new();
    for _ in 0..4 {
        for channel in 0..6 {
            for _ in 0..3 {
                bytes.extend(((channel + 1) as f32).to_le_bytes());
                bytes.extend(0.0_f32.to_le_bytes());
            }
        }
    }
    metadata["data_bytes"] = serde_json::json!(bytes.len());
    metadata["data_fnv1a64"] = serde_json::json!(hash(&bytes));
    FullDifferenceQtf::from_json_and_bytes(&metadata.to_string(), &bytes).unwrap()
}

fn assets_and_binding() -> (WaveModelAssets, WaveModelBinding) {
    let pack = embedded_vessel_pack("semisub-981", "research-nominal-v4").unwrap();
    let mut binding = pack.geometry.wave_model.unwrap();
    let second = constant_qtf();
    binding.full_difference_metadata_fnv1a64 = Some(second.metadata_bytes_hash().into());
    (
        WaveModelAssets {
            first_order: FirstOrderExcitation::from_json_and_bytes(FIRST, DATA).unwrap(),
            full_difference: Some(second),
        },
        binding,
    )
}

fn geometry() -> PackGeometry {
    embedded_vessel_pack("semisub-981", "research-nominal-v4")
        .unwrap()
        .geometry
}

#[test]
fn complete_difference_terms_follow_the_same_phasors_and_switch_independently() {
    let (assets, binding) = assets_and_binding();
    let field = field();
    let geometry = geometry();
    let on = assets
        .compile("semisub-981", &binding, &geometry, &field, 0.0, true)
        .unwrap();
    let off = assets
        .compile("semisub-981", &binding, &geometry, &field, 0.0, false)
        .unwrap();
    let time = 0.7;
    let (first, second) = on.loads(time, [0.0; 3], [1.0, 0.0, 0.0, 0.0]).unwrap();
    let without = off.loads(time, [0.0; 3], [1.0, 0.0, 0.0, 0.0]).unwrap();
    assert_eq!(first, without.0);
    assert_eq!(without.1, [0.0; 6]);
    let serialized = serde_json::to_value(&field).unwrap();
    let phasor: Complex64 = serialized["components"]
        .as_array()
        .unwrap()
        .iter()
        .map(|component| {
            Complex64::from_polar(
                component["amplitude"].as_f64().unwrap(),
                -(component["omega"].as_f64().unwrap() * time
                    + component["phase"].as_f64().unwrap()),
            )
        })
        .sum();
    for channel in 0..6 {
        let expected = 0.5
            * phasor.norm_sqr()
            * 1025.0
            * 9.81
            * (channel + 1) as f64
            * [1.0, -1.0, -1.0, 1.0, -1.0, -1.0][channel];
        assert!((second[channel] - expected).abs() < 1e-10 * (1.0 + expected.abs()));
    }
}

#[test]
fn payload_identity_and_each_rigid_loading_condition_are_checked_at_compilation() {
    let (assets, mut binding) = assets_and_binding();
    let geometry = geometry();
    binding.first_order_metadata_fnv1a64 = "fnv1a-0000000000000000".into();
    assert!(
        assets
            .compile("semisub-981", &binding, &geometry, &field(), 0.0, false)
            .is_err()
    );
    for name in ["mass", "center", "inertia", "missing", "vessel", "draft"] {
        let (mut assets, mut binding) = assets_and_binding();
        let mut metadata: serde_json::Value = serde_json::from_str(FIRST).unwrap();
        match name {
            "mass" => metadata["rigid_condition"]["mass_kg"] = serde_json::json!(1.0),
            "center" => {
                metadata["rigid_condition"]["center_of_mass_waterline_z_up_m"][0] =
                    serde_json::json!(1.0)
            }
            "inertia" => {
                metadata["rigid_condition"]["inertia_about_cg_kg_m2"][0] = serde_json::json!(1.0)
            }
            "missing" => metadata["rigid_condition"] = serde_json::Value::Null,
            "vessel" => metadata["vessel"] = serde_json::json!("another-vessel"),
            "draft" => metadata["draft_m"] = serde_json::json!(1.0),
            _ => unreachable!(),
        }
        assets.first_order =
            FirstOrderExcitation::from_json_and_bytes(&metadata.to_string(), DATA).unwrap();
        binding.first_order_metadata_fnv1a64 = assets.first_order.metadata_bytes_hash().into();
        assert!(
            assets
                .compile("semisub-981", &binding, &geometry, &field(), 0.0, false)
                .is_err(),
            "{name}"
        );
    }
}

#[test]
fn absent_data_unsupported_conditions_and_partial_qtf_are_rejected() {
    let (mut assets, mut binding) = assets_and_binding();
    let geometry = geometry();
    assets.full_difference = None;
    assert!(
        assets
            .compile("semisub-981", &binding, &geometry, &field(), 0.0, true)
            .is_err()
    );
    assert!(
        assets
            .compile("semisub-981", &binding, &geometry, &field(), 0.0, false)
            .is_ok()
    );
    let sample = FullDifferenceQtf::from_json_and_bytes(
        QTF_TEMPLATE,
        include_bytes!("fixtures/semisub-qtf-runtime/qtf-f32le.bin"),
    )
    .unwrap();
    binding.full_difference_metadata_fnv1a64 = Some(sample.metadata_bytes_hash().into());
    assets.full_difference = Some(sample);
    assert!(
        assets
            .compile("semisub-981", &binding, &geometry, &field(), 0.0, true)
            .is_err()
    );
    assert!(
        assets
            .compile("semisub-981", &binding, &geometry, &field(), 0.0, false)
            .is_err()
    );
    let (assets, mut binding) = assets_and_binding();
    binding.full_difference_metadata_fnv1a64 = Some("fnv1a-0000000000000000".into());
    assert!(
        assets
            .compile("semisub-981", &binding, &geometry, &field(), 0.0, false)
            .is_err()
    );
    binding.full_difference_metadata_fnv1a64 =
        Some(assets.full_difference.as_ref().unwrap().metadata_bytes_hash().into());
    binding.mean_forward_speed_mps = 0.001;
    assert!(
        assets
            .compile("semisub-981", &binding, &geometry, &field(), 0.0, false)
            .is_err()
    );
    let session = SessionConfiguration {
        vessel: "semisub-981".into(),
        parameter_version: "research-nominal-v4".into(),
        environment: control_engine::sixdof::session::EnvironmentPreset::V1,
        ..Default::default()
    };
    assert!(
        FleetSimulation::new(session)
            .err()
            .unwrap()
            .contains("尚未加载")
    );
}

#[test]
fn physical_rk_assembles_both_wave_orders_and_preserves_the_force_breakdown() {
    let pack = embedded_vessel_pack("semisub-981", "research-nominal-v4").unwrap();
    let (assets, binding) = assets_and_binding();
    let field = field();
    let model = assets
        .compile("semisub-981", &binding, &pack.geometry, &field, 0.0, true)
        .unwrap();
    let mut environment = EnvironmentState::calm(20261106);
    environment.switches.wave_enabled = true;
    environment.wave = field;
    let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
    plant.set_environment_state(
        environment,
        WindHullGeometry {
            frontal_area_m2: 1.0,
            lateral_area_m2: 1.0,
            length_m: 110.0,
            pressure_center_body: [0.0; 3],
        },
    );
    plant.configure_wave_model(model.clone());
    let commands = FleetSimulation::new(SessionConfiguration {
        vessel: "semisub-981".into(),
        parameter_version: "research-nominal-v4".into(),
        ..Default::default()
    })
    .unwrap()
    .input()
    .actuators
    .clone();
    for _ in 0..6 {
        plant.step_with_actuators(1.0 / 120.0, &commands).unwrap();
    }
    let output = plant.last_dynamics().unwrap();
    let external = output.external_components.unwrap();
    let expected = model
        .loads(
            plant.sim_time_s(),
            plant.state().position_ned,
            plant.state().quaternion,
        )
        .unwrap();
    assert_eq!(external.tau_wave_1, expected.0);
    assert_eq!(external.tau_wave_2, expected.1);
    assert!(external.tau_wave_1.iter().any(|value| value.abs() > 1.0));
    assert!(external.tau_wave_2.iter().any(|value| value.abs() > 1.0));
    assert!(
        plant
            .state()
            .body_velocity
            .iter()
            .any(|value| value.abs() > 1e-8)
    );
    for channel in 0..6 {
        let sum = external.tau_hull_viscous[channel]
            + external.tau_actuator[channel]
            + external.tau_wind[channel]
            + external.tau_wave_1[channel]
            + external.tau_wave_2[channel]
            + external.tau_special[channel];
        assert_eq!(output.breakdown.external[channel], sum);
    }
}

#[test]
fn other_monohulls_use_frozen_embedded_waves_through_the_normal_session() {
    for vessel in ["cruise-adora", "icebreaker-xuelong2", "dredger-tianjing"] {
        let mut simulation = FleetSimulation::new(SessionConfiguration {
            vessel: vessel.into(), parameter_version: "research-nominal-v3".into(),
            environment: control_engine::sixdof::session::EnvironmentPreset::V1,
            ..Default::default()
        }).unwrap();
        simulation.advance(0.2, None).unwrap();
        let frame: serde_json::Value = serde_json::from_str(&simulation.frame_json().unwrap()).unwrap();
        assert_eq!(frame["waveModel"]["firstOrderEnabled"], true);
        assert!(frame["dynamics"]["external_components"]["tau_wave_1"].as_array().unwrap()
            .iter().any(|value| value.as_f64().unwrap().abs() > 1.0));
        let saved = simulation.snapshot_json().unwrap();
        let mut restored = FleetSimulation::from_snapshot_json(&saved).unwrap();
        simulation.advance(0.1, None).unwrap(); restored.advance(0.1, None).unwrap();
        assert_eq!(simulation.snapshot_json().unwrap(), restored.snapshot_json().unwrap());
    }
}
