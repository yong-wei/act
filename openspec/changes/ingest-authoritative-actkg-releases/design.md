## Context

ActKG 首个 Engineering Release 包含 103 个异质对象、完整类型字段、精确工程关系、来源映射、EvidenceSegment 存根和治理结论。ACT 现有旧图模型不能无损承载这些语义。本变更只建立候选接入，不改变任何生产消费者。

## Goals / Non-Goals

**Goals:**

- 以显式 ReleaseSet 锁定清单接收当前根轨迹发布包。
- 在数据库中同时保留可约束的稳定信封、完整 JSONB 载荷和原始 Release。
- 证明导入结果与发布包在规范化后往返一致。

**Non-Goals:**

- 不支持未知未来 Schema，不建设多版本迁移框架。
- 不建立 Legacy→Canonical 映射，不迁移历史事实。
- 不提供运行查询、图谱 UI 或生产权威切换。

## Decisions

1. 锁定清单记录 Release ID、版本、受控路径、Schema/contract hash 和 release hash；目录扫描或“最新版本”不构成输入。
2. Release、对象、关系、来源和证据使用关系化信封承载身份、端点、版本、治理等级和索引字段；完整类型载荷保存为经当前 Schema 校验的 JSONB。
3. 保存去除自引用哈希字段后的规范化原始 Release，并以同一算法复核 release hash。
4. 成员资格由外层 `release_status=RELEASED` 与实体清单决定；对象冻结的 `publication_status` 仅保留为载荷字段。
5. 导入在单个事务内完成。端点缺失、重复身份不一致、关系冲突、Schema 或哈希不符时整个 ReleaseSet 失败，不保留部分结果。
6. 导入收据只保存发布包实际携带的上游血缘字段。当前首包记录来源运行和来源实现提交，并将 CTKGDataset、RevisionProposalRegistry 引用明确标记为未提供；不得推导或虚构缺失引用。未来发布包增加这些字段时，以针对真实 Schema 差异的后续变更扩展合同。ACT 不复制上游治理工作流，权威内容永远只读。

## Risks / Trade-offs

- [当前 Schema 仍可能变化] → 首轮明确只支持当前 contract hash；第二个发布包以独立变更扩展。
- [JSONB 可能掩盖字段漂移] → 导入前执行固定 Schema 校验，稳定身份和端点仍由关系约束保护。
- [重复 Release 造成冲突] → 规范化相同内容可复用，未声明修订的不一致内容关闭导入。
- [ACT 形成第二治理入口] → 不提供权威内容写入、反馈、提案明细或跨项目提交接口。

## Migration Plan

新增表和约束后，在候选状态导入当前发布包；执行空库、重复导入、冲突回滚和往返哈希测试。既有旧图表和运行查询保持不变。

## Open Questions

无。
