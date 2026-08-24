---
node_id: ctkg_v3e-object-0b94edb93771b955eedd5d9f
authority_entity_id: "ctkg:v3e-object-0b94edb93771b955eedd5d9f"
name: 得到闭环对数幅频和相频曲线
category: 概念性
batch: B
release_tier: gold
tags:
  - gold
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: da8aecf7f477909c5554fc76c43bc0b1a27eece1c92c2681964f41ea022e9a74 -->

## 首页

# 得到闭环对数幅频和相频曲线

**一句话定义**：在已知系统开环传递函数条件下，直接调用命令 feedback 和 bode，可立即得到闭环对数幅频和相频曲线，然后可判读出系统谐振频率 ω_r、谐振峰值 M_r(dB) 及带宽频率 ω_b。

**核心直觉**：在图谱邻接中可把握：前置 → 谐振峰值 · 后续 → 谐振峰值、谐振频率、带宽频率。

**关联**：前置 → 谐振峰值 · 后续 → 谐振峰值、谐振频率、带宽频率

---

## 详情

### 完整解释

在已知系统开环传递函数条件下，直接调用命令 feedback 和 bode，可立即得到闭环对数幅频和相频曲线，然后可判读出系统谐振频率 ω_r、谐振峰值 M_r(dB) 及带宽频率 ω_b。

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 后续 | 谐振峰值 | 用于分析 |
| 后续 | 谐振频率 | 用于分析 |
| 后续 | 带宽频率 | 用于分析 |
| 前置 | 谐振峰值 | 关联 |
| 后续 | 谐振频率 | 关联 |
| 后续 | 带宽频率 | 关联 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`gold`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

gold
