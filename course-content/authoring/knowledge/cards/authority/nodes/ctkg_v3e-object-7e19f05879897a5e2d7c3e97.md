---
node_id: ctkg_v3e-object-7e19f05879897a5e2d7c3e97
authority_entity_id: "ctkg:v3e-object-7e19f05879897a5e2d7c3e97"
name: "Ackermann's form"
name_en: "Ackermann's formula for state feedback gain"
category: 概念性
batch: B
release_tier: gold
tags:
  - gold
  - "Ackermann's"
  - form
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: f2287ce9f186f13991a8e2194cae89ed042fa255a2db76bda74d3141f50d23cc -->

## 首页

# Ackermann's form | Ackermann's formula for state feedback gain

**一句话定义**：Ackermann's form：For a single-input, single-output system, Ackermann's formula is useful for determining the state variable feedback mat…

**核心直觉**：在图谱邻接中可把握：后续 → Controllability matrix。

**关联**：后续 → Controllability matrix

---

## 详情

### 完整解释

For a single-input, single-output system, Ackermann's formula is useful for determining the state variable feedback matrix K. Given the desired characteristic equation q(λ) = λ^n + α_{n-1} λ^{n-1} + ... + α_0, the state feedback gain matrix is K = [0 0 ... 1] P_c^{-1} q(A), where q(A) = A^n + α_{n-1} A^{n-1} + ... + α_1 A + α_0 I and P_c is the controllability matrix.

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 后续 | Controllability matrix | 包含组件 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`gold`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

gold、Ackermann's、form
