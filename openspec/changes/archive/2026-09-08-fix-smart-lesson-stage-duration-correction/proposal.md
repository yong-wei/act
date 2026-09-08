## Why

真实 Provider（siliconflow `Qwen/Qwen3.5-35B-A3B`）下 SmartLesson BOPPPS 阶段生成的 smoke 暴露：任务、generation job、worker 和 provider 调用全部正常，但部分阶段输出无法通过 schema 校验，correction 后仍失败（`provider-output-invalid-after-correction`），job 进入 `RETRYABLE`，draft 无法到达 `READY`。既有复现：SMOKE-r2 `OBJECTIVES` `stage-step-duration-mismatch:3:5`，SMOKE-r3 `BRIDGE_IN` `stage-step-duration-mismatch:4:8`。

仓库事实证实的根因链（`origin/integration@e1c25fffe6`）：

1. schema 的步骤时长一致性约束由 `createBopppsStageSchema` 的 `superRefine` 以 Zod custom issue 表达，message 形如 `stage-step-duration-mismatch:<步骤和>:<阶段时长>`、path 为 `steps`（`src/lib/smart-lesson-plan/schema.ts:103-112`）。`validateSmartLessonProviderOutput` 把 Zod issue 逐字透传进 receipt，`code` 字段是 `custom`，语义只存在于 message（`src/lib/smart-lesson-plan/provider-runtime.ts:317-341`）。
2. worker 的 correction 上下文只识别门禁层 `stage-duration-mismatch`（SmartLessonPlanError code），不解析 schema 层 message 中的实际值/目标值；对步骤时长总和错误，`buildCorrectionContext` 返回 `null`，correction 请求退化为无上下文的通用 schema 修正提示（`src/lib/smart-lesson-plan/worker.ts:588-606`）。
3. 原始生成 prompt（system/prompt）从未声明 `stage.minutes = sum(steps[].minutes)` 约束，模型自然产出不一致输出（`src/lib/smart-lesson-plan/worker.ts:427-428`）。

三层叠加：模型不知道约束 → 校验失败 → correction 不知道该修什么 → 一次 CORRECTION 用尽后仍失败 → RETRYABLE。

## What Changes

- 原始阶段生成 system prompt 明确要求每个 BOPPPS 阶段满足 `stage.minutes` 严格等于 `steps[].minutes` 之和。
- schema 校验失败时，worker 把 message 匹配 `^stage-step-duration-mismatch:\d+:\d+$` 的 custom issue 规范化为 correction 可处理的 `stage-step-duration-mismatch` 错误（保留实际值/目标值）。
- `buildCorrectionContext` 解析该错误并传递：阶段名称、实际步骤时长总和、目标阶段时长（以已确认 outline 的阶段时长为权威目标），correction instruction 明确要求保持步骤数量、顺序、标题、教学活动、评价内容与 `sourceBindings` 不变，每个步骤时长为正整数且总和严格等于目标，优先保持原时长比例，不扩展教学语义。
- 无法可靠解析时长信息（message 不匹配或 outline 不可得）时不猜测数值，返回 `null` 走通用 schema 修正提示。
- `SMART_LESSON_PROMPT_VERSION` 升级为 `smart-lesson-plan.v2`；schema 版本保持不变。
- 补充 worker 回归测试：规范化、correction context 解析、修正后链路成功。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `smart-lesson-plan-authoring`：BOPPPS 阶段时长类校验失败获得针对性的自动 correction 上下文；原始生成 prompt 携带阶段/步骤时长一致性约束；一次 ORIGINAL + 一次 CORRECTION 的调用上限与审计结构不变。

## Impact

- `src/lib/smart-lesson-plan/worker.ts`（prompt 约束、issue 规范化、correction context 解析）。
- `src/lib/smart-lesson-plan/provider-runtime.ts`（`SMART_LESSON_PROMPT_VERSION` 升 v2）。
- `src/lib/smart-lesson-plan/__tests__/worker.test.ts`（回归测试）。
- 不改：BOPPPS schema 约束与校验规则（`schema.ts` 数值校验保持原样）、provider/model 配置、生成门禁、实验条件、ORIGINAL/CORRECTION attempt 审计结构、一次 ORIGINAL + 一次 CORRECTION 的调用上限。
