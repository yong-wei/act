## Why

#1125 已经完成并归档了 CTKG 0.2 聚合包的精确导入，但该实现有意固定在 `control-theory-engineering-v0.2`。标准兼容层产生 `ValidatedActKGBundle` 后，还需要一个独立的候选导入边界，才能在保留 #1125 历史数据和运行接口的前提下接收今后的兼容发布。

## What Changes

- 让候选导入器只消费 `ValidatedActKGBundle`，不再自行按固定文件名或固定发布常量解释标准公开包；#1125 的无 Manifest v0.2 精确入口继续保留。
- 扩展 Bundle Receipt、Artifact 元数据、组件引用和 Projection 记录，分开保存 Bundle、Release、ReleaseSet 与 Projection 身份及全部公开原始字节。
- 对标准 `stable aggregate` Bundle 执行事务性、幂等的 Stage、逐字节 Round Trip 和 `ACCEPTED_CANDIDATE` 回执；任一步失败均不留下部分数据。
- 允许同一语义 Release 的包装修订只新增 Bundle Receipt 和原始 Artifact 版本，不重复写入对象、关系或 Crosswalk。
- 让 Repository 按持久化的兼容合同和导入回执验证显式候选 ReleaseSet，而不是把所有聚合候选都解释为 #1125 的固定 v0.2 身份。
- 保持现有知识图谱 API、DTO、图谱画布、节点详情和控灵接口不变；新 ReleaseSet 的默认候选指针、下游治理和生产权威切换不在本变更中执行。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `authoritative-knowledge-release-ingestion`: 增加标准已验证 Bundle 的事务导入、公开 Artifact 往返、包装修订幂等和候选回执合同。
- `authoritative-knowledge-repository`: 允许 Repository 根据持久化合同和回执读取显式标准候选 ReleaseSet，同时保留 #1125 精确候选和历史隔离。
- `knowledge-graph-projection-contract`: 保存并验证多 Projection 身份，只将已登记的 runtime Projection 映射到既有 ACT V2 投影。

## Impact

- 影响 Prisma 发布/Artifact/Projection 持久化、候选导入命令、导入回执、Repository 候选诊断与数据库集成测试。
- 依赖 `establish-actkg-public-bundle-compatibility` 输出确定的 `ValidatedActKGBundle`。
- #1125 的 v0.2 数据、回执、精确适配器、Repository/API 行为和 Legacy 生产权威保持不变。
- `govern-actkg-release-set-deltas` 在本变更完成后比较已验证的候选快照；本变更本身不运行课程、资源或消费者治理。
