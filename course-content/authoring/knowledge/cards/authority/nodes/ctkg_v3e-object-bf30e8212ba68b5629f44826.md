---
node_id: ctkg_v3e-object-bf30e8212ba68b5629f44826
authority_entity_id: "ctkg:v3e-object-bf30e8212ba68b5629f44826"
name: 状态可控
category: 概念性
batch: B
release_tier: gold
tags:
  - gold
  - 状态可控
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: e087f0a0640402b32bf10e5d2e375a35f6e630756b411358d8c9387bbc628d68 -->

## 首页

# 状态可控

**一句话定义**：对于式（9－76）所示线性时变系统，如果对取定初始时刻 t0 ∈ Tt 的一个非零初始状态 x(t0)=x0，存在一个时刻 t1 ∈ Tt, t1>t0，和一个无约束的容许控制 u(t), t∈[t0, t1]，使状态由 x(t0)=x0…

**核心直觉**：在图谱邻接中可把握：前置 → 容许控制 · 后续 → 系统可控。

**关联**：前置 → 容许控制 · 后续 → 系统可控

---

## 详情

### 完整解释

对于式（9－76）所示线性时变系统，如果对取定初始时刻 t0 ∈ Tt 的一个非零初始状态 x(t0)=x0，存在一个时刻 t1 ∈ Tt, t1>t0，和一个无约束的容许控制 u(t), t∈[t0, t1]，使状态由 x(t0)=x0 转移到 t1 时的 x(t1)=0，则称此 x0 是在 t0 时刻可控的。

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 后续 | 系统可控 | 是一种 |
| 前置 | 容许控制 | 应用于 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`gold`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

gold、状态可控
