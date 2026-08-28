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
    assert!(error.contains("authorized model parameters"));
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
