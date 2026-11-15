//! 邮轮鳍反馈采用仪器姿态估计，有限控制能力由冻结鳍几何和计程仪量测计算。

use super::actuator_system::{ActuatorSystem, finite_wing_coefficients};
use serde::{Deserialize, Serialize};

const DT: f64 = 0.05;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RollStudentModel {
    pub inertia_kg_m2: f64,
    pub damping_nm_s_rad: f64,
    pub stiffness_nm_rad: f64,
}

impl RollStudentModel {
    pub fn feedback_gains(&self, damping_ratio: f64, stiffness_fraction: f64) -> [f64; 2] {
        [stiffness_fraction*self.stiffness_nm_rad,
            (2.0*damping_ratio*(self.inertia_kg_m2*self.stiffness_nm_rad).sqrt()-self.damping_nm_s_rad).max(0.0)]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotchInput {
    pub center_hz: f64,
    pub bandwidth_hz: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CruiseFinInput {
    pub enabled: bool,
    pub model: RollStudentModel,
    pub damping_ratio: f64,
    pub stiffness_fraction: f64,
    pub low_pass_cutoff_hz: f64,
    pub notch: Option<NotchInput>,
}

impl CruiseFinInput {
    pub fn validate(&self) -> Result<(), String> {
        let model = self.model;
        if [
            model.inertia_kg_m2,
            model.damping_nm_s_rad,
            model.stiffness_nm_rad,
            self.damping_ratio,
            self.stiffness_fraction,
            self.low_pass_cutoff_hz,
        ]
        .iter()
        .any(|value| !value.is_finite())
            || model.inertia_kg_m2 <= 0.0
            || model.damping_nm_s_rad < 0.0
            || model.stiffness_nm_rad <= 0.0
            || !(model.inertia_kg_m2 * model.stiffness_nm_rad).is_finite()
            || !(0.3..=0.7).contains(&self.damping_ratio)
            || !(0.0..=0.5).contains(&self.stiffness_fraction)
            || !(0.15..=0.6).contains(&self.low_pass_cutoff_hz)
        {
            return Err("减摇模型、阻尼目标或滤波参数无效".into());
        }
        if let Some(notch) = self.notch {
            if !notch.center_hz.is_finite()
                || !notch.bandwidth_hz.is_finite()
                || !(0.02..=2.0).contains(&notch.center_hz)
                || !(0.03..=0.1).contains(&notch.bandwidth_hz)
            {
                return Err("陷波中心或带宽超出教学范围".into());
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy)]
pub struct FinMeasurements {
    pub angular_rate_rad_s: Option<[f64; 3]>,
    pub specific_force_mps2: Option<[f64; 3]>,
    pub water_speed_mps: Option<f64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct NotchState {
    configuration: Option<NotchInput>,
    input: [f64; 2],
    output: [f64; 2],
}

impl NotchState {
    fn step(&mut self, value: f64, configuration: Option<NotchInput>) -> f64 {
        if self.configuration != configuration {
            self.configuration = configuration;
            self.input = [value; 2];
            self.output = [value; 2];
        }
        let Some(configuration) = configuration else {
            return value;
        };
        let omega = 2.0 * std::f64::consts::PI * configuration.center_hz * DT;
        let alpha = omega.sin() * configuration.bandwidth_hz / (2.0 * configuration.center_hz);
        let divisor = 1.0 + alpha;
        let middle = -2.0 * omega.cos() / divisor;
        let next = (value + self.input[1]) / divisor + middle * self.input[0]
            - middle * self.output[0]
            - (1.0 - alpha) / divisor * self.output[1];
        self.input = [value, self.input[0]];
        self.output = [next, self.output[0]];
        next
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CruiseFinController {
    initialized: bool,
    pub estimated_roll_rad: f64,
    pub estimated_pitch_rad: f64,
    pub filtered_roll_rad: f64,
    pub filtered_roll_rate_rad_s: f64,
    roll_notch: NotchState,
    rate_notch: NotchState,
    pub requested_moment_nm: f64,
    pub available_moment_nm: f64,
    pub allocated_moment_nm: f64,
    pub angles_rad: [f64; 2],
    pub measurement_good: bool,
    pub low_speed_authority: bool,
    pub samples: u64,
}

impl CruiseFinController {
    pub fn validate_checkpoint(&self, controller_ticks: u64) -> Result<(), String> {
        let values = [
            self.estimated_roll_rad,
            self.estimated_pitch_rad,
            self.filtered_roll_rad,
            self.filtered_roll_rate_rad_s,
            self.requested_moment_nm,
            self.available_moment_nm,
            self.allocated_moment_nm,
            self.angles_rad[0],
            self.angles_rad[1],
        ];
        if values
            .iter()
            .chain(self.roll_notch.input.iter())
            .chain(self.roll_notch.output.iter())
            .chain(self.rate_notch.input.iter())
            .chain(self.rate_notch.output.iter())
            .any(|value| !value.is_finite())
            || self.samples > controller_ticks
            || self
                .angles_rad
                .iter()
                .any(|value| value.abs() > 25.0_f64.to_radians() + 1e-12)
            || self.available_moment_nm < 0.0
            || self.allocated_moment_nm.abs() > self.available_moment_nm + 1e-6
        {
            return Err("减摇反馈恢复状态或控制时钟无效".into());
        }
        Ok(())
    }

    pub(crate) fn observe(&mut self, measurements: FinMeasurements, low_pass_cutoff_hz: f64,
        notch: Option<NotchInput>) -> Result<Option<(f64, f64, f64)>, String> {
        self.samples += 1;
        self.measurement_good = false;
        let (Some(rates), Some(force), Some(speed)) = (
            measurements.angular_rate_rad_s,
            measurements.specific_force_mps2,
            measurements.water_speed_mps,
        ) else {
            return Ok(None);
        };
        if rates
            .iter()
            .chain(force.iter())
            .chain(std::iter::once(&speed))
            .any(|value| !value.is_finite())
        {
            return Err("减摇仪器量测无效".into());
        }
        self.measurement_good = true;
        // 比力在静止时为负重力投影。低频倾角校正与陀螺运动学共同形成姿态估计。
        let tilt_roll = (-force[1]).atan2(-force[2]);
        let tilt_pitch = force[0].atan2(force[1].hypot(force[2]));
        if !self.initialized {
            self.estimated_roll_rad = tilt_roll;
            self.estimated_pitch_rad = tilt_pitch;
            self.filtered_roll_rad = tilt_roll;
            self.filtered_roll_rate_rad_s = rates[0];
            self.initialized = true;
        }
        let gravity_weight = 1.0 - (-2.0 * std::f64::consts::PI * 0.03 * DT).exp();
        self.estimated_pitch_rad += gravity_weight * (tilt_pitch - self.estimated_pitch_rad);
        let roll = self.estimated_roll_rad;
        let pitch = self.estimated_pitch_rad.clamp(-1.2, 1.2);
        let roll_rate =
            rates[0] + roll.sin() * pitch.tan() * rates[1] + roll.cos() * pitch.tan() * rates[2];
        self.estimated_roll_rad += DT * roll_rate;
        self.estimated_roll_rad +=
            gravity_weight * super::passive_observer::wrap_pi(tilt_roll - self.estimated_roll_rad);
        let weight = 1.0 - (-2.0 * std::f64::consts::PI * low_pass_cutoff_hz * DT).exp();
        self.filtered_roll_rad += weight * (self.estimated_roll_rad - self.filtered_roll_rad);
        self.filtered_roll_rate_rad_s += weight * (roll_rate - self.filtered_roll_rate_rad_s);
        let filtered_roll = self.roll_notch.step(self.filtered_roll_rad, notch);
        let filtered_rate = self
            .rate_notch
            .step(self.filtered_roll_rate_rad_s, notch);
        Ok(Some((filtered_roll, filtered_rate, speed)))
    }

    pub fn step(
        &mut self,
        input: &CruiseFinInput,
        measurements: FinMeasurements,
        system: &ActuatorSystem,
        failed_fin: Option<usize>,
    ) -> Result<[f64; 2], String> {
        input.validate()?;
        if system.surfaces.len() != 2
            || system
                .surfaces
                .iter()
                .any(|surface| surface.normal_body != [0.0, 0.0, 1.0])
        {
            return Err("减摇反馈需要双鳍参数包".into());
        }
        if !input.enabled {
            self.angles_rad = [0.0; 2];
            self.requested_moment_nm = 0.0;
            self.allocated_moment_nm = 0.0;
        }
        let Some((filtered_roll, filtered_rate, speed)) =
            self.observe(measurements, input.low_pass_cutoff_hz, input.notch)? else {
                return Ok(self.angles_rad);
            };
        let model = input.model;
        let [angle_gain,rate_gain]=model.feedback_gains(input.damping_ratio,input.stiffness_fraction);
        self.requested_moment_nm = if input.enabled {
            -angle_gain * filtered_roll - rate_gain * filtered_rate
        } else {
            0.0
        };
        self.low_speed_authority = speed < 2.0;
        // 分配仅使用计程仪与冻结几何。实际载荷仍由完整局部来流和实际鳍角生成。
        let capacities: [f64; 2] = std::array::from_fn(|index| {
            let fin = &system.surfaces[index];
            if failed_fin == Some(index) {
                return 0.0;
            }
            let lift = finite_wing_coefficients(fin.servo.max_angle_rad, fin.aspect_ratio).0;
            fin.installation.position_body_m[1].abs()
                * 0.5
                * system.water_density_kg_m3
                * fin.area_m2
                * fin.normal_factor.abs()
                * speed.max(0.0).powi(2)
                * lift.abs()
        });
        self.available_moment_nm = capacities.iter().sum();
        self.allocated_moment_nm = self
            .requested_moment_nm
            .clamp(-self.available_moment_nm, self.available_moment_nm);
        self.angles_rad = std::array::from_fn(|index| {
            if capacities[index] == 0.0 || self.available_moment_nm < 1e-9 {
                return 0.0;
            }
            let fin = &system.surfaces[index];
            let fraction = self.allocated_moment_nm / self.available_moment_nm;
            let maximum_lift =
                finite_wing_coefficients(fin.servo.max_angle_rad, fin.aspect_ratio).0;
            let requested_lift =
                -fin.installation.position_body_m[1].signum() * fraction * maximum_lift;
            let mut lower = -fin.servo.max_angle_rad;
            let mut upper = fin.servo.max_angle_rad;
            for _ in 0..24 {
                let middle = (lower + upper) / 2.0;
                if finite_wing_coefficients(middle, fin.aspect_ratio).0 < requested_lift {
                    lower = middle;
                } else {
                    upper = middle;
                }
            }
            (lower + upper) / 2.0
        });
        if !input.enabled {
            self.angles_rad = [0.0; 2];
        }
        Ok(self.angles_rad)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input() -> CruiseFinInput {
        CruiseFinInput {
            enabled: true,
            model: RollStudentModel {
                inertia_kg_m2: 12e9,
                damping_nm_s_rad: 1e8,
                stiffness_nm_rad: 1e9,
            },
            damping_ratio: 0.5,
            stiffness_fraction: 0.2,
            low_pass_cutoff_hz: 0.3,
            notch: None,
        }
    }
    fn system() -> ActuatorSystem {
        serde_json::from_str::<serde_json::Value>(include_str!(
            "../../model-data/cruise-adora/v2/actuators.json"
        ))
        .and_then(|value| serde_json::from_value(value["system"].clone()))
        .unwrap()
    }
    fn measurements(speed: f64) -> FinMeasurements {
        FinMeasurements {
            angular_rate_rad_s: Some([0.01, 0.0, 0.0]),
            specific_force_mps2: Some([0.0, -9.81 * 0.02_f64.sin(), -9.81 * 0.02_f64.cos()]),
            water_speed_mps: Some(speed),
        }
    }

    #[test]
    fn bounded_authority_depends_on_speed_and_remaining_fin() {
        let system = system();
        let mut full = CruiseFinController::default();
        let angles = full
            .step(&input(), measurements(8.0), &system, None)
            .unwrap();
        assert!(full.allocated_moment_nm < 0.0);
        assert!(angles[0] < 0.0 && angles[1] > 0.0);
        let capacity = full.available_moment_nm;
        let mut half = CruiseFinController::default();
        assert_eq!(
            half.step(&input(), measurements(8.0), &system, Some(0))
                .unwrap()[0],
            0.0
        );
        assert!((half.available_moment_nm / capacity - 0.5).abs() < 1e-12);
        let mut stopped = CruiseFinController::default();
        assert_eq!(
            stopped
                .step(&input(), measurements(0.0), &system, None)
                .unwrap(),
            [0.0; 2]
        );
        assert_eq!(stopped.available_moment_nm, 0.0);
        assert!(stopped.low_speed_authority);
    }

    #[test]
    fn notch_at_identified_frequency_attenuates_actual_feedback_and_restores() {
        let mut state = NotchState::default();
        let setting = Some(NotchInput {
            center_hz: 0.2,
            bandwidth_hz: 0.06,
        });
        let mut residual = 0.0;
        for tick in 0..12000 {
            let value = (2.0 * std::f64::consts::PI * 0.2 * tick as f64 * DT).sin();
            let filtered = state.step(value, setting);
            if tick > 10000 {
                residual += filtered.powi(2);
            }
        }
        assert!((residual / 1999.0).sqrt() < 1e-8);
        let mut restored: NotchState =
            serde_json::from_str(&serde_json::to_string(&state).unwrap()).unwrap();
        for tick in 0..100 {
            assert_eq!(
                state.step(tick as f64, setting),
                restored.step(tick as f64, setting)
            );
        }
    }

    #[test]
    fn missing_measurement_holds_commands_and_disabled_fins_return_zero() {
        let system = system();
        let mut controller = CruiseFinController::default();
        let commands = controller
            .step(&input(), measurements(8.0), &system, None)
            .unwrap();
        let mut missing = measurements(8.0);
        missing.angular_rate_rad_s = None;
        assert_eq!(
            controller.step(&input(), missing, &system, None).unwrap(),
            commands
        );
        assert!(!controller.measurement_good);
        let mut disabled = input();
        disabled.enabled = false;
        assert_eq!(
            controller
                .step(&disabled, measurements(8.0), &system, None)
                .unwrap(),
            [0.0; 2]
        );
        controller.validate_checkpoint(3).unwrap();
    }
}
