---
node_id: ctkg_v3e-object-6ca8140f61e8805a2e5c8201
authority_entity_id: "ctkg:v3e-object-6ca8140f61e8805a2e5c8201"
name: Matched Pole-Zero (MPZ) Method
category: 概念性
batch: B
release_tier: silver
tags:
  - silver
  - Matched
  - Pole-Zero
  - (MPZ)
  - Method
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: 310548a3c6e91b70b0773282ac611092c489e547859a37a41eeb34734458c60c -->

## 首页

# Matched Pole-Zero (MPZ) Method

**一句话定义**：Matched Pole-Zero (MPZ) Method：A digitization method that applies the relation z=e^{sT} to the poles and zeros of a transfer function. Steps: 1) Map p…

**关联**：（权威图邻接待补充）

---

## 详情

### 完整解释

A digitization method that applies the relation z=e^{sT} to the poles and zeros of a transfer function. Steps: 1) Map poles and zeros according to z=e^{sT}. 2) If numerator is lower order than denominator, add powers of (z+1) to equalize order. 3) Set DC or low-frequency gain of D_d(z) equal to that of D_c(s).

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| — | — | 权威图中暂无 DomainConcept 邻接 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`silver`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

silver、Matched、Pole-Zero、(MPZ)、Method
