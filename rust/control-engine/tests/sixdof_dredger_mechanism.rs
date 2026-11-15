use control_engine::sixdof::actuator_system::{ActuatorCommands, ShaftCommand, SurfaceCommand};
use control_engine::sixdof::destroyer_plant::DestroyerSixDofPlant;
use control_engine::sixdof::dredger_mechanism::{DredgerCommands, DredgerConfiguration};
use control_engine::sixdof::model_pack::embedded_vessel_pack;

fn plant(configuration: DredgerConfiguration) -> (DestroyerSixDofPlant, ActuatorCommands) {
    let pack = embedded_vessel_pack("dredger-tianjing", "research-nominal-v3").unwrap();
    let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
    plant.configure_dredger(configuration).unwrap();
    let commands = ActuatorCommands {
        shafts: vec![ShaftCommand::default(); 2],
        surfaces: vec![
            SurfaceCommand {
                enabled: true,
                ..Default::default()
            };
            2
        ],
    };
    (plant, commands)
}

#[test]
fn dredger_dry_bridge_balances_without_duplicate_mass_or_fictitious_production() {
    let (mut plant, commands) = plant(Default::default());
    let initial = plant.state().clone();
    for _ in 0..1200 {
        plant.step_with_actuators(1.0 / 120.0, &commands).unwrap();
    }
    let observation = &plant.dredger().unwrap().state.last_observation;
    assert!(observation.ladder_angle_deg.abs() < 0.01);
    assert_eq!(observation.production_m3, 0.0);
    assert_eq!(observation.cable_tension_n, [0.0; 2]);
    for i in 0..3 {
        assert!((plant.state().position_ned[i] - initial.position_ned[i]).abs() < 1e-4);
    }
}

#[test]
fn dredger_actual_lowering_rotation_cables_and_soil_produce_finite_work() {
    let (mut plant, commands) = plant(DredgerConfiguration {
        initial_depth_m: Some(19.5),
        initial_spud_down: true,
        initial_cables_attached: true,
        ..Default::default()
    });
    plant
        .set_dredger_commands(DredgerCommands {
            spud_down: true,
            cables_attached: true,
            depth_reference_m: 20.3,
            cutter_rpm: 30.0,
            ..Default::default()
        })
        .unwrap();
    let mut maximum_rate = 0.0f64;
    let mut maximum_power = 0.0f64;
    for index in 0..3600 {
        plant
            .step_with_actuators(1.0 / 120.0, &commands)
            .unwrap_or_else(|error| panic!("tick {index} {error:?}"));
        let observation = &plant.dredger().unwrap().state.last_observation;
        maximum_rate = maximum_rate.max(observation.ladder_rate_deg_s.abs());
        maximum_power = maximum_power.max(observation.cutter_power_w.abs());
        assert!(observation
            .cable_tension_n
            .iter()
            .all(|tension| *tension >= 0.0));
        assert!(observation.hydraulic_force_n.abs() <= 1e6 + 1e-6);
    }
    let mechanism = plant.dredger().unwrap();
    let observation = &mechanism.state.last_observation;
    eprintln!(
        "dredger receipt {} maxRate={maximum_rate} maxPower={maximum_power}",
        serde_json::to_string(observation).unwrap()
    );
    assert!(observation.production_m3 > 0.0 && observation.cutting_work_j > 0.0);
    assert!((observation.depth_m - 20.3).abs() < 0.3);
    assert!(maximum_rate <= 0.5 + 0.01);
    assert!(maximum_power <= 4.2e6 + 1e-6);
    mechanism.state.bed.validate().unwrap();
}

#[test]
fn dredger_break_withdraws_real_force_and_checkpoint_preserves_future() {
    let configuration = DredgerConfiguration {
        initial_depth_m: Some(19.5),
        initial_spud_down: true,
        initial_cables_attached: true,
        cable_break_time_s: Some(1.0),
        ..Default::default()
    };
    let (mut first, commands) = plant(configuration.clone());
    for _ in 0..60 {
        first.step_with_actuators(1.0 / 120.0, &commands).unwrap();
    }
    assert!(
        first
            .dredger()
            .unwrap()
            .state
            .last_observation
            .cable_tension_n[1]
            > 20_000.0
    );
    let encoded = serde_json::to_string(&first.checkpoint()).unwrap();
    let (mut restored, _) = plant(configuration);
    restored
        .restore_checkpoint(serde_json::from_str(&encoded).unwrap())
        .unwrap();
    for _ in 0..180 {
        first.step_with_actuators(1.0 / 120.0, &commands).unwrap();
        restored
            .step_with_actuators(1.0 / 120.0, &commands)
            .unwrap();
    }
    assert_eq!(
        serde_json::to_value(restored.checkpoint()).unwrap(),
        serde_json::to_value(first.checkpoint()).unwrap()
    );
    let mechanism = first.dredger().unwrap();
    assert!(mechanism.state.cable_broken[1]);
    assert_eq!(mechanism.state.last_observation.cable_tension_n[1], 0.0);
    assert!(mechanism
        .state
        .events
        .iter()
        .any(|event| event.kind == "cable_break"));
}
