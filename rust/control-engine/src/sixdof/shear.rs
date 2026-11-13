//! 空间剪切流模块（issue-2156 阶段 B2.3）。
//!
//! 合同（issue #2156 §流）：
//! - 基准 C1/C2 保持**空间均匀、时间恒定**水平流；未验证剪切不混入
//!   正式工况——本模块为独立接口，不接入在线物理（接线随 per-vessel
//!   且需受力模型验证）。
//! - 只有满足流场连续性（水平无散）并给出局部速度梯度/涡量的验证
//!   后才开放；不得把均匀无旋流公式直接用于任意剪切。
//!
//! 实现：**平行线性剪切** v(r) = [U + S·(p·r)]·d——流向 d 单位矢量、
//! 垂向 p = d⊥；散度 ∇·v ≡ 0（构造性成立，任意 θ/S），涡量
//! ω_z = ∂v/∂x − ∂u/∂y = −S（常数）。线性场对任意对称域（如船体
//! 外接矩形）的均值恰等于场在域心的值——受力模型用域心来流对线性
//! 剪切是精确的（涡量引起的差动艏摇力矩按 S·L² 量级显式给出量级
//! 上界供接线方验证）。

/// 平行线性剪切流场（构造性无散）。
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ShearCurrentField {
    /// 基础流速模长 U（m/s）。
    pub base_speed_mps: f64,
    /// 流向 θ（NED rad；d = (cosθ, sinθ)）。
    pub direction_rad: f64,
    /// 垂向剪切率 S（1/s；u 沿垂直于流向方向每米的变化）。
    pub shear_per_s: f64,
}

impl ShearCurrentField {
    /// 校验（fail-closed）：参数有限；剪切率在可适用域内（|S| ≤ 0.05/s
    /// ——强剪切需独立验证后另行开放）。
    pub fn validate(&self) -> Result<(), String> {
        if !self.base_speed_mps.is_finite()
            || !self.direction_rad.is_finite()
            || !self.shear_per_s.is_finite()
        {
            return Err("剪切流参数须有限".into());
        }
        if self.base_speed_mps < 0.0 {
            return Err("基础流速须非负".into());
        }
        if self.shear_per_s.abs() > 0.05 {
            return Err(format!(
                "剪切率 {} 超出已验证适用域（|S| ≤ 0.05/s）",
                self.shear_per_s
            ));
        }
        Ok(())
    }

    /// 位置 (x, y) 处的流速（NED m/s）。
    pub fn velocity_at(&self, x_n: f64, y_e: f64) -> [f64; 2] {
        let (sin_t, cos_t) = self.direction_rad.sin_cos();
        let p_dot_r = -sin_t * x_n + cos_t * y_e;
        let magnitude = self.base_speed_mps + self.shear_per_s * p_dot_r;
        [magnitude * cos_t, magnitude * sin_t]
    }

    /// 位置 (x, y) 处的梯度张量 [du/dx, du/dy, dv/dx, dv/dy]（1/s）。
    pub fn gradient_at(&self, _x_n: f64, _y_e: f64) -> [f64; 4] {
        let (sin_t, cos_t) = self.direction_rad.sin_cos();
        // u = (U + S·p·r)·cosθ → du/dx = −S·sinθ·cosθ、du/dy = S·cos²θ
        // v = (U + S·p·r)·sinθ → dv/dx = −S·sin²θ、dv/dy = S·cosθ·sinθ
        [
            -self.shear_per_s * sin_t * cos_t,
            self.shear_per_s * cos_t * cos_t,
            -self.shear_per_s * sin_t * sin_t,
            self.shear_per_s * sin_t * cos_t,
        ]
    }

    /// 水平散度 ∇·v（恒 0——构造性，供数值对账）。
    pub fn divergence_at(&self, x_n: f64, y_e: f64) -> f64 {
        let g = self.gradient_at(x_n, y_e);
        g[0] + g[3]
    }

    /// 涡量 ω_z = ∂v/∂x − ∂u/∂y（常数 = −S）。
    pub fn vorticity_at(&self, _x_n: f64, _y_e: f64) -> f64 {
        -self.shear_per_s
    }

    /// 船体外接矩形域的平均流速：线性场对对称域的均值 = 域心值
    /// （解析精确，非数值近似）。`length_m`/`beam_m` 为域尺度（仅
    /// 供文档语义；均值与尺度无关）。
    pub fn hull_averaged_flow(
        &self,
        x_n: f64,
        y_e: f64,
        _length_m: f64,
        _beam_m: f64,
    ) -> [f64; 2] {
        self.velocity_at(x_n, y_e)
    }

    /// 剪切引起的差动艏摇力矩量级上界（N·m，review 修订含交叉项）。
    ///
    /// 二次阻力假设下沿船长积分 x·½ρCdB·|v|(v)（v = 局部横向流速）
    /// 的包络：交叉项 |U|·|S|·L³/6（基础来流×剪切，弱剪切时主导）
    /// + 自作用项 S²·L⁴/32。供接线方验证受力模型时对账；不是力矩
    /// 公式本身（接线随 per-vessel 专项）。
    pub fn shear_yaw_moment_scale(
        &self,
        length_m: f64,
        beam_m: f64,
        drag_coefficient: f64,
    ) -> f64 {
        let rho = 1025.0;
        let (s_abs, u_abs) = (self.shear_per_s.abs(), self.base_speed_mps.abs());
        let cross = u_abs * s_abs * length_m.powi(3) / 6.0;
        let self_term = s_abs * s_abs * length_m.powi(4) / 32.0;
        0.5 * rho * beam_m * drag_coefficient * (cross + self_term)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 有限差分散度（中心差分）。
    fn fd_divergence(field: &ShearCurrentField, x: f64, y: f64, h: f64) -> f64 {
        let v_xp = field.velocity_at(x + h, y);
        let v_xm = field.velocity_at(x - h, y);
        let v_yp = field.velocity_at(x, y + h);
        let v_ym = field.velocity_at(x, y - h);
        (v_xp[0] - v_xm[0]) / (2.0 * h) + (v_yp[1] - v_ym[1]) / (2.0 * h)
    }

    /// 有限差分涡量（中心差分）。
    fn fd_vorticity(field: &ShearCurrentField, x: f64, y: f64, h: f64) -> f64 {
        let v_xp = field.velocity_at(x + h, y);
        let v_xm = field.velocity_at(x - h, y);
        let v_yp = field.velocity_at(x, y + h);
        let v_ym = field.velocity_at(x, y - h);
        (v_xp[1] - v_xm[1]) / (2.0 * h) - (v_yp[0] - v_ym[0]) / (2.0 * h)
    }

    #[test]
    fn parallel_shear_is_divergence_free_for_any_direction() {
        for deg in [0.0f64, 30.0, 90.0, 135.0, 200.0] {
            let field = ShearCurrentField {
                base_speed_mps: 1.2,
                direction_rad: deg.to_radians(),
                shear_per_s: 0.004,
            };
            field.validate().expect("域内应通过");
            for (x, y) in [(0.0, 0.0), (120.0, -80.0), (-300.0, 450.0)] {
                assert!(
                    field.divergence_at(x, y).abs() < 1e-15,
                    "解析散度恒 0：θ={deg}"
                );
                let fd = fd_divergence(&field, x, y, 0.5);
                assert!(fd.abs() < 1e-6, "有限差分散度≈0：θ={deg} @({x},{y}) = {fd}");
            }
        }
    }

    #[test]
    fn vorticity_is_constant_minus_shear() {
        let field = ShearCurrentField {
            base_speed_mps: 0.8,
            direction_rad: 0.7,
            shear_per_s: 0.01,
        };
        for (x, y) in [(0.0, 0.0), (100.0, 50.0)] {
            assert!((field.vorticity_at(x, y) - (-0.01)).abs() < 1e-15);
            let fd = fd_vorticity(&field, x, y, 0.5);
            assert!((fd - (-0.01)).abs() < 1e-6, "有限差分涡量 = −S：{fd}");
        }
    }

    #[test]
    fn zero_shear_reduces_to_uniform() {
        let field = ShearCurrentField {
            base_speed_mps: 0.5,
            direction_rad: 90.0_f64.to_radians(),
            shear_per_s: 0.0,
        };
        for (x, y) in [(0.0, 0.0), (500.0, -500.0)] {
            let v = field.velocity_at(x, y);
            assert!((v[0]).abs() < 1e-15 && (v[1] - 0.5).abs() < 1e-15, "均匀流恒定：{v:?}");
        }
    }

    #[test]
    fn hull_average_equals_centroid_for_linear_field() {
        let field = ShearCurrentField {
            base_speed_mps: 1.0,
            direction_rad: 0.3,
            shear_per_s: 0.005,
        };
        let center = field.velocity_at(200.0, 100.0);
        // 数值对账：矩形网格采样平均 ≈ 域心值（线性场解析精确）。
        let (l, b, n) = (180.0, 30.0, 41usize);
        let mut sum = [0.0f64; 2];
        for i in 0..n {
            for j in 0..n {
                let x = 200.0 + (i as f64 / (n - 1) as f64 - 0.5) * l;
                let y = 100.0 + (j as f64 / (n - 1) as f64 - 0.5) * b;
                let v = field.velocity_at(x, y);
                sum[0] += v[0];
                sum[1] += v[1];
            }
        }
        let avg = [sum[0] / (n * n) as f64, sum[1] / (n * n) as f64];
        assert!(
            (avg[0] - center[0]).abs() < 1e-9 && (avg[1] - center[1]).abs() < 1e-9,
            "线性场域均值=域心值：avg={avg:?} center={center:?}"
        );
        assert_eq!(field.hull_averaged_flow(200.0, 100.0, l, b), center);
    }

    #[test]
    fn out_of_domain_shear_rejected() {
        let bad = ShearCurrentField {
            base_speed_mps: 1.0,
            direction_rad: 0.0,
            shear_per_s: 0.2, // 超出 |S| ≤ 0.05 已验证域。
        };
        assert!(bad.validate().is_err(), "超域剪切 fail-closed");
        let nan = ShearCurrentField {
            base_speed_mps: f64::NAN,
            direction_rad: 0.0,
            shear_per_s: 0.0,
        };
        assert!(nan.validate().is_err());
    }

    #[test]
    fn shear_yaw_moment_scale_is_finite_and_positive() {
        let field = ShearCurrentField {
            base_speed_mps: 1.0,
            direction_rad: 0.0,
            shear_per_s: 0.01,
        };
        let m = field.shear_yaw_moment_scale(180.0, 25.0, 1.0);
        assert!(m.is_finite() && m > 0.0, "量级上界应有限正：{m}");
        // S=0 → 0（无剪切无力矩项）。
        let uniform = ShearCurrentField { shear_per_s: 0.0, ..field };
        assert_eq!(uniform.shear_yaw_moment_scale(180.0, 25.0, 1.0), 0.0);
    }
}

#[cfg(test)]
mod review_tests {
    use super::*;

    /// 二次阻力差动力矩的数值积分（review 语义）：
    /// M = ∫ x·½ρCdB·|v(x)|·v(x) dx，v(x) = U − S·x（θ=π/2、域心原点）。
    #[test]
    fn moment_scale_bounds_quadratic_drag_integral() {
        let (u, s, l, b, cd) = (1.0f64, 1.0e-4, 100.0, 20.0, 1.0);
        let rho = 1025.0;
        let n = 2000usize;
        let dx = l / n as f64;
        let mut integral = 0.0;
        for i in 0..n {
            let x = -l / 2.0 + (i as f64 + 0.5) * dx;
            let v = u - s * x;
            integral += x * v.abs() * v * dx;
        }
        let m_numeric = 0.5 * rho * cd * b * integral.abs();
        let field = ShearCurrentField {
            base_speed_mps: u,
            direction_rad: std::f64::consts::FRAC_PI_2,
            shear_per_s: s,
        };
        let bound = field.shear_yaw_moment_scale(l, b, cd);
        assert!(
            bound >= m_numeric,
            "上界应覆盖数值积分：bound={bound}, numeric={m_numeric}"
        );
        // 评审复现值量级（≈170,833）：上界不应过度保守（<2×数值）。
        assert!(
            bound < 2.0 * m_numeric,
            "上界不应过度保守：bound={bound}, numeric={m_numeric}"
        );
    }
}
