use serde_json::{json, Value};

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

fn wrap_rad(mut error: f64) -> f64 {
    while error > std::f64::consts::PI {
        error -= 2.0 * std::f64::consts::PI;
    }
    while error < -std::f64::consts::PI {
        error += 2.0 * std::f64::consts::PI;
    }
    error
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

fn require_dt(request: &Value) -> Result<f64, String> {
    let dt = num(request, "dt", 0.0);
    if dt > 0.0 && dt <= 1.0 {
        Ok(dt)
    } else {
        Err("dt must be in (0, 1].".to_string())
    }
}

fn invert3x3(matrix: [[f64; 3]; 3]) -> Option<[[f64; 3]; 3]> {
    let det = matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1])
        - matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0])
        + matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);
    if det.abs() < 1e-10 {
        return None;
    }
    let inv = 1.0 / det;
    Some([
        [
            (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) * inv,
            (matrix[0][2] * matrix[2][1] - matrix[0][1] * matrix[2][2]) * inv,
            (matrix[0][1] * matrix[1][2] - matrix[0][2] * matrix[1][1]) * inv,
        ],
        [
            (matrix[1][2] * matrix[2][0] - matrix[1][0] * matrix[2][2]) * inv,
            (matrix[0][0] * matrix[2][2] - matrix[0][2] * matrix[2][0]) * inv,
            (matrix[0][2] * matrix[1][0] - matrix[0][0] * matrix[1][2]) * inv,
        ],
        [
            (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]) * inv,
            (matrix[0][1] * matrix[2][0] - matrix[0][0] * matrix[2][1]) * inv,
            (matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0]) * inv,
        ],
    ])
}

fn apply_forbidden(mut angle: f64, zones: &Value) -> f64 {
    while angle >= 180.0 {
        angle -= 360.0;
    }
    while angle < -180.0 {
        angle += 360.0;
    }
    if let Some(items) = zones.as_array() {
        for zone in items {
            let min = zone.get(0).and_then(Value::as_f64).unwrap_or(0.0);
            let max = zone.get(1).and_then(Value::as_f64).unwrap_or(0.0);
            if angle >= min && angle <= max {
                angle = if (angle - min).abs() < (angle - max).abs() {
                    min - 1.0
                } else {
                    max + 1.0
                };
            }
        }
    }
    angle
}

pub fn compute_allocate_thrust(request: &Value) -> Result<String, String> {
    let dt = require_dt(request)?;
    let tau = request
        .get("tauCmd")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_else(|| vec![json!(0.0), json!(0.0), json!(0.0)]);
    let fx = tau.first().and_then(Value::as_f64).unwrap_or(0.0);
    let fy = tau.get(1).and_then(Value::as_f64).unwrap_or(0.0);
    let mz = tau.get(2).and_then(Value::as_f64).unwrap_or(0.0);
    let states = request.get("thrusters").and_then(Value::as_array).cloned().unwrap_or_default();
    let configs = request.get("configs").and_then(Value::as_array).cloned().unwrap_or_default();
    let n = states.len().min(configs.len());
    let force_mag = (fx * fx + fy * fy).sqrt();
    let force_dir = if force_mag > 1.0 {
        rad_to_deg(fy.atan2(fx))
    } else {
        0.0
    };
    let mut desired = vec![0.0; n];
    for i in 0..n {
        let state = &states[i];
        let config = &configs[i];
        if bool_flag(state, "failed", false) || !bool_flag(state, "enabled", true) {
            desired[i] = num(state, "azimuth", 0.0);
            continue;
        }
        let mut adjusted = force_dir;
        let moment_contribution = mz / 1000.0;
        if num(config, "positionX", 0.0) < 0.0 {
            adjusted += moment_contribution * 5.0;
        } else {
            adjusted -= moment_contribution * 5.0;
        }
        desired[i] = apply_forbidden(adjusted, config.get("forbiddenZones").unwrap_or(&Value::Null));
    }
    let mut constrained = vec![0.0; n];
    for i in 0..n {
        let current = num(&states[i], "azimuth", 0.0);
        let max_change = num(&configs[i], "maxAzimuthRate", 15.0) * dt;
        let mut diff = desired[i] - current;
        if diff > 180.0 {
            diff -= 360.0;
        }
        if diff < -180.0 {
            diff += 360.0;
        }
        constrained[i] = if diff.abs() <= max_change {
            desired[i]
        } else {
            current + diff.signum() * max_change
        };
    }
    let mut b = vec![vec![0.0; n]; 3];
    for i in 0..n {
        let az = deg_to_rad(constrained[i]);
        b[0][i] = az.cos();
        b[1][i] = az.sin();
        b[2][i] = num(&configs[i], "positionX", 0.0) * az.sin() - num(&configs[i], "positionY", 0.0) * az.cos();
    }
    let mut bbt = [[0.0; 3]; 3];
    for i in 0..3 {
        for j in 0..3 {
            bbt[i][j] = (0..n).map(|k| b[i][k] * b[j][k]).sum();
        }
    }
    let inv = invert3x3(bbt);
    let mut bplus = vec![vec![0.0; 3]; n];
    if let Some(inv) = inv {
        for i in 0..n {
            for j in 0..3 {
                bplus[i][j] = (0..3).map(|k| b[k][i] * inv[k][j]).sum();
            }
        }
    }
    let mut thrusts = vec![0.0; n];
    let mut saturated = false;
    for i in 0..n {
        if bool_flag(&states[i], "failed", false) || !bool_flag(&states[i], "enabled", true) {
            continue;
        }
        thrusts[i] = bplus[i][0] * fx + bplus[i][1] * fy + bplus[i][2] * mz;
        let max_t = num(&configs[i], "maxThrust", 800.0);
        if thrusts[i].abs() > max_t {
            thrusts[i] = thrusts[i].signum() * max_t;
            saturated = true;
        }
    }
    let mut total_fx = 0.0;
    let mut total_fy = 0.0;
    let mut total_mz = 0.0;
    let mut total_power = 0.0;
    let mut new_states = Vec::with_capacity(n);
    for i in 0..n {
        let failed = bool_flag(&states[i], "failed", false);
        let enabled = bool_flag(&states[i], "enabled", true);
        let thrust = if failed || !enabled { 0.0 } else { thrusts[i] };
        let azimuth = constrained[i];
        let az = deg_to_rad(azimuth);
        let local_fx = thrust * az.cos();
        let local_fy = thrust * az.sin();
        total_fx += local_fx;
        total_fy += local_fy;
        total_mz += num(&configs[i], "positionX", 0.0) * local_fy - num(&configs[i], "positionY", 0.0) * local_fx;
        let max_t = num(&configs[i], "maxThrust", 800.0).max(1e-9);
        let power = if thrust.abs() > 0.0 {
            num(&configs[i], "maxPower", 4500.0) * (thrust.abs() / max_t).powf(1.5)
        } else {
            0.0
        };
        total_power += power;
        new_states.push(json!({
            "id": num(&states[i], "id", (i + 1) as f64),
            "thrust": thrust.abs(),
            "azimuth": azimuth,
            "power": power,
            "enabled": enabled,
            "failed": failed
        }));
    }
    let force_error = ((total_fx - fx).powi(2) + (total_fy - fy).powi(2) + ((total_mz - mz) / 100.0).powi(2)).sqrt();
    let denom = (fx * fx + fy * fy + (mz / 100.0).powi(2) + 1.0).sqrt();
    serde_json::to_string(&json!({
        "thrusters": new_states,
        "totalForceX": total_fx,
        "totalForceY": total_fy,
        "totalMomentN": total_mz,
        "totalPower": total_power,
        "feasible": force_error < 0.1 * denom,
        "saturated": saturated,
        "modelId": "practice_allocate_thrust"
    }))
    .map_err(|error| error.to_string())
}

fn compute_pid_channel(
    error: f64,
    state: &Value,
    kp: f64,
    ki: f64,
    kd: f64,
    dt: f64,
    integral_limit: f64,
    deadband: f64,
) -> (f64, Value) {
    let effective = if error.abs() < deadband { 0.0 } else { error };
    let new_integral = clamp(num(state, "integral", 0.0) + effective * dt, -integral_limit, integral_limit);
    let derivative = (effective - num(state, "prevError", 0.0)) / dt;
    (
        kp * effective + ki * new_integral + kd * derivative,
        json!({ "integral": new_integral, "prevError": effective }),
    )
}

fn apply_decoupling(tau: [f64; 3], enabled: bool) -> [f64; 3] {
    if !enabled {
        return tau;
    }
    let coupling_vr = 1e9 / 1e7;
    let coupling_rv = 1e8 / 5e10;
    let det: f64 = 1.0 - coupling_vr * coupling_rv;
    if det.abs() < 1e-10 {
        return tau;
    }
    let matrix = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0 / det, -coupling_vr / det],
        [0.0, -coupling_rv / det, 1.0 / det],
    ];
    [
        matrix[0][0] * tau[0] + matrix[0][1] * tau[1] + matrix[0][2] * tau[2],
        matrix[1][0] * tau[0] + matrix[1][1] * tau[1] + matrix[1][2] * tau[2],
        matrix[2][0] * tau[0] + matrix[2][1] * tau[1] + matrix[2][2] * tau[2],
    ]
}

pub fn compute_dp_decoupled_control(request: &Value) -> Result<String, String> {
    let dt = require_dt(request)?;
    let platform = object(request, "platform");
    let controller = object(request, "controllerState");
    let config = object(request, "config");
    let gains = object(config, "gains");
    let error_x = num(platform, "targetX", 0.0) - num(platform, "x", 0.0);
    let error_y = num(platform, "targetY", 0.0) - num(platform, "y", 0.0);
    let psi = num(platform, "psi", 0.0);
    let error_surge = error_x * psi.cos() + error_y * psi.sin();
    let error_sway = -error_x * psi.sin() + error_y * psi.cos();
    let error_yaw = wrap_rad(num(platform, "targetPsi", 0.0) - psi);
    let (tau_x, surge_state) = compute_pid_channel(
        error_surge,
        object(controller, "surge"),
        nested_num(gains, &["surge", "kp"], 500.0),
        nested_num(gains, &["surge", "ki"], 10.0),
        nested_num(gains, &["surge", "kd"], 2000.0),
        dt,
        nested_num(config, &["integralLimit", "surge"], 5000.0),
        nested_num(config, &["deadband", "position"], 0.1),
    );
    let (tau_y, sway_state) = compute_pid_channel(
        error_sway,
        object(controller, "sway"),
        nested_num(gains, &["sway", "kp"], 800.0),
        nested_num(gains, &["sway", "ki"], 15.0),
        nested_num(gains, &["sway", "kd"], 3000.0),
        dt,
        nested_num(config, &["integralLimit", "sway"], 8000.0),
        nested_num(config, &["deadband", "position"], 0.1),
    );
    let (tau_n, yaw_state) = compute_pid_channel(
        error_yaw,
        object(controller, "yaw"),
        nested_num(gains, &["yaw", "kp"], 1e8),
        nested_num(gains, &["yaw", "ki"], 1e6),
        nested_num(gains, &["yaw", "kd"], 5e8),
        dt,
        nested_num(config, &["integralLimit", "yaw"], 1e9),
        nested_num(config, &["deadband", "heading"], 0.5) * std::f64::consts::PI / 180.0,
    );
    let decoupling_enabled = bool_flag(request, "decouplingEnabled", bool_flag(config, "decouplingEnabled", true));
    let decoupled = apply_decoupling([tau_x, tau_y, tau_n], decoupling_enabled);
    serde_json::to_string(&json!({
        "output": {
            "tauX": tau_x,
            "tauY": tau_y,
            "tauN": tau_n,
            "errorX": error_surge,
            "errorY": error_sway,
            "errorPsi": rad_to_deg(error_yaw),
            "decoupledTauX": decoupled[0],
            "decoupledTauY": decoupled[1],
            "decoupledTauN": decoupled[2]
        },
        "newState": { "surge": surge_state, "sway": sway_state, "yaw": yaw_state },
        "modelId": "practice_dp_decoupled_control"
    }))
    .map_err(|error| error.to_string())
}

pub fn compute_ice_breaking_step(request: &Value) -> Result<String, String> {
    let dt = require_dt(request)?;
    let params = object(request, "params");
    let state = object(request, "state");
    let speed = num(request, "speed", 0.0);
    if !bool_flag(params, "enabled", false) || num(params, "iceThickness", 0.0) <= 0.0 {
        return serde_json::to_string(&json!({
            "inContact": false,
            "stickPhase": false,
            "phaseTime": 0.0,
            "nextPhaseTime": num(state, "nextPhaseTime", 0.0),
            "currentK": 1.0,
            "currentT": 1.0,
            "resistanceForce": 0.0,
            "modelId": "practice_ice_breaking_step"
        }))
        .map_err(|error| error.to_string());
    }
    if speed.abs() <= 0.1 {
        return serde_json::to_string(&json!({
            "inContact": false,
            "stickPhase": bool_flag(state, "stickPhase", false),
            "phaseTime": num(state, "phaseTime", 0.0),
            "nextPhaseTime": num(state, "nextPhaseTime", 0.0),
            "currentK": 1.0,
            "currentT": 1.0,
            "resistanceForce": 0.0,
            "modelId": "practice_ice_breaking_step"
        }))
        .map_err(|error| error.to_string());
    }
    let samples = rng_samples(request);
    let mut rng_index = 0;
    let mut phase_time = num(state, "phaseTime", 0.0) + dt;
    let mut stick_phase = bool_flag(state, "stickPhase", false);
    let mut next_phase_time = num(state, "nextPhaseTime", 2.0);
    if phase_time >= next_phase_time {
        stick_phase = !stick_phase;
        phase_time = 0.0;
        next_phase_time = if stick_phase {
            2.0 + rng_at(&samples, &mut rng_index) * 4.0
        } else {
            0.5 + rng_at(&samples, &mut rng_index) * 1.5
        };
    }
    let (k_factor, t_factor) = if stick_phase {
        (
            num(params, "kVariationMin", 0.4) + rng_at(&samples, &mut rng_index) * (0.7 - num(params, "kVariationMin", 0.4)),
            1.2 + rng_at(&samples, &mut rng_index) * (num(params, "tVariationMax", 1.4) - 1.2),
        )
    } else {
        (
            0.9 + rng_at(&samples, &mut rng_index) * (num(params, "kVariationMax", 1.1) - 0.9),
            num(params, "tVariationMin", 0.8) + rng_at(&samples, &mut rng_index) * (1.0 - num(params, "tVariationMin", 0.8)),
        )
    };
    let thickness = num(params, "iceThickness", 1.0);
    let mut resistance = 5e6 * thickness.powf(1.5) * speed.abs().powf(0.5);
    if stick_phase {
        resistance *= 1.5;
    }
    serde_json::to_string(&json!({
        "inContact": true,
        "stickPhase": stick_phase,
        "phaseTime": phase_time,
        "nextPhaseTime": next_phase_time,
        "currentK": num(state, "currentK", 1.0) + 0.1 * (k_factor - num(state, "currentK", 1.0)),
        "currentT": num(state, "currentT", 1.0) + 0.1 * (t_factor - num(state, "currentT", 1.0)),
        "resistanceForce": resistance,
        "modelId": "practice_ice_breaking_step"
    }))
    .map_err(|error| error.to_string())
}

pub fn compute_azipod_course_keeper(request: &Value) -> Result<String, String> {
    let dt = require_dt(request)?;
    let mode = text(request, "controlMode", "pid");
    let state = object(request, "state");
    let time = num(request, "time", 0.0);
    if mode == "manual" {
        return serde_json::to_string(&json!({
            "integral": 0.0,
            "prevError": 0.0,
            "prevTime": time,
            "azimuth1Cmd": num(state, "azimuth1Cmd", 0.0),
            "azimuth2Cmd": num(state, "azimuth2Cmd", 0.0),
            "thrust1Cmd": num(state, "thrust1Cmd", 0.0),
            "thrust2Cmd": num(state, "thrust2Cmd", 0.0),
            "yawMomentDemand": num(state, "yawMomentDemand", 0.0),
            "thrustDemand": num(state, "thrustDemand", 0.0),
            "modelId": "practice_azipod_course_keeper"
        }))
        .map_err(|error| error.to_string());
    }
    let ice_mode = bool_flag(request, "iceMode", false);
    let mut kp = nested_num(request, &["config", "gains", "kp"], if ice_mode { 0.8 } else { 1.2 });
    let mut ki = nested_num(request, &["config", "gains", "ki"], if ice_mode { 0.008 } else { 0.015 });
    let mut kd = nested_num(request, &["config", "gains", "kd"], if ice_mode { 0.5 } else { 0.8 });
    let gain_factor = nested_num(request, &["config", "gainFactor"], if ice_mode { 0.7 } else { 1.0 });
    let perturbed_k = num(request, "perturbedK", 1.0);
    kp *= gain_factor * perturbed_k;
    ki *= gain_factor;
    kd *= gain_factor;
    let error = angle_delta_deg(num(request, "targetHeading", 0.0), num(request, "currentHeading", 0.0));
    let mut integral = num(state, "integral", 0.0);
    let mut derivative = 0.0;
    if mode == "pid" {
        integral += error * dt;
        if bool_flag(object(request, "config"), "antiWindup", true) {
            let limit = nested_num(request, &["config", "integralLimit"], if ice_mode { 30.0 } else { 50.0 });
            integral = clamp(integral, -limit, limit);
        }
    }
    if mode == "pd" || mode == "pid" {
        derivative = (error - num(state, "prevError", 0.0)) / dt;
    }
    let output = match mode {
        "p" => kp * error,
        "pd" => kp * error + kd * derivative,
        _ => kp * error + ki * integral + kd * derivative,
    };
    let max_azimuth = nested_num(request, &["config", "maxAzimuthDeg"], 45.0);
    let azimuth_delta = clamp(output * 2.0, -deg_to_rad(max_azimuth), deg_to_rad(max_azimuth));
    let base_thrust = nested_num(request, &["config", "baseThrust"], 3_000_000.0);
    let thrust = if num(request, "speedMps", 0.0) > 0.5 {
        base_thrust
    } else {
        base_thrust * 0.5
    };
    serde_json::to_string(&json!({
        "integral": integral,
        "prevError": error,
        "prevTime": time,
        "azimuth1Cmd": azimuth_delta / 2.0,
        "azimuth2Cmd": -azimuth_delta / 2.0,
        "thrust1Cmd": thrust,
        "thrust2Cmd": thrust,
        "yawMomentDemand": output * 1e8,
        "thrustDemand": thrust * 2.0,
        "modelId": "practice_azipod_course_keeper"
    }))
    .map_err(|error| error.to_string())
}

fn current_forces(env: &Value, psi: f64) -> (f64, f64, f64) {
    let relative = num(env, "direction", 0.0) - psi;
    let q = 0.5 * 1025.0 * num(env, "speed", 0.0).powi(2);
    (
        -q * 2000.0 * 0.8 * relative.cos(),
        -q * 4000.0 * 1.2 * relative.sin(),
        -q * 4000.0 * 114.0 * 0.15 * (2.0 * relative).sin(),
    )
}

fn wind_forces(env: &Value, psi: f64) -> (f64, f64, f64) {
    let relative = num(env, "direction", 0.0) - psi;
    let q = 0.5 * 1.225 * num(env, "speed", 0.0).powi(2);
    (
        -q * 3000.0 * 0.7 * relative.cos(),
        -q * 5000.0 * 1.0 * relative.sin(),
        -q * 5000.0 * 114.0 * 0.12 * (2.0 * relative).sin(),
    )
}

fn wave_forces(wave_height: f64, wave_dir_deg: f64, psi: f64) -> (f64, f64, f64) {
    let relative = deg_to_rad(wave_dir_deg) - psi;
    let hs2 = wave_height * wave_height;
    let coeff = 50_000.0;
    (
        -coeff * hs2 * relative.cos(),
        -coeff * hs2 * relative.sin(),
        -coeff * hs2 * 0.1 * (2.0 * relative).sin() * 114.0,
    )
}

pub fn compute_drilling_environment(request: &Value) -> Result<String, String> {
    let dt = num(request, "dt", 1.0 / 60.0);
    if bool_flag(request, "evolve", true) && !(dt > 0.0 && dt <= 1.0) {
        return Err("dt must be in (0, 1].".to_string());
    }
    let samples = rng_samples(request);
    let mut rng_index = 0;
    let current = object(request, "current");
    let wind = object(request, "wind");
    let (new_current, new_wind) = if bool_flag(request, "evolve", true) {
        let tau = 300.0;
        let alpha = 1.0 - (-dt / tau).exp();
        let speed_noise = (rng_at(&samples, &mut rng_index) - 0.5) * num(current, "variability", 0.1) * 0.5;
        let dir_noise = (rng_at(&samples, &mut rng_index) - 0.5) * num(current, "variability", 0.1) * 0.2;
        let new_current_speed = (num(current, "speed", 0.0)
            + alpha * (num(current, "meanSpeed", 0.0) - num(current, "speed", 0.0))
            + speed_noise * dt.sqrt())
        .max(0.0);
        let new_current_dir = wrap_rad(
            num(current, "direction", 0.0)
                + alpha * wrap_rad(num(current, "meanDirection", 0.0) - num(current, "direction", 0.0))
                + dir_noise * dt.sqrt(),
        );
        let mean_wind = num(request, "meanWindSpeed", num(wind, "speed", 0.0));
        let mut evolved_wind = wind.clone();
        if rng_at(&samples, &mut rng_index) < dt / 10.0 {
            if let Some(object) = evolved_wind.as_object_mut() {
                object.insert(
                    "speed".to_string(),
                    json!(mean_wind * num(wind, "gustFactor", 1.2) * (0.9 + rng_at(&samples, &mut rng_index) * 0.2)),
                );
                object.insert(
                    "direction".to_string(),
                    json!(num(wind, "direction", 0.0) + (rng_at(&samples, &mut rng_index) - 0.5) * 0.2),
                );
            }
        } else {
            let recover = 1.0 - (-dt / 5.0).exp();
            if let Some(object) = evolved_wind.as_object_mut() {
                object.insert(
                    "speed".to_string(),
                    json!(num(wind, "speed", 0.0) + recover * (mean_wind - num(wind, "speed", 0.0))),
                );
            }
        }
        let mut evolved_current = current.clone();
        if let Some(object) = evolved_current.as_object_mut() {
            object.insert("speed".to_string(), json!(new_current_speed));
            object.insert("direction".to_string(), json!(new_current_dir));
        }
        (evolved_current, evolved_wind)
    } else {
        (current.clone(), wind.clone())
    };
    let psi = num(request, "psi", 0.0);
    let current_force = current_forces(&new_current, psi);
    let wind_force = wind_forces(&new_wind, psi);
    let wave_force = wave_forces(num(request, "waveHeight", 1.5), num(request, "waveDirection", 0.0), psi);
    serde_json::to_string(&json!({
        "current": new_current,
        "wind": new_wind,
        "forces": {
            "forceX": current_force.0 + wind_force.0 + wave_force.0,
            "forceY": current_force.1 + wind_force.1 + wave_force.1,
            "momentN": current_force.2 + wind_force.2 + wave_force.2
        },
        "modelId": "practice_drilling_environment"
    }))
    .map_err(|error| error.to_string())
}
