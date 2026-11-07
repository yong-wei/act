//! 辐射记忆状态空间（issue-2153-p1 A1.5）。
//!
//! Cummins 辐射记忆以带零点一阶环节组实现（每模态状态 `ẋ = A·x + B·u`，
//! 输出记忆力 `τ_memory = Σ C·(B·u + A·x)`，即 `H(s) = C·B·s/(s+|A|)`）。
//! 恒定速度下稳态记忆为零（Cummins 合同：记忆由速度变化激励），
//! 高频极限为等效阻尼 `D = C·B`。合同（issue §2/§2.1）：
//! - 被动、稳定：A < 0，且一阶环节正实（无源）条件 `(-A)·B·C ≥ 0`；
//! - **不含 D 直通项**：`A_inf` 已在质量阵左端（dynamics），此处再放 D
//!   即重复计入（载荷不重复合同）；
//! - 精确离散化：ZOH 解析式 `x⁺ = e^{A·dt}·x + (e^{A·dt} − 1)/A · B·u`。

/// 一阶辐射环节（拟合自离线水动力数据，参数包提供）。
#[derive(Debug, Clone, Copy)]
pub struct RadiationMode {
    /// 连续时间极点（负值，被动稳定）。
    pub a: f64,
    pub input_gain: f64,
    pub output_gain: f64,
    /// 作用通道（0..5：surge/sway/heave/roll/pitch/yaw）。
    pub channel: usize,
}

#[derive(Debug, Clone)]
pub struct RadiationModel {
    pub modes: Vec<RadiationMode>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum RadiationModelError {
    UnstableMode { index: usize, a: f64 },
    NotPassive { index: usize },
    InvalidChannel { index: usize, channel: usize },
}

impl RadiationModel {
    /// 校核被动稳定合同；不接受违背项（fail-closed）。
    pub fn validate(&self) -> Result<(), RadiationModelError> {
        for (index, mode) in self.modes.iter().enumerate() {
            if !(mode.a < 0.0) || !mode.a.is_finite() {
                return Err(RadiationModelError::UnstableMode { index, a: mode.a });
            }
            if !((-mode.a) * mode.input_gain * mode.output_gain >= 0.0) {
                return Err(RadiationModelError::NotPassive { index });
            }
            if mode.channel >= 6 {
                return Err(RadiationModelError::InvalidChannel { index, channel: mode.channel });
            }
        }
        Ok(())
    }

    pub fn state_len(&self) -> usize {
        self.modes.len()
    }

    /// ZOH 精确离散一步（`u` 为本步恒定的相对速度输入；`x_next` 由调用方
    /// 提供缓冲，长度须等于 `state_len()`）。返回 6 通道辐射记忆力
    /// `τ = C·(B·u + A·x⁺)`（恒速稳态为零、高频阻尼 C·B）。
    pub fn step_into(&self, x: &[f64], x_next: &mut [f64], u: [f64; 6], dt: f64) -> [f64; 6] {
        let mut tau = [0.0f64; 6];
        for (index, mode) in self.modes.iter().enumerate() {
            let exp = (mode.a * dt).exp();
            let x_k = x.get(index).copied().unwrap_or(0.0);
            let u_k = u[mode.channel];
            // ZOH 精确离散：x⁺ = e^{A·dt}·x + (e^{A·dt} − 1)/A · B·u
            let next = exp * x_k + (exp - 1.0) / mode.a * mode.input_gain * u_k;
            if let Some(slot) = x_next.get_mut(index) {
                *slot = next;
            }
            // 输出带零点：τ = C·(B·u + A·x⁺)；恒 u 稳态 x→B·u/(−A) ⇒ τ→0。
            tau[mode.channel] += mode.output_gain * (mode.input_gain * u_k + mode.a * next);
        }
        tau
    }

    /// 与给定速度场一致的稳态记忆（初值预热：从巡航初速直接开始的
    /// 运行必须预载，否则瞬态表现为虚假冲击力）。
    pub fn steady_state(&self, u: [f64; 6]) -> Vec<f64> {
        self.modes
            .iter()
            .map(|mode| mode.input_gain * u[mode.channel] / (-mode.a))
            .collect()
    }

    /// 便利形式：返回新状态向量。
    pub fn step(&self, x: &[f64], u: [f64; 6], dt: f64) -> (Vec<f64>, [f64; 6]) {
        let mut x_next = vec![0.0; self.modes.len()];
        let tau = self.step_into(x, &mut x_next, u, dt);
        (x_next, tau)
    }
}
