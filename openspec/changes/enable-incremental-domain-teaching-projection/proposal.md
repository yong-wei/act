## Why

Engineering Authority 与 ACT Teaching Projection 已经分层，但当前前端不能稳定消费按领域逐步增加的教学关系。需要把“可增量发布、覆盖不足不阻断、未来关系自动进入相应分片”固化为运行时合同。

## What Changes

- 为教学节点、直接先修/后修关系及其领域归属定义可追加、版本化的增量发布格式。
- 只消费已发布且通过 ACT 教学审核的直接关系；禁止从工程关系、课程顺序或名称相似度推导先修关系。
- 将教学投影的 `partial`、`empty`、`unavailable` 与 Engineering Authority 可用性分离；教学覆盖不足不得阻断 Authority 激活、领域进入或工程关系浏览。
- 让未来新增的有效教学关系在新投影版本发布后按相同合同自动进入领域分片，无需修改前端关系白名单或重新发布旧工程事实。
- 保留来源、审核状态、投影版本和失效原因的内部治理证据，产品界面仅显示人类可读语义与诚实的覆盖状态。

## Capabilities

### New Capabilities
- `incremental-domain-teaching-projection`: 定义按领域增量发布、组合、降级与自动消费教学语义的合同。

### Modified Capabilities
- `act-teaching-projection`: 将 Teaching Projection 扩展为可追加的领域分片，并保持已发布关系的不可变审核边界。
- `knowledge-graph-projection-contract`: 明确 Teaching Projection 覆盖不足不影响 Engineering Graph，且新投影版本可独立生效。

## Impact

影响 Teaching Projection 作者态与运行态 schema、校验器、版本选择、领域分片组合及覆盖状态 API；不重审或改写已发布的 ActKG 工程实体和关系。
