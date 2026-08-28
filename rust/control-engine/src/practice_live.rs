use serde_json::{json, Value};

use crate::practice_live_platform;

fn num(value: &Value, key: &str, fallback: f64) -> f64 {
    value
        .get(key)
        .and_then(Value::as_f64)
        .filter(|item| item.is_finite())
        .unwrap_or(fallback)
}

fn nested_num(value: &Value, path: &[&str], fallback: f64) -> f64 {
    let mut current = value;
    for key in path {
        current = match current.get(*key) {
            Some(next) => next,
            None => return fallback,
        };
    }
    current.as_f64().filter(|item| item.is_finite()).unwrap_or(fallback)
}

fn bool_flag(value: &Value, key: &str, fallback: bool) -> bool {
    value.get(key).and_then(Value::as_bool).unwrap_or(fallback)
}

fn text<'a>(value: &'a Value, key: &str, fallback: &'a str) -> &'a str {
    value.get(key).and_then(Value::as_str).unwrap_or(fallback)
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

fn wrap_deg(heading: f64) -> f64 {
    ((heading % 360.0) + 360.0) % 360.0
}

fn angle_delta_deg(target: f64, current: f64) -> f64 {
    let mut diff = wrap_deg(target) - wrap_deg(current);
    if diff > 180.0 {
        diff -= 360.0;
    }
    if diff < -180.0 {
        diff += 360.0;
    }
    diff
}

fn wrap_deg_signed(mut error: f64) -> f64 {
    while error > 180.0 {
        error -= 360.0;
    }
    while error < -180.0 {
        error += 360.0;
    }
    error
}

fn wrap_rad(mut error: f64) -> f64 {
    while error > std::f64::consts::PI {
        error -= 2.0 * std::f64::consts::PI;
    }
    while error < -std::f64::consts::PI {
        error += 2.0 * std::f64::consts::PI;
    }
    error
}

fn object<'a>(value: &'a Value, key: &str) -> &'a Value {
    value.get(key).unwrap_or(&Value::Null)
}

fn rng_samples(request: &Value) -> Vec<f64> {
    request
        .get("rngSamples")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_f64)
                .filter(|item| item.is_finite())
                .collect()
        })
        .unwrap_or_default()
}

fn rng_at(samples: &[f64], index: &mut usize) -> f64 {
    if *index < samples.len() {
        let value = samples[*index];
        *index += 1;
        value
    } else {
        0.5
    }
}

fn gains(value: &Value, fallback: (f64, f64, f64)) -> (f64, f64, f64) {
    (
        num(value, "kp", fallback.0),
        num(value, "ki", fallback.1),
        num(value, "kd", fallback.2),
    )
}

fn require_dt(request: &Value) -> Result<f64, String> {
    let dt = num(request, "dt", 0.0);
    if dt > 0.0 && dt <= 1.0 {
        Ok(dt)
    } else {
        Err("dt must be in (0, 1].".to_string())
    }
}

pub fn compute_practice_capability(model_id: &str, request: &Value) -> Result<String, String> {
    match model_id {
        "practice_pid_control" => compute_pid_control(request),
        "practice_pid_2nd_order" => compute_pid_2nd_order(request),
        "practice_dp_control" => compute_dp_control(request),
        "practice_smith_predictor" => compute_smith_predictor(request),
        "practice_sloshing_step" => compute_sloshing_step(request),
        "practice_gain_schedule_step" => compute_gain_schedule_step(request),
        "practice_wind_load_step" => compute_wind_load_step(request),
        "practice_dredging_disturbance" => compute_dredging_disturbance(request),
        "practice_cruise_comfort_realtime" => compute_cruise_comfort_realtime(request),
        "practice_dp_decoupled_control" => practice_live_platform::compute_dp_decoupled_control(request),
        "practice_allocate_thrust" => practice_live_platform::compute_allocate_thrust(request),
        "practice_ice_breaking_step" => practice_live_platform::compute_ice_breaking_step(request),
        "practice_azipod_course_keeper" => practice_live_platform::compute_azipod_course_keeper(request),
        "practice_drilling_environment" => practice_live_platform::compute_drilling_environment(request),
        _ => Err(format!("不支持的虚拟仿真模型: {model_id}")),
    }
}

fn compute_pid_control(request: &Value) -> Result<String, String> {
    let dt = require_dt(request)?;
    let mode = text(request, "controlMode", "pid");
    let state = object(request, "state");
    if matches!(mode, "manual" | "dp" | "autopilot") {
        return serde_json::to_string(&json!({
            "output": { "rudderDeg": 0.0, "error": 0.0, "derivative": 0.0 },
            "newState": state,
            "modelId": "practice_pid_control"
        }))
        .map_err(|error| error.to_string());
    }

    let gains_value = object(request, "gains");
    let (kp, mut ki, mut kd) = gains(gains_value, (0.8, 0.05, 2.0));
    let original_ki = ki;
    if mode == "p" {
        ki = 0.0;
        kd = 0.0;
    } else if mode == "pd" {
        ki = 0.0;
    }
    let max_rudder = num(request, "maxRudderDeg", 35.0);
    let error_deg = angle_delta_deg(num(request, "targetHeading", 0.0), num(request, "currentHeading", 0.0));
    let error_rad = deg_to_rad(error_deg);
    let mut derivative = (error_rad - num(state, "prevError", 0.0)) / dt;
    let derivative_filter = num(request, "derivativeFilter", 0.1);
    if state.get("prevDerivative").and_then(Value::as_f64).is_some() {
        derivative = derivative_filter * derivative + (1.0 - derivative_filter) * num(state, "prevDerivative", 0.0);
    }
    let integral_limit = num(
        request,
        "maxIntegral",
        deg_to_rad(max_rudder) / if original_ki == 0.0 { 0.001 } else { original_ki },
    );
    let new_integral = clamp(num(state, "integral", 0.0) + error_rad * dt, -integral_limit, integral_limit);
    let output_rad = kp * error_rad + ki * new_integral + kd * derivative;
    let mut rudder_deg = clamp(rad_to_deg(output_rad), -max_rudder, max_rudder);
    if let Some(rate_limit) = request.get("rateLimit").and_then(Value::as_f64).filter(|item| item.is_finite()) {
        let prev_rudder = rad_to_deg(
            kp * num(state, "prevError", 0.0)
                + ki * num(state, "integral", 0.0)
                + kd * num(state, "prevDerivative", 0.0),
        );
        let max_change = rate_limit * dt;
        rudder_deg = clamp(rudder_deg, prev_rudder - max_change, prev_rudder + max_change);
    }
    serde_json::to_string(&json!({
        "output": {
            "rudderDeg": rudder_deg,
            "error": error_deg,
            "derivative": rad_to_deg(derivative)
        },
        "newState": {
            "integral": new_integral,
            "prevError": error_rad,
            "prevDerivative": derivative
        },
        "modelId": "practice_pid_control"
    }))
    .map_err(|error| error.to_string())
}

fn compute_pid_2nd_order(request: &Value) -> Result<String, String> {
    let dt = require_dt(request)?;
    let mode = text(request, "controlMode", "pid");
    let state = object(request, "state");
    if mode == "manual" {
        return serde_json::to_string(&json!({
            "rudderDeg": 0.0,
            "newState": state,
            "modelId": "practice_pid_2nd_order"
        }))
        .map_err(|error| error.to_string());
    }
    let (kp, ki, kd) = gains(object(request, "gains"), (0.4, 0.005, 8.0));
    let error = wrap_deg_signed(num(request, "targetHeading", 0.0) - num(request, "currentHeading", 0.0));
    let mut rudder = kp * error;
    if mode == "pd" || mode == "pid" {
        rudder -= kd * num(request, "currentYawRate", 0.0);
    }
    let mut new_integral = num(state, "integral", 0.0);
    if mode == "pid" {
        new_integral = clamp(
            new_integral + error * dt,
            -num(request, "integralLimit", 30.0),
            num(request, "integralLimit", 30.0),
        );
        rudder += ki * new_integral;
    }
    serde_json::to_string(&json!({
        "rudderDeg": clamp(rudder, -num(request, "maxRudderDeg", 35.0), num(request, "maxRudderDeg", 35.0)),
        "newState": { "integral": new_integral, "prevError": error },
        "modelId": "practice_pid_2nd_order"
    }))
    .map_err(|error| error.to_string())
}

fn channel_pid(
    error: f64,
    velocity: f64,
    state: &Value,
    kp: f64,
    ki: f64,
    kd: f64,
    dt: f64,
    integral_limit: f64,
) -> (f64, Value) {
    let new_integral = clamp(num(state, "integral", 0.0) + error * dt, -integral_limit, integral_limit);
    let output = kp * error + ki * new_integral + kd * (-velocity);
    (output, json!({ "integral": new_integral, "prevError": error }))
}

fn compute_dp_control(request: &Value) -> Result<String, String> {
    let dt = require_dt(request)?;
    let current = object(request, "current");
    let target = object(request, "target");
    let state = object(request, "dpState");
    let dx = num(target, "x", 0.0) - num(current, "x", 0.0);
    let dy = num(target, "y", 0.0) - num(current, "y", 0.0);
    let psi = num(current, "psi", 0.0);
    let surge_error = psi.cos() * dx + psi.sin() * dy;
    let sway_error = -psi.sin() * dx + psi.cos() * dy;
    let yaw_error = wrap_rad(num(target, "psi", 0.0) - psi);
    let surge_gains = gains(object(object(request, "gains"), "surge"), (50_000.0, 2_000.0, 30_000.0));
    let sway_gains = gains(object(object(request, "gains"), "sway"), (80_000.0, 3_000.0, 40_000.0));
    let yaw_gains = gains(object(object(request, "gains"), "yaw"), (5e8, 1e7, 2e8));
    let (surge_out, surge_state) = channel_pid(
        surge_error,
        num(current, "u", 0.0),
        object(state, "surge"),
        surge_gains.0,
        surge_gains.1,
        surge_gains.2,
        dt,
        nested_num(request, &["limits", "integralLimit", "surge"], 50.0),
    );
    let (sway_out, sway_state) = channel_pid(
        sway_error,
        num(current, "v", 0.0),
        object(state, "sway"),
        sway_gains.0,
        sway_gains.1,
        sway_gains.2,
        dt,
        nested_num(request, &["limits", "integralLimit", "sway"], 50.0),
    );
    let (yaw_out, yaw_state) = channel_pid(
        yaw_error,
        num(current, "r", 0.0),
        object(state, "yaw"),
        yaw_gains.0,
        yaw_gains.1,
        yaw_gains.2,
        dt,
        nested_num(request, &["limits", "integralLimit", "yaw"], 1.0),
    );
    let max_surge = nested_num(request, &["limits", "maxSurgeThrust"], 2_000_000.0);
    let max_sway = nested_num(request, &["limits", "maxSwayThrust"], 1_500_000.0);
    let max_yaw = nested_num(request, &["limits", "maxYawMoment"], 5e8);
    let max_rudder = nested_num(request, &["limits", "maxRudderAngle"], 35.0);
    let mut surge_thrust = clamp(surge_out, -max_surge, max_surge);
    let mut sway_thrust = clamp(sway_out, -max_sway, max_sway);
    let mut yaw_moment = clamp(yaw_out, -max_yaw, max_yaw);
    if bool_flag(request, "feedforward", false) {
        let disturbance = object(request, "disturbance");
        let force_x = num(disturbance, "forceX", 0.0);
        let force_y = num(disturbance, "forceY", 0.0);
        surge_thrust = clamp(surge_thrust - (psi.cos() * force_x + psi.sin() * force_y), -max_surge, max_surge);
        sway_thrust = clamp(sway_thrust - (-psi.sin() * force_x + psi.cos() * force_y), -max_sway, max_sway);
        yaw_moment = clamp(yaw_moment - num(disturbance, "momentN", 0.0), -max_yaw, max_yaw);
    }
    let rudder_command = clamp(
        yaw_moment / (max_yaw / deg_to_rad(max_rudder)),
        deg_to_rad(-max_rudder),
        deg_to_rad(max_rudder),
    );
    serde_json::to_string(&json!({
        "output": {
            "rudderCommand": rudder_command,
            "surgeThrust": surge_thrust,
            "swayThrust": sway_thrust,
            "yawMoment": yaw_moment
        },
        "newState": { "surge": surge_state, "sway": sway_state, "yaw": yaw_state },
        "metrics": {
            "positionError": (surge_error * surge_error + sway_error * sway_error).sqrt(),
            "headingError": rad_to_deg(yaw_error.abs()),
            "surgeError": surge_error,
            "swayError": sway_error
        },
        "modelId": "practice_dp_control"
    }))
    .map_err(|error| error.to_string())
}

fn compute_smith_predictor(request: &Value) -> Result<String, String> {
    let config = object(request, "config");
    let dt = num(config, "dt", 0.0);
    if !(dt > 0.0 && dt <= 1.0) {
        return Err("dt must be in (0, 1].".to_string());
    }
    let state = object(request, "state");
    let predictor = object(state, "predictor");
    let pid = object(state, "pid");
    let (kp, ki, kd) = gains(object(request, "gains"), (0.4, 0.005, 8.0));
    let compensation = num(predictor, "modelOutput", 0.0) - num(predictor, "delayedModelOutput", 0.0);
    let effective_error = wrap_deg_signed(
        num(request, "targetHeading", 0.0) - num(request, "actualHeading", 0.0) - compensation,
    );
    let mut rudder = kp * effective_error + kd * ((effective_error - num(pid, "prevError", 0.0)) / dt);
    let integral_limit = num(request, "integralLimit", 30.0);
    let new_integral = clamp(num(pid, "integral", 0.0) + effective_error * dt, -integral_limit, integral_limit);
    rudder = clamp(
        rudder + ki * new_integral,
        -num(request, "maxRudderDeg", 35.0),
        num(request, "maxRudderDeg", 35.0),
    );
    let model_k = num(config, "modelK", 0.03) * 180.0 / std::f64::consts::PI;
    let model_t = num(config, "modelT", 80.0);
    let new_model_output = num(predictor, "modelOutput", 0.0) + dt * (model_k * rudder - num(predictor, "modelOutput", 0.0)) / model_t;
    let mut history: Vec<f64> = predictor
        .get("modelHistory")
        .and_then(Value::as_array)
        .map(|items| items.iter().filter_map(Value::as_f64).collect())
        .unwrap_or_else(|| vec![0.0]);
    if history.is_empty() {
        history.push(0.0);
    }
    let index = num(predictor, "historyIndex", 0.0).round() as usize % history.len();
    let delayed = history[index];
    history[index] = new_model_output;
    let new_index = (index + 1) % history.len();
    serde_json::to_string(&json!({
        "rudderDeg": rudder,
        "newState": {
            "predictor": {
                "modelOutput": new_model_output,
                "delayedModelOutput": delayed,
                "modelHistory": history,
                "historyIndex": new_index
            },
            "pid": { "integral": new_integral, "prevError": effective_error },
            "modelState": new_model_output
        },
        "modelId": "practice_smith_predictor"
    }))
    .map_err(|error| error.to_string())
}

fn sloshing_derivatives(angle: f64, rate: f64, yaw_rate: f64, params: &Value) -> (f64, f64) {
    let natural_freq = num(params, "naturalFreq", 0.5);
    let damping = num(params, "damping", 0.1);
    let inertia = num(params, "inertia", 1e10);
    let coupling = num(params, "coupling", 5e8);
    let stiffness = inertia * natural_freq * natural_freq;
    let damping_coeff = 2.0 * damping * natural_freq * inertia;
    let excitation = coupling * yaw_rate;
    (rate, (excitation - damping_coeff * rate - stiffness * angle) / inertia)
}

fn compute_sloshing_step(request: &Value) -> Result<String, String> {
    let dt = require_dt(request)?;
    let state = object(request, "state");
    let params = object(request, "params");
    let yaw_rate = num(request, "shipYawRateRad", 0.0);
    let angle = num(state, "angle", 0.0);
    let rate = num(state, "rate", 0.0);
    let k1 = sloshing_derivatives(angle, rate, yaw_rate, params);
    let k2 = sloshing_derivatives(angle + 0.5 * dt * k1.0, rate + 0.5 * dt * k1.1, yaw_rate, params);
    let k3 = sloshing_derivatives(angle + 0.5 * dt * k2.0, rate + 0.5 * dt * k2.1, yaw_rate, params);
    let k4 = sloshing_derivatives(angle + dt * k3.0, rate + dt * k3.1, yaw_rate, params);
    let new_angle = angle + (dt / 6.0) * (k1.0 + 2.0 * k2.0 + 2.0 * k3.0 + k4.0);
    let new_rate = rate + (dt / 6.0) * (k1.1 + 2.0 * k2.1 + 2.0 * k3.1 + k4.1);
    let pressure = num(params, "basePressure", 100.0) + num(params, "pressureSensitivity", 50.0) * new_angle.abs();
    let moment = -num(params, "coupling", 5e8) * new_angle * 0.001;
    serde_json::to_string(&json!({
        "state": { "angle": new_angle, "rate": new_rate, "tankPressure": pressure },
        "moment": moment,
        "modelId": "practice_sloshing_step"
    }))
    .map_err(|error| error.to_string())
}

fn compute_gain_schedule_step(request: &Value) -> Result<String, String> {
    require_dt(request)?;
    let schedule = object(request, "schedule");
    let empty = object(schedule, "empty");
    let full = object(schedule, "full");
    let variable = clamp(num(request, "schedulingVariable", 0.5), 0.0, 1.0);
    let scheduling_enabled = bool_flag(request, "schedulingEnabled", true);
    let mut current = (
        nested_num(request, &["currentGains", "kp"], 1.6),
        nested_num(request, &["currentGains", "ki"], 0.02),
        nested_num(request, &["currentGains", "kd"], 1.0),
    );
    let mut target = if scheduling_enabled {
        (
            num(empty, "kp", 0.8) + (num(full, "kp", 2.5) - num(empty, "kp", 0.8)) * variable,
            num(empty, "ki", 0.01) + (num(full, "ki", 0.03) - num(empty, "ki", 0.01)) * variable,
            num(empty, "kd", 0.5) + (num(full, "kd", 1.5) - num(empty, "kd", 0.5)) * variable,
        )
    } else {
        (
            nested_num(request, &["targetGains", "kp"], current.0),
            nested_num(request, &["targetGains", "ki"], current.1),
            nested_num(request, &["targetGains", "kd"], current.2),
        )
    };
    if !scheduling_enabled {
        target = (
            nested_num(request, &["targetGains", "kp"], current.0),
            nested_num(request, &["targetGains", "ki"], current.1),
            nested_num(request, &["targetGains", "kd"], current.2),
        );
    }
    if scheduling_enabled {
        let alpha = clamp(num(request, "smoothingFactor", 0.1), 0.0, 1.0);
        current = (
            current.0 + alpha * (target.0 - current.0),
            current.1 + alpha * (target.1 - current.1),
            current.2 + alpha * (target.2 - current.2),
        );
    }
    let mut pid_request = request.clone();
    if let Some(object) = pid_request.as_object_mut() {
        object.insert("gains".to_string(), json!({ "kp": current.0, "ki": current.1, "kd": current.2 }));
        object.insert("state".to_string(), object.get("pidState").cloned().unwrap_or(json!({})));
        let pid_mode = match text(request, "controlMode", "pid") {
            "pid_scheduled" => "pid",
            other => other,
        };
        object.insert("controlMode".to_string(), json!(pid_mode));
    }
    let pid: Value = serde_json::from_str(&compute_pid_control(&pid_request)?)
        .map_err(|error| error.to_string())?;
    serde_json::to_string(&json!({
        "output": pid["output"],
        "pidState": pid["newState"],
        "currentGains": { "kp": current.0, "ki": current.1, "kd": current.2 },
        "targetGains": { "kp": target.0, "ki": target.1, "kd": target.2 },
        "schedulingVariable": variable,
        "gainsConverged": (current.0 - target.0).abs() < 0.01
            && (current.1 - target.1).abs() < 0.001
            && (current.2 - target.2).abs() < 0.01,
        "isSchedulingActive": scheduling_enabled,
        "modelId": "practice_gain_schedule_step"
    }))
    .map_err(|error| error.to_string())
}

fn compute_wind_load_step(request: &Value) -> Result<String, String> {
    let env = object(request, "environment");
    let params = object(request, "params");
    let mut speed = num(env, "speed", 10.0);
    if bool_flag(env, "gustEnabled", false) {
        let period = num(env, "gustPeriod", 15.0).max(1e-6);
        let phase = 2.0 * std::f64::consts::PI * num(request, "time", 0.0) / period;
        let gust_factor = phase.sin() * 0.7 + (phase * 2.3).sin() * 0.3;
        speed += num(env, "gustAmplitude", 3.0) * gust_factor;
    }
    let mut relative = num(env, "direction", std::f64::consts::FRAC_PI_2) - num(request, "shipHeading", 0.0);
    relative = wrap_rad(relative);
    let load_ratio = clamp(num(request, "loadRatio", 0.5), 0.0, 1.0);
    let cargo_multiplier = load_ratio * load_ratio * 3.0;
    let area = num(params, "hullArea", 2000.0) + num(params, "cargoArea", 6000.0) * cargo_multiplier;
    let dynamic_pressure = 0.5 * num(params, "airDensity", 1.225) * speed * speed;
    let force = dynamic_pressure * area * num(params, "windCoeff", 0.8) * relative.sin();
    let arm = num(params, "shipLength", 366.0) * num(params, "armRatio", 0.3);
    serde_json::to_string(&json!({
        "force": force,
        "moment": force * arm,
        "relativeDirection": relative,
        "modelId": "practice_wind_load_step"
    }))
    .map_err(|error| error.to_string())
}

fn step_response(time: f64, max_force: f64, rise_time: f64, decay_time: f64) -> f64 {
    if time < 0.0 {
        return 0.0;
    }
    max_force * (1.0 - (-time / rise_time).exp()) * (-time / decay_time).exp()
}

fn impulse_response(time: f64, max_force: f64, peak_time: f64, decay_time: f64) -> f64 {
    if time < 0.0 {
        return 0.0;
    }
    let normalized = (time - peak_time) / decay_time;
    max_force * (-0.5 * normalized * normalized).exp()
}

fn compute_dredging_disturbance(request: &Value) -> Result<String, String> {
    let time = num(request, "time", 0.0);
    let config = object(request, "config");
    let mut state = object(request, "state").clone();
    let samples = rng_samples(request);
    let mut rng_index = 0;
    let max_force = num(config, "maxForce", 500_000.0);
    let min_interval = num(config, "minInterval", 5.0);
    let max_interval = num(config, "maxInterval", 15.0);
    if !bool_flag(&state, "isImpactActive", false)
        && time - num(&state, "lastImpactTime", 0.0) >= num(&state, "nextInterval", min_interval)
    {
        let rand = rng_at(&samples, &mut rng_index);
        let impact_type = if rand < 0.3 {
            "step"
        } else if rand < 0.5 {
            "impulse"
        } else {
            "mixed"
        };
        let variance = num(config, "directionVariance", 0.3);
        let direction = std::f64::consts::PI + (rng_at(&samples, &mut rng_index) * 2.0 - 1.0) * variance;
        state = json!({
            "lastImpactTime": time,
            "nextInterval": min_interval + rng_at(&samples, &mut rng_index) * (max_interval - min_interval),
            "isImpactActive": true,
            "impactStartTime": time,
            "currentForce": 0.0,
            "forceDirection": direction,
            "impactType": impact_type
        });
    }
    let mut force = 0.0;
    if bool_flag(&state, "isImpactActive", false) {
        let elapsed = time - num(&state, "impactStartTime", 0.0);
        force = step_response(
            elapsed,
            max_force * num(config, "stepRatio", 0.6),
            0.5,
            num(config, "decayTimeConstant", 2.0),
        ) + impulse_response(elapsed, max_force * num(config, "impulseRatio", 0.4), 0.1, 0.3);
        if force < max_force * 0.01 {
            if let Some(object) = state.as_object_mut() {
                object.insert("isImpactActive".to_string(), json!(false));
                object.insert("lastImpactTime".to_string(), json!(time));
                object.insert(
                    "nextInterval".to_string(),
                    json!(min_interval + rng_at(&samples, &mut rng_index) * (max_interval - min_interval)),
                );
            }
            force = 0.0;
        }
    }
    if let Some(object) = state.as_object_mut() {
        object.insert("currentForce".to_string(), json!(force));
    }
    let direction = num(&state, "forceDirection", std::f64::consts::PI);
    serde_json::to_string(&json!({
        "disturbance": {
            "forceX": -force * direction.cos(),
            "forceY": force * direction.sin(),
            "momentN": force * 10.0 * direction.sin()
        },
        "newState": state,
        "modelId": "practice_dredging_disturbance"
    }))
    .map_err(|error| error.to_string())
}

fn normal_cdf(x: f64) -> f64 {
    let a1 = 0.254829592;
    let a2 = -0.284496736;
    let a3 = 1.421413741;
    let a4 = -1.453152027;
    let a5 = 1.061405429;
    let p = 0.3275911;
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let abs_x = x.abs();
    let t = 1.0 / (1.0 + p * abs_x);
    let y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * (-abs_x * abs_x).exp();
    0.5 * (1.0 + sign * y)
}

fn compute_msi(vertical_accel_rms: f64, exposure_hours: f64, frequency_hz: f64) -> f64 {
    let f_low = 0.1;
    let f_high = 0.3;
    let f_center = (f_low + f_high) / 2.0;
    let freq_weight = if frequency_hz >= f_low && frequency_hz <= f_high {
        1.0 - (frequency_hz - f_center).abs() / (f_center - f_low) * 0.2
    } else if frequency_hz < f_low {
        (frequency_hz / f_low).max(0.3)
    } else {
        (f_high / frequency_hz).max(0.3)
    };
    let a50 = 0.5 * (2.0 / exposure_hours).sqrt() / freq_weight;
    let weighted = vertical_accel_rms * freq_weight;
    if weighted < 0.01 || a50 < 0.01 {
        return 0.0;
    }
    clamp(100.0 * normal_cdf((weighted / a50).ln() / 0.4), 0.0, 100.0)
}

fn estimate_msi_from_roll(roll_deg: f64, roll_period: f64, ship_beam: f64, exposure_hours: f64) -> f64 {
    let omega = 2.0 * std::f64::consts::PI / roll_period;
    let vertical = roll_deg.abs() * (std::f64::consts::PI / 180.0) * omega * omega * (ship_beam / 2.0);
    compute_msi(vertical / 2.0_f64.sqrt(), exposure_hours, 1.0 / roll_period)
}

fn estimate_msi_from_motion(
    roll_rms: f64,
    lateral_accel_g: f64,
    yaw_rate: f64,
    roll_period: f64,
    ship_beam: f64,
) -> f64 {
    let roll_msi = estimate_msi_from_roll(roll_rms, roll_period, ship_beam, 2.0);
    let normalized_roll = clamp(roll_rms / 2.2, 0.0, 2.0).powf(1.25);
    let normalized_lateral = clamp(lateral_accel_g / 0.06, 0.0, 2.0).powf(1.35);
    let normalized_yaw = clamp(yaw_rate.abs() / 1.4, 0.0, 2.0).powf(1.1);
    let lateral_coupling = clamp(0.18 + 0.82 * clamp(roll_rms / 1.1, 0.0, 2.0).powf(1.2), 0.18, 1.2);
    let yaw_coupling = clamp(0.25 + 0.5 * clamp(roll_rms / 1.2, 0.0, 2.0).powf(1.15), 0.25, 0.95);
    let load = 0.62 * normalized_roll + 0.26 * normalized_lateral * lateral_coupling + 0.12 * normalized_yaw * yaw_coupling;
    let motion_msi = clamp(100.0 * (1.0 - (-1.6 * load).exp()), 0.0, 100.0);
    clamp(0.4 * roll_msi + 0.6 * motion_msi, 0.0, 100.0)
}

fn iso2631(frequency: f64) -> f64 {
    if frequency < 0.1 {
        0.5
    } else if frequency < 0.5 {
        1.0
    } else if frequency < 2.0 {
        (0.5 / frequency).max(0.5)
    } else {
        0.25 / frequency
    }
}

fn comfort_rating(roll_rms: f64, msi: f64) -> &'static str {
    if roll_rms <= 1.0 && msi <= 5.0 {
        "excellent"
    } else if roll_rms <= 2.0 && msi <= 10.0 {
        "good"
    } else if roll_rms <= 4.0 && msi <= 20.0 {
        "moderate"
    } else if roll_rms <= 6.0 && msi <= 40.0 {
        "poor"
    } else {
        "unacceptable"
    }
}

fn compute_cruise_comfort_realtime(request: &Value) -> Result<String, String> {
    let dt = require_dt(request)?;
    let prev = object(request, "prevMetrics");
    let alpha = clamp(num(request, "alpha", 0.02), 0.001, 0.999);
    let tau = -(1.0 / 60.0) / (1.0 - alpha).ln();
    let alpha_eff = clamp(1.0 - (-dt.max(1e-4) / tau).exp(), 0.001, 0.8);
    let abs_roll = num(request, "currentRollDeg", 0.0).abs();
    let new_rms = (alpha_eff * abs_roll * abs_roll + (1.0 - alpha_eff) * num(prev, "rollRms", 0.0).powi(2)).sqrt();
    let new_peak = (num(prev, "rollPeak", 0.0) * 0.999).max(abs_roll);
    let roll_period = num(request, "rollPeriodSec", 18.0);
    let ship_beam = num(request, "shipBeam", 37.0);
    let msi = estimate_msi_from_motion(
        new_rms,
        num(request, "lateralAccelG", 0.0),
        num(request, "yawRateDegPerSec", 0.0),
        roll_period,
        ship_beam,
    );
    let omega = 2.0 * std::f64::consts::PI / roll_period;
    let arm = ship_beam / 2.0;
    let current_accel = abs_roll * (std::f64::consts::PI / 180.0) * omega * omega * arm;
    let new_vdv = (alpha_eff * current_accel.powi(4) + (1.0 - alpha_eff) * num(prev, "vdv", 0.0).powi(4)).powf(0.25);
    let freq_weight = iso2631(1.0 / roll_period);
    let roll_weighted = new_rms * (std::f64::consts::PI / 180.0) * omega * omega * arm * freq_weight;
    let lateral_weighted = num(request, "lateralAccelG", 0.0) * 9.81 * 0.65;
    serde_json::to_string(&json!({
        "msi": msi,
        "rollRms": new_rms,
        "rollPeak": new_peak,
        "comfortRating": comfort_rating(new_rms, msi),
        "vdv": new_vdv,
        "frequencyWeightedAccel": (roll_weighted * roll_weighted + lateral_weighted * lateral_weighted).sqrt(),
        "modelId": "practice_cruise_comfort_realtime"
    }))
    .map_err(|error| error.to_string())
}
