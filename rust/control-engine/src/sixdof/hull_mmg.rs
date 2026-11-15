//! 船体 MMG 载荷与低速连续模型（issue-2153-p1 A1.3）。
//!
//! 合同（issue §2.1）：
//! - 高速段：MMG 船体/桨/舵分离结构的三次项黏性/准定常力（导数由参数包
//!   提供，本模块只定义结构与符号约定）；
//! - 低速/零速/侧移/倒航：cross-flow 横向阻力 + 二次纵向阻力连续模型，
//!   禁止 `U=max(U,0.1)` 掩盖奇异；
//! - 过渡：|u| 在 1–3 m/s 之间 smoothstep 加权**混合两个完整模型**
//!   （`τ = w·τ_mmg + (1−w)·τ_low`），加权平均而非叠加，杜绝重复阻力；
//! - 横荡—艏摇载荷按垂向作用点 `z_h` 产生横摇力矩（`r×F` 语义）。
//!
//! 本模块输出 6 通道中的水平三通道（surge/sway/yaw）与耦合横摇
//! （heave/pitch 恢复由 dynamics 的恢复矩阵承担）。

/// MMG 船体黏性导数（参数包 P/B/D 级来源；S.I. 单位化为系数形式）。
#[derive(Debug, Clone, Copy)]
pub struct HullMmgParams {
    /// 纵向：`X(u) = Xuu·u|u| + Xu·u`（含阻力与线性项）。
    pub x_uu: f64,
    pub x_u: f64,
    /// 横向三次组合：`Y(v,r) = Yv·v + Yvv·v|v| + Yvr·v|r| + Yr·r + Yrr·r|r|`。
    pub y_v: f64,
    pub y_vv: f64,
    pub y_vr: f64,
    pub y_r: f64,
    pub y_rr: f64,
    /// 艏摇：`N(v,r) = Nv·v + Nvv·v|v| + Nvr·v|r| + Nr·r + Nrr·r|r|`。
    pub n_v: f64,
    pub n_vv: f64,
    pub n_vr: f64,
    pub n_r: f64,
    pub n_rr: f64,
    /// 横荡/艏摇合力的垂向作用点（FRD z，水下为负）。
    pub z_h: f64,
}

/// 低速 cross-flow 模型参数。
#[derive(Debug, Clone, Copy)]
pub struct LowSpeedParams {
    /// 横向 cross-flow 阻力系数（`F_y = −0.5·ρ·CD·L·T·v|v|` 的折算系数）。
    pub crossflow_y: f64,
    /// 低速纵向二次阻力系数。
    pub surge_drag: f64,
    /// 横荡力对艏摇的低速力臂（m）。
    pub yaw_arm: f64,
    /// 垂向作用点（与 MMG 同点，保证过渡一致）。
    pub z_h: f64,
}

/// 公开基准无量纲导数的B→T映射，尺度统一为0.5ρLppT U²及其Lpp倍。
#[derive(Debug, Clone, serde::Deserialize)]
pub struct MappedMmgHull {
    pub water_density_kg_m3: f64,
    pub length_m: f64,
    pub draft_m: f64,
    /// R0、Xvv、Xvr、Xrr、Xvvvv。
    pub surge_coefficients: [f64; 5],
    /// Yv、Yr、Yvvv、Yvvr、Yvrr、Yrrr。
    pub sway_coefficients: [f64; 6],
    pub yaw_coefficients: [f64; 6],
    pub crossflow_cd: f64,
    pub force_center_body_z_m: f64,
}

impl MappedMmgHull {
    pub fn validate(&self) -> bool {
        [self.water_density_kg_m3, self.length_m, self.draft_m, self.crossflow_cd].iter()
            .all(|value| value.is_finite() && *value > 0.0)
            && self.surge_coefficients.iter().chain(&self.sway_coefficients)
                .chain(&self.yaw_coefficients).all(|value| value.is_finite())
            && self.surge_coefficients[0] >= 0.0 && self.force_center_body_z_m.is_finite()
    }

    pub fn loads(&self, relative_velocity: &[f64; 6]) -> [f64; 6] {
        let z = self.force_center_body_z_m;
        let u = relative_velocity[0] + relative_velocity[4] * z;
        let v = relative_velocity[1] - relative_velocity[3] * z;
        let r = relative_velocity[5];
        let speed = u.hypot(v);
        let mut high = [0.0; 3];
        if speed > 0.0 {
            let vp = v / speed;
            let rp = r * self.length_m / speed;
            let [r0, xvv, xvr, xrr, xvvvv] = self.surge_coefficients;
            let basis = [vp, rp, vp.powi(3), vp * vp * rp, vp * rp * rp, rp.powi(3)];
            let scale = 0.5 * self.water_density_kg_m3 * self.length_m * self.draft_m * speed * speed;
            high[0] = scale * (-r0 + xvv * vp * vp + xvr * vp * rp + xrr * rp * rp + xvvvv * vp.powi(4));
            high[1] = scale * self.sway_coefficients.iter().zip(basis).map(|(a, b)| a * b).sum::<f64>();
            high[2] = scale * self.length_m * self.yaw_coefficients.iter().zip(basis).map(|(a, b)| a * b).sum::<f64>();
        }
        let mut low = [-0.5 * self.water_density_kg_m3 * self.length_m * self.draft_m
            * self.surge_coefficients[0] * u * u.abs(), 0.0, 0.0];
        // 21个站点的梯形积分，横向力和艏摇矩来自同一条带载荷。
        let spacing = self.length_m / 20.0;
        for index in 0..=20 {
            let x = -0.5 * self.length_m + spacing * index as f64;
            let local = v + x * r;
            let weight = if index == 0 || index == 20 { 0.5 } else { 1.0 };
            let force = -0.5 * self.water_density_kg_m3 * self.crossflow_cd
                * self.draft_m * spacing * weight * local * local.abs();
            low[1] += force;
            low[2] += x * force;
        }
        // 倒航沿用低速阻力，避免把正航MMG导数外推至反向。
        let weight = transition_weight(u);
        let loads = std::array::from_fn::<_, 3, _>(|index| weight * high[index] + (1.0 - weight) * low[index]);
        [loads[0], loads[1], 0.0, -self.force_center_body_z_m * loads[1],
            self.force_center_body_z_m * loads[0], loads[2]]
    }
}

pub const TRANSITION_LOW_MPS: f64 = 1.0;
pub const TRANSITION_HIGH_MPS: f64 = 3.0;

/// MMG 三次项船体力（相对速度输入）。返回 [Fx, Fy, Nzz]。
pub fn mmg_hull_loads(p: &HullMmgParams, u: f64, v: f64, r: f64) -> [f64; 3] {
    let fx = p.x_u * u + p.x_uu * u * u.abs();
    let fy = p.y_v * v + p.y_vv * v * v.abs()
        + p.y_vr * v * r.abs()
        + p.y_r * r + p.y_rr * r * r.abs();
    let nz = p.n_v * v + p.n_vv * v * v.abs()
        + p.n_vr * v * r.abs()
        + p.n_r * r + p.n_rr * r * r.abs();
    [fx, fy, nz]
}

/// 低速 cross-flow 载荷（零速/侧移/倒航连续，无速度下限截断）。
pub fn low_speed_loads(p: &LowSpeedParams, u: f64, v: f64, r: f64) -> [f64; 3] {
    // 纵向二次阻力（倒航同式：u|u| 天然四象限）。
    let fx = -p.surge_drag * u * u.abs();
    // 横向 cross-flow（含艏摇引起的局部横流近似：v + arm·r）。
    let v_eff = v + p.yaw_arm * r;
    let fy = -p.crossflow_y * v_eff * v_eff.abs();
    let nz = -p.crossflow_y * p.yaw_arm * v_eff * v_eff.abs();
    [fx, fy, nz]
}

/// 过渡权重：|u| ≤ 1 → 0（纯低速）；≥ 3 → 1（纯 MMG）；之间三次 smoothstep。
pub fn transition_weight(u_abs: f64) -> f64 {
    if u_abs <= TRANSITION_LOW_MPS {
        return 0.0;
    }
    if u_abs >= TRANSITION_HIGH_MPS {
        return 1.0;
    }
    let t = (u_abs - TRANSITION_LOW_MPS) / (TRANSITION_HIGH_MPS - TRANSITION_LOW_MPS);
    t * t * (3.0 - 2.0 * t)
}

/// 混合船体载荷：`w·MMG + (1−w)·低速`（加权平均，无叠加重复）。
/// 返回 6 通道（含横荡—艏摇载荷经 z_h 的横摇耦合）。
pub fn blended_hull_loads(
    mmg: &HullMmgParams,
    low: &LowSpeedParams,
    u: f64,
    v: f64,
    r: f64,
) -> [f64; 6] {
    let w = transition_weight(u.abs());
    let a = mmg_hull_loads(mmg, u, v, r);
    let b = low_speed_loads(low, u, v, r);
    let fx = w * a[0] + (1.0 - w) * b[0];
    let fy = w * a[1] + (1.0 - w) * b[1];
    let nz = w * a[2] + (1.0 - w) * b[2];
    // 横摇耦合：横荡/艏摇合力作用在 z_h（r×F 语义，绕 y 的力矩由
    // surge 分量产生、绕 x 的力矩由 sway 分量产生）。
    // 统一 r×F 合同：r=[0,0,z_h] → M = (−z_h·Fy, z_h·Fx, 0)。
    let k_roll = -mmg.z_h * fy;
    let k_pitch = mmg.z_h * fx;
    [fx, fy, 0.0, k_roll, k_pitch, nz]
}
