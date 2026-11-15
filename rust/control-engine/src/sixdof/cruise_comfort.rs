//! 同一刚体真值产生客点惯性加速度、比力和教学统计，不解释为医学晕船概率。

use super::integrator::NOMINAL_DT;
use super::state::{TruthState, euler_from_quaternion, moment_from_force, rotation_matrix};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CruiseConfiguration {
    pub statistics_start_s: f64,
    pub statistics_end_s: f64,
    pub fin_failure_time_s: Option<f64>,
    pub failed_fin_index: Option<usize>,
}

impl CruiseConfiguration {
    pub fn validate(&self) -> Result<(), String> {
        if !self.statistics_start_s.is_finite()
            || !self.statistics_end_s.is_finite()
            || self.statistics_start_s < 0.0
            || self.statistics_end_s <= self.statistics_start_s
            || self
                .fin_failure_time_s
                .is_some_and(|time| !time.is_finite() || time < 0.0)
            || self.failed_fin_index.is_some_and(|index| index >= 2)
            || self.fin_failure_time_s.is_some() != self.failed_fin_index.is_some()
        {
            return Err("邮轮统计窗口或单鳍故障配置无效".into());
        }
        Ok(())
    }

    pub fn failed_fin(&self, time_s: f64) -> Option<usize> {
        self.fin_failure_time_s
            .filter(|time| time_s + 1e-9 >= *time)
            .and(self.failed_fin_index)
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PassengerStatistics {
    pub position_body_m: [f64; 3],
    pub acceleration_body_mps2: [f64; 3],
    pub specific_force_body_mps2: [f64; 3],
    pub acceleration_ned_mps2: [f64; 3],
    pub horizontal_acceleration_peak_mps2: f64,
    pub acceleration_peak_mps2: f64,
    horizontal_acceleration_squared: f64,
    acceleration_squared: f64,
    jerk_squared: f64,
    jerk_samples: u64,
    previous_acceleration_body: Option<[f64; 3]>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CruiseComfortState {
    pub physics_samples: u64,
    pub last_time_s: f64,
    pub roll_peak_deg: f64,
    pub roll_rate_peak_deg_s: f64,
    roll_squared_deg: f64,
    roll_rate_squared_deg_s: f64,
    pub passengers: [PassengerStatistics; 2],
    propulsion_start_j: f64,
    fins_start_j: f64,
    pub positive_propulsion_work_j: f64,
    pub fin_servo_electric_work_j: f64,
}

pub fn passenger_acceleration(
    state: &TruthState,
    acceleration: [f64; 6],
    position: [f64; 3],
) -> [f64; 3] {
    let velocity = [
        state.body_velocity[0],
        state.body_velocity[1],
        state.body_velocity[2],
    ];
    let omega = [
        state.body_velocity[3],
        state.body_velocity[4],
        state.body_velocity[5],
    ];
    let omega_dot = [acceleration[3], acceleration[4], acceleration[5]];
    let rotating_origin = moment_from_force(omega, velocity);
    let tangential = moment_from_force(omega_dot, position);
    let centripetal = moment_from_force(omega, moment_from_force(omega, position));
    std::array::from_fn(|axis| {
        acceleration[axis] + rotating_origin[axis] + tangential[axis] + centripetal[axis]
    })
}

impl CruiseComfortState {
    pub fn new(lpp_m: f64) -> Self {
        Self {
            physics_samples: 0,
            last_time_s: 0.0,
            roll_peak_deg: 0.0,
            roll_rate_peak_deg_s: 0.0,
            roll_squared_deg: 0.0,
            roll_rate_squared_deg_s: 0.0,
            passengers: [
                PassengerStatistics {
                    position_body_m: [0.0, 0.0, -15.0],
                    ..Default::default()
                },
                PassengerStatistics {
                    position_body_m: [0.3 * lpp_m, 0.0, -15.0],
                    ..Default::default()
                },
            ],
            propulsion_start_j: 0.0,
            fins_start_j: 0.0,
            positive_propulsion_work_j: 0.0,
            fin_servo_electric_work_j: 0.0,
        }
    }

    pub fn observe(
        &mut self,
        time_s: f64,
        state: &TruthState,
        acceleration: [f64; 6],
        configuration: &CruiseConfiguration,
    ) {
        let propulsion: f64 = state.actuator_states.positive_motor_work_j.iter().sum();
        let fins: f64 = state.actuator_states.control_surface_work_j.iter().sum();
        let included = time_s > configuration.statistics_start_s + 1e-9
            && time_s <= configuration.statistics_end_s + 1e-9;
        if time_s <= configuration.statistics_start_s + 1e-9 {
            self.propulsion_start_j = propulsion;
            self.fins_start_j = fins;
        }
        let rotation = rotation_matrix(state.quaternion);
        let omega = [
            state.body_velocity[3],
            state.body_velocity[4],
            state.body_velocity[5],
        ];
        for point in &mut self.passengers {
            let current = passenger_acceleration(state, acceleration, point.position_body_m);
            let gravity = [
                rotation[2][0] * 9.81,
                rotation[2][1] * 9.81,
                rotation[2][2] * 9.81,
            ];
            if included {
                let horizontal_squared = current[0].powi(2) + current[1].powi(2);
                let total_squared: f64 = current.iter().map(|value| value.powi(2)).sum();
                point.horizontal_acceleration_squared += horizontal_squared;
                point.acceleration_squared += total_squared;
                point.horizontal_acceleration_peak_mps2 = point
                    .horizontal_acceleration_peak_mps2
                    .max(horizontal_squared.sqrt());
                point.acceleration_peak_mps2 =
                    point.acceleration_peak_mps2.max(total_squared.sqrt());
                if let Some(previous) = point.previous_acceleration_body {
                    let rotation_derivative = moment_from_force(omega, current);
                    point.jerk_squared += (0..3)
                        .map(|axis| {
                            ((current[axis] - previous[axis]) / NOMINAL_DT
                                + rotation_derivative[axis])
                                .powi(2)
                        })
                        .sum::<f64>();
                    point.jerk_samples += 1;
                }
            }
            point.previous_acceleration_body = Some(current);
            point.acceleration_body_mps2 = current;
            point.specific_force_body_mps2 =
                std::array::from_fn(|axis| current[axis] - gravity[axis]);
            point.acceleration_ned_mps2 = std::array::from_fn(|axis| {
                rotation[axis]
                    .iter()
                    .zip(current)
                    .map(|(component, value)| component * value)
                    .sum()
            });
        }
        if included {
            self.physics_samples += 1;
            let roll_deg = euler_from_quaternion(state.quaternion)
                .roll_rad
                .to_degrees();
            let rate_deg_s = state.body_velocity[3].to_degrees();
            self.roll_squared_deg += roll_deg.powi(2);
            self.roll_rate_squared_deg_s += rate_deg_s.powi(2);
            self.roll_peak_deg = self.roll_peak_deg.max(roll_deg.abs());
            self.roll_rate_peak_deg_s = self.roll_rate_peak_deg_s.max(rate_deg_s.abs());
            self.positive_propulsion_work_j = propulsion - self.propulsion_start_j;
            self.fin_servo_electric_work_j = fins - self.fins_start_j;
        }
        self.last_time_s = time_s;
    }

    pub fn validate(&self, time_s: f64, configuration: &CruiseConfiguration) -> Result<(), String> {
        let expected = ((time_s.min(configuration.statistics_end_s) / NOMINAL_DT + 1e-7).floor()
            - (configuration.statistics_start_s / NOMINAL_DT + 1e-7).floor())
        .max(0.0) as u64;
        if (self.last_time_s - time_s).abs() > 1e-8 || self.physics_samples != expected {
            return Err("邮轮统计恢复点的采样时钟无效".into());
        }
        let values = [
            self.last_time_s,
            self.roll_peak_deg,
            self.roll_rate_peak_deg_s,
            self.roll_squared_deg,
            self.roll_rate_squared_deg_s,
            self.propulsion_start_j,
            self.fins_start_j,
            self.positive_propulsion_work_j,
            self.fin_servo_electric_work_j,
        ];
        let invalid_passenger = self.passengers.iter().any(|point| {
            [
                point.horizontal_acceleration_peak_mps2,
                point.acceleration_peak_mps2,
                point.horizontal_acceleration_squared,
                point.acceleration_squared,
                point.jerk_squared,
            ]
            .iter()
            .chain(point.position_body_m.iter())
            .chain(point.acceleration_body_mps2.iter())
            .chain(point.specific_force_body_mps2.iter())
            .chain(point.acceleration_ned_mps2.iter())
            .chain(point.previous_acceleration_body.iter().flatten())
            .any(|value| !value.is_finite())
                || point.horizontal_acceleration_squared < 0.0
                || point.acceleration_squared < 0.0
                || point.jerk_squared < 0.0
                || point.jerk_samples > self.physics_samples
        });
        if values.iter().any(|value| !value.is_finite())
            || invalid_passenger
            || self.roll_squared_deg < 0.0
            || self.roll_rate_squared_deg_s < 0.0
            || self.positive_propulsion_work_j < -1e-5
            || self.fin_servo_electric_work_j < -1e-5
        {
            return Err("邮轮统计恢复状态无效".into());
        }
        Ok(())
    }

    pub fn diagnostics(&self) -> serde_json::Value {
        let count = self.physics_samples as f64;
        let rms = |squared: f64| (count > 0.0).then(|| (squared / count).sqrt());
        serde_json::json!({"sampleCadenceS":NOMINAL_DT,"physicsSamples":self.physics_samples,
            "durationS":count*NOMINAL_DT,"rollRmsDeg":rms(self.roll_squared_deg),
            "rollPeakDeg":self.roll_peak_deg,"rollRateRmsDegS":rms(self.roll_rate_squared_deg_s),
            "rollRatePeakDegS":self.roll_rate_peak_deg_s,"positivePropulsionWorkJ":self.positive_propulsion_work_j,
            "finServoElectricWorkJ":self.fin_servo_electric_work_j,
            "passengers":self.passengers.iter().map(|point| serde_json::json!({
                "positionBodyM":point.position_body_m,"accelerationBodyMps2":point.acceleration_body_mps2,
                "specificForceBodyMps2":point.specific_force_body_mps2,"accelerationNedMps2":point.acceleration_ned_mps2,
                "horizontalAccelerationRmsMps2":rms(point.horizontal_acceleration_squared),
                "horizontalAccelerationPeakMps2":point.horizontal_acceleration_peak_mps2,
                "accelerationRmsMps2":rms(point.acceleration_squared),"accelerationPeakMps2":point.acceleration_peak_mps2,
                "jerkRmsMps3":(point.jerk_samples > 0).then(|| (point.jerk_squared/point.jerk_samples as f64).sqrt()),
            })).collect::<Vec<_>>(),"comfortInterpretation":"teaching_proxy_unweighted"})
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rigid_body_point_acceleration_contains_origin_rotation_and_offset_terms() {
        let state = TruthState {
            quaternion: [1.0, 0.0, 0.0, 0.0],
            body_velocity: [8.0, 0.0, 0.0, 0.0, 0.0, 0.1],
            ..Default::default()
        };
        assert_eq!(
            passenger_acceleration(&state, [0.0; 6], [0.0; 3]),
            [0.0, 0.8, 0.0]
        );
        let acceleration =
            passenger_acceleration(&state, [0.0, 0.0, 0.0, 0.0, 0.0, 0.02], [90.0, 0.0, -15.0]);
        assert!((acceleration[0] + 0.9).abs() < 1e-12);
        assert!((acceleration[1] - 2.6).abs() < 1e-12);
    }

    #[test]
    fn statistics_exclude_transient_and_keep_gravity_separate() {
        let configuration = CruiseConfiguration {
            statistics_start_s: 1.0,
            statistics_end_s: 2.0,
            fin_failure_time_s: None,
            failed_fin_index: None,
        };
        let mut metrics = CruiseComfortState::new(305.0);
        let state = TruthState {
            quaternion: [1.0, 0.0, 0.0, 0.0],
            ..Default::default()
        };
        for tick in 1..=240 {
            metrics.observe(tick as f64 * NOMINAL_DT, &state, [0.0; 6], &configuration);
        }
        assert_eq!(metrics.physics_samples, 120);
        assert_eq!(metrics.passengers[0].acceleration_body_mps2, [0.0; 3]);
        assert_eq!(
            metrics.passengers[0].specific_force_body_mps2,
            [0.0, 0.0, -9.81]
        );
        assert_eq!(
            metrics.diagnostics()["passengers"][0]["horizontalAccelerationRmsMps2"],
            0.0
        );
        metrics.validate(2.0, &configuration).unwrap();
    }
}
