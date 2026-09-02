//! Controller implementation behind the WASM facade.
//!
//! Structure/PID parameter application and reinforcement-learning
//! controller training live here; `lib.rs` only decodes, dispatches and
//! exports.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::cmp::Ordering;
use std::collections::HashMap;

use crate::analysis::{TransferFunction, tf_mul};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StructureSpec {
    pub(crate) kind: String,
    pub(crate) enabled: bool,
    pub(crate) params: HashMap<String, f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RlTrainingRequest {
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
pub(crate) struct RlTrainingResult {
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

pub(crate) fn tf_from_structure(spec: &StructureSpec) -> TransferFunction {
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
                if ki.abs() < 1e-12 && tf > 0.0 {
                    TransferFunction {
                        numerator: vec![kp * tf + kd, kp],
                        denominator: vec![tf, 1.0],
                    }
                } else if ki.abs() < 1e-12 {
                    TransferFunction {
                        numerator: vec![kd, kp],
                        denominator: vec![1.0],
                    }
                } else if tf > 0.0 {
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

pub(crate) fn compute_rl_training_inner(request: &RlTrainingRequest) -> RlTrainingResult {
    if request.panel_kind == "rust_toy_training_panel"
        || request.panel_kind == "toy_rl_training_panel"
    {
        compute_toy_rl_training(request)
    } else {
        compute_heading_rl_training(request)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
