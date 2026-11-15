//! 教学辨识与冻结预测的公开数值入口。没有物理会话写权限。

use super::student_model::{self, IdentificationResult, ModelStructure};
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ActuatorPrediction {
    structure: ModelStructure,
    input_origin: f64,
    output_origin: f64,
    initial_output: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
enum StructureKind { Nomoto1, Nomoto2, Fopdt, RollOscillator }

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DpSignals {
    input_body: Vec<[f64;3]>,
    output: Vec<[f64;3]>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DpMetricPoint {
    time_s: f64,
    position_error_m: [f64;2],
    heading_error_deg: f64,
    normalized_allocation_residual: f64,
}

#[derive(Deserialize)]
#[serde(tag = "operation", rename_all = "snake_case")]
enum Request {
    IceMetrics {
        points: Vec<super::ice_contact::IceMetricPoint>,
        #[serde(default, rename = "terminalPoint")]
        terminal_point: Option<super::ice_contact::IceMetricPoint>,
    },
    DpMetrics {
        points: Vec<DpMetricPoint>,
        #[serde(rename = "endTimeS")]
        end_time_s: f64,
    },
    DpCapacity {
        #[serde(rename = "windSpeedMps")]
        wind_speed_mps: f64,
        #[serde(rename = "windFromDeg")]
        wind_from_deg: f64,
        #[serde(rename = "powerBudgetW")]
        power_budget_w: f64,
    },
    DpIdentify {
        runs: Vec<DpSignals>,
        #[serde(rename = "dtS")]
        dt_s: f64,
    },
    DpPredict {
        structure: ModelStructure,
        signals: DpSignals,
        #[serde(rename = "dtS")]
        dt_s: f64,
    },
    DpManualCommands {
        #[serde(rename = "targetBody")]
        target_body: [f64;3],
        #[serde(rename = "thrusterIndex")]
        thruster_index: Option<usize>,
    },
    SignalSpectrum {
        values: Vec<f64>,
        #[serde(rename = "dtS")]
        dt_s: f64,
        #[serde(rename = "minimumFrequencyHz")]
        minimum_frequency_hz: f64,
        #[serde(rename = "maximumFrequencyHz")]
        maximum_frequency_hz: f64,
    },
    RunMetrics {
        points: Vec<super::course_metrics::RunMetricPoint>,
        #[serde(rename = "endTimeS")]
        end_time_s: f64,
        #[serde(rename = "initialHeadingDeg")]
        initial_heading_deg: f64,
    },
    HeadingDesign { structure: ModelStructure },
    SpeedDesign { structure: ModelStructure },
    RollDesign { input: super::cruise_control::CruiseFinInput },
    ContainerClosedLoop {
        #[serde(flatten)]
        request: super::student_speed_forecast::ContainerForecast,
    },
    SpeedOpenLoop {
        #[serde(flatten)]
        request: super::student_speed_forecast::SpeedForecast,
        #[serde(rename = "inputRpm")]
        input_rpm: Vec<f64>,
    },
    SpeedClosedLoop {
        #[serde(flatten)]
        request: super::student_speed_forecast::SpeedForecast,
        #[serde(rename = "referenceMps")]
        reference_mps: Vec<f64>,
        controller: super::lng_speed_control::SpeedPiInput,
        #[serde(rename = "maximumRpm")]
        maximum_rpm: f64,
        #[serde(default, rename = "brakingPlan")]
        braking_plan: Option<super::lng_berth_plan::BerthSpeedPlan>,
    },
    Identify {
        #[serde(rename = "structureKind")]
        structure_kind: StructureKind,
        #[serde(default, rename = "freeDecayOutput")]
        free_decay_output: Option<Vec<f64>>,
        input: Vec<f64>, output: Vec<f64>,
        #[serde(rename = "dtS")]
        dt_s: f64,
        #[serde(rename = "inputOrigin")]
        input_origin: f64,
        #[serde(rename = "outputOrigin")]
        output_origin: f64,
    },
    Predict {
        structure: ModelStructure, input: Vec<f64>, output: Vec<f64>,
        #[serde(default)]
        actuator: Option<ActuatorPrediction>,
        #[serde(rename = "dtS")]
        dt_s: f64,
        #[serde(rename = "inputOrigin")]
        input_origin: f64,
        #[serde(rename = "outputOrigin")]
        output_origin: f64,
    },
    HeadingClosedLoop {
        structure: ModelStructure,
        reference: Vec<f64>,
        #[serde(rename = "inputOrigin")]
        input_origin: f64,
        #[serde(rename = "outputOrigin")]
        output_origin: f64,
        #[serde(rename = "initialHeadingDeg")]
        initial_heading_deg: f64,
        #[serde(rename = "initialYawRateDegS")]
        initial_yaw_rate_deg_s: f64,
        #[serde(rename = "dtS")]
        dt_s: f64,
        controller: super::session::SessionInput,
        #[serde(default)]
        controllers: Option<Vec<super::session::SessionInput>>,
        #[serde(default)]
        output: Option<Vec<f64>>,
        #[serde(default)]
        actuator: Option<ActuatorPrediction>,
    },
}

fn normalized_channels(input: Vec<f64>, output: Vec<f64>, dt: f64, input_origin: f64,
    output_origin: f64) -> Result<(Vec<f64>, Vec<f64>), String> {
    if !(0.01..=1.0).contains(&dt) || !input_origin.is_finite() || !output_origin.is_finite()
        || input.len() != output.len() || !(2..=24001).contains(&input.len())
        || input.iter().chain(&output).any(|value| !value.is_finite() || value.abs() > 1e15) {
        return Err("辨识采样周期、工作点或通道记录无效".into());
    }
    let input: Vec<f64> = input.iter().map(|value| value-input_origin).collect();
    let output: Vec<f64> = output.iter().map(|value| value-output_origin).collect();
    if input.iter().chain(&output).any(|value| !value.is_finite()) {
        return Err("工作点归一化后通道超出有限范围".into());
    }
    Ok((input, output))
}

fn validate_structure(structure: &ModelStructure) -> Result<(), String> {
    let time = |value: f64| (0.2..=2000.0).contains(&value);
    let gain = |value: f64| value.is_finite() && value.abs() <= 1e9;
    let valid = match structure {
        ModelStructure::Nomoto1 { k, t_s } => gain(*k) && time(t_s.abs()),
        ModelStructure::Nomoto2 { k, t1_s, t2_s } => gain(*k) && time(*t1_s) && time(*t2_s),
        ModelStructure::Fopdt { k, t_s, delay_s } => gain(*k) && time(*t_s) && (0.0..=120.0).contains(delay_s),
        ModelStructure::RollOscillator { natural_freq_rad_s, damping, control_gain } =>
            (0.001..=10.0).contains(natural_freq_rad_s) && (0.001..=5.0).contains(damping) && gain(*control_gain),
        ModelStructure::DpLowFreq3 { .. } => false,
    };
    if !valid { return Err("学生模型的参数或结构不适用于该通道".into()); }
    Ok(())
}

fn prediction(structure: &ModelStructure, input: &[f64], output: &[f64], dt: f64)
    -> Result<(Vec<f64>, student_model::EvaluationMetrics), String> {
    validate_structure(structure)?;
    let mut predicted = student_model::predict(structure, input, output[0], dt);
    predicted.truncate(output.len());
    if predicted.len() != output.len() || predicted.iter().any(|value| !value.is_finite()) {
        return Err("该学生模型在所选窗口内的预测无效".into());
    }
    let metrics = student_model::evaluate_with_input(&predicted, output, input).ok_or("预测指标无法计算")?;
    Ok((predicted, metrics))
}

fn identify(kind: StructureKind, input: &[f64], output: &[f64], dt: f64,
    free_decay_output: Option<&[f64]>) -> IdentificationResult {
    match kind {
        StructureKind::Nomoto1 => student_model::identify_nomoto1(input, output, dt),
        StructureKind::Nomoto2 => student_model::identify_nomoto2(input, output, dt),
        StructureKind::Fopdt => student_model::identify_fopdt(input, output, dt),
        StructureKind::RollOscillator => {
            if let Some(free_decay) = free_decay_output {
                student_model::identify_roll_oscillator(free_decay, dt, Some((input, output)))
            } else if input.iter().all(|value| value.abs() < 1e-12) {
                student_model::identify_roll_oscillator(output, dt, None)
            } else {
                IdentificationResult { structure: None, residual_rms: f64::NAN, identified_ok: false,
                    failure_reason: Some("控制增益辨识需要独立的零输入自由衰减记录".into()) }
            }
        }
    }
}

pub fn compute(request_json: &str) -> Result<String, String> {
    let request: Request = serde_json::from_str(request_json).map_err(|error| error.to_string())?;
    let response = match request {
        Request::DpMetrics {points,end_time_s} => {
            if points.is_empty() || points.len()>72001 || !end_time_s.is_finite() || end_time_s<=0.0
                || points.iter().any(|point|!point.time_s.is_finite() || point.position_error_m.iter().any(|value|!value.is_finite())
                    || !point.heading_error_deg.is_finite() || !point.normalized_allocation_residual.is_finite())
                || points.windows(2).any(|pair|pair[1].time_s<=pair[0].time_s)
            {return Err("定位评价需要有效的完整时序记录".into());}
            let start=(end_time_s-180.0).max(0.0);
            let selected=points.iter().filter(|point|point.time_s>=start-1e-7 && point.time_s<=end_time_s+1e-7).collect::<Vec<_>>();
            if selected.is_empty() {return Err("定位评价的末段窗口尚无有效样本".into());}
            let mut position_squared=0.0;let mut heading_squared=0.0;let mut maximum_position=0.0_f64;let mut residual_squared=0.0;
            for point in &selected {
                let error=point.position_error_m[0].hypot(point.position_error_m[1]);
                position_squared+=error*error;
                let heading=super::passive_observer::wrap_pi(point.heading_error_deg.to_radians()).to_degrees();
                heading_squared+=heading*heading;maximum_position=maximum_position.max(error);
                residual_squared+=point.normalized_allocation_residual.powi(2);
            }
            json!({"windowStartS":start,"windowEndS":end_time_s,"samples":selected.len(),
                "positionRmsM":(position_squared/selected.len() as f64).sqrt(),
                "headingRmsDeg":(heading_squared/selected.len() as f64).sqrt(),"maximumPositionErrorM":maximum_position,
                "normalizedAllocationResidualRms":(residual_squared/selected.len() as f64).sqrt()})
        }
        Request::DpCapacity {wind_speed_mps,wind_from_deg,power_budget_w} => {
            use super::actuator_system::{ActuatorCommands,ShaftCommand};
            use super::model_pack::PackActuators;
            use super::semisub_allocator::{allocate,AllocationMode};
            if ![8.0,12.0,18.0,24.0,30.0].contains(&wind_speed_mps) || !wind_from_deg.is_finite()
                || ![8e6,16e6,32e6].contains(&power_budget_w) {return Err("请选择规定的风速和可用功率".into());}
            let pack=super::model_pack::embedded_vessel_pack("semisub-981","research-nominal-v5")
                .map_err(|error|format!("参数包无效 {error:?}"))?;
            let direction=wind_from_deg.to_radians();
            let load=pack.geometry.wind_model.as_ref().ok_or("缺少公开风载投影")?
                .loads([-wind_speed_mps*direction.cos(),-wind_speed_mps*direction.sin()],[1.0,0.0,0.0,0.0],[0.0;6]);
            let PackActuators::Physical {mut system,..}=pack.actuators else {return Err("缺少实际推进器参数".into());};
            system.max_positive_motor_power_w=Some(power_budget_w);
            let commands=ActuatorCommands {shafts:vec![ShaftCommand::default();8],surfaces:vec![]};
            let desired=[-load[0],-load[1],-load[5]];
            let ideal=allocate(&system,desired,AllocationMode::Pseudoinverse,[1.0;3],1.0,
                [0.0;8],[0.0;8],[0.0;3],[[0.0;2];8],None,true,commands.clone());
            let azimuth=std::array::from_fn(|index|ideal.commands.shafts[index].azimuth_rad);
            let result=allocate(&system,desired,AllocationMode::SequentialConvex,[1.0;3],1.0,
                azimuth,[0.0;8],[0.0;3],[[0.0;2];8],None,true,commands);
            json!({"windSpeedMps":wind_speed_mps,"windFromDeg":wind_from_deg,"powerBudgetW":power_budget_w,
                "windLoadBody":desired.map(|value|-value),"allocation":result,
                "withinNominalStaticCapacity":result.normalized_residual<=0.02,
                "assumptions":"公开教学投影、零流速、静态方位对齐、无阵风与波浪，动态运行另行验证"})
        }
        Request::DpManualCommands {target_body,thruster_index} => {
            use super::actuator_system::{ActuatorCommands,ShaftCommand};
            use super::model_pack::PackActuators;
            if target_body.iter().any(|value|!value.is_finite() || value.abs()>8e6)
                || thruster_index.is_some_and(|index|index>=8) {return Err("推进器激励无效".into());}
            let pack=super::model_pack::embedded_vessel_pack("semisub-981","research-nominal-v5")
                .map_err(|error|format!("参数包无效 {error:?}"))?;
            let PackActuators::Physical {system,..}=pack.actuators else {return Err("缺少实际推进器".into());};
            let mut commands=ActuatorCommands {shafts:vec![ShaftCommand::default();8],surfaces:vec![]};
            if let Some(index)=thruster_index {
                let magnitude=target_body[0].hypot(target_body[1]);
                let angle=target_body[1].atan2(target_body[0]);
                commands.shafts[index].azimuth_rad=angle;
                commands.shafts[index].speed_reference_rad_s=super::semisub_allocator::shaft_reference(
                    &system,index,magnitude,angle,[0.0;3]).0;
            } else {
                let allocation=super::semisub_allocator::allocate(&system,target_body,
                    super::semisub_allocator::AllocationMode::Pseudoinverse,[1.0;3],1.0,
                    [0.0;8],[0.0;8],[0.0;3],[[0.0;2];8],None,true,commands);
                commands=allocation.commands;
            }
            serde_json::to_value(commands).map_err(|error|error.to_string())?
        }
        Request::DpIdentify {runs,dt_s} => {
            if !(0.01..=1.0).contains(&dt_s) || runs.is_empty() || runs.len()>20 {return Err("低频辨识运行或采样周期无效".into());}
            let mut inputs=Vec::new();let mut outputs=Vec::new();let mut starts=Vec::new();
            for run in runs {
                if run.input_body.len()!=run.output.len() || run.output.len()<20
                    || run.input_body.iter().chain(&run.output).flatten().any(|value|!value.is_finite() || value.abs()>1e12)
                {return Err("低频辨识通道或独立窗口无效".into());}
                starts.push(inputs.len());inputs.extend(run.input_body);outputs.extend(run.output);
            }
            if inputs.len()>24001 {return Err("低频辨识窗口超过支持长度".into());}
            let channel=|values:&Vec<[f64;3]>,axis|values.iter().map(|value|value[axis]).collect::<Vec<f64>>();
            let result=student_model::identify_dp_low_freq_segments(&channel(&inputs,0),&channel(&inputs,1),&channel(&inputs,2),
                &channel(&outputs,0),&channel(&outputs,1),&channel(&outputs,2),dt_s,&starts);
            json!({"identifiedOk":result.identified_ok,"structure":result.structure,
                "failureReason":result.failure_reason,"residualRms":result.residual_rms})
        }
        Request::DpPredict {structure,signals,dt_s} => {
            let ModelStructure::DpLowFreq3 {a,b}=&structure else {return Err("请选择本人三通道低频模型".into());};
            if a.len()!=9 || b.len()!=9 || a.iter().chain(b).any(|value|!value.is_finite())
                || !(0.01..=1.0).contains(&dt_s) || signals.input_body.len()!=signals.output.len()
                || !(20..=24001).contains(&signals.output.len())
                || signals.input_body.iter().chain(&signals.output).flatten().any(|value|!value.is_finite() || value.abs()>1e12)
            {return Err("三通道低频模型或独立验证窗口无效".into());}
            let input=|axis|signals.input_body.iter().map(|point|point[axis]).collect::<Vec<f64>>();
            let predicted=student_model::predict_dp(&structure,&input(0),&input(1),&input(2),signals.output[0])
                .ok_or("三通道模型预测失败")?;
            let metrics=(0..3).map(|axis| {
                let predicted=predicted.iter().map(|point|point[axis]).collect::<Vec<_>>();
                let output=signals.output.iter().map(|point|point[axis]).collect::<Vec<_>>();
                student_model::evaluate(&predicted,&output)
            }).collect::<Vec<_>>();
            json!({"predicted":predicted,"metrics":metrics})
        }
        Request::SignalSpectrum { values, dt_s, minimum_frequency_hz, maximum_frequency_hz } => {
            if !(32..=24001).contains(&values.len()) || !(0.01..=1.0).contains(&dt_s)
                || !minimum_frequency_hz.is_finite() || !maximum_frequency_hz.is_finite()
                || minimum_frequency_hz <= 0.0 || minimum_frequency_hz >= maximum_frequency_hz
                || maximum_frequency_hz > 1.0_f64.min(0.5 / dt_s)
                || values.iter().any(|value| !value.is_finite() || value.abs() > 1e9) {
                return Err("频谱需要32至24001个等间隔有限样本，分析频带须处于有效采样范围".into());
            }
            let mean = values.iter().sum::<f64>() / values.len() as f64;
            let window: Vec<f64> = (0..values.len()).map(|index|
                0.5 - 0.5 * (2.0 * std::f64::consts::PI * index as f64 / (values.len() - 1) as f64).cos()).collect();
            let window_sum = window.iter().sum::<f64>();
            let samples: Vec<f64> = values.iter().zip(&window).map(|(value, weight)| (value - mean) * weight).collect();
            let resolution = 1.0 / (values.len() as f64 * dt_s);
            let first_bin = (minimum_frequency_hz / resolution).ceil() as usize;
            let last_bin = (maximum_frequency_hz / resolution).floor() as usize;
            if last_bin <= first_bin || last_bin > 1200 {
                return Err("所选窗口的频率分辨率不足，或分析频带超出支持范围".into());
            }
            let mut peak = None;
            let mut maximum_amplitude = 1e-10;
            let mut bins = Vec::new();
            for bin in first_bin..=last_bin {
                let omega = 2.0 * std::f64::consts::PI * bin as f64 / values.len() as f64;
                let coefficient = 2.0 * omega.cos();
                let mut previous = 0.0;
                let mut second_previous = 0.0;
                for value in &samples {
                    let next = value + coefficient * previous - second_previous;
                    second_previous = previous;
                    previous = next;
                }
                let squared = previous * previous + second_previous * second_previous - coefficient * previous * second_previous;
                let amplitude = 2.0 * squared.max(0.0).sqrt() / window_sum;
                let frequency = bin as f64 * resolution;
                if amplitude > maximum_amplitude { maximum_amplitude = amplitude; peak = Some(frequency); }
                bins.push(json!({ "frequencyHz": frequency, "amplitude": amplitude }));
            }
            json!({ "method": "mean_removed_hann_amplitude", "resolutionHz": resolution,
                "peakFrequencyHz": peak, "bins": bins })
        }
        Request::RunMetrics { points,end_time_s,initial_heading_deg } => {
            serde_json::to_value(super::course_metrics::evaluate(&points,end_time_s,initial_heading_deg)?)
                .map_err(|error| error.to_string())?
        }
        Request::HeadingDesign { structure } => {
            validate_structure(&structure)?;
            let ModelStructure::Nomoto1 { k,t_s } = structure else { return Err("航向设计初值需要本人辨识的一阶转艏率模型".into()); };
            if k / t_s <= 0.0 { return Err("请核对实际输入方向，当前K/T无法生成正增益航向设计初值".into()); }
            let damping = 0.8;
            let frequency = (1.0/(damping*t_s.abs())).max(0.03);
            let kp = t_s*frequency*frequency/k;
            let kd = (2.0*damping*frequency*t_s-1.0)/k;
            if [kp,kd,3.0*kp,3.0*kd].iter().any(|value| !value.is_finite()) { return Err("当前模型的控制设计结果超出有限范围".into()); }
            json!({ "schema":"act.student-heading-design.v1", "dampingRatio":damping,
                "naturalFrequencyRadS":frequency, "kp":kp, "kd":kd, "ki":kp/150.0,
                "kpMinimum":0.2*kp, "kpMaximum":3.0*kp, "kdMaximum":3.0*kd })
        }
        Request::SpeedDesign { structure } => {
            validate_structure(&structure)?;
            if !matches!(structure, ModelStructure::Fopdt { k, .. } if k > 0.0) {
                return Err("航速设计初值需要本人辨识的正增益一阶时延模型".into());
            }
            serde_json::to_value(super::lng_speed_control::imc_pi_gains(&structure, 1.0, 1.0)?)
                .map_err(|error| error.to_string())?
        }
        Request::RollDesign { input } => {
            input.validate()?;
            let model=input.model;
            let [kp,kd]=model.feedback_gains(input.damping_ratio,input.stiffness_fraction);
            let stiffness=model.stiffness_nm_rad+kp;
            let damping=model.damping_nm_s_rad+kd;
            let natural=(stiffness/model.inertia_kg_m2).sqrt();
            let ratio=damping/(2.0*(model.inertia_kg_m2*stiffness).sqrt());
            let bins:Vec<_>=(0..81).map(|index| {
                let frequency=0.01*10.0_f64.powf(index as f64/40.0);
                let omega=2.0*std::f64::consts::PI*frequency;
                let amplitude=|c:f64,b:f64| 1e6*180.0/std::f64::consts::PI
                    /((c-model.inertia_kg_m2*omega*omega).powi(2)+(b*omega).powi(2)).sqrt();
                json!({"frequencyHz":frequency,"openAmplitudeDegPerMNm":amplitude(model.stiffness_nm_rad,model.damping_nm_s_rad),
                    "closedAmplitudeDegPerMNm":amplitude(stiffness,damping)})
            }).collect();
            json!({"angleGainNmRad":kp,"rateGainNmSRad":kd,"naturalFrequencyRadS":natural,
                "dampingRatio":ratio,"assumptions":"linear_roll_unlimited_moment_no_measurement_delay","bins":bins})
        }
        Request::ContainerClosedLoop { request } => super::student_speed_forecast::container_closed_loop(request)?,
        Request::SpeedOpenLoop { request, input_rpm } => {
            super::student_speed_forecast::open_loop(request, input_rpm)?
        }
        Request::SpeedClosedLoop { request, reference_mps, controller, maximum_rpm, braking_plan } => {
            super::student_speed_forecast::closed_loop(request, reference_mps, controller, maximum_rpm, braking_plan)?
        }
        Request::Identify { structure_kind, free_decay_output, input, output, dt_s, input_origin, output_origin } => {
            if free_decay_output.as_ref().is_some_and(|values| !(2..=24001).contains(&values.len())
                || values.iter().any(|value| !value.is_finite() || value.abs() > 1e15)) {
                return Err("自由衰减记录的采样无效".into());
            }
            let (input, output) = normalized_channels(input, output, dt_s, input_origin, output_origin)?;
            let result = identify(structure_kind, &input, &output, dt_s, free_decay_output.as_deref());
            if result.identified_ok {
                let structure = result.structure.ok_or("辨识成功但结构缺失")?;
                let (predicted, metrics) = prediction(&structure, &input, &output, dt_s)?;
                json!({ "schema": "act.student-model-analysis.v1", "identifiedOk": true,
                    "structure": structure, "metrics": metrics,
                    "predicted": predicted.iter().map(|value| value+output_origin).collect::<Vec<_>>(),
                    "failureReason": null })
            } else {
                json!({ "schema": "act.student-model-analysis.v1", "identifiedOk": false,
                    "structure": null, "metrics": null, "predicted": [],
                    "failureReason": result.failure_reason.unwrap_or("该窗口无法完成辨识".into()) })
            }
        }
        Request::Predict { structure, mut input, output, dt_s, input_origin, output_origin, actuator } => {
            if let Some(actuator) = actuator {
                let (commands, _) = normalized_channels(input, output.clone(), dt_s,
                    actuator.input_origin, output_origin)?;
                validate_structure(&actuator.structure)?;
                if !actuator.initial_output.is_finite() || !actuator.output_origin.is_finite() {
                    return Err("执行器模型初态或工作点无效".into());
                }
                input = student_model::predict(&actuator.structure, &commands,
                    actuator.initial_output-actuator.output_origin, dt_s);
                input.truncate(output.len());
                for value in &mut input { *value += actuator.output_origin; }
            }
            let (input, output) = normalized_channels(input, output, dt_s, input_origin, output_origin)?;
            let (predicted, metrics) = prediction(&structure, &input, &output, dt_s)?;
            json!({ "schema": "act.student-model-analysis.v1", "structure": structure, "metrics": metrics,
                "predicted": predicted.iter().map(|value| value+output_origin).collect::<Vec<_>>() })
        }
        Request::IceMetrics { points, terminal_point } => super::ice_contact::run_metrics(&points, terminal_point.as_ref())?,
        Request::HeadingClosedLoop { structure, reference, input_origin, output_origin, initial_heading_deg, initial_yaw_rate_deg_s,
            dt_s, controller, controllers, output, actuator } => {
            validate_structure(&structure)?;
            if !matches!(structure, ModelStructure::Nomoto1 { .. } | ModelStructure::Nomoto2 { .. })
                || (dt_s-0.05).abs() > 1e-9 || !(2..=24001).contains(&reference.len())
                || reference.iter().any(|value| !value.is_finite())
                || !initial_heading_deg.is_finite() || !initial_yaw_rate_deg_s.is_finite()
                || !input_origin.is_finite() || !output_origin.is_finite()
                || controller.control_mode == super::control_law::HeadingControlMode::Manual {
                return Err("独立航向闭环需要转艏率模型、20Hz采样及有效控制器".into());
            }
            if controllers.as_ref().is_some_and(|inputs| inputs.len() != reference.len()
                || inputs.iter().any(|input| input.control_mode == super::control_law::HeadingControlMode::Manual))
                || output.as_ref().is_some_and(|values| values.len() != reference.len()
                    || values.iter().any(|value| !value.is_finite())) {
                return Err("独立闭环的控制器记录或比较量测无效".into());
            }
            let mut plant = student_model::ScalarPredictor::new(structure, initial_yaw_rate_deg_s-output_origin, dt_s);
            let mut feedback = super::control_law::HeadingFeedbackController::default();
            let mut actuator_model = if let Some(actuator) = actuator {
                validate_structure(&actuator.structure)?;
                if !actuator.initial_output.is_finite() || !actuator.input_origin.is_finite()
                    || !actuator.output_origin.is_finite() {
                    return Err("执行器模型工作点无效".into());
                }
                Some((student_model::ScalarPredictor::new(actuator.structure,
                    actuator.initial_output-actuator.output_origin, dt_s), actuator.input_origin, actuator.output_origin))
            } else { None };
            let mut heading = initial_heading_deg;
            let mut headings = Vec::with_capacity(reference.len());
            let mut rates = Vec::with_capacity(reference.len());
            let mut commands = Vec::with_capacity(reference.len());
            let mut actual = Vec::with_capacity(reference.len());
            for (index, target) in reference.iter().enumerate() {
                headings.push(heading);
                rates.push(plant.output()+output_origin);
                let active_controller = controllers.as_ref().map(|inputs| &inputs[index]).unwrap_or(&controller);
                let gains = active_controller.ice_heading_schedule
                    .map(|schedule| schedule.gains(active_controller.pid))
                    .unwrap_or(active_controller.pid);
                let command = feedback.step_with_tracking(active_controller.control_mode, &gains, *target,
                    Some(heading), index as f64*dt_s, dt_s, active_controller.derivative_filter_tau_s,
                    active_controller.heading_integral_tracking.unwrap_or_default())?;
                let surface = actuator_model.as_ref().map(|(state, _, origin)| state.output()+origin).unwrap_or(command);
                commands.push(command);
                actual.push(surface);
                let previous_rate = plant.output()+output_origin;
                let next_rate = plant.step(surface-input_origin)+output_origin;
                heading += dt_s*(previous_rate+next_rate)/2.0;
                if let Some((state, origin, _)) = &mut actuator_model { state.step(command-*origin); }
                if !heading.is_finite() || !next_rate.is_finite() { return Err("独立闭环发散".into()); }
            }
            let metrics = output.as_ref().and_then(|measured| student_model::evaluate_with_input(&rates, measured, &commands));
            json!({ "schema": "act.student-model-analysis.v1", "headingDeg": headings,
                "yawRateDegS": rates, "commandsDeg": commands, "actualSurfaceDeg": actual,
                "predicted": rates, "metrics": metrics })
        }
    };
    serde_json::to_string(&response).map_err(|error| error.to_string())
}
