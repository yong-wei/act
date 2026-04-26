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
        "mmg3dof" => compute_mmg3dof(&request),
        "semisub3dof" => compute_semisub3dof(&request),
        "azipod3dof" => compute_azipod3dof(&request),
        model_id => Err(format!("不支持的虚拟仿真模型: {model_id}")),
    }
}
