use serde_json::{json, Value};

use crate::virtual_simulation_runtime::compute_roll_coupled_nomoto;

fn num(value: &Value, key: &str, fallback: f64) -> f64 {
    value
        .get(key)
        .and_then(Value::as_f64)
        .filter(|item| item.is_finite())
        .unwrap_or(fallback)
}

fn bool_flag(value: &Value, key: &str, fallback: bool) -> bool {
    value.get(key).and_then(Value::as_bool).unwrap_or(fallback)
}

fn clamp(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

fn deg_to_rad(value: f64) -> f64 {
    value * std::f64::consts::PI / 180.0
}

fn rad_to_deg(value: f64) -> f64 {
    value * 180.0 / std::f64::consts::PI
}

fn heading_error_deg(target: f64, current: f64) -> f64 {
    ((target - current + 180.0) % 360.0) - 180.0
}

fn history(value: &Value, key: &str) -> [f64; 2] {
    let items = value.get(key).and_then(Value::as_array);
    [
        items.and_then(|arr| arr.first()).and_then(Value::as_f64).unwrap_or(0.0),
        items.and_then(|arr| arr.get(1)).and_then(Value::as_f64).unwrap_or(0.0),
    ]
}

fn compute_wave_excitation(time: f64, sea_state: f64, wave_direction: f64, heading_deg: f64) -> f64 {
    let base_amplitude = 0.2 * sea_state.powf(1.35);
    let relative_direction = wave_direction - heading_deg;
    let direction_factor = 0.25 + 0.75 * deg_to_rad(relative_direction).sin().abs();
    let omega1 = 2.0 * std::f64::consts::PI * 0.12;
    let omega2 = 2.0 * std::f64::consts::PI * 0.18;
    let omega3 = 2.0 * std::f64::consts::PI * 0.25;
    base_amplitude
        * direction_factor
        * (0.5 * (omega1 * time).sin() + 0.3 * (omega2 * time + 0.5).sin() + 0.2 * (omega3 * time + 1.2).sin())
}

fn notch_coefficients(sample_rate: f64) -> (f64, f64, f64, f64, f64) {
    let omega_n = 2.0 * std::f64::consts::PI * 0.16;
    let period = 1.0 / sample_rate;
    let omega_p = (2.0 / period) * (omega_n * period / 2.0).tan();
    let k = 2.0 / period;
    let k2 = k * k;
    let omega2 = omega_p * omega_p;
    let zero_damping = 0.1;
    let pole_damping = 0.5;
    let denom = k2 + 2.0 * pole_damping * omega_p * k + omega2;
    (
        (k2 + 2.0 * zero_damping * omega_p * k + omega2) / denom,
        (2.0 * omega2 - 2.0 * k2) / denom,
        (k2 - 2.0 * zero_damping * omega_p * k + omega2) / denom,
        (2.0 * omega2 - 2.0 * k2) / denom,
        (k2 - 2.0 * pole_damping * omega_p * k + omega2) / denom,
    )
}

fn apply_notch(raw_wave: f64, notch: &Value, enabled: bool, dt: f64) -> (f64, Value) {
    let input_history = history(notch, "inputHistory");
    let output_history = history(notch, "outputHistory");
    if !enabled {
        return (
            raw_wave,
            json!({
                "inputHistory": [raw_wave, input_history[0]],
                "outputHistory": [raw_wave, output_history[0]],
                "enabled": bool_flag(notch, "enabled", true),
                "currentGainDb": 0.0
            }),
        );
    }
    let (b0, b1, b2, a1, a2) = notch_coefficients(1.0 / dt);
    let output = b0 * raw_wave + b1 * input_history[0] + b2 * input_history[1]
        - a1 * output_history[0]
        - a2 * output_history[1];
    let gain = if raw_wave.abs() > 1e-9 {
        20.0 * (output.abs() / raw_wave.abs()).log10()
    } else {
        0.0
    };
    (
        output,
        json!({
            "inputHistory": [raw_wave, input_history[0]],
            "outputHistory": [output, output_history[0]],
            "enabled": true,
            "currentGainDb": gain
        }),
    )
}

fn apply_fin_rate(current: f64, target: f64, dt: f64) -> f64 {
    let max_change = 15.0 * dt;
    clamp(current + clamp(target - current, -max_change, max_change), -25.0, 25.0)
}

fn anti_roll_moment(port: f64, starboard: f64, speed: f64, roll_rad: f64) -> (f64, f64, f64) {
    let dynamic_pressure = 0.5 * 1025.0 * speed * speed;
    let port_lift = dynamic_pressure * 12.0 * 5.5 * deg_to_rad(port);
    let starboard_lift = dynamic_pressure * 12.0 * 5.5 * deg_to_rad(starboard);
    let total = (port_lift - starboard_lift) * 15.0 * 0.85 * roll_rad.cos();
    (port_lift, starboard_lift, total)
}

fn fin_power(port: f64, starboard: f64, rate: f64, speed: f64) -> f64 {
    let avg_angle = (port.abs() + starboard.abs()) / 2.0;
    let static_power = (avg_angle / 25.0) * 50.0;
    let dynamic_power = (rate.abs() / 15.0) * 100.0;
    let speed_ratio = speed / 11.3;
    clamp(static_power + dynamic_power + speed_ratio * speed_ratio * 150.0, 0.0, 500.0)
}

fn step_fins(fin: &Value, enabled: bool, state: &Value, speed: f64, dt: f64) -> Value {
    if !enabled {
        return json!({
            "portFinAngleDeg": 0.0,
            "starboardFinAngleDeg": 0.0,
            "portLiftForce": 0.0,
            "starboardLiftForce": 0.0,
            "antiRollMoment": 0.0,
            "powerConsumption": 0.0,
            "enabled": bool_flag(fin, "enabled", true)
        });
    }
    let roll_deg = rad_to_deg(num(state, "rollRad", 0.0));
    let roll_rate_deg = rad_to_deg(num(state, "rollRateRad", 0.0));
    let control_angle = clamp(-roll_deg - 2.0 * roll_rate_deg, -25.0, 25.0);
    let new_port = apply_fin_rate(num(fin, "portFinAngleDeg", 0.0), control_angle, dt);
    let new_starboard = apply_fin_rate(num(fin, "starboardFinAngleDeg", 0.0), -control_angle, dt);
    let (port_lift, starboard_lift, total_moment) =
        anti_roll_moment(new_port, new_starboard, speed, num(state, "rollRad", 0.0));
    let avg_rate = ((new_port - num(fin, "portFinAngleDeg", 0.0)).abs()
        + (new_starboard - num(fin, "starboardFinAngleDeg", 0.0)).abs())
        / 2.0
        / dt;
    json!({
        "portFinAngleDeg": new_port,
        "starboardFinAngleDeg": new_starboard,
        "portLiftForce": port_lift,
        "starboardLiftForce": starboard_lift,
        "antiRollMoment": total_moment,
        "powerConsumption": fin_power(new_port, new_starboard, avg_rate, speed),
        "enabled": true
    })
}

pub fn compute_practice_cruise_live_step(request: &Value) -> Result<String, String> {
    let dt = num(request, "dt", 0.0);
    if !(dt > 0.0 && dt <= 1.0) {
        return Err("dt must be in (0, 1].".to_string());
    }
    let time = num(request, "time", 0.0);
    let target_heading = num(request, "targetHeading", 0.0);
    let control_mode = request.get("controlMode").and_then(Value::as_str).unwrap_or("pid");
    let mut state = request.get("state").cloned().unwrap_or(json!({}));
    let pid = request.get("pidState").cloned().unwrap_or(json!({ "integral": 0.0, "prevError": 0.0 }));
    let fin = request.get("finState").cloned().unwrap_or(json!({}));
    let notch = request.get("notchState").cloned().unwrap_or(json!({}));
    let current_heading = rad_to_deg(num(&state, "headingRad", 0.0));
    let current_yaw_rate = rad_to_deg(num(&state, "yawRateRad", 0.0));
    let max_rudder = num(request, "maxRudderDeg", 35.0);
    let mut speed = num(&state, "speedMps", 9.3);

    let (rudder_deg, next_pid) = if control_mode == "manual" {
        speed = num(request, "manualSpeed", speed);
        (
            num(request, "manualRudder", 0.0),
            json!({
                "integral": num(&pid, "integral", 0.0),
                "prevError": num(&pid, "prevError", 0.0)
            }),
        )
    } else {
        let kp = num(request, "kp", 0.6);
        let mut ki = num(request, "ki", 0.008);
        let mut kd = num(request, "kd", 1.5);
        if control_mode == "p" {
            ki = 0.0;
            kd = 0.0;
        } else if control_mode == "pd" {
            ki = 0.0;
        }
        let error = heading_error_deg(target_heading, current_heading);
        let max_integral = max_rudder / if ki == 0.0 { 0.001 } else { ki };
        let integral = clamp(num(&pid, "integral", 0.0) + error * dt, -max_integral, max_integral);
        let derivative = (error - num(&pid, "prevError", 0.0)) / dt;
        (
            clamp(kp * error + ki * integral + kd * derivative, -max_rudder, max_rudder),
            json!({ "integral": integral, "prevError": error }),
        )
    };

    let prev_rudder = num(request, "prevRudder", 0.0);
    let rudder_rate = (rudder_deg - prev_rudder).abs() / dt;
    let raw_wave = compute_wave_excitation(
        time,
        num(request, "seaState", 3.0),
        num(request, "waveDirection", 90.0),
        current_heading,
    );
    let notch_enabled = bool_flag(&notch, "enabled", true) && bool_flag(request, "notchFilterEnabled", true);
    let (wave, next_notch) = apply_notch(raw_wave, &notch, notch_enabled, dt);
    let fin_enabled = bool_flag(&fin, "enabled", true) && bool_flag(request, "finStabilizerEnabled", true);
    let next_fin = step_fins(&fin, fin_enabled, &state, speed, dt);
    let fin_moment = clamp(num(&next_fin, "antiRollMoment", 0.0) / 2_000_000.0, -2.5, 2.5);
    let centripetal = (speed * num(&state, "yawRateRad", 0.0)).abs() / 9.81;
    let rudder_ratio = rudder_deg.abs() / max_rudder.max(1.0);
    let sign = if rudder_deg != 0.0 {
        rudder_deg.signum()
    } else {
        num(&state, "yawRateRad", 0.0).signum()
    };
    let turning_excitation = sign * clamp(centripetal * 2.2 + rudder_ratio.powf(1.1) * 0.02, -2.5, 2.5);
    state["speedMps"] = json!(speed);
    let plant_request = json!({
        "dt": dt,
        "state": state,
        "params": request.get("rollCoupledParams").cloned().unwrap_or(json!({})),
        "rudderDeg": rudder_deg,
        "finMomentNormalized": -fin_moment,
        "waveExcitation": wave,
        "turningExcitation": turning_excitation
    });
    let mut next_state: Value = serde_json::from_str(&compute_roll_coupled_nomoto(&plant_request)?)
        .map_err(|error| error.to_string())?;
    next_state["finAngleDeg"] = json!(num(&next_fin, "portFinAngleDeg", 0.0));
    serde_json::to_string(&json!({
        "state": next_state,
        "pidState": next_pid,
        "finState": next_fin,
        "notchState": next_notch,
        "rudderDeg": rudder_deg,
        "rudderRate": rudder_rate,
        "currentHeading": current_heading,
        "currentYawRate": current_yaw_rate,
        "waveExcitation": wave,
        "finMomentNormalized": -fin_moment,
        "turningExcitation": turning_excitation,
        "modelId": "practice_cruise_live_step"
    }))
    .map_err(|error| error.to_string())
}
