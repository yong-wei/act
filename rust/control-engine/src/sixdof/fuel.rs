//! #2159的T级教学发动机曲线，输入来自实际桨扭矩和轴速。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FuelModel {
    pub rated_shaft_power_w: f64,
    pub auxiliary_power_w: f64,
    pub efficiency: f64,
    pub load_fractions: [f64; 5],
    pub sfoc_g_per_kwh: [f64; 5],
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Deserialize, Serialize)]
pub struct FuelState {
    pub fuel_kg: f64,
    pub positive_propeller_work_j: f64,
    pub negative_propeller_work_j: f64,
    pub engine_work_j: f64,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
pub struct FuelRates {
    pub signed_shaft_power_w: f64,
    pub load_fraction: f64,
    pub sfoc_g_per_kwh: f64,
    pub engine_power_w: f64,
    pub fuel_kg_per_s: f64,
    pub running: bool,
}

impl FuelState {
    pub fn values(self) -> [f64; 4] {
        [self.fuel_kg, self.positive_propeller_work_j, self.negative_propeller_work_j, self.engine_work_j]
    }

    pub fn from_values(values: &[f64]) -> Self {
        Self { fuel_kg: values[0], positive_propeller_work_j: values[1],
            negative_propeller_work_j: values[2], engine_work_j: values[3] }
    }
}

impl FuelModel {
    pub fn validate(&self) -> Result<(), String> {
        if !self.rated_shaft_power_w.is_finite() || self.rated_shaft_power_w <= 0.0
            || !self.auxiliary_power_w.is_finite() || self.auxiliary_power_w < 0.0
            || !self.efficiency.is_finite() || !(0.0..=1.0).contains(&self.efficiency) || self.efficiency == 0.0
            || self.load_fractions.iter().any(|value| !value.is_finite() || *value <= 0.0 || *value > 1.0)
            || self.load_fractions.windows(2).any(|pair| pair[0] >= pair[1])
            || self.load_fractions[4] != 1.0
            || self.sfoc_g_per_kwh.iter().any(|value| !value.is_finite() || *value <= 0.0)
        {
            return Err("教学发动机功率、效率或燃油曲线无效".into());
        }
        Ok(())
    }

    pub fn rates(&self, signed_shaft_power_w: f64, running: bool) -> FuelRates {
        let load = (signed_shaft_power_w.max(0.0)/self.rated_shaft_power_w)
            .clamp(self.load_fractions[0], 1.0);
        let upper = self.load_fractions.partition_point(|value| *value < load).clamp(1, 4);
        let fraction = (load-self.load_fractions[upper-1])
            /(self.load_fractions[upper]-self.load_fractions[upper-1]);
        let sfoc = self.sfoc_g_per_kwh[upper-1]
            +fraction*(self.sfoc_g_per_kwh[upper]-self.sfoc_g_per_kwh[upper-1]);
        // 低负载保持0.1额定轴功率的怠速消耗，2MW辅机与推进需求共同经过0.95效率。
        let engine_power = if running {
            (signed_shaft_power_w.max(self.load_fractions[0]*self.rated_shaft_power_w)
                +self.auxiliary_power_w)/self.efficiency
        } else { 0.0 };
        FuelRates { signed_shaft_power_w, load_fraction: load, sfoc_g_per_kwh: sfoc,
            engine_power_w: engine_power, fuel_kg_per_s: engine_power*sfoc/3.6e9, running }
    }
}
