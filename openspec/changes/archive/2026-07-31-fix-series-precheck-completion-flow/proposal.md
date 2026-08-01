## Why

“串联校正速判”在最后一题检查答案时静默写入完成证据，同时保留一个禁用的“下一题”按钮。用户无法确认提交状态，也无法在写入失败后重试。

## What Changes

- 最后一题检查答案后提供显式“完成检测”操作。
- 完成操作展示提交中、成功和失败状态，并允许失败重试。
- 对单次完成操作实施幂等保护，避免重复写入结果和学习路径证据。
- 保留非最后一题的“检查 → 下一题”流程，并核查同模式测验的影响面。

## Capabilities

### New Capabilities

- `adaptive-quiz-explicit-completion`: 学习路径测验以显式、可反馈且幂等的动作完成结果提交。

### Modified Capabilities

- 无。

## Impact

- `src/resources/interactive-learning/lesson-15/series-precheck/index.tsx`
- `src/app/interactive-learning/resources/[id]/page.tsx`
- `src/features/interactive/__tests__/series-precheck-completion.test.tsx`
