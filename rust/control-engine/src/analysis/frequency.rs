use num_complex::Complex64;
use super::*;

#[derive(Debug, Clone)]
pub(super) struct NyquistFrequencySample {
    omega: f64,
    value: Complex64,
}

pub(super) fn eval_transfer_function_at(loop_tf: &TransferFunction, s: Complex64) -> Complex64 {
    let denominator = eval_poly_complex(&loop_tf.denominator, s);
    if denominator.norm() < 1e-18 {
        let numerator = eval_poly_complex(&loop_tf.numerator, s);
        let angle = numerator.arg();
        return Complex64::from_polar(1e12, angle);
    }
    eval_poly_complex(&loop_tf.numerator, s) / denominator
}

pub(super) fn eval_transfer_function(loop_tf: &TransferFunction, omega: f64) -> Complex64 {
    eval_transfer_function_at(loop_tf, Complex64::new(0.0, omega))
}

pub(super) fn is_finite_complex(value: Complex64) -> bool {
    value.re.is_finite() && value.im.is_finite()
}

pub(super) fn complex_to_point(value: Complex64) -> ComplexPoint {
    ComplexPoint {
        re: value.re,
        im: value.im,
    }
}

pub(super) fn distance_to_segment(point: Complex64, start: Complex64, end: Complex64) -> f64 {
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

pub(super) fn angle_delta_rad(left: f64, right: f64) -> f64 {
    let mut delta = right - left;
    while delta > std::f64::consts::PI {
        delta -= 2.0 * std::f64::consts::PI;
    }
    while delta <= -std::f64::consts::PI {
        delta += 2.0 * std::f64::consts::PI;
    }
    delta
}

pub(super) fn nyquist_should_refine(
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

pub(super) fn append_adaptive_nyquist_segment(
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

pub(super) fn nyquist_frequency_samples(
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

pub(super) fn interpolate_nyquist_display_start(
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

pub(super) fn nyquist_display_samples(
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

pub(super) fn interpolate_nyquist_sample(
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

pub(super) fn push_unique_nyquist_key_point(
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

pub(super) fn nyquist_key_points(samples: &[NyquistFrequencySample]) -> Vec<NyquistKeyPoint> {
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

pub(super) fn trailing_zero_order(coeffs: &[f64]) -> usize {
    coeffs
        .iter()
        .rev()
        .take_while(|value| value.abs() < 1e-12)
        .count()
}

pub(super) fn coefficient_for_origin_order(coeffs: &[f64], order: usize) -> f64 {
    coeffs
        .get(coeffs.len().saturating_sub(order + 1))
        .copied()
        .unwrap_or(0.0)
}

pub(super) fn asymptote_angle_deg(coeff: f64, power: isize) -> f64 {
    let coeff_angle = if coeff < 0.0 { 180.0 } else { 0.0 };
    normalize_angle_deg(coeff_angle + 90.0 * power as f64)
}

pub(super) fn nyquist_asymptotes(loop_tf: &TransferFunction) -> Vec<NyquistAsymptote> {
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

pub(super) fn low_frequency_infinity_order(loop_tf: &TransferFunction) -> usize {
    let numerator_origin_order = trailing_zero_order(&loop_tf.numerator);
    let denominator_origin_order = trailing_zero_order(&loop_tf.denominator);
    denominator_origin_order.saturating_sub(numerator_origin_order)
}

pub(super) fn mapped_origin_indent_segment(
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

pub(super) fn nyquist_contour_segments(
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

pub(super) fn winding_number(points: &[ComplexPoint], critical: Complex64) -> f64 {
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

pub(super) fn count_right_half_plane_roots(coeffs: &[f64]) -> usize {
    durand_kerner(coeffs)
        .iter()
        .filter(|root| root.re > 1e-7)
        .count()
}

pub(super) fn build_nyquist_criterion(loop_tf: &TransferFunction, clockwise_n: i64) -> NyquistCriterion {
    let p = count_right_half_plane_roots(&loop_tf.denominator);
    let z = count_right_half_plane_roots(&poly_combine(&loop_tf.denominator, &loop_tf.numerator, 1.0));
    NyquistCriterion {
        n: clockwise_n,
        p,
        z,
        relation: "Z = P + N".to_string(),
        is_consistent: z as i64 == p as i64 + clockwise_n,
    }
}

pub(super) fn build_nyquist_data(
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
        let z = count_right_half_plane_roots(&poly_combine(&loop_tf.denominator, &loop_tf.numerator, 1.0))
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

pub(super) fn frequency_response(
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

pub(super) fn unwrap_bode_phase_deg(mut phase_deg: f64, previous_phase: Option<f64>) -> f64 {
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

pub(super) fn exact_frequency_readings(
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

pub(super) fn interpolate_zero_cross(points: &[CurvePoint], target: f64) -> Option<f64> {
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

pub(super) fn margins(
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
    // 整段贴合阈值时 signum(0)==signum(0)，不得当成穿越（Issue #1957 review）。
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

pub(super) fn interp_curve(points: &[CurvePoint], x: f64) -> Option<f64> {
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

