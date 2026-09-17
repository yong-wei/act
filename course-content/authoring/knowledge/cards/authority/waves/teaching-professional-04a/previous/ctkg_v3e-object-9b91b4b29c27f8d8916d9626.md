---
node_id: ctkg_v3e-object-9b91b4b29c27f8d8916d9626
authority_entity_id: "ctkg:v3e-object-9b91b4b29c27f8d8916d9626"
name: Full-state observer
category: 概念性
batch: B
release_tier: gold
tags:
  - gold
  - Full-state
  - observer
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: 78015f17f000975b3e7a2883a3c940acb8e8578c0c5cd0315a0265f04dc6d189 -->

## 首页

# Full-state observer

**一句话定义**：Full-state observer：A dynamic system that estimates the state vector x(t) of a plant using the system model and output measurements, such t…

**核心直觉**：在图谱邻接中可把握：前置 → Kalman filter、Ackermann's formula for observer gain、Reduced-order observer。

**关联**：前置 → Kalman filter、Ackermann's formula for observer gain、Reduced-order observer

---

## 详情

### 完整解释

A dynamic system that estimates the state vector x(t) of a plant using the system model and output measurements, such that the estimate converges to the true state.

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 前置 | Kalman filter | 是一种 |
| 前置 | Ackermann's formula for observer gain | 用于分析 |
| 前置 | Reduced-order observer | 关联 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`gold`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

gold、Full-state、observer
