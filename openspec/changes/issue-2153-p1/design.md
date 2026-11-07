# Design: issue-2153-p1

## 1. 现有资产核验（侦察）

- `rust/control-engine/src/destroyer_hifi.rs`：非线性 3DOF MMG、实际/辨识响应、执行器/船体/扰动通道分段辨识、噪声对比——**复用为升级起点**，非重写。需审查：`iz=0.25*m*L²` 回转半径定义、`area_r=L*0.015` 量纲来源、常量推进力、符号约定。
- `destroyer-simulation.tsx` SimulationEngine 已消费 DestroyerHifiState（WASM 桥已通）。
- `vessel-drives.ts`（六船）：现为各船物理配置/命令映射——收敛方向为纯适配器，物理真值逐步迁入 WASM。
- 公共 sample 路径存在非有限值→0 回退（需删除并分型报告）。

## 2. 内核结构（Rust）

新增 `rust/control-engine/src/sixdof/` 模块（与 destroyer_hifi 并行演进，最终统一）：

- `state.rs`：`TruthState`（NED 位置、单位四元数、6 自由度体速度、辐射状态、执行器状态、专属状态）；`eta_dot = J(eta)·nu`；四元数归一化。
- `dynamics.rs`：`M_RB·ν̇ + C_RB(ν)ν + A_∞·ν̇_r + C_A(ν_r)ν_r + τ_radiation + g(η) = τ_hull + τ_actuator + τ_wind + τ_wave1 + τ_wave2 + τ_special`；`ν_r = ν − ν_current_body`，`ν̇_current_body` 显式进入质量阵左端；`r×F` 统一载荷力矩助手。
- `hull_mmg.rs`：MMG 三次项黏性/准定常（不含附加质量）；低速段 cross-flow + 四象限桨（1–3 m/s smoothstep，两侧同力基准）。
- `actuators.rs`：桨轴动力学（J_s·ω̇、限幅、四象限 T/Q）、舵/鳍/吊舱一阶伺服；功率=Q·ω。
- `radiation.rs`：离线拟合的被动稳定状态空间（精确离散化）。
- `sensor.rs`：采样/噪声/偏置/时延/丢包通道（各随机流独立物理时钟）。
- `integrator.rs`：RK4 dt=1/120；接触细分 `dt≤0.1/√(k/m_eff)`（上限 1/960，超预算显式报错，不裁剪状态）。

首版落地范围（P1）：055 升级 6DOF（heave/roll/pitch 以静水恢复 + 辐射拟合起步），公共合同字段与 run 冻结全量生效；六船在 #2147 接线时逐船迁移。

## 3. run 冻结与错误语义

- run 打开封包 `modelVersion, parameterBundleHash, environmentVersion, sensorVersion, courseVersion, stepId, controllerArtifact, initialState, factorMask, seed`；改参=新 run 或带时间戳事件。
- 输出分类：`non-finite-state` / `physically-infeasible` / `out-of-domain` 三类错误；sample 层删除归零回退，错误运行保留诊断、不计零误差成功。

## 4. 验证策略（issue 验收门槛映射）

- 独立算例（Rust 单测）：质量阵正定；静水平衡（零输入浮态）；自由衰减；无输入能量不增；力矩符号（含横荡-艏摇-横摇耦合垂向作用点）；角度单位；低速过渡区力基准无重复。
- 数值收敛：1/120 vs 1/240 主指标差 <1%（接触工况以细分收敛证据为准）。
- 比较链：真值/带噪测量/估计/学生预测 四通道命名固定（UI 侧 #2148 联动）。
- 参数包齐全 + 适用范围 + 许可证 → 才启用对应正式实验（#2157 联动门）。

## 5. 分阶段与交接

- 阶段 A（本 change 首个实施 PR）：sixdof 模块骨架 + 055 6DOF 升级 + sample 非有限修正 + run 冻结字段 + 上述算例。
- 阶段 B（#2147/#2156/#2157 配合）：六船逐船迁移、环境/传感器链、参数包。
- 实施会话从 tasks.md 未勾项继续；本 change 文档即交接蓝图。
