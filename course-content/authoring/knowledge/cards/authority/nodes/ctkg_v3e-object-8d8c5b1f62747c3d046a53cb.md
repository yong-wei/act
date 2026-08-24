---
node_id: ctkg_v3e-object-8d8c5b1f62747c3d046a53cb
authority_entity_id: "ctkg:v3e-object-8d8c5b1f62747c3d046a53cb"
name: 系统不可观测
category: 概念性
batch: B
release_tier: gold
tags:
  - gold
  - 系统不可观测
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: bc262c0328168d42e3d88dbabe7612fedc9988486758b82b20d91d8765785a85 -->

## 首页

# 系统不可观测

**一句话定义**：对于式（9－81）所示线性时变系统，如果取定初始时刻 t0∈Tt，存在一个有限时刻 t1∈Tt, t1>t0，对于所有 t∈[t0, t1]，系统的输出 y(t) 不能唯一确定所有状态的初值 xi(t0), i=1,2,⋯,n，即至少有一…

**核心直觉**：在图谱邻接中可把握：前置 → 否包含元素全…、对角线规范型判据 · 后续 → 可观测性。

**关联**：前置 → 否包含元素全…、对角线规范型判据 · 后续 → 可观测性

---

## 详情

### 完整解释

对于式（9－81）所示线性时变系统，如果取定初始时刻 t0∈Tt，存在一个有限时刻 t1∈Tt, t1>t0，对于所有 t∈[t0, t1]，系统的输出 y(t) 不能唯一确定所有状态的初值 xi(t0), i=1,2,⋯,n，即至少有一个状态的初值不能被 y(t) 确定，则称系统在时间区间 [t0, t1] 内是不完全可观测的，简称系统不可观测。

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 后续 | 可观测性 | 属于 |
| 前置 | 否包含元素全… | 应用于 |
| 前置 | 对角线规范型判据 | 应用于 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`gold`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

gold、系统不可观测
