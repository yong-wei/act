## Context

微辅导验证题来自编排快照中的 `validationQuestion.questionId`。checkpoint-authored 题目在目录与注册表中使用作者态 source ID，在自适应运行时题库中使用 `checkpoint-authored-question:<sourceId>`。`startMicroIntervention` 把前者原样交给 `getAdaptiveQuestionById`，后者只认带前缀的运行时 ID，查找失败后把 `validationRuntimeHash` 写成 `null`。读取验证题时，缺失哈希被安全策略判为 `REFERENCE_DRIFT`。preset 题目没有这层前缀，因此不受影响。

## Goals / Non-Goals

**Goals:**

- 启动时用规范化运行时身份解析题目并写入非空 `validationRuntimeHash`。
- 读取与提交使用同一运行时身份；作者态 ID 与运行时 ID 比较时视为同一题目。
- 旧的 `validationRuntimeHash=null` 记录继续不可验证，不补写哈希。

**Non-Goals:**

- 不改验证注册表文件、不重跑物化同步、不改 Prisma。
- 不把旧 intervention 自动修复成可提交。
- 不改变真实内容/版本漂移的 fail-closed 语义。

## Decisions

1. **在运行时查找层同时接受作者态 ID 与运行时 ID。** `getAdaptiveQuestionById` / checkpoint-authored 记录查找在去掉或补上 `checkpoint-authored-question:` 后解析为同一记录，返回对象的 `id` 始终是运行时 ID。这样启动、读取、提交共用一条解析路径，preset/generated 仍先按原 ID 命中。
2. **启动快照写入运行时 ID，比较时做身份归一。** `sourceFromAvailableTask` 在解析成功后把快照中的 `questionId` 写成运行时 ID，并用该对象计算哈希。`sameSource` 与提交身份校验用 canonical source ID 比较，避免编排层仍给出作者态 ID 时把新 intervention 误判漂移。
3. **旧空哈希保持 fail-closed。** 启动使用 `update: {}` 的幂等 upsert，不回填已有行。读取验证题在哈希缺失时仍返回 `REFERENCE_DRIFT`，不根据当前题目伪造哈希。

## Risks / Trade-offs

- 编排快照与干预快照的 `questionId` 字面值可能不同（作者态 vs 运行时）→ 比较必须走身份归一，不能再做裸字符串相等。
- 扩大 `getAdaptiveQuestionById` 的解析面可能让无关调用误命中 checkpoint 记录 → 仅在 preset/generated 未命中后，对已知 authored source ID 集合查找，不把任意字符串都加上前缀当成功。
