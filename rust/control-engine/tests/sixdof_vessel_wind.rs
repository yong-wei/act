use control_engine::sixdof::vessel_wind::{FujiwaraGeometry, ProjectedWindGeometry, VesselWindModel, WindPanel};
use control_engine::sixdof::{DestroyerSixDofPlant, EnvironmentState, WindHullGeometry};
use control_engine::sixdof::model_pack::embedded_vessel_pack;
use control_engine::sixdof::actuator_system::ActuatorCommands;
use std::path::Path;

fn roro() -> FujiwaraGeometry {
    // Fujiwara et al. 2005 Fig.14的八项原型输入。
    FujiwaraGeometry { frontal_area_m2: 724.1, lateral_area_m2: 4223.4,
        superstructure_lateral_area_m2: 2881.1, loa_m: 181.3, beam_m: 25.1,
        center_lateral_from_midship_m: -1.82, center_lateral_above_waterline_m: 12.7,
        superstructure_height_m: 25.8, midship_body_x_m: 0.0,
        pressure_center_body_m: [-1.82, 0.0, -12.7], frontal_center_body_z_m: -12.7,
        cg_waterline_height_m: 0.0 }
}

fn panels() -> ProjectedWindGeometry {
    ProjectedWindGeometry { air_density_kg_m3: 1.225, drag_coefficient: 1.2, panels: vec![
        WindPanel { point_body_m: [0.0, 2.0, -10.0], normal_axis: 0, projected_area_m2: 20.0 },
        WindPanel { point_body_m: [5.0, 0.0, -12.0], normal_axis: 1, projected_area_m2: 40.0 },
        WindPanel { point_body_m: [-3.0, 0.0, -4.0], normal_axis: 1, projected_area_m2: 12.0 },
    ] }
}

#[test]
fn original_fujiwara_coefficients_preserve_head_beam_and_following_wind_signs() {
    let geometry = roro();
    let expected_head = -0.922+0.507*4223.4/(181.3*25.1)+1.162*(-1.82)/181.3;
    let expected_following = -(0.018-5.091*25.1/181.3+10.367*12.7/181.3
        -3.011*2881.1/(181.3*181.3)-0.341*724.1/(25.1*25.1));
    let expected_beam = 0.404+0.368*724.1/(25.1*25.8)+0.902*25.8/181.3;
    assert!((geometry.coefficients(0.0)[0]-expected_head).abs() < 1e-14);
    assert!((geometry.coefficients(std::f64::consts::PI)[0]-expected_following).abs() < 1e-14);
    assert!((geometry.coefficients(std::f64::consts::FRAC_PI_2)[1]-expected_beam).abs() < 1e-14);
    let model = VesselWindModel::Fujiwara(geometry);
    model.validate().unwrap();
    assert!(model.loads([-10.0, 0.0], [1.0, 0.0, 0.0, 0.0], [0.0; 6])[0] < 0.0);
    assert!(model.loads([10.0, 0.0], [1.0, 0.0, 0.0, 0.0], [0.0; 6])[0] > 0.0);
    let port = model.loads([0.0, 10.0], [1.0, 0.0, 0.0, 0.0], [0.0; 6]);
    let starboard = model.loads([0.0, -10.0], [1.0, 0.0, 0.0, 0.0], [0.0; 6]);
    assert!(port[1] > 0.0 && port[3] > 0.0);
    assert!((port[1]+starboard[1]).abs() < 1e-9);
    assert!((port[3]+starboard[3]).abs() < 1e-9);
    assert!((port[5]+starboard[5]).abs() < 1e-9);
}

#[test]
fn fujiwara_fore_aft_regressions_join_with_continuous_first_derivative() {
    let geometry = roro();
    for degrees in [80.0_f64, 90.0, 100.0] {
        let center = degrees.to_radians();
        let h = 1e-6;
        let left = geometry.coefficients(center-h);
        let middle = geometry.coefficients(center);
        let right = geometry.coefficients(center+h);
        for axis in 0..2 {
            assert!(((middle[axis]-left[axis])/h-(right[axis]-middle[axis])/h).abs() < 2e-5);
        }
    }
}

#[test]
fn current_attitude_and_angular_point_velocity_enter_actual_wind_loads() {
    let model = VesselWindModel::Fujiwara(roro());
    let identity = [1.0, 0.0, 0.0, 0.0];
    let yaw = 0.8_f64;
    let rotated = [(yaw/2.0).cos(), 0.0, 0.0, (yaw/2.0).sin()];
    let a = model.loads([-10.0, 0.0], identity, [0.0; 6]);
    let b = model.loads([-10.0*yaw.cos(), -10.0*yaw.sin()], rotated, [0.0; 6]);
    for axis in 0..6 { assert!((a[axis]-b[axis]).abs() < 1e-8); }
    let pitch = 30.0_f64.to_radians();
    let pitched = [(pitch/2.0).cos(), 0.0, (pitch/2.0).sin(), 0.0];
    let c = model.loads([-10.0, 0.0], pitched, [0.0; 6]);
    assert!((c[0]/a[0]-0.75).abs() < 1e-14);
    let angular = model.loads([0.0, 0.0], identity, [0.0, 0.0, 0.0, 0.0, 0.2, 0.0]);
    assert!(angular[0] > 0.0);
    let translating = model.loads([0.0, 0.0], identity, [8.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
    assert!(translating[0] < 0.0);
    assert_eq!(model.loads([0.0, 0.0], identity, [0.0; 6]), [0.0; 6]);
}

#[test]
fn platform_projection_loads_close_power_and_six_component_moments() {
    let geometry = panels();
    let model = VesselWindModel::Projected(geometry.clone());
    model.validate().unwrap();
    let nu = [3.0, -2.0, 0.4, 0.07, -0.11, 0.03];
    let loads = model.loads([0.0, 0.0], [1.0, 0.0, 0.0, 0.0], nu);
    let power: f64 = loads.iter().zip(nu).map(|(force, velocity)| force*velocity).sum();
    let mut dissipation = 0.0;
    for panel in &geometry.panels {
        let r = panel.point_body_m;
        let local = [nu[0]+nu[4]*r[2]-nu[5]*r[1], nu[1]+nu[5]*r[0]-nu[3]*r[2]];
        dissipation += 0.5*geometry.air_density_kg_m3*geometry.drag_coefficient
            *panel.projected_area_m2*local[panel.normal_axis].abs().powi(3);
    }
    assert!(power < 0.0);
    assert!((power+dissipation).abs() < 1e-10);
    assert!(loads[0] != 0.0 && loads[1] != 0.0 && loads[3] != 0.0 && loads[4] != 0.0 && loads[5] != 0.0);
    let fixed = model.loads([10.0, 0.0], [1.0, 0.0, 0.0, 0.0], [0.0; 6]);
    assert!((fixed[0]-0.5*1.225*1.2*20.0*100.0).abs() < 1e-12);
    assert_eq!(fixed[4], -10.0*fixed[0]);
    assert_eq!(fixed[5], -2.0*fixed[0]);
}

#[test]
fn invalid_wind_parameters_are_rejected_by_the_model_and_pack_gate() {
    let mut geometry = roro();
    geometry.superstructure_lateral_area_m2 = geometry.lateral_area_m2+1.0;
    assert!(VesselWindModel::Fujiwara(geometry).validate().is_err());
    let mut geometry = panels();
    geometry.panels[0].normal_axis = 2;
    assert!(VesselWindModel::Projected(geometry).validate().is_err());
    let mut geometry = panels();
    geometry.panels[0].projected_area_m2 = f64::NAN;
    assert!(VesselWindModel::Projected(geometry).validate().is_err());
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("model-data/semisub-981/v2");
    let read = |name: &str| std::fs::read_to_string(root.join(name)).unwrap();
    let mut geometry: serde_json::Value = serde_json::from_str(&read("geometry.json")).unwrap();
    let mut invalid = panels();
    invalid.panels[0].normal_axis = 2;
    geometry["wind_model"] = serde_json::to_value(VesselWindModel::Projected(invalid)).unwrap();
    let result = control_engine::sixdof::model_pack::load_model_pack(&read("manifest.json"),
        &geometry.to_string(), &read("maneuvering.json"), &read("actuators.json"), &read("provenance.json"));
    assert!(matches!(result, Err(control_engine::sixdof::model_pack::PackError::InvalidWindGeometry { .. })));
}

#[test]
fn seven_source_wind_models_enter_each_physical_plant_with_exact_force_accounting() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../docs/research/fleet-hydrodynamics/wind-validation");
    for (vessel, version) in [("destroyer-055", "research-nominal-v4"),
        ("lng-changheng", "research-nominal-v1"), ("container-msc", "research-nominal-v1"),
        ("cruise-adora", "research-nominal-v1"), ("icebreaker-xuelong2", "research-nominal-v1"),
        ("dredger-tianjing", "research-nominal-v1"), ("semisub-981", "research-nominal-v2")]
    {
        let model: VesselWindModel = serde_json::from_str(&std::fs::read_to_string(root.join(vessel).join("wind.json")).unwrap()).unwrap();
        model.validate().unwrap();
        let mut pack = embedded_vessel_pack(vessel, version).unwrap();
        pack.geometry.wind_model = Some(model.clone());
        let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
        let mut state = plant.state().clone();
        state.body_velocity = [0.0; 6];
        state.radiation_states.clear();
        state.actuator_states.propeller_shaft_speed_rad_s.fill(0.0);
        state.actuator_states.shaft_reference_speed_rad_s.fill(0.0);
        state.actuator_states.motor_torques_nm.fill(0.0);
        state.actuator_states.motor_torque_demand_nm.fill(0.0);
        plant.restore_state(state);
        let mut environment = EnvironmentState::calm(20261106);
        environment.switches.wind_force_enabled = true;
        environment.wind.true_wind.speed_mps = 8.0;
        environment.wind.true_wind.from_deg = 60.0;
        let air = environment.wind.true_wind.velocity_ned();
        plant.set_environment_state(environment, WindHullGeometry { frontal_area_m2: 1.0, lateral_area_m2: 1.0,
            length_m: pack.geometry.lpp_m, pressure_center_body: [0.0; 3] });
        let system = plant.actuator_system().unwrap();
        let commands = ActuatorCommands { shafts: vec![Default::default(); system.propulsors.len()],
            surfaces: vec![Default::default(); system.surfaces.len()] };
        for _ in 0..30 {
            plant.step_with_actuators(1.0/120.0, &commands).unwrap();
            let state = plant.state();
            let expected = model.loads(air, state.quaternion, state.body_velocity);
            let dynamics = plant.last_dynamics().unwrap();
            let actual = dynamics.external_components.unwrap();
            for axis in 0..6 {
                assert!((actual.tau_wind[axis]-expected[axis]).abs() < 1e-7, "{vessel} axis {axis}");
            }
            assert_eq!(actual.total(), dynamics.breakdown.external);
            assert!(state.body_velocity.iter().all(|value| value.is_finite()));
        }
    }
}

#[test]
fn actual_rk_uses_frozen_platform_wind_and_preserves_disabled_wind_ablation() {
    let mut pack = embedded_vessel_pack("semisub-981", "research-nominal-v2").unwrap();
    let model = VesselWindModel::Projected(panels());
    pack.geometry.wind_model = Some(model.clone());
    let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
    let mut environment = EnvironmentState::calm(20261106);
    environment.switches.wind_force_enabled = true;
    environment.wind.true_wind.speed_mps = 10.0;
    let old_geometry = WindHullGeometry { frontal_area_m2: 1e9, lateral_area_m2: 1e9,
        length_m: 110.0, pressure_center_body: [0.0, 0.0, -1000.0] };
    plant.set_environment_state(environment.clone(), old_geometry);
    let system = plant.actuator_system().unwrap();
    let commands = ActuatorCommands { shafts: vec![Default::default(); system.propulsors.len()], surfaces: vec![] };
    plant.step_with_actuators(1.0/120.0, &commands).unwrap();
    let state = plant.state();
    let expected = model.loads([-10.0, 0.0], state.quaternion, state.body_velocity);
    let actual = plant.last_dynamics().unwrap().external_components.unwrap();
    for axis in 0..6 { assert!((actual.tau_wind[axis]-expected[axis]).abs() < 1e-12); }
    assert_eq!(actual.total(), plant.last_dynamics().unwrap().breakdown.external);
    let mut calm = plant.clone();
    environment.switches.wind_force_enabled = false;
    calm.set_environment_state(environment, old_geometry);
    let before = state.body_velocity;
    calm.step_with_actuators(1.0/120.0, &commands).unwrap();
    assert_eq!(calm.last_dynamics().unwrap().external_components.unwrap().tau_wind, [0.0; 6]);
    assert!(expected[0] < 0.0 && plant.last_dynamics().unwrap().breakdown.external[0] < -1000.0);
    assert!(plant.last_dynamics().unwrap().nu_dot[0] < calm.last_dynamics().unwrap().nu_dot[0]);
    assert!(calm.state().body_velocity[0] < before[0]+1e-6);
}
