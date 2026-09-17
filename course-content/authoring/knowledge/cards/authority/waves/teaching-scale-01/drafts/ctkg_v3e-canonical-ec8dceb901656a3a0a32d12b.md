---
node_id: ctkg_v3e-canonical-ec8dceb901656a3a0a32d12b
authority_entity_id: "ctkg:v3e-canonical-ec8dceb901656a3a0a32d12b"
name: "稳定性"
name_en: "Stability"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-b9e6ef9dc0108ba4e981d23b358388df9f567591bf9ac25b434fa7e4a462a1ab.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-b9e6ef9dc0108ba4e981d23b358388df9f567591bf9ac25b434fa7e4a462a1ab.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-ec8dceb901656a3a0a32d12b.md"
asset_refs: []
---

## 首页

# 稳定性 | Stability

**一句话定义**：系统在无界时间内对扰动和初始状态保持有界或自由响应衰减的性质。

**核心直觉**：连续系统看极点实部，离散系统看单位圆；“稳定”必须先说明模型和稳定定义。

**关键公式**：
$$
\text{continuous LTI: }\operatorname{Re}(p_i)<0;\qquad \text{discrete LTI: }|z_i|<1
$$

**学习目标**：用闭环极点或相应判据判断稳定性，并区分渐近、临界和 BIBO 语境。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

对连续有限维 LTI，闭环极点严格在左半平面时自由响应衰减；右半平面极点产生增长模态，虚轴情形需要检查重数和输入输出。稳定性属于动态结论，不能由反馈负号、增益大小或某一个时刻的曲线单独证明。

### 教学计算/推理例

极点为 −1±j2 时包络 e^(−t) 衰减，系统渐近稳定；若有极点 +0.1，自由模态 e^(0.1t) 增长，系统不稳定。离散极点 z=0.8 则因 |z|=0.8<1 而稳定。

### 适用条件与边界

需说明连续或离散、内部或输入输出稳定，以及是否存在不稳定模态消去。临界稳定和重复虚轴极点不能直接归为严格稳定。

### 自检

1. 极点 −1+j2 的实部说明什么？
2. 离散极点 z=1.1 是否稳定？

**核对要点**：实部 −1 使包络衰减；不稳定，因其模大于 1。

### 关联节点

- **运动稳定性**（出边，关系：前置于）
- **大范围稳定系统**（出边，关系：前置于）
- **中性稳定**（出边，关系：前置于）
- **平衡状态稳定性**（出边，关系：前置于）
- **临界稳定**（出边，关系：前置于）
