---
node_id: ctkg_v3e-object-c437a7c8ef65d5677ad5c387
authority_entity_id: "ctkg:v3e-object-c437a7c8ef65d5677ad5c387"
name: "补偿"
name_en: "Compensation"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-6e4b0b9bd47b3dc19b522bb267273b23e6efc9629430b078b4bd49b98127ad24.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-6e4b0b9bd47b3dc19b522bb267273b23e6efc9629430b078b4bd49b98127ad24.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-c437a7c8ef65d5677ad5c387.md"
asset_refs: []
---

## 首页

# 补偿 | Compensation

**一句话定义**：为使控制系统达到适宜性能而进行的结构或参数调整。

**核心直觉**：补偿是设计行动，必须从性能缺口出发，再选择低频、中频或高频的改变位置。

**关键公式**：
$$
L_new(s)=D_c(s)G(s)H(s)
$$

**学习目标**：根据目标指标选择补偿方向，并比较校正前后的完整闭环表现。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

补偿可以通过串联、反馈、输入或输出结构改变系统。它不是单一元件名称，也不能只用“响应更快”描述；补偿后要同时复核稳态误差、超调、相位裕度、控制量和噪声。

### 教学计算/推理例

单位反馈 G=1/(s+1) 无补偿时闭环为 1/(s+2)，单位阶跃静差为 0.5。串联常数补偿 D_c=4 后闭环为 4/(s+5)，静差为 0.2；这只是名义模型上的一个目标改进。

### 适用条件与边界

需先写性能指标、信号位置、可用元件和约束。结构变化可能改变不同扰动通道，不能只比较一个参考阶跃。

### 自检

1. 补偿和补偿器是同一个层级的词吗？
2. 上例串联 D_c=4 后静差是多少？

**核对要点**：不是，补偿是设计行为，补偿器是实现该行为的附加环节；为 0.2。

### 关联节点

- **输出补偿**（出边，关系：前置于）
- **输入补偿**（出边，关系：前置于）
- **反馈补偿**（出边，关系：前置于）
- **输入补偿**（入边，关系：属于）
- **校正方案（串联校正、反馈校正、输出校正、输入校正）的选择取决于性能指标要求、各信号节点的功率电平以及可用的校正网络。**（入边，关系：适用于）
