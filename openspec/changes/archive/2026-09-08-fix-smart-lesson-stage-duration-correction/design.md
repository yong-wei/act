## Context

SmartLesson 阶段生成有两层时长校验：schema 层（`createBopppsStageSchema.superRefine`，`sum(steps.minutes) === stage.minutes`，custom issue message 携带 `actual:expected`）与门禁层（`validateGeneratedStage` 的 `stage-duration-mismatch`，比对 outline 确认的阶段时长）。门禁层错误已有 correction context（`buildCorrectionContext` 的既有分支），schema 层的步骤时长错误没有：custom issue 的 `code` 字段是 `custom`，`buildCorrectionContext` 按 code 匹配不到，且其内部 `bopppsStageSchema.parse(output)` 对未通过 superRefine 的输出会直接抛 ZodError——即现有结构既识别不了、也解析不了。

一条必须尊重的既有事实：correction 只有两次 provider 调用的预算（一次 ORIGINAL + 一次 CORRECTION，`beginCorrectionAttempt` + `correctsAttemptId` 审计已固化），修正输出会再走完整 `validateStageCandidate`（schema 层 + 门禁层）。因此 correction 目标必须落在门禁权威值上，否则二次校验会立刻失败。

## Goals / Non-Goals

**Goals**

- 原始生成让模型知道步骤时长一致性约束，降低首错率。
- 步骤时长错误能被规范化、correction 能拿到具体修正约束，一次 CORRECTION 内修复。
- 时长信息不可靠解析时诚实退化到通用修正提示，不猜测数值。

**Non-Goals**

- 不放宽或修改 BOPPPS schema 数值校验本身。
- 不增加 provider 调用次数、不改变 attempt 审计结构与实验条件。
- 不处理 provider 超时、网络类可重试错误（已有路径不变）。
- 不承诺消除所有 `provider-output-invalid-after-correction`（其余类别失败不属本变更）。

## Decisions

1. **规范化位置在 worker 的 `validateStageCandidate`，不在 provider-runtime。** `validateSmartLessonProviderOutput` 是通用透传层（所有结构化输出共用），把 SmartLesson 专属的 message 语义塞进去会污染共享契约。worker 侧在 schema 校验失败后对 receipt.issues 做一次后处理：message 匹配 `^stage-step-duration-mismatch:(\d+):(\d+)$` 的 issue 改写 `code` 为 `stage-step-duration-mismatch`、path 归一为 `['steps']`，message 原样保留（它是 actual/expected 载体）。规范化后的 receipt 即 beginCorrectionAttempt 持久化的 receipt，审计看到的错误码与 correction 行为一致。
2. **correction 的目标时长以已确认 outline 为权威，不用输出里自带的 `stage.minutes`。** 输出的 `stage.minutes` 自身可能偏离 outline（schema 失败时门禁尚未运行，无从保证一致）；若把步骤和修到输出值上，修正输出会在门禁层再次失败。`expectedStageMinutes(context, stage)` 是门禁同源权威值。outline 解析失败时返回 `null` 退化通用修正（不猜测）。
3. **correction context 不重新 parse 输出。** actual（步骤时长总和）直接取自规范化 message 的第一捕获组；现有 `stage-duration-mismatch` 分支保持原实现（其输出已通过 schema，parse 安全）。
4. **prompt 约束放在 system 提示**（`buildStageRequest` 返回的 `system`），对 BOPPPS 阶段与 OUTLINE 统一生效无副作用；措辞一句话，不改变来源绑定与结构化输出指令。
5. **`SMART_LESSON_PROMPT_VERSION` 升 `smart-lesson-plan.v2`**：prompt 内容变化必须可追溯，attempt 审计按版本区分新旧行为；schema 版本不变（数值校验规则未动）。

## Risks / Trade-offs

- 真实模型的修正成功率无法在单测中证明，验收含一次真实 Qwen3.5 smoke（不启动正式实验，不手动 retry/resume）。
- message 正则只匹配 `stage-step-duration-mismatch`；未来新增其他 schema 层 custom 语义错误时需按同一模式扩展规范化表，不在此预先抽象。

## Migration Plan

无数据迁移。`promptVersion` 字符串升级随下一次生成 attempt 自然生效；既有 attempt 的审计记录不受影响。
