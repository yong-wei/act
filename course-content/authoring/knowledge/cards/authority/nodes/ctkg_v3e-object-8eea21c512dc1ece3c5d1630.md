---
node_id: ctkg_v3e-object-8eea21c512dc1ece3c5d1630
authority_entity_id: "ctkg:v3e-object-8eea21c512dc1ece3c5d1630"
name: 临界比例度法
category: 概念性
batch: B
release_tier: gold
tags:
  - gold
  - 临界比例度法
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: 2a7d21bbabd5dd24f3e0752380c0c4638b3abdb843016a04f7643e90ab384919 -->

## 首页

# 临界比例度法

**一句话定义**：一种经典的PID参数整定方法，首先设PID控制器的积分时间系数Ti=∞，微分时间系数Td=0，比例系数设为较小的值；然后增大Kp，观察系统的输出曲线，当系统输出出现等幅振荡时记下临界比例值Km及振荡周期Tc；然后按经验数据表调整比例系数、…

**核心直觉**：然后增大Kp，观察系统的输出曲线，当系统输出出现等幅振荡时记下临界比例值Km及振荡周期Tc。

**关联**：（权威图邻接待补充）

---

## 详情

### 完整解释

一种经典的PID参数整定方法，首先设PID控制器的积分时间系数Ti=∞，微分时间系数Td=0，比例系数设为较小的值；然后增大Kp，观察系统的输出曲线，当系统输出出现等幅振荡时记下临界比例值Km及振荡周期Tc；然后按经验数据表调整比例系数、积分和微分时间常数。

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| — | — | 权威图中暂无 DomainConcept 邻接 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`unknown`，release_tier=`gold`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

gold、临界比例度法
