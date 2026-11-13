use control_engine::sixdof::control_law::HeadingControlMode;
use control_engine::sixdof::model_pack::{PackActuators, embedded_vessel_pack};
use control_engine::sixdof::session::{EnvironmentPreset, FleetSimulation, SessionConfiguration};
use control_engine::sixdof::NoiseLevel;

fn session(environment: EnvironmentPreset) -> FleetSimulation {
    FleetSimulation::new(SessionConfiguration { vessel: "semisub-981".into(),
        parameter_version: "research-nominal-v1".into(), noise_level: NoiseLevel::N0,
        environment, ..Default::default() }).unwrap()
}

fn frame(session: &FleetSimulation) -> serde_json::Value {
    serde_json::from_str(&session.frame_json().unwrap()).unwrap()
}

#[test]
fn source_geometry_single_cg_and_complete_eight_pod_envelopes_are_frozen() {
    let pack = embedded_vessel_pack("semisub-981", "research-nominal-v1").unwrap();
    assert_eq!(pack.geometry.displacement_mass_kg, 53095000.0);
    assert!((pack.geometry.hydrostatic_stiffness_si.unwrap()[3][3] / (53095000.0 * 9.81) - 2.0).abs() < 1e-12);
    let cg = pack.geometry.center_of_mass_waterline_z_up_m.unwrap()[2];
    assert!((cg - 17.353925353925355).abs() < 1e-12);
    let PackActuators::Physical { system, .. } = pack.actuators else { panic!("实际轴系包"); };
    assert_eq!(system.propulsors.len(), 8);
    assert_eq!(system.surfaces.len(), 0);
    for propeller in system.propulsors {
        assert!(propeller.azimuth.is_some());
        assert_eq!(propeller.diameter_m, 4.5);
        assert_eq!(propeller.installation.reference_immersion_m, 22.0);
        assert!((propeller.installation.position_body_m[2] - 2.25 - (cg + 19.0) - 0.75).abs() < 1e-12);
    }
}

#[test]
fn mirrored_single_pod_commands_produce_opposite_actual_yaw_with_identical_surge() {
    let mut left = session(EnvironmentPreset::P0);
    let mut right = session(EnvironmentPreset::P0);
    for (simulation, index) in [(&mut left, 0), (&mut right, 1)] {
        let mut input = simulation.input().clone();
        input.actuators.shafts[index].speed_reference_rad_s = 3.0;
        simulation.advance(0.0, Some(input)).unwrap();
        for _ in 0..120 { simulation.advance(1.0 / 60.0, None).unwrap(); }
    }
    let left_frame = frame(&left);
    let right_frame = frame(&right);
    let a = left_frame["truth"]["body_velocity"][5].as_f64().unwrap();
    let b = right_frame["truth"]["body_velocity"][5].as_f64().unwrap();
    assert!(a > 1e-7 && b < -1e-7);
    assert!((a + b).abs() < 1e-9);
    let a = left_frame["truth"]["body_velocity"][0].as_f64().unwrap();
    let b = right_frame["truth"]["body_velocity"][0].as_f64().unwrap();
    assert!(a > 0.0);
    assert!((a - b).abs() < 1e-9);
    let mut restored = FleetSimulation::from_snapshot_json(&left.snapshot_json().unwrap()).unwrap();
    for _ in 0..60 {
        left.advance(1.0 / 60.0, None).unwrap();
        restored.advance(1.0 / 60.0, None).unwrap();
    }
    assert_eq!(left.snapshot_json().unwrap(), restored.snapshot_json().unwrap());
}

#[test]
fn calm_static_equilibrium_and_component_current_drag_reach_the_real_session() {
    let mut calm = session(EnvironmentPreset::P0);
    let mut current = session(EnvironmentPreset::C1);
    for _ in 0..60 {
        calm.advance(1.0 / 60.0, None).unwrap();
        current.advance(1.0 / 60.0, None).unwrap();
    }
    let calm = frame(&calm);
    assert!(calm["truth"]["body_velocity"].as_array().unwrap().iter().all(|value| value.as_f64().unwrap().abs() < 1e-8));
    let current = frame(&current);
    assert!(current["truth"]["position_ned"][1].as_f64().unwrap() > 0.0);
}

#[test]
fn unready_position_controller_is_explicit_and_rejected_without_session_changes() {
    let mut simulation = session(EnvironmentPreset::P0);
    let original = simulation.snapshot_json().unwrap();
    let mut input = simulation.input().clone();
    input.control_mode = HeadingControlMode::Pid;
    assert!(simulation.advance(0.1, Some(input)).unwrap_err().contains("定位控制模板"));
    assert_eq!(simulation.snapshot_json().unwrap(), original);
    let mut saved: serde_json::Value = serde_json::from_str(&original).unwrap();
    saved["input"]["controlMode"] = serde_json::json!("pid");
    assert!(FleetSimulation::from_snapshot_json(&saved.to_string()).is_err());
}
