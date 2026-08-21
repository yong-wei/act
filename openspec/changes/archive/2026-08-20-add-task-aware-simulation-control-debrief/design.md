## Context

`src/resources/simulations/simulations/cruise-simulation.tsx` 已经维护当前运行身份、完成状态、航向/舵角/减摇鳍功率等状态，并计算课程转向过程的超调、调节时间和最大横向加速度。`cruise/telemetry-bridge.ts` 将这些结果写入带 scene、scenario、model/runtime、runId 和 checksum 的 `SimulationTraceV1` 摘要，但当前摘要中的 `passed` 直接使用界面 `targetForm`，没有区分任务下发阈值与学生自填目标；舵角和功率也是运行结束时的瞬时值，不是峰值或能量。

因此，复盘不能直接把现有 `passed` 或通用固定阈值改写成学习评价，也不能复用 `ai-recommend-panel.tsx` 中以 `settlingTime < 45` 等固定数值生成 good/warning/bad 的做法。首版选择 Cruise 课程转向场景，是因为它同时具备明确完成边界、稳定运行身份、可校验 telemetry 摘要和现有持久化测试，适合作为单场景合同；其他船型的结果和完成语义仍不统一。

## Goals / Non-Goals

**Goals:**

- 为一个完成态合同成熟的 Cruise 场景建立可复用的复盘输入与纯展示模型。
- 严格分开“本次运行已经计算的事实”和“任务合同允许得出的逐项阈值结论”。
- 保留每项指标的来源、单位、测量语义、阈值权威和不可用原因。
- 通过确定性单元/组件测试及浏览器验收覆盖五类关键状态。

**Non-Goals:**

- 不扩展到其他船型、Control Odyssey、通用 Control Workbench 或 Arena 正式提交。
- 不新增或修改 Rust/TypeScript 物理模型、响应指标算法和 task scoring。
- 不生成综合分、最佳方案、控制器自动调参或因果诊断。
- 不把结束时舵角/功率升级为峰值、控制能量或控制约束结论。
- 不在本变更内清理所有既有实验页的启发式文案；仅保证新复盘不复用这些判断。

## Decisions

### 1. 首版固定 Cruise 课程转向场景

受支持身份固定为：

- scene：`sim/cruise`
- scenario：`cruise-comfort-course-turn`
- model：`fleet-cruise-adora`

只有 `state.isCompleted` 为真，且 telemetry summary 的 scene/scenario/model/runId 与当前运行一致并通过校验时，才建立复盘。重置或新启动生成新的 runId，旧复盘不继续挂在当前运行下。该门禁也要求 TelemetryBridge 的完成事件不再由“已有部分 performance”提前触发。

选择单场景适配而不是立即抽象七艘船，是因为其他场景的完成态、聚合指标和控制量含义不同；先固定输入合同可以避免在 UI 层制造一个宽松但不可验证的联合类型。

### 2. 使用纯 debrief projector，不新增指标计算器

新增纯函数把“已验证 run summary + 当前场景完成事实 + 可选任务阈值合同”投影为卡片模型。模型中的每个 metric row 包含：

- metricId、label、value、unit；
- measurementKind（例如 run aggregate、run-end observation）；
- availability 与 unavailableReason；
- 可选 threshold outcome 及其 task/provenance identity。

Projector 只做字段选择、有限数校验和已声明单位的格式化，不从时间序列重新计算超调、调节时间、稳态误差、峰值或能量。这样数值真源仍在现有仿真/telemetry 链路。

### 3. 阈值合同显式携带权威来源

阈值输入使用显式 task identity、metricId、operator、finite value、unit 和 provenance。只有注册任务或课程任务下发的阈值可生成“满足/未满足”。学生在自由探索界面填写的 `targetForm`、硬编码常量和现有聚合 `summary.passed` 不具有该权威。

当任务只约束部分指标时，Projector 只判断这些指标；其他指标继续作为事实。所有判断逐项显示观测值与阈值，不再派生总体状态。相比直接读取 `targetForm`，这一方案增加了一小段适配代码，但可以测试阈值究竟来自哪里，并守住官方评价边界。

### 4. 事实层保留严格测量语义

Cruise 首版可使用：

- `turn_overshoot_percent`：当前转向过程的已计算超调；
- `settling_time_s`：当前转向过程的已计算调节时间；
- `heading_error_deg`：运行结束时航向误差；
- `peak_lateral_accel_g`：运行过程聚合的最大横向加速度；
- `rudder_deg`、`fin_power_kw`：仅作为运行结束时控制量观察。

`heading_error_deg` 不自动改名为稳态误差。只有后续 source contract 提供明确的 steady-state-error 指标时才显示该名称。`rudder_deg` 和 `fin_power_kw` 也不得用于“控制量过大”判断；如果任务要求峰值、能量或执行器约束而来源缺少对应聚合指标，卡片显示不可判断。

### 5. 复盘文案由确定性规则生成

事实说明使用固定、指标特定的学生可读模板，描述测量对象及其可观察含义。阈值说明只复述比较结果。下一次建议最多指向一个可观察变量、曲线或参数实验，不声称已经识别根因，不调用自由文本模型生成结论。

卡片分为“本次运行事实”“任务要求（若有）”“下一次可观察方向”三个区域。响应指标与控制量观察分组展示，以免学生把跟踪质量与执行器负担混为同一结论。

### 6. 验证采用 projector 契约加单场景浏览器验收

单元测试覆盖输入校验、单位/语义、部分阈值、自由探索和禁止词；组件测试覆盖重置/新 run 身份。浏览器验收使用确定性 fixture 覆盖：全部已声明阈值满足、超调未满足、调节时间未满足、控制量缺少可判断语义、运行未完成或无效。

浏览器断言同时检查事实数值、阈值来源、允许文案，以及不出现“表现良好”“需要关注”“优秀”“最优”等综合评价。现有 Cruise telemetry bridge 和 run persistence 测试继续验证 checksum 与持久化兼容。

## Risks / Trade-offs

- [现有 TelemetryBridge 可能在运行完成前发出摘要] → 将 completion/runId/summary validation 作为 debrief 与完成事件的共同门禁，并增加暂停、重置和新运行回归测试。
- [界面 `targetForm` 被误当任务权威] → 阈值 projector 只接受显式 provenance；无 provenance 时保持事实层。
- [结束时控制量被误读为全程负担] → metric registry 固定 `run-end observation` 标签，缺少聚合量时明确不可判断。
- [单场景结构过早泛化] → 首版只建立最小 projector 接口和 Cruise adapter，不创建七船联合 schema。
- [学习建议被理解为因果诊断] → 采用确定性观察性模板，并在测试中拒绝未经计算的根因、优劣和最优表述。

## Migration Plan

该能力只增加完成态投影与界面，不迁移数据库或历史运行。上线时先启用 projector/契约测试，再接入 Cruise 完成事件和卡片；回滚时移除卡片与适配器，既有 trace summary、持久化运行、Arena 和学习证据保持不变。

## Open Questions

无。首版场景、阈值权威、指标语义和非目标已经固定。
