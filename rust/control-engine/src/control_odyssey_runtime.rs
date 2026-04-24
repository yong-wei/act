use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationStepRequest {
    model: SimulationModel,
    controller: SimulationController,
    state: SimulationState,
    input: SimulationInput,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SimulationModel {
    #[serde(rename = "type")]
    model_type: String,
    numerator: Vec<f64>,
    denominator: Vec<f64>,
    #[serde(default = "default_coefficient_order")]
    coefficient_order: String,
    #[serde(default)]
    delay: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SimulationController {
    mode: String,
    pid: PidConfig,
    speed_feedback: Option<SpeedFeedbackConfig>,
    feedforward: Option<FeedforwardConfig>,
    smith_predictor: Option<SmithPredictorConfig>,
    limits: Option<ControllerLimits>,
    control_rate: Option<f64>,
    setpoint_rate: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PidConfig {
    kp: f64,
    ki: f64,
    kd: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SpeedFeedbackConfig {
    enabled: bool,
    tau: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FeedforwardConfig {
    enabled: bool,
    gain: f64,
    base: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SmithPredictorConfig {
    enabled: bool,
    delay: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ControllerLimits {
    manual: Option<f64>,
    p: Option<f64>,
    i: Option<f64>,
    d: Option<f64>,
    vfb: Option<f64>,
    ff: Option<f64>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SimulationState {
    time: f64,
    base_offset: f64,
    base_y: f64,
    last_base_y: f64,
    plant_state: Vec<f64>,
    delay_buffer: Vec<f64>,
    integral: f64,
    prev_error: f64,
    speed_feedback_state: f64,
    predictor_no_delay_state: Vec<f64>,
    predictor_delay_state: Vec<f64>,
    predictor_delay_buffer: Vec<f64>,
    predictor_no_delay_y: f64,
    predictor_delay_y: f64,
    last_mode: Option<String>,
    y: f64,
    v: f64,
    u: f64,
    r: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SimulationInput {
    dt: f64,
    input_command: f64,
    #[serde(default)]
    disturbance: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SimulationStepResult {
    state: SimulationState,
    sample: SimulationSample,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SimulationSample {
    time: f64,
    reference: f64,
    output: f64,
    plant_output: f64,
    control: f64,
    error: f64,
    controller_terms: ControllerTerms,
    smith: SmithSample,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct ControllerTerms {
    p: f64,
    i: f64,
    d: f64,
    vfb: f64,
    ff: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SmithSample {
    enabled: bool,
    feedback_output: f64,
    no_delay_output: f64,
    delay_output: f64,
}

#[derive(Clone)]
struct DiscretePlant {
    a: Vec<Vec<f64>>,
    b: Vec<f64>,
    c: Vec<f64>,
    d: f64,
}

fn default_coefficient_order() -> String {
    "ascending".to_string()
}

pub fn compute_simulation_step_json(request_json: &str) -> Result<String, String> {
    let request: SimulationStepRequest =
        serde_json::from_str(request_json).map_err(|error| error.to_string())?;
    let result = compute_simulation_step_inner(request)?;
    serde_json::to_string(&result).map_err(|error| error.to_string())
}

fn compute_simulation_step_inner(
    request: SimulationStepRequest,
) -> Result<SimulationStepResult, String> {
    if request.model.model_type != "transferFunction" {
        return Err("control odyssey runtime only supports transferFunction models".to_string());
    }
    let dt = request.input.dt;
    if !dt.is_finite() || dt <= 0.0 {
        return Err("dt must be positive and finite".to_string());
    }

    let plant = discretize_transfer_function(&request.model, dt)?;
    let mut state = request.state;
    resize_state(&mut state.plant_state, plant.a.len());

    let mode = request.controller.mode.to_ascii_lowercase();
    if state.last_mode.as_deref() != Some(mode.as_str()) {
        state.integral = 0.0;
        state.prev_error = 0.0;
        if mode == "auto" {
            state.r = state.y;
        }
        state.last_mode = Some(mode.clone());
    }

    let limits = request.controller.limits.unwrap_or_default();
    let mut terms = ControllerTerms::default();
    let smith_enabled = mode == "auto"
        && request
            .controller
            .smith_predictor
            .as_ref()
            .map(|config| config.enabled)
            .unwrap_or(false);

    let feedback_tau = request
        .controller
        .speed_feedback
        .as_ref()
        .map(|config| config.tau)
        .unwrap_or(0.6);
    let feedback_alpha = if feedback_tau > 0.0 {
        (dt / (feedback_tau + dt)).min(1.0)
    } else {
        1.0
    };
    state.speed_feedback_state += (state.v - state.speed_feedback_state) * feedback_alpha;

    let feedback_y = if smith_enabled {
        state.predictor_no_delay_y + (state.y - state.predictor_delay_y)
    } else {
        state.y
    };
    let mut smith = SmithSample {
        enabled: smith_enabled,
        feedback_output: feedback_y,
        no_delay_output: state.predictor_no_delay_y,
        delay_output: state.predictor_delay_y,
    };

    if mode == "manual" {
        let rate = request.controller.control_rate.unwrap_or(1.5);
        let manual_limit = limits.manual.unwrap_or(1.0);
        state.u = clamp(
            state.u + request.input.input_command * rate * dt,
            -manual_limit,
            manual_limit,
        );
    } else {
        let setpoint_rate = request.controller.setpoint_rate.unwrap_or(120.0);
        state.r = clamp(
            state.r + request.input.input_command * setpoint_rate * dt,
            0.0,
            400.0,
        );
        let error = (state.r - feedback_y) / 200.0;
        let i_limit = limits.i.unwrap_or(0.0);
        let i_state_limit = if i_limit > 0.0 && request.controller.pid.ki.abs() > 0.0 {
            i_limit / request.controller.pid.ki.abs().max(0.0001)
        } else {
            0.0
        };
        state.integral = if i_state_limit > 0.0 {
            clamp(state.integral + error * dt, -i_state_limit, i_state_limit)
        } else {
            0.0
        };
        let derivative = (error - state.prev_error) / dt;
        state.prev_error = error;

        terms.p = limit_value(request.controller.pid.kp * error, limits.p);
        terms.i = limit_value(request.controller.pid.ki * state.integral, limits.i);
        terms.d = limit_value(request.controller.pid.kd * derivative, limits.d);
        let speed_feedback = request
            .controller
            .speed_feedback
            .as_ref()
            .filter(|config| config.enabled)
            .map(|_| -state.speed_feedback_state / 200.0)
            .unwrap_or(0.0);
        terms.vfb = limit_value(speed_feedback, limits.vfb);
        let feedforward = request
            .controller
            .feedforward
            .as_ref()
            .filter(|config| config.enabled)
            .map(|config| {
                let base = config.base.unwrap_or(200.0);
                (config.gain * (state.r - base)) / 200.0
            })
            .unwrap_or(0.0);
        terms.ff = limit_value(feedforward, limits.ff);
        state.u = terms.p + terms.i + terms.d + terms.vfb + terms.ff;
    }

    state.time += dt;
    let applied_u = push_delay(&mut state.delay_buffer, request.model.delay, dt, state.u);
    let plant_output = step_plant(&plant, &mut state.plant_state, applied_u);
    state.base_y = state.base_offset + plant_output;
    state.v = (state.base_y - state.last_base_y) / dt;
    state.last_base_y = state.base_y;
    state.y = state.base_y + request.input.disturbance;

    if smith_enabled {
        let no_delay_model = SimulationModel {
            delay: 0.0,
            ..request.model.clone()
        };
        let predictor_delay = request
            .controller
            .smith_predictor
            .as_ref()
            .map(|config| config.delay.max(0.0))
            .unwrap_or(0.0);
        let delay_model = SimulationModel {
            delay: predictor_delay,
            ..request.model.clone()
        };
        let no_delay_plant = discretize_transfer_function(&no_delay_model, dt)?;
        let delay_plant = discretize_transfer_function(&delay_model, dt)?;
        if state.predictor_no_delay_state.len() != no_delay_plant.a.len() {
            state.predictor_no_delay_state = state.plant_state.clone();
            state.predictor_no_delay_y = state.base_y;
        }
        if state.predictor_delay_state.len() != delay_plant.a.len() {
            state.predictor_delay_state = state.plant_state.clone();
            state.predictor_delay_y = state.base_y;
            state.predictor_delay_buffer.clear();
        }
        let no_delay_output = step_plant(
            &no_delay_plant,
            &mut state.predictor_no_delay_state,
            state.u,
        );
        let delayed_u = push_delay(
            &mut state.predictor_delay_buffer,
            predictor_delay,
            dt,
            state.u,
        );
        let delay_output = step_plant(&delay_plant, &mut state.predictor_delay_state, delayed_u);
        state.predictor_no_delay_y = state.base_offset + no_delay_output;
        state.predictor_delay_y = state.base_offset + delay_output;
        smith.no_delay_output = state.predictor_no_delay_y;
        smith.delay_output = state.predictor_delay_y;
    } else {
        state.predictor_no_delay_state = state.plant_state.clone();
        state.predictor_delay_state = state.plant_state.clone();
        state.predictor_delay_buffer.clear();
        state.predictor_no_delay_y = state.base_y;
        state.predictor_delay_y = state.base_y;
        smith.no_delay_output = state.base_y;
        smith.delay_output = state.base_y;
        smith.feedback_output = state.y;
    }

    let sample = SimulationSample {
        time: state.time,
        reference: state.r,
        output: state.y,
        plant_output: state.base_y,
        control: state.u,
        error: state.r - feedback_y,
        controller_terms: terms,
        smith,
    };
    Ok(SimulationStepResult { state, sample })
}

fn discretize_transfer_function(model: &SimulationModel, dt: f64) -> Result<DiscretePlant, String> {
    let mut numerator = model.numerator.clone();
    let mut denominator = model.denominator.clone();
    if model.coefficient_order == "descending" {
        numerator.reverse();
        denominator.reverse();
    }
    if denominator.is_empty() {
        return Err("denominator cannot be empty".to_string());
    }
    let leading = *denominator.last().unwrap_or(&1.0);
    if leading.abs() < 1e-12 {
        return Err("highest-order denominator coefficient cannot be zero".to_string());
    }
    for value in &mut numerator {
        *value /= leading;
    }
    for value in &mut denominator {
        *value /= leading;
    }
    let order = denominator.len().saturating_sub(1);
    if order == 0 {
        return Ok(DiscretePlant {
            a: vec![vec![0.0]],
            b: vec![1.0],
            c: vec![numerator.first().copied().unwrap_or(0.0)],
            d: 0.0,
        });
    }

    let mut a = vec![vec![0.0; order]; order];
    for i in 0..order.saturating_sub(1) {
        a[i][i + 1] = 1.0;
    }
    for i in 0..order {
        a[order - 1][i] = -denominator.get(i).copied().unwrap_or(0.0);
    }
    let mut b = vec![0.0; order];
    b[order - 1] = 1.0;
    let mut c = vec![0.0; order];
    for (i, value) in numerator.iter().take(order).enumerate() {
        c[i] = *value;
    }
    let d = if numerator.len() > order {
        numerator[order]
    } else {
        0.0
    };

    let identity = identity(order);
    let a_half = mat_scale(&a, dt / 2.0);
    let inv = invert(&mat_sub(&identity, &a_half))?;
    let ad = mat_mul(&inv, &mat_add(&identity, &a_half));
    let bd = mat_vec_mul(&inv, &b)
        .into_iter()
        .map(|value| value * dt)
        .collect::<Vec<_>>();
    let cd = vec_mat_mul(&c, &inv);
    let cd_b = dot(&cd, &b);
    let dd = d + cd_b * dt / 2.0;
    Ok(DiscretePlant {
        a: ad,
        b: bd,
        c: cd,
        d: dd,
    })
}

fn step_plant(plant: &DiscretePlant, state: &mut Vec<f64>, input: f64) -> f64 {
    resize_state(state, plant.a.len());
    let mut next = mat_vec_mul(&plant.a, state);
    for (value, b) in next.iter_mut().zip(plant.b.iter()) {
        *value += b * input;
    }
    *state = next;
    dot(&plant.c, state) + plant.d * input
}

fn push_delay(buffer: &mut Vec<f64>, delay: f64, dt: f64, value: f64) -> f64 {
    let steps = if delay > 0.0 {
        (delay / dt).round().max(1.0) as usize
    } else {
        0
    };
    if steps == 0 {
        buffer.clear();
        return value;
    }
    if buffer.len() != steps + 1 {
        *buffer = vec![0.0; steps + 1];
    }
    buffer.push(value);
    buffer.remove(0)
}

fn resize_state(state: &mut Vec<f64>, size: usize) {
    if state.len() < size {
        state.resize(size, 0.0);
    } else if state.len() > size {
        state.truncate(size);
    }
}

fn clamp(value: f64, min: f64, max: f64) -> f64 {
    value.min(max).max(min)
}

fn limit_value(value: f64, limit: Option<f64>) -> f64 {
    match limit {
        Some(bound) if bound > 0.0 => clamp(value, -bound, bound),
        _ => 0.0,
    }
}

fn identity(size: usize) -> Vec<Vec<f64>> {
    let mut matrix = vec![vec![0.0; size]; size];
    for (i, row) in matrix.iter_mut().enumerate() {
        row[i] = 1.0;
    }
    matrix
}

fn mat_add(a: &[Vec<f64>], b: &[Vec<f64>]) -> Vec<Vec<f64>> {
    a.iter()
        .zip(b.iter())
        .map(|(ar, br)| ar.iter().zip(br.iter()).map(|(av, bv)| av + bv).collect())
        .collect()
}

fn mat_sub(a: &[Vec<f64>], b: &[Vec<f64>]) -> Vec<Vec<f64>> {
    a.iter()
        .zip(b.iter())
        .map(|(ar, br)| ar.iter().zip(br.iter()).map(|(av, bv)| av - bv).collect())
        .collect()
}

fn mat_scale(a: &[Vec<f64>], scalar: f64) -> Vec<Vec<f64>> {
    a.iter()
        .map(|row| row.iter().map(|value| value * scalar).collect())
        .collect()
}

fn mat_mul(a: &[Vec<f64>], b: &[Vec<f64>]) -> Vec<Vec<f64>> {
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

fn mat_vec_mul(a: &[Vec<f64>], x: &[f64]) -> Vec<f64> {
    a.iter().map(|row| dot(row, x)).collect()
}

fn vec_mat_mul(x: &[f64], a: &[Vec<f64>]) -> Vec<f64> {
    let cols = a.first().map(|row| row.len()).unwrap_or(0);
    (0..cols)
        .map(|j| x.iter().enumerate().map(|(i, value)| value * a[i][j]).sum())
        .collect()
}

fn dot(a: &[f64], b: &[f64]) -> f64 {
    a.iter().zip(b.iter()).map(|(av, bv)| av * bv).sum()
}

fn invert(matrix: &[Vec<f64>]) -> Result<Vec<Vec<f64>>, String> {
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
    Ok(augmented.into_iter().map(|row| row[n..].to_vec()).collect())
}
