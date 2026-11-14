use control_engine::sixdof::model_pack::embedded_vessel_pack;
use control_engine::sixdof::session::{EnvironmentPreset, FleetSimulation, SessionConfiguration};
use control_engine::sixdof::sensor::NoiseLevel;

const VERSIONS: [(&str, &str); 5] = [
    ("destroyer-055", "research-nominal-v5"),
    ("cruise-adora", "research-nominal-v2"),
    ("icebreaker-xuelong2", "research-nominal-v2"),
    ("dredger-tianjing", "research-nominal-v2"),
    ("semisub-981", "research-nominal-v3"),
];

#[test]
fn fitted_packs_load_six_channel_models_and_declare_their_source_artifacts() {
    for (vessel, version) in VERSIONS {
        let pack = embedded_vessel_pack(vessel, version).unwrap();
        let radiation = pack.geometry.passive_radiation.as_ref().unwrap();
        radiation.validate().unwrap();
        pack.geometry.wind_model.as_ref().unwrap().validate().unwrap();
        assert!(radiation.state_len() >= 100);
        assert_eq!(pack.manifest.model_version, version);
        let directory = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("model-data")
            .join(vessel).join(version.strip_prefix("research-nominal-").unwrap());
        let manifest: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(directory.join("manifest.json")).unwrap()).unwrap();
        assert!(manifest["files_sha256"].as_object().unwrap().contains_key("wind-validation.json"));
        assert!(manifest["files_sha256"].as_object().unwrap().contains_key("radiation-fit-arrays.npz"));
    }
}

#[test]
fn all_fitted_vessels_run_w1_w2_and_restore_the_complete_random_and_physical_future() {
    for (vessel, version) in VERSIONS {
        for environment in [EnvironmentPreset::W1, EnvironmentPreset::W2] {
            let configuration = SessionConfiguration { vessel: vessel.into(), parameter_version: version.into(),
                environment, noise_level: NoiseLevel::N0, ..Default::default() };
            let mut simulation = FleetSimulation::new(configuration.clone()).unwrap();
            for _ in 0..10 { simulation.advance(0.05, None).unwrap(); }
            let checkpoint = simulation.snapshot_json().unwrap();
            let mut restored = FleetSimulation::from_snapshot_json(&checkpoint).unwrap();
            for _ in 0..10 {
                simulation.advance(0.05, None).unwrap();
                restored.advance(0.05, None).unwrap();
            }
            assert_eq!(simulation.snapshot_json().unwrap(), restored.snapshot_json().unwrap(), "{vessel}");
            let frame: serde_json::Value = serde_json::from_str(&simulation.frame_json().unwrap()).unwrap();
            let wind = frame["dynamics"]["external_components"]["tau_wind"].as_array().unwrap();
            assert!(wind.iter().any(|value| value.as_f64().unwrap().abs() > 1.0), "{vessel}");
            let radiation_states = frame["truth"]["radiation_states"].as_array().unwrap();
            assert!(radiation_states.len() >= 100);
            assert!(radiation_states.iter().all(|value| value.as_f64().unwrap().is_finite()));
        }
    }
}
