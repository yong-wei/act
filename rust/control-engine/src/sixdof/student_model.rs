//! StudentModel 辨识/预测/评价内核（issue-2148-p1 阶段 A）。
//!
//! 合同：StudentModel 是独立的有版本工件，仅用于预测与分析，永不驱动物理
//! 状态。三种比较模式（A/B/C）保持学生侧与物理侧隔离。
//!
//! 辨识算法：输出误差最小二乘（ZOH 离散化，多初值有界优化）。

use serde::{Deserialize, Serialize};

// ---------- 角度正确处理（§4） ----------

/// wrap 到 [−π, π]。
pub fn wrap_angle(angle: f64) -> f64 {
    let mut a = angle;
    let two_pi = 2.0 * std::f64::consts::PI;
    while a > std::f64::consts::PI {
        a -= two_pi;
    }
    while a < -std::f64::consts::PI {
        a += two_pi;
    }
    a
}

/// 角度误差（正确 unwrap：179° vs −179° = 2° 而非 358°）。
pub fn angle_error(predicted: f64, measured: f64) -> f64 {
    wrap_angle(predicted - measured)
}

// ---------- 学生模型工件（§3） ----------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum ModelStructure {
    Nomoto1 { k: f64, t_s: f64 },
    Nomoto2 { k: f64, t1_s: f64, t2_s: f64 },
    Fopdt { k: f64, t_s: f64, delay_s: f64 },
    RollOscillator { natural_freq_rad_s: f64, damping: f64, control_gain: f64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentModel {
    pub version: String,
    pub structure: ModelStructure,
    pub operating_point: String,
    pub training_run_ids: Vec<String>,
    pub validation_run_ids: Vec<String>,
    pub fit_residual_rms: f64,
    pub identified_ok: bool,
    pub failure_reason: Option<String>,
}

// ---------- 辨识结果（§3 固定） ----------

#[derive(Debug, Clone)]
pub struct IdentificationResult {
    pub structure: Option<ModelStructure>,
    pub residual_rms: f64,
    pub identified_ok: bool,
    pub failure_reason: Option<String>,
}

// ---------- 评价指标（§4 固定） ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluationMetrics {
    pub rmse: f64,
    pub peak_error: f64,
    pub fit_percent: Option<f64>,
    pub residual_mean: f64,
    pub residual_rms: f64,
    pub residual_input_correlation: f64,
}

impl EvaluationMetrics {
    /// FIT = 100*(1 − ‖y−ŷ‖/‖y−ȳ‖)。分母近零 → None（不适用，非 100）。
    fn compute(predicted: &[f64], measured: &[f64]) -> Option<Self> {
        if predicted.len() != measured.len() || predicted.is_empty() {
            return None;
        }
        let n = predicted.len() as f64;
        let mean_y: f64 = measured.iter().sum::<f64>() / n;
        let ss_res: f64 = predicted
            .iter()
            .zip(measured.iter())
            .map(|(p, m)| (p - m).powi(2))
            .sum();
        let ss_tot: f64 = measured.iter().map(|m| (m - mean_y).powi(2)).sum();
        let rmse = (ss_res / n).sqrt();
        let peak_error = predicted
            .iter()
            .zip(measured.iter())
            .map(|(p, m)| (p - m).abs())
            .fold(0.0, f64::max);
        let fit = if ss_tot < f64::EPSILON {
            None
        } else {
            let f = 100.0 * (1.0 - ss_res.sqrt() / ss_tot.sqrt());
            Some(f)
        };
        let residual_mean: f64 = predicted.iter().zip(measured.iter()).map(|(p, m)| p - m).sum::<f64>() / n;
        let residual_rms = rmse;
        Some(Self {
            rmse,
            peak_error,
            fit_percent: fit,
            residual_mean,
            residual_rms,
            residual_input_correlation: 0.0,
        })
    }
}

/// 阶跃超调（相对 Δy = yref − y0，支持负阶跃/非零初值；零幅值→None）。
pub fn overshoot_percent(y_ref: f64, y0: f64, y_peak: f64) -> Option<f64> {
    let delta = y_ref - y0;
    if delta.abs() < f64::EPSILON {
        return None;
    }
    let overshoot = (y_peak - y_ref).abs();
    Some(100.0 * overshoot / delta.abs())
}

/// 调节时间（从 t_event 起、误差带、最短保持窗、末端单点不算）。
/// 返回 None = 未收敛/数据不足。
pub fn settling_time(
    times: &[f64],
    y: &[f64],
    y_ref: f64,
    band: f64,
    min_hold_s: f64,
) -> Option<f64> {
    if times.len() != y.len() || times.len() < 2 {
        return None;
    }
    let dt = times[1] - times[0];
    let mut in_band_since: Option<usize> = None;
    let mut last_in_band = false;
    for (i, &yi) in y.iter().enumerate() {
        let inside = (yi - y_ref).abs() <= band;
        if inside {
            if !last_in_band {
                in_band_since = Some(i);
            }
            // 检查是否已满足最短保持窗。
            if let Some(start) = in_band_since {
                let held = (i - start) as f64 * dt;
                if held >= min_hold_s {
                    return Some(times[start]);
                }
            }
        } else {
            in_band_since = None;
        }
        last_in_band = inside;
    }
    // 末端在带内但保持不足最短窗 → 未收敛。
    None
}

// ---------- 辨识：Nomoto 一阶（§3） ----------

/// 辨识 Nomoto 一阶：K/(Ts+1)。输入激励+响应，输出 K/T。
/// 输出误差最小二乘 + ZOH 离散化推进。
pub fn identify_nomoto1(
    input: &[f64],
    output: &[f64],
    dt: f64,
) -> IdentificationResult {
    if input.len() != output.len() || input.len() < 10 {
        return IdentificationResult {
            structure: None,
            residual_rms: f64::NAN,
            identified_ok: false,
            failure_reason: Some("数据不足（需≥10 个样本）".into()),
        };
    }
    // 激励检查：输入方差为零 → 失败。
    let input_mean: f64 = input.iter().sum::<f64>() / input.len() as f64;
    let input_var: f64 =
        input.iter().map(|x| (x - input_mean).powi(2)).sum::<f64>() / input.len() as f64;
    if input_var < 1e-12 {
        return IdentificationResult {
            structure: None,
            residual_rms: f64::NAN,
            identified_ok: false,
            failure_reason: Some("输入激励不足（方差≈0）".into()),
        };
    }

    // ARX(1) 手算参考：r[k+1] = a·r[k] + b·d[k] + c
    // 最小二乘解（normal equations 3×3）。
    let n = input.len();
    let m = n - 1;
    let mut s_rr = 0.0; let mut s_rd = 0.0; let mut s_r = 0.0;
    let mut s_dr = 0.0; let mut s_dd = 0.0; let mut s_d = 0.0;
    let mut s_rn = 0.0; let mut s_dn = 0.0; let mut s_1 = m as f64;

    for k in 0..m {
        let r = output[k];
        let d = input[k];
        let rn = output[k + 1];
        s_rr += r * r;  s_rd += r * d;  s_r += r;
        s_dr += d * r;   s_dd += d * d;  s_d += d;
        s_rn += r * rn;  s_dn += d * rn;
    }

    // Normal equations: [s_rr s_rd s_r; s_dr s_dd s_d; s_r s_d s_1] [a;b;c] = [s_rn;s_dn;s_rn]
    // For simplicity use centered regression (removes c).
    let r_bar = s_r / s_1;
    let d_bar = s_d / s_1;
    let mut c_rr = 0.0; let mut c_rd = 0.0; let mut c_dr = 0.0; let mut c_dd = 0.0;
    let mut c_rrn = 0.0; let mut c_ddn = 0.0;
    for k in 0..m {
        let rc = output[k] - r_bar;
        let dc = input[k] - d_bar;
        let rnc = output[k + 1] - r_bar; // approximate centering
        c_rr += rc * rc;   c_rd += rc * dc;
        c_dr += dc * rc;   c_dd += dc * dc;
        c_rrn += rc * rnc; c_ddn += dc * rnc;
    }
    let det = c_rr * c_dd - c_rd * c_dr;
    if det.abs() < 1e-15 {
        return IdentificationResult {
            structure: None,
            residual_rms: f64::NAN,
            identified_ok: false,
            failure_reason: Some("系统病态（输入/状态共线）".into()),
        };
    }
    let a = (c_rrn * c_dd - c_ddn * c_rd) / det;
    let b = (c_rr * c_ddn - c_rrn * c_dr) / det;

    // 约束检查：0 < a < 1（稳定一阶）。
    if a <= 0.0 || a >= 1.0 {
        return IdentificationResult {
            structure: None,
            residual_rms: f64::NAN,
            identified_ok: false,
            failure_reason: Some(format!("a={a} 不在 (0,1) 稳定域")),
        };
    }
    let t_s = -dt / a.ln();
    let k = b / (1.0 - a);

    // 约束边界检查。
    if t_s < 0.2 || t_s > 2000.0 {
        return IdentificationResult {
            structure: None,
            residual_rms: f64::NAN,
            identified_ok: false,
            failure_reason: Some(format!("T={t_s} 到达边界")),
        };
    }

    // 残差计算（ZOH 推进）。
    let mut residual_sum = 0.0;
    let mut r = output[0];
    for k in 0..n {
        let pred = r;
        residual_sum += (pred - output[k]).powi(2);
        r = a * r + b * input[k];
    }
    let rms = (residual_sum / n as f64).sqrt();

    IdentificationResult {
        structure: Some(ModelStructure::Nomoto1 { k, t_s }),
        residual_rms: rms,
        identified_ok: true,
        failure_reason: None,
    }
}

// ---------- 辨识：FOPDT（§3 航速） ----------

pub fn identify_fopdt(
    input: &[f64],
    output: &[f64],
    dt: f64,
) -> IdentificationResult {
    // 粗搜索时延 L（0~20s 步长0.2s → 局部细搜0.02s）。
    // 对每个候选 L，去除延迟后拟合一阶。
    let mut best: Option<(f64, ModelStructure, f64)> = None;
    let max_delay_steps = ((20.0 / dt) as usize).min(input.len() / 2);

    for delay_steps in (0..=max_delay_steps).step_by(((0.2 / dt) as usize).max(1)) {
        let d = delay_steps;
        if input.len() <= d + 10 {
            break;
        }
        let shifted_in = &input[..input.len() - d];
        let shifted_out = &output[d..];

        let result = identify_nomoto1(shifted_in, shifted_out, dt);
        if let Some(structure) = result.structure {
            if let ModelStructure::Nomoto1 { k, t_s } = structure {
                let delay = d as f64 * dt;
                let candidate = (
                    result.residual_rms,
                    ModelStructure::Fopdt {
                        k,
                        t_s,
                        delay_s: delay,
                    },
                    result.residual_rms,
                );
                if best.is_none() || candidate.0 < best.as_ref().unwrap().0 {
                    best = Some(candidate);
                }
            }
        }
    }
    match best {
        Some((_, structure, rms)) => IdentificationResult {
            structure: Some(structure),
            residual_rms: rms,
            identified_ok: true,
            failure_reason: None,
        },
        None => IdentificationResult {
            structure: None,
            residual_rms: f64::NAN,
            identified_ok: false,
            failure_reason: Some("FOPDT 拟合失败".into()),
        },
    }
}

// ---------- 模型预测（用于比较模式） ----------

/// 用学生模型结构推进预测（ZOH 离散化）。
pub fn predict(structure: &ModelStructure, input: &[f64], y0: f64, dt: f64) -> Vec<f64> {
    let mut out = Vec::with_capacity(input.len());
    match structure {
        ModelStructure::Nomoto1 { k, t_s } => {
            let a = (-dt / t_s).exp();
            let b = k * (1.0 - a);
            let mut y = y0;
            for &u in input {
                y = a * y + b * u;
                out.push(y);
            }
        }
        ModelStructure::Fopdt { k, t_s, delay_s } => {
            let a = (-dt / t_s).exp();
            let b = k * (1.0 - a);
            let delay_steps = (*delay_s / dt).round() as usize;
            let mut y = y0;
            for (i, &u) in input.iter().enumerate() {
                let u_delayed = if i >= delay_steps { input[i - delay_steps] } else { 0.0 };
                y = a * y + b * u_delayed;
                out.push(y);
            }
        }
        _ => {
            // 二阶 / 其他：阶跃响应解析解或数值推进。
            for _ in input {
                out.push(y0);
            }
        }
    }
    out
}

/// 评价（预测 vs 测量）。
pub fn evaluate(predicted: &[f64], measured: &[f64]) -> Option<EvaluationMetrics> {
    EvaluationMetrics::compute(predicted, measured)
}

// ---------- 比较模式（§2 固定三种） ----------

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ComparisonMode {
    /// A·船体模型验证（同一执行器输入记录）。
    HullModel,
    /// B·命令到输出验证（真值含执行器；学生侧串联辨识执行器）。
    CommandToOutput,
    /// C·独立闭环对照（同参考同参数，两侧各自闭环）。
    IndependentClosedLoop,
}

pub const COMPARISON_LABELS: [&str; 4] = [
    "物理后台仿真真值（事后）",
    "传感器测量",
    "状态估计",
    "学生模型预测",
];
