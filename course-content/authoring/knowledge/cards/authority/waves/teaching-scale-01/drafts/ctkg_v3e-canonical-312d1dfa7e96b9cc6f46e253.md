---
node_id: ctkg_v3e-canonical-312d1dfa7e96b9cc6f46e253
authority_entity_id: "ctkg:v3e-canonical-312d1dfa7e96b9cc6f46e253"
name: "单位阶跃响应"
name_en: "Unit-Step Response"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-54574d1fca4e8c34cdc1cde7b9b37f02d72c3c1986ee01d522bc12562524536c.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-54574d1fca4e8c34cdc1cde7b9b37f02d72c3c1986ee01d522bc12562524536c.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-312d1dfa7e96b9cc6f46e253.md"
asset_refs: []
---

## 首页

# 单位阶跃响应 | Unit-Step Response

**一句话定义**：以单位阶跃函数作为输入时系统随时间的输出响应。

**核心直觉**：阶跃在 t=0 突然改变目标，响应曲线同时展示速度、超调和最终值。

**关键公式**：
$$
R(s)=1/s,  Y(s)=G(s)/s
$$

**学习目标**：由传递函数写出单位阶跃响应，并标出初始、峰值和终值的定义。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

单位阶跃响应是时域比较的共同基准。对零初始、线性定常系统，输出拉氏变换为 G(s)/s；若系统有初始状态、偏置或非单位输入，必须在公式中加以说明。

### 教学计算/推理例

取 G(s)=1/(0.5s+1)，则 y(t)=1−e^(−2t)。在 t=0.5 s 时 y=1−e^(−1)≈0.6321，终值为 1。

### 适用条件与边界

适用于线性定常、零初始和阶跃幅值为 1 的模型。非线性、时变或饱和状态下，需说明该响应只是某个工作点实验。

### 自检

1. 上述一阶响应在 t=1 s 的输出是多少？
2. 单位阶跃响应能否直接给出任意输入的响应？

**核对要点**：约为 0.8647；仅在线性叠加条件下可用卷积或分解得到其他输入响应。

### 关联节点

- **单位阶跃响应曲线**（入边，关系：相关）
- **高阶系统解析阶跃响应**（入边，关系：相关）
- **一阶系统的单位阶跃响应**（入边，关系：属于）
- **单位阶跃函数**（出边，关系：由此得到）
