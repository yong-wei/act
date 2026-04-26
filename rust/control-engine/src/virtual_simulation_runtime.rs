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

fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
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

fn compute_roll_coupled_nomoto(request: &Value) -> Result<String, String> {
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
    let mut max_rudder_rate: f64 = 0.0;
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
        let desired = if sim_time < target_switch_time {
            0.0
        } else {
            target_heading
        };
        let current_heading = normalize_heading_deg(rad_to_deg(heading));
        let error_rad = deg_to_rad(angle_delta_deg(desired, current_heading));
        integral = clamp(integral + error_rad * dt, -integral_limit, integral_limit);
        let derivative = (error_rad - prev_error) / dt;
        let output_rad = num(pid, "kp", 0.0) * error_rad
            + num(pid, "ki", 0.0) * integral
            + num(pid, "kd", 0.0) * derivative;
        let rudder = clamp(rad_to_deg(output_rad), -max_rudder, max_rudder);
        prev_error = error_rad;

        let rudder_rad = deg_to_rad(rudder);
        let yaw_accel = (k * rudder_rad - yaw_rate) / t_nomoto;
        yaw_rate += yaw_accel * dt;
        heading += yaw_rate * dt;
        x += speed * heading.cos() * dt;
        z += speed * heading.sin() * dt;

        total_error += cross_track_error(x, z, &guide_path);
        error_count += 1.0;
        max_rudder_rate = max_rudder_rate.max((rudder - prev_rudder).abs() / dt);
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
            "maxRudderRate": max_rudder_rate
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

fn mmg_forces(
    state: MmgState,
    params: &Value,
    length: f64,
    draft: f64,
    disturbance: &Value,
    rpm: f64,
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

    [
        xh + xp + xr + num(disturbance, "forceX", 0.0),
        yh + yr + num(disturbance, "forceY", 0.0),
        nh + nr + num(disturbance, "momentN", 0.0),
    ]
}

fn mmg_derivatives(
    state: MmgState,
    params: &Value,
    length: f64,
    draft: f64,
    disturbance: &Value,
    rpm: f64,
) -> MmgDerivatives {
    let [x_force, y_force, n_force] = mmg_forces(state, params, length, draft, disturbance, rpm);
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
    let base = MmgState {
        x: num(state_value, "x", 0.0),
        y: num(state_value, "y", 0.0),
        psi: num(state_value, "psi", 0.0),
        u: num(state_value, "u", 0.0),
        v: num(state_value, "v", 0.0),
        r: num(state_value, "r", 0.0),
        rudder,
    };
    let k1 = mmg_derivatives(base, params, length, draft, disturbance, rpm);
    let k2 = mmg_derivatives(
        add_mmg(base, k1, 0.5 * dt),
        params,
        length,
        draft,
        disturbance,
        rpm,
    );
    let k3 = mmg_derivatives(
        add_mmg(base, k2, 0.5 * dt),
        params,
        length,
        draft,
        disturbance,
        rpm,
    );
    let k4 = mmg_derivatives(
        add_mmg(base, k3, dt),
        params,
        length,
        draft,
        disturbance,
        rpm,
    );
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
        "nomoto1st" => compute_nomoto1st(&request),
        "nomoto2nd_delay" => compute_nomoto2nd_delay(&request),
        "nomoto_variable_mass" => compute_nomoto_variable_mass(&request),
        "container_roll" => compute_container_roll(&request),
        "roll_coupled_nomoto" => compute_roll_coupled_nomoto(&request),
        "cruise_comfort_analysis" => compute_cruise_comfort_analysis(&request),
        "icebreaker_robust_analysis" => compute_icebreaker_robust_analysis(&request),
        "nomoto_quick_sim" => compute_nomoto_quick_sim(&request),
        "mmg3dof" => compute_mmg3dof(&request),
        "semisub3dof" => compute_semisub3dof(&request),
        "azipod3dof" => compute_azipod3dof(&request),
        model_id => Err(format!("不支持的虚拟仿真模型: {model_id}")),
    }
}
