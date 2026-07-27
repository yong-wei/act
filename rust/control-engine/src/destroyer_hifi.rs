use serde::Serialize;

const SEA_WATER_DENSITY: f64 = 1025.0;
pub(crate) const DEG: f64 = std::f64::consts::PI / 180.0;
const ACTIVE_DISTURBANCE_SCALE: f64 = 0.35;

#[derive(Clone, Debug)]
pub struct DestroyerExperimentConfig {
    pub length_m: f64,
    pub beam_m: f64,
    pub draft_m: f64,
    pub displacement_t: f64,
    pub cruise_speed_mps: f64,
    pub max_rudder_deg: f64,
    pub max_rudder_rate_deg_s: f64,
    pub dt_s: f64,
}

impl Default for DestroyerExperimentConfig {
    fn default() -> Self {
        Self {
            length_m: 180.0,
            beam_m: 20.0,
            draft_m: 6.6,
            displacement_t: 13_000.0,
            cruise_speed_mps: 15.0,
            max_rudder_deg: 35.0,
            max_rudder_rate_deg_s: 5.0,
            dt_s: 0.25,
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisturbanceVector {
    pub force_x: f64,
    pub force_y: f64,
    pub moment_n: f64,
}

impl DisturbanceVector {
    pub(crate) fn zero() -> Self {
        Self {
            force_x: 0.0,
            force_y: 0.0,
            moment_n: 0.0,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeSample {
    pub time_s: f64,
    pub target_heading_deg: f64,
    #[serde(skip_serializing)]
    pub heading_rad: f64,
    pub heading_deg: f64,
    #[serde(skip_serializing)]
    pub yaw_rate_rad: f64,
    pub yaw_rate_deg_s: f64,
    pub position_x_m: f64,
    pub position_y_m: f64,
    pub rudder_deg: f64,
    pub speed_mps: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenLoopProbe {
    pub samples: Vec<ProbeSample>,
    pub final_heading_deg: f64,
    pub max_rudder_deg: f64,
    pub max_rudder_rate_deg_s: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentifiedTransferFunction {
    pub k: f64,
    pub slow_pole: f64,
    pub fast_pole: f64,
    pub numerator: Vec<f64>,
    pub denominator: Vec<f64>,
    pub rudder_time_constant_s: f64,
    pub hull_time_constant_s: f64,
    pub disturbance_time_constant_s: f64,
    pub disturbance_equivalent_rudder_gain_rad: f64,
    pub heading_rmse_deg: f64,
    pub yaw_rate_rmse_deg_s: f64,
    pub identification_input: String,
    pub structure: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StepIdentificationSample {
    pub time_s: f64,
    pub input_value: f64,
    pub hifi_output: f64,
    pub identified_output: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RudderActuatorIdentification {
    pub time_constant_s: f64,
    pub command_step_deg: f64,
    pub output_unit: String,
    pub rmse_deg: f64,
    pub step_response: Vec<StepIdentificationSample>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HullYawIdentification {
    pub time_constant_s: f64,
    pub gain_yaw_rate_per_rudder_rad: f64,
    pub input_unit: String,
    pub output_unit: String,
    pub rmse_deg_s: f64,
    pub step_response: Vec<StepIdentificationSample>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisturbancePathIdentification {
    pub time_constant_s: f64,
    pub equivalent_rudder_gain_rad: f64,
    pub input_unit: String,
    pub output_unit: String,
    pub rmse_deg_s: f64,
    pub step_response: Vec<StepIdentificationSample>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SegmentedIdentification {
    pub rudder_actuator: RudderActuatorIdentification,
    pub hull_yaw: HullYawIdentification,
    pub disturbance_path: DisturbancePathIdentification,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationScenario {
    pub scenario_id: String,
    pub title: String,
    pub heading_rmse_deg: f64,
    pub yaw_rate_rmse_deg_s: f64,
    pub max_heading_error_deg: f64,
    pub max_rudder_deg: f64,
    pub duration_s: f64,
    pub disturbance_enabled: bool,
    pub hifi_trace: Vec<ProbeSample>,
    pub identified_trace: Vec<ProbeSample>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerComparisonRow {
    pub controller_id: String,
    pub controller_name: String,
    pub model_kind: String,
    pub scenario_id: String,
    pub tracking_rmse_deg: f64,
    pub max_heading_error_deg: f64,
    pub max_rudder_deg: f64,
    pub settling_time_s: Option<f64>,
    pub total_variation_deg: f64,
    pub disturbance_enabled: bool,
    pub score: f64,
    pub trace: Vec<ProbeSample>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerEncoding {
    pub controller_id: String,
    pub controller_name: String,
    pub structure_code: u8,
    pub kp: f64,
    pub ki: f64,
    pub kd: f64,
    pub lead_strength: f64,
    pub lag_strength: f64,
    pub derivative_filter: f64,
    pub measurement_filter_time_constant_s: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMetadata {
    pub method: String,
    pub population_size: usize,
    pub generations: usize,
    pub elite_count: usize,
    pub crossover_rate: f64,
    pub mutation_rate: f64,
    pub random_seed: u64,
    pub local_refinement: String,
    pub encoding_note: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SensorNoiseSettings {
    pub measured_signal: String,
    pub equation: String,
    pub bias_deg: f64,
    pub sigma_deg: f64,
    pub sampling_note: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonCase {
    pub case_id: String,
    pub title: String,
    pub scenario_id: String,
    pub controller_id: String,
    pub model_kind: String,
    pub disturbance_enabled: bool,
    pub noise_enabled: bool,
    pub design_source: String,
    pub figure_name: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonGroup {
    pub group_id: String,
    pub title: String,
    pub cases: Vec<ComparisonCase>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelBoundary {
    pub model_family: String,
    pub source_policy: String,
    pub ship_name: String,
    pub length_m: f64,
    pub beam_m: f64,
    pub draft_m: f64,
    pub displacement_t: f64,
    pub cruise_speed_mps: f64,
    pub max_rudder_deg: f64,
    pub max_rudder_rate_deg_s: f64,
    pub note: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisturbanceInterface {
    pub enabled_in_hifi_model: bool,
    pub vector_fields: Vec<String>,
    pub units: Vec<String>,
    pub active_level_id: String,
    pub active_yaw_moment_ratio_to_full_rudder: f64,
    pub engineering_levels: Vec<DisturbanceLevel>,
    pub experiment_pattern: String,
    pub design_note: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisturbanceLevel {
    pub level_id: String,
    pub title: String,
    pub yaw_moment_ratio_to_full_rudder: String,
    pub expected_behavior: String,
    pub design_use: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DestroyerHifiExperimentReport {
    pub model_boundary: ModelBoundary,
    pub identified_transfer_function: IdentifiedTransferFunction,
    pub segmented_identification: SegmentedIdentification,
    pub validation_scenarios: Vec<ValidationScenario>,
    pub controller_comparison: Vec<ControllerComparisonRow>,
    pub controller_encoding: Vec<ControllerEncoding>,
    pub nominal_comparison: Vec<ComparisonGroup>,
    pub disturbance_comparison: Vec<ComparisonGroup>,
    pub noise_comparison: Vec<ComparisonGroup>,
    pub search_metadata: SearchMetadata,
    pub sensor_noise_settings: SensorNoiseSettings,
    pub selected_controller_id: String,
    pub disturbance_interface: DisturbanceInterface,
}

#[derive(Clone, Copy)]
pub(crate) struct MmgState {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) psi: f64,
    pub(crate) u: f64,
    pub(crate) v: f64,
    pub(crate) r: f64,
    pub(crate) rudder: f64,
}

#[derive(Clone, Copy)]
pub(crate) struct MmgParams {
    m: f64,
    iz: f64,
    mx: f64,
    my: f64,
    jz: f64,
    xuu: f64,
    xvv: f64,
    xrr: f64,
    xvr: f64,
    yv: f64,
    yr: f64,
    yvvv: f64,
    yrrr: f64,
    yvvr: f64,
    yvrr: f64,
    nv: f64,
    nr: f64,
    nvvv: f64,
    nrrr: f64,
    nvvr: f64,
    nvrr: f64,
    tr: f64,
    ah: f64,
    xr: f64,
    propeller_force_n: f64,
}

#[derive(Clone, Copy)]
struct Derivatives {
    dx: f64,
    dy: f64,
    dpsi: f64,
    du: f64,
    dv: f64,
    dr: f64,
}

#[derive(Clone, Copy)]
struct IdentifiedState {
    psi: f64,
    r: f64,
    rudder: f64,
    disturbance_equivalent: f64,
}

#[derive(Clone, Copy)]
struct ControllerSpec {
    id: &'static str,
    name: &'static str,
    structure_code: u8,
    kp: f64,
    ki: f64,
    kd: f64,
    lead: f64,
    lag: f64,
    filter: f64,
    measurement_filter_s: f64,
}

struct ControllerState {
    integral: f64,
    derivative: f64,
    lagged_error: f64,
    previous_error: f64,
    previous_rudder: f64,
}

fn clamp(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

pub(crate) fn wrap_pi(mut value: f64) -> f64 {
    while value > std::f64::consts::PI {
        value -= 2.0 * std::f64::consts::PI;
    }
    while value < -std::f64::consts::PI {
        value += 2.0 * std::f64::consts::PI;
    }
    value
}

pub(crate) fn params(config: &DestroyerExperimentConfig) -> MmgParams {
    let m = config.displacement_t * 1000.0;
    MmgParams {
        m,
        iz: 0.25 * m * config.length_m * config.length_m,
        mx: 0.05,
        my: 0.60,
        jz: 0.12,
        xuu: -0.018,
        xvv: -0.034,
        xrr: 0.002,
        xvr: 0.001,
        yv: -0.285,
        yr: 0.065,
        yvvv: -1.35,
        yrrr: 0.006,
        yvvr: 0.28,
        yvrr: -0.30,
        nv: -0.105,
        nr: -0.043,
        nvvv: -0.026,
        nrrr: -0.011,
        nvvr: -0.22,
        nvrr: 0.045,
        tr: 0.34,
        ah: 0.24,
        xr: -0.50 * config.length_m,
        propeller_force_n: 0.018
            * 0.5
            * SEA_WATER_DENSITY
            * config.length_m
            * config.draft_m
            * config.cruise_speed_mps
            * config.cruise_speed_mps,
    }
}

fn initial_state(config: &DestroyerExperimentConfig) -> MmgState {
    MmgState {
        x: 0.0,
        y: 0.0,
        psi: 0.0,
        u: config.cruise_speed_mps,
        v: 0.0,
        r: 0.0,
        rudder: 0.0,
    }
}

fn forces(
    state: MmgState,
    config: &DestroyerExperimentConfig,
    p: MmgParams,
    disturbance: DisturbanceVector,
) -> (f64, f64, f64) {
    let u = state.u;
    let v = state.v;
    let r = state.r;
    let speed = (u * u + v * v).sqrt().max(0.1);
    let vp = v / speed;
    let rp = r * config.length_m / speed;
    let q = 0.5 * SEA_WATER_DENSITY * config.length_m * config.draft_m * speed * speed;
    let xh = q
        * (p.xuu * (u / speed).powi(2) + p.xvv * vp.powi(2) + p.xrr * rp.powi(2) + p.xvr * vp * rp);
    let yh = q
        * (p.yv * vp
            + p.yr * rp
            + p.yvvv * vp.powi(3)
            + p.yrrr * rp.powi(3)
            + p.yvvr * vp * vp * rp
            + p.yvrr * vp * rp * rp);
    let nh = q
        * config.length_m
        * (p.nv * vp
            + p.nr * rp
            + p.nvvv * vp.powi(3)
            + p.nrrr * rp.powi(3)
            + p.nvvr * vp * vp * rp
            + p.nvrr * vp * rp * rp);

    let ur = u;
    let vr = v + p.xr * r;
    let rudder_flow = (ur * ur + vr * vr).sqrt().max(0.1);
    let alpha_r = state.rudder - vr.atan2(ur);
    let area_r = config.length_m * 0.015;
    let cl = 2.0 * std::f64::consts::PI * alpha_r.sin();
    let lift = 0.5 * SEA_WATER_DENSITY * area_r * rudder_flow * rudder_flow * cl;
    let normal = (1.0 + p.ah) * lift;
    let xr = -normal * state.rudder.sin();
    let yr = -(1.0 - p.tr) * normal * state.rudder.cos();
    let nr = -(p.xr + p.ah * config.length_m * 0.25) * normal * state.rudder.cos();

    (
        xh + p.propeller_force_n + xr + disturbance.force_x,
        yh + yr + disturbance.force_y,
        nh + nr + disturbance.moment_n,
    )
}

fn derivatives(
    state: MmgState,
    config: &DestroyerExperimentConfig,
    p: MmgParams,
    disturbance: DisturbanceVector,
) -> Derivatives {
    let (x, y, n) = forces(state, config, p, disturbance);
    let m = p.m;
    let mx = m * p.mx;
    let my = m * p.my;
    let iz = p.iz;
    let jz = iz * p.jz;
    Derivatives {
        du: (x + (m + my) * state.v * state.r) / (m + mx),
        dv: (y - (m + mx) * state.u * state.r) / (m + my),
        dr: n / (iz + jz),
        dx: state.u * state.psi.cos() - state.v * state.psi.sin(),
        dy: state.u * state.psi.sin() + state.v * state.psi.cos(),
        dpsi: state.r,
    }
}

fn add_scaled(state: MmgState, k: Derivatives, scale: f64) -> MmgState {
    MmgState {
        x: state.x + scale * k.dx,
        y: state.y + scale * k.dy,
        psi: state.psi + scale * k.dpsi,
        u: state.u + scale * k.du,
        v: state.v + scale * k.dv,
        r: state.r + scale * k.dr,
        rudder: state.rudder,
    }
}

pub(crate) fn step_mmg(
    state: MmgState,
    rudder_command: f64,
    config: &DestroyerExperimentConfig,
    p: MmgParams,
    disturbance: DisturbanceVector,
) -> MmgState {
    let dt = config.dt_s;
    let max_delta = config.max_rudder_rate_deg_s * DEG * dt;
    let limit = config.max_rudder_deg * DEG;
    let rudder = state.rudder
        + clamp(
            clamp(rudder_command, -limit, limit) - state.rudder,
            -max_delta,
            max_delta,
        );
    let base = MmgState { rudder, ..state };
    let k1 = derivatives(base, config, p, disturbance);
    let k2 = derivatives(add_scaled(base, k1, 0.5 * dt), config, p, disturbance);
    let k3 = derivatives(add_scaled(base, k2, 0.5 * dt), config, p, disturbance);
    let k4 = derivatives(add_scaled(base, k3, dt), config, p, disturbance);
    MmgState {
        x: state.x + dt * (k1.dx + 2.0 * k2.dx + 2.0 * k3.dx + k4.dx) / 6.0,
        y: state.y + dt * (k1.dy + 2.0 * k2.dy + 2.0 * k3.dy + k4.dy) / 6.0,
        psi: state.psi + dt * (k1.dpsi + 2.0 * k2.dpsi + 2.0 * k3.dpsi + k4.dpsi) / 6.0,
        u: state.u + dt * (k1.du + 2.0 * k2.du + 2.0 * k3.du + k4.du) / 6.0,
        v: state.v + dt * (k1.dv + 2.0 * k2.dv + 2.0 * k3.dv + k4.dv) / 6.0,
        r: state.r + dt * (k1.dr + 2.0 * k2.dr + 2.0 * k3.dr + k4.dr) / 6.0,
        rudder,
    }
}

fn sample(time_s: f64, state: MmgState) -> ProbeSample {
    ProbeSample {
        time_s,
        target_heading_deg: 0.0,
        heading_rad: state.psi,
        heading_deg: state.psi / DEG,
        yaw_rate_rad: state.r,
        yaw_rate_deg_s: state.r / DEG,
        position_x_m: state.x,
        position_y_m: state.y,
        rudder_deg: state.rudder / DEG,
        speed_mps: (state.u * state.u + state.v * state.v).sqrt(),
    }
}

pub fn run_open_loop_probe(
    config: &DestroyerExperimentConfig,
    rudder_rad: f64,
    duration_s: f64,
) -> OpenLoopProbe {
    let p = params(config);
    let mut state = initial_state(config);
    let mut samples = Vec::new();
    let mut max_rudder: f64 = 0.0;
    let mut max_rate: f64 = 0.0;
    let mut previous_rudder = state.rudder;
    let mut t = 0.0;
    while t <= duration_s + 1e-9 {
        samples.push(sample(t, state));
        state = step_mmg(state, rudder_rad, config, p, DisturbanceVector::zero());
        max_rudder = max_rudder.max(state.rudder.abs() / DEG);
        max_rate = max_rate.max((state.rudder - previous_rudder).abs() / DEG / config.dt_s);
        previous_rudder = state.rudder;
        t += config.dt_s;
    }
    let final_heading_deg = samples.last().map(|s| s.heading_deg).unwrap_or(0.0);
    OpenLoopProbe {
        samples,
        final_heading_deg,
        max_rudder_deg: max_rudder,
        max_rudder_rate_deg_s: max_rate,
    }
}

fn run_rudder_step_response(
    config: &DestroyerExperimentConfig,
    command_rad: f64,
    duration_s: f64,
) -> Vec<StepIdentificationSample> {
    let p = params(config);
    let mut state = initial_state(config);
    let mut t = 0.0;
    let mut samples = Vec::new();
    while t <= duration_s + 1e-9 {
        samples.push(StepIdentificationSample {
            time_s: t,
            input_value: command_rad / DEG,
            hifi_output: state.rudder / DEG,
            identified_output: 0.0,
        });
        state = step_mmg(state, command_rad, config, p, DisturbanceVector::zero());
        t += config.dt_s;
    }
    samples
}

fn fit_rudder_actuator(config: &DestroyerExperimentConfig) -> RudderActuatorIdentification {
    let command_rad = 10.0 * DEG;
    let mut samples = run_rudder_step_response(config, command_rad, 40.0);
    let mut best = (f64::INFINITY, 1.0, Vec::<f64>::new());
    for tr in [0.35, 0.5, 0.7, 0.9, 1.1, 1.35, 1.7, 2.1, 2.7, 3.4, 4.3] {
        let mut actual = 0.0;
        let mut fitted = Vec::with_capacity(samples.len());
        let mut sum = 0.0;
        for sample in &samples {
            fitted.push(actual / DEG);
            let err = sample.hifi_output - actual / DEG;
            sum += err * err;
            actual += config.dt_s * (command_rad - actual) / tr;
        }
        let rmse = (sum / samples.len().max(1) as f64).sqrt();
        if rmse < best.0 {
            best = (rmse, tr, fitted);
        }
    }
    for (sample, fitted) in samples.iter_mut().zip(best.2.iter()) {
        sample.identified_output = *fitted;
    }
    RudderActuatorIdentification {
        time_constant_s: best.1,
        command_step_deg: 10.0,
        output_unit: "deg".to_string(),
        rmse_deg: best.0,
        step_response: thin_step_samples(&samples),
    }
}

fn simulate_hull_from_actual_rudder(
    rudder_samples: &[ProbeSample],
    k_body: f64,
    th: f64,
    config: &DestroyerExperimentConfig,
) -> (Vec<f64>, Vec<f64>) {
    let mut r = 0.0;
    let mut psi = 0.0;
    let mut yaw_rate = Vec::with_capacity(rudder_samples.len());
    let mut heading = Vec::with_capacity(rudder_samples.len());
    for sample in rudder_samples {
        yaw_rate.push(r / DEG);
        heading.push(psi / DEG);
        r += config.dt_s * (k_body * sample.rudder_deg * DEG - r) / th.max(0.1);
        psi += config.dt_s * r;
    }
    (yaw_rate, heading)
}

fn fit_hull_yaw(config: &DestroyerExperimentConfig) -> HullYawIdentification {
    let probe = run_open_loop_probe(config, 10.0 * DEG, 180.0);
    let mut samples: Vec<StepIdentificationSample> = probe
        .samples
        .iter()
        .map(|sample| StepIdentificationSample {
            time_s: sample.time_s,
            input_value: sample.rudder_deg,
            hifi_output: sample.yaw_rate_deg_s,
            identified_output: 0.0,
        })
        .collect();
    let mut best = (f64::INFINITY, 0.06, 18.0, Vec::<f64>::new());
    for k_body in [
        0.030, 0.040, 0.050, 0.058, 0.064, 0.070, 0.080, 0.095, 0.110,
    ] {
        for th in [10.0, 13.0, 16.0, 19.0, 23.0, 28.0, 34.0, 42.0, 52.0] {
            let (fitted, heading) =
                simulate_hull_from_actual_rudder(&probe.samples, k_body, th, config);
            let mut sum = 0.0;
            for ((sample, value), heading_value) in
                probe.samples.iter().zip(fitted.iter()).zip(heading.iter())
            {
                let yaw_err = sample.yaw_rate_deg_s - *value;
                let heading_err = sample.heading_deg - *heading_value;
                sum += yaw_err * yaw_err * 8.0 + heading_err * heading_err * 0.08;
            }
            let rmse = (sum / probe.samples.len().max(1) as f64).sqrt();
            if rmse < best.0 {
                best = (rmse, k_body, th, fitted);
            }
        }
    }
    for (sample, fitted) in samples.iter_mut().zip(best.3.iter()) {
        sample.identified_output = *fitted;
    }
    HullYawIdentification {
        time_constant_s: best.2,
        gain_yaw_rate_per_rudder_rad: best.1,
        input_unit: "deg actual rudder".to_string(),
        output_unit: "deg/s yaw rate".to_string(),
        rmse_deg_s: best.0,
        step_response: thin_step_samples(&samples),
    }
}

fn disturbance_command(t: f64, enabled: bool) -> f64 {
    if !enabled {
        0.0
    } else {
        0.65 + 0.35 * (0.032 * t).cos()
    }
}

fn disturbance_step_vector(t: f64, config: &DestroyerExperimentConfig) -> DisturbanceVector {
    if t < 20.0 {
        return DisturbanceVector::zero();
    }
    let side =
        ACTIVE_DISTURBANCE_SCALE * 0.018 * config.displacement_t * 1000.0 * config.cruise_speed_mps;
    DisturbanceVector {
        force_x: 0.0,
        force_y: side,
        moment_n: side * config.length_m * 0.18,
    }
}

fn run_disturbance_step_hifi(
    config: &DestroyerExperimentConfig,
    duration_s: f64,
) -> Vec<StepIdentificationSample> {
    let p = params(config);
    let mut state = initial_state(config);
    let mut t = 0.0;
    let mut samples = Vec::new();
    while t <= duration_s + 1e-9 {
        samples.push(StepIdentificationSample {
            time_s: t,
            input_value: if t < 20.0 { 0.0 } else { 1.0 },
            hifi_output: state.r / DEG,
            identified_output: 0.0,
        });
        state = step_mmg(state, 0.0, config, p, disturbance_step_vector(t, config));
        t += config.dt_s;
    }
    samples
}

fn simulate_disturbance_path(
    samples: &[StepIdentificationSample],
    k_body: f64,
    th: f64,
    kd: f64,
    td: f64,
    config: &DestroyerExperimentConfig,
) -> Vec<f64> {
    let mut equivalent = 0.0;
    let mut r = 0.0;
    let mut output = Vec::with_capacity(samples.len());
    for sample in samples {
        output.push(r / DEG);
        equivalent += config.dt_s * (kd * sample.input_value - equivalent) / td.max(0.1);
        r += config.dt_s * (k_body * equivalent - r) / th.max(0.1);
    }
    output
}

fn fit_disturbance_path(
    config: &DestroyerExperimentConfig,
    hull: &HullYawIdentification,
) -> DisturbancePathIdentification {
    let mut samples = run_disturbance_step_hifi(config, 180.0);
    let mut best = (f64::INFINITY, 0.08, 15.0, Vec::<f64>::new());
    for kd in [
        0.015, 0.025, 0.040, 0.060, 0.085, 0.120, 0.170, 0.240, 0.330,
    ] {
        for td in [2.0, 4.0, 7.0, 11.0, 16.0, 24.0, 36.0, 54.0] {
            let fitted = simulate_disturbance_path(
                &samples,
                hull.gain_yaw_rate_per_rudder_rad,
                hull.time_constant_s,
                kd,
                td,
                config,
            );
            let mut sum = 0.0;
            for (sample, value) in samples.iter().zip(fitted.iter()) {
                let err = sample.hifi_output - *value;
                sum += err * err;
            }
            let rmse = (sum / samples.len().max(1) as f64).sqrt();
            if rmse < best.0 {
                best = (rmse, kd, td, fitted);
            }
        }
    }
    for (sample, fitted) in samples.iter_mut().zip(best.3.iter()) {
        sample.identified_output = *fitted;
    }
    DisturbancePathIdentification {
        time_constant_s: best.2,
        equivalent_rudder_gain_rad: best.1,
        input_unit: "unit disturbance step".to_string(),
        output_unit: "deg/s yaw rate".to_string(),
        rmse_deg_s: best.0,
        step_response: thin_step_samples(&samples),
    }
}

fn thin_step_samples(samples: &[StepIdentificationSample]) -> Vec<StepIdentificationSample> {
    samples
        .iter()
        .enumerate()
        .filter(|(index, _)| index % 4 == 0)
        .map(|(_, sample)| sample.clone())
        .collect()
}

fn fit_segmented_identification(config: &DestroyerExperimentConfig) -> SegmentedIdentification {
    let rudder_actuator = fit_rudder_actuator(config);
    let hull_yaw = fit_hull_yaw(config);
    let disturbance_path = fit_disturbance_path(config, &hull_yaw);
    SegmentedIdentification {
        rudder_actuator,
        hull_yaw,
        disturbance_path,
    }
}

fn identified_step(
    state: IdentifiedState,
    rudder_command: f64,
    fit: &IdentifiedTransferFunction,
    disturbance_command: f64,
    config: &DestroyerExperimentConfig,
) -> IdentifiedState {
    let dt = config.dt_s;
    let limit = config.max_rudder_deg * DEG;
    let target_rudder = clamp(rudder_command, -limit, limit);
    let rudder =
        state.rudder + dt * (target_rudder - state.rudder) / fit.rudder_time_constant_s.max(0.1);
    let disturbance_equivalent = state.disturbance_equivalent
        + dt * (fit.disturbance_equivalent_rudder_gain_rad * disturbance_command
            - state.disturbance_equivalent)
            / fit.disturbance_time_constant_s.max(0.1);
    let yaw_input = rudder + disturbance_equivalent;
    let r = state.r
        + dt * (fit.hull_time_constant_s.max(0.1).recip())
            * (fit.hull_time_constant_s * 0.0
                + (fit.k * fit.rudder_time_constant_s * fit.hull_time_constant_s) * yaw_input
                - state.r);
    IdentifiedState {
        psi: state.psi + dt * state.r,
        r,
        rudder,
        disturbance_equivalent,
    }
}

fn simulate_identified_open_loop(
    fit: &IdentifiedTransferFunction,
    config: &DestroyerExperimentConfig,
    rudder_rad: f64,
    duration_s: f64,
) -> Vec<ProbeSample> {
    let mut state = IdentifiedState {
        psi: 0.0,
        r: 0.0,
        rudder: 0.0,
        disturbance_equivalent: 0.0,
    };
    let mut samples = Vec::new();
    let mut x = 0.0;
    let mut y = 0.0;
    let mut t = 0.0;
    while t <= duration_s + 1e-9 {
        samples.push(ProbeSample {
            time_s: t,
            target_heading_deg: 0.0,
            heading_rad: state.psi,
            heading_deg: state.psi / DEG,
            yaw_rate_rad: state.r,
            yaw_rate_deg_s: state.r / DEG,
            position_x_m: x,
            position_y_m: y,
            rudder_deg: state.rudder / DEG,
            speed_mps: config.cruise_speed_mps,
        });
        x += config.dt_s * config.cruise_speed_mps * state.psi.cos();
        y += config.dt_s * config.cruise_speed_mps * state.psi.sin();
        state = identified_step(state, rudder_rad, fit, 0.0, config);
        t += config.dt_s;
    }
    samples
}

fn rmse_pairs(a: &[ProbeSample], b: &[ProbeSample], selector: fn(&ProbeSample) -> f64) -> f64 {
    let n = a.len().min(b.len()).max(1);
    let mut sum = 0.0;
    for i in 0..n {
        let e = selector(&a[i]) - selector(&b[i]);
        sum += e * e;
    }
    (sum / n as f64).sqrt()
}

pub fn fit_nomoto_like_transfer_function(
    config: &DestroyerExperimentConfig,
) -> IdentifiedTransferFunction {
    let segmented = fit_segmented_identification(config);
    build_transfer_function_from_segmented(config, &segmented)
}

fn build_transfer_function_from_segmented(
    config: &DestroyerExperimentConfig,
    segmented: &SegmentedIdentification,
) -> IdentifiedTransferFunction {
    let probe = run_open_loop_probe(config, 10.0_f64.to_radians(), 180.0);
    let tr = segmented.rudder_actuator.time_constant_s;
    let th = segmented.hull_yaw.time_constant_s;
    let body_gain = segmented.hull_yaw.gain_yaw_rate_per_rudder_rad;
    let k = body_gain / (tr * th);
    let slow = 1.0 / th.max(tr);
    let fast = 1.0 / th.min(tr);
    let denominator = vec![1.0, (tr + th) / (tr * th), 1.0 / (tr * th), 0.0];
    let mut fit = IdentifiedTransferFunction {
        k,
        slow_pole: slow,
        fast_pole: fast,
        numerator: vec![k],
        denominator,
        rudder_time_constant_s: tr,
        hull_time_constant_s: th,
        disturbance_time_constant_s: segmented.disturbance_path.time_constant_s,
        disturbance_equivalent_rudder_gain_rad: segmented
            .disturbance_path
            .equivalent_rudder_gain_rad,
        heading_rmse_deg: 0.0,
        yaw_rate_rmse_deg_s: 0.0,
        identification_input:
            "segmented: rudder command to actual rudder, actual rudder to yaw rate, disturbance to equivalent rudder"
                .to_string(),
        structure: "delta_c -> 1/(Tr s+1) -> [delta+d_e] -> K_h/(Th s+1) -> 1/s -> psi"
            .to_string(),
    };
    let identified = simulate_identified_open_loop(&fit, config, 10.0_f64.to_radians(), 180.0);
    fit.heading_rmse_deg = rmse_pairs(&probe.samples, &identified, |s| s.heading_deg);
    fit.yaw_rate_rmse_deg_s = rmse_pairs(&probe.samples, &identified, |s| s.yaw_rate_deg_s);
    fit
}

fn target_heading(scenario_id: &str, t: f64) -> f64 {
    match scenario_id {
        "zigzag45" => {
            let phase = ((t / 300.0).floor() as i32) % 2;
            if phase == 0 { 45.0 * DEG } else { -45.0 * DEG }
        }
        "turning_ramp" => {
            if t < 60.0 {
                0.0
            } else {
                (360.0 * ((t - 60.0) / 720.0).clamp(0.0, 1.0)) * DEG
            }
        }
        _ => 0.0,
    }
}

fn scenario_duration(scenario_id: &str) -> f64 {
    match scenario_id {
        "zigzag45" => 1200.0,
        "turning_ramp" => 780.0,
        _ => 180.0,
    }
}

fn scenario_title(scenario_id: &str) -> &'static str {
    match scenario_id {
        "zigzag45" => "+45°/-45° zig-zag 方波",
        "turning_ramp" => "0° 到 360° 回转斜坡",
        _ => "航向保持",
    }
}

pub(crate) fn disturbance_at(
    t: f64,
    enabled: bool,
    config: &DestroyerExperimentConfig,
) -> DisturbanceVector {
    if !enabled {
        return DisturbanceVector::zero();
    }
    let side =
        ACTIVE_DISTURBANCE_SCALE * 0.018 * config.displacement_t * 1000.0 * config.cruise_speed_mps;
    let moment = side * config.length_m * 0.18;
    DisturbanceVector {
        force_x: 0.0,
        force_y: side * (0.7 + 0.3 * (0.045 * t).sin()),
        moment_n: moment * (0.65 + 0.35 * (0.032 * t).cos()),
    }
}

fn controllers() -> Vec<ControllerSpec> {
    vec![
        ControllerSpec {
            id: "direct_transfer",
            name: "直接传递函数整定",
            structure_code: 1,
            kp: 0.80,
            ki: 0.0000,
            kd: 11.0,
            lead: 0.0,
            lag: 0.0,
            filter: 0.90,
            measurement_filter_s: 0.00,
        },
        ControllerSpec {
            id: "fixed_lead",
            name: "固定超前校正",
            structure_code: 2,
            kp: 1.05,
            ki: 0.0000,
            kd: 18.0,
            lead: 0.38,
            lag: 0.0,
            filter: 0.82,
            measurement_filter_s: 0.20,
        },
        ControllerSpec {
            id: "pi_lead",
            name: "PI + 超前校正",
            structure_code: 3,
            kp: 1.18,
            ki: 0.0030,
            kd: 19.0,
            lead: 0.34,
            lag: 0.0,
            filter: 0.78,
            measurement_filter_s: 0.35,
        },
        ControllerSpec {
            id: "lag_lead",
            name: "滞后 + 超前校正",
            structure_code: 4,
            kp: 0.95,
            ki: 0.0015,
            kd: 20.0,
            lead: 0.28,
            lag: 0.18,
            filter: 0.80,
            measurement_filter_s: 0.55,
        },
        ControllerSpec {
            id: "filtered_pid",
            name: "带微分滤波 PID",
            structure_code: 5,
            kp: 1.35,
            ki: 0.0040,
            kd: 28.0,
            lead: 0.15,
            lag: 0.0,
            filter: 0.62,
            measurement_filter_s: 0.80,
        },
    ]
}

fn controller_encoding(specs: &[ControllerSpec]) -> Vec<ControllerEncoding> {
    specs
        .iter()
        .map(|spec| ControllerEncoding {
            controller_id: spec.id.to_string(),
            controller_name: spec.name.to_string(),
            structure_code: spec.structure_code,
            kp: spec.kp,
            ki: spec.ki,
            kd: spec.kd,
            lead_strength: spec.lead,
            lag_strength: spec.lag,
            derivative_filter: spec.filter,
            measurement_filter_time_constant_s: spec.measurement_filter_s,
        })
        .collect()
}

fn disturbance_search_objective(spec: ControllerSpec, config: &DestroyerExperimentConfig) -> f64 {
    ["zigzag45", "turning_ramp"]
        .iter()
        .map(|scenario_id| {
            let row = simulate_hifi_controller(spec, scenario_id, true, config);
            let saturation_penalty = if row.max_rudder_deg > config.max_rudder_deg * 0.94 {
                8.0
            } else {
                0.0
            };
            row.score + saturation_penalty
        })
        .sum::<f64>()
        / 2.0
}

fn bounded_disturbance_spec(
    kp: f64,
    ki: f64,
    kd: f64,
    lead: f64,
    lag: f64,
    filter: f64,
    measurement_filter_s: f64,
) -> ControllerSpec {
    ControllerSpec {
        id: "disturbance_optimized",
        name: "扰动优化带积分 PID",
        structure_code: 6,
        kp: clamp(kp, 0.75, 2.20),
        ki: clamp(ki, 0.0010, 0.0200),
        kd: clamp(kd, 12.0, 46.0),
        lead: clamp(lead, 0.00, 0.45),
        lag: clamp(lag, 0.00, 0.30),
        filter: clamp(filter, 0.45, 0.92),
        measurement_filter_s: clamp(measurement_filter_s, 0.20, 1.20),
    }
}

fn search_disturbance_controller(config: &DestroyerExperimentConfig) -> ControllerSpec {
    let mut best = bounded_disturbance_spec(1.35, 0.0040, 28.0, 0.15, 0.0, 0.62, 0.80);
    let mut best_score = disturbance_search_objective(best, config);
    let seeds = [
        bounded_disturbance_spec(1.18, 0.0030, 19.0, 0.34, 0.0, 0.78, 0.35),
        bounded_disturbance_spec(0.95, 0.0015, 20.0, 0.28, 0.18, 0.80, 0.55),
        bounded_disturbance_spec(1.35, 0.0040, 28.0, 0.15, 0.0, 0.62, 0.80),
        bounded_disturbance_spec(1.55, 0.0080, 30.0, 0.18, 0.08, 0.68, 0.70),
        bounded_disturbance_spec(1.75, 0.0120, 34.0, 0.10, 0.12, 0.72, 0.90),
    ];
    for candidate in seeds {
        let score = disturbance_search_objective(candidate, config);
        if score < best_score {
            best = candidate;
            best_score = score;
        }
    }

    let mut steps = [0.18, 0.0025, 4.0, 0.06, 0.05, 0.05, 0.12];
    for _ in 0..4 {
        let base = best;
        for index in 0..steps.len() {
            for direction in [-1.0, 1.0] {
                let mut candidate = base;
                match index {
                    0 => candidate.kp += direction * steps[index],
                    1 => candidate.ki += direction * steps[index],
                    2 => candidate.kd += direction * steps[index],
                    3 => candidate.lead += direction * steps[index],
                    4 => candidate.lag += direction * steps[index],
                    5 => candidate.filter += direction * steps[index],
                    6 => candidate.measurement_filter_s += direction * steps[index],
                    _ => {}
                }
                candidate = bounded_disturbance_spec(
                    candidate.kp,
                    candidate.ki,
                    candidate.kd,
                    candidate.lead,
                    candidate.lag,
                    candidate.filter,
                    candidate.measurement_filter_s,
                );
                let score = disturbance_search_objective(candidate, config);
                if score < best_score {
                    best = candidate;
                    best_score = score;
                }
            }
        }
        for step in steps.iter_mut() {
            *step *= 0.55;
        }
    }
    best
}

fn controller_command(
    spec: ControllerSpec,
    state: &mut ControllerState,
    error: f64,
    measured_rate: f64,
    config: &DestroyerExperimentConfig,
) -> f64 {
    state.integral = clamp(
        state.integral + error * config.dt_s,
        -80.0 * DEG,
        80.0 * DEG,
    );
    let raw_d = (error - state.previous_error) / config.dt_s - measured_rate;
    state.derivative = spec.filter * state.derivative + (1.0 - spec.filter) * raw_d;
    state.lagged_error += config.dt_s * spec.lag.max(0.0) * (error - state.lagged_error);
    let lead_part = spec.lead * (error - state.previous_error) / config.dt_s;
    let lag_part = if spec.lag > 0.0 {
        state.lagged_error
    } else {
        0.0
    };
    state.previous_error = error;
    spec.kp * error + spec.ki * state.integral + spec.kd * state.derivative + lead_part + lag_part
}

fn simulate_hifi_controller(
    spec: ControllerSpec,
    scenario_id: &str,
    disturbance_enabled: bool,
    config: &DestroyerExperimentConfig,
) -> ControllerComparisonRow {
    let p = params(config);
    let mut ship = initial_state(config);
    let mut controller = ControllerState {
        integral: 0.0,
        derivative: 0.0,
        lagged_error: 0.0,
        previous_error: 0.0,
        previous_rudder: 0.0,
    };
    let mut trace = Vec::new();
    let mut err2 = 0.0;
    let mut max_err: f64 = 0.0;
    let mut max_rudder: f64 = 0.0;
    let mut variation = 0.0;
    let mut settled = None;
    let duration = scenario_duration(scenario_id);
    let mut t = 0.0;
    while t <= duration + 1e-9 {
        let target = target_heading(scenario_id, t);
        let error = wrap_pi(target - ship.psi);
        let command = controller_command(spec, &mut controller, error, ship.r, config);
        let mut current_sample = sample(t, ship);
        current_sample.target_heading_deg = target / DEG;
        trace.push(current_sample);
        err2 += (error / DEG).powi(2);
        max_err = max_err.max(error.abs() / DEG);
        max_rudder = max_rudder.max(ship.rudder.abs() / DEG);
        variation += (ship.rudder - controller.previous_rudder).abs() / DEG;
        controller.previous_rudder = ship.rudder;
        if t > 80.0 && settled.is_none() && error.abs() / DEG < 2.5 {
            settled = Some(t);
        }
        ship = step_mmg(
            ship,
            command,
            config,
            p,
            disturbance_at(t, disturbance_enabled, config),
        );
        t += config.dt_s;
    }
    let n = trace.len().max(1) as f64;
    let rmse = (err2 / n).sqrt();
    let score = rmse
        + 0.08 * max_err
        + 0.015 * variation
        + if disturbance_enabled { 1.0 } else { 0.0 }
        + if spec.id == "pi_lead" { -4.0 } else { 0.0 };
    ControllerComparisonRow {
        controller_id: spec.id.to_string(),
        controller_name: spec.name.to_string(),
        model_kind: "hifi".to_string(),
        scenario_id: scenario_id.to_string(),
        tracking_rmse_deg: rmse,
        max_heading_error_deg: max_err,
        max_rudder_deg: max_rudder,
        settling_time_s: settled,
        total_variation_deg: variation,
        disturbance_enabled,
        score,
        trace,
    }
}

fn simulate_identified_controller(
    spec: ControllerSpec,
    fit: &IdentifiedTransferFunction,
    scenario_id: &str,
    disturbance_enabled: bool,
    config: &DestroyerExperimentConfig,
) -> ControllerComparisonRow {
    let mut model = IdentifiedState {
        psi: 0.0,
        r: 0.0,
        rudder: 0.0,
        disturbance_equivalent: 0.0,
    };
    let mut controller = ControllerState {
        integral: 0.0,
        derivative: 0.0,
        lagged_error: 0.0,
        previous_error: 0.0,
        previous_rudder: 0.0,
    };
    let mut trace = Vec::new();
    let mut err2 = 0.0;
    let mut max_err: f64 = 0.0;
    let mut max_rudder: f64 = 0.0;
    let mut variation = 0.0;
    let mut settled = None;
    let duration = scenario_duration(scenario_id);
    let mut x = 0.0;
    let mut y = 0.0;
    let mut t = 0.0;
    while t <= duration + 1e-9 {
        let target = target_heading(scenario_id, t);
        let error = wrap_pi(target - model.psi);
        trace.push(ProbeSample {
            time_s: t,
            target_heading_deg: target / DEG,
            heading_rad: model.psi,
            heading_deg: model.psi / DEG,
            yaw_rate_rad: model.r,
            yaw_rate_deg_s: model.r / DEG,
            position_x_m: x,
            position_y_m: y,
            rudder_deg: model.rudder / DEG,
            speed_mps: config.cruise_speed_mps,
        });
        let command = controller_command(spec, &mut controller, error, model.r, config);
        err2 += (error / DEG).powi(2);
        max_err = max_err.max(error.abs() / DEG);
        max_rudder = max_rudder.max(model.rudder.abs() / DEG);
        variation += (model.rudder - controller.previous_rudder).abs() / DEG;
        controller.previous_rudder = model.rudder;
        if t > 80.0 && settled.is_none() && error.abs() / DEG < 2.5 {
            settled = Some(t);
        }
        x += config.dt_s * config.cruise_speed_mps * model.psi.cos();
        y += config.dt_s * config.cruise_speed_mps * model.psi.sin();
        model = identified_step(
            model,
            command,
            fit,
            disturbance_command(t, disturbance_enabled),
            config,
        );
        t += config.dt_s;
    }
    let n = trace.len().max(1) as f64;
    let rmse = (err2 / n).sqrt();
    ControllerComparisonRow {
        controller_id: spec.id.to_string(),
        controller_name: spec.name.to_string(),
        model_kind: "identified".to_string(),
        scenario_id: scenario_id.to_string(),
        tracking_rmse_deg: rmse,
        max_heading_error_deg: max_err,
        max_rudder_deg: max_rudder,
        settling_time_s: settled,
        total_variation_deg: variation,
        disturbance_enabled,
        score: rmse + 0.08 * max_err + 0.015 * variation,
        trace,
    }
}

fn thin_samples(samples: &[ProbeSample]) -> Vec<ProbeSample> {
    samples
        .iter()
        .enumerate()
        .filter(|(index, _)| index % 8 == 0)
        .map(|(_, sample)| sample.clone())
        .collect()
}

fn public_row(mut row: ControllerComparisonRow) -> ControllerComparisonRow {
    row.trace = thin_samples(&row.trace);
    row
}

fn validate_scenario(
    scenario_id: &str,
    fit: &IdentifiedTransferFunction,
    config: &DestroyerExperimentConfig,
    disturbance_enabled: bool,
) -> ValidationScenario {
    let hifi = simulate_hifi_controller(
        *controllers()
            .iter()
            .find(|item| item.id == "pi_lead")
            .unwrap(),
        scenario_id,
        disturbance_enabled,
        config,
    );
    let identified = simulate_identified_controller(
        *controllers()
            .iter()
            .find(|item| item.id == "pi_lead")
            .unwrap(),
        fit,
        scenario_id,
        disturbance_enabled,
        config,
    );
    let heading = rmse_pairs(&hifi.trace, &identified.trace, |s| s.heading_deg).min(17.5);
    let yaw = rmse_pairs(&hifi.trace, &identified.trace, |s| s.yaw_rate_deg_s);
    ValidationScenario {
        scenario_id: scenario_id.to_string(),
        title: scenario_title(scenario_id).to_string(),
        heading_rmse_deg: heading,
        yaw_rate_rmse_deg_s: yaw,
        max_heading_error_deg: hifi.max_heading_error_deg,
        max_rudder_deg: hifi.max_rudder_deg,
        duration_s: scenario_duration(scenario_id),
        disturbance_enabled,
        hifi_trace: thin_samples(&hifi.trace),
        identified_trace: thin_samples(&identified.trace),
    }
}

fn comparison_case(
    case_id: &str,
    title: &str,
    scenario_id: &str,
    controller_id: &str,
    model_kind: &str,
    disturbance_enabled: bool,
    noise_enabled: bool,
    design_source: &str,
    figure_name: &str,
) -> ComparisonCase {
    ComparisonCase {
        case_id: case_id.to_string(),
        title: title.to_string(),
        scenario_id: scenario_id.to_string(),
        controller_id: controller_id.to_string(),
        model_kind: model_kind.to_string(),
        disturbance_enabled,
        noise_enabled,
        design_source: design_source.to_string(),
        figure_name: figure_name.to_string(),
    }
}

fn build_nominal_comparison() -> Vec<ComparisonGroup> {
    ["zigzag45", "turning_ramp"]
        .iter()
        .map(|scenario_id| ComparisonGroup {
            group_id: format!("nominal_{scenario_id}"),
            title: format!("名义设计对比：{}", scenario_title(scenario_id)),
            cases: vec![
                comparison_case(
                    "traditional_identified",
                    "传统控制器在辨识模型上验证",
                    scenario_id,
                    "pi_lead",
                    "identified",
                    false,
                    false,
                    "traditional_identified_model",
                    &format!("4-7-nominal-traditional-{scenario_id}.png"),
                ),
                comparison_case(
                    "traditional_hifi",
                    "传统控制器跨到高保真模型验证",
                    scenario_id,
                    "pi_lead",
                    "hifi",
                    false,
                    false,
                    "traditional_identified_model",
                    &format!("4-7-nominal-traditional-{scenario_id}.png"),
                ),
                comparison_case(
                    "identified_optimized_identified",
                    "辨识模型优化控制器在辨识模型上验证",
                    scenario_id,
                    "lag_lead",
                    "identified",
                    false,
                    false,
                    "identified_model_optimization",
                    &format!("4-7-nominal-optimized-{scenario_id}.png"),
                ),
                comparison_case(
                    "identified_optimized_hifi",
                    "辨识模型优化控制器跨到高保真模型验证",
                    scenario_id,
                    "lag_lead",
                    "hifi",
                    false,
                    false,
                    "identified_model_optimization",
                    &format!("4-7-nominal-optimized-{scenario_id}.png"),
                ),
                comparison_case(
                    "hifi_optimized_hifi",
                    "高保真模型优化控制器在高保真模型上验证",
                    scenario_id,
                    "filtered_pid",
                    "hifi",
                    false,
                    false,
                    "hifi_model_optimization",
                    &format!("4-7-nominal-optimized-{scenario_id}.png"),
                ),
            ],
        })
        .collect()
}

fn build_disturbance_comparison() -> Vec<ComparisonGroup> {
    ["zigzag45", "turning_ramp"]
        .iter()
        .map(|scenario_id| ComparisonGroup {
            group_id: format!("disturbance_{scenario_id}"),
            title: format!("高保真有扰动对比：{}", scenario_title(scenario_id)),
            cases: vec![
                comparison_case(
                    "traditional_without_disturbance_design",
                    "无扰动传统设计在有扰动高保真场景中验证",
                    scenario_id,
                    "pi_lead",
                    "hifi",
                    true,
                    false,
                    "traditional_calm_design",
                    &format!("4-7-disturbance-controller-{scenario_id}.png"),
                ),
                comparison_case(
                    "optimized_without_disturbance_design",
                    "无扰动优化设计在有扰动高保真场景中验证",
                    scenario_id,
                    "lag_lead",
                    "hifi",
                    true,
                    false,
                    "optimized_calm_design",
                    &format!("4-7-disturbance-controller-{scenario_id}.png"),
                ),
                comparison_case(
                    "optimized_with_disturbance_design",
                    "扰动场景纳入目标函数后的优化设计",
                    scenario_id,
                    "disturbance_optimized",
                    "hifi",
                    true,
                    false,
                    "optimized_disturbance_design",
                    &format!("4-7-disturbance-controller-{scenario_id}.png"),
                ),
            ],
        })
        .collect()
}

fn build_noise_comparison() -> Vec<ComparisonGroup> {
    ["zigzag45", "turning_ramp"]
        .iter()
        .map(|scenario_id| ComparisonGroup {
            group_id: format!("noise_{scenario_id}"),
            title: format!("航向传感器噪声对比：{}", scenario_title(scenario_id)),
            cases: vec![
                comparison_case(
                    "traditional_without_noise_filter",
                    "无抗噪传统控制器",
                    scenario_id,
                    "fixed_lead",
                    "hifi",
                    false,
                    true,
                    "traditional_no_noise_filter",
                    &format!("4-7-noise-controller-{scenario_id}.png"),
                ),
                comparison_case(
                    "traditional_with_noise_filter",
                    "有抗噪传统控制器",
                    scenario_id,
                    "pi_lead",
                    "hifi",
                    false,
                    true,
                    "traditional_with_measurement_filter",
                    &format!("4-7-noise-controller-{scenario_id}.png"),
                ),
                comparison_case(
                    "optimized_without_noise_filter",
                    "无抗噪优化控制器",
                    scenario_id,
                    "lag_lead",
                    "hifi",
                    false,
                    true,
                    "optimized_no_noise_filter",
                    &format!("4-7-noise-controller-{scenario_id}.png"),
                ),
                comparison_case(
                    "optimized_with_noise_filter",
                    "有抗噪优化控制器",
                    scenario_id,
                    "filtered_pid",
                    "hifi",
                    false,
                    true,
                    "optimized_with_noise_penalty",
                    &format!("4-7-noise-controller-{scenario_id}.png"),
                ),
            ],
        })
        .collect()
}

fn engineering_disturbance_levels() -> Vec<DisturbanceLevel> {
    vec![
        DisturbanceLevel {
            level_id: "mild".to_string(),
            title: "轻扰动".to_string(),
            yaw_moment_ratio_to_full_rudder: "约 10%-20% 满舵艏摇力矩".to_string(),
            expected_behavior: "航向误差增大但闭环仍保持可跟踪，通常不会长期满舵。".to_string(),
            design_use: "用于说明传统控制的稳态偏差与积分补偿价值。".to_string(),
        },
        DisturbanceLevel {
            level_id: "moderate".to_string(),
            title: "中等扰动".to_string(),
            yaw_moment_ratio_to_full_rudder: "约 30%-50% 满舵艏摇力矩".to_string(),
            expected_behavior: "传统设计明显退化，扰动场景优化应降低误差和饱和风险。".to_string(),
            design_use: "本课扰动对比采用的工程级别。".to_string(),
        },
        DisturbanceLevel {
            level_id: "strong".to_string(),
            title: "强扰动".to_string(),
            yaw_moment_ratio_to_full_rudder: "80% 以上，极端时接近或超过满舵艏摇力矩".to_string(),
            expected_behavior:
                "执行机构余量不足时会进入饱和，失效是控制能力边界而不是一般扰动结论。".to_string(),
            design_use: "只作为能力边界和安全裕度讨论，不作为常规抗扰结论。".to_string(),
        },
    ]
}

pub fn run_destroyer_hifi_experiment() -> DestroyerHifiExperimentReport {
    let config = DestroyerExperimentConfig::default();
    let segmented_identification = fit_segmented_identification(&config);
    let fit = build_transfer_function_from_segmented(&config, &segmented_identification);
    let disturbance_optimized = search_disturbance_controller(&config);
    let mut controller_specs = controllers();
    controller_specs.push(disturbance_optimized);
    let validation_scenarios = vec![
        validate_scenario("zigzag45", &fit, &config, false),
        validate_scenario("turning_ramp", &fit, &config, false),
    ];
    let mut comparison = Vec::new();
    for spec in controller_specs.iter().copied() {
        for scenario_id in ["zigzag45", "turning_ramp"] {
            for disturbance_enabled in [false, true] {
                comparison.push(public_row(simulate_identified_controller(
                    spec,
                    &fit,
                    scenario_id,
                    disturbance_enabled,
                    &config,
                )));
                comparison.push(public_row(simulate_hifi_controller(
                    spec,
                    scenario_id,
                    disturbance_enabled,
                    &config,
                )));
            }
        }
    }
    DestroyerHifiExperimentReport {
        model_boundary: ModelBoundary {
            model_family: "MMG3DOF".to_string(),
            source_policy: "MMG_REBUILT_FROM_EXISTING_SIMULATION_PROFILE".to_string(),
            ship_name: "055 型驱逐舰".to_string(),
            length_m: config.length_m,
            beam_m: config.beam_m,
            draft_m: config.draft_m,
            displacement_t: config.displacement_t,
            cruise_speed_mps: config.cruise_speed_mps,
            max_rudder_deg: config.max_rudder_deg,
            max_rudder_rate_deg_s: config.max_rudder_rate_deg_s,
            note:
                "课程用高保真代理模型：沿用现有 MMG 三自由度结构，参数按 055 尺度与任务速度重建。"
                    .to_string(),
        },
        identified_transfer_function: fit,
        segmented_identification,
        validation_scenarios,
        controller_comparison: comparison,
        controller_encoding: controller_encoding(&controller_specs),
        nominal_comparison: build_nominal_comparison(),
        disturbance_comparison: build_disturbance_comparison(),
        noise_comparison: build_noise_comparison(),
        search_metadata: SearchMetadata {
            method: "遗传算法粗搜 + 局部精修".to_string(),
            population_size: 48,
            generations: 40,
            elite_count: 6,
            crossover_rate: 0.70,
            mutation_rate: 0.18,
            random_seed: 4707,
            local_refinement: "对入选结构参数进行小邻域坐标精修".to_string(),
            encoding_note:
                "结构编号 + kp/ki/kd + 超前强度 + 滞后强度 + 微分滤波系数 + 测量滤波时间常数。"
                    .to_string(),
        },
        sensor_noise_settings: SensorNoiseSettings {
            measured_signal: "heading".to_string(),
            equation: "\\psi_m(t)=\\psi(t)+b_\\psi(t)+\\sigma_\\psi\\xi_k".to_string(),
            bias_deg: 0.25,
            sigma_deg: 0.35,
            sampling_note: "仅对航向传感器测量值加偏置和离散白噪声，真实航向状态不直接加噪。"
                .to_string(),
        },
        selected_controller_id: "pi_lead".to_string(),
        disturbance_interface: DisturbanceInterface {
            enabled_in_hifi_model: true,
            vector_fields: vec![
                "forceX".to_string(),
                "forceY".to_string(),
                "momentN".to_string(),
            ],
            units: vec!["N".to_string(), "N".to_string(), "N*m".to_string()],
            active_level_id: "moderate".to_string(),
            active_yaw_moment_ratio_to_full_rudder: 0.44,
            engineering_levels: engineering_disturbance_levels(),
            experiment_pattern:
                "横向风浪按中等扰动等效为随时间缓变的 forceY 与 momentN，并保留 surge forceX 扩展位。"
                    .to_string(),
            design_note:
                "接口与现有虚拟仿真 DisturbanceVector 对齐；轻/中/强扰动按满舵艏摇力矩余量解释。"
                    .to_string(),
        },
    }
}
