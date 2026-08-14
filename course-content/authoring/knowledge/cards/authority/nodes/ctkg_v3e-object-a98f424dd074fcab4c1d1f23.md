---
node_id: ctkg_v3e-object-a98f424dd074fcab4c1d1f23
authority_entity_id: "ctkg:v3e-object-a98f424dd074fcab4c1d1f23"
name: Symmetric Root Locus (SRL) Method
category: 概念性
batch: B
release_tier: silver
tags:
  - silver
  - Symmetric
  - Root
  - Locus
  - (SRL)
  - Method
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: bd5871165c0657fb1850783c4bc11b2c6507fcb9ded16b393df87573fc519f62 -->

## 首页

# Symmetric Root Locus (SRL) Method

**一句话定义**：Symmetric Root Locus (SRL) Method：A technique for linear control systems design based on the optimal linear quadratic regulator (LQR) problem. The optima…

**核心直觉**：在图谱邻接中可把握：后续 → Linear Quadratic Regulator (LQR)。

**关联**：后续 → Linear Quadratic Regulator (LQR)

---

## 详情

### 完整解释

A technique for linear control systems design based on the optimal linear quadratic regulator (LQR) problem. The optimal closed-loop poles are chosen by selecting the matrix C1, which defines the tracking error, and then choosing ρ, which balances the importance of this tracking error against the control effort. The closed-loop poles are placed at the stable roots of the symmetric root-locus equation 1+ρ G0(-s) G0(s)=0.

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 后续 | Linear Quadratic Regulator (LQR) | 应用于 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`silver`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

silver、Symmetric、Root、Locus、(SRL)、Method
