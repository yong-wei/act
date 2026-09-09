## MODIFIED Requirements

### Requirement: Stage duration mismatches receive targeted automatic correction

BOPPPS 阶段生成的时长类校验失败 SHALL 获得针对性的自动 correction：原始生成 prompt SHALL 声明权威阶段时长，并要求输出前自检 `stage.minutes` 等于 `steps[].minutes` 之和；步骤时长总和不一致 SHALL 被规范化为 correction 可处理的错误并携带实际值与目标值；可行时 correction SHALL 给出保持原步骤数量与原时长比例的正整数分配；不可行时 SHALL 允许合并或减少步骤；每个阶段 attempt SHALL 保持一次 ORIGINAL + 一次 CORRECTION 的调用上限。

#### Scenario: 原始生成携带时长一致性约束

- **WHEN** worker 构造 BOPPPS 阶段生成请求
- **THEN** 请求 SHALL 给出权威阶段时长
- **AND** system prompt SHALL 明确要求 `stage.minutes` 严格等于该阶段所有 `steps[].minutes` 之和，并在输出前重新加总核对
- **AND** prompt version SHALL 标记为 `smart-lesson-plan.v3`，schema 版本保持不变。

#### Scenario: 步骤时长总和不一致被规范化

- **WHEN** 阶段输出的步骤时长总和不等于阶段时长，产生 message 形如 `stage-step-duration-mismatch:<actual>:<expected>` 的 schema 校验 issue
- **THEN** worker SHALL 把该 issue 规范化为 code `stage-step-duration-mismatch` 的 correction 可处理错误
- **AND** 持久化的 validation receipt 与 correction 行为 SHALL 使用同一规范化错误。

#### Scenario: Correction 收到具体时长修正约束

- **WHEN** `stage-step-duration-mismatch` 是该次校验的唯一错误并触发自动 correction，且可从候选步骤导出可行的正整数分配
- **THEN** correction context SHALL 携带阶段名称、实际步骤时长总和、目标阶段时长，以及与原步骤数量相同、总和等于目标、优先保持原时长比例的 `durationAllocation`
- **AND** correction 要求 SHALL 保持步骤数量、顺序、标题、教学活动、评价内容与 `sourceBindings` 不变，先按该分配设置 `steps.minutes`，每个步骤时长为正整数且总和严格等于目标阶段时长，不扩展教学语义。

#### Scenario: 无法导出可行分配时允许减少步骤

- **WHEN** `stage-step-duration-mismatch` 是该次校验的唯一错误，但候选步骤数量大于目标时长或无法导出正整数分配
- **THEN** correction context SHALL 省略 `durationAllocation`
- **AND** correction 要求 SHALL NOT 锁定原步骤数量，允许合并或减少步骤，同时保留教学语义、顺序与 `sourceBindings`
- **AND** 修正后 `stage.minutes` 与所有 `steps.minutes` 之和仍必须严格相等，且每个 minutes 为正整数。

#### Scenario: 时长信息无法可靠解析或并存其他校验错误时诚实退化

- **WHEN** 错误 message 不携带可解析的实际值/目标值，权威 outline 阶段时长不可得，或该次校验还并存其他 schema 错误
- **THEN** correction SHALL 退化使用通用 schema 修正提示
- **AND** SHALL NOT 猜测或伪造时长数值。

#### Scenario: 审计与调用上限不变

- **WHEN** 一次 ORIGINAL attempt 后触发 CORRECTION attempt
- **THEN** 两个 attempt SHALL 独立持久化并以 `correctsAttemptId` 关联，原始输出与 validation receipt SHALL 保留不被覆盖
- **AND** 阶段 SHALL NOT 获得第二次 CORRECTION 调用。
