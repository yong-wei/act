# 路径执行错误需使用独立状态并在 current-path 模块展示

## 问题

Issue #995: API 返回 409 Conflict 时，路径执行错误信息与练习加载、提交等错误共用同一页面级 `error` 状态，且在 `current-path` 模块中无错误展示。用户在当前操作区域看不到失败原因，感知为"按钮无响应"。

## 决策

1. 新增独立状态 `pathExecutionError`（`useState<string | null>`），与页面通用 `error` 平行。
2. 所有路径操作函数（writePathNodeActivity、skipPathNode、completePathNodeAction、launchPathNodeAction、launchExecutionNode）的错误写入从 `setError` 迁移至 `setPathExecutionError`。
3. 在 `current-path` 模块顶部新增基于 `pathExecutionError` 的错误展示区域，含"刷新路径状态"按钮。

## 理由

- 路径执行与练习属于不同的操作领域，不应共享同一错误状态——避免练习失败被误归因为"路径操作未能完成"
- `pathExecutionError` 展示在 `current-path` 模块内，用户触发路径操作的区域即是错误展示区域

## 影响范围

仅涉及 `adaptive-practice/page.tsx`。非路径操作（练习加载、提交、题目生成、登录检查）继续使用共用 `error` 状态。
