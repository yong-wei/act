use control_engine::virtual_simulation_runtime::compute_virtual_simulation_step_json;
use serde_json::{json, Value};

#[test]
fn arena_cruise_roll_preview_consumes_identity_and_returns_finite_trace() {
    let request = json!({
        "modelId": "arena_cruise_roll_preview",
        "taskId": "task-cruise-roll-blackbox-identification",
        "datasetHash": "arena-blackbox-dataset-preview123456",
        "identificationModelId": "arena-identification-preview12345",
        "controllerHash": "artifact-preview",
        "controllerGain": 1.6,
        "dampingCompensation": 0.72,
        "energyBudget": 12.0,
        "initialRoll": 0.2,
        "sampleTime": 0.2,
        "steps": 61,
        "modelRelation": "surrogate"
    });
    let result: Value = serde_json::from_str(
        &compute_virtual_simulation_step_json(&request.to_string()).unwrap(),
    )
    .unwrap();
    let trace = result["trace"].as_array().unwrap();
    assert_eq!(trace.len(), 61);
    assert!(result["summary"]["trackingError"].as_f64().unwrap().is_finite());
    assert!(result["summary"]["controlEnergy"].as_f64().unwrap().is_finite());
    assert_eq!(
        result["identity"]["taskId"].as_str().unwrap(),
        "task-cruise-roll-blackbox-identification"
    );
    assert_eq!(result["modelRelation"].as_str().unwrap(), "surrogate");
}

#[test]
fn identified_preview_without_authorized_parameters_fails_closed() {
    let request = json!({
        "modelId": "arena_cruise_roll_preview",
        "taskId": "task-cruise-roll-blackbox-identification",
        "datasetHash": "arena-blackbox-dataset-preview123456",
        "identificationModelId": "arena-identification-preview12345",
        "controllerHash": "artifact-preview",
        "controllerGain": 1.6,
        "dampingCompensation": 0.72,
        "energyBudget": 12.0,
        "initialRoll": 0.2,
        "modelRelation": "identified"
    });
    let error = compute_virtual_simulation_step_json(&request.to_string()).unwrap_err();
    assert!(error.contains("authorized plantDamping"));
}

#[test]
fn identified_preview_consumes_authorized_plant_parameters() {
    let surrogate = json!({
        "modelId": "arena_cruise_roll_preview",
        "taskId": "task-cruise-roll-blackbox-identification",
        "datasetHash": "arena-blackbox-dataset-preview123456",
        "identificationModelId": "arena-identification-preview12345",
        "controllerHash": "artifact-preview",
        "controllerGain": 1.6,
        "dampingCompensation": 0.72,
        "energyBudget": 12.0,
        "initialRoll": 0.2,
        "sampleTime": 0.2,
        "steps": 61,
        "modelRelation": "surrogate"
    });
    let identified = json!({
        "modelId": "arena_cruise_roll_preview",
        "taskId": "task-cruise-roll-blackbox-identification",
        "datasetHash": "arena-blackbox-dataset-preview123456",
        "identificationModelId": "arena-identification-preview12345",
        "controllerHash": "artifact-preview",
        "controllerGain": 1.6,
        "dampingCompensation": 0.72,
        "energyBudget": 12.0,
        "initialRoll": 0.2,
        "sampleTime": 0.2,
        "steps": 61,
        "modelRelation": "identified",
        "authorizedModelParameters": {
            "plantDamping": 1.4,
            "plantStiffness": 2.2,
            "plantInputGain": 0.4
        }
    });
    let left: Value = serde_json::from_str(
        &compute_virtual_simulation_step_json(&surrogate.to_string()).unwrap(),
    )
    .unwrap();
    let right: Value = serde_json::from_str(
        &compute_virtual_simulation_step_json(&identified.to_string()).unwrap(),
    )
    .unwrap();
    assert_eq!(left["modelRelation"].as_str().unwrap(), "surrogate");
    assert_eq!(right["modelRelation"].as_str().unwrap(), "identified");
    assert_eq!(right["identity"]["plantDamping"].as_f64().unwrap(), 1.4);
    assert_ne!(
        left["summary"]["trackingError"].as_f64().unwrap(),
        right["summary"]["trackingError"].as_f64().unwrap()
    );
}

fn within_tolerance(actual: f64, expected: f64) -> bool {
    let abs = (actual - expected).abs();
    abs <= 1e-6 || abs <= expected.abs() * 1e-3
}

#[test]
fn arena_cruise_roll_preview_matches_frozen_baseline_within_tolerance() {
    let request = json!({
        "modelId": "arena_cruise_roll_preview",
        "taskId": "task-cruise-roll-blackbox-identification",
        "datasetHash": "arena-blackbox-dataset-preview123456",
        "identificationModelId": "arena-identification-preview12345",
        "controllerHash": "artifact-preview",
        "controllerGain": 1.6,
        "dampingCompensation": 0.72,
        "energyBudget": 12.0,
        "initialRoll": 0.2,
        "sampleTime": 0.2,
        "steps": 61,
        "modelRelation": "surrogate"
    });
    let result: Value = serde_json::from_str(
        &compute_virtual_simulation_step_json(&request.to_string()).unwrap(),
    )
    .unwrap();
    let tracking = result["summary"]["trackingError"].as_f64().unwrap();
    let max_deviation = result["summary"]["maxDeviation"].as_f64().unwrap();
    let control_energy = result["summary"]["controlEnergy"].as_f64().unwrap();
    let smoothness = result["summary"]["smoothness"].as_f64().unwrap();
    let safety_violations = result["summary"]["safetyViolations"].as_u64().unwrap();
    assert!(tracking.is_finite() && tracking >= 0.0);
    assert!(max_deviation.is_finite() && max_deviation >= tracking);
    assert!(control_energy.is_finite() && control_energy > 0.0);
    assert!(within_tolerance(tracking, 0.025));
    assert!(within_tolerance(max_deviation, 0.183));
    assert!(within_tolerance(control_energy, 0.053));
    assert!(within_tolerance(smoothness, 0.991));
    assert_eq!(safety_violations, 0);
    assert_eq!(result["trace"].as_array().unwrap().len(), 61);
    assert_eq!(result["identity"]["plantDamping"].as_f64().unwrap(), 0.72);
}

#[test]
fn preview_identity_change_is_visible_in_result_identity() {
    let base = json!({
        "modelId": "arena_cruise_roll_preview",
        "taskId": "task-a",
        "datasetHash": "arena-blackbox-dataset-aaaaaaaaaaaa",
        "identificationModelId": "model-a",
        "controllerHash": "artifact-a",
        "controllerGain": 1.6,
        "dampingCompensation": 0.72,
        "energyBudget": 12.0,
        "initialRoll": 0.2,
        "modelRelation": "surrogate"
    });
    let mutated = {
        let mut value = base.clone();
        value["taskId"] = json!("task-b");
        value
    };
    let left: Value = serde_json::from_str(
        &compute_virtual_simulation_step_json(&base.to_string()).unwrap(),
    )
    .unwrap();
    let right: Value = serde_json::from_str(
        &compute_virtual_simulation_step_json(&mutated.to_string()).unwrap(),
    )
    .unwrap();
    assert_ne!(
        left["identity"]["taskId"].as_str().unwrap(),
        right["identity"]["taskId"].as_str().unwrap()
    );
}
