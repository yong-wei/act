---
node_id: ctkg_v3e-object-f1df5739a34bf55489aeeeeb
authority_entity_id: "ctkg:v3e-object-f1df5739a34bf55489aeeeeb"
name: 校正装置
category: 概念性
batch: B
release_tier: silver
tags:
  - silver
  - 校正装置
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: 3ccb4da274b20d9e7e5c590176425296c2c8c9baf9e9e22de97f7d9e6a718dc7 -->

## 首页

# 校正装置

**一句话定义**：如果通过调整放大器增益后仍然不能全面满足设计要求的性能指标，就需要在系统中增加一些参数及特性可按需要改变的校正装置，使系统性能全面满足设计要求。

**核心直觉**：在图谱邻接中可把握：前置 → PID控制器、前馈校正、反馈校正。

**关联**：前置 → PID控制器、前馈校正、反馈校正

---

## 详情

### 完整解释

如果通过调整放大器增益后仍然不能全面满足设计要求的性能指标，就需要在系统中增加一些参数及特性可按需要改变的校正装置，使系统性能全面满足设计要求。

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 前置 | PID控制器 | 是一种 |
| 前置 | 前馈校正 | 是一种 |
| 前置 | 反馈校正 | 是一种 |
| 前置 | 复合校正 | 是一种 |
| 前置 | 串联校正 | 是一种 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`silver`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

silver、校正装置
