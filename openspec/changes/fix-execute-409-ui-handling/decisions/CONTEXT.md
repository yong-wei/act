# Issue #995: 自适应学习路径"开始学习"按钮无响应

修复过程中涉及的术语和决策上下文。

## Language

**路径执行写入（Path Execution Write）**:
客户端通过 POST `/api/learning-paths/:id/execute` 将路径节点活动状态记录到服务端的过程。

**路径中心自有资源（Path-Center Owned Resource）**:
路径节点的目标资源由路径中心直接打开和管理，无需跳转至独立交互页面。

**幂等键（Idempotency Key）**:
每次路径执行写入请求携带的唯一标识，格式为 `${activityKind}:${pathId}:${nodeId}:${timestamp}`。

**HTTP 409 Conflict**:
服务端返回的状态码，表示请求与当前状态冲突。
