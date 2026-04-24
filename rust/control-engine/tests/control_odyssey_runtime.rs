use control_engine::control_odyssey_runtime::compute_simulation_step_json;
use serde_json::{Value, json};

fn request(model: Value, controller: Value, state: Value, input: Value) -> String {
    json!({
        "model": model,
        "controller": controller,
        "state": state,
        "input": input
    })
    .to_string()
}

fn base_state() -> Value {
    json!({
        "time": 0.0,
        "baseOffset": 200.0,
        "baseY": 200.0,
        "lastBaseY": 200.0,
        "plantState": [],
        "delayBuffer": [],
        "integral": 0.0,
        "prevError": 0.0,
        "speedFeedbackState": 0.0,
        "predictorNoDelayState": [],
        "predictorDelayState": [],
        "predictorDelayBuffer": [],
        "predictorNoDelayY": 200.0,
        "predictorDelayY": 200.0,
        "lastMode": "manual",
        "y": 200.0,
        "v": 0.0,
        "u": 0.0,
        "r": 200.0
    })
}

fn auto_controller() -> Value {
    json!({
        "mode": "auto",
        "pid": { "kp": 2.0, "ki": 0.8, "kd": 0.2 },
        "speedFeedback": { "enabled": true, "tau": 0.5 },
        "feedforward": { "enabled": true, "gain": 0.4, "base": 200.0 },
        "smithPredictor": { "enabled": true, "delay": 0.2 },
        "limits": { "manual": 1.0, "p": 10.0, "i": 2.0, "d": 4.0, "vfb": 2.0, "ff": 2.0 },
        "controlRate": 1.5
    })
}

#[test]
fn tustin_step_and_output_disturbance_are_finite() {
    let json = request(
        json!({
            "type": "transferFunction",
            "coefficientOrder": "ascending",
            "numerator": [120.0],
            "denominator": [1.0, 0.6],
            "delay": 0.0
        }),
        json!({
            "mode": "manual",
            "pid": { "kp": 0.0, "ki": 0.0, "kd": 0.0 },
            "limits": { "manual": 1.0 },
            "controlRate": 1.0
        }),
        base_state(),
        json!({ "dt": 1.0 / 60.0, "inputCommand": 1.0, "disturbance": 12.0 }),
    );

    let result: Value =
        serde_json::from_str(&compute_simulation_step_json(&json).unwrap()).unwrap();
    assert!(
        result["sample"]["plantOutput"]
            .as_f64()
            .unwrap()
            .is_finite()
    );
    assert_eq!(
        result["sample"]["output"].as_f64().unwrap()
            - result["sample"]["plantOutput"].as_f64().unwrap(),
        12.0
    );
}

#[test]
fn delay_pid_limits_speed_feedback_feedforward_and_smith_are_reported() {
    let mut state = base_state();
    state["r"] = json!(260.0);
    let json = request(
        json!({
            "type": "transferFunction",
            "coefficientOrder": "ascending",
            "numerator": [120.0],
            "denominator": [0.0, 1.0],
            "delay": 0.2
        }),
        auto_controller(),
        state,
        json!({ "dt": 1.0 / 60.0, "inputCommand": 0.0, "disturbance": 0.0 }),
    );

    let result: Value =
        serde_json::from_str(&compute_simulation_step_json(&json).unwrap()).unwrap();
    let terms = &result["sample"]["controllerTerms"];
    assert!(terms["p"].as_f64().unwrap().abs() <= 10.0);
    assert!(terms["i"].as_f64().unwrap().abs() <= 2.0);
    assert!(terms["d"].as_f64().unwrap().abs() <= 4.0);
    assert!(terms["vfb"].as_f64().unwrap().abs() <= 2.0);
    assert!(terms["ff"].as_f64().unwrap().abs() <= 2.0);
    assert!(result["sample"]["smith"]["enabled"].as_bool().unwrap());
    assert!(result["state"]["delayBuffer"].as_array().unwrap().len() >= 2);
}

#[test]
fn all_control_odyssey_models_step_without_nan() {
    let models = [
        json!({"numerator":[120.0],"denominator":[0.0,1.0]}),
        json!({"numerator":[120.0],"denominator":[1.0,0.6]}),
        json!({"numerator":[120.0],"denominator":[0.0,1.0,0.6]}),
        json!({"numerator":[120.0],"denominator":[0.0,1.0,1.8]}),
        json!({"numerator":[120.0],"denominator":[0.0,1.0],"delay":0.5}),
        json!({"numerator":[120.0],"denominator":[0.0,1.0,1.2],"delay":0.6}),
        json!({"numerator":[80.0],"denominator":[0.0,0.0,1.0]}),
        json!({"numerator":[484.0],"denominator":[4.84,1.54,1.0]}),
        json!({"numerator":[400.0],"denominator":[4.0,1.0,1.0],"delay":0.4}),
        json!({"numerator":[100.0,-80.0],"denominator":[1.0,1.2]}),
        json!({"numerator":[80.0,-72.0],"denominator":[0.0,1.0,1.0]}),
        json!({"numerator":[60.0],"denominator":[-1.0,1.8]}),
        json!({"numerator":[60.0],"denominator":[-1.0,1.8],"delay":0.3}),
        json!({"numerator":[100.0],"denominator":[1.0,2.9,2.5,0.576]}),
        json!({"numerator":[60.0,-36.0],"denominator":[-1.0,0.7,1.2]}),
    ];

    for model in models {
        let json = request(
            json!({
                "type": "transferFunction",
                "coefficientOrder": "ascending",
                "numerator": model["numerator"].clone(),
                "denominator": model["denominator"].clone(),
                "delay": model["delay"].as_f64().unwrap_or(0.0)
            }),
            auto_controller(),
            {
                let mut state = base_state();
                state["r"] = json!(230.0);
                state
            },
            json!({ "dt": 1.0 / 60.0, "inputCommand": 0.0, "disturbance": 0.0 }),
        );
        let result: Value =
            serde_json::from_str(&compute_simulation_step_json(&json).unwrap()).unwrap();
        assert!(result["sample"]["output"].as_f64().unwrap().is_finite());
        assert!(result["sample"]["control"].as_f64().unwrap().is_finite());
    }
}
