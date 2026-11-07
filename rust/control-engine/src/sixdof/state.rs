//! TruthState 与六自由度运动学（issue-2153-p1 A1.1）。
//!
//! 状态布局（SI 单位，FRD 体坐标 / NED 世界坐标）：
//! - `position_ned`: 北东地位置 [N, E, D] m
//! - `quaternion`: 姿态单位四元数 `[w, x, y, z]`（NED←FRD，w 为标量分量）
//! - `body_velocity`: 体坐标六自由度速度 `[u, v, w, p, q, r]`
//!   （纵向/横荡/垂荡 m/s，横摇/纵摇/艏摇角速度 rad/s）
//! - `radiation_states`: 辐射记忆状态空间（由 radiation 模块定义维数）
//! - `actuator_states`: 执行器物理状态（桨轴转速 rad/s、舵/鳍/吊舱实际角 rad）
//! - `specialist_states`: 专属子系统状态（冰接触、钢桩、液舱等，按船定义）

use serde::{Deserialize, Serialize};

/// 执行器物理状态：命令与实际分离，载荷使用实际值（issue §2.2/§3）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct ActuatorStates {
    /// 各桨轴转速 rad/s（正进速方向），由轴动力学 `J_s·ω̇ = Q_motor − Q_prop − Q_friction` 演化。
    pub propeller_shaft_speed_rad_s: Vec<f64>,
    /// 舵/鳍/吊舱实际角度 rad（一阶伺服 + 幅值/速率限幅后的值）。
    pub control_surface_angles_rad: Vec<f64>,
    /// 预留：推进器方位角（全回转吊舱/DP）rad。
    pub azimuth_angles_rad: Vec<f64>,
}

/// TruthPlant 完整状态。`quaternion` 恒为单位四元数（积分后须归一化）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct TruthState {
    pub position_ned: [f64; 3],
    pub quaternion: [f64; 4],
    pub body_velocity: [f64; 6],
    pub radiation_states: Vec<f64>,
    pub actuator_states: ActuatorStates,
    pub specialist_states: Vec<f64>,
}

/// ZYX（偏航-纵摇-横摇）欧拉角，学生显示层使用；内核角度一律 rad。
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Euler {
    pub roll_rad: f64,
    pub pitch_rad: f64,
    pub yaw_rad: f64,
}

/// 归一化为单位四元数；零范数输入回退到单位四元数（并保持 [w,x,y,z] 顺序）。
pub fn normalize_quaternion(q: [f64; 4]) -> [f64; 4] {
    let norm = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt();
    if !(norm > 0.0) || !norm.is_finite() {
        return [1.0, 0.0, 0.0, 0.0];
    }
    let inv = 1.0 / norm;
    [q[0] * inv, q[1] * inv, q[2] * inv, q[3] * inv]
}

/// 四元数 → 旋转矩阵 R（体→世界，NED←FRD），行主序 `[[f64;3];3]`。
pub fn rotation_matrix(q: [f64; 4]) -> [[f64; 3]; 3] {
    let [w, x, y, z] = normalize_quaternion(q);
    [
        [1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y - w * z), 2.0 * (x * z + w * y)],
        [2.0 * (x * y + w * z), 1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z - w * x)],
        [2.0 * (x * z - w * y), 2.0 * (y * z + w * x), 1.0 - 2.0 * (x * x + y * y)],
    ]
}

/// 四元数 → ZYX 欧拉角（roll、pitch、yaw，rad）。
pub fn euler_from_quaternion(q: [f64; 4]) -> Euler {
    let [w, x, y, z] = normalize_quaternion(q);
    let sinr_cosp = 2.0 * (w * x + y * z);
    let cosr_cosp = 1.0 - 2.0 * (x * x + y * y);
    let roll = sinr_cosp.atan2(cosr_cosp);
    let sinp = 2.0 * (w * y - z * x);
    let pitch = if sinp.abs() >= 1.0 {
        sinp.clamp(-1.0, 1.0).asin()
    } else {
        sinp.asin()
    };
    let siny_cosp = 2.0 * (w * z + x * y);
    let cosy_cosp = 1.0 - 2.0 * (y * y + z * z);
    let yaw = siny_cosp.atan2(cosy_cosp);
    Euler { roll_rad: roll, pitch_rad: pitch, yaw_rad: yaw }
}

/// 体角速度四元数运动学：`q̇ = ½ Ω(ω_body) q`，ω 为体坐标 [p, q, r] rad/s。
pub fn quaternion_rate(q: [f64; 4], omega_body: [f64; 3]) -> [f64; 4] {
    let [w, x, y, z] = q;
    let [p, qq, r] = omega_body;
    // Ω(ω) 作用于四元数向量部分（体坐标右乘约定，Fossen 2021 §2.2）：
    // q̇ = ½ · q ⊗ [0, ω_body]
    [
        0.5 * (-x * p - y * qq - z * r),
        0.5 * (w * p + y * r - z * qq),
        0.5 * (w * qq - x * r + z * p),
        0.5 * (w * r + x * qq - y * p),
    ]
}

/// 欧拉角速率变换的逆：体角速度 → ZYX 欧拉角速率 `[rollDot, pitchDot, yawDot]`。
/// 奇异姿态（pitch = ±90°）按 gimbal-lock 语义返回有限近似（roll 率并入 yaw 率）。
pub fn euler_rate_transform_inverse(euler: Euler, omega_body: [f64; 3]) -> [f64; 3] {
    let [p, q, r] = omega_body;
    let (sin_roll, cos_roll) = euler.roll_rad.sin_cos();
    let (sin_pitch, cos_pitch) = euler.pitch_rad.sin_cos();
    if cos_pitch.abs() < 1e-9 {
        // 万向锁：横摇率并入艏摇率，避免除零。
        return [0.0, q, p + r];
    }
    let tan_pitch = sin_pitch / cos_pitch;
    [
        p + q * sin_roll * tan_pitch + r * cos_roll * tan_pitch,
        q * cos_roll - r * sin_roll,
        (q * sin_roll + r * cos_roll) / cos_pitch,
    ]
}

/// `J(eta)`：六自由度体→世界速度变换（欧拉显示形态）。
/// 位置行 = R(q)·v_body；角速度行 = T(Θ)⁻¹·ω_body。行主序 6×6。
pub fn jacobian_eta(q: [f64; 4], euler: Euler) -> [[f64; 6]; 6] {
    let r = rotation_matrix(q);
    let (sin_roll, cos_roll) = euler.roll_rad.sin_cos();
    let (sin_pitch, cos_pitch) = euler.pitch_rad.sin_cos();
    let t_inv = if cos_pitch.abs() < 1e-9 {
        // 万向锁：与 euler_rate_transform_inverse 同语义（roll 率归零并入 yaw 率）。
        [[0.0, 0.0, 0.0], [0.0, 1.0, 0.0], [1.0, 0.0, 0.0]]
    } else {
        let sec_pitch = 1.0 / cos_pitch;
        let tan_pitch = sin_pitch * sec_pitch;
        [
            [1.0, sin_roll * tan_pitch, cos_roll * tan_pitch],
            [0.0, cos_roll, -sin_roll],
            [0.0, sin_roll * sec_pitch, cos_roll * sec_pitch],
        ]
    };
    let mut j = [[0.0f64; 6]; 6];
    for row in 0..3 {
        for col in 0..3 {
            j[row][col] = r[row][col];
            j[3 + row][3 + col] = t_inv[row][col];
        }
    }
    j
}

/// 统一 `r × F` 载荷力矩助手（issue §2：不在多个组件手写符号）。
/// `r_body` 作用点到重心矢量 m，`f_body` 力 N，返回体坐标力矩 N·m。
pub fn moment_from_force(r_body: [f64; 3], f_body: [f64; 3]) -> [f64; 3] {
    [
        r_body[1] * f_body[2] - r_body[2] * f_body[1],
        r_body[2] * f_body[0] - r_body[0] * f_body[2],
        r_body[0] * f_body[1] - r_body[1] * f_body[0],
    ]
}

/// 3×3 对称正定判定（Cholesky 试探；不对称或非正定返回 false）。质量阵校核用。
pub fn symmetric_positive_definite_3(m: &[[f64; 3]; 3]) -> bool {
    let mut a = *m;
    for i in 0..3 {
        for j in 0..i {
            if (a[i][j] - a[j][i]).abs() > 1e-12 * (a[i][j].abs() + a[j][i].abs() + 1.0) {
                return false;
            }
        }
    }
    for k in 0..3 {
        if !(a[k][k] > 0.0) || !a[k][k].is_finite() {
            return false;
        }
        let d = a[k][k].sqrt();
        for j in (k + 1)..3 {
            a[k][j] /= d; // 行归一 L[k][j]
        }
        for i in (k + 1)..3 {
            let f = a[i][k] / d;
            a[i][k] = f;
            for j in (k + 1)..3 {
                a[i][j] -= f * a[k][j]; // Schur：L[i][k]·L[j][k]
            }
        }
    }
    true
}

/// 6×6 对称正定判定（质量矩阵 `M_RB + A_inf` 校核，issue 验收门槛三）。
pub fn symmetric_positive_definite_6(m: &[[f64; 6]; 6]) -> bool {
    let mut a = *m;
    for i in 0..6 {
        for j in 0..i {
            if (a[i][j] - a[j][i]).abs() > 1e-12 * (a[i][j].abs() + a[j][i].abs() + 1.0) {
                return false;
            }
        }
    }
    for k in 0..6 {
        if !(a[k][k] > 0.0) || !a[k][k].is_finite() {
            return false;
        }
        let d = a[k][k].sqrt();
        for j in (k + 1)..6 {
            a[k][j] /= d; // 行归一 L[k][j]
        }
        for i in (k + 1)..6 {
            let f = a[i][k] / d;
            a[i][k] = f;
            for j in (k + 1)..6 {
                a[i][j] -= f * a[k][j]; // Schur：L[i][k]·L[j][k]
            }
        }
    }
    true
}
