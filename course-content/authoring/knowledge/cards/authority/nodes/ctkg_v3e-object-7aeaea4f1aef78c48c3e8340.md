---
node_id: ctkg_v3e-object-7aeaea4f1aef78c48c3e8340
authority_entity_id: "ctkg:v3e-object-7aeaea4f1aef78c48c3e8340"
name: "Ackermann's formula"
category: 概念性
batch: B
release_tier: gold
tags:
  - gold
  - "Ackermann's"
  - formula
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: dbbbfe9cd7975d5788b72537334f93d134720100e6bd1e4e1b303ab69c5df813 -->

## 首页

# Ackermann's formula

**一句话定义**：Ackermann's formula：A compact formula for computing the state feedback gain matrix K for pole placement, given by K = [0 ... 0 1] * C^{-1}…

**核心直觉**：在图谱邻接中可把握：前置 → Pole placement b · 后续 → Pole placement b。

**关联**：前置 → Pole placement b · 后续 → Pole placement b

---

## 详情

### 完整解释

A compact formula for computing the state feedback gain matrix K for pole placement, given by K = [0 ... 0 1] * C^{-1} * α_c(A), where C is the controllability matrix and α_c(A) is the desired characteristic polynomial evaluated at the system matrix A.

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 后续 | Pole placement b | 派生自 |
| 前置 | Pole placement b | 关联 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`gold`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

gold、Ackermann's、formula
