use serde_json::{Map, Value, json};

use crate::destroyer_hifi_runtime;

const RHO: f64 = 1025.0;

fn num(value: &Value, key: &str, fallback: f64) -> f64 {
    value
        .get(key)
        .and_then(Value::as_f64)
        .filter(|item| item.is_finite())
        .unwrap_or(fallback)
}

fn path_num(value: &Value, path: &[&str], fallback: f64) -> f64 {
    let mut current = value;
    for key in path {
        current = match current.get(*key) {
            Some(next) => next,
            None => return fallback,
        };
    }
    current
        .as_f64()
        .filter(|item| item.is_finite())
        .unwrap_or(fallback)
}

fn arr3(value: &Value, key: &str) -> [f64; 3] {
    let arr = value.get(key).and_then(Value::as_array);
    [
        arr.and_then(|items| items.first())
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
        arr.and_then(|items| items.get(1))
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
        arr.and_then(|items| items.get(2))
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
    ]
}

fn clamp(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

fn wrap_pi(mut value: f64) -> f64 {
    while value > std::f64::consts::PI {
        value -= 2.0 * std::f64::consts::PI;
    }
    while value < -std::f64::consts::PI {
        value += 2.0 * std::f64::consts::PI;
    }
    value
}

fn deg_to_rad(value: f64) -> f64 {
    value * std::f64::consts::PI / 180.0
}

fn rad_to_deg(value: f64) -> f64 {
    value * 180.0 / std::f64::consts::PI
}

fn normalize_heading_deg(value: f64) -> f64 {
    let mut normalized = value % 360.0;
    if normalized < 0.0 {
        normalized += 360.0;
    }
    normalized
}

fn normalize_signed_heading_deg(value: f64) -> f64 {
    let normalized = normalize_heading_deg(value);
    if normalized > 180.0 {
        normalized - 360.0
    } else {
        normalized
    }
}

fn angle_delta_deg(target: f64, current: f64) -> f64 {
    let mut diff = normalize_heading_deg(target) - normalize_heading_deg(current);
    if diff > 180.0 {
        diff -= 360.0;
    }
    if diff < -180.0 {
        diff += 360.0;
    }
    diff
}

fn nested_pair(value: &Value, parent: &str, key: &str, fallback: [f64; 2]) -> [f64; 2] {
    let arr = value
        .get(parent)
        .and_then(|item| item.get(key))
        .and_then(Value::as_array);
    [
        arr.and_then(|items| items.first())
            .and_then(Value::as_f64)
            .filter(|item| item.is_finite())
            .unwrap_or(fallback[0]),
        arr.and_then(|items| items.get(1))
            .and_then(Value::as_f64)
            .filter(|item| item.is_finite())
            .unwrap_or(fallback[1]),
    ]
}

fn json_array_f64(value: &Value, key: &str) -> Vec<f64> {
    value
        .get(key)
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .map(|item| {
                    item.as_f64()
                        .filter(|value| value.is_finite())
                        .unwrap_or(0.0)
                })
                .collect()
        })
        .unwrap_or_default()
}

fn array_f64(value: &Value, key: &str, fallback: &[f64]) -> Vec<f64> {
    let values = json_array_f64(value, key);
    if values.is_empty() {
        fallback.to_vec()
    } else {
        values
    }
}

fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

#[derive(Clone)]
struct LinearDiscretePlant {
    a: Vec<Vec<f64>>,
    b: Vec<f64>,
    c: Vec<f64>,
    d: f64,
}

fn matrix_identity(size: usize) -> Vec<Vec<f64>> {
    let mut matrix = vec![vec![0.0; size]; size];
    for (index, row) in matrix.iter_mut().enumerate() {
        row[index] = 1.0;
    }
    matrix
}

fn matrix_add(a: &[Vec<f64>], b: &[Vec<f64>]) -> Vec<Vec<f64>> {
    a.iter()
        .zip(b.iter())
        .map(|(ar, br)| ar.iter().zip(br.iter()).map(|(av, bv)| av + bv).collect())
        .collect()
}

fn matrix_sub(a: &[Vec<f64>], b: &[Vec<f64>]) -> Vec<Vec<f64>> {
    a.iter()
        .zip(b.iter())
        .map(|(ar, br)| ar.iter().zip(br.iter()).map(|(av, bv)| av - bv).collect())
        .collect()
}

fn matrix_scale(a: &[Vec<f64>], scalar: f64) -> Vec<Vec<f64>> {
    a.iter()
        .map(|row| row.iter().map(|value| value * scalar).collect())
        .collect()
}

fn matrix_mul(a: &[Vec<f64>], b: &[Vec<f64>]) -> Vec<Vec<f64>> {
    let rows = a.len();
    let cols = b.first().map(|row| row.len()).unwrap_or(0);
    let inner = b.len();
    let mut output = vec![vec![0.0; cols]; rows];
    for i in 0..rows {
        for j in 0..cols {
            output[i][j] = (0..inner).map(|k| a[i][k] * b[k][j]).sum();
        }
    }
    output
}

fn matrix_vec_mul(a: &[Vec<f64>], x: &[f64]) -> Vec<f64> {
    a.iter().map(|row| dot(row, x)).collect()
}

fn vec_matrix_mul(x: &[f64], a: &[Vec<f64>]) -> Vec<f64> {
    let cols = a.first().map(|row| row.len()).unwrap_or(0);
    (0..cols)
        .map(|col| {
            x.iter()
                .enumerate()
                .map(|(row, value)| value * a[row][col])
                .sum()
        })
        .collect()
}

fn dot(a: &[f64], b: &[f64]) -> f64 {
    a.iter().zip(b.iter()).map(|(av, bv)| av * bv).sum()
}

fn invert_matrix(matrix: &[Vec<f64>]) -> Result<Vec<Vec<f64>>, String> {
    let n = matrix.len();
    let mut augmented = vec![vec![0.0; n * 2]; n];
    for i in 0..n {
        for j in 0..n {
            augmented[i][j] = matrix[i][j];
        }
        augmented[i][n + i] = 1.0;
    }
    for col in 0..n {
        let pivot = (col..n)
            .max_by(|&a, &b| {
                augmented[a][col]
                    .abs()
                    .partial_cmp(&augmented[b][col].abs())
                    .unwrap()
            })
            .unwrap();
        if augmented[pivot][col].abs() < 1e-12 {
            return Err("matrix is singular".to_string());
        }
        augmented.swap(col, pivot);
        let divisor = augmented[col][col];
        for value in augmented[col].iter_mut() {
            *value /= divisor;
        }
        for row in 0..n {
            if row == col {
                continue;
            }
            let factor = augmented[row][col];
            for j in 0..(n * 2) {
                augmented[row][j] -= factor * augmented[col][j];
            }
        }
    }
    Ok((0..n)
        .map(|row| augmented[row][n..(n * 2)].to_vec())
        .collect())
}

fn discretize_transfer_function(
    numerator_in: &[f64],
    denominator_in: &[f64],
    dt: f64,
) -> Result<LinearDiscretePlant, String> {
    if denominator_in.is_empty() {
        return Err("denominator cannot be empty".to_string());
    }
    let leading = *denominator_in.last().unwrap_or(&1.0);
    if leading.abs() < 1e-12 {
        return Err("highest-order denominator coefficient cannot be zero".to_string());
    }
    let numerator: Vec<f64> = numerator_in.iter().map(|value| value / leading).collect();
    let denominator: Vec<f64> = denominator_in.iter().map(|value| value / leading).collect();
    let order = denominator.len().saturating_sub(1);
    if order == 0 {
        return Ok(LinearDiscretePlant {
            a: vec![vec![0.0]],
            b: vec![1.0],
            c: vec![numerator.first().copied().unwrap_or(0.0)],
            d: 0.0,
        });
    }

    let mut a = vec![vec![0.0; order]; order];
    for index in 0..order.saturating_sub(1) {
        a[index][index + 1] = 1.0;
    }
    for index in 0..order {
        a[order - 1][index] = -denominator.get(index).copied().unwrap_or(0.0);
    }
    let mut b = vec![0.0; order];
    b[order - 1] = 1.0;
    let mut c = vec![0.0; order];
    for (index, value) in numerator.iter().take(order).enumerate() {
        c[index] = *value;
    }
    let d = if numerator.len() > order {
        numerator[order]
    } else {
        0.0
    };

    let identity = matrix_identity(order);
    let a_half = matrix_scale(&a, dt / 2.0);
    let inv = invert_matrix(&matrix_sub(&identity, &a_half))?;
    let ad = matrix_mul(&inv, &matrix_add(&identity, &a_half));
    let bd = matrix_vec_mul(&inv, &b)
        .into_iter()
        .map(|value| value * dt)
        .collect::<Vec<_>>();
    let cd = vec_matrix_mul(&c, &inv);
    let dd = d + dot(&cd, &b) * dt / 2.0;
    Ok(LinearDiscretePlant {
        a: ad,
        b: bd,
        c: cd,
        d: dd,
    })
}

fn step_linear_plant(plant: &LinearDiscretePlant, state: &mut Vec<f64>, input: f64) -> f64 {
    if state.len() != plant.a.len() {
        state.resize(plant.a.len(), 0.0);
    }
    let mut next = matrix_vec_mul(&plant.a, state);
    for (value, b) in next.iter_mut().zip(plant.b.iter()) {
        *value += b * input;
    }
    *state = next;
    dot(&plant.c, state) + plant.d * input
}

fn response_metrics(values: &[f64], times: &[f64], target: f64) -> Value {
    let final_value = values.last().copied().unwrap_or(0.0);
    let steady_state_error = (target - final_value).abs();
    let peak_value = values.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let peak_index = values
        .iter()
        .position(|value| (*value - peak_value).abs() < 1e-12)
        .unwrap_or(0);
    let peak_time = times.get(peak_index).copied().unwrap_or(0.0);
    let overshoot = if target.abs() > 1e-9 && peak_value > target {
        (peak_value - target) / target.abs() * 100.0
    } else {
        0.0
    };
    let rise_start = values.iter().position(|value| *value >= target * 0.1);
    let rise_end = values.iter().position(|value| *value >= target * 0.9);
    let rise_time = match (rise_start, rise_end) {
        (Some(start), Some(end)) => {
            times.get(end).unwrap_or(&0.0) - times.get(start).unwrap_or(&0.0)
        }
        _ => 0.0,
    };
    let band = target.abs() * 0.05;
    let last_outside = values
        .iter()
        .enumerate()
        .filter(|(_, value)| (**value - target).abs() > band)
        .map(|(index, _)| index)
        .last();
    let settling_time = match last_outside {
        Some(index) if index + 1 < times.len() => times[index + 1],
        Some(_) => times.last().copied().unwrap_or(0.0),
        None => 0.0,
    };

    json!({
        "finalValue": final_value,
        "steadyStateError": steady_state_error,
        "overshootPercent": overshoot.max(0.0),
        "overshoot": overshoot.max(0.0),
        "riseTime": rise_time,
        "peakTime": peak_time,
        "settlingTime": settling_time,
        "peakValue": peak_value
    })
}

fn compute_nomoto1st(request: &Value) -> Result<String, String> {
    let dt = num(request, "dt", 0.0);
    if dt <= 0.0 || dt > 1.0 {
        return Err("dt must be in (0, 1].".to_string());
    }
    let state = &request["state"];
    let params = &request["params"];
    let rudder_deg = clamp(
        num(request, "rudderDeg", 0.0),
        -num(params, "maxRudderDeg", 35.0),
        num(params, "maxRudderDeg", 35.0),
    );
    let rudder_rad = deg_to_rad(rudder_deg);
    let heading = num(state, "headingRad", 0.0);
    let yaw_rate = num(state, "yawRateRad", 0.0);
    let x = num(state, "positionX", 0.0);
    let z = num(state, "positionZ", 0.0);
    let speed = num(state, "speedMps", num(params, "speedMps", 5.0));
    let k = num(params, "K", 0.1);
    let t = num(params, "T", 50.0).max(1e-6);

    let derivative = |values: [f64; 4]| -> [f64; 4] {
        let current_heading = values[0];
        let current_yaw_rate = values[1];
        [
            current_yaw_rate,
            (k * rudder_rad - current_yaw_rate) / t,
            speed * current_heading.cos(),
            speed * current_heading.sin(),
        ]
    };
    let y = [heading, yaw_rate, x, z];
    let k1 = derivative(y);
    let k2 = derivative([
        y[0] + 0.5 * dt * k1[0],
        y[1] + 0.5 * dt * k1[1],
        y[2] + 0.5 * dt * k1[2],
        y[3] + 0.5 * dt * k1[3],
    ]);
    let k3 = derivative([
        y[0] + 0.5 * dt * k2[0],
        y[1] + 0.5 * dt * k2[1],
        y[2] + 0.5 * dt * k2[2],
        y[3] + 0.5 * dt * k2[3],
    ]);
    let k4 = derivative([
        y[0] + dt * k3[0],
        y[1] + dt * k3[1],
        y[2] + dt * k3[2],
        y[3] + dt * k3[3],
    ]);
    serde_json::to_string(&json!({
        "headingRad": y[0] + dt * (k1[0] + 2.0 * k2[0] + 2.0 * k3[0] + k4[0]) / 6.0,
        "yawRateRad": y[1] + dt * (k1[1] + 2.0 * k2[1] + 2.0 * k3[1] + k4[1]) / 6.0,
        "positionX": y[2] + dt * (k1[2] + 2.0 * k2[2] + 2.0 * k3[2] + k4[2]) / 6.0,
        "positionZ": y[3] + dt * (k1[3] + 2.0 * k2[3] + 2.0 * k3[3] + k4[3]) / 6.0,
        "rudderDeg": rudder_deg,
        "speedMps": speed
    }))
    .map_err(|error| error.to_string())
}

fn compute_linear_pid_batch(request: &Value) -> Result<String, String> {
    let dt = num(request, "dt", 0.05);
    if dt <= 0.0 || dt > 1.0 {
        return Err("dt must be in (0, 1].".to_string());
    }
    let duration = num(request, "duration", 20.0).clamp(dt, 120.0);
    let reference = num(request, "reference", 1.0);
    let numerator = array_f64(request, "numerator", &[1.0]);
    let denominator = array_f64(request, "denominator", &[1.0, 1.0]);
    let plant = discretize_transfer_function(&numerator, &denominator, dt)?;
    let mut state = vec![0.0; plant.a.len()];
    let mut y = 0.0;
    let mut prev_error = 0.0;
    let mut integral = 0.0;
    let kp = num(request, "kp", 0.0);
    let ki = num(request, "ki", 0.0);
    let kd = num(request, "kd", 0.0);
    let mut times = Vec::new();
    let mut response = Vec::new();
    let mut setpoint = Vec::new();

    let mut sim_time = 0.0;
    while sim_time <= duration + 1e-9 {
        let error = reference - y;
        integral += error * dt;
        let derivative = (error - prev_error) / dt;
        let control = kp * error + ki * integral + kd * derivative;
        y = step_linear_plant(&plant, &mut state, control);
        prev_error = error;
        times.push(round2(sim_time));
        response.push(y);
        setpoint.push(reference);
        sim_time += dt;
    }

    let metrics = response_metrics(&response, &times, reference);
    serde_json::to_string(&json!({
        "times": times,
        "response": response,
        "setpoint": setpoint,
        "metrics": metrics
    }))
    .map_err(|error| error.to_string())
}

fn linear_input(signal: &str, time: f64, dt: f64) -> f64 {
    match signal {
        "ramp" => time,
        "impulse" => {
            if time <= dt {
                1.0 / dt
            } else {
                0.0
            }
        }
        _ => 1.0,
    }
}

fn compute_transfer_function_response(request: &Value) -> Result<String, String> {
    let dt = num(request, "dt", 1.0 / 60.0);
    if dt <= 0.0 || dt > 1.0 {
        return Err("dt must be in (0, 1].".to_string());
    }
    let duration = num(request, "duration", 8.0).clamp(dt, 120.0);
    let numerator = array_f64(request, "numerator", &[1.0]);
    let denominator = array_f64(request, "denominator", &[1.0, 1.0]);
    let signal = request
        .get("signal")
        .and_then(Value::as_str)
        .unwrap_or("step");
    let plant = discretize_transfer_function(&numerator, &denominator, dt)?;
    let mut state = vec![0.0; plant.a.len()];
    let mut points = Vec::new();
    let mut values = Vec::new();
    let max_steps = num(request, "maxSteps", 900.0).round().clamp(1.0, 5000.0) as usize;
    let steps = ((duration / dt).ceil() as usize).min(max_steps);
    for index in 0..=steps {
        let time = index as f64 * dt;
        let y = step_linear_plant(&plant, &mut state, linear_input(signal, time, dt));
        values.push(y);
        points.push(json!({ "t": time, "y": y }));
    }
    let min_y = values.iter().copied().fold(0.0, f64::min);
    let max_y = values.iter().copied().fold(1.0, f64::max);
    serde_json::to_string(&json!({
        "points": points,
        "minY": min_y - 0.1 * min_y.abs(),
        "maxY": max_y + 0.1 * max_y.abs(),
        "duration": duration
    }))
    .map_err(|error| error.to_string())
}

fn compute_second_order_step_response(request: &Value) -> Result<String, String> {
    let zeta = clamp(num(request, "zeta", 0.45), 0.01, 5.0);
    let omega = num(request, "omega", 4.5).max(0.01);
    let dt = num(request, "dt", 0.01);
    let duration = num(request, "duration", 6.0);
    let mut cloned = request.as_object().cloned().unwrap_or_default();
    cloned.insert("numerator".to_string(), json!([omega * omega]));
    cloned.insert(
        "denominator".to_string(),
        json!([omega * omega, 2.0 * zeta * omega, 1.0]),
    );
    cloned.insert("dt".to_string(), json!(dt));
    cloned.insert("duration".to_string(), json!(duration));
    cloned.insert("signal".to_string(), json!("step"));
    let response: Value =
        serde_json::from_str(&compute_transfer_function_response(&Value::Object(cloned))?)
            .map_err(|error| error.to_string())?;
    let points = response
        .get("points")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let times: Vec<f64> = points.iter().map(|point| num(point, "t", 0.0)).collect();
    let values: Vec<f64> = points.iter().map(|point| num(point, "y", 0.0)).collect();
    let metrics = response_metrics(&values, &times, 1.0);
    serde_json::to_string(&json!({
        "times": times,
        "values": values,
        "metrics": metrics
    }))
    .map_err(|error| error.to_string())
}

fn compute_second_order_analytic_response(request: &Value) -> Result<String, String> {
    let zeta = clamp(num(request, "zeta", 0.35), 0.05, 0.95);
    let wn = num(request, "wn", 2.0).max(0.05);
    let wd = wn * (1.0 - zeta * zeta).sqrt();
    let phi = zeta.acos();
    let t_max = (8.0 / (zeta * wn)).clamp(6.0, 20.0);
    let steps = num(request, "steps", 120.0).round().clamp(10.0, 2000.0) as usize;
    let mut points = Vec::new();
    for index in 0..steps {
        let t = (t_max * index as f64) / ((steps - 1) as f64).max(1.0);
        let decay = (-zeta * wn * t).exp();
        let response = 1.0 - (1.0 / (1.0 - zeta * zeta).sqrt()) * decay * (wd * t + phi).sin();
        points.push(json!({ "t": t, "y": response }));
    }
    serde_json::to_string(&json!({
        "points": points,
        "tMax": t_max,
        "overshoot": ((-zeta * std::f64::consts::PI) / (1.0 - zeta * zeta).sqrt()).exp() * 100.0,
        "peakTime": std::f64::consts::PI / wd,
        "settlingTime": 4.0 / (zeta * wn),
        "riseTime": (std::f64::consts::PI - phi) / wd,
        "wd": wd
    }))
    .map_err(|error| error.to_string())
}

fn compute_cruise_typhoon_step(request: &Value) -> Result<String, String> {
    let dt = num(request, "dt", 1.0 / 60.0);
    if dt <= 0.0 || dt > 1.0 {
        return Err("dt must be in (0, 1].".to_string());
    }
    let state = &request["state"];
    let heading = num(state, "heading", 0.0);
    let target_heading = num(state, "targetHeading", heading);
    let speed = num(state, "speed", 20.0);
    let sea_state = num(request, "seaState", 3.0);
    let heading_error = target_heading - heading;
    let heading_rate = heading_error.signum() * (heading_error.abs() * 0.1).min(2.0);
    let new_heading = heading + heading_rate * dt;
    let time = num(state, "time", 0.0) + dt;
    let wave_phase = time * 0.5;
    let base_roll = 3.0 * wave_phase.sin() * (sea_state / 5.0);
    let turning_roll = heading_rate * 2.0;
    let new_roll = base_roll + turning_roll;
    let speed_ms = speed * 0.5144;
    let roll_accel = 9.81 * deg_to_rad(new_roll).sin();
    let turning_accel = speed_ms * deg_to_rad(heading_rate).abs();
    let lateral_accel = (roll_accel + turning_accel) / 9.81;

    let mut out = state.as_object().cloned().unwrap_or_default();
    out.insert("time".to_string(), json!(time));
    out.insert("heading".to_string(), json!(new_heading));
    out.insert("rollAngle".to_string(), json!(new_roll));
    out.insert("yawRate".to_string(), json!(heading_rate));
    out.insert("lateralAccel".to_string(), json!(lateral_accel));
    serde_json::to_string(&Value::Object(out)).map_err(|error| error.to_string())
}

fn compute_champagne_tower_step(request: &Value) -> Result<String, String> {
    let dt = num(request, "dt", 1.0 / 60.0);
    if dt <= 0.0 || dt > 1.0 {
        return Err("dt must be in (0, 1].".to_string());
    }
    let state = &request["state"];
    let params = &request["params"];
    let height = num(params, "height", 1.8).max(0.1);
    let damping_ratio = num(params, "dampingRatio", 0.18).max(0.0);
    let fall_threshold = deg_to_rad(num(params, "fallThreshold", 12.0));
    let natural_freq = (9.81 / height).sqrt();
    let angle = num(state, "angle", 0.0);
    let angular_velocity = num(state, "angularVelocity", 0.0);
    let lateral_accel = num(request, "lateralAccel", 0.0);
    let ship_roll = deg_to_rad(num(request, "shipRollDeg", 0.0));
    let external_force = (lateral_accel * 9.81) / height + ship_roll * 0.5;
    let angular_accel = -2.0 * damping_ratio * natural_freq * angular_velocity
        - natural_freq * natural_freq * angle
        + external_force;
    let new_velocity = angular_velocity + angular_accel * dt;
    let new_angle = angle + new_velocity * dt;
    let is_falling = new_angle.abs() > fall_threshold;
    let stability = (1.0 - new_angle.abs() / fall_threshold).max(0.0);
    serde_json::to_string(&json!({
        "angle": new_angle,
        "angularVelocity": new_velocity,
        "isFalling": is_falling,
        "stability": stability,
        "lateralAccel": lateral_accel
    }))
    .map_err(|error| error.to_string())
}

fn nomoto2_derivatives(yaw_rate: f64, yaw_accel: f64, rudder_rad: f64, params: &Value) -> [f64; 2] {
    let k = num(params, "K", 0.03);
    let t1 = num(params, "T1", 80.0).max(1e-6);
    let t2 = num(params, "T2", 20.0).max(1e-6);
    [
        yaw_accel,
        (k * rudder_rad - yaw_rate - (t1 + t2) * yaw_accel) / (t1 * t2),
    ]
}

fn compute_nomoto2nd_delay(request: &Value) -> Result<String, String> {
    let dt = num(request, "dt", 0.0);
    if dt <= 0.0 || dt > 1.0 {
        return Err("dt must be in (0, 1].".to_string());
    }
    let state = &request["state"];
    let params = &request["params"];
    let rudder_deg = clamp(
        num(request, "rudderDeg", 0.0),
        -num(params, "maxRudderDeg", 35.0),
        num(params, "maxRudderDeg", 35.0),
    );
    let mut history = json_array_f64(state, "rudderHistory");
    if history.is_empty() {
        history.resize(
            (num(params, "timeDelay", 0.5) / dt).ceil().max(1.0) as usize,
            0.0,
        );
    }
    let index = state
        .get("historyIndex")
        .and_then(Value::as_u64)
        .map(|value| value as usize)
        .unwrap_or(0)
        % history.len();
    let delayed_rudder = history[index];
    history[index] = rudder_deg;
    let new_index = (index + 1) % history.len();
    let delayed_rudder_rad = deg_to_rad(delayed_rudder);

    let yaw_rate = num(state, "yawRateRad", 0.0);
    let yaw_accel = num(state, "yawRateDerivative", 0.0);
    let k1 = nomoto2_derivatives(yaw_rate, yaw_accel, delayed_rudder_rad, params);
    let k2 = nomoto2_derivatives(
        yaw_rate + 0.5 * dt * k1[0],
        yaw_accel + 0.5 * dt * k1[1],
        delayed_rudder_rad,
        params,
    );
    let k3 = nomoto2_derivatives(
        yaw_rate + 0.5 * dt * k2[0],
        yaw_accel + 0.5 * dt * k2[1],
        delayed_rudder_rad,
        params,
    );
    let k4 = nomoto2_derivatives(
        yaw_rate + dt * k3[0],
        yaw_accel + dt * k3[1],
        delayed_rudder_rad,
        params,
    );
    let new_yaw_rate = yaw_rate + dt * (k1[0] + 2.0 * k2[0] + 2.0 * k3[0] + k4[0]) / 6.0;
    let new_yaw_accel = yaw_accel + dt * (k1[1] + 2.0 * k2[1] + 2.0 * k3[1] + k4[1]) / 6.0;
    let new_heading = num(state, "headingRad", 0.0) + new_yaw_rate * dt;
    let speed = num(state, "speedMps", num(params, "speedMps", 9.8));
    serde_json::to_string(&json!({
        "headingRad": new_heading,
        "yawRateRad": new_yaw_rate,
        "yawRateDerivative": new_yaw_accel,
        "rudderDeg": rudder_deg,
        "positionX": num(state, "positionX", 0.0) + speed * new_heading.cos() * dt,
        "positionZ": num(state, "positionZ", 0.0) + speed * new_heading.sin() * dt,
        "speedMps": speed,
        "rudderHistory": history,
        "historyIndex": new_index
    }))
    .map_err(|error| error.to_string())
}

fn compute_nomoto_variable_mass(request: &Value) -> Result<String, String> {
    let dt = num(request, "dt", 0.0);
    if dt <= 0.0 || dt > 1.0 {
        return Err("dt must be in (0, 1].".to_string());
    }
    let state = &request["state"];
    let load_ratio = clamp(num(state, "loadRatio", 0.5), 0.0, 1.0);
    let rudder_deg = clamp(num(request, "rudderDeg", 0.0), -35.0, 35.0);
    let rudder_rad = deg_to_rad(rudder_deg);
    let current_k = num(state, "currentK", 0.08);
    let current_t = num(state, "currentT", 80.0).max(1e-6);
    let inertia = 5.0e10 + (1.5e11 - 5.0e10) * load_ratio;
    let external_accel = num(request, "externalMoment", 0.0) / inertia;
    let derivative =
        |yaw_rate: f64| (current_k * rudder_rad - yaw_rate) / current_t + external_accel;
    let r = num(state, "yawRateRad", 0.0);
    let k1 = derivative(r);
    let k2 = derivative(r + 0.5 * dt * k1);
    let k3 = derivative(r + 0.5 * dt * k2);
    let k4 = derivative(r + dt * k3);
    let new_yaw_rate = r + dt * (k1 + 2.0 * k2 + 2.0 * k3 + k4) / 6.0;
    let heading = num(state, "headingRad", 0.0);
    let speed = num(state, "speedMps", 10.3);
    let mut out: Map<String, Value> = state.as_object().cloned().unwrap_or_default();
    out.insert("headingRad".to_string(), json!(heading + r * dt));
    out.insert("yawRateRad".to_string(), json!(new_yaw_rate));
    out.insert("rudderDeg".to_string(), json!(rudder_deg));
    out.insert(
        "positionX".to_string(),
        json!(num(state, "positionX", 0.0) + speed * heading.cos() * dt),
    );
    out.insert(
        "positionZ".to_string(),
        json!(num(state, "positionZ", 0.0) + speed * heading.sin() * dt),
    );
    out.insert("speedMps".to_string(), json!(speed));
    serde_json::to_string(&Value::Object(out)).map_err(|error| error.to_string())
}

fn compute_container_roll(request: &Value) -> Result<String, String> {
    let dt = num(request, "dt", 0.0);
    if dt <= 0.0 || dt > 1.0 {
        return Err("dt must be in (0, 1].".to_string());
    }
    let state = &request["state"];
    let load_ratio = clamp(num(request, "loadRatio", 0.5), 0.0, 1.0);
    let inertia = (5.0e10 * 0.3) + ((1.5e11 * 0.3) - (5.0e10 * 0.3)) * load_ratio;
    let omega = 0.3;
    let zeta = 0.05;
    let k_roll = inertia * omega * omega;
    let b_roll = 2.0 * zeta * omega * inertia;
    let mass = 80_000_000.0 + (240_000_000.0 - 80_000_000.0) * load_ratio;
    let turn_excitation = num(request, "yawRateRad", 0.0) * 10.3 * mass * 0.001;
    let excitation = num(request, "windMoment", 0.0) * 0.5 + turn_excitation;
    let angle = num(state, "angle", 0.0);
    let rate = num(state, "rate", 0.0);
    let accel = (excitation - b_roll * rate - k_roll * angle) / inertia;
    serde_json::to_string(&json!({
        "angle": angle + rate * dt,
        "rate": rate + accel * dt
    }))
    .map_err(|error| error.to_string())
}

fn roll_coupled_heading_derivatives(
    yaw_rate: f64,
    yaw_accel: f64,
    rudder_rad: f64,
    params: &Value,
) -> [f64; 2] {
    let k = num(params, "K", 0.05);
    let t1 = num(params, "T1", 90.0).max(1e-6);
    let t2 = num(params, "T2", 25.0).max(1e-6);
    [
        yaw_accel,
        (k * rudder_rad - yaw_rate - (t1 + t2) * yaw_accel) / (t1 * t2),
    ]
}

fn roll_coupled_roll_derivatives(
    roll: f64,
    roll_rate: f64,
    wave: f64,
    fin: f64,
    turning: f64,
    params: &Value,
) -> [f64; 2] {
    let k_phi = num(params, "K_phi", 0.15);
    let t_phi1 = num(params, "T_phi1", 8.0).max(1e-6);
    let t_phi2 = num(params, "T_phi2", 2.0).max(1e-6);
    [
        roll_rate,
        (k_phi * (wave + turning - fin) - roll - (t_phi1 + t_phi2) * roll_rate) / (t_phi1 * t_phi2),
    ]
}

pub(crate) fn compute_roll_coupled_nomoto(request: &Value) -> Result<String, String> {
    let dt = num(request, "dt", 0.0);
    if dt <= 0.0 || dt > 1.0 {
        return Err("dt must be in (0, 1].".to_string());
    }
    let state = &request["state"];
    let params = &request["params"];
    let rudder_deg = clamp(
        num(request, "rudderDeg", 0.0),
        -num(params, "maxRudderDeg", 35.0),
        num(params, "maxRudderDeg", 35.0),
    );
    let rudder_rad = deg_to_rad(rudder_deg);
    let yaw_rate = num(state, "yawRateRad", 0.0);
    let yaw_accel = num(state, "yawAccelRad", 0.0);
    let hk1 = roll_coupled_heading_derivatives(yaw_rate, yaw_accel, rudder_rad, params);
    let hk2 = roll_coupled_heading_derivatives(
        yaw_rate + 0.5 * dt * hk1[0],
        yaw_accel + 0.5 * dt * hk1[1],
        rudder_rad,
        params,
    );
    let hk3 = roll_coupled_heading_derivatives(
        yaw_rate + 0.5 * dt * hk2[0],
        yaw_accel + 0.5 * dt * hk2[1],
        rudder_rad,
        params,
    );
    let hk4 = roll_coupled_heading_derivatives(
        yaw_rate + dt * hk3[0],
        yaw_accel + dt * hk3[1],
        rudder_rad,
        params,
    );
    let new_yaw_rate = yaw_rate + dt * (hk1[0] + 2.0 * hk2[0] + 2.0 * hk3[0] + hk4[0]) / 6.0;
    let new_yaw_accel = yaw_accel + dt * (hk1[1] + 2.0 * hk2[1] + 2.0 * hk3[1] + hk4[1]) / 6.0;

    let wave = num(request, "waveExcitation", 0.0);
    let fin = num(request, "finMomentNormalized", 0.0);
    let turning = num(request, "turningExcitation", 0.0);
    let roll = num(state, "rollRad", 0.0);
    let roll_rate = num(state, "rollRateRad", 0.0);
    let rk1 = roll_coupled_roll_derivatives(roll, roll_rate, wave, fin, turning, params);
    let rk2 = roll_coupled_roll_derivatives(
        roll + 0.5 * dt * rk1[0],
        roll_rate + 0.5 * dt * rk1[1],
        wave,
        fin,
        turning,
        params,
    );
    let rk3 = roll_coupled_roll_derivatives(
        roll + 0.5 * dt * rk2[0],
        roll_rate + 0.5 * dt * rk2[1],
        wave,
        fin,
        turning,
        params,
    );
    let rk4 = roll_coupled_roll_derivatives(
        roll + dt * rk3[0],
        roll_rate + dt * rk3[1],
        wave,
        fin,
        turning,
        params,
    );
    let new_roll = roll + dt * (rk1[0] + 2.0 * rk2[0] + 2.0 * rk3[0] + rk4[0]) / 6.0;
    let new_roll_rate = roll_rate + dt * (rk1[1] + 2.0 * rk2[1] + 2.0 * rk3[1] + rk4[1]) / 6.0;
    let new_heading = num(state, "headingRad", 0.0) + new_yaw_rate * dt;
    let speed = num(state, "speedMps", num(params, "speedMps", 9.3));
    serde_json::to_string(&json!({
        "headingRad": new_heading,
        "yawRateRad": new_yaw_rate,
        "yawAccelRad": new_yaw_accel,
        "rollRad": new_roll,
        "rollRateRad": new_roll_rate,
        "positionX": num(state, "positionX", 0.0) + speed * new_heading.cos() * dt,
        "positionZ": num(state, "positionZ", 0.0) + speed * new_heading.sin() * dt,
        "speedMps": speed,
        "rudderDeg": rudder_deg,
        "finAngleDeg": num(state, "finAngleDeg", 0.0)
    }))
    .map_err(|error| error.to_string())
}

fn compute_cruise_comfort_analysis(request: &Value) -> Result<String, String> {
    let objectives = &request["objectives"];
    let metrics = &request["metrics"];
    let comfort_score = clamp(
        100.0 - num(metrics, "msi", 0.0) * 1.5 - num(metrics, "overshoot", 0.0) * 0.6,
        0.0,
        100.0,
    );
    let performance_score = clamp(
        100.0 - num(metrics, "settlingTime", 0.0) * 1.1 - num(metrics, "overshoot", 0.0) * 0.5,
        0.0,
        100.0,
    );
    let energy_score = clamp(100.0 - num(metrics, "finPower", 0.0) * 0.08, 0.0, 100.0);

    let weight_sum = (num(objectives, "comfortWeight", 0.0)
        + num(objectives, "performanceWeight", 0.0)
        + num(objectives, "energyWeight", 0.0))
    .max(1.0);
    let comfort_weight = num(objectives, "comfortWeight", 0.0) / weight_sum;
    let performance_weight = num(objectives, "performanceWeight", 0.0) / weight_sum;
    let energy_weight = num(objectives, "energyWeight", 0.0) / weight_sum;
    let blended_score = round2(
        comfort_score * comfort_weight
            + performance_score * performance_weight
            + energy_score * energy_weight,
    );

    let pareto_front: Vec<Value> = (0..12)
        .map(|index| {
            let ratio = index as f64 / 11.0;
            json!({
                "comfort": round2(95.0 - ratio * 45.0 + (index as f64).sin() * 2.0),
                "performance": round2(60.0 + ratio * 35.0 - ((index as f64) * 0.6).cos() * 3.0)
            })
        })
        .collect();

    let mut advice = Vec::new();
    if comfort_score < 65.0 {
        advice.push("舒适度偏低：建议降低带宽或加强减摇策略。");
    }
    if performance_score < 65.0 {
        advice.push("性能偏弱：可适当提高 Kp 并控制超调。");
    }
    if energy_score < 60.0 {
        advice.push("能耗偏高：建议限制减摇鳍动作频率。");
    }
    if advice.is_empty() {
        advice.push("当前权衡较均衡，可继续微调提升 Pareto 前沿位置。");
    }

    serde_json::to_string(&json!({
        "objectiveScores": {
            "comfort": round2(comfort_score),
            "performance": round2(performance_score),
            "energy": round2(energy_score)
        },
        "blendedScore": blended_score,
        "paretoFront": pareto_front,
        "currentDesign": {
            "comfort": round2(comfort_score),
            "performance": round2(performance_score)
        },
        "advice": advice
    }))
    .map_err(|error| error.to_string())
}

fn deterministic_unit_sample(index: usize, salt: usize) -> f64 {
    let x = ((index as f64 + 1.0) * (salt as f64 + 3.0) * 12.9898).sin() * 43758.5453;
    x - x.floor()
}

fn compute_icebreaker_robust_analysis(request: &Value) -> Result<String, String> {
    let sample_count = num(request, "sampleCount", 80.0).round().clamp(20.0, 300.0) as usize;
    let [k_min, k_max] = nested_pair(request, "uncertaintyRange", "paramK", [0.9, 1.1]);
    let [t_min, t_max] = nested_pair(request, "uncertaintyRange", "paramT", [0.9, 1.1]);
    let scenarios = request
        .get("disturbanceScenarios")
        .and_then(Value::as_array)
        .ok_or_else(|| "disturbanceScenarios must be an array.".to_string())?;

    let mut scenario_results = Vec::new();
    for (scenario_index, scenario) in scenarios.iter().enumerate() {
        let intensity = num(scenario, "intensity", 1.0);
        let mut rejection_sum = 0.0;
        let mut margin_sum = 0.0;
        let mut sensitivity_sum = 0.0;

        for sample_index in 0..sample_count {
            let k = k_min
                + deterministic_unit_sample(sample_index, scenario_index + 1) * (k_max - k_min);
            let t = t_min
                + deterministic_unit_sample(sample_index, scenario_index + 7) * (t_max - t_min);
            let rejection = clamp(
                92.0 - intensity * 9.0 - (1.0 - k).abs() * 26.0 - (1.0 - t).abs() * 18.0,
                10.0,
                100.0,
            );
            let margin = clamp(58.0 - intensity * 6.0 - (1.0 - t).abs() * 28.0, 5.0, 80.0);
            let sensitivity = (1.0 - k).abs() * 100.0 + (1.0 - t).abs() * 100.0;

            rejection_sum += rejection;
            margin_sum += margin;
            sensitivity_sum += sensitivity;
        }

        scenario_results.push(json!({
            "name": scenario.get("name").and_then(Value::as_str).unwrap_or("未命名场景"),
            "intensity": intensity,
            "disturbanceRejection": round2(rejection_sum / sample_count as f64),
            "stabilityMargin": round2(margin_sum / sample_count as f64),
            "parameterSensitivity": round2(sensitivity_sum / sample_count as f64)
        }));
    }

    let count = (scenario_results.len() as f64).max(1.0);
    let aggregate_rejection = scenario_results
        .iter()
        .map(|item| num(item, "disturbanceRejection", 0.0))
        .sum::<f64>()
        / count;
    let aggregate_margin = scenario_results
        .iter()
        .map(|item| num(item, "stabilityMargin", 0.0))
        .sum::<f64>()
        / count;
    let aggregate_sensitivity = scenario_results
        .iter()
        .map(|item| num(item, "parameterSensitivity", 0.0))
        .sum::<f64>()
        / count;
    let recommendation = if aggregate_margin < 25.0 {
        "稳定裕度偏低，建议提高阻尼并放缓高频控制动作。"
    } else if aggregate_sensitivity > 45.0 {
        "参数敏感性偏高，建议收缩增益并增加鲁棒补偿。"
    } else {
        "鲁棒性表现良好，可继续进行局部精调优化。"
    };

    serde_json::to_string(&json!({
        "robustnessMetrics": {
            "disturbanceRejection": round2(aggregate_rejection),
            "stabilityMargin": round2(aggregate_margin),
            "parameterSensitivity": round2(aggregate_sensitivity)
        },
        "scenarioResults": scenario_results,
        "recommendation": recommendation
    }))
    .map_err(|error| error.to_string())
}

#[derive(Clone, Copy)]
struct QuickPoint {
    x: f64,
    z: f64,
}

fn cross_track_error(x: f64, z: f64, guide_path: &[QuickPoint]) -> f64 {
    if guide_path.len() < 2 {
        return 0.0;
    }
    let mut min_dist_sq = f64::INFINITY;
    for segment in guide_path.windows(2) {
        let p1 = segment[0];
        let p2 = segment[1];
        let vx = p2.x - p1.x;
        let vz = p2.z - p1.z;
        let wx = x - p1.x;
        let wz = z - p1.z;
        let c1 = wx * vx + wz * vz;
        let c2 = vx * vx + vz * vz;
        let dist_sq = if c1 <= 0.0 {
            (x - p1.x).powi(2) + (z - p1.z).powi(2)
        } else if c2 <= c1 || c2 <= 1e-9 {
            (x - p2.x).powi(2) + (z - p2.z).powi(2)
        } else {
            let b = c1 / c2;
            let px = p1.x + vx * b;
            let pz = p1.z + vz * b;
            (x - px).powi(2) + (z - pz).powi(2)
        };
        min_dist_sq = min_dist_sq.min(dist_sq);
    }
    min_dist_sq.sqrt()
}

fn scheduled_heading(request: &Value, sim_time: f64, target_heading: f64, target_switch_time: f64) -> f64 {
    let Some(points) = request.get("headingSchedule").and_then(Value::as_array) else {
        return if sim_time < target_switch_time { 0.0 } else { target_heading };
    };
    let Some(first_point) = points.first() else {
        return if sim_time < target_switch_time { 0.0 } else { target_heading };
    };

    let mut previous_time = num(first_point, "time", 0.0);
    let mut previous_heading = num(first_point, "headingDeg", 0.0);
    if sim_time <= previous_time {
        return previous_heading;
    }

    for point in points.iter().skip(1) {
        let point_time = num(point, "time", previous_time);
        let point_heading = num(point, "headingDeg", previous_heading);
        if sim_time <= point_time {
            let span = point_time - previous_time;
            let progress = if span > 1e-9 {
                ((sim_time - previous_time) / span).clamp(0.0, 1.0)
            } else {
                1.0
            };
            return previous_heading + (point_heading - previous_heading) * progress;
        }
        previous_time = point_time;
        previous_heading = point_heading;
    }

    previous_heading
}

fn compute_nomoto_quick_sim(request: &Value) -> Result<String, String> {
    let dt = num(request, "dt", 0.5);
    if dt <= 0.0 || dt > 1.0 {
        return Err("dt must be in (0, 1].".to_string());
    }
    let duration = num(request, "duration", 120.0).clamp(dt, 600.0);
    let start = &request["start"];
    let pid = &request["pid"];
    let nomoto = &request["nomoto"];
    let speed = num(nomoto, "speedMps", 15.0);
    let max_rudder = num(nomoto, "maxRudderDeg", 35.0);
    let k = num(nomoto, "K", 0.08);
    let t_nomoto = num(nomoto, "T", 55.0).max(1e-6);
    let target_heading = num(request, "targetHeadingDeg", 90.0);
    let target_switch_time = num(request, "targetSwitchTime", 60.0);
    let max_rudder_rate_limit = num(nomoto, "maxRudderRateDegPerSec", 0.0);

    let guide_path: Vec<QuickPoint> = request
        .get("guidePath")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .map(|item| QuickPoint {
                    x: num(item, "x", 0.0),
                    z: num(item, "z", 0.0),
                })
                .collect()
        })
        .unwrap_or_default();

    let mut heading = deg_to_rad(num(start, "headingDeg", 0.0));
    let mut yaw_rate = 0.0;
    let mut x = num(start, "x", 0.0);
    let mut z = num(start, "z", 0.0);
    let mut integral = 0.0;
    let mut prev_error = 0.0;
    let mut prev_rudder = 0.0;
    let mut max_observed_rudder_rate: f64 = 0.0;
    let mut total_error = 0.0;
    let mut error_count = 0.0;
    let integral_limit = if num(pid, "ki", 0.0).abs() > 1e-9 {
        deg_to_rad(max_rudder) / num(pid, "ki", 0.0).abs()
    } else {
        f64::INFINITY
    };

    let mut times = Vec::new();
    let mut desired_headings = Vec::new();
    let mut actual_headings = Vec::new();
    let mut speeds = Vec::new();
    let mut rudders = Vec::new();
    let mut trajectory = Vec::new();

    let mut sim_time = 0.0;
    while sim_time <= duration + 1e-9 {
        let desired = scheduled_heading(request, sim_time, target_heading, target_switch_time);
        let current_heading = normalize_heading_deg(rad_to_deg(heading));
        let error_rad = deg_to_rad(angle_delta_deg(desired, current_heading));
        integral = clamp(integral + error_rad * dt, -integral_limit, integral_limit);
        let derivative = (error_rad - prev_error) / dt;
        let output_rad = num(pid, "kp", 0.0) * error_rad
            + num(pid, "ki", 0.0) * integral
            + num(pid, "kd", 0.0) * derivative;
        let commanded_rudder = clamp(rad_to_deg(output_rad), -max_rudder, max_rudder);
        let rudder = if max_rudder_rate_limit > 0.0 {
            let max_delta = max_rudder_rate_limit * dt;
            clamp(commanded_rudder, prev_rudder - max_delta, prev_rudder + max_delta)
        } else {
            commanded_rudder
        };
        prev_error = error_rad;

        let rudder_rad = deg_to_rad(rudder);
        let yaw_accel = (k * rudder_rad - yaw_rate) / t_nomoto;
        yaw_rate += yaw_accel * dt;
        heading += yaw_rate * dt;
        x += speed * heading.cos() * dt;
        z += speed * heading.sin() * dt;

        total_error += cross_track_error(x, z, &guide_path);
        error_count += 1.0;
        max_observed_rudder_rate = max_observed_rudder_rate.max((rudder - prev_rudder).abs() / dt);
        prev_rudder = rudder;

        times.push(round2(sim_time));
        desired_headings.push(normalize_signed_heading_deg(desired));
        actual_headings.push(normalize_signed_heading_deg(current_heading));
        speeds.push(speed);
        rudders.push(rudder);
        trajectory.push(json!({
            "time": round2(sim_time),
            "x": x,
            "z": z,
            "heading": current_heading,
            "rudder": rudder
        }));

        sim_time += dt;
    }

    serde_json::to_string(&json!({
        "trajectory": trajectory,
        "chartData": {
            "time": times,
            "desiredHeading": desired_headings,
            "actualHeading": actual_headings,
            "speed": speeds,
            "rudder": rudders
        },
        "metrics": {
            "avgError": if error_count > 0.0 { total_error / error_count } else { 0.0 },
            "maxRudderRate": max_observed_rudder_rate
        }
    }))
    .map_err(|error| error.to_string())
}

#[derive(Clone, Copy)]
struct MmgState {
    x: f64,
    y: f64,
    psi: f64,
    u: f64,
    v: f64,
    r: f64,
    rudder: f64,
}

#[derive(Clone, Copy)]
struct MmgDerivatives {
    dx: f64,
    dy: f64,
    dpsi: f64,
    du: f64,
    dv: f64,
    dr: f64,
}

/// `thruster`: 可选直接执行器输入（#1944 方案 A）——[surge N, sway N, yaw N·m]，
/// 由 DP 四通道输出换算而来，与螺旋桨推力（rpm 路径）互斥使用；缺省 [0;3]
/// 保持既有纯 rpm 行为。
fn mmg_forces(
    state: MmgState,
    params: &Value,
    length: f64,
    draft: f64,
    disturbance: &Value,
    disturbance_in_world: bool,
    rpm: f64,
    thruster: [f64; 3],
) -> [f64; 3] {
    let speed = (state.u * state.u + state.v * state.v).sqrt().max(0.001);
    let vp = state.v / speed;
    let rp = state.r * length / speed;
    let q = 0.5 * RHO * length * draft * speed * speed;
    let hydro = &params["hydro"];
    let xh = q
        * (num(hydro, "Xuu", -0.022) * (state.u / speed).powi(2)
            + num(hydro, "Xvv", -0.04) * vp.powi(2)
            + num(hydro, "Xrr", 0.002) * rp.powi(2)
            + num(hydro, "Xvr", 0.002) * vp * rp);
    let yh = q
        * (num(hydro, "Yv", -0.315) * vp
            + num(hydro, "Yr", 0.083) * rp
            + num(hydro, "Yvvv", -1.607) * vp.powi(3)
            + num(hydro, "Yrrr", 0.008) * rp.powi(3)
            + num(hydro, "Yvvr", 0.379) * vp * vp * rp
            + num(hydro, "Yvrr", -0.391) * vp * rp * rp);
    let nh = q
        * length
        * (num(hydro, "Nv", -0.137) * vp
            + num(hydro, "Nr", -0.049) * rp
            + num(hydro, "Nvvv", -0.03) * vp.powi(3)
            + num(hydro, "Nrrr", -0.013) * rp.powi(3)
            + num(hydro, "Nvvr", -0.294) * vp * vp * rp
            + num(hydro, "Nvrr", 0.055) * vp * rp * rp);

    let prop = &params["propeller"];
    let diameter = num(prop, "Dp", 4.5);
    let n = rpm / 60.0;
    let va = state.u * (1.0 - num(prop, "wp", 0.25));
    let j = if n > 0.1 { va / (n * diameter) } else { 0.0 };
    let kt = 0.4 - 0.3 * j;
    let thrust = kt * RHO * n * n * diameter.powi(4);
    let xp = (1.0 - num(prop, "tp", 0.15)) * thrust;

    let rudder = &params["rudder"];
    let x_r = num(rudder, "xR", -0.5 * length);
    let u_r = state.u;
    let v_r = state.v + x_r * state.r;
    let flow = (u_r * u_r + v_r * v_r).sqrt().max(0.001);
    let alpha = state.rudder - v_r.atan2(u_r);
    let area = length * 0.015;
    let lift = 0.5 * RHO * area * flow * flow * (2.0 * std::f64::consts::PI * alpha.sin());
    let normal = (1.0 + num(rudder, "aH", 0.3)) * lift;
    let xr = -normal * state.rudder.sin();
    let yr = -(1.0 - num(rudder, "tR", 0.4)) * normal * state.rudder.cos();
    let nr = -(x_r + num(rudder, "aH", 0.3) * length * 0.25) * normal * state.rudder.cos();

    // 扰动默认按船体系直接合成；调用方声明世界系（#1944 review）时先旋入船体
    // 坐标（与 practice_dp_control 前馈的世界系输入口径互补），力矩不变。
    let (dfx, dfy) = {
        let fx = num(disturbance, "forceX", 0.0);
        let fy = num(disturbance, "forceY", 0.0);
        if disturbance_in_world {
            (
                state.psi.cos() * fx + state.psi.sin() * fy,
                -state.psi.sin() * fx + state.psi.cos() * fy,
            )
        } else {
            (fx, fy)
        }
    };
    [
        xh + xp + xr + thruster[0] + dfx,
        yh + yr + thruster[1] + dfy,
        nh + nr + thruster[2] + num(disturbance, "momentN", 0.0),
    ]
}

fn mmg_derivatives(
    state: MmgState,
    params: &Value,
    length: f64,
    draft: f64,
    disturbance: &Value,
    disturbance_in_world: bool,
    rpm: f64,
    thruster: [f64; 3],
) -> MmgDerivatives {
    let [x_force, y_force, n_force] =
        mmg_forces(state, params, length, draft, disturbance, disturbance_in_world, rpm, thruster);
    let mass = path_num(params, &["massInertia", "m"], 17_000_000.0);
    let mx = mass * path_num(params, &["massInertia", "mx"], 0.05);
    let my = mass * path_num(params, &["massInertia", "my"], 0.9);
    let iz = path_num(params, &["massInertia", "Iz"], 2.5e9);
    let jz = iz * path_num(params, &["massInertia", "Jz"], 0.15);
    MmgDerivatives {
        du: (x_force + (mass + my) * state.v * state.r) / (mass + mx),
        dv: (y_force - (mass + mx) * state.u * state.r) / (mass + my),
        dr: n_force / (iz + jz),
        dx: state.u * state.psi.cos() - state.v * state.psi.sin(),
        dy: state.u * state.psi.sin() + state.v * state.psi.cos(),
        dpsi: state.r,
    }
}

fn add_mmg(state: MmgState, k: MmgDerivatives, scale: f64) -> MmgState {
    MmgState {
        x: state.x + k.dx * scale,
        y: state.y + k.dy * scale,
        psi: state.psi + k.dpsi * scale,
        u: state.u + k.du * scale,
        v: state.v + k.dv * scale,
        r: state.r + k.dr * scale,
        rudder: state.rudder,
    }
}

fn compute_mmg3dof(request: &Value) -> Result<String, String> {
    let dt = num(request, "dt", 0.0);
    if dt <= 0.0 || dt > 1.0 {
        return Err("dt must be in (0, 1].".to_string());
    }
    let state_value = &request["state"];
    let params = &request["params"];
    let length = num(request, "shipLength", 127.5);
    let draft = num(request, "shipDraft", 6.2);
    let disturbance = request.get("disturbance").unwrap_or(&Value::Null);
    let max_change = path_num(params, &["rudder", "maxRate"], 0.0436332313) * dt;
    let rudder_limit = path_num(params, &["rudder", "maxAngle"], 0.6108652382);
    let target_rudder = clamp(
        num(request, "rudderCommand", 0.0),
        -rudder_limit,
        rudder_limit,
    );
    let current_rudder = num(state_value, "rudderAngle", 0.0);
    let rudder = current_rudder + clamp(target_rudder - current_rudder, -max_change, max_change);
    let rpm = num(request, "propellerRPM", 80.0);
    let disturbance_in_world = request
        .get("disturbanceInWorld")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    // #1944：可选推力输入按 kN/kN·m 契约传入，这里唯一一次 ×1000 换算为 N。
    let thruster = [
        num(request, "surgeThrustKN", 0.0) * 1000.0,
        num(request, "swayThrustKN", 0.0) * 1000.0,
        num(request, "yawMomentKNm", 0.0) * 1000.0,
    ];
    let base = MmgState {
        x: num(state_value, "x", 0.0),
        y: num(state_value, "y", 0.0),
        psi: num(state_value, "psi", 0.0),
        u: num(state_value, "u", 0.0),
        v: num(state_value, "v", 0.0),
        r: num(state_value, "r", 0.0),
        rudder,
    };
    let k1 = mmg_derivatives(base, params, length, draft, disturbance, disturbance_in_world, rpm, thruster);
    let k2 = mmg_derivatives(add_mmg(base, k1, 0.5 * dt), params, length, draft, disturbance, disturbance_in_world, rpm, thruster);
    let k3 = mmg_derivatives(add_mmg(base, k2, 0.5 * dt), params, length, draft, disturbance, disturbance_in_world, rpm, thruster);
    let k4 = mmg_derivatives(add_mmg(base, k3, dt), params, length, draft, disturbance, disturbance_in_world, rpm, thruster);
    serde_json::to_string(&json!({
        "x": base.x + dt * (k1.dx + 2.0 * k2.dx + 2.0 * k3.dx + k4.dx) / 6.0,
        "y": base.y + dt * (k1.dy + 2.0 * k2.dy + 2.0 * k3.dy + k4.dy) / 6.0,
        "psi": base.psi + dt * (k1.dpsi + 2.0 * k2.dpsi + 2.0 * k3.dpsi + k4.dpsi) / 6.0,
        "u": base.u + dt * (k1.du + 2.0 * k2.du + 2.0 * k3.du + k4.du) / 6.0,
        "v": base.v + dt * (k1.dv + 2.0 * k2.dv + 2.0 * k3.dv + k4.dv) / 6.0,
        "r": base.r + dt * (k1.dr + 2.0 * k2.dr + 2.0 * k3.dr + k4.dr) / 6.0,
        "rudderAngle": rudder,
        "propellerRPM": rpm
    }))
    .map_err(|error| error.to_string())
}

fn semisub_damping(u: f64, v: f64, r: f64) -> [f64; 3] {
    [-1.2e6 * u, -2.5e6 * v - 8.0e7 * r, -8.0e7 * v - 9.5e10 * r]
}

fn semisub_derivatives(
    _x: f64,
    _y: f64,
    psi: f64,
    u: f64,
    v: f64,
    r: f64,
    thrust: [f64; 3],
    env: [f64; 3],
) -> [f64; 6] {
    let mass = 55_000_000.0;
    let m11 = mass * 1.18;
    let m22 = mass * 1.92;
    let m33 = 2.8e10 * 1.24;
    let [du_damp, dv_damp, dr_damp] = semisub_damping(u, v, r);
    let u_dot = (thrust[0] * 1000.0 + env[0] + du_damp + m22 * v * r) / m11;
    let v_dot = (thrust[1] * 1000.0 + env[1] + dv_damp - m11 * u * r) / m22;
    let r_dot = (thrust[2] * 1000.0 + env[2] + dr_damp + (m11 - m22) * u * v) / m33;
    [
        u * psi.cos() - v * psi.sin(),
        u * psi.sin() + v * psi.cos(),
        r,
        u_dot,
        v_dot,
        r_dot,
    ]
}

fn compute_semisub3dof(request: &Value) -> Result<String, String> {
    let dt = num(request, "dt", 0.0);
    if dt <= 0.0 || dt > 1.0 {
        return Err("dt must be in (0, 1].".to_string());
    }
    let state = &request["state"];
    let thrust = arr3(request, "thrusterForce");
    let env = arr3(request, "envForce");
    let (x, y, psi, u, v, r) = (
        num(state, "x", 0.0),
        num(state, "y", 0.0),
        num(state, "psi", 0.0),
        num(state, "u", 0.0),
        num(state, "v", 0.0),
        num(state, "r", 0.0),
    );
    let k1 = semisub_derivatives(x, y, psi, u, v, r, thrust, env);
    let k2 = semisub_derivatives(
        x + 0.5 * dt * k1[0],
        y + 0.5 * dt * k1[1],
        psi + 0.5 * dt * k1[2],
        u + 0.5 * dt * k1[3],
        v + 0.5 * dt * k1[4],
        r + 0.5 * dt * k1[5],
        thrust,
        env,
    );
    let k3 = semisub_derivatives(
        x + 0.5 * dt * k2[0],
        y + 0.5 * dt * k2[1],
        psi + 0.5 * dt * k2[2],
        u + 0.5 * dt * k2[3],
        v + 0.5 * dt * k2[4],
        r + 0.5 * dt * k2[5],
        thrust,
        env,
    );
    let k4 = semisub_derivatives(
        x + dt * k3[0],
        y + dt * k3[1],
        psi + dt * k3[2],
        u + dt * k3[3],
        v + dt * k3[4],
        r + dt * k3[5],
        thrust,
        env,
    );
    let new_x = x + dt * (k1[0] + 2.0 * k2[0] + 2.0 * k3[0] + k4[0]) / 6.0;
    let new_y = y + dt * (k1[1] + 2.0 * k2[1] + 2.0 * k3[1] + k4[1]) / 6.0;
    let new_psi = wrap_pi(psi + dt * (k1[2] + 2.0 * k2[2] + 2.0 * k3[2] + k4[2]) / 6.0);
    let target_x = num(state, "targetX", 0.0);
    let target_y = num(state, "targetY", 0.0);
    let target_psi = num(state, "targetPsi", 0.0);
    let mut out: Map<String, Value> = state.as_object().cloned().unwrap_or_default();
    out.insert("x".to_string(), json!(new_x));
    out.insert("y".to_string(), json!(new_y));
    out.insert("psi".to_string(), json!(new_psi));
    out.insert(
        "u".to_string(),
        json!(clamp(
            u + dt * (k1[3] + 2.0 * k2[3] + 2.0 * k3[3] + k4[3]) / 6.0,
            -2.0,
            2.0
        )),
    );
    out.insert(
        "v".to_string(),
        json!(clamp(
            v + dt * (k1[4] + 2.0 * k2[4] + 2.0 * k3[4] + k4[4]) / 6.0,
            -2.0,
            2.0
        )),
    );
    out.insert(
        "r".to_string(),
        json!(clamp(
            r + dt * (k1[5] + 2.0 * k2[5] + 2.0 * k3[5] + k4[5]) / 6.0,
            -0.1,
            0.1
        )),
    );
    out.insert(
        "positionError".to_string(),
        json!(((new_x - target_x).powi(2) + (new_y - target_y).powi(2)).sqrt()),
    );
    out.insert(
        "headingError".to_string(),
        json!(wrap_pi(new_psi - target_psi).abs() * 180.0 / std::f64::consts::PI),
    );
    serde_json::to_string(&Value::Object(out)).map_err(|error| error.to_string())
}

fn azipod_step_one(azipod: &Value, config: &Value, dt: f64) -> Value {
    let enabled = azipod
        .get("enabled")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    if !enabled {
        let mut out = azipod.as_object().cloned().unwrap_or_default();
        out.insert("thrust".to_string(), json!(0.0));
        out.insert("power".to_string(), json!(0.0));
        return Value::Object(out);
    }
    let max_slew = num(config, "maxSlewRate", 0.2094395102);
    let azimuth = num(azipod, "azimuth", 0.0);
    let desired_slew = clamp(
        (num(azipod, "azimuthCmd", 0.0) - azimuth) / dt,
        -max_slew,
        max_slew,
    );
    let new_azimuth = wrap_pi(azimuth + desired_slew * dt);
    let max_thrust = num(config, "maxThrust", 7_500_000.0);
    let time_constant = 2.0;
    let alpha = dt / (time_constant + dt);
    let thrust = clamp(
        num(azipod, "thrust", 0.0)
            + alpha * (num(azipod, "thrustCmd", 0.0) - num(azipod, "thrust", 0.0)),
        0.0,
        max_thrust,
    );
    let max_power = num(config, "maxPower", 7_500_000.0);
    let mut out = azipod.as_object().cloned().unwrap_or_default();
    out.insert("azimuth".to_string(), json!(new_azimuth));
    out.insert("slewRate".to_string(), json!(desired_slew));
    out.insert("thrust".to_string(), json!(thrust));
    out.insert(
        "power".to_string(),
        json!((thrust / max_thrust).powf(1.5) * max_power),
    );
    Value::Object(out)
}

fn azipod_forces(azipod: &Value, config: &Value) -> [f64; 3] {
    let thrust = num(azipod, "thrust", 0.0);
    let alpha = num(azipod, "azimuth", 0.0);
    let fx = thrust * alpha.cos();
    let fy = thrust * alpha.sin();
    [
        fx,
        fy,
        -num(config, "positionX", -55.0) * fy + num(config, "positionY", 0.0) * fx,
    ]
}

fn azipod_derivatives(
    psi: f64,
    u: f64,
    v: f64,
    r: f64,
    azipod1: &Value,
    azipod2: &Value,
    params: &Value,
    config1: &Value,
    config2: &Value,
    ice_resistance: f64,
) -> [f64; 6] {
    let f1 = azipod_forces(azipod1, config1);
    let f2 = azipod_forces(azipod2, config2);
    let mass = num(params, "mass", 13_990_000.0);
    let m11 = mass * (1.0 + num(params, "addedMassX", 0.08));
    let m22 = mass * (1.0 + num(params, "addedMassY", 0.65));
    let m33 = num(params, "inertiaZ", 5.25e10) * (1.0 + num(params, "addedInertiaZ", 0.16));
    let fx = f1[0] + f2[0] - num(params, "dampingU", 9.5e5) * u - ice_resistance;
    let fy = f1[1] + f2[1] - num(params, "dampingV", 2.8e6) * v;
    let mz = f1[2] + f2[2] - num(params, "dampingR", 8.5e10) * r;
    [
        u * psi.cos() - v * psi.sin(),
        u * psi.sin() + v * psi.cos(),
        r,
        (fx + m22 * v * r) / m11,
        (fy - m11 * u * r) / m22,
        mz / m33,
    ]
}

fn compute_azipod3dof(request: &Value) -> Result<String, String> {
    let dt = num(request, "dt", 0.0);
    if dt <= 0.0 || dt > 1.0 {
        return Err("dt must be in (0, 1].".to_string());
    }
    let state = &request["state"];
    let params = &request["params"];
    let config1 = params
        .get("azipods")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .unwrap_or(&state["azipod1"]);
    let config2 = params
        .get("azipods")
        .and_then(Value::as_array)
        .and_then(|items| items.get(1))
        .unwrap_or(&state["azipod2"]);
    let azipod1 = azipod_step_one(&state["azipod1"], config1, dt);
    let azipod2 = azipod_step_one(&state["azipod2"], config2, dt);
    let x = num(state, "x", 0.0);
    let y = num(state, "y", 0.0);
    let psi = num(state, "psi", 0.0);
    let u = num(state, "u", 0.0);
    let v = num(state, "v", 0.0);
    let r = num(state, "r", 0.0);
    let ice_resistance = num(request, "iceResistance", 0.0);
    let k1 = azipod_derivatives(
        psi,
        u,
        v,
        r,
        &azipod1,
        &azipod2,
        params,
        config1,
        config2,
        ice_resistance,
    );
    let k2 = azipod_derivatives(
        psi + 0.5 * dt * k1[2],
        u + 0.5 * dt * k1[3],
        v + 0.5 * dt * k1[4],
        r + 0.5 * dt * k1[5],
        &azipod1,
        &azipod2,
        params,
        config1,
        config2,
        ice_resistance,
    );
    let k3 = azipod_derivatives(
        psi + 0.5 * dt * k2[2],
        u + 0.5 * dt * k2[3],
        v + 0.5 * dt * k2[4],
        r + 0.5 * dt * k2[5],
        &azipod1,
        &azipod2,
        params,
        config1,
        config2,
        ice_resistance,
    );
    let k4 = azipod_derivatives(
        psi + dt * k3[2],
        u + dt * k3[3],
        v + dt * k3[4],
        r + dt * k3[5],
        &azipod1,
        &azipod2,
        params,
        config1,
        config2,
        ice_resistance,
    );
    let mut out = state.as_object().cloned().unwrap_or_default();
    out.insert(
        "x".to_string(),
        json!(x + dt * (k1[0] + 2.0 * k2[0] + 2.0 * k3[0] + k4[0]) / 6.0),
    );
    out.insert(
        "y".to_string(),
        json!(y + dt * (k1[1] + 2.0 * k2[1] + 2.0 * k3[1] + k4[1]) / 6.0),
    );
    out.insert(
        "psi".to_string(),
        json!(wrap_pi(
            psi + dt * (k1[2] + 2.0 * k2[2] + 2.0 * k3[2] + k4[2]) / 6.0
        )),
    );
    out.insert(
        "u".to_string(),
        json!(u + dt * (k1[3] + 2.0 * k2[3] + 2.0 * k3[3] + k4[3]) / 6.0),
    );
    out.insert(
        "v".to_string(),
        json!(v + dt * (k1[4] + 2.0 * k2[4] + 2.0 * k3[4] + k4[4]) / 6.0),
    );
    out.insert(
        "r".to_string(),
        json!(r + dt * (k1[5] + 2.0 * k2[5] + 2.0 * k3[5] + k4[5]) / 6.0),
    );
    out.insert("azipod1".to_string(), azipod1);
    out.insert("azipod2".to_string(), azipod2);
    out.insert("iceResistanceForce".to_string(), json!(ice_resistance));
    out.insert("time".to_string(), json!(num(state, "time", 0.0) + dt));
    serde_json::to_string(&Value::Object(out)).map_err(|error| error.to_string())
}

pub fn compute_virtual_simulation_step_json(request_json: &str) -> Result<String, String> {
    let request: Value = serde_json::from_str(request_json).map_err(|error| error.to_string())?;
    match request
        .get("modelId")
        .and_then(Value::as_str)
        .unwrap_or_default()
    {
        "destroyer_hifi" => {
            destroyer_hifi_runtime::compute_virtual_simulation_step_json(request_json)
        }
        "linear_pid_batch" => compute_linear_pid_batch(&request),
        "transfer_function_response" => compute_transfer_function_response(&request),
        "second_order_step_response" => compute_second_order_step_response(&request),
        "second_order_analytic_response" => compute_second_order_analytic_response(&request),
        "cruise_typhoon_step" => compute_cruise_typhoon_step(&request),
        "champagne_tower_step" => compute_champagne_tower_step(&request),
        "nomoto1st" => compute_nomoto1st(&request),
        "nomoto2nd_delay" => compute_nomoto2nd_delay(&request),
        "nomoto_variable_mass" => compute_nomoto_variable_mass(&request),
        "container_roll" => compute_container_roll(&request),
        "roll_coupled_nomoto" => compute_roll_coupled_nomoto(&request),
        "practice_cruise_live_step" => crate::practice_cruise_live::compute_practice_cruise_live_step(&request),
        model_id if model_id.starts_with("practice_") => {
            crate::practice_live::compute_practice_capability(model_id, &request)
        }
        "cruise_comfort_analysis" => compute_cruise_comfort_analysis(&request),
        "icebreaker_robust_analysis" => compute_icebreaker_robust_analysis(&request),
        "nomoto_quick_sim" => compute_nomoto_quick_sim(&request),
        "mmg3dof" => compute_mmg3dof(&request),
        "semisub3dof" => compute_semisub3dof(&request),
        "azipod3dof" => compute_azipod3dof(&request),
        "arena_cruise_roll_preview" => crate::arena_preview::compute_arena_cruise_roll_preview(&request),
        model_id => Err(format!("不支持的虚拟仿真模型: {model_id}")),
    }
}
