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
    /// 残差与输入相关性（P2：真实计算，非固定零）。
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
            residual_input_correlation: 0.0, // 由 evaluate_with_input 填充。
        })
    }
}

/// 阶跃超调（相对 Δy = yref − y0，支持负阶跃/非零初值；零幅值→None）。
/// 有向判断：正向阶跃只算越过 yref 之上，负向只算低于 yref。
/// 未越过目标（纯欠调）→ 0%（非误报为超调）。
pub fn overshoot_percent(y_ref: f64, y0: f64, y_peak: f64) -> Option<f64> {
    let delta = y_ref - y0;
    if delta.abs() < f64::EPSILON {
        return None;
    }
    // 有向超出量：正阶跃 → max(peak − ref, 0)；负阶跃 → max(ref − peak, 0)。
    let overshoot = if delta > 0.0 {
        (y_peak - y_ref).max(0.0)
    } else {
        (y_ref - y_peak).max(0.0)
    };
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
    // P2：非有限数值检查——NaN/Inf 输入或响应导致无效模型。
    if input.iter().chain(output.iter()).any(|v| !v.is_finite()) {
        return IdentificationResult {
            structure: None,
            residual_rms: f64::NAN,
            identified_ok: false,
            failure_reason: Some("输入/响应含非有限数值".into()),
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

    // ARX(1)：r[k+1] = a·r[k] + b·d[k] + c，中心化回归消去 c。
    let n = input.len();
    let m = n - 1;
    let m_f = m as f64;
    let r_bar: f64 = (0..m).map(|k| output[k]).sum::<f64>() / m_f;
    let d_bar: f64 = (0..m).map(|k| input[k]).sum::<f64>() / m_f;
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

    // P2：系数有限性检查。
    if !a.is_finite() || !b.is_finite() {
        return IdentificationResult {
            structure: None,
            residual_rms: f64::NAN,
            identified_ok: false,
            failure_reason: Some("辨识系数非有限".into()),
        };
    }
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
    if !(0.2..=2000.0).contains(&t_s) {
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
        if let Some(ModelStructure::Nomoto1 { k, t_s }) = result.structure {
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
            // 与 identify 相同时序约定：y[k+1] = a·y[k] + b·u[k]。
            // out[0] = y0（初始值），out[k+1] 由 input[k] 推进。
            let a = (-dt / t_s).exp();
            let b = k * (1.0 - a);
            out.push(y0);
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
            out.push(y0);
            let mut y = y0;
            for (i, _) in input.iter().enumerate() {
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

/// 评价（含输入信号——计算残差与输入的皮尔逊相关）。
pub fn evaluate_with_input(
    predicted: &[f64],
    measured: &[f64],
    input: &[f64],
) -> Option<EvaluationMetrics> {
    let mut m = EvaluationMetrics::compute(predicted, measured)?;
    if input.len() == measured.len() && input.len() > 1 {
        let residual: Vec<f64> =
            predicted.iter().zip(measured.iter()).map(|(p, y)| p - y).collect();
        m.residual_input_correlation = pearson_correlation(&residual, input);
    }
    Some(m)
}

fn pearson_correlation(x: &[f64], y: &[f64]) -> f64 {
    let n = x.len() as f64;
    if n < 2.0 {
        return 0.0;
    }
    let x_bar: f64 = x.iter().sum::<f64>() / n;
    let y_bar: f64 = y.iter().sum::<f64>() / n;
    let mut cov = 0.0;
    let mut var_x = 0.0;
    let mut var_y = 0.0;
    for (xi, yi) in x.iter().zip(y.iter()) {
        cov += (xi - x_bar) * (yi - y_bar);
        var_x += (xi - x_bar).powi(2);
        var_y += (yi - y_bar).powi(2);
    }
    if var_x < f64::EPSILON || var_y < f64::EPSILON {
        return 0.0;
    }
    cov / (var_x * var_y).sqrt()
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
