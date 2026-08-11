---
node_id: ctc_modeling-82926f44dbd08d4b847f084c
authority_entity_id: "ctc:modeling-82926f44dbd08d4b847f084c"
name: 根据结构图的信号线明确传递的信…
name_en: modeling_82926f44dbd08d4b847f084c
category: 程序性
coverage_role: formal_objective
batch: A
concept_kind: analysis_method
release_tier: silver
tags:
  - analysis_method
  - silver
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: 842a535390a1341823f0f1b0c38cdbe8fd3c79bdf50e57406eab6af1adf52604 -->

## 首页

# 根据结构图的信号线明确传递的信… | modeling_82926f44dbd08d4b847f084c

**一句话定义**：根据结构图的信号线明确传递的信号得到节点，用标有传递函数的线段代替结构图中的方框得到支路。

**核心直觉**：应尽量精简节点数目，支路增益为1的相邻两个节点一般可合并，但源节点或阱节点不能合并。

**关联**：（权威图邻接待补充）

---

## 详情

### 完整解释

根据结构图的信号线明确传递的信号得到节点，用标有传递函数的线段代替结构图中的方框得到支路。应尽量精简节点数目，支路增益为1的相邻两个节点一般可合并，但源节点或阱节点不能合并；比较点之前无引出点时只在比较点后设一个节点，有引出点时在引出点和比较点各设一个节点，其间支路增益为1。

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| — | — | 权威图中暂无 DomainConcept 邻接 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`analysis_method`，release_tier=`silver`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

analysis_method、silver
