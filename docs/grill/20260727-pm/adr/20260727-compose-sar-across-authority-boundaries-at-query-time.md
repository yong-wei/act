---
status: accepted
context: authoritative-knowledge-graph-migration
---

# SAR 在查询时跨权威边界组合候选

SAR 分别查询 ActKG AuthoritativeKnowledgeRepository 与 ACT 的 KAQ、资源、路径和学习状态 Overlay，并沿显式类型化绑定执行有限跳扩展。每个结果节点和关系保留 namespace、权威来源、Release 或 Overlay 版本。

组合结果是面向单次查询的可重建候选投影，只用于检索扩展和上下文组织，不回写为 ActKG 工程关系、ACT 教学关系或新的统一图谱真源。

该设计允许 SAR 利用跨知识、能力、资源和学习状态的关联，同时避免物化图需要同步多套权威数据并模糊治理边界。
