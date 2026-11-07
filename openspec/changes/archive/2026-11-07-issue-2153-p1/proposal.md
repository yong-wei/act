# Proposal: issue-2153-p1 — 七船物理基座：固定六自由度非线性真值模型合同

- Issue: #2153（P1，父项 #2146；旧 24 步退役 #2155 已完成）
- 类型: 物理内核架构合同与实现（多阶段交付）

## Why

课程负责人定案：七船是七个独立实验，后台长期保留接近工程实际的**六自由度非线性模型**（风浪流、执行器、传感器机制），教学步骤只改现实因素开关/参数与操作权限；低阶传递函数仅作学生辨识与对照。当前差距：055 仍以 3DOF 为主要真值；各船物理/执行器/环境/观测实现不统一；LNG 手动航速直写状态；公共 sample 把非有限值归零。`destroyer_hifi.rs` 已有非线性 3DOF MMG、分段辨识与噪声对照资产，必须复用升级，不得另做 Nomoto 后台。

## What Changes（合同条目，实现分阶段落地）

1. **唯一 TruthPlant 结构**：七船统一 `xTruth=[positionNED, quaternion(4), bodyVelocity(6), radiationStates, actuatorStates, specialistStates]`；Fossen 六自由度动力学 + 辐射记忆；NED/FRD 坐标、SI 单位（rad/kg/N/N·m/W/s）；`etaDot=J(eta)nu`；`nu_current_bodyDot` 入相对加速度。
2. **水动力组合边界**：MMG 船体/桨/舵分离 + 三次项（纵向速度为受力积分所得）；附加质量唯一（不与 MMG 参考叠加）；浮力/重力按湿表面与重心；低速/零速/侧移/倒航用 cross-flow/四象限连续模型（1–3 m/s smoothstep 过渡，禁 `U=max(U,0.1)` 掩盖奇异）；981 半潜辐射/绕射 + 构件黏性（不套舵航向模型）；天鲸钢桩/锚缆/绞刀桥架工况与自由航行分开。
3. **执行器物理子系统**：桨轴 `J_s ω̇=Q_motor−Q_prop−Q_friction`（扭矩/功率/转速/变化率限制、四象限连续）；舵/鳍/吊舱一阶伺服 + 幅值/速率限幅；局部来流含船体速度/角速度/流/波轨/桨后流；功率由扭矩×转速计算。
4. **三层职责固定**：TruthPlant 唯一驱动 3D/轨迹/事件/事后评价；Sensor/Observer 提供带噪测量（不暗用真值）；StudentModel 永不替代真值。关环境不删状态/不改模型类型。
5. **数值合同**：Rust/WASM 唯一在线推进；首版 dt=1/120 RK4，接触按 `dt≤0.1/√(k/m_eff)` 细分至 1/960；控制 20Hz（DP 10Hz）；倍速只改墙钟；run 冻结 `modelVersion/parameterBundleHash/…/seed`；删除非有限→0 回退，分型报告错误。
6. **现有代码处置**：`destroyer_hifi.rs` 复用升级（审查 iz/area_r 量纲、常量推力、符号）；`vessel-drives.ts` 收敛为配置/命令适配器；旧低阶内核仅留作 StudentModel/基准。

## Impact

- Rust 内核（control-engine）、七船驱动与 profile、公共 sample 修正、run 冻结字段。
- 参数生产与校核由 #2157 另立（缺关键参数包可开发验证，但该船不得标高保真验收完成）。
- 分阶段：P1 内核结构 + 055 6DOF 升级 + 公共合同 → 后续逐船接入。

## Non-Goals

- 不虚构实名装备参数为实船校准（P/B/D/T 分级为准）。
- 不删除波浪/回退 3DOF/把噪声加显示层等捷径。
- 不改教学目标、现实因素含义与参数来源等级（课程负责人权限）。
- 本 change 不含参数包生产与逐船校准（#2157/各船专项）。
