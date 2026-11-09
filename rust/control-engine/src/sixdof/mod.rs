//! Six-DOF TruthPlant 内核（issue-2153-p1 阶段 A）。
//!
//! 结构见 change `issue-2153-p1` design.md：state（状态与运动学）、dynamics
//! （Fossen 六自由度组装）、hull_mmg（MMG + 低速连续载荷）、actuators
//! （桨轴/舵/鳍/吊舱物理）、radiation（被动稳定辐射状态空间）、sensor
//! （采样/噪声/时延通道）、integrator（RK4 + 接触细分）。
//!
//! 单位合同：角度 rad、质量 kg、力 N、力矩 N·m、功率 W、时间 s；
//! 坐标合同：FRD 体坐标（x 艏、y 右舷、z 向下），NED 世界坐标。

pub mod actuators;
pub mod control_law;
pub mod destroyer_plant;
pub mod dynamics;
pub mod environment_state;
pub mod observer;
pub mod qtf;
pub mod benchmark_b470;
pub mod benchmark_s175;
pub mod shear;
pub mod tank_sloshing;
pub mod hull_mmg;
pub mod integrator;
pub mod model_pack;
pub mod radiation;
pub mod sensor;
pub mod wave;
pub mod wind;
pub mod state;
pub mod student_model;
pub mod vessel_runtime;

pub use destroyer_plant::{DestroyerCommands, DestroyerSixDofConfig, DestroyerSixDofPlant};
pub use control_law::{
    HeadingControlMode, HeadingControlOutput, HeadingPidGains, command_rudder_deg, wrap_180,
    DEFAULT_RUDDER_LIMIT_DEG,
};
pub use actuators::{
    PropellerModel, PropellerShaft, ServoModel, clamp_motor_torque, clamp_shaft_speed,
    propeller_loads, propeller_loads_with_ventilation, servo_step, shaft_acceleration,
    shaft_friction, shaft_power, ventilation_loss_factors,
};
pub use environment_state::{EnvironmentState, EnvironmentSwitches};
pub use student_model::{
    ComparisonMode, EvaluationMetrics, ModelStructure, StudentModel, angle_error,
    evaluate, evaluate_with_input, identify_dp_low_freq, identify_dredge_channel,
    identify_fopdt, identify_nomoto1, identify_nomoto2, identify_roll_oscillator,
    overshoot_percent, predict, predict_dp, settling_time,
    wrap_angle, COMPARISON_LABELS,
};
pub use vessel_runtime::compute_vessel_sixdof_step_json;
pub use observer::{LowFrequencyObserver, ObservationChain};
pub use sensor::{FaultKind, Measurement, NoiseLevel, Quality, SensorChannel, SEEDS_VALIDATION, SEED_TRAINING, channel_seed};
pub use wave::{WaveCondition, WaveField};
pub use qtf::{MeanDriftTable, TableProvenance, newman_difference_loads, newman_mean_loads};
pub use shear::ShearCurrentField;
pub use tank_sloshing::{SloshingMode, TankSloshing};
pub use wind::{GustProcess, TrueWind, WindEnvironment, WindHullGeometry, fujiwara_loads, relative_wind_body};
pub use radiation::{RadiationMode, RadiationModel, RadiationModelError};
pub use hull_mmg::{
    HullMmgParams, LowSpeedParams, blended_hull_loads, low_speed_loads, mmg_hull_loads,
    transition_weight,
};
pub use model_pack::{PackError, PackModel, embedded_destroyer_055, load_model_pack};
pub use integrator::{
    advance_nominal_step, contact_substep_count, rk4_step, ContactStiffness,
    IntegrationError, MIN_DT, NOMINAL_DT,
};
pub use dynamics::{
    AddedMassParams, CurrentFieldBody, DynamicsOutput, ExternalForces, ForceBreakdown,
    RigidBodyParams, RestoringParams, coriolis_added_mass, coriolis_centripetal_rb,
    dynamics_step, mass_matrix, restoring_force, solve_linear_6,
};
pub use state::{
    ActuatorStates, Euler, TruthState, euler_from_quaternion, euler_rate_transform_inverse,
    jacobian_eta, moment_from_force, normalize_quaternion, quaternion_rate, rotation_matrix,
    symmetric_positive_definite_3, symmetric_positive_definite_6,
};
