//! 天鲸20Hz记录评价。硬约束峰值/违反时长另取120Hz原生累计量。

use super::dredger_control::DredgerMode;
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DredgerMetricPoint {
    pub time_s: f64,
    pub mode: DredgerMode,
    pub sway_mps: f64,
    pub reference_mps: f64,
    pub depth_m: f64,
    pub depth_reference_m: f64,
    pub production_m3: f64,
    pub mechanical_work_j: f64,
    pub cut_power_w: f64,
    pub cable_tension_n: [f64; 2],
    pub spud_reaction_n: f64,
    pub cutter_rpm: f64,
    pub cutter_reference_rpm: f64,
    pub cable_broken: [bool; 2],
    pub mode_event_count: usize,
    pub chatter_event_count: u64,
    pub reversal_count: u64,
}

pub fn run_metrics(
    points: &[DredgerMetricPoint],
    terminal: Option<&DredgerMetricPoint>,
    end_s: f64,
) -> Result<Value, String> {
    if !end_s.is_finite() || end_s <= 0.0 || points.is_empty() || points.len() > 12001 {
        return Err("天鲸评价需要连续20Hz实际记录及有效结束时间".into());
    }
    let mut records: Vec<_> = points.iter().collect();
    if let Some(terminal) = terminal {
        let gap = terminal.time_s - records.last().expect("非空记录").time_s;
        if (terminal.time_s - end_s).abs() > 1e-7 || !(0.0..=0.050001).contains(&gap) {
            return Err("天鲸结束状态与最后控制采样不连续".into());
        }
        if gap > 1e-8 {
            records.push(terminal);
        }
    }
    for (index, point) in records.iter().enumerate() {
        if [
            point.time_s,
            point.sway_mps,
            point.reference_mps,
            point.depth_m,
            point.depth_reference_m,
            point.production_m3,
            point.mechanical_work_j,
            point.cut_power_w,
            point.spud_reaction_n,
            point.cutter_rpm,
            point.cutter_reference_rpm,
        ]
        .iter()
        .chain(&point.cable_tension_n)
        .any(|v| !v.is_finite())
            || point.time_s < 0.0
            || point.time_s > end_s + 1e-7
            || (index > 0
                && ((point.time_s - records[index - 1].time_s) > 0.050001
                    || point.time_s <= records[index - 1].time_s))
        {
            return Err("天鲸评价记录存在非有限值、缺口或时间倒序".into());
        }
    }
    let mut squared_sway = 0.0;
    let mut squared_depth = 0.0;
    let mut samples = 0usize;
    let mut cut_duration = 0.0;
    let mut overloaded_cut = 0.0;
    let mut fault_time = None;
    let mut pause_time = None;
    let mut lifted_time = None;
    for (index, point) in records.iter().enumerate() {
        let dt = if index + 1 < records.len() {
            records[index + 1].time_s - point.time_s
        } else {
            0.0
        };
        if point.mode == DredgerMode::CutSwing {
            cut_duration += dt;
            if point.time_s >= (end_s - 180.0).max(0.0) {
                squared_sway += (point.sway_mps - point.reference_mps).powi(2);
                squared_depth += (point.depth_m - point.depth_reference_m).powi(2);
                samples += 1;
            }
        }
        if point.cut_power_w > 0.0
            && (point.cable_tension_n.iter().any(|v| *v > 800_000.0)
                || point.spud_reaction_n > 1.5e6)
        {
            overloaded_cut += dt;
        }
        if point.cable_broken.iter().any(|v| *v) && fault_time.is_none() {
            fault_time = Some(point.time_s);
        }
        if fault_time.is_some() && point.cutter_reference_rpm == 0.0 && pause_time.is_none() {
            pause_time = Some(point.time_s);
        }
        if fault_time.is_some()
            && point.depth_m < 19.6
            && point.cutter_rpm.abs() < 3.0
            && lifted_time.is_none()
        {
            lifted_time = Some(point.time_s);
        }
    }
    let last = records.last().expect("非空记录");
    Ok(
        json!({ "dredgerSwayRmsMps": if samples > 0 { Some((squared_sway / samples as f64).sqrt()) } else { None },
        "dredgerDepthRmsM": if samples > 0 { Some((squared_depth / samples as f64).sqrt()) } else { None },
        "dredgerCutDurationS": cut_duration, "dredgerOverloadedCutDurationS": overloaded_cut,
        "dredgerProductionM3": last.production_m3, "dredgerMechanicalWorkJ": last.mechanical_work_j,
        "dredgerSpecificEnergyJPerM3": if last.production_m3 > 1e-9 { Some(last.mechanical_work_j / last.production_m3) } else { None },
        "dredgerModeChangeCount": last.mode_event_count, "dredgerChatterEventCount": last.chatter_event_count,
        "dredgerReversalCount": last.reversal_count,
        "dredgerStopCommandAfterFaultS": fault_time.zip(pause_time).map(|(fault, pause)| pause - fault),
        "dredgerLiftAfterFaultS": fault_time.zip(lifted_time).map(|(fault, lifted)| lifted - fault) }),
    )
}
