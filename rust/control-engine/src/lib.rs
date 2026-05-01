use num_complex::Complex64;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

pub mod control_odyssey_runtime;
pub mod destroyer_hifi;
pub mod destroyer_hifi_runtime;
pub mod virtual_simulation_runtime;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TransferFunctionSpec {
    numerator: Vec<f64>,
    denominator: Vec<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StructureSpec {
    kind: String,
    enabled: bool,
    params: HashMap<String, f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TimeRangeConfig {
    start: f64,
    end: f64,
    samples: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FrequencyRangeConfig {
    min: f64,
    max: f64,
    samples: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RootLocusConfig {
    min_gain: f64,
    max_gain: f64,
    samples: usize,
    current_gain: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct FeasibleRegionConfig {
    zeta_min: f64,
    sigma_min: f64,
    mp_ratio: Option<f64>,
    settling_time: Option<f64>,
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum ResponseType {
    Step,
    Impulse,
    Ramp,
}

fn default_response_type() -> ResponseType {
    ResponseType::Step
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ControlAnalysisRequest {
    runtime_mode: String,
    #[serde(rename = "caseId")]
    _case_id: Option<String>,
    plant: TransferFunctionSpec,
    structures: Vec<StructureSpec>,
    outputs: Vec<String>,
    #[serde(default = "default_response_type")]
    response_type: ResponseType,
    time_range: TimeRangeConfig,
    frequency_range: FrequencyRangeConfig,
    root_locus: RootLocusConfig,
    feasible_region: Option<FeasibleRegionConfig>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CurvePoint {
    x: f64,
    y: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ComplexPoint {
    re: f64,
    im: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RootLocusSamplePoint {
    re: f64,
    im: f64,
    gain: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ControlMetrics {
    overshoot_pct: f64,
    rise_time_sec: Option<f64>,
    settling_time_sec: Option<f64>,
    peak_time_sec: Option<f64>,
    final_value: f64,
    phase_margin_deg: Option<f64>,
    gain_margin_db: Option<f64>,
    gain_crossover_rad_per_sec: Option<f64>,
    phase_crossover_rad_per_sec: Option<f64>,
    bandwidth_rad_per_sec: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StepResponseData {
    points: Vec<CurvePoint>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BodeAxisData {
    points: Vec<CurvePoint>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NyquistData {
    points: Vec<ComplexPoint>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RootLocusData {
    branches: Vec<Vec<RootLocusSamplePoint>>,
    current_poles: Vec<ComplexPoint>,
    open_loop_poles: Vec<ComplexPoint>,
    open_loop_zeros: Vec<ComplexPoint>,
    feasible_region: Option<FeasibleRegionConfig>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ControlAnalysisResult {
    metrics: ControlMetrics,
    step_response: StepResponseData,
    magnitude: BodeAxisData,
    phase: BodeAxisData,
    nyquist: NyquistData,
    root_locus: RootLocusData,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NonlinearAnalysisRequest {
    runtime_mode: String,
    analysis_kind: String,
    model_id: String,
    parameters: Option<HashMap<String, serde_json::Value>>,
    initial_point: Option<Vec<f64>>,
    time_range: TimeRangeConfig,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VectorFieldPoint {
    x: f64,
    y: f64,
    dx: f64,
    dy: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NamedCurve {
    id: String,
    points: Vec<CurvePoint>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PhasePlaneResult {
    vector_field: Vec<VectorFieldPoint>,
    trajectories: Vec<NamedCurve>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NegativeInverseCurve {
    id: String,
    label: String,
    points: Vec<ComplexPoint>,
    marks: HashMap<String, String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NegativeInverseResult {
    curves: Vec<NegativeInverseCurve>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HarmonicResult {
    input: Vec<CurvePoint>,
    relay_output: Vec<CurvePoint>,
    filtered_output: Vec<CurvePoint>,
    describing_function_approximation: Vec<CurvePoint>,
    spectrum: Vec<CurvePoint>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CharacteristicResult {
    curve: Vec<CurvePoint>,
    sine_envelope: Vec<CurvePoint>,
    describing_function: ComplexPoint,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NonlinearSummary {
    outcome: String,
    metrics: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NonlinearAnalysisResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    phase_plane: Option<PhasePlaneResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    negative_inverse: Option<NegativeInverseResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    harmonic: Option<HarmonicResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    characteristic: Option<CharacteristicResult>,
    summary: NonlinearSummary,
}

#[derive(Clone)]
struct TransferFunction {
    numerator: Vec<f64>,
    denominator: Vec<f64>,
}

fn trim_leading(mut values: Vec<f64>) -> Vec<f64> {
    while values.len() > 1 && values.first().map(|v| v.abs() < 1e-12).unwrap_or(false) {
        values.remove(0);
    }
    values
}

fn normalize_tf(tf: TransferFunction) -> TransferFunction {
    let numerator = trim_leading(tf.numerator);
    let denominator = trim_leading(tf.denominator);
    let lead = denominator[0];
    TransferFunction {
        numerator: numerator.iter().map(|v| v / lead).collect(),
        denominator: denominator.iter().map(|v| v / lead).collect(),
    }
}

fn convolve(a: &[f64], b: &[f64]) -> Vec<f64> {
    let mut output = vec![0.0; a.len() + b.len() - 1];
    for (i, av) in a.iter().enumerate() {
        for (j, bv) in b.iter().enumerate() {
            output[i + j] += av * bv;
        }
    }
    output
}

fn poly_add(a: &[f64], b: &[f64]) -> Vec<f64> {
    let width = a.len().max(b.len());
    let mut output = vec![0.0; width];
    for i in 0..width {
        let ai = if i >= width - a.len() {
            a[i - (width - a.len())]
        } else {
            0.0
        };
        let bi = if i >= width - b.len() {
            b[i - (width - b.len())]
        } else {
            0.0
        };
        output[i] = ai + bi;
    }
    trim_leading(output)
}

fn tf_mul(a: &TransferFunction, b: &TransferFunction) -> TransferFunction {
    normalize_tf(TransferFunction {
        numerator: convolve(&a.numerator, &b.numerator),
        denominator: convolve(&a.denominator, &b.denominator),
    })
}

fn tf_unity_feedback(loop_tf: &TransferFunction) -> TransferFunction {
    normalize_tf(TransferFunction {
        numerator: loop_tf.numerator.clone(),
        denominator: poly_add(&loop_tf.denominator, &loop_tf.numerator),
    })
}

fn eval_poly_complex(coeffs: &[f64], x: Complex64) -> Complex64 {
    coeffs.iter().fold(Complex64::new(0.0, 0.0), |acc, coeff| {
        acc * x + Complex64::new(*coeff, 0.0)
    })
}

fn compare_f64(left: f64, right: f64) -> Ordering {
    left.total_cmp(&right)
}

fn sort_complex_points(points: &mut [Complex64]) {
    points
        .sort_by(|left, right| compare_f64(left.re, right.re).then(compare_f64(left.im, right.im)));
}

fn poly_derivative(coeffs: &[f64]) -> Vec<f64> {
    if coeffs.len() <= 1 {
        return vec![0.0];
    }
    let degree = coeffs.len() - 1;
    coeffs
        .iter()
        .enumerate()
        .take(degree)
        .map(|(index, coeff)| coeff * (degree - index) as f64)
        .collect()
}

fn logspace(min: f64, max: f64, samples: usize) -> Vec<f64> {
    let start = min.log10();
    let end = max.log10();
    (0..samples)
        .map(|index| {
            let progress = index as f64 / (samples.saturating_sub(1).max(1)) as f64;
            10f64.powf(start + (end - start) * progress)
        })
        .collect()
}

fn linspace(start: f64, end: f64, samples: usize) -> Vec<f64> {
    (0..samples)
        .map(|index| {
            let progress = index as f64 / (samples.saturating_sub(1).max(1)) as f64;
            start + (end - start) * progress
        })
        .collect()
}

fn tf_from_structure(spec: &StructureSpec) -> TransferFunction {
    let get = |key: &str, fallback: f64| spec.params.get(key).copied().unwrap_or(fallback);
    match spec.kind.as_str() {
        "gain" => TransferFunction {
            numerator: vec![get("k", 1.0)],
            denominator: vec![1.0],
        },
        "p" => TransferFunction {
            numerator: vec![get("kp", get("k", 1.0))],
            denominator: vec![1.0],
        },
        "pi" => {
            let k = get("k", get("kp", 1.0));
            let ti = get("ti", 1.0);
            TransferFunction {
                numerator: vec![k * ti, k],
                denominator: vec![ti, 0.0],
            }
        }
        "pd" => {
            let k = get("k", get("kp", 1.0));
            let td = get("td", 1.0);
            TransferFunction {
                numerator: vec![k * td, k],
                denominator: vec![1.0],
            }
        }
        "pid" => {
            let has_direct_gains = spec.params.contains_key("kp")
                || spec.params.contains_key("ki")
                || spec.params.contains_key("kd")
                || spec.params.contains_key("tf");
            if has_direct_gains {
                let kp = get("kp", get("k", 1.0));
                let ki = get(
                    "ki",
                    if spec.params.contains_key("ti") {
                        kp / get("ti", 1.0).max(1e-9)
                    } else {
                        0.0
                    },
                );
                let kd = get(
                    "kd",
                    if spec.params.contains_key("td") {
                        kp * get("td", 0.0)
                    } else {
                        0.0
                    },
                );
                let tf = get("tf", 0.0);
                if tf > 0.0 {
                    TransferFunction {
                        numerator: vec![kp * tf + kd, kp + ki * tf, ki],
                        denominator: vec![tf, 1.0, 0.0],
                    }
                } else {
                    TransferFunction {
                        numerator: vec![kd, kp, ki],
                        denominator: vec![1.0, 0.0],
                    }
                }
            } else {
                let k = get("k", get("kp", 1.0));
                let ti = get("ti", 1.0);
                let td = get("td", 1.0);
                TransferFunction {
                    numerator: vec![k * td * ti, k * (td + ti), k],
                    denominator: vec![ti, 0.0],
                }
            }
        }
        "lead" => {
            let k = get("k", 1.0);
            let tau = get("tau", 1.0);
            let alpha = get("alpha", 0.2);
            TransferFunction {
                numerator: vec![k * tau, k],
                denominator: vec![alpha * tau, 1.0],
            }
        }
        "lag" => {
            let k = get("k", 1.0);
            let tau = get("tau", 1.0);
            let beta = get("beta", 4.0);
            TransferFunction {
                numerator: vec![k * tau, k],
                denominator: vec![beta * tau, 1.0],
            }
        }
        "lead_lag" => {
            let lead = TransferFunction {
                numerator: vec![get("k", 1.0) * get("tauLead", 1.0), get("k", 1.0)],
                denominator: vec![get("alphaLead", 0.2) * get("tauLead", 1.0), 1.0],
            };
            let lag = TransferFunction {
                numerator: vec![get("tauLag", 1.0), 1.0],
                denominator: vec![get("betaLag", 4.0) * get("tauLag", 1.0), 1.0],
            };
            tf_mul(&lead, &lag)
        }
        _ => TransferFunction {
            numerator: vec![1.0],
            denominator: vec![1.0],
        },
    }
}

fn build_loop_tf(request: &ControlAnalysisRequest) -> TransferFunction {
    let plant = normalize_tf(TransferFunction {
        numerator: request.plant.numerator.clone(),
        denominator: request.plant.denominator.clone(),
    });
    request
        .structures
        .iter()
        .filter(|item| item.enabled)
        .fold(plant, |acc, structure| {
            tf_mul(&acc, &tf_from_structure(structure))
        })
}

fn extract_primary_gain(structures: &[StructureSpec], fallback: f64) -> f64 {
    structures
        .iter()
        .find(|item| item.enabled && item.kind == "gain")
        .and_then(|item| item.params.get("k"))
        .copied()
        .unwrap_or(fallback)
}

fn compute_time_metrics(points: &[CurvePoint]) -> ControlMetrics {
    let finite_points: Vec<&CurvePoint> = points
        .iter()
        .filter(|point| point.x.is_finite() && point.y.is_finite())
        .collect();

    if finite_points.is_empty() {
        return ControlMetrics {
            overshoot_pct: 0.0,
            rise_time_sec: None,
            settling_time_sec: None,
            peak_time_sec: None,
            final_value: 0.0,
            phase_margin_deg: None,
            gain_margin_db: None,
            gain_crossover_rad_per_sec: None,
            phase_crossover_rad_per_sec: None,
            bandwidth_rad_per_sec: None,
        };
    }

    let final_value = finite_points.last().map(|point| point.y).unwrap_or(0.0);
    let peak_point = finite_points
        .iter()
        .copied()
        .max_by(|left, right| compare_f64(left.y, right.y));
    let max_value = peak_point.map(|point| point.y).unwrap_or(final_value);
    let overshoot_pct = if final_value.abs() > 1e-12 {
        ((max_value - final_value).max(0.0) / final_value.abs()) * 100.0
    } else {
        0.0
    };

    let rise_low = 0.1 * final_value;
    let rise_high = 0.9 * final_value;
    let crosses = |value: f64, target: f64| -> bool {
        if final_value >= 0.0 {
            value >= target
        } else {
            value <= target
        }
    };
    let rise_start = finite_points
        .iter()
        .copied()
        .find(|point| crosses(point.y, rise_low))
        .map(|point| point.x);
    let rise_end = finite_points
        .iter()
        .copied()
        .find(|point| crosses(point.y, rise_high))
        .map(|point| point.x);
    let settling_time_sec = finite_points
        .iter()
        .rposition(|point| (point.y - final_value).abs() > 0.02 * final_value.abs().max(1e-9))
        .and_then(|index| finite_points.get(index + 1).map(|point| point.x));

    ControlMetrics {
        overshoot_pct,
        rise_time_sec: match (rise_start, rise_end) {
            (Some(start), Some(end)) => Some(end - start),
            _ => None,
        },
        settling_time_sec,
        peak_time_sec: peak_point.map(|point| point.x),
        final_value,
        phase_margin_deg: None,
        gain_margin_db: None,
        gain_crossover_rad_per_sec: None,
        phase_crossover_rad_per_sec: None,
        bandwidth_rad_per_sec: None,
    }
}

struct CanonicalStateSpace {
    a: Vec<Vec<f64>>,
    b: Vec<f64>,
    c: Vec<f64>,
    d: f64,
}

fn create_canonical_state_space(num: &[f64], den: &[f64]) -> Option<CanonicalStateSpace> {
    if den.len() <= 1 {
        return None;
    }

    let order = den.len() - 1;
    let mut padded_num = vec![0.0; order + 1];
    let offset = padded_num.len().saturating_sub(num.len());
    for (index, value) in num.iter().enumerate() {
        let target = index + offset;
        if target < padded_num.len() {
            padded_num[target] = *value;
        }
    }

    let d = padded_num[0];
    let a_asc: Vec<f64> = den.iter().skip(1).rev().copied().collect();
    let b_asc: Vec<f64> = padded_num.iter().skip(1).rev().copied().collect();

    let mut a = vec![vec![0.0; order]; order];
    for row in 0..order.saturating_sub(1) {
        a[row][row + 1] = 1.0;
    }
    for column in 0..order {
        a[order - 1][column] = -a_asc[column];
    }

    let mut b = vec![0.0; order];
    b[order - 1] = 1.0;

    let c = (0..order)
        .map(|index| b_asc[index] - a_asc[index] * d)
        .collect();

    Some(CanonicalStateSpace { a, b, c, d })
}

fn mat_vec_mul(matrix: &[Vec<f64>], vector: &[f64]) -> Vec<f64> {
    matrix
        .iter()
        .map(|row| {
            row.iter()
                .zip(vector.iter())
                .map(|(lhs, rhs)| lhs * rhs)
                .sum()
        })
        .collect()
}

fn vec_add(lhs: &[f64], rhs: &[f64]) -> Vec<f64> {
    lhs.iter()
        .zip(rhs.iter())
        .map(|(left, right)| left + right)
        .collect()
}

fn vec_scale(values: &[f64], factor: f64) -> Vec<f64> {
    values.iter().map(|value| value * factor).collect()
}

fn dot(lhs: &[f64], rhs: &[f64]) -> f64 {
    lhs.iter()
        .zip(rhs.iter())
        .map(|(left, right)| left * right)
        .sum()
}

fn response_input(response_type: ResponseType, dt: f64, time: f64, index: usize) -> f64 {
    match response_type {
        ResponseType::Step => 1.0,
        ResponseType::Impulse => {
            if index == 0 {
                1.0 / dt.max(1e-4)
            } else {
                0.0
            }
        }
        ResponseType::Ramp => time.max(0.0),
    }
}

fn simulate_time_response(
    tf: &TransferFunction,
    config: &TimeRangeConfig,
    response_type: ResponseType,
) -> Option<Vec<CurvePoint>> {
    let tf = normalize_tf(tf.clone());
    let system = create_canonical_state_space(&tf.numerator, &tf.denominator)?;
    let count = config.samples.max(2);
    let dt = (config.end - config.start) / (count - 1) as f64;
    if !dt.is_finite() || dt <= 0.0 {
        return None;
    }

    let mut state = vec![0.0; system.b.len()];
    let mut points = Vec::with_capacity(count);

    let derivative = |current_state: &[f64], time: f64, index: usize| -> Vec<f64> {
        let input = response_input(response_type, dt, time, index);
        let ax = mat_vec_mul(&system.a, current_state);
        let bu = vec_scale(&system.b, input);
        vec_add(&ax, &bu)
    };

    for index in 0..count {
        let time = config.start + dt * index as f64;
        let input = response_input(response_type, dt, time, index);
        let output = dot(&system.c, &state) + system.d * input;
        points.push(CurvePoint {
            x: time,
            y: if output.is_finite() { output } else { 0.0 },
        });

        if index + 1 == count {
            break;
        }

        let k1 = derivative(&state, time, index);
        let k2 = derivative(
            &vec_add(&state, &vec_scale(&k1, dt / 2.0)),
            time + dt / 2.0,
            index,
        );
        let k3 = derivative(
            &vec_add(&state, &vec_scale(&k2, dt / 2.0)),
            time + dt / 2.0,
            index,
        );
        let k4 = derivative(&vec_add(&state, &vec_scale(&k3, dt)), time + dt, index);

        state = state
            .iter()
            .enumerate()
            .map(|(state_index, value)| {
                value
                    + (dt / 6.0)
                        * (k1[state_index]
                            + 2.0 * k2[state_index]
                            + 2.0 * k3[state_index]
                            + k4[state_index])
            })
            .collect();
    }

    Some(points)
}

fn step_response_by_residue(tf: &TransferFunction, times: &[f64]) -> Option<Vec<CurvePoint>> {
    let mut augmented_denominator = tf.denominator.clone();
    augmented_denominator.push(0.0);
    let poles = durand_kerner(&augmented_denominator);
    if poles.is_empty() {
        return None;
    }

    let scale = poles.iter().map(|pole| pole.norm()).fold(1.0_f64, f64::max);
    for (index, pole) in poles.iter().enumerate() {
        for candidate in poles.iter().skip(index + 1) {
            if (*pole - *candidate).norm() < 1e-6 * scale {
                return None;
            }
        }
    }

    let derivative = poly_derivative(&augmented_denominator);
    let residues: Vec<Complex64> = poles
        .iter()
        .map(|pole| {
            let slope = eval_poly_complex(&derivative, *pole);
            if slope.norm() < 1e-12 {
                None
            } else {
                Some(eval_poly_complex(&tf.numerator, *pole) / slope)
            }
        })
        .collect::<Option<Vec<_>>>()?;

    let mut points = Vec::with_capacity(times.len());
    for time in times {
        let value = poles
            .iter()
            .zip(residues.iter())
            .fold(Complex64::new(0.0, 0.0), |acc, (pole, residue)| {
                acc + *residue * (*pole * *time).exp()
            });
        if !value.re.is_finite() || !value.im.is_finite() {
            return None;
        }
        points.push(CurvePoint {
            x: *time,
            y: value.re,
        });
    }
    Some(points)
}

fn step_response(
    tf: &TransferFunction,
    config: &TimeRangeConfig,
    response_type: ResponseType,
) -> (Vec<CurvePoint>, ControlMetrics) {
    let tf = normalize_tf(tf.clone());
    let times = linspace(config.start, config.end, config.samples.max(2));
    let points = match response_type {
        ResponseType::Step => step_response_by_residue(&tf, &times)
            .or_else(|| simulate_time_response(&tf, config, response_type))
            .unwrap_or_else(|| {
                let gain = if tf
                    .denominator
                    .first()
                    .map(|value| value.abs())
                    .unwrap_or(0.0)
                    < 1e-12
                {
                    0.0
                } else {
                    tf.numerator.first().copied().unwrap_or(0.0)
                        / tf.denominator.first().copied().unwrap_or(1.0)
                };
                times
                    .iter()
                    .map(|time| CurvePoint { x: *time, y: gain })
                    .collect()
            }),
        ResponseType::Impulse | ResponseType::Ramp => {
            simulate_time_response(&tf, config, response_type).unwrap_or_else(|| {
                times
                    .iter()
                    .map(|time| CurvePoint { x: *time, y: 0.0 })
                    .collect()
            })
        }
    };
    let metrics = compute_time_metrics(&points);
    (points, metrics)
}

fn frequency_response(
    loop_tf: &TransferFunction,
    config: &FrequencyRangeConfig,
) -> (Vec<CurvePoint>, Vec<CurvePoint>, Vec<ComplexPoint>) {
    let loop_tf = normalize_tf(loop_tf.clone());
    let omegas = logspace(config.min, config.max, config.samples.max(8));
    let mut magnitude = Vec::with_capacity(omegas.len());
    let mut phase = Vec::with_capacity(omegas.len());
    let mut nyquist_positive = Vec::with_capacity(omegas.len());
    let mut last_phase: Option<f64> = None;
    for omega in omegas {
        let s = Complex64::new(0.0, omega);
        let value =
            eval_poly_complex(&loop_tf.numerator, s) / eval_poly_complex(&loop_tf.denominator, s);
        let norm = value.norm();
        let mut phase_deg = if norm < 1e-12 {
            0.0
        } else {
            value.arg().to_degrees()
        };
        if let Some(previous_phase) = last_phase {
            while phase_deg - previous_phase > 180.0 {
                phase_deg -= 360.0;
            }
            while phase_deg - previous_phase < -180.0 {
                phase_deg += 360.0;
            }
        }
        last_phase = Some(phase_deg);

        magnitude.push(CurvePoint {
            x: omega,
            y: 20.0 * norm.max(1e-12).log10(),
        });
        phase.push(CurvePoint {
            x: omega,
            y: phase_deg,
        });
        nyquist_positive.push(ComplexPoint {
            re: value.re,
            im: value.im,
        });
    }
    let mut nyquist = nyquist_positive.clone();
    for point in nyquist_positive.iter().rev().skip(1) {
        nyquist.push(ComplexPoint {
            re: point.re,
            im: -point.im,
        });
    }
    (magnitude, phase, nyquist)
}

fn interpolate_zero_cross(points: &[CurvePoint], target: f64) -> Option<f64> {
    points.windows(2).find_map(|window| {
        let left = &window[0];
        let right = &window[1];
        let left_offset = left.y - target;
        let right_offset = right.y - target;
        if left_offset == 0.0 {
            return Some(left.x);
        }
        if left_offset.signum() == right_offset.signum() {
            return None;
        }
        let ratio = left_offset.abs() / (left_offset.abs() + right_offset.abs());
        Some(left.x + (right.x - left.x) * ratio)
    })
}

fn margins(
    magnitude: &[CurvePoint],
    phase: &[CurvePoint],
) -> (
    Option<f64>,
    Option<f64>,
    Option<f64>,
    Option<f64>,
    Option<f64>,
) {
    let wc = interpolate_zero_cross(magnitude, 0.0);
    let wg = interpolate_zero_cross(phase, -180.0);
    let pm = wc.and_then(|cross| interp_curve(phase, cross).map(|value| 180.0 + value));
    let gm_db = wg.and_then(|cross| interp_curve(magnitude, cross).map(|value| -value));
    let bandwidth = magnitude.windows(2).find_map(|window| {
        let left = &window[0];
        let right = &window[1];
        let left_offset = left.y + 3.0;
        let right_offset = right.y + 3.0;
        if left_offset.signum() == right_offset.signum() {
            return None;
        }
        let ratio = left_offset.abs() / (left_offset.abs() + right_offset.abs());
        Some(left.x + (right.x - left.x) * ratio)
    });
    (pm, gm_db, wc, wg, bandwidth)
}

fn interp_curve(points: &[CurvePoint], x: f64) -> Option<f64> {
    points.windows(2).find_map(|window| {
        let left = &window[0];
        let right = &window[1];
        if x < left.x || x > right.x {
            return None;
        }
        let ratio = if (right.x - left.x).abs() < 1e-12 {
            0.0
        } else {
            (x - left.x) / (right.x - left.x)
        };
        Some(left.y + ratio * (right.y - left.y))
    })
}

fn durand_kerner(coeffs: &[f64]) -> Vec<Complex64> {
    let coeffs = trim_leading(coeffs.to_vec());
    if coeffs.len() <= 1 {
        return Vec::new();
    }
    let degree = coeffs.len() - 1;
    let lead = coeffs[0];
    let monic: Vec<f64> = coeffs.iter().map(|value| value / lead).collect();
    let radius = 1.0
        + monic
            .iter()
            .skip(1)
            .map(|value| value.abs())
            .fold(0.0, f64::max);
    let mut roots: Vec<Complex64> = (0..degree)
        .map(|index| {
            let angle = 2.0 * std::f64::consts::PI * index as f64 / degree as f64;
            Complex64::from_polar(radius, angle)
        })
        .collect();
    for _ in 0..120 {
        let mut max_delta: f64 = 0.0;
        for index in 0..degree {
            let denom = roots
                .iter()
                .enumerate()
                .filter(|(candidate, _)| *candidate != index)
                .fold(Complex64::new(1.0, 0.0), |acc, (_, root)| {
                    acc * (roots[index] - *root)
                });
            if denom.norm() < 1e-18 {
                continue;
            }
            let value = eval_poly_complex(&monic, roots[index]);
            let next = roots[index] - value / denom;
            max_delta = max_delta.max((next - roots[index]).norm());
            roots[index] = next;
        }
        if max_delta < 1e-10 {
            break;
        }
    }
    symmetrize_real_polynomial_roots(&mut roots);
    sort_complex_points(&mut roots);
    roots
}

fn symmetrize_real_polynomial_roots(roots: &mut Vec<Complex64>) {
    let len = roots.len();
    if len <= 1 {
        return;
    }

    let scale = roots.iter().map(|root| root.norm()).fold(1.0_f64, f64::max);
    let real_eps = 1e-8 * scale;
    let pair_eps = 1e-4 * scale;
    let mut used = vec![false; len];
    let mut normalized = Vec::with_capacity(len);

    for index in 0..len {
        if used[index] {
            continue;
        }

        let root = roots[index];
        if root.im.abs() <= real_eps {
            used[index] = true;
            normalized.push(Complex64::new(root.re, 0.0));
            continue;
        }

        let conjugate = root.conj();
        let mut best_index = None;
        let mut best_distance = f64::INFINITY;
        for candidate_index in 0..len {
            if candidate_index == index || used[candidate_index] {
                continue;
            }
            let distance = (roots[candidate_index] - conjugate).norm();
            if distance < best_distance {
                best_distance = distance;
                best_index = Some(candidate_index);
            }
        }

        if let Some(candidate_index) = best_index {
            if best_distance <= pair_eps || roots[candidate_index].im.signum() != root.im.signum() {
                used[index] = true;
                used[candidate_index] = true;
                let paired = roots[candidate_index];
                let re = 0.5 * (root.re + paired.re);
                let im = 0.5 * (root.im.abs() + paired.im.abs());
                let signed_im = im.copysign(root.im);
                normalized.push(Complex64::new(re, signed_im));
                normalized.push(Complex64::new(re, -signed_im));
                continue;
            }
        }

        used[index] = true;
        normalized.push(root);
    }

    if normalized.len() == len {
        *roots = normalized;
    }
}

fn best_root_assignment(previous: &[Complex64], current: &[Complex64]) -> Vec<Complex64> {
    if previous.len() != current.len() || current.len() <= 1 {
        let mut ordered = current.to_vec();
        sort_complex_points(&mut ordered);
        return ordered;
    }

    let mut best_cost = f64::INFINITY;
    let mut best_order = Vec::with_capacity(current.len());
    let mut used = vec![false; current.len()];
    let mut trial = Vec::with_capacity(current.len());

    fn search(
        index: usize,
        previous: &[Complex64],
        current: &[Complex64],
        used: &mut [bool],
        trial: &mut Vec<Complex64>,
        trial_cost: f64,
        best_cost: &mut f64,
        best_order: &mut Vec<Complex64>,
    ) {
        if index == previous.len() {
            if trial_cost < *best_cost {
                *best_cost = trial_cost;
                *best_order = trial.clone();
            }
            return;
        }

        for candidate_index in 0..current.len() {
            if used[candidate_index] {
                continue;
            }
            let segment_cost = (previous[index] - current[candidate_index]).norm_sqr();
            let next_cost = trial_cost + segment_cost;
            if next_cost >= *best_cost {
                continue;
            }
            used[candidate_index] = true;
            trial.push(current[candidate_index]);
            search(
                index + 1,
                previous,
                current,
                used,
                trial,
                next_cost,
                best_cost,
                best_order,
            );
            trial.pop();
            used[candidate_index] = false;
        }
    }

    search(
        0,
        previous,
        current,
        &mut used,
        &mut trial,
        0.0,
        &mut best_cost,
        &mut best_order,
    );

    if best_order.is_empty() {
        let mut ordered = current.to_vec();
        sort_complex_points(&mut ordered);
        ordered
    } else {
        best_order
    }
}

#[derive(Clone)]
struct RootLocusSample {
    gain: f64,
    roots: Vec<Complex64>,
}

fn compute_characteristic_roots(loop_tf: &TransferFunction, gain: f64) -> Vec<Complex64> {
    let scaled_num: Vec<f64> = loop_tf.numerator.iter().map(|value| value * gain).collect();
    let characteristic = poly_add(&loop_tf.denominator, &scaled_num);
    durand_kerner(&characteristic)
}

fn sample_root_locus(
    loop_tf: &TransferFunction,
    gain: f64,
    previous: Option<&[Complex64]>,
) -> RootLocusSample {
    let roots = compute_characteristic_roots(loop_tf, gain);
    let ordered_roots = previous
        .map(|reference| best_root_assignment(reference, &roots))
        .unwrap_or_else(|| {
            let mut initial = roots;
            sort_complex_points(&mut initial);
            initial
        });
    RootLocusSample {
        gain,
        roots: ordered_roots,
    }
}

fn min_pairwise_distance(roots: &[Complex64]) -> f64 {
    let mut min_distance = f64::INFINITY;
    for (index, root) in roots.iter().enumerate() {
        for candidate in roots.iter().skip(index + 1) {
            min_distance = min_distance.min((*root - *candidate).norm());
        }
    }
    if min_distance.is_finite() {
        min_distance
    } else {
        0.0
    }
}

fn should_refine_root_segment(
    left: &RootLocusSample,
    right: &RootLocusSample,
    depth: usize,
    max_depth: usize,
) -> bool {
    if depth >= max_depth || left.roots.len() != right.roots.len() {
        return false;
    }
    let scale = left
        .roots
        .iter()
        .chain(right.roots.iter())
        .map(|root| root.norm())
        .fold(1.0_f64, f64::max);
    let max_delta = left
        .roots
        .iter()
        .zip(right.roots.iter())
        .map(|(lhs, rhs)| (*lhs - *rhs).norm())
        .fold(0.0_f64, f64::max);
    let min_spacing = min_pairwise_distance(&left.roots).min(min_pairwise_distance(&right.roots));

    max_delta > 0.18 * scale || min_spacing < 0.08 * scale
}

fn append_root_locus_segment(
    loop_tf: &TransferFunction,
    left: &RootLocusSample,
    right_gain: f64,
    depth: usize,
    max_depth: usize,
    output: &mut Vec<RootLocusSample>,
) {
    let right = sample_root_locus(loop_tf, right_gain, Some(&left.roots));
    if should_refine_root_segment(left, &right, depth, max_depth) {
        let mid_gain = 0.5 * (left.gain + right.gain);
        if (mid_gain - left.gain).abs() < 1e-9 || (right.gain - mid_gain).abs() < 1e-9 {
            output.push(right);
            return;
        }
        append_root_locus_segment(loop_tf, left, mid_gain, depth + 1, max_depth, output);
        if let Some(midpoint) = output.last().cloned() {
            append_root_locus_segment(loop_tf, &midpoint, right.gain, depth + 1, max_depth, output);
        } else {
            output.push(right);
        }
    } else {
        output.push(right);
    }
}

fn root_locus(
    loop_tf: &TransferFunction,
    config: &RootLocusConfig,
    feasible_region: Option<FeasibleRegionConfig>,
) -> RootLocusData {
    let gains = linspace(config.min_gain, config.max_gain, config.samples.max(8));
    let degree = loop_tf.denominator.len().max(loop_tf.numerator.len()) - 1;
    let mut branches: Vec<Vec<RootLocusSamplePoint>> = vec![Vec::new(); degree];
    let max_depth = 5;
    let mut samples = Vec::new();
    let initial_gain = gains.first().copied().unwrap_or(config.min_gain);
    samples.push(sample_root_locus(loop_tf, initial_gain, None));
    for next_gain in gains.into_iter().skip(1) {
        let left = samples.last().cloned();
        if let Some(left_sample) = left {
            append_root_locus_segment(loop_tf, &left_sample, next_gain, 0, max_depth, &mut samples);
        }
    }

    for sample in &samples {
        for (index, root) in sample.roots.iter().enumerate() {
            if let Some(branch) = branches.get_mut(index) {
                branch.push(RootLocusSamplePoint {
                    re: root.re,
                    im: root.im,
                    gain: sample.gain,
                });
            }
        }
    }

    let current_poles = compute_characteristic_roots(loop_tf, config.current_gain)
        .into_iter()
        .map(|root| ComplexPoint {
            re: root.re,
            im: root.im,
        })
        .collect();
    let open_loop_poles = durand_kerner(&loop_tf.denominator)
        .into_iter()
        .map(|root| ComplexPoint {
            re: root.re,
            im: root.im,
        })
        .collect();
    let open_loop_zeros = if loop_tf.numerator.len() > 1
        && loop_tf.numerator.iter().any(|value| value.abs() > 1e-12)
    {
        durand_kerner(&loop_tf.numerator)
            .into_iter()
            .map(|root| ComplexPoint {
                re: root.re,
                im: root.im,
            })
            .collect()
    } else {
        Vec::new()
    };

    RootLocusData {
        branches,
        current_poles,
        open_loop_poles,
        open_loop_zeros,
        feasible_region,
    }
}

fn compute_analysis_inner(request: &ControlAnalysisRequest) -> ControlAnalysisResult {
    let loop_tf = build_loop_tf(request);
    let closed_tf = tf_unity_feedback(&loop_tf);
    let (step_points, mut metrics) =
        step_response(&closed_tf, &request.time_range, request.response_type);
    let (magnitude, phase, nyquist) = frequency_response(&loop_tf, &request.frequency_range);
    let (phase_margin_deg, gain_margin_db, gain_cross, phase_cross, bandwidth) =
        margins(&magnitude, &phase);
    metrics.phase_margin_deg = phase_margin_deg;
    metrics.gain_margin_db = gain_margin_db;
    metrics.gain_crossover_rad_per_sec = gain_cross;
    metrics.phase_crossover_rad_per_sec = phase_cross;
    metrics.bandwidth_rad_per_sec = bandwidth;
    let primary_gain = extract_primary_gain(&request.structures, request.root_locus.current_gain);
    let root_locus_data = root_locus(
        &normalize_tf(TransferFunction {
            numerator: loop_tf
                .numerator
                .iter()
                .map(|value| value / primary_gain.max(1e-9))
                .collect(),
            denominator: loop_tf.denominator.clone(),
        }),
        &request.root_locus,
        request.feasible_region.clone(),
    );

    ControlAnalysisResult {
        metrics,
        step_response: StepResponseData {
            points: step_points,
        },
        magnitude: BodeAxisData { points: magnitude },
        phase: BodeAxisData { points: phase },
        nyquist: NyquistData { points: nyquist },
        root_locus: root_locus_data,
    }
}

fn nonlinear_param(request: &NonlinearAnalysisRequest, key: &str, fallback: f64) -> f64 {
    request
        .parameters
        .as_ref()
        .and_then(|params| params.get(key))
        .and_then(|value| value.as_f64())
        .filter(|value| value.is_finite())
        .unwrap_or(fallback)
}

fn nonlinear_range(request: &NonlinearAnalysisRequest) -> Vec<f64> {
    linspace(
        request.time_range.start,
        request.time_range.end,
        request.time_range.samples.max(2),
    )
}

fn phase_derivative(model_id: &str, x: f64, y: f64, request: &NonlinearAnalysisRequest) -> (f64, f64) {
    match model_id {
        "double_integrator" => (y, 0.0),
        "integral_inertia" => {
            let t = nonlinear_param(request, "T", 1.0).max(1e-6);
            (y, -y / t)
        }
        _ => {
            let mu = nonlinear_param(request, "mu", 1.0);
            (y, mu * (1.0 - x * x) * y - x)
        }
    }
}

fn compute_phase_plane(request: &NonlinearAnalysisRequest) -> NonlinearAnalysisResult {
    let initial = request.initial_point.clone().unwrap_or_else(|| vec![1.2, 0.1]);
    let mut x = *initial.first().unwrap_or(&1.2);
    let mut y = *initial.get(1).unwrap_or(&0.1);
    let samples = request.time_range.samples.max(2);
    let dt = (request.time_range.end - request.time_range.start) / (samples - 1) as f64;
    let mut points = Vec::with_capacity(samples);

    for _ in 0..samples {
        points.push(CurvePoint { x, y });
        let (dx1, dy1) = phase_derivative(&request.model_id, x, y, request);
        let (dx2, dy2) = phase_derivative(&request.model_id, x + 0.5 * dt * dx1, y + 0.5 * dt * dy1, request);
        let (dx3, dy3) = phase_derivative(&request.model_id, x + 0.5 * dt * dx2, y + 0.5 * dt * dy2, request);
        let (dx4, dy4) = phase_derivative(&request.model_id, x + dt * dx3, y + dt * dy3, request);
        x += dt * (dx1 + 2.0 * dx2 + 2.0 * dx3 + dx4) / 6.0;
        y += dt * (dy1 + 2.0 * dy2 + 2.0 * dy3 + dy4) / 6.0;
    }

    let mut vector_field = Vec::new();
    for ix in 0..9 {
        for iy in 0..9 {
            let vx = -3.0 + ix as f64 * 0.75;
            let vy = -3.0 + iy as f64 * 0.75;
            let (dx, dy) = phase_derivative(&request.model_id, vx, vy, request);
            vector_field.push(VectorFieldPoint { x: vx, y: vy, dx, dy });
        }
    }

    let outcome = match request.model_id.as_str() {
        "double_integrator" => "速度保持并沿相平面直线漂移",
        "integral_inertia" => "速度衰减后状态逐渐停留",
        _ => "趋向闭合轨道",
    };

    NonlinearAnalysisResult {
        phase_plane: Some(PhasePlaneResult {
            vector_field,
            trajectories: vec![NamedCurve { id: request.model_id.clone(), points }],
        }),
        negative_inverse: None,
        harmonic: None,
        characteristic: None,
        summary: NonlinearSummary {
            outcome: outcome.to_string(),
            metrics: vec![
                format!("样本数 {}", samples),
                format!("初始点 ({:.2}, {:.2})", initial.first().unwrap_or(&1.2), initial.get(1).unwrap_or(&0.1)),
            ],
        },
    }
}

fn describing_function(model_id: &str, amplitude: f64, request: &NonlinearAnalysisRequest) -> Complex64 {
    let a_input = amplitude.max(1e-6);
    let pi = std::f64::consts::PI;
    match model_id {
        "hysteresis_relay" => {
            let m = nonlinear_param(request, "M", 1.0).max(1e-6);
            let h = nonlinear_param(request, "h", 0.5).max(1e-6);
            if a_input <= h {
                return Complex64::new(0.0, 0.0);
            }
            let ratio = (h / a_input).clamp(0.0, 0.999_999);
            Complex64::new(
                4.0 * m / (pi * a_input) * (1.0 - ratio * ratio).sqrt(),
                -4.0 * m / (pi * a_input) * ratio,
            )
        }
        "relay" => {
            let m = nonlinear_param(request, "M", 1.0).max(1e-6);
            Complex64::new(4.0 * m / (pi * a_input), 0.0)
        }
        "deadzone_relay" => {
            let m = nonlinear_param(request, "M", 1.0).max(1e-6);
            let d = nonlinear_param(request, "d", 0.5).max(1e-6);
            if a_input <= d {
                return Complex64::new(0.0, 0.0);
            }
            let ratio = (d / a_input).clamp(0.0, 0.999_999);
            Complex64::new(4.0 * m / (pi * a_input) * (1.0 - ratio * ratio).sqrt(), 0.0)
        }
        "deadzone" => {
            let k = nonlinear_param(request, "k", 1.0).max(1e-6);
            let delta = nonlinear_param(request, "Delta", 0.5).max(1e-6);
            if a_input <= delta {
                return Complex64::new(0.0, 0.0);
            }
            let ratio = (delta / a_input).clamp(0.0, 0.999_999);
            Complex64::new(
                2.0 * k / pi * (pi / 2.0 - ratio.asin() - ratio * (1.0 - ratio * ratio).sqrt()),
                0.0,
            )
        }
        "deadzone_saturation" => {
            let k = nonlinear_param(request, "k", 1.0).max(1e-6);
            let delta = nonlinear_param(request, "Delta", 0.5).max(1e-6);
            let a = nonlinear_param(request, "a", 2.0).max(delta + 1e-6);
            if a_input <= delta {
                return Complex64::new(0.0, 0.0);
            }
            let delta_ratio = (delta / a_input).clamp(0.0, 0.999_999);
            if a_input <= a {
                return Complex64::new(
                    2.0 * k / pi * (pi / 2.0 - delta_ratio.asin() - delta_ratio * (1.0 - delta_ratio * delta_ratio).sqrt()),
                    0.0,
                );
            }
            let a_ratio = (a / a_input).clamp(0.0, 0.999_999);
            Complex64::new(
                2.0 * k / pi * (
                    a_ratio.asin()
                    - delta_ratio.asin()
                    + a_ratio * (1.0 - a_ratio * a_ratio).sqrt()
                    - delta_ratio * (1.0 - delta_ratio * delta_ratio).sqrt()
                ),
                0.0,
            )
        }
        "backlash" => {
            let k = nonlinear_param(request, "k", 1.0).max(1e-6);
            let b = nonlinear_param(request, "b", 0.5).max(1e-6);
            if a_input <= b {
                return Complex64::new(0.0, 0.0);
            }
            let ratio = (b / a_input).clamp(1e-6, 0.999_999);
            Complex64::new(k * (1.0 - ratio), -4.0 * k * b / (pi * a_input) * (1.0 - ratio))
        }
        _ => {
            let k = nonlinear_param(request, "k", 1.0).max(1e-6);
            let a = nonlinear_param(request, "a", 1.0).max(1e-6);
            if a_input <= a {
                return Complex64::new(k, 0.0);
            }
            let ratio = (a / a_input).clamp(0.0, 0.999_999);
            Complex64::new(
                2.0 * k / pi * (ratio.asin() + ratio * (1.0 - ratio * ratio).sqrt()),
                0.0,
            )
        }
    }
}

fn characteristic_value(model_id: &str, x: f64, request: &NonlinearAnalysisRequest) -> f64 {
    let k = nonlinear_param(request, "k", 1.0).max(0.05);
    match model_id {
        "deadzone" => {
            let delta = nonlinear_param(request, "Delta", 0.5).max(0.0);
            if x.abs() <= delta { 0.0 } else { x.signum() * k * (x.abs() - delta) }
        }
        "deadzone_saturation" => {
            let delta = nonlinear_param(request, "Delta", 0.5).max(0.0);
            let a = nonlinear_param(request, "a", 2.0).max(delta + 1e-6);
            if x.abs() <= delta {
                0.0
            } else {
                x.signum() * k * (x.abs() - delta).min(a - delta)
            }
        }
        "relay" => {
            let m = nonlinear_param(request, "M", 1.0).max(0.05);
            if x >= 0.0 { m } else { -m }
        }
        "deadzone_relay" => {
            let m = nonlinear_param(request, "M", 1.0).max(0.05);
            let d = nonlinear_param(request, "d", 0.5).max(0.0);
            if x.abs() <= d { 0.0 } else { x.signum() * m }
        }
        _ => {
            let limit = nonlinear_param(request, "a", 1.0).max(0.05);
            (k * x).clamp(-k * limit, k * limit)
        }
    }
}

fn compute_negative_inverse(request: &NonlinearAnalysisRequest) -> NonlinearAnalysisResult {
    let min_a = nonlinear_param(request, "A_min", 0.05).max(0.001);
    let max_a = nonlinear_param(request, "A_max", 8.0).max(min_a + 0.01);
    let samples = request.time_range.samples.max(2);
    let mut points = Vec::with_capacity(samples);
    for index in 0..samples {
        let progress = index as f64 / (samples - 1) as f64;
        let amplitude = min_a + (max_a - min_a) * progress;
        let n = describing_function(&request.model_id, amplitude, request);
        if n.norm() <= 1e-9 {
            continue;
        }
        let value = -Complex64::new(1.0, 0.0) / n;
        points.push(ComplexPoint { re: value.re, im: value.im });
    }

    let mut marks = HashMap::new();
    marks.insert("start".to_string(), "open_circle_start".to_string());
    marks.insert("direction".to_string(), "arrow_for_increasing_A".to_string());

    NonlinearAnalysisResult {
        phase_plane: None,
        negative_inverse: Some(NegativeInverseResult {
            curves: vec![NegativeInverseCurve {
                id: request.model_id.clone(),
                label: request.model_id.replace('_', " "),
                points,
                marks,
            }],
        }),
        harmonic: None,
        characteristic: None,
        summary: NonlinearSummary {
            outcome: "负倒曲线随 A 增大按表达式数值生成".to_string(),
            metrics: vec![format!("幅值范围 {:.2}..{:.2}", min_a, max_a)],
        },
    }
}

fn compute_harmonic(request: &NonlinearAnalysisRequest) -> NonlinearAnalysisResult {
    let a = nonlinear_param(request, "A", 2.0).max(0.05);
    let omega = nonlinear_param(request, "omega", 1.0).max(0.05);
    let omega_c = nonlinear_param(request, "omega_c", 2.0).max(0.05);
    let m = nonlinear_param(request, "M", 1.0).max(0.05);
    let mut input = Vec::new();
    let mut relay_output = Vec::new();
    let mut filtered_output = Vec::new();
    let mut approximation = Vec::new();
    let attenuation = omega_c / (omega_c * omega_c + omega * omega).sqrt();
    for t in nonlinear_range(request) {
        let e = a * (omega * t).sin();
        let relay = if e >= 0.0 { m } else { -m };
        let base = 4.0 * m / std::f64::consts::PI * (omega * t).sin();
        input.push(CurvePoint { x: t, y: e });
        relay_output.push(CurvePoint { x: t, y: relay });
        filtered_output.push(CurvePoint { x: t, y: attenuation * base });
        approximation.push(CurvePoint { x: t, y: base });
    }
    NonlinearAnalysisResult {
        phase_plane: None,
        negative_inverse: None,
        harmonic: Some(HarmonicResult {
            input,
            relay_output,
            filtered_output,
            describing_function_approximation: approximation,
            spectrum: vec![
                CurvePoint { x: 1.0, y: 4.0 * m / std::f64::consts::PI },
                CurvePoint { x: 3.0, y: 4.0 * m / (3.0 * std::f64::consts::PI) },
                CurvePoint { x: 5.0, y: 4.0 * m / (5.0 * std::f64::consts::PI) },
            ],
        }),
        characteristic: None,
        summary: NonlinearSummary {
            outcome: "低通截止频率越低，高次谐波越被衰减".to_string(),
            metrics: vec![format!("基波衰减系数 {:.2}", attenuation)],
        },
    }
}

fn compute_characteristic(request: &NonlinearAnalysisRequest) -> NonlinearAnalysisResult {
    let k = nonlinear_param(request, "k", 1.0).max(0.05);
    let amplitude = nonlinear_param(request, "A", 2.0).max(0.05);
    let range = nonlinear_range(request);
    let curve = match request.model_id.as_str() {
        "hysteresis_relay" => {
            let m = nonlinear_param(request, "M", 1.0).max(0.05);
            let h = nonlinear_param(request, "h", 0.5).max(0.0);
            let increasing = range.iter().map(|x| CurvePoint { x: *x, y: if *x >= h { m } else { -m } });
            let decreasing = range.iter().rev().map(|x| CurvePoint { x: *x, y: if *x <= -h { -m } else { m } });
            increasing.chain(decreasing).collect::<Vec<_>>()
        }
        "backlash" => {
            let b = nonlinear_param(request, "b", 0.5).max(0.0);
            let increasing = range.iter().map(|x| CurvePoint { x: *x, y: k * (*x - b) });
            let decreasing = range.iter().rev().map(|x| CurvePoint { x: *x, y: k * (*x + b) });
            increasing.chain(decreasing).collect::<Vec<_>>()
        }
        _ => range
            .into_iter()
            .map(|x| CurvePoint {
                x,
                y: characteristic_value(&request.model_id, x, request),
            })
            .collect::<Vec<_>>(),
    };
    let min_y = curve.iter().map(|point| point.y).fold(f64::INFINITY, f64::min);
    let max_y = curve.iter().map(|point| point.y).fold(f64::NEG_INFINITY, f64::max);
    let sine_envelope = vec![
        CurvePoint { x: -amplitude, y: min_y },
        CurvePoint { x: -amplitude, y: max_y },
        CurvePoint { x: amplitude, y: max_y },
        CurvePoint { x: amplitude, y: min_y },
    ];
    let n = describing_function(&request.model_id, amplitude, request);
    NonlinearAnalysisResult {
        phase_plane: None,
        negative_inverse: None,
        harmonic: None,
        characteristic: Some(CharacteristicResult {
            curve,
            sine_envelope,
            describing_function: ComplexPoint { re: n.re, im: n.im },
        }),
        summary: NonlinearSummary {
            outcome: "输入输出特性与当前描述函数参数已联动".to_string(),
            metrics: vec![format!("N(A)=({:.3},{:.3})", n.re, n.im)],
        },
    }
}

fn compute_nonlinear_analysis_inner(request: &NonlinearAnalysisRequest) -> NonlinearAnalysisResult {
    match request.analysis_kind.as_str() {
        "phase_plane" => compute_phase_plane(request),
        "negative_inverse_family" => compute_negative_inverse(request),
        "harmonic_lowpass" => compute_harmonic(request),
        _ => compute_characteristic(request),
    }
}

#[wasm_bindgen]
pub fn compute_analysis(request_json: &str) -> Result<String, JsValue> {
    let request: ControlAnalysisRequest = serde_json::from_str(request_json)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    if request.runtime_mode != "analysis" {
        return Err(JsValue::from_str("只支持 analysis 模式请求。"));
    }
    if request.outputs.is_empty() {
        return Err(JsValue::from_str("outputs 不能为空。"));
    }
    let result = compute_analysis_inner(&request);
    serde_json::to_string(&result).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen]
pub fn compute_nonlinear_analysis(request_json: &str) -> Result<String, JsValue> {
    let request: NonlinearAnalysisRequest = serde_json::from_str(request_json)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    if request.runtime_mode != "nonlinear_analysis" {
        return Err(JsValue::from_str("只支持 nonlinear_analysis 模式请求。"));
    }
    let result = compute_nonlinear_analysis_inner(&request);
    serde_json::to_string(&result).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen]
pub fn compute_simulation_step(request_json: &str) -> Result<String, JsValue> {
    control_odyssey_runtime::compute_simulation_step_json(request_json)
        .map_err(|error| JsValue::from_str(&error))
}

#[wasm_bindgen]
pub fn compute_virtual_simulation_step(request_json: &str) -> Result<String, JsValue> {
    virtual_simulation_runtime::compute_virtual_simulation_step_json(request_json)
        .map_err(|error| JsValue::from_str(&error))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn computes_basic_first_order_step() {
        let request = ControlAnalysisRequest {
            runtime_mode: "analysis".to_string(),
            _case_id: None,
            plant: TransferFunctionSpec {
                numerator: vec![1.0],
                denominator: vec![1.0, 1.0],
            },
            structures: vec![StructureSpec {
                kind: "gain".to_string(),
                enabled: true,
                params: HashMap::from([(String::from("k"), 1.0)]),
            }],
            outputs: vec!["step_response".to_string()],
            response_type: ResponseType::Step,
            time_range: TimeRangeConfig {
                start: 0.0,
                end: 5.0,
                samples: 100,
            },
            frequency_range: FrequencyRangeConfig {
                min: 0.1,
                max: 10.0,
                samples: 64,
            },
            root_locus: RootLocusConfig {
                min_gain: 0.0,
                max_gain: 2.0,
                samples: 16,
                current_gain: 1.0,
            },
            feasible_region: None,
        };

        let result = compute_analysis_inner(&request);
        assert!(!result.step_response.points.is_empty());
        assert!(result.metrics.final_value > 0.4);
        assert!(result.metrics.final_value < 0.6);
    }

    fn ship_heading_request(gain: f64) -> ControlAnalysisRequest {
        ControlAnalysisRequest {
            runtime_mode: "analysis".to_string(),
            _case_id: Some("ship_heading".to_string()),
            plant: TransferFunctionSpec {
                numerator: vec![0.01715],
                denominator: vec![1.0, 2.24375, 0.214375, 0.0],
            },
            structures: vec![StructureSpec {
                kind: "gain".to_string(),
                enabled: true,
                params: HashMap::from([(String::from("k"), gain)]),
            }],
            outputs: vec![
                "step_response".to_string(),
                "root_locus".to_string(),
                "magnitude".to_string(),
                "phase".to_string(),
                "nyquist".to_string(),
                "bode".to_string(),
            ],
            response_type: ResponseType::Step,
            time_range: TimeRangeConfig {
                start: 0.0,
                end: 160.0,
                samples: 540,
            },
            frequency_range: FrequencyRangeConfig {
                min: 1e-3,
                max: 1e1,
                samples: 360,
            },
            root_locus: RootLocusConfig {
                min_gain: 0.0,
                max_gain: 12.0,
                samples: 96,
                current_gain: gain,
            },
            feasible_region: Some(FeasibleRegionConfig {
                zeta_min: 0.5169308662051556,
                sigma_min: 4.0 / 45.0,
                mp_ratio: Some(0.15),
                settling_time: Some(45.0),
            }),
        }
    }

    fn platform_pitch_request(gain: f64) -> ControlAnalysisRequest {
        ControlAnalysisRequest {
            runtime_mode: "analysis".to_string(),
            _case_id: Some("platform_pitch".to_string()),
            plant: TransferFunctionSpec {
                numerator: vec![197.33333333333334, 2960.0],
                denominator: vec![
                    0.000002833333333333334,
                    0.0034101666666666664,
                    0.5788716666666666,
                    35.37266666666667,
                    101.0,
                    0.0,
                ],
            },
            structures: vec![StructureSpec {
                kind: "gain".to_string(),
                enabled: true,
                params: HashMap::from([(String::from("k"), gain)]),
            }],
            outputs: vec![
                "step_response".to_string(),
                "root_locus".to_string(),
                "magnitude".to_string(),
                "phase".to_string(),
                "nyquist".to_string(),
                "bode".to_string(),
            ],
            response_type: ResponseType::Step,
            time_range: TimeRangeConfig {
                start: 0.0,
                end: 2.0,
                samples: 540,
            },
            frequency_range: FrequencyRangeConfig {
                min: 1e-1,
                max: 1e4,
                samples: 420,
            },
            root_locus: RootLocusConfig {
                min_gain: 0.0,
                max_gain: 24.0,
                samples: 120,
                current_gain: gain,
            },
            feasible_region: Some(FeasibleRegionConfig {
                zeta_min: 0.5911550337988976,
                sigma_min: 20.0,
                mp_ratio: Some(0.1),
                settling_time: Some(0.2),
            }),
        }
    }

    #[test]
    fn ship_heading_zero_gain_keeps_all_outputs_finite() {
        let result = compute_analysis_inner(&ship_heading_request(0.0));

        assert!(
            result
                .magnitude
                .points
                .iter()
                .all(|point| point.x.is_finite() && point.y.is_finite())
        );
        assert!(
            result
                .phase
                .points
                .iter()
                .all(|point| point.x.is_finite() && point.y.is_finite())
        );
        assert!(
            result
                .nyquist
                .points
                .iter()
                .all(|point| point.re.is_finite() && point.im.is_finite())
        );
    }

    #[test]
    fn supports_impulse_and_ramp_time_responses() {
        let mut impulse_request = ship_heading_request(1.0);
        impulse_request.response_type = ResponseType::Impulse;
        let impulse = compute_analysis_inner(&impulse_request);
        assert!(!impulse.step_response.points.is_empty());
        assert!(
            impulse
                .step_response
                .points
                .iter()
                .all(|point| point.x.is_finite() && point.y.is_finite())
        );
        assert!(
            impulse
                .step_response
                .points
                .iter()
                .any(|point| point.y.abs() > 1e-6)
        );

        let mut ramp_request = ship_heading_request(1.0);
        ramp_request.response_type = ResponseType::Ramp;
        let ramp = compute_analysis_inner(&ramp_request);
        assert!(!ramp.step_response.points.is_empty());
        let last = ramp.step_response.points.last().unwrap();
        let first = ramp.step_response.points.first().unwrap();
        assert!(last.y.is_finite());
        assert!(last.y > first.y);
    }

    #[test]
    fn root_locus_branches_keep_gain_metadata() {
        let result = compute_analysis_inner(&ship_heading_request(1.0));
        let first_branch = result
            .root_locus
            .branches
            .first()
            .expect("missing root locus branch");
        assert!(!first_branch.is_empty());
        assert!(first_branch.iter().all(|point| point.gain.is_finite()));
        assert_eq!(first_branch.first().map(|point| point.gain), Some(0.0));
    }

    #[test]
    fn root_locus_samples_remain_conjugate_symmetric() {
        let result = compute_analysis_inner(&ship_heading_request(1.0));

        for sample_index in 0..result.root_locus.branches[0].len() {
            let mut roots = Vec::new();
            for branch in &result.root_locus.branches {
                roots.push(branch[sample_index].clone());
            }

            for root in &roots {
                if root.im.abs() < 1e-7 {
                    continue;
                }
                assert!(
                    roots.iter().any(|candidate| {
                        (candidate.re - root.re).abs() < 1e-6 && (candidate.im + root.im).abs() < 1e-6
                    }),
                    "missing conjugate for root ({}, {}) at sample {}",
                    root.re,
                    root.im,
                    sample_index
                );
            }
        }
    }

    #[test]
    fn platform_pitch_case_computes_without_panicking() {
        let result = compute_analysis_inner(&platform_pitch_request(5.0));

        assert!(!result.step_response.points.is_empty());
        assert_eq!(result.root_locus.branches.len(), 5);
    }
}
