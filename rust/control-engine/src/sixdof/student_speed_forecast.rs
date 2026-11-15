//! 局部航速模型的独立纵向预测，复用正式IMC PI及其命令时延。

use super::lng_speed_control::{LngSpeedController, SpeedPiInput, CONTROL_DT_S};
use super::student_model::{evaluate_with_input, ModelStructure, ScalarPredictor};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeedForecast {
    pub structure: ModelStructure,
    pub input_origin: f64,
    pub output_origin: f64,
    pub initial_speed_mps: f64,
    pub initial_bow_distance_m: f64,
    pub current_forward_mps: f64,
    pub dt_s: f64,
    #[serde(default)]
    pub output: Option<Vec<f64>>,
    #[serde(default)]
    pub output_offset_samples: usize,
}

impl SpeedForecast {
    fn validate(&self, count: usize) -> Result<(), String> {
        let valid_model = matches!(self.structure, ModelStructure::Fopdt { k, t_s, delay_s }
            if k.is_finite() && k > 0.0 && k <= 1e9
                && (0.2..=2000.0).contains(&t_s) && (0.0..=120.0).contains(&delay_s));
        if !valid_model
            || !self.dt_s.is_finite()
            || !(CONTROL_DT_S..=1.0).contains(&self.dt_s)
            || (self.dt_s / CONTROL_DT_S - (self.dt_s / CONTROL_DT_S).round()).abs() > 1e-9
            || !(2..=24001).contains(&count)
            || self.output_offset_samples > count.saturating_sub(2)
            || (self.output.is_none() && self.output_offset_samples != 0)
            || (count.saturating_sub(1) as f64) * self.dt_s > 1200.0 + 1e-8
            || [
                self.input_origin,
                self.output_origin,
                self.initial_speed_mps,
                self.initial_bow_distance_m,
                self.current_forward_mps,
            ]
            .iter()
            .any(|value| !value.is_finite() || value.abs() > 1e9)
            || self.output.as_ref().is_some_and(|values| {
                values.len() != count - self.output_offset_samples || values.iter().any(|value| !value.is_finite())
            })
        {
            return Err(
                "纵向预测需要有效的轴速参考—航速局部模型、20Hz整数分频采样及有限初态".into(),
            );
        }
        Ok(())
    }

    fn response(&self, predicted: Vec<f64>, commands: Vec<f64>) -> Result<Value, String> {
        if predicted
            .iter()
            .chain(&commands)
            .any(|value| !value.is_finite())
        {
            return Err("局部航速模型的独立预测发散".into());
        }
        let mut clearance = self.initial_bow_distance_m;
        let mut distances = Vec::with_capacity(predicted.len());
        distances.push(clearance);
        for pair in predicted.windows(2) {
            clearance -= self.dt_s * ((pair[0] + pair[1]) / 2.0 + self.current_forward_mps);
            distances.push(clearance);
        }
        let metrics = self
            .output
            .as_ref()
            .and_then(|actual| evaluate_with_input(&predicted[self.output_offset_samples..], actual,
                &commands[self.output_offset_samples..]));
        let outside_local_speed_domain = predicted.iter().any(|speed| !(0.0..=4.0).contains(speed));
        Ok(json!({
            "schema": "act.student-speed-forecast.v1", "predicted": predicted,
            "commandsRpm": commands, "bowClearanceM": distances, "metrics": metrics,
            "outsideLocalSpeedDomain": outside_local_speed_domain,
        }))
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContainerForecast {
    #[serde(flatten)]
    pub speed: SpeedForecast,
    pub controller: super::container_speed_control::ContainerSpeedInput,
    pub loading_ratio: f64,
    pub maximum_rpm: f64,
    pub reference_mps: Vec<f64>,
    pub voyage: Option<super::container_voyage::ContainerVoyageConfiguration>,
    pub fuel_model: Option<super::fuel::FuelModel>,
    pub initial_shaft_power_w: Option<f64>,
}

/// 独立局部模型仅读取自身航速和航程，实际量测只参与结束后的误差评价。
pub fn container_closed_loop(request: ContainerForecast) -> Result<Value, String> {
    use super::container_speed_control::ContainerSpeedController;
    let speed = &request.speed;
    speed.validate(request.reference_mps.len())?;
    if request.reference_mps.iter().any(|value| !value.is_finite() || !(6.0..=12.0).contains(value))
        || !(0.2..=0.9).contains(&request.loading_ratio)
        || request.initial_shaft_power_w.is_some_and(|power| !power.is_finite() || power < 0.0)
        || request.voyage.is_some() && (request.fuel_model.is_none() || request.initial_shaft_power_w.is_none()
            || speed.initial_speed_mps <= 0.0)
    {
        return Err("集装箱独立预测需要有效航速、装载及航次燃油工作点".into());
    }
    if let Some(voyage) = &request.voyage { voyage.validate()?; }
    if let Some(fuel) = &request.fuel_model { fuel.validate()?; }
    let mut control = ContainerSpeedController::new(&request.controller, request.loading_ratio,
        speed.input_origin, request.maximum_rpm)?;
    let mut plant = ScalarPredictor::new(speed.structure.clone(), speed.initial_speed_mps - speed.output_origin, CONTROL_DT_S);
    let mut predicted = Vec::with_capacity(request.reference_mps.len());
    let mut commands = Vec::with_capacity(request.reference_mps.len());
    let mut distances = Vec::with_capacity(request.reference_mps.len());
    let mut fuel_kg = 0.0;
    let mut north_m = 0.0;
    let mut arrival_s = None;
    let steps = (speed.dt_s / CONTROL_DT_S).round() as usize;
    for (index, reference) in request.reference_mps.iter().enumerate() {
        let measured = plant.output() + speed.output_origin;
        predicted.push(measured);
        distances.push(north_m);
        for substep in 0..steps {
            let target = request.voyage.as_ref().map(|voyage| voyage.reference_at(north_m)).unwrap_or(*reference);
            let command = control.step(&request.controller, target, Some(measured),
                Some(measured + speed.current_forward_mps), request.maximum_rpm)?;
            if substep == 0 { commands.push(command); }
            let previous = plant.output() + speed.output_origin;
            let next = plant.step(command - speed.input_origin) + speed.output_origin;
            if !next.is_finite() { return Err("集装箱独立局部模型预测发散".into()); }
            let old_north = north_m;
            north_m += CONTROL_DT_S * ((previous + next) / 2.0 + speed.current_forward_mps);
            if arrival_s.is_none() {
                // 理想燃油是固定工作点的速度立方近似，实际燃油另由桨扭矩与轴速积分。
                let used_dt = if request.voyage.is_some() && north_m >= 6000.0 && north_m > old_north {
                    CONTROL_DT_S * ((6000.0 - old_north) / (north_m - old_north)).clamp(0.0, 1.0)
                } else { CONTROL_DT_S };
                if let (Some(fuel), Some(power)) = (&request.fuel_model, request.initial_shaft_power_w) {
                    let shaft_power = (power * (previous.max(0.0) / speed.initial_speed_mps).powi(3))
                        .clamp(0.0, fuel.rated_shaft_power_w);
                    fuel_kg += used_dt * fuel.rates(shaft_power, true).fuel_kg_per_s;
                }
                if request.voyage.is_some() && north_m >= 6000.0 {
                    arrival_s = Some(index as f64 * speed.dt_s + substep as f64 * CONTROL_DT_S + used_dt);
                }
            }
        }
    }
    let metrics = speed.output.as_ref().and_then(|actual| evaluate_with_input(
        &predicted[speed.output_offset_samples..], actual, &commands[speed.output_offset_samples..]));
    Ok(json!({"schema":"act.student-container-forecast.v1", "predicted":predicted,
        "commandsRpm":commands,"northM":distances,"metrics":metrics,
        "idealArrivalS":arrival_s,"idealFuelKg":request.fuel_model.as_ref().map(|_| fuel_kg),
        "fuelInterpretation":"teaching_cubic_workpoint_estimate"}))
}

pub fn open_loop(request: SpeedForecast, input_rpm: Vec<f64>) -> Result<Value, String> {
    request.validate(input_rpm.len())?;
    if input_rpm
        .iter()
        .any(|value| !value.is_finite() || value.abs() > 1e6)
    {
        return Err("纵向开环预测的轴速参考无效".into());
    }
    let mut plant = ScalarPredictor::new(
        request.structure.clone(),
        request.initial_speed_mps - request.output_origin,
        request.dt_s,
    );
    let mut predicted = Vec::with_capacity(input_rpm.len());
    for command in &input_rpm {
        predicted.push(plant.output() + request.output_origin);
        plant.step(*command - request.input_origin);
    }
    request.response(predicted, input_rpm)
}

pub fn closed_loop(
    request: SpeedForecast,
    reference_mps: Vec<f64>,
    mut controller: SpeedPiInput,
    maximum_rpm: f64,
    braking_plan: Option<super::lng_berth_plan::BerthSpeedPlan>,
) -> Result<Value, String> {
    request.validate(reference_mps.len())?;
    if reference_mps
        .iter()
        .any(|value| !value.is_finite() || !(0.0..=4.0).contains(value))
    {
        return Err("纵向闭环参考航速超出0至4m/s范围".into());
    }
    let mut control = LngSpeedController::new(&controller, request.input_origin, maximum_rpm)?;
    let mut plant = ScalarPredictor::new(
        request.structure.clone(),
        request.initial_speed_mps - request.output_origin,
        CONTROL_DT_S,
    );
    let mut predicted = Vec::with_capacity(reference_mps.len());
    let mut commands = Vec::with_capacity(reference_mps.len());
    if let Some(plan) = &braking_plan {
        plan.validate()?;
    }
    let mut clearance = request.initial_bow_distance_m;
    let control_steps = (request.dt_s / CONTROL_DT_S).round() as usize;
    for target in reference_mps {
        let speed = plant.output() + request.output_origin;
        predicted.push(speed);
        // 量测按所选采样周期保持，控制器以20Hz读取自身模型的量测。
        for substep in 0..control_steps {
            controller.reference_mps = match &braking_plan {
                Some(plan) => plan.reference_mps(clearance)?,
                None => target,
            };
            let command = control.step(&controller, Some(speed), maximum_rpm)?;
            if substep == 0 {
                commands.push(command);
            }
            let previous_speed = plant.output() + request.output_origin;
            let next_speed = plant.step(command - request.input_origin) + request.output_origin;
            clearance -=
                CONTROL_DT_S * ((previous_speed + next_speed) / 2.0 + request.current_forward_mps);
        }
    }
    request.response(predicted, commands)
}
