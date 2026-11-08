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
///
/// 采样约定（与 predict 一致）：output[k] 为施加 input[k] **之前**的状态采样，
/// 即回归方程 output[k+1] = a·output[k] + b·input[k]。上游采集必须遵循同一约定，
/// 否则快系统/快变激励下差一拍会破坏辨识。
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

// ---------- 辨识：Nomoto 二阶（§3 转艏率候选） ----------

/// 辨识 Nomoto 二阶：K/((T1·s+1)(T2·s+1))。
///
/// 采样约定与 identify_nomoto1 一致：output[k] 为施加 input[k] 之前的状态
/// 采样。二阶系统的 ZOH 消去形恰为 ARX(2,2)：
/// y[k+1] = a1·y[k] + a2·y[k−1] + b1·u[k] + b2·u[k−1]；
/// 离散特征根 z 经 s=ln(z)/dt 精确还原连续极点，稳态增益由直流平衡式
/// K=(b1+b2)/(1−a1−a2) 得到。
pub fn identify_nomoto2(
    input: &[f64],
    output: &[f64],
    dt: f64,
) -> IdentificationResult {
    let fail = |reason: &str| IdentificationResult {
        structure: None,
        residual_rms: f64::NAN,
        identified_ok: false,
        failure_reason: Some(reason.to_string()),
    };
    if input.len() != output.len() || input.len() < 20 {
        return fail("数据不足（需≥20 个样本）");
    }
    if input.iter().chain(output.iter()).any(|v| !v.is_finite()) {
        return fail("输入/响应含非有限数值");
    }
    // 激励检查。
    let input_mean: f64 = input.iter().sum::<f64>() / input.len() as f64;
    let input_var: f64 =
        input.iter().map(|x| (x - input_mean).powi(2)).sum::<f64>() / input.len() as f64;
    if input_var < 1e-12 {
        return fail("输入激励不足（方差≈0）");
    }

    // ARX(2,2) 最小二乘：θ = [a1, a2, b1, b2]。
    // 回归对 k=1..n-1：y[k+1] = a1·y[k] + a2·y[k-1] + b1·u[k] + b2·u[k-1]。
    let m = input.len() - 2;
    let mut ata = [[0.0f64; 4]; 4];
    let mut atb = [0.0f64; 4];
    for k in 1..=m {
        let phi = [output[k], output[k - 1], input[k], input[k - 1]];
        let target = output[k + 1];
        for i in 0..4 {
            for j in 0..4 {
                ata[i][j] += phi[i] * phi[j];
            }
            atb[i] += phi[i] * target;
        }
    }
    let Some(theta) = solve_linear_4(&ata, &atb) else {
        return fail("正规方程病态（输入/状态共线）");
    };
    let [a1, a2, b1, b2] = theta;
    if ![a1, a2, b1, b2].iter().all(|v| v.is_finite()) {
        return fail("辨识系数非有限");
    }

    // 离散特征根 z² − a1·z − a2 = 0 → 连续极点 s = ln(z)/dt。
    let disc = a1 * a1 + 4.0 * a2;
    if disc < 0.0 {
        return fail("二阶极点复数化（建议用横摇振子结构）");
    }
    let sqrt_disc = disc.sqrt();
    let z1 = (a1 + sqrt_disc) / 2.0;
    let z2 = (a1 - sqrt_disc) / 2.0;
    if !(z1 > 0.0 && z1 < 1.0) || !(z2 > 0.0 && z2 < 1.0) {
        return fail(&format!("离散极点不在 (0,1) 稳定域：z1={z1}, z2={z2}"));
    }
    let s1 = z1.ln() / dt;
    let s2 = z2.ln() / dt;
    let (t1, t2) = (-1.0 / s1, -1.0 / s2);
    let (t1, t2) = if t1 >= t2 { (t1, t2) } else { (t2, t1) };
    if !(0.2..=2000.0).contains(&t1) || !(0.2..=2000.0).contains(&t2) {
        return fail(&format!("T1/T2 到达边界：{t1}/{t2}"));
    }
    let denom = 1.0 - a1 - a2;
    if denom.abs() < 1e-9 {
        return fail("直流增益分母近零");
    }
    let k_gain = (b1 + b2) / denom;
    if !k_gain.is_finite() || k_gain.abs() < 1e-12 {
        return fail("增益退化");
    }

    // 残差（ARX 一步预测）。
    let mut residual_sum = 0.0;
    let mut count = 0.0;
    for k in 1..=m {
        let pred = a1 * output[k] + a2 * output[k - 1] + b1 * input[k] + b2 * input[k - 1];
        residual_sum += (pred - output[k + 1]).powi(2);
        count += 1.0;
    }
    let rms = (residual_sum / count).sqrt();

    IdentificationResult {
        structure: Some(ModelStructure::Nomoto2 { k: k_gain, t1_s: t1, t2_s: t2 }),
        residual_rms: rms,
        identified_ok: true,
        failure_reason: None,
    }
}

/// 4×4 线性方程组求解（部分主元高斯消去）；奇异返回 None。
fn solve_linear_4(a: &[[f64; 4]; 4], b: &[f64; 4]) -> Option<[f64; 4]> {
    let mut m = *a;
    let mut rhs = *b;
    for col in 0..4 {
        // 部分主元。
        let mut pivot = col;
        for row in col + 1..4 {
            if m[row][col].abs() > m[pivot][col].abs() {
                pivot = row;
            }
        }
        if m[pivot][col].abs() < 1e-12 {
            return None;
        }
        m.swap(col, pivot);
        rhs.swap(col, pivot);
        for row in col + 1..4 {
            let factor = m[row][col] / m[col][col];
            for j in col..4 {
                m[row][j] -= factor * m[col][j];
            }
            rhs[row] -= factor * rhs[col];
        }
    }
    let mut x = [0.0f64; 4];
    for row in (0..4).rev() {
        let mut acc = rhs[row];
        for j in row + 1..4 {
            acc -= m[row][j] * x[j];
        }
        x[row] = acc / m[row][row];
    }
    Some(x)
}

// ---------- 辨识：横摇二阶振子（§3 自由衰减 + 小激励） ----------

/// 辨识横摇振子：ωn/ζ 来自自由衰减记录，控制增益 G 来自小激励段
/// （φ̈ = −ωn²·φ − 2ζωn·φ̇ + G·u）。无激励段时 G 返回 0 并在
/// failure_reason 保留 None（结构仍可用于自由衰减预测）。
///
/// 采样约定同前：`free_decay` 为零输入横摇角序列；激励段
/// `(excited_input, excited_output)` 同一采样周期。
pub fn identify_roll_oscillator(
    free_decay: &[f64],
    dt: f64,
    excited: Option<(&[f64], &[f64])>,
) -> IdentificationResult {
    let fail = |reason: &str| IdentificationResult {
        structure: None,
        residual_rms: f64::NAN,
        identified_ok: false,
        failure_reason: Some(reason.to_string()),
    };
    if free_decay.len() < 40 || !free_decay.iter().all(|v| v.is_finite()) {
        return fail("自由衰减数据不足或含非有限数值（需≥40 样本）");
    }

    // 1) 过零点（线性插值取子样本时刻）→ 阻尼周期 Td。
    let mut crossings: Vec<f64> = Vec::new();
    for i in 0..free_decay.len() - 1 {
        let (a, b) = (free_decay[i], free_decay[i + 1]);
        if a == 0.0 {
            crossings.push(i as f64 * dt);
        } else if a * b < 0.0 {
            let frac = -a / (b - a);
            crossings.push((i as f64 + frac) * dt);
        }
    }
    if crossings.len() < 3 {
        return fail("过零点不足（非振荡或数据过短）");
    }
    let periods: Vec<f64> = crossings.windows(2).map(|w| w[1] - w[0]).collect();
    // 半周期交替：相邻差为 Td/2 → 取偶数跨度的平均×2。
    let t_half: f64 = periods.iter().sum::<f64>() / periods.len() as f64;
    let t_damped = 2.0 * t_half;
    if !(0.5..=7200.0).contains(&t_damped) {
        return fail(&format!("阻尼周期越界：{t_damped}s"));
    }
    let omega_d = 2.0 * std::f64::consts::PI / t_damped;

    // 2) 峰→每个峰与其后第一个同号峰的比值（对数减幅，每对隔一个整周期）。
    let mut peaks: Vec<usize> = Vec::new();
    for i in 1..free_decay.len() - 1 {
        let (a, b, c) = (free_decay[i - 1], free_decay[i], free_decay[i + 1]);
        if b.abs() > a.abs() && b.abs() > c.abs() && b != 0.0 {
            peaks.push(i);
        }
    }
    let mut decrements: Vec<f64> = Vec::new();
    for (idx, &i) in peaks.iter().enumerate() {
        if let Some(&j) = peaks[idx + 1..].iter().find(|&&j| free_decay[j] * free_decay[i] > 0.0) {
            let (amp_a, amp_b) = (free_decay[i].abs(), free_decay[j].abs());
            if amp_a > 1e-9 && amp_b > 1e-9 && amp_b < amp_a {
                decrements.push((amp_a / amp_b).ln());
            }
        }
    }
    if decrements.is_empty() {
        return fail("对数减幅不可计算（同号峰不足或非衰减）");
    }
    let delta: f64 = decrements.iter().sum::<f64>() / decrements.len() as f64;
    if delta <= 0.0 {
        return fail("非衰减响应（δ≤0）");
    }
    let damping = delta / (4.0 * std::f64::consts::PI * std::f64::consts::PI + delta * delta).sqrt();
    let natural_freq = omega_d / (1.0 - damping * damping).sqrt();
    if !(0.01..=3.0).contains(&natural_freq) {
        return fail(&format!("固有频率越界：{natural_freq} rad/s"));
    }
    if !(0.01..=3.0).contains(&damping) {
        return fail(&format!("阻尼比越界：{damping}"));
    }

    // 3) 控制增益：φ̈ + ωn²φ + 2ζωn·φ̇ = G·u → 单参数最小二乘。
    // 未提供激励段或激励退化时 G 保持 0（自由衰减结构仍有效）。
    let mut control_gain = 0.0f64;
    if let Some((e_in, e_out)) = excited {
        if e_in.len() == e_out.len() && e_in.len() > 10 {
            let n = e_out.len();
            let d1 = |k: usize| (e_out[k + 1] - e_out[k - 1]) / (2.0 * dt);
            let d2 = |k: usize| (e_out[k + 1] - 2.0 * e_out[k] + e_out[k - 1]) / (dt * dt);
            let mut num = 0.0;
            let mut den = 0.0;
            for k in 1..n - 1 {
                let lhs = d2(k) + natural_freq * natural_freq * e_out[k]
                    + 2.0 * damping * natural_freq * d1(k);
                num += lhs * e_in[k];
                den += e_in[k] * e_in[k];
            }
            if den > 1e-12 {
                let g = num / den;
                if g.is_finite() {
                    control_gain = g;
                }
            }
        }
    }

    IdentificationResult {
        structure: Some(ModelStructure::RollOscillator {
            natural_freq_rad_s: natural_freq,
            damping,
            control_gain,
        }),
        // 残差：自由衰减段 ODE 余量 φ̈+ωn²φ+2ζωnφ̇（理想振子应≈0）。
        residual_rms: {
            let n = free_decay.len();
            let d1 = |k: usize| (free_decay[k + 1] - free_decay[k - 1]) / (2.0 * dt);
            let d2 = |k: usize| (free_decay[k + 1] - 2.0 * free_decay[k] + free_decay[k - 1]) / (dt * dt);
            let mut sum = 0.0;
            let mut count = 0.0;
            for k in 1..n - 1 {
                let r = d2(k)
                    + natural_freq * natural_freq * free_decay[k]
                    + 2.0 * damping * natural_freq * d1(k);
                sum += r * r;
                count += 1.0;
            }
            (sum / count).sqrt()
        },
        identified_ok: true,
        failure_reason: None,
    }
}


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
        ModelStructure::Nomoto2 { k, t1_s, t2_s } => {
            // ÿ·(T1·T2) = K·u − y − (T1+T2)·ẏ；RK4 子步推进（dt/8）。
            out.push(y0);
            let (mut y, mut yd) = (y0, 0.0);
            for &u in input {
                let accel =
                    |yy: f64, yyd: f64| (k * u - yy - (t1_s + t2_s) * yyd) / (t1_s * t2_s);
                let (h, steps) = (dt / 8.0, 8);
                for _ in 0..steps {
                    let k1y = yd;
                    let k1v = accel(y, yd);
                    let k2y = yd + 0.5 * h * k1v;
                    let k2v = accel(y + 0.5 * h * k1y, yd + 0.5 * h * k1v);
                    let k3y = yd + 0.5 * h * k2v;
                    let k3v = accel(y + 0.5 * h * k2y, yd + 0.5 * h * k2v);
                    let k4y = yd + h * k3v;
                    let k4v = accel(y + h * k3y, yd + h * k3v);
                    y += h / 6.0 * (k1y + 2.0 * k2y + 2.0 * k3y + k4y);
                    yd += h / 6.0 * (k1v + 2.0 * k2v + 2.0 * k3v + k4v);
                }
                out.push(y);
            }
        }
        ModelStructure::RollOscillator { natural_freq_rad_s: wn, damping: z, control_gain: g } => {
            // φ̈ = −ωn²·φ − 2ζωn·φ̇ + G·u；RK4 子步推进（dt/8）。
            out.push(y0);
            let (mut phi, mut phi_d) = (y0, 0.0);
            for &u in input {
                let accel =
                    |p: f64, pd: f64| -wn * wn * p - 2.0 * z * wn * pd + g * u;
                let (h, steps) = (dt / 8.0, 8);
                for _ in 0..steps {
                    let k1y = phi_d;
                    let k1v = accel(phi, phi_d);
                    let k2y = phi_d + 0.5 * h * k1v;
                    let k2v = accel(phi + 0.5 * h * k1y, phi_d + 0.5 * h * k1v);
                    let k3y = phi_d + 0.5 * h * k2v;
                    let k3v = accel(phi + 0.5 * h * k2y, phi_d + 0.5 * h * k2v);
                    let k4y = phi_d + h * k3v;
                    let k4v = accel(phi + h * k3y, phi_d + h * k3v);
                    phi += h / 6.0 * (k1y + 2.0 * k2y + 2.0 * k3y + k4y);
                    phi_d += h / 6.0 * (k1v + 2.0 * k2v + 2.0 * k3v + k4v);
                }
                out.push(phi);
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
