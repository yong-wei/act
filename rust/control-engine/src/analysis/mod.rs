//! Control analysis implementation behind the WASM facade.
//!
//! Linear/frequency-domain analysis, nonlinear analysis and their result
//! assembly live here; `lib.rs` only decodes, dispatches and exports.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

use crate::controllers::{StructureSpec, tf_from_structure};

mod tf;
mod time;
mod frequency;
mod root_locus;
mod nonlinear;

use tf::*;
pub(crate) use tf::tf_mul;
use time::*;
use frequency::*;
use root_locus::*;
use nonlinear::*;

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

pub(crate) fn compute_analysis_inner(request: &ControlAnalysisRequest) -> ControlAnalysisResult {
    let loop_tf = build_plant_tf(request, true);
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
        let root_locus_tf = build_plant_tf(request, false);
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
    use num_complex::Complex64;

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
        real_poles.sort_by(|left, right| (*left).total_cmp(&(*right)));
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
        let loop_tf = build_plant_tf(&request, true);
        let closed_loop_rhp_roots =
            durand_kerner(&poly_combine(&loop_tf.denominator, &loop_tf.numerator, 1.0))
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
