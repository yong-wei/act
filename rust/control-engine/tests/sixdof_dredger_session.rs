use control_engine::sixdof::dredger_control::{DredgerInput, DredgerMode};
use control_engine::sixdof::dredger_mechanism::{DredgerCommands, DredgerConfiguration};
use control_engine::sixdof::session::{FleetSimulation, SessionConfiguration};
use control_engine::sixdof::student_model::identify_dredge_channel;
use control_engine::sixdof::NoiseLevel;

fn configuration(depth: f64) -> SessionConfiguration {
    SessionConfiguration {
        vessel: "dredger-tianjing".into(),
        noise_level: NoiseLevel::N0,
        dredger: Some(DredgerConfiguration {
            initial_depth_m: Some(depth),
            initial_spud_down: true,
            initial_cables_attached: true,
            ..Default::default()
        }),
        ..Default::default()
    }
}
fn frame(simulation: &FleetSimulation) -> serde_json::Value {
    serde_json::from_str(&simulation.frame_json().unwrap()).unwrap()
}
fn working_input(
    simulation: &FleetSimulation,
    depth: f64,
) -> control_engine::sixdof::session::SessionInput {
    let mut input = simulation.input().clone();
    input.dredger = Some(DredgerInput {
        requested_mode: DredgerMode::SpudHold,
        commands: DredgerCommands {
            spud_down: true,
            cables_attached: true,
            depth_reference_m: depth,
            ..Default::default()
        },
        ..Default::default()
    });
    input
}

#[test]
fn dredger_local_winch_step_identifies_measured_fixed_mode_response() {
    let mut simulation = FleetSimulation::new(configuration(19.5)).unwrap();
    let mut input = working_input(&simulation, 19.5);
    let mut command = vec![];
    let mut output = vec![];
    let mut maximum_heading = 0.0f64;
    for tick in 0..6000 {
        let time = tick as f64 * 0.05;
        let differential = if (40.0..100.0).contains(&time) {
            0.015
        } else if (160.0..220.0).contains(&time) {
            -0.015
        } else {
            0.0
        };
        input.dredger.as_mut().unwrap().commands.winch_speed_mps = [differential, -differential];
        simulation
            .advance(0.05, Some(input.clone()))
            .unwrap_or_else(|error| panic!("{time}s {error}"));
        let actual = frame(&simulation);
        let sample = &actual["controlSamples"][0];
        let measurements = sample["dredger"]["samples"].as_array().unwrap();
        let sway = measurements
            .iter()
            .find(|sample| sample["signal"] == "SwaySpeed")
            .unwrap();
        command.push(
            (sample["dredger"]["commands"]["winchSpeedMps"][0]
                .as_f64()
                .unwrap()
                - sample["dredger"]["commands"]["winchSpeedMps"][1]
                    .as_f64()
                    .unwrap())
                / 2.0,
        );
        output.push(sway["measurement"]["value"].as_f64().unwrap());
        maximum_heading =
            maximum_heading.max(actual["attitudeDeg"]["heading"].as_f64().unwrap().abs());
        assert_eq!(actual["dredgerController"]["mode"], "spud_hold");
    }
    let identified = identify_dredge_channel(&command[200..3000], &output[200..3000], 0.05);
    eprintln!(
        "dredger identification {:?} residual={} failure={:?} maximumHeading={maximum_heading}",
        identified.structure, identified.residual_rms, identified.failure_reason
    );
    assert!(identified.identified_ok, "{:?}", identified.failure_reason);
    assert!(maximum_heading < 2.0);
    let initial_hash =
        frame(&FleetSimulation::new(configuration(19.5)).unwrap())["parameterHash"].clone();
    let legacy = FleetSimulation::new(SessionConfiguration {
        dredger: None,
        ..configuration(19.5)
    })
    .unwrap();
    assert_ne!(initial_hash, frame(&legacy)["parameterHash"]);

    // 使用这次实际量测辨识的同一模型，先冻结C预测，再进行真实机构闭环。
    let mut controlled = FleetSimulation::new(configuration(19.5)).unwrap();
    let mut input = working_input(&controlled, 20.3);
    let controller = input.dredger.as_mut().unwrap();
    controller.requested_mode = DredgerMode::CutSwing;
    controller.commands.cutter_rpm = 30.0;
    controller.automatic_swing = true;
    controller.kp_multiplier = 0.2;
    controller.ti_multiplier = 3.0;
    controller.local_model = identified.structure.clone();
    let prediction = control_engine::sixdof::student_model_runtime::compute(
        &serde_json::json!({
            "operation":"dredger_closed_loop", "structure": identified.structure,
            "inputOrigin":0.0,"outputOrigin":0.0,"initialSpeedMps":0.0,"initialHeadingDeg":0.0,
            "swingRadiusM":frame(&controlled)["parameters"]["dredger"]["initialSwingRadiusM"],
            "durationS":600.0,"dtS":0.05,"assumedCutStartS":18.0,"controller":controller,
        })
        .to_string(),
    )
    .unwrap();
    let frozen_prediction: serde_json::Value = serde_json::from_str(&prediction).unwrap();
    assert_eq!(
        frozen_prediction["predicted"].as_array().unwrap().len(),
        12001
    );
    let mut metric_points = vec![];
    for tick in 0..12000 {
        controlled
            .advance(0.05, Some(input.clone()))
            .unwrap_or_else(|error| panic!("closed loop tick {tick}: {error}"));
        let actual = frame(&controlled);
        let point = &actual["dredger"];
        let observed = &point["observation"];
        metric_points.push(serde_json::from_value(serde_json::json!({
            "timeS": actual["timeS"], "mode": point["mode"], "swayMps":observed["cutterSwaySpeedMps"],
            "referenceMps": point["referenceMps"], "depthM":observed["depthM"],
            "depthReferenceM":point["commands"]["depthReferenceM"],"productionM3":observed["productionM3"],
            "mechanicalWorkJ":observed["positiveCutterWorkJ"].as_f64().unwrap()+observed["positiveWinchWorkJ"].as_f64().unwrap(),
            "cutPowerW":observed["cuttingPowerW"],"cableTensionN":observed["cableTensionN"],"spudReactionN":observed["spudReactionN"],
            "cutterRpm":observed["cutterRpm"],"cutterReferenceRpm":point["commands"]["cutterRpm"],
            "cableBroken":point["cableBroken"],"modeEventCount":point["modeEventCount"],
            "chatterEventCount":point["chatterEventCount"],"reversalCount":point["reversalCount"],
        })).unwrap());
    }
    let metrics =
        control_engine::sixdof::dredger_metrics::run_metrics(&metric_points, None, 600.0).unwrap();
    let actual = frame(&controlled);
    eprintln!(
        "dredger full sand metrics {metrics}, fine {}",
        actual["dredgerFineMetrics"]
    );
    let sway_rms = metrics["dredgerSwayRmsMps"].as_f64().unwrap();
    assert!(sway_rms.is_finite() && sway_rms <= 0.16);
    eprintln!("dredger teaching sway target met={}", sway_rms <= 0.02);
    assert!(metrics["dredgerDepthRmsM"].as_f64().unwrap() <= 0.15);
    assert!(metrics["dredgerProductionM3"].as_f64().unwrap() > 1.0);
    assert_eq!(actual["dredgerFineMetrics"]["hardViolationDurationS"], 0.0);
    assert_eq!(
        actual["dredgerFineMetrics"]["soilDomainViolationDurationS"],
        0.0
    );
}

#[test]
fn dredger_cut_entry_and_cable_break_execute_pause_lift_and_recovery() {
    let mut config = configuration(20.3);
    config.dredger.as_mut().unwrap().cable_break_time_s = Some(40.0);
    let mut simulation = FleetSimulation::new(config).unwrap();
    let mut input = working_input(&simulation, 20.3);
    input.dredger.as_mut().unwrap().requested_mode = DredgerMode::CutSwing;
    input.dredger.as_mut().unwrap().commands.cutter_rpm = 30.0;
    let mut entered_cut = false;
    for tick in 0..1200 {
        simulation
            .advance(0.05, Some(input.clone()))
            .unwrap_or_else(|error| panic!("tick {tick}: {error}"));
        let actual = frame(&simulation);
        entered_cut |= actual["dredgerController"]["mode"] == "cut_swing";
    }
    let actual = frame(&simulation);
    eprintln!("dredger mode receipt {}", actual["dredgerController"]);
    assert!(entered_cut);
    assert_eq!(actual["dredger"]["cableBroken"][1], true);
    assert_eq!(actual["dredger"]["observation"]["cableTensionN"][1], 0.0);
    assert_eq!(actual["dredger"]["commands"]["cutterRpm"], 0.0);
    assert!(actual["dredger"]["observation"]["depthM"].as_f64().unwrap() < 19.6);
    assert!(actual["dredgerController"]["tripLatched"]
        .as_bool()
        .unwrap());
    assert_eq!(actual["dredgerController"]["mode"], "recover");
    assert_eq!(actual["dredgerController"]["chatterEventCount"], 0);
    let saved = simulation.snapshot_json().unwrap();
    let mut restored = FleetSimulation::from_snapshot_json(&saved).unwrap();
    simulation.advance(0.5, None).unwrap();
    restored.advance(0.2, None).unwrap();
    restored.advance(0.3, None).unwrap();
    let normalize = |raw: String| {
        let mut value: serde_json::Value = serde_json::from_str(&raw).unwrap();
        value["accumulator_s"] = serde_json::json!(0.0);
        value
    };
    assert_eq!(
        normalize(simulation.snapshot_json().unwrap()),
        normalize(restored.snapshot_json().unwrap())
    );
}

#[test]
fn dredger_input_and_queued_measurements_restore_with_noise_and_safety_bounds() {
    let mut simulation = FleetSimulation::new(SessionConfiguration {
        noise_level: NoiseLevel::N1,
        ..configuration(19.5)
    })
    .unwrap();
    let input = working_input(&simulation, 19.5);
    simulation.advance(0.05, Some(input)).unwrap();
    let first = frame(&simulation);
    assert_eq!(first["dredgerController"]["feedbackAvailable"], false);
    let saved = simulation.snapshot_json().unwrap();
    let mut restored = FleetSimulation::from_snapshot_json(&saved).unwrap();
    for _ in 0..40 {
        simulation.advance(0.05, None).unwrap();
        restored.advance(0.05, None).unwrap();
    }
    assert_eq!(
        simulation.snapshot_json().unwrap(),
        restored.snapshot_json().unwrap()
    );
    let before = simulation.snapshot_json().unwrap();
    let mut invalid = simulation.input().clone();
    invalid.dredger.as_mut().unwrap().safety_fraction = 1.1;
    assert!(simulation.advance(0.0, Some(invalid)).is_err());
    assert_eq!(before, simulation.snapshot_json().unwrap());
    let actual = frame(&simulation);
    let observed = actual["dredger"]["observation"]["depthM"].as_f64().unwrap();
    let measured = actual["dredger"]["samples"]
        .as_array()
        .unwrap()
        .iter()
        .find(|sample| sample["signal"] == "Depth")
        .unwrap()["measurement"]["value"]
        .as_f64()
        .unwrap();
    assert_ne!(observed, measured);
}

#[test]
fn dredger_given_carriage_chain_releases_and_recaptures_without_teleportation() {
    let config = SessionConfiguration {
        vessel: "dredger-tianjing".into(),
        noise_level: NoiseLevel::N0,
        dredger: Some(DredgerConfiguration::default()),
        ..Default::default()
    };
    let mut simulation = FleetSimulation::new(config).unwrap();
    let mut input = working_input(&simulation, -0.5);
    let mut previous_position = [0.0; 3];
    let mut maximum_position_step = 0.0f64;
    let mut old_anchor = None;
    for tick in 0..3600 {
        let time = tick as f64 * 0.05;
        let control = input.dredger.as_mut().unwrap();
        control.requested_mode = if time < 60.0 || time >= 140.0 {
            DredgerMode::Prepare
        } else if time < 80.0 {
            DredgerMode::Exit
        } else {
            DredgerMode::Transit
        };
        control.commands.carriage_speed_mps = if (80.0..120.0).contains(&time) {
            0.025
        } else {
            0.0
        };
        simulation.advance(0.05, Some(input.clone())).unwrap();
        let actual = frame(&simulation);
        let position: [f64; 3] =
            serde_json::from_value(actual["truth"]["position_ned"].clone()).unwrap();
        maximum_position_step = maximum_position_step
            .max((position[0] - previous_position[0]).hypot(position[1] - previous_position[1]));
        previous_position = position;
        if tick == 1000 {
            let snapshot: serde_json::Value =
                serde_json::from_str(&simulation.snapshot_json().unwrap()).unwrap();
            old_anchor = Some(snapshot["plant"]["dredger"]["spudAnchorNed"].clone());
        }
    }
    let actual = frame(&simulation);
    assert_eq!(actual["dredgerController"]["mode"], "spud_hold");
    assert_eq!(actual["dredgerFineMetrics"]["hardViolationDurationS"], 0.0);
    assert!(
        (actual["dredger"]["observation"]["carriageM"]
            .as_f64()
            .unwrap()
            - 1.0)
            .abs()
            < 0.01
    );
    assert!(maximum_position_step < 0.01);
    let snapshot: serde_json::Value =
        serde_json::from_str(&simulation.snapshot_json().unwrap()).unwrap();
    assert_ne!(
        old_anchor.unwrap(),
        snapshot["plant"]["dredger"]["spudAnchorNed"]
    );
}

#[test]
fn dredger_wave_fault_occurs_during_real_cutting_and_keeps_finite_actuator_limits() {
    let config: SessionConfiguration = serde_json::from_value(serde_json::json!({
        "vessel":"dredger-tianjing","noiseLevel":"N1","environment":"E1",
        "environmentSwitches":{"wind_force_enabled":true,"current_enabled":true,"wave_enabled":true},
        "environmentOverrides":{"wave":{"hs_m":0.5,"tp_s":6.0,"direction_to_deg":90.0,"water_depth_m":20.0}},
        "dredger":{"soil":"sand","initialDepthM":19.5,"initialSpudDown":true,
            "initialCablesAttached":true,"cableBreakTimeS":180.0,"brokenCableIndex":1}
    })).unwrap();
    let mut simulation = FleetSimulation::new(config).unwrap();
    let mut input = working_input(&simulation, 20.3);
    let control = input.dredger.as_mut().unwrap();
    control.requested_mode = DredgerMode::CutSwing;
    control.commands.cutter_rpm = 30.0;
    control.automatic_swing = true;
    control.entry_hold_s = 5.0;
    control.kp_multiplier = 0.2;
    control.ti_multiplier = 3.0;
    control.local_model = Some(
        serde_json::from_value(serde_json::json!({
            "kind":"nomoto1","k":1.8837153653045424,"t_s":3.30471349943374
        }))
        .unwrap(),
    );
    for _ in 0..3600 {
        simulation.advance(0.05, Some(input.clone())).unwrap();
    }
    assert_eq!(frame(&simulation)["dredgerController"]["mode"], "cut_swing");
    for _ in 0..1200 {
        simulation.advance(0.05, Some(input.clone())).unwrap();
    }
    let actual = frame(&simulation);
    eprintln!(
        "wave fault fine={}, modes={}",
        actual["dredgerFineMetrics"], actual["dredgerController"]["events"]
    );
    assert_eq!(actual["dredger"]["cableBroken"][1], true);
    assert_eq!(actual["dredger"]["commands"]["cutterRpm"], 0.0);
    assert_eq!(actual["dredgerController"]["mode"], "recover");
    assert_eq!(actual["dredgerFineMetrics"]["hardViolationDurationS"], 0.0);
}
