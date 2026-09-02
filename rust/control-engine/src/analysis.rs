//! Control analysis implementation behind the WASM facade.
//!
//! Linear/frequency-domain analysis, nonlinear analysis and their result
//! assembly live here; `lib.rs` only decodes, dispatches and exports.

use num_complex::Complex64;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::cmp::Ordering;
use std::collections::HashMap;

use crate::controllers::{StructureSpec, tf_from_structure};

pub fn analysis_request_errors(runtime_mode: &str, outputs_empty: bool) -> Option<&'static str> {
    if runtime_mode != "analysis" {
        return Some("只支持 analysis 模式请求。");
    }
    if outputs_empty {
        return Some("outputs 不能为空。");
    }
    None
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TransferFunctionSpec {
    numerator: Vec<f64>,
    denominator: Vec<f64>,
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
pub(crate) struct ControlAnalysisRequest {
    pub(crate) runtime_mode: String,
    #[serde(rename = "caseId")]
    _case_id: Option<String>,
    plant: TransferFunctionSpec,
    structures: Vec<StructureSpec>,
    pub(crate) outputs: Vec<String>,
    #[serde(default = "default_response_type")]
    response_type: ResponseType,
    time_range: TimeRangeConfig,
    frequency_range: FrequencyRangeConfig,
    #[serde(default)]
    frequency_probes_rad_per_sec: Vec<Value>,
    settling_band_ratio: Option<f64>,
    nyquist: Option<NyquistConfig>,
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
struct NyquistSamplePoint {
    re: f64,
    im: f64,
    frequency: f64,
    magnitude_db: f64,
    phase_deg: f64,
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

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
enum RootLocusSegmentType {
    RealAxisLocus,
    Branch,
    BranchCompletion,
    NearZero,
    AsymptoticTail,
    Asymptote,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
enum RootLocusSegmentLineStyle {
    Solid,
    Dashed,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RootLocusSegmentPoint {
    re: f64,
    im: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    gain: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    branch_id: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sample_index: Option<usize>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RootLocusSegmentMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    branch_id: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    angle_deg: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_auxiliary: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    endpoint_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    target_zero_index: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    terminal_distance: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sampling_parameter: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RootLocusSegment {
    #[serde(rename = "type")]
    segment_type: RootLocusSegmentType,
    line_style: RootLocusSegmentLineStyle,
    points: Vec<RootLocusSegmentPoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    metadata: Option<RootLocusSegmentMetadata>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
enum RootLocusEventType {
    OpenLoopPole,
    OpenLoopZero,
    Breakaway,
    Reentry,
    ImaginaryAxisCrossing,
    InfinityEndpoint,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RootLocusEvent {
    #[serde(rename = "type")]
    event_type: RootLocusEventType,
    point: ComplexPoint,
    #[serde(skip_serializing_if = "Option::is_none")]
    gain: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    branch_id: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    label: Option<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
enum RootLocusStructuredSegmentType {
    NearPole,
    Regular,
    NearBreak,
    NearZero,
    AsymptoticTail,
    Asymptote,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RootLocusStructuredSegment {
    id: String,
    #[serde(rename = "type")]
    segment_type: RootLocusStructuredSegmentType,
    #[serde(skip_serializing_if = "Option::is_none")]
    branch_id: Option<usize>,
    points: Vec<RootLocusSegmentPoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_auxiliary: Option<bool>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RootLocusBranchDescriptor {
    id: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    start_event_type: Option<RootLocusEventType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    end_event_type: Option<RootLocusEventType>,
    segment_ids: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RootLocusBranchStructure {
    branches: Vec<RootLocusBranchDescriptor>,
    segments: Vec<RootLocusStructuredSegment>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RootLocusView {
    x: [f64; 2],
    y: [f64; 2],
    #[serde(skip_serializing_if = "Vec::is_empty")]
    include_segment_types: Vec<RootLocusStructuredSegmentType>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    exclude_segment_types: Vec<RootLocusStructuredSegmentType>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RootLocusViews {
    feature: RootLocusView,
    full: RootLocusView,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RootLocusFiniteZeroCoverage {
    matched_count: usize,
    total_count: usize,
    max_terminal_distance: f64,
    all_matched_within_tolerance: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RootLocusDiagnostics {
    finite_zero_coverage: RootLocusFiniteZeroCoverage,
    assignment_warnings: Vec<String>,
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
    overshoot_pct: Option<f64>,
    rise_time_sec: Option<f64>,
    settling_time_sec: Option<f64>,
    peak_time_sec: Option<f64>,
    final_value: f64,
    phase_margin_deg: Option<f64>,
    gain_margin_db: Option<f64>,
    gain_crossover_rad_per_sec: Option<f64>,
    phase_crossover_rad_per_sec: Option<f64>,
    phase_crossover_status: Option<PhaseCrossoverStatus>,
    bandwidth_rad_per_sec: Option<f64>,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum PhaseCrossoverStatus {
    Finite,
    NotObservedInFrequencyRange,
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
    segments: Vec<Vec<ComplexPoint>>,
    line_style: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct NyquistSegmentMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pole_location: Option<ComplexPoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pole_order: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    frequency_interval: Option<[f64; 2]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    parameter_range: Option<[f64; 2]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    layer_index: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_auxiliary: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    collapsed: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    branch: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct NyquistSegment {
    #[serde(rename = "type")]
    segment_type: String,
    points: Vec<ComplexPoint>,
    direction: String,
    line_style: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    metadata: Option<NyquistSegmentMetadata>,
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
    positive_samples: Vec<NyquistSamplePoint>,
    negative_samples: Vec<NyquistSamplePoint>,
    segments: Vec<NyquistSegment>,
    infinity_closure: NyquistClosureSegment,
    key_points: Vec<NyquistKeyPoint>,
    asymptotes: Vec<NyquistAsymptote>,
    encirclements: f64,
    criterion: NyquistCriterion,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NyquistCriterion {
    n: i64,
    p: usize,
    z: usize,
    relation: String,
    is_consistent: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RootLocusData {
    branches: Vec<Vec<RootLocusSamplePoint>>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    segments: Vec<RootLocusSegment>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    events: Vec<RootLocusEvent>,
    branch_structure: RootLocusBranchStructure,
    views: RootLocusViews,
    diagnostics: RootLocusDiagnostics,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    suggested_insets: Vec<RootLocusView>,
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
    current_gain: f64,
    current_poles: Vec<ComplexPoint>,
    open_loop_poles: Vec<ComplexPoint>,
    open_loop_zeros: Vec<ComplexPoint>,
    feasible_region: Option<FeasibleRegionConfig>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ControlAnalysisResult {
    metrics: ControlMetrics,
    step_response: StepResponseData,
    magnitude: BodeAxisData,
    phase: BodeAxisData,
    frequency_readings: Vec<FrequencyResponseReading>,
    nyquist: NyquistData,
    root_locus: RootLocusData,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FrequencyResponseReading {
    frequency_rad_per_sec: f64,
    re: f64,
    im: f64,
    magnitude_db: f64,
    phase_deg: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NonlinearAnalysisRequest {
    pub(crate) runtime_mode: String,
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
pub(crate) struct NonlinearAnalysisResult {
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
pub(crate) struct TransferFunction {
    pub(crate) numerator: Vec<f64>,
    pub(crate) denominator: Vec<f64>,
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

pub(crate) fn tf_mul(a: &TransferFunction, b: &TransferFunction) -> TransferFunction {
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

fn build_root_locus_tf(request: &ControlAnalysisRequest) -> TransferFunction {
    let plant = normalize_tf(TransferFunction {
        numerator: request.plant.numerator.clone(),
        denominator: request.plant.denominator.clone(),
    });
    request
        .structures
        .iter()
        .filter(|item| item.enabled && item.kind != "gain")
        .fold(plant, |acc, structure| {
            tf_mul(&acc, &tf_from_structure(structure))
        })
}

fn compute_time_metrics(
    points: &[CurvePoint],
    expected_final_value: Option<f64>,
    asymptotically_stable: bool,
    settling_band_ratio: f64,
) -> ControlMetrics {
    let finite_points: Vec<&CurvePoint> = points
        .iter()
        .filter(|point| point.x.is_finite() && point.y.is_finite())
        .collect();

    if finite_points.is_empty() {
        return ControlMetrics {
            overshoot_pct: None,
            rise_time_sec: None,
            settling_time_sec: None,
            peak_time_sec: None,
            final_value: 0.0,
            phase_margin_deg: None,
            gain_margin_db: None,
            gain_crossover_rad_per_sec: None,
            phase_crossover_rad_per_sec: None,
            phase_crossover_status: None,
            bandwidth_rad_per_sec: None,
        };
    }

    let final_value = expected_final_value
        .filter(|value| value.is_finite())
        .unwrap_or_else(|| finite_points.last().map(|point| point.y).unwrap_or(0.0));
    if !asymptotically_stable {
        return ControlMetrics {
            overshoot_pct: None,
            rise_time_sec: None,
            settling_time_sec: None,
            peak_time_sec: None,
            final_value,
            phase_margin_deg: None,
            gain_margin_db: None,
            gain_crossover_rad_per_sec: None,
            phase_crossover_rad_per_sec: None,
            phase_crossover_status: None,
            bandwidth_rad_per_sec: None,
        };
    }
    let peak_point = finite_points
        .iter()
        .copied()
        .max_by(|left, right| compare_f64(left.y, right.y));
    let max_value = peak_point.map(|point| point.y).unwrap_or(final_value);
    let overshoot_pct = if final_value.abs() > 1e-12 {
        Some(((max_value - final_value).max(0.0) / final_value.abs()) * 100.0)
    } else {
        Some(0.0)
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
        .rposition(|point| {
            (point.y - final_value).abs() > settling_band_ratio * final_value.abs().max(1e-9)
        })
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
        phase_crossover_status: None,
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
    settling_band_ratio: f64,
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
    let closed_loop_poles = durand_kerner(&tf.denominator);
    let asymptotically_stable =
        !closed_loop_poles.is_empty() && closed_loop_poles.iter().all(|pole| pole.re < -1e-8);
    let expected_final_value =
        if matches!(response_type, ResponseType::Step) && asymptotically_stable {
            tf.numerator
                .last()
                .copied()
                .zip(tf.denominator.last().copied())
                .and_then(|(numerator, denominator)| {
                    (denominator.abs() > 1e-12).then_some(numerator / denominator)
                })
        } else {
            None
        };
    let metrics = compute_time_metrics(
        &points,
        expected_final_value,
        asymptotically_stable,
        settling_band_ratio,
    );
    (points, metrics)
}

fn default_control_metrics() -> ControlMetrics {
    ControlMetrics {
        overshoot_pct: None,
        rise_time_sec: None,
        settling_time_sec: None,
        peak_time_sec: None,
        final_value: 0.0,
        phase_margin_deg: None,
        gain_margin_db: None,
        gain_crossover_rad_per_sec: None,
        phase_crossover_rad_per_sec: None,
        phase_crossover_status: None,
        bandwidth_rad_per_sec: None,
    }
}

fn output_requested(request: &ControlAnalysisRequest, keys: &[&str]) -> bool {
    request.outputs.is_empty()
        || keys
            .iter()
            .any(|key| request.outputs.iter().any(|output| output == key))
}

#[derive(Debug, Clone)]
struct NyquistFrequencySample {
    omega: f64,
    value: Complex64,
}

fn eval_transfer_function_at(loop_tf: &TransferFunction, s: Complex64) -> Complex64 {
    let denominator = eval_poly_complex(&loop_tf.denominator, s);
    if denominator.norm() < 1e-18 {
        let numerator = eval_poly_complex(&loop_tf.numerator, s);
        let angle = numerator.arg();
        return Complex64::from_polar(1e12, angle);
    }
    eval_poly_complex(&loop_tf.numerator, s) / denominator
}

fn eval_transfer_function(loop_tf: &TransferFunction, omega: f64) -> Complex64 {
    eval_transfer_function_at(loop_tf, Complex64::new(0.0, omega))
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

fn interpolate_nyquist_display_start(
    left: &NyquistFrequencySample,
    right: &NyquistFrequencySample,
    target_radius: f64,
) -> NyquistFrequencySample {
    let left_radius = left.value.norm();
    let right_radius = right.value.norm();
    let denominator = (left_radius - right_radius).abs().max(1e-12);
    let ratio = ((left_radius - target_radius) / denominator).clamp(0.0, 1.0);
    let omega = left.omega * (right.omega / left.omega).powf(ratio);
    let value = left.value + (right.value - left.value) * ratio;
    NyquistFrequencySample { omega, value }
}

fn nyquist_display_samples(
    loop_tf: &TransferFunction,
    samples: &[NyquistFrequencySample],
) -> Vec<NyquistFrequencySample> {
    const DISPLAY_START_RADIUS: f64 = 2.0;
    if low_frequency_infinity_order(loop_tf) == 0 || samples.len() < 2 {
        return samples.to_vec();
    }
    let Some(first_visible_index) = samples
        .iter()
        .position(|sample| sample.value.norm() <= DISPLAY_START_RADIUS)
    else {
        return samples.to_vec();
    };
    if first_visible_index == 0 {
        return samples.to_vec();
    }

    let mut display = Vec::with_capacity(samples.len() - first_visible_index + 1);
    display.push(interpolate_nyquist_display_start(
        &samples[first_visible_index - 1],
        &samples[first_visible_index],
        DISPLAY_START_RADIUS,
    ));
    display.extend(samples[first_visible_index..].iter().cloned());
    display
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

fn low_frequency_infinity_order(loop_tf: &TransferFunction) -> usize {
    let numerator_origin_order = trailing_zero_order(&loop_tf.numerator);
    let denominator_origin_order = trailing_zero_order(&loop_tf.denominator);
    denominator_origin_order.saturating_sub(numerator_origin_order)
}

fn mapped_origin_indent_segment(
    loop_tf: &TransferFunction,
    rho: f64,
    positive_points: &[ComplexPoint],
    negative_points: &[ComplexPoint],
) -> Option<NyquistSegment> {
    let pole_order = low_frequency_infinity_order(loop_tf);
    if pole_order == 0 || !rho.is_finite() || rho <= 0.0 {
        return None;
    }

    let Some(positive_start) = positive_points.first().cloned() else {
        return None;
    };
    let Some(negative_end) = negative_points.last().cloned() else {
        return None;
    };

    let start_angle = -std::f64::consts::FRAC_PI_2;
    let end_angle = std::f64::consts::FRAC_PI_2;
    let sample_count = (48 * pole_order).max(48);
    let mut points = Vec::with_capacity(sample_count + 1);
    for index in 0..=sample_count {
        let ratio = index as f64 / sample_count as f64;
        let theta = start_angle + (end_angle - start_angle) * ratio;
        let s = Complex64::from_polar(rho, theta);
        points.push(complex_to_point(eval_transfer_function_at(loop_tf, s)));
    }
    if points.len() > 1 {
        if let Some(first) = points.first_mut() {
            *first = negative_end;
        }
        if let Some(last) = points.last_mut() {
            *last = positive_start;
        }
    }

    Some(NyquistSegment {
        segment_type: "infinity_arc".to_string(),
        points,
        direction: "contour_indent_right_half_plane".to_string(),
        line_style: "dashed".to_string(),
        metadata: Some(NyquistSegmentMetadata {
            pole_location: Some(ComplexPoint { re: 0.0, im: 0.0 }),
            pole_order: Some(pole_order),
            frequency_interval: Some([-rho, rho]),
            parameter_range: Some([start_angle, end_angle]),
            layer_index: Some(0),
            is_auxiliary: Some(true),
            collapsed: None,
            branch: None,
        }),
    })
}

fn nyquist_contour_segments(
    loop_tf: &TransferFunction,
    samples: &[NyquistFrequencySample],
    positive_points: &[ComplexPoint],
    negative_points: &[ComplexPoint],
    mode: NyquistPlotMode,
) -> Vec<NyquistSegment> {
    let mut segments = Vec::new();
    let min_omega = samples.first().map(|sample| sample.omega).unwrap_or(0.0);
    let max_omega = samples.last().map(|sample| sample.omega).unwrap_or(0.0);

    if mode == NyquistPlotMode::Full && !negative_points.is_empty() {
        segments.push(NyquistSegment {
            segment_type: "regular_negative".to_string(),
            points: negative_points.to_vec(),
            direction: "negative_frequency".to_string(),
            line_style: "solid".to_string(),
            metadata: Some(NyquistSegmentMetadata {
                pole_location: None,
                pole_order: None,
                frequency_interval: Some([-max_omega, -min_omega]),
                parameter_range: None,
                layer_index: None,
                is_auxiliary: Some(false),
                collapsed: None,
                branch: Some("negative".to_string()),
            }),
        });
    }

    if mode == NyquistPlotMode::Full {
        if let Some(segment) =
            mapped_origin_indent_segment(loop_tf, min_omega, positive_points, negative_points)
        {
            segments.push(segment);
        }
    }

    if !positive_points.is_empty() {
        segments.push(NyquistSegment {
            segment_type: "regular_positive".to_string(),
            points: positive_points.to_vec(),
            direction: "positive_frequency".to_string(),
            line_style: "solid".to_string(),
            metadata: Some(NyquistSegmentMetadata {
                pole_location: None,
                pole_order: None,
                frequency_interval: Some([min_omega, max_omega]),
                parameter_range: None,
                layer_index: None,
                is_auxiliary: Some(false),
                collapsed: None,
                branch: Some("positive".to_string()),
            }),
        });
    }

    segments
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

fn count_right_half_plane_roots(coeffs: &[f64]) -> usize {
    durand_kerner(coeffs)
        .iter()
        .filter(|root| root.re > 1e-7)
        .count()
}

fn build_nyquist_criterion(loop_tf: &TransferFunction, clockwise_n: i64) -> NyquistCriterion {
    let p = count_right_half_plane_roots(&loop_tf.denominator);
    let z = count_right_half_plane_roots(&poly_add(&loop_tf.denominator, &loop_tf.numerator));
    NyquistCriterion {
        n: clockwise_n,
        p,
        z,
        relation: "Z = P + N".to_string(),
        is_consistent: z as i64 == p as i64 + clockwise_n,
    }
}

fn build_nyquist_data(
    loop_tf: &TransferFunction,
    display_samples: &[NyquistFrequencySample],
    full_samples: &[NyquistFrequencySample],
    mode: NyquistPlotMode,
) -> NyquistData {
    let positive_samples: Vec<NyquistSamplePoint> = display_samples
        .iter()
        .map(|sample| {
            let point = complex_to_point(sample.value);
            NyquistSamplePoint {
                re: point.re,
                im: point.im,
                frequency: sample.omega,
                magnitude_db: 20.0 * sample.value.norm().max(1e-12).log10(),
                phase_deg: sample.value.arg().to_degrees(),
            }
        })
        .collect();
    let negative_samples: Vec<NyquistSamplePoint> = if mode == NyquistPlotMode::Full {
        positive_samples
            .iter()
            .rev()
            .map(|sample| NyquistSamplePoint {
                re: sample.re,
                im: -sample.im,
                frequency: -sample.frequency,
                magnitude_db: sample.magnitude_db,
                phase_deg: -sample.phase_deg,
            })
            .collect()
    } else {
        Vec::new()
    };
    let positive_points: Vec<ComplexPoint> = display_samples
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
    let segments = nyquist_contour_segments(
        loop_tf,
        display_samples,
        &positive_points,
        &negative_points,
        mode,
    );
    let closure_segments: Vec<Vec<ComplexPoint>> = segments
        .iter()
        .filter(|segment| segment.segment_type == "infinity_arc")
        .map(|segment| segment.points.clone())
        .collect();
    let infinity_closure = NyquistClosureSegment {
        points: closure_segments.iter().flatten().cloned().collect(),
        segments: closure_segments,
        line_style: "dashed".to_string(),
    };
    let mut contour_points: Vec<ComplexPoint> = if mode == NyquistPlotMode::Full {
        let full_positive_points: Vec<ComplexPoint> = full_samples
            .iter()
            .map(|sample| complex_to_point(sample.value))
            .collect();
        let full_negative_points: Vec<ComplexPoint> = full_positive_points
            .iter()
            .rev()
            .map(|point| ComplexPoint {
                re: point.re,
                im: -point.im,
            })
            .collect();
        nyquist_contour_segments(
            loop_tf,
            full_samples,
            &full_positive_points,
            &full_negative_points,
            mode,
        )
        .iter()
        .flat_map(|segment| segment.points.iter().cloned())
        .collect()
    } else {
        positive_points.clone()
    };
    if let Some(start) = contour_points.first().cloned() {
        contour_points.push(start);
    }

    let clockwise_n = if mode == NyquistPlotMode::Full {
        -winding_number(&contour_points, Complex64::new(-1.0, 0.0)) as i64
    } else {
        let p = count_right_half_plane_roots(&loop_tf.denominator) as i64;
        let z = count_right_half_plane_roots(&poly_add(&loop_tf.denominator, &loop_tf.numerator))
            as i64;
        z - p
    };

    NyquistData {
        mode,
        points,
        positive_points,
        negative_points,
        positive_samples,
        negative_samples,
        segments,
        infinity_closure,
        key_points: nyquist_key_points(full_samples),
        asymptotes: nyquist_asymptotes(loop_tf),
        encirclements: clockwise_n as f64,
        criterion: build_nyquist_criterion(loop_tf, clockwise_n),
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
    let display_samples = nyquist_display_samples(&loop_tf, &samples);
    let mut magnitude = Vec::with_capacity(samples.len());
    let mut phase = Vec::with_capacity(samples.len());
    let mut last_phase: Option<f64> = None;
    for sample in &samples {
        let omega = sample.omega;
        let value = sample.value;
        let norm = value.norm();
        let phase_deg = unwrap_bode_phase_deg(
            if norm < 1e-12 {
                0.0
            } else {
                value.arg().to_degrees()
            },
            last_phase,
        );
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
    let nyquist = build_nyquist_data(&loop_tf, &display_samples, &samples, mode);
    (magnitude, phase, nyquist)
}

fn unwrap_bode_phase_deg(mut phase_deg: f64, previous_phase: Option<f64>) -> f64 {
    if let Some(previous_phase) = previous_phase {
        while phase_deg - previous_phase > 180.0 {
            phase_deg -= 360.0;
        }
        while phase_deg - previous_phase < -180.0 {
            phase_deg += 360.0;
        }
    }
    phase_deg
}

fn exact_frequency_readings(
    loop_tf: &TransferFunction,
    probes: &[Value],
    range: &FrequencyRangeConfig,
) -> Vec<FrequencyResponseReading> {
    let mut frequencies = probes
        .iter()
        .filter_map(Value::as_f64)
        .filter(|frequency| {
            frequency.is_finite()
                && *frequency > 0.0
                && *frequency >= range.min
                && *frequency <= range.max
        })
        .collect::<Vec<_>>();
    frequencies.sort_by(f64::total_cmp);
    frequencies.dedup_by(|left, right| left.to_bits() == right.to_bits());

    let mut phase_grid = nyquist_frequency_samples(loop_tf, range, SamplingMode::Adaptive)
        .into_iter()
        .map(|sample| sample.omega)
        .collect::<Vec<_>>();
    phase_grid.extend(frequencies.iter().copied());
    phase_grid.sort_by(f64::total_cmp);
    phase_grid.dedup_by(|left, right| left.to_bits() == right.to_bits());
    let mut unwrapped_phases = HashMap::new();
    let mut previous_phase = None;
    for frequency in phase_grid {
        let value = eval_transfer_function(loop_tf, frequency);
        if !is_finite_complex(value) {
            continue;
        }
        let norm = value.norm();
        let phase_deg = unwrap_bode_phase_deg(
            if norm < 1e-12 {
                0.0
            } else {
                value.arg().to_degrees()
            },
            previous_phase,
        );
        previous_phase = Some(phase_deg);
        unwrapped_phases.insert(frequency.to_bits(), phase_deg);
    }

    frequencies
        .into_iter()
        .filter_map(|frequency| {
            let value = eval_transfer_function(loop_tf, frequency);
            if !is_finite_complex(value) {
                return None;
            }
            let norm = value.norm();
            Some(FrequencyResponseReading {
                frequency_rad_per_sec: frequency,
                re: value.re,
                im: value.im,
                magnitude_db: 20.0 * norm.max(1e-12).log10(),
                phase_deg: *unwrapped_phases.get(&frequency.to_bits())?,
            })
        })
        .collect()
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

    let mut current = current.to_vec();
    sort_complex_points(&mut current);
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
        &current,
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
    midpoint: &RootLocusSample,
    right: &RootLocusSample,
    depth: usize,
    max_depth: usize,
) -> bool {
    if depth >= max_depth
        || left.roots.len() != midpoint.roots.len()
        || left.roots.len() != right.roots.len()
    {
        return false;
    }
    let scale = left
        .roots
        .iter()
        .chain(midpoint.roots.iter())
        .chain(right.roots.iter())
        .map(|root| root.norm())
        .fold(1.0_f64, f64::max);
    let max_delta = left
        .roots
        .iter()
        .zip(right.roots.iter())
        .map(|(lhs, rhs)| (*lhs - *rhs).norm())
        .fold(0.0_f64, f64::max);
    let max_chord_error = left
        .roots
        .iter()
        .zip(midpoint.roots.iter())
        .zip(right.roots.iter())
        .map(|((lhs, mid), rhs)| {
            let chord_midpoint = (*lhs + *rhs) * 0.5;
            (*mid - chord_midpoint).norm()
        })
        .fold(0.0_f64, f64::max);
    let min_spacing = min_pairwise_distance(&left.roots)
        .min(min_pairwise_distance(&midpoint.roots))
        .min(min_pairwise_distance(&right.roots));

    max_delta > 0.12 * scale
        || max_chord_error > 0.0015 * scale
        || (min_spacing < 0.1 * scale && max_delta > 0.0005 * scale)
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
    let mid_gain = 0.5 * (left.gain + right.gain);
    if (mid_gain - left.gain).abs() < 1e-9 || (right.gain - mid_gain).abs() < 1e-9 {
        output.push(right);
        return;
    }
    let midpoint = sample_root_locus(loop_tf, mid_gain, Some(&left.roots));
    if should_refine_root_segment(left, &midpoint, &right, depth, max_depth) {
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
            let span = (max_gain - min_gain).max(1e-9);
            let base_step = span / config.samples.max(30) as f64;
            for stationary_point in stationary {
                let center = stationary_point.gain;
                if center < min_gain - 1e-9 || center > max_gain + 1e-9 {
                    continue;
                }
                let nearest_stationary_gap = stationary
                    .iter()
                    .map(|point| (point.gain - center).abs())
                    .filter(|gap| *gap > 1e-9)
                    .fold(f64::INFINITY, f64::min);
                let separation_limit = if nearest_stationary_gap.is_finite() {
                    nearest_stationary_gap * 0.35
                } else {
                    span
                };
                let window = (base_step * 0.9)
                    .min(span * 0.08)
                    .min(separation_limit)
                    .max(base_step * 0.2)
                    .max(center.abs() * 0.02)
                    .min(span);
                for ratio in [
                    -1.0, -0.75, -0.5, -0.375, -0.25, -0.1875, -0.125, -0.0625, -0.03125,
                    -0.015625, 0.0, 0.015625, 0.03125, 0.0625, 0.125, 0.1875, 0.25, 0.375, 0.5,
                    0.75, 1.0,
                ] {
                    gains.push((center + window * ratio).clamp(min_gain, max_gain));
                }
            }
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

fn root_locus_segment_point(
    re: f64,
    im: f64,
    gain: Option<f64>,
    branch_id: Option<usize>,
    sample_index: Option<usize>,
) -> RootLocusSegmentPoint {
    RootLocusSegmentPoint {
        re,
        im,
        gain,
        branch_id,
        sample_index,
    }
}

fn root_locus_plot_extent(
    branches: &[Vec<RootLocusSamplePoint>],
    open_loop_poles: &[Complex64],
    open_loop_zeros: &[Complex64],
    centroid: Option<f64>,
) -> f64 {
    let mut extent = centroid.map(f64::abs).unwrap_or(1.0).max(1.0);
    for point in open_loop_poles.iter().chain(open_loop_zeros.iter()) {
        extent = extent.max(point.re.abs()).max(point.im.abs());
    }
    for point in branches.iter().flatten() {
        extent = extent.max(point.re.abs()).max(point.im.abs());
    }
    extent.max(1.0) * 1.35
}

fn root_locus_real_axis_segments(
    real_axis_segments: &[RealAxisSegment],
    extent: f64,
) -> Vec<RootLocusSegment> {
    real_axis_segments
        .iter()
        .map(|segment| {
            let start = segment.start.unwrap_or(-extent);
            let end = segment.end.unwrap_or(extent);
            RootLocusSegment {
                segment_type: RootLocusSegmentType::RealAxisLocus,
                line_style: RootLocusSegmentLineStyle::Solid,
                points: vec![
                    root_locus_segment_point(start, 0.0, None, None, None),
                    root_locus_segment_point(end, 0.0, None, None, None),
                ],
                metadata: None,
            }
        })
        .collect()
}

fn root_locus_branch_segments(branches: &[Vec<RootLocusSamplePoint>]) -> Vec<RootLocusSegment> {
    branches
        .iter()
        .enumerate()
        .filter(|(_, branch)| branch.len() > 1)
        .map(|(branch_id, branch)| RootLocusSegment {
            segment_type: RootLocusSegmentType::Branch,
            line_style: RootLocusSegmentLineStyle::Solid,
            points: branch
                .iter()
                .map(|point| {
                    root_locus_segment_point(
                        point.re,
                        point.im,
                        Some(point.gain),
                        point.branch_id,
                        point.sample_index,
                    )
                })
                .collect(),
            metadata: Some(RootLocusSegmentMetadata {
                branch_id: Some(branch_id),
                angle_deg: None,
                is_auxiliary: None,
                endpoint_type: None,
                target_zero_index: None,
                terminal_distance: None,
                sampling_parameter: None,
            }),
        })
        .collect()
}

fn root_locus_completion_segments(
    branches: &[Vec<RootLocusSamplePoint>],
    open_loop_zeros: &[Complex64],
) -> Vec<RootLocusSegment> {
    let mut segments = Vec::new();
    let mut used_branches = vec![false; branches.len()];
    let finite_zeros: Vec<Complex64> = open_loop_zeros.to_vec();

    for zero in finite_zeros {
        let mut best_branch_index = None;
        let mut best_distance = f64::INFINITY;
        for (branch_index, branch) in branches.iter().enumerate() {
            if used_branches[branch_index] || branch.is_empty() {
                continue;
            }
            if let Some(endpoint) = branch.last() {
                let distance = (Complex64::new(endpoint.re, endpoint.im) - zero).norm();
                if distance < best_distance {
                    best_distance = distance;
                    best_branch_index = Some(branch_index);
                }
            }
        }

        let Some(branch_index) = best_branch_index else {
            continue;
        };
        if best_distance <= 1e-6 {
            used_branches[branch_index] = true;
            continue;
        }
        let Some(endpoint) = branches[branch_index].last() else {
            continue;
        };
        let scale = zero
            .norm()
            .max(Complex64::new(endpoint.re, endpoint.im).norm())
            .max(1.0);
        if best_distance > 0.08 * scale {
            continue;
        }
        segments.push(RootLocusSegment {
            segment_type: RootLocusSegmentType::BranchCompletion,
            line_style: RootLocusSegmentLineStyle::Solid,
            points: vec![
                root_locus_segment_point(
                    endpoint.re,
                    endpoint.im,
                    Some(endpoint.gain),
                    endpoint.branch_id,
                    endpoint.sample_index,
                ),
                root_locus_segment_point(zero.re, zero.im, None, Some(branch_index), None),
            ],
            metadata: Some(RootLocusSegmentMetadata {
                branch_id: Some(branch_index),
                angle_deg: None,
                is_auxiliary: None,
                endpoint_type: Some("finite_zero".to_string()),
                target_zero_index: None,
                terminal_distance: Some(best_distance),
                sampling_parameter: Some("gain".to_string()),
            }),
        });
        used_branches[branch_index] = true;
    }

    segments
}

#[derive(Debug, Clone)]
struct RootLocusZeroAssignment {
    branch_index: usize,
    zero_index: usize,
}

#[derive(Debug, Clone)]
struct RootLocusNearZeroPlan {
    segments: Vec<RootLocusSegment>,
    assignments: Vec<RootLocusZeroAssignment>,
    diagnostics: RootLocusDiagnostics,
}

fn near_zero_roots(
    loop_tf: &TransferFunction,
    mu: f64,
    previous: Option<&[Complex64]>,
) -> Vec<Complex64> {
    let scaled_denominator: Vec<f64> = loop_tf.denominator.iter().map(|value| value * mu).collect();
    let roots = durand_kerner(&poly_add(&loop_tf.numerator, &scaled_denominator));
    previous
        .map(|reference| best_root_assignment(reference, &roots))
        .unwrap_or_else(|| {
            let mut ordered = roots;
            sort_complex_points(&mut ordered);
            ordered
        })
}

fn root_locus_mu_sequence(config: &RootLocusConfig) -> Vec<f64> {
    let terminal_gain = config
        .max_gain
        .max(config.current_gain)
        .max(config.min_gain)
        .max(1e-6);
    let start_mu = 1.0 / terminal_gain;
    let end_mu = (start_mu * 1e-10).max(1e-14);
    let samples = 18usize;
    (0..samples)
        .map(|index| {
            let progress = index as f64 / (samples - 1) as f64;
            start_mu * (end_mu / start_mu).powf(progress)
        })
        .collect()
}

fn assign_branches_to_finite_zeros(
    branch_tracks: &[Vec<Complex64>],
    open_loop_zeros: &[Complex64],
) -> (Vec<RootLocusZeroAssignment>, Vec<String>) {
    let mut candidates = Vec::new();
    for (branch_index, track) in branch_tracks.iter().enumerate() {
        let Some(endpoint) = track.last() else {
            continue;
        };
        for (zero_index, zero) in open_loop_zeros.iter().enumerate() {
            let scale = endpoint.norm().max(zero.norm()).max(1.0);
            let conjugate_penalty = if endpoint.im.abs() > 1e-8
                && zero.im.abs() > 1e-8
                && endpoint.im.signum() != zero.im.signum()
            {
                100.0 * scale
            } else {
                0.0
            };
            candidates.push((
                (*endpoint - *zero).norm() + conjugate_penalty,
                branch_index,
                zero_index,
            ));
        }
    }
    candidates.sort_by(|left, right| compare_f64(left.0, right.0));

    let mut used_branches = vec![false; branch_tracks.len()];
    let mut used_zeros = vec![false; open_loop_zeros.len()];
    let mut assignments = Vec::new();
    let mut warnings = Vec::new();
    for (_cost, branch_index, zero_index) in candidates {
        if used_branches[branch_index] || used_zeros[zero_index] {
            continue;
        }
        used_branches[branch_index] = true;
        used_zeros[zero_index] = true;
        assignments.push(RootLocusZeroAssignment {
            branch_index,
            zero_index,
        });
        if assignments.len() == open_loop_zeros.len() {
            break;
        }
    }

    for zero_index in 0..open_loop_zeros.len() {
        if !used_zeros[zero_index] {
            warnings.push(format!(
                "finite zero {zero_index} was not assigned to a branch"
            ));
        }
    }

    assignments.sort_by(|left, right| left.branch_index.cmp(&right.branch_index));
    (assignments, warnings)
}

fn root_locus_near_zero_plan(
    loop_tf: &TransferFunction,
    config: &RootLocusConfig,
    branches: &[Vec<RootLocusSamplePoint>],
    open_loop_zeros: &[Complex64],
) -> RootLocusNearZeroPlan {
    if open_loop_zeros.is_empty() || branches.is_empty() {
        return RootLocusNearZeroPlan {
            segments: Vec::new(),
            assignments: Vec::new(),
            diagnostics: RootLocusDiagnostics {
                finite_zero_coverage: RootLocusFiniteZeroCoverage {
                    matched_count: 0,
                    total_count: open_loop_zeros.len(),
                    max_terminal_distance: 0.0,
                    all_matched_within_tolerance: open_loop_zeros.is_empty(),
                },
                assignment_warnings: Vec::new(),
            },
        };
    }

    let branch_endpoints: Vec<Complex64> = branches
        .iter()
        .map(|branch| {
            branch
                .last()
                .map(|point| Complex64::new(point.re, point.im))
                .unwrap_or_else(|| Complex64::new(0.0, 0.0))
        })
        .collect();
    let mut tracks: Vec<Vec<Complex64>> =
        branch_endpoints.iter().map(|point| vec![*point]).collect();
    let mut previous = branch_endpoints.clone();
    for mu in root_locus_mu_sequence(config) {
        let ordered = near_zero_roots(loop_tf, mu, Some(&previous));
        if ordered.len() != tracks.len() {
            break;
        }
        for (branch_index, root) in ordered.iter().enumerate() {
            tracks[branch_index].push(*root);
        }
        previous = ordered;
    }

    let (assignments, warnings) = assign_branches_to_finite_zeros(&tracks, open_loop_zeros);
    let max_terminal_distance = 0.0_f64;
    let mut segments = Vec::new();
    for assignment in &assignments {
        let branch_index = assignment.branch_index;
        let zero_index = assignment.zero_index;
        let Some(zero) = open_loop_zeros.get(zero_index) else {
            continue;
        };
        let Some(branch) = branches.get(branch_index) else {
            continue;
        };
        let Some(branch_endpoint) = branch.last() else {
            continue;
        };
        let mut points = Vec::new();
        points.push(root_locus_segment_point(
            branch_endpoint.re,
            branch_endpoint.im,
            Some(branch_endpoint.gain),
            Some(branch_index),
            branch_endpoint.sample_index,
        ));
        for (mu_index, root) in tracks
            .get(branch_index)
            .into_iter()
            .flat_map(|track| track.iter().skip(1))
            .enumerate()
        {
            let mu_values = root_locus_mu_sequence(config);
            let gain = mu_values
                .get(mu_index)
                .copied()
                .filter(|mu| *mu > 0.0)
                .map(|mu| 1.0 / mu);
            points.push(root_locus_segment_point(
                root.re,
                root.im,
                gain,
                Some(branch_index),
                None,
            ));
        }
        points.push(root_locus_segment_point(
            zero.re,
            zero.im,
            None,
            Some(branch_index),
            None,
        ));
        segments.push(RootLocusSegment {
            segment_type: RootLocusSegmentType::NearZero,
            line_style: RootLocusSegmentLineStyle::Solid,
            points,
            metadata: Some(RootLocusSegmentMetadata {
                branch_id: Some(branch_index),
                angle_deg: None,
                is_auxiliary: None,
                endpoint_type: Some("finite_zero".to_string()),
                target_zero_index: Some(zero_index),
                terminal_distance: Some(0.0),
                sampling_parameter: Some("mu".to_string()),
            }),
        });
    }

    let matched_count = assignments.len();
    RootLocusNearZeroPlan {
        segments,
        assignments,
        diagnostics: RootLocusDiagnostics {
            finite_zero_coverage: RootLocusFiniteZeroCoverage {
                matched_count,
                total_count: open_loop_zeros.len(),
                max_terminal_distance,
                all_matched_within_tolerance: matched_count == open_loop_zeros.len(),
            },
            assignment_warnings: warnings,
        },
    }
}

fn root_locus_asymptote_segments(
    asymptotes: &[RootLocusAsymptote],
    extent: f64,
) -> Vec<RootLocusSegment> {
    asymptotes
        .iter()
        .map(|asymptote| {
            let rad = asymptote.angle_deg.to_radians();
            RootLocusSegment {
                segment_type: RootLocusSegmentType::Asymptote,
                line_style: RootLocusSegmentLineStyle::Dashed,
                points: vec![
                    root_locus_segment_point(asymptote.centroid, 0.0, None, None, None),
                    root_locus_segment_point(
                        asymptote.centroid + rad.cos() * extent,
                        rad.sin() * extent,
                        None,
                        None,
                        None,
                    ),
                ],
                metadata: Some(RootLocusSegmentMetadata {
                    branch_id: None,
                    angle_deg: Some(asymptote.angle_deg),
                    is_auxiliary: Some(true),
                    endpoint_type: Some("infinity".to_string()),
                    target_zero_index: None,
                    terminal_distance: None,
                    sampling_parameter: Some("gain".to_string()),
                }),
            }
        })
        .collect()
}

fn root_locus_asymptotic_tail_segments(
    branches: &[Vec<RootLocusSamplePoint>],
    near_zero_plan: &RootLocusNearZeroPlan,
    asymptote_segments: &[RootLocusSegment],
) -> Vec<RootLocusSegment> {
    let mut tail_segments = Vec::new();
    let mut asymptote_index = 0usize;
    for (branch_index, branch) in branches.iter().enumerate() {
        if near_zero_plan
            .assignments
            .iter()
            .any(|assignment| assignment.branch_index == branch_index)
        {
            continue;
        }
        let Some(endpoint) = branch.last() else {
            continue;
        };
        let Some(asymptote_endpoint) = asymptote_segments
            .iter()
            .filter(|segment| segment.segment_type == RootLocusSegmentType::Asymptote)
            .nth(asymptote_index)
            .and_then(|segment| segment.points.last())
        else {
            continue;
        };
        asymptote_index += 1;
        tail_segments.push(RootLocusSegment {
            segment_type: RootLocusSegmentType::AsymptoticTail,
            line_style: RootLocusSegmentLineStyle::Solid,
            points: vec![
                root_locus_segment_point(
                    endpoint.re,
                    endpoint.im,
                    Some(endpoint.gain),
                    Some(branch_index),
                    endpoint.sample_index,
                ),
                root_locus_segment_point(
                    asymptote_endpoint.re,
                    asymptote_endpoint.im,
                    None,
                    Some(branch_index),
                    None,
                ),
            ],
            metadata: Some(RootLocusSegmentMetadata {
                branch_id: Some(branch_index),
                angle_deg: None,
                is_auxiliary: Some(true),
                endpoint_type: Some("infinity".to_string()),
                target_zero_index: None,
                terminal_distance: None,
                sampling_parameter: Some("gain".to_string()),
            }),
        });
    }
    tail_segments
}

fn root_locus_segments(
    branches: &[Vec<RootLocusSamplePoint>],
    real_axis_segments: &[RealAxisSegment],
    asymptotes: &[RootLocusAsymptote],
    open_loop_poles: &[Complex64],
    open_loop_zeros: &[Complex64],
    near_zero_plan: &RootLocusNearZeroPlan,
    near_zero_segments: &[RootLocusSegment],
) -> Vec<RootLocusSegment> {
    let centroid = asymptotes.first().map(|asymptote| asymptote.centroid);
    let extent = root_locus_plot_extent(branches, open_loop_poles, open_loop_zeros, centroid);
    let asymptote_segments = root_locus_asymptote_segments(asymptotes, extent);
    let mut segments = Vec::new();
    segments.extend(root_locus_real_axis_segments(real_axis_segments, extent));
    segments.extend(root_locus_branch_segments(branches));
    segments.extend(near_zero_segments.iter().cloned());
    segments.extend(root_locus_asymptotic_tail_segments(
        branches,
        near_zero_plan,
        &asymptote_segments,
    ));
    if near_zero_segments.is_empty() {
        segments.extend(root_locus_completion_segments(branches, open_loop_zeros));
    }
    segments.extend(asymptote_segments);
    segments
}

fn point_from_complex(value: Complex64) -> ComplexPoint {
    ComplexPoint {
        re: value.re,
        im: value.im,
    }
}

fn root_locus_events(
    open_loop_poles: &[Complex64],
    open_loop_zeros: &[Complex64],
    stationary_points: &[RootLocusSamplePoint],
    imaginary_axis_crossings: &[RootLocusSamplePoint],
    asymptotes: &[RootLocusSegment],
) -> Vec<RootLocusEvent> {
    let mut events = Vec::new();
    events.extend(
        open_loop_poles
            .iter()
            .enumerate()
            .map(|(index, pole)| RootLocusEvent {
                event_type: RootLocusEventType::OpenLoopPole,
                point: point_from_complex(*pole),
                gain: Some(0.0),
                branch_id: Some(index),
                label: None,
            }),
    );
    events.extend(
        open_loop_zeros
            .iter()
            .enumerate()
            .map(|(index, zero)| RootLocusEvent {
                event_type: RootLocusEventType::OpenLoopZero,
                point: point_from_complex(*zero),
                gain: None,
                branch_id: Some(index),
                label: None,
            }),
    );
    events.extend(stationary_points.iter().map(|point| RootLocusEvent {
        event_type: if point.gain >= 0.0 {
            RootLocusEventType::Breakaway
        } else {
            RootLocusEventType::Reentry
        },
        point: ComplexPoint {
            re: point.re,
            im: point.im,
        },
        gain: Some(point.gain),
        branch_id: point.branch_id,
        label: None,
    }));
    events.extend(imaginary_axis_crossings.iter().map(|point| RootLocusEvent {
        event_type: RootLocusEventType::ImaginaryAxisCrossing,
        point: ComplexPoint {
            re: point.re,
            im: point.im,
        },
        gain: Some(point.gain),
        branch_id: point.branch_id,
        label: None,
    }));
    events.extend(
        asymptotes
            .iter()
            .filter(|segment| segment.segment_type == RootLocusSegmentType::Asymptote)
            .enumerate()
            .filter_map(|(index, segment)| {
                segment.points.last().map(|point| RootLocusEvent {
                    event_type: RootLocusEventType::InfinityEndpoint,
                    point: ComplexPoint {
                        re: point.re,
                        im: point.im,
                    },
                    gain: None,
                    branch_id: Some(index),
                    label: None,
                })
            }),
    );
    events
}

fn structured_segment_from_points(
    id: String,
    segment_type: RootLocusStructuredSegmentType,
    branch_id: Option<usize>,
    points: Vec<RootLocusSegmentPoint>,
    is_auxiliary: Option<bool>,
) -> RootLocusStructuredSegment {
    RootLocusStructuredSegment {
        id,
        segment_type,
        branch_id,
        points,
        is_auxiliary,
    }
}

fn root_locus_branch_structure(
    branches: &[Vec<RootLocusSamplePoint>],
    near_zero_plan: &RootLocusNearZeroPlan,
    stationary_points: &[RootLocusSamplePoint],
    asymptote_segments: &[RootLocusSegment],
) -> RootLocusBranchStructure {
    let mut descriptors = Vec::new();
    let mut structured_segments = Vec::new();
    for (branch_id, branch) in branches.iter().enumerate() {
        if branch.is_empty() {
            continue;
        }
        let mut segment_ids = Vec::new();
        let to_segment_point = |point: &RootLocusSamplePoint| {
            root_locus_segment_point(
                point.re,
                point.im,
                Some(point.gain),
                point.branch_id,
                point.sample_index,
            )
        };
        let first_count = branch.len().min(4);
        let near_pole_id = format!("b{branch_id}-near-pole");
        structured_segments.push(structured_segment_from_points(
            near_pole_id.clone(),
            RootLocusStructuredSegmentType::NearPole,
            Some(branch_id),
            branch
                .iter()
                .take(first_count)
                .map(to_segment_point)
                .collect(),
            None,
        ));
        segment_ids.push(near_pole_id);

        if branch.len() > first_count {
            let regular_id = format!("b{branch_id}-regular");
            let start = first_count.saturating_sub(1);
            let end = branch.len().saturating_sub(3).max(start + 1);
            structured_segments.push(structured_segment_from_points(
                regular_id.clone(),
                RootLocusStructuredSegmentType::Regular,
                Some(branch_id),
                branch[start..end.min(branch.len())]
                    .iter()
                    .map(to_segment_point)
                    .collect(),
                None,
            ));
            segment_ids.push(regular_id);
        }

        if let Some(stationary) = stationary_points.first() {
            let near_break_id = format!("b{branch_id}-near-break");
            structured_segments.push(structured_segment_from_points(
                near_break_id.clone(),
                RootLocusStructuredSegmentType::NearBreak,
                Some(branch_id),
                vec![root_locus_segment_point(
                    stationary.re,
                    stationary.im,
                    Some(stationary.gain),
                    stationary.branch_id,
                    stationary.sample_index,
                )],
                None,
            ));
            segment_ids.push(near_break_id);
        }

        if let Some(segment) = near_zero_plan.segments.iter().find(|segment| {
            segment
                .metadata
                .as_ref()
                .and_then(|metadata| metadata.branch_id)
                == Some(branch_id)
        }) {
            let near_zero_id = format!("b{branch_id}-near-zero");
            structured_segments.push(structured_segment_from_points(
                near_zero_id.clone(),
                RootLocusStructuredSegmentType::NearZero,
                Some(branch_id),
                segment.points.clone(),
                None,
            ));
            segment_ids.push(near_zero_id);
        }

        if !near_zero_plan
            .assignments
            .iter()
            .any(|assignment| assignment.branch_index == branch_id)
        {
            let tail_id = format!("b{branch_id}-asymptotic-tail");
            structured_segments.push(structured_segment_from_points(
                tail_id.clone(),
                RootLocusStructuredSegmentType::AsymptoticTail,
                Some(branch_id),
                branch
                    .iter()
                    .rev()
                    .take(4)
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                    .map(to_segment_point)
                    .collect(),
                Some(true),
            ));
            segment_ids.push(tail_id);
        }

        descriptors.push(RootLocusBranchDescriptor {
            id: branch_id,
            start_event_type: Some(RootLocusEventType::OpenLoopPole),
            end_event_type: if near_zero_plan
                .assignments
                .iter()
                .any(|assignment| assignment.branch_index == branch_id)
            {
                Some(RootLocusEventType::OpenLoopZero)
            } else {
                Some(RootLocusEventType::InfinityEndpoint)
            },
            segment_ids,
        });
    }

    for (index, segment) in asymptote_segments
        .iter()
        .filter(|segment| segment.segment_type == RootLocusSegmentType::Asymptote)
        .enumerate()
    {
        structured_segments.push(structured_segment_from_points(
            format!("asymptote-{index}"),
            RootLocusStructuredSegmentType::Asymptote,
            Some(index),
            segment.points.clone(),
            Some(true),
        ));
    }

    RootLocusBranchStructure {
        branches: descriptors,
        segments: structured_segments,
    }
}

fn view_from_points(
    points: impl Iterator<Item = ComplexPoint>,
    include_segment_types: Vec<RootLocusStructuredSegmentType>,
    exclude_segment_types: Vec<RootLocusStructuredSegmentType>,
) -> RootLocusView {
    let mut x_min = f64::INFINITY;
    let mut x_max = f64::NEG_INFINITY;
    let mut y_min = f64::INFINITY;
    let mut y_max = f64::NEG_INFINITY;
    for point in points {
        if point.re.is_finite() && point.im.is_finite() {
            x_min = x_min.min(point.re);
            x_max = x_max.max(point.re);
            y_min = y_min.min(point.im);
            y_max = y_max.max(point.im);
        }
    }
    if !x_min.is_finite() || !x_max.is_finite() || !y_min.is_finite() || !y_max.is_finite() {
        x_min = -8.0;
        x_max = 2.0;
        y_min = -6.0;
        y_max = 6.0;
    }
    let x_padding = ((x_max - x_min).abs() * 0.12).max(0.4);
    let y_padding = ((y_max - y_min).abs() * 0.18).max(0.4);
    x_min -= x_padding;
    x_max += x_padding;
    y_min -= y_padding;
    y_max += y_padding;
    if (x_max - x_min).abs() < 1e-9 {
        x_min -= 1.0;
        x_max += 1.0;
    }
    if (y_max - y_min).abs() < 1e-9 {
        y_min -= 1.0;
        y_max += 1.0;
    }
    RootLocusView {
        x: [x_min, x_max],
        y: [y_min, y_max],
        include_segment_types,
        exclude_segment_types,
    }
}

fn root_locus_views(
    branch_structure: &RootLocusBranchStructure,
    events: &[RootLocusEvent],
    current_poles: &[ComplexPoint],
) -> RootLocusViews {
    let feature_include = vec![
        RootLocusStructuredSegmentType::NearPole,
        RootLocusStructuredSegmentType::Regular,
        RootLocusStructuredSegmentType::NearBreak,
        RootLocusStructuredSegmentType::NearZero,
    ];
    let feature_exclude = vec![
        RootLocusStructuredSegmentType::AsymptoticTail,
        RootLocusStructuredSegmentType::Asymptote,
    ];
    let full_include = vec![
        RootLocusStructuredSegmentType::NearPole,
        RootLocusStructuredSegmentType::Regular,
        RootLocusStructuredSegmentType::NearBreak,
        RootLocusStructuredSegmentType::NearZero,
        RootLocusStructuredSegmentType::AsymptoticTail,
        RootLocusStructuredSegmentType::Asymptote,
    ];
    let feature_filter = feature_include.clone();
    let feature_points = branch_structure
        .segments
        .iter()
        .filter(move |segment| feature_filter.contains(&segment.segment_type))
        .flat_map(|segment| {
            segment.points.iter().map(|point| ComplexPoint {
                re: point.re,
                im: point.im,
            })
        })
        .chain(events.iter().map(|event| event.point.clone()))
        .chain(current_poles.iter().cloned());
    let full_points = branch_structure
        .segments
        .iter()
        .flat_map(|segment| {
            segment.points.iter().map(|point| ComplexPoint {
                re: point.re,
                im: point.im,
            })
        })
        .chain(events.iter().map(|event| event.point.clone()))
        .chain(current_poles.iter().cloned());

    RootLocusViews {
        feature: view_from_points(feature_points, feature_include, feature_exclude),
        full: view_from_points(full_points, full_include, Vec::new()),
    }
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
    let max_depth = 8;
    let max_samples = 2000;
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

    let current_poles: Vec<ComplexPoint> =
        compute_characteristic_roots(loop_tf, config.current_gain)
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
    let real_axis_segments = real_axis_segments(&open_loop_poles_raw, &open_loop_zeros_raw);
    let asymptotes = root_locus_asymptotes(&open_loop_poles_raw, &open_loop_zeros_raw);
    let near_zero_plan =
        root_locus_near_zero_plan(loop_tf, config, &branches, &open_loop_zeros_raw);
    let segments = root_locus_segments(
        &branches,
        &real_axis_segments,
        &asymptotes,
        &open_loop_poles_raw,
        &open_loop_zeros_raw,
        &near_zero_plan,
        &near_zero_plan.segments,
    );
    let imaginary_axis_crossings = imaginary_axis_crossings(&branches);
    let events = root_locus_events(
        &open_loop_poles_raw,
        &open_loop_zeros_raw,
        &stationary_points,
        &imaginary_axis_crossings,
        &segments,
    );
    let branch_structure =
        root_locus_branch_structure(&branches, &near_zero_plan, &stationary_points, &segments);
    let views = root_locus_views(&branch_structure, &events, &current_poles);

    RootLocusData {
        branches,
        segments,
        events,
        branch_structure,
        views,
        diagnostics: near_zero_plan.diagnostics,
        suggested_insets: Vec::new(),
        gains,
        real_axis_segments,
        stationary_points,
        asymptotes,
        imaginary_axis_crossings,
        departure_angles: departure_angles(&open_loop_poles_raw, &open_loop_zeros_raw),
        arrival_angles: arrival_angles(&open_loop_poles_raw, &open_loop_zeros_raw),
        current_gain: config.current_gain,
        current_poles,
        open_loop_poles,
        open_loop_zeros,
        feasible_region,
    }
}

pub(crate) fn compute_analysis_inner(request: &ControlAnalysisRequest) -> ControlAnalysisResult {
    let loop_tf = build_loop_tf(request);
    let frequency_readings = exact_frequency_readings(
        &loop_tf,
        &request.frequency_probes_rad_per_sec,
        &request.frequency_range,
    );
    let needs_step = output_requested(request, &["step_response"]);
    let needs_frequency = output_requested(request, &["magnitude", "phase", "nyquist", "bode"]);
    let needs_root_locus = output_requested(request, &["root_locus"]);
    let (step_points, mut metrics) = if needs_step {
        let closed_tf = tf_unity_feedback(&loop_tf);
        let settling_band_ratio = request
            .settling_band_ratio
            .filter(|ratio| ratio.is_finite() && *ratio > 0.0 && *ratio < 1.0)
            .unwrap_or(0.02);
        step_response(
            &closed_tf,
            &request.time_range,
            request.response_type,
            settling_band_ratio,
        )
    } else {
        (Vec::new(), default_control_metrics())
    };
    let (magnitude, phase, nyquist) = if needs_frequency {
        frequency_response(&loop_tf, &request.frequency_range, request.nyquist.as_ref())
    } else {
        let mode = request
            .nyquist
            .as_ref()
            .and_then(|config| config.mode)
            .unwrap_or(NyquistPlotMode::Full);
        (
            Vec::new(),
            Vec::new(),
            NyquistData {
                mode,
                points: Vec::new(),
                positive_points: Vec::new(),
                negative_points: Vec::new(),
                positive_samples: Vec::new(),
                negative_samples: Vec::new(),
                segments: Vec::new(),
                infinity_closure: NyquistClosureSegment {
                    points: Vec::new(),
                    segments: Vec::new(),
                    line_style: "dashed".to_string(),
                },
                key_points: Vec::new(),
                asymptotes: Vec::new(),
                encirclements: 0.0,
                criterion: build_nyquist_criterion(&loop_tf, 0),
            },
        )
    };
    if needs_frequency {
        let (phase_margin_deg, gain_margin_db, gain_cross, phase_cross, bandwidth) =
            margins(&magnitude, &phase);
        metrics.phase_margin_deg = phase_margin_deg;
        metrics.gain_margin_db = gain_margin_db;
        metrics.gain_crossover_rad_per_sec = gain_cross;
        metrics.phase_crossover_rad_per_sec = phase_cross;
        metrics.phase_crossover_status = Some(if phase_cross.is_some() {
            PhaseCrossoverStatus::Finite
        } else {
            PhaseCrossoverStatus::NotObservedInFrequencyRange
        });
        metrics.bandwidth_rad_per_sec = bandwidth;
    }
    let root_locus_data = if needs_root_locus {
        let root_locus_tf = build_root_locus_tf(request);
        root_locus(
            &root_locus_tf,
            &request.root_locus,
            request.feasible_region.clone(),
        )
    } else {
        RootLocusData {
            branches: Vec::new(),
            segments: Vec::new(),
            events: Vec::new(),
            branch_structure: RootLocusBranchStructure {
                branches: Vec::new(),
                segments: Vec::new(),
            },
            views: RootLocusViews {
                feature: view_from_points(
                    std::iter::empty::<ComplexPoint>(),
                    Vec::new(),
                    Vec::new(),
                ),
                full: view_from_points(std::iter::empty::<ComplexPoint>(), Vec::new(), Vec::new()),
            },
            diagnostics: RootLocusDiagnostics {
                finite_zero_coverage: RootLocusFiniteZeroCoverage {
                    matched_count: 0,
                    total_count: 0,
                    max_terminal_distance: 0.0,
                    all_matched_within_tolerance: true,
                },
                assignment_warnings: Vec::new(),
            },
            suggested_insets: Vec::new(),
            gains: Vec::new(),
            real_axis_segments: Vec::new(),
            stationary_points: Vec::new(),
            asymptotes: Vec::new(),
            imaginary_axis_crossings: Vec::new(),
            departure_angles: Vec::new(),
            arrival_angles: Vec::new(),
            current_gain: request.root_locus.current_gain,
            current_poles: Vec::new(),
            open_loop_poles: Vec::new(),
            open_loop_zeros: Vec::new(),
            feasible_region: request.feasible_region.clone(),
        }
    };

    ControlAnalysisResult {
        metrics,
        step_response: StepResponseData {
            points: step_points,
        },
        magnitude: BodeAxisData { points: magnitude },
        phase: BodeAxisData { points: phase },
        frequency_readings,
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

pub(crate) fn compute_nonlinear_analysis_inner(
    request: &NonlinearAnalysisRequest,
) -> NonlinearAnalysisResult {
    match request.analysis_kind.as_str() {
        "phase_plane" => compute_phase_plane(request),
        "negative_inverse_family" => compute_negative_inverse(request),
        "harmonic_lowpass" => compute_harmonic(request),
        "turning_radius" => compute_turning_radius(request),
        _ => compute_characteristic(request),
    }
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
            frequency_probes_rad_per_sec: Vec::new(),
            settling_band_ratio: None,
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

    #[test]
    fn marks_phase_crossover_outside_the_requested_range_as_unobserved() {
        let request: ControlAnalysisRequest = serde_json::from_value(serde_json::json!({
            "runtimeMode": "analysis",
            "plant": {
                "numerator": [1_000_000_000.0],
                "denominator": [1.0, 3_000.0, 3_000_000.0, 1_000_000_000.0],
                "coefficientOrder": "descending"
            },
            "structures": [],
            "outputs": ["bode"],
            "timeRange": { "start": 0.0, "end": 1.0, "samples": 8 },
            "frequencyRange": { "min": 0.1, "max": 100.0, "samples": 240 },
            "rootLocus": { "minGain": 0.0, "maxGain": 2.0, "samples": 2, "currentGain": 1.0 }
        }))
        .expect("frequency-range request should deserialize");

        let result = compute_analysis_inner(&request);

        assert!(result.metrics.phase_crossover_rad_per_sec.is_none());
        assert!(result.metrics.gain_margin_db.is_none());
        assert_eq!(
            result.metrics.phase_crossover_status,
            Some(PhaseCrossoverStatus::NotObservedInFrequencyRange)
        );
    }

    fn unit_1_5_gain_request(gain: f64) -> ControlAnalysisRequest {
        serde_json::from_value(serde_json::json!({
            "runtimeMode": "analysis",
            "plant": {
                "numerator": [1.0],
                "denominator": [1.0, 7.0, 6.0, 0.0],
                "coefficientOrder": "descending"
            },
            "structures": [{ "kind": "gain", "enabled": true, "params": { "k": gain } }],
            "outputs": ["step_response", "root_locus", "bode"],
            "responseType": "step",
            "settlingBandRatio": 0.05,
            "timeRange": { "start": 0.0, "end": 90.0, "samples": 420 },
            "frequencyRange": { "min": 0.03, "max": 20.0, "samples": 220 },
            "rootLocus": { "minGain": 0.0, "maxGain": 46.0, "samples": 240, "currentGain": gain }
        }))
        .expect("1-5 request should deserialize")
    }

    #[test]
    fn unit_1_5_uses_five_percent_settling_time() {
        let k3 = compute_analysis_inner(&unit_1_5_gain_request(3.0));
        let k12 = compute_analysis_inner(&unit_1_5_gain_request(12.0));
        assert!((k3.metrics.settling_time_sec.expect("stable K=3") - 7.38).abs() < 0.35);
        assert!((k12.metrics.settling_time_sec.expect("stable K=12") - 8.05).abs() < 0.35);
    }

    #[test]
    fn unit_1_5_preserves_shared_two_percent_settling_time_default() {
        let mut default_request = unit_1_5_gain_request(3.0);
        default_request.settling_band_ratio = None;
        let default_result = compute_analysis_inner(&default_request);
        let five_percent_result = compute_analysis_inner(&unit_1_5_gain_request(3.0));
        assert!(
            default_result
                .metrics
                .settling_time_sec
                .expect("default 2% settling")
                > five_percent_result
                    .metrics
                    .settling_time_sec
                    .expect("explicit 5% settling")
        );
    }

    #[test]
    fn unit_1_5_critical_and_unstable_steps_have_no_stable_transient_metrics() {
        for gain in [42.0, 44.0] {
            let result = compute_analysis_inner(&unit_1_5_gain_request(gain));
            assert!(result.metrics.overshoot_pct.is_none(), "K={gain}");
            assert!(result.metrics.rise_time_sec.is_none(), "K={gain}");
            assert!(result.metrics.settling_time_sec.is_none(), "K={gain}");
        }
    }

    #[test]
    fn computes_exact_frequency_probes_independently_from_sampled_outputs() {
        let request: ControlAnalysisRequest = serde_json::from_value(serde_json::json!({
            "runtimeMode": "analysis",
            "plant": {
                "numerator": [1.0],
                "denominator": [1.0, 1.0],
                "coefficientOrder": "descending"
            },
            "structures": [],
            "outputs": ["step_response"],
            "timeRange": { "start": 0.0, "end": 1.0, "samples": 8 },
            "frequencyRange": { "min": 0.1, "max": 10.0, "samples": 2 },
            "frequencyProbesRadPerSec": [1.0, 1.0, 0.0, -1.0, 11.0, null, "bad"],
            "rootLocus": { "minGain": 0.0, "maxGain": 2.0, "samples": 2, "currentGain": 1.0 }
        }))
        .expect("frequency probe request should deserialize");

        let result = compute_analysis_inner(&request);

        assert!(result.magnitude.points.is_empty());
        assert!(result.phase.points.is_empty());
        assert_eq!(result.frequency_readings.len(), 1);
        let reading = &result.frequency_readings[0];
        assert!((reading.frequency_rad_per_sec - 1.0).abs() < 1e-12);
        assert!((reading.re - 0.5).abs() < 1e-12);
        assert!((reading.im + 0.5).abs() < 1e-12);
        assert!((reading.magnitude_db + 3.010_299_956_639_812).abs() < 1e-12);
        assert!((reading.phase_deg + 45.0).abs() < 1e-12);
        assert_eq!(result.metrics.phase_margin_deg, None);
    }

    #[test]
    fn exact_frequency_probe_phase_follows_the_unwrapped_bode_branch() {
        for (denominator, order) in [
            (vec![1.0, 3.0, 3.0, 1.0], 3.0_f64),
            (vec![1.0, 4.0, 6.0, 4.0, 1.0], 4.0_f64),
        ] {
            let request: ControlAnalysisRequest = serde_json::from_value(serde_json::json!({
                "runtimeMode": "analysis",
                "plant": {
                    "numerator": [1.0],
                    "denominator": denominator,
                    "coefficientOrder": "descending"
                },
                "structures": [],
                "outputs": ["bode"],
                "timeRange": { "start": 0.0, "end": 1.0, "samples": 8 },
                "frequencyRange": { "min": 0.01, "max": 100.0, "samples": 8 },
                "frequencyProbesRadPerSec": [10.0],
                "rootLocus": { "minGain": 0.0, "maxGain": 2.0, "samples": 2, "currentGain": 1.0 }
            }))
            .expect("high-order frequency probe request should deserialize");

            let result = compute_analysis_inner(&request);
            let reading = &result.frequency_readings[0];
            let expected_phase = -order * 10.0_f64.atan().to_degrees();
            let principal_from_complex = reading.im.atan2(reading.re).to_degrees();
            let wrapped_reading_phase = (reading.phase_deg + 180.0).rem_euclid(360.0) - 180.0;

            assert!((reading.phase_deg - expected_phase).abs() < 1e-10);
            assert!((wrapped_reading_phase - principal_from_complex).abs() < 1e-10);
            assert!(
                (reading.phase_deg
                    - result
                        .phase
                        .points
                        .iter()
                        .min_by(|left, right| (left.x - 10.0)
                            .abs()
                            .total_cmp(&(right.x - 10.0).abs()))
                        .expect("sampled Bode phase should exist")
                        .y)
                    .abs()
                    < 30.0
            );
        }
    }

    #[test]
    fn frequency_probes_do_not_change_sampled_bode_or_metrics() {
        let request_json = serde_json::json!({
            "runtimeMode": "analysis",
            "plant": {
                "numerator": [1.0],
                "denominator": [1.0, 3.0, 3.0, 1.0],
                "coefficientOrder": "descending"
            },
            "structures": [],
            "outputs": ["bode"],
            "timeRange": { "start": 0.0, "end": 1.0, "samples": 8 },
            "frequencyRange": { "min": 0.01, "max": 100.0, "samples": 24 },
            "rootLocus": { "minGain": 0.0, "maxGain": 2.0, "samples": 2, "currentGain": 1.0 }
        });
        let without_probes: ControlAnalysisRequest = serde_json::from_value(request_json.clone())
            .expect("baseline request should deserialize");
        let mut with_probes_json = request_json;
        with_probes_json["frequencyProbesRadPerSec"] = serde_json::json!([0.2, 2.0, 10.0]);
        let with_probes: ControlAnalysisRequest =
            serde_json::from_value(with_probes_json).expect("probe request should deserialize");

        let baseline = compute_analysis_inner(&without_probes);
        let probed = compute_analysis_inner(&with_probes);

        assert_eq!(
            serde_json::to_value((&baseline.magnitude, &baseline.phase, &baseline.metrics))
                .unwrap(),
            serde_json::to_value((&probed.magnitude, &probed.phase, &probed.metrics)).unwrap(),
        );
        assert!(baseline.frequency_readings.is_empty());
        assert_eq!(probed.frequency_readings.len(), 3);
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
            frequency_probes_rad_per_sec: Vec::new(),
            settling_band_ratio: None,
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
            frequency_probes_rad_per_sec: Vec::new(),
            settling_band_ratio: None,
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
            frequency_probes_rad_per_sec: Vec::new(),
            settling_band_ratio: None,
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
        assert!(
            result
                .root_locus
                .gains
                .iter()
                .any(|gain| (gain - 0.7059).abs() < 2e-3)
        );
        assert!(
            result
                .root_locus
                .gains
                .iter()
                .any(|gain| (gain - 7.4941).abs() < 2e-3)
        );
    }

    #[test]
    fn unit_3_3_step_05_root_locus_sorts_branches_without_crossing_complex_halves() {
        let result = compute_analysis_inner(&unit_3_3_step_05_request(2.0));

        assert_eq!(result.root_locus.branches.len(), 2);
        assert!(
            result
                .root_locus
                .branches
                .iter()
                .all(|branch| branch.len() > 30)
        );
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
    fn root_assignment_uses_deterministic_order_for_equal_distance_roots() {
        let previous = vec![Complex64::new(-1.0, 0.0), Complex64::new(-1.0, 0.0)];
        let current = vec![Complex64::new(-1.0, 0.1), Complex64::new(-1.0, -0.1)];

        let assigned = best_root_assignment(&previous, &current);

        assert!(assigned[0].im < assigned[1].im);
    }

    #[test]
    fn adaptive_root_locus_adds_dense_samples_around_stationary_points() {
        let result = compute_analysis_inner(&unit_3_3_step_05_request(2.0));

        for stationary in &result.root_locus.stationary_points {
            let nearby: Vec<f64> = result
                .root_locus
                .gains
                .iter()
                .copied()
                .filter(|gain| (gain - stationary.gain).abs() <= 0.08)
                .collect();
            assert!(
                nearby.len() >= 9,
                "stationary gain {} has sparse neighborhood {:?}",
                stationary.gain,
                nearby
            );
            assert!(nearby.iter().any(|gain| *gain < stationary.gain));
            assert!(nearby.iter().any(|gain| *gain > stationary.gain));
            assert!(
                nearby
                    .windows(2)
                    .all(|pair| (pair[1] - pair[0]).abs() <= 0.04),
                "stationary gain {} has large local gaps {:?}",
                stationary.gain,
                nearby
            );
        }
    }

    #[test]
    fn adaptive_root_locus_refines_curved_segments_by_chord_error() {
        let left = RootLocusSample {
            gain: 0.0,
            roots: vec![Complex64::new(1.0, 0.0)],
        };
        let midpoint = RootLocusSample {
            gain: 0.5,
            roots: vec![Complex64::new(0.82, 0.04)],
        };
        let right = RootLocusSample {
            gain: 1.0,
            roots: vec![Complex64::new(1.0, 0.08)],
        };

        assert!(should_refine_root_segment(&left, &midpoint, &right, 0, 8));
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
        assert!(
            result
                .root_locus
                .gains
                .iter()
                .any(|gain| (gain - 0.7059).abs() < 2e-3)
        );
        assert!(result.root_locus.gains.iter().all(|gain| *gain <= 4.0));
        assert!(
            result
                .root_locus
                .branches
                .iter()
                .all(|branch| branch.len() == 6)
        );
    }

    #[test]
    fn root_locus_returns_auxiliary_rule_data() {
        let result = compute_analysis_inner(&platform_pitch_request(1.0));

        assert!(!result.root_locus.real_axis_segments.is_empty());
        assert!(!result.root_locus.asymptotes.is_empty());
        assert!(
            result
                .root_locus
                .segments
                .iter()
                .any(
                    |segment| segment.segment_type == RootLocusSegmentType::RealAxisLocus
                        && segment.line_style == RootLocusSegmentLineStyle::Solid
                )
        );
        assert!(
            result
                .root_locus
                .segments
                .iter()
                .any(
                    |segment| segment.segment_type == RootLocusSegmentType::Branch
                        && segment.line_style == RootLocusSegmentLineStyle::Solid
                )
        );
        assert!(
            result
                .root_locus
                .segments
                .iter()
                .filter(|segment| segment.segment_type == RootLocusSegmentType::Asymptote)
                .all(|segment| {
                    segment.line_style == RootLocusSegmentLineStyle::Dashed
                        && segment.points.len() == 2
                        && segment.points[0].im.abs() <= 1e-12
                })
        );
        assert!(
            result
                .root_locus
                .departure_angles
                .iter()
                .all(|angle| angle.angle_deg.is_finite())
        );
        assert!(
            result
                .root_locus
                .arrival_angles
                .iter()
                .all(|angle| angle.angle_deg.is_finite())
        );
        assert!(
            result
                .root_locus
                .imaginary_axis_crossings
                .iter()
                .all(|point| point.gain.is_finite() && point.gain >= 0.0)
        );
    }

    #[test]
    fn root_locus_segments_complete_branches_to_finite_complex_zeros() {
        let mut request = unit_3_3_step_05_request(1.0);
        request.plant = TransferFunctionSpec {
            numerator: vec![1.0, 2.0, 5.0],
            denominator: vec![1.0, 6.0, 11.0, 6.0],
        };
        request.outputs = vec!["root_locus".to_string()];
        request.root_locus.max_gain = 20.0;
        request.root_locus.samples = 48;

        let result = compute_analysis_inner(&request);
        let near_zero_segments: Vec<&RootLocusSegment> = result
            .root_locus
            .segments
            .iter()
            .filter(|segment| segment.segment_type == RootLocusSegmentType::NearZero)
            .collect();
        let asymptote = result
            .root_locus
            .segments
            .iter()
            .find(|segment| segment.segment_type == RootLocusSegmentType::Asymptote)
            .expect("expected one asymptote ray for three poles and two zeros");

        assert_eq!(result.root_locus.open_loop_zeros.len(), 2);
        assert_eq!(near_zero_segments.len(), 2);
        for zero in &result.root_locus.open_loop_zeros {
            assert!(near_zero_segments.iter().any(|segment| {
                segment
                    .points
                    .last()
                    .map(|point| {
                        (point.re - zero.re).abs() < 1e-6 && (point.im - zero.im).abs() < 1e-6
                    })
                    .unwrap_or(false)
            }));
        }
        assert_eq!(asymptote.points.len(), 2);
        assert!((asymptote.points[0].re + 4.0).abs() < 1e-6);
        assert!(asymptote.points[1].re < asymptote.points[0].re);
    }

    #[test]
    fn root_locus_segments_do_not_draw_forbidden_left_middle_real_pole_interval() {
        let mut request = unit_3_3_step_05_request(1.0);
        request.plant = TransferFunctionSpec {
            numerator: vec![1.0],
            denominator: vec![1.0, 6.0, 11.0, 6.0],
        };
        request.outputs = vec!["root_locus".to_string()];
        request.root_locus.max_gain = 50.0;

        let result = compute_analysis_inner(&request);
        let mut real_poles: Vec<f64> = result
            .root_locus
            .open_loop_poles
            .iter()
            .filter(|pole| pole.im.abs() <= 1e-8)
            .map(|pole| pole.re)
            .collect();
        real_poles.sort_by(|left, right| compare_f64(*left, *right));
        let forbidden_start = real_poles[0];
        let forbidden_end = real_poles[1];

        assert_eq!(real_poles.len(), 3);
        assert!(
            result
                .root_locus
                .segments
                .iter()
                .filter(|segment| segment.segment_type == RootLocusSegmentType::RealAxisLocus)
                .all(|segment| {
                    let left = segment
                        .points
                        .iter()
                        .map(|point| point.re)
                        .fold(f64::INFINITY, f64::min);
                    let right = segment
                        .points
                        .iter()
                        .map(|point| point.re)
                        .fold(f64::NEG_INFINITY, f64::max);
                    right <= forbidden_start + 1e-8 || left >= forbidden_end - 1e-8
                })
        );
    }

    #[test]
    fn root_locus_completion_segments_are_not_long_zero_chords() {
        let mut request = unit_3_3_step_05_request(1.0);
        request.plant = TransferFunctionSpec {
            numerator: vec![1.0, 2.0, 5.0],
            denominator: vec![1.0, 6.0, 11.0, 6.0],
        };
        request.outputs = vec!["root_locus".to_string()];
        request.root_locus.max_gain = 1.0;
        request.root_locus.samples = 24;

        let result = compute_analysis_inner(&request);

        assert!(
            result
                .root_locus
                .segments
                .iter()
                .all(|segment| segment.segment_type != RootLocusSegmentType::BranchCompletion)
        );
    }

    #[test]
    fn root_locus_near_zero_segments_reach_complex_zeros_when_gain_range_is_low() {
        let mut request = unit_3_3_step_05_request(1.0);
        request.plant = TransferFunctionSpec {
            numerator: vec![1.0, 2.0, 5.0],
            denominator: vec![1.0, 6.0, 11.0, 6.0],
        };
        request.outputs = vec!["root_locus".to_string()];
        request.root_locus.max_gain = 1.0;
        request.root_locus.samples = 24;

        let result = compute_analysis_inner(&request);
        let near_zero_segments: Vec<&RootLocusSegment> = result
            .root_locus
            .segments
            .iter()
            .filter(|segment| segment.segment_type == RootLocusSegmentType::NearZero)
            .collect();

        assert_eq!(result.root_locus.open_loop_zeros.len(), 2);
        assert_eq!(near_zero_segments.len(), 2);
        for (zero_index, zero) in result.root_locus.open_loop_zeros.iter().enumerate() {
            let segment = near_zero_segments
                .iter()
                .find(|segment| {
                    segment
                        .metadata
                        .as_ref()
                        .and_then(|metadata| metadata.target_zero_index)
                        == Some(zero_index)
                })
                .expect("missing near-zero segment for finite zero");
            let metadata = segment
                .metadata
                .as_ref()
                .expect("missing near-zero metadata");
            let endpoint = segment.points.last().expect("missing near-zero endpoint");

            assert_eq!(metadata.endpoint_type.as_deref(), Some("finite_zero"));
            assert_eq!(metadata.sampling_parameter.as_deref(), Some("mu"));
            assert!(metadata.terminal_distance.unwrap_or(1.0) < 1e-8);
            assert!((endpoint.re - zero.re).abs() < 1e-8);
            assert!((endpoint.im - zero.im).abs() < 1e-8);
        }
        assert!(
            result
                .root_locus
                .diagnostics
                .finite_zero_coverage
                .all_matched_within_tolerance
        );
    }

    #[test]
    fn root_locus_near_zero_assignment_keeps_conjugate_halves() {
        let mut request = unit_3_3_step_05_request(1.0);
        request.plant = TransferFunctionSpec {
            numerator: vec![1.0, 2.0, 5.0],
            denominator: vec![1.0, 6.0, 11.0, 6.0],
        };
        request.outputs = vec!["root_locus".to_string()];
        request.root_locus.max_gain = 1.0;
        request.root_locus.samples = 24;

        let result = compute_analysis_inner(&request);

        for segment in result
            .root_locus
            .segments
            .iter()
            .filter(|segment| segment.segment_type == RootLocusSegmentType::NearZero)
        {
            let points_with_imaginary_part: Vec<&RootLocusSegmentPoint> = segment
                .points
                .iter()
                .filter(|point| point.im.abs() > 1e-8)
                .collect();
            if points_with_imaginary_part.len() < 2 {
                continue;
            }
            let first_sign = points_with_imaginary_part.first().unwrap().im.signum();
            let last_sign = points_with_imaginary_part.last().unwrap().im.signum();

            assert_eq!(
                first_sign, last_sign,
                "near-zero segment crosses conjugate halves: {:?}",
                segment.points
            );
        }
        assert!(result.root_locus.diagnostics.assignment_warnings.is_empty());
    }

    #[test]
    fn root_locus_zero_page_gain_uses_open_loop_model_before_gain_structure() {
        let mut request = unit_3_3_step_05_request(0.0);
        request.plant = TransferFunctionSpec {
            numerator: vec![1.0, 2.0, 5.0],
            denominator: vec![1.0, 6.0, 11.0, 6.0],
        };
        request.outputs = vec!["root_locus".to_string()];
        request.root_locus.current_gain = 0.0;

        let result = compute_analysis_inner(&request);

        assert_eq!(result.root_locus.open_loop_zeros.len(), 2);
        assert!(
            result
                .root_locus
                .open_loop_zeros
                .iter()
                .any(|zero| (zero.re + 1.0).abs() < 1e-8 && (zero.im - 2.0).abs() < 1e-8)
        );
        assert!(
            result
                .root_locus
                .open_loop_zeros
                .iter()
                .any(|zero| (zero.re + 1.0).abs() < 1e-8 && (zero.im + 2.0).abs() < 1e-8)
        );
    }

    #[test]
    fn direct_pd_correction_does_not_add_cancelled_origin_pole_or_zero() {
        let mut request = ship_heading_request(1.0);
        request.outputs = vec!["root_locus".to_string()];
        let baseline = compute_analysis_inner(&request);
        request.structures.push(StructureSpec {
            kind: "pid".to_string(),
            enabled: true,
            params: HashMap::from([
                ("kp".to_string(), 1.0),
                ("ki".to_string(), 0.0),
                ("kd".to_string(), 0.2),
                ("tf".to_string(), 0.04),
            ]),
        });

        let result = compute_analysis_inner(&request);
        let origin_pole_count = |points: &[ComplexPoint]| {
            points
                .iter()
                .filter(|point| point.re.abs() < 1e-9 && point.im.abs() < 1e-9)
                .count()
        };
        let origin_zero_count = |points: &[ComplexPoint]| {
            points
                .iter()
                .filter(|point| point.re.abs() < 1e-9 && point.im.abs() < 1e-9)
                .count()
        };

        assert_eq!(
            origin_pole_count(&result.root_locus.open_loop_poles),
            origin_pole_count(&baseline.root_locus.open_loop_poles)
        );
        assert_eq!(
            origin_zero_count(&result.root_locus.open_loop_zeros),
            origin_zero_count(&baseline.root_locus.open_loop_zeros)
        );
        assert!(
            result
                .root_locus
                .open_loop_poles
                .iter()
                .any(|pole| (pole.re + 25.0).abs() < 1e-8 && pole.im.abs() < 1e-8)
        );
        assert!(
            result
                .root_locus
                .open_loop_zeros
                .iter()
                .any(|zero| (zero.re + 1.0 / 0.24).abs() < 1e-8 && zero.im.abs() < 1e-8)
        );
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
    fn nyquist_returns_full_contour_metadata_and_key_points() {
        let mut request = ship_heading_request(1.0);
        request.root_locus.current_gain = 2.75;
        request.nyquist = Some(NyquistConfig {
            mode: Some(NyquistPlotMode::Full),
            sampling_mode: Some(SamplingMode::Adaptive),
        });

        let result = compute_analysis_inner(&request);

        assert_eq!(result.nyquist.mode, NyquistPlotMode::Full);
        assert!(!result.nyquist.positive_points.is_empty());
        assert_eq!(result.root_locus.current_gain, 2.75);
        assert_eq!(
            result.nyquist.positive_samples.len(),
            result.nyquist.positive_points.len()
        );
        assert_eq!(
            result.nyquist.negative_samples.len(),
            result.nyquist.negative_points.len()
        );
        assert!(
            result
                .nyquist
                .positive_samples
                .iter()
                .all(|point| point.frequency.is_finite()
                    && point.frequency > 0.0
                    && point.magnitude_db.is_finite()
                    && point.phase_deg.is_finite())
        );
        assert!(
            result
                .nyquist
                .negative_samples
                .iter()
                .all(|point| point.frequency.is_finite() && point.frequency < 0.0)
        );
        assert_eq!(
            result.nyquist.positive_points.len(),
            result.nyquist.negative_points.len()
        );
        assert!(result.nyquist.points.len() >= result.nyquist.positive_points.len() * 2);
        assert_eq!(result.nyquist.infinity_closure.line_style, "dashed");
        assert_eq!(
            result
                .nyquist
                .segments
                .iter()
                .map(|segment| segment.segment_type.as_str())
                .collect::<Vec<_>>(),
            vec!["regular_negative", "infinity_arc", "regular_positive"]
        );
        assert_eq!(result.nyquist.infinity_closure.segments.len(), 1);
        let closure = &result.nyquist.infinity_closure.segments[0];
        let positive_start = result.nyquist.positive_points.first().unwrap();
        let negative_end = result.nyquist.negative_points.last().unwrap();
        assert!(closure.len() > 40);
        assert!((closure.first().unwrap().re - negative_end.re).abs() < 1e-9);
        assert!((closure.first().unwrap().im - negative_end.im).abs() < 1e-9);
        assert!((closure.last().unwrap().re - positive_start.re).abs() < 1e-9);
        assert!((closure.last().unwrap().im - positive_start.im).abs() < 1e-9);
        assert!(
            closure
                .iter()
                .any(|point| point.re > positive_start.re.hypot(positive_start.im) * 0.5)
        );
        let high_frequency_gap = result.nyquist.positive_points.last().unwrap().re
            - result.nyquist.negative_points.first().unwrap().re;
        assert!(high_frequency_gap.abs() < 1e-6);
        assert!(
            result
                .nyquist
                .key_points
                .iter()
                .any(|point| point.kind == "real_axis_crossing")
        );
        assert!(
            result
                .nyquist
                .key_points
                .iter()
                .any(|point| point.kind == "unit_circle_crossing")
        );
        assert!(
            result
                .nyquist
                .key_points
                .iter()
                .all(|point| point.frequency.is_finite())
        );
        assert!(result.nyquist.encirclements.is_finite());
    }

    #[test]
    fn nyquist_origin_pole_display_starts_near_visible_radius_without_changing_criterion() {
        let mut request = ship_heading_request(1.0);
        request.frequency_range = FrequencyRangeConfig {
            min: 1e-3,
            max: 1e1,
            samples: 360,
        };
        request.nyquist = Some(NyquistConfig {
            mode: Some(NyquistPlotMode::Full),
            sampling_mode: Some(SamplingMode::Adaptive),
        });

        let result = compute_analysis_inner(&request);
        let display_start_radius = result
            .nyquist
            .positive_points
            .first()
            .map(|point| point.re.hypot(point.im))
            .unwrap_or(f64::INFINITY);
        let closure_max_radius = result
            .nyquist
            .infinity_closure
            .segments
            .iter()
            .flatten()
            .map(|point| point.re.hypot(point.im))
            .fold(0.0_f64, f64::max);

        assert!(
            display_start_radius <= 2.25,
            "display radius {display_start_radius}"
        );
        assert!(
            closure_max_radius <= 2.75,
            "closure radius {closure_max_radius}"
        );
        assert!(result.nyquist.criterion.is_consistent);
        assert_eq!(
            result.nyquist.criterion.z as i64,
            result.nyquist.criterion.p as i64 + result.nyquist.criterion.n
        );
        assert!(!result.magnitude.points.is_empty());
        assert!(result.magnitude.points[0].y > 30.0);
    }

    #[test]
    fn nyquist_criterion_returns_n_p_z() {
        let mut request = ship_heading_request(1.0);
        request.plant = TransferFunctionSpec {
            numerator: vec![2.0],
            denominator: vec![1.0, -1.0],
        };
        request.structures = vec![StructureSpec {
            kind: "gain".to_string(),
            enabled: true,
            params: HashMap::from([(String::from("k"), 1.0)]),
        }];
        request.frequency_range = FrequencyRangeConfig {
            min: 1e-3,
            max: 1e3,
            samples: 360,
        };
        request.nyquist = Some(NyquistConfig {
            mode: Some(NyquistPlotMode::Full),
            sampling_mode: Some(SamplingMode::Adaptive),
        });

        let result = compute_analysis_inner(&request);

        assert_eq!(result.nyquist.criterion.p, 1);
        assert_eq!(result.nyquist.criterion.z, 0);
        assert_eq!(result.nyquist.criterion.n, -1);
        assert!(result.nyquist.criterion.is_consistent);
        assert_eq!(
            result.nyquist.encirclements,
            result.nyquist.criterion.n as f64
        );
    }

    #[test]
    fn nyquist_criterion_matches_closed_loop_roots() {
        let request = ship_heading_request(1.0);
        let result = compute_analysis_inner(&request);
        let loop_tf = build_loop_tf(&request);
        let closed_loop_rhp_roots =
            durand_kerner(&poly_add(&loop_tf.denominator, &loop_tf.numerator))
                .iter()
                .filter(|root| root.re > 1e-7)
                .count();

        assert_eq!(result.nyquist.criterion.p, 0);
        assert_eq!(result.nyquist.criterion.z, closed_loop_rhp_roots);
        assert_eq!(
            result.nyquist.criterion.z as i64,
            result.nyquist.criterion.p as i64 + result.nyquist.criterion.n as i64
        );
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
        assert_eq!(
            result
                .nyquist
                .segments
                .iter()
                .map(|segment| segment.segment_type.as_str())
                .collect::<Vec<_>>(),
            vec!["regular_positive"]
        );
    }

    #[test]
    fn root_locus_returns_event_branch_view_structure() {
        let result = compute_analysis_inner(&platform_pitch_request(1.0));
        let event_types: Vec<&RootLocusEventType> = result
            .root_locus
            .events
            .iter()
            .map(|event| &event.event_type)
            .collect();
        let segment_types: Vec<&RootLocusStructuredSegmentType> = result
            .root_locus
            .branch_structure
            .segments
            .iter()
            .map(|segment| &segment.segment_type)
            .collect();

        assert!(event_types.contains(&&RootLocusEventType::OpenLoopPole));
        assert!(event_types.contains(&&RootLocusEventType::OpenLoopZero));
        assert!(event_types.contains(&&RootLocusEventType::Breakaway));
        assert!(event_types.contains(&&RootLocusEventType::ImaginaryAxisCrossing));
        assert!(event_types.contains(&&RootLocusEventType::InfinityEndpoint));
        assert!(segment_types.contains(&&RootLocusStructuredSegmentType::NearPole));
        assert!(segment_types.contains(&&RootLocusStructuredSegmentType::Regular));
        assert!(segment_types.contains(&&RootLocusStructuredSegmentType::NearBreak));
        assert!(segment_types.contains(&&RootLocusStructuredSegmentType::NearZero));
        assert!(segment_types.contains(&&RootLocusStructuredSegmentType::AsymptoticTail));
        assert!(segment_types.contains(&&RootLocusStructuredSegmentType::Asymptote));
        assert!(!result.root_locus.branch_structure.branches.is_empty());
        assert!(result.root_locus.views.feature.x[0] < result.root_locus.views.feature.x[1]);
        assert!(result.root_locus.views.full.y[0] < result.root_locus.views.full.y[1]);
    }

    #[test]
    fn root_locus_feature_view_excludes_asymptotic_tail() {
        let result = compute_analysis_inner(&ship_heading_request(1.0));

        assert!(
            result
                .root_locus
                .views
                .feature
                .exclude_segment_types
                .contains(&RootLocusStructuredSegmentType::AsymptoticTail)
        );
        assert!(
            result
                .root_locus
                .views
                .feature
                .exclude_segment_types
                .contains(&RootLocusStructuredSegmentType::Asymptote)
        );
        assert!(
            result
                .root_locus
                .views
                .full
                .include_segment_types
                .contains(&RootLocusStructuredSegmentType::AsymptoticTail)
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

    fn relative_close(left: f64, right: f64, abs_tol: f64, rel_tol: f64) -> bool {
        let diff = (left - right).abs();
        diff <= abs_tol || diff <= rel_tol * left.abs().max(right.abs())
    }

    #[test]
    fn analysis_metrics_stay_finite_within_declared_tolerance() {
        let baseline = compute_analysis_inner(&unit_1_5_gain_request(3.0));
        let nearby = compute_analysis_inner(&unit_1_5_gain_request(3.0001));
        assert!(baseline.metrics.final_value.is_finite());
        assert!(nearby.metrics.final_value.is_finite());
        assert!(relative_close(
            baseline.metrics.final_value,
            nearby.metrics.final_value,
            1e-6,
            1e-3,
        ));
        if let (Some(left), Some(right)) =
            (baseline.metrics.overshoot_pct, nearby.metrics.overshoot_pct)
        {
            assert!(left.is_finite());
            assert!(right.is_finite());
            assert!(relative_close(left, right, 1e-4, 5e-3));
        }
    }

    #[test]
    fn analysis_request_errors_remain_fail_closed() {
        assert_eq!(
            analysis_request_errors("simulation", false),
            Some("只支持 analysis 模式请求。")
        );
        assert_eq!(
            analysis_request_errors("analysis", true),
            Some("outputs 不能为空。")
        );
        assert_eq!(analysis_request_errors("analysis", false), None);
    }
}
