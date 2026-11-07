# Tasks: issue-2153-p1

> 多阶段交付：本 change 覆盖合同落地与阶段 A（055 6DOF + 公共合同）；六船逐船迁移随 #2147/#2156/#2157 推进，未完成项保持未勾。

## A1. 内核结构（Rust sixdof 模块）

- [x] A1.1 `state.rs`：TruthState（NED/单位四元数/6DOF 体速度/辐射/执行器/专属）、`J(eta)` 运动学、四元数归一化
- [x] A1.2 `dynamics.rs`：Fossen 六自由度方程组装（含 `ν̇_current_body` 项、统一 `r×F` 载荷力矩）
- [x] A1.3 `hull_mmg.rs`：MMG 三次项 + 低速 cross-flow/四象限连续过渡（1–3 m/s smoothstep，力基准无重复）
- [x] A1.4 `actuators.rs`：桨轴动力学（J_s·ω̇/限幅/四象限）、舵/鳍/吊舱伺服、功率=Q·ω
- [x] A1.5 `radiation.rs`：被动稳定状态空间 + 精确离散化
- [x] A1.6 `integrator.rs`：RK4 1/120 + 接触细分（≤1/960，超预算显式报错）

## A2. 055 升级与公共修正

- [ ] A2.1 destroyer_hifi 资产审查（iz 回转半径、area_r 量纲、常量推力、符号）并并入 sixdof 或桥接
- [x] A2.2 055 TruthPlant 升级 6DOF（heave/roll/pitch 起步：静水恢复 + 辐射拟合）
- [x] A2.3 删除公共 sample 非有限值→0 回退，改三类错误报告（non-finite/infeasible/out-of-domain）
- [ ] A2.4 run 冻结字段全量生效（modelVersion/parameterBundleHash/environmentVersion/sensorVersion/courseVersion/stepId/controllerArtifact/initialState/factorMask/seed）
- [x] A2.5 `vessel-drives.ts` 标注收敛为适配器（物理真值迁移计划落档）

## A3. 独立算例与门槛

- [x] A3.1 质量阵正定、静水平衡、自由衰减、无输入无增能算例
- [x] A3.2 力矩符号（横荡-艏摇-横摇耦合垂向作用点）与角度单位算例
- [x] A3.3 低速过渡区（0/侧移/倒航）无奇异、无重复阻力算例
- [x] A3.4 1/120 vs 1/240 主指标差 <1% 收敛证据；暂停/继续与不同帧率同一时刻不变性算例（跨 CPU 容差比较）
- [ ] A3.5 恒定流不叠加同义流扰动力、一阶波浪激励不与瞬时波面积分重复计入的载荷分项算例
- [x] A3.6 命令/实际执行器分离（命令≠实际；全速到停船/侧向受流/推进器故障/零速鳍失效由方程产生）

## A4. 联动与验收

- [ ] A4.1 真值/测量/估计/学生预测四通道命名统一（与 #2148 对齐）
- [ ] A4.2 参数包齐全门（#2157）接入前，对应船不标高保真验收完成
- [ ] A4.3 wasm 构建 + 前端消费冒烟 + typecheck/test 全绿
- [ ] A4.4 `openspec validate --strict` 随最终实施 PR 归档
