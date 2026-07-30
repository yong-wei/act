use control_engine::virtual_simulation_runtime::compute_virtual_simulation_step_json;
use serde_json::{Value, json};

fn assert_finite_fields(value: &Value, fields: &[&str]) {
    for field in fields {
        assert!(value[*field].as_f64().unwrap().is_finite(), "{field}");
    }
}

#[test]
fn interactive_linear_runtimes_return_finite_series() {
    let pid_request = json!({
        "modelId": "linear_pid_batch",
        "dt": 0.05,
        "duration": 2.0,
        "reference": 1.0,
        "kp": 1.2,
        "ki": 0.1,
        "kd": 0.25,
        "numerator": [0.5],
        "denominator": [0.0, 0.12, 1.0]
    });
    let pid_result: Value = serde_json::from_str(
        &compute_virtual_simulation_step_json(&pid_request.to_string()).unwrap(),
    )
    .unwrap();
    assert!(pid_result["times"].as_array().unwrap().len() > 10);
    assert!(pid_result["response"][0].as_f64().unwrap().is_finite());
    assert!(
        pid_result["metrics"]["finalValue"]
            .as_f64()
            .unwrap()
            .is_finite()
    );

    let step_request = json!({
        "modelId": "second_order_step_response",
        "zeta": 0.45,
        "omega": 4.5,
        "duration": 2.0,
        "dt": 0.01
    });
    let step_result: Value = serde_json::from_str(
        &compute_virtual_simulation_step_json(&step_request.to_string()).unwrap(),
    )
    .unwrap();
    assert!(step_result["values"].as_array().unwrap().len() > 100);
    assert!(
        step_result["metrics"]["overshoot"]
            .as_f64()
            .unwrap()
            .is_finite()
    );

    let response_request = json!({
        "modelId": "transfer_function_response",
        "numerator": [1.0],
        "denominator": [1.0, 1.0],
        "duration": 2.0,
        "dt": 0.02,
        "signal": "step"
    });
    let response_result: Value = serde_json::from_str(
        &compute_virtual_simulation_step_json(&response_request.to_string()).unwrap(),
    )
    .unwrap();
    assert!(response_result["points"].as_array().unwrap().len() > 20);
    assert!(response_result["maxY"].as_f64().unwrap().is_finite());
}

#[test]
fn interactive_cruise_and_champagne_steps_return_finite_state() {
    let cruise_request = json!({
        "modelId": "cruise_typhoon_step",
        "dt": 0.1,
        "seaState": 4,
        "state": {
            "time": 0.0,
            "heading": 0.0,
            "targetHeading": 20.0,
            "rollAngle": 0.0,
            "yawRate": 0.0,
            "speed": 18.0,
            "lateralAccel": 0.0
        }
    });
    let cruise_result: Value = serde_json::from_str(
        &compute_virtual_simulation_step_json(&cruise_request.to_string()).unwrap(),
    )
    .unwrap();
    assert_finite_fields(
        &cruise_result,
        &["time", "heading", "rollAngle", "yawRate", "lateralAccel"],
    );

    let tower_request = json!({
        "modelId": "champagne_tower_step",
        "dt": 0.1,
        "lateralAccel": 0.2,
        "shipRollDeg": 3.0,
        "params": { "height": 1.8, "dampingRatio": 0.18, "fallThreshold": 12.0 },
        "state": { "angle": 0.0, "angularVelocity": 0.0 }
    });
    let tower_result: Value = serde_json::from_str(
        &compute_virtual_simulation_step_json(&tower_request.to_string()).unwrap(),
    )
    .unwrap();
    assert_finite_fields(
        &tower_result,
        &["angle", "angularVelocity", "stability", "lateralAccel"],
    );
}

#[test]
fn mmg3dof_step_outputs_finite_state_and_limits_rudder_rate() {
    let request = json!({
        "modelId": "mmg3dof",
        "dt": 0.25,
        "rudderCommand": 0.5,
        "propellerRPM": 80.0,
        "shipLength": 127.5,
        "shipDraft": 6.2,
        "state": {
            "x": 0.0,
            "y": 0.0,
            "psi": 0.0,
            "u": 2.0,
            "v": 0.0,
            "r": 0.0,
            "rudderAngle": 0.0,
            "propellerRPM": 80.0
        },
        "params": {
            "massInertia": { "m": 17000000.0, "Iz": 2.5e9, "xG": -2.5, "mx": 0.05, "my": 0.9, "Jz": 0.15 },
            "hydro": {
                "Xuu": -0.022, "Xvv": -0.04, "Xrr": 0.002, "Xvr": 0.002,
                "Yv": -0.315, "Yr": 0.083, "Yvvv": -1.607, "Yrrr": 0.008, "Yvvr": 0.379, "Yvrr": -0.391,
                "Nv": -0.137, "Nr": -0.049, "Nvvv": -0.03, "Nrrr": -0.013, "Nvvr": -0.294, "Nvrr": 0.055
            },
            "rudder": { "maxAngle": 0.6108652382, "maxRate": 0.0436332313, "tR": 0.4, "aH": 0.3, "xR": -63.75 },
            "propeller": { "Dp": 4.5, "wp": 0.25, "tp": 0.15 }
        },
        "disturbance": { "forceX": 0.0, "forceY": 0.0, "momentN": 0.0 }
    });

    let result: Value =
        serde_json::from_str(&compute_virtual_simulation_step_json(&request.to_string()).unwrap())
            .unwrap();

    assert_finite_fields(
        &result,
        &[
            "x",
            "y",
            "psi",
            "u",
            "v",
            "r",
            "rudderAngle",
            "propellerRPM",
        ],
    );
    assert!(result["x"].as_f64().unwrap() > 0.0);
    assert!(result["rudderAngle"].as_f64().unwrap() <= 0.0436332313 * 0.25 + 1e-9);
}

#[test]
fn semisub_step_outputs_finite_state_and_error_metrics() {
    let request = json!({
        "modelId": "semisub3dof",
        "dt": 0.25,
        "thrusterForce": [20.0, 10.0, 50.0],
        "envForce": [0.0, 0.0, 0.0],
        "state": {
            "x": 3.0, "y": -2.0, "psi": 0.1, "u": 0.0, "v": 0.0, "r": 0.0,
            "targetX": 0.0, "targetY": 0.0, "targetPsi": 0.0,
            "positionError": 0.0, "headingError": 0.0,
            "thrusters": [], "decouplingEnabled": true
        }
    });

    let result: Value =
        serde_json::from_str(&compute_virtual_simulation_step_json(&request.to_string()).unwrap())
            .unwrap();

    assert_finite_fields(
        &result,
        &[
            "x",
            "y",
            "psi",
            "u",
            "v",
            "r",
            "positionError",
            "headingError",
        ],
    );
    assert!(result["positionError"].as_f64().unwrap() > 0.0);
}

#[test]
fn azipod_step_outputs_finite_state_and_advances_time() {
    let azipod = |id: i32, position_y: f64| {
        json!({
            "id": id,
            "azimuth": 0.0,
            "azimuthCmd": 0.2,
            "thrust": 0.0,
            "thrustCmd": 1000000.0,
            "power": 0.0,
            "slewRate": 0.0,
            "enabled": true,
            "positionX": -55.0,
            "positionY": position_y,
            "maxThrust": 7500000.0,
            "maxPower": 7500000.0,
            "maxSlewRate": 0.2094395102
        })
    };
    let request = json!({
        "modelId": "azipod3dof",
        "dt": 0.25,
        "iceResistance": 0.0,
        "state": {
            "x": 0.0, "y": 0.0, "psi": 0.0, "u": 0.0, "v": 0.0, "r": 0.0,
            "azipod1": azipod(1, 5.0),
            "azipod2": azipod(2, -5.0),
            "iceResistanceForce": 0.0,
            "perturbedK": 1.0,
            "perturbedT": 1.0,
            "time": 0.0
        },
        "params": {
            "mass": 13990000.0,
            "addedMassX": 0.08,
            "addedMassY": 0.65,
            "inertiaZ": 5.25e10,
            "addedInertiaZ": 0.16,
            "dampingU": 9.5e5,
            "dampingV": 2.8e6,
            "dampingR": 8.5e10,
            "maxSlewRate": 0.2094395102,
            "maxThrust": 7500000.0,
            "azipods": [azipod(1, 5.0), azipod(2, -5.0)]
        }
    });

    let result: Value =
        serde_json::from_str(&compute_virtual_simulation_step_json(&request.to_string()).unwrap())
            .unwrap();

    assert_finite_fields(&result, &["x", "y", "psi", "u", "v", "r", "time"]);
    assert_eq!(result["time"].as_f64().unwrap(), 0.25);
    assert!(result["azipod1"]["thrust"].as_f64().unwrap() > 0.0);
    assert!(result["azipod1"]["slewRate"].as_f64().unwrap() <= 0.2094395102 + 1e-9);
}

#[test]
fn nomoto_first_order_step_outputs_finite_state() {
    let request = json!({
        "modelId": "nomoto1st",
        "dt": 0.5,
        "rudderDeg": 10.0,
        "state": {
            "headingRad": 0.0,
            "yawRateRad": 0.0,
            "rudderDeg": 0.0,
            "positionX": 0.0,
            "positionZ": 0.0,
            "speedMps": 5.0
        },
        "params": { "K": 0.1, "T": 50.0, "maxRudderDeg": 35.0 }
    });

    let result: Value =
        serde_json::from_str(&compute_virtual_simulation_step_json(&request.to_string()).unwrap())
            .unwrap();

    assert_finite_fields(
        &result,
        &[
            "headingRad",
            "yawRateRad",
            "rudderDeg",
            "positionX",
            "positionZ",
            "speedMps",
        ],
    );
    assert!(result["positionX"].as_f64().unwrap() > 0.0);
    assert_eq!(result["rudderDeg"].as_f64().unwrap(), 10.0);
}

#[test]
fn nomoto_second_order_delay_step_preserves_history_and_outputs_finite_state() {
    let request = json!({
        "modelId": "nomoto2nd_delay",
        "dt": 0.5,
        "rudderDeg": 8.0,
        "state": {
            "headingRad": 0.0,
            "yawRateRad": 0.0,
            "yawRateDerivative": 0.0,
            "rudderDeg": 0.0,
            "positionX": 0.0,
            "positionZ": 0.0,
            "speedMps": 9.8,
            "rudderHistory": [0.0, 0.0, 0.0, 0.0],
            "historyIndex": 0
        },
        "params": { "K": 0.03, "T1": 80.0, "T2": 20.0, "timeDelay": 2.0, "maxRudderDeg": 35.0, "speedMps": 9.8 }
    });

    let result: Value =
        serde_json::from_str(&compute_virtual_simulation_step_json(&request.to_string()).unwrap())
            .unwrap();

    assert_finite_fields(
        &result,
        &[
            "headingRad",
            "yawRateRad",
            "yawRateDerivative",
            "rudderDeg",
            "positionX",
            "positionZ",
            "speedMps",
        ],
    );
    assert_eq!(result["historyIndex"].as_u64().unwrap(), 1);
    assert_eq!(result["rudderHistory"][0].as_f64().unwrap(), 8.0);
}

#[test]
fn variable_mass_nomoto_and_roll_steps_output_finite_state() {
    let state = json!({
        "headingRad": 0.0,
        "yawRateRad": 0.0,
        "rudderDeg": 0.0,
        "positionX": 0.0,
        "positionZ": 0.0,
        "speedMps": 10.3,
        "loadRatio": 0.5,
        "cargoMass": 160000000.0,
        "currentK": 0.08,
        "currentT": 80.0,
        "windLoad": { "force": 0.0, "moment": 1000000.0, "relativeDirection": 45.0 },
        "roll": { "angle": 0.0, "rate": 0.0 }
    });
    let step_request = json!({
        "modelId": "nomoto_variable_mass",
        "dt": 0.5,
        "rudderDeg": 6.0,
        "externalMoment": 1000000.0,
        "state": state
    });
    let step_result: Value = serde_json::from_str(
        &compute_virtual_simulation_step_json(&step_request.to_string()).unwrap(),
    )
    .unwrap();
    assert_finite_fields(
        &step_result,
        &[
            "headingRad",
            "yawRateRad",
            "rudderDeg",
            "positionX",
            "positionZ",
            "speedMps",
        ],
    );

    let roll_request = json!({
        "modelId": "container_roll",
        "dt": 0.5,
        "windMoment": 1000000.0,
        "yawRateRad": step_result["yawRateRad"].as_f64().unwrap(),
        "loadRatio": 0.5,
        "state": { "angle": 0.0, "rate": 0.0 }
    });
    let roll_result: Value = serde_json::from_str(
        &compute_virtual_simulation_step_json(&roll_request.to_string()).unwrap(),
    )
    .unwrap();
    assert_finite_fields(&roll_result, &["angle", "rate"]);
}

#[test]
fn roll_coupled_nomoto_step_outputs_finite_heading_and_roll_state() {
    let request = json!({
        "modelId": "roll_coupled_nomoto",
        "dt": 0.5,
        "rudderDeg": 5.0,
        "finMomentNormalized": -0.1,
        "waveExcitation": 0.2,
        "turningExcitation": 0.03,
        "state": {
            "headingRad": 0.0,
            "yawRateRad": 0.0,
            "yawAccelRad": 0.0,
            "rollRad": 0.0,
            "rollRateRad": 0.0,
            "positionX": 0.0,
            "positionZ": 0.0,
            "speedMps": 9.3,
            "rudderDeg": 0.0,
            "finAngleDeg": 0.0
        },
        "params": {
            "K": 0.05,
            "T1": 90.0,
            "T2": 25.0,
            "K_phi": 0.15,
            "T_phi1": 8.0,
            "T_phi2": 2.0,
            "maxRudderDeg": 35.0,
            "speedMps": 9.3
        }
    });

    let result: Value =
        serde_json::from_str(&compute_virtual_simulation_step_json(&request.to_string()).unwrap())
            .unwrap();

    assert_finite_fields(
        &result,
        &[
            "headingRad",
            "yawRateRad",
            "yawAccelRad",
            "rollRad",
            "rollRateRad",
            "positionX",
            "positionZ",
            "speedMps",
        ],
    );
    assert!(result["positionX"].as_f64().unwrap() > 0.0);
}

#[test]
fn cruise_comfort_analysis_outputs_engineering_scores() {
    let request = json!({
        "modelId": "cruise_comfort_analysis",
        "objectives": {
            "comfortWeight": 0.5,
            "performanceWeight": 0.3,
            "energyWeight": 0.2
        },
        "metrics": {
            "msi": 12.0,
            "settlingTime": 45.0,
            "overshoot": 8.0,
            "finPower": 120.0
        }
    });

    let result: Value =
        serde_json::from_str(&compute_virtual_simulation_step_json(&request.to_string()).unwrap())
            .unwrap();

    assert_finite_fields(
        &result["objectiveScores"],
        &["comfort", "performance", "energy"],
    );
    assert!(result["blendedScore"].as_f64().unwrap().is_finite());
    assert_eq!(result["paretoFront"].as_array().unwrap().len(), 12);
    assert!(result["advice"].as_array().unwrap().len() >= 1);
}

#[test]
fn icebreaker_robust_analysis_outputs_scenario_aggregate() {
    let request = json!({
        "modelId": "icebreaker_robust_analysis",
        "uncertaintyRange": {
            "paramK": [0.85, 1.15],
            "paramT": [0.8, 1.2]
        },
        "disturbanceScenarios": [
            { "name": "薄冰扰动", "intensity": 1.0 },
            { "name": "厚冰冲击", "intensity": 3.0 }
        ],
        "sampleCount": 40
    });

    let result: Value =
        serde_json::from_str(&compute_virtual_simulation_step_json(&request.to_string()).unwrap())
            .unwrap();

    assert_finite_fields(
        &result["robustnessMetrics"],
        &[
            "disturbanceRejection",
            "stabilityMargin",
            "parameterSensitivity",
        ],
    );
    assert_eq!(result["scenarioResults"].as_array().unwrap().len(), 2);
    assert!(result["recommendation"].as_str().unwrap().len() > 5);
}

#[test]
fn nomoto_quick_simulation_outputs_metrics_for_optimizer() {
    let request = json!({
        "modelId": "nomoto_quick_sim",
        "duration": 20.0,
        "dt": 0.5,
        "start": { "x": 0.0, "z": 0.0, "headingDeg": 0.0 },
        "targetHeadingDeg": 30.0,
        "targetSwitchTime": 5.0,
        "pid": { "kp": 1.4, "ki": 0.02, "kd": 0.7 },
        "nomoto": { "K": 0.08, "T": 55.0, "speedMps": 15.0, "maxRudderDeg": 35.0 },
        "guidePath": [
            { "x": 0.0, "z": 0.0 },
            { "x": 300.0, "z": 0.0 },
            { "x": 300.0, "z": 300.0 }
        ]
    });

    let result: Value =
        serde_json::from_str(&compute_virtual_simulation_step_json(&request.to_string()).unwrap())
            .unwrap();

    assert_finite_fields(&result["metrics"], &["avgError", "maxRudderRate"]);
    assert_eq!(result["chartData"]["time"].as_array().unwrap().len(), 41);
    assert_eq!(result["trajectory"].as_array().unwrap().len(), 41);
}

#[test]
fn nomoto_quick_simulation_limits_actual_rudder_rate_when_requested() {
    let request = json!({
        "modelId": "nomoto_quick_sim",
        "duration": 2.0,
        "dt": 0.5,
        "start": { "x": 0.0, "z": 0.0, "headingDeg": 0.0 },
        "targetHeadingDeg": 90.0,
        "targetSwitchTime": 0.0,
        "pid": { "kp": 3.0, "ki": 0.001, "kd": 5.0 },
        "nomoto": {
            "K": 0.08,
            "T": 55.0,
            "speedMps": 15.0,
            "maxRudderDeg": 35.0,
            "maxRudderRateDegPerSec": 5.0
        },
        "guidePath": [
            { "x": 0.0, "z": 0.0 },
            { "x": 30.0, "z": 0.0 }
        ]
    });

    let result: Value =
        serde_json::from_str(&compute_virtual_simulation_step_json(&request.to_string()).unwrap())
            .unwrap();

    assert!(result["metrics"]["maxRudderRate"].as_f64().unwrap() <= 5.0 + 1e-9);
}
