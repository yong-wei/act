# S175 Capytaine 频域水动力数据库（issue-2157 Capytaine 路径证据）

## 发现与来源

MSS 仓库 `HYDRO/vessels_capytaine/S175/s175.mat`（上游修订
`e8ab42a105cd`，取回 2026-11-09）为**完整一阶频域数据库**：

- `hydrodynamic_source = "Capytaine"`、`hydrodynamic_reference = "CG"`
  ——上游即以 Capytaine 计算（正是 issue #2157 规定的生产路径实证）。
- 内容：6×6×38 频率的附加质量 A / 阻尼 B / 恢复 C、36 航向 RAO、
  MRB 质量矩阵、主尺度（Lpp=175/B=25.4/**T=9.5**/∇=23973/Cb=0.568/
  GM_T=0.98）。
- 本地隔离环境已装 **capytaine==2.2.1**（项目锁定版本）+ meshio；
  自行求解待 per-vessel 网格生成（`solve_first_order.py` 为管线模板）。

## 导出与机器校验

- `rust/control-engine/tests/fixtures/s175_hydrodb.json`：A/B/C/MRB/
  主尺度全量导出（64KB）。
- `rust/control-engine/tests/sixdof_s175_hydrodb.rs`（6 用例全绿）：
  1. 来源标识（Capytaine/CG）与同船性（Lpp=175）
  2. **C44 = ρg∇·GM_T 恒等式 <0.1%**（1025·9.81·23973·0.98 = 2.362e8 ✓）
  3. C33 → 水线面积系数 Cw ∈ (0.5, 0.95)
  4. 横摇固有周期（含 A44）∈ (15, 25)s——实测 18.1s
  5. 垂荡附加质量比：瘦长船带 (1.5, 3.0)×m 且随 ω 下降（实测
     2.56@0.1 → 1.92@0.37）
  6. MRB 对角一致性 + 全频段 A 对角有限正、B44 峰值量级

## 装载差异声明（不跨装载对比）

数据库为 T=9.5m 满载（∇=23973、GM_T=0.98）；`container.m` 时域基准
为 T=8.5m（GM≈0.3）。同一 S175 船的**不同装载工况**——两者各自验证
身份与量级，不直接对比数值。

## 后续（#2157 Capytaine 路径完成定义的剩余部分）

per-vessel 网格生成（七船教学几何）→ 自行 BEM 求解 → 一阶系数入
`model-data` 参数包（与 #2157 §2 生产路径闭环）。
