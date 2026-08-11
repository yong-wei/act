---
node_id: ctkg_v3e-object-5592624b3ec200b86f7b744d
authority_entity_id: "ctkg:v3e-object-5592624b3ec200b86f7b744d"
name: Observability
category: 概念性
batch: B
release_tier: gold
tags:
  - gold
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: 614ee63bdafc7c3cdc977ebaeffe3da1cbf29fc999de5a99cd17e10ec6bba729 -->

## 首页

# Observability

**一句话定义**：Observability：A system is completely observable if and only if there exists a finite time T such that the initial state x(0) can be d…

**核心直觉**：在图谱邻接中可把握：前置 → Pole placement、Kalman state-space decomposition · 后续 → Observer Canonical Form。

**关联**：前置 → Pole placement、Kalman state-space decomposition · 后续 → Observer Canonical Form

---

## 详情

### 完整解释

A system is completely observable if and only if there exists a finite time T such that the initial state x(0) can be determined from the observation history given y(t) the control u(t), 0 ≤ t ≤ T.

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 前置 | Pole placement | 用于分析 |
| 前置 | Kalman state-space decomposition | 用于分析 |
| 后续 | Observer Canonical Form | 关联 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`gold`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

gold
