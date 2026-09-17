---
node_id: ctkg_v3e-object-18dc6cccc99e95f3ae794561
authority_entity_id: "ctkg:v3e-object-18dc6cccc99e95f3ae794561"
name: aliasing
category: 概念性
batch: B
release_tier: gold
tags:
  - gold
  - aliasing
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: 6bbd10ad5d9f3161458139648d6fce42fab3259e778184943eeff28b7fa80e06 -->

## 首页

# aliasing

**一句话定义**：aliasing：The phenomenon where high-frequency noise is modulated to a lower frequency by the sampling process, occurring when the…

**核心直觉**：在图谱邻接中可把握：前置 → anti-alias prefilter · 后续 → Nyquist-Shannon sampling theorem。

**关联**：前置 → anti-alias prefilter · 后续 → Nyquist-Shannon sampling theorem

---

## 详情

### 完整解释

The phenomenon where high-frequency noise is modulated to a lower frequency by the sampling process, occurring when the sample rate is not at least twice as fast as any of the frequencies in the signal being sampled.

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 前置 | anti-alias prefilter | 用于分析 |
| 后续 | Nyquist-Shannon sampling theorem | 应用于 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`gold`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

gold、aliasing
