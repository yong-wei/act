---
node_id: ctkg_v3e-object-e1caec9f68da5c573be699d5
authority_entity_id: "ctkg:v3e-object-e1caec9f68da5c573be699d5"
name: "串联校正"
name_en: "Cascade Compensation"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: draft
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-96151abaaa346ff4f9a8c92d0c8193ec3288cd1bb0acd88ec80f344e0ada2626.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-96151abaaa346ff4f9a8c92d0c8193ec3288cd1bb0acd88ec80f344e0ada2626.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-e1caec9f68da5c573be699d5.md"
asset_refs: []
---

## 首页

# 串联校正 | Cascade Compensation

**一句话定义**：把校正装置串接在误差点之后、前向通道中的补偿方式。

**核心直觉**：串联补偿直接改变前向环路增益，位置和信号功率决定它能否真实实现。

**关键公式**：
$$
L(s)=D_c(s)G(s)H(s)
$$

**学习目标**：从串联位置写出新环路，并分别检查参考、扰动和噪声通道。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

串联校正把 D_c 放在前向通道，原对象与反馈通道的动态仍保留。它常用于调低频增益、加相位或限高频，但执行器前的幅值变化也会改变饱和和噪声风险。

请同时检查结果的正负号、数量级和归一化；若与直觉冲突，应优先回查输入类型、通道位置和初始条件。

### 教学计算/推理例

取 G=1/(s+1)、H=1、D_c=2。新开环为 2/(s+1)，闭环为 2/(s+3)，单位阶跃终值为 2/3、静差为 1/3；无补偿时静差为 1/2。

### 适用条件与边界

需要明确串联点、信号单位、补偿器可实现性和闭环稳定。反馈校正或输入校正不能直接套用相同分子。

### 自检

1. D_c=2 放在前向通道后，闭环分母是什么？
2. 串联补偿只改变静差而不改变极点吗？

**核对要点**：为 s+3；不一定，环路增益改变会改变闭环特征方程。

### 关联节点

- **校正装置**（入边，关系：前置于）
- **校正装置**（出边，关系：属于）
