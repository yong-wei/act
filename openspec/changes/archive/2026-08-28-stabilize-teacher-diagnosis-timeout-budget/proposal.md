# Proposal: Stabilize teacher diagnosis timeout budget

## Why

班级学情诊断把结构化提供方请求、JSON 回退和 worker 任务截止时间都钉在 120
秒。空结构化输出后的单次 JSON 回退没有独立可执行余量，BullMQ 任务层也会在
提供方清理和持久化完成前先记 `diagnosis-generation-timeout`。

## What Changes

- 把提供方总生成窗口与 worker 任务窗口拆开：提供方窗口严格更短。
- JSON 回退消耗同一提供方总窗口的剩余时间，不得无限等待。
- BullMQ lock duration 覆盖完整任务窗口，任务层保留校验、持久化和状态收尾余量。
- 超时任务保持可重试，冻结证据截止时间、输入摘要和任务身份不变。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `teacher-diagnosis-generation-governance`: 回退阶段必须拥有可执行窗口；任务层截止时间必须晚于提供方窗口。

## Impact

- `src/lib/diagnosis-generation.ts`
- `src/lib/diagnosis-generation-provider.ts`
- `src/lib/diagnosis-generation-worker.ts`
- `src/lib/smart-lesson-plan/provider-runtime.ts`
- 诊断生成单元测试
