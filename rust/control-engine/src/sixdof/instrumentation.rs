//! 安装点量测、独立随机子流及全通道采样队列。

use super::environment_state::EnvironmentState;
use super::sensor::{FaultKind, Measurement, NoiseLevel, Quality, SensorChannel, channel_seed};
use super::state::{
    TruthState, euler_from_quaternion, moment_from_force, normalize_quaternion, rotation_matrix,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SensorSignal {
    Heading,
    YawRate,
    North,
    East,
    SpeedLog,
    RollRate,
    PitchRate,
    SpecificForceX,
    SpecificForceY,
    SpecificForceZ,
    WindSpeed,
    WindDirection,
    SurfaceEncoder(usize),
    AzimuthEncoder(usize),
    ShaftSpeed(usize),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorInstallations {
    pub gnss_body_m: [f64; 3],
    pub imu_body_m: [f64; 3],
    pub speed_log_body_m: [f64; 3],
    pub wind_body_m: [f64; 3],
    pub cg_waterline_height_m: f64,
}

#[derive(Clone, Serialize, Deserialize)]
struct InstalledSensor {
    signal: SensorSignal,
    channel: SensorChannel,
    latest: Option<Measurement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObservedSample {
    pub signal: SensorSignal,
    pub measurement: Measurement,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct SensorSuite {
    pub installations: SensorInstallations,
    channels: Vec<InstalledSensor>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ObservationTruth {
    pub time_s: f64,
    pub state: TruthState,
    pub acceleration_body: [f64; 6],
}

impl ObservationTruth {
    fn at(previous: &Self, current: &Self, time_s: f64) -> Self {
        let duration = current.time_s - previous.time_s;
        let ratio = if duration > 0.0 {
            ((time_s - previous.time_s) / duration).clamp(0.0, 1.0)
        } else {
            1.0
        };
        let mut truth = current.clone();
        let mix = |first: f64, second: f64| first + ratio * (second - first);
        for axis in 0..3 {
            truth.state.position_ned[axis] = mix(
                previous.state.position_ned[axis],
                current.state.position_ned[axis],
            );
        }
        let sign = if previous
            .state
            .quaternion
            .iter()
            .zip(current.state.quaternion)
            .map(|(first, second)| first * second)
            .sum::<f64>()
            < 0.0
        {
            -1.0
        } else {
            1.0
        };
        truth.state.quaternion = normalize_quaternion(std::array::from_fn(|axis| {
            mix(
                previous.state.quaternion[axis],
                sign * current.state.quaternion[axis],
            )
        }));
        for axis in 0..6 {
            truth.state.body_velocity[axis] = mix(
                previous.state.body_velocity[axis],
                current.state.body_velocity[axis],
            );
            truth.acceleration_body[axis] = mix(
                previous.acceleration_body[axis],
                current.acceleration_body[axis],
            );
        }
        let first = &previous.state.actuator_states;
        let target = &mut truth.state.actuator_states;
        for (current, previous) in target
            .propeller_shaft_speed_rad_s
            .iter_mut()
            .zip(&first.propeller_shaft_speed_rad_s)
        {
            *current = mix(*previous, *current);
        }
        for (current, previous) in target
            .control_surface_angles_rad
            .iter_mut()
            .zip(&first.control_surface_angles_rad)
        {
            *current = mix(*previous, *current);
        }
        for (current, previous) in target
            .azimuth_angles_rad
            .iter_mut()
            .zip(&first.azimuth_angles_rad)
        {
            *current = previous + ratio * super::passive_observer::wrap_pi(*current - previous);
        }
        truth.time_s = time_s;
        truth
    }
}

impl SensorSuite {
    pub fn new(
        seed: u64,
        level: NoiseLevel,
        installations: SensorInstallations,
        shafts: usize,
        surfaces: usize,
    ) -> Result<Self, String> {
        if installations
            .gnss_body_m
            .iter()
            .chain(&installations.imu_body_m)
            .chain(&installations.speed_log_body_m)
            .chain(&installations.wind_body_m)
            .chain(std::iter::once(&installations.cg_waterline_height_m))
            .any(|value| !value.is_finite())
        {
            return Err("传感器安装坐标无效".into());
        }
        let mut definitions = vec![
            (SensorSignal::Heading, "heading_gyro", 0),
            (SensorSignal::YawRate, "yaw_rate", 1),
            (SensorSignal::North, "gnss_ne", 2),
            (SensorSignal::East, "gnss_ne", 3),
            (SensorSignal::SpeedLog, "speed_log", 4),
            (SensorSignal::RollRate, "imu_pq", 5),
            (SensorSignal::PitchRate, "imu_pq", 6),
            (SensorSignal::SpecificForceX, "imu_specific_force", 7),
            (SensorSignal::SpecificForceY, "imu_specific_force", 8),
            (SensorSignal::SpecificForceZ, "imu_specific_force", 9),
            (SensorSignal::WindSpeed, "wind_speed", 10),
            (SensorSignal::WindDirection, "wind_direction", 11),
        ];
        for index in 0..surfaces {
            definitions.push((
                SensorSignal::SurfaceEncoder(index),
                "encoder",
                100 + index as u64,
            ));
        }
        for index in 0..shafts {
            definitions.push((
                SensorSignal::AzimuthEncoder(index),
                "encoder",
                200 + index as u64,
            ));
            definitions.push((
                SensorSignal::ShaftSpeed(index),
                "shaft_speed",
                300 + index as u64,
            ));
        }
        let channels = definitions
            .into_iter()
            .map(|(signal, name, stream)| InstalledSensor {
                signal,
                channel: SensorChannel::new(name, channel_seed(seed, stream as usize), level)
                    .expect("固定传感器类型存在"),
                latest: None,
            })
            .collect();
        Ok(Self {
            installations,
            channels,
        })
    }

    pub fn set_faults(&mut self, heading_bias: bool, gnss_outage: bool) {
        for sensor in &mut self.channels {
            let fault = match sensor.signal {
                SensorSignal::Heading if heading_bias => {
                    Some(FaultKind::HeadingBiasRamp { t_start: 180.0 })
                }
                SensorSignal::North | SensorSignal::East if gnss_outage => {
                    Some(FaultKind::GnssOutage {
                        t_start: 180.0,
                        t_end: 200.0,
                    })
                }
                _ => None,
            };
            sensor.channel.set_fault(fault);
        }
    }

    pub fn latest(&self, signal: SensorSignal) -> Option<Measurement> {
        self.channels
            .iter()
            .find(|sensor| sensor.signal == signal)
            .and_then(|sensor| sensor.latest)
    }

    pub fn latest_samples(&self) -> Vec<ObservedSample> {
        self.channels.iter().filter_map(|sensor| sensor.latest.map(|measurement| ObservedSample {
            signal: sensor.signal, measurement,
        })).collect()
    }

    pub fn validate_checkpoint(&self, expected: &Self, time_s: f64) -> Result<(), String> {
        if self.channels.len() != expected.channels.len()
            || serde_json::to_string(&self.installations).ok()
                != serde_json::to_string(&expected.installations).ok()
        {
            return Err("恢复点的传感器布局不一致".into());
        }
        for (actual, expected) in self.channels.iter().zip(&expected.channels) {
            if actual.signal != expected.signal {
                return Err("恢复点的传感器通道不一致".into());
            }
            actual
                .channel
                .validate_checkpoint(&expected.channel, time_s)?;
            if actual.latest.is_some_and(|sample| {
                sample.t_arrive_s > time_s + 1e-8
                    || sample.t_sample_s > sample.t_arrive_s
                    || sample.t_sample_s < 0.0
                    || (!sample.value.is_finite() && sample.quality == Quality::Good)
            }) {
                return Err("恢复点的最近量测无效".into());
            }
        }
        Ok(())
    }

    pub fn valid_value(&self, signal: SensorSignal, time_s: f64) -> Option<f64> {
        let sensor = self
            .channels
            .iter()
            .find(|sensor| sensor.signal == signal)?;
        let sample = sensor.latest?;
        (sample.quality == Quality::Good
            && sample.value.is_finite()
            && time_s - sample.t_arrive_s <= 2.0 / sensor.channel.rate_hz() + 1e-9)
            .then_some(sample.value)
    }

    pub fn advance(
        &mut self,
        previous: &ObservationTruth,
        current: &ObservationTruth,
        environment: &EnvironmentState,
    ) -> Vec<ObservedSample> {
        let mut arrived = Vec::new();
        for sensor in &mut self.channels {
            let signal = sensor.signal;
            let samples = sensor.channel.advance_all(current.time_s, |time| {
                let truth = ObservationTruth::at(previous, current, time);
                ideal_measurement(signal, &self.installations, &truth, environment)
            });
            for measurement in samples {
                sensor.latest = Some(measurement);
                arrived.push(ObservedSample {
                    signal,
                    measurement,
                });
            }
        }
        arrived
    }
}

fn world_vector(rotation: &[[f64; 3]; 3], vector: [f64; 3]) -> [f64; 3] {
    std::array::from_fn(|axis| {
        (0..3)
            .map(|column| rotation[axis][column] * vector[column])
            .sum()
    })
}

fn body_vector(rotation: &[[f64; 3]; 3], vector: [f64; 3]) -> [f64; 3] {
    std::array::from_fn(|axis| (0..3).map(|row| rotation[row][axis] * vector[row]).sum())
}

pub fn ideal_measurement(
    signal: SensorSignal,
    installations: &SensorInstallations,
    truth: &ObservationTruth,
    environment: &EnvironmentState,
) -> (f64, f64) {
    let state = &truth.state;
    let velocity = state.body_velocity;
    let rotation = rotation_matrix(state.quaternion);
    let omega = [velocity[3], velocity[4], velocity[5]];
    let point_velocity = |lever| -> [f64; 3] {
        let rotational = moment_from_force(omega, lever);
        std::array::from_fn(|axis| velocity[axis] + rotational[axis])
    };
    let value = match signal {
        SensorSignal::Heading => euler_from_quaternion(state.quaternion).yaw_rad.to_degrees(),
        SensorSignal::YawRate => velocity[5].to_degrees(),
        SensorSignal::North | SensorSignal::East => {
            let axis = usize::from(signal == SensorSignal::East);
            state.position_ned[axis] + world_vector(&rotation, installations.gnss_body_m)[axis]
        }
        SensorSignal::RollRate => velocity[3].to_degrees(),
        SensorSignal::PitchRate => velocity[4].to_degrees(),
        SensorSignal::SpecificForceX
        | SensorSignal::SpecificForceY
        | SensorSignal::SpecificForceZ => {
            let axis = match signal {
                SensorSignal::SpecificForceX => 0,
                SensorSignal::SpecificForceY => 1,
                _ => 2,
            };
            let lever = installations.imu_body_m;
            let angular_acceleration = [
                truth.acceleration_body[3],
                truth.acceleration_body[4],
                truth.acceleration_body[5],
            ];
            let tangential = moment_from_force(angular_acceleration, lever);
            let centripetal = moment_from_force(omega, moment_from_force(omega, lever));
            let rotating_origin = moment_from_force(omega, [velocity[0], velocity[1], velocity[2]]);
            let gravity = body_vector(&rotation, [0.0, 0.0, 9.81]);
            truth.acceleration_body[axis]
                + rotating_origin[axis]
                + tangential[axis]
                + centripetal[axis]
                - gravity[axis]
        }
        SensorSignal::SpeedLog => {
            let point_offset = world_vector(&rotation, installations.speed_log_body_m);
            let mut water = if environment.switches.current_enabled {
                [environment.current_ned[0], environment.current_ned[1], 0.0]
            } else {
                [0.0; 3]
            };
            if environment.switches.wave_enabled {
                let orbital = environment.wave.orbital_velocity(
                    truth.time_s,
                    state.position_ned[0] + point_offset[0],
                    state.position_ned[1] + point_offset[1],
                    (installations.cg_waterline_height_m - state.position_ned[2] - point_offset[2])
                        .min(0.0),
                );
                for axis in 0..3 {
                    water[axis] += orbital[axis];
                }
            }
            point_velocity(installations.speed_log_body_m)[0] - body_vector(&rotation, water)[0]
        }
        SensorSignal::WindSpeed | SensorSignal::WindDirection => {
            let point = point_velocity(installations.wind_body_m);
            let wind = environment.wind.true_wind.velocity_ned();
            let local = body_vector(&rotation, [wind[0], wind[1], 0.0]);
            let relative = [local[0] - point[0], local[1] - point[1]];
            let speed = relative[0].hypot(relative[1]);
            return (
                if signal == SensorSignal::WindSpeed {
                    speed
                } else {
                    (-relative[1]).atan2(-relative[0]).to_degrees()
                },
                speed,
            );
        }
        SensorSignal::SurfaceEncoder(index) => {
            state.actuator_states.control_surface_angles_rad[index].to_degrees()
        }
        SensorSignal::AzimuthEncoder(index) => {
            state.actuator_states.azimuth_angles_rad[index].to_degrees()
        }
        SensorSignal::ShaftSpeed(index) => {
            state.actuator_states.propeller_shaft_speed_rad_s[index] * 30.0 / std::f64::consts::PI
        }
    };
    (value, 0.0)
}
