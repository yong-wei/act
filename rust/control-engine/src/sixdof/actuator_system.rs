//! 七船执行器组，共用桨图谱、轴系、实际方位及有限翼载荷。
//! 参数为各船冻结包中的教学标称，实际状态属于TruthState。

use super::actuators::{PropellerInstallation, ServoModel, ventilation_factors_for_diameter};
use super::benchmark_b470::{advance_angle_beta, four_quadrant_coefficients, propeller_loads_b470};
use super::environment_state::EnvironmentState;
use super::state::{ActuatorStates, moment_from_force, rotation_matrix};

const TWO_PI: f64 = 2.0 * std::f64::consts::PI;
const SHAFT_STATE_LEN: usize = 8;

#[derive(Debug, Clone, serde::Deserialize)]
pub struct AzimuthServo {
    pub servo: ServoModel,
    /// 区间用[-π,π]表示，边界也属于禁区。
    pub forbidden_sectors_rad: Vec<[f64; 2]>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct Propulsor {
    pub installation: PropellerInstallation,
    pub diameter_m: f64,
    pub max_power_w: f64,
    pub rated_speed_rad_s: f64,
    pub motor_time_constant_s: f64,
    pub shaft_inertia_kg_m2: f64,
    pub reference_slew_rad_s2: f64,
    /// 轴速伺服的T级误差响应时间，前馈由同一桨图谱计算。
    pub speed_control_time_s: f64,
    /// 教学设备的额外推力上限，基础出力继续由实际四象限桨载荷产生。
    #[serde(default)]
    pub max_thrust_n: Option<f64>,
    pub azimuth: Option<AzimuthServo>,
}

impl Propulsor {
    pub fn rated_torque_nm(&self) -> f64 {
        self.max_power_w / self.rated_speed_rad_s
    }

    pub fn friction_torque_nm(&self, omega: f64) -> f64 {
        let rated = self.rated_torque_nm();
        0.01 * rated * (omega / 0.1).tanh()
            + 0.005 * rated * omega / self.rated_speed_rad_s
    }

    pub fn limited_motor_torque_nm(&self, target: f64, omega: f64) -> f64 {
        let torque = target.clamp(-1.2 * self.rated_torque_nm(), 1.2 * self.rated_torque_nm());
        if torque * omega > self.max_power_w {
            self.max_power_w / omega
        } else {
            torque
        }
    }
}

#[derive(Debug, Clone, Copy, serde::Deserialize)]
pub struct FinServoPower {
    pub mean_chord_m: f64,
    pub efficiency: f64,
    pub standby_w: f64,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ControlSurface {
    pub installation: PropellerInstallation,
    pub area_m2: f64,
    pub aspect_ratio: f64,
    /// 零角法向为+y的舵或+z的鳍，翼弦沿+x。
    pub normal_body: [f64; 3],
    pub servo: ServoModel,
    pub wake_propulsor: Option<usize>,
    pub normal_factor: f64,
    pub fin_servo_power: Option<FinServoPower>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ActuatorSystem {
    pub water_density_kg_m3: f64,
    #[serde(default)]
    pub max_positive_motor_power_w: Option<f64>,
    #[serde(default)]
    pub fuel_model: Option<super::fuel::FuelModel>,
    pub propulsors: Vec<Propulsor>,
    pub surfaces: Vec<ControlSurface>,
}

#[derive(Debug, Clone, Copy, Default, serde::Serialize, serde::Deserialize)]
pub struct ShaftCommand {
    pub speed_reference_rad_s: f64,
    pub motor_torque_override_nm: Option<f64>,
    pub azimuth_rad: f64,
    pub drive_cut: bool,
    pub azimuth_jammed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub engine_running: Option<bool>,
}

#[derive(Debug, Clone, Copy, Default, serde::Serialize, serde::Deserialize)]
pub struct SurfaceCommand {
    pub angle_rad: f64,
    pub jammed: bool,
    pub enabled: bool,
}

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct ActuatorCommands {
    pub shafts: Vec<ShaftCommand>,
    pub surfaces: Vec<SurfaceCommand>,
}

pub struct LocalWater<'a> {
    pub time_s: f64,
    pub position_ned: [f64; 3],
    pub quaternion: [f64; 4],
    pub relative_velocity: [f64; 6],
    pub environment: Option<&'a EnvironmentState>,
}

pub struct ActuatorEvaluation {
    pub loads: [f64; 6],
    pub motor_torques_nm: Vec<f64>,
    pub fuel: Option<super::fuel::FuelRates>,
}

impl LocalWater<'_> {
    fn at(&self, installation: &PropellerInstallation) -> ([f64; 3], f64) {
        let rotation = rotation_matrix(self.quaternion);
        let lever = installation.position_body_m;
        let mut point = self.position_ned;
        for axis in 0..3 {
            point[axis] += rotation[axis].iter().zip(lever)
                .map(|(component, offset)| component * offset).sum::<f64>();
        }
        let wave = self.environment.filter(|env| env.switches.wave_enabled);
        let elevation = wave.map(|env| env.wave.elevation(self.time_s, point[0], point[1]))
            .unwrap_or(0.0);
        let immersion = installation.immersion_depth(self.position_ned, self.quaternion, elevation);
        let nu = self.relative_velocity;
        let angular_velocity = [nu[3], nu[4], nu[5]];
        let rotational = moment_from_force(angular_velocity, lever);
        let mut velocity = [nu[0] + rotational[0], nu[1] + rotational[1], nu[2] + rotational[2]];
        if let Some(env) = wave {
            let orbital = env.wave.orbital_velocity(
                self.time_s, point[0], point[1], -(immersion - elevation).max(0.0),
            );
            for axis in 0..3 {
                velocity[axis] -= (0..3).map(|row| rotation[row][axis] * orbital[row]).sum::<f64>();
            }
        }
        (velocity, immersion)
    }
}

/// #2147固定有限翼曲线，角度可跨越正车/倒车。
pub fn finite_wing_coefficients(alpha: f64, aspect_ratio: f64) -> (f64, f64) {
    let absolute = alpha.abs();
    let blend = ((absolute - 15.0_f64.to_radians()) / 15.0_f64.to_radians()).clamp(0.0, 1.0);
    let stall_weight = blend * blend * (3.0 - 2.0 * blend);
    let slope = TWO_PI * aspect_ratio / (aspect_ratio + 2.0);
    let lift = (1.0 - stall_weight) * slope * alpha + stall_weight * 1.1 * (2.0 * alpha).sin();
    let drag = 0.01 + lift * lift / (std::f64::consts::PI * 0.85 * aspect_ratio)
        + 1.8 * alpha.sin().powi(2) * stall_weight;
    (lift, drag)
}

fn wrap_angle(angle: f64) -> f64 {
    (angle + std::f64::consts::PI).rem_euclid(TWO_PI) - std::f64::consts::PI
}

/// 返回不穿越禁区的最短路径。两侧均受阻时保持实际方位。
pub fn azimuth_path_error(actual: f64, target: f64, model: &AzimuthServo) -> Option<f64> {
    let limit = model.servo.max_angle_rad;
    let full_rotation = limit >= std::f64::consts::PI;
    let actual = if full_rotation { wrap_angle(actual) } else { actual };
    let target = if full_rotation { wrap_angle(target) } else { target.clamp(-limit, limit) };
    let base = if full_rotation { wrap_angle(target - actual) } else { target - actual };
    let mut candidates = vec![base];
    if full_rotation {
        candidates.extend([base - TWO_PI, base + TWO_PI]);
    }
    candidates.sort_by(|a, b| a.abs().total_cmp(&b.abs()));
    candidates.into_iter().find(|error| {
        let low = actual.min(actual + error);
        let high = actual.max(actual + error);
        let first_turn = (low / TWO_PI).floor() as i64 - 1;
        let last_turn = (high / TWO_PI).ceil() as i64 + 1;
        !model.forbidden_sectors_rad.iter().any(|sector| {
            (first_turn..=last_turn).any(|turn| {
                let offset = turn as f64 * TWO_PI;
                low <= sector[1] + offset && high >= sector[0] + offset
            })
        })
    })
}

fn servo_rate(model: &ServoModel, error: f64) -> f64 {
    (error / model.time_constant_s).clamp(-model.max_rate_rad_s, model.max_rate_rad_s)
}

fn add_load(total: &mut [f64; 6], position: [f64; 3], force: [f64; 3]) {
    let moment = moment_from_force(position, force);
    for axis in 0..3 {
        total[axis] += force[axis];
        total[axis + 3] += moment[axis];
    }
}

impl ActuatorSystem {
    pub fn validate(&self) -> Result<(), String> {
        if !self.water_density_kg_m3.is_finite() || self.water_density_kg_m3 <= 0.0 {
            return Err("执行器水密度须为有限正值".into());
        }
        if self.max_positive_motor_power_w.is_some_and(|value| !value.is_finite() || value <= 0.0) {
            return Err("推进系统正机械功率预算须为有限正值".into());
        }
        if let Some(fuel) = &self.fuel_model {
            fuel.validate()?;
            if self.propulsors.len() != 1
                || (fuel.rated_shaft_power_w-self.propulsors[0].max_power_w).abs() > 1e-8
            {
                return Err("教学发动机需要与冻结单轴额定功率一致".into());
            }
        }
        for propulsor in &self.propulsors {
            propulsor.installation.validate()?;
            let values = [propulsor.diameter_m, propulsor.max_power_w, propulsor.rated_speed_rad_s,
                propulsor.motor_time_constant_s, propulsor.shaft_inertia_kg_m2,
                propulsor.reference_slew_rad_s2, propulsor.speed_control_time_s];
            if values.iter().any(|value| !value.is_finite() || *value <= 0.0) {
                return Err("桨轴参数须为有限正值".into());
            }
            if propulsor.max_thrust_n.is_some_and(|value| !value.is_finite() || value <= 0.0) {
                return Err("推进器额外推力上限须为有限正值".into());
            }
            if let Some(azimuth) = &propulsor.azimuth {
                validate_servo(&azimuth.servo)?;
                if azimuth.forbidden_sectors_rad.iter().any(|sector| {
                    sector.iter().any(|value| !value.is_finite() || value.abs() > std::f64::consts::PI)
                        || sector[0] > sector[1]
                }) {
                    return Err("方位禁区须为[-π,π]内的有序区间".into());
                }
            }
        }
        for surface in &self.surfaces {
            surface.installation.validate()?;
            validate_servo(&surface.servo)?;
            if [surface.area_m2, surface.aspect_ratio, surface.normal_factor].iter()
                .any(|value| !value.is_finite() || *value <= 0.0)
                || ![[0.0, 1.0, 0.0], [0.0, 0.0, 1.0]].contains(&surface.normal_body)
                || surface.wake_propulsor.is_some_and(|index| index >= self.propulsors.len())
            {
                return Err("翼面几何或桨后流关联无效".into());
            }
            if let Some(power) = surface.fin_servo_power {
                if !power.mean_chord_m.is_finite() || power.mean_chord_m <= 0.0
                    || !power.efficiency.is_finite() || !(0.0..=1.0).contains(&power.efficiency)
                    || power.efficiency == 0.0 || !power.standby_w.is_finite() || power.standby_w < 0.0
                {
                    return Err("鳍伺服能耗参数无效".into());
                }
            }
        }
        Ok(())
    }

    pub fn state_len(&self) -> usize {
        SHAFT_STATE_LEN * self.propulsors.len() + 2 * self.surfaces.len()
            + if self.fuel_model.is_some() { 4 } else { 0 }
    }

    pub fn validate_state(&self, state: &ActuatorStates) -> Result<(), String> {
        let shaft_count = self.propulsors.len();
        let required = [
            (&state.propeller_shaft_speed_rad_s, shaft_count), (&state.motor_torques_nm, shaft_count),
            (&state.shaft_reference_speed_rad_s, shaft_count), (&state.azimuth_angles_rad, shaft_count),
            (&state.control_surface_angles_rad, self.surfaces.len()),
        ];
        let optional = [
            (&state.motor_torque_demand_nm, shaft_count),
            (&state.positive_motor_work_j, shaft_count), (&state.motor_work_j, shaft_count),
            (&state.propeller_work_j, shaft_count), (&state.shaft_friction_work_j, shaft_count),
            (&state.control_surface_work_j, self.surfaces.len()),
        ];
        if required.iter().any(|(values, count)| values.len() != *count)
            || optional.iter().any(|(values, count)| !values.is_empty() && values.len() != *count)
            || required.iter().chain(&optional).any(|(values, _)| values.iter().any(|value| !value.is_finite()))
        {
            return Err("执行器状态维度或数值无效".into());
        }
        if state.fuel.is_some() != self.fuel_model.is_some()
            || state.fuel.is_some_and(|fuel| fuel.values().iter().any(|value| !value.is_finite() || *value < 0.0))
        {
            return Err("教学燃油累计量或模型版本无效".into());
        }
        if self.max_positive_motor_power_w.is_some_and(|budget| {
            state.motor_torques_nm.iter().zip(&state.propeller_shaft_speed_rad_s)
                .map(|(torque, omega)| (torque * omega).max(0.0)).sum::<f64>() > budget * (1.0 + 1e-10)
        }) {
            return Err("实际轴系正机械功率超过系统预算".into());
        }
        for (index, model) in self.propulsors.iter().enumerate() {
            if state.shaft_reference_speed_rad_s[index].abs() > model.rated_speed_rad_s + 1e-9
                || state.propeller_shaft_speed_rad_s[index].abs() > model.rated_speed_rad_s + 1e-6
            {
                return Err("轴速参考超过冻结设备限制".into());
            }
        }
        for (index, model) in self.surfaces.iter().enumerate() {
            if state.control_surface_angles_rad[index].abs() > model.servo.max_angle_rad + 1e-9 {
                return Err("实际翼面角超出冻结设备限制".into());
            }
        }
        Ok(())
    }

    pub fn enforce_motor_limits(&self, state: &mut [f64]) -> Result<(), super::integrator::IntegrationError> {
        for (index, model) in self.propulsors.iter().enumerate() {
            let offset = SHAFT_STATE_LEN * index;
            if state[offset].abs() > model.rated_speed_rad_s + 1e-6 {
                return Err(super::integrator::IntegrationError::ActuatorConstraintInfeasible {
                    shaft_index: index, speed_rad_s: state[offset],
                });
            }
            state[offset + 1] = model.limited_motor_torque_nm(state[offset + 1], state[offset]);
        }
        Ok(())
    }

    pub fn validate_commands(&self, commands: &ActuatorCommands) -> Result<(), String> {
        if commands.shafts.len() != self.propulsors.len() || commands.surfaces.len() != self.surfaces.len() {
            return Err("执行器命令数量与冻结布局不符".into());
        }
        if self.fuel_model.is_none() && commands.shafts.iter().any(|command| command.engine_running.is_some()) {
            return Err("当前参数包没有教学发动机启停模型".into());
        }
        if commands.shafts.iter().any(|command| !command.speed_reference_rad_s.is_finite()
            || !command.azimuth_rad.is_finite()
            || command.motor_torque_override_nm.is_some_and(|value| !value.is_finite()))
            || commands.surfaces.iter().any(|command| !command.angle_rad.is_finite())
        {
            return Err("执行器命令含非有限值".into());
        }
        Ok(())
    }

    pub fn encode_state(&self, state: &ActuatorStates) -> Vec<f64> {
        let mut values = Vec::with_capacity(self.state_len());
        for index in 0..self.propulsors.len() {
            let motor_demand = if state.motor_torque_demand_nm.is_empty() {
                &state.motor_torques_nm
            } else { &state.motor_torque_demand_nm };
            for vector in [&state.propeller_shaft_speed_rad_s, motor_demand,
                &state.shaft_reference_speed_rad_s, &state.azimuth_angles_rad,
                &state.positive_motor_work_j, &state.motor_work_j,
                &state.propeller_work_j, &state.shaft_friction_work_j]
            {
                values.push(vector.get(index).copied().unwrap_or(0.0));
            }
        }
        for index in 0..self.surfaces.len() {
            values.push(state.control_surface_angles_rad.get(index).copied().unwrap_or(0.0));
            values.push(state.control_surface_work_j.get(index).copied().unwrap_or(0.0));
        }
        if self.fuel_model.is_some() {
            values.extend(state.fuel.unwrap_or_default().values());
        }
        values
    }

    pub fn decode_state(&self, values: &[f64]) -> ActuatorStates {
        let mut state = ActuatorStates::default();
        let motor_torques = self.delivered_motor_torques(values);
        for index in 0..self.propulsors.len() {
            let offset = SHAFT_STATE_LEN * index;
            let omega = values[offset];
            state.propeller_shaft_speed_rad_s.push(omega);
            state.motor_torques_nm.push(motor_torques[index]);
            state.motor_torque_demand_nm.push(values[offset + 1]);
            state.shaft_reference_speed_rad_s.push(values[offset + 2]);
            state.azimuth_angles_rad.push(values[offset + 3]);
            state.positive_motor_work_j.push(values[offset + 4]);
            state.motor_work_j.push(values[offset + 5]);
            state.propeller_work_j.push(values[offset + 6]);
            state.shaft_friction_work_j.push(values[offset + 7]);
        }
        let surface_offset = SHAFT_STATE_LEN * self.propulsors.len();
        for index in 0..self.surfaces.len() {
            state.control_surface_angles_rad.push(values[surface_offset + 2 * index]);
            state.control_surface_work_j.push(values[surface_offset + 2 * index + 1]);
        }
        if self.fuel_model.is_some() {
            state.fuel = Some(super::fuel::FuelState::from_values(&values[self.state_len()-4..]));
        }
        state
    }

    /// 正功率共享同一预算，负机械功保持独立，轴系和功积分使用同一实际扭矩。
    fn delivered_motor_torques(&self, state: &[f64]) -> Vec<f64> {
        let mut torques: Vec<_> = self.propulsors.iter().enumerate().map(|(index, model)| {
            let offset = SHAFT_STATE_LEN * index;
            model.limited_motor_torque_nm(state[offset + 1], state[offset])
        }).collect();
        if let Some(budget) = self.max_positive_motor_power_w {
            let positive: f64 = torques.iter().enumerate()
                .map(|(index, torque)| (torque * state[SHAFT_STATE_LEN * index]).max(0.0)).sum();
            let factor = (budget / positive.max(budget)).min(1.0);
            for (index, torque) in torques.iter_mut().enumerate() {
                if *torque * state[SHAFT_STATE_LEN * index] > 0.0 { *torque *= factor; }
            }
        }
        torques
    }

    /// 一个物理细步内轴速参考按固定斜率变化，不依赖渲染帧。
    pub fn reference_rates(&self, state: &[f64], commands: &ActuatorCommands, dt: f64) -> Vec<f64> {
        self.propulsors.iter().enumerate().map(|(index, model)| {
            let target = commands.shafts[index].speed_reference_rad_s
                .clamp(-model.rated_speed_rad_s, model.rated_speed_rad_s);
            ((target - state[SHAFT_STATE_LEN * index + 2]) / dt)
                .clamp(-model.reference_slew_rad_s2, model.reference_slew_rad_s2)
        }).collect()
    }

    /// 与刚体同一RK子阶段计算全部载荷和轴系/伺服/功的导数。
    pub fn derivatives(
        &self,
        state: &[f64],
        rates: &mut [f64],
        commands: &ActuatorCommands,
        reference_rates: &[f64],
        water: &LocalWater<'_>,
    ) -> ActuatorEvaluation {
        let mut total = [0.0; 6];
        let delivered_motors = self.delivered_motor_torques(state);
        let mut motor_torques_nm = Vec::with_capacity(self.propulsors.len());
        let mut thrusts = Vec::with_capacity(self.propulsors.len());
        let mut advance_velocities = Vec::with_capacity(self.propulsors.len());
        for (index, model) in self.propulsors.iter().enumerate() {
            let command = commands.shafts[index];
            let offset = SHAFT_STATE_LEN * index;
            let omega = state[offset];
            let reference = state[offset + 2];
            let azimuth = state[offset + 3];
            let axis = [azimuth.cos(), azimuth.sin(), 0.0];
            let (velocity, immersion) = water.at(&model.installation);
            let axial = velocity.iter().zip(axis).map(|(value, component)| value * component).sum();
            let (thrust_wet, torque_wet) = propeller_loads_b470(
                model.diameter_m, axial, omega / TWO_PI, self.water_density_kg_m3,
            );
            let beta = advance_angle_beta(axial, omega / TWO_PI, model.diameter_m);
            // 通气先验使用有界CT负载指标，轴停转时仍保持四象限水动力。
            let loading = four_quadrant_coefficients(beta).0;
            let factors = ventilation_factors_for_diameter(model.diameter_m, immersion, loading);
            let raw_thrust = thrust_wet * factors[0];
            let thrust = model.max_thrust_n.map_or(raw_thrust, |limit| raw_thrust.clamp(-limit, limit));
            let torque = torque_wet * factors[1];
            let friction = model.friction_torque_nm(omega);
            let mut motor = if command.engine_running == Some(false) { 0.0 } else { delivered_motors[index] };
            // 电流约束在固定物理步内限制主动加速，轴速由同一扭矩继续积分。
            // 流体驱动的不可控超速交由步进器报告不可行，轴动能保持可对账。
            let max_acceleration = (model.rated_speed_rad_s - omega) / super::integrator::NOMINAL_DT;
            let min_acceleration = (-model.rated_speed_rad_s - omega) / super::integrator::NOMINAL_DT;
            if motor > 0.0 {
                motor = motor.min((torque + friction + model.shaft_inertia_kg_m2 * max_acceleration).max(0.0));
            } else {
                motor = motor.max((torque + friction + model.shaft_inertia_kg_m2 * min_acceleration).min(0.0));
            }
            let (_, feedforward) = propeller_loads_b470(
                model.diameter_m, axial, reference / TWO_PI, self.water_density_kg_m3,
            );
            let requested_torque = command.motor_torque_override_nm.unwrap_or(
                feedforward * factors[1] + model.friction_torque_nm(reference)
                    + model.shaft_inertia_kg_m2 * (reference - omega) / model.speed_control_time_s,
            );
            let target_torque = if command.drive_cut || command.engine_running == Some(false) { 0.0 } else {
                model.limited_motor_torque_nm(requested_torque, omega)
            };
            rates[offset] = (motor - torque - friction) / model.shaft_inertia_kg_m2;
            rates[offset + 1] = (target_torque - state[offset + 1]) / model.motor_time_constant_s;
            rates[offset + 2] = reference_rates[index];
            rates[offset + 3] = if command.azimuth_jammed { 0.0 } else {
                model.azimuth.as_ref().and_then(|servo| {
                    azimuth_path_error(azimuth, command.azimuth_rad, servo)
                        .map(|error| servo_rate(&servo.servo, error))
                }).unwrap_or(0.0)
            };
            let motor_power = motor * omega;
            rates[offset + 4] = motor_power.max(0.0);
            rates[offset + 5] = motor_power;
            rates[offset + 6] = torque * omega;
            rates[offset + 7] = friction * omega;
            add_load(&mut total, model.installation.position_body_m,
                [axis[0] * thrust, axis[1] * thrust, 0.0]);
            thrusts.push(thrust);
            advance_velocities.push(axial);
            motor_torques_nm.push(motor);
        }
        let surface_offset = SHAFT_STATE_LEN * self.propulsors.len();
        for (index, surface) in self.surfaces.iter().enumerate() {
            let offset = surface_offset + 2 * index;
            let angle = state[offset];
            let command = commands.surfaces[index];
            let target = if command.enabled { command.angle_rad } else { 0.0 }
                .clamp(-surface.servo.max_angle_rad, surface.servo.max_angle_rad);
            let angle_rate = if command.jammed { 0.0 } else {
                servo_rate(&surface.servo, target - angle)
            };
            let (mut velocity, immersion) = water.at(&surface.installation);
            if let Some(propulsor_index) = surface.wake_propulsor {
                let propulsor = &self.propulsors[propulsor_index];
                let thrust = thrusts[propulsor_index];
                let axial = advance_velocities[propulsor_index];
                // 正车时艉侧舵位于桨射流下游，采用T级动量盘出口流速。
                // 反车射流朝艏，艉舵继续使用其实际局部反向来流。
                if thrust > 0.0 && axial >= 0.0 {
                    let area = std::f64::consts::PI * propulsor.diameter_m.powi(2) / 4.0;
                    velocity[0] += (axial * axial + 2.0 * thrust / (self.water_density_kg_m3 * area)).sqrt() - axial;
                }
            }
            let normal = surface.normal_body;
            let lateral = velocity.iter().zip(normal).map(|(value, component)| value * component).sum::<f64>();
            let speed = velocity[0].hypot(lateral);
            let alpha = angle + lateral.atan2(velocity[0]);
            let (lift_coefficient, drag_coefficient) = finite_wing_coefficients(alpha, surface.aspect_ratio);
            let fraction = immersed_surface_fraction(surface, angle, water.quaternion, immersion);
            let dynamic_area = 0.5 * self.water_density_kg_m3 * surface.area_m2 * fraction * speed * speed;
            let lift = dynamic_area * surface.normal_factor * lift_coefficient;
            let drag = dynamic_area * drag_coefficient;
            let force = if speed > 0.0 {
                let along = (-drag * velocity[0] + lift * lateral) / speed;
                let across = (-drag * lateral - lift * velocity[0]) / speed;
                [along, normal[1] * across, normal[2] * across]
            } else { [0.0; 3] };
            add_load(&mut total, surface.installation.position_body_m, force);
            rates[offset] = angle_rate;
            rates[offset + 1] = surface.fin_servo_power.map(|power| {
                let hinge = dynamic_area * power.mean_chord_m * 0.05 * alpha.sin();
                let standby = if command.enabled || angle_rate.abs() > 1e-12 { power.standby_w } else { 0.0 };
                (hinge * angle_rate).abs() / power.efficiency + standby
            }).unwrap_or(0.0);
        }
        let fuel = self.fuel_model.as_ref().map(|model| {
            let power = rates[6];
            let fuel = model.rates(power, commands.shafts[0].engine_running.unwrap_or(true));
            let offset = self.state_len()-4;
            rates[offset..offset+4].copy_from_slice(&[fuel.fuel_kg_per_s,
                power.max(0.0), (-power).max(0.0), fuel.engine_power_w]);
            fuel
        });
        ActuatorEvaluation { loads: total, motor_torques_nm, fuel }
    }
}

fn immersed_surface_fraction(surface: &ControlSurface, angle: f64, quaternion: [f64; 4], depth: f64) -> f64 {
    let rotation = rotation_matrix(quaternion);
    let normal = surface.normal_body;
    let span_direction = moment_from_force(normal, [1.0, 0.0, 0.0]);
    let chord_direction = [angle.cos(), -normal[1] * angle.sin(), -normal[2] * angle.sin()];
    let span = (surface.area_m2 * surface.aspect_ratio).sqrt();
    let chord = surface.area_m2 / span;
    let vertical_span = rotation[2].iter().zip(span_direction)
        .map(|(component, value)| component * value).sum::<f64>().abs() * span;
    let vertical_chord = rotation[2].iter().zip(chord_direction)
        .map(|(component, value)| component * value).sum::<f64>().abs() * chord;
    let height = vertical_span + vertical_chord;
    if height > 1e-12 { (0.5 + depth / height).clamp(0.0, 1.0) }
    else if depth > 0.0 { 1.0 } else { 0.0 }
}

fn validate_servo(servo: &ServoModel) -> Result<(), String> {
    if [servo.max_angle_rad, servo.max_rate_rad_s, servo.time_constant_s].iter()
        .any(|value| !value.is_finite() || *value <= 0.0)
    {
        return Err("伺服幅度、速率和时间常数须为有限正值".into());
    }
    Ok(())
}
