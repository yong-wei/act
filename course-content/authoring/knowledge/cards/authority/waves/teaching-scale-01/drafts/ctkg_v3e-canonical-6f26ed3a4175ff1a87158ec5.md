---
node_id: ctkg_v3e-canonical-6f26ed3a4175ff1a87158ec5
authority_entity_id: "ctkg:v3e-canonical-6f26ed3a4175ff1a87158ec5"
name: "加速度误差常数 (K_a)"
name_en: "Acceleration Error Constant"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-9404b9667875d0dfb6fe72ff121ac90ce18fd7707d9c57ef6e8f09e0f6af8911.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-9404b9667875d0dfb6fe72ff121ac90ce18fd7707d9c57ef6e8f09e0f6af8911.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-6f26ed3a4175ff1a87158ec5.md"
asset_refs: []
---

## 首页

# 加速度误差常数 (K_a) | Acceleration Error Constant

**一句话定义**：Ⅱ型系统对单位加速度输入 t²/2 的低频系数 Ka。

**核心直觉**：输入再高一阶，低频需要再多一个积分器才能把误差压到有限常值。

**关键公式**：
$$
Ka=lim(s→0)s²L(s),  e_ss(acceleration)=1/Ka
$$

**学习目标**：判断系统型别并计算 Ka，避免将单位加速度与普通二次输入混淆。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

Ka 是静态误差系数中对应二次增长输入的一项。它不等于“加速度对象参数”，而是完整环路在原点附近的极限。即便 Ka 给出有限误差，也必须检查闭环稳定和控制量。

复核时还要把公式中的每个量与实际信号一一对应，检查单位是否一致、极限是否存在，并区分“该模型下算得出”与“工程上可以直接采用”。

### 教学计算/推理例

取 L(s)=12/[s²(s+3)]，则 Ka=12/3=4。单位加速度输入 r=t²/2 的理想稳态误差为 1/4=0.25。

### 适用条件与边界

假设单位反馈、输入按 t²/2 归一化、闭环稳定且稳态误差存在。扰动通道和非单位反馈要从完整误差传递函数开始。

### 自检

1. L(s)=12/[s²(s+3)] 的 Ka 是多少？
2. Ka=0 时能否声称加速度输入误差为 0？

**核对要点**：为 4；不能，Ka=0 表示该理想静差公式不产生有限零误差。

### 关联节点

- 当前权威邻域仅返回该节点本身，未添加推测关系。
