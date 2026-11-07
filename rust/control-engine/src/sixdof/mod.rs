//! Six-DOF TruthPlant 内核（issue-2153-p1 阶段 A）。
//!
//! 结构见 change `issue-2153-p1` design.md：state（状态与运动学）、dynamics
//! （Fossen 六自由度组装）、hull_mmg（MMG + 低速连续载荷）、actuators
//! （桨轴/舵/鳍/吊舱物理）、radiation（被动稳定辐射状态空间）、sensor
//! （采样/噪声/时延通道）、integrator（RK4 + 接触细分）。
//!
//! 单位合同：角度 rad、质量 kg、力 N、力矩 N·m、功率 W、时间 s；
//! 坐标合同：FRD 体坐标（x 艏、y 右舷、z 向下），NED 世界坐标。

pub mod dynamics;
pub mod integrator;
pub mod radiation;
pub mod state;

pub use radiation::{RadiationMode, RadiationModel, RadiationModelError};
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
