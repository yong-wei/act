---
status: accepted
context: authoritative-knowledge-graph-migration
---

# 分离 CTKG 发布协议接入与课程资源语义治理

CTKG 0.2 接入子变更只负责公开发布合同、哈希与组件校验、GraphProjection V2、上游 RAG Crosswalk、Repository、候选图谱，以及旧候选身份相关影子数据的确定性失效和新治理基线就绪检查。它不重新生成 CourseCoverage、ACT `EvidenceStructuralUnitCrosswalk`、资源候选、复核决定或 shadow publication。公开发布成员资格只证明对象属于 ActKG 权威发布范围，不证明其已经进入 ACT 具体课程，也不能确定 ACT 资源承担的教学角色。

新增系统建模对象的 CourseCoverage 角色，以及 ACT 原子资源到 Canonical Object 的讲解、练习、评价或引用绑定，进入紧随其后的独立治理子变更。该变更完成前，新增对象可以在候选图谱中只读浏览，但不得自动参与正式课程消费者。

这一拆分增加一个治理检查点，但避免协议与数据库适配同时承担数百个对象的课程语义和资源角色审核，并保持权威来源对齐与 ACT 教学资源绑定的既有边界。
