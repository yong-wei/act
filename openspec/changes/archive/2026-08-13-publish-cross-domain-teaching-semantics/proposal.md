## Why

领域内教学关系不足以表达完整课程路径，基础分析、经典设计与现代控制之间还需要少量经过审核的直接跨领域依赖。它们应在各领域增量稳定后统一审核，避免局部包产生矛盾或隐含传递关系。

## What Changes

- 审核并发布八领域之间必要的直接先修/后修关系与边界入口。
- 对组合后的 Teaching Projection 执行全局无环性、端点存在性、方向和重复关系校验。
- 只保留有教学依据的直接边，不把传递闭包、工程派生或视觉邻近持久化为教学事实。
- 覆盖不足继续作为非阻断状态，未来跨领域关系可通过新的增量版本追加。

## Capabilities

### New Capabilities
- `cross-domain-teaching-semantics`: 定义八领域之间的已审核直接教学关系与全局一致性门禁。

### Modified Capabilities
- `act-teaching-prerequisites`: 增加跨领域直接先修关系的组合、无环和审核合同。

## Impact

影响 Teaching Projection 跨领域作者态关系、组合验证、审核证据和运行态分片；依赖三个领域教学语义包，不修改 Engineering Authority。
