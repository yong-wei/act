## Context

当前 `DIAGNOSIS_GENERATION_ATTEMPT_TIMEOUT_MS` 与提供方 `timeoutMs` 都是
120_000。worker `withGenerationTimeout` 与 `runWithOptionalTimeout` 同时在
120 秒 abort；结构化 `generateText` 也把 120 秒传给单次调用。空输出后的
JSON 回退几乎没有剩余时间，任务层会先记超时。

## Goals / Non-Goals

**Goals:**

- 提供方总生成窗口严格小于 worker 任务窗口。
- 单次 JSON 回退只使用提供方总窗口剩余时间。
- lock duration 覆盖完整任务窗口。
- 超时仍可重试，身份与证据截止时间不变。

**Non-Goals:**

- 不绕过报告结构、证据引用、作用域和截止时间校验。
- 不修改学生画像、作业、测验或风险事实。
- 不通过无限增加超时掩盖提供方永久不可用。
- 不改变未选择 `fallbackToTextJson` 的其他结构化调用。

## Decisions

### 1. Split provider and task windows

- `DIAGNOSIS_PROVIDER_GENERATION_WINDOW_MS = 120_000`
- `DIAGNOSIS_GENERATION_ATTEMPT_TIMEOUT_MS = 150_000`
- `DIAGNOSIS_GENERATION_LOCK_DURATION_MS = 180_000`

Worker 超时包装使用任务窗口。提供方 `generate()` 使用提供方窗口。锁覆盖任务窗口并保留 30 秒收尾余量。

### 2. Fallback spends remaining provider budget

When `fallbackToTextJson` is true, the structured request and the JSON
fallback share one outer abort. The fallback timeout is the remaining
provider budget after the structured attempt. If remaining time is 0, do not
start fallback; record `diagnosis-provider-empty-output`.

### 3. Keep retry identity

Timeout and empty-output remain retryable. Retry retains cutoff, input
summary, job identity, generator version, and predecessor reference.

## Risks / Trade-offs

- [Risk] 拉长任务窗口会让卡住的 RUNNING 任务更晚被标 stale。→ stale 判定跟随任务窗口，不跟随提供方窗口。
- [Trade-off] 提供方窗口保持 120 秒，不把失败伪装成更长等待。
