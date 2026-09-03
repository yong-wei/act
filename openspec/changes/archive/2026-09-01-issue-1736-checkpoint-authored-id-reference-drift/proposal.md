## Why

微辅导任务可以成功生成并完成学习，但 checkpoint-authored 验证题在「获取验证题」阶段把作者态 source ID 当成运行时 ID 查找，导致 `validationRuntimeHash` 持久化为 `null`，随后误报 `REFERENCE_DRIFT`。学生无法完成验证，重开任务仍复现。

## What Changes

- 微辅导启动、快照、读取和提交全程把 checkpoint-authored 作者态 ID 解析为带 `checkpoint-authored-question:` 前缀的运行时身份。
- 新 intervention 必须保存非空且与实际运行时题目一致的 `validationRuntimeHash`。
- 无真实内容或版本漂移时，不得再对 checkpoint-authored 验证题返回 `REFERENCE_DRIFT`。
- 已持久化且 `validationRuntimeHash=null` 的旧 intervention 继续 fail-closed，不静默补哈希。
- preset 与 generated 验证题行为保持不变。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `micro-intervention-outcomes`: 要求验证题身份在启动时规范化为运行时 ID，并据此绑定运行时哈希；作者态 ID 与运行时 ID 视为同一题目身份。

## Impact

- 受影响代码：`src/features/assessment/micro-intervention-outcomes.ts`、`src/features/assessment/adaptive-engine.ts`、`src/features/adaptive-assessment/learning-goal-checkpoint-question-sets.ts` 及其回归测试。
- 不修改 Prisma schema、迁移、验证注册表物化路径，也不改变学生可见文案以外的 API 形状。
- 验证：checkpoint-authored 端到端回归（启动 → 完成 → 获取 → 提交），以及既有 preset/generated 与真实漂移 fail-closed 用例。
