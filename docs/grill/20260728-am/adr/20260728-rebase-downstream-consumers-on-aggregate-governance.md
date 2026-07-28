---
status: accepted
context: authoritative-knowledge-graph-migration
---

# 将下游消费者重新绑定到聚合治理门禁

RAG 迁移同时依赖 CTKG 0.2 协议变基和聚合课程/资源治理，只能消费版本一致的 ACT `EvidenceStructuralUnitCrosswalk`；上游三字段 RAG reference 仅作为定位输入，不能直接充当用户可核验的正文证据。KAQ 迁移依赖聚合 `CourseCoverage`，SAR 依赖聚合身份下经审阅的 KAQ 和资源绑定。

当前 `control-theory-engineering-v0.2` 是工程知识聚合发布，不包含正式 Teaching Projection。学习路径不得用工程谓词推断先修或顺序；Canonical 新事实继续等待统一生产切换；最终 cutover 仍要求完整课程 ReleaseSet、正式 Teaching Projection 和全部消费者门禁。

因此，既有后续变更需要修改依赖和输入合同，但仍保留各自的消费实现边界。协议变基与语义治理只提供 shadow 输入，不提前实施或激活 RAG、KAQ、SAR、路径、事实写入或生产权威。
