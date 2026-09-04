use num_complex::Complex64;
use super::*;

pub(super) fn nonlinear_param(request: &NonlinearAnalysisRequest, key: &str, fallback: f64) -> f64 {
    request
        .parameters
        .as_ref()
        .and_then(|params| params.get(key))
        .and_then(|value| value.as_f64())
        .filter(|value| value.is_finite())
        .unwrap_or(fallback)
}

pub(super) fn nonlinear_range(request: &NonlinearAnalysisRequest) -> Vec<f64> {
    linspace(
        request.time_range.start,
        request.time_range.end,
        request.time_range.samples.max(2),
    )
}

pub(super) fn phase_derivative(
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

pub(super) fn compute_phase_plane(request: &NonlinearAnalysisRequest) -> NonlinearAnalysisResult {
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

pub(super) fn describing_function(
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

pub(super) fn characteristic_value(model_id: &str, x: f64, request: &NonlinearAnalysisRequest) -> f64 {
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

pub(super) fn characteristic_signal_output(
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

pub(super) fn compute_negative_inverse(request: &NonlinearAnalysisRequest) -> NonlinearAnalysisResult {
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

pub(super) fn compute_harmonic(request: &NonlinearAnalysisRequest) -> NonlinearAnalysisResult {
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

pub(super) fn compute_characteristic(request: &NonlinearAnalysisRequest) -> NonlinearAnalysisResult {
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

pub(super) fn compute_turning_radius(request: &NonlinearAnalysisRequest) -> NonlinearAnalysisResult {
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

