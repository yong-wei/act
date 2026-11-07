//! 六自由度动力学组装（issue-2153-p1 A1.2）。
//!
//! Fossen 结构（issue §2）：
//! `M_RB·ν̇ + C_RB(ν)ν + A_inf·ν̇_r + C_A(ν_r)ν_r + τ_radiation + g(η) = τ_ext`
//! 其中 `ν_r = ν − ν_current_body`，`ν̇_r = ν̇ − ν̇_current_body`。把 `A_inf·ν̇_r`
//! 移项后按质量阵求解：
//! `(M_RB + A_inf)·ν̇ = τ_ext − C_RB(ν)ν − C_A(ν_r)ν_r − τ_radiation − g(η) + A_inf·ν̇_current_body`
//!
//! 首版坐标约定：**体坐标原点取在重心**（`r_g = 0`）；CG 偏置体原点的参数包
//! 支持列入后续阶段。恢复项首版采用小幅线性恢复矩阵 `g(η) = K·Δη`（issue
//! §2.1「小幅线性恢复矩阵用于校核」）。
//!
//! Coriolis/向心力采用性质可证形式：
//! - `C_RB(ν)ν = [ m·(ω×ν_lin); ω×(I_g·ω) ]`（r_g=0），满足 `νᵀ·C_RB·ν = 0`
//! - `C_A(ν_r)ν_r = [ S(a)·ω_r ; S(a)·ν_r,lin + S(b)·ω_r ]`，
//!   `a = A₁₁ν_r,lin + A₁₂ω_r`、`b = A₂₁ν_r,lin + A₂₂ω_r`，
//!   满足 `νᵀ·C_A·ν = 0`（S 反对称 + 混合积性质）。

use super::state::{
    euler_from_quaternion, euler_rate_transform_inverse, quaternion_rate, rotation_matrix,
    TruthState,
};

/// 刚体参数（体原点=重心）。惯量关于重心，kg·m²。
#[derive(Debug, Clone, Copy)]
pub struct RigidBodyParams {
    pub mass_kg: f64,
    pub inertia_about_cg: [[f64; 3]; 3],
}

/// 附加质量与辐射首版参数。`a_inf` 对称正定（A1.2 单测校核）。
#[derive(Debug, Clone, Copy)]
pub struct AddedMassParams {
    pub a_inf: [[f64; 6]; 6],
}

/// 小幅线性恢复矩阵（N/m、N·m/rad），`g(η) = K·Δη`；`K` 对称。
#[derive(Debug, Clone, Copy)]
pub struct RestoringParams {
    pub k_linear: [[f64; 6]; 6],
}

/// 外力分项（N / N·m）。分项保留供力/力矩分项输出与载荷不重复校核（issue §7）。
#[derive(Debug, Clone, Copy, Default)]
pub struct ExternalForces {
    pub tau_hull_viscous: [f64; 6],
    pub tau_actuator: [f64; 6],
    pub tau_wind: [f64; 6],
    pub tau_wave_1: [f64; 6],
    pub tau_wave_2: [f64; 6],
    pub tau_special: [f64; 6],
}

impl ExternalForces {
    pub fn total(&self) -> [f64; 6] {
        let mut sum = [0.0; 6];
        for i in 0..6 {
            sum[i] = self.tau_hull_viscous[i]
                + self.tau_actuator[i]
                + self.tau_wind[i]
                + self.tau_wave_1[i]
                + self.tau_wave_2[i]
                + self.tau_special[i];
        }
        sum
    }
}

/// 环境流场（体坐标）：相对流速与其变化率（旋转坐标与时空变化流场均并入）。
#[derive(Debug, Clone, Copy, Default)]
pub struct CurrentFieldBody {
    pub nu_current_body: [f64; 6],
    pub nu_current_body_dot: [f64; 6],
}

fn cross(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

fn skew_mul(s_vector: [f64; 3], v: [f64; 3]) -> [f64; 3] {
    cross(s_vector, v)
}

/// 质量矩阵 `M = M_RB + A_inf`（6×6，对称；正定性由参数校核保障）。
pub fn mass_matrix(rb: &RigidBodyParams, am: &AddedMassParams) -> [[f64; 6]; 6] {
    let mut m = am.a_inf;
    for i in 0..3 {
        m[i][i] += rb.mass_kg;
    }
    for i in 0..3 {
        for j in 0..3 {
            m[3 + i][3 + j] += rb.inertia_about_cg[i][j];
        }
    }
    m
}

/// `C_RB(ν)·ν`（r_g = 0 形式；能量性质 `νᵀ·C_RB·ν = 0` 由单测保障）。
pub fn coriolis_centripetal_rb(rb: &RigidBodyParams, nu: [f64; 6]) -> [f64; 6] {
    let nu_lin = [nu[0], nu[1], nu[2]];
    let omega = [nu[3], nu[4], nu[5]];
    let i_omega = [
        rb.inertia_about_cg[0][0] * omega[0]
            + rb.inertia_about_cg[0][1] * omega[1]
            + rb.inertia_about_cg[0][2] * omega[2],
        rb.inertia_about_cg[1][0] * omega[0]
            + rb.inertia_about_cg[1][1] * omega[1]
            + rb.inertia_about_cg[1][2] * omega[2],
        rb.inertia_about_cg[2][0] * omega[0]
            + rb.inertia_about_cg[2][1] * omega[1]
            + rb.inertia_about_cg[2][2] * omega[2],
    ];
    let force = cross(omega, nu_lin).map(|value| rb.mass_kg * value);
    let torque = cross(omega, i_omega);
    [
        force[0], force[1], force[2],
        torque[0], torque[1], torque[2],
    ]
}

/// `C_A(ν_r)·ν_r`（性质可证形式；`νᵀ·C_A·ν = 0` 由单测保障）。
pub fn coriolis_added_mass(am: &AddedMassParams, nu_r: [f64; 6]) -> [f64; 6] {
    let nu_r_lin = [nu_r[0], nu_r[1], nu_r[2]];
    let omega_r = [nu_r[3], nu_r[4], nu_r[5]];
    let mut a_vec = [0.0f64; 3];
    let mut b_vec = [0.0f64; 3];
    for i in 0..3 {
        for j in 0..3 {
            a_vec[i] += am.a_inf[i][j] * nu_r[j];
            a_vec[i] += am.a_inf[i][3 + j] * omega_r[j];
            b_vec[i] += am.a_inf[3 + i][j] * nu_r_lin[j];
            b_vec[i] += am.a_inf[3 + i][3 + j] * omega_r[j];
        }
    }
    let force = skew_mul(a_vec, omega_r);
    let torque_lin = skew_mul(a_vec, nu_r_lin);
    let torque_omega = skew_mul(b_vec, omega_r);
    [
        force[0], force[1], force[2],
        torque_lin[0] + torque_omega[0],
        torque_lin[1] + torque_omega[1],
        torque_lin[2] + torque_omega[2],
    ]
}

/// 线性恢复 `g(η) = K·Δη`；`delta_eta = [dx, dy, dz, droll, dpitch, dyaw]`。
pub fn restoring_force(rp: &RestoringParams, delta_eta: [f64; 6]) -> [f64; 6] {
    let mut g = [0.0f64; 6];
    for i in 0..6 {
        for j in 0..6 {
            g[i] += rp.k_linear[i][j] * delta_eta[j];
        }
    }
    g
}

/// 6×6 线性求解（带部分主元的高斯消元）。矩阵被破坏性修改。
pub fn solve_linear_6(matrix: &mut [[f64; 6]; 6], mut rhs: [f64; 6]) -> [f64; 6] {
    for col in 0..6 {
        let mut pivot = col;
        let mut best = matrix[col][col].abs();
        for row in (col + 1)..6 {
            if matrix[row][col].abs() > best {
                best = matrix[row][col].abs();
                pivot = row;
            }
        }
        if best == 0.0 || !best.is_finite() {
            return [f64::NAN; 6];
        }
        if pivot != col {
            matrix.swap(col, pivot);
            rhs.swap(col, pivot);
        }
        let inv = 1.0 / matrix[col][col];
        for row in (col + 1)..6 {
            let factor = matrix[row][col] * inv;
            if factor == 0.0 {
                continue;
            }
            for j in col..6 {
                matrix[row][j] -= factor * matrix[col][j];
            }
            rhs[row] -= factor * rhs[col];
        }
    }
    let mut x = [0.0f64; 6];
    for row in (0..6).rev() {
        let mut acc = rhs[row];
        for j in (row + 1)..6 {
            acc -= matrix[row][j] * x[j];
        }
        x[row] = acc / matrix[row][row];
    }
    x
}

/// 一次动力学右端组装的输出：ν̇、η̇ 与力/力矩分项（对账与教学输出）。
#[derive(Debug, Clone, Copy)]
pub struct DynamicsOutput {
    pub nu_dot: [f64; 6],
    pub position_dot_ned: [f64; 3],
    pub quaternion_dot: [f64; 4],
    /// 欧拉角速率（显示层用；与四元数通路一致由单测保障）。
    pub euler_rates: [f64; 3],
    /// 分项力/力矩（质量阵左端各项移到右端后的值，N / N·m）。
    pub breakdown: ForceBreakdown,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct ForceBreakdown {
    pub coriolis_rb: [f64; 6],
    pub coriolis_added_mass: [f64; 6],
    pub radiation: [f64; 6],
    pub restoring: [f64; 6],
    pub current_inertia: [f64; 6],
    pub external: [f64; 6],
}

/// 组装并求解 ν̇（issue §2 动力学合同）。
#[allow(clippy::too_many_arguments)]
pub fn dynamics_step(
    state: &TruthState,
    rb: &RigidBodyParams,
    am: &AddedMassParams,
    rp: &RestoringParams,
    current: &CurrentFieldBody,
    tau_radiation: [f64; 6],
    delta_eta: [f64; 6],
    external: &ExternalForces,
) -> DynamicsOutput {
    let nu = state.body_velocity;
    let mut nu_r = [0.0f64; 6];
    for i in 0..6 {
        nu_r[i] = nu[i] - current.nu_current_body[i];
    }

    let c_rb = coriolis_centripetal_rb(rb, nu);
    let c_a = coriolis_added_mass(am, nu_r);
    let g = restoring_force(rp, delta_eta);
    let tau_ext = external.total();

    let mut current_inertia = [0.0f64; 6];
    for i in 0..6 {
        for j in 0..6 {
            current_inertia[i] += am.a_inf[i][j] * current.nu_current_body_dot[j];
        }
    }

    let mut rhs = [0.0f64; 6];
    for i in 0..6 {
        rhs[i] = tau_ext[i] - c_rb[i] - c_a[i] - tau_radiation[i] - g[i] + current_inertia[i];
    }

    let mut m = mass_matrix(rb, am);
    let nu_dot = solve_linear_6(&mut m, rhs);

    let r = rotation_matrix(state.quaternion);
    let position_dot = [
        r[0][0] * nu[0] + r[0][1] * nu[1] + r[0][2] * nu[2],
        r[1][0] * nu[0] + r[1][1] * nu[1] + r[1][2] * nu[2],
        r[2][0] * nu[0] + r[2][1] * nu[1] + r[2][2] * nu[2],
    ];
    let quaternion_dot = quaternion_rate(state.quaternion, [nu[3], nu[4], nu[5]]);
    let euler = euler_from_quaternion(state.quaternion);
    let euler_rates = euler_rate_transform_inverse(euler, [nu[3], nu[4], nu[5]]);

    DynamicsOutput {
        nu_dot,
        position_dot_ned: position_dot,
        quaternion_dot,
        euler_rates,
        breakdown: ForceBreakdown {
            coriolis_rb: c_rb,
            coriolis_added_mass: c_a,
            radiation: tau_radiation,
            restoring: g,
            current_inertia,
            external: tau_ext,
        },
    }
}
