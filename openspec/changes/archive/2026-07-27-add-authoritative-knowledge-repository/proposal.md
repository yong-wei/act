## Why

无损导入后的 ActKG 数据需要一个统一运行查询边界，否则前端、控灵和后续消费者仍会直接读取文件或旧 Prisma 节点，并重新制造多套真源。Repository 必须在任何消费者迁移前明确区分候选、活动和 Legacy 状态。

## What Changes

- 新增 `AuthoritativeKnowledgeRepository`，只从已校验数据库读模型查询 ReleaseSet、对象、关系、来源和证据。
- 明确 candidate、active、legacy 三类状态，不允许候选数据被正式消费者误读为活动权威。
- 新增 `act.canvas.v2`、`act.node-detail.v2`、`act.migration-review.v1` 三项首轮投影。
- 每项投影声明源 ReleaseSet、字段范围和角色可见性，不建立万能 DTO。
- 禁止运行时读取 Release 文件、ActKG 项目路径或在数据库为空时回退文件。
- 本变更依赖 `ingest-authoritative-actkg-releases`，但不切换生产知识权威。

## Capabilities

### New Capabilities

- `authoritative-knowledge-repository`: 定义权威知识数据库查询、状态隔离和首轮投影合同。

### Modified Capabilities

无。

## Impact

- 影响知识数据访问层、投影类型、Repository 测试和迁移审计接口。
- 为候选图谱、控灵、RAG、SAR、KAQ、路径和事实写入提供后续稳定边界。
- 现有 `UnifiedKnowledgeGraphPayload` 与旧 API 暂不改变。
