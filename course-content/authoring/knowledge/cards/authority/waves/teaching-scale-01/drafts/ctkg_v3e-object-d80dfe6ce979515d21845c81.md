---
node_id: ctkg_v3e-object-d80dfe6ce979515d21845c81
authority_entity_id: "ctkg:v3e-object-d80dfe6ce979515d21845c81"
name: "串联滞后-超前校正"
name_en: "Cascade Lag-Lead Compensation"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-8677504b988904be14627ec17514ab41b0b2d67bc951c28521a300cf4d58e1ce.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-8677504b988904be14627ec17514ab41b0b2d67bc951c28521a300cf4d58e1ce.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-d80dfe6ce979515d21845c81.md"
asset_refs: []
---

## 首页

# 串联滞后-超前校正 | Cascade Lag-Lead Compensation

**一句话定义**：在串联网络中同时利用超前部分改善相位和速度、滞后部分改善低频精度的校正方法。

**核心直觉**：先用超前段提供相位，再用滞后段补低频；两个频段应分开设计并整体复核。

**关键公式**：
$$
D(s)=D_lead(s)D_lag(s)
$$

**学习目标**：按指标拆分超前和滞后职责，计算组合增益并验证交越、裕度和时域响应。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

滞后-超前校正不是把两张公式表机械相乘。超前段通常影响中频相位和交越，滞后段把增益集中在低频；两段的交接频率、额外相位和高频增益会互相影响，所以必须用组合后的完整环路重算。

### 教学计算/推理例

取 D_lead=(1+0.25s)/(1+0.05s)、D_lag=(1+10s)/(1+50s)。直流增益为 1，高频增益趋于 (0.25/0.05)×(10/50)=1；其余性能要按完整频率响应验证。

### 适用条件与边界

适用于线性定常近似和明确的双重指标。频段重叠、噪声或执行器约束明显时，分段初算只能作为起点。

### 自检

1. 组合补偿器的总传递函数如何得到？
2. 只验证滞后段低频增益是否足够吗？

**核对要点**：为两个子网络相乘；不够，还要验证组合后的相位、交越、时域和高频动作。

### 关联节点

- **利用滞后-超前网络的超前部分来增大系统的相角裕度，同时利用滞后部分来改善系统的稳态性能。**（入边，关系：适用于）
- **相位滞后补偿器**（出边，关系：包含）
- **兼有滞后校正和超前校正的优点，即已校正系统响应速度较快，超调量较小，抑制高频噪声的性能也较好。**（入边，关系：适用于）
- **相位超前补偿器**（出边，关系：包含）
