---
status: accepted
context: authoritative-knowledge-graph-migration
---

# 以聚合发布包作为候选 ReleaseSet 的唯一入口

候选 ReleaseSet 使用 `control-theory-engineering-v0.2` 作为唯一当前发布入口。接入过程必须校验并记录 `component-releases.json` 中根轨迹与系统建模组件的身份和哈希，但不把组件包与聚合包作为并列候选重复导入。

既有 `root-locus-engineering-v0.1` 继续保留为不可变组件来源、旧合同回归夹具和历史接入收据依据。候选 Repository、画布、详情和上游 RAG Crosswalk 统一以聚合发布身份工作；ACT `EvidenceStructuralUnitCrosswalk` 由后续语义治理子变更基于该聚合身份重新生成。

该决定避免同一对象和关系经聚合投影与组件投影重复出现，也使候选版本、资源绑定影子身份和下游迁移依赖具有唯一入口。
