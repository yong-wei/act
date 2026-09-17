---
node_id: ctkg_v3e-object-d80dfe6ce979515d21845c81
authority_entity_id: "ctkg:v3e-object-d80dfe6ce979515d21845c81"
name: 串联滞后-超前校正
category: 概念性
batch: B
release_tier: gold
tags:
  - gold
  - 串联滞后-超前校正
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: 26eb92254b760195778eb1ec66cf2140d6de2ed30227b56341878cb15b5096f5 -->

## 首页

# 串联滞后-超前校正

**一句话定义**：这种校正方法兼有滞后校正和超前校正的优点，即已校正系统响应速度较快，超调量较小，抑制高频噪声的性能也较好。

**核心直觉**：其基本原理是利用滞后-超前网络的超前部分来增大系统的相角裕度，同时利用滞后部分来改善系统的稳态性能。

**关联**：后续 → Phase-Lead Compensator、Phase-Lag Compensator

---

## 详情

### 完整解释

这种校正方法兼有滞后校正和超前校正的优点，即已校正系统响应速度较快，超调量较小，抑制高频噪声的性能也较好。其基本原理是利用滞后-超前网络的超前部分来增大系统的相角裕度，同时利用滞后部分来改善系统的稳态性能。

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 后续 | Phase-Lead Compensator | 包含组件 |
| 后续 | Phase-Lag Compensator | 包含组件 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`gold`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

gold、串联滞后-超前校正
