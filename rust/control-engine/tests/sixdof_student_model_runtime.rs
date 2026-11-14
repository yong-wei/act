use control_engine::sixdof::session::FleetSimulation;
use control_engine::sixdof::student_model::{ModelStructure, predict};
use control_engine::virtual_simulation_runtime::compute_virtual_simulation_step_json;
use serde_json::{Value, json};

fn compute(request: Value) -> Value {
    serde_json::from_str(&compute_virtual_simulation_step_json(&request.to_string()).unwrap()).unwrap()
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
