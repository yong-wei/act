---
status: accepted
context: authoritative-knowledge-graph-migration
---

# 在下游消费者迁移前插入 CTKG 0.2 合同变基

#1124 已经建立资源 Canonical 绑定的影子基础设施，但其候选 ReleaseSet 和接入合同仍以根轨迹旧发布包为基线。新发布的 `control-theory-engineering-v0.2` 采用 ReleaseEntry、GraphProjection V2、RAG Crosswalk 和组件清单组成的 CTKG 0.2 公开发布合同，现有导入器不能直接接收。

迁移系列在 #1124 之后、RAG 迁移之前插入一个独立基础子变更。该变更适配 CTKG 0.2 公开发布合同，更新候选 ReleaseSet、Repository 和候选图谱，并确定性地使旧 ReleaseSet 下的影子结果失去当前资格。新的 CourseCoverage、ACT Crosswalk 和资源教学角色由紧随其后的语义治理子变更生成。它不修改 #1124 的已合并提交或归档工件，也不实施后续消费者迁移或生产权威切换。

这样可以使 RAG、KAQ、SAR、学习路径和学习事实迁移建立在稳定的 CTKG 0.2 合同上，避免各消费者分别兼容或重复迁移根轨迹局部接口。
