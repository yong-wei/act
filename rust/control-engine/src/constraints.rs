//! Hard numerical constraints.

pub fn reject_non_finite(value: f64, label: &str) -> Result<f64, String> {
    if value.is_finite() {
        Ok(value)
    } else {
        Err(format!("{label} is not a finite numerical result."))
    }
}

pub fn round3(value: f64) -> Result<f64, String> {
    reject_non_finite((value * 1000.0).round() / 1000.0, "rounded value")
}
