---
node_id: ctkg_v3e-object-0eadd6f972de0e7b503343cf
authority_entity_id: "ctkg:v3e-object-0eadd6f972de0e7b503343cf"
name: PID controller d
name_en: PID controller design procedure for spacecraft attitude control
category: 概念性
batch: B
release_tier: gold
tags:
  - gold
  - PID
  - controller
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: b1bf84c7a117a80a1adf2444aba7c14ebb8471bd21b5bf29cca562f8e4763132 -->

## 首页

# PID controller d | PID controller design procedure for spacecraft attitude control

**一句话定义**：PID controller d：The design procedure involves: 1) Adjusting T_D to achieve the desired phase margin (PM) at a reasonably high frequency…

**关联**：（权威图邻接待补充）

---

## 详情

### 完整解释

The design procedure involves: 1) Adjusting T_D to achieve the desired phase margin (PM) at a reasonably high frequency. 2) Setting T_I to a factor of 20 lower than T_D to avoid negatively impacting the phase at crossover. 3) Determining the gain K by plotting the compensated system amplitude with K=1, finding the amplitude value at the desired crossover frequency, and setting 1/K equal to that value.

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| — | — | 权威图中暂无 DomainConcept 邻接 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`gold`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

gold、PID、controller
