use control_engine::sixdof::coupled_sloshing::CoupledSloshing;
use control_engine::sixdof::dynamics::{mass_matrix, solve_linear_6, AddedMassParams, RigidBodyParams};
use control_engine::sixdof::model_pack::{
    embedded_vessel_pack, embedded_vessel_pack_with_loading, load_model_pack, PackError, PackModel,
};
use control_engine::sixdof::session::{FleetSimulation, SessionConfiguration};
use control_engine::sixdof::{DestroyerSixDofPlant, NoiseLevel, TruthState};

const VERSION: &str = "research-nominal-v1";
const LOADINGS: [(&str, &[f64]); 2] = [
    ("lng-changheng", &[0.30, 0.70, 0.85, 0.95]),
    ("container-msc", &[0.20, 0.35, 0.60, 0.80, 0.90]),
];

fn rigid(pack: &PackModel) -> RigidBodyParams {
    let geometry = &pack.geometry;
    RigidBodyParams {
        mass_kg: geometry.displacement_mass_kg,
        inertia_about_cg: [
            [geometry.inertia_about_cg_kg_m2.ixx, 0.0, 0.0],
            [0.0, geometry.inertia_about_cg_kg_m2.iyy, 0.0],
            [0.0, 0.0, geometry.inertia_about_cg_kg_m2.izz],
        ],
    }
}

fn at_rest(pack: &PackModel) -> TruthState {
    let angle = pack.geometry.equilibrium_pitch_rad / 2.0;
    TruthState {
        quaternion: [angle.cos(), 0.0, angle.sin(), 0.0],
        ..Default::default()
    }
}

#[test]
fn all_loading_states_share_one_physical_hull_and_distinct_frozen_hashes() {
    for (vessel, ratios) in LOADINGS {
        let baseline = embedded_vessel_pack(vessel, VERSION).unwrap();
        let base = &baseline.geometry;
        let base_kg = base.center_of_mass_waterline_z_up_m.unwrap()[2]
            / base.equilibrium_pitch_rad.cos() + base.draft_m;
        let mut hashes = std::collections::HashSet::new();
        for ratio in ratios {
            let pack = embedded_vessel_pack_with_loading(vessel, VERSION, Some(*ratio)).unwrap();
            assert!(hashes.insert(pack.content_hash.clone()));
            let geometry = &pack.geometry;
            let kg = geometry.center_of_mass_waterline_z_up_m.unwrap()[2]
                / geometry.equilibrium_pitch_rad.cos() + geometry.draft_m;
            let hull = geometry.nonlinear_hydrostatics.as_ref().unwrap();
            let reference = base.nonlinear_hydrostatics.as_ref().unwrap();
            assert_eq!(hull.triangles, reference.triangles);
            for (point, original) in hull.vertices_body_m.iter().zip(&reference.vertices_body_m) {
                assert_eq!(point[..2], original[..2]);
                assert!(((point[2]-kg)-(original[2]-base_kg)).abs() < 2e-12);
            }
            assert!((geometry.displacement_volume_m3*1025.0/geometry.displacement_mass_kg-1.0).abs() < 1e-8);
        }
    }
    for (vessel, ratio) in [("lng-changheng", 0.85), ("container-msc", 0.6)] {
        assert_eq!(embedded_vessel_pack(vessel, VERSION).unwrap().content_hash,
            embedded_vessel_pack_with_loading(vessel, VERSION, Some(ratio)).unwrap().content_hash);
    }
}

#[test]
fn coupled_lng_static_trim_and_modal_equilibria_close_at_every_fill() {
    for ratio in LOADINGS[0].1 {
        let pack = embedded_vessel_pack_with_loading("lng-changheng", VERSION, Some(*ratio)).unwrap();
        let geometry = &pack.geometry;
        let rigid = rigid(&pack);
        let mass = mass_matrix(&rigid, &AddedMassParams { a_inf: [[0.0; 6]; 6] });
        let liquid = CoupledSloshing::new(&geometry.liquid_tanks, &rigid, mass).unwrap();
        assert_eq!(liquid.modes.len(), 8);
        assert!((liquid.partition.liquid_mass_kg-4.0*44.0*38.0*26.0*ratio*450.0).abs() < 1e-7);
        assert!(liquid.partition.fixed_mass_kg >= 50e6-1e-7);
        let state = at_rest(&pack);
        let restoring = geometry.nonlinear_hydrostatics.as_ref().unwrap()
            .evaluate(&state, rigid.mass_kg, 1025.0).restoring_body;
        let mut matrix = mass;
        let base_acceleration = solve_linear_6(&mut matrix, restoring.map(|value| -value));
        let coupled = liquid.evaluate(&state, &geometry.liquid_initial_state, base_acceleration).unwrap();
        assert!(coupled.body_acceleration.iter().all(|value| value.abs() < 1e-8), "{ratio}");
        assert!(coupled.modal_derivatives.iter().all(|value| value.abs() < 1e-8), "{ratio}");
        assert!(coupled.within_small_amplitude);
    }
}

#[test]
fn effective_lng_gm_is_two_point_five_after_one_free_surface_correction() {
    let pack = embedded_vessel_pack("lng-changheng", VERSION).unwrap();
    let geometry = &pack.geometry;
    let rigid = rigid(&pack);
    let mass = mass_matrix(&rigid, &AddedMassParams { a_inf: [[0.0; 6]; 6] });
    let liquid = CoupledSloshing::new(&geometry.liquid_tanks, &rigid, mass).unwrap();
    let correction: f64 = liquid.modes.iter().filter(|mode| mode.direction_body[1] == 1.0)
        .map(|installed| installed.mode.reaction_coupling.powi(2)*9.81
            /(installed.mode.modal_mass*installed.mode.omega_n.powi(2)*rigid.mass_kg)).sum();
    let geometric = geometry.hydrostatic_stiffness_si.unwrap()[3][3]/(rigid.mass_kg*9.81);
    assert!((geometric-correction-2.5).abs() < 1e-11);
    assert!((correction-3.063340086027068).abs() < 1e-11);
    let angle: f64 = 0.001;
    let rolled = TruthState { quaternion: [(angle/2.0).cos(), (angle/2.0).sin(), 0.0, 0.0], ..Default::default() };
    let q: Vec<_> = liquid.modes.iter().flat_map(|mode| {
        let projection = mode.direction_body[1]*angle.sin();
        [mode.mode.reaction_coupling*9.81*projection/(mode.mode.modal_mass*mode.mode.omega_n.powi(2)), 0.0]
    }).collect();
    let hull = geometry.nonlinear_hydrostatics.as_ref().unwrap();
    let level = hull.evaluate(&at_rest(&pack), rigid.mass_kg, 1025.0).potential_energy_j;
    let energy = hull.evaluate(&rolled, rigid.mass_kg, 1025.0).potential_energy_j-level
        +liquid.modal_energy_j(&rolled, &q).unwrap();
    assert!((energy/(0.5*rigid.mass_kg*9.81*2.5*angle.powi(2))-1.0).abs() < 0.005);
}

#[test]
fn container_high_load_is_stable_with_actual_hold_distribution_and_fixed_mass() {
    let table: serde_json::Value = serde_json::from_str(include_str!(
        "../model-data/container-msc/v1/loading-cases.json")).unwrap();
    let base: serde_json::Value = serde_json::from_str(include_str!(
        "../model-data/container-msc/v1/geometry.json")).unwrap();
    for case in table["cases"].as_array().unwrap() {
        let ratio = case["loading_ratio"].as_f64().unwrap();
        let pack = embedded_vessel_pack_with_loading("container-msc", VERSION, Some(ratio)).unwrap();
        let loading = &case["geometry"]["loading"];
        for field in ["fixed_mass", "fixed_center", "fixed_inertia"] {
            assert_eq!(loading[field], base["loading"][field]);
        }
        let ballast = loading["ballast_mass"].as_f64().unwrap();
        assert!((pack.geometry.displacement_mass_kg-(72e6+240e6*ratio+ballast)).abs() < 1e-6);
        let groups = &loading["cargo_groups"];
        assert!((groups["deck_mass_kg"].as_f64().unwrap()-0.8*240e6*ratio.min(0.6)).abs() < 1e-6);
        assert!(loading["disk_top_immersion_m"].as_f64().unwrap() >= 0.5-1e-8);
        let state = at_rest(&pack);
        let restoring = pack.geometry.nonlinear_hydrostatics.as_ref().unwrap()
            .evaluate(&state, pack.geometry.displacement_mass_kg, 1025.0).restoring_body;
        assert!(restoring.iter().all(|value| value.abs() < 0.1));
        assert!(pack.geometry.hydrostatic_stiffness_si.unwrap()[3][3] > 0.0);
    }
    let high = embedded_vessel_pack_with_loading("container-msc", VERSION, Some(0.9)).unwrap();
    let gm = high.geometry.hydrostatic_stiffness_si.unwrap()[3][3]/(high.geometry.displacement_mass_kg*9.81);
    assert!((gm-1.164064119950158).abs() < 1e-10);
}

#[test]
fn maximum_container_load_respects_sixty_five_mw_and_keeps_actual_initial_deceleration() {
    use control_engine::sixdof::actuator_system::{ActuatorCommands, ShaftCommand, SurfaceCommand};
    use control_engine::sixdof::model_pack::PackActuators;
    let pack = embedded_vessel_pack_with_loading("container-msc", VERSION, Some(0.9)).unwrap();
    let PackActuators::Physical { system, initial_state } = &pack.actuators else { panic!("需要实际执行器") };
    let initial_power = initial_state.motor_torques_nm[0]*initial_state.propeller_shaft_speed_rad_s[0];
    assert!((initial_power-65e6).abs() < 1e-6);
    assert_eq!(system.propulsors[0].max_power_w, 65e6);
    let commands = ActuatorCommands {
        shafts: vec![ShaftCommand { speed_reference_rad_s: initial_state.shaft_reference_speed_rad_s[0], ..Default::default() }],
        surfaces: vec![SurfaceCommand { enabled: true, ..Default::default() }],
    };
    let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
    assert_eq!(plant.state().body_velocity[0], 8.0);
    plant.step_with_actuators(1.0/120.0, &commands).unwrap();
    assert!(plant.state().body_velocity[0] < 8.0);
    assert!(plant.last_dynamics().unwrap().nu_dot[0] < 0.0);
    let actual = &plant.state().actuator_states;
    assert!(actual.motor_torques_nm[0]*actual.propeller_shaft_speed_rad_s[0] <= 65e6*(1.0+1e-12));
}

#[test]
fn actual_loaded_sessions_restore_complete_future_and_preserve_initial_liquid_state() {
    for (vessel, ratios) in LOADINGS {
        for ratio in ratios {
            let configuration = SessionConfiguration { vessel: vessel.into(), parameter_version: VERSION.into(),
                loading_ratio: Some(*ratio), noise_level: NoiseLevel::N0, ..Default::default() };
            let pack = embedded_vessel_pack_with_loading(vessel, VERSION, Some(*ratio)).unwrap();
            let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
            assert_eq!(plant.state().specialist_states, pack.geometry.liquid_initial_state);
            let mut missing_liquid_state = plant.state().clone();
            missing_liquid_state.specialist_states.clear();
            plant.restore_state(missing_liquid_state);
            assert_eq!(plant.state().specialist_states, pack.geometry.liquid_initial_state);
            let mut session = FleetSimulation::new(configuration).unwrap();
            session.advance(0.1, None).unwrap();
            let snapshot = session.snapshot_json().unwrap();
            let mut restored = FleetSimulation::from_snapshot_json(&snapshot).unwrap();
            session.advance(0.1, None).unwrap();
            restored.advance(0.1, None).unwrap();
            assert_eq!(session.snapshot_json().unwrap(), restored.snapshot_json().unwrap(), "{vessel} {ratio}");
            let saved: serde_json::Value = serde_json::from_str(&snapshot).unwrap();
            assert_eq!(saved["configuration"]["loadingRatio"].as_f64().unwrap(), *ratio);
        }
    }
}

#[test]
fn unregistered_loadings_and_unbalanced_liquid_initialization_are_rejected() {
    for ratio in [f64::NAN, -0.1, 0.0, 0.5, 1.1] {
        assert!(embedded_vessel_pack_with_loading("lng-changheng", VERSION, Some(ratio)).is_err());
    }
    assert!(embedded_vessel_pack_with_loading("destroyer-055", "research-nominal-v4", Some(0.85)).is_err());
    let mut geometry: serde_json::Value = serde_json::from_str(include_str!(
        "../model-data/lng-changheng/v1/geometry.json")).unwrap();
    geometry["liquid_initial_state"][0] = serde_json::json!(0.1);
    let result = load_model_pack(include_str!("../model-data/lng-changheng/v1/manifest.json"),
        &geometry.to_string(), include_str!("../model-data/lng-changheng/v1/maneuvering.json"),
        include_str!("../model-data/lng-changheng/v1/actuators.json"),
        include_str!("../model-data/lng-changheng/v1/provenance.json"));
    assert!(matches!(result, Err(PackError::InvalidLiquidTank { .. })));
}
