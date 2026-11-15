//! 作业仪器继续复用统一传感器误差链。控制只读取已到达且有效的量测。

use super::dredger_mechanism::DredgerObservation;
use super::sensor::{channel_seed, Measurement, NoiseLevel, Quality, SensorChannel};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DredgerSignal {
    Depth,
    SwaySpeed,
    LadderAngle,
    CutterRpm,
    CableTension(usize),
    SpudForce,
    SpudContact,
    SpudTravel,
    WinchSpeed(usize),
    CableLength(usize),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DredgerSample {
    pub signal: DredgerSignal,
    pub measurement: Measurement,
}

#[derive(Clone, Serialize, Deserialize)]
struct InstalledSensor {
    signal: DredgerSignal,
    channel: SensorChannel,
    latest: Option<Measurement>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DredgerSensors {
    channels: Vec<InstalledSensor>,
    previous_time_s: f64,
    previous_observation: DredgerObservation,
}

fn value(signal: DredgerSignal, observation: &DredgerObservation) -> f64 {
    match signal {
        DredgerSignal::Depth => observation.depth_m,
        DredgerSignal::SwaySpeed => observation.cutter_sway_speed_mps,
        DredgerSignal::LadderAngle => observation.ladder_angle_deg,
        DredgerSignal::CutterRpm => observation.cutter_rpm,
        DredgerSignal::CableTension(index) => observation.cable_tension_n[index],
        DredgerSignal::SpudForce => observation.spud_reaction_n,
        DredgerSignal::SpudContact => observation.spud_contact_fraction,
        DredgerSignal::SpudTravel => observation.spud_vertical_travel_m,
        DredgerSignal::WinchSpeed(index) => observation.winch_speed_mps[index],
        DredgerSignal::CableLength(index) => observation.cable_length_m[index],
    }
}

impl DredgerSensors {
    pub fn new(seed: u64, level: NoiseLevel, observation: DredgerObservation) -> Self {
        let definitions = [
            (DredgerSignal::Depth, "dredge_depth"),
            (DredgerSignal::SwaySpeed, "dredge_sway"),
            (DredgerSignal::LadderAngle, "encoder"),
            (DredgerSignal::CutterRpm, "shaft_speed"),
            (DredgerSignal::CableTension(0), "dredge_tension"),
            (DredgerSignal::CableTension(1), "dredge_tension"),
            (DredgerSignal::SpudForce, "dredge_spud_force"),
            (DredgerSignal::SpudContact, "dredge_contact"),
            (DredgerSignal::SpudTravel, "dredge_length"),
            (DredgerSignal::WinchSpeed(0), "dredge_sway"),
            (DredgerSignal::WinchSpeed(1), "dredge_sway"),
            (DredgerSignal::CableLength(0), "dredge_length"),
            (DredgerSignal::CableLength(1), "dredge_length"),
        ];
        let channels = definitions
            .into_iter()
            .enumerate()
            .map(|(index, (signal, name))| InstalledSensor {
                signal,
                channel: SensorChannel::new(name, channel_seed(seed, 1000 + index), level)
                    .expect("已注册作业传感器"),
                latest: None,
            })
            .collect();
        let mut sensors = Self {
            channels,
            previous_time_s: 0.0,
            previous_observation: observation.clone(),
        };
        sensors.advance(0.0, &observation);
        sensors
    }

    pub fn advance(&mut self, time_s: f64, observation: &DredgerObservation) -> Vec<DredgerSample> {
        let mut arrived = vec![];
        let previous_time = self.previous_time_s;
        let elapsed = time_s - previous_time;
        for sensor in &mut self.channels {
            let previous = value(sensor.signal, &self.previous_observation);
            let current = value(sensor.signal, observation);
            for measurement in sensor.channel.advance_all(time_s, |sample_time| {
                let fraction = if elapsed > 0.0 {
                    ((sample_time - previous_time) / elapsed).clamp(0.0, 1.0)
                } else {
                    1.0
                };
                (previous + fraction * (current - previous), 0.0)
            }) {
                sensor.latest = Some(measurement);
                arrived.push(DredgerSample {
                    signal: sensor.signal,
                    measurement,
                });
            }
        }
        self.previous_time_s = time_s;
        self.previous_observation = observation.clone();
        arrived
    }

    pub fn valid_value(&self, signal: DredgerSignal, time_s: f64) -> Option<f64> {
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

    pub fn latest_samples(&self) -> Vec<DredgerSample> {
        self.channels
            .iter()
            .filter_map(|sensor| {
                sensor.latest.map(|measurement| DredgerSample {
                    signal: sensor.signal,
                    measurement,
                })
            })
            .collect()
    }

    pub fn validate_checkpoint(&self, expected: &Self, time_s: f64) -> Result<(), String> {
        if self.channels.len() != expected.channels.len()
            || !self.previous_time_s.is_finite()
            || (self.previous_time_s - time_s).abs() > 1e-8
        {
            return Err("作业传感器恢复点的通道或时钟不一致".into());
        }
        for (actual, expected) in self.channels.iter().zip(&expected.channels) {
            if actual.signal != expected.signal {
                return Err("作业传感器恢复点的通道次序不一致".into());
            }
            actual
                .channel
                .validate_checkpoint(&expected.channel, time_s)?;
            if actual.latest.is_some_and(|sample| {
                sample.t_arrive_s > time_s + 1e-8
                    || sample.t_sample_s < 0.0
                    || sample.t_sample_s > sample.t_arrive_s
                    || (sample.quality == Quality::Good && !sample.value.is_finite())
            }) {
                return Err("作业传感器恢复点的最近量测无效".into());
            }
        }
        Ok(())
    }
}
