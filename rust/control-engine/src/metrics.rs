//! Summary and metric derivation boundary.
//!
//! Existing analysis metrics remain in `lib.rs`. Arena virtual-preview
//! aggregates are derived here from the Rust trace.

use crate::constraints::reject_non_finite;

pub fn mean_abs_error(outputs: &[f64], references: &[f64]) -> Result<f64, String> {
    if outputs.is_empty() || outputs.len() != references.len() {
        return Err("metric samples are empty or mismatched".to_string());
    }
    let sum: f64 = outputs
        .iter()
        .zip(references)
        .map(|(output, reference)| (output - reference).abs())
        .sum();
    reject_non_finite(sum / outputs.len() as f64, "trackingError")
}

pub fn max_abs_error(outputs: &[f64], references: &[f64]) -> Result<f64, String> {
    let max = outputs
        .iter()
        .zip(references)
        .map(|(output, reference)| (output - reference).abs())
        .fold(0.0_f64, f64::max);
    reject_non_finite(max, "maxDeviation")
}
