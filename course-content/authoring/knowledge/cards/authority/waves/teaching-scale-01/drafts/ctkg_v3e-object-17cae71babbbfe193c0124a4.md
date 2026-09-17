---
node_id: ctkg_v3e-object-17cae71babbbfe193c0124a4
authority_entity_id: "ctkg:v3e-object-17cae71babbbfe193c0124a4"
name: "积分补偿器"
name_en: "Integral Compensator"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-026066555686222528d2d9d0ecd4372475d8fdb19a9cc2b2acf22d188fb35744.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-026066555686222528d2d9d0ecd4372475d8fdb19a9cc2b2acf22d188fb35744.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-17cae71babbbfe193c0124a4.md"
asset_refs: []
---

## 首页

# 积分补偿器 | Integral Compensator

**一句话定义**：以积分环节提高低频增益、改善低阶多项式输入稳态误差的补偿器。

**核心直觉**：积分器能积累误差推动长期偏差归零，但也带来相位损失和饱和累积风险。

**关键公式**：
$$
G_c(s)=K_I/s
$$

**学习目标**：计算积分器引入的原点极点和稳态效果，并检查闭环极点及抗饱和。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

积分补偿器的输出与误差的时间积分成正比。它提高低频环路增益，常用于消除常值静差；但积分器会增加系统阶次并可能引起振荡，执行器饱和时还会出现积分累积。

### 教学计算/推理例

取 K_I=2、对象 G=1/(s+1)、单位反馈，闭环特征多项式为 s²+s+2，单位阶跃在稳定前提下终值为 1。该多项式的两个极点实部为 −0.5，说明要用动态指标继续检查其振荡程度。

### 适用条件与边界

需确认闭环稳定、积分初值、执行器范围和抗饱和策略。不能把“零静差”当成不需要调节或不产生超调。

### 自检

1. 积分器为什么能提升低频增益？
2. 上例闭环特征多项式是什么？

**核对要点**：因为其幅值在低频随 1/ω 增长；为 s²+s+2。

### 关联节点

- **补偿器**（入边，关系：前置于）
- **根轨迹（单参数）**（入边，关系：用于分析）
- **比例积分控制器**（入边，关系：属于）
- **补偿器**（出边，关系：属于）
