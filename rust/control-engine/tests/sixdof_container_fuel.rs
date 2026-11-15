use control_engine::sixdof::actuator_system::{ActuatorCommands, LocalWater, ShaftCommand};
use control_engine::sixdof::fuel::FuelModel;
use control_engine::sixdof::model_pack::{embedded_vessel_pack_with_loading, embedded_vessel_pack_with_water_depth, PackActuators};
use control_engine::sixdof::session::{FleetSimulation, SessionConfiguration};
use control_engine::sixdof::DestroyerSixDofPlant;

fn model() -> FuelModel {
    FuelModel { rated_shaft_power_w: 65e6, auxiliary_power_w: 2e6, efficiency: 0.95,
        load_fractions: [0.1, 0.25, 0.5, 0.75, 1.0], sfoc_g_per_kwh: [230.0, 195.0, 180.0, 175.0, 185.0] }
}

fn configuration(ratio: f64) -> SessionConfiguration {
    SessionConfiguration { vessel: "container-msc".into(), parameter_version: "research-nominal-v2".into(),
        loading_ratio: Some(ratio), ..Default::default() }
}

#[test]
fn sfoc_interpolation_idle_shutdown_and_kilogram_units_follow_the_fixed_curve() {
    let model = model();
    model.validate().unwrap();
    for (load, sfoc) in [(0.1, 230.0), (0.175, 212.5), (0.25, 195.0), (0.5, 180.0), (0.75, 175.0), (1.0, 185.0)] {
        let rates = model.rates(load*65e6, true);
        assert!((rates.sfoc_g_per_kwh-sfoc).abs() < 1e-12);
        assert!((rates.engine_power_w-(load*65e6+2e6)/0.95).abs() < 1e-7);
        let kg_per_hour = rates.engine_power_w/1000.0*sfoc/1000.0;
        assert!((rates.fuel_kg_per_s*3600.0-kg_per_hour).abs() < 1e-10);
    }
    let idle = model.rates(0.0, true);
    assert_eq!(idle.fuel_kg_per_s, model.rates(-65e6, true).fuel_kg_per_s);
    assert_eq!(idle.fuel_kg_per_s, model.rates(6.5e6, true).fuel_kg_per_s);
    assert_eq!(model.rates(65e6, false).fuel_kg_per_s, 0.0);
    assert_eq!(model.rates(-65e6, false).engine_power_w, 0.0);
}

#[test]
fn invalid_engine_curves_and_nonfinite_parameters_are_rejected() {
    for index in 0..6 {
        let mut model = model();
        match index {
            0 => model.efficiency = 0.0,
            1 => model.auxiliary_power_w = -1.0,
            2 => model.rated_shaft_power_w = f64::NAN,
            3 => model.load_fractions[2] = 0.1,
            4 => model.sfoc_g_per_kwh[3] = f64::INFINITY,
            _ => model.load_fractions[4] = 0.9,
        }
        assert!(model.validate().is_err());
    }
}

#[test]
fn five_loading_models_keep_rigid_geometry_and_bind_depth_radiation_wind_and_fuel() {
    let mut hashes = Vec::new();
    for ratio in [0.2, 0.35, 0.6, 0.8, 0.9] {
        let original = embedded_vessel_pack_with_loading("container-msc", "research-nominal-v1", Some(ratio)).unwrap();
        let pack = embedded_vessel_pack_with_loading("container-msc", "research-nominal-v2", Some(ratio)).unwrap();
        assert_eq!(pack.geometry.displacement_mass_kg, original.geometry.displacement_mass_kg);
        assert_eq!(pack.geometry.draft_m, original.geometry.draft_m);
        assert_eq!(pack.geometry.equilibrium_pitch_rad, original.geometry.equilibrium_pitch_rad);
        assert_eq!(pack.geometry.center_of_mass_waterline_z_up_m, original.geometry.center_of_mass_waterline_z_up_m);
        assert_eq!(pack.geometry.inertia_about_cg_kg_m2.ixx, original.geometry.inertia_about_cg_kg_m2.ixx);
        assert_eq!(pack.geometry.inertia_about_cg_kg_m2.iyy, original.geometry.inertia_about_cg_kg_m2.iyy);
        assert_eq!(pack.geometry.inertia_about_cg_kg_m2.izz, original.geometry.inertia_about_cg_kg_m2.izz);
        assert_eq!(pack.geometry.hydrodynamic_depth_m, Some(200.0));
        assert!(pack.geometry.passive_radiation.as_ref().unwrap().state_len() >= 80);
        assert!(pack.geometry.wind_model.is_some());
        let PackActuators::Physical { system, initial_state } = &pack.actuators else { panic!("需要实际轴系") };
        assert_eq!(system.fuel_model.as_ref().unwrap().sfoc_g_per_kwh, model().sfoc_g_per_kwh);
        assert_eq!(initial_state.fuel.unwrap().fuel_kg, 0.0);
        assert_eq!(embedded_vessel_pack_with_water_depth("container-msc", "research-nominal-v2", Some(ratio), Some(200.0)).unwrap().content_hash, pack.content_hash);
        hashes.push(pack.content_hash);
    }
    hashes.sort(); hashes.dedup(); assert_eq!(hashes.len(), 5);
    assert!(embedded_vessel_pack_with_water_depth("container-msc", "research-nominal-v2", Some(0.6), Some(40.0)).is_err());
}

#[test]
fn actual_rk_fuel_uses_propeller_power_and_separates_signed_work() {
    let pack = embedded_vessel_pack_with_loading("container-msc", "research-nominal-v2", Some(0.6)).unwrap();
    let PackActuators::Physical { system, initial_state } = &pack.actuators else { panic!("需要实际轴系") };
    let commands = ActuatorCommands { shafts: vec![ShaftCommand {
        speed_reference_rad_s: initial_state.shaft_reference_speed_rad_s[0], ..Default::default()
    }], surfaces: vec![Default::default(); system.surfaces.len()] };
    let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
    let mut previous = plant.fuel_rates(&commands).unwrap().unwrap();
    let mut independent_fuel = 0.0;
    for _ in 0..360 {
        plant.step_with_actuators(1.0/120.0, &commands).unwrap();
        let current = plant.fuel_rates(&commands).unwrap().unwrap();
        let independent_rate = |rates: &control_engine::sixdof::fuel::FuelRates| {
            let q = (rates.signed_shaft_power_w.max(0.0)/65e6).clamp(0.1, 1.0);
            let q_nodes = [0.1, 0.25, 0.5, 0.75, 1.0];
            let sfoc_nodes = [230.0, 195.0, 180.0, 175.0, 185.0];
            let upper = q_nodes.partition_point(|value| *value < q).clamp(1, 4);
            let sfoc = sfoc_nodes[upper-1]+(sfoc_nodes[upper]-sfoc_nodes[upper-1])
                *(q-q_nodes[upper-1])/(q_nodes[upper]-q_nodes[upper-1]);
            ((rates.signed_shaft_power_w.max(6.5e6)+2e6)/0.95/1000.0)*sfoc/3.6e6
        };
        independent_fuel += (independent_rate(&previous)+independent_rate(&current))/240.0;
        previous = current;
    }
    let state = &plant.state().actuator_states;
    let fuel = state.fuel.unwrap();
    assert!(fuel.fuel_kg > 1.0);
    assert!((fuel.fuel_kg/independent_fuel-1.0).abs() < 1e-5);
    assert!((fuel.positive_propeller_work_j-fuel.negative_propeller_work_j-state.propeller_work_j[0]).abs()
        < 1e-10*fuel.positive_propeller_work_j);
    assert!((fuel.engine_work_j-(fuel.positive_propeller_work_j+2e6*3.0)/0.95).abs()
        < 1e-10*fuel.engine_work_j);
}

#[test]
fn explicit_shutdown_cuts_actual_motor_torque_while_drive_cut_keeps_idle_consumption() {
    let pack = embedded_vessel_pack_with_loading("container-msc", "research-nominal-v2", Some(0.6)).unwrap();
    let PackActuators::Physical { system, initial_state } = &pack.actuators else { panic!("需要实际轴系") };
    let values = system.encode_state(initial_state);
    let mut commands = ActuatorCommands { shafts: vec![ShaftCommand { drive_cut: true, ..Default::default() }],
        surfaces: vec![Default::default(); system.surfaces.len()] };
    let water = LocalWater { time_s: 0.0, position_ned: [0.0; 3], quaternion: [1.0, 0.0, 0.0, 0.0],
        relative_velocity: [8.0, 0.0, 0.0, 0.0, 0.0, 0.0], environment: None };
    let running = system.derivatives(&values, &mut vec![0.0; values.len()], &commands, &[0.0], &water);
    assert!(running.fuel.unwrap().fuel_kg_per_s > 0.0);
    commands.shafts[0].engine_running = Some(false);
    let stopped = system.derivatives(&values, &mut vec![0.0; values.len()], &commands, &[0.0], &water);
    assert_eq!(stopped.motor_torques_nm[0], 0.0);
    assert_eq!(stopped.fuel.unwrap().fuel_kg_per_s, 0.0);
    let mut simulation = FleetSimulation::new(configuration(0.6)).unwrap();
    simulation.advance(0.2, None).unwrap();
    let before: serde_json::Value = serde_json::from_str(&simulation.frame_json().unwrap()).unwrap();
    let mut input = simulation.input().clone(); input.actuators.shafts[0].engine_running = Some(false);
    simulation.advance(1.0, Some(input)).unwrap();
    let after: serde_json::Value = serde_json::from_str(&simulation.frame_json().unwrap()).unwrap();
    assert_eq!(before["teachingFuel"]["state"]["fuel_kg"], after["teachingFuel"]["state"]["fuel_kg"]);
    assert_eq!(after["truth"]["actuator_states"]["motor_torques_nm"][0], 0.0);
}

#[test]
fn fuel_cumulative_state_survives_future_pause_reset_and_rejects_invalid_restore() {
    let mut simulation = FleetSimulation::new(configuration(0.9)).unwrap();
    let initial = simulation.snapshot_json().unwrap();
    simulation.advance(0.5, None).unwrap();
    let snapshot = simulation.snapshot_json().unwrap();
    let mut restored = FleetSimulation::from_snapshot_json(&snapshot).unwrap();
    simulation.advance(0.5, None).unwrap(); restored.advance(0.5, None).unwrap();
    assert_eq!(simulation.snapshot_json().unwrap(), restored.snapshot_json().unwrap());
    let mut invalid: serde_json::Value = serde_json::from_str(&snapshot).unwrap();
    invalid["plant"]["state"]["actuator_states"]["fuel"]["fuel_kg"] = serde_json::json!(-1.0);
    assert!(FleetSimulation::from_snapshot_json(&invalid.to_string()).is_err());
    simulation.set_paused(true); let paused = simulation.snapshot_json().unwrap();
    simulation.advance(1.0, None).unwrap(); assert_eq!(simulation.snapshot_json().unwrap(), paused);
    simulation.reset().unwrap(); assert_eq!(simulation.snapshot_json().unwrap(), initial);
    let mut legacy = FleetSimulation::new(SessionConfiguration { parameter_version: "research-nominal-v1".into(), ..configuration(0.6) }).unwrap();
    let mut input = legacy.input().clone(); input.actuators.shafts[0].engine_running = Some(false);
    assert!(legacy.advance(0.2, Some(input)).is_err());
    assert!(!legacy.snapshot_json().unwrap().contains("\"fuel\""));
}
