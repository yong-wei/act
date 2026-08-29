use serde_json::{json, Value};

use crate::constraints::{reject_non_finite, round3};
use crate::metrics::{max_abs_error, mean_abs_error};

fn required_str(request: &Value, key: &str) -> Result<String, String> {
    request
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| format!("{key} is required"))
}

fn required_finite(request: &Value, key: &str) -> Result<f64, String> {
    let value = request
        .get(key)
        .and_then(Value::as_f64)
        .ok_or_else(|| format!("{key} must be a finite number"))?;
    reject_non_finite(value, key)
}

fn authorized_finite(request: &Value, key: &str) -> Result<f64, String> {
    let value = request
        .get("authorizedModelParameters")
        .and_then(Value::as_object)
        .and_then(|map| map.get(key))
        .and_then(Value::as_f64)
        .ok_or_else(|| format!("identified capability requires authorized {key}"))?;
    reject_non_finite(value, key)
}

pub fn compute_arena_cruise_roll_preview(request: &Value) -> Result<String, String> {
    let model_relation = request
        .get("modelRelation")
        .and_then(Value::as_str)
        .unwrap_or("surrogate");
    let (plant_damping, plant_stiffness, plant_input_gain, emitted_relation) =
        if model_relation == "identified" {
            (
                authorized_finite(request, "plantDamping")?,
                authorized_finite(request, "plantStiffness")?,
                authorized_finite(request, "plantInputGain")?,
                "identified",
            )
        } else {
            (0.72, 1.18, 0.68, "surrogate")
        };

    let task_id = required_str(request, "taskId")?;
    let dataset_hash = required_str(request, "datasetHash")?;
    let identification_model_id = required_str(request, "identificationModelId")?;
    let controller_hash = required_str(request, "controllerHash")?;
    let controller_gain = required_finite(request, "controllerGain")?;
    let damping_compensation = required_finite(request, "dampingCompensation")?;
    let energy_budget = required_finite(request, "energyBudget")?;
    let mut roll = required_finite(request, "initialRoll").unwrap_or(0.2);
    let sample_time = request
        .get("sampleTime")
        .and_then(Value::as_f64)
        .filter(|value| value.is_finite() && *value > 0.0)
        .unwrap_or(0.2);
    let steps = request
        .get("steps")
        .and_then(Value::as_u64)
        .unwrap_or(61)
        .max(1) as usize;

    let mut roll_rate = 0.0;
    let mut previous_control = 0.0;
    let mut control_energy = 0.0;
    let mut control_delta = 0.0;
    let mut safety_violations = 0_u64;
    let mut outputs = Vec::with_capacity(steps);
    let mut references = Vec::with_capacity(steps);
    let mut trace = Vec::with_capacity(steps);

    for index in 0..steps {
        let t = round3(index as f64 * sample_time)?;
        let reference = 0.0;
        let wave = 0.06 * (0.8 * t + 0.5).sin() + 0.025 * (2.3 * t).sin();
        let raw_control = -controller_gain * (roll - reference) - damping_compensation * roll_rate;
        let limit = 0.5_f64.max((energy_budget / 3.0).min(6.0));
        let control = raw_control.max(-limit).min(limit);
        let acceleration =
            -plant_damping * roll_rate - plant_stiffness * roll + plant_input_gain * control + wave;
        roll_rate += acceleration * sample_time;
        roll += roll_rate * sample_time;
        control_energy += control * control * sample_time;
        control_delta += (control - previous_control).abs();
        previous_control = control;
        if roll.abs() > 0.75 {
            safety_violations += 1;
        }
        let output = round3(roll)?;
        let control_out = round3(control)?;
        reject_non_finite(output, "output")?;
        reject_non_finite(control_out, "control")?;
        outputs.push(output);
        references.push(reference);
        trace.push(json!({
            "t": t,
            "reference": reference,
            "output": output,
            "control": control_out,
        }));
    }

    let tracking_error = round3(mean_abs_error(&outputs, &references)?)?;
    let max_deviation = round3(max_abs_error(&outputs, &references)?)?;
    let smoothness = round3((1.0 - control_delta / 1.0_f64.max(outputs.len() as f64 * 2.0)).max(0.0))?;
    let control_energy = round3(control_energy)?;

    let payload = json!({
        "trace": trace,
        "summary": {
            "trackingError": tracking_error,
            "maxDeviation": max_deviation,
            "controlEnergy": control_energy,
            "safetyViolations": safety_violations,
            "smoothness": smoothness,
        },
        "identity": {
            "taskId": task_id,
            "datasetHash": dataset_hash,
            "identificationModelId": identification_model_id,
            "controllerHash": controller_hash,
            "plantDamping": plant_damping,
            "plantStiffness": plant_stiffness,
            "plantInputGain": plant_input_gain,
        },
        "modelRelation": emitted_relation,
    });
    serde_json::to_string(&payload).map_err(|error| error.to_string())
}
