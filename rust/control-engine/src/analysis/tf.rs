use num_complex::Complex64;
use super::*;

pub(super) fn trim_leading(mut values: Vec<f64>) -> Vec<f64> {
    while values.len() > 1 && values.first().map(|v| v.abs() < 1e-12).unwrap_or(false) {
        values.remove(0);
    }
    values
}

pub(super) fn normalize_tf(tf: TransferFunction) -> TransferFunction {
    let numerator = trim_leading(tf.numerator);
    let denominator = trim_leading(tf.denominator);
    let lead = denominator[0];
    TransferFunction {
        numerator: numerator.iter().map(|v| v / lead).collect(),
        denominator: denominator.iter().map(|v| v / lead).collect(),
    }
}

pub(super) fn convolve(a: &[f64], b: &[f64]) -> Vec<f64> {
    let mut output = vec![0.0; a.len() + b.len() - 1];
    for (i, av) in a.iter().enumerate() {
        for (j, bv) in b.iter().enumerate() {
            output[i + j] += av * bv;
        }
    }
    output
}

pub(super) fn poly_combine(a: &[f64], b: &[f64], sign: f64) -> Vec<f64> {
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
        output[i] = ai + sign * bi;
    }
    trim_leading(output)
}

pub(crate) fn tf_mul(a: &TransferFunction, b: &TransferFunction) -> TransferFunction {
    normalize_tf(TransferFunction {
        numerator: convolve(&a.numerator, &b.numerator),
        denominator: convolve(&a.denominator, &b.denominator),
    })
}

pub(super) fn tf_unity_feedback(loop_tf: &TransferFunction) -> TransferFunction {
    normalize_tf(TransferFunction {
        numerator: loop_tf.numerator.clone(),
        denominator: poly_combine(&loop_tf.denominator, &loop_tf.numerator, 1.0),
    })
}

pub(super) fn eval_poly_complex(coeffs: &[f64], x: Complex64) -> Complex64 {
    coeffs.iter().fold(Complex64::new(0.0, 0.0), |acc, coeff| {
        acc * x + Complex64::new(*coeff, 0.0)
    })
}

pub(super) fn sort_complex_points(points: &mut [Complex64]) {
    points.sort_by(|left, right| {
        left.re
            .total_cmp(&right.re)
            .then(left.im.total_cmp(&right.im))
    });
}

pub(super) fn poly_derivative(coeffs: &[f64]) -> Vec<f64> {
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

pub(super) fn sample_progress(index: usize, samples: usize) -> f64 {
    index as f64 / (samples.saturating_sub(1).max(1)) as f64
}

pub(super) fn logspace(min: f64, max: f64, samples: usize) -> Vec<f64> {
    let start = min.log10();
    let end = max.log10();
    (0..samples)
        .map(|index| 10f64.powf(start + (end - start) * sample_progress(index, samples)))
        .collect()
}

pub(super) fn linspace(start: f64, end: f64, samples: usize) -> Vec<f64> {
    (0..samples)
        .map(|index| start + (end - start) * sample_progress(index, samples))
        .collect()
}

pub(super) fn build_plant_tf(request: &ControlAnalysisRequest, include_gain: bool) -> TransferFunction {
    let plant = normalize_tf(TransferFunction {
        numerator: request.plant.numerator.clone(),
        denominator: request.plant.denominator.clone(),
    });
    request
        .structures
        .iter()
        .filter(|item| item.enabled && (include_gain || item.kind != "gain"))
        .fold(plant, |acc, structure| {
            tf_mul(&acc, &tf_from_structure(structure))
        })
}

pub(super) fn durand_kerner(coeffs: &[f64]) -> Vec<Complex64> {
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

pub(super) fn symmetrize_real_polynomial_roots(roots: &mut Vec<Complex64>) {
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
