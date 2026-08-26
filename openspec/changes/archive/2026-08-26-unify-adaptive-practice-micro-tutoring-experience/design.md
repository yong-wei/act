## Context

#1520–#1522 已固定 v2 分母、资源和生产资格。学生页仍用 `isMicroTutoringEligible(catalogItemId + reviewed)`，标题固定为“检查节点练习”。服务端已有 `practiceSessionId` 与 `adaptive-path:{pathId}:{nodeId}`，但题目/反馈状态未随 session 切换清空。

## Goals / Non-Goals

**Goals:**

- 资格与阶段由服务端投影，客户端只渲染。
- 只有 v2 完整资格错答显示开始入口。
- 不可用原因对学生可操作且不暴露内部字段。
- 路径执行与独立练习不复用题目、答案和微辅导面板状态。

**Non-Goals:**

- 不在客户端复制 v2 目录。
- 不改写历史归因或 v1/v2 资格回执。
- 不改变微辅导编排器的掌握度/路径副作用边界。

## Decisions

1. 在提交答案结果中附加 `microTutoring` 投影：`stage`、`qualified`、`unavailableReason`、`retryAttribution`。
2. 下一题结果附加 `assessmentStage`，来自现有 `questionScope`。
3. `unavailableReason` 仅使用：`NOT_COVERED`、`EVIDENCE_DRIFT`、`RESOURCE_UNAVAILABLE`、`VALIDATION_UNAVAILABLE`、`ACCESS_REVOKED`。
4. sessionId 变化时清空 `questionState`、`feedback` 和微辅导相关本地状态。
5. `retryAttribution` 为真时提供“重新作答”按钮，只拉取新题，不更新旧答案。

## Risks / Trade-offs

- 资格投影失败必须 fail-closed 为不可用，不能回退到客户端猜测。
- 题目缺少 catalog 身份时显示未覆盖，并允许重新作答。
