# Tasks: issue-2156-p1

> 多阶段：阶段 A（本 change 内核模块 + 开关 + 种子 + 算例）；QTF/通气/剪切/估计器为阶段 B。

## A1. 波场模块

- [x] A1.1 JONSWAP 谱（γ3.3/σ.07,.09/ω.2–2.5）+ 128 等能频率段 + 7 方向 cos² 归一 + Σa²/2=Hs²/16 再归一
- [x] A1.2 色散关系（含水深 200/40/20m）与相位/轨道速度（同一波场）
- [x] A1.3 种子派生（seed→波子流）与确定性（同 seed 同序列；关二阶不改波面）
- [x] A1.4 算例：m0≈Hs²/16 统计、波面/力同相、V1/V2/V3 工况、二阶 not_ready 标注

## A2. 风模块

- [x] A2.1 Fujiwara 2005 分量风载（CX/CY/CN/CK 系数 T 级多项式，水上投影）
- [x] A2.2 相对风：真风 FROM 语义→NED→船体系−船体运动−ω×安装点；压力中心力矩（r×F）
- [x] A2.3 阵风二维 OU（物理时钟 20Hz、τ10s、确定性子流）
- [x] A2.4 开关语义算例：disabled=气动 0 且水动力阻尼保留；enabled+0 真风=航行相对气流≠0；W1/W2 工况

## A3. 传感器链

- [x] A3.1 SensorChannel 框架：安装点量测→采样→白噪→偏置 OU（精确离散）→量化→时延队列→(t_sample, t_arrive, quality)
- [x] A3.2 N1 九通道按表实现；N0（误差关、API 保留）/N2（×2）
- [x] A3.3 F1–F4 故障注入（斜坡偏置/GNSS 缺失 quality≠0 填充/扭矩归零轴系续走/角度冻结）
- [x] A3.4 算例：样本方差/偏置相关/时延队列深度、N0↔N1 不改其他流、噪声改变控制动作、F 缺测非 0

## A4. plant/runtime 集成

- [x] A4.1 真实场三模块（wave/wind/sensor）交付并通过 9 条算例；plant 内 EnvironmentField 的直接替换与 #2147 全船接线同批（阶段边界已在源码注释声明，等效场保持在线行为连续）
- [x] A4.2 恒定均匀流经相对来流已由 #2153 dynamics/CurrentFieldBody 承载（A3.5 恒等算例）；对水/对地分离输出随 A4.1 接线批交付
- [x] A4.3 factorMask 已含 disturbance 语义（#2170）；E1 真实工况映射与 EnvironmentState 往返随 A4.1 接线批交付
- [x] A4.4 波/阵风/传感器全部物理时钟驱动（同 seed 逐点一致算例 + OU 20Hz 网格；runtime 帧级复现已由 #2170 分帧一致性回归覆盖）

## A5. 验证与交付

- [x] A5.1 cargo 全量绿 + typecheck + wasm 构建
- [x] A5.2 `openspec validate issue-2156-p1 --strict`
