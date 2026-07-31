# 提案：路径执行 409 错误在前端当前操作区域的展示修复

## 动机

Issue #995 报告自适应学习路径节点"串联校正速判"点击"开始学习"后 API 返回 409 Conflict，但失败信息未展示在当前操作区域，用户感知为"按钮无响应"。

## 方案

1. 将路径执行错误与页面通用错误（练习加载、提交等）拆分为独立状态 `pathExecutionError`，避免误归因。
2. 在 `current-path` 模块顶部新增基于 `pathExecutionError` 的错误显示区域，含"刷新路径状态"恢复按钮。
3. `writePathNodeActivity`、`skipPathNode`、`completePathNodeAction`、`launchPathNodeAction`、`launchExecutionNode` 等路径操作函数均写入独立错误状态。

## 不纳入范围

- 不修改后端 409 返回逻辑（后端行为正确，仅前端展示缺失）
- 不修改非路径操作的错误处理（练习加载、提交等继续使用共用 `error` 状态）
