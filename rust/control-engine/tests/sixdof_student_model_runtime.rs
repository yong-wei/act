use control_engine::sixdof::session::FleetSimulation;
use control_engine::sixdof::student_model::{ModelStructure, predict};
use control_engine::virtual_simulation_runtime::compute_virtual_simulation_step_json;
use serde_json::{Value, json};

fn compute(request: Value) -> Value {
    serde_json::from_str(&compute_virtual_simulation_step_json(&request.to_string()).unwrap()).unwrap()
}

#[test]
fn cruise_roll_design_reuses_the_physical_feedback_gains_and_keeps_ideal_frequency_units() {
    let request=json!({"modelId":"student_model_analysis","operation":"roll_design","input":{
        "enabled":true,"model":{"inertiaKgM2":1e10,"dampingNmSRad":2e8,"stiffnessNmRad":1e9},
        "dampingRatio":0.5,"stiffnessFraction":0.2,"lowPassCutoffHz":0.3,"notch":null}});
    let result=compute(request.clone());
    let rate_gain=1e19_f64.sqrt()-2e8;
    assert_eq!(result["angleGainNmRad"],2e8);
    assert!((result["rateGainNmSRad"].as_f64().unwrap()-rate_gain).abs()<1e-6);
    assert!((result["naturalFrequencyRadS"].as_f64().unwrap()-(0.12_f64).sqrt()).abs()<1e-12);
    let bins=result["bins"].as_array().unwrap();
    assert_eq!(bins.len(),81);
    assert!((bins[0]["frequencyHz"].as_f64().unwrap()-0.01).abs()<1e-12);
    assert!((bins[80]["frequencyHz"].as_f64().unwrap()-1.0).abs()<1e-12);
    for bin in bins {
        assert!(bin["openAmplitudeDegPerMNm"].as_f64().unwrap().is_finite());
        assert!(bin["closedAmplitudeDegPerMNm"].as_f64().unwrap().is_finite());
    }
    let peak=bins.iter().max_by(|a,b|a["openAmplitudeDegPerMNm"].as_f64().unwrap()
        .total_cmp(&b["openAmplitudeDegPerMNm"].as_f64().unwrap())).unwrap();
    assert!(peak["closedAmplitudeDegPerMNm"].as_f64().unwrap()<peak["openAmplitudeDegPerMNm"].as_f64().unwrap());
    let mut invalid=request;
    invalid["input"]["model"]["inertiaKgM2"]=json!(-1.0);
    assert!(compute_virtual_simulation_step_json(&invalid.to_string()).is_err());
}

#[test]
fn liquid_spectrum_preserves_units_peak_and_a_flat_signals_missing_peak() {
    let values: Vec<f64> = (0..4000).map(|index|
        7.0 + 2.0 * (2.0 * std::f64::consts::PI * 0.125 * index as f64 * 0.05).sin()).collect();
    let request = json!({"modelId":"student_model_analysis","operation":"signal_spectrum",
        "values":values,"dtS":0.05,"minimumFrequencyHz":0.02,"maximumFrequencyHz":1.0});
    let result = compute(request.clone());
    assert!((result["peakFrequencyHz"].as_f64().unwrap() - 0.125).abs() < 1e-12);
    assert_eq!(result["resolutionHz"], 0.005);
    let peak = result["bins"].as_array().unwrap().iter().find(|bin|
        (bin["frequencyHz"].as_f64().unwrap() - 0.125).abs() < 1e-12).unwrap();
    assert!((peak["amplitude"].as_f64().unwrap() - 2.0).abs() < 1e-4);
    let mut flat = request;
    flat["values"] = json!(vec![7.0;4000]);
    assert!(compute(flat.clone())["peakFrequencyHz"].is_null());
    flat["dtS"] = json!(0.0);
    assert!(compute_virtual_simulation_step_json(&flat.to_string()).is_err());
}

fn metric_points(duration_s: usize, settled_at_s: f64) -> Vec<Value> {
    (0..duration_s*20).map(|tick| {
        let time = tick as f64*0.05;
        json!({"timeS":time,"referenceHeadingDeg":if time < 20.0 {0.0} else {10.0},
            "headingDeg":if time < settled_at_s {0.0} else {10.0},"headingArrivedAtS":time,"headingQuality":"Good",
            "rudderDeg":tick as f64*0.01,"rollDeg":1.0,"motorPowerW":[2e6],"positiveMotorWorkJ":time*4e6})
    }).collect()
}

#[test]
fn run_metrics_require_final_sixty_seconds_and_preserve_missing_measurements() {
    let response = compute(json!({"modelId":"student_model_analysis","operation":"run_metrics",
        "points":metric_points(180,30.0),"endTimeS":180.0,"initialHeadingDeg":0.0}));
    assert_eq!(response["final120sHeadingMaeDeg"],0.0);
    assert!((response["settlingTimeS"].as_f64().unwrap()-10.0).abs() < 1e-8);
    let mut points = metric_points(120,119.95);
    let last_point_only = compute(json!({"modelId":"student_model_analysis","operation":"run_metrics",
        "points":points,"endTimeS":120.0,"initialHeadingDeg":0.0}));
    assert!(last_point_only["settlingTimeS"].is_null());
    for point in &mut points { point["headingDeg"] = Value::Null; point["headingQuality"] = json!("Missing"); }
    let missing = compute(json!({"modelId":"student_model_analysis","operation":"run_metrics",
        "points":points,"endTimeS":120.0,"initialHeadingDeg":0.0}));
    assert!(missing["headingRmseDeg"].is_null());
    assert!(missing["final120sHeadingMaeDeg"].is_null());
    assert_eq!(missing["validHeadingSamples"],0);
}

#[test]
fn run_metrics_use_the_last_step_amplitude_and_reject_time_gaps() {
    let mut points = metric_points(180,30.0);
    for point in &mut points {
        let time = point["timeS"].as_f64().unwrap();
        point["referenceHeadingDeg"] = json!(if time < 20.0 {60.0} else {0.0});
        point["headingDeg"] = json!(-6.0);
    }
    let response = compute(json!({"modelId":"student_model_analysis","operation":"run_metrics",
        "points":points,"endTimeS":180.0,"initialHeadingDeg":0.0}));
    assert!((response["headingOvershootPercent"].as_f64().unwrap()-10.0).abs() < 1e-10);
    points[3]["timeS"] = json!(0.17);
    assert!(compute_virtual_simulation_step_json(&json!({"modelId":"student_model_analysis","operation":"run_metrics",
        "points":points,"endTimeS":180.0,"initialHeadingDeg":0.0}).to_string()).is_err());
}

#[test]
fn public_identification_normalizes_operating_point_and_freezes_a_valid_structure() {
    let input: Vec<f64> = (0..200).map(|index| if index < 20 { 50.0 } else { 55.0 }).collect();
    let deviation: Vec<f64> = input.iter().map(|value| value-50.0).collect();
    let mut output = predict(&ModelStructure::Fopdt { k: 0.1, t_s: 3.0, delay_s: 0.0 }, &deviation, 0.0, 0.05);
    output.truncate(input.len());
    for value in &mut output { *value += 8.0; }
    let identified = compute(json!({ "modelId": "student_model_analysis", "operation": "identify",
        "structureKind": "fopdt", "input": input, "output": output, "dtS": 0.05,
        "inputOrigin": 50.0, "outputOrigin": 8.0 }));
    assert_eq!(identified["identifiedOk"], true);
    assert!((identified["structure"]["k"].as_f64().unwrap()-0.1).abs() < 1e-10);
    assert!((identified["structure"]["t_s"].as_f64().unwrap()-3.0).abs() < 1e-9);
    assert_eq!(identified["predicted"].as_array().unwrap().len(), input.len());
    assert!(identified["metrics"]["rmse"].as_f64().unwrap() < 1e-12);
}

#[test]
fn failed_identification_returns_a_reason_and_never_substitutes_a_default_model() {
    let result = compute(json!({ "modelId": "student_model_analysis", "operation": "identify",
        "structureKind": "nomoto1", "input": vec![0.0; 30], "output": vec![0.0; 30],
        "dtS": 0.05, "inputOrigin": 0.0, "outputOrigin": 0.0 }));
    assert_eq!(result["identifiedOk"], false);
    assert!(result["structure"].is_null());
    assert!(result["metrics"].is_null());
    assert!(!result["failureReason"].as_str().unwrap().is_empty());
}

#[test]
fn heading_design_uses_the_student_model_and_fixed_course_formula() {
    let result = compute(json!({ "modelId":"student_model_analysis", "operation":"heading_design",
        "structure":{ "kind":"nomoto1", "k":0.06, "t_s":10.0 } }));
    assert_eq!(result["dampingRatio"],0.8);
    assert!((result["naturalFrequencyRadS"].as_f64().unwrap()-0.125).abs() < 1e-12);
    let kp = 10.0*0.125_f64.powi(2)/0.06;
    assert!((result["kp"].as_f64().unwrap()-kp).abs() < 1e-12);
    assert!((result["kd"].as_f64().unwrap()-1.0/0.06).abs() < 1e-12);
    assert!((result["ki"].as_f64().unwrap()-kp/150.0).abs() < 1e-12);
    assert!((result["kpMaximum"].as_f64().unwrap()-3.0*kp).abs() < 1e-12);
    assert!(compute_virtual_simulation_step_json(&json!({ "modelId":"student_model_analysis", "operation":"heading_design",
        "structure":{ "kind":"nomoto1", "k":-0.06, "t_s":10.0 } }).to_string()).is_err());
}

#[test]
fn command_comparison_cascades_actuator_output_before_body_input() {
    let result = compute(json!({ "modelId": "student_model_analysis", "operation": "predict",
        "structure": { "kind": "nomoto1", "k": 0.2, "t_s": 4.0 },
        "input": [5.0, 5.0, 5.0, 5.0], "output": [0.0, 0.0, 0.0, 0.0],
        "dtS": 0.05, "inputOrigin": 0.0, "outputOrigin": 0.0,
        "actuator": { "structure": { "kind": "fopdt", "k": 1.0, "t_s": 0.5, "delay_s": 0.0 },
            "inputOrigin": 0.0, "outputOrigin": 0.0, "initialOutput": 0.0 } }));
    let values = result["predicted"].as_array().unwrap();
    assert_eq!(values[0], 0.0);
    assert_eq!(values[1], 0.0);
    let expected = 0.2*(1.0-(-0.05_f64/4.0).exp())*5.0*(1.0-(-0.05_f64/0.5).exp());
    assert!((values[2].as_f64().unwrap()-expected).abs() < 1e-14);
}

#[test]
fn model_edits_and_independent_feedback_cannot_change_physical_session() {
    let session = FleetSimulation::new(Default::default()).unwrap();
    let snapshot = session.snapshot_json().unwrap();
    let mut controller = session.input().clone();
    controller.control_mode = control_engine::sixdof::control_law::HeadingControlMode::Pd;
    controller.pid.kp = 1.0;
    controller.pid.kd = 2.0;
    let request = json!({ "modelId": "student_model_analysis", "operation": "heading_closed_loop",
        "structure": { "kind": "nomoto1", "k": 0.1, "t_s": 5.0 },
        "reference": vec![10.0; 1000], "initialHeadingDeg": 0.0, "initialYawRateDegS": 0.0,
        "dtS": 0.05, "inputOrigin": 0.0, "outputOrigin": 0.0, "controller": controller });
    let first = compute(request.clone());
    let mut edited = request;
    edited["structure"]["k"] = json!(0.2);
    let second = compute(edited);
    assert_eq!(first["commandsDeg"][0], 10.0);
    assert_ne!(first["commandsDeg"][100], second["commandsDeg"][100]);
    assert_ne!(first["headingDeg"][100], second["headingDeg"][100]);
    assert_eq!(session.snapshot_json().unwrap(), snapshot);
}

#[test]
fn independent_loop_replays_controller_edits_with_its_own_feedback_and_metrics() {
    let session = FleetSimulation::new(Default::default()).unwrap();
    let mut controller = session.input().clone();
    controller.control_mode = control_engine::sixdof::control_law::HeadingControlMode::Pd;
    controller.pid.kp = 1.0;
    controller.pid.ki = 0.0;
    controller.pid.kd = 0.0;
    let mut controllers = vec![controller.clone(); 100];
    controllers[1].pid.kp = 2.0;
    let request = json!({ "modelId": "student_model_analysis", "operation": "heading_closed_loop",
        "structure": { "kind": "nomoto1", "k": 0.1, "t_s": 5.0 },
        "reference": vec![10.0; 100], "output": vec![0.0; 100],
        "initialHeadingDeg": 0.0, "initialYawRateDegS": 0.0, "dtS": 0.05,
        "inputOrigin": 0.0, "outputOrigin": 0.0, "controller": controller, "controllers": controllers });
    let response = compute(request);
    assert_eq!(response["commandsDeg"][0], 10.0);
    assert!(response["commandsDeg"][1].as_f64().unwrap() > 19.9);
    assert_eq!(response["predicted"], response["yawRateDegS"]);
    assert!(response["metrics"]["rmse"].as_f64().unwrap() > 0.0);
    assert!(response["metrics"]["fit_percent"].is_null());
}

fn speed_request(operation: &str) -> Value {
    let model = json!({"kind":"fopdt","k":0.04,"t_s":80.0,"delay_s":5.0});
    json!({"modelId":"student_model_analysis","operation":operation,
        "structure":model,"inputOrigin":100.0,"outputOrigin":4.0,
        "initialSpeedMps":4.0,"initialBowDistanceM":1500.0,"currentForwardMps":0.0,"dtS":0.05,
        "maximumRpm":200.0,"referenceMps":vec![4.0; 12001],"inputRpm":vec![100.0; 12001],
        "controller":{"localModel":{"structure":model,"speedMps":4.0,"shaftReferenceRpm":100.0},
            "referenceMps":4.0,"kpMultiplier":1.0,"tiMultiplier":1.0,"antiWindup":true,
            "smithEnabled":false,"filterTauS":0.2,"additionalCommandDelayS":0.0}})
}

#[test]
fn speed_design_and_open_loop_preserve_operating_point_and_ground_distance() {
    let request = speed_request("speed_open_loop");
    let gains = compute(json!({"modelId":"student_model_analysis","operation":"speed_design",
        "structure":request["structure"]}));
    let expected_lambda = 80.0/3.0;
    assert!((gains["lambdaS"].as_f64().unwrap()-expected_lambda).abs() < 1e-12);
    assert!((gains["kpRpmPerMps"].as_f64().unwrap()-80.0/(0.04*(expected_lambda+5.0))).abs() < 1e-12);
    assert_eq!(gains["tiS"],80.0);
    assert_eq!(gains["trackingTimeS"],16.0);
    let calm = compute(request.clone());
    assert!(calm["predicted"].as_array().unwrap().iter().all(|value| value == &json!(4.0)));
    assert!((calm["bowClearanceM"][12000].as_f64().unwrap()+900.0).abs() < 1e-8);
    let mut current = request;
    current["currentForwardMps"] = json!(0.3);
    let flowing = compute(current);
    assert_eq!(calm["predicted"],flowing["predicted"]);
    assert!((flowing["bowClearanceM"][12000].as_f64().unwrap()+1080.0).abs() < 1e-8);
}

#[test]
fn independent_speed_feedback_uses_its_own_state_and_cannot_modify_truth() {
    let physical = FleetSimulation::new(Default::default()).unwrap();
    let before = physical.snapshot_json().unwrap();
    let mut request = speed_request("speed_closed_loop");
    let steady = compute(request.clone());
    assert!(steady["commandsRpm"].as_array().unwrap().iter().all(|value| value == &json!(100.0)));
    request["referenceMps"] = json!(vec![3.0;12001]);
    let first = compute(request.clone());
    assert!((first["predicted"][12000].as_f64().unwrap()-3.0).abs() < 0.01);
    assert!(first["commandsRpm"].as_array().unwrap().iter().all(|value| value.as_f64().unwrap().abs() <= 200.0));
    request["structure"]["k"] = json!(0.08);
    let edited = compute(request);
    assert_ne!(first["predicted"][200],edited["predicted"][200]);
    assert_ne!(first["commandsRpm"][200],edited["commandsRpm"][200]);
    assert_eq!(physical.snapshot_json().unwrap(),before);
}

#[test]
fn longitudinal_forecast_rejects_invalid_sampling_models_and_references() {
    let mut request = speed_request("speed_closed_loop");
    request["dtS"] = json!(0.07);
    assert!(compute_virtual_simulation_step_json(&request.to_string()).is_err());
    request["dtS"] = json!(0.05);
    request["structure"]["k"] = json!(-0.04);
    assert!(compute_virtual_simulation_step_json(&request.to_string()).is_err());
    request["structure"]["k"] = json!(0.04);
    request["referenceMps"][1] = json!(5.0);
    assert!(compute_virtual_simulation_step_json(&request.to_string()).is_err());
}

#[test]
fn speed_forecast_preserves_five_hertz_sampling_and_uses_its_own_braking_plan() {
    let mut request = speed_request("speed_closed_loop");
    request["dtS"] = json!(0.2);
    request["referenceMps"] = json!(vec![4.0;3001]);
    let steady = compute(request.clone());
    assert_eq!(steady["predicted"].as_array().unwrap().len(),3001);
    assert!((steady["bowClearanceM"][3000].as_f64().unwrap()+900.0).abs() < 1e-8);
    request["brakingPlan"] = json!({"brakingDistanceM":1200.0,
        "nodes":[{"distanceM":600.0,"speedMps":2.0},{"distanceM":30.0,"speedMps":0.0}]});
    let planned = compute(request);
    assert!(planned["predicted"][3000].as_f64().unwrap() < 1.0);
    assert!(planned["bowClearanceM"][3000].as_f64().unwrap() > -100.0);
    assert_ne!(steady["commandsRpm"][2000],planned["commandsRpm"][2000]);
}

#[test]
fn delayed_first_measurement_evaluates_the_independent_prediction_from_its_declared_initial_state() {
    let mut request = speed_request("speed_closed_loop");
    let before = compute(request.clone());
    let predicted = before["predicted"].as_array().unwrap();
    request["outputOffsetSamples"] = json!(1);
    request["output"] = json!(&predicted[1..]);
    let aligned = compute(request.clone());
    assert_eq!(aligned["predicted"], before["predicted"]);
    assert_eq!(aligned["bowClearanceM"], before["bowClearanceM"]);
    assert_eq!(aligned["metrics"]["rmse"], 0.0);
    request["outputOffsetSamples"] = json!(predicted.len());
    assert!(compute_virtual_simulation_step_json(&request.to_string()).is_err());
}

fn container_forecast_request() -> Value {
    let models: Vec<Value> = [(0.2, 0.04, 120.0, 40.0), (0.6, 0.05, 160.0, 55.0), (0.9, 0.06, 200.0, 65.0)]
        .into_iter().map(|(loading, k, t, rpm)| json!({"loadingRatio":loading,"operatingModel":{
            "structure":{"kind":"fopdt","k":k,"t_s":t,"delay_s":2.0},"speedMps":8.0,"shaftReferenceRpm":rpm}})).collect();
    json!({"modelId":"student_model_analysis","operation":"container_closed_loop",
        "structure":{"kind":"fopdt","k":0.05,"t_s":160.0,"delay_s":2.0},
        "inputOrigin":55.0,"outputOrigin":8.0,"initialSpeedMps":8.0,"initialBowDistanceM":0.0,
        "currentForwardMps":0.0,"dtS":0.2,"maximumRpm":90.0,"loadingRatio":0.6,
        "referenceMps":vec![8.0;6001],"voyage":{"segmentSpeedsMps":[8.0,8.0,8.0,8.0]},
        "initialShaftPowerW":40e6,"fuelModel":{"rated_shaft_power_w":65e6,"auxiliary_power_w":2e6,
            "efficiency":0.95,"load_fractions":[0.1,0.25,0.5,0.75,1.0],"sfoc_g_per_kwh":[230,195,180,175,185]},
        "controller":{"models":models,"referenceMps":8.0,"fixedModelIndex":1,"schedulingEnabled":false,
            "bumpless":true,"kpMultiplier":1.0,"tiMultiplier":1.0,"antiWindup":true,
            "filterTauS":0.2,"feedback":"water","losLookaheadM":null}})
}

#[test]
fn container_forecast_uses_its_own_distance_and_keeps_fuel_in_the_arrival_window() {
    let request = container_forecast_request();
    let first = compute(request.clone());
    assert_eq!(first["predicted"].as_array().unwrap().len(), 6001);
    assert!((first["idealArrivalS"].as_f64().unwrap() - 750.0).abs() < 1e-6);
    let fuel: control_engine::sixdof::fuel::FuelModel = serde_json::from_value(request["fuelModel"].clone()).unwrap();
    assert!((first["idealFuelKg"].as_f64().unwrap() - 750.0 * fuel.rates(40e6, true).fuel_kg_per_s).abs() < 1e-6);
    let mut actual = request;
    actual["outputOffsetSamples"] = json!(1);
    actual["output"] = json!(vec![100.0;6000]);
    let compared = compute(actual);
    assert_eq!(first["commandsRpm"], compared["commandsRpm"]);
    assert_eq!(first["predicted"], compared["predicted"]);
    assert_eq!(first["idealArrivalS"], compared["idealArrivalS"]);
    assert!(compared["metrics"]["rmse"].as_f64().unwrap() > 90.0);
}

#[test]
fn container_forecast_rejects_invalid_reference_and_missing_voyage_workpoint() {
    let mut request = container_forecast_request();
    request["referenceMps"][0] = json!(4.0);
    assert!(compute_virtual_simulation_step_json(&request.to_string()).is_err());
    request["referenceMps"][0] = json!(8.0);
    request["initialShaftPowerW"] = Value::Null;
    assert!(compute_virtual_simulation_step_json(&request.to_string()).is_err());
}
