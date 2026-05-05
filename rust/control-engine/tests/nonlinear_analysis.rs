use control_engine::compute_nonlinear_analysis;
use serde_json::{json, Value};

fn compute(request: Value) -> Value {
    let result = compute_nonlinear_analysis(&request.to_string()).expect("nonlinear analysis should compute");
    serde_json::from_str(&result).expect("result should be valid json")
}

#[test]
fn computes_phase_plane_trajectories_for_unit_5_2() {
    let result = compute(json!({
        "runtimeMode": "nonlinear_analysis",
        "analysisKind": "phase_plane",
        "modelId": "damped_second_order",
        "initialPoint": [1.2, 0.1],
        "parameters": { "zeta": 0.35, "omega_n": 1.0 },
        "timeRange": { "start": 0.0, "end": 8.0, "samples": 180 }
    }));

    let trajectory = result["phasePlane"]["trajectories"][0]["points"].as_array().unwrap();
    let vector_field = result["phasePlane"]["vectorField"].as_array().unwrap();
    assert!(trajectory.len() >= 120);
    assert!(vector_field.len() >= 160);
    assert!(vector_field.iter().any(|point| point["x"].as_f64().unwrap() == -3.0));
    assert!(vector_field.iter().any(|point| point["x"].as_f64().unwrap() == 3.0));
    assert!(vector_field.iter().any(|point| point["y"].as_f64().unwrap() == -3.0));
    assert!(vector_field.iter().any(|point| point["y"].as_f64().unwrap() == 3.0));
    assert_eq!(result["summary"]["outcome"].as_str().unwrap(), "阻尼二阶轨迹逐步收敛到原点");

    let van_der_pol = compute(json!({
        "runtimeMode": "nonlinear_analysis",
        "analysisKind": "phase_plane",
        "modelId": "van_der_pol",
        "initialPoint": [1.2, 0.1],
        "parameters": { "mu": 1.0 },
        "timeRange": { "start": 0.0, "end": 8.0, "samples": 180 }
    }));
    let vdp_field = van_der_pol["phasePlane"]["vectorField"].as_array().unwrap();
    assert!(vdp_field.iter().any(|point| point["y"].as_f64().unwrap() == -4.0));
    assert!(vdp_field.iter().any(|point| point["y"].as_f64().unwrap() == 4.0));
}

#[test]
fn computes_negative_inverse_family_with_complex_branch() {
    let result = compute(json!({
        "runtimeMode": "nonlinear_analysis",
        "analysisKind": "negative_inverse_family",
        "modelId": "hysteresis_relay",
        "parameters": { "M": 1.0, "h": 0.5, "A": 2.0 },
        "timeRange": { "start": 0.0, "end": 1.0, "samples": 80 }
    }));

    let points = result["negativeInverse"]["curves"][0]["points"].as_array().unwrap();
    assert!(points.len() >= 60);
    assert!(points.iter().any(|point| point["im"].as_f64().unwrap().abs() > 0.01));
    assert!(result["negativeInverse"]["curves"][0]["selectedPoint"]["amplitude"].as_f64().unwrap() > 1.9);
    assert_eq!(result["negativeInverse"]["curves"][0]["marks"]["direction"].as_str().unwrap(), "arrow_for_increasing_A");
}

#[test]
fn computes_harmonic_lowpass_with_output_comparison_and_spectrum() {
    let result = compute(json!({
        "runtimeMode": "nonlinear_analysis",
        "analysisKind": "harmonic_lowpass",
        "modelId": "ideal_relay",
        "parameters": { "A": 2.0, "omega": 1.0, "omega_c": 2.0, "M": 1.0 },
        "timeRange": { "start": 0.0, "end": 8.0, "samples": 120 }
    }));

    assert!(result["harmonic"]["input"].as_array().unwrap().len() >= 100);
    assert!(result["harmonic"]["relayOutput"].as_array().unwrap().len() >= 100);
    assert!(result["harmonic"]["filteredOutput"].as_array().unwrap().len() >= 100);
    assert!(result["harmonic"]["describingFunctionApproximation"].as_array().unwrap().len() >= 100);
    assert_eq!(result["harmonic"]["spectrum"].as_array().unwrap().len(), 3);
}

#[test]
fn computes_distinct_characteristics_for_unit_5_2_tabs() {
    let saturation = compute(json!({
        "runtimeMode": "nonlinear_analysis",
        "analysisKind": "characteristic",
        "modelId": "saturation",
        "parameters": { "k": 1.0, "a": 1.0, "A": 2.0 },
        "timeRange": { "start": -2.0, "end": 2.0, "samples": 9 }
    }));
    let deadzone = compute(json!({
        "runtimeMode": "nonlinear_analysis",
        "analysisKind": "characteristic",
        "modelId": "deadzone",
        "parameters": { "k": 1.0, "Delta": 0.5, "A": 2.0 },
        "timeRange": { "start": -2.0, "end": 2.0, "samples": 9 }
    }));
    let hysteresis = compute(json!({
        "runtimeMode": "nonlinear_analysis",
        "analysisKind": "characteristic",
        "modelId": "hysteresis_relay",
        "parameters": { "M": 1.0, "h": 0.5, "A": 2.0 },
        "timeRange": { "start": -2.0, "end": 2.0, "samples": 9 }
    }));

    assert_ne!(saturation["characteristic"]["curve"], deadzone["characteristic"]["curve"]);
    assert!(hysteresis["characteristic"]["curve"].as_array().unwrap().len() > 9);
    assert!(saturation["characteristic"]["signalComparison"]["input"].as_array().unwrap().len() >= 9);
    assert!(saturation["characteristic"]["signalComparison"]["output"].as_array().unwrap().len() >= 9);
    assert!(hysteresis["characteristic"]["describingFunction"]["im"].as_f64().unwrap().abs() > 0.01);
}

#[test]
fn computes_turning_radius_constraints_for_unit_5_3() {
    let tight = compute(json!({
        "runtimeMode": "nonlinear_analysis",
        "analysisKind": "turning_radius",
        "modelId": "mass_avoidance_turn",
        "parameters": { "R_m": 35.0 },
        "timeRange": { "start": 0.0, "end": 82.0, "samples": 180 }
    }));
    let medium = compute(json!({
        "runtimeMode": "nonlinear_analysis",
        "analysisKind": "turning_radius",
        "modelId": "mass_avoidance_turn",
        "parameters": { "R_m": 65.0 },
        "timeRange": { "start": 0.0, "end": 82.0, "samples": 180 }
    }));
    let wide = compute(json!({
        "runtimeMode": "nonlinear_analysis",
        "analysisKind": "turning_radius",
        "modelId": "mass_avoidance_turn",
        "parameters": { "R_m": 140.0 },
        "timeRange": { "start": 0.0, "end": 82.0, "samples": 180 }
    }));

    assert_eq!(tight["turningRadius"]["saturationActive"].as_bool().unwrap(), true);
    assert_eq!(wide["turningRadius"]["saturationActive"].as_bool().unwrap(), false);
    assert_eq!(tight["turningRadius"]["collisionActive"].as_bool().unwrap(), true);
    assert_eq!(medium["turningRadius"]["collisionActive"].as_bool().unwrap(), false);
    assert_eq!(wide["turningRadius"]["collisionActive"].as_bool().unwrap(), false);
    assert_eq!(medium["turningRadius"]["safetyConstraintSatisfied"].as_bool().unwrap(), false);
    assert_eq!(wide["turningRadius"]["safetyConstraintSatisfied"].as_bool().unwrap(), true);
    assert!(tight["turningRadius"]["maxDeltaDeg"].as_f64().unwrap() >= 17.5);
    assert!(wide["turningRadius"]["maxDeltaDeg"].as_f64().unwrap() < 16.0);
    assert!(medium["turningRadius"]["dStartM"].as_f64().unwrap() > tight["turningRadius"]["dStartM"].as_f64().unwrap());
    assert!(tight["turningRadius"]["minDistanceM"].as_f64().unwrap() < 25.0);
    assert!(medium["turningRadius"]["minDistanceM"].as_f64().unwrap() > 25.0);
    assert!(medium["turningRadius"]["minDistanceM"].as_f64().unwrap() < 41.0);
    assert!(wide["turningRadius"]["minDistanceM"].as_f64().unwrap() > 41.0);
    assert_eq!(tight["turningRadius"]["headingCurves"].as_array().unwrap().len(), 2);
    assert!(wide["turningRadius"]["path"]["actual"].as_array().unwrap().len() >= 120);
    assert!(wide["summary"]["metrics"].as_array().unwrap().iter().any(|item| {
        item.as_str().unwrap_or("").contains("R=140")
    }));
}
