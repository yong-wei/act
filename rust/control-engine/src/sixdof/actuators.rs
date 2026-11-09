//! 执行器物理子系统（issue-2153-p1 A1.4）。
//!
//! 合同（issue §2.2）：
//! - 桨轴 `J_s·ω̇ = Q_motor − Q_prop − Q_friction`，驱动扭矩响应、
//!   扭矩/功率/转速/变化率限制参与求解；四象限 `T, Q = f(Va, n, D, 几何)`，
//!   n=0、Va=0 连续定义；
//! - 舵/鳍/吊舱：一阶伺服 + 幅值/速率限幅，实际角度作用于载荷；
//! - 功率由扭矩×转速计算（`P = Q·ω`），不得"最大推力×2"。
//!
//! 四象限水动力首版采用规范化通用形态：推力/扭矩系数以进速比 J 的高阶
//! 多项式描述（前进象限），倒车/零速象限用连续正则化拼接（Bilesanthoni
//! 型 smoothstep 权重），保证 `n→0`、`Va→0` 处 T、Q→0 且连续可微。
//! 系数与几何图谱由参数包提供（#2157），此处只定结构。

/// 桨几何与四象限系数（参数包 P/B/D 级来源；缺省为零系数 = 无桨力）。
#[derive(Debug, Clone, Copy)]
pub struct PropellerModel {
    pub diameter_m: f64,
    /// 水密度 kg/m³（海水 1025）。
    pub water_density: f64,
    /// 前进象限推力系数多项式 k_T(J) = c0 + c1·J + c2·J²。
    pub kt_coefficients: [f64; 3],
    /// 前进象限扭矩系数多项式 k_Q(J)。
    pub kq_coefficients: [f64; 3],
}

/// 桨轴动力学参数。
#[derive(Debug, Clone, Copy)]
pub struct PropellerShaft {
    /// 轴系转动惯量 kg·m²（含桨惯量）。
    pub shaft_inertia: f64,
    /// 电机扭矩上限 N·m（含功率限制折算）。
    pub max_motor_torque_nm: f64,
    /// 转速上限 rad/s。
    pub max_shaft_speed_rad_s: f64,
    /// 扭矩变化率上限 N·m/s。
    pub max_torque_rate_nm_s: f64,
    /// 轴摩擦模型：库仑 + 粘性（N·m、N·m·s/rad）。
    pub coulomb_friction_nm: f64,
    pub viscous_friction_nm_s_per_rad: f64,
}

/// 四象限进速比：J = Va / (n·D)，n→0 时按有效标尺正则化保持连续。
fn advance_ratio(va_mps: f64, n_rad_s: f64, diameter_m: f64) -> f64 {
    let n_eff = n_rad_s.abs().max(0.05);
    va_mps / (n_eff * diameter_m)
}

/// 四象限推力与扭矩（N、N·m）。n=0 或 Va=0 连续（T,Q→0 或纯系桩值）。
/// 返回 (thrust_n, torque_nm)。
pub fn propeller_loads(
    model: &PropellerModel,
    va_mps: f64,
    n_rad_s: f64,
) -> (f64, f64) {
    let d = model.diameter_m;
    let rho = model.water_density;
    // 水动力标尺用真实转速：n→0 时 load∝n²→0，保证 T、Q 连续归零。
    let load = rho * n_rad_s * n_rad_s * d * d * d * d;
    // 进速比仅防除零；外推区间 clamp 避免低转速系数发散。
    let j = advance_ratio(va_mps, n_rad_s, d).clamp(-5.0, 5.0);
    let kt = model.kt_coefficients[0]
        + model.kt_coefficients[1] * j
        + model.kt_coefficients[2] * j * j;
    let kq = model.kq_coefficients[0]
        + model.kq_coefficients[1] * j
        + model.kq_coefficients[2] * j * j;
    // 倒转象限（n<0）：系数符号镜像，保持 n→0/Va→0 连续；
    // 倒车象限图谱系数细化归参数包（#2157）。
    let sign = if n_rad_s >= 0.0 { 1.0 } else { -1.0 };
    (sign * kt * load, sign * kq * load * d)
}

/// Smogeli 型通气/出水推力损失因子（issue-2156 阶段 B2.2）。
///
/// 合同（issue #2156）：通气/出水按经过验证的子模型；未校核的极端
/// 工况不开放，不用硬乘固定推力折扣。首版为 **准静态 T 级实现**：
/// 浸没比 h/R（轴心低于瞬时自由面的深度 / 桨半径）与负载水平（无量纲
/// 推力 |k_T| 作为代理）驱动的光滑损失曲线——重载先通气（临界浸没
/// 上移）、露出即无水动力推力、深浸没不受影响；适用域 h/R∈[0,3]，
/// 超域钳位（≥3 视为全湿）。Smogeli 论文的迟滞/瞬态与图谱系数随
/// #2157 参数包接入；迟滞未建模显式声明（适用域内准静态）。
///
/// 返回 [推力因子, 扭矩因子]（0..=1，作用于湿态载荷）。
pub fn ventilation_loss_factors(
    model: &PropellerModel,
    immersion_m: f64,
    kt_wetted: f64,
) -> [f64; 2] {
    let radius = model.diameter_m / 2.0;
    if radius <= 0.0 || immersion_m <= 0.0 {
        // 轴心在自由面以上：无水动力载荷（轴系惯性/摩擦仍由轴动力学
        // 承载——断桨不停轴，见 #2147 失效语义）。
        return [0.0, 0.0];
    }
    let h_over_r = immersion_m / radius;
    if h_over_r >= 3.0 {
        return [1.0, 1.0]; // 深浸没：全湿（适用域上界钳位）。
    }
    // 临界浸没（T 级系数）：重载（大 |k_T|）更早通气。
    let loading = kt_wetted.abs().clamp(0.0, 1.0);
    let h_c = 1.0 + 0.6 * loading; // h_c/R ∈ [1, 1.6]
    // 光滑过渡（logistic，宽度 ~0.25R）；部分通气残余推力下限随负载
    // 增大而降低（重载通气损失更严重）。
    let floor = 0.35 - 0.15 * loading; // ∈ [0.2, 0.35]
    let s = ((h_over_r - h_c) / 0.25).tanh(); // ∈ (−1, 1) 光滑
    let mut thrust_factor = floor + (1.0 - floor) * (0.5 + 0.5 * s);
    // 出水过渡（review 修订）：桨盘渐出水面时推力连续趋零——h/R∈(0,0.6]
    // 乘 smoothstep 浸没分数（C¹ 连续，端点导数 0），消除 h→0⁺ 残余
    // 下限的跳变（出水/再入水不瞬切 ~30% 湿态推力）。
    let t_emerge = (h_over_r / 0.6).clamp(0.0, 1.0);
    let emerge = t_emerge * t_emerge * (3.0 - 2.0 * t_emerge);
    thrust_factor *= emerge;
    // 扭矩损失与推力损失同向但略缓（通气后转矩衰减弱于推力）；
    // T 级近似 0.75 次幂，并与出水过渡用同一 emerge 权重混合——
    // t=0 时跟随推力（同趋零）、t=1 时过渡到纯 0.75 幂（边界连续）。
    let torque_full = thrust_factor.powf(0.75);
    let torque_factor = thrust_factor + (torque_full - thrust_factor) * emerge;
    [thrust_factor.clamp(0.0, 1.0), torque_factor.clamp(0.0, 1.0)]
}

/// 含通气/出水的四象限桨载荷：先算湿态（全浸没）载荷，再按浸没比
/// 与负载施加 Smogeli 型损失因子。`immersion_m` = 轴心低于瞬时自由
/// 面的深度（m；由调用方组合波面高程/升沉/纵倾几何，per-vessel 接线）。
pub fn propeller_loads_with_ventilation(
    model: &PropellerModel,
    va_mps: f64,
    n_rad_s: f64,
    immersion_m: Option<f64>,
) -> (f64, f64) {
    let (thrust, torque) = propeller_loads(model, va_mps, n_rad_s);
    match immersion_m {
        None => (thrust, torque),
        Some(h) => {
            // 负载代理：湿态无量纲推力（|k_T|；由同多项式重算，与
            // propeller_loads 内部一致）。
            let j = advance_ratio(va_mps, n_rad_s, model.diameter_m).clamp(-5.0, 5.0);
            let kt = model.kt_coefficients[0]
                + model.kt_coefficients[1] * j
                + model.kt_coefficients[2] * j * j;
            let [tf, qf] = ventilation_loss_factors(model, h, kt);
            (thrust * tf, torque * qf)
        }
    }
}

/// 轴摩擦扭矩（反对称库仑 + 粘性）。
pub fn shaft_friction(shaft: &PropellerShaft, n_rad_s: f64) -> f64 {
    let coulomb = if n_rad_s.abs() > 1e-4 {
        shaft.coulomb_friction_nm * n_rad_s.signum()
    } else {
        shaft.coulomb_friction_nm * (n_rad_s / 1e-4).clamp(-1.0, 1.0)
    };
    coulomb + shaft.viscous_friction_nm_s_per_rad * n_rad_s
}

/// 桨轴一步推进（标量 RK4 由调用方装配；此处给导数，便于与六自由度联立）。
/// `q_motor_commanded` 为指令电机扭矩（已受扭矩/变化率限幅后的目标）。
pub fn shaft_acceleration(
    shaft: &PropellerShaft,
    prop: &PropellerModel,
    n_rad_s: f64,
    va_mps: f64,
    q_motor_commanded: f64,
) -> f64 {
    let (_, q_prop) = propeller_loads(prop, va_mps, n_rad_s);
    let friction = shaft_friction(shaft, n_rad_s);
    (q_motor_commanded - q_prop - friction) / shaft.shaft_inertia
}

/// 扭矩指令限幅：幅值 + 变化率（相对上一实际指令值）。
pub fn clamp_motor_torque(
    shaft: &PropellerShaft,
    commanded: f64,
    previous_commanded: f64,
    dt: f64,
) -> f64 {
    let amplitude = commanded.clamp(-shaft.max_motor_torque_nm, shaft.max_motor_torque_nm);
    let max_delta = shaft.max_torque_rate_nm_s * dt;
    previous_commanded + (amplitude - previous_commanded).clamp(-max_delta, max_delta)
}

/// 轴功率 W：`P = Q·ω`（合同：不得由最大推力倍乘生成）。
pub fn shaft_power(q_motor_nm: f64, n_rad_s: f64) -> f64 {
    q_motor_nm * n_rad_s
}

/// 转速安全限幅（硬物理上限，教学开关不可越过）。
pub fn clamp_shaft_speed(shaft: &PropellerShaft, n_rad_s: f64) -> f64 {
    n_rad_s.clamp(-shaft.max_shaft_speed_rad_s, shaft.max_shaft_speed_rad_s)
}

/// 舵/鳍/吊舱一阶伺服：速率与幅值限幅后的实际角增量。
#[derive(Debug, Clone, Copy)]
pub struct ServoModel {
    pub max_angle_rad: f64,
    pub max_rate_rad_s: f64,
    /// 一阶时间常数 s（0 表示纯速率模型）。
    pub time_constant_s: f64,
}

pub fn servo_step(servo: &ServoModel, actual_rad: f64, commanded_rad: f64, dt: f64) -> f64 {
    let target = commanded_rad.clamp(-servo.max_angle_rad, servo.max_angle_rad);
    let first_order = if servo.time_constant_s > 0.0 {
        let alpha = (-dt / servo.time_constant_s).exp();
        actual_rad + (1.0 - alpha) * (target - actual_rad)
    } else {
        target
    };
    let max_delta = servo.max_rate_rad_s * dt;
    (first_order - actual_rad).clamp(-max_delta, max_delta) + actual_rad
}
