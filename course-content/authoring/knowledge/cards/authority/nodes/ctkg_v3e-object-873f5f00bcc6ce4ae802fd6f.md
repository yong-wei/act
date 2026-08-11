---
node_id: ctkg_v3e-object-873f5f00bcc6ce4ae802fd6f
authority_entity_id: "ctkg:v3e-object-873f5f00bcc6ce4ae802fd6f"
name: z-transform
category: 概念性
batch: B
release_tier: gold
tags:
  - gold
  - z-transform
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: c8b153bff16cb6deb9f6a3e0fcadbaf0ba81101292218431c3e7dfb0233150e1 -->

## 首页

# z-transform

**一句话定义**：z-transform：A transform defined as Z{r(t)} = Z{r*(t)} = sum_{k=0}^{∞} r(kT) z^{-k}, where z = e^{sT}.

**核心直觉**：在图谱邻接中可把握：前置 → First-Order Plant Discrete Model、开环脉冲传递函数 · 后续 → Laplace transform、conformal mapping。

**关联**：前置 → First-Order Plant Discrete Model、开环脉冲传递函数 · 后续 → Laplace transform、conformal mapping

---

## 详情

### 完整解释

A transform defined as Z{r(t)} = Z{r*(t)} = sum_{k=0}^{∞} r(kT) z^{-k}, where z = e^{sT}.

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 前置 | First-Order Plant Discrete Model | 派生自 |
| 前置 | 开环脉冲传递函数 | 派生自 |
| 后续 | Laplace transform | 关联 |
| 后续 | conformal mapping | 关联 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`gold`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

gold、z-transform
