# Wageningen B4-70 四象限基准证据（issue-2157 阶段 B 路径 4）

## 来源（可追溯）

- 论文：Smogeli, Ø.N. (2006)《Control of Marine Propellers: From Normal to
  Extreme Conditions》NTNU PhD 2006:187，ISBN 82-471-8147-9。
  https://assor.folk.ntnu.no/PhD%20Thesis/Smogeli_PhD_Thesis.pdf （取回 2026-11-09，
  本目录存档原件 `Smogeli_PhD_Thesis.pdf`，322 页）。
- Fourier 系数：附录 A **表 A.3**（a-3 页），原始来源 van Lammeren et al. (1969)。
- 模型方程：§2.1.2 式 2.31–2.38（CT/CQ 定义、β 进角、KT/KQ 转换）。
- 交叉验证锚点：表 A.1（KT0=0.445、KQ0=0.0666、KT0r=0.347、KQ0r=0.0628、
  系桩 490 kN/295 kNm/2.05 rps/3800 kW）。

## 转录

`rust/control-engine/src/sixdof/benchmark_b470.rs`：AT/BT/AQ/BQ 各 21 值
（k=0…20）逐值转录自表 A.3；β = atan2(Va, 0.7πnD)（issue 合同规定 atan2
保证倒车进入正确 Fourier 象限）；Ta/Qa 由 CT/CQ×V0.7² 标尺给出。

再提取核对：`pdftotext Smogeli_PhD_Thesis.pdf - | grep -a "Table A.3"` 附带
上下文即可对照表 A.3（PDF 文本层保留全部数值）。

## 验证锚点（tests/sixdof_benchmark_b470.rs）

- β=0（系桩）→ KT0/KQ0 与表 A.1 偏差 <0.5%
- β=π（倒车系桩）→ |KT0r|/|KQ0r| 偏差 <1%，推力为负
- 系桩工况量纲载荷：T≈490 kN、Q≈295 kNm、P≈3800 kW 均在表 A.1 的 2-3% 内
- KT 双口径一致（量纲载荷反推 = 式 2.37 转换，<1e-12）
- n→0⁺/⁻ 极限一致、n=0&Va=0 严格零、风车状态（n=0, Va>0）推力为负
- 前进/倒车/倒航象限符号贯通，β 全周期 CT/CQ 有界（图 2.2 量级带）

## 边界（issue 合同）

- 不把前进象限 KT(J) 二次式外推至倒航（Fourier 级数原生四象限）。
- 不将 FPP 系列不同 P/D 误当单 CPP 变螺距——本表仅对应附录 A 的单一
  定义（van Lammeren 1969 参数化，与 Oosterveld & van Oossanen 1975 的
  KT0=0.455 存在已知差异，见附录 A 说明，论文选用前者）。
