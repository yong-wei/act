use control_engine::virtual_simulation_runtime::compute_virtual_simulation_step_json;
use serde_json::{Value, json};

fn assert_finite_fields(value: &Value, fields: &[&str]) {
    for field in fields {
        assert!(value[*field].as_f64().unwrap().is_finite(), "{field}");
    }
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
