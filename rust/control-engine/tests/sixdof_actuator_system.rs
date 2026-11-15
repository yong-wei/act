use control_engine::sixdof::actuator_system::{
    ActuatorCommands, AzimuthServo, ShaftCommand, SurfaceCommand,
    azimuth_path_error, finite_wing_coefficients,
};
use control_engine::sixdof::actuators::ServoModel;
use control_engine::sixdof::model_pack::{
    PackActuators, embedded_destroyer_055_v2, embedded_destroyer_055_v3,
};
use control_engine::sixdof::{DestroyerSixDofPlant, TruthState};
use control_engine::sixdof_runtime::compute_destroyer_sixdof_step_json;

fn plant_and_commands() -> (DestroyerSixDofPlant, ActuatorCommands) {
    let pack = embedded_destroyer_055_v2().unwrap();
    let plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
    let commands = ActuatorCommands {
        shafts: plant.state().actuator_states.shaft_reference_speed_rad_s.iter()
            .map(|reference| ShaftCommand { speed_reference_rad_s: *reference, ..Default::default() }).collect(),
        surfaces: vec![SurfaceCommand { enabled: true, ..Default::default() }; 2],
    };
    (plant, commands)
}

#[test]
fn versioned_pack_uses_fixed_dual_installations_and_single_kg() {
    let pack = embedded_destroyer_055_v2().unwrap();
    let PackActuators::Physical { system, initial_state } = &pack.actuators else { panic!("需要物理执行器组") };
    assert_eq!(system.propulsors.len(), 2);
    assert_eq!(system.surfaces.len(), 2);
    assert_eq!(pack.geometry.lpp_m, 171.0);
    assert_eq!(pack.geometry.cruise_speed_mps, Some(8.0));
    assert_eq!(system.propulsors[0].diameter_m, 5.0);
    assert_eq!(system.propulsors[0].max_power_w, 15e6);
    assert_eq!(system.propulsors[0].installation.reference_immersion_m, 3.5);
    assert!((system.propulsors[0].installation.position_body_m[1] + 3.6).abs() < 1e-12);
    assert!((system.propulsors[1].installation.position_body_m[1] - 3.6).abs() < 1e-12);
    let actual = initial_state.propeller_shaft_speed_rad_s[0];
    assert!(actual > 0.0 && actual < system.propulsors[0].rated_speed_rad_s);
    let expected_ixx = 13e6 * (0.35_f64 * 20.0).powi(2);
    assert_eq!(pack.geometry.inertia_about_cg_kg_m2.ixx, expected_ixx);
    assert_eq!(pack.geometry.hydrostatic_stiffness_si.unwrap()[3][3], 13e6 * 9.81 * 1.5);
}

#[test]
fn source_hull_revision_keeps_old_pack_and_freezes_clear_installation() {
    let previous = embedded_destroyer_055_v2().unwrap();
    let pack = embedded_destroyer_055_v3().unwrap();
    assert_ne!(pack.content_hash, previous.content_hash);
    assert_eq!(pack.manifest.model_version, "research-nominal-v3");
    assert_eq!(pack.geometry.loa_m, 180.0);
    assert_eq!(pack.geometry.lpp_m, 171.0);
    let PackActuators::Physical { system, .. } = &pack.actuators else { panic!("需要物理执行器组") };
    assert_eq!(system.propulsors[0].installation.position_body_m[0], -78.0);
    assert_eq!(system.surfaces[0].installation.position_body_m[0], -82.08);
    let stiffness = pack.geometry.hydrostatic_stiffness_si.unwrap();
    assert!(stiffness[2][4] > 0.0);
    assert_eq!(stiffness[2][4], stiffness[4][2]);
    let condensed_pitch = stiffness[4][4] - stiffness[2][4].powi(2) / stiffness[2][2];
    assert!(condensed_pitch > 0.0);
    assert_eq!(stiffness[3][3], 13e6 * 9.81 * 1.5);
    let proof: serde_json::Value = serde_json::from_str(include_str!(
        "../model-data/destroyer-055/v3/envelope-validation.json")).unwrap();
    assert_eq!(proof["status"], "passed");
    for resolution in proof["resolutions"].as_array().unwrap() {
        assert_eq!(resolution["static"]["watertight"], true);
        for propeller in resolution["revised_propeller_installation"].as_array().unwrap() {
            assert!(propeller["clearance_m"].as_f64().unwrap() > 0.04);
            assert_eq!(propeller["circumscribed_disk_clear"], true);
        }
    }
}

#[test]
fn source_hull_has_no_unforced_sixty_second_drift() {
    let pack = embedded_destroyer_055_v3().unwrap();
    let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
    let mut state = plant.state().clone();
    state.body_velocity.fill(0.0);
    state.radiation_states.fill(0.0);
    state.actuator_states.propeller_shaft_speed_rad_s.fill(0.0);
    state.actuator_states.shaft_reference_speed_rad_s.fill(0.0);
    state.actuator_states.motor_torques_nm.fill(0.0);
    state.actuator_states.motor_torque_demand_nm.fill(0.0);
    plant.restore_state(state);
    let commands = ActuatorCommands {
        shafts: vec![ShaftCommand::default(); 2],
        surfaces: vec![SurfaceCommand { enabled: true, ..Default::default() }; 2],
    };
    for _ in 0..120 { plant.step_with_actuators(0.5, &commands).unwrap(); }
    assert!(plant.state().position_ned.iter().all(|value| value.abs() < 1e-10));
    assert!(plant.state().body_velocity.iter().all(|value| value.abs() < 1e-10));
}

#[test]
fn source_revision_round_trips_through_normal_numerical_entry() {
    let mut state = serde_json::json!({"speedMps": 8.0});
    let mut manifest = serde_json::Value::Null;
    for frame in 0..2 {
        let raw = compute_destroyer_sixdof_step_json(&serde_json::json!({
            "parameterBundleVersion": "research-nominal-v3", "dtS": 0.5,
            "controlMode": "manual", "state": state,
        }).to_string()).unwrap();
        state = serde_json::from_str(&raw).unwrap();
        assert_eq!(state["runManifest"]["modelVersion"], "sixdof-destroyer-v3");
        assert_eq!(state["manifestReset"], frame == 0);
        if frame == 0 { manifest = state["runManifest"].clone(); }
        assert_eq!(state["runManifest"], manifest);
        assert!(state["runManifest"]["parameterBundleHash"].as_str().unwrap()
            .starts_with("research-nominal-v3@"));
        assert_eq!(state["sixdofState"]["actuatorStates"]["motor_torques_nm"].as_array().unwrap().len(), 2);
    }
}

#[test]
fn drive_cut_preserves_motor_lag_and_shaft_energy_balance() {
    let (mut plant, mut commands) = plant_and_commands();
    let original = plant.state().actuator_states.clone();
    let system = plant.actuator_system().unwrap().clone();
    for command in &mut commands.shafts { command.drive_cut = true; }
    plant.step_with_actuators(0.5, &commands).unwrap();
    let final_state = &plant.state().actuator_states;
    for index in 0..2 {
        let initial_torque = original.motor_torques_nm[index];
        let expected = initial_torque * (-1.0_f64).exp();
        assert!((final_state.motor_torques_nm[index] / expected - 1.0).abs() < 1e-8);
        assert!(final_state.propeller_shaft_speed_rad_s[index] < original.propeller_shaft_speed_rad_s[index]);
        assert!(final_state.propeller_shaft_speed_rad_s[index] > 0.0);
        let inertia = system.propulsors[index].shaft_inertia_kg_m2;
        let kinetic_change = 0.5 * inertia * (final_state.propeller_shaft_speed_rad_s[index].powi(2)
            - original.propeller_shaft_speed_rad_s[index].powi(2));
        let work = final_state.motor_work_j[index] - final_state.propeller_work_j[index]
            - final_state.shaft_friction_work_j[index];
        assert!((work - kinetic_change).abs() < kinetic_change.abs() * 1e-7);
        assert!(final_state.shaft_friction_work_j[index] > 0.0);
    }
    assert!(plant.state().body_velocity[0] > 7.5, "断电后船速按惯性演化");
}

#[test]
fn shaft_reference_slew_and_positive_power_limits_are_physical() {
    let (mut plant, mut commands) = plant_and_commands();
    let initial = plant.state().actuator_states.shaft_reference_speed_rad_s[0];
    commands.shafts.iter_mut().for_each(|command| command.speed_reference_rad_s = -100.0);
    plant.step_with_actuators(0.5, &commands).unwrap();
    let actual = plant.state().actuator_states.shaft_reference_speed_rad_s[0];
    assert!((initial - actual - 2.5 * std::f64::consts::PI / 30.0).abs() < 1e-10);
    let drive = &plant.actuator_system().unwrap().propulsors[0];
    for omega in [-50.0, -0.01, 0.0, 0.01, 50.0] {
        for target in [-1e9, 1e9] {
            let torque = drive.limited_motor_torque_nm(target, omega);
            assert!(torque.abs() <= 1.2 * drive.rated_torque_nm() + 1e-8);
            assert!(torque * omega <= drive.max_power_w + 1e-6);
            assert!(drive.friction_torque_nm(omega) * omega >= 0.0);
        }
    }
}

#[test]
fn maximum_shaft_reference_preserves_actual_speed_and_energy_limits() {
    let (mut plant, mut commands) = plant_and_commands();
    let initial = plant.state().actuator_states.clone();
    let system = plant.actuator_system().unwrap().clone();
    for command in &mut commands.shafts { command.speed_reference_rad_s = 1000.0; }
    let mut peak = 0.0_f64;
    for _ in 0..2400 {
        plant.step_with_actuators(1.0 / 120.0, &commands).unwrap();
        let state = &plant.state().actuator_states;
        peak = peak.max(state.propeller_shaft_speed_rad_s[0]);
        for index in 0..2 {
            assert!(state.motor_torques_nm[index] * state.propeller_shaft_speed_rad_s[index]
                <= system.propulsors[index].max_power_w + 1e-6);
        }
    }
    assert!(peak <= system.propulsors[0].rated_speed_rad_s + 1e-5, "轴速峰值 {peak}");
    let final_state = &plant.state().actuator_states;
    let kinetic = 0.5 * system.propulsors[0].shaft_inertia_kg_m2
        * (final_state.propeller_shaft_speed_rad_s[0].powi(2) - initial.propeller_shaft_speed_rad_s[0].powi(2));
    let work = final_state.motor_work_j[0] - final_state.propeller_work_j[0] - final_state.shaft_friction_work_j[0];
    assert!((kinetic - work).abs() <= kinetic.abs().max(1.0) * 1e-5);
}

#[test]
fn jam_freezes_actual_angle_after_rate_limited_motion() {
    let (mut plant, mut commands) = plant_and_commands();
    commands.surfaces.iter_mut().for_each(|command| command.angle_rad = 30.0_f64.to_radians());
    plant.step_with_actuators(1.0, &commands).unwrap();
    let angle = plant.state().actuator_states.control_surface_angles_rad[0];
    assert!(angle > 0.0 && angle <= 5.0_f64.to_radians() + 1e-9);
    commands.surfaces[0].jammed = true;
    plant.step_with_actuators(1.0, &commands).unwrap();
    assert_eq!(plant.state().actuator_states.control_surface_angles_rad[0], angle);
    assert!(plant.state().actuator_states.control_surface_angles_rad[1] > angle);
}

#[test]
fn finite_wing_stall_is_continuous_and_drag_dissipative() {
    let (linear, _) = finite_wing_coefficients(10.0_f64.to_radians(), 2.0);
    assert!((linear - std::f64::consts::PI * 10.0_f64.to_radians()).abs() < 1e-12);
    for degrees in [15.0_f64, 30.0] {
        let (left, drag_left) = finite_wing_coefficients(degrees.to_radians() - 1e-8, 2.0);
        let (right, drag_right) = finite_wing_coefficients(degrees.to_radians() + 1e-8, 2.0);
        assert!((left - right).abs() < 1e-6 && (drag_left - drag_right).abs() < 1e-6);
    }
    for degree in -180..=180 {
        let alpha = (degree as f64).to_radians();
        let (lift, drag) = finite_wing_coefficients(alpha, 2.0);
        let (opposite, _) = finite_wing_coefficients(-alpha, 2.0);
        assert!((lift + opposite).abs() < 1e-12 && drag > 0.0);
    }
}

#[test]
fn azimuth_uses_shortest_allowed_path_and_reports_blockage() {
    let mut model = AzimuthServo {
        servo: ServoModel { max_angle_rad: std::f64::consts::PI, max_rate_rad_s: 0.2, time_constant_s: 1.0 },
        forbidden_sectors_rad: vec![],
    };
    let error = azimuth_path_error(170.0_f64.to_radians(), -170.0_f64.to_radians(), &model).unwrap();
    assert!((error.to_degrees() - 20.0).abs() < 1e-10);
    assert!(azimuth_path_error(1e30, 0.3, &model).unwrap().abs() <= std::f64::consts::PI);
    model.forbidden_sectors_rad = vec![[175.0_f64.to_radians(), std::f64::consts::PI]];
    let other = azimuth_path_error(170.0_f64.to_radians(), -170.0_f64.to_radians(), &model).unwrap();
    assert!((other.to_degrees() + 340.0).abs() < 1e-10);
    model.forbidden_sectors_rad.push([-1.0, 1.0]);
    assert!(azimuth_path_error(170.0_f64.to_radians(), -170.0_f64.to_radians(), &model).is_none());
}

fn run_runtime(dt: f64) -> serde_json::Value {
    let mut state = serde_json::json!({"speedMps": 8.0});
    for _ in 0..(1.0 / dt).round() as usize {
        state = serde_json::from_str(&compute_destroyer_sixdof_step_json(&serde_json::json!({
            "parameterBundleVersion": "research-nominal-v2", "dtS": dt, "controlMode": "manual",
            "manualRudderDeg": 0.0, "shaftSpeedReferenceRpm": 160.0, "state": state,
        }).to_string()).unwrap()).unwrap();
    }
    state
}

#[test]
fn runtime_round_trips_both_shafts_motor_states_and_work() {
    let fast = run_runtime(1.0 / 60.0);
    let slow = run_runtime(0.5);
    assert_eq!(fast["runManifest"]["modelVersion"], "sixdof-destroyer-v3");
    let left: TruthState = serde_json::from_value(serde_json::json!({
        "position_ned": fast["sixdofState"]["positionNed"],
        "quaternion": fast["sixdofState"]["quaternion"],
        "body_velocity": fast["sixdofState"]["bodyVelocity"],
        "radiation_states": fast["sixdofState"]["radiationStates"],
        "actuator_states": fast["sixdofState"]["actuatorStates"], "specialist_states": [],
    })).unwrap();
    assert_eq!(left.actuator_states.propeller_shaft_speed_rad_s.len(), 2);
    for name in ["propeller_shaft_speed_rad_s", "motor_torques_nm", "motor_torque_demand_nm", "shaft_reference_speed_rad_s",
        "positive_motor_work_j", "motor_work_j", "propeller_work_j", "shaft_friction_work_j"]
    {
        for (left, right) in fast["sixdofState"]["actuatorStates"][name].as_array().unwrap().iter()
            .zip(slow["sixdofState"]["actuatorStates"][name].as_array().unwrap())
        {
            let left = left.as_f64().unwrap();
            let right = right.as_f64().unwrap();
            assert!((left - right).abs() < left.abs().max(1.0) * 1e-9, "{name}: {left} vs {right}");
        }
    }
}

#[test]
fn versioned_entry_rejects_incomplete_actuator_state() {
    let mut state = run_runtime(0.5);
    state["sixdofState"]["actuatorStates"]["motor_torques_nm"] = serde_json::json!([100.0]);
    assert!(compute_destroyer_sixdof_step_json(&serde_json::json!({
        "parameterBundleVersion": "research-nominal-v2", "dtS": 0.5,
        "controlMode": "manual", "state": state,
    }).to_string()).is_err());
}

#[test]
fn water_driven_overspeed_reports_failure_without_committing_partial_state() {
    let (mut plant, commands) = plant_and_commands();
    let mut state = plant.state().clone();
    state.body_velocity[0] = 300.0;
    plant.restore_state(state.clone());
    plant.set_environment_state(control_engine::sixdof::EnvironmentState::calm(17),
        control_engine::sixdof::WindHullGeometry {
            frontal_area_m2: 380.0, lateral_area_m2: 1200.0, length_m: 171.0,
            pressure_center_body: [4.0, 0.0, -6.0],
        });
    let result = plant.step_with_actuators(0.5, &commands);
    assert!(result.is_err(), "超出设备能力的水驱动超速应报告不可行");
    assert_eq!(plant.state(), &state);
    assert_eq!(plant.sim_time_s(), 0.0);
    state.body_velocity[0] = 8.0;
    plant.restore_state(state);
    plant.step_with_actuators(0.1, &commands).unwrap();
    let (mut reference, _) = plant_and_commands();
    reference.step_with_actuators(0.1, &commands).unwrap();
    for (actual, expected) in plant.state().body_velocity.iter().zip(reference.state().body_velocity) {
        assert!((actual - expected).abs() < 1e-10);
    }
}

#[test]
fn shaft_inertia_prior_has_reproducible_sensitivity_and_energy_balance() {
    let mut records = Vec::new();
    for multiplier in [0.5, 1.0, 2.0] {
        let mut pack = embedded_destroyer_055_v2().unwrap();
        if let PackActuators::Physical { system, .. } = &mut pack.actuators {
            for propulsor in &mut system.propulsors { propulsor.shaft_inertia_kg_m2 *= multiplier; }
        }
        let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
        let initial = plant.state().actuator_states.propeller_shaft_speed_rad_s[0];
        let inertia = plant.actuator_system().unwrap().propulsors[0].shaft_inertia_kg_m2;
        let commands = ActuatorCommands {
            shafts: vec![ShaftCommand { drive_cut: true, ..Default::default() }; 2],
            surfaces: vec![SurfaceCommand { enabled: true, ..Default::default() }; 2],
        };
        for _ in 0..360 { plant.step_with_actuators(1.0 / 120.0, &commands).unwrap(); }
        let state = &plant.state().actuator_states;
        let omega = state.propeller_shaft_speed_rad_s[0];
        let kinetic = 0.5 * inertia * (omega * omega - initial * initial);
        let work = state.motor_work_j[0] - state.propeller_work_j[0] - state.shaft_friction_work_j[0];
        let error = (kinetic - work).abs() / kinetic.abs();
        assert!(error < 1e-6);
        records.push(serde_json::json!({
            "inertia_multiplier": multiplier, "inertia_kg_m2": inertia,
            "time_s": plant.sim_time_s(), "shaft_speed_rad_s": omega,
            "motor_work_j": state.motor_work_j[0], "propeller_work_j": state.propeller_work_j[0],
            "friction_work_j": state.shaft_friction_work_j[0], "kinetic_energy_change_j": kinetic,
            "energy_relative_error": error,
        }));
    }
    assert!(records[0]["shaft_speed_rad_s"].as_f64().unwrap() < records[1]["shaft_speed_rad_s"].as_f64().unwrap());
    assert!(records[1]["shaft_speed_rad_s"].as_f64().unwrap() < records[2]["shaft_speed_rad_s"].as_f64().unwrap());
    if let Ok(path) = std::env::var("ACT_SHAFT_SENSITIVITY_REPORT") {
        let report = serde_json::json!({
            "schema": "act.shaft-inertia-sensitivity.v1", "model_fidelity": "research-nominal",
            "parameter_bundle_hash": embedded_destroyer_055_v2().unwrap().content_hash,
            "physical_dt_s": 1.0 / 120.0, "initial_speed_mps": 8.0,
            "inertia_prior": "25000*(D/4)^5 kg*m^2", "scenarios": records,
        });
        std::fs::write(path, serde_json::to_string_pretty(&report).unwrap() + "\n").unwrap();
    }
}

#[test]
fn mapped_crossflow_integrates_force_and_moment_without_fictitious_sway() {
    let pack = embedded_destroyer_055_v2().unwrap();
    let control_engine::sixdof::model_pack::PackManeuvering::Mapped { mapped_mmg: hull } = pack.maneuvering
        else { panic!("需要完整MMG与条带模型") };
    let sway = hull.loads(&[0.0, 1.0, 0.0, 0.0, 0.0, 0.0]);
    assert!(sway[1] < 0.0 && sway[5].abs() < 1e-6);
    let expected = -0.5 * 1025.0 * 171.0 * 6.6;
    assert!((sway[1] - expected).abs() < 1e-7);
    let yaw = hull.loads(&[0.0, 0.0, 0.0, 0.0, 0.0, 0.02]);
    assert!(yaw[1].abs() < 1e-6 && yaw[5] < 0.0);
    let reverse = hull.loads(&[-5.0, 1.0, 0.0, 0.0, 0.0, 0.0]);
    assert!(reverse[0] > 0.0 && reverse[1] < 0.0);
}

#[test]
fn mapped_hull_uses_force_point_velocity_for_roll_power_balance() {
    let pack = embedded_destroyer_055_v2().unwrap();
    let control_engine::sixdof::model_pack::PackManeuvering::Mapped { mapped_mmg: hull } = pack.maneuvering
        else { panic!("需要完整MMG与条带模型") };
    let nu = [0.0, 1.0, 0.0, 2.0 / hull.force_center_body_z_m, 0.0, 0.0];
    let loads = hull.loads(&nu);
    let power: f64 = loads.iter().zip(nu).map(|(force, velocity)| force * velocity).sum();
    assert!(loads[1] > 0.0 && loads[3] < 0.0 && power < 0.0);
}
