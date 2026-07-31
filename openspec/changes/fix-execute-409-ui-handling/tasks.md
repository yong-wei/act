# Tasks

1. 新增独立状态 `pathExecutionError`，与页面通用 `error` 分离
2. 将以下函数的错误写入从 `setError` 改为 `setPathExecutionError`：
   - `writePathNodeActivity`（execute API 409）
   - `skipPathNode`（deviations API 异常）
   - `completePathNodeAction`（execute completion API 异常）
   - `launchPathNodeAction`（pre-check 失败 & execute launch API 异常）
   - `launchExecutionNode`（pre-check 失败）
3. 在 `current-path` 模块顶部添加基于 `pathExecutionError` 的错误显示区域
4. "刷新路径状态"按钮清空 `pathExecutionError` 并触发路径刷新
5. 验证：聚焦测试覆盖错误状态隔离、错误展示、刷新动作
