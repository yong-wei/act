use num_complex::Complex64;
use super::*;

pub(super) fn compute_time_metrics(
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
        return default_control_metrics();
    }

    let final_value = expected_final_value
        .filter(|value| value.is_finite())
        .unwrap_or_else(|| finite_points.last().map(|point| point.y).unwrap_or(0.0));
    if !asymptotically_stable {
        return ControlMetrics {
            final_value,
            ..default_control_metrics()
        };
    }
    let peak_point = finite_points
        .iter()
        .copied()
        .max_by(|left, right| left.y.total_cmp(&right.y));
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
        ..default_control_metrics()
    }
}

pub(super) struct CanonicalStateSpace {
    a: Vec<Vec<f64>>,
    b: Vec<f64>,
    c: Vec<f64>,
    d: f64,
}

pub(super) fn create_canonical_state_space(num: &[f64], den: &[f64]) -> Option<CanonicalStateSpace> {
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

pub(super) fn mat_vec_mul(matrix: &[Vec<f64>], vector: &[f64]) -> Vec<f64> {
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

pub(super) fn vec_add(lhs: &[f64], rhs: &[f64]) -> Vec<f64> {
    lhs.iter()
        .zip(rhs.iter())
        .map(|(left, right)| left + right)
        .collect()
}

pub(super) fn vec_scale(values: &[f64], factor: f64) -> Vec<f64> {
    values.iter().map(|value| value * factor).collect()
}

pub(super) fn dot(lhs: &[f64], rhs: &[f64]) -> f64 {
    lhs.iter()
        .zip(rhs.iter())
        .map(|(left, right)| left * right)
        .sum()
}

pub(super) fn response_input(response_type: ResponseType, dt: f64, time: f64, index: usize) -> f64 {
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

pub(super) fn simulate_time_response(
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

pub(super) fn step_response_by_residue(tf: &TransferFunction, times: &[f64]) -> Option<Vec<CurvePoint>> {
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

pub(super) fn step_response(
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

pub(super) fn default_control_metrics() -> ControlMetrics {
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

pub(super) fn output_requested(request: &ControlAnalysisRequest, keys: &[&str]) -> bool {
    request.outputs.is_empty()
        || keys
            .iter()
            .any(|key| request.outputs.iter().any(|output| output == key))
}


