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

fn level_models() -> Vec<(&'static str, Value)> {
    vec![
        (
            "level-1",
            json!({"numerator":[120.0],"denominator":[0.0,1.0]}),
        ),
        (
            "level-2",
            json!({"numerator":[120.0],"denominator":[1.0,0.6]}),
        ),
        (
            "level-3",
            json!({"numerator":[120.0],"denominator":[0.0,1.0,0.6]}),
        ),
        (
            "level-4",
            json!({"numerator":[120.0],"denominator":[0.0,1.0,1.8]}),
        ),
        (
            "level-5",
            json!({"numerator":[120.0],"denominator":[0.0,1.0],"delay":0.5}),
        ),
        (
            "level-6",
            json!({"numerator":[120.0],"denominator":[0.0,1.0,1.2],"delay":0.6}),
        ),
        (
            "level-7",
            json!({"numerator":[80.0],"denominator":[0.0,0.0,1.0]}),
        ),
        (
            "level-8",
            json!({"numerator":[484.0],"denominator":[4.84,1.54,1.0]}),
        ),
        (
            "level-9",
            json!({"numerator":[400.0],"denominator":[4.0,1.0,1.0],"delay":0.4}),
        ),
        (
            "level-10",
            json!({"numerator":[100.0,-80.0],"denominator":[1.0,1.62,0.504]}),
        ),
        (
            "level-11",
            json!({"numerator":[80.0,-72.0],"denominator":[0.0,1.0,1.0]}),
        ),
        (
            "level-12",
            json!({"numerator":[60.0],"denominator":[-1.0,1.8]}),
        ),
        (
            "level-13",
            json!({"numerator":[60.0],"denominator":[-1.0,1.8],"delay":0.3}),
        ),
        (
            "level-14",
            json!({"numerator":[100.0],"denominator":[1.0,2.9,2.5,0.576]}),
        ),
        (
            "level-15",
            json!({"numerator":[60.0,-36.0],"denominator":[-1.0,0.7,1.2],"delay":0.3}),
        ),
    ]
}

fn level_request(
    model: &Value,
    controller: Value,
    state: Value,
    dt: f64,
    disturbance: f64,
) -> String {
    request(
        json!({
            "type": "transferFunction",
            "coefficientOrder": "ascending",
            "numerator": model["numerator"].clone(),
            "denominator": model["denominator"].clone(),
            "delay": model["delay"].as_f64().unwrap_or(0.0)
        }),
        controller,
        state,
        json!({ "dt": dt, "inputCommand": 0.0, "disturbance": disturbance }),
    )
}

fn reference_y(tier: &str, x: f64) -> f64 {
    if x < 500.0 {
        return 200.0;
    }
    let events: &[(f64, f64)] = match tier {
        "bronze" => &[(700.0, 60.0)],
        _ => &[
            (650.0, 70.0),
            (1050.0, -80.0),
            (1550.0, 60.0),
            (2250.0, -50.0),
        ],
    };
    200.0
        + events
            .iter()
            .filter(|(at, _)| x >= *at)
            .map(|(_, amplitude)| amplitude)
            .sum::<f64>()
}

fn disturbance_y(tier: &str, x: f64) -> f64 {
    if tier != "gold" {
        return 0.0;
    }
    [
        (900.0, 24.0, 140.0),
        (1700.0, -30.0, 160.0),
        (2400.0, 20.0, 120.0),
    ]
    .iter()
    .filter(|(at, _, duration)| x >= *at && x <= *at + *duration)
    .map(|(_, amplitude, _)| amplitude)
    .sum()
}

fn pd_controller() -> Value {
    json!({
        "mode": "auto",
        "pid": { "kp": 0.4, "ki": 0.0, "kd": 0.4 },
        "limits": { "manual": 5.0, "p": 5.0, "i": 0.0, "d": 5.0, "vfb": 0.0, "ff": 0.0 },
        "controlRate": 1.5,
        "setpointRate": 120.0
    })
}

fn pid_assist_controller(model_delay: f64) -> Value {
    json!({
        "mode": "auto",
        "pid": { "kp": 0.3, "ki": 0.05, "kd": 0.2 },
        "speedFeedback": { "enabled": true, "tau": 0.05 },
        "feedforward": { "enabled": true, "gain": 0.05, "base": 200.0 },
        "smithPredictor": { "enabled": model_delay > 0.0, "delay": model_delay },
        "limits": { "manual": 10.0, "p": 10.0, "i": 10.0, "d": 10.0, "vfb": 10.0, "ff": 10.0 },
        "controlRate": 1.5,
        "setpointRate": 120.0
    })
}

#[test]
fn pd_derivative_does_not_kick_on_setpoint_step() {
    let mut state = base_state();
    state["lastMode"] = json!("auto");
    state["r"] = json!(260.0);
    let json = request(
        json!({
            "type": "transferFunction",
            "coefficientOrder": "ascending",
            "numerator": [120.0],
            "denominator": [1.0, 0.6],
            "delay": 0.0
        }),
        json!({
            "mode": "auto",
            "pid": { "kp": 0.4, "ki": 0.0, "kd": 0.4 },
            "limits": { "manual": 5.0, "p": 5.0, "i": 0.0, "d": 5.0, "vfb": 0.0, "ff": 0.0 },
            "controlRate": 1.5
        }),
        state,
        json!({ "dt": 1.0 / 60.0, "inputCommand": 0.0, "disturbance": 0.0 }),
    );

    let result: Value =
        serde_json::from_str(&compute_simulation_step_json(&json).unwrap()).unwrap();
    let d_term = result["sample"]["controllerTerms"]["d"].as_f64().unwrap();
    assert!(
        d_term.abs() < 1e-9,
        "D term should ignore setpoint-only jumps, got {d_term}"
    );
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
    for (_, model) in level_models() {
        let mut state = base_state();
        state["r"] = json!(230.0);
        let json = level_request(&model, auto_controller(), state, 1.0 / 60.0, 0.0);
        let result: Value =
            serde_json::from_str(&compute_simulation_step_json(&json).unwrap()).unwrap();
        assert!(result["sample"]["output"].as_f64().unwrap().is_finite());
        assert!(result["sample"]["control"].as_f64().unwrap().is_finite());
    }
}

#[test]
fn all_levels_remain_finite_under_pd_and_assisted_pid_runs() {
    let dt = 1.0 / 60.0;
    let scroll_speed = 150.0;
    let ship_x_offset = 100.0;
    let run_seconds = 22.0;
    let tiers = ["bronze", "silver", "gold"];

    for (level_id, model) in level_models() {
        let model_delay = model["delay"].as_f64().unwrap_or(0.0);
        let controller_cases = [
            ("pd", pd_controller()),
            ("pid-assist", pid_assist_controller(model_delay)),
        ];

        for tier in tiers {
            for (controller_label, controller) in &controller_cases {
                let mut state = base_state();
                let mut filtered_disturbance = 0.0;
                let mut previous_display_output = 200.0;

                for frame in 0..(run_seconds / dt) as usize {
                    let x = frame as f64 * dt * scroll_speed + ship_x_offset;
                    state["r"] = json!(reference_y(tier, x).clamp(0.0, 400.0));
                    let raw_disturbance = disturbance_y(tier, x);
                    let alpha = (dt / (0.6 + dt)).min(1.0);
                    filtered_disturbance += (raw_disturbance - filtered_disturbance) * alpha;

                    let json =
                        level_request(&model, controller.clone(), state, dt, filtered_disturbance);
                    let result: Value =
                        serde_json::from_str(&compute_simulation_step_json(&json).unwrap())
                            .unwrap();
                    let sample = &result["sample"];
                    let output = sample["output"].as_f64().unwrap();
                    let display_output = output.clamp(0.0, 400.0);
                    let control = sample["control"].as_f64().unwrap();
                    let d_term = sample["controllerTerms"]["d"].as_f64().unwrap();
                    let output_delta = (display_output - previous_display_output).abs();

                    assert!(
                        output.is_finite() && control.is_finite() && d_term.is_finite(),
                        "{level_id} {tier} {controller_label} produced non-finite sample at frame {frame}"
                    );
                    assert!(
                        output.abs() < 1.0e5,
                        "{level_id} {tier} {controller_label} output diverged to {output} at frame {frame}"
                    );
                    assert!(
                        output_delta < 1000.0,
                        "{level_id} {tier} {controller_label} output jumped by {output_delta} at frame {frame}"
                    );

                    state = result["state"].clone();
                    state["y"] = json!(display_output);
                    previous_display_output = display_output;
                    if !(0.0..=400.0).contains(&output) {
                        break;
                    }
                }
            }
        }
    }
}
