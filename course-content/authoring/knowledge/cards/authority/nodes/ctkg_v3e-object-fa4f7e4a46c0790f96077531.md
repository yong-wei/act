---
node_id: ctkg_v3e-object-fa4f7e4a46c0790f96077531
authority_entity_id: "ctkg:v3e-object-fa4f7e4a46c0790f96077531"
name: 衰减曲线法
category: 概念性
batch: B
release_tier: gold
tags:
  - gold
  - 衰减曲线法
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: a876c10d5553dddb9e8e35edd309132d3467c6fd436bc6067adb1549bdb7c842 -->

## 首页

# 衰减曲线法

**一句话定义**：使系统阶跃响应产生衰减振荡，再根据衰减振荡曲线的参数来确定PID参数的方法。

**核心直觉**：工程上认为，系统响应的振荡幅值在一个周期内衰减1/4（衰减比为4:1），对应的阻尼比为ζ=0.21，此时系统的动态性能较适宜。

**关联**：前置 → 衰减比 · 后续 → 比例系数、衰减比、微分时间常数

---

## 详情

### 完整解释

使系统阶跃响应产生衰减振荡，再根据衰减振荡曲线的参数来确定PID参数的方法。工程上认为，系统响应的振荡幅值在一个周期内衰减1/4（衰减比为4:1），对应的阻尼比为ζ=0.21，此时系统的动态性能较适宜。

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 后续 | 比例系数 | 包含组件 |
| 后续 | 衰减比 | 包含组件 |
| 后续 | 微分时间常数 | 包含组件 |
| 前置 | 衰减比 | 关联 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`gold`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

gold、衰减曲线法
