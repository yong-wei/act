# 设计：路径执行错误状态隔离与展示

## 状态拆分

新增 `pathExecutionError` 状态（`useState<string | null>`），与页面通用 `error` 状态平行。

### 写入 `pathExecutionError` 的路径操作

| 函数 | 场景 |
|------|------|
| `writePathNodeActivity` | execute API 返回 4xx/5xx |
| `skipPathNode` | deviations API 返回 4xx/5xx |
| `completePathNodeAction` | execute API 返回 4xx/5xx |
| `launchPathNodeAction` | 外部资源目标校验失败、弹窗被拦截、API 启动失败 |
| `launchExecutionNode` | 中心资源目标校验失败、弹窗被拦截 |

### 清空 `pathExecutionError` 的时机

- 对应路径操作成功时（`setPathExecutionError(null)`）
- 用户点击"刷新路径状态"按钮时

## UI 布局

在 `PathWorkspaceModule moduleId="current-path"` 顶部、进度总结之前插入条件渲染区块：
- 红色警示框（`border-destructive/35 bg-destructive/10`）
- 展示 `pathExecutionError` 字符串
- "刷新路径状态"按钮调用 `reloadActiveLearningPath()`

## 测试策略

1. `writePathNodeActivity` 返回 false 时页面级 `error` 不变、`pathExecutionError` 含 API 错误信息
2. 练习加载/提交失败时 `pathExecutionError` 不变、`error` 含对应错误信息
3. `pathExecutionError` 非空时 current-path 模块显示警示框，空时隐藏
4. "刷新路径状态"按钮清空 `pathExecutionError` 并触发路径刷新
