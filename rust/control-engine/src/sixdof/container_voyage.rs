//! #2159的6000m实际航次与同初末航速评价。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContainerVoyageConfiguration {
    pub segment_speeds_mps: [f64; 4],
}

impl ContainerVoyageConfiguration {
    pub fn validate(&self) -> Result<(), String> {
        if self
            .segment_speeds_mps
            .iter()
            .any(|speed| !speed.is_finite() || !(6.0..=12.0).contains(speed))
        {
            return Err("航次四段速度须为6至12米每秒".into());
        }
        Ok(())
    }

    pub fn reference_at(&self, actual_north_m: f64) -> f64 {
        let segment = ((actual_north_m.max(0.0) / 1500.0).floor() as usize).min(3);
        self.segment_speeds_mps[segment]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VoyageTerminationReason {
    Arrived,
    TimeLimit,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoyageTermination {
    pub reason: VoyageTerminationReason,
    pub time_s: f64,
    pub final_water_speed_mps: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContainerVoyageProgress {
    pub last_time_s: f64,
    pub north_m: f64,
    pub east_m: f64,
    pub maximum_cross_track_m: f64,
    pub maximum_roll_deg: f64,
    pub heading_reference_deg: f64,
    pub final_segment_heading_integral_deg_s: f64,
    pub final_segment_duration_s: f64,
    pub termination: Option<VoyageTermination>,
}

impl ContainerVoyageProgress {
    pub fn update(
        &mut self,
        time_s: f64,
        position_ned: [f64; 3],
        water_speed_mps: f64,
        heading_error_rad: f64,
        roll_rad: f64,
    ) -> Result<bool, String> {
        if [time_s, water_speed_mps, heading_error_rad, roll_rad]
            .iter()
            .chain(position_ned.iter())
            .any(|value| !value.is_finite())
            || time_s < self.last_time_s
            || self.termination.is_some()
        {
            return Err("航次物理位置、航速、姿态或时钟无效".into());
        }
        let dt = time_s - self.last_time_s;
        self.last_time_s = time_s;
        self.north_m = position_ned[0];
        self.east_m = position_ned[1];
        self.maximum_cross_track_m = self.maximum_cross_track_m.max(position_ned[1].abs());
        self.maximum_roll_deg = self.maximum_roll_deg.max(roll_rad.to_degrees().abs());
        if self.north_m >= 4500.0 {
            self.final_segment_heading_integral_deg_s +=
                super::passive_observer::wrap_pi(heading_error_rad)
                    .to_degrees()
                    .abs()
                    * dt;
            self.final_segment_duration_s += dt;
        }
        let reason = if self.north_m >= 6000.0 {
            Some(VoyageTerminationReason::Arrived)
        } else if time_s >= 1200.0 {
            Some(VoyageTerminationReason::TimeLimit)
        } else {
            None
        };
        self.termination = reason.map(|reason| VoyageTermination {
            reason,
            time_s,
            final_water_speed_mps: water_speed_mps,
        });
        Ok(self.termination.is_some())
    }

    pub fn mean_final_heading_error_deg(&self) -> f64 {
        self.final_segment_heading_integral_deg_s / self.final_segment_duration_s.max(1e-30)
    }

    pub fn eligible_for_fuel_comparison(&self) -> bool {
        self.termination.as_ref().is_some_and(|end| {
            end.reason == VoyageTerminationReason::Arrived
                && end.time_s <= 900.0
                && (end.final_water_speed_mps - 8.0).abs() <= 0.3
        }) && self.maximum_cross_track_m <= 50.0
            && self.mean_final_heading_error_deg() <= 2.0
    }

    pub fn validate_checkpoint(
        &self,
        time_s: f64,
        position_ned: [f64; 3],
        paused: bool,
    ) -> Result<(), String> {
        let values = [
            self.last_time_s,
            self.north_m,
            self.east_m,
            self.maximum_cross_track_m,
            self.maximum_roll_deg,
            self.heading_reference_deg,
            self.final_segment_heading_integral_deg_s,
            self.final_segment_duration_s,
        ];
        if values.iter().any(|value| !value.is_finite())
            || (self.last_time_s - time_s).abs() > 1e-8
            || !(0.0..=1200.0).contains(&time_s)
            || (self.north_m - position_ned[0]).abs() > 1e-8
            || (self.east_m - position_ned[1]).abs() > 1e-8
            || self.maximum_cross_track_m < self.east_m.abs()
            || self.maximum_roll_deg < 0.0
            || self.heading_reference_deg.abs() > 180.0
            || self.final_segment_heading_integral_deg_s < 0.0
            || self.final_segment_duration_s < 0.0
            || self.final_segment_duration_s > time_s + 1e-8
        {
            return Err("航次恢复点的累计量或位置无效".into());
        }
        match &self.termination {
            Some(end)
                if !paused
                    || !end.time_s.is_finite()
                    || !end.final_water_speed_mps.is_finite()
                    || (end.time_s - time_s).abs() > 1e-8
                    || (end.reason == VoyageTerminationReason::Arrived
                        && self.north_m < 6000.0)
                    || (end.reason == VoyageTerminationReason::TimeLimit
                        && (time_s < 1200.0 || self.north_m >= 6000.0)) =>
            {
                Err("航次终止条件与恢复点不一致".into())
            }
            None if self.north_m >= 6000.0 || time_s >= 1200.0 => {
                Err("航次恢复点缺少应有终止记录".into())
            }
            _ => Ok(()),
        }
    }
}
