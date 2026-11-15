use control_engine::sixdof::ice_contact::IceConfiguration;
use control_engine::sixdof::session::{FleetSimulation,SessionConfiguration};
use control_engine::sixdof::NoiseLevel;

fn configuration(thickness_m:f64)->SessionConfiguration {
    SessionConfiguration {vessel:"icebreaker-xuelong2".into(),parameter_version:"research-nominal-v3".into(),
        noise_level:NoiseLevel::N0,initial_position_ned:[145.0,0.0,0.0],initial_water_speed_mps:Some(1.0),
        ice:Some(IceConfiguration {thickness_m,flexural_strength_pa:500_000.0,
            friction_coefficient:0.1,contact_segments:64}),..Default::default()}
}

fn frame(simulation:&FleetSimulation)->serde_json::Value {
    serde_json::from_str(&simulation.frame_json().unwrap()).unwrap()
}

#[test]
fn source_waterline_contact_dissipates_energy_and_moves_finite_floes() {
    let mut ice=FleetSimulation::new(configuration(0.6)).unwrap();
    let mut open_configuration=configuration(0.6);
    open_configuration.ice=None;
    let mut open=FleetSimulation::new(open_configuration).unwrap();
    for _ in 0..20 {ice.advance(1.0,None).unwrap();open.advance(1.0,None).unwrap();}
    let actual=frame(&ice);
    let contact=&actual["iceContact"];
    println!("ice representative {}",serde_json::json!({"diagnostics":contact,
        "speed":actual["waterVelocityBody"][0],"openSpeed":frame(&open)["waterVelocityBody"][0],
        "attitude":actual["attitudeDeg"]}));
    assert!(contact["brokenAreaM2"].as_f64().unwrap()>0.0);
    assert!(contact["floeCount"].as_u64().unwrap()>0);
    let body=contact["contactBodyWorkJ"].as_f64().unwrap();
    let floe=contact["contactFloeWorkJ"].as_f64().unwrap();
    let dissipated=contact["crushingWorkJ"].as_f64().unwrap()+contact["frictionWorkJ"].as_f64().unwrap()
        +contact["fractureWorkJ"].as_f64().unwrap();
    assert!(dissipated>0.0);
    assert!((body+floe+dissipated).abs()<1e-6*dissipated.max(1.0));
    assert!(actual["waterVelocityBody"][0].as_f64().unwrap()<frame(&open)["waterVelocityBody"][0].as_f64().unwrap());
    let snapshot=ice.snapshot_json().unwrap();
    let mut recovered=FleetSimulation::from_snapshot_json(&snapshot).unwrap();
    ice.advance(0.5,None).unwrap();recovered.advance(0.5,None).unwrap();
    assert_eq!(ice.snapshot_json().unwrap(),recovered.snapshot_json().unwrap());
}

#[test]
fn ice_identity_and_plate_scale_are_bound_and_invalid_domains_fail() {
    let thin=configuration(0.3);
    let thick=configuration(0.9);
    let ratio=thick.ice.as_ref().unwrap().characteristic_length_m()/thin.ice.as_ref().unwrap().characteristic_length_m();
    assert!((ratio-3.0f64.powf(0.75)).abs()<1e-12);
    let thin=FleetSimulation::new(thin).unwrap();
    let thick=FleetSimulation::new(thick).unwrap();
    assert_ne!(frame(&thin)["parameterHash"],frame(&thick)["parameterHash"]);
    let mut invalid=configuration(0.1);
    assert!(FleetSimulation::new(invalid.clone()).is_err());
    invalid=configuration(0.6);
    invalid.environment=control_engine::sixdof::session::EnvironmentPreset::V1;
    assert!(FleetSimulation::new(invalid).is_err());
    let mut forged:serde_json::Value=serde_json::from_str(&thin.snapshot_json().unwrap()).unwrap();
    forged["plant"]["ice"]["frontsNorthM"][0]=serde_json::json!(100.0);
    assert!(FleetSimulation::from_snapshot_json(&forged.to_string()).is_err());
}

#[test]
fn open_water_frames_and_failed_ice_restore_preserve_atomic_state() {
    let mut simulation=FleetSimulation::new(configuration(0.6)).unwrap();
    let before=simulation.snapshot_json().unwrap();
    assert!(simulation.advance(f64::NAN,None).is_err());
    assert_eq!(before,simulation.snapshot_json().unwrap());
    simulation.advance(0.12,None).unwrap();
    let mut restored=FleetSimulation::from_snapshot_json(&simulation.snapshot_json().unwrap()).unwrap();
    simulation.advance(0.04,None).unwrap();simulation.advance(0.06,None).unwrap();
    restored.advance(0.1,None).unwrap();
    let mut a:serde_json::Value=serde_json::from_str(&simulation.snapshot_json().unwrap()).unwrap();
    let mut b:serde_json::Value=serde_json::from_str(&restored.snapshot_json().unwrap()).unwrap();
    a["accumulator_s"]=serde_json::json!(0.0);b["accumulator_s"]=serde_json::json!(0.0);
    assert_eq!(a,b);
}

#[test]
fn representative_thicknesses_preserve_resistance_direction() {
    let mut speeds=Vec::new();
    for thickness in [0.3,0.6,0.9] {
        let mut simulation=FleetSimulation::new(configuration(thickness)).unwrap();
        for _ in 0..60 {simulation.advance(1.0,None).unwrap();}
        let actual=frame(&simulation);
        let speed=actual["waterVelocityBody"][0].as_f64().unwrap();
        speeds.push(speed);
        println!("ice thickness {thickness} speed {speed} contact {}",actual["iceContact"]);
    }
    assert!(speeds[0]>speeds[1] && speeds[1]>speeds[2],"Thicker ice must increase the representative resistance: {speeds:?}");
}
