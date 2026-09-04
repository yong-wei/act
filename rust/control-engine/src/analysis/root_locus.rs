use num_complex::Complex64;
use super::*;


pub(super) fn best_root_assignment(previous: &[Complex64], current: &[Complex64]) -> Vec<Complex64> {
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
pub(super) struct RootLocusSample {
    pub(super) gain: f64,
    pub(super) roots: Vec<Complex64>,
}

pub(super) fn compute_characteristic_roots(loop_tf: &TransferFunction, gain: f64) -> Vec<Complex64> {
    let scaled_num: Vec<f64> = loop_tf.numerator.iter().map(|value| value * gain).collect();
    let characteristic = poly_combine(&loop_tf.denominator, &scaled_num, 1.0);
    durand_kerner(&characteristic)
}

pub(super) fn sample_root_locus(
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

pub(super) fn min_pairwise_distance(roots: &[Complex64]) -> f64 {
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

pub(super) fn should_refine_root_segment(
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

pub(super) fn append_root_locus_segment(
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

pub(super) fn rounded_gain(value: f64) -> f64 {
    if !value.is_finite() {
        return value;
    }
    (value * 1_000_000_000_000.0).round() / 1_000_000_000_000.0
}

pub(super) fn sorted_unique_gains(mut gains: Vec<f64>) -> Vec<f64> {
    gains.retain(|gain| gain.is_finite() && *gain >= 0.0);
    gains.sort_by(|left, right| (*left).total_cmp(&(*right)));
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

pub(super) fn gain_at_real_point(loop_tf: &TransferFunction, point: f64) -> Option<f64> {
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

pub(super) fn real_roots(points: &[Complex64]) -> Vec<f64> {
    let mut values: Vec<f64> = points
        .iter()
        .filter(|point| point.im.abs() <= 1e-7 * point.norm().max(1.0))
        .map(|point| point.re)
        .collect();
    values.sort_by(|left, right| (*left).total_cmp(&(*right)));
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

pub(super) fn is_on_real_axis_locus(
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

pub(super) fn stationary_points(
    loop_tf: &TransferFunction,
    open_loop_poles: &[Complex64],
    open_loop_zeros: &[Complex64],
) -> Vec<RootLocusSamplePoint> {
    if loop_tf.numerator.iter().all(|value| value.abs() < 1e-12) {
        return Vec::new();
    }
    let denominator_derivative = poly_derivative(&loop_tf.denominator);
    let numerator_derivative = poly_derivative(&loop_tf.numerator);
    let candidates = durand_kerner(&poly_combine(
        &convolve(&denominator_derivative, &loop_tf.numerator),
        &convolve(&loop_tf.denominator, &numerator_derivative),
        -1.0,
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
    points.sort_by(|left, right| left.gain.total_cmp(&right.gain));
    points
}

pub(super) fn root_locus_gain_sequence(
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

pub(super) fn real_axis_segments(
    open_loop_poles: &[Complex64],
    open_loop_zeros: &[Complex64],
) -> Vec<RealAxisSegment> {
    let mut singularities = real_roots(open_loop_poles);
    singularities.extend(real_roots(open_loop_zeros));
    singularities.sort_by(|left, right| (*left).total_cmp(&(*right)));
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

pub(super) fn normalize_angle_deg(angle: f64) -> f64 {
    let mut normalized = angle % 360.0;
    if normalized > 180.0 {
        normalized -= 360.0;
    }
    if normalized <= -180.0 {
        normalized += 360.0;
    }
    normalized
}

pub(super) fn angle_between(origin: Complex64, target: Complex64) -> f64 {
    (target.im - origin.im)
        .atan2(target.re - origin.re)
        .to_degrees()
}

pub(super) fn root_locus_asymptotes(
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

pub(super) fn departure_angles(
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

pub(super) fn arrival_angles(
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

pub(super) fn imaginary_axis_crossings(branches: &[Vec<RootLocusSamplePoint>]) -> Vec<RootLocusSamplePoint> {
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

pub(super) fn root_locus_segment_point(
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

pub(super) fn root_locus_plot_extent(
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

pub(super) fn root_locus_real_axis_segments(
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

pub(super) fn root_locus_branch_segments(branches: &[Vec<RootLocusSamplePoint>]) -> Vec<RootLocusSegment> {
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

pub(super) fn root_locus_completion_segments(
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
pub(super) struct RootLocusZeroAssignment {
    branch_index: usize,
    zero_index: usize,
}

#[derive(Debug, Clone)]
pub(super) struct RootLocusNearZeroPlan {
    segments: Vec<RootLocusSegment>,
    assignments: Vec<RootLocusZeroAssignment>,
    diagnostics: RootLocusDiagnostics,
}

pub(super) fn near_zero_roots(
    loop_tf: &TransferFunction,
    mu: f64,
    previous: Option<&[Complex64]>,
) -> Vec<Complex64> {
    let scaled_denominator: Vec<f64> = loop_tf.denominator.iter().map(|value| value * mu).collect();
    let roots = durand_kerner(&poly_combine(&loop_tf.numerator, &scaled_denominator, 1.0));
    previous
        .map(|reference| best_root_assignment(reference, &roots))
        .unwrap_or_else(|| {
            let mut ordered = roots;
            sort_complex_points(&mut ordered);
            ordered
        })
}

pub(super) fn root_locus_mu_sequence(config: &RootLocusConfig) -> Vec<f64> {
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

pub(super) fn assign_branches_to_finite_zeros(
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
    candidates.sort_by(|left, right| left.0.total_cmp(&right.0));

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

pub(super) fn root_locus_near_zero_plan(
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
        let mu_values = root_locus_mu_sequence(config);
        for (mu_index, root) in tracks
            .get(branch_index)
            .into_iter()
            .flat_map(|track| track.iter().skip(1))
            .enumerate()
        {
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

pub(super) fn root_locus_asymptote_segments(
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

pub(super) fn root_locus_asymptotic_tail_segments(
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

pub(super) fn root_locus_segments(
    branches: &[Vec<RootLocusSamplePoint>],
    real_axis_segments: &[RealAxisSegment],
    asymptotes: &[RootLocusAsymptote],
    open_loop_poles: &[Complex64],
    open_loop_zeros: &[Complex64],
    near_zero_plan: &RootLocusNearZeroPlan,
) -> Vec<RootLocusSegment> {
    let centroid = asymptotes.first().map(|asymptote| asymptote.centroid);
    let extent = root_locus_plot_extent(branches, open_loop_poles, open_loop_zeros, centroid);
    let asymptote_segments = root_locus_asymptote_segments(asymptotes, extent);
    let mut segments = Vec::new();
    segments.extend(root_locus_real_axis_segments(real_axis_segments, extent));
    segments.extend(root_locus_branch_segments(branches));
    segments.extend(near_zero_plan.segments.iter().cloned());
    segments.extend(root_locus_asymptotic_tail_segments(
        branches,
        near_zero_plan,
        &asymptote_segments,
    ));
    if near_zero_plan.segments.is_empty() {
        segments.extend(root_locus_completion_segments(branches, open_loop_zeros));
    }
    segments.extend(asymptote_segments);
    segments
}

pub(super) fn root_locus_events(
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
                point: complex_to_point(*pole),
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
                point: complex_to_point(*zero),
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

pub(super) fn structured_segment_from_points(
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

pub(super) fn root_locus_branch_structure(
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

pub(super) fn view_from_points(
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

pub(super) fn root_locus_views(
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

pub(super) fn root_locus(
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

