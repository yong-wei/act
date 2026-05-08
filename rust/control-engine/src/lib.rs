use num_complex::Complex64;
use serde::{Deserialize, Serialize};
use serde_json::Value;
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

#[derive(Debug, Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum NyquistPlotMode {
    Full,
    Half,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NyquistConfig {
    mode: Option<NyquistPlotMode>,
    sampling_mode: Option<SamplingMode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RootLocusConfig {
    min_gain: f64,
    max_gain: f64,
    samples: usize,
    current_gain: f64,
    increment: Option<f64>,
    sampling_mode: Option<SamplingMode>,
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum SamplingMode {
    Adaptive,
    Fixed,
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
    nyquist: Option<NyquistConfig>,
    root_locus: RootLocusConfig,
    feasible_region: Option<FeasibleRegionConfig>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RlTrainingRequest {
    panel_kind: String,
    training_type: Option<String>,
    seed: Option<u64>,
    training_episodes: Option<usize>,
    episode_chunk: Option<usize>,
    evaluate: Option<bool>,
    training_state: Option<RlTrainingState>,
    #[serde(default)]
    selected_parameters: HashMap<String, Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct RlRewardPoint {
    episode: usize,
    reward: f64,
    moving_average: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RlTrainingState {
    next_episode: usize,
    q_table: Vec<Vec<f64>>,
    reward_window: Vec<f64>,
    reward_history: Vec<RlRewardPoint>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RlComparisonPoint {
    t: f64,
    reference: f64,
    pid: f64,
    rl: f64,
    rudder_pid: f64,
    rudder_rl: f64,
    disturbance: f64,
    edge_scenario: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RlTrainingMetrics {
    rms_heading_error: f64,
    max_overshoot: f64,
    settling_time: f64,
    average_rudder: f64,
    average_rudder_rate: f64,
    final_error: f64,
    cumulative_reward: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RlTrainingResult {
    panel_kind: String,
    training_type: String,
    seed: u64,
    selected_parameters: HashMap<String, String>,
    training_episodes: usize,
    reward_curve: Vec<RlRewardPoint>,
    reward_chunk: Vec<RlRewardPoint>,
    comparison_trace: Vec<RlComparisonPoint>,
    metrics: RlTrainingMetrics,
    safety_fallback_count: usize,
    training_state: Option<RlTrainingState>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    branch_id: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sample_index: Option<usize>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RealAxisSegment {
    #[serde(skip_serializing_if = "Option::is_none")]
    start: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    end: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RootLocusAsymptote {
    centroid: f64,
    angle_deg: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RootLocusAngle {
    point: ComplexPoint,
    angle_deg: f64,
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
struct NyquistClosureSegment {
    points: Vec<ComplexPoint>,
    line_style: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NyquistKeyPoint {
    kind: String,
    point: ComplexPoint,
    frequency: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NyquistAsymptote {
    end: String,
    kind: String,
    angle_deg: Option<f64>,
    point: Option<ComplexPoint>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NyquistData {
    mode: NyquistPlotMode,
    points: Vec<ComplexPoint>,
    positive_points: Vec<ComplexPoint>,
    negative_points: Vec<ComplexPoint>,
    infinity_closure: NyquistClosureSegment,
    key_points: Vec<NyquistKeyPoint>,
    asymptotes: Vec<NyquistAsymptote>,
    encirclements: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RootLocusData {
    branches: Vec<Vec<RootLocusSamplePoint>>,
    gains: Vec<f64>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    real_axis_segments: Vec<RealAxisSegment>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    stationary_points: Vec<RootLocusSamplePoint>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    asymptotes: Vec<RootLocusAsymptote>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    imaginary_axis_crossings: Vec<RootLocusSamplePoint>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    departure_angles: Vec<RootLocusAngle>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    arrival_angles: Vec<RootLocusAngle>,
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
    selected_point: Option<SelectedComplexPoint>,
    marks: HashMap<String, String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NegativeInverseResult {
    curves: Vec<NegativeInverseCurve>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SelectedComplexPoint {
    re: f64,
    im: f64,
    amplitude: f64,
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
    signal_comparison: SignalComparisonResult,
    describing_function: ComplexPoint,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SignalComparisonResult {
    input: Vec<CurvePoint>,
    output: Vec<CurvePoint>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TurningHeadingCurve {
    id: String,
    label: String,
    points: Vec<CurvePoint>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TurningRadiusPath {
    actual: Vec<CurvePoint>,
    nominal: Vec<CurvePoint>,
    obstacle_center: CurvePoint,
    obstacle_radius: f64,
    clearance_radius: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TurningRadiusResult {
    d_start_m: f64,
    delta_d_deg: f64,
    max_delta_deg: f64,
    saturation_active: bool,
    min_distance_m: f64,
    collision_active: bool,
    safety_constraint_satisfied: bool,
    heading_curves: Vec<TurningHeadingCurve>,
    path: TurningRadiusPath,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    turning_radius: Option<TurningRadiusResult>,
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

fn poly_sub(a: &[f64], b: &[f64]) -> Vec<f64> {
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
        output[i] = ai - bi;
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

#[derive(Debug, Clone)]
struct NyquistFrequencySample {
    omega: f64,
    value: Complex64,
}

fn eval_transfer_function(loop_tf: &TransferFunction, omega: f64) -> Complex64 {
    let s = Complex64::new(0.0, omega);
    let denominator = eval_poly_complex(&loop_tf.denominator, s);
    if denominator.norm() < 1e-18 {
        let numerator = eval_poly_complex(&loop_tf.numerator, s);
        let angle = numerator.arg();
        return Complex64::from_polar(1e12, angle);
    }
    eval_poly_complex(&loop_tf.numerator, s) / denominator
}

fn is_finite_complex(value: Complex64) -> bool {
    value.re.is_finite() && value.im.is_finite()
}

fn complex_to_point(value: Complex64) -> ComplexPoint {
    ComplexPoint {
        re: value.re,
        im: value.im,
    }
}

fn distance_to_segment(point: Complex64, start: Complex64, end: Complex64) -> f64 {
    let segment = end - start;
    let length_sq = segment.norm_sqr();
    if length_sq < 1e-24 {
        return (point - start).norm();
    }
    let projection =
        (((point - start).re * segment.re) + ((point - start).im * segment.im)) / length_sq;
    let clamped = projection.clamp(0.0, 1.0);
    let nearest = start + segment * clamped;
    (point - nearest).norm()
}

fn angle_delta_rad(left: f64, right: f64) -> f64 {
    let mut delta = right - left;
    while delta > std::f64::consts::PI {
        delta -= 2.0 * std::f64::consts::PI;
    }
    while delta <= -std::f64::consts::PI {
        delta += 2.0 * std::f64::consts::PI;
    }
    delta
}

fn nyquist_should_refine(
    left: &NyquistFrequencySample,
    middle: &NyquistFrequencySample,
    right: &NyquistFrequencySample,
) -> bool {
    if !is_finite_complex(left.value)
        || !is_finite_complex(middle.value)
        || !is_finite_complex(right.value)
    {
        return false;
    }
    let scale = left
        .value
        .norm()
        .max(middle.value.norm())
        .max(right.value.norm())
        .max(1.0);
    let geometric_error = distance_to_segment(middle.value, left.value, right.value) / scale;
    let angle_change = angle_delta_rad(left.value.arg(), middle.value.arg()).abs()
        + angle_delta_rad(middle.value.arg(), right.value.arg()).abs();
    let critical = Complex64::new(-1.0, 0.0);
    let near_critical = (left.value - critical)
        .norm()
        .min((right.value - critical).norm())
        < 0.45;
    geometric_error > 0.012 || angle_change > 0.18 || (near_critical && geometric_error > 0.004)
}

fn append_adaptive_nyquist_segment(
    loop_tf: &TransferFunction,
    left: NyquistFrequencySample,
    right: NyquistFrequencySample,
    depth: usize,
    max_depth: usize,
    output: &mut Vec<NyquistFrequencySample>,
    max_samples: usize,
) {
    if output.len() >= max_samples {
        output.push(right);
        return;
    }
    let middle_omega = (left.omega * right.omega).sqrt();
    if !middle_omega.is_finite() || middle_omega <= left.omega || middle_omega >= right.omega {
        output.push(right);
        return;
    }
    let middle = NyquistFrequencySample {
        omega: middle_omega,
        value: eval_transfer_function(loop_tf, middle_omega),
    };
    if depth >= max_depth || !nyquist_should_refine(&left, &middle, &right) {
        output.push(right);
        return;
    }
    append_adaptive_nyquist_segment(
        loop_tf,
        left,
        middle.clone(),
        depth + 1,
        max_depth,
        output,
        max_samples,
    );
    append_adaptive_nyquist_segment(
        loop_tf,
        middle,
        right,
        depth + 1,
        max_depth,
        output,
        max_samples,
    );
}

fn nyquist_frequency_samples(
    loop_tf: &TransferFunction,
    config: &FrequencyRangeConfig,
    sampling_mode: SamplingMode,
) -> Vec<NyquistFrequencySample> {
    let min = config.min.max(1e-9);
    let max = config.max.max(min * 1.0001);
    let base = logspace(min, max, config.samples.max(24));
    let mut samples = Vec::new();
    let mut base_samples = base.into_iter().map(|omega| NyquistFrequencySample {
        omega,
        value: eval_transfer_function(loop_tf, omega),
    });
    if let Some(first) = base_samples.next() {
        samples.push(first.clone());
        let mut previous = first;
        for next in base_samples {
            if sampling_mode == SamplingMode::Adaptive {
                append_adaptive_nyquist_segment(
                    loop_tf,
                    previous,
                    next.clone(),
                    0,
                    7,
                    &mut samples,
                    config.samples.max(24) * 8,
                );
            } else {
                samples.push(next.clone());
            }
            previous = next;
        }
    }
    samples
}

fn interpolate_nyquist_sample(
    left: &NyquistFrequencySample,
    right: &NyquistFrequencySample,
    left_offset: f64,
    right_offset: f64,
) -> Option<(f64, Complex64)> {
    if left_offset == 0.0 {
        return Some((left.omega, left.value));
    }
    if left_offset.signum() == right_offset.signum() {
        return None;
    }
    let ratio = left_offset.abs() / (left_offset.abs() + right_offset.abs()).max(1e-12);
    let omega = left.omega + (right.omega - left.omega) * ratio;
    let value = left.value + (right.value - left.value) * ratio;
    Some((omega, value))
}

fn push_unique_nyquist_key_point(
    points: &mut Vec<NyquistKeyPoint>,
    kind: &str,
    frequency: f64,
    value: Complex64,
) {
    if !frequency.is_finite() || !is_finite_complex(value) {
        return;
    }
    let duplicate = points.iter().any(|point| {
        point.kind == kind && (point.frequency - frequency).abs() <= 1e-6 * frequency.abs().max(1.0)
    });
    if duplicate {
        return;
    }
    points.push(NyquistKeyPoint {
        kind: kind.to_string(),
        point: complex_to_point(value),
        frequency,
    });
}

fn nyquist_key_points(samples: &[NyquistFrequencySample]) -> Vec<NyquistKeyPoint> {
    let mut points = Vec::new();
    for window in samples.windows(2) {
        let left = &window[0];
        let right = &window[1];
        if let Some((frequency, value)) =
            interpolate_nyquist_sample(left, right, left.value.im, right.value.im)
        {
            push_unique_nyquist_key_point(&mut points, "real_axis_crossing", frequency, value);
        }
        if let Some((frequency, value)) =
            interpolate_nyquist_sample(left, right, left.value.re, right.value.re)
        {
            push_unique_nyquist_key_point(&mut points, "imaginary_axis_crossing", frequency, value);
        }
        if let Some((frequency, value)) = interpolate_nyquist_sample(
            left,
            right,
            left.value.norm() - 1.0,
            right.value.norm() - 1.0,
        ) {
            push_unique_nyquist_key_point(&mut points, "unit_circle_crossing", frequency, value);
        }
    }
    points
}

fn trailing_zero_order(coeffs: &[f64]) -> usize {
    coeffs
        .iter()
        .rev()
        .take_while(|value| value.abs() < 1e-12)
        .count()
}

fn coefficient_for_origin_order(coeffs: &[f64], order: usize) -> f64 {
    coeffs
        .get(coeffs.len().saturating_sub(order + 1))
        .copied()
        .unwrap_or(0.0)
}

fn asymptote_angle_deg(coeff: f64, power: isize) -> f64 {
    let coeff_angle = if coeff < 0.0 { 180.0 } else { 0.0 };
    normalize_angle_deg(coeff_angle + 90.0 * power as f64)
}

fn nyquist_asymptotes(loop_tf: &TransferFunction) -> Vec<NyquistAsymptote> {
    let mut asymptotes = Vec::new();
    let numerator_degree = loop_tf.numerator.len().saturating_sub(1) as isize;
    let denominator_degree = loop_tf.denominator.len().saturating_sub(1) as isize;
    let high_power = numerator_degree - denominator_degree;
    let high_coeff = loop_tf.numerator.first().copied().unwrap_or(0.0)
        / loop_tf.denominator.first().copied().unwrap_or(1.0);
    if high_power != 0 {
        asymptotes.push(NyquistAsymptote {
            end: "high_frequency".to_string(),
            kind: if high_power > 0 { "infinite" } else { "zero" }.to_string(),
            angle_deg: Some(asymptote_angle_deg(high_coeff, high_power)),
            point: None,
        });
    }

    let numerator_origin_order = trailing_zero_order(&loop_tf.numerator);
    let denominator_origin_order = trailing_zero_order(&loop_tf.denominator);
    let low_power = numerator_origin_order as isize - denominator_origin_order as isize;
    let denominator_coeff =
        coefficient_for_origin_order(&loop_tf.denominator, denominator_origin_order);
    let low_coeff = coefficient_for_origin_order(&loop_tf.numerator, numerator_origin_order)
        / if denominator_coeff.abs() < 1e-12 {
            1e-12
        } else {
            denominator_coeff
        };
    if low_power != 0 {
        asymptotes.push(NyquistAsymptote {
            end: "low_frequency".to_string(),
            kind: if low_power > 0 { "zero" } else { "infinite" }.to_string(),
            angle_deg: Some(asymptote_angle_deg(low_coeff, low_power)),
            point: None,
        });
    }
    asymptotes
}

fn winding_number(points: &[ComplexPoint], critical: Complex64) -> f64 {
    if points.len() < 2 {
        return 0.0;
    }
    let mut total = 0.0;
    for window in points.windows(2) {
        let left = Complex64::new(window[0].re - critical.re, window[0].im - critical.im);
        let right = Complex64::new(window[1].re - critical.re, window[1].im - critical.im);
        if left.norm() < 1e-12 || right.norm() < 1e-12 {
            continue;
        }
        total += angle_delta_rad(left.arg(), right.arg());
    }
    if let (Some(first), Some(last)) = (points.first(), points.last()) {
        let left = Complex64::new(last.re - critical.re, last.im - critical.im);
        let right = Complex64::new(first.re - critical.re, first.im - critical.im);
        if left.norm() >= 1e-12 && right.norm() >= 1e-12 {
            total += angle_delta_rad(left.arg(), right.arg());
        }
    }
    (total / (2.0 * std::f64::consts::PI)).round()
}

fn build_nyquist_data(
    loop_tf: &TransferFunction,
    samples: &[NyquistFrequencySample],
    mode: NyquistPlotMode,
) -> NyquistData {
    let positive_points: Vec<ComplexPoint> = samples
        .iter()
        .map(|sample| complex_to_point(sample.value))
        .collect();
    let negative_points: Vec<ComplexPoint> = if mode == NyquistPlotMode::Full {
        positive_points
            .iter()
            .rev()
            .map(|point| ComplexPoint {
                re: point.re,
                im: -point.im,
            })
            .collect()
    } else {
        Vec::new()
    };
    let points = if mode == NyquistPlotMode::Full {
        let mut full = positive_points.clone();
        full.extend(negative_points.clone());
        full
    } else {
        positive_points.clone()
    };
    let infinity_closure = if mode == NyquistPlotMode::Full {
        match (positive_points.last(), negative_points.first()) {
            (Some(start), Some(end)) => NyquistClosureSegment {
                points: vec![start.clone(), end.clone()],
                line_style: "dashed".to_string(),
            },
            _ => NyquistClosureSegment {
                points: Vec::new(),
                line_style: "dashed".to_string(),
            },
        }
    } else {
        NyquistClosureSegment {
            points: Vec::new(),
            line_style: "dashed".to_string(),
        }
    };
    let mut contour_points = negative_points.clone();
    contour_points.extend(positive_points.clone());
    if let Some(start) = contour_points.first().cloned() {
        contour_points.push(start);
    }

    NyquistData {
        mode,
        points,
        positive_points,
        negative_points,
        infinity_closure,
        key_points: nyquist_key_points(samples),
        asymptotes: nyquist_asymptotes(loop_tf),
        encirclements: if mode == NyquistPlotMode::Full {
            winding_number(&contour_points, Complex64::new(-1.0, 0.0))
        } else {
            0.0
        },
    }
}

fn frequency_response(
    loop_tf: &TransferFunction,
    config: &FrequencyRangeConfig,
    nyquist_config: Option<&NyquistConfig>,
) -> (Vec<CurvePoint>, Vec<CurvePoint>, NyquistData) {
    let loop_tf = normalize_tf(loop_tf.clone());
    let mode = nyquist_config
        .and_then(|item| item.mode)
        .unwrap_or(NyquistPlotMode::Full);
    let sampling_mode = nyquist_config
        .and_then(|item| item.sampling_mode)
        .unwrap_or(SamplingMode::Adaptive);
    let samples = nyquist_frequency_samples(&loop_tf, config, sampling_mode);
    let mut magnitude = Vec::with_capacity(samples.len());
    let mut phase = Vec::with_capacity(samples.len());
    let mut last_phase: Option<f64> = None;
    for sample in &samples {
        let omega = sample.omega;
        let value = sample.value;
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
    }
    let nyquist = build_nyquist_data(&loop_tf, &samples, mode);
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

    max_delta > 0.12 * scale || (min_spacing < 0.03 * scale && max_delta > 0.01 * scale)
}

fn append_root_locus_segment(
    loop_tf: &TransferFunction,
    left: &RootLocusSample,
    right_gain: f64,
    depth: usize,
    max_depth: usize,
    output: &mut Vec<RootLocusSample>,
    max_samples: usize,
) {
    let right = sample_root_locus(loop_tf, right_gain, Some(&left.roots));
    if output.len() + 1 >= max_samples {
        output.push(right);
        return;
    }
    if should_refine_root_segment(left, &right, depth, max_depth) {
        let mid_gain = 0.5 * (left.gain + right.gain);
        if (mid_gain - left.gain).abs() < 1e-9 || (right.gain - mid_gain).abs() < 1e-9 {
            output.push(right);
            return;
        }
        append_root_locus_segment(
            loop_tf,
            left,
            mid_gain,
            depth + 1,
            max_depth,
            output,
            max_samples,
        );
        if let Some(midpoint) = output.last().cloned() {
            append_root_locus_segment(
                loop_tf,
                &midpoint,
                right.gain,
                depth + 1,
                max_depth,
                output,
                max_samples,
            );
        } else {
            output.push(right);
        }
    } else {
        output.push(right);
    }
}

fn rounded_gain(value: f64) -> f64 {
    if !value.is_finite() {
        return value;
    }
    (value * 1_000_000_000_000.0).round() / 1_000_000_000_000.0
}

fn sorted_unique_gains(mut gains: Vec<f64>) -> Vec<f64> {
    gains.retain(|gain| gain.is_finite() && *gain >= 0.0);
    gains.sort_by(|left, right| compare_f64(*left, *right));
    let mut output = Vec::new();
    for gain in gains {
        let rounded = rounded_gain(gain);
        if output
            .last()
            .map(|previous: &f64| (rounded - *previous).abs() > 1e-9)
            .unwrap_or(true)
        {
            output.push(rounded);
        }
    }
    output
}

fn gain_at_real_point(loop_tf: &TransferFunction, point: f64) -> Option<f64> {
    let s = Complex64::new(point, 0.0);
    let numerator = eval_poly_complex(&loop_tf.numerator, s).re;
    if numerator.abs() < 1e-10 {
        return None;
    }
    let denominator = eval_poly_complex(&loop_tf.denominator, s).re;
    let gain = -denominator / numerator;
    if gain.is_finite() && gain >= -1e-9 {
        Some(gain.max(0.0))
    } else {
        None
    }
}

fn real_roots(points: &[Complex64]) -> Vec<f64> {
    let mut values: Vec<f64> = points
        .iter()
        .filter(|point| point.im.abs() <= 1e-7 * point.norm().max(1.0))
        .map(|point| point.re)
        .collect();
    values.sort_by(|left, right| compare_f64(*left, *right));
    let mut output = Vec::new();
    for value in values {
        if output
            .last()
            .map(|previous: &f64| (value - *previous).abs() > 1e-6)
            .unwrap_or(true)
        {
            output.push(value);
        }
    }
    output
}

fn is_on_real_axis_locus(
    point: f64,
    open_loop_poles: &[Complex64],
    open_loop_zeros: &[Complex64],
) -> bool {
    let right_count = open_loop_poles
        .iter()
        .chain(open_loop_zeros.iter())
        .filter(|root| root.im.abs() < 1e-7 && root.re > point + 1e-7)
        .count();
    right_count % 2 == 1
}

fn stationary_points(
    loop_tf: &TransferFunction,
    open_loop_poles: &[Complex64],
    open_loop_zeros: &[Complex64],
) -> Vec<RootLocusSamplePoint> {
    if loop_tf.numerator.iter().all(|value| value.abs() < 1e-12) {
        return Vec::new();
    }
    let denominator_derivative = poly_derivative(&loop_tf.denominator);
    let numerator_derivative = poly_derivative(&loop_tf.numerator);
    let candidates = durand_kerner(&poly_sub(
        &convolve(&denominator_derivative, &loop_tf.numerator),
        &convolve(&loop_tf.denominator, &numerator_derivative),
    ));

    let mut points = Vec::new();
    for candidate in candidates {
        let scale = candidate.norm().max(1.0);
        if candidate.im.abs() > 1e-7 * scale {
            continue;
        }
        let re = candidate.re;
        if !is_on_real_axis_locus(re, open_loop_poles, open_loop_zeros) {
            continue;
        }
        if let Some(gain) = gain_at_real_point(loop_tf, re) {
            points.push(RootLocusSamplePoint {
                re,
                im: 0.0,
                gain: rounded_gain(gain),
                branch_id: None,
                sample_index: None,
            });
        }
    }
    points.sort_by(|left, right| compare_f64(left.gain, right.gain));
    points
}

fn root_locus_gain_sequence(
    config: &RootLocusConfig,
    stationary: &[RootLocusSamplePoint],
) -> Vec<f64> {
    let min_gain = config.min_gain.max(0.0);
    let mut gains = Vec::new();
    match config.sampling_mode.unwrap_or(SamplingMode::Adaptive) {
        SamplingMode::Fixed => {
            let max_gain = config.max_gain.max(min_gain);
            if let Some(increment) = config
                .increment
                .filter(|value| value.is_finite() && *value > 0.0)
            {
                let mut gain = min_gain;
                while gain <= max_gain + 1e-9 {
                    gains.push(gain);
                    gain += increment;
                }
                if gains
                    .last()
                    .map(|last| (max_gain - *last).abs() > 1e-8)
                    .unwrap_or(true)
                {
                    gains.push(max_gain);
                }
            } else {
                gains.extend(linspace(min_gain, max_gain, config.samples.max(2)));
            }
            gains.extend(
                stationary
                    .iter()
                    .map(|point| point.gain)
                    .filter(|gain| *gain >= min_gain - 1e-9 && *gain <= max_gain + 1e-9),
            );
        }
        SamplingMode::Adaptive => {
            let max_gain = config.max_gain.max(min_gain).max(config.current_gain).max(
                stationary
                    .iter()
                    .map(|point| point.gain)
                    .fold(0.0_f64, f64::max),
            );
            gains.extend(linspace(min_gain, max_gain, config.samples.max(30)));
            gains.push(config.current_gain);
            gains.extend(
                stationary
                    .iter()
                    .map(|point| point.gain)
                    .filter(|gain| *gain >= min_gain - 1e-9 && *gain <= max_gain + 1e-9),
            );
        }
    }
    sorted_unique_gains(gains)
}

fn real_axis_segments(
    open_loop_poles: &[Complex64],
    open_loop_zeros: &[Complex64],
) -> Vec<RealAxisSegment> {
    let mut singularities = real_roots(open_loop_poles);
    singularities.extend(real_roots(open_loop_zeros));
    singularities.sort_by(|left, right| compare_f64(*left, *right));
    let mut unique = Vec::new();
    for value in singularities {
        if unique
            .last()
            .map(|previous: &f64| (value - *previous).abs() > 1e-6)
            .unwrap_or(true)
        {
            unique.push(value);
        }
    }
    if unique.is_empty() {
        return Vec::new();
    }

    let mut segments = Vec::new();
    for index in 0..=unique.len() {
        let start = if index == 0 {
            None
        } else {
            Some(unique[index - 1])
        };
        let end = if index == unique.len() {
            None
        } else {
            Some(unique[index])
        };
        let probe = match (start, end) {
            (Some(left), Some(right)) => 0.5 * (left + right),
            (None, Some(right)) => right - 1.0,
            (Some(left), None) => left + 1.0,
            (None, None) => 0.0,
        };
        if is_on_real_axis_locus(probe, open_loop_poles, open_loop_zeros) {
            segments.push(RealAxisSegment { start, end });
        }
    }
    segments
}

fn normalize_angle_deg(angle: f64) -> f64 {
    let mut normalized = angle % 360.0;
    if normalized > 180.0 {
        normalized -= 360.0;
    }
    if normalized <= -180.0 {
        normalized += 360.0;
    }
    normalized
}

fn angle_between(origin: Complex64, target: Complex64) -> f64 {
    (target.im - origin.im)
        .atan2(target.re - origin.re)
        .to_degrees()
}

fn root_locus_asymptotes(
    open_loop_poles: &[Complex64],
    open_loop_zeros: &[Complex64],
) -> Vec<RootLocusAsymptote> {
    let excess = open_loop_poles.len().saturating_sub(open_loop_zeros.len());
    if excess == 0 {
        return Vec::new();
    }
    let pole_sum: f64 = open_loop_poles.iter().map(|pole| pole.re).sum();
    let zero_sum: f64 = open_loop_zeros.iter().map(|zero| zero.re).sum();
    let centroid = (pole_sum - zero_sum) / excess as f64;
    (0..excess)
        .map(|index| RootLocusAsymptote {
            centroid,
            angle_deg: (2 * index + 1) as f64 * 180.0 / excess as f64,
        })
        .collect()
}

fn departure_angles(
    open_loop_poles: &[Complex64],
    open_loop_zeros: &[Complex64],
) -> Vec<RootLocusAngle> {
    open_loop_poles
        .iter()
        .filter(|pole| pole.im.abs() > 1e-7)
        .map(|pole| {
            let zero_angles: f64 = open_loop_zeros
                .iter()
                .map(|zero| angle_between(*pole, *zero))
                .sum();
            let pole_angles: f64 = open_loop_poles
                .iter()
                .filter(|candidate| (**candidate - *pole).norm() > 1e-8)
                .map(|candidate| angle_between(*pole, *candidate))
                .sum();
            RootLocusAngle {
                point: ComplexPoint {
                    re: pole.re,
                    im: pole.im,
                },
                angle_deg: normalize_angle_deg(180.0 + zero_angles - pole_angles),
            }
        })
        .collect()
}

fn arrival_angles(
    open_loop_poles: &[Complex64],
    open_loop_zeros: &[Complex64],
) -> Vec<RootLocusAngle> {
    open_loop_zeros
        .iter()
        .filter(|zero| zero.im.abs() > 1e-7)
        .map(|zero| {
            let pole_angles: f64 = open_loop_poles
                .iter()
                .map(|pole| angle_between(*zero, *pole))
                .sum();
            let zero_angles: f64 = open_loop_zeros
                .iter()
                .filter(|candidate| (**candidate - *zero).norm() > 1e-8)
                .map(|candidate| angle_between(*zero, *candidate))
                .sum();
            RootLocusAngle {
                point: ComplexPoint {
                    re: zero.re,
                    im: zero.im,
                },
                angle_deg: normalize_angle_deg(180.0 - pole_angles + zero_angles),
            }
        })
        .collect()
}

fn imaginary_axis_crossings(branches: &[Vec<RootLocusSamplePoint>]) -> Vec<RootLocusSamplePoint> {
    let mut crossings = Vec::new();
    for (branch_id, branch) in branches.iter().enumerate() {
        for (sample_index, pair) in branch.windows(2).enumerate() {
            let left = &pair[0];
            let right = &pair[1];
            if left.re.abs() < 1e-8 && left.im.abs() > 1e-8 {
                crossings.push(RootLocusSamplePoint {
                    re: 0.0,
                    im: left.im,
                    gain: left.gain,
                    branch_id: Some(branch_id),
                    sample_index: Some(sample_index),
                });
                continue;
            }
            if left.re.signum() == right.re.signum() {
                continue;
            }
            let ratio = left.re.abs() / (left.re.abs() + right.re.abs()).max(1e-12);
            let im = left.im + (right.im - left.im) * ratio;
            if im.abs() <= 1e-8 {
                continue;
            }
            crossings.push(RootLocusSamplePoint {
                re: 0.0,
                im,
                gain: rounded_gain(left.gain + (right.gain - left.gain) * ratio),
                branch_id: Some(branch_id),
                sample_index: Some(sample_index),
            });
        }
    }
    crossings
}

fn root_locus(
    loop_tf: &TransferFunction,
    config: &RootLocusConfig,
    feasible_region: Option<FeasibleRegionConfig>,
) -> RootLocusData {
    let degree = loop_tf.denominator.len().max(loop_tf.numerator.len()) - 1;
    let open_loop_poles_raw = durand_kerner(&loop_tf.denominator);
    let open_loop_zeros_raw = if loop_tf.numerator.len() > 1
        && loop_tf.numerator.iter().any(|value| value.abs() > 1e-12)
    {
        durand_kerner(&loop_tf.numerator)
    } else {
        Vec::new()
    };
    let stationary_points = stationary_points(loop_tf, &open_loop_poles_raw, &open_loop_zeros_raw);
    let gains = root_locus_gain_sequence(config, &stationary_points);
    let mut branches: Vec<Vec<RootLocusSamplePoint>> = vec![Vec::new(); degree];
    let max_depth = 5;
    let max_samples = 1000;
    let mut samples = Vec::new();
    let initial_gain = gains.first().copied().unwrap_or(config.min_gain);
    samples.push(sample_root_locus(loop_tf, initial_gain, None));
    for next_gain in gains.into_iter().skip(1) {
        if samples.len() >= max_samples {
            break;
        }
        let left = samples.last().cloned();
        if let Some(left_sample) = left {
            if config.sampling_mode.unwrap_or(SamplingMode::Adaptive) == SamplingMode::Fixed {
                samples.push(sample_root_locus(
                    loop_tf,
                    next_gain,
                    Some(&left_sample.roots),
                ));
            } else {
                append_root_locus_segment(
                    loop_tf,
                    &left_sample,
                    next_gain,
                    0,
                    max_depth,
                    &mut samples,
                    max_samples,
                );
            }
        }
    }

    for (sample_index, sample) in samples.iter().enumerate() {
        for (branch_id, root) in sample.roots.iter().enumerate() {
            if let Some(branch) = branches.get_mut(branch_id) {
                branch.push(RootLocusSamplePoint {
                    re: root.re,
                    im: root.im,
                    gain: sample.gain,
                    branch_id: Some(branch_id),
                    sample_index: Some(sample_index),
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
    let open_loop_poles = open_loop_poles_raw
        .iter()
        .map(|root| ComplexPoint {
            re: root.re,
            im: root.im,
        })
        .collect();
    let open_loop_zeros = open_loop_zeros_raw
        .iter()
        .map(|root| ComplexPoint {
            re: root.re,
            im: root.im,
        })
        .collect();
    let gains = samples
        .iter()
        .map(|sample| rounded_gain(sample.gain))
        .collect();
    let imaginary_axis_crossings = imaginary_axis_crossings(&branches);

    RootLocusData {
        branches,
        gains,
        real_axis_segments: real_axis_segments(&open_loop_poles_raw, &open_loop_zeros_raw),
        stationary_points,
        asymptotes: root_locus_asymptotes(&open_loop_poles_raw, &open_loop_zeros_raw),
        imaginary_axis_crossings,
        departure_angles: departure_angles(&open_loop_poles_raw, &open_loop_zeros_raw),
        arrival_angles: arrival_angles(&open_loop_poles_raw, &open_loop_zeros_raw),
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
    let (magnitude, phase, nyquist) =
        frequency_response(&loop_tf, &request.frequency_range, request.nyquist.as_ref());
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
        nyquist,
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

fn phase_derivative(
    model_id: &str,
    x: f64,
    y: f64,
    request: &NonlinearAnalysisRequest,
) -> (f64, f64) {
    match model_id {
        "damped_second_order" => {
            let zeta = nonlinear_param(request, "zeta", 0.35).max(0.01);
            let omega_n = nonlinear_param(request, "omega_n", 1.0).max(0.01);
            (y, -2.0 * zeta * omega_n * y - omega_n * omega_n * x)
        }
        "stable_focus" => {
            let alpha = nonlinear_param(request, "alpha", 0.25).max(0.01);
            let beta = nonlinear_param(request, "beta", 1.2).max(0.01);
            (-alpha * x - beta * y, beta * x - alpha * y)
        }
        _ => {
            let mu = nonlinear_param(request, "mu", 1.0);
            (y, mu * (1.0 - x * x) * y - x)
        }
    }
}

fn compute_phase_plane(request: &NonlinearAnalysisRequest) -> NonlinearAnalysisResult {
    let initial = request
        .initial_point
        .clone()
        .unwrap_or_else(|| vec![1.2, 0.1]);
    let mut x = *initial.first().unwrap_or(&1.2);
    let mut y = *initial.get(1).unwrap_or(&0.1);
    let samples = request.time_range.samples.max(2);
    let dt = (request.time_range.end - request.time_range.start) / (samples - 1) as f64;
    let mut points = Vec::with_capacity(samples);

    for _ in 0..samples {
        points.push(CurvePoint { x, y });
        let (dx1, dy1) = phase_derivative(&request.model_id, x, y, request);
        let (dx2, dy2) = phase_derivative(
            &request.model_id,
            x + 0.5 * dt * dx1,
            y + 0.5 * dt * dy1,
            request,
        );
        let (dx3, dy3) = phase_derivative(
            &request.model_id,
            x + 0.5 * dt * dx2,
            y + 0.5 * dt * dy2,
            request,
        );
        let (dx4, dy4) = phase_derivative(&request.model_id, x + dt * dx3, y + dt * dy3, request);
        x += dt * (dx1 + 2.0 * dx2 + 2.0 * dx3 + dx4) / 6.0;
        y += dt * (dy1 + 2.0 * dy2 + 2.0 * dy3 + dy4) / 6.0;
    }

    let mut vector_field = Vec::new();
    let (field_y_min, field_y_max) = if request.model_id == "van_der_pol" {
        (-4.0, 4.0)
    } else {
        (-3.0, 3.0)
    };
    for ix in 0..13 {
        for iy in 0..13 {
            let vx = -3.0 + ix as f64 * 0.5;
            let vy = field_y_min + (field_y_max - field_y_min) * iy as f64 / 12.0;
            let (dx, dy) = phase_derivative(&request.model_id, vx, vy, request);
            vector_field.push(VectorFieldPoint {
                x: vx,
                y: vy,
                dx,
                dy,
            });
        }
    }

    let outcome = match request.model_id.as_str() {
        "damped_second_order" => "阻尼二阶轨迹逐步收敛到原点",
        "stable_focus" => "稳定焦点轨迹螺旋收敛到原点",
        _ => "趋向闭合轨道",
    };

    NonlinearAnalysisResult {
        phase_plane: Some(PhasePlaneResult {
            vector_field,
            trajectories: vec![NamedCurve {
                id: request.model_id.clone(),
                points,
            }],
        }),
        negative_inverse: None,
        harmonic: None,
        characteristic: None,
        turning_radius: None,
        summary: NonlinearSummary {
            outcome: outcome.to_string(),
            metrics: vec![
                format!("样本数 {}", samples),
                format!(
                    "初始点 ({:.2}, {:.2})",
                    initial.first().unwrap_or(&1.2),
                    initial.get(1).unwrap_or(&0.1)
                ),
            ],
        },
    }
}

fn describing_function(
    model_id: &str,
    amplitude: f64,
    request: &NonlinearAnalysisRequest,
) -> Complex64 {
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
                    2.0 * k / pi
                        * (pi / 2.0
                            - delta_ratio.asin()
                            - delta_ratio * (1.0 - delta_ratio * delta_ratio).sqrt()),
                    0.0,
                );
            }
            let a_ratio = (a / a_input).clamp(0.0, 0.999_999);
            Complex64::new(
                2.0 * k / pi
                    * (a_ratio.asin() - delta_ratio.asin()
                        + a_ratio * (1.0 - a_ratio * a_ratio).sqrt()
                        - delta_ratio * (1.0 - delta_ratio * delta_ratio).sqrt()),
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
            Complex64::new(
                k * (1.0 - ratio),
                -4.0 * k * b / (pi * a_input) * (1.0 - ratio),
            )
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
            if x.abs() <= delta {
                0.0
            } else {
                x.signum() * k * (x.abs() - delta)
            }
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
            if x >= 0.0 {
                m
            } else {
                -m
            }
        }
        "deadzone_relay" => {
            let m = nonlinear_param(request, "M", 1.0).max(0.05);
            let d = nonlinear_param(request, "d", 0.5).max(0.0);
            if x.abs() <= d {
                0.0
            } else {
                x.signum() * m
            }
        }
        _ => {
            let limit = nonlinear_param(request, "a", 1.0).max(0.05);
            (k * x).clamp(-k * limit, k * limit)
        }
    }
}

fn characteristic_signal_output(
    model_id: &str,
    input: f64,
    previous_output: Option<f64>,
    request: &NonlinearAnalysisRequest,
) -> f64 {
    match model_id {
        "hysteresis_relay" => {
            let m = nonlinear_param(request, "M", 1.0).max(0.05);
            let h = nonlinear_param(request, "h", 0.5).max(0.0);
            if input >= h {
                m
            } else if input <= -h {
                -m
            } else {
                previous_output.unwrap_or_else(|| if input >= 0.0 { m } else { -m })
            }
        }
        "backlash" => {
            let k = nonlinear_param(request, "k", 1.0).max(0.05);
            let b = nonlinear_param(request, "b", 0.5).max(0.0);
            let previous = previous_output.unwrap_or(0.0);
            let upper = k * (input - b);
            let lower = k * (input + b);
            previous.clamp(upper.min(lower), upper.max(lower))
        }
        _ => characteristic_value(model_id, input, request),
    }
}

fn compute_negative_inverse(request: &NonlinearAnalysisRequest) -> NonlinearAnalysisResult {
    let min_a = nonlinear_param(request, "A_min", 0.05).max(0.001);
    let max_a = nonlinear_param(request, "A_max", 8.0).max(min_a + 0.01);
    let selected_a = nonlinear_param(request, "A", 2.0).clamp(min_a, max_a);
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
        points.push(ComplexPoint {
            re: value.re,
            im: value.im,
        });
    }

    let mut marks = HashMap::new();
    marks.insert("start".to_string(), "open_circle_start".to_string());
    marks.insert(
        "direction".to_string(),
        "arrow_for_increasing_A".to_string(),
    );
    let selected_point = {
        let n = describing_function(&request.model_id, selected_a, request);
        if n.norm() > 1e-9 {
            let value = -Complex64::new(1.0, 0.0) / n;
            Some(SelectedComplexPoint {
                re: value.re,
                im: value.im,
                amplitude: selected_a,
            })
        } else {
            None
        }
    };

    NonlinearAnalysisResult {
        phase_plane: None,
        negative_inverse: Some(NegativeInverseResult {
            curves: vec![NegativeInverseCurve {
                id: request.model_id.clone(),
                label: request.model_id.replace('_', " "),
                points,
                selected_point,
                marks,
            }],
        }),
        harmonic: None,
        characteristic: None,
        turning_radius: None,
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
        filtered_output.push(CurvePoint {
            x: t,
            y: attenuation * base,
        });
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
                CurvePoint {
                    x: 1.0,
                    y: 4.0 * m / std::f64::consts::PI,
                },
                CurvePoint {
                    x: 3.0,
                    y: 4.0 * m / (3.0 * std::f64::consts::PI),
                },
                CurvePoint {
                    x: 5.0,
                    y: 4.0 * m / (5.0 * std::f64::consts::PI),
                },
            ],
        }),
        characteristic: None,
        turning_radius: None,
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
            let increasing = range.iter().map(|x| CurvePoint {
                x: *x,
                y: if *x >= h { m } else { -m },
            });
            let decreasing = range.iter().rev().map(|x| CurvePoint {
                x: *x,
                y: if *x <= -h { -m } else { m },
            });
            increasing.chain(decreasing).collect::<Vec<_>>()
        }
        "backlash" => {
            let b = nonlinear_param(request, "b", 0.5).max(0.0);
            let increasing = range.iter().map(|x| CurvePoint {
                x: *x,
                y: k * (*x - b),
            });
            let decreasing = range.iter().rev().map(|x| CurvePoint {
                x: *x,
                y: k * (*x + b),
            });
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
    let min_y = curve
        .iter()
        .map(|point| point.y)
        .fold(f64::INFINITY, f64::min);
    let max_y = curve
        .iter()
        .map(|point| point.y)
        .fold(f64::NEG_INFINITY, f64::max);
    let sine_envelope = vec![
        CurvePoint {
            x: -amplitude,
            y: min_y,
        },
        CurvePoint {
            x: -amplitude,
            y: max_y,
        },
        CurvePoint {
            x: amplitude,
            y: max_y,
        },
        CurvePoint {
            x: amplitude,
            y: min_y,
        },
    ];
    let n = describing_function(&request.model_id, amplitude, request);
    let omega = nonlinear_param(request, "omega", 1.0).max(0.05);
    let comparison_samples = request.time_range.samples.clamp(40, 180);
    let end = 2.0 * std::f64::consts::PI / omega;
    let comparison_times = linspace(0.0, end, comparison_samples);
    let mut comparison_input = Vec::with_capacity(comparison_samples);
    let mut comparison_output = Vec::with_capacity(comparison_samples);
    let mut previous_output = None;
    for t in comparison_times {
        let input = amplitude * (omega * t).sin();
        let output =
            characteristic_signal_output(&request.model_id, input, previous_output, request);
        previous_output = Some(output);
        comparison_input.push(CurvePoint { x: t, y: input });
        comparison_output.push(CurvePoint { x: t, y: output });
    }
    NonlinearAnalysisResult {
        phase_plane: None,
        negative_inverse: None,
        harmonic: None,
        characteristic: Some(CharacteristicResult {
            curve,
            sine_envelope,
            signal_comparison: SignalComparisonResult {
                input: comparison_input,
                output: comparison_output,
            },
            describing_function: ComplexPoint { re: n.re, im: n.im },
        }),
        turning_radius: None,
        summary: NonlinearSummary {
            outcome: "输入输出特性与当前描述函数参数已联动".to_string(),
            metrics: vec![format!("N(A)=({:.3},{:.3})", n.re, n.im)],
        },
    }
}

fn compute_turning_radius(request: &NonlinearAnalysisRequest) -> NonlinearAnalysisResult {
    let samples = request.time_range.samples.max(2);
    let start = request.time_range.start;
    let end = request.time_range.end.max(start + 1e-6);
    let r_m = nonlinear_param(request, "R_m", 140.0).clamp(35.0, 160.0);
    let v = 4.0;
    let delta_max = 18.0_f64.to_radians();
    let length = 34.0;
    let obstacle_x = 145.0;
    let obstacle_y = -5.0;
    let obstacle_radius = 25.0;
    let safety_margin = 16.0;
    let clearance = obstacle_radius + safety_margin;
    let start_radius = (clearance * (2.0 * r_m + clearance)).sqrt();
    let delta_needed = (length / r_m).atan();
    let mut delta_cmd: f64 = 0.0;
    let mut psi: f64 = 0.0;
    let mut x: f64 = 0.0;
    let mut y: f64 = 0.0;
    let mut active = false;
    let rate_limit = 12.0_f64.to_radians();
    let dt = (end - start) / (samples - 1) as f64;

    let mut delta_points = Vec::with_capacity(samples);
    let mut delta_target_points = Vec::with_capacity(samples);
    let mut actual_path = Vec::with_capacity(samples);
    let mut nominal_path = Vec::with_capacity(samples);
    let mut max_delta = 0.0_f64;
    let mut min_clearance = f64::INFINITY;

    for index in 0..samples {
        let t = start + dt * index as f64;
        if index > 0 {
            let prev_dist = ((obstacle_x - x).powi(2) + (obstacle_y - y).powi(2)).sqrt();
            if !active && prev_dist <= start_radius {
                active = true;
            }
            let delta_target = if active && psi < 45.0_f64.to_radians() {
                delta_needed
            } else {
                0.0
            };
            let target = delta_target.clamp(-delta_max, delta_max);
            let step = (target - delta_cmd).clamp(-rate_limit * dt, rate_limit * dt);
            delta_cmd += step;
            let yaw_rate = v / length * delta_cmd.tan();
            psi += dt * yaw_rate;
            x += dt * v * psi.cos();
            y += dt * v * psi.sin();
        }

        let distance = ((obstacle_x - x).powi(2) + (obstacle_y - y).powi(2)).sqrt();
        min_clearance = min_clearance.min(distance);
        max_delta = max_delta.max(delta_cmd.abs());
        let progress = (psi / 45.0_f64.to_radians()).clamp(0.0, 1.0);
        let nominal_theta = progress * 45.0_f64.to_radians();
        let nominal_x = obstacle_x - start_radius + r_m * nominal_theta.sin();
        let nominal_y = r_m * (1.0 - nominal_theta.cos());
        let delta_target_deg = if active && psi < 45.0_f64.to_radians() {
            delta_needed.to_degrees()
        } else {
            0.0
        };

        delta_points.push(CurvePoint {
            x: t,
            y: delta_cmd.to_degrees(),
        });
        delta_target_points.push(CurvePoint {
            x: t,
            y: delta_target_deg,
        });
        actual_path.push(CurvePoint { x, y });
        nominal_path.push(CurvePoint {
            x: nominal_x,
            y: nominal_y,
        });
    }

    let saturation_active = delta_needed > delta_max || max_delta >= delta_max * 0.98;
    let collision_active = min_clearance < obstacle_radius;
    let safety_constraint_satisfied = min_clearance >= clearance;
    let outcome = if collision_active {
        "当前规划半径会进入障碍物碰撞区域"
    } else if !safety_constraint_satisfied {
        "当前规划半径未留足安全裕量，处在贴近风险边界"
    } else if saturation_active {
        "当前规划半径触发舵角饱和，需把执行约束回写给规划层"
    } else {
        "当前规划半径满足舵角与安全约束"
    };

    NonlinearAnalysisResult {
        phase_plane: None,
        negative_inverse: None,
        harmonic: None,
        characteristic: None,
        turning_radius: Some(TurningRadiusResult {
            d_start_m: start_radius,
            delta_d_deg: delta_needed.to_degrees(),
            max_delta_deg: max_delta.to_degrees(),
            saturation_active,
            min_distance_m: min_clearance,
            collision_active,
            safety_constraint_satisfied,
            heading_curves: vec![
                TurningHeadingCurve {
                    id: "actual_delta".to_string(),
                    label: "实际舵角".to_string(),
                    points: delta_points,
                },
                TurningHeadingCurve {
                    id: "target_delta".to_string(),
                    label: "目标舵角".to_string(),
                    points: delta_target_points,
                },
            ],
            path: TurningRadiusPath {
                actual: actual_path,
                nominal: nominal_path,
                obstacle_center: CurvePoint {
                    x: obstacle_x,
                    y: obstacle_y,
                },
                obstacle_radius,
                clearance_radius: clearance,
            },
        }),
        summary: NonlinearSummary {
            outcome: outcome.to_string(),
            metrics: vec![
                format!("R={:.0} m", r_m),
                format!("d_start={:.1} m", start_radius),
                format!("delta_d={:.2} deg", delta_needed.to_degrees()),
                format!("min_distance={:.1} m", min_clearance),
                format!("collision={}", collision_active),
            ],
        },
    }
}

fn compute_nonlinear_analysis_inner(request: &NonlinearAnalysisRequest) -> NonlinearAnalysisResult {
    match request.analysis_kind.as_str() {
        "phase_plane" => compute_phase_plane(request),
        "negative_inverse_family" => compute_negative_inverse(request),
        "harmonic_lowpass" => compute_harmonic(request),
        "turning_radius" => compute_turning_radius(request),
        _ => compute_characteristic(request),
    }
}

fn clamp(value: f64, min_value: f64, max_value: f64) -> f64 {
    value.max(min_value).min(max_value)
}

fn seeded_noise(seed: u64, index: usize) -> f64 {
    let mut x = seed ^ ((index as u64 + 1).wrapping_mul(0x9E37_79B9_7F4A_7C15));
    x ^= x >> 12;
    x ^= x << 25;
    x ^= x >> 27;
    let scaled = x.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 11;
    (scaled as f64 / ((1_u64 << 53) as f64)) * 2.0 - 1.0
}

fn parameter_strings(parameters: &HashMap<String, Value>) -> HashMap<String, String> {
    parameters
        .iter()
        .map(|(key, value)| {
            let text = match value {
                Value::String(item) => item.clone(),
                Value::Number(item) => item.to_string(),
                Value::Bool(item) => item.to_string(),
                _ => value.to_string(),
            };
            (key.clone(), text)
        })
        .collect()
}

fn parameter_numeric(parameters: &HashMap<String, Value>, key: &str, fallback: f64) -> f64 {
    match parameters.get(key) {
        Some(Value::Number(value)) => value.as_f64().unwrap_or(fallback),
        Some(Value::String(value)) => value.parse::<f64>().unwrap_or(fallback),
        _ => fallback,
    }
}

fn discrete_index(value: f64, min_value: f64, max_value: f64, bins: usize) -> usize {
    let ratio = ((value - min_value) / (max_value - min_value)).clamp(0.0, 0.999_999);
    (ratio * bins as f64).floor() as usize
}

fn greedy_action_index(q_values: &[f64]) -> usize {
    q_values
        .iter()
        .enumerate()
        .max_by(|(_, left), (_, right)| left.partial_cmp(right).unwrap_or(Ordering::Equal))
        .map(|(index, _)| index)
        .unwrap_or(0)
}

fn append_reward_point(
    rewards: &mut Vec<RlRewardPoint>,
    window: &mut Vec<f64>,
    episode: usize,
    reward: f64,
) -> RlRewardPoint {
    window.push(reward);
    if window.len() > 20 {
        window.remove(0);
    }
    let moving_average = window.iter().sum::<f64>() / window.len() as f64;
    let point = RlRewardPoint {
        episode: episode + 1,
        reward,
        moving_average,
    };
    rewards.push(point.clone());
    point
}

fn absolute_decay_epsilon(initial: f64, minimum: f64, episode: usize, decay_scale: f64) -> f64 {
    (minimum + (initial - minimum) * (-(episode as f64) / decay_scale.max(1.0)).exp()).max(minimum)
}

fn run_toy_q_learning_chunk(
    seed: u64,
    chunk: usize,
    action_cost: f64,
    boundary_penalty: f64,
    training_state: Option<RlTrainingState>,
) -> (RlTrainingState, Vec<RlRewardPoint>) {
    let state_bins = 17;
    let actions = [-0.18_f64, 0.0, 0.18];
    let mut state = training_state.unwrap_or_else(|| RlTrainingState {
        next_episode: 0,
        q_table: vec![vec![0.0; actions.len()]; state_bins],
        reward_window: Vec::new(),
        reward_history: Vec::new(),
    });
    if state.q_table.len() != state_bins
        || state.q_table.iter().any(|row| row.len() != actions.len())
    {
        state.q_table = vec![vec![0.0; actions.len()]; state_bins];
        state.next_episode = 0;
        state.reward_window.clear();
        state.reward_history.clear();
    }
    let start_episode = state.next_episode;
    let end_episode = start_episode.saturating_add(chunk);
    let mut reward_chunk = Vec::with_capacity(chunk);

    for episode in start_episode..end_episode {
        let mut y = 1.8 * seeded_noise(seed, episode * 17 + 1);
        let mut episode_reward = 0.0;
        for step in 0..34 {
            let state_index = discrete_index(y, -2.0, 2.0, state_bins);
            let epsilon = absolute_decay_epsilon(0.38, 0.035, episode, 70.0);
            let explore = seeded_noise(seed, episode * 101 + step) > 1.0 - 2.0 * epsilon;
            let action_index = if explore {
                ((seeded_noise(seed, episode * 131 + step).abs() * actions.len() as f64) as usize)
                    .min(actions.len() - 1)
            } else {
                greedy_action_index(&state.q_table[state_index])
            };
            let action = actions[action_index];
            let previous_error = y.abs();
            y = clamp(
                y + action + seeded_noise(seed, episode * 211 + step) * 0.015,
                -2.3,
                2.3,
            );
            let next_state = discrete_index(y, -2.0, 2.0, state_bins);
            let reward = (previous_error - y.abs()) * 4.0
                - action_cost * action.abs() * 8.0
                - if y.abs() > 2.0 { boundary_penalty } else { 0.0 };
            let next_best = state.q_table[next_state]
                .iter()
                .copied()
                .fold(f64::NEG_INFINITY, f64::max);
            let current = state.q_table[state_index][action_index];
            state.q_table[state_index][action_index] =
                current + 0.18 * (reward + 0.92 * next_best - current);
            episode_reward += reward;
        }
        let point = append_reward_point(
            &mut state.reward_history,
            &mut state.reward_window,
            episode,
            episode_reward,
        );
        reward_chunk.push(point);
    }

    state.next_episode = end_episode;
    (state, reward_chunk)
}

#[derive(Clone, Copy)]
struct HeadingRlState {
    heading_deg: f64,
    yaw_rate_deg: f64,
    rudder_deg: f64,
}

struct HeadingScenario {
    reference_deg: f64,
    disturbance_deg: f64,
    edge_scenario: f64,
}

struct HeadingEvaluation {
    comparison_trace: Vec<RlComparisonPoint>,
    metrics: RlTrainingMetrics,
    safety_fallback_count: usize,
}

fn heading_scenario(t: f64) -> HeadingScenario {
    let reference_deg = if t < 30.0 {
        0.0
    } else if t < 110.0 {
        12.0
    } else {
        -6.0
    };
    let disturbance_deg = if (55.0..95.0).contains(&t) {
        2.4
    } else if (125.0..145.0).contains(&t) {
        -3.2
    } else if (150.0..156.0).contains(&t) {
        4.1
    } else {
        0.0
    };
    let edge_scenario = if (132.0..162.0).contains(&t) {
        1.0
    } else {
        0.0
    };
    HeadingScenario {
        reference_deg,
        disturbance_deg,
        edge_scenario,
    }
}

fn heading_state_index(error_deg: f64, yaw_rate_deg: f64) -> usize {
    let error_bins = 25;
    let rate_bins = 11;
    discrete_index(error_deg, -24.0, 24.0, error_bins) * rate_bins
        + discrete_index(yaw_rate_deg, -2.6, 2.6, rate_bins)
}

fn step_heading_nomoto(
    state: HeadingRlState,
    rudder_target_deg: f64,
    t: f64,
    dt: f64,
) -> HeadingRlState {
    let scenario = heading_scenario(t);
    let max_rudder = 16.0;
    let max_rudder_rate = 0.85;
    let target = clamp(rudder_target_deg, -max_rudder, max_rudder);
    let rudder_step = clamp(
        target - state.rudder_deg,
        -max_rudder_rate * dt,
        max_rudder_rate * dt,
    );
    let rudder = clamp(state.rudder_deg + rudder_step, -max_rudder, max_rudder);
    let t_nomoto = if scenario.edge_scenario > 0.0 {
        18.0
    } else {
        12.0
    };
    let k_nomoto = if scenario.edge_scenario > 0.0 {
        0.24
    } else {
        0.36
    };
    let yaw_accel =
        (k_nomoto * rudder - state.yaw_rate_deg) / t_nomoto + scenario.disturbance_deg * 0.014;
    let yaw_rate = clamp(state.yaw_rate_deg + yaw_accel * dt, -3.0, 3.0);
    let heading = state.heading_deg + yaw_rate * dt;
    HeadingRlState {
        heading_deg: heading,
        yaw_rate_deg: yaw_rate,
        rudder_deg: rudder,
    }
}

fn pid_rudder_command(
    error_deg: f64,
    yaw_rate_deg: f64,
    integral_error: &mut f64,
    dt: f64,
    gains: (f64, f64, f64),
) -> f64 {
    *integral_error = clamp(*integral_error + error_deg * dt, -160.0, 160.0);
    let (kp, ki, kd) = gains;
    clamp(
        kp * error_deg + ki * *integral_error - kd * yaw_rate_deg,
        -16.0,
        16.0,
    )
}

fn training_gains(training_type: &str, action_index: usize) -> (f64, f64, f64) {
    match training_type {
        "rl_pid_schedule" => match action_index {
            0 => (0.72, 0.008, 4.8),
            1 => (0.92, 0.012, 5.7),
            2 => (1.12, 0.016, 6.4),
            3 => (1.28, 0.018, 7.2),
            _ => (1.42, 0.020, 8.0),
        },
        _ => (1.05, 0.014, 6.0),
    }
}

fn rl_rudder_command(
    training_type: &str,
    action_index: usize,
    state: HeadingRlState,
    error_deg: f64,
    integral_error: &mut f64,
    dt: f64,
    action_step: f64,
    disturbance_bias: f64,
) -> f64 {
    let actions = [-1.0_f64, -0.5, 0.0, 0.5, 1.0];
    if training_type == "rl_pid_schedule" {
        let gains = training_gains(training_type, action_index);
        return pid_rudder_command(error_deg, state.yaw_rate_deg, integral_error, dt, gains)
            + disturbance_bias * 2.0;
    }
    let base_command = pid_rudder_command(
        error_deg,
        state.yaw_rate_deg,
        integral_error,
        dt,
        (0.98, 0.012, 5.4),
    );
    clamp(
        base_command + actions[action_index] * action_step,
        -16.0,
        16.0,
    )
}

fn run_heading_q_learning_chunk(
    seed: u64,
    chunk: usize,
    training_type: &str,
    parameters: &HashMap<String, Value>,
    training_state: Option<RlTrainingState>,
) -> (RlTrainingState, Vec<RlRewardPoint>) {
    let state_count = 25 * 11;
    let actions = [-1.0_f64, -0.5, 0.0, 0.5, 1.0];
    let mut training_state = training_state.unwrap_or_else(|| RlTrainingState {
        next_episode: 0,
        q_table: vec![vec![0.0; actions.len()]; state_count],
        reward_window: Vec::new(),
        reward_history: Vec::new(),
    });
    if training_state.q_table.len() != state_count
        || training_state
            .q_table
            .iter()
            .any(|row| row.len() != actions.len())
    {
        training_state.q_table = vec![vec![0.0; actions.len()]; state_count];
        training_state.next_episode = 0;
        training_state.reward_window.clear();
        training_state.reward_history.clear();
    }
    let exploration_decay = parameter_numeric(parameters, "explorationDecay", 0.5).clamp(0.2, 0.85);
    let action_step = parameter_numeric(parameters, "actionStepDeg", 2.5).clamp(1.0, 5.0);
    let error_weight = parameter_numeric(parameters, "errorPenaltyWeight", 1.0).clamp(0.6, 1.8);
    let rudder_rate_weight =
        parameter_numeric(parameters, "rudderRatePenaltyWeight", 0.5).clamp(0.2, 1.2);
    let safety_weight = parameter_numeric(parameters, "safetyPenaltyWeight", 1.4).clamp(0.8, 2.4);
    let switch_penalty = parameter_numeric(parameters, "switchPenaltyWeight", 0.4).clamp(0.1, 1.0);
    let disturbance_bias = parameter_numeric(parameters, "disturbanceBias", 0.1).clamp(-0.4, 0.4);
    let dt = 0.5;
    let start_episode = training_state.next_episode;
    let end_episode = start_episode.saturating_add(chunk);
    let mut reward_chunk = Vec::with_capacity(chunk);

    for episode in start_episode..end_episode {
        let mut state = HeadingRlState {
            heading_deg: seeded_noise(seed, episode * 19) * 2.0,
            yaw_rate_deg: 0.0,
            rudder_deg: 0.0,
        };
        let mut integral_error = 0.0;
        let mut episode_reward = 0.0;
        let mut t = 0.0;
        while t <= 180.0 + 1e-9 {
            let scenario = heading_scenario(t);
            let error = scenario.reference_deg - state.heading_deg;
            let state_index = heading_state_index(error, state.yaw_rate_deg);
            let epsilon =
                absolute_decay_epsilon(0.52, 0.035, episode, 95.0 * (1.0 + exploration_decay));
            let explore =
                seeded_noise(seed, episode * 97 + (t / dt) as usize) > 1.0 - 2.0 * epsilon;
            let action_index = if explore {
                ((seeded_noise(seed, episode * 149 + (t / dt) as usize).abs()
                    * actions.len() as f64) as usize)
                    .min(actions.len() - 1)
            } else {
                greedy_action_index(&training_state.q_table[state_index])
            };
            let previous_error = error.abs();
            let previous_rudder = state.rudder_deg;
            let command = rl_rudder_command(
                training_type,
                action_index,
                state,
                error,
                &mut integral_error,
                dt,
                action_step,
                disturbance_bias,
            );
            state = step_heading_nomoto(state, command, t, dt);
            let next_scenario = heading_scenario(t + dt);
            let next_error = next_scenario.reference_deg - state.heading_deg;
            let rudder_rate = (state.rudder_deg - previous_rudder).abs() / dt;
            let safety_penalty = if training_type == "safe_shell_rl"
                && (next_error.abs()
                    > parameter_numeric(parameters, "safetyErrorThresholdDeg", 9.0)
                    || state.yaw_rate_deg.abs()
                        > parameter_numeric(parameters, "yawRateThreshold", 0.35) * 4.0
                    || rudder_rate
                        > parameter_numeric(parameters, "rudderRateThreshold", 0.7) * 2.0)
            {
                safety_weight
            } else {
                0.0
            };
            let route_penalty = if training_type == "rl_pid_schedule" {
                switch_penalty * rudder_rate * 0.12
            } else {
                rudder_rate_weight * rudder_rate * 0.10
            };
            let reward = (previous_error - next_error.abs()) * 1.2
                - error_weight * next_error.abs() * 0.055
                - state.yaw_rate_deg.abs() * 0.16
                - state.rudder_deg.abs() * 0.030
                - route_penalty
                - safety_penalty
                + if next_error.abs() < 1.2 { 0.18 } else { 0.0 };
            let next_state = heading_state_index(next_error, state.yaw_rate_deg);
            let next_best = training_state.q_table[next_state]
                .iter()
                .copied()
                .fold(f64::NEG_INFINITY, f64::max);
            let current = training_state.q_table[state_index][action_index];
            training_state.q_table[state_index][action_index] =
                current + 0.12 * (reward + 0.94 * next_best - current);
            episode_reward += reward;
            t += dt;
        }
        let point = append_reward_point(
            &mut training_state.reward_history,
            &mut training_state.reward_window,
            episode,
            episode_reward,
        );
        reward_chunk.push(point);
    }

    training_state.next_episode = end_episode;
    (training_state, reward_chunk)
}

fn compute_toy_rl_training(request: &RlTrainingRequest) -> RlTrainingResult {
    let seed = request.seed.unwrap_or(5505);
    let initial_next_episode = request
        .training_state
        .as_ref()
        .map(|state| state.next_episode)
        .unwrap_or(0);
    let target_total = request.training_episodes.unwrap_or_else(|| {
        initial_next_episode.saturating_add(request.episode_chunk.unwrap_or(80))
    });
    let chunk = request
        .episode_chunk
        .unwrap_or_else(|| target_total.saturating_sub(initial_next_episode))
        .min(1200);
    let action_cost = parameter_numeric(&request.selected_parameters, "actionCost", 0.04);
    let boundary_penalty = parameter_numeric(&request.selected_parameters, "boundaryPenalty", 1.0);
    let (training_state, reward_chunk) = run_toy_q_learning_chunk(
        seed,
        chunk,
        action_cost,
        boundary_penalty,
        request.training_state.clone(),
    );
    let should_evaluate = request.evaluate.unwrap_or(true);
    let reward_curve = if should_evaluate {
        training_state.reward_history.clone()
    } else {
        reward_chunk.clone()
    };
    let mut comparison_trace = Vec::new();
    if should_evaluate {
        let actions = [-0.18_f64, 0.0, 0.18];
        let mut learned_y = 1.2;
        for index in 0..61 {
            let t = index as f64;
            let random = 1.2 * (-0.035 * t).exp() + seeded_noise(seed, index) * 0.12;
            let explicit = 1.2 * (-0.16 * t).exp();
            if index > 0 {
                let state = discrete_index(learned_y, -2.0, 2.0, training_state.q_table.len());
                let action = actions[greedy_action_index(&training_state.q_table[state])];
                learned_y = clamp(learned_y + action, -2.0, 2.0);
            }
            let learned = learned_y;
            comparison_trace.push(RlComparisonPoint {
                t,
                reference: 0.0,
                pid: explicit,
                rl: learned,
                rudder_pid: -0.45 * explicit,
                rudder_rl: -0.42 * learned + random * 0.02,
                disturbance: 0.0,
                edge_scenario: 0.0,
            });
        }
    }
    let final_error = comparison_trace
        .last()
        .map(|point| point.rl.abs())
        .unwrap_or(0.03);
    let cumulative_reward = reward_curve
        .last()
        .map(|point| point.moving_average)
        .unwrap_or(0.0);

    RlTrainingResult {
        panel_kind: request.panel_kind.clone(),
        training_type: request
            .training_type
            .clone()
            .unwrap_or_else(|| "toy_rl".to_string()),
        seed,
        selected_parameters: parameter_strings(&request.selected_parameters),
        training_episodes: training_state.next_episode,
        reward_curve,
        reward_chunk,
        comparison_trace,
        metrics: RlTrainingMetrics {
            rms_heading_error: final_error,
            max_overshoot: 0.0,
            settling_time: 24.0,
            average_rudder: 0.18,
            average_rudder_rate: 0.04,
            final_error,
            cumulative_reward,
        },
        safety_fallback_count: 0,
        training_state: Some(training_state),
    }
}

fn evaluate_heading_policy(
    seed: u64,
    training_type: &str,
    q_table: &[Vec<f64>],
    parameters: &HashMap<String, Value>,
    cumulative_reward: f64,
) -> HeadingEvaluation {
    let dt = 0.5;
    let action_step = parameter_numeric(parameters, "actionStepDeg", 2.5).clamp(1.0, 5.0);
    let safety_error_threshold =
        parameter_numeric(parameters, "safetyErrorThresholdDeg", 9.0).clamp(5.0, 14.0);
    let fallback_sensitivity =
        parameter_numeric(parameters, "fallbackSensitivity", 0.7).clamp(0.3, 1.0);
    let disturbance_bias = parameter_numeric(parameters, "disturbanceBias", 0.1).clamp(-0.4, 0.4);
    let mut pid_state = HeadingRlState {
        heading_deg: 0.0,
        yaw_rate_deg: 0.0,
        rudder_deg: 0.0,
    };
    let mut rl_state = HeadingRlState {
        heading_deg: seeded_noise(seed, 17) * 0.25,
        yaw_rate_deg: 0.0,
        rudder_deg: 0.0,
    };
    let mut pid_integral = 0.0;
    let mut rl_integral = 0.0;
    let mut comparison_trace = Vec::new();
    let mut safety_fallback_count = 0;
    let mut t = 0.0;

    while t <= 180.0 + 1e-9 {
        let scenario = heading_scenario(t);
        let pid_error = scenario.reference_deg - pid_state.heading_deg;
        let pid_command = pid_rudder_command(
            pid_error,
            pid_state.yaw_rate_deg,
            &mut pid_integral,
            dt,
            (1.0, 0.012, 5.8),
        );
        let rl_error = scenario.reference_deg - rl_state.heading_deg;
        let state_index = heading_state_index(rl_error, rl_state.yaw_rate_deg);
        let action_index = q_table
            .get(state_index)
            .map(|row| greedy_action_index(row))
            .unwrap_or(2);
        let mut rl_command = rl_rudder_command(
            training_type,
            action_index,
            rl_state,
            rl_error,
            &mut rl_integral,
            dt,
            action_step,
            disturbance_bias,
        );

        if training_type == "safe_shell_rl"
            && (rl_error.abs() > safety_error_threshold || scenario.edge_scenario > 0.0)
        {
            let fallback_command = pid_rudder_command(
                rl_error,
                rl_state.yaw_rate_deg,
                &mut rl_integral,
                dt,
                (1.16, 0.014, 6.8),
            );
            rl_command =
                (1.0 - fallback_sensitivity) * rl_command + fallback_sensitivity * fallback_command;
            safety_fallback_count += 1;
        }

        if training_type == "rl_pid_schedule" && scenario.edge_scenario > 0.0 {
            rl_command *= 0.82;
        }

        comparison_trace.push(RlComparisonPoint {
            t,
            reference: scenario.reference_deg,
            pid: pid_state.heading_deg,
            rl: rl_state.heading_deg,
            rudder_pid: pid_state.rudder_deg,
            rudder_rl: rl_state.rudder_deg,
            disturbance: scenario.disturbance_deg,
            edge_scenario: scenario.edge_scenario,
        });

        pid_state = step_heading_nomoto(pid_state, pid_command, t, dt);
        rl_state = step_heading_nomoto(rl_state, rl_command, t, dt);
        t += dt;
    }

    let mut squared_error_sum = 0.0;
    let mut max_overshoot: f64 = 0.0;
    let mut rudder_sum = 0.0;
    let mut rudder_rate_sum = 0.0;
    let mut previous_rudder = comparison_trace
        .first()
        .map(|point| point.rudder_rl)
        .unwrap_or(0.0);
    for point in &comparison_trace {
        let error = point.reference - point.rl;
        squared_error_sum += error * error;
        max_overshoot = max_overshoot.max((point.rl - point.reference).max(0.0));
        rudder_sum += point.rudder_rl.abs();
        rudder_rate_sum += (point.rudder_rl - previous_rudder).abs() / dt;
        previous_rudder = point.rudder_rl;
    }
    let count = comparison_trace.len().max(1) as f64;
    let settling_time = comparison_trace
        .iter()
        .find(|point| {
            point.t >= 110.0
                && comparison_trace
                    .iter()
                    .filter(|candidate| candidate.t >= point.t)
                    .all(|candidate| (candidate.reference - candidate.rl).abs() < 1.8)
        })
        .map(|point| point.t)
        .unwrap_or_else(|| {
            comparison_trace
                .last()
                .map(|point| point.t)
                .unwrap_or(180.0)
        });
    let final_error = comparison_trace
        .last()
        .map(|point| (point.reference - point.rl).abs())
        .unwrap_or(0.0);

    HeadingEvaluation {
        comparison_trace,
        metrics: RlTrainingMetrics {
            rms_heading_error: (squared_error_sum / count).sqrt(),
            max_overshoot,
            settling_time,
            average_rudder: rudder_sum / count,
            average_rudder_rate: rudder_rate_sum / count,
            final_error,
            cumulative_reward,
        },
        safety_fallback_count,
    }
}

fn compute_heading_rl_training(request: &RlTrainingRequest) -> RlTrainingResult {
    let training_type = request
        .training_type
        .clone()
        .unwrap_or_else(|| "direct_rl".to_string());
    let seed = request.seed.unwrap_or(5515);
    let initial_next_episode = request
        .training_state
        .as_ref()
        .map(|state| state.next_episode)
        .unwrap_or(0);
    let target_total = request.training_episodes.unwrap_or_else(|| {
        initial_next_episode.saturating_add(request.episode_chunk.unwrap_or(140))
    });
    let chunk = request
        .episode_chunk
        .unwrap_or_else(|| target_total.saturating_sub(initial_next_episode))
        .min(1200);
    let (training_state, reward_chunk) = run_heading_q_learning_chunk(
        seed,
        chunk,
        &training_type,
        &request.selected_parameters,
        request.training_state.clone(),
    );
    let should_evaluate = request.evaluate.unwrap_or(true);
    let reward_curve = if should_evaluate {
        training_state.reward_history.clone()
    } else {
        reward_chunk.clone()
    };
    let cumulative_reward = reward_curve
        .last()
        .map(|point| point.moving_average)
        .unwrap_or(0.0);
    let evaluation = if should_evaluate {
        evaluate_heading_policy(
            seed,
            &training_type,
            &training_state.q_table,
            &request.selected_parameters,
            cumulative_reward,
        )
    } else {
        HeadingEvaluation {
            comparison_trace: Vec::new(),
            metrics: RlTrainingMetrics {
                rms_heading_error: 0.0,
                max_overshoot: 0.0,
                settling_time: 0.0,
                average_rudder: 0.0,
                average_rudder_rate: 0.0,
                final_error: 0.0,
                cumulative_reward,
            },
            safety_fallback_count: 0,
        }
    };

    RlTrainingResult {
        panel_kind: request.panel_kind.clone(),
        training_type,
        seed,
        selected_parameters: parameter_strings(&request.selected_parameters),
        training_episodes: training_state.next_episode,
        reward_curve,
        reward_chunk,
        comparison_trace: evaluation.comparison_trace,
        metrics: evaluation.metrics,
        safety_fallback_count: evaluation.safety_fallback_count,
        training_state: Some(training_state),
    }
}

fn compute_rl_training_inner(request: &RlTrainingRequest) -> RlTrainingResult {
    if request.panel_kind == "rust_toy_training_panel"
        || request.panel_kind == "toy_rl_training_panel"
    {
        compute_toy_rl_training(request)
    } else {
        compute_heading_rl_training(request)
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
pub fn compute_rl_training(request_json: &str) -> Result<String, JsValue> {
    let request: RlTrainingRequest = serde_json::from_str(request_json)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    let result = compute_rl_training_inner(&request);
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
            nyquist: None,
            root_locus: RootLocusConfig {
                min_gain: 0.0,
                max_gain: 2.0,
                samples: 16,
                current_gain: 1.0,
                increment: None,
                sampling_mode: None,
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
            nyquist: None,
            root_locus: RootLocusConfig {
                min_gain: 0.0,
                max_gain: 12.0,
                samples: 96,
                current_gain: gain,
                increment: None,
                sampling_mode: None,
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
            nyquist: None,
            root_locus: RootLocusConfig {
                min_gain: 0.0,
                max_gain: 24.0,
                samples: 120,
                current_gain: gain,
                increment: None,
                sampling_mode: None,
            },
            feasible_region: Some(FeasibleRegionConfig {
                zeta_min: 0.5911550337988976,
                sigma_min: 20.0,
                mp_ratio: Some(0.1),
                settling_time: Some(0.2),
            }),
        }
    }

    fn unit_3_3_step_05_request(gain: f64) -> ControlAnalysisRequest {
        ControlAnalysisRequest {
            runtime_mode: "analysis".to_string(),
            _case_id: Some("unit-3-3-step-05-condition-workspace".to_string()),
            plant: TransferFunctionSpec {
                numerator: vec![1.0, 3.5],
                denominator: vec![1.0, 2.9, 0.78],
            },
            structures: vec![StructureSpec {
                kind: "gain".to_string(),
                enabled: true,
                params: HashMap::from([(String::from("k"), gain)]),
            }],
            outputs: vec!["root_locus".to_string()],
            response_type: ResponseType::Step,
            time_range: TimeRangeConfig {
                start: 0.0,
                end: 8.0,
                samples: 240,
            },
            frequency_range: FrequencyRangeConfig {
                min: 1e-2,
                max: 1e2,
                samples: 240,
            },
            nyquist: None,
            root_locus: RootLocusConfig {
                min_gain: 0.0,
                max_gain: 20.0,
                samples: 30,
                current_gain: gain,
                increment: None,
                sampling_mode: None,
            },
            feasible_region: None,
        }
    }

    #[test]
    fn unit_3_3_step_05_root_locus_keeps_valid_stationary_points() {
        let result = compute_analysis_inner(&unit_3_3_step_05_request(2.0));
        let stationary = &result.root_locus.stationary_points;

        assert_eq!(stationary.len(), 2);
        assert!(stationary.iter().any(|point| {
            (point.re + 1.8029).abs() < 2e-3
                && point.im.abs() < 1e-8
                && (point.gain - 0.7059).abs() < 2e-3
        }));
        assert!(stationary.iter().any(|point| {
            (point.re + 5.1971).abs() < 2e-3
                && point.im.abs() < 1e-8
                && (point.gain - 7.4941).abs() < 2e-3
        }));
        assert!(result
            .root_locus
            .gains
            .iter()
            .any(|gain| (gain - 0.7059).abs() < 2e-3));
        assert!(result
            .root_locus
            .gains
            .iter()
            .any(|gain| (gain - 7.4941).abs() < 2e-3));
    }

    #[test]
    fn unit_3_3_step_05_root_locus_sorts_branches_without_crossing_complex_halves() {
        let result = compute_analysis_inner(&unit_3_3_step_05_request(2.0));

        assert_eq!(result.root_locus.branches.len(), 2);
        assert!(result
            .root_locus
            .branches
            .iter()
            .all(|branch| branch.len() > 30));
        for branch in &result.root_locus.branches {
            let complex_signs: Vec<i32> = branch
                .iter()
                .filter(|point| point.im.abs() > 1e-5)
                .map(|point| point.im.signum() as i32)
                .collect();
            if let Some(first) = complex_signs.first() {
                assert!(
                    complex_signs.iter().all(|sign| sign == first),
                    "complex branch changed imaginary sign: {:?}",
                    complex_signs
                );
            }
            assert!(branch.iter().all(|point| point.branch_id.is_some()));
            assert!(branch.iter().all(|point| point.sample_index.is_some()));
        }
    }

    #[test]
    fn fixed_root_locus_sampling_keeps_explicit_increment_and_range() {
        let mut request = unit_3_3_step_05_request(2.0);
        request.root_locus.min_gain = 0.0;
        request.root_locus.max_gain = 4.0;
        request.root_locus.samples = 99;
        request.root_locus.increment = Some(1.0);
        request.root_locus.sampling_mode = Some(SamplingMode::Fixed);

        let result = compute_analysis_inner(&request);

        assert_eq!(result.root_locus.gains.len(), 6);
        assert_eq!(result.root_locus.gains.first().copied(), Some(0.0));
        assert_eq!(result.root_locus.gains.last().copied(), Some(4.0));
        assert!(result
            .root_locus
            .gains
            .iter()
            .any(|gain| (gain - 0.7059).abs() < 2e-3));
        assert!(result.root_locus.gains.iter().all(|gain| *gain <= 4.0));
        assert!(result
            .root_locus
            .branches
            .iter()
            .all(|branch| branch.len() == 6));
    }

    #[test]
    fn root_locus_returns_auxiliary_rule_data() {
        let result = compute_analysis_inner(&ship_heading_request(1.0));

        assert!(!result.root_locus.real_axis_segments.is_empty());
        assert!(!result.root_locus.asymptotes.is_empty());
        assert!(result
            .root_locus
            .departure_angles
            .iter()
            .all(|angle| angle.angle_deg.is_finite()));
        assert!(result
            .root_locus
            .arrival_angles
            .iter()
            .all(|angle| angle.angle_deg.is_finite()));
        assert!(result
            .root_locus
            .imaginary_axis_crossings
            .iter()
            .all(|point| point.gain.is_finite() && point.gain >= 0.0));
    }

    #[test]
    fn ship_heading_zero_gain_keeps_all_outputs_finite() {
        let result = compute_analysis_inner(&ship_heading_request(0.0));

        assert!(result
            .magnitude
            .points
            .iter()
            .all(|point| point.x.is_finite() && point.y.is_finite()));
        assert!(result
            .phase
            .points
            .iter()
            .all(|point| point.x.is_finite() && point.y.is_finite()));
        assert!(result
            .nyquist
            .points
            .iter()
            .all(|point| point.re.is_finite() && point.im.is_finite()));
    }

    #[test]
    fn nyquist_returns_full_contour_metadata_and_key_points() {
        let mut request = ship_heading_request(1.0);
        request.nyquist = Some(NyquistConfig {
            mode: Some(NyquistPlotMode::Full),
            sampling_mode: Some(SamplingMode::Adaptive),
        });

        let result = compute_analysis_inner(&request);

        assert_eq!(result.nyquist.mode, NyquistPlotMode::Full);
        assert!(!result.nyquist.positive_points.is_empty());
        assert_eq!(
            result.nyquist.positive_points.len(),
            result.nyquist.negative_points.len()
        );
        assert!(result.nyquist.points.len() >= result.nyquist.positive_points.len() * 2);
        assert_eq!(result.nyquist.infinity_closure.line_style, "dashed");
        assert!(result.nyquist.infinity_closure.points.len() >= 2);
        assert!(result
            .nyquist
            .key_points
            .iter()
            .any(|point| point.kind == "real_axis_crossing"));
        assert!(result
            .nyquist
            .key_points
            .iter()
            .any(|point| point.kind == "unit_circle_crossing"));
        assert!(result
            .nyquist
            .key_points
            .iter()
            .all(|point| point.frequency.is_finite()));
        assert!(result.nyquist.encirclements.is_finite());
    }

    #[test]
    fn nyquist_half_mode_returns_positive_branch_only() {
        let mut request = ship_heading_request(1.0);
        request.nyquist = Some(NyquistConfig {
            mode: Some(NyquistPlotMode::Half),
            sampling_mode: Some(SamplingMode::Adaptive),
        });

        let result = compute_analysis_inner(&request);

        assert_eq!(result.nyquist.mode, NyquistPlotMode::Half);
        assert_eq!(
            result.nyquist.points.len(),
            result.nyquist.positive_points.len()
        );
        assert!(result.nyquist.negative_points.is_empty());
        assert!(result.nyquist.infinity_closure.points.is_empty());
    }

    #[test]
    fn supports_impulse_and_ramp_time_responses() {
        let mut impulse_request = ship_heading_request(1.0);
        impulse_request.response_type = ResponseType::Impulse;
        let impulse = compute_analysis_inner(&impulse_request);
        assert!(!impulse.step_response.points.is_empty());
        assert!(impulse
            .step_response
            .points
            .iter()
            .all(|point| point.x.is_finite() && point.y.is_finite()));
        assert!(impulse
            .step_response
            .points
            .iter()
            .any(|point| point.y.abs() > 1e-6));

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
                        (candidate.re - root.re).abs() < 1e-6
                            && (candidate.im + root.im).abs() < 1e-6
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

    #[test]
    fn rl_training_uses_q_learning_and_preserves_route_ordering() {
        let toy = compute_rl_training_inner(&RlTrainingRequest {
            panel_kind: "rust_toy_training_panel".to_string(),
            training_type: Some("toy_rl".to_string()),
            seed: Some(5505),
            training_episodes: Some(80),
            episode_chunk: None,
            evaluate: None,
            training_state: None,
            selected_parameters: HashMap::from([
                ("actionCost".to_string(), Value::from(0.04)),
                ("boundaryPenalty".to_string(), Value::from(1.0)),
            ]),
        });
        assert_eq!(toy.reward_curve.len(), 80);
        assert!(toy.metrics.final_error.is_finite());
        assert!(toy.metrics.cumulative_reward.is_finite());

        let direct = compute_rl_training_inner(&RlTrainingRequest {
            panel_kind: "rust_heading_rl_training_panel".to_string(),
            training_type: Some("direct_rl".to_string()),
            seed: Some(5515),
            training_episodes: Some(140),
            episode_chunk: None,
            evaluate: None,
            training_state: None,
            selected_parameters: HashMap::from([
                ("explorationDecay".to_string(), Value::from(0.5)),
                ("actionStepDeg".to_string(), Value::from(2.5)),
                ("errorPenaltyWeight".to_string(), Value::from(1.0)),
                ("rudderRatePenaltyWeight".to_string(), Value::from(0.5)),
            ]),
        });
        let safe = compute_rl_training_inner(&RlTrainingRequest {
            panel_kind: "rust_heading_rl_training_panel".to_string(),
            training_type: Some("safe_shell_rl".to_string()),
            seed: Some(5515),
            training_episodes: Some(140),
            episode_chunk: None,
            evaluate: None,
            training_state: None,
            selected_parameters: HashMap::from([
                ("safetyErrorThresholdDeg".to_string(), Value::from(9.0)),
                ("yawRateThreshold".to_string(), Value::from(0.35)),
                ("rudderRateThreshold".to_string(), Value::from(0.7)),
                ("safetyPenaltyWeight".to_string(), Value::from(1.4)),
                ("fallbackSensitivity".to_string(), Value::from(0.7)),
            ]),
        });
        let scheduled = compute_rl_training_inner(&RlTrainingRequest {
            panel_kind: "rust_heading_rl_training_panel".to_string(),
            training_type: Some("rl_pid_schedule".to_string()),
            seed: Some(5515),
            training_episodes: Some(140),
            episode_chunk: None,
            evaluate: None,
            training_state: None,
            selected_parameters: HashMap::from([
                ("parameterSetIndex".to_string(), Value::from(2.0)),
                ("switchPenaltyWeight".to_string(), Value::from(0.4)),
                ("disturbanceBias".to_string(), Value::from(0.1)),
                ("fastModeLimit".to_string(), Value::from(0.5)),
                ("errorBandCount".to_string(), Value::from(5.0)),
            ]),
        });

        assert!(direct.metrics.rms_heading_error.is_finite());
        assert!(direct.metrics.rms_heading_error < 15.0);
        assert!(safe.metrics.rms_heading_error < direct.metrics.rms_heading_error);
        assert!(scheduled.metrics.rms_heading_error < safe.metrics.rms_heading_error);
        assert!(safe.safety_fallback_count > 0);
        assert_eq!(scheduled.safety_fallback_count, 0);
    }

    #[test]
    fn heading_rl_training_evaluates_real_nomoto_inertia() {
        let result = compute_rl_training_inner(&RlTrainingRequest {
            panel_kind: "rust_heading_rl_training_panel".to_string(),
            training_type: Some("direct_rl".to_string()),
            seed: Some(5515),
            training_episodes: Some(80),
            episode_chunk: None,
            evaluate: None,
            training_state: None,
            selected_parameters: HashMap::from([
                ("explorationDecay".to_string(), Value::from(0.5)),
                ("actionStepDeg".to_string(), Value::from(2.5)),
                ("errorPenaltyWeight".to_string(), Value::from(1.0)),
                ("rudderRatePenaltyWeight".to_string(), Value::from(0.5)),
            ]),
        });

        let before = result
            .comparison_trace
            .iter()
            .find(|point| (point.t - 29.5).abs() < 1e-9)
            .expect("trace contains sample before the command step");
        let after = result
            .comparison_trace
            .iter()
            .find(|point| (point.t - 30.0).abs() < 1e-9)
            .expect("trace contains sample at the command step");
        assert_eq!(before.reference, 0.0);
        assert_eq!(after.reference, 12.0);
        assert!(
            (after.pid - before.pid).abs() < 3.0,
            "PID response jumped with the command instead of passing through the Nomoto plant"
        );
        assert!(
            (after.rl - before.rl).abs() < 3.0,
            "RL response jumped with the command instead of passing through the Nomoto plant"
        );
        assert!(
            result
                .comparison_trace
                .iter()
                .any(|point| point.disturbance.abs() > 0.0),
            "evaluation trace should expose disturbance/edge-scenario overlays for the frontend"
        );
    }

    #[test]
    fn rl_training_continues_from_serialized_state_without_rewriting_history() {
        let first = compute_rl_training_inner(&RlTrainingRequest {
            panel_kind: "rust_heading_rl_training_panel".to_string(),
            training_type: Some("direct_rl".to_string()),
            seed: Some(5515),
            training_episodes: Some(4),
            episode_chunk: Some(4),
            evaluate: None,
            training_state: None,
            selected_parameters: HashMap::from([
                ("explorationDecay".to_string(), Value::from(0.5)),
                ("actionStepDeg".to_string(), Value::from(2.5)),
                ("errorPenaltyWeight".to_string(), Value::from(1.0)),
                ("rudderRatePenaltyWeight".to_string(), Value::from(0.5)),
            ]),
        });
        let first_history = first.reward_curve.clone();
        let continued = compute_rl_training_inner(&RlTrainingRequest {
            panel_kind: "rust_heading_rl_training_panel".to_string(),
            training_type: Some("direct_rl".to_string()),
            seed: Some(5515),
            training_episodes: Some(8),
            episode_chunk: Some(4),
            evaluate: None,
            training_state: first.training_state.clone(),
            selected_parameters: HashMap::from([
                ("explorationDecay".to_string(), Value::from(0.5)),
                ("actionStepDeg".to_string(), Value::from(2.5)),
                ("errorPenaltyWeight".to_string(), Value::from(1.0)),
                ("rudderRatePenaltyWeight".to_string(), Value::from(0.5)),
            ]),
        });
        let one_shot = compute_rl_training_inner(&RlTrainingRequest {
            panel_kind: "rust_heading_rl_training_panel".to_string(),
            training_type: Some("direct_rl".to_string()),
            seed: Some(5515),
            training_episodes: Some(8),
            episode_chunk: Some(8),
            evaluate: None,
            training_state: None,
            selected_parameters: HashMap::from([
                ("explorationDecay".to_string(), Value::from(0.5)),
                ("actionStepDeg".to_string(), Value::from(2.5)),
                ("errorPenaltyWeight".to_string(), Value::from(1.0)),
                ("rudderRatePenaltyWeight".to_string(), Value::from(0.5)),
            ]),
        });

        assert_eq!(first.reward_chunk.len(), 4);
        assert_eq!(continued.reward_chunk.len(), 4);
        assert_eq!(continued.reward_chunk[0].episode, 5);
        assert_eq!(&continued.reward_curve[..4], &first_history[..]);
        assert_eq!(&one_shot.reward_curve[..4], &first_history[..]);
    }

    #[test]
    fn rl_training_tick_returns_only_new_chunk_until_final_evaluation() {
        let first = compute_rl_training_inner(&RlTrainingRequest {
            panel_kind: "rust_toy_training_panel".to_string(),
            training_type: Some("toy_rl".to_string()),
            seed: Some(5505),
            training_episodes: Some(4),
            episode_chunk: Some(4),
            evaluate: Some(false),
            training_state: None,
            selected_parameters: HashMap::from([
                ("actionCost".to_string(), Value::from(0.04)),
                ("boundaryPenalty".to_string(), Value::from(1.0)),
            ]),
        });
        let continued = compute_rl_training_inner(&RlTrainingRequest {
            panel_kind: "rust_toy_training_panel".to_string(),
            training_type: Some("toy_rl".to_string()),
            seed: Some(5505),
            training_episodes: Some(200),
            episode_chunk: Some(4),
            evaluate: Some(false),
            training_state: first.training_state.clone(),
            selected_parameters: HashMap::from([
                ("actionCost".to_string(), Value::from(0.04)),
                ("boundaryPenalty".to_string(), Value::from(1.0)),
            ]),
        });
        let final_result = compute_rl_training_inner(&RlTrainingRequest {
            panel_kind: "rust_toy_training_panel".to_string(),
            training_type: Some("toy_rl".to_string()),
            seed: Some(5505),
            training_episodes: Some(8),
            episode_chunk: Some(0),
            evaluate: Some(true),
            training_state: continued.training_state.clone(),
            selected_parameters: HashMap::from([
                ("actionCost".to_string(), Value::from(0.04)),
                ("boundaryPenalty".to_string(), Value::from(1.0)),
            ]),
        });

        assert_eq!(first.reward_curve.len(), 4);
        assert_eq!(first.reward_chunk.len(), 4);
        assert_eq!(continued.reward_curve.len(), 4);
        assert_eq!(continued.reward_chunk[0].episode, 5);
        assert_eq!(final_result.reward_chunk.len(), 0);
        assert_eq!(final_result.reward_curve.len(), 8);
    }

    #[test]
    fn heading_rl_training_continues_with_absolute_episode_decay() {
        let parameters = HashMap::from([
            ("explorationDecay".to_string(), Value::from(0.5)),
            ("actionStepDeg".to_string(), Value::from(2.5)),
            ("errorPenaltyWeight".to_string(), Value::from(1.0)),
            ("rudderRatePenaltyWeight".to_string(), Value::from(0.5)),
        ]);
        let first = compute_rl_training_inner(&RlTrainingRequest {
            panel_kind: "rust_heading_rl_training_panel".to_string(),
            training_type: Some("direct_rl".to_string()),
            seed: Some(5515),
            training_episodes: Some(4),
            episode_chunk: Some(4),
            evaluate: Some(false),
            training_state: None,
            selected_parameters: parameters.clone(),
        });
        let continued = compute_rl_training_inner(&RlTrainingRequest {
            panel_kind: "rust_heading_rl_training_panel".to_string(),
            training_type: Some("direct_rl".to_string()),
            seed: Some(5515),
            training_episodes: Some(400),
            episode_chunk: Some(4),
            evaluate: Some(false),
            training_state: first.training_state.clone(),
            selected_parameters: parameters.clone(),
        });
        let one_shot = compute_rl_training_inner(&RlTrainingRequest {
            panel_kind: "rust_heading_rl_training_panel".to_string(),
            training_type: Some("direct_rl".to_string()),
            seed: Some(5515),
            training_episodes: Some(8),
            episode_chunk: Some(8),
            evaluate: Some(false),
            training_state: None,
            selected_parameters: parameters.clone(),
        });
        let final_result = compute_rl_training_inner(&RlTrainingRequest {
            panel_kind: "rust_heading_rl_training_panel".to_string(),
            training_type: Some("direct_rl".to_string()),
            seed: Some(5515),
            training_episodes: Some(8),
            episode_chunk: Some(0),
            evaluate: Some(true),
            training_state: continued.training_state.clone(),
            selected_parameters: parameters,
        });

        assert_eq!(continued.reward_curve.len(), 4);
        assert_eq!(continued.reward_curve[0].episode, 5);
        assert_eq!(&continued.reward_curve[..], &one_shot.reward_curve[4..]);
        assert_eq!(final_result.reward_chunk.len(), 0);
        assert_eq!(final_result.reward_curve.len(), 8);
    }
}
