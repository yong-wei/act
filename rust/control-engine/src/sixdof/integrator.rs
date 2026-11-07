//! RK4 定步长积分器与接触细分策略（issue-2153-p1 A1.6）。
//!
//! 数值合同（issue §4）：标称步长 1/120 s、RK4；刚性接触按
//! `dt <= 0.1/sqrt(k/m_eff)` 细分，上限 1/960 s；超出预算显式报错，
//! 不裁剪状态伪装稳定。倍速只改变墙钟推进量（由调用方多次调用本
//! 步进器实现），同一仿真时刻的数值与帧率/暂停无关。

/// 积分步进错误（分型报告合同：issue §4 非有限/不可行/越域的步进器侧对应）。
#[derive(Debug, Clone, PartialEq)]
pub enum IntegrationError {
    /// 需要的细分步长小于下限（1/960 s 仍不满足接触刚度）。
    ContactStiffnessBudgetExceeded { required_dt: f64 },
    /// 状态出现非有限值，运行必须终止并保留诊断。
    NonFiniteState { stage: &'static str, index: usize },
}

/// 接触刚度参数（钢桩/锚缆/冰接触等）：等效刚度 N/m 与等效质量 kg。
#[derive(Debug, Clone, Copy)]
pub struct ContactStiffness {
    pub stiffness_n_per_m: f64,
    pub effective_mass_kg: f64,
}

pub const NOMINAL_DT: f64 = 1.0 / 120.0;
pub const MIN_DT: f64 = 1.0 / 960.0;

/// 依据接触刚度计算允许步长；无接触（None）返回标称步长的整数细分=1。
pub fn contact_substep_count(contact: Option<ContactStiffness>) -> Result<usize, IntegrationError> {
    let Some(c) = contact else { return Ok(1) };
    if !(c.stiffness_n_per_m > 0.0) || !(c.effective_mass_kg > 0.0) {
        return Err(IntegrationError::ContactStiffnessBudgetExceeded { required_dt: f64::NAN });
    }
    let required = 0.1 / (c.stiffness_n_per_m / c.effective_mass_kg).sqrt();
    if !required.is_finite() {
        return Err(IntegrationError::ContactStiffnessBudgetExceeded { required_dt: required });
    }
    let mut substeps = 1usize;
    while (NOMINAL_DT / substeps as f64) > required {
        substeps += 1;
        if (NOMINAL_DT / substeps as f64) < MIN_DT {
            // 已到下限仍不满足：显式报错（合同：不得裁剪状态伪装稳定）。
            if (NOMINAL_DT / substeps as f64) > required {
                return Err(IntegrationError::ContactStiffnessBudgetExceeded { required_dt: required });
            }
        }
    }
    Ok(substeps)
}

/// 通用 RK4：对 `y' = f(t, y)`（y 为任意长度状态切片）积分一个步长。
/// `derivs(t, y, &mut dy)` 由调用方填充；返回新 y（写入 `y`）。
pub fn rk4_step<F>(t: f64, y: &mut [f64], dt: f64, derivs: F) -> Result<(), IntegrationError>
where
    F: Fn(f64, &[f64], &mut [f64]),
{
    let n = y.len();
    let mut k1 = vec![0.0; n];
    let mut k2 = vec![0.0; n];
    let mut k3 = vec![0.0; n];
    let mut k4 = vec![0.0; n];
    let mut tmp = vec![0.0; n];

    derivs(t, y, &mut k1);
    check_finite(&k1, "k1")?;
    for i in 0..n {
        tmp[i] = y[i] + 0.5 * dt * k1[i];
    }
    derivs(t + 0.5 * dt, &tmp, &mut k2);
    check_finite(&k2, "k2")?;
    for i in 0..n {
        tmp[i] = y[i] + 0.5 * dt * k2[i];
    }
    derivs(t + 0.5 * dt, &tmp, &mut k3);
    check_finite(&k3, "k3")?;
    for i in 0..n {
        tmp[i] = y[i] + dt * k3[i];
    }
    derivs(t + dt, &tmp, &mut k4);
    check_finite(&k4, "k4")?;
    for i in 0..n {
        y[i] += dt / 6.0 * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]);
    }
    check_finite(y, "state")?;
    Ok(())
}

fn check_finite(values: &[f64], stage: &'static str) -> Result<(), IntegrationError> {
    for (index, value) in values.iter().enumerate() {
        if !value.is_finite() {
            return Err(IntegrationError::NonFiniteState { stage, index });
        }
    }
    Ok(())
}

/// 步进一个标称步长：按接触细分把 `y` 从 `t` 推进 `NOMINAL_DT`。
pub fn advance_nominal_step<F>(
    t: f64,
    y: &mut [f64],
    contact: Option<ContactStiffness>,
    derivs: F,
) -> Result<f64, IntegrationError>
where
    F: Fn(f64, &[f64], &mut [f64]),
{
    let substeps = contact_substep_count(contact)?;
    let dt = NOMINAL_DT / substeps as f64;
    let mut time = t;
    for _ in 0..substeps {
        rk4_step(time, y, dt, &derivs)?;
        time += dt;
    }
    Ok(time)
}
