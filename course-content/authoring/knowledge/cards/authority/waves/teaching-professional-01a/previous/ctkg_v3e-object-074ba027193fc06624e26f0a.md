---
node_id: ctkg_v3e-object-074ba027193fc06624e26f0a
authority_entity_id: "ctkg:v3e-object-074ba027193fc06624e26f0a"
name: Nyquist-Shannon sampling theorem
category: 概念性
batch: B
release_tier: gold
tags:
  - gold
  - sampling
  - theorem
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: 9166b43709a1880ab4729a6c47142f2256bb71165f5ebfceaf3cd7a85b458d57 -->

## 首页

# Nyquist-Shannon sampling theorem

**一句话定义**：Nyquist-Shannon sampling theorem：A theorem stating that for a signal to be accurately reconstructed from samples, it must have no frequency component gr…

**核心直觉**：在图谱邻接中可把握：前置 → aliasing · 后续 → Nyquist rate。

**关联**：前置 → aliasing · 后续 → Nyquist rate

---

## 详情

### 完整解释

A theorem stating that for a signal to be accurately reconstructed from samples, it must have no frequency component greater than half the sample rate (ω_s/2); the highest frequency that can be unambiguously represented by discrete samples is the Nyquist rate of ω_s/2.

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 后续 | Nyquist rate | 包含组件 |
| 前置 | aliasing | 应用于 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`gold`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

gold、sampling、theorem
