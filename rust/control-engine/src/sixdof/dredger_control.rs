//! 固定作业模式图与本人局部模型设计的横移PI。输出仅为真实绞车/桥架/刀速命令。

use super::dredger_mechanism::{DredgerCommands, DredgerEvent};
use super::dredger_sensors::{DredgerSensors, DredgerSignal};
use super::lng_speed_control::imc_pi_gains;
use super::student_model::ModelStructure;
use serde::{Deserialize, Serialize};

const DT: f64 = 0.05;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DredgerMode {
    #[default]
    Transit,
    Prepare,
    SpudHold,
    CutSwing,
    PauseCut,
    Recover,
    Exit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IntegralPolicy {
    #[default]
    Track,
    Freeze,
    Reset,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DredgerInput {
    pub requested_mode: DredgerMode,
    pub commands: DredgerCommands,
    pub automatic_swing: bool,
    pub local_model: Option<ModelStructure>,
    pub reference_mps: f64,
    pub half_angle_deg: f64,
    pub reversal_ramp_s: f64,
    pub kp_multiplier: f64,
    pub ti_multiplier: f64,
    pub entry_speed_mps: f64,
    pub entry_hold_s: f64,
    pub safety_fraction: f64,
    pub integral_policy: IntegralPolicy,
    pub depth_filter_tau_s: f64,
    pub sway_filter_tau_s: f64,
}
impl Default for DredgerInput {
    fn default() -> Self {
        Self {
            requested_mode: DredgerMode::Transit,
            commands: Default::default(),
            automatic_swing: false,
            local_model: None,
            reference_mps: 0.08,
            half_angle_deg: 10.0,
            reversal_ramp_s: 15.0,
            kp_multiplier: 1.0,
            ti_multiplier: 1.0,
            entry_speed_mps: 0.05,
            entry_hold_s: 10.0,
            safety_fraction: 1.0,
            integral_policy: Default::default(),
            depth_filter_tau_s: 0.2,
            sway_filter_tau_s: 0.2,
        }
    }
}

fn effective_pi_model(model: &ModelStructure) -> Result<ModelStructure, String> {
    let (k, t_s, delay_s) = match *model {
        ModelStructure::Nomoto1 { k, t_s } if (0.2..=2000.0).contains(&t_s) => (k, t_s, 0.0),
        ModelStructure::Nomoto2 { k, t1_s, t2_s }
            if (0.2..=2000.0).contains(&t1_s) && (0.2..=2000.0).contains(&t2_s) =>
        {
            (k, t1_s + t2_s, 0.0)
        }
        ModelStructure::Fopdt { k, t_s, delay_s }
            if (0.2..=2000.0).contains(&t_s) && (0.0..=120.0).contains(&delay_s) =>
        {
            (k, t_s, delay_s)
        }
        _ => return Err("横移PI需要本人固定作业模式的一阶或二阶局部模型".into()),
    };
    if ![k, t_s, delay_s].iter().all(|v| v.is_finite()) || !(0.0..=1e9).contains(&k) || k == 0.0 {
        return Err("当前局部模型的方向或稳定性不适合所给横移PI模板".into());
    }
    Ok(ModelStructure::Fopdt { k, t_s, delay_s })
}

impl DredgerInput {
    pub fn validate(&self) -> Result<(), String> {
        self.commands.validate()?;
        let ranged = [
            (self.reference_mps, 0.03, 0.15),
            (self.half_angle_deg, 1.0, 15.0),
            (self.reversal_ramp_s, 5.0, 30.0),
            (self.kp_multiplier, 0.2, 3.0),
            (self.ti_multiplier, 0.2, 3.0),
            (self.entry_speed_mps, 0.03, 0.1),
            (self.entry_hold_s, 5.0, 20.0),
            (self.safety_fraction, 0.7, 1.0),
            (self.depth_filter_tau_s, 0.05, 5.0),
            (self.sway_filter_tau_s, 0.05, 5.0),
        ];
        if ranged
            .iter()
            .any(|(value, low, high)| !value.is_finite() || value < low || value > high)
        {
            return Err("横移、进入条件、滤波或提前中止参数超出教学设计范围".into());
        }
        if let Some(model) = &self.local_model {
            imc_pi_gains(
                &effective_pi_model(model)?,
                self.kp_multiplier,
                self.ti_multiplier,
            )?;
        }
        if self.automatic_swing && self.local_model.is_none() {
            return Err("自动横移需要先冻结本人局部模型".into());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DredgerController {
    pub ticks: u64,
    pub mode: DredgerMode,
    pub events: Vec<DredgerEvent>,
    pub filtered_depth_m: Option<f64>,
    pub filtered_sway_mps: Option<f64>,
    pub filtered_minimum_tension_n: Option<f64>,
    pub reference_mps: f64,
    pub applied_differential_mps: f64,
    pub integral_mps: f64,
    pub feedback_available: bool,
    pub integral_frozen: bool,
    pub entry_elapsed_s: f64,
    pub overload_elapsed_s: f64,
    pub invalid_elapsed_s: f64,
    pub trip_latched: bool,
    pub chatter_event_count: u64,
    pub reversal_count: u64,
    direction: f64,
    center_heading_deg: Option<f64>,
    local_model: Option<ModelStructure>,
    last_angle_reference_deg: f64,
}

fn filtered(previous: Option<f64>, value: Option<f64>, tau: f64) -> Option<f64> {
    value.map(|value| {
        previous.map_or(value, |previous| {
            previous + (1.0 - (-DT / tau).exp()) * (value - previous)
        })
    })
}

impl DredgerController {
    pub fn new(spud_down: bool, initial_angle_deg: f64) -> Self {
        Self {
            ticks: 0,
            mode: if spud_down {
                DredgerMode::SpudHold
            } else {
                DredgerMode::Transit
            },
            events: vec![],
            filtered_depth_m: None,
            filtered_sway_mps: None,
            filtered_minimum_tension_n: None,
            reference_mps: 0.0,
            applied_differential_mps: 0.0,
            integral_mps: 0.0,
            feedback_available: false,
            integral_frozen: false,
            entry_elapsed_s: 0.0,
            overload_elapsed_s: 0.0,
            invalid_elapsed_s: 0.0,
            trip_latched: false,
            chatter_event_count: 0,
            reversal_count: 0,
            direction: 1.0,
            center_heading_deg: None,
            local_model: None,
            last_angle_reference_deg: initial_angle_deg,
        }
    }

    pub fn validate_input(&self, input: &DredgerInput) -> Result<(), String> {
        input.validate()?;
        if self.local_model.is_some()
            && input.local_model.is_some()
            && serde_json::to_value(&self.local_model).ok()
                != serde_json::to_value(&input.local_model).ok()
        {
            return Err("本次运行的本人横移模型已经冻结，请新建运行比较新模型".into());
        }
        Ok(())
    }

    fn transition(&mut self, mode: DredgerMode, time_s: f64, policy: IntegralPolicy) {
        if mode == self.mode {
            return;
        }
        self.mode = mode;
        self.entry_elapsed_s = 0.0;
        self.events.push(DredgerEvent {
            time_s,
            kind: format!("mode_{mode:?}"),
            component: 0,
        });
        let recent = self
            .events
            .iter()
            .rev()
            .take_while(|event| time_s - event.time_s < 10.0)
            .filter(|event| ["mode_CutSwing", "mode_SpudHold"].contains(&event.kind.as_str()))
            .count();
        if recent > 2 && [DredgerMode::CutSwing, DredgerMode::SpudHold].contains(&mode) {
            self.chatter_event_count += 1;
        }
        if policy == IntegralPolicy::Reset {
            self.integral_mps = 0.0;
        }
    }

    pub fn step(
        &mut self,
        input: &DredgerInput,
        sensors: &DredgerSensors,
        time_s: f64,
        ground_speed_mps: Option<f64>,
        heading_deg: Option<f64>,
        cable_broken: [bool; 2],
    ) -> Result<DredgerCommands, String> {
        self.validate_input(input)?;
        self.ticks += 1;
        if self.local_model.is_none() {
            self.local_model = input.local_model.clone();
        }
        let get = |signal| sensors.valid_value(signal, time_s);
        let depth = get(DredgerSignal::Depth);
        let sway = get(DredgerSignal::SwaySpeed);
        let angle = get(DredgerSignal::LadderAngle);
        let rpm = get(DredgerSignal::CutterRpm);
        let tension = [
            get(DredgerSignal::CableTension(0)),
            get(DredgerSignal::CableTension(1)),
        ];
        let spud = get(DredgerSignal::SpudForce);
        let contact = get(DredgerSignal::SpudContact);
        let travel = get(DredgerSignal::SpudTravel);
        self.filtered_depth_m = filtered(self.filtered_depth_m, depth, input.depth_filter_tau_s);
        self.filtered_sway_mps = filtered(self.filtered_sway_mps, sway, input.sway_filter_tau_s);
        let minimum_tension = tension[0]
            .zip(tension[1])
            .map(|(port, starboard)| port.min(starboard));
        self.filtered_minimum_tension_n =
            filtered(self.filtered_minimum_tension_n, minimum_tension, 0.5);
        self.feedback_available = [
            depth,
            sway,
            angle,
            rpm,
            tension[0],
            tension[1],
            spud,
            contact,
            travel,
            ground_speed_mps,
            heading_deg,
        ]
        .iter()
        .all(Option::is_some);
        self.invalid_elapsed_s = if self.feedback_available {
            0.0
        } else {
            self.invalid_elapsed_s + DT
        };
        let overloaded = tension
            .iter()
            .flatten()
            .any(|value| *value > 800_000.0 * input.safety_fraction);
        self.overload_elapsed_s = if overloaded {
            self.overload_elapsed_s + DT
        } else {
            0.0
        };
        let danger = self.overload_elapsed_s >= 1.0
            || spud.is_some_and(|v| v > 1.5e6 * input.safety_fraction)
            || travel.is_some_and(|v| v.abs() > 0.5)
            || self.invalid_elapsed_s > 2.0
            || cable_broken.iter().any(|broken| *broken);
        let working = [
            DredgerMode::Prepare,
            DredgerMode::SpudHold,
            DredgerMode::CutSwing,
        ]
        .contains(&self.mode);
        if working && danger {
            self.trip_latched = true;
            self.transition(DredgerMode::PauseCut, time_s, input.integral_policy);
        }
        if self.center_heading_deg.is_none() {
            self.center_heading_deg = heading_deg;
        }
        if !self.trip_latched {
            self.normal_transition(
                input,
                time_s,
                ground_speed_mps,
                contact,
                depth,
                rpm,
                tension,
            );
        }
        if self.mode == DredgerMode::PauseCut
            && depth.is_some_and(|v| v < 19.6)
            && rpm.is_some_and(|v| v.abs() < 3.0)
        {
            self.transition(DredgerMode::Recover, time_s, input.integral_policy);
        }
        if self.mode == DredgerMode::Recover
            && [DredgerMode::Exit, DredgerMode::Transit].contains(&input.requested_mode)
        {
            self.transition(DredgerMode::Exit, time_s, input.integral_policy);
        }
        if self.mode == DredgerMode::Exit
            && input.requested_mode == DredgerMode::Transit
            && depth.is_some_and(|v| v < 0.0)
            && rpm.is_some_and(|v| v.abs() < 3.0)
        {
            self.transition(DredgerMode::Transit, time_s, input.integral_policy);
        }

        let mut commands = input.commands.clone();
        match self.mode {
            DredgerMode::Transit => {
                commands.spud_down = false;
                commands.cables_attached = false;
                commands.depth_reference_m = -0.5;
                commands.cutter_rpm = 0.0;
                commands.winch_speed_mps = [0.0; 2];
            }
            DredgerMode::Prepare | DredgerMode::SpudHold | DredgerMode::CutSwing => {
                commands.spud_down = true;
                commands.cables_attached = true;
            }
            DredgerMode::PauseCut | DredgerMode::Recover => {
                commands.spud_down = true;
                commands.cables_attached = true;
                commands.cutter_rpm = 0.0;
                commands.winch_speed_mps = [0.0; 2];
                commands.depth_reference_m = commands.depth_reference_m.min(19.5);
            }
            DredgerMode::Exit => {
                commands.cutter_rpm = 0.0;
                commands.winch_speed_mps = [0.0; 2];
                commands.depth_reference_m = -0.5;
                let raised = depth.is_some_and(|value| value < 0.0)
                    && rpm.is_some_and(|value| value.abs() < 3.0);
                commands.spud_down = !raised;
                commands.cables_attached = !raised;
            }
        }
        // 给定倒桩动作只在刀具抬起、停转、钢桩完全撤除后移动台车。
        // 再落桩时重新捕获世界接触点，船体位置始终由六自由度受力推进。
        let carriage_ready = self.mode == DredgerMode::Transit
            && self.feedback_available
            && contact.is_some_and(|value| value < 0.001)
            && depth.is_some_and(|value| value < 0.0)
            && rpm.is_some_and(|value| value.abs() < 3.0)
            && ground_speed_mps.is_some_and(|value| value < input.entry_speed_mps);
        if !carriage_ready {
            commands.carriage_speed_mps = 0.0;
        }
        if let (Some(depth), Some(angle)) = (self.filtered_depth_m, angle) {
            let q = angle.to_radians();
            let arm = 36.0 * q.cos() - 1.5 * q.sin();
            // 有限液压伺服在物理端点内保留0.05°命令余量，允许船体耦合扰动被实际反馈纠正。
            self.last_angle_reference_deg = (q + (commands.depth_reference_m - depth) / arm)
                .to_degrees()
                .clamp(0.05, 64.95);
        }
        commands.ladder_angle_reference_deg = Some(self.last_angle_reference_deg);
        self.apply_sway_pi(input, &mut commands, heading_deg)?;
        if self.mode == DredgerMode::CutSwing && input.automatic_swing && self.feedback_available {
            if let Some(tension) = self.filtered_minimum_tension_n {
                // 固定总缆长会在转弯时同时拉紧双缆。共模仅通过实测张力保持50kN预张力。
                let common = ((tension - 50_000.0) * 2e-7).clamp(-0.15, 0.15);
                let previous_differential = self.applied_differential_mps;
                for speed in &mut commands.winch_speed_mps {
                    *speed = (*speed + common).clamp(-0.5, 0.5);
                }
                self.applied_differential_mps =
                    (commands.winch_speed_mps[0] - commands.winch_speed_mps[1]) / 2.0;
                if let Some(model) = &input.local_model {
                    let gains = imc_pi_gains(
                        &effective_pi_model(model)?,
                        input.kp_multiplier,
                        input.ti_multiplier,
                    )?;
                    self.integral_mps += DT
                        * (self.applied_differential_mps - previous_differential)
                        / gains.tracking_time_s;
                }
            }
        }
        commands.validate()?;
        Ok(commands)
    }

    fn normal_transition(
        &mut self,
        input: &DredgerInput,
        time_s: f64,
        speed: Option<f64>,
        contact: Option<f64>,
        depth: Option<f64>,
        rpm: Option<f64>,
        tension: [Option<f64>; 2],
    ) {
        match input.requested_mode {
            DredgerMode::Transit => {
                if ![
                    DredgerMode::Transit,
                    DredgerMode::PauseCut,
                    DredgerMode::Recover,
                    DredgerMode::Exit,
                ]
                .contains(&self.mode)
                {
                    self.transition(DredgerMode::PauseCut, time_s, input.integral_policy);
                }
            }
            DredgerMode::Prepare | DredgerMode::SpudHold | DredgerMode::CutSwing => {
                if self.mode == DredgerMode::Transit {
                    self.transition(DredgerMode::Prepare, time_s, input.integral_policy);
                }
                if self.mode == DredgerMode::Prepare && contact.is_some_and(|value| value >= 0.999)
                {
                    self.transition(DredgerMode::SpudHold, time_s, input.integral_policy);
                }
                if self.mode == DredgerMode::Recover
                    && input.requested_mode != DredgerMode::CutSwing
                {
                    self.transition(DredgerMode::SpudHold, time_s, input.integral_policy);
                }
                if self.mode == DredgerMode::CutSwing
                    && input.requested_mode != DredgerMode::CutSwing
                {
                    self.transition(DredgerMode::PauseCut, time_s, input.integral_policy);
                }
                let ready = self.feedback_available
                    && speed.is_some_and(|v| v < input.entry_speed_mps)
                    && contact.is_some_and(|v| v >= 0.999)
                    && tension.iter().all(|v| v.is_some_and(|v| v > 20_000.0))
                    && depth.is_some_and(|v| (v - input.commands.depth_reference_m).abs() < 0.1)
                    && input.commands.cutter_rpm > 0.0
                    && rpm.is_some_and(|v| v >= 0.9 * input.commands.cutter_rpm);
                if self.mode == DredgerMode::SpudHold
                    && input.requested_mode == DredgerMode::CutSwing
                {
                    self.entry_elapsed_s = if ready {
                        self.entry_elapsed_s + DT
                    } else {
                        0.0
                    };
                    if self.entry_elapsed_s + 1e-9 >= input.entry_hold_s {
                        self.transition(DredgerMode::CutSwing, time_s, input.integral_policy);
                    }
                }
            }
            DredgerMode::PauseCut | DredgerMode::Recover => {
                if ![DredgerMode::PauseCut, DredgerMode::Recover].contains(&self.mode) {
                    self.transition(DredgerMode::PauseCut, time_s, input.integral_policy);
                }
            }
            DredgerMode::Exit => {
                if ![
                    DredgerMode::PauseCut,
                    DredgerMode::Recover,
                    DredgerMode::Exit,
                ]
                .contains(&self.mode)
                {
                    self.transition(DredgerMode::PauseCut, time_s, input.integral_policy);
                }
            }
        }
    }

    fn apply_sway_pi(
        &mut self,
        input: &DredgerInput,
        commands: &mut DredgerCommands,
        heading_deg: Option<f64>,
    ) -> Result<(), String> {
        let active =
            input.automatic_swing && self.mode == DredgerMode::CutSwing && self.feedback_available;
        if let (Some(heading), Some(center)) = (heading_deg, self.center_heading_deg) {
            let relative =
                super::passive_observer::wrap_pi((heading - center).to_radians()).to_degrees();
            if active && relative * self.direction >= input.half_angle_deg {
                self.direction = -self.direction;
                self.reversal_count += 1;
            }
        }
        let target = if active {
            self.direction * input.reference_mps
        } else {
            0.0
        };
        let max_change = 2.0 * input.reference_mps / input.reversal_ramp_s * DT;
        self.reference_mps += (target - self.reference_mps).clamp(-max_change, max_change);
        self.integral_frozen = !active;
        if let Some(model) = &input.local_model {
            let gains = imc_pi_gains(
                &effective_pi_model(model)?,
                input.kp_multiplier,
                input.ti_multiplier,
            )?;
            let error = self.reference_mps - self.filtered_sway_mps.unwrap_or(0.0);
            let proportional = gains.kp_rpm_per_mps * error;
            let raw = proportional + self.integral_mps;
            let applied = raw.clamp(-0.5, 0.5);
            if active {
                self.integral_mps += DT
                    * (gains.kp_rpm_per_mps / gains.ti_s * error
                        + (applied - raw) / gains.tracking_time_s);
                commands.winch_speed_mps = [applied, -applied];
            } else if input.integral_policy == IntegralPolicy::Track {
                let held = (commands.winch_speed_mps[0] - commands.winch_speed_mps[1]) / 2.0;
                self.integral_mps = held - proportional;
            }
        }
        self.applied_differential_mps =
            (commands.winch_speed_mps[0] - commands.winch_speed_mps[1]) / 2.0;
        Ok(())
    }

    /// 独立C模型只反馈自己的横移速度/航向，固定CutSwing域内复用同一PI与换向斜坡。
    pub fn fixed_mode_prediction_step(
        &mut self,
        input: &DredgerInput,
        own_speed_mps: f64,
        own_heading_deg: f64,
    ) -> Result<f64, String> {
        self.validate_input(input)?;
        if !own_speed_mps.is_finite() || !own_heading_deg.is_finite() {
            return Err("横移预测反馈非有限".into());
        }
        self.mode = DredgerMode::CutSwing;
        self.feedback_available = true;
        if self.center_heading_deg.is_none() {
            self.center_heading_deg = Some(own_heading_deg);
        }
        self.filtered_sway_mps = filtered(
            self.filtered_sway_mps,
            Some(own_speed_mps),
            input.sway_filter_tau_s,
        );
        let mut commands = input.commands.clone();
        self.apply_sway_pi(input, &mut commands, Some(own_heading_deg))?;
        Ok(self.applied_differential_mps)
    }

    pub fn validate_checkpoint(&self, controller_ticks: u64) -> Result<(), String> {
        if self.ticks > controller_ticks
            || self.events.len() > 100_000
            || [
                self.reference_mps,
                self.applied_differential_mps,
                self.integral_mps,
                self.entry_elapsed_s,
                self.overload_elapsed_s,
                self.invalid_elapsed_s,
                self.direction,
                self.last_angle_reference_deg,
            ]
            .iter()
            .any(|v| !v.is_finite())
            || self.filtered_depth_m.is_some_and(|v| !v.is_finite())
            || self.filtered_sway_mps.is_some_and(|v| !v.is_finite())
            || self
                .filtered_minimum_tension_n
                .is_some_and(|v| !v.is_finite())
            || ![-1.0, 1.0].contains(&self.direction)
        {
            return Err("作业控制器恢复点的时钟或状态无效".into());
        }
        Ok(())
    }
}
