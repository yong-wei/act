//! 教学运行的量测评价。原生物理细步极值由会话另行累计。

use serde::{Deserialize, Serialize};
use super::sensor::Quality;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunMetricPoint {
    time_s: f64,
    reference_heading_deg: f64,
    heading_deg: Option<f64>,
    heading_arrived_at_s: Option<f64>,
    heading_quality: Quality,
    rudder_deg: Option<f64>,
    roll_deg: f64,
    motor_power_w: Vec<f64>,
    positive_motor_work_j: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunMetrics {
    sample_cadence_s: f64,
    valid_heading_samples: usize,
    missing_heading_samples: usize,
    heading_rmse_deg: Option<f64>,
    final120s_heading_mae_deg: Option<f64>,
    heading_overshoot_percent: Option<f64>,
    settling_time_s: Option<f64>,
    settling_band_deg: f64,
    rudder_total_variation_deg: f64,
    maximum_roll_deg: f64,
    maximum_shaft_power_w: f64,
    positive_motor_work_j: f64,
}

fn angle_error(reference: f64, actual: f64) -> f64 {
    (reference-actual+180.0).rem_euclid(360.0)-180.0
}

pub fn evaluate(points: &[RunMetricPoint], end_time_s: f64, initial_heading_deg: f64) -> Result<RunMetrics,String> {
    if !(0.0..=3600.0).contains(&end_time_s) || !initial_heading_deg.is_finite() || points.len() > 72000 {
        return Err("运行评价的时间或样本数量无效".into());
    }
    let mut final_reference_start = 0.0;
    let mut reference_before_final = initial_heading_deg;
    let final_reference = points.last().map_or(initial_heading_deg,|point| point.reference_heading_deg);
    for (index,point) in points.iter().enumerate() {
        if (point.time_s-index as f64*0.05).abs() > 1e-6 || point.time_s > end_time_s+1e-7
            || [point.time_s,point.reference_heading_deg,point.roll_deg,point.positive_motor_work_j].iter().any(|value| !value.is_finite())
            || point.heading_deg.into_iter().chain(point.heading_arrived_at_s).chain(point.rudder_deg)
                .chain(point.motor_power_w.iter().copied()).any(|value| !value.is_finite()) {
            return Err("运行评价需要连续20Hz采样及有限数值".into());
        }
        if angle_error(final_reference,point.reference_heading_deg).abs() > 1e-7 {
            final_reference_start = point.time_s+0.05;
            reference_before_final = point.reference_heading_deg;
        }
    }
    let reference_step = angle_error(final_reference,reference_before_final);
    let band = 0.5_f64.max(reference_step.abs()*0.02);
    let mut valid = 0;
    let mut missing = 0;
    let mut squared_error = 0.0;
    let mut final_error = 0.0;
    let mut final_count = 0;
    let mut variation = 0.0;
    let mut previous_rudder: Option<f64> = None;
    let mut maximum_roll = 0.0_f64;
    let mut maximum_power = 0.0_f64;
    let mut peak_beyond = 0.0_f64;
    let mut settled_from = None;
    for point in points {
        let usable = point.heading_quality == Quality::Good
            && point.heading_arrived_at_s.is_some_and(|arrival| arrival <= point.time_s+1e-7 && point.time_s-arrival <= 0.200001);
        if let Some(heading) = point.heading_deg.filter(|_| usable) {
            let error = angle_error(point.reference_heading_deg,heading);
            valid += 1;
            squared_error += error*error;
            if point.time_s >= end_time_s-120.0 { final_count += 1; final_error += error.abs(); }
            if point.time_s >= final_reference_start {
                if error.abs() <= band { settled_from.get_or_insert(point.time_s); }
                else { settled_from = None; }
                if reference_step != 0.0 { peak_beyond = peak_beyond.max(-error*reference_step.signum()); }
            }
        } else {
            missing += 1;
            if point.time_s >= final_reference_start { settled_from = None; }
        }
        if let (Some(current),Some(previous)) = (point.rudder_deg,previous_rudder) { variation += (current-previous).abs(); }
        previous_rudder = point.rudder_deg;
        maximum_roll = maximum_roll.max(point.roll_deg.abs());
        for power in &point.motor_power_w { maximum_power = maximum_power.max(*power); }
    }
    Ok(RunMetrics {
        sample_cadence_s: 0.05, valid_heading_samples: valid, missing_heading_samples: missing,
        heading_rmse_deg: (valid > 0).then(|| (squared_error/valid as f64).sqrt()),
        final120s_heading_mae_deg: (final_count > 0 && end_time_s >= 120.0).then(|| final_error/final_count as f64),
        heading_overshoot_percent: (reference_step != 0.0).then(|| 100.0*peak_beyond/reference_step.abs()),
        settling_time_s: settled_from.filter(|start| end_time_s-start >= 60.0-1e-7).map(|start| start-final_reference_start),
        settling_band_deg: band, rudder_total_variation_deg: variation, maximum_roll_deg: maximum_roll,
        maximum_shaft_power_w: maximum_power, positive_motor_work_j: points.last().map_or(0.0,|point| point.positive_motor_work_j),
    })
}
