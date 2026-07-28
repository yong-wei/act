---
status: accepted
context: authoritative-knowledge-graph-migration
clarifies: docs/grill/20260727-pm/adr/20260727-define-act-losslessness-at-the-engineering-release-boundary.md
---

# 将 ACT 无损接入边界对齐到公开工程发布包

ActKG 已明确区分私有 `CTKGDataset` 与公开 Engineering Release。私有 Dataset 保存来源正文、精确证据、治理决定和完整投影生产血缘；公开包由发布成员、脱敏 GraphProjection、上游 RAG Crosswalk、组件清单、哈希和公开血缘组成，供消费者重建运行视图。

ACT 对公开工程发布包承担无损保存、关闭式校验和确定性重建责任，但不导入私有 Dataset，也不声称公开 Projection V2 是完整 Dataset。ACT 自有教材正文、结构单元和已验证 `EvidenceStructuralUnitCrosswalk` 继续通过独立治理链路与上游公开定位身份闭合。

后续 OpenSpec 工件必须修正此前把 Engineering Release 描述为完整规范对象、来源与精确证据载荷的表述，以实际公开合同定义验收边界。
