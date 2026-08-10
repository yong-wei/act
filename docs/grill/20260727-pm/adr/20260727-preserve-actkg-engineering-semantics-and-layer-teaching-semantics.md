---
status: accepted
context: authoritative-knowledge-graph-migration
supersedes_in_part: docs/adr/0019-restrict-the-knowledge-base-to-three-canonical-relations.md
---

# 无损保留 ActKG 工程语义并分离教学语义投影

ACT 的权威知识基座完整保存 ActKG Release 中的异质对象类型、类型专属字段、工程关系谓词、方向、证据、来源和治理状态，并通过往返验证证明导入结果无损。画布、搜索和其他消费者可以生成有明确 Profile 的简化投影，但简化投影不能成为权威真源，也不能反向重建 Release。

现有包含、先修和关联三类关系仅约束 ACT 教学语义投影，不再限制权威工程本体。教学语义与工程语义分别治理；工程关系不能自动推断为教学先修或包含。ActKG 后续正式发布教学语义后，ACT 再将教学消费者迁移到对应权威发布内容。

这一决定增加了权威仓储和多投影实现成本，但避免 Formula、SystemModel、KnowledgeStatement 及有方向工程关系在迁移中发生不可恢复的语义压缩。
