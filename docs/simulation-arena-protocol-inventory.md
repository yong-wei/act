# Simulation Scene & Arena Protocol Inventory

基于 `SceneSpec v1`、`EvaluationSpec v1` 和 `SimulationTrace v1` 协议（见 `src/resources/simulations/core/protocol-types.ts`），对当前 7 个 `/simulations/*` 场景和 Arena 黑箱流进行差距盘查。

生成日期：2026-05-25

## 1. 七个仿真场景 → SceneSpec v1

### 1.1 055型驱逐舰 (`destroyer-055`)

| 域 | 状态 | 说明 |
|----|------|------|
| scene | ✓ 已有 | route: `/simulations/destroyer`, standalone 模式 |
| model | ✓ 已有 | Nomoto1stOrder (runtime: destroyer_hifi), K=0.08, T=55 |
| disturbance | ⚠ 部分 | 默认海况 config，无显式 seed；`disturbancePattern: 'normal'`，含波浪/风/流 |
| evaluation | ⚠ 部分 | 有 SimulationMetrics 和 EthicalViolation 阈值，但未包装为 EvaluationSpec v1 |
| assets | ⚠ 部分 | 3D 船模 + 海面着色器，版本管理为隐式 |
| telemetry | ✓ 已有 | recordInterval=0.05s, channels: time/heading/rudder/speed/position |
| replay | ✗ 缺失 | 无显式 seed 或 checksum |
| governance | ✗ 缺失 | 无显式 evidenceSource/privacyLevel/retentionClass |

### 1.2 爱达·魔都号邮轮 (`fleet-cruise-adora`)

| 域 | 状态 | 说明 |
|----|------|------|
| scene | ✓ 已有 | route: `/simulations/cruise` |
| model | ✓ 已有 | RollCoupledNomoto (二阶 + 横摇耦合), K, T1, T2, 减摇鳍 |
| disturbance | ⚠ 部分 | 默认海况，无显式 seed；含舒适度频段 (0.1-0.3Hz) |
| evaluation | ⚠ 部分 | 有 ComfortMetrics + EthicalViolation，未包装为 EvaluationSpec |
| assets | ⚠ 部分 | 邮轮模型 + 减摇鳍可视化 |
| telemetry | ✓ 已有 | recordInterval=0.05s, 含 roll/comfort 通道 |
| replay | ✗ 缺失 | 无显式 seed 或 checksum |
| governance | ✗ 缺失 | 无显式 governance 元数据 |

### 1.3 天鲸号挖泥船 (`fleet-dredger-tianjing`)

| 域 | 状态 | 说明 |
|----|------|------|
| scene | ✓ 已有 | route: `/simulations/dredger` |
| model | ✓ 已有 | Nomoto2ndOrder (二阶 + 时滞), 泥浆浊度模型 |
| disturbance | ⚠ 部分 | 默认海况，无显式 seed |
| evaluation | ⚠ 部分 | 含 TURBIDITY_EXCEEDED 违规，未包装为 EvaluationSpec |
| assets | ⚠ 部分 | 挖泥船模型 |
| telemetry | ✓ 已有 | recordInterval=0.05s |
| replay | ✗ 缺失 | 无显式 seed 或 checksum |
| governance | ✗ 缺失 | 无显式 governance 元数据 |

### 1.4 海洋石油981平台 (`fleet-drill-hysy981`)

| 域 | 状态 | 说明 |
|----|------|------|
| scene | ✓ 已有 | route: `/simulations/drilling` |
| model | ✓ 已有 | SemiSubmersible3DOF (DP 动力定位), 推进器推力分配 |
| disturbance | ⚠ 部分 | 含风/流/浪 + 推进器禁止区域，无显式 seed |
| evaluation | ⚠ 部分 | 含 DP 位置/航向约束 (黄/红警报)，未包装为 EvaluationSpec |
| assets | ⚠ 部分 | 半潜平台模型 |
| telemetry | ✓ 已有 | recordInterval=0.05s, 含 thruster/power 通道 |
| replay | ✗ 缺失 | 无显式 seed 或 checksum |
| governance | ✗ 缺失 | 无显式 governance 元数据 |

### 1.5 雪龙2号破冰船 (`fleet-icebreaker-xuelong2`)

| 域 | 状态 | 说明 |
|----|------|------|
| scene | ✓ 已有 | route: `/simulations/icebreaker` |
| model | ✓ 已有 | Azipod3DOF (吊舱推进), 冰阻力 + stick-slip + 参数摄动 |
| disturbance | ⚠ 部分 | 含冰厚 + 冰阻力随机摄动，但种子未显式暴露 |
| evaluation | ⚠ 部分 | 含 Azipod/冰违规，未包装为 EvaluationSpec |
| assets | ⚠ 部分 | 破冰船模型 + 冰面效果 |
| telemetry | ✓ 已有 | recordInterval=0.05s, 含 azimuth/power 通道 |
| replay | ✗ 缺失 | 无显式 seed 或 checksum。**注意**: ice stick-slip 随机过程使回放依赖 seed |
| governance | ✗ 缺失 | 无显式 governance 元数据 |

### 1.6 长恒系列LNG船 (`fleet-lng-changheng`)

| 域 | 状态 | 说明 |
|----|------|------|
| scene | ✓ 已有 | route: `/simulations/lng` |
| model | ✓ 已有 | Nomoto2ndOrderDelay + SloshingState (液货晃荡耦合) |
| disturbance | ⚠ 部分 | 默认海况，无显式 seed；液货晃荡为内生扰动 |
| evaluation | ⚠ 部分 | 含 SLOSHING_EXCEEDED/PRESSURE_EXCEEDED 违规，未包装为 EvaluationSpec |
| assets | ⚠ 部分 | LNG 船模型 |
| telemetry | ✓ 已有 | recordInterval=0.05s |
| replay | ✗ 缺失 | 无显式 seed 或 checksum |
| governance | ✗ 缺失 | 无显式 governance 元数据 |

### 1.7 MSC集装箱船 (`fleet-container-msc`)

| 域 | 状态 | 说明 |
|----|------|------|
| scene | ✓ 已有 | route: `/simulations/container` |
| model | ✓ 已有 | NomotoVariableMass (变质量), 增益调度 PID, 风载荷 + 横摇 |
| disturbance | ⚠ 部分 | 含风载荷，无显式 seed |
| evaluation | ⚠ 部分 | 含 CARGO_SHIFT_RISK/WIND_SPEED_EXCEEDED 违规，未包装为 EvaluationSpec |
| assets | ⚠ 部分 | 集装箱船模型 |
| telemetry | ✓ 已有 | recordInterval=0.05s |
| replay | ✗ 缺失 | 无显式 seed 或 checksum |
| governance | ✗ 缺失 | 无显式 governance 元数据 |

## 2. Arena 黑箱流 → SimulationTrace v1 + EvaluationSpec v1

### 2.1 Arena 公开实验 / 虚拟预览 / 官方评估

| 协议字段 | 状态 | 说明 |
|----------|------|------|
| envelope.runId | ⚠ 部分 | 有 `ArenaBlackBoxExperiment` id 和 `ArenaVirtualSimulationRun` id |
| envelope.sceneId | ⚠ 部分 | 通过 task → 场景间接关联，未直接编码 |
| envelope.seed | ✗ 缺失 | Arena 运行未记录显式 seed |
| envelope.protocolVersion | ✗ 缺失 | 未声明协议版本 |
| envelope.checksum | ✗ 缺失 | 无 replay checksum |
| samples | ⚠ 部分 | `SimulationLog` / `ArenaSubmission` 含轨迹数据，但格式未统一为 TraceSampleRef |
| summary.metrics | ⚠ 部分 | `ArenaEvaluationRun` 存指标，但键名未与 TraceSummary 对齐 |
| evaluation.metrics | ⚠ 部分 | 各 task 各自定义指标 |
| evaluation.hardConstraints | ⚠ 部分 | 硬约束逻辑在 task 评估器中，未声明为 EvaluationSpec |
| evaluation.visibility | ⚠ 部分 | preview/official 通过 API 路径区分，未在 spec 中显式声明 |
| evaluation.modelRelation | ✗ 缺失 | Arena 黑箱对象常为简化模型，未记录与 3D 场景对象的关系 |

### 2.2 模型关系差距 (Model Relation Gaps)

Arena 黑箱流使用以下简化或代理对象，与对应的 3D 仿真场景模型不一致：

| Arena Task | Arena 黑箱对象 | 对应 3D 场景 | 模型关系 | 教学含义 |
|------------|---------------|-------------|----------|----------|
| 二阶对象快速稳定挑战 | 二阶线性传函 (Matlab 等效) | Nomoto2ndOrder 非线性 (destroyer/container) | **surrogate** | 黑箱为标准线性传函，3D 场景包含非线性水动力导数。Preview 评估结果不能等同于对应 3D 场景的操纵性能 |
| 巡航舒适度挑战 | 横摇耦合简化传函 | RollCoupledNomoto + 减摇鳍 (cruise) | **simplified** | 黑箱不含减摇鳍执行器动力学和舒适度频段模型，不能推断实际邮轮舒适度评级 |
| DP 定位保持挑战 | 3DOF 线性化模型 | SemiSubmersible3DOF + 推力分配 (drilling) | **simplified** | 黑箱不含推进器禁止区域、饱和和非线性推力分配约束 |
| 破冰操纵挑战 | 简化 Nomoto + 冰扰动 | Azipod3DOF + stick-slip 冰阻力 (icebreaker) | **surrogate** | 黑箱的冰扰动为叠加噪声，非物理 stick-slip 模型 |

**差距**: 这些 Arena 对象在评估时未声明 `modelRelation`，导致 preview 和 official 的声明边界不明确。

## 3. 全局差距归纳

| 优先级 | 差距 | 影响范围 | 建议后续 change |
|--------|------|----------|-----------------|
| P0 | 所有 7 场景和 Arena 均缺少 `replay` 域 (seed + checksum) | `make-simulation-runtime-replayable` | #136 |
| P0 | Arena 未记录 `modelRelation` | `unify-arena-preview-adapter-and-model-registry` | #138 |
| P1 | 所有场景和 Arena 缺少 `governance` 域 | `govern-simulation-and-arena-evidence-sources` | #135 |
| P1 | 所有场景缺少 `EvaluationSpec v1` 包装 | `govern-simulation-and-arena-evidence-sources` | #135 |
| P1 | Arena trace 未统一为 `SimulationTrace v1` | `govern-simulation-and-arena-evidence-sources` | #135 |
| P2 | 所有场景的 `assets` 域缺少显式版本管理 | `register-simulations-as-course-resources` | #139 |
| P2 | 场景路由与 course resource id 的别名映射不显式 | `register-simulations-as-course-resources` | #139 |
