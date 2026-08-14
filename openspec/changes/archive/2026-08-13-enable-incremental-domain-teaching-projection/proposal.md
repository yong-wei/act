## Why

Engineering Authority 与 ACT Teaching Projection 已经分层，但作者态尚未定义可按领域逐步增加的教学关系。需要先固化不可变片段、组合与覆盖合同；运行时分片消费另由后续变更实现。

## What Changes

- 为教学节点、直接先修/后修关系及其领域归属定义可追加、版本化的增量发布格式。
- 只消费已发布且通过 ACT 教学审核的直接关系；禁止从工程关系、课程顺序或名称相似度推导先修关系。
- 将教学投影的 `partial`、`empty`、`unavailable` 与 Engineering Authority 可用性分离；教学覆盖不足不得阻断组合和激活合同。
- 让未来新增的有效教学关系在新投影版本组合时按相同合同进入所属领域，无需修改关系注册表或重审旧工程事实。
- 保留来源、审核状态、投影版本和失效原因的内部治理证据；产品表面与实际响应由后续消费变更负责。

## Capabilities

### New Capabilities
- `incremental-domain-teaching-projection`: 定义按领域增量发布、组合、覆盖与激活教学语义的合同。

### Modified Capabilities
- `act-teaching-projection`: 将 Teaching Projection 扩展为可追加的领域分片，并保持已发布关系的不可变审核边界。

## Impact

影响 Teaching Projection 作者态、不可变工件 schema、校验器、组合与激活合同；不实现领域路由、服务端分片、响应缓存或运行时 Authority loader，也不重审或改写已发布的 ActKG 工程实体和关系。
