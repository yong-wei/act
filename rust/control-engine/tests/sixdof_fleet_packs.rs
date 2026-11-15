use control_engine::sixdof::model_pack::{embedded_vessel_pack, PackActuators};
use control_engine::sixdof::session::{EnvironmentPreset, FleetSimulation, SessionConfiguration};
use control_engine::sixdof::{DestroyerCommands, DestroyerSixDofPlant, NoiseLevel, TruthState};

const VESSELS: [&str; 3] = ["cruise-adora", "icebreaker-xuelong2", "dredger-tianjing"];

fn configuration(vessel: &str) -> SessionConfiguration {
    SessionConfiguration {
        vessel: vessel.into(),
        parameter_version: "research-nominal-v1".into(),
        noise_level: NoiseLevel::N0,
        ..Default::default()
    }
}

#[test]
fn every_pack_closes_mass_single_cg_and_full_hull_restoring() {
    for vessel in VESSELS {
        let pack = embedded_vessel_pack(vessel, "research-nominal-v1").unwrap();
        assert_eq!(pack.manifest.vessel, vessel);
        let geometry = &pack.geometry;
        let hull = geometry.nonlinear_hydrostatics.as_ref().unwrap();
        let level_state = TruthState {
            quaternion: [1.0, 0.0, 0.0, 0.0],
            ..Default::default()
        };
        let level = hull.evaluate(&level_state, geometry.displacement_mass_kg, 1025.0);
        assert!((level.displaced_volume_m3 / geometry.displacement_volume_m3 - 1.0).abs() < 1e-9);
        assert!(
            level.restoring_body.iter().all(|value| value.abs() < 1e-3),
            "{vessel}"
        );
        let angle = 1e-5;
        let rolled = TruthState {
            quaternion: [(angle / 2.0_f64).cos(), (angle / 2.0_f64).sin(), 0.0, 0.0],
            ..Default::default()
        };
        let moment = hull
            .evaluate(&rolled, geometry.displacement_mass_kg, 1025.0)
            .restoring_body[3];
        let reference = geometry.hydrostatic_stiffness_si.unwrap()[3][3] * angle;
        assert!(
            (moment / reference - 1.0).abs() < 0.005,
            "{vessel} {moment} {reference}"
        );
        assert!(embedded_vessel_pack(vessel, "unregistered").is_err());
    }
}

#[test]
fn source_revisions_freeze_physical_pods_fins_and_aft_clearance() {
    for vessel in VESSELS {
        let pack = embedded_vessel_pack(vessel, "research-nominal-v1").unwrap();
        let PackActuators::Physical { system, .. } = &pack.actuators else {
            panic!("物理执行器组缺失")
        };
        assert_eq!(system.propulsors.len(), 2);
        match vessel {
            "cruise-adora" => {
                assert!(system
                    .propulsors
                    .iter()
                    .all(|propeller| propeller.azimuth.is_some()));
                assert_eq!(system.surfaces.len(), 2);
                for surface in &system.surfaces {
                    assert_eq!(surface.normal_body, [0.0, 0.0, 1.0]);
                    assert_eq!(surface.installation.position_body_m[1].abs(), 21.75);
                    assert!(surface.fin_servo_power.is_some());
                }
            }
            "icebreaker-xuelong2" => {
                assert!(system.surfaces.is_empty());
                for propeller in &system.propulsors {
                    assert_eq!(propeller.installation.position_body_m[0], -53.5);
                    assert_eq!(propeller.installation.position_body_m[1].abs(), 5.0);
                    assert_eq!(propeller.max_power_w, 7.5e6);
                }
            }
            "dredger-tianjing" => {
                assert!(system
                    .propulsors
                    .iter()
                    .all(|propeller| propeller.azimuth.is_none()));
                assert_eq!(system.surfaces.len(), 2);
                assert!(system
                    .propulsors
                    .iter()
                    .all(|propeller| propeller.installation.position_body_m[0] == -60.5));
                assert!(system
                    .surfaces
                    .iter()
                    .all(|surface| surface.installation.position_body_m[0] == -62.5));
            }
            _ => unreachable!(),
        }
    }
}

#[test]
fn stopped_dredger_keeps_finite_unforced_state_with_nonlinear_restoring() {
    let pack = embedded_vessel_pack("dredger-tianjing", "research-nominal-v1").unwrap();
    let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
    for _ in 0..120 {
        plant.step(DestroyerCommands::default()).unwrap();
    }
    assert!(plant
        .state()
        .position_ned
        .iter()
        .all(|value| value.abs() < 1e-9));
    assert!(plant
        .state()
        .body_velocity
        .iter()
        .all(|value| value.abs() < 1e-9));
    assert!(plant
        .last_dynamics()
        .unwrap()
        .nu_dot
        .iter()
        .all(|value| value.is_finite()));
}

#[test]
fn fleet_sessions_restore_future_without_sharing_physics_or_clocks() {
    let mut sessions: Vec<_> = VESSELS
        .iter()
        .map(|vessel| FleetSimulation::new(configuration(vessel)).unwrap())
        .collect();
    let untouched: Vec<_> = sessions
        .iter()
        .map(|session| session.snapshot_json().unwrap())
        .collect();
    sessions[0].advance(0.1, None).unwrap();
    assert_eq!(sessions[1].snapshot_json().unwrap(), untouched[1]);
    assert_eq!(sessions[2].snapshot_json().unwrap(), untouched[2]);
    for session in &mut sessions {
        session.advance(0.05, None).unwrap();
        let mut restored =
            FleetSimulation::from_snapshot_json(&session.snapshot_json().unwrap()).unwrap();
        session.advance(0.1, None).unwrap();
        restored.advance(0.1, None).unwrap();
        assert_eq!(
            session.snapshot_json().unwrap(),
            restored.snapshot_json().unwrap()
        );
    }
}

#[test]
fn symmetric_pod_heading_command_moves_real_azimuth_and_yaw() {
    use control_engine::sixdof::control_law::HeadingControlMode;
    for vessel in ["cruise-adora", "icebreaker-xuelong2"] {
        let mut session = FleetSimulation::new(configuration(vessel)).unwrap();
        let mut input = session.input().clone();
        input.control_mode = HeadingControlMode::P;
        input.pid.kp = 1.0;
        input.target_heading_deg = 10.0;
        session.advance(0.0, Some(input)).unwrap();
        for _ in 0..60 {
            session.advance(1.0 / 60.0, None).unwrap();
        }
        let frame: serde_json::Value =
            serde_json::from_str(&session.frame_json().unwrap()).unwrap();
        assert!(
            frame["heldCommands"]["shafts"][0]["azimuth_rad"]
                .as_f64()
                .unwrap()
                < 0.0
        );
        let angle = frame["truth"]["actuator_states"]["azimuth_angles_rad"][0]
            .as_f64()
            .unwrap();
        assert!(angle < 0.0 && angle > -10.1_f64.to_radians());
        assert!(
            frame["truth"]["body_velocity"][5].as_f64().unwrap() > 0.0,
            "{vessel}"
        );
    }
}

#[test]
fn pending_wind_projection_is_visible_before_a_new_vessel_run() {
    for vessel in VESSELS {
        let result = FleetSimulation::new(SessionConfiguration {
            environment: EnvironmentPreset::W1,
            ..configuration(vessel)
        });
        assert!(result.err().unwrap().contains("风载投影"));
    }
}
