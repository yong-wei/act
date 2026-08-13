## Why

`POST /api/interactive/events` 接收的客户端 payload 可直接提供 `competencyContribution`，并在 LearningFact 物化时进入 Portrait v2。攻击者可伪造能力提升，污染后续个性化路径的输入。

## What Changes

- 在 LearningFact 物化边界默认拒绝客户端互动事件的能力贡献，同时保留行为、作答、得分、进度、上下文和 InteractionLog 写入。
- 仅允许经过服务端持久化与治理核验的自适应测评事件携带有效能力贡献。
- 保持教师审核及其他直接服务端物化的已审核事实写入不变。
- 不修改 HTTP 请求或响应字段，不修改数据库结构，不处理已入库的历史事实。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `learning-fact-quality-weight`：客户端互动提交即使具有富目标作答证据，也只能作为可追溯学习事实；其能力贡献必须由服务端可信写入路径授予。

## Impact

- 影响 `learning-fact-materialization` 的能力贡献写入资格、服务端自适应测评持久化调用点及其单元测试。
- Portrait v2、HTTP API、Prisma schema、教师审核写回与既有服务端直接物化接口不变。
