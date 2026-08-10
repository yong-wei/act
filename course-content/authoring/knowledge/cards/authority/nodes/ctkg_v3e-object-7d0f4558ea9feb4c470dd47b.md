---
node_id: ctkg_v3e-object-7d0f4558ea9feb4c470dd47b
authority_entity_id: "ctkg:v3e-object-7d0f4558ea9feb4c470dd47b"
name: 系统完全可观测
category: 概念性
batch: B
release_tier: gold
tags:
  - gold
  - 系统完全可观测
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: 030d68f0cb4f477eaf1e9cb1c76edf5ff871a176e621be516cf659395685fad0 -->

## 首页

# 系统完全可观测

**一句话定义**：对于式（9－81）所示线性时变系统，如果取定初始时刻 t0∈Tt，存在一个有限时刻 t1∈Tt, t1>t0，对于所有 t∈[t0, t1]，系统的输出 y(t) 能唯一确定状态向量的初值 x(t0)，则称系统在 [t0, t1] 内是完…

**核心直觉**：如果对于一切 t1>t0系统都是可观测的，则称系统在 [t0, ∞) 内完全可观测。

**关联**：后续 → 可观测性

---

## 详情

### 完整解释

对于式（9－81）所示线性时变系统，如果取定初始时刻 t0∈Tt，存在一个有限时刻 t1∈Tt, t1>t0，对于所有 t∈[t0, t1]，系统的输出 y(t) 能唯一确定状态向量的初值 x(t0)，则称系统在 [t0, t1] 内是完全可观测的，简称系统可观测。如果对于一切 t1>t0系统都是可观测的，则称系统在 [t0, ∞) 内完全可观测。

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 后续 | 可观测性 | 是一种 |
| 后续 | 可观测性 | 属于 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`gold`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

gold、系统完全可观测
