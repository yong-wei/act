## Why

ACT 当前只能把外部知识数据压缩为旧式统一节点，无法无损接收 ActKG 的异质对象、精确关系、来源证据和治理状态。首个 `root-locus-engineering-v0.1` 已具备正式 Release 合同，需要先建立可验证、可复现且不改变生产权威的接入边界。

## What Changes

- 新增显式 ReleaseSet 锁定清单，只接收固定路径、版本、Schema、`contract_hash` 和 Release 哈希均匹配的发布包。
- 新增关系化稳定信封、经当前 Schema 校验的完整 JSONB 载荷和原始 Release 三层持久化。
- 事务性导入 Canonical Object、关系、来源、EvidenceSegment、治理等级及版本信息，并执行端点、唯一性、冲突和往返验证。
- 按 `release_status=RELEASED` 与实体清单确定成员资格，不用冻结的对象 `publication_status` 过滤已发布成员。
- 导入收据显式记录发布包实际携带的上游血缘。首包只具有来源运行和来源实现提交，因此不得虚构 CTKGDataset 或 RevisionProposalRegistry 引用；未来发布包提供这些引用后再按真实字段保存。
- ACT 对 Canonical Object 和工程关系保持只读，不提供反馈、跨项目提交或自动修订入口。
- 首轮只兼容当前根轨迹发布包；未来 Schema 变化另立适配，不建设通用多 Schema 框架。
- 本变更只建立候选数据接入，不激活生产知识权威或任何正式消费者。

## Capabilities

### New Capabilities

- `authoritative-knowledge-release-ingestion`: 定义 ActKG ReleaseSet 锁定、校验、无损持久化、事务导入和往返验证合同。

### Modified Capabilities

无。

## Impact

- 影响 Prisma 数据模型、数据库迁移、Release 导入脚本、接入校验和审计测试。
- 输入为 `course-content/authoring/knowledge/releases/root-locus-engineering-v0.1/`。
- 不修改现有知识图谱 API、旧节点、历史事实或生产查询来源。
