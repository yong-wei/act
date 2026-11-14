use control_engine::sixdof::model_pack::{
    embedded_vessel_pack_with_loading, embedded_vessel_pack_with_water_depth,
};
use control_engine::sixdof::session::{BerthConfiguration, FleetSimulation, SessionConfiguration};

#[test]
fn every_loading_and_depth_selects_its_fitted_matrix_without_changing_rigid_loading() {
    let mut hashes = Vec::new();
    for ratio in [0.3, 0.7, 0.85, 0.95] {
        let original =
            embedded_vessel_pack_with_loading("lng-changheng", "research-nominal-v1", Some(ratio))
                .unwrap();
        for depth in [40.0, 200.0] {
            let pack = embedded_vessel_pack_with_water_depth(
                "lng-changheng",
                "research-nominal-v2",
                Some(ratio),
                Some(depth),
            )
            .unwrap();
            assert_eq!(pack.geometry.hydrodynamic_depth_m, Some(depth));
            assert_eq!(
                pack.geometry.displacement_mass_kg,
                original.geometry.displacement_mass_kg
            );
            assert_eq!(
                pack.geometry.center_of_mass_waterline_z_up_m,
                original.geometry.center_of_mass_waterline_z_up_m
            );
            assert_eq!(
                pack.geometry.liquid_initial_state,
                original.geometry.liquid_initial_state
            );
            assert_eq!(
                pack.geometry.inertia_about_cg_kg_m2.ixx,
                original.geometry.inertia_about_cg_kg_m2.ixx
            );
            assert_eq!(
                pack.geometry.inertia_about_cg_kg_m2.iyy,
                original.geometry.inertia_about_cg_kg_m2.iyy
            );
            assert_eq!(
                pack.geometry.inertia_about_cg_kg_m2.izz,
                original.geometry.inertia_about_cg_kg_m2.izz
            );
            let radiation = pack.geometry.passive_radiation.as_ref().unwrap();
            assert_eq!(radiation.frequency_band_rad_s, [0.025, 2.5]);
            assert!(radiation.oscillators.len() >= 40);
            assert!(radiation.added_mass()[0][4].abs() > 1.0);
            assert!(pack.geometry.wind_model.is_some());
            hashes.push(pack.content_hash);
        }
    }
    hashes.sort();
    hashes.dedup();
    assert_eq!(hashes.len(), 8);
}

#[test]
fn explicit_default_conditions_have_the_same_identity_and_outside_states_are_rejected() {
    let implicit =
        embedded_vessel_pack_with_loading("lng-changheng", "research-nominal-v2", None).unwrap();
    let explicit = embedded_vessel_pack_with_water_depth(
        "lng-changheng",
        "research-nominal-v2",
        Some(0.85),
        Some(200.0),
    )
    .unwrap();
    assert_eq!(implicit.content_hash, explicit.content_hash);
    for depth in [0.0, -40.0, 20.0, 39.9, 60.0, 201.0, f64::NAN] {
        assert!(
            embedded_vessel_pack_with_water_depth(
                "lng-changheng",
                "research-nominal-v2",
                Some(0.85),
                Some(depth)
            )
            .is_err()
        );
    }
    assert!(
        embedded_vessel_pack_with_water_depth(
            "lng-changheng",
            "research-nominal-v2",
            Some(0.8),
            Some(40.0)
        )
        .is_err()
    );
    assert!(
        embedded_vessel_pack_with_water_depth(
            "lng-changheng",
            "research-nominal-v1",
            Some(0.85),
            Some(40.0)
        )
        .is_err()
    );
}

#[test]
fn the_normal_session_restores_each_depth_and_all_fitted_memory_states() {
    for ratio in [0.3, 0.7, 0.85, 0.95] {
        for depth in [40.0, 200.0] {
            let configuration = SessionConfiguration {
                vessel: "lng-changheng".into(),
                parameter_version: "research-nominal-v2".into(),
                loading_ratio: Some(ratio),
                water_depth_m: Some(depth),
                ..Default::default()
            };
            let mut simulation = FleetSimulation::new(configuration).unwrap();
            let mut input = simulation.input().clone();
            for surface in &mut input.actuators.surfaces {
                surface.angle_rad = 0.05;
            }
            simulation.advance(0.5, Some(input)).unwrap();
            let snapshot = simulation.snapshot_json().unwrap();
            let mut restored = FleetSimulation::from_snapshot_json(&snapshot).unwrap();
            simulation.advance(0.2, None).unwrap();
            restored.advance(0.2, None).unwrap();
            assert_eq!(
                simulation.snapshot_json().unwrap(),
                restored.snapshot_json().unwrap()
            );
            let frame: serde_json::Value =
                serde_json::from_str(&simulation.frame_json().unwrap()).unwrap();
            assert_eq!(frame["hydrodynamicDepthM"], depth);
            assert!(frame["truth"]["radiation_states"].as_array().unwrap().len() >= 80);
            let saved: serde_json::Value = serde_json::from_str(&snapshot).unwrap();
            assert_eq!(
                saved["plant"]["environment"]["wave"]["condition"]["water_depth_m"],
                depth
            );
        }
    }
}

#[test]
fn berth_scenarios_select_forty_meters_and_reject_a_conflicting_depth() {
    let configuration = SessionConfiguration {
        vessel: "lng-changheng".into(),
        parameter_version: "research-nominal-v2".into(),
        berth: Some(BerthConfiguration {
            stop_line_north_m: 0.0,
            initial_bow_distance_m: 1500.0,
        }),
        ..Default::default()
    };
    let simulation = FleetSimulation::new(configuration.clone()).unwrap();
    let frame: serde_json::Value = serde_json::from_str(&simulation.frame_json().unwrap()).unwrap();
    assert_eq!(frame["hydrodynamicDepthM"], 40.0);
    for depth in [200.0, f64::NAN, -1.0] {
        assert!(
            FleetSimulation::new(SessionConfiguration {
                water_depth_m: Some(depth),
                ..configuration.clone()
            })
            .is_err()
        );
    }
}
