---
node_id: ctkg_v3e-object-42be29933b0ae43fc424465b
authority_entity_id: "ctkg:v3e-object-42be29933b0ae43fc424465b"
name: Estimator Error Poles
category: 概念性
batch: B
release_tier: silver
tags:
  - silver
  - Estimator
  - Error
  - Poles
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: f1813bced694866f5bf67f937b80da0fc2422bdd5ec760429c24e2a2f4105f51 -->

## 首页

# Estimator Error Poles

**一句话定义**：Estimator Error Poles：The desired poles of the estimator error dynamics, specified as β₁, β₂, …, βₙ.

**核心直觉**：在图谱邻接中可把握：前置 → Estimator Gain S · 后续 → Estimator Error。

**关联**：前置 → Estimator Gain S · 后续 → Estimator Error

---

## 详情

### 完整解释

The desired poles of the estimator error dynamics, specified as β₁, β₂, …, βₙ.

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 前置 | Estimator Gain S | 包含组件 |
| 后续 | Estimator Error | 应用于 |
| 前置 | Estimator Gain S | 应用于 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`silver`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

silver、Estimator、Error、Poles
