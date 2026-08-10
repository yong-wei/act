---
node_id: ctkg_v3e-object-1b7b0dc48c95ff419467dd86
authority_entity_id: "ctkg:v3e-object-1b7b0dc48c95ff419467dd86"
name: 模拟信号
category: 概念性
batch: B
release_tier: gold
tags:
  - gold
  - 模拟信号
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: f2b65548169a963353850b56ae2777951754542985fc85714d2e215c06b4b9c3 -->

## 首页

# 模拟信号

**一句话定义**：测量元件、执行元件和被控对象是模拟元件，其输入和输出是连续信号，即时间上和幅值上都连续的信号，称为模拟信号。

**核心直觉**：在图谱邻接中可把握：前置 → 阶梯信号、采样控制系统、数字控制系统 · 后续 → A/D转换器、D/A转换器。

**关联**：前置 → 阶梯信号、采样控制系统、数字控制系统 · 后续 → A/D转换器、D/A转换器

---

## 详情

### 完整解释

测量元件、执行元件和被控对象是模拟元件，其输入和输出是连续信号，即时间上和幅值上都连续的信号，称为模拟信号。

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| 前置 | 阶梯信号 | 是一种 |
| 前置 | 采样控制系统 | 包含组件 |
| 前置 | 数字控制系统 | 包含组件 |
| 前置 | 采样过程 | 关联 |
| 后续 | A/D转换器 | 关联 |
| 后续 | D/A转换器 | 关联 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`gold`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

gold、模拟信号
