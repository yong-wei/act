---
node_id: ctkg_v3e-object-b0cbf122498bca9269e55406
authority_entity_id: "ctkg:v3e-object-b0cbf122498bca9269e55406"
name: "延迟环节"
name_en: "Delay Element"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-e4963f54a478cbc04c87a194dbb646d4fabd812074ec21fd9f0e9c710b43f4db.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-e4963f54a478cbc04c87a194dbb646d4fabd812074ec21fd9f0e9c710b43f4db.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-b0cbf122498bca9269e55406.md"
asset_refs: []
---

## 首页

# 延迟环节 | Delay Element

**一句话定义**：输出保持输入波形形状、仅整体延后固定时间的理想环节。

**核心直觉**：它不衰减幅值，却在频域给每个频率增加 −ωT 的相位滞后。

**关键公式**：
$$
G_d(s)=e^(−sT_d)
$$

**学习目标**：从时域波形和频域相位两面识别延迟环节。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

理想延迟环节不改变输入波形，只把每个事件向后搬移。与一阶滞后不同，它的幅值恒为 1；与采样延迟不同，它在这里是连续时间理想模型。延迟进入反馈环路后会直接减少稳定裕度。

请同时检查结果的正负号、数量级和归一化；若与直觉冲突，应优先回查输入类型、通道位置和初始条件。

### 教学计算/推理例

取 T_d=0.25 s，输入脉冲在 1.0–2.0 s 之间为 1，则输出在 1.25–2.25 s 之间为 1。在 ω=4 rad/s，幅值为 1、相位滞后为 −1 rad。

### 适用条件与边界

要求纯延迟、因果输入和固定时间。若存在滤波、运输扩散或采样保持，应把其他动态另列。

### 自检

1. 延迟环节的幅值随频率变化吗？
2. T_d=0.25、ω=4 时相位是多少？

**核对要点**：理想情况下不变，始终为 1；为 −1 rad。

### 关联节点

- **单位采样延迟环节**（出边，关系：相关）
