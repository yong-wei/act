//! 固定作业模式内的局部横移模型预测。没有物理场、床面或实际运行输入。

use super::dredger_control::{DredgerController, DredgerInput};
use super::student_model::{evaluate_with_input, ModelStructure, ScalarPredictor};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DredgerForecast {
    pub structure: ModelStructure,
    pub input_origin: f64,
    pub output_origin: f64,
    pub initial_speed_mps: f64,
    pub initial_heading_deg: f64,
    pub swing_radius_m: f64,
    pub duration_s: f64,
    pub dt_s: f64,
    pub assumed_cut_start_s: f64,
    pub controller: DredgerInput,
    #[serde(default)]
    pub output: Option<Vec<f64>>,
}

pub fn closed_loop(request: DredgerForecast) -> Result<Value, String> {
    request.controller.validate()?;
    let count = ((request.duration_s / 0.05).round() as usize).saturating_add(1);
    if [
        request.input_origin,
        request.output_origin,
        request.initial_speed_mps,
        request.initial_heading_deg,
        request.swing_radius_m,
        request.duration_s,
        request.dt_s,
        request.assumed_cut_start_s,
    ]
    .iter()
    .any(|v| !v.is_finite())
        || (request.dt_s - 0.05).abs() > 1e-9
        || !(50.0..=200.0).contains(&request.swing_radius_m)
        || !(1.0..=600.0).contains(&request.duration_s)
        || !(0.0..=600.0).contains(&request.assumed_cut_start_s)
        || request.assumed_cut_start_s > request.duration_s
        || !request.controller.automatic_swing
        || !(2..=12001).contains(&count)
        || serde_json::to_value(&request.controller.local_model).ok()
            != serde_json::to_value(Some(&request.structure)).ok()
        || request
            .output
            .as_ref()
            .is_some_and(|v| v.len() != count || v.iter().any(|v| !v.is_finite()))
    {
        return Err("独立横移预测需要同一本人局部模型、固定作业模式、有限初态及20Hz记录".into());
    }
    let mut model = ScalarPredictor::new(
        request.structure.clone(),
        request.initial_speed_mps - request.output_origin,
        0.05,
    );
    let mut controller = DredgerController::new(true, 0.0);
    let mut predicted = Vec::with_capacity(count);
    let mut commands = Vec::with_capacity(count);
    let mut headings = Vec::with_capacity(count);
    let mut east = Vec::with_capacity(count);
    let mut distance = 0.0f64;
    let mut outside_local_domain = false;
    for index in 0..count {
        let speed = model.output() + request.output_origin;
        if !speed.is_finite() || speed.abs() > 10.0 || distance.abs() >= request.swing_radius_m {
            return Err("本人横移局部模型的预测超出有限几何范围".into());
        }
        let heading =
            request.initial_heading_deg + (distance / request.swing_radius_m).asin().to_degrees();
        outside_local_domain |= (heading - request.initial_heading_deg).abs() > 15.0;
        predicted.push(speed);
        headings.push(heading);
        east.push(distance);
        let command = if index as f64 * 0.05 < request.assumed_cut_start_s {
            0.0
        } else {
            controller.fixed_mode_prediction_step(&request.controller, speed, heading)?
        };
        commands.push(command);
        let next = model.step(command - request.input_origin) + request.output_origin;
        distance += (speed + next) * 0.025;
    }
    let metrics = request
        .output
        .as_ref()
        .and_then(|actual| evaluate_with_input(&predicted, actual, &commands));
    Ok(
        json!({ "schema": "act.student-dredger-forecast.v1", "predicted": predicted,
        "commandsMps": commands, "headingDeg": headings, "eastM": east, "metrics": metrics,
        "outsideLocalDomain": outside_local_domain,
        "assumedCutStartS": request.assumed_cut_start_s,
        "assumptions": "fixed_mode_local_winch_to_sway_no_soil_or_mooring_limits" }),
    )
}
