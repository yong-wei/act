//! 差频二阶波浪载荷（QTF）内核——Newman 近似（issue-2156 阶段 B2.1）。
//!
//! 合同（issue #2156）：
//! - 二阶平均/低频载荷由 QTF 计算；QTF 未就绪不得伪造慢漂。本模块交付
//!   **Newman 近似机制**与系数表接入：对角项 T(ω,μ) 为平均漂移系数，
//!   非对角项按 √(TᵢTⱼ) 组合（Newman 1974，低差频适用域）。
//! - 零速半潜平台（#2161）后续由 NEMOH v3 离线差频 QTF 供给对角表；
//!   巡航船含前进速度的完整 QTF 在有验证数据前保持 not_ready（不开放、
//!   不以静止 RAO 换遭遇频率冒充）。
//! - T 级教学标称表显式标注来源等级，不伪装实船/NEMOH 校准。
//!
//! 数值形态：Newman 双重和可恒等折叠为单次复数累加——
//! F(t) = Σᵢⱼ √(TᵢTⱼ)·aᵢaⱼ·cos(θᵢ−θⱼ) = |Σᵢ √Tᵢ·aᵢ·e^{iθᵢ}|²，
//! 对角项 θᵢ−θᵢ=0 恒为均值贡献：mean(F) = Σᵢ Tᵢ·aᵢ²（表值约定）。
//! 与波面/一阶载荷共用同一分量相位（同相、可追踪），关闭二阶不改波面序列。

use serde::{Deserialize, Serialize};

/// 系数表来源等级（issue #2156：参数来源分级）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "source")]
pub enum TableProvenance {
    /// T 级教学标称（形状/量级供教学，不代表实船或求解器校准）。
    TeachingNominal,
    /// B 级：NEMOH 离线差频求解（版本与运行引用可追溯）。
    Nemoh { version: String, run_ref: String },
}

/// 差频对角系数表 T(ω, μ_rel)（水平面三通道）。
///
/// 单位约定：通道平均力 = Σᵢ Tᵢ·aᵢ²（对角贡献；a 为波幅 m），
/// surge/sway 为 N/m²、yaw 为 N·m/m²。`dirs_rel_rad` 为波传播方向相对
/// 船体 x 轴的夹角（0 = 沿船艏向传播）。表值必须非负（Newman 平方根
/// 要求正定对角；符号变化需完整 QTF，不在本近似域）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeanDriftTable {
    /// 频率网格（升序，rad/s）。
    pub freqs_rad_s: Vec<f64>,
    /// 相对方向网格（rad）。
    pub dirs_rel_rad: Vec<f64>,
    /// surge 系数（Nf × Nd，行主序）。
    pub surge: Vec<f64>,
    /// sway 系数（Nf × Nd）。
    pub sway: Vec<f64>,
    /// yaw 系数（Nf × Nd）。
    pub yaw: Vec<f64>,
    pub provenance: TableProvenance,
}

impl MeanDriftTable {
    /// 网格与数值校验（fail-closed）：升序网格、非负有限值、维度一致。
    pub fn validate(&self) -> Result<(), String> {
        let nf = self.freqs_rad_s.len();
        let nd = self.dirs_rel_rad.len();
        if nf < 2 || nd < 2 {
            return Err("系数表网格至少 2×2".into());
        }
        if !self.freqs_rad_s.windows(2).all(|w| w[0] < w[1]) {
            return Err("频率网格必须严格升序".into());
        }
        if !self.dirs_rel_rad.windows(2).all(|w| w[0] < w[1]) {
            return Err("方向网格必须严格升序".into());
        }
        for (name, block) in [("surge", &self.surge), ("sway", &self.sway), ("yaw", &self.yaw)] {
            if block.len() != nf * nd {
                return Err(format!("{name} 维度 {nf}×{nd} 不符（{}）", block.len()));
            }
            if block.iter().any(|v| !v.is_finite() || *v < 0.0) {
                return Err(format!("{name} 系数须非负有限（Newman 正定对角）"));
            }
        }
        Ok(())
    }

    /// 双线性插值查表：返回 [surge, sway, yaw]（越界钳位到边缘）。
    pub fn lookup(&self, omega: f64, mu_rel: f64) -> [f64; 3] {
        let lookup_block = |block: &[f64]| -> f64 {
            let nf = self.freqs_rad_s.len();
            let nd = self.dirs_rel_rad.len();
            // 频率方向索引（升序网格，钳位）。
            let fi = locate(&self.freqs_rad_s, omega);
            let di = locate(&self.dirs_rel_rad, mu_rel);
            let (i0, i1) = (fi.min(nf - 2), fi.min(nf - 2) + 1);
            let (j0, j1) = (di.min(nd - 2), di.min(nd - 2) + 1);
            let f0 = self.freqs_rad_s[i0];
            let f1 = self.freqs_rad_s[i1];
            let d0 = self.dirs_rel_rad[j0];
            let d1 = self.dirs_rel_rad[j1];
            let tf = ((omega - f0) / (f1 - f0).max(1e-12)).clamp(0.0, 1.0);
            let td = ((mu_rel - d0) / (d1 - d0).max(1e-12)).clamp(0.0, 1.0);
            let v00 = block[i0 * nd + j0];
            let v01 = block[i0 * nd + j1];
            let v10 = block[i1 * nd + j0];
            let v11 = block[i1 * nd + j1];
            (v00 * (1.0 - tf) + v10 * tf) * (1.0 - td) + (v01 * (1.0 - tf) + v11 * tf) * td
        };
        [lookup_block(&self.surge), lookup_block(&self.sway), lookup_block(&self.yaw)]
    }

    /// T 级教学标称表（半潜平台水平面慢漂量级；γ 峰附近的双 bump 形状
    /// 为教学假设，不代表 NEMOH 校准——来源等级显式 TeachingNominal）。
    ///
    /// 量级参考：ρgB ≈ 1025·9.81·40 ≈ 4.0e5 N/m，乘 κ(ω) 峰值 0.05 →
    /// 对角 ~2e4 N/m²；Hs=1.5（Σa²/2=Hs²/16≈0.14）时均值漂移 ~10³ N 量级。
    pub fn teaching_nominal_semi_sub() -> Self {
        let freqs: Vec<f64> = (0..13).map(|i| 0.2 + 0.2 * i as f64).collect(); // 0.2..2.6
        let dirs: Vec<f64> = (-6..=6).map(|j| j as f64 * 15.0_f64.to_radians()).collect();
        let nf = freqs.len();
        let nd = dirs.len();
        let kappa = |w: f64| {
            // 教学形状：峰值频段集中（ω≈ωp(V1)、σ=0.25 覆盖谱峰两侧）。
            // 差频慢漂由**峰区分量对的差值**激发：谱峰展宽 ~0.2 rad/s →
            // 慢漂周期 20–60s ≫ 峰周期 7s。底值压到可忽略，避免宽带
            // 差频混入快变纹波。（半潜漂移系数实际峰位随船体共振移动，
            // T 级表取峰区；NEMOH 表接入后按求解结果替换。）
            0.0005 + 0.05 * (-(w - 0.9).powi(2) / (2.0 * 0.25 * 0.25)).exp()
        };
        let rho_g_b = 1025.0 * 9.81 * 40.0;
        let mut surge = Vec::with_capacity(nf * nd);
        let mut sway = Vec::with_capacity(nf * nd);
        let mut yaw = Vec::with_capacity(nf * nd);
        for &w in &freqs {
            for &mu in &dirs {
                // 传播方向投影：沿体轴传播 → surge 主导；横交 → sway/yaw。
                let c = mu.cos();
                let s = mu.sin();
                let base = rho_g_b * kappa(w);
                surge.push(base * c * c);
                sway.push(base * s * s);
                yaw.push(0.25 * base * c.abs() * s.abs() * 60.0); // 力臂 60 m（T 级）。
            }
        }
        Self {
            freqs_rad_s: freqs,
            dirs_rel_rad: dirs,
            surge,
            sway,
            yaw,
            provenance: TableProvenance::TeachingNominal,
        }
    }
}

/// 升序网格定位（返回 ≤value 的最大区段左端索引；越界钳位）。
fn locate(grid: &[f64], value: f64) -> usize {
    match grid.binary_search_by(|probe| probe.partial_cmp(&value).unwrap()) {
        Ok(i) => i,
        Err(i) => i.saturating_sub(1),
    }
}

/// Newman 差频二阶载荷（水平面三通道 + 零垂荡/横摇/纵摇）。
///
/// 分量取自 `field`（与波面/一阶载荷同源同相）；`yaw` 为船体航向
/// （NED rad）。返回 [Fx, Fy, Fz, K, M, N]。O(N) 复数累加恒等于
/// Newman 双重和。
pub fn newman_difference_loads(
    field: &crate::sixdof::wave::WaveField,
    t: f64,
    x_n: f64,
    y_e: f64,
    yaw: f64,
    table: &MeanDriftTable,
) -> [f64; 6] {
    let mut re = [0.0f64; 3];
    let mut im = [0.0f64; 3];
    for c in field.components() {
        let theta =
            c.omega * t - c.k * (x_n * c.direction.cos() + y_e * c.direction.sin()) + c.phase;
        let (sin_t, cos_t) = theta.sin_cos();
        // 相对传播方向（波传播方向 − 航向）。
        let mu_rel = wrap_pi(c.direction - yaw);
        let t123 = table.lookup(c.omega, mu_rel);
        for ch in 0..3 {
            if t123[ch] <= 0.0 {
                continue;
            }
            let w = c.amplitude * t123[ch].sqrt();
            re[ch] += w * cos_t;
            im[ch] += w * sin_t;
        }
    }
    let mut loads = [0.0f64; 6];
    for ch in 0..3 {
        loads[ch] = re[ch] * re[ch] + im[ch] * im[ch];
    }
    // 第 3 通道为 yaw 力矩（下标 5）；垂荡通道（下标 2）保持 0。
    loads[5] = loads[2];
    loads[2] = 0.0;
    loads
}

/// Newman 近似的解析均值（对角和）：mean(F_c) = Σᵢ T_c(ωᵢ,μᵢ_rel)·aᵢ²。
/// 与 `newman_difference_loads` 同一表值约定；供时间平均收敛性对账。
pub fn newman_mean_loads(
    field: &crate::sixdof::wave::WaveField,
    yaw: f64,
    table: &MeanDriftTable,
) -> [f64; 6] {
    let mut loads = [0.0f64; 6];
    for c in field.components() {
        let mu_rel = wrap_pi(c.direction - yaw);
        let t123 = table.lookup(c.omega, mu_rel);
        loads[0] += t123[0] * c.amplitude * c.amplitude;
        loads[1] += t123[1] * c.amplitude * c.amplitude;
        loads[5] += t123[2] * c.amplitude * c.amplitude;
    }
    loads
}

fn wrap_pi(a: f64) -> f64 {
    let two_pi = 2.0 * std::f64::consts::PI;
    let mut v = a;
    while v > std::f64::consts::PI {
        v -= two_pi;
    }
    while v < -std::f64::consts::PI {
        v += two_pi;
    }
    v
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn teaching_table_validates() {
        let table = MeanDriftTable::teaching_nominal_semi_sub();
        table.validate().expect("T 级表应通过校验");
        assert_eq!(table.provenance, TableProvenance::TeachingNominal);
    }

    #[test]
    fn negative_diagonal_rejected() {
        let mut table = MeanDriftTable::teaching_nominal_semi_sub();
        table.surge[0] = -1.0;
        assert!(table.validate().is_err(), "负对角须 fail-closed");
    }

    #[test]
    fn lookup_clamps_out_of_domain() {
        let table = MeanDriftTable::teaching_nominal_semi_sub();
        // 越界频率钳到边缘，仍返回有限非负值。
        let v_low = table.lookup(0.01, 0.0);
        let v_high = table.lookup(9.9, 0.0);
        assert!(v_low.iter().chain(v_high.iter()).all(|v| v.is_finite() && *v >= 0.0));
    }
}
