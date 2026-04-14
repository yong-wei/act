use num_complex::Complex64;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ControlAnalysisRequest {
    runtime_mode: String,
    #[serde(rename = "caseId")]
    _case_id: Option<String>,
    plant: TransferFunctionSpec,
    structures: Vec<StructureSpec>,
    outputs: Vec<String>,
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
    branches: Vec<Vec<ComplexPoint>>,
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
        let ai = if i >= width - a.len() { a[i - (width - a.len())] } else { 0.0 };
        let bi = if i >= width - b.len() { b[i - (width - b.len())] } else { 0.0 };
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
    coeffs.iter().fold(Complex64::new(0.0, 0.0), |acc, coeff| acc * x + Complex64::new(*coeff, 0.0))
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
        "gain" => TransferFunction { numerator: vec![get("k", 1.0)], denominator: vec![1.0] },
        "p" => TransferFunction { numerator: vec![get("kp", get("k", 1.0))], denominator: vec![1.0] },
        "pi" => {
            let k = get("k", get("kp", 1.0));
            let ti = get("ti", 1.0);
            TransferFunction { numerator: vec![k * ti, k], denominator: vec![ti, 0.0] }
        }
        "pd" => {
            let k = get("k", get("kp", 1.0));
            let td = get("td", 1.0);
            TransferFunction { numerator: vec![k * td, k], denominator: vec![1.0] }
        }
        "pid" => {
            let k = get("k", get("kp", 1.0));
            let ti = get("ti", 1.0);
            let td = get("td", 1.0);
            TransferFunction { numerator: vec![k * td * ti, k * (td + ti), k], denominator: vec![ti, 0.0] }
        }
        "lead" => {
            let k = get("k", 1.0);
            let tau = get("tau", 1.0);
            let alpha = get("alpha", 0.2);
            TransferFunction { numerator: vec![k * tau, k], denominator: vec![alpha * tau, 1.0] }
        }
        "lag" => {
            let k = get("k", 1.0);
            let tau = get("tau", 1.0);
            let beta = get("beta", 4.0);
            TransferFunction { numerator: vec![k * tau, k], denominator: vec![beta * tau, 1.0] }
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
        _ => TransferFunction { numerator: vec![1.0], denominator: vec![1.0] },
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
        .fold(plant, |acc, structure| tf_mul(&acc, &tf_from_structure(structure)))
}

fn extract_primary_gain(structures: &[StructureSpec], fallback: f64) -> f64 {
    structures
        .iter()
        .find(|item| item.enabled && item.kind == "gain")
        .and_then(|item| item.params.get("k"))
        .copied()
        .unwrap_or(fallback)
}

fn descending_to_ascending(values: &[f64], length: usize) -> Vec<f64> {
    let mut ascending: Vec<f64> = values.iter().rev().copied().collect();
    while ascending.len() < length {
        ascending.push(0.0);
    }
    ascending
}

fn step_response(tf: &TransferFunction, config: &TimeRangeConfig) -> (Vec<CurvePoint>, ControlMetrics) {
    let tf = normalize_tf(tf.clone());
    let n = tf.denominator.len().saturating_sub(1);
    let times = linspace(config.start, config.end, config.samples.max(2));
    if n == 0 {
        let gain = tf.numerator[0] / tf.denominator[0];
        let points = times.iter().map(|t| CurvePoint { x: *t, y: gain }).collect();
        return (
            points,
            ControlMetrics {
                overshoot_pct: 0.0,
                rise_time_sec: Some(0.0),
                settling_time_sec: Some(0.0),
                peak_time_sec: Some(0.0),
                final_value: gain,
                phase_margin_deg: None,
                gain_margin_db: None,
                gain_crossover_rad_per_sec: None,
                phase_crossover_rad_per_sec: None,
                bandwidth_rad_per_sec: None,
            },
        );
    }

    let a = descending_to_ascending(&tf.denominator[1..], n);
    let b = descending_to_ascending(&tf.numerator, n);
    let mut state = vec![0.0; n];
    let mut points = Vec::with_capacity(times.len());
    let dt = if times.len() > 1 { times[1] - times[0] } else { 0.01 };

    let derivative = |x: &[f64]| -> Vec<f64> {
        let mut dx = vec![0.0; n];
        for i in 0..n.saturating_sub(1) {
            dx[i] = x[i + 1];
        }
        let feedback = a
            .iter()
            .enumerate()
            .fold(0.0, |acc, (idx, coeff)| acc + coeff * x[idx]);
        dx[n - 1] = 1.0 - feedback;
        dx
    };

    let output = |x: &[f64]| -> f64 { b.iter().enumerate().fold(0.0, |acc, (idx, coeff)| acc + coeff * x[idx]) };

    for time in &times {
        points.push(CurvePoint { x: *time, y: output(&state) });
        let k1 = derivative(&state);
        let x2: Vec<f64> = state.iter().zip(k1.iter()).map(|(s, k)| s + 0.5 * dt * k).collect();
        let k2 = derivative(&x2);
        let x3: Vec<f64> = state.iter().zip(k2.iter()).map(|(s, k)| s + 0.5 * dt * k).collect();
        let k3 = derivative(&x3);
        let x4: Vec<f64> = state.iter().zip(k3.iter()).map(|(s, k)| s + dt * k).collect();
        let k4 = derivative(&x4);
        for index in 0..n {
            state[index] += (dt / 6.0) * (k1[index] + 2.0 * k2[index] + 2.0 * k3[index] + k4[index]);
        }
    }

    let final_value = points.last().map(|point| point.y).unwrap_or(0.0);
    let max_value = points.iter().map(|point| point.y).fold(f64::MIN, f64::max);
    let overshoot_pct = if final_value.abs() > 1e-12 {
        ((max_value - final_value).max(0.0) / final_value.abs()) * 100.0
    } else {
        0.0
    };
    let rise_low = 0.1 * final_value;
    let rise_high = 0.9 * final_value;
    let rise_start = points.iter().find(|point| point.y >= rise_low).map(|point| point.x);
    let rise_end = points.iter().find(|point| point.y >= rise_high).map(|point| point.x);
    let settling_time_sec = points
        .iter()
        .rposition(|point| (point.y - final_value).abs() > 0.02 * final_value.abs().max(1e-9))
        .and_then(|index| points.get(index + 1).map(|point| point.x));
    let peak_time_sec = points
        .iter()
        .max_by(|a, b| a.y.partial_cmp(&b.y).unwrap())
        .map(|point| point.x);

    (
        points,
        ControlMetrics {
            overshoot_pct,
            rise_time_sec: match (rise_start, rise_end) {
                (Some(start), Some(end)) => Some(end - start),
                _ => None,
            },
            settling_time_sec,
            peak_time_sec,
            final_value,
            phase_margin_deg: None,
            gain_margin_db: None,
            gain_crossover_rad_per_sec: None,
            phase_crossover_rad_per_sec: None,
            bandwidth_rad_per_sec: None,
        },
    )
}

fn frequency_response(loop_tf: &TransferFunction, config: &FrequencyRangeConfig) -> (Vec<CurvePoint>, Vec<CurvePoint>, Vec<ComplexPoint>) {
    let loop_tf = normalize_tf(loop_tf.clone());
    let omegas = logspace(config.min, config.max, config.samples.max(8));
    let mut magnitude = Vec::with_capacity(omegas.len());
    let mut phase = Vec::with_capacity(omegas.len());
    let mut nyquist_positive = Vec::with_capacity(omegas.len());
    for omega in omegas {
        let s = Complex64::new(0.0, omega);
        let value = eval_poly_complex(&loop_tf.numerator, s) / eval_poly_complex(&loop_tf.denominator, s);
        magnitude.push(CurvePoint { x: omega, y: 20.0 * value.norm().log10() });
        phase.push(CurvePoint { x: omega, y: value.arg().to_degrees() });
        nyquist_positive.push(ComplexPoint { re: value.re, im: value.im });
    }
    let mut nyquist = nyquist_positive.clone();
    for point in nyquist_positive.iter().rev().skip(1) {
        nyquist.push(ComplexPoint { re: point.re, im: -point.im });
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

fn margins(magnitude: &[CurvePoint], phase: &[CurvePoint]) -> (Option<f64>, Option<f64>, Option<f64>, Option<f64>, Option<f64>) {
    let wc = interpolate_zero_cross(magnitude, 0.0);
    let wg = interpolate_zero_cross(phase, -180.0);
    let pm = wc.and_then(|cross| interp_curve(phase, cross).map(|value| 180.0 + value));
    let gm_db = wg.and_then(|cross| interp_curve(magnitude, cross).map(|value| -value));
    let bandwidth = magnitude
        .windows(2)
        .find_map(|window| {
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
        let ratio = if (right.x - left.x).abs() < 1e-12 { 0.0 } else { (x - left.x) / (right.x - left.x) };
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
                .fold(Complex64::new(1.0, 0.0), |acc, (_, root)| acc * (roots[index] - *root));
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
    roots.sort_by(|left, right| left.re.partial_cmp(&right.re).unwrap());
    roots
}

fn root_locus(loop_tf: &TransferFunction, config: &RootLocusConfig, feasible_region: Option<FeasibleRegionConfig>) -> RootLocusData {
    let gains = linspace(config.min_gain, config.max_gain, config.samples.max(8));
    let degree = loop_tf.denominator.len().max(loop_tf.numerator.len()) - 1;
    let mut branches: Vec<Vec<ComplexPoint>> = vec![Vec::new(); degree];
    let mut previous: Option<Vec<Complex64>> = None;

    for gain in &gains {
        let scaled_num: Vec<f64> = loop_tf.numerator.iter().map(|value| value * *gain).collect();
        let char_poly = poly_add(&loop_tf.denominator, &scaled_num);
        let mut roots = durand_kerner(&char_poly);
        if let Some(prev) = &previous {
            let mut ordered = Vec::with_capacity(roots.len());
            let mut remaining = roots.clone();
            for previous_root in prev {
                let (best_index, _) = remaining
                    .iter()
                    .enumerate()
                    .map(|(index, candidate)| (index, (*candidate - *previous_root).norm()))
                    .min_by(|left, right| left.1.partial_cmp(&right.1).unwrap())
                    .unwrap();
                ordered.push(remaining.remove(best_index));
            }
            roots = ordered;
        }
        for (index, root) in roots.iter().enumerate() {
            if let Some(branch) = branches.get_mut(index) {
                branch.push(ComplexPoint { re: root.re, im: root.im });
            }
        }
        previous = Some(roots);
    }

    let current_poly = poly_add(
        &loop_tf.denominator,
        &loop_tf.numerator.iter().map(|value| value * config.current_gain).collect::<Vec<_>>(),
    );
    let current_poles = durand_kerner(&current_poly)
        .into_iter()
        .map(|root| ComplexPoint { re: root.re, im: root.im })
        .collect();
    let open_loop_poles = durand_kerner(&loop_tf.denominator)
        .into_iter()
        .map(|root| ComplexPoint { re: root.re, im: root.im })
        .collect();
    let open_loop_zeros = if loop_tf.numerator.len() > 1 {
        durand_kerner(&loop_tf.numerator)
            .into_iter()
            .map(|root| ComplexPoint { re: root.re, im: root.im })
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
    let (step_points, mut metrics) = step_response(&closed_tf, &request.time_range);
    let (magnitude, phase, nyquist) = frequency_response(&loop_tf, &request.frequency_range);
    let (phase_margin_deg, gain_margin_db, gain_cross, phase_cross, bandwidth) = margins(&magnitude, &phase);
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
        step_response: StepResponseData { points: step_points },
        magnitude: BodeAxisData { points: magnitude },
        phase: BodeAxisData { points: phase },
        nyquist: NyquistData { points: nyquist },
        root_locus: root_locus_data,
    }
}

#[wasm_bindgen]
pub fn compute_analysis(request_json: &str) -> Result<String, JsValue> {
    let request: ControlAnalysisRequest =
        serde_json::from_str(request_json).map_err(|error| JsValue::from_str(&error.to_string()))?;
    if request.runtime_mode != "analysis" {
        return Err(JsValue::from_str("只支持 analysis 模式请求。"));
    }
    if request.outputs.is_empty() {
        return Err(JsValue::from_str("outputs 不能为空。"));
    }
    let result = compute_analysis_inner(&request);
    serde_json::to_string(&result).map_err(|error| JsValue::from_str(&error.to_string()))
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
            time_range: TimeRangeConfig { start: 0.0, end: 5.0, samples: 100 },
            frequency_range: FrequencyRangeConfig { min: 0.1, max: 10.0, samples: 64 },
            root_locus: RootLocusConfig { min_gain: 0.0, max_gain: 2.0, samples: 16, current_gain: 1.0 },
            feasible_region: None,
        };

        let result = compute_analysis_inner(&request);
        assert!(!result.step_response.points.is_empty());
        assert!(result.metrics.final_value > 0.4);
        assert!(result.metrics.final_value < 0.6);
    }
}
