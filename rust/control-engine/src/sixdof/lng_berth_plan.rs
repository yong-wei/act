//! 靠泊速度计划以导航估计的船艏距离为自变量，保持速度PI与轴系连续。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeedPlanNode {
    pub distance_m: f64,
    pub speed_mps: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeadingPlanNode {
    pub time_s: f64,
    pub heading_deg: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BerthSpeedPlan {
    pub braking_distance_m: f64,
    pub nodes: Vec<SpeedPlanNode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub heading_nodes: Option<Vec<HeadingPlanNode>>,
}

impl BerthSpeedPlan {
    pub fn validate(&self) -> Result<(), String> {
        if !self.braking_distance_m.is_finite()
            || !(300.0..=1500.0).contains(&self.braking_distance_m)
            || self.nodes.is_empty()
            || self.nodes.len() > 4
            || self.nodes.iter().any(|node| {
                !node.distance_m.is_finite()
                    || !node.speed_mps.is_finite()
                    || !(0.0..self.braking_distance_m).contains(&node.distance_m)
                    || !(0.0..=4.0).contains(&node.speed_mps)
            })
            || self
                .nodes
                .windows(2)
                .any(|pair| pair[0].distance_m <= pair[1].distance_m)
        {
            return Err("靠泊计划需要300至1500m减速起点及按距离递减的1至4个速度节点".into());
        }
        if self.heading_nodes.as_ref().is_some_and(|nodes| nodes.is_empty() || nodes.len() > 4
            || nodes[0].time_s != 0.0
            || nodes.iter().any(|node| !node.time_s.is_finite() || !(0.0..=1200.0).contains(&node.time_s)
                || !node.heading_deg.is_finite() || !(-30.0..=30.0).contains(&node.heading_deg))
            || nodes.windows(2).any(|pair| pair[0].time_s >= pair[1].time_s)) {
            return Err("转向计划需要从0秒开始、时间递增的1至4个航向节点，航向为正负30度".into());
        }
        Ok(())
    }

    pub fn heading_reference_deg(&self, time_s: f64) -> Option<f64> {
        let nodes = self.heading_nodes.as_ref()?;
        let mut previous = nodes.first()?;
        for next in &nodes[1..] {
            if time_s <= next.time_s {
                let weight = ((time_s - previous.time_s) / (next.time_s - previous.time_s)).clamp(0.0, 1.0);
                return Some(previous.heading_deg + weight * (next.heading_deg - previous.heading_deg));
            }
            previous = next;
        }
        Some(previous.heading_deg)
    }

    pub fn reference_mps(&self, bow_distance_m: f64) -> Result<f64, String> {
        self.validate()?;
        if !bow_distance_m.is_finite() {
            return Err("靠泊计划缺少有效导航距离".into());
        }
        let mut previous_distance = self.braking_distance_m;
        let mut previous_speed = 4.0;
        for node in &self.nodes {
            if bow_distance_m >= node.distance_m {
                let weight = ((previous_distance - bow_distance_m)
                    / (previous_distance - node.distance_m))
                    .clamp(0.0, 1.0);
                return Ok(previous_speed + weight * (node.speed_mps - previous_speed));
            }
            previous_distance = node.distance_m;
            previous_speed = node.speed_mps;
        }
        Ok(previous_speed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plan_is_continuous_and_respects_frozen_nodes() {
        let plan = BerthSpeedPlan {
            braking_distance_m: 1200.0,
            heading_nodes: None,
            nodes: vec![
                SpeedPlanNode {
                    distance_m: 600.0,
                    speed_mps: 2.0,
                },
                SpeedPlanNode {
                    distance_m: 30.0,
                    speed_mps: 0.0,
                },
            ],
        };
        assert_eq!(plan.reference_mps(1500.0).unwrap(), 4.0);
        assert_eq!(plan.reference_mps(900.0).unwrap(), 3.0);
        assert_eq!(plan.reference_mps(600.0).unwrap(), 2.0);
        assert_eq!(plan.reference_mps(30.0).unwrap(), 0.0);
        assert_eq!(plan.reference_mps(-1.0).unwrap(), 0.0);
        assert!(
            (plan.reference_mps(600.0 + 1e-6).unwrap() - plan.reference_mps(600.0 - 1e-6).unwrap())
                .abs()
                < 1e-8
        );
        let mut invalid = plan;
        invalid.nodes[1].distance_m = 600.0;
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn heading_nodes_are_continuous_and_old_speed_plans_keep_their_serialization() {
        let mut plan = BerthSpeedPlan {braking_distance_m:1200.0,
            nodes:vec![SpeedPlanNode {distance_m:30.0,speed_mps:0.0}],heading_nodes:None};
        assert!(!serde_json::to_string(&plan).unwrap().contains("headingNodes"));
        plan.heading_nodes = Some(vec![HeadingPlanNode {time_s:0.0,heading_deg:-9.0},
            HeadingPlanNode {time_s:200.0,heading_deg:-9.0},HeadingPlanNode {time_s:400.0,heading_deg:0.0}]);
        plan.validate().unwrap();
        assert_eq!(plan.heading_reference_deg(100.0),Some(-9.0));
        assert_eq!(plan.heading_reference_deg(300.0),Some(-4.5));
        assert_eq!(plan.heading_reference_deg(600.0),Some(0.0));
        plan.heading_nodes.as_mut().unwrap()[1].time_s = 0.0;
        assert!(plan.validate().is_err());
    }
}
